/**
 * SIP Configuration
 *
 * Centralized configuration for SIP operations with sensible defaults.
 * All timing values are in milliseconds unless otherwise noted.
 *
 * @module lib/sip/config
 */

// ============================================================================
// SIP Protocol Constants
// ============================================================================

/**
 * SIP Response Status Codes
 * @see https://en.wikipedia.org/wiki/List_of_SIP_response_codes
 */
export const SipStatusCode = {
  // 1xx Provisional
  TRYING: 100,
  RINGING: 180,
  CALL_BEING_FORWARDED: 181,
  QUEUED: 182,
  SESSION_PROGRESS: 183,

  // 2xx Success
  OK: 200,
  ACCEPTED: 202,

  // 3xx Redirection
  MULTIPLE_CHOICES: 300,
  MOVED_PERMANENTLY: 301,
  MOVED_TEMPORARILY: 302,

  // 4xx Client Error
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  METHOD_NOT_ALLOWED: 405,
  REQUEST_TIMEOUT: 408,
  BUSY_HERE: 486,
  REQUEST_TERMINATED: 487,

  // 5xx Server Error
  SERVER_INTERNAL_ERROR: 500,
  NOT_IMPLEMENTED: 501,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,

  // 6xx Global Failure
  BUSY_EVERYWHERE: 600,
  DECLINE: 603,
} as const;

export type SipStatusCodeType = (typeof SipStatusCode)[keyof typeof SipStatusCode];

/**
 * STUN/TURN server configuration
 */
export interface IceServer {
  urls: string | string[];
  username?: string;
  credential?: string;
}

/**
 * Audio constraints for WebRTC
 */
export interface AudioConstraints {
  echoCancellation: boolean;
  noiseSuppression: boolean;
  autoGainControl: boolean;
  sampleRate?: { ideal: number };
  channelCount?: { ideal: number };
}

/**
 * Transport configuration
 */
export interface TransportConfig {
  /** WebSocket connection timeout in seconds */
  connectionTimeout: number;
  /** Keep-alive interval in seconds */
  keepAliveInterval: number;
  /** Keep-alive debounce in seconds */
  keepAliveDebounce: number;
  /** Enable SIP tracing for debugging */
  traceSip: boolean;
}

/**
 * Registration configuration
 */
export interface RegistrationConfig {
  /** Registration expiry in seconds */
  expires: number;
  /** Refresh frequency as percentage of expires */
  refreshFrequency: number;
  /** Retry interval on failure in milliseconds */
  retryInterval: number;
  /** Maximum retry attempts */
  maxRetries: number;
}

/**
 * DTMF configuration
 */
export interface DtmfConfig {
  /** DTMF tone duration in milliseconds */
  duration: number;
  /** Gap between DTMF tones in milliseconds */
  interToneGap: number;
}

/**
 * Call configuration
 */
export interface CallConfig {
  /** Maximum concurrent call lines */
  maxLines: number;
  /** No-answer timeout in seconds */
  noAnswerTimeout: number;
  /** Enable early media */
  earlyMedia: boolean;
  /** DTMF tone settings */
  dtmf: DtmfConfig;
}

/**
 * Reconnection configuration
 */
export interface ReconnectionConfig {
  /** Maximum reconnection attempts */
  maxAttempts: number;
  /** Initial delay in milliseconds */
  initialDelay: number;
  /** Maximum delay in milliseconds */
  maxDelay: number;
  /** Delay multiplier for exponential backoff */
  multiplier: number;
  /**
   * Heartbeat interval (ms): how often to actively probe that the SIP link is
   * really alive (a round-trip re-REGISTER). Catches a *silently* dead socket —
   * one that never fired `onclose` (common on flaky ISPs) — which the transport
   * would otherwise never notice. 0 disables the heartbeat.
   */
  heartbeatIntervalMs: number;
  /** How long (ms) the heartbeat round-trip may take before that probe counts as a miss. */
  heartbeatDeadlineMs: number;
  /**
   * Consecutive missed/failed probes required before declaring the link dead. >1 so a
   * single slow round-trip on a high-latency link (e.g. Pakistan) doesn't false-trip a
   * reconnect on a connection that's actually fine.
   */
  heartbeatMissThreshold: number;
}

/**
 * Server failover configuration
 */
export interface FailoverConfig {
  /** Enable automatic failover */
  enabled: boolean;
  /** Backup server WebSocket URI (optional, set at runtime) */
  backupServer: string | null;
  /** Number of failures before switching to backup */
  failoverThreshold: number;
  /** Health check interval in milliseconds */
  healthCheckInterval: number;
  /** Time to wait before trying primary server again in milliseconds */
  primaryRetryDelay: number;
}

/**
 * Call stats collection configuration
 */
export interface StatsConfig {
  /** Enable stats collection */
  enabled: boolean;
  /** Stats polling interval in milliseconds */
  pollingInterval: number;
}

/**
 * Complete SIP configuration
 */
export interface SipConfiguration {
  transport: TransportConfig;
  registration: RegistrationConfig;
  call: CallConfig;
  reconnection: ReconnectionConfig;
  failover: FailoverConfig;
  stats: StatsConfig;
  iceServers: IceServer[];
  audioConstraints: AudioConstraints;
  userAgentString: string;
}

/**
 * Fallback STUN servers (used if TURN fetch fails)
 */
export const FALLBACK_STUN_SERVERS: IceServer[] = [
  { urls: 'stun:global.stun.twilio.com:3478' },
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

/**
 * Default ICE servers - replaced with Twilio TURN servers at runtime
 */
export const DEFAULT_ICE_SERVERS: IceServer[] = FALLBACK_STUN_SERVERS;

/**
 * Pre-warmed TURN credentials cache. Populated by `preWarmTurnCredentials()`
 * on page load so they're ready before the user dials. Saves 1-2 seconds of
 * call setup time for TURN-dependent users (Pakistan mobile ISPs).
 *
 * TTL: 1 hour. Twilio tokens last 24h but we refresh hourly to stay safe.
 * If cache expires, next `fetchTurnCredentials()` call fetches fresh.
 */
let cachedTurnCredentials: IceServer[] | null = null;
let cachedTurnTimestamp = 0;
const TURN_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

/**
 * Pre-warm TURN credentials on page load. Call this from SipProvider's
 * mount effect — fetches and caches TURN creds in the background so
 * `fetchTurnCredentials()` returns instantly when the user dials.
 */
export async function preWarmTurnCredentials(): Promise<void> {
  try {
    await fetchTurnCredentials(); // Populates cachedTurnCredentials internally
  } catch {
    // Swallow — fetched on-demand if pre-warm fails
  }
}

/**
 * Fetch TURN server credentials from backend (Twilio NTS)
 * Returns fresh credentials for STUN + TURN servers.
 * Returns cached credentials if pre-warmed.
 */
export async function fetchTurnCredentials(): Promise<IceServer[]> {
  const cacheValid =
    cachedTurnCredentials &&
    cachedTurnCredentials.length > 0 &&
    Date.now() - cachedTurnTimestamp < TURN_CACHE_TTL_MS;
  if (cacheValid) {
    return cachedTurnCredentials!;
  }
  // Read auth token from Zustand persisted store (same as ApiClient).
  const AUTH_STORAGE_KEY = 'auth-storage';
  let token: string | null = null;
  try {
    const stored = localStorage.getItem(AUTH_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      token = parsed.state?.token || null;
    }
  } catch {
    // Ignore parse errors
  }
  const headers: Record<string, string> = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // RETRY before degrading. A transient fetch failure on a lossy link must NOT
  // silently drop us to STUN-only — STUN-only = one-way audio on the symmetric-
  // NAT (Pakistan) links this fleet runs on, i.e. a direct "audio missing" cause.
  // Only after all attempts fail do we consider a fallback.
  const MAX_ATTEMPTS = 3;
  const ATTEMPT_TIMEOUT_MS = 4000;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      // Bound each attempt so a stalled request on a lossy link fails fast and
      // we retry, instead of hanging on the browser's multi-minute default.
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), ATTEMPT_TIMEOUT_MS);
      let response: Response;
      try {
        response = await fetch('/api/proxy/auth/turn-credentials', {
          headers,
          credentials: 'include',
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timer);
      }
      if (!response.ok) {
        throw new Error(`Failed to fetch TURN credentials: ${response.status}`);
      }
      const result = await response.json();
      const iceServers: IceServer[] = result.data;
      if (iceServers && iceServers.length > 0) {
        console.log(`[ICE] Loaded ${iceServers.length} TURN servers`);
        cachedTurnCredentials = iceServers;
        cachedTurnTimestamp = Date.now();
        return iceServers;
      }
      throw new Error('Empty TURN server list');
    } catch (error) {
      console.warn(`[ICE] TURN credential fetch attempt ${attempt}/${MAX_ATTEMPTS} failed:`, error);
      if (attempt < MAX_ATTEMPTS) {
        await new Promise((r) => setTimeout(r, attempt * 400)); // 400ms, then 800ms backoff
      }
    }
  }

  // Last resort. Prefer a previously-fetched TURN set (the server issues creds
  // valid ~24h, far longer than the 1h client cache, so a "stale" set usually
  // still authenticates and gives us a relay) over STUN-only, which cannot.
  if (cachedTurnCredentials && cachedTurnCredentials.length > 0) {
    console.warn('[ICE] TURN fetch failed after retries — reusing last known TURN set');
    return cachedTurnCredentials;
  }
  console.warn('[ICE] TURN fetch failed after retries — STUN-only fallback (relay unavailable)');
  return FALLBACK_STUN_SERVERS;
}

/**
 * Default audio constraints optimized for VoIP.
 *
 * `noiseSuppression` (browser mic-side NS) defaults OFF: arix reskin calls
 * egress via Telnyx, where carrier-side Krisp Viva Pro runs noise suppression
 * on BOTH directions. Stacking the browser's mic NS on top of Krisp
 * double-processes the outbound voice (watery/over-suppressed artifacts), so we
 * let the stronger carrier NS own it. Users can still re-enable it per-device in
 * Settings (e.g. for a non-Krisp path). `echoCancellation` and `autoGainControl`
 * stay ON — echo cancellation is essential on a softphone, and auto-gain is
 * level control, not noise removal, so it doesn't conflict with Krisp.
 */
export const DEFAULT_AUDIO_CONSTRAINTS: AudioConstraints = {
  echoCancellation: true,
  noiseSuppression: false,
  autoGainControl: true,
  sampleRate: { ideal: 48000 },
  channelCount: { ideal: 1 },
};

/**
 * Default SIP configuration
 */
export const DEFAULT_SIP_CONFIG: SipConfiguration = {
  transport: {
    connectionTimeout: 30,
    // CRLF heartbeat. Lowered from 30→10s on 2026-05-08 for PK ISP customers
    // (PTCL/Jazz DPI silently kill long-lived TCP after ~60-120s; the old 30s
    // interval meant up to 30s of "WS looks alive but isn't" before sip.js
    // detected the death. 10s caps undetected-zombie window at 10s.)
    // Industry standard for SIP-over-WSS — Linphone/Bria/JsSIP all run 10-15s.
    keepAliveInterval: 10,
    keepAliveDebounce: 3,
    traceSip: false,
  },
  registration: {
    expires: 600,
    refreshFrequency: 80,
    retryInterval: 5000,
    maxRetries: 5,
  },
  call: {
    maxLines: 4,
    noAnswerTimeout: 60,
    earlyMedia: true,
    dtmf: {
      duration: 100,
      interToneGap: 70,
    },
  },
  reconnection: {
    maxAttempts: 10,
    // Lowered from 1000→250 ms on 2026-05-08 for PK ISP customers. Most PK
    // network drops are transient (3-10s); landing the first reconnect at
    // 250ms catches them before the user notices. Subsequent attempts still
    // exponentially back off (250→500→1000→2000…→30000) so a truly-down
    // server isn't hammered. Matches the WebSocket reconnect pattern used by
    // Slack, Discord, WhatsApp Web.
    initialDelay: 250,
    maxDelay: 30000,
    multiplier: 2,
    // Active liveness heartbeat: probe every 30s, declare dead if the round-trip
    // doesn't complete in 10s. Detects a zombie socket within ~30-40s (vs never)
    // and triggers the auto-reconnect path — so the dialer self-heals without a
    // page refresh. Tunable; raise the interval if REGISTER load is a concern.
    heartbeatIntervalMs: 30000,
    heartbeatDeadlineMs: 12000,
    heartbeatMissThreshold: 2,
  },
  failover: {
    enabled: true,
    backupServer: null,
    // Failover on the very FIRST primary failure. Lowered from 3 → 1 on
    // 2026-05-23 because affected users (Chrome profile-side filtering
    // refusing wss://sip.bitnexdial.com:7443) were waiting ~90s before
    // the third strike triggered the switch to manual.bitnexdial.com.
    // The trade-off: a single transient WSS blip will also fail over,
    // but primaryRetryDelay below schedules a primary-health probe
    // every 5 min, so healthy users automatically return to the direct
    // path. For users whose primary is permanently broken (the actual
    // case we're optimising for), every reconnect attempt eats 5 minutes
    // — the immediate failover gives them a working session in <2s.
    failoverThreshold: 1,
    healthCheckInterval: 60000, // 1 minute
    primaryRetryDelay: 300000, // 5 minutes
  },
  stats: {
    enabled: true,
    pollingInterval: 2000, // 2 seconds
  },
  iceServers: DEFAULT_ICE_SERVERS,
  audioConstraints: DEFAULT_AUDIO_CONSTRAINTS,
  userAgentString: 'BitNex-WebPhone/1.0',
};

/**
 * Get media constraints for WebRTC
 */
export function getMediaConstraints(
  audioConstraints: AudioConstraints = DEFAULT_AUDIO_CONSTRAINTS,
  video: boolean = false
): MediaStreamConstraints {
  return {
    audio: {
      echoCancellation: audioConstraints.echoCancellation,
      noiseSuppression: audioConstraints.noiseSuppression,
      autoGainControl: audioConstraints.autoGainControl,
      ...(audioConstraints.sampleRate && { sampleRate: audioConstraints.sampleRate }),
      ...(audioConstraints.channelCount && { channelCount: audioConstraints.channelCount }),
    },
    video,
  };
}

/**
 * Get WebRTC peer connection configuration.
 *
 * @param iceServers  STUN/TURN list, pre-ordered by the backend (TLS/443 first).
 * @param policy      ICE transport policy:
 *                      - 'all' (default): try host + STUN + TURN candidates
 *                      - 'relay': force TURN relay only. Used for the auto-retry
 *                        path when the initial call fails with an ICE-level error —
 *                        guarantees connectivity at the cost of ~100-200ms of
 *                        extra relay latency. Never the default because it would
 *                        route every call through Twilio TURN unnecessarily.
 */
/**
 * Trim only the REDUNDANT (TCP) TURN endpoints — keep every UDP one.
 *
 * The browser allocates a relay on every TURN url. With Cloudflare added we had 6
 * (CF UDP-53/UDP-3478/TLS-443/TCP-3478 + coturn TLS-5349/TCP-3478). The two TCP
 * `:3478` urls are redundant with the TLS ones (443/5349) and just add TCP
 * allocations, so we drop them.
 *
 * We deliberately KEEP BOTH UDP ports (CF UDP-53 AND CF UDP-3478). Under packet
 * loss the UDP TURN allocation is what we want but its handshake packets get
 * dropped; giving the browser TWO independent UDP ports = two parallel chances to
 * land a UDP relay before the prefer-UDP SDH (fireOnRelaySdhFactory) has to fall
 * back to TCP. (PK DPI also throttles :3478 more than :53, so the two ports fail
 * independently.) TCP endpoints (TLS 443/5349) stay purely as last resort.
 *   KEEP  CF UDP-53 · CF UDP-3478 · CF TLS-443 · coturn TLS-5349   (2 UDP + 2 TLS)
 *   DROP  CF TCP-3478 · coturn TCP-3478   (redundant with the TLS endpoints)
 * STUN is left as-is.
 */
function trimIceServers(servers: IceServer[]): IceServer[] {
  const keep = (u: string): boolean => {
    const s = String(u).toLowerCase();
    if (s.startsWith('stun:')) return true; // not used under relay policy; harmless
    if (s.startsWith('turn:') || s.startsWith('turns:')) {
      // Drop ONLY the redundant TCP :3478 endpoints; keep every UDP url
      // (including UDP :3478) so we have multiple parallel UDP attempts.
      const isUdp = s.includes('transport=udp');
      if (s.includes(':3478') && !isUdp) return false;
      return true;
    }
    return true;
  };
  const out: IceServer[] = [];
  for (const srv of servers) {
    const urls = Array.isArray(srv.urls) ? srv.urls : [srv.urls];
    const kept = urls.filter(keep);
    if (kept.length) out.push({ ...srv, urls: kept.length === 1 ? kept[0] : kept });
  }
  return out.length ? out : servers; // never strip everything
}

export function getPeerConnectionConfig(
  iceServers: IceServer[] = DEFAULT_ICE_SERVERS,
  policy: RTCIceTransportPolicy = 'all'
): RTCConfiguration {
  return {
    iceServers: trimIceServers(iceServers),
    iceTransportPolicy: policy,
    bundlePolicy: 'balanced',
    rtcpMuxPolicy: 'require',
  };
}

/**
 * Merge partial configuration with defaults
 */
export function mergeConfig(partial: Partial<SipConfiguration>): SipConfiguration {
  return {
    transport: { ...DEFAULT_SIP_CONFIG.transport, ...partial.transport },
    registration: { ...DEFAULT_SIP_CONFIG.registration, ...partial.registration },
    call: {
      ...DEFAULT_SIP_CONFIG.call,
      ...partial.call,
      dtmf: { ...DEFAULT_SIP_CONFIG.call.dtmf, ...partial.call?.dtmf },
    },
    reconnection: { ...DEFAULT_SIP_CONFIG.reconnection, ...partial.reconnection },
    failover: { ...DEFAULT_SIP_CONFIG.failover, ...partial.failover },
    stats: { ...DEFAULT_SIP_CONFIG.stats, ...partial.stats },
    iceServers: partial.iceServers || DEFAULT_SIP_CONFIG.iceServers,
    audioConstraints: { ...DEFAULT_SIP_CONFIG.audioConstraints, ...partial.audioConstraints },
    userAgentString: partial.userAgentString || DEFAULT_SIP_CONFIG.userAgentString,
  };
}
