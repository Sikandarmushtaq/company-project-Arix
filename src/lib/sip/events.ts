/**
 * SIP Event Constants - SINGLE SOURCE OF TRUTH
 *
 * All SIP event type strings are defined here to prevent typos
 * and ensure consistency across the codebase.
 *
 * @module lib/sip/events
 */

/**
 * SIP Event Types
 * Use these constants instead of magic strings when emitting/handling events
 */
export const SIP_EVENTS = {
  // Connection events
  CONNECTION_STATE_CHANGED: 'connectionStateChanged',
  REGISTRATION_STATE_CHANGED: 'registrationStateChanged',

  // Call events
  INCOMING_CALL: 'incomingCall',
  CALL_STATE_CHANGED: 'callStateChanged',
  CALL_ENDED: 'callEnded',
  DTMF_RECEIVED: 'dtmfReceived',

  // Media events
  MEDIA_ERROR: 'mediaError',
  AUDIO_DEVICES_CHANGED: 'audioDevicesChanged',
  AUDIO_INPUT_CHANGED: 'audioInputChanged',
  AUDIO_OUTPUT_CHANGED: 'audioOutputChanged',

  // Network events
  NETWORK_STATUS_CHANGED: 'networkStatusChanged',

  // Quality events
  CALL_STATS_UPDATE: 'callStatsUpdate',

  // Failover events
  SERVER_FAILOVER: 'serverFailover',
  SERVER_HEALTH_CHANGED: 'serverHealthChanged',

  // Recording events
  RECORDING_STARTED: 'recordingStarted',
  RECORDING_STOPPED: 'recordingStopped',

  // Conference events
  CONFERENCE_STARTED: 'conferenceStarted',
  CONFERENCE_SPLIT: 'conferenceSplit',
} as const;

export type SipEventType = (typeof SIP_EVENTS)[keyof typeof SIP_EVENTS];
