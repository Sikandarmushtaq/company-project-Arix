/**
 * SIP Telemetry Manager
 *
 * Collects per-call WebRTC ICE diagnostic data and ships it to the backend on
 * call end. Powers the `/admin/call-health` dashboard.
 *
 * Capture strategy (professional / event-driven):
 *
 *  1. PC DISCOVERY: A 200ms polling probe runs until the RTCPeerConnection
 *     becomes available (created by SIP.js during invite()). Max 10 seconds.
 *
 *  2. CANDIDATE GATHERING: `icecandidate` events record which candidate types
 *     (host/srflx/relay) were gathered. Parsed from the SDP candidate line
 *     which is universally available across browsers.
 *
 *  3. SELECTED PAIR CAPTURE: When `iceconnectionstatechange` fires with
 *     `connected` or `completed`, we IMMEDIATELY call `pc.getStats()` to
 *     extract the selected candidate pair (TURN URL, protocol, types).
 *     This is the KEY design choice — at this moment the PC is fully alive
 *     and stats are guaranteed available. Capturing at call-end is too late
 *     because cleanupLine() tears down the PC before async getStats resolves.
 *
 *  4. FLUSH: On `callEnded`, we POST the pre-captured data synchronously.
 *     No async getStats() needed — everything was already collected at step 3.
 *
 * @module lib/sip/managers/SipTelemetryManager
 */

import type { SipManagerContext } from './types';
import type {
  CallTelemetryState,
  IceCandidateType,
  IceFinalState,
  IceTransportProtocol,
  SipEvent,
} from '../types';
import { sipLogger as logger } from '../logger';
import { submitIceTelemetry } from '@/lib/api/services/callTelemetry.service';

function emptyState(
  callUuid: string,
  direction: 'inbound' | 'outbound',
  isRelayOnlyRetry: boolean
): CallTelemetryState {
  return {
    callUuid,
    direction,
    inviteStartTime: Date.now(),
    inviteSentTime: null,
    firstCandidateTime: null,
    connectedTime: null,
    endTime: null,
    hadHostCandidate: false,
    hadSrflxCandidate: false,
    hadRelayCandidate: false,
    selectedLocalType: null,
    selectedRemoteType: null,
    selectedTurnUrl: null,
    selectedProtocol: null,
    retriedAsRelay: isRelayOnlyRetry,
    iceRestarted: false,
    finalIceState: 'new',
    hangupReason: null,
    packetsReceived: 0,
    packetsSent: 0,
  };
}

function parseCandidateType(value: unknown): IceCandidateType | null {
  if (value === 'host' || value === 'srflx' || value === 'relay' || value === 'prflx') {
    return value;
  }
  return null;
}

/**
 * Parse candidate type from the raw SDP candidate string.
 * Format: "candidate:... typ host ..." or "candidate:... typ relay ..."
 * This is more reliable than accessing `.type` on RTCIceCandidate which
 * is not universally available across all browser versions.
 */
function parseCandidateTypeFromSdp(candidateStr: string): IceCandidateType | null {
  const match = /\styp\s+(host|srflx|relay|prflx)/.exec(candidateStr);
  return match ? (match[1] as IceCandidateType) : null;
}

function parseProtocol(protocol: unknown, relayProtocol: unknown): IceTransportProtocol | null {
  if (typeof relayProtocol === 'string' && relayProtocol.toLowerCase().includes('tls')) {
    return 'tls';
  }
  if (protocol === 'udp' || protocol === 'tcp') return protocol;
  if (protocol === 'tls') return 'tls';
  return null;
}

const PC_PROBE_TIMEOUT_MS = 10_000;
const PC_PROBE_INTERVAL_MS = 200;

export class SipTelemetryManager {
  private ctx: SipManagerContext;
  private states: Map<number, CallTelemetryState> = new Map();
  private detachers: Map<number, () => void> = new Map();
  private pcProbeTimers: Map<number, ReturnType<typeof setInterval>> = new Map();
  // Track PCs so we can call getStats on ICE connected without re-fetching session
  private peerConnections: Map<number, RTCPeerConnection> = new Map();

  constructor(ctx: SipManagerContext) {
    this.ctx = ctx;
  }

  handleEvent(event: SipEvent): void {
    switch (event.type) {
      case 'telemetryStarted':
        this.onStart(event.lineId, event.callUuid, event.direction, event.isRelayOnlyRetry);
        break;
      case 'callStateChanged':
        this.tryAttachListeners(event.lineId);
        break;
      case 'inviteSent': {
        // Mark when the outbound INVITE was dispatched → the dial→INVITE window
        // (ICE gathering) closes here. Record once (first dispatch wins).
        const s = this.states.get(event.lineId);
        if (s && s.inviteSentTime === null) s.inviteSentTime = Date.now();
        break;
      }
      case 'callStatsUpdate': {
        // Accumulate RTP packet counts from the quality manager's 2s polling.
        // This is the authoritative source for "did audio actually flow".
        const s = this.states.get(event.lineId);
        if (s) {
          s.packetsReceived = event.stats.packetsReceived;
          s.packetsSent = event.stats.packetsSent;
        }
        break;
      }
      case 'noMediaFlow':
        this.markIceRestarted(event.lineId);
        break;
      case 'iceFailureDetected':
        this.markHangupReason(event.lineId, event.reason);
        break;
      case 'callEnded':
        this.onCallEnded(event.lineId, event.reason);
        break;
      default:
        break;
    }
  }

  // -------------------------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------------------------

  private onStart(
    lineId: number,
    callUuid: string,
    direction: 'inbound' | 'outbound',
    isRelayOnlyRetry: boolean
  ): void {
    if (this.states.has(lineId)) {
      this.flush(lineId);
    }
    this.states.set(lineId, emptyState(callUuid, direction, isRelayOnlyRetry));
    this.startPcProbe(lineId);
  }

  private onCallEnded(lineId: number, reason?: string): void {
    const state = this.states.get(lineId);
    if (!state) return;

    state.endTime = Date.now();
    if (reason && !state.hangupReason) state.hangupReason = reason;

    // All stats were already captured proactively at ICE-connected time.
    // Just flush the pre-captured data — no async getStats() needed.
    this.flush(lineId);
  }

  // -------------------------------------------------------------------------
  // PeerConnection discovery (polling probe)
  // -------------------------------------------------------------------------

  private startPcProbe(lineId: number): void {
    if (this.detachers.has(lineId) || this.pcProbeTimers.has(lineId)) return;

    const startTime = Date.now();
    const timer = setInterval(() => {
      if (Date.now() - startTime > PC_PROBE_TIMEOUT_MS) {
        this.stopPcProbe(lineId);
        return;
      }
      this.tryAttachListeners(lineId);
      if (this.detachers.has(lineId)) {
        this.stopPcProbe(lineId);
      }
    }, PC_PROBE_INTERVAL_MS);

    this.pcProbeTimers.set(lineId, timer);
  }

  private stopPcProbe(lineId: number): void {
    const timer = this.pcProbeTimers.get(lineId);
    if (timer) {
      clearInterval(timer);
      this.pcProbeTimers.delete(lineId);
    }
  }

  private tryAttachListeners(lineId: number): void {
    if (this.detachers.has(lineId)) return;
    if (!this.states.has(lineId)) return;

    const session = this.ctx.sessions.get(lineId);
    if (!session) return;

    const pc = this.ctx.getPeerConnection(session);
    if (!pc) return;

    // Store PC reference for proactive stats capture
    this.peerConnections.set(lineId, pc);
    this.attachPeerConnectionListeners(pc, lineId);

    // Snapshot current state (may have missed early transitions)
    this.snapshotCurrentIceState(pc, lineId);
  }

  private snapshotCurrentIceState(pc: RTCPeerConnection, lineId: number): void {
    const state = this.states.get(lineId);
    if (!state) return;

    const raw = pc.iceConnectionState as string;
    if (raw === 'connected' || raw === 'completed') {
      state.finalIceState = 'connected';
      if (state.connectedTime === null) {
        state.connectedTime = Date.now();
      }
      // Proactively capture stats since we're already connected
      this.captureSelectedPair(lineId);
    } else if (raw === 'failed') {
      state.finalIceState = 'failed';
    } else if (raw === 'disconnected') {
      state.finalIceState = 'disconnected';
    } else if (raw === 'closed') {
      state.finalIceState = 'closed';
    }
  }

  // -------------------------------------------------------------------------
  // PeerConnection event listeners
  // -------------------------------------------------------------------------

  private attachPeerConnectionListeners(pc: RTCPeerConnection, lineId: number): void {
    const onCandidate = (event: RTCPeerConnectionIceEvent) => {
      if (!event.candidate) return;
      const state = this.states.get(lineId);
      if (!state) return;

      if (state.firstCandidateTime === null) {
        state.firstCandidateTime = Date.now();
      }

      // Parse from SDP candidate string — universally available across browsers.
      // The `.type` property on RTCIceCandidate may be undefined in older engines.
      const sdpLine = event.candidate.candidate || '';
      const candidateType =
        parseCandidateTypeFromSdp(sdpLine) ||
        parseCandidateType((event.candidate as unknown as { type?: string }).type);

      if (candidateType === 'host') state.hadHostCandidate = true;
      if (candidateType === 'srflx') state.hadSrflxCandidate = true;
      if (candidateType === 'relay') state.hadRelayCandidate = true;
    };

    const onIceConnectionStateChange = () => {
      const state = this.states.get(lineId);
      if (!state) return;

      const raw = pc.iceConnectionState as string | undefined;
      if (!raw) return;

      if (raw === 'connected' || raw === 'completed') {
        state.finalIceState = 'connected';
        if (state.connectedTime === null) {
          state.connectedTime = Date.now();
        }
        // PROACTIVE CAPTURE: PC is fully alive right now — extract selected pair
        // immediately. This is the only reliable moment to call getStats().
        this.captureSelectedPair(lineId);
      } else if (raw === 'failed') {
        state.finalIceState = 'failed';
      } else if (raw === 'disconnected') {
        state.finalIceState = 'disconnected';
      } else if (raw === 'closed') {
        state.finalIceState = 'closed';
      }
    };

    pc.addEventListener('icecandidate', onCandidate);
    pc.addEventListener('iceconnectionstatechange', onIceConnectionStateChange);

    this.detachers.set(lineId, () => {
      pc.removeEventListener('icecandidate', onCandidate);
      pc.removeEventListener('iceconnectionstatechange', onIceConnectionStateChange);
    });
  }

  // -------------------------------------------------------------------------
  // Selected pair extraction (called proactively at ICE connected time)
  // -------------------------------------------------------------------------

  /**
   * Fire-and-forget: call getStats() on the live PC and populate the telemetry
   * state with the selected candidate pair info. Called at the moment ICE
   * reaches 'connected' — the PC is guaranteed alive.
   */
  private captureSelectedPair(lineId: number): void {
    const pc = this.peerConnections.get(lineId);
    const state = this.states.get(lineId);
    if (!pc || !state) return;

    // Already captured? Skip (prevents double-capture on connected→completed).
    if (state.selectedLocalType !== null) return;

    pc.getStats()
      .then((report) => {
        this.extractSelectedPair(report, state);
        logger.debug(
          `Telemetry: captured selected pair for line ${lineId}: ` +
            `local=${state.selectedLocalType} remote=${state.selectedRemoteType} ` +
            `turn=${state.selectedTurnUrl} proto=${state.selectedProtocol}`
        );
      })
      .catch((err) => {
        logger.debug(`Telemetry: getStats failed for line ${lineId}:`, err);
      });
  }

  private extractSelectedPair(report: RTCStatsReport, state: CallTelemetryState): void {
    // Build an index of all stats entries by ID for cross-referencing.
    const entriesById = new Map<string, Record<string, unknown>>();
    let selectedPairId: string | null = null;

    report.forEach((entry) => {
      const e = entry as Record<string, unknown>;
      if (typeof e.id === 'string') {
        entriesById.set(e.id, e);
      }

      // Method 1: transport entry has selectedCandidatePairId (Chrome 90+)
      if (e.type === 'transport' && typeof e.selectedCandidatePairId === 'string') {
        selectedPairId = e.selectedCandidatePairId as string;
      }
    });

    // Method 2: nominated + succeeded candidate-pair (Firefox, older Chrome)
    if (!selectedPairId) {
      report.forEach((entry) => {
        const p = entry as Record<string, unknown>;
        if (
          p.type === 'candidate-pair' &&
          (p.nominated === true || p.selected === true) &&
          p.state === 'succeeded' &&
          typeof p.id === 'string'
        ) {
          selectedPairId = p.id as string;
        }
      });
    }

    // Method 3: any candidate-pair in "succeeded" state (broadest fallback)
    if (!selectedPairId) {
      report.forEach((entry) => {
        const p = entry as Record<string, unknown>;
        if (p.type === 'candidate-pair' && p.state === 'succeeded' && typeof p.id === 'string') {
          selectedPairId = p.id as string;
        }
      });
    }

    if (!selectedPairId) return;

    const pair = entriesById.get(selectedPairId);
    if (!pair) return;

    const localId = pair.localCandidateId as string | undefined;
    const remoteId = pair.remoteCandidateId as string | undefined;

    if (localId) {
      const local = entriesById.get(localId);
      if (local) {
        state.selectedLocalType = parseCandidateType(local.candidateType);
        state.selectedTurnUrl = (local.url as string) ?? (local.relayAddress as string) ?? null;
        state.selectedProtocol = parseProtocol(local.protocol, local.relayProtocol);

        // Fallback: if no `url` field, construct from address + port
        if (!state.selectedTurnUrl && local.candidateType === 'relay') {
          const addr = local.address || local.ip;
          const port = local.port;
          if (addr && port) {
            const proto = state.selectedProtocol || 'udp';
            state.selectedTurnUrl = `turn:${addr}:${port}?transport=${proto}`;
          }
        }
      }
    }

    if (remoteId) {
      const remote = entriesById.get(remoteId);
      if (remote) {
        state.selectedRemoteType = parseCandidateType(remote.candidateType);
      }
    }
  }

  // -------------------------------------------------------------------------
  // Flush / submit
  // -------------------------------------------------------------------------

  /**
   * Bounded duration (ms) between two stamps, or null if the end stamp is absent
   * or the delta is outside the [0, 120_000] range the backend Zod schema
   * enforces. Prevents a single out-of-range timing (a wall-clock step back, or a
   * stalled gather exceeding the cap) from failing validation and dropping the
   * ENTIRE telemetry row — the metric degrades to null instead.
   */
  private boundedDurationMs(start: number, end: number | null): number | null {
    if (end === null) return null;
    const delta = end - start;
    return delta >= 0 && delta <= 120_000 ? delta : null;
  }

  private flush(lineId: number): void {
    const state = this.states.get(lineId);
    if (!state) return;

    this.stopPcProbe(lineId);

    const detach = this.detachers.get(lineId);
    if (detach) detach();
    this.detachers.delete(lineId);
    this.peerConnections.delete(lineId);
    this.states.delete(lineId);

    const payload = {
      callUuid: state.callUuid,
      direction: state.direction,
      occurredAt: new Date(state.inviteStartTime).toISOString(),
      hadHostCandidate: state.hadHostCandidate,
      hadSrflxCandidate: state.hadSrflxCandidate,
      hadRelayCandidate: state.hadRelayCandidate,
      timeToFirstCandidateMs:
        state.firstCandidateTime !== null ? state.firstCandidateTime - state.inviteStartTime : null,
      selectedLocalType: state.selectedLocalType,
      selectedRemoteType: state.selectedRemoteType,
      selectedTurnUrl: state.selectedTurnUrl,
      selectedProtocol: state.selectedProtocol,
      finalIceState: state.finalIceState,
      timeToConnectedMs:
        state.connectedTime !== null ? state.connectedTime - state.inviteStartTime : null,
      // dial→INVITE-sent window (mic acquisition + offer + ICE gathering + dispatch;
      // ICE gathering dominates it — the part pre-warming would remove). Bounded so
      // a rogue value can't drop the whole row.
      timeToInviteSentMs: this.boundedDurationMs(state.inviteStartTime, state.inviteSentTime),
      retriedAsRelay: state.retriedAsRelay,
      iceRestarted: state.iceRestarted,
      hangupReason: state.hangupReason,
      packetsReceived: state.packetsReceived,
      packetsSent: state.packetsSent,
    } as const;

    submitIceTelemetry(payload).catch((err) => {
      logger.debug('ICE telemetry submission failed (swallowed):', err);
    });
  }

  private markIceRestarted(lineId: number): void {
    const state = this.states.get(lineId);
    if (state) state.iceRestarted = true;
  }

  private markHangupReason(lineId: number, reason: string): void {
    const state = this.states.get(lineId);
    if (state && !state.hangupReason) state.hangupReason = reason;
  }

  destroy(): void {
    this.pcProbeTimers.forEach((timer) => clearInterval(timer));
    this.pcProbeTimers.clear();
    this.detachers.forEach((detach) => detach());
    this.detachers.clear();
    this.peerConnections.clear();
    this.states.clear();
  }
}
