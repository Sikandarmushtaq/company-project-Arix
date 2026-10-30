/**
 * SIP Managers - Modular SIP Functionality
 *
 * Each manager handles a specific aspect of SIP functionality.
 * The main SipManager facade orchestrates these sub-managers.
 *
 * @module lib/sip/managers
 */

export type { SipManagerContext } from './types';

export { SipConnectionManager } from './SipConnectionManager';
export { SipCallManager } from './SipCallManager';
export { SipMediaManager } from './SipMediaManager';
export { SipRecordingManager } from './SipRecordingManager';
export { SipQualityManager } from './SipQualityManager';
export { SipConferenceManager } from './SipConferenceManager';
export { SipTransferManager } from './SipTransferManager';
export { SipFailoverManager } from './SipFailoverManager';
