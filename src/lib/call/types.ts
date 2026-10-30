/**
 * Call-engine abstraction (Phase 3).
 *
 * `ICallEngine` is the contract shared by every call engine — the existing
 * SIP.js engine (`SipManager`) and the forthcoming LiveKit engine
 * (`LiveKitManager`). It is intentionally the EXACT public surface `SipManager`
 * already exposes, so that:
 *   - the Zustand call store and ALL call UI stay engine-agnostic — they talk to
 *     `callEngine` (see ./call-engine), never a concrete engine; and
 *   - a LiveKit engine can be dropped in behind the same interface with the
 *     store/UI unchanged, while SIP.js remains the fallback.
 *
 * Defining this interface changes NO runtime behavior — it only names the seam.
 * `SipManager` satisfies it structurally (enforced by the typed assignment in
 * ./call-engine); a `LiveKitManager` must satisfy it too.
 *
 * @module lib/call/types
 */

import type {
  SipConnectionState,
  CallLine,
  SipCredentials,
  MakeCallOptions,
  DTMFTone,
  SipEventHandler,
  CallStats,
  ServerInfo,
} from '../sip/types';
import type { AudioConstraints } from '../sip/config';

/**
 * Which in-call controls the ACTIVE engine supports right now. Universal controls
 * (dial, hangup, mute, DTMF) are always available and not listed here. The UI gates
 * on these so an unsupported control is never offered to the agent — e.g. LiveKit
 * has no hold/transfer until Phase 3e, so those buttons disable when it's active.
 * Flags can flip to true as an engine gains features.
 */
export interface CallEngineCapabilities {
  hold: boolean;
  transfer: boolean;
  attendedTransfer: boolean;
  conference: boolean;
  /**
   * How "add call" forms a conference. true = adding a party creates the
   * conference instantly (LiveKit: dial into the same room, SFU mixes — no
   * separate line, no merge step). false = the SIP model (hold + second line,
   * then explicit merge). The UI's add-call flow branches on this.
   */
  instantConference: boolean;
  recording: boolean;
}

/**
 * The unified call-engine contract. Every member here already exists on
 * `SipManager` with these exact signatures — keep them in sync. Any new engine
 * (LiveKit) implements this same shape so consumers never branch on engine type.
 */
export interface ICallEngine {
  /** In-call controls this engine currently supports (for UI gating). */
  readonly capabilities: CallEngineCapabilities;

  // --- Getters -------------------------------------------------------------
  readonly connectionState: SipConnectionState;
  readonly isRegistered: boolean;
  readonly activeLines: CallLine[];
  readonly audioDevices: MediaDeviceInfo[];
  readonly selectedInputDeviceId: string | null;
  readonly selectedOutputDeviceId: string | null;
  readonly isOnline: boolean;
  readonly currentServer: ServerInfo | null;

  // --- Events (single callback channel; consumers switch on event.type) -----
  on(handler: SipEventHandler): () => void;

  // --- Connection ----------------------------------------------------------
  hasActiveCalls(): boolean;
  connect(credentials: SipCredentials, preserveActiveCalls?: boolean): Promise<void>;
  markIntentDisconnected(): void;
  disconnect(): Promise<void>;
  destroy(): Promise<void>;

  // --- Audio devices -------------------------------------------------------
  enumerateAudioDevices(): Promise<MediaDeviceInfo[]>;
  setAudioInputDevice(deviceId: string): Promise<void>;
  setAudioOutputDevice(deviceId: string): Promise<void>;
  /** Call-audio processing constraints. Optional — SIP.js implements it; the
   *  LiveKit engine omits it and the router falls back to defaults. */
  getAudioConstraints?(): AudioConstraints;
  setAudioConstraints?(partial: Partial<AudioConstraints>): Promise<void>;

  // --- Call quality --------------------------------------------------------
  getCallStats(lineId: number): Promise<CallStats | null>;

  /** Remote audio MediaStream for the given line (for waveform/visualizers).
   *  Engine-agnostic so the call UI never branches on engine type. */
  getRemoteAudioStream(lineId: number): MediaStream | null;

  // --- Server failover -----------------------------------------------------
  setBackupServer(uri: string): void;

  // --- DND / blocked / own-number checkers ---------------------------------
  setDndChecker(checker: (() => boolean) | null): void;
  setBlockedChecker(checker: ((number: string) => boolean) | null): void;
  setOwnNumberChecker(checker: ((number: string) => boolean) | null): void;
  /** Telnyx SIP-transport pilot: when on, the SIP.js engine tags outbound INVITEs
   *  (X-Telnyx-Route) so FreeSWITCH routes the call out the Telnyx trunk. Only the
   *  SIP.js engine implements this; other engines ignore it. */
  setTelnyxRoute?(on: boolean): void;
  isDndEnabled(): boolean;
  isNumberBlocked(number: string): boolean;
  isOwnNumber(number: string): boolean;

  // --- Call control (line-id based, lines 1..maxLines) ---------------------
  makeCall(number: string, options?: MakeCallOptions): Promise<number>;
  answerCall(lineId: number): Promise<void>;
  rejectCall(lineId: number): Promise<void>;
  endCall(lineId: number): Promise<void>;
  holdCall(lineId: number): Promise<void>;
  unholdCall(lineId: number): Promise<void>;
  switchCalls(): Promise<number | null>;
  muteCall(lineId: number): void;
  unmuteCall(lineId: number): void;
  sendDTMF(lineId: number, tone: DTMFTone): void;
  transferCall(lineId: number, targetNumber: string): Promise<void>;
  getLineState(lineId: number): CallLine | undefined;
  getAllLines(): CallLine[];

  // --- Recording -----------------------------------------------------------
  startRecording(lineId: number): Promise<void>;
  stopRecording(lineId: number): Promise<Blob | null>;
  isRecording(lineId: number): boolean;

  // --- Attended transfer ---------------------------------------------------
  startAttendedTransfer(lineId: number, targetNumber: string): Promise<number>;
  completeAttendedTransfer(consultLineId: number): Promise<void>;
  cancelAttendedTransfer(consultLineId: number): Promise<void>;
  getAttendedTransferState(
    lineId: number
  ): { originalLineId: number; consultLineId: number } | null;

  // --- Conference ----------------------------------------------------------
  mergeLines(lineId1: number, lineId2: number): Promise<void>;
  splitConference(lineIdToKeep: number): Promise<void>;
  isInConference(lineId: number): boolean;
  getConferencedLines(): number[];
  /**
   * Add another party to the active call. On an instant-conference engine
   * (`capabilities.instantConference`) this dials the party straight into the
   * current room to form the conference; engines without it should throw.
   */
  addConferenceParty(number: string): Promise<void>;
}

/**
 * Shared call-layer types, re-exported so call-layer modules import from
 * `@/lib/call/types` rather than reaching into the SIP engine internals.
 * (These remain physically defined in ../sip/types for now; nothing moves.)
 */
export type {
  SipConnectionState,
  CallState,
  CallLine,
  IncomingCall,
  SipCredentials,
  MakeCallOptions,
  DTMFTone,
  SipEvent,
  SipEventHandler,
  CallStats,
  ServerInfo,
} from '../sip/types';
