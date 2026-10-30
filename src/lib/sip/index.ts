/**
 * SIP Module - WebRTC-based VoIP calling
 *
 * This module provides a complete WebRTC SIP phone implementation
 * with support for multi-line calling, hold, transfer, and DTMF.
 *
 * @module lib/sip
 *
 * NOTE: for call CONTROL use the engine router (`callEngine` from
 * `@/lib/call/call-engine`), which selects SIP.js or LiveKit — not the SIP engine
 * directly. This module exports SIP types/config/errors and the `SipManager` class.
 *
 * @example
 * ```typescript
 * import { callEngine } from '@/lib/call/call-engine';
 * import type { SipCredentials, CallState } from '@/lib/sip';
 *
 * await callEngine.connect(credentials);
 * const lineId = await callEngine.makeCall('+1234567890');
 * ```
 */

// Re-export error classes and codes
export {
  SipErrorCode,
  SipError,
  ConnectionError,
  RegistrationError,
  CallError,
  MediaError,
} from './errors';

// Re-export configuration
export {
  SipStatusCode,
  DEFAULT_ICE_SERVERS,
  DEFAULT_AUDIO_CONSTRAINTS,
  DEFAULT_SIP_CONFIG,
  getMediaConstraints,
  getPeerConnectionConfig,
  mergeConfig,
} from './config';

export type {
  SipStatusCodeType,
  IceServer,
  AudioConstraints,
  TransportConfig,
  RegistrationConfig,
  DtmfConfig,
  CallConfig,
  ReconnectionConfig,
  SipConfiguration,
} from './config';

// Re-export logger
export { sipLogger, createSipLogger } from './logger';
export type { LogLevel, LoggerConfig } from './logger';

// Re-export types
export type {
  SipConnectionState,
  CallState,
  CallDirection,
  SipCredentials,
  CallLine,
  IncomingCall,
  MakeCallOptions,
  DTMFTone,
  CallStats,
  SipEvent,
  SipEventHandler,
  SipStoreState,
  SipStoreActions,
  SipStore,
} from './types';

// Re-export the SIP manager CLASS only. The concrete `sipManager` INSTANCE is
// intentionally NOT re-exported here: all call control must go through the engine
// router at `@/lib/call/call-engine` (`callEngine`), so consumers never bind to a
// specific engine and bypass LiveKit/SIP selection. Import the class only if you
// genuinely need the type.
export { SipManager } from './sip-manager';

// Re-export call audio service
export { callAudioService, AVAILABLE_RINGTONES } from './call-audio-service';
export type { CallAudioType, AudioSettings, RingtoneOption } from './call-audio-service';
