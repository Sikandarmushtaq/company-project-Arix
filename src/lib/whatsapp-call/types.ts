/**
 * WhatsApp Calling — Frontend Types (SSOT)
 *
 * Mirrors server-side types for the WhatsApp calling feature.
 * These types are used by WaCallManager, hooks, and UI components.
 *
 * @module lib/whatsapp-call/types
 */

export type WaCallDirection = 'inbound' | 'outbound';

export type WaCallStatus =
  | 'idle'
  | 'incoming' // Ringing on agent's UI (inbound)
  | 'connecting' // Agent answered, WebRTC handshake in progress
  | 'active' // Audio flowing
  | 'ending' // Hangup in progress
  | 'ended';

/**
 * WhatsApp call state — managed by WaCallManager.
 */
export interface WaCallState {
  status: WaCallStatus;
  callId: string | null;
  direction: WaCallDirection | null;
  customerNumber: string | null;
  customerName: string | null;
  phoneNumberId: string | null;
  startTime: Date | null;
  answerTime: Date | null;
  duration: number; // seconds, updated live
  isMuted: boolean;
  isRecording: boolean;
}

/**
 * Incoming call payload from WebSocket (wa:call_incoming).
 */
export interface WaCallIncomingEvent {
  callId: string;
  customerNumber: string;
  customerName: string | null;
  phoneNumberId: string;
  sdpOffer?: string;
  timestamp: number;
}

/**
 * Call ended payload from WebSocket (wa:call_ended).
 */
export interface WaCallEndedEvent {
  callId: string;
  reason: string;
  durationSecs: number;
}

/**
 * SDP answer from Meta for outbound calls (wa:call_sdp_answer).
 */
export interface WaCallSdpAnswerEvent {
  callId: string;
  sdpAnswer: string;
}

/**
 * Call permission granted/rejected (wa:call_permission_granted/rejected).
 */
export interface WaCallPermissionEvent {
  customerNumber: string;
  status: 'accepted' | 'rejected';
  expiresAt: string | null;
}

/**
 * Call permission record from API.
 *
 * The quota fields (`canCall`, `callsInLast24h`, `callsRemaining`,
 * `windowResetsAt`) are computed by the backend. The frontend MUST gate UI
 * on `canCall` — never re-derive Meta's "5 per 24h" rule client-side. The
 * rule itself only applies to time-bounded permissions (`expiresAt !== null`);
 * permanent permissions (Meta code 138017, `expiresAt === null`) are always
 * `canCall: true` because Meta does not enforce the cap on those.
 */
export interface WaCallPermission {
  id: number;
  phoneNumberId: string;
  customerNumber: string;
  status: 'pending' | 'accepted' | 'rejected' | 'expired';
  requestedAt: string;
  acceptedAt: string | null;
  /** ISO timestamp; `null` for permanent permissions (Meta code 138017). */
  expiresAt: string | null;
  /**
   * @deprecated Historical lifetime counter — the backend no longer writes
   * to this column or gates on it. Use `canCall` instead.
   */
  callsUsed: number;
  /** Always reported. Informational for permanent permissions; gating for time-bounded. */
  callsInLast24h: number;
  /** `5 - callsInLast24h` clamped at 0. Informational for permanent permissions. */
  callsRemaining: number;
  /**
   * ISO timestamp when the oldest in-window call ages out, populated only when
   * `canCall === false`. `null` for permanent permissions and for under-cap
   * time-bounded permissions.
   */
  windowResetsAt: string | null;
  /** Single source of truth for "can the agent place a call right now". */
  canCall: boolean;
}

/**
 * Call record from API (history).
 */
export interface WaCallRecord {
  id: number;
  callId: string;
  phoneNumberId: string;
  organizationId: number | null;
  assignedUserId: number | null;
  direction: WaCallDirection;
  customerNumber: string;
  customerName: string | null;
  status: string;
  startedAt: string | null;
  answeredAt: string | null;
  endedAt: string | null;
  durationSecs: number;
  hangupReason: string | null;
  recordingUrl: string | null;
  read: boolean;
}

/**
 * Initial empty call state.
 */
export function emptyWaCallState(): WaCallState {
  return {
    status: 'idle',
    callId: null,
    direction: null,
    customerNumber: null,
    customerName: null,
    phoneNumberId: null,
    startTime: null,
    answerTime: null,
    duration: 0,
    isMuted: false,
    isRecording: false,
  };
}
