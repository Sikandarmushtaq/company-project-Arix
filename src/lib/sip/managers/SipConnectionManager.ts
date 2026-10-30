/**
 * SIP Connection Manager
 *
 * Handles WebSocket connection, SIP registration, reconnection logic,
 * network status detection, and tab visibility recovery.
 *
 * @module lib/sip/managers/SipConnectionManager
 */

import {
  UserAgent,
  Registerer,
  RegistererState,
  type UserAgentOptions,
  type Invitation,
} from 'sip.js';

import { getPeerConnectionConfig, fetchTurnCredentials } from '../config';
import { createFireOnRelaySdhFactory } from './fireOnRelaySdhFactory';
import { SipError, SipErrorCode, ConnectionError, MediaError } from '../errors';
import type { SipCredentials, SipConnectionState } from '../types';
import type { SipManagerContext } from './types';
import type { SipMediaManager } from './SipMediaManager';
import type { SipFailoverManager } from './SipFailoverManager';
import type { SipCallManager } from './SipCallManager';
import { sipLogger as logger } from '../logger';
import { isClientDebugEnabled } from '../../clientDebug';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const INSTANCE_STORAGE_KEY = 'sip_instance_id';

/**
 * Get or create a unique RFC 5626 instance ID per browser.
 * Uses localStorage so all tabs share ONE instance ID — prevents
 * multi-tab registration competition that causes inbound call routing
 * to pick a stale/background tab's contact in Kamailio usrloc.
 */
function getOrCreateInstanceId(): string {
  if (typeof window !== 'undefined' && window.localStorage) {
    const existing = localStorage.getItem(INSTANCE_STORAGE_KEY);
    if (existing && UUID_REGEX.test(existing)) return existing;
  }
  const id = crypto.randomUUID();
  if (typeof window !== 'undefined' && window.localStorage) {
    localStorage.setItem(INSTANCE_STORAGE_KEY, id);
  }
  return id;
}

/**
 * Create an inline Web Worker for registration keepalive.
 * Web Worker timers are NOT throttled by Chrome's background tab policy,
 * ensuring the registration refresh fires on time even when the tab is hidden.
 */
function createKeepaliveWorker(): Worker | null {
  if (typeof Worker === 'undefined') return null;
  const code = `
    let timerId = null;
    self.onmessage = function(e) {
      if (e.data.command === 'start') {
        if (timerId) clearInterval(timerId);
        timerId = setInterval(function() {
          self.postMessage('tick');
        }, e.data.interval);
      } else if (e.data.command === 'stop') {
        if (timerId) { clearInterval(timerId); timerId = null; }
      }
    };
  `;
  try {
    const blob = new Blob([code], { type: 'application/javascript' });
    return new Worker(URL.createObjectURL(blob));
  } catch {
    return null;
  }
}

export class SipConnectionManager {
  private ctx: SipManagerContext;
  private mediaManager: SipMediaManager;
  private failoverManager: SipFailoverManager;
  private callManager: SipCallManager | null = null; // Set after construction

  // Core SIP objects
  private userAgent: UserAgent | null = null;
  private registerer: Registerer | null = null;
  private credentials: SipCredentials | null = null;

  // Connection state
  private _connectionState: SipConnectionState = 'disconnected';
  private _isRegistered = false;

  // Connection intent — the single source of truth for whether the SIP layer
  // SHOULD be connected. Set to 'connected' by connect(), and to 'disconnected'
  // by markIntentDisconnected() (logout / teardown). EVERY (re)connect and
  // (re)register path checks this, so an explicit logout can never be followed
  // by an auto re-register — whether from the transport-close handler firing
  // during userAgent.stop(), failover, the keepalive worker, tab-visibility, or
  // a network 'online' event. This is the fix for "incoming calls still ring
  // after logout": the credentials persist after disconnect, so without this
  // gate any of those triggers would re-register the extension.
  private connectionIntent: 'connected' | 'disconnected' = 'disconnected';

  // Reconnection
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private registrationRetryTimer: ReturnType<typeof setTimeout> | null = null;

  // Registration listener handler (stored for cleanup)
  private registrationStateHandler: ((state: RegistererState) => void) | null = null;

  // Network status
  private _isOnline: boolean = typeof navigator !== 'undefined' ? navigator.onLine : true;
  private wasConnectedBeforeOffline = false;
  private onlineHandler: (() => void) | null = null;
  private offlineHandler: (() => void) | null = null;

  // Registration resilience: Web Worker keepalive + visibility recovery
  private keepaliveWorker: Worker | null = null;
  private visibilityHandler: (() => void) | null = null;
  private _lastRegistrationTime = 0;
  /** Consecutive failed liveness probes — a link is declared dead only past the threshold. */
  private consecutiveHeartbeatFailures = 0;

  constructor(
    ctx: SipManagerContext,
    mediaManager: SipMediaManager,
    failoverManager: SipFailoverManager
  ) {
    this.ctx = ctx;
    this.mediaManager = mediaManager;
    this.failoverManager = failoverManager;
    this.setupNetworkListeners();
    this.setupVisibilityListener();
  }

  /**
   * Set the call manager reference (breaks circular init dependency)
   */
  setCallManager(callManager: SipCallManager): void {
    this.callManager = callManager;
  }

  // Getters
  get connectionState(): SipConnectionState {
    return this._connectionState;
  }

  get isRegistered(): boolean {
    return this._isRegistered;
  }

  get isOnline(): boolean {
    return this._isOnline;
  }

  getUserAgent(): UserAgent | null {
    return this.userAgent;
  }

  getCredentials(): SipCredentials | null {
    return this.credentials;
  }

  get lastRegistrationTime(): number {
    return this._lastRegistrationTime;
  }

  /**
   * Pre-call registration probe. If last successful registration was >60s ago,
   * force a fresh REGISTER and wait for 200 OK before proceeding.
   * Returns true if registered, false if re-registration failed.
   */
  async ensureRegistered(): Promise<boolean> {
    if (!this.registerer || !this.userAgent) return false;

    const elapsed = Date.now() - this._lastRegistrationTime;
    if (this._isRegistered && elapsed < 60_000) return true;

    logger.info(`Pre-call registration probe (last reg ${Math.round(elapsed / 1000)}s ago)`);
    // Bound the ENTIRE probe (the register() SEND *and* the wait for the Registered
    // callback). Previously only the wait was bounded — a register() that hung on a
    // zombie transport would hang ensureRegistered → placeOutboundCall → makeCall,
    // sticking the dialer's call lock. One deadline covers both, with cleanup.
    let interval: ReturnType<typeof setInterval> | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    try {
      await new Promise<void>((resolve, reject) => {
        timer = setTimeout(() => reject(new Error('Registration probe timeout')), 6000);
        // If the REGISTER send itself fails (e.g. transport closed), fail fast.
        this.registerer!.register().catch((e) => reject(e));
        if (this._isRegistered) return resolve();
        interval = setInterval(() => {
          if (this._isRegistered) resolve();
        }, 100);
      });
      return true;
    } catch (error) {
      logger.error('Pre-call registration probe failed:', error);
      return false;
    } finally {
      if (interval) clearInterval(interval);
      if (timer) clearTimeout(timer);
    }
  }

  /**
   * Connect to SIP server
   */
  async connect(credentials: SipCredentials, preserveActiveCalls = false): Promise<void> {
    // Explicit connect → we intend to be connected. Re-enables every reconnect
    // path that markIntentDisconnected() suppressed (e.g. a fresh login in the
    // same SPA session after a prior logout).
    this.connectionIntent = 'connected';

    if (this.userAgent) {
      if (preserveActiveCalls && this.ctx.hasActiveCalls()) {
        logger.info('Reconnecting with active calls - preserving sessions');
        this.credentials = credentials;
        this.setConnectionState('connecting');

        try {
          await this.softReconnect();
          return;
        } catch (error) {
          logger.error('Soft reconnect failed:', error);
        }
      }
      await this.disconnect();
    }

    this.credentials = credentials;
    this.setConnectionState('connecting');

    // Initialize failover with server info from credentials
    this.failoverManager.initialize(credentials.webSocketUri, credentials.backupWebSocketUri);

    try {
      // Fetch TURN credentials and update config before creating UserAgent
      const iceServers = await fetchTurnCredentials();
      const config = this.ctx.getConfig();
      config.iceServers = iceServers;

      // A microphone is REQUIRED to make/receive calls — for a softphone there
      // is no point registering without it. Acquire it up front; if it fails
      // (no device, or blocked), abort the connection so the UI can tell the
      // user to connect a microphone, instead of registering a phone that
      // can't actually take a call.
      await this.mediaManager.requestMediaPermission();
      await this.createUserAgent();
    } catch (error) {
      this.setConnectionState('error');

      // A missing/blocked microphone is a CLIENT DEVICE problem, not a server
      // connectivity one — do NOT run failover (the backup server needs a mic
      // too, and the retry loop just spams "cannot failover"). Re-throw the
      // MediaError unchanged: its message ("No microphone detected. Connect a
      // microphone or headset…") propagates to the SIP store's
      // registrationError and is shown in the UI.
      if (error instanceof MediaError) {
        throw error;
      }

      this.failoverManager.handleConnectionFailure();
      throw error instanceof SipError
        ? error
        : new ConnectionError('Failed to connect', SipErrorCode.CONNECTION_FAILED, {
            cause: error instanceof Error ? error : undefined,
          });
    }
  }

  /**
   * Synchronously signal that the SIP layer must NOT be connected. Call this
   * BEFORE the async disconnect (e.g. first thing on logout) so any reconnect
   * trigger that fires during teardown — transport close → handleDisconnect,
   * keepalive tick, tab-visibility, or network 'online' — is suppressed at
   * once. Also cancels any already-scheduled reconnect / registration / failover
   * timers so an in-flight backoff can't re-register after logout.
   */
  markIntentDisconnected(): void {
    this.connectionIntent = 'disconnected';
    this.clearTimers();
    this.failoverManager.clearTimers();
    this.stopKeepaliveWorker();
  }

  /**
   * Disconnect from SIP server
   */
  async disconnect(): Promise<void> {
    // Mark the transport as intentionally down BEFORE unregister/stop so the
    // onDisconnect delegate (handleDisconnect) fired by userAgent.stop() sees
    // 'disconnected' and does NOT schedule a reconnect.
    this._connectionState = 'disconnected';
    this.clearTimers();
    this.stopKeepaliveWorker();
    this.failoverManager.clearTimers();

    // Unregister and remove listener
    if (this.registerer) {
      if (this.registrationStateHandler) {
        try {
          this.registerer.stateChange.removeListener(this.registrationStateHandler);
        } catch {
          // Ignore removal errors
        }
        this.registrationStateHandler = null;
      }
      try {
        await this.registerer.unregister();
      } catch {
        // Ignore unregister errors
      }
      this.registerer = null;
    }

    // Stop user agent
    if (this.userAgent) {
      try {
        await this.userAgent.stop();
      } catch {
        // Ignore stop errors
      }
      this.userAgent = null;
    }

    this._isRegistered = false;
    this.setConnectionState('disconnected');
    this.ctx.emit({ type: 'registrationStateChanged', isRegistered: false });
  }

  /**
   * Soft reconnect - re-establish connection without disconnecting active calls
   */
  private async softReconnect(): Promise<void> {
    if (!this.userAgent || !this.credentials) {
      throw new ConnectionError('No user agent or credentials', SipErrorCode.CONNECTION_FAILED);
    }

    logger.info('Attempting soft reconnect...');

    const transport = (this.userAgent as unknown as { transport?: { isConnected: () => boolean } })
      .transport;

    if (transport && typeof transport.isConnected === 'function' && transport.isConnected()) {
      logger.info('Transport still connected, re-registering...');
      if (this._isRegistered) {
        this.setConnectionState('registered');
      } else {
        await this.startRegistration();
      }
      return;
    }

    logger.info('Transport disconnected, attempting to reconnect transport...');

    try {
      const reconnectTransport = (
        this.userAgent as unknown as {
          transport?: {
            connect: () => Promise<void>;
            disconnect: () => Promise<void>;
          };
        }
      ).transport;

      if (reconnectTransport && typeof reconnectTransport.connect === 'function') {
        await reconnectTransport.connect();
        logger.info('Transport reconnected successfully');
      } else {
        throw new Error('Transport reconnect not available');
      }
    } catch (error) {
      logger.warn('Transport reconnect failed:', error);
      throw error;
    }
  }

  /**
   * Full cleanup including event listeners
   */
  async destroy(): Promise<void> {
    await this.disconnect();
    this.removeNetworkListeners();
    this.removeVisibilityListener();
  }

  private async createUserAgent(): Promise<void> {
    if (!this.credentials) {
      throw new ConnectionError('No credentials provided', SipErrorCode.CONNECTION_FAILED);
    }

    const config = this.ctx.getConfig();
    const uri = UserAgent.makeURI(`sip:${this.credentials.username}@${this.credentials.domain}`);

    if (!uri) {
      throw new ConnectionError('Invalid SIP URI', SipErrorCode.INVALID_URI);
    }

    const options: UserAgentOptions = {
      uri,
      transportOptions: {
        server: this.credentials.webSocketUri,
        connectionTimeout: config.transport.connectionTimeout,
        keepAliveInterval: config.transport.keepAliveInterval,
        keepAliveDebounce: config.transport.keepAliveDebounce,
      },
      authorizationUsername: this.credentials.username,
      authorizationPassword: this.credentials.password,
      displayName: this.credentials.displayName || this.credentials.username,
      // RFC 5626: unique instance per browser tab for multi-device support
      instanceId: getOrCreateInstanceId(),
      // Custom SDH: prefer a UDP relay and keep a fallback, instead of waiting
      // for iceGatheringState='complete' (never fires under loss) or firing on
      // the first relay (which under loss is the fragile TCP/TLS one). Holds out
      // for the UDP relay, ships it + a fallback so ICE can fail over, and never
      // sends a media-less INVITE. See fireOnRelaySdhFactory.ts for the rationale.
      sessionDescriptionHandlerFactory: createFireOnRelaySdhFactory(),
      sessionDescriptionHandlerFactoryOptions: {
        // Max time SIP.js waits for ICE candidates before sending INVITE.
        //
        // Bumped from 3000ms → 10000ms on 2026-05-06 after the backend TURN
        // policy (auth.controller.ts: drop UDP TURN, inject turns:443/TLS) made
        // *all* relay candidates require TCP allocation. Empirically observed
        // on dispatchshabaz's PTCL connection: with 3000ms, Chrome sent the
        // INVITE with the SDP `c=` line at `0.0.0.0:9` and zero `a=candidate:`
        // attributes — no relay candidate had completed allocation in time.
        // rtpengine then had no peer address to send media to, and no candidate
        // ever arrived later because this codebase's sip.js path doesn't
        // post-INVITE-trickle (`a=ice-options:trickle` is advertised but no
        // INFO/UPDATE messages with candidates were ever sent in any of the
        // observed failures).
        //
        // Why 3s (was 10s): since Cloudflare TURN was added (2026-07-18) the
        // browser gathers ~6 TURN endpoints. The winner (CF UDP-53, near-edge)
        // yields a usable relay candidate in ~1 s, but one of the slower /
        // DPI-throttled URLs never finishes its allocation, so
        // iceGatheringState never reaches 'complete' and SIP.js was waiting the
        // FULL 10 s timeout before EVERY INVITE ("dialing takes forever"). The
        // Cap the ICE-gathering wait. On a clean line gathering COMPLETES in
        // ~1-2 s (see trimIceServers) and the INVITE fires then — the cap doesn't
        // bite, dialing stays fast. The cap only matters on a LOSSY line where the
        // TURN-allocation packets get dropped and gathering never completes: too
        // low (2 s) and the INVITE fired with ZERO relay candidates -> no media
        // path -> dead call (observed at 30% loss, 2026-07-18). 5 s gives the relay
        // time to allocate under loss while keeping clean-line dials fast.
        //
        // 2026-07-18 — fire-on-first-relay-candidate now SHIPPED (see
        // sessionDescriptionHandlerFactory above / fireOnRelaySdhFactory.ts):
        // the offer fires the instant the first relay candidate arrives, so on a
        // clean line dialing is ~1 s regardless of this value. This timeout is
        // now only the LAST-RESORT ceiling for a badly lossy line where even the
        // first relay allocation is slow — raised 5 s → 12 s so that under heavy
        // loss (observed: first candidate at ~8 s @ 50% drop) the relay still
        // makes it into the offer instead of firing a media-less INVITE. It does
        // NOT slow clean-line dials because fire-on-first resolves long before it.
        iceGatheringTimeout: 12000,
        // HOTFIX 2026-05-06: force TURN relay for INBOUND call answers too.
        // Same reason as makeCall above — Pakistan symmetric NAT breaks
        // host/srflx-based ICE in the inbound direction. Without this,
        // calls TO ext 116 from outside also experience one-way audio.
        peerConnectionConfiguration: getPeerConnectionConfig(config.iceServers, 'relay'),
      },
      userAgentString: config.userAgentString,
      // Silence SIP.js's built-in console logger for end users so full SIP
      // messages (INVITE/SDP, dialed numbers, call-ids) are NOT dumped to the
      // browser console. On only in dev or when the debug flag is set.
      logBuiltinEnabled: isClientDebugEnabled(),
      noAnswerTimeout: config.call.noAnswerTimeout,
      delegate: {
        onConnect: () => this.handleConnect(),
        onDisconnect: (error) => this.handleDisconnect(error),
        onInvite: (invitation) => this.handleIncomingCall(invitation),
      },
    };

    this.userAgent = new UserAgent(options);
    await this.userAgent.start();
  }

  private handleConnect(): void {
    logger.info(' WebSocket connected');
    this.setConnectionState('connected');
    this.reconnectAttempts = 0;
    this.failoverManager.resetConnectionFailures();
    this.startRegistration();
  }

  private handleDisconnect(error?: Error): void {
    logger.info(' WebSocket disconnected', error?.message);
    this._isRegistered = false;
    this.ctx.emit({ type: 'registrationStateChanged', isRegistered: false });

    if (this.connectionIntent === 'connected' && this._connectionState !== 'disconnected') {
      const hasActiveCalls = this.ctx.hasActiveCalls();
      if (hasActiveCalls) {
        logger.info('WebSocket disconnected but calls are active - attempting reconnection');
        this.setConnectionState('connecting');
      } else {
        this.setConnectionState('disconnected');
      }
      this.failoverManager.handleConnectionFailure();
      this.attemptReconnect();
    }
  }

  private handleIncomingCall(invitation: Invitation): void {
    if (this.callManager) {
      this.callManager.handleIncomingCall(invitation);
    } else {
      logger.error('CallManager not set, rejecting incoming call');
      invitation.reject();
    }
  }

  private setConnectionState(state: SipConnectionState): void {
    this._connectionState = state;
    this.ctx.emit({ type: 'connectionStateChanged', state });
  }

  // Registration

  private async startRegistration(): Promise<void> {
    if (!this.userAgent || this.connectionIntent !== 'connected') return;

    const config = this.ctx.getConfig();

    try {
      this.registerer = new Registerer(this.userAgent, {
        expires: config.registration.expires,
        refreshFrequency: config.registration.refreshFrequency,
        regId: 1, // RFC 5626: registration ID for multi-device
      });

      this.registrationStateHandler = (state: RegistererState) => {
        switch (state) {
          case RegistererState.Registered:
            logger.info(' Registered successfully');
            this._isRegistered = true;
            this._lastRegistrationTime = Date.now();
            this.setConnectionState('registered');
            this.ctx.emit({ type: 'registrationStateChanged', isRegistered: true });
            this.startKeepaliveWorker();
            break;

          case RegistererState.Unregistered:
            logger.info(' Unregistered');
            this._isRegistered = false;
            if (this._connectionState === 'registered') {
              this.setConnectionState('connected');
            }
            this.ctx.emit({ type: 'registrationStateChanged', isRegistered: false });
            this.stopKeepaliveWorker();
            break;
        }
      };

      this.registerer.stateChange.addListener(this.registrationStateHandler);
      await this.registerer.register();
    } catch (error) {
      logger.error(' Registration failed:', error);
      this.ctx.emit({
        type: 'registrationStateChanged',
        isRegistered: false,
        error: error instanceof Error ? error.message : 'Registration failed',
      });
      this.scheduleRegistrationRetry();
    }
  }

  private scheduleRegistrationRetry(): void {
    this.clearRegistrationRetryTimer();
    const config = this.ctx.getConfig();
    this.registrationRetryTimer = setTimeout(() => {
      if (
        this.connectionIntent === 'connected' &&
        this._connectionState === 'connected' &&
        !this._isRegistered
      ) {
        this.startRegistration();
      }
    }, config.registration.retryInterval);
  }

  // Reconnection

  private attemptReconnect(): void {
    // Never reconnect after an explicit logout/disconnect.
    if (this.connectionIntent !== 'connected') return;

    const config = this.ctx.getConfig();
    const { maxAttempts, initialDelay, maxDelay, multiplier } = config.reconnection;

    if (this.reconnectAttempts >= maxAttempts || !this.credentials) {
      logger.error(' Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const base = Math.min(initialDelay * Math.pow(multiplier, this.reconnectAttempts - 1), maxDelay);
    // Equal jitter (AWS-style: half fixed + half random) so many clients that drop
    // together (e.g. a Kamailio blip) don't reconnect in lockstep and stampede the
    // server. Industry-standard backoff-with-jitter.
    const delay = Math.round(base / 2 + Math.random() * (base / 2));

    logger.info(`Reconnection attempt ${this.reconnectAttempts} in ${delay}ms`);

    this.reconnectTimer = setTimeout(() => {
      if (this.credentials) {
        const hasActiveCalls = this.ctx.hasActiveCalls();
        logger.info(
          `Reconnecting with ${hasActiveCalls ? 'active calls - preserving' : 'no active calls'}`
        );
        this.connect(this.credentials, hasActiveCalls).catch((err) =>
          logger.error('Reconnection failed', err)
        );
      }
    }, delay);
  }

  private clearTimers(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.clearRegistrationRetryTimer();
  }

  private clearRegistrationRetryTimer(): void {
    if (this.registrationRetryTimer) {
      clearTimeout(this.registrationRetryTimer);
      this.registrationRetryTimer = null;
    }
  }

  // Registration keepalive (Web Worker — immune to Chrome background throttling)

  private startKeepaliveWorker(): void {
    this.stopKeepaliveWorker();
    this.consecutiveHeartbeatFailures = 0;
    const config = this.ctx.getConfig();
    const interval = config.reconnection.heartbeatIntervalMs;
    if (!interval || interval <= 0) return; // heartbeat disabled
    this.keepaliveWorker = createKeepaliveWorker();
    if (this.keepaliveWorker) {
      // The Web Worker timer isn't throttled in a background tab, so the heartbeat
      // keeps probing even when the dialer isn't focused.
      this.keepaliveWorker.onmessage = () => {
        void this.heartbeatTick();
      };
      this.keepaliveWorker.postMessage({ command: 'start', interval });
      logger.info(`[Heartbeat] started (every ${Math.round(interval / 1000)}s)`);
    }
  }

  /**
   * Active liveness probe (fires off the keepalive Web Worker tick). Detects a
   * SILENTLY dead socket — one that never fired `onclose` — which the SIP.js
   * transport would otherwise never notice, leaving the UI falsely "Ready". A dead
   * probe triggers the same auto-reconnect path as a real disconnect, so the dialer
   * self-heals without a page refresh (the SIP.js-recommended app-layer recovery).
   */
  private async heartbeatTick(): Promise<void> {
    if (this.connectionIntent !== 'connected' || this._connectionState === 'disconnected') return;
    if (!this.registerer) return;

    // Cheap first check: the transport already KNOWS it's closed (definitive, not a
    // slow probe) → reconnect immediately, no threshold needed.
    const transport = (this.userAgent as unknown as { transport?: { isConnected?: () => boolean } })
      ?.transport;
    if (transport && typeof transport.isConnected === 'function' && !transport.isConnected()) {
      logger.warn('[Heartbeat] transport disconnected — forcing reconnect');
      this.consecutiveHeartbeatFailures = 0;
      this.onLinkDead();
      return;
    }

    // Round-trip probe: a re-REGISTER that must be ACCEPTED within the deadline. A
    // zombie socket (OPEN but unreachable) never gets a 200 back.
    const config = this.ctx.getConfig();
    const result = await this.probeRegister(config.reconnection.heartbeatDeadlineMs);

    // Re-check after the await: a logout/teardown may have run during the probe
    // window — never resurrect a torn-down connection with a late result. (Cast
    // defeats TS's stale narrowing of this mutable field across the await.)
    if (this.connectionIntent !== 'connected' || (this._connectionState as string) === 'disconnected')
      return;

    if (result === 'alive') {
      this.consecutiveHeartbeatFailures = 0;
      this._lastRegistrationTime = Date.now();
      if (!this._isRegistered) {
        this._isRegistered = true;
        this.setConnectionState('registered');
        this.ctx.emit({ type: 'registrationStateChanged', isRegistered: true });
      }
      return;
    }

    // 'dead' (no response) or 'rejected' (server said no). Tolerate a single blip —
    // one slow round-trip or a transient 4xx/5xx on a high-latency link shouldn't
    // grey a healthy user. Act only after N consecutive failures.
    this.consecutiveHeartbeatFailures++;
    if (this.consecutiveHeartbeatFailures < config.reconnection.heartbeatMissThreshold) {
      logger.info(
        `[Heartbeat] probe ${result} (${this.consecutiveHeartbeatFailures}/${config.reconnection.heartbeatMissThreshold}) — tolerating`
      );
      return;
    }
    this.consecutiveHeartbeatFailures = 0;
    if (result === 'dead') {
      logger.warn('[Heartbeat] link is dead (consecutive misses) — reconnecting');
      this.onLinkDead();
    } else {
      // Link is alive but the server keeps rejecting REGISTER — a registration
      // problem, not a transport one. Mark unregistered + retry registration.
      logger.warn('[Heartbeat] REGISTER repeatedly rejected — re-registering');
      if (this._isRegistered) {
        this._isRegistered = false;
        this.ctx.emit({ type: 'registrationStateChanged', isRegistered: false });
      }
      this.scheduleRegistrationRetry();
    }
  }

  /**
   * Send a re-REGISTER and wait (up to deadlineMs) for the server's response.
   *   'alive'    — 200 OK received (round-trip works)
   *   'rejected' — server responded with a failure (link up, registration down)
   *   'dead'     — no response within the deadline (zombie socket)
   */
  private probeRegister(deadlineMs: number): Promise<'alive' | 'rejected' | 'dead'> {
    return new Promise((resolve) => {
      const reg = this.registerer;
      if (!reg) return resolve('dead');
      let settled = false;
      const done = (r: 'alive' | 'rejected' | 'dead') => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(r);
      };
      const timer = setTimeout(() => done('dead'), deadlineMs);
      reg
        .register({
          requestDelegate: {
            onAccept: () => done('alive'),
            onReject: () => done('rejected'),
          },
        })
        .catch(() => done('dead'));
    });
  }

  /**
   * A liveness probe (or the transport) says the link is dead. Sync the state to
   * disconnected and kick an immediate reconnect — mirrors the tab-visibility
   * force-reconnect (does NOT go through handleDisconnect, so the failover failure
   * counter isn't bumped for what is a client-side liveness finding).
   */
  private onLinkDead(): void {
    if (this.connectionIntent !== 'connected') return;
    this._isRegistered = false;
    this.ctx.emit({ type: 'registrationStateChanged', isRegistered: false });
    // Mid-call: use 'connecting' (not 'disconnected') so the badge shows recovering
    // while the reconnect preserves the live call — mirrors handleDisconnect.
    this.setConnectionState(this.ctx.hasActiveCalls() ? 'connecting' : 'disconnected');
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.reconnectAttempts = 0;
    this.attemptReconnect();
  }

  private stopKeepaliveWorker(): void {
    if (this.keepaliveWorker) {
      this.keepaliveWorker.postMessage({ command: 'stop' });
      this.keepaliveWorker.terminate();
      this.keepaliveWorker = null;
    }
  }

  // Visibility recovery — re-register immediately when tab becomes visible

  private setupVisibilityListener(): void {
    if (typeof document !== 'undefined') {
      this.visibilityHandler = () => this.handleVisibilityChange();
      document.addEventListener('visibilitychange', this.visibilityHandler);
    }
  }

  private removeVisibilityListener(): void {
    if (typeof document !== 'undefined' && this.visibilityHandler) {
      document.removeEventListener('visibilitychange', this.visibilityHandler);
      this.visibilityHandler = null;
    }
  }

  private handleVisibilityChange(): void {
    if (document.hidden) return;
    if (!this.credentials) return;
    // Don't resurrect a connection the user explicitly tore down (logout).
    if (this.connectionIntent !== 'connected') return;

    // Detect whether we should treat this resume as a forced reconnect:
    //   - state already says 'disconnected' (onclose fired while tab was hidden,
    //     a backoff timer may be queued for several seconds out — skip the wait)
    //   - state claims we're connected but transport.isConnected() says otherwise
    //     (browser suspended the tab and killed TCP without firing onclose;
    //     observed on mobile carriers with aggressive idle handling)
    const transport = (this.userAgent as unknown as { transport?: { isConnected?: () => boolean } })
      ?.transport;
    const transportLooksAlive =
      !transport || typeof transport.isConnected !== 'function' || transport.isConnected();
    const needsReconnect = this._connectionState === 'disconnected' || !transportLooksAlive;

    if (needsReconnect) {
      logger.info(
        `[Visibility] Tab visible — forcing reconnect (state=${this._connectionState}, transport=${transportLooksAlive ? 'alive' : 'dead'})`
      );

      // Sync state if it was lying. Don't go through handleDisconnect because
      // that increments the failover failure counter — a tab-resume reconnect
      // is not a server failure, just a client-side wakeup.
      if (this._connectionState !== 'disconnected') {
        this._isRegistered = false;
        this.ctx.emit({ type: 'registrationStateChanged', isRegistered: false });
        this.setConnectionState('disconnected');
      }
      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
      }
      this.reconnectAttempts = 0;
      this.attemptReconnect();
      return;
    }

    // Connection is genuinely alive; opportunistically refresh REGISTER if
    // half the registration TTL has elapsed (covers cases where the SIP
    // registration timed out at the registrar but the WS is still healthy).
    if (!this.registerer) return;
    const elapsed = Date.now() - this._lastRegistrationTime;
    const config = this.ctx.getConfig();
    const expiresMs = config.registration.expires * 1000;
    if (elapsed > expiresMs * 0.5) {
      logger.info(
        `[Visibility] Tab visible, re-registering (${Math.round(elapsed / 1000)}s since last reg)`
      );
      this.registerer
        .register()
        .catch((err) => logger.error('[Visibility] Re-register failed:', err));
    }
  }

  // Network listeners

  private setupNetworkListeners(): void {
    if (typeof window !== 'undefined') {
      this.onlineHandler = () => this.handleOnline();
      this.offlineHandler = () => this.handleOffline();
      window.addEventListener('online', this.onlineHandler);
      window.addEventListener('offline', this.offlineHandler);
    }
  }

  private removeNetworkListeners(): void {
    if (typeof window !== 'undefined') {
      if (this.onlineHandler) {
        window.removeEventListener('online', this.onlineHandler);
        this.onlineHandler = null;
      }
      if (this.offlineHandler) {
        window.removeEventListener('offline', this.offlineHandler);
        this.offlineHandler = null;
      }
    }
  }

  private handleOnline(): void {
    logger.info('Network: Back online');
    this._isOnline = true;
    this.ctx.emit({ type: 'networkStatusChanged', isOnline: true });

    if (
      this.wasConnectedBeforeOffline &&
      this.credentials &&
      this.connectionIntent === 'connected'
    ) {
      logger.info('Attempting to reconnect after coming back online');
      this.reconnectAttempts = 0;

      const hasActiveCalls = this.ctx.hasActiveCalls();
      logger.info(
        `Reconnecting with ${hasActiveCalls ? 'active calls - preserving' : 'no active calls'}`
      );

      this.connect(this.credentials, hasActiveCalls).catch((err) => {
        logger.error('Failed to reconnect after coming online:', err);
      });
    }
  }

  private handleOffline(): void {
    logger.info('Network: Went offline');
    this._isOnline = false;
    this.wasConnectedBeforeOffline = this._connectionState !== 'disconnected';
    this.ctx.emit({ type: 'networkStatusChanged', isOnline: false });

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }
}
