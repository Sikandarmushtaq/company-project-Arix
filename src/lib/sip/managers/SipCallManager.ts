/**
 * SIP Call Manager
 *
 * Handles all call control: making/answering/ending calls, hold, mute, DTMF,
 * blind transfer, incoming call handling, session state management, and call logging.
 *
 * @module lib/sip/managers/SipCallManager
 */

import {
  UserAgent,
  Inviter,
  Invitation,
  Session,
  SessionState,
  type SessionDescriptionHandlerOptions,
} from 'sip.js';

import { getMediaConstraints, getPeerConnectionConfig, SipStatusCode } from '../config';
import { callFailureOutcome } from '../call-outcome';
import { applyJitterBufferTarget, JITTER_BUFFER_BASE_MS } from '../media-tuning';
import { opusLowBandwidthModifier, capAudioSenderBitrate } from '../sdp-modifiers';
import { SipErrorCode, CallError, SipError } from '../errors';
import type { CallLine, CallState, MakeCallOptions, DTMFTone } from '../types';
import type { SipManagerContext } from './types';
import type { SipQualityManager } from './SipQualityManager';
import type { SipRecordingManager } from './SipRecordingManager';
import type { SipConferenceManager } from './SipConferenceManager';
import type { SipTransferManager } from './SipTransferManager';
import { sipLogger as logger } from '../logger';
import { callAudioService } from '../call-audio-service';
import { remoteAudioBoost } from '../remote-audio-boost';
import { createHoldMusicTrack, type HoldMusicHandle } from '../hold-music';
import { callsService } from '@/lib/api';
import { normalizePhone } from '@/lib/utils/phone';
import { CallStatus, getUnansweredStatus } from '@/lib/constants/call-status';

/**
 * Window (ms) after INVITE inside which a status-code rejection is treated
 * as an ICE/media-level failure (as opposed to a genuine busy/decline).
 * Calls that ring for several seconds and THEN get rejected are not ICE issues;
 * those reflect normal user actions (declined, busy, etc.).
 */
const ICE_FAILURE_WINDOW_MS = 3_000;

/**
 * SIP status codes that — when returned within ICE_FAILURE_WINDOW_MS of INVITE —
 * almost always indicate an ICE/media negotiation failure rather than a user
 * action. On these codes we automatically retry once with TURN-relay-only to
 * bypass STUN/host candidate issues.
 */
function isIceLevelFailure(status: number | undefined, elapsedMs: number): boolean {
  if (status === undefined) return false;
  if (elapsedMs > ICE_FAILURE_WINDOW_MS) return false;
  // 488 Not Acceptable Here — classic FreeSWITCH "no suitable candidates" reject
  if (status === 488) return true;
  // 500 Server Internal Error (early) — usually media setup failure server-side
  if (status === 500) return true;
  // 504 Server Timeout (early) — dialog setup stalled on media negotiation
  if (status === 504) return true;
  return false;
}

/**
 * Generate a client-side unique id for a call. Used by the telemetry pipeline
 * to correlate multiple events (ICE state changes, stats, end) to a single row
 * on the backend. Prefer crypto.randomUUID in browsers that support it; fall
 * back to a cheap time-based id on older environments (rare in our target set
 * but safe).
 */
function generateCallUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  const rand = Math.random().toString(36).slice(2, 10);
  return `${Date.now().toString(36)}-${rand}`;
}

// Blind transfer: max time to wait for terminal NOTIFY before reverting
const TRANSFER_TIMEOUT_MS = 30_000;
// Blind transfer: delay after 200 OK before ending local call
const TRANSFER_END_DELAY_MS = 1_000;
// Safety timeout: max time to wait for session to reach Terminated after endCall
const END_CALL_SAFETY_TIMEOUT_MS = 5_000;

export class SipCallManager {
  private ctx: SipManagerContext;
  private qualityManager: SipQualityManager;
  private recordingManager: SipRecordingManager;
  private conferenceManager: SipConferenceManager;
  private transferManager: SipTransferManager;

  // Ring timeout timers (auto-cancel if not answered)
  private ringTimeoutTimers: Map<number, ReturnType<typeof setTimeout>> = new Map();
  // Transfer timeout timers (revert to established if no terminal NOTIFY)
  private transferTimeoutTimers: Map<number, ReturnType<typeof setTimeout>> = new Map();
  // Pending cancellation flags — set by endCall() to signal makeCall() handlers
  // that the call should be terminated at the earliest opportunity
  private pendingCancellations: Set<number> = new Set();
  /**
   * Per-line professional failure outcome (e.g. "Not in Service") recorded in
   * `onReject`. A rejected INVITE ends the call via a RACE between `onReject` and
   * the session's `Terminated` stateChange (`handleTermination`) — whichever
   * cleans up first emits `callEnded`. Recording the outcome here lets EITHER
   * path attach it, so the label is never lost to that race.
   */
  private readonly pendingOutcomes = new Map<number, string>();
  // Pre-warmed media streams — acquired during ringing so accept() is fast
  private preWarmedStreams: Map<number, MediaStream> = new Map();
  // ICE restart tracking — prevent repeated restarts on the same line
  // Per-line ICE-restart history: how many restarts we've done and when the last
  // one fired. Allows a SECOND restart (a call that loses media twice can still
  // self-heal) but caps the total and enforces a cooldown so a flaky link can't
  // trigger a restart storm.
  private iceRestartState: Map<number, { count: number; lastAt: number }> = new Map();

  // Client-side hold state (no SIP re-INVITE — see hold-music.ts for the why).
  private holdMusicHandles: Map<number, HoldMusicHandle> = new Map();
  private holdSavedMic: Map<number, MediaStreamTrack | null> = new Map();
  private holdSavedElMuted: Map<number, boolean> = new Map();

  constructor(
    ctx: SipManagerContext,
    qualityManager: SipQualityManager,
    recordingManager: SipRecordingManager,
    conferenceManager: SipConferenceManager,
    transferManager: SipTransferManager
  ) {
    this.ctx = ctx;
    this.qualityManager = qualityManager;
    this.recordingManager = recordingManager;
    this.conferenceManager = conferenceManager;
    this.transferManager = transferManager;
  }

  // ---------------------------------------------------------------------------
  // Incoming Calls
  // ---------------------------------------------------------------------------

  handleIncomingCall(invitation: Invitation): void {
    const callerNumber = this.extractCallerNumber(invitation);

    // Phantom fork detection: FreeSWITCH parallel-forks to both Kamailio
    // nodes. One fork can arrive with the user's own number in remoteIdentity
    // (Kamailio internal routing artifact). caller=callee is impossible for
    // legitimate calls (self-calling is blocked outbound). Silently ignore —
    // don't log, don't ring, don't allocate a line. The INVITE expires
    // naturally via SIP timeout or CANCEL from FreeSWITCH.
    const isOwn = this.ctx.isOwnNumber(callerNumber);
    logger.info('Phantom fork check:', { callerNumber, isOwn });
    if (isOwn) {
      logger.info('Phantom fork ignored: caller is own number', callerNumber);
      return;
    }

    // Reject if DND is enabled
    if (this.ctx.isDndEnabled()) {
      logger.info('DND enabled, rejecting call from', callerNumber);
      invitation.reject({ statusCode: 486 }); // Busy Here
      this.logRejectedCall(callerNumber, 'dnd').catch(() => {});
      return;
    }

    // Reject if caller is blocked
    if (this.ctx.isNumberBlocked(callerNumber)) {
      logger.info('Blocked number, rejecting call from', callerNumber);
      invitation.reject({ statusCode: 603 }); // Decline
      this.logRejectedCall(callerNumber, 'blocked').catch(() => {});
      return;
    }

    // Don't reject duplicate INVITEs from parallel fork (FreeSWITCH bridges
    // to both Kamailio nodes). Rejecting with 486 can cause FreeSWITCH to
    // cancel ALL forks on slow networks. Instead, accept both on separate
    // lines — the duplicate gets CANCEL'd naturally ("Call completed elsewhere")
    // when the user answers the first. The store protects the UI from overwrite.

    const lineId = this.ctx.findAvailableLine();

    if (lineId === null) {
      logger.info(' No available lines, rejecting call');
      invitation.reject();
      return;
    }

    const callerName = invitation.remoteIdentity?.displayName || undefined;
    const sipCallId = this.extractSipCallId(invitation);

    this.ctx.sessions.set(lineId, invitation as unknown as Session);

    const lineState: CallLine = {
      id: lineId,
      state: 'ringing',
      direction: 'inbound',
      remoteNumber: callerNumber,
      remoteName: callerName,
      startTime: new Date(),
      duration: 0,
      isMuted: false,
      isHeld: false,
      sipCallId,
    };
    this.ctx.lineStates.set(lineId, lineState);

    this.setupSessionHandlers(invitation as unknown as Session, lineId);

    this.logCallStart(lineId, callerNumber, 'inbound', sipCallId).catch((err) => {
      logger.warn('Failed to log incoming call:', err);
    });

    callAudioService.playRingtone();

    this.ctx.emit({
      type: 'incomingCall',
      call: {
        lineId,
        callerNumber,
        callerName,
        timestamp: new Date(),
      },
    });

    // Start telemetry capture for the inbound leg. Note inbound calls never
    // trigger a relay-only retry (the callee does not control ICE policy for
    // the call), but we still record ICE stats for observability.
    this.ctx.emit({
      type: 'telemetryStarted',
      lineId,
      callUuid: generateCallUuid(),
      direction: 'inbound',
      isRelayOnlyRetry: false,
    });

    // Pre-warm getUserMedia so the mic device is already open when the user answers.
    // The subsequent getUserMedia inside invitation.accept() returns in ~10-50ms
    // instead of 200-800ms, dramatically reducing the "Connecting..." phase.
    this.preWarmMedia(lineId);
  }

  private extractCallerNumber(invitation: Invitation): string {
    try {
      if (invitation.remoteIdentity?.uri?.user) {
        return this.ctx.formatPhoneNumber(invitation.remoteIdentity.uri.user);
      }

      const request = (invitation as unknown as { request?: { from?: { toString: () => string } } })
        .request;
      if (request?.from) {
        const fromHeader = request.from.toString();
        const match = fromHeader.match(/sip:([^@;]+)@/);
        if (match?.[1]) {
          return this.ctx.formatPhoneNumber(match[1]);
        }
      }
    } catch (error) {
      logger.error(' Error extracting caller number:', error);
    }
    return 'Unknown';
  }

  private extractSipCallId(invitation: Invitation): string | undefined {
    try {
      const request = invitation.request;
      if (request && typeof request.callId === 'string' && request.callId.length > 0) {
        logger.info('Extracted SIP Call-ID:', request.callId);
        return request.callId;
      }

      if (request && typeof request.getHeader === 'function') {
        const callIdHeader = request.getHeader('Call-ID') || request.getHeader('call-id');
        if (callIdHeader && callIdHeader.length > 0) {
          logger.info('Extracted SIP Call-ID from header:', callIdHeader);
          return callIdHeader;
        }
      }

      logger.warn('Could not extract SIP Call-ID from invitation');
      return undefined;
    } catch (error) {
      logger.error('Error extracting SIP Call-ID:', error);
      return undefined;
    }
  }

  // ---------------------------------------------------------------------------
  // Outbound Calls
  // ---------------------------------------------------------------------------

  async makeCall(number: string, options: MakeCallOptions = {}): Promise<number> {
    // HOTFIX 2026-05-06: default policy is 'relay', not 'all'.
    // Why: 100% of current customers are on Pakistan ISPs (PTCL/Jazz/Zong/Telenor)
    // which use carrier-grade symmetric NAT. With policy='all' the browser picks
    // a host/srflx candidate that half-works (server receives, client doesn't),
    // producing one-way audio. Forcing TURN relay (Twilio Singapore) eliminates
    // the symmetric-NAT failure at a cost of ~80-150ms relay latency.
    // When non-PK customers are onboarded, switch this to country-aware policy
    // (read user.country from the session and pass 'all' for non-problem regions).
    return this.placeOutboundCall(number, options, { iceTransportPolicy: 'relay', isRetry: false });
  }

  /**
   * Internal outbound-call implementation.
   *
   * Accepts an `iceTransportPolicy` so the same path can retry with 'relay'-only
   * candidates after an initial ICE-level failure. `isRetry=true` is set when
   * this call is an automatic relay-only retry triggered by an earlier failure;
   * it is propagated into the telemetry record so the admin dashboard can see
   * that the user's call was only saved by falling back to TURN.
   */
  private async placeOutboundCall(
    number: string,
    options: MakeCallOptions,
    attempt: { iceTransportPolicy: RTCIceTransportPolicy; isRetry: boolean }
  ): Promise<number> {
    const ua = this.ctx.getUserAgent();
    const credentials = this.ctx.getCredentials();
    const connMgr = this.ctx.getConnectionManager();

    if (!ua) {
      throw new CallError('Not registered', SipErrorCode.NOT_REGISTERED);
    }

    // Pre-call registration probe: ensure we're registered before attempting INVITE
    if (!connMgr.isRegistered || Date.now() - connMgr.lastRegistrationTime > 60_000) {
      const ok = await connMgr.ensureRegistered();
      if (!ok) {
        throw new CallError('Not registered', SipErrorCode.NOT_REGISTERED);
      }
    }

    const lineId = this.ctx.findAvailableLine();
    if (lineId === null) {
      throw new CallError('No available lines', SipErrorCode.NO_AVAILABLE_LINES);
    }

    const config = this.ctx.getConfig();
    const formattedNumber = this.ctx.formatPhoneNumber(number).replace(/#/g, '%23');
    const targetUri = UserAgent.makeURI(`sip:${formattedNumber}@${credentials?.domain}`);

    if (!targetUri) {
      throw new CallError('Invalid target number', SipErrorCode.CALL_FAILED);
    }

    try {
      const extraHeaders = [
        `X-Client-Version: ${config.userAgentString}`,
        ...(options.extraHeaders || []),
      ];

      // Telnyx SIP-transport pilot: tag every outbound INVITE so FreeSWITCH
      // bridges out the Telnyx trunk instead of Tozcall. Applied here (the single
      // Inviter) so primary calls AND transfer-consult calls are both covered;
      // absent the tag the call goes out Tozcall exactly as before.
      if (this.ctx.isTelnyxRoute()) {
        extraHeaders.push('X-Telnyx-Route: 1');
      }

      if (options.callerId) {
        extraHeaders.push(`P-Preferred-Identity: <sip:${options.callerId}@${credentials?.domain}>`);
      }

      // Per-call RTCPeerConnection config. For the first attempt we use 'all'
      // (host + STUN + TURN). If that attempt fails with an ICE-level error,
      // the retry runs with 'relay' — TURN-only — which bypasses host/STUN
      // negotiation entirely at the cost of ~100-200ms of relay latency.
      const peerConnectionConfiguration = getPeerConnectionConfig(
        config.iceServers,
        attempt.iceTransportPolicy
      );

      const inviter = new Inviter(ua, targetUri, {
        sessionDescriptionHandlerOptions: {
          constraints: getMediaConstraints(config.audioConstraints, options.video),
          hold: false,
          peerConnectionConfiguration,
        } as SessionDescriptionHandlerOptions,
        // Tune Opus for lossy/low-bandwidth links (FEC + capped bitrate).
        sessionDescriptionHandlerModifiers: [opusLowBandwidthModifier],
        earlyMedia: options.earlyMedia ?? config.call.earlyMedia,
        inviteWithoutSdp: false,
        extraHeaders,
      });

      // Time reference used by onReject to decide whether a rejection
      // happened fast enough to be treated as an ICE-level failure (vs. a
      // genuine busy / decline / user timeout, which we must NOT retry).
      const inviteStartTime = Date.now();

      // Signal start of telemetry capture for this line (consumed by SipTelemetryManager).
      // `isRelayOnlyRetry` tells the telemetry manager that this row represents
      // a retry triggered by a prior ICE-level failure — that fact is surfaced
      // in the admin dashboard as a "call was only saved by TURN" signal.
      this.ctx.emit({
        type: 'telemetryStarted',
        lineId,
        callUuid: generateCallUuid(),
        direction: 'outbound',
        isRelayOnlyRetry: attempt.isRetry,
      });

      const lineState: CallLine = {
        id: lineId,
        state: 'dialing',
        direction: 'outbound',
        remoteNumber: formattedNumber,
        startTime: new Date(),
        duration: 0,
        isMuted: false,
        isHeld: false,
      };
      this.ctx.lineStates.set(lineId, lineState);
      this.ctx.sessions.set(lineId, inviter);

      this.setupSessionHandlers(inviter, lineId);
      this.ctx.emit({ type: 'callStateChanged', lineId, state: 'dialing' });

      this.logCallStart(lineId, formattedNumber, 'outbound').catch((err) => {
        logger.warn('Failed to log call start:', err);
      });

      const handleEarlyTermination = () => {
        if (inviter.state === SessionState.Terminated) {
          logger.debug(`Inviter terminated early for line ${lineId}`);
          callAudioService.stopRingback();
          if (this.ctx.lineStates.has(lineId)) {
            const outcome = this.pendingOutcomes.get(lineId);
            this.cleanupLine(lineId);
            this.ctx.emit({ type: 'callEnded', lineId, reason: 'terminated', outcome });
          }
        }
      };

      // Check pending cancellation BEFORE invite() — prevents getUserMedia
      // from acquiring the mic if the user already clicked hangup
      if (this.pendingCancellations.has(lineId)) {
        logger.info(`Pending cancellation before invite for line ${lineId}, aborting`);
        this.cleanupLine(lineId);
        this.ctx.emit({ type: 'callEnded', lineId, reason: 'cancelled' });
        return lineId;
      }

      await inviter
        .invite({
          requestDelegate: {
            onTrying: () => {
              logger.debug(`Call trying on line ${lineId}`);
              // Check pending cancellation — cancel now that INVITE is in-flight
              if (this.pendingCancellations.has(lineId)) {
                logger.info(`Pending cancellation detected on trying for line ${lineId}`);
                inviter.cancel().catch((err) => {
                  logger.warn(`Cancel on trying failed for line ${lineId}:`, err);
                });
                return;
              }
              // Do NOT ring on 100 Trying. We wait for the real alerting signal
              // (180 Ringing / 183 Session Progress) before playing ringback, so a
              // number that's out of service — which fails fast with a 4xx/5xx and
              // never sends 180 — never rings at all (just shows "Not in service").
              // This is standard VoIP behavior and matches Google Voice. The line
              // stays 'dialing' ("Calling…") until it actually rings.
            },
            onProgress: (response) => {
              const status = response.message.statusCode;
              logger.debug(`Call progress on line ${lineId}: ${status}`);
              // Check pending cancellation — we have a provisional response, cancel is guaranteed to work
              if (this.pendingCancellations.has(lineId)) {
                logger.info(`Pending cancellation detected on progress for line ${lineId}`);
                inviter.cancel().catch((err) => {
                  logger.warn(`Cancel on progress failed for line ${lineId}:`, err);
                });
                return;
              }
              if (status === SipStatusCode.RINGING || status === SipStatusCode.SESSION_PROGRESS) {
                this.ctx.updateLineState(lineId, { state: 'ringing' });
                // Ring only now that the call has actually reached the alerting
                // stage (moved here from onTrying). Our own branded ringback;
                // carrier early media stays muted (below).
                callAudioService.playRingback();
                const hasEarlyMediaSDP = !!response.message.body;
                if (hasEarlyMediaSDP) {
                  // Set up Audio element during early media but MUTED.
                  // This lets ICE/DTLS establish so voice is instant on 200 OK,
                  // while keeping carrier ringback inaudible.
                  this.setupRemoteAudio(inviter, lineId);
                  const earlyAudio = this.ctx.remoteAudioElements.get(lineId);
                  if (earlyAudio) earlyAudio.muted = true;
                  logger.debug(`Early media muted on line ${lineId}, ICE/DTLS establishing`);
                }
                this.startRingTimeout(lineId, config.call.noAnswerTimeout);
              }
            },
            onAccept: () => {
              logger.info(`Call accepted on line ${lineId}`);
              this.clearRingTimeout(lineId);
              // Check pending cancellation — call was answered but user already hung up, send BYE
              if (this.pendingCancellations.has(lineId)) {
                callAudioService.stopRingback();
                logger.info(
                  `Pending cancellation detected on accept for line ${lineId}, sending BYE`
                );
                inviter.bye().catch((err) => {
                  logger.warn(`BYE after pending cancel failed for line ${lineId}:`, err);
                });
                return;
              }
              // 200 OK received = the callee answered. Flip the UI to "connected"
              // HERE too (not only from SessionState.Established) so a raced/missed
              // Established event can't leave the caller stuck on "Ringing".
              // Idempotent — a no-op if the Established transition already connected.
              this.markEstablished(inviter, lineId);
            },
            onReject: (response) => {
              const status = response.message.statusCode;
              const reason = response.message.reasonPhrase;
              const elapsed = Date.now() - inviteStartTime;

              logger.warn(
                `Call rejected on line ${lineId}: ${status} ${reason} (${elapsed}ms elapsed)`
              );
              this.clearRingTimeout(lineId);
              callAudioService.stopRingback();

              // Record a professional outcome NOW, before any cleanup, so whichever
              // termination path fires first for this rejection — this handler, or
              // the session's Terminated stateChange (handleTermination) — can attach
              // it to callEnded. Without this, the race loses the label.
              const outcome = callFailureOutcome(status, reason) ?? undefined;
              if (outcome) this.pendingOutcomes.set(lineId, outcome);

              // Industrial-grade NAT traversal: if this was the FIRST attempt
              // and the rejection looks like an ICE-level failure (e.g., 488
              // Not Acceptable Here from FreeSWITCH because the client's SDP
              // only offered a LAN host candidate), auto-retry once with
              // iceTransportPolicy=relay. This routes media through TURN
              // regardless of STUN reachability.
              //
              // We DO NOT retry:
              //   - If this was already a retry (attempt.isRetry = true)
              //   - If the rejection was slow (> ICE_FAILURE_WINDOW_MS) —
              //     those are user-facing (busy, decline, user timeout).
              //   - If the line was cancelled by the user (pendingCancellations).
              const shouldRetryAsRelay =
                !attempt.isRetry &&
                !this.pendingCancellations.has(lineId) &&
                isIceLevelFailure(status, elapsed);

              if (shouldRetryAsRelay) {
                // We're retrying, not failing — drop any recorded outcome so the
                // upcoming retry (or its success) never surfaces a stale label.
                this.pendingOutcomes.delete(lineId);
                logger.info(
                  `Line ${lineId}: ICE-level failure (${status} in ${elapsed}ms), ` +
                    'auto-retrying with iceTransportPolicy=relay (TURN-only)'
                );
                // Signal to telemetry + UI that an ICE-level failure occurred
                // on this leg before we tear it down.
                this.ctx.emit({
                  type: 'iceFailureDetected',
                  lineId,
                  reason: `${status} ${reason ?? 'ICE failure'}`,
                });
                // Clean up the failed leg
                if (this.ctx.lineStates.has(lineId)) {
                  this.cleanupLine(lineId);
                  this.ctx.emit({ type: 'callEnded', lineId, reason: reason ?? 'ICE failure' });
                }
                // Kick off the retry on the next microtask so cleanup settles first.
                // Errors from the retry are logged — we do not rethrow because the
                // original makeCall promise has already resolved with the initial lineId.
                Promise.resolve().then(() =>
                  this.placeOutboundCall(number, options, {
                    iceTransportPolicy: 'relay',
                    isRetry: true,
                  }).catch((retryErr) => {
                    logger.error(`Relay-only retry failed for ${number}:`, retryErr);
                  })
                );
                return;
              }

              // Emit the professional outcome on its OWN event, decoupled from the
              // callEnded / Terminated-stateChange race. SIP.js fires the Terminated
              // stateChange (→ handleTermination → callEnded) BEFORE it invokes this
              // onReject delegate, so attaching the label to callEnded always lost it
              // (handleTermination ran first, with pendingOutcomes still empty). A
              // reject only ever happens on an outbound INVITE before answer, and the
              // ICE-retry path already returned above, so emitting here is exactly the
              // "genuine outbound pre-answer failure" case the toast wants — no
              // dependence on whether the line is still tracked.
              if (outcome) {
                this.ctx.emit({ type: 'callOutcome', lineId, outcome });
              }

              if (this.ctx.lineStates.has(lineId)) {
                this.cleanupLine(lineId);
                this.ctx.emit({ type: 'callEnded', lineId, reason, outcome });
              }
              // NOTE: if the line is already gone, the Terminated stateChange
              // (handleTermination) has already emitted callEnded — the toast is
              // driven by the callOutcome event above, so nothing more to do here.
            },
          },
        })
        .then(() => {
          // INVITE dispatched — closes the dial→INVITE window (mic + offer + ICE
          // gathering + dispatch; ICE gathering dominates and is what pre-warming
          // would remove). Telemetry-only (Phase 0 measurement).
          // Guarded: a telemetry emit must NEVER surface as a call failure via the
          // .catch below (emit routes to handleEvent, which is unwrapped upstream).
          try {
            this.ctx.emit({ type: 'inviteSent', lineId });
          } catch (err) {
            logger.debug(`inviteSent telemetry emit failed (non-critical) on line ${lineId}:`, err);
          }
        })
        .catch((error) => {
          logger.warn(`Invite failed for line ${lineId}:`, error);
          handleEarlyTermination();
        });

      handleEarlyTermination();
      return lineId;
    } catch (error) {
      this.cleanupLine(lineId);
      throw error instanceof SipError
        ? error
        : new CallError('Failed to make call', SipErrorCode.CALL_FAILED, {
            cause: error instanceof Error ? error : undefined,
            lineId,
          });
    }
  }

  // ---------------------------------------------------------------------------
  // Call Control
  // ---------------------------------------------------------------------------

  async answerCall(lineId: number): Promise<void> {
    const session = this.ctx.sessions.get(lineId);
    if (!session) {
      throw new CallError('Line not found', SipErrorCode.CALL_NOT_FOUND, { lineId });
    }

    const invitation = session as unknown as Invitation;
    if (typeof invitation.accept !== 'function') {
      throw new CallError('Not an incoming call', SipErrorCode.INVALID_CALL_STATE, { lineId });
    }

    // If there's an active call, put it on hold before answering
    const activeCall = Array.from(this.ctx.lineStates.values()).find(
      (line) => line.id !== lineId && line.state === 'established' && !line.isHeld
    );
    if (activeCall) {
      await this.holdCall(activeCall.id).catch((err) => {
        logger.warn(`Failed to hold active call on line ${activeCall.id}:`, err);
      });
    }

    callAudioService.stopRingtone();

    const config = this.ctx.getConfig();

    try {
      this.ctx.updateLineState(lineId, { state: 'connecting' });

      // Race invitation.accept() against a 15s timeout. If SIP.js's internal
      // getUserMedia or SDP negotiation hangs, we give up and let the user retry
      // instead of leaving them in an infinite "Connecting..." state.
      const acceptPromise = invitation.accept({
        sessionDescriptionHandlerOptions: {
          constraints: getMediaConstraints(config.audioConstraints),
        } as SessionDescriptionHandlerOptions,
        // Tune Opus for lossy/low-bandwidth links (FEC + capped bitrate).
        sessionDescriptionHandlerModifiers: [opusLowBandwidthModifier],
      });

      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error('Call accept timed out — media acquisition may be stuck'));
        }, 15000);
      });

      await Promise.race([acceptPromise, timeoutPromise]);

      // Release pre-warmed stream — SIP.js now has its own from accept()
      this.releasePreWarmedMedia(lineId);

      // State transition to 'established' + setupRemoteAudio are handled by the
      // stateChange listener (setupSessionHandlers) — no duplicate work here.
      logger.debug(`Inbound accept() resolved for line ${lineId}, state: ${session.state}`);
    } catch (error) {
      this.cleanupLine(lineId);
      const message =
        error instanceof Error && error.message.includes('timed out')
          ? 'Could not answer call — microphone may be stuck. Please try again or reload the page.'
          : 'Failed to answer call';
      throw new CallError(message, SipErrorCode.CALL_FAILED, {
        cause: error instanceof Error ? error : undefined,
        lineId,
      });
    }
  }

  async rejectCall(lineId: number): Promise<void> {
    const session = this.ctx.sessions.get(lineId);
    if (!session) {
      throw new CallError('Line not found', SipErrorCode.CALL_NOT_FOUND, { lineId });
    }

    const invitation = session as unknown as Invitation;
    if (typeof invitation.reject !== 'function') {
      throw new CallError('Not an incoming call', SipErrorCode.INVALID_CALL_STATE, { lineId });
    }

    callAudioService.stopRingtone();

    try {
      await invitation.reject();
    } finally {
      this.cleanupLine(lineId);
      this.ctx.emit({ type: 'callEnded', lineId, reason: 'rejected' });
    }
  }

  async endCall(lineId: number): Promise<void> {
    const session = this.ctx.sessions.get(lineId);
    if (!session) return;

    // Set pending cancellation flag — makeCall() handlers check this
    // to terminate the call at the earliest opportunity (onTrying/onProgress/onAccept)
    this.pendingCancellations.add(lineId);

    // If session is already terminated, just clean up any leftover state
    if (session.state === SessionState.Terminated) {
      if (this.ctx.lineStates.has(lineId)) {
        this.cleanupLine(lineId);
        this.ctx.emit({ type: 'callEnded', lineId });
      }
      return;
    }

    // For Established sessions, bye() is reliable — send it and let the
    // session stateChange handler (handleTermination) do cleanup.
    if (session.state === SessionState.Established) {
      try {
        await session.bye();
      } catch (error) {
        logger.error('Error sending BYE:', error);
        // BYE failed (network error, etc.) — force cleanup
        if (this.ctx.lineStates.has(lineId)) {
          this.cleanupLine(lineId);
          this.ctx.emit({ type: 'callEnded', lineId });
        }
      }
      return;
    }

    // For Establishing/Initial sessions (early hangup), cancel() may fail
    // if no provisional response has been received yet. Use a retry +
    // safety timeout approach to guarantee cleanup.
    if (session.state === SessionState.Establishing || session.state === SessionState.Initial) {
      const inviter = session as unknown as Inviter;
      let cancelled = false;

      try {
        await inviter.cancel();
        cancelled = true;
        logger.info(`Cancel sent for line ${lineId}`);
      } catch (error) {
        logger.warn(`Cancel failed for line ${lineId} (may need retry):`, error);
      }

      if (cancelled) {
        // cancel() succeeded — session will transition to Terminated via stateChange.
        // Set a safety timeout in case the state transition never fires.
        this.startEndCallSafetyTimeout(lineId, session);
        return;
      }

      // cancel() failed — likely no provisional response yet.
      // Immediately update UI to show the call is ending so the user gets feedback.
      this.ctx.updateLineState(lineId, { state: 'ended' });

      // Listen for state changes: when session reaches Establishing (got 1xx),
      // retry the cancel. Safety timeout guarantees cleanup either way.
      const retryListener = (state: SessionState) => {
        if (state === SessionState.Establishing || state === SessionState.Established) {
          session.stateChange.removeListener(retryListener);
          // Got a response — now cancel/bye should work
          if (state === SessionState.Established) {
            session.bye().catch((err) => {
              logger.warn(`Retry BYE failed for line ${lineId}:`, err);
            });
          } else {
            (session as unknown as Inviter).cancel().catch((err) => {
              logger.warn(`Retry cancel failed for line ${lineId}:`, err);
            });
          }
        } else if (state === SessionState.Terminated) {
          session.stateChange.removeListener(retryListener);
          // Already terminated — handleTermination will clean up
        }
      };

      session.stateChange.addListener(retryListener);
      // Use shorter timeout for failed cancel — user already sees "ending" state
      this.startEndCallSafetyTimeout(lineId, session, 2_000);
    }
  }

  /**
   * Safety timeout: if the session doesn't reach Terminated within 5 seconds
   * after endCall(), force-clean the line. Prevents orphaned background calls.
   */
  private startEndCallSafetyTimeout(
    lineId: number,
    session: Session,
    timeoutMs: number = END_CALL_SAFETY_TIMEOUT_MS
  ): void {
    const timer = setTimeout(() => {
      if (this.ctx.lineStates.has(lineId)) {
        logger.warn(
          `End-call safety timeout for line ${lineId} (session state: ${session.state}) — forcing cleanup`
        );
        // Try one last cancel/bye attempt
        try {
          if (session.state === SessionState.Established) {
            session.bye().catch(() => {});
          } else if (
            session.state === SessionState.Establishing ||
            session.state === SessionState.Initial
          ) {
            (session as unknown as Inviter).cancel().catch(() => {});
          }
        } catch {
          // Ignore — we're force-cleaning anyway
        }
        // Force cleanup regardless
        this.cleanupLine(lineId);
        this.ctx.emit({ type: 'callEnded', lineId });
      }
    }, timeoutMs);

    // If session terminates normally before timeout, clear it
    const clearOnTerminate = (state: SessionState) => {
      if (state === SessionState.Terminated) {
        clearTimeout(timer);
        session.stateChange.removeListener(clearOnTerminate);
      }
    };
    session.stateChange.addListener(clearOnTerminate);
  }

  async holdCall(lineId: number): Promise<void> {
    const session = this.ctx.sessions.get(lineId);
    if (!session || session.state !== SessionState.Established) {
      throw new CallError('Call not established', SipErrorCode.INVALID_CALL_STATE, { lineId });
    }

    const lineState = this.ctx.lineStates.get(lineId);
    if (lineState?.isHeld) {
      logger.info(`Call on line ${lineId} already held, skipping`);
      return;
    }

    try {
      const pc = this.ctx.getPeerConnection(session);
      const sender = pc?.getSenders().find((s) => s.track?.kind === 'audio') ?? null;
      if (!pc || !sender) {
        throw new CallError('No audio sender to hold', SipErrorCode.INVALID_CALL_STATE, { lineId });
      }

      // Remember the live mic track so unhold can restore it.
      this.holdSavedMic.set(lineId, sender.track);

      // Swap the mic for hold music (remote hears MOH over the existing Opus path),
      // else fall back to a silent hold.
      const music = await createHoldMusicTrack();
      if (music) {
        this.holdMusicHandles.set(lineId, music);
        await sender.replaceTrack(music.track);
      } else if (sender.track) {
        sender.track.enabled = false;
      }

      // Don't play the remote party's audio to the user while on hold.
      const el = this.ctx.remoteAudioElements.get(lineId);
      if (el) {
        this.holdSavedElMuted.set(lineId, el.muted);
        el.muted = true;
      }

      this.ctx.updateLineState(lineId, { isHeld: true, state: 'held' });
      logger.info(
        `Call on line ${lineId} placed on hold (client-side ${music ? 'MOH' : 'silent'})`
      );
    } catch (error) {
      // Roll back any partial hold so the call isn't left half-held.
      this.teardownHoldMusic(lineId);
      throw new CallError('Failed to hold call', SipErrorCode.CALL_FAILED, {
        cause: error instanceof Error ? error : undefined,
        lineId,
      });
    }
  }

  /**
   * Resume a client-side hold: restore the mic on the audio sender (fresh
   * getUserMedia if the saved track was released while held), stop the music, and
   * unmute the remote audio. No re-INVITE.
   */
  async unholdCall(lineId: number): Promise<void> {
    const session = this.ctx.sessions.get(lineId);
    if (!session || session.state !== SessionState.Established) {
      throw new CallError('Call not established', SipErrorCode.INVALID_CALL_STATE, { lineId });
    }

    // Skip if already unheld (idempotent guard for concurrent unhold attempts)
    const lineState = this.ctx.lineStates.get(lineId);
    if (lineState && !lineState.isHeld) {
      logger.info(`Call on line ${lineId} is not held, skipping unhold`);
      return;
    }

    try {
      const pc = this.ctx.getPeerConnection(session);
      const sender = pc?.getSenders().find((s) => s.track?.kind === 'audio') ?? null;

      // Restore the mic. If the saved track ended (device released while held),
      // acquire a fresh one.
      let mic = this.holdSavedMic.get(lineId) ?? null;
      if (sender) {
        if (!mic || mic.readyState === 'ended') {
          try {
            const config = this.ctx.getConfig();
            const stream = await navigator.mediaDevices.getUserMedia(
              getMediaConstraints(config.audioConstraints)
            );
            mic = stream.getAudioTracks()[0] ?? null;
          } catch (micErr) {
            logger.error(`Line ${lineId} unhold: failed to acquire microphone`, micErr);
          }
        }
        if (mic) {
          await sender.replaceTrack(mic);
          // Respect mute state — don't re-enable the mic if the call was muted.
          mic.enabled = !lineState?.isMuted;
        }
      }

      this.teardownHoldMusic(lineId);

      // Restore remote audio to its pre-hold muted state.
      const el = this.ctx.remoteAudioElements.get(lineId);
      if (el) {
        el.muted = this.holdSavedElMuted.get(lineId) ?? false;
      }
      this.holdSavedElMuted.delete(lineId);

      this.ctx.updateLineState(lineId, { isHeld: false, state: 'established' });
      logger.info(`Call on line ${lineId} resumed from hold`);
    } catch (error) {
      throw new CallError('Failed to unhold call', SipErrorCode.CALL_FAILED, {
        cause: error instanceof Error ? error : undefined,
        lineId,
      });
    }
  }

  /**
   * Stop and drop hold-music resources for a line. Idempotent.
   *
   * @param stopSavedMic also stop the saved mic track. Use ONLY on call teardown,
   *   where the mic is orphaned (the sender carries the music track, so the
   *   sender-stop loop in cleanupLine never reaches the mic → it would stay live
   *   and keep the mic device open). On UNHOLD the mic has already been moved back
   *   onto the sender, so it must NOT be stopped here.
   */
  private teardownHoldMusic(lineId: number, stopSavedMic = false): void {
    const music = this.holdMusicHandles.get(lineId);
    if (music) {
      try {
        music.stop();
      } catch {
        /* ignore */
      }
      this.holdMusicHandles.delete(lineId);
    }
    if (stopSavedMic) {
      const mic = this.holdSavedMic.get(lineId);
      if (mic && mic.readyState === 'live') {
        try {
          mic.stop();
        } catch {
          /* ignore */
        }
      }
    }
    this.holdSavedMic.delete(lineId);
  }

  async switchCalls(): Promise<number | null> {
    const activeCall = Array.from(this.ctx.lineStates.values()).find(
      (line) => line.state === 'established' && !line.isHeld
    );

    const heldCall = Array.from(this.ctx.lineStates.values()).find(
      (line) => line.isHeld && (line.state === 'held' || line.state === 'holding')
    );

    if (!activeCall || !heldCall) {
      logger.warn('Cannot switch calls: need one active and one held call');
      return null;
    }

    try {
      await this.holdCall(activeCall.id);
      await this.unholdCall(heldCall.id);

      this.ctx.emit({
        type: 'callsSwitched',
        newActiveLineId: heldCall.id,
        previousActiveLineId: activeCall.id,
      });

      logger.info(`Switched calls: Line ${activeCall.id} on hold, Line ${heldCall.id} active`);
      return heldCall.id;
    } catch (error) {
      logger.error('Failed to switch calls:', error);
      throw new CallError('Failed to switch calls', SipErrorCode.CALL_FAILED, {
        cause: error instanceof Error ? error : undefined,
      });
    }
  }

  muteCall(lineId: number): void {
    this.setLineMuted(lineId, true);
  }

  unmuteCall(lineId: number): void {
    this.setLineMuted(lineId, false);
  }

  /**
   * Mute/unmute a line's outbound audio. While the line is HELD the audio sender
   * carries the hold-music track, so we target the SAVED mic instead — otherwise
   * muting would silence the music, not the (parked) mic, and unhold would then
   * restore an unexpectedly-live mic.
   */
  private setLineMuted(lineId: number, muted: boolean): void {
    const session = this.ctx.sessions.get(lineId);
    if (!session) return;

    if (this.ctx.lineStates.get(lineId)?.isHeld) {
      const mic = this.holdSavedMic.get(lineId);
      if (mic) mic.enabled = !muted;
    } else {
      const pc = this.ctx.getPeerConnection(session);
      if (!pc) return;
      pc.getSenders().forEach((sender) => {
        if (sender.track?.kind === 'audio') {
          sender.track.enabled = !muted;
        }
      });
    }

    this.ctx.updateLineState(lineId, { isMuted: muted });
  }

  sendDTMF(lineId: number, tone: DTMFTone): void {
    const session = this.ctx.sessions.get(lineId);
    if (!session) {
      logger.warn(`Cannot send DTMF: no session for line ${lineId}`);
      return;
    }

    if (session.state !== SessionState.Established) {
      logger.warn(
        `Cannot send DTMF: call not established on line ${lineId} (state: ${session.state})`
      );
      return;
    }

    const pc = this.ctx.getPeerConnection(session);
    if (!pc) {
      logger.warn(`Cannot send DTMF: no peer connection for line ${lineId}`);
      return;
    }

    const config = this.ctx.getConfig();
    const { duration, interToneGap } = config.call.dtmf;
    let dtmfSent = false;

    pc.getSenders().forEach((sender) => {
      if (sender.track?.kind === 'audio' && sender.dtmf) {
        try {
          sender.dtmf.insertDTMF(tone, duration, interToneGap);
          dtmfSent = true;
          logger.debug(`DTMF tone '${tone}' sent on line ${lineId}`);
        } catch (error) {
          logger.error(`Failed to send DTMF tone '${tone}' on line ${lineId}:`, error);
        }
      }
    });

    if (!dtmfSent) {
      logger.warn(
        `No DTMF capability available on line ${lineId} - audio sender may not support DTMF`
      );
      return;
    }

    this.ctx.emit({ type: 'dtmfReceived', lineId, tone });
  }

  async transferCall(lineId: number, targetNumber: string): Promise<void> {
    const session = this.ctx.sessions.get(lineId);
    if (!session || session.state !== SessionState.Established) {
      throw new CallError('Call not established', SipErrorCode.INVALID_CALL_STATE, { lineId });
    }

    const credentials = this.ctx.getCredentials();
    const formattedNumber = this.ctx.formatPhoneNumber(targetNumber);
    const targetUri = UserAgent.makeURI(`sip:${formattedNumber}@${credentials?.domain}`);

    if (!targetUri) {
      throw new CallError('Invalid transfer target', SipErrorCode.CALL_FAILED, { lineId });
    }

    try {
      this.ctx.updateLineState(lineId, { state: 'transferring' });
      this.startTransferTimeout(lineId);

      await session.refer(targetUri, {
        onNotify: (notification) => {
          const sipFrag = notification.request.body;

          if (sipFrag.includes('200 OK') || sipFrag.includes('SIP/2.0 200')) {
            this.clearTransferTimeout(lineId);
            logger.info(`Blind transfer accepted for line ${lineId}`);
            this.ctx.emit({ type: 'transferCompleted', lineId, target: targetNumber });
            setTimeout(() => {
              this.endCall(lineId).catch((err) =>
                logger.warn(`Failed to end call after blind transfer: ${err}`)
              );
            }, TRANSFER_END_DELAY_MS);
          } else if (/SIP\/2\.0 [4-6]\d{2}/.test(sipFrag)) {
            this.clearTransferTimeout(lineId);
            logger.warn(`Blind transfer failed for line ${lineId}: ${sipFrag}`);
            this.ctx.updateLineState(lineId, { state: 'established' });
            this.ctx.emit({ type: 'transferFailed', lineId, reason: sipFrag });
          }
        },
      });

      logger.info(`Initiated blind transfer from line ${lineId} to ${targetNumber}`);
    } catch (error) {
      this.clearTransferTimeout(lineId);
      this.ctx.updateLineState(lineId, { state: 'established' });
      throw new CallError('Failed to transfer call', SipErrorCode.CALL_FAILED, {
        cause: error instanceof Error ? error : undefined,
        lineId,
      });
    }
  }

  getLineState(lineId: number): CallLine | undefined {
    return this.ctx.lineStates.get(lineId);
  }

  getAllLines(): CallLine[] {
    // Return only LIVE lines. A line in a terminal state ('ended'/'error') can
    // briefly linger in the map before cleanupLine() deletes it — and if the
    // follow-up cleanup never fires (a cancel() whose Terminated stateChange is
    // lost, a dropped transport, a missed safety-timeout), it would stay forever.
    // getAllLines() is the single source for the call list AND the multi-call /
    // conference strip (shown when >= 2 lines), so one stale dead line would
    // wrongly pop the multi-call UI on a fresh single call. Filtering terminal
    // states here fixes it for every consumer at once — a dead line never counts.
    return Array.from(this.ctx.lineStates.values()).filter(
      (line) => line.state !== 'ended' && line.state !== 'error'
    );
  }

  /**
   * Idempotently mark a line CONNECTED ("established").
   *
   * A 200 OK fires BOTH the `onAccept` delegate AND the SessionState.Established
   * FSM transition. Historically the UI only flipped to "connected" from the
   * Established state-change — but that event can race or be missed (the listener
   * attaches after the state has already advanced, or SIP.js coalesces the
   * transition), which left the caller stuck on "Ringing" while the callee had
   * answered and media was flowing. Depending on a single signal reintroduced
   * that bug every time.
   *
   * Defense-in-depth fix: BOTH signals call this method — whichever arrives first
   * wins and does the full connect (state + audio + stats), and the second is a
   * harmless no-op because we bail out once the line is already established.
   * JS is single-threaded, so the guard read + state write can't interleave.
   *
   * Safe to call any number of times, from either signal, in any order.
   */
  private markEstablished(session: Session, lineId: number): void {
    const lineState = this.ctx.lineStates.get(lineId);
    // Already connected (the other signal won) or the line is gone → no-op.
    if (!lineState || lineState.state === 'established') return;

    callAudioService.stopRingback();
    callAudioService.stopRingtone();
    this.setupRemoteAudio(session, lineId);
    // Hard-cap the Opus uplink bitrate on thin links (the "internet hungry" fix).
    const pc = this.ctx.getPeerConnection(session);
    if (pc) void capAudioSenderBitrate(pc);
    // Unmute remote audio — may have been muted during the early media phase
    // to suppress carrier ringback while our local ringback played.
    const el = this.ctx.remoteAudioElements.get(lineId);
    if (el && el.muted) {
      el.muted = false;
      logger.debug(`Remote audio unmuted on line ${lineId}`);
    }
    this.qualityManager.startStatsPolling(lineId);
    this.logCallAnswer(lineId).catch((err) => {
      logger.warn('Failed to log call answer:', err);
    });
    // The early-return guard above guarantees this runs at most once per call,
    // so the line flips to "connected" exactly once regardless of which signal
    // (onAccept or Established) won the race.
    this.ctx.updateLineState(lineId, {
      state: 'established',
      wasAnswered: true,
      answerTime: new Date(),
    });
  }

  // ---------------------------------------------------------------------------
  // Session Handlers
  // ---------------------------------------------------------------------------

  private setupSessionHandlers(session: Session, lineId: number): void {
    let terminationHandled = false;

    // BYE queue: SIP.js silently drops BYE if session is not yet Established
    // (e.g., between 200 OK sent and ACK received for inbound calls).
    // We intercept BYE during non-Established states and process it once Established.
    let pendingBye: { accept: () => void } | null = null;

    const handleTermination = (source: string) => {
      if (terminationHandled) {
        logger.debug(`Termination already handled for line ${lineId}, ignoring ${source}`);
        return;
      }
      terminationHandled = true;

      logger.debug(`Handling termination for line ${lineId} from ${source}`);
      callAudioService.stopRingback();
      // Only stop ringtone if no other inbound lines are still ringing.
      // Parallel fork (FreeSWITCH bridges to both Kamailio nodes) creates 2 lines
      // for 1 call — when one fork is CANCEL'd, the ringtone must keep playing
      // for the surviving ringing line.
      const hasOtherRinging = Array.from(this.ctx.lineStates.values()).some(
        (l) => l.id !== lineId && l.direction === 'inbound' && l.state === 'ringing'
      );
      if (!hasOtherRinging) {
        callAudioService.stopRingtone();
      }
      this.qualityManager.stopStatsPolling(lineId);

      if (this.ctx.lineStates.has(lineId)) {
        // Attach any professional outcome recorded by onReject for this line —
        // captured BEFORE cleanupLine (which clears the map).
        const outcome = this.pendingOutcomes.get(lineId);
        this.cleanupLine(lineId);
        this.ctx.emit({ type: 'callEnded', lineId, outcome });
      }
    };

    const processBye = (source: string) => {
      logger.info(`Processing BYE on line ${lineId} (${source})`);
      callAudioService.stopRingback();
      // Only stop ringtone if no other inbound lines are ringing
      const hasOtherRingingBye = Array.from(this.ctx.lineStates.values()).some(
        (l) => l.id !== lineId && l.direction === 'inbound' && l.state === 'ringing'
      );
      if (!hasOtherRingingBye) {
        callAudioService.stopRingtone();
      }
      if (this.ctx.lineStates.has(lineId)) {
        this.cleanupLine(lineId);
        this.ctx.emit({ type: 'callEnded', lineId, reason: 'Remote hangup' });
      }
    };

    // Monkey-patch onByeRequest to intercept BYE during non-Established states.
    // SIP.js Session.onByeRequest (session.js:716) silently drops BYE if state !== Established.
    // For inbound calls, BYE can arrive during Establishing (between 200 OK sent and ACK received).
    // We override onByeRequest to queue BYE and replay it once session is Established.
    //
    // FRAGILITY NOTE: This accesses a private SIP.js method. If SIP.js removes or renames
    // onByeRequest in a future version, the guard below will log an error and fall back
    // to default behavior (BYE dropped during Establishing — call hangs until timeout).
    // If you see "onByeRequest not found" errors after a SIP.js upgrade, this patch needs updating.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sessionAny = session as any;
    if (typeof sessionAny.onByeRequest !== 'function') {
      logger.error(
        'SIP.js onByeRequest method not found — BYE queue patch cannot be applied. ' +
          'This likely means SIP.js was upgraded. Early BYE during Establishing state will be dropped.'
      );
    }
    const originalOnByeRequest =
      typeof sessionAny.onByeRequest === 'function'
        ? (sessionAny.onByeRequest as (request: unknown) => void).bind(session)
        : null;
    if (originalOnByeRequest) {
      sessionAny.onByeRequest = (request: { accept: () => void }) => {
        if (session.state === SessionState.Established) {
          // Normal path — let SIP.js handle it (calls delegate.onBye, transitions to Terminated)
          originalOnByeRequest(request);
        } else {
          // BYE arrived before Established (e.g., during Establishing)
          // Queue the raw request and accept it. We'll handle termination when session becomes Established.
          logger.warn(
            `BYE received on line ${lineId} during ${session.state} — queuing for post-Established processing`
          );
          try {
            request.accept();
          } catch (error) {
            logger.warn('Early BYE accept error:', error);
          }
          pendingBye = request;
        }
      };
    } // end if (originalOnByeRequest)

    session.delegate = {
      onBye: () => {
        // Called by SIP.js onByeRequest when state === Established.
        // SIP.js handles state transition to Terminated after this.
        processBye('delegate-established');
      },
      onCancel: () => {
        logger.info(`CANCEL received on line ${lineId}`);
        callAudioService.stopRingback();
        // Only stop ringtone if no other inbound lines are still ringing
        // (parallel fork: one fork cancelled, other still active)
        const hasOtherRinging = Array.from(this.ctx.lineStates.values()).some(
          (l) => l.id !== lineId && l.direction === 'inbound' && l.state === 'ringing'
        );
        if (!hasOtherRinging) {
          callAudioService.stopRingtone();
        }
        if (this.ctx.lineStates.has(lineId)) {
          this.cleanupLine(lineId);
          this.ctx.emit({ type: 'callEnded', lineId, reason: 'Call cancelled' });
        }
      },
    };

    session.stateChange.addListener((state) => {
      logger.debug(`Session state change for line ${lineId}: ${state}`);

      const lineState = this.ctx.lineStates.get(lineId);
      if (!lineState) {
        logger.debug(`No line state found for line ${lineId}, cleaning up`);
        handleTermination('stateChange-noLineState');
        return;
      }

      let newCallState: CallState = lineState.state;

      switch (state) {
        case SessionState.Establishing:
          newCallState = 'connecting';
          // Start stats polling early (during ringing/early media) so MOS and
          // connection quality data is available by the time the call connects.
          // The PeerConnection exists at this point (created by 183 SDP).
          this.qualityManager.startStatsPolling(lineId);
          break;
        case SessionState.Established:
          newCallState = 'established';
          // Idempotent connect — ALSO driven by the onAccept (200 OK) delegate, so
          // a raced/missed Established event can't leave the UI stuck ringing while
          // the call is live. Whichever signal fires first wins; this is a no-op if
          // onAccept already connected the line. See markEstablished().
          this.markEstablished(session, lineId);
          // Process any BYE that arrived during Establishing state.
          // The BYE was already accepted (200 OK sent to remote) — we just need to
          // clean up the call locally and end the session.
          if (pendingBye) {
            logger.info(`Processing queued BYE for line ${lineId} (arrived during Establishing)`);
            pendingBye = null;
            // Small delay to let SIP.js finish Established state transition internals
            setTimeout(() => {
              processBye('queued-post-established');
              // Terminate the session — SIP.js skipped this since we intercepted onByeRequest
              try {
                session.dispose();
              } catch (error) {
                logger.debug('Session dispose after queued BYE:', error);
              }
            }, 50);
          }
          break;
        case SessionState.Terminating:
        case SessionState.Terminated:
          newCallState = 'ended';
          pendingBye = null; // Clear queued BYE — termination handles cleanup
          handleTermination(`stateChange-${state}`);
          break;
      }

      if (newCallState !== lineState.state && newCallState !== 'ended') {
        const updates: Partial<CallLine> = { state: newCallState };
        if (newCallState === 'established') {
          updates.wasAnswered = true;
          updates.answerTime = new Date();
        }
        this.ctx.updateLineState(lineId, updates);
      }
    });

    const originalDispose = session.dispose.bind(session);
    session.dispose = () => {
      logger.debug(`Session disposed for line ${lineId}`);
      handleTermination('dispose');
      return originalDispose();
    };
  }

  // ---------------------------------------------------------------------------
  // ICE Restart
  // ---------------------------------------------------------------------------

  /**
   * Attempt ICE restart via re-INVITE when no media flow is detected.
   * Triggered by SipQualityManager after ~2 consecutive no-data intervals (~4s).
   * By then STUN has long completed, so fresh ICE gathering includes srflx
   * candidates. Capped at MAX_ICE_RESTARTS per line with a cooldown, so a call
   * can self-heal a second media loss without risking a restart storm.
   */
  attemptIceRestart(lineId: number): void {
    const MAX_ICE_RESTARTS = 2;
    const ICE_RESTART_COOLDOWN_MS = 10_000;
    const st = this.iceRestartState.get(lineId) ?? { count: 0, lastAt: 0 };
    if (st.count >= MAX_ICE_RESTARTS) {
      logger.debug(`ICE restart cap (${MAX_ICE_RESTARTS}) reached for line ${lineId}, skipping`);
      return;
    }
    if (Date.now() - st.lastAt < ICE_RESTART_COOLDOWN_MS) {
      logger.debug(`ICE restart within cooldown for line ${lineId}, skipping`);
      return;
    }

    const session = this.ctx.sessions.get(lineId);
    if (!session) return;

    const lineState = this.ctx.lineStates.get(lineId);
    if (!lineState || lineState.state !== 'established') return;

    this.iceRestartState.set(lineId, { count: st.count + 1, lastAt: Date.now() });
    logger.info(`Attempting ICE restart for line ${lineId} (attempt ${st.count + 1}/${MAX_ICE_RESTARTS})`);

    const pc = this.ctx.getPeerConnection(session);
    if (!pc) {
      logger.warn(`No PeerConnection for line ${lineId}, cannot restart ICE`);
      return;
    }

    // Trigger ICE restart via re-INVITE with iceRestart option
    const inviteOptions = {
      sessionDescriptionHandlerOptions: {
        iceRestart: true,
      },
    };

    const invitable = session as unknown as { invite?: (options?: unknown) => Promise<unknown> };
    if (typeof invitable.invite === 'function') {
      invitable
        .invite(inviteOptions)
        .then(() => {
          logger.info(`ICE restart re-INVITE sent for line ${lineId}`);
          // Clear old audio element so setupRemoteAudio creates fresh one
          // with new tracks from the renegotiated PeerConnection
          const oldAudio = this.ctx.remoteAudioElements.get(lineId);
          if (oldAudio) {
            oldAudio.srcObject = null;
          }
          this.setupRemoteAudio(session, lineId);
        })
        .catch((err: unknown) => {
          logger.error(`ICE restart failed for line ${lineId}:`, err);
        });
    } else {
      logger.warn(`Session on line ${lineId} does not support re-INVITE`);
    }
  }

  /**
   * Set the INITIAL playout jitter-buffer floor on the remote audio receiver at
   * media setup — a bigger buffer trades a little latency for far fewer dropouts
   * / concealment artifacts on lossy (Pakistan) last-mile links (the team's noted
   * #1 MOS lever). From here, SipQualityManager adapts the target UPWARD on lossy
   * links and back DOWN when the link is clean. Shared helper is feature-detected
   * and non-throwing, so a missing API never blocks audio.
   */
  private applyReceiverJitterBuffer(receiver: RTCRtpReceiver): void {
    applyJitterBufferTarget(receiver, JITTER_BUFFER_BASE_MS);
  }

  private setupRemoteAudio(session: Session, lineId: number): void {
    try {
      const pc = this.ctx.getPeerConnection(session);
      if (!pc) return;

      let audioElement = this.ctx.remoteAudioElements.get(lineId);

      if (audioElement?.srcObject) {
        const existingStream = audioElement.srcObject as MediaStream;
        if (existingStream.getAudioTracks().length > 0 && existingStream.active) {
          logger.debug(`Remote audio already set up for line ${lineId}`);
          return;
        }
      }

      if (!audioElement) {
        audioElement = new Audio();
        audioElement.autoplay = true;
        // Route new call audio to the user's chosen output device. The media
        // manager only re-points elements that ALREADY exist when the user picks
        // a device, so a freshly created element would otherwise fall back to the
        // OS default until the next manual selection. Best-effort / non-blocking.
        const sinkId = this.ctx.getSelectedOutputDeviceId();
        if (sinkId && 'setSinkId' in audioElement) {
          (audioElement as HTMLAudioElement & { setSinkId: (id: string) => Promise<void> })
            .setSinkId(sinkId)
            .catch((err) => logger.warn(`Failed to set output device for line ${lineId}:`, err));
        }
        this.ctx.remoteAudioElements.set(lineId, audioElement);
      }

      const remoteStream = new MediaStream();
      pc.getReceivers().forEach((receiver) => {
        if (receiver.track) {
          remoteStream.addTrack(receiver.track);
          if (receiver.track.kind === 'audio') this.applyReceiverJitterBuffer(receiver);
        }
      });
      // We just set the receiver to the base floor; drop any stale adaptive JB
      // state so the quality manager re-syncs (and can re-raise on the next poll
      // if the link is still lossy — e.g. right after an ICE-restart re-entry).
      this.qualityManager.resetJitterBufferState(lineId);

      // Attach through the volume booster. When boost is off (the default) this
      // is a plain `srcObject = remoteStream` passthrough; when on, the remote
      // audio is routed through a Web Audio gain stage and fed back into this
      // same element (preserving output-device selection). Never throws.
      remoteAudioBoost.attach(lineId, audioElement, remoteStream);
      audioElement.play().catch((err) => logger.error('Failed to play remote audio', err));
      logger.debug(`Remote audio set up for line ${lineId}`);
    } catch (error) {
      logger.error('Error setting up remote audio:', error);
    }
  }

  // ---------------------------------------------------------------------------
  // Call Logging
  // ---------------------------------------------------------------------------

  private async logCallStart(
    lineId: number,
    remoteNumber: string,
    direction: 'inbound' | 'outbound',
    sipCallId?: string
  ): Promise<void> {
    try {
      const normalizedNumber = normalizePhone(remoteNumber);
      const call = await callsService.createCall({
        callee: normalizedNumber,
        direction,
        startTime: new Date().toISOString(),
        sipCallId,
      });
      this.ctx.updateLineState(lineId, { callRecordId: call.id });
      logger.info(
        `Call logged to backend: ${call.id}${sipCallId ? ` (sipCallId: ${sipCallId})` : ''}`
      );
    } catch (error) {
      logger.warn('Failed to log call start to backend:', error);
    }
  }

  private async logRejectedCall(remoteNumber: string, status: 'blocked' | 'dnd'): Promise<void> {
    try {
      const now = new Date().toISOString();
      await callsService.createCall({
        callee: normalizePhone(remoteNumber),
        direction: 'inbound',
        startTime: now,
        endTime: now,
        status,
      });
      logger.info(`Rejected call logged: ${remoteNumber} (${status})`);
    } catch (error) {
      logger.warn('Failed to log rejected call:', error);
    }
  }

  private async logCallAnswer(lineId: number, attempt = 0): Promise<void> {
    const line = this.ctx.lineStates.get(lineId);
    if (!line) return;

    // The POST /calls that assigns callRecordId is fire-and-forget, so a fast
    // IVR auto-answer can reach "answered" before the id is back. Retry briefly
    // instead of dropping the answerTime — otherwise the backend never learns
    // the call was answered and mislabels it no-answer/0s. (logCallEnd also
    // re-sends answerTime as a final backstop.)
    if (!line.callRecordId) {
      if (attempt < 6) {
        setTimeout(() => void this.logCallAnswer(lineId, attempt + 1), 400);
      }
      return;
    }

    try {
      await callsService.updateCall(line.callRecordId, {
        // Use the captured answer time, not "now" (retries can be seconds late).
        answerTime: (line.answerTime ?? new Date()).toISOString(),
        status: 'answered',
      });
      logger.info(`Call answer logged: ${line.callRecordId}`);
    } catch (error) {
      logger.warn('Failed to log call answer:', error);
    }
  }

  private async logCallEnd(lineId: number, reason?: string): Promise<void> {
    const line = this.ctx.lineStates.get(lineId);
    if (!line?.callRecordId) return;

    const now = Date.now();
    const wasAnswered = line.wasAnswered === true;

    const ringTime = line.startTime
      ? Math.floor(((line.answerTime?.getTime() || now) - line.startTime.getTime()) / 1000)
      : 0;

    const duration =
      wasAnswered && line.answerTime ? Math.floor((now - line.answerTime.getTime()) / 1000) : 0;

    const status = wasAnswered ? CallStatus.COMPLETED : getUnansweredStatus(line.direction);

    try {
      await callsService.updateCall(line.callRecordId, {
        endTime: new Date().toISOString(),
        // Re-send answerTime on end (not only in logCallAnswer) so a dropped
        // mid-call answer PATCH — e.g. a fast IVR answer that beat the POST
        // /calls id race — never leaves the backend thinking the call was
        // unanswered, which would rewrite a real completed call to no-answer/0s.
        ...(wasAnswered && line.answerTime
          ? { answerTime: line.answerTime.toISOString() }
          : {}),
        duration,
        ringTime,
        status,
        reasonText: reason,
      });
      logger.info(
        `Call end logged: ${line.callRecordId}, ringTime: ${ringTime}s, duration: ${duration}s, status: ${status}`
      );
    } catch (error) {
      logger.warn('Failed to log call end:', error);
    }
  }

  // ---------------------------------------------------------------------------
  // Ring Timeout
  // ---------------------------------------------------------------------------

  private startRingTimeout(lineId: number, timeoutSeconds: number): void {
    this.clearRingTimeout(lineId);
    const timer = setTimeout(() => {
      const session = this.ctx.sessions.get(lineId);
      if (!session) return;

      const lineState = this.ctx.lineStates.get(lineId);
      if (lineState && (lineState.state === 'ringing' || lineState.state === 'dialing')) {
        logger.info(
          `Ring timeout (${timeoutSeconds}s) reached for line ${lineId}, auto-cancelling`
        );
        this.endCall(lineId).catch((err) =>
          logger.warn(`Failed to auto-cancel timed-out call on line ${lineId}:`, err)
        );
      }
    }, timeoutSeconds * 1000);
    this.ringTimeoutTimers.set(lineId, timer);
  }

  private clearRingTimeout(lineId: number): void {
    const timer = this.ringTimeoutTimers.get(lineId);
    if (timer) {
      clearTimeout(timer);
      this.ringTimeoutTimers.delete(lineId);
    }
  }

  // ---------------------------------------------------------------------------
  // Transfer Timeout
  // ---------------------------------------------------------------------------

  private startTransferTimeout(lineId: number): void {
    this.clearTransferTimeout(lineId);
    const timer = setTimeout(() => {
      const lineState = this.ctx.lineStates.get(lineId);
      if (lineState?.state === 'transferring') {
        logger.warn(`Transfer timeout (${TRANSFER_TIMEOUT_MS}ms) for line ${lineId}, reverting`);
        this.ctx.updateLineState(lineId, { state: 'established' });
        this.ctx.emit({ type: 'transferFailed', lineId, reason: 'Transfer timed out' });
      }
      this.transferTimeoutTimers.delete(lineId);
    }, TRANSFER_TIMEOUT_MS);
    this.transferTimeoutTimers.set(lineId, timer);
  }

  private clearTransferTimeout(lineId: number): void {
    const timer = this.transferTimeoutTimers.get(lineId);
    if (timer) {
      clearTimeout(timer);
      this.transferTimeoutTimers.delete(lineId);
    }
  }

  // ---------------------------------------------------------------------------
  // Media Pre-warming (Inbound)
  // ---------------------------------------------------------------------------

  /**
   * Pre-warm getUserMedia when an incoming call arrives.
   * Opening the mic device during ringing means the subsequent getUserMedia
   * inside invitation.accept() returns in ~10-50ms instead of 200-800ms,
   * because Chrome reuses the already-open device handle.
   */
  private preWarmMedia(lineId: number): void {
    const config = this.ctx.getConfig();
    // Wrap in a 4s timeout — if pre-warm hangs, we don't want to block the mic.
    // The actual accept() call will handle media acquisition with its own retry logic.
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        logger.debug(`Pre-warm getUserMedia timed out for line ${lineId} (non-critical)`);
      }
    }, 4000);

    navigator.mediaDevices
      .getUserMedia(getMediaConstraints(config.audioConstraints))
      .then((stream) => {
        if (settled) {
          // Already timed out — just close the stream we got
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        settled = true;
        clearTimeout(timer);
        // Only store if the line still exists (user might have rejected already)
        if (this.ctx.lineStates.has(lineId)) {
          this.preWarmedStreams.set(lineId, stream);
          logger.debug(`Pre-warmed media for incoming call on line ${lineId}`);
        } else {
          stream.getTracks().forEach((track) => track.stop());
        }
      })
      .catch((err) => {
        settled = true;
        clearTimeout(timer);
        logger.debug('Pre-warm getUserMedia failed (non-critical):', err);
      });
  }

  private releasePreWarmedMedia(lineId: number): void {
    const stream = this.preWarmedStreams.get(lineId);
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      this.preWarmedStreams.delete(lineId);
    }
  }

  // ---------------------------------------------------------------------------
  // Line Cleanup
  // ---------------------------------------------------------------------------

  cleanupLine(lineId: number): void {
    this.pendingCancellations.delete(lineId);
    this.pendingOutcomes.delete(lineId);
    this.releasePreWarmedMedia(lineId);
    // Ending while on hold: the sender carries music, so stop the orphaned mic too.
    this.teardownHoldMusic(lineId, true);
    this.holdSavedElMuted.delete(lineId);
    this.iceRestartState.delete(lineId);
    this.clearRingTimeout(lineId);
    this.clearTransferTimeout(lineId);
    this.logCallEnd(lineId).catch((err) => logger.warn('Failed to log call end:', err));

    // Stop local media tracks to release the microphone.
    // SIP.js's SDH.close() normally handles this via session.dispose(), but if
    // bye()/cancel() throws (network error, race condition), dispose() never runs
    // and the getUserMedia tracks stay active — Chrome shows mic-in-use indicator.
    // track.stop() is idempotent, so this is safe even if SDH.close() also runs.
    const session = this.ctx.sessions.get(lineId);
    if (session) {
      const pc = this.ctx.getPeerConnection(session);
      if (pc) {
        pc.getSenders().forEach((sender) => {
          if (sender.track) sender.track.stop();
        });
        pc.getReceivers().forEach((receiver) => {
          if (receiver.track) receiver.track.stop();
        });
      }

      // Safety net: if PeerConnection is already gone (cancelled before INVITE sent),
      // the SDH may still hold a media stream with active tracks. Access it directly.
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const sdh = (session as any).sessionDescriptionHandler;
        if (sdh) {
          // Stop tracks on the SDH's local media stream (if it exists)
          const localStream = sdh._localMediaStream || sdh.localMediaStream || sdh._mediaStream;
          if (localStream && typeof localStream.getTracks === 'function') {
            localStream.getTracks().forEach((track: MediaStreamTrack) => {
              if (track.readyState === 'live') {
                track.stop();
                logger.debug(`Stopped orphaned ${track.kind} track in SDH cleanup`);
              }
            });
          }
        }
      } catch {
        // Ignore — best-effort cleanup of orphaned tracks
      }
    }

    // Cleanup remote audio element
    remoteAudioBoost.release(lineId);
    const audioElement = this.ctx.remoteAudioElements.get(lineId);
    if (audioElement) {
      audioElement.pause();
      audioElement.srcObject = null;
      this.ctx.remoteAudioElements.delete(lineId);
    }

    // Cleanup recording if active
    if (this.recordingManager.isRecording(lineId)) {
      this.recordingManager
        .stopRecording(lineId)
        .catch((err) => logger.error('Error stopping recording:', err));
    }

    // Cleanup conference state (async — fire and forget)
    this.conferenceManager
      .handleLineCleanup(lineId)
      .catch((err) => logger.warn(`Conference cleanup error for line ${lineId}:`, err));

    // Cleanup attended transfer state
    this.transferManager.handleLineCleanup(lineId);

    // Stop stats polling
    this.qualityManager.stopStatsPolling(lineId);

    // Remove session and line state
    this.ctx.sessions.delete(lineId);
    this.ctx.lineStates.delete(lineId);
  }

  /**
   * End all active calls (for disconnect cleanup)
   */
  async endAllCalls(): Promise<void> {
    const lineIds = Array.from(this.ctx.sessions.keys());
    for (const lineId of lineIds) {
      try {
        await this.endCall(lineId);
      } catch {
        // Ignore errors during cleanup
      }
    }
  }
}
