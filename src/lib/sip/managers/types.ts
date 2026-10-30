/**
 * Shared context interface for SIP sub-managers
 *
 * Provides access to shared state and utility methods that all
 * sub-managers need without creating circular dependencies.
 *
 * @module lib/sip/managers/types
 */

import type { Session } from 'sip.js';
import type { CallLine, SipEvent, SipCredentials } from '../types';
import type { SipConfiguration } from '../config';

// Forward declarations to avoid circular imports
import type { SipConnectionManager } from './SipConnectionManager';
import type { SipCallManager } from './SipCallManager';

export interface SipManagerContext {
  // Shared state
  sessions: Map<number, Session>;
  lineStates: Map<number, CallLine>;
  remoteAudioElements: Map<number, HTMLAudioElement>;

  // Event system
  emit: (event: SipEvent) => void;

  // Configuration & credentials
  getConfig: () => SipConfiguration;
  getUserAgent: () => import('sip.js').UserAgent | null;
  getCredentials: () => SipCredentials | null;

  // Utility methods
  findAvailableLine: () => number | null;
  updateLineState: (lineId: number, updates: Partial<CallLine>) => void;
  getPeerConnection: (session: Session) => RTCPeerConnection | null;
  getSelectedOutputDeviceId: () => string | null;
  formatPhoneNumber: (number: string) => string;
  cleanupLine: (lineId: number) => void;
  hasActiveCalls: () => boolean;

  // Call enforcement
  isNumberBlocked: (number: string) => boolean;
  isDndEnabled: () => boolean;
  isOwnNumber: (number: string) => boolean;

  // Telnyx SIP-transport pilot: when true, every outbound INVITE carries
  // X-Telnyx-Route so FreeSWITCH bridges the call out the Telnyx trunk.
  isTelnyxRoute: () => boolean;

  // Cross-manager access (lazy-bound to avoid circular init)
  getConnectionManager: () => SipConnectionManager;
  getCallManager: () => SipCallManager;
}
