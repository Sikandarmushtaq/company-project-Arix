/**
 * SIP Types
 *
 * Type definitions for SIP functionality. These types are used
 * throughout the SIP module for type safety and documentation.
 *
 * @module lib/sip/types
 */

// Re-export error types
export * from './errors';

// Re-export config types
export type {
  IceServer,
  AudioConstraints,
  TransportConfig,
  RegistrationConfig,
  CallConfig,
  ReconnectionConfig,
  SipConfiguration,
} from './config';

/**
 * SIP connection states
 */
export type SipConnectionState =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'registered'
  | 'unregistered'
  | 'error';

/**
 * Call states
 */
export type CallState =
  | 'idle'
  | 'dialing'
  | 'ringing'
  | 'connecting'
  | 'established'
  | 'holding'
  | 'held'
  | 'transferring'
  | 'ended'
  | 'error';

/**
 * Call direction
 */
export type CallDirection = 'inbound' | 'outbound';

/**
 * SIP credentials for connection
 *
 * Server configuration comes from System Settings (SSOT).
 * User credentials (username/password) come from user profile.
 *
 * This interface matches the backend API response from /api/v1/auth/sip-credentials
 * to maintain SSOT (Single Source of Truth) across the stack.
 */
export interface SipCredentials {
  // User credentials
  /** SIP username/extension */
  username: string;
  /** SIP password */
  password: string;
  /** Display name for caller ID */
  displayName: string;

  // Primary server (from System Settings)
  /** SIP domain */
  domain: string;
  /** Full WebSocket URI (e.g., wss://domain:8089/ws) */
  webSocketUri: string;
  /** WebSocket server hostname (may differ from domain) */
  wssServer: string;
  /** WebSocket port (e.g., "8089") */
  webSocketPort: string;
  /** WebSocket path (e.g., "/ws") */
  webSocketPath: string;

  // Backup server for failover (from System Settings)
  /** Backup WebSocket URI for failover */
  backupWebSocketUri: string | null;
  /** Backup WebSocket server hostname */
  backupWssServer: string | null;
  /** Backup WebSocket port */
  backupWebSocketPort: string | null;
  /** Backup WebSocket path */
  backupWebSocketPath: string | null;
}

/**
 * Call line information
 */
export interface CallLine {
  /** Line ID (1-4) */
  id: number;
  /** Current call state */
  state: CallState;
  /** Call direction */
  direction: CallDirection;
  /** Remote party number */
  remoteNumber: string;
  /** Remote party name (if available) */
  remoteName?: string;
  /** Call start time (when ringing began) */
  startTime?: Date;
  /** Call answer time (when call was connected/established) */
  answerTime?: Date;
  /** Call duration in seconds (talk time, not ring time) */
  duration: number;
  /** Mute state */
  isMuted: boolean;
  /** Hold state */
  isHeld: boolean;
  /** Recording state */
  isRecording?: boolean;
  /** Conference state */
  isInConference?: boolean;
  /**
   * Extra PSTN party numbers mixed into THIS line to form a conference. Used by
   * instant-conference engines (LiveKit), where a conference is one room with
   * multiple parties rather than several merged lines — so the UI can list them.
   */
  conferenceParties?: string[];
  /** Backend call record ID (for call logging) */
  callRecordId?: number;
  /** Whether the call was ever answered/established (for proper status tracking) */
  wasAnswered?: boolean;
  /** SIP Call-ID for multi-device deduplication */
  sipCallId?: string;
}

/**
 * Incoming call notification
 */
export interface IncomingCall {
  /** Line ID for this call */
  lineId: number;
  /** Caller's phone number */
  callerNumber: string;
  /** Caller's name (if available) */
  callerName?: string;
  /** Time the call was received */
  timestamp: Date;
}

/**
 * Options for making a call
 */
export interface MakeCallOptions {
  /** Enable video */
  video?: boolean;
  /** Enable early media */
  earlyMedia?: boolean;
  /** Custom SIP headers */
  extraHeaders?: string[];
  /** Caller ID override */
  callerId?: string;
}

/**
 * DTMF tones
 */
export type DTMFTone = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '*' | '#';

/**
 * Call statistics
 */
export interface CallStats {
  /** Packets received */
  packetsReceived: number;
  /** Packets sent */
  packetsSent: number;
  /** Bytes received */
  bytesReceived: number;
  /** Bytes sent */
  bytesSent: number;
  /** Jitter in milliseconds */
  jitter: number;
  /** Round-trip time in milliseconds */
  roundTripTime: number;
  /** Packet loss percentage */
  packetLoss: number;
  /** Mean Opinion Score (1-5, higher is better) */
  mosScore: number;
  /** Timestamp of stats collection */
  timestamp: Date;
}

/**
 * Call quality level based on MOS score
 */
export type CallQuality = 'excellent' | 'good' | 'fair' | 'poor';

/**
 * Candidate type as reported by RTCIceCandidateStats.candidateType.
 */
export type IceCandidateType = 'host' | 'srflx' | 'relay' | 'prflx';

/**
 * Selected-pair protocol (actual transport over the wire).
 */
export type IceTransportProtocol = 'udp' | 'tcp' | 'tls';

/**
 * Terminal ICE state after the call ended.
 */
export type IceFinalState = 'connected' | 'failed' | 'disconnected' | 'closed' | 'new';

/**
 * Per-call diagnostic state. One per line while active; flushed to the
 * backend telemetry endpoint on call end.
 *
 * All fields are observed passively — no extra RPC is made to collect them.
 */
export interface CallTelemetryState {
  callUuid: string;
  direction: 'inbound' | 'outbound';
  inviteStartTime: number; // Date.now() when INVITE sent / answered
  inviteSentTime: number | null; // Date.now() when the outbound INVITE was actually dispatched
  firstCandidateTime: number | null;
  connectedTime: number | null;
  endTime: number | null;
  hadHostCandidate: boolean;
  hadSrflxCandidate: boolean;
  hadRelayCandidate: boolean;
  selectedLocalType: IceCandidateType | null;
  selectedRemoteType: IceCandidateType | null;
  selectedTurnUrl: string | null;
  selectedProtocol: IceTransportProtocol | null;
  retriedAsRelay: boolean;
  iceRestarted: boolean;
  finalIceState: IceFinalState;
  hangupReason: string | null;
  // RTP media flow — accumulated from callStatsUpdate events
  packetsReceived: number;
  packetsSent: number;
}

/**
 * Server info for failover tracking
 */
export interface ServerInfo {
  /** Server URI */
  uri: string;
  /** Whether this is the primary server */
  isPrimary: boolean;
  /** Current health status */
  isHealthy: boolean;
  /** Number of consecutive failures */
  failureCount: number;
  /** Last successful connection time */
  lastConnected?: Date;
}

/**
 * SIP events
 */
export type SipEvent =
  | { type: 'connectionStateChanged'; state: SipConnectionState }
  | { type: 'registrationStateChanged'; isRegistered: boolean; error?: string }
  | { type: 'incomingCall'; call: IncomingCall }
  | { type: 'callStateChanged'; lineId: number; state: CallState }
  | { type: 'callEnded'; lineId: number; reason?: string; outcome?: string }
  | { type: 'dtmfReceived'; lineId: number; tone: string }
  | { type: 'mediaError'; error: string }
  // Audio device events
  | { type: 'audioDevicesChanged'; devices: MediaDeviceInfo[] }
  | { type: 'audioInputChanged'; deviceId: string }
  | { type: 'audioOutputChanged'; deviceId: string }
  // Network events
  | { type: 'networkStatusChanged'; isOnline: boolean }
  // Call quality events
  | { type: 'callStatsUpdate'; lineId: number; stats: CallStats }
  | { type: 'noMediaFlow'; lineId: number }
  // Server failover events
  | { type: 'serverFailover'; fromServer: string; toServer: string; reason: string }
  | { type: 'serverHealthChanged'; server: ServerInfo }
  // Recording events
  | { type: 'recordingStarted'; lineId: number }
  | { type: 'recordingStopped'; lineId: number; recording: Blob }
  // Conference events
  | { type: 'conferenceStarted'; lineIds: number[] }
  | { type: 'conferenceSplit'; lineId: number }
  // Call switching events
  | { type: 'callsSwitched'; newActiveLineId: number; previousActiveLineId: number }
  // Transfer events
  | { type: 'transferCompleted'; lineId: number; target: string }
  | { type: 'transferFailed'; lineId: number; reason: string }
  // Call telemetry lifecycle — consumed by SipTelemetryManager
  | {
      type: 'telemetryStarted';
      lineId: number;
      callUuid: string;
      direction: 'inbound' | 'outbound';
      isRelayOnlyRetry: boolean;
    }
  | { type: 'telemetryEnded'; lineId: number; state: CallTelemetryState }
  // Outbound INVITE dispatched — marks the dial→INVITE (ICE-gathering) window.
  | { type: 'inviteSent'; lineId: number }
  // Connection-health state changes — consumed by useConnectionHealth
  | { type: 'turnServersChanged'; count: number; hasRelay443: boolean }
  | { type: 'iceFailureDetected'; lineId: number; reason: string }
  // Professional failure outcome for an outbound INVITE rejected before answer
  // (e.g. 404 → "Not in Service"). Emitted directly from onReject so the toast
  // does NOT depend on the callEnded / Terminated-stateChange race — SIP.js
  // fires the Terminated stateChange BEFORE the onReject delegate, so the
  // pendingOutcomes-on-callEnded path always loses the label. This event does not.
  | { type: 'callOutcome'; lineId: number; outcome: string };

/**
 * SIP event handler function
 */
export type SipEventHandler = (event: SipEvent) => void;

/**
 * SIP store state (for Zustand)
 */
export interface SipStoreState {
  /** Connection state */
  connectionState: SipConnectionState;
  /** Registration status */
  isRegistered: boolean;
  /** Registration error message */
  registrationError: string | null;
  /** Active call lines */
  lines: CallLine[];
  /** Currently active line ID */
  activeLineId: number | null;
  /** Current incoming call */
  incomingCall: IncomingCall | null;
  /** Mute state */
  isMuted: boolean;
  /** Available audio devices */
  audioDevices: MediaDeviceInfo[];
  /** Selected input device ID */
  selectedAudioInput: string | null;
  /** Selected output device ID */
  selectedAudioOutput: string | null;
  /** Network online status */
  isOnline: boolean;
  /** Call stats per line */
  callStats: Record<number, CallStats>;
  /** Current server info */
  currentServer: ServerInfo | null;
}

/**
 * SIP store actions (for Zustand)
 */
export interface SipStoreActions {
  connect: (credentials: SipCredentials) => Promise<void>;
  disconnect: () => Promise<void>;
  makeCall: (number: string, options?: MakeCallOptions) => Promise<number>;
  answerCall: (lineId: number) => Promise<void>;
  rejectCall: (lineId: number) => Promise<void>;
  endCall: (lineId: number) => Promise<void>;
  holdCall: (lineId: number) => Promise<void>;
  unholdCall: (lineId: number) => Promise<void>;
  muteCall: (lineId: number) => void;
  unmuteCall: (lineId: number) => void;
  sendDTMF: (lineId: number, tone: DTMFTone) => void;
  transferCall: (lineId: number, targetNumber: string) => Promise<void>;
  setActiveLineId: (lineId: number | null) => void;
  clearIncomingCall: () => void;
  // Audio device actions
  refreshAudioDevices: () => Promise<void>;
  setAudioInput: (deviceId: string) => Promise<void>;
  setAudioOutput: (deviceId: string) => Promise<void>;
}

/**
 * Complete SIP store type
 */
export type SipStore = SipStoreState & SipStoreActions;
