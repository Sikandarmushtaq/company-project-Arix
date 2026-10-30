/**
 * Call Telemetry Service
 *
 * Fire-and-forget ingestion POST for WebRTC ICE diagnostic records collected
 * by SipTelemetryManager. The backend is hardened to always accept 202 so the
 * client does not depend on this response.
 *
 * @module lib/api/services/callTelemetry
 */

import { apiClient } from '../client';

export type IceCandidateType = 'host' | 'srflx' | 'relay' | 'prflx';
export type IceTransportProtocol = 'udp' | 'tcp' | 'tls';
export type IceFinalState = 'connected' | 'failed' | 'disconnected' | 'closed' | 'new';

/**
 * Payload matching the backend Zod schema (`ingestTelemetrySchema`).
 * Any field mismatch causes a 400 response — keep in lockstep with backend.
 */
export interface IceTelemetryPayload {
  callUuid: string;
  direction: 'inbound' | 'outbound';
  occurredAt: string; // ISO-8601
  hadHostCandidate: boolean;
  hadSrflxCandidate: boolean;
  hadRelayCandidate: boolean;
  timeToFirstCandidateMs: number | null;
  selectedLocalType: IceCandidateType | null;
  selectedRemoteType: IceCandidateType | null;
  selectedTurnUrl: string | null;
  selectedProtocol: IceTransportProtocol | null;
  finalIceState: IceFinalState;
  timeToConnectedMs: number | null;
  /** ms from telemetry start (~dial) to INVITE sent — ICE-gathering window (Phase 0). */
  timeToInviteSentMs: number | null;
  retriedAsRelay: boolean;
  iceRestarted: boolean;
  hangupReason: string | null;
  packetsReceived: number;
  packetsSent: number;
}

/**
 * POST the telemetry record. Resolves silently on any failure — callers must
 * NOT await or observe the result (fire-and-forget).
 */
export async function submitIceTelemetry(payload: IceTelemetryPayload): Promise<void> {
  try {
    await apiClient.post('/calls/ice-telemetry', payload);
  } catch {
    // Intentional: telemetry is best-effort. Network errors, session expiration,
    // rate limits — all swallowed. The call has already ended from the user's POV.
  }
}
