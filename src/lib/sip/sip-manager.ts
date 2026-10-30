/**
 * SIP Manager - Thin Facade
 *
 * Orchestrates modular sub-managers and exposes a unified public API.
 * All actual logic lives in the sub-managers under ./managers/.
 *
 * @module lib/sip/sip-manager
 */

import type { Session } from 'sip.js';

import { mergeConfig, type SipConfiguration, type AudioConstraints } from './config';
import { toE164 } from '@/lib/utils/phone';

import type {
  SipCredentials,
  SipConnectionState,
  CallLine,
  MakeCallOptions,
  DTMFTone,
  SipEvent,
  SipEventHandler,
  CallStats,
  ServerInfo,
} from './types';

import { sipLogger as logger } from './logger';
import { callAudioService } from './call-audio-service';
import type { CallEngineCapabilities } from '../call/types';

// Sub-managers
import type { SipManagerContext } from './managers/types';
import { SipConnectionManager } from './managers/SipConnectionManager';
import { SipCallManager } from './managers/SipCallManager';
import { SipMediaManager } from './managers/SipMediaManager';
import { SipRecordingManager } from './managers/SipRecordingManager';
import { SipQualityManager } from './managers/SipQualityManager';
import { SipConferenceManager } from './managers/SipConferenceManager';
import { SipTransferManager } from './managers/SipTransferManager';
import { SipFailoverManager } from './managers/SipFailoverManager';
import { SipTelemetryManager } from './managers/SipTelemetryManager';

// ============================================================================
// SIP Manager Class
// ============================================================================

export class SipManager {
  // Shared state (owned by facade, accessed by sub-managers via context)
  private sessions: Map<number, Session> = new Map();
  private lineStates: Map<number, CallLine> = new Map();
  private remoteAudioElements: Map<number, HTMLAudioElement> = new Map();

  // Configuration
  private config: SipConfiguration;

  // Event handling
  private eventHandlers: Set<SipEventHandler> = new Set();

  // DND / blocked number / own number checkers (set by phone layout)
  private dndChecker: (() => boolean) | null = null;
  private blockedChecker: ((number: string) => boolean) | null = null;
  private ownNumberChecker: ((number: string) => boolean) | null = null;

  // Telnyx SIP-transport pilot: when true, outbound INVITEs carry X-Telnyx-Route
  // so FreeSWITCH routes the call out the Telnyx trunk (set by the engine router).
  private telnyxRoute = false;

  // Sub-managers
  private connectionManager: SipConnectionManager;
  private callManager: SipCallManager;
  private mediaManager: SipMediaManager;
  private recordingManager: SipRecordingManager;
  private qualityManager: SipQualityManager;
  private conferenceManager: SipConferenceManager;
  private transferManager: SipTransferManager;
  private failoverManager: SipFailoverManager;
  private telemetryManager: SipTelemetryManager;

  constructor(config: Partial<SipConfiguration> = {}) {
    this.config = mergeConfig(config);

    // Build shared context
    const ctx: SipManagerContext = {
      sessions: this.sessions,
      lineStates: this.lineStates,
      remoteAudioElements: this.remoteAudioElements,
      emit: (event) => this.emit(event),
      getConfig: () => this.config,
      getUserAgent: () => this.connectionManager.getUserAgent(),
      getCredentials: () => this.connectionManager.getCredentials(),
      findAvailableLine: () => this.findAvailableLine(),
      updateLineState: (lineId, updates) => this.updateLineState(lineId, updates),
      getPeerConnection: (session) => this.getPeerConnection(session),
      getSelectedOutputDeviceId: () => this.mediaManager.selectedOutputDeviceId,
      formatPhoneNumber: (number) => this.formatPhoneNumber(number),
      cleanupLine: (lineId) => this.callManager.cleanupLine(lineId),
      hasActiveCalls: () => this.sessions.size > 0,
      isNumberBlocked: (number: string) => this.isNumberBlocked(number),
      isDndEnabled: () => this.isDndEnabled(),
      isOwnNumber: (number: string) => this.isOwnNumber(number),
      isTelnyxRoute: () => this.telnyxRoute,
      getConnectionManager: () => this.connectionManager,
      getCallManager: () => this.callManager,
    };

    // Instantiate sub-managers (order matters for dependencies)
    this.qualityManager = new SipQualityManager(ctx);
    this.mediaManager = new SipMediaManager(ctx);
    this.recordingManager = new SipRecordingManager(ctx);
    this.failoverManager = new SipFailoverManager(ctx);
    this.conferenceManager = new SipConferenceManager(ctx);
    this.transferManager = new SipTransferManager(ctx);
    // TelemetryManager is passive: it subscribes to events via handleEvent(),
    // never originates actions. Zero risk of interference with call flow.
    this.telemetryManager = new SipTelemetryManager(ctx);

    // ConnectionManager needs MediaManager + FailoverManager
    this.connectionManager = new SipConnectionManager(ctx, this.mediaManager, this.failoverManager);

    // CallManager needs quality, recording, conference, transfer managers
    this.callManager = new SipCallManager(
      ctx,
      this.qualityManager,
      this.recordingManager,
      this.conferenceManager,
      this.transferManager
    );

    // Wire circular reference: ConnectionManager ↔ CallManager
    this.connectionManager.setCallManager(this.callManager);
  }

  // ---------------------------------------------------------------------------
  // Public Getters
  // ---------------------------------------------------------------------------

  get connectionState(): SipConnectionState {
    return this.connectionManager.connectionState;
  }

  get isRegistered(): boolean {
    return this.connectionManager.isRegistered;
  }

  get activeLines(): CallLine[] {
    return Array.from(this.lineStates.values());
  }

  get audioDevices(): MediaDeviceInfo[] {
    return this.mediaManager.audioDevices;
  }

  get selectedInputDeviceId(): string | null {
    return this.mediaManager.selectedInputDeviceId;
  }

  get selectedOutputDeviceId(): string | null {
    return this.mediaManager.selectedOutputDeviceId;
  }

  get isOnline(): boolean {
    return this.connectionManager.isOnline;
  }

  get currentServer(): ServerInfo | null {
    return this.failoverManager.currentServer;
  }

  /** SIP.js supports the full in-call control set. */
  get capabilities(): CallEngineCapabilities {
    return {
      hold: true,
      transfer: true,
      attendedTransfer: true,
      conference: true,
      instantConference: false, // SIP conferences via hold + second line + explicit merge
      recording: true,
    };
  }

  // ---------------------------------------------------------------------------
  // Event Handling
  // ---------------------------------------------------------------------------

  on(handler: SipEventHandler): () => void {
    this.eventHandlers.add(handler);
    return () => this.eventHandlers.delete(handler);
  }

  private emit(event: SipEvent): void {
    // Route noMediaFlow to callManager for automatic ICE restart
    if (event.type === 'noMediaFlow') {
      this.callManager.attemptIceRestart(event.lineId);
    }

    // Feed every event into the telemetry manager. Must run BEFORE external
    // handlers so the telemetry row reflects the terminal state.
    this.telemetryManager.handleEvent(event);

    this.eventHandlers.forEach((handler) => {
      try {
        handler(event);
      } catch (error) {
        logger.error(' Event handler error:', error);
      }
    });
  }

  // ---------------------------------------------------------------------------
  // Connection Management
  // ---------------------------------------------------------------------------

  hasActiveCalls(): boolean {
    return this.sessions.size > 0;
  }

  getRemoteAudioStream(lineId: number): MediaStream | null {
    const el = this.remoteAudioElements.get(lineId);
    return (el?.srcObject as MediaStream | null) ?? null;
  }

  async connect(credentials: SipCredentials, preserveActiveCalls = false): Promise<void> {
    // If already connected, do full cleanup first (unless preserving active calls)
    if (this.connectionManager.getUserAgent()) {
      if (!preserveActiveCalls || !this.hasActiveCalls()) {
        await this.disconnect();
      }
    }
    return this.connectionManager.connect(credentials, preserveActiveCalls);
  }

  /**
   * Synchronously signal that SIP must stay disconnected (suppresses every
   * auto-reconnect/re-register path). Call this FIRST on logout, before the
   * async disconnect(), so a re-REGISTER can't race the teardown.
   */
  markIntentDisconnected(): void {
    this.connectionManager.markIntentDisconnected();
  }

  async disconnect(): Promise<void> {
    // Suppress all SIP reconnect/re-register paths synchronously, before any
    // async teardown begins — prevents the "calls still ring after logout" bug
    // where the transport-close handler / failover re-registers the extension.
    this.connectionManager.markIntentDisconnected();

    // Stop ringtone/ringback FIRST — endAllCalls() may not reach stopRingtone()
    // if the session termination path is interrupted (e.g., cancel() fails on
    // an inbound Invitation, safety timeout hasn't fired yet, and lineStates
    // are about to be cleared below). This is the safety net.
    callAudioService.stopRingtone();
    callAudioService.stopRingback();

    // Stop stats polling first (prevents errors on stale sessions)
    this.qualityManager.clearAll();

    // Stop all recordings
    await this.recordingManager.stopAllRecordings();

    // End all active calls
    await this.callManager.endAllCalls();

    // Disconnect SIP transport (unregister + stop user agent)
    await this.connectionManager.disconnect();

    // Cleanup local media stream
    this.mediaManager.cleanupLocalStream();

    // Close recording AudioContext
    await this.recordingManager.destroy();

    // Close conference AudioContext + clear state
    await this.conferenceManager.destroy();

    // Clear transfer state
    this.transferManager.destroy();

    // Cleanup any remaining remote audio elements
    for (const [, audioElement] of this.remoteAudioElements) {
      audioElement.pause();
      audioElement.srcObject = null;
    }
    this.remoteAudioElements.clear();

    // Clear shared state maps
    this.sessions.clear();
    this.lineStates.clear();
  }

  async destroy(): Promise<void> {
    callAudioService.destroy();

    await this.disconnect();

    // Remove event listeners from sub-managers
    this.failoverManager.destroy();
    this.mediaManager.destroy();
    this.telemetryManager.destroy();
    await this.connectionManager.destroy();

    // Clear all event handlers
    this.eventHandlers.clear();

    logger.info('SIP Manager destroyed');
  }

  // ---------------------------------------------------------------------------
  // Audio Device Management
  // ---------------------------------------------------------------------------

  async enumerateAudioDevices(): Promise<MediaDeviceInfo[]> {
    return this.mediaManager.enumerateAudioDevices();
  }

  async setAudioInputDevice(deviceId: string): Promise<void> {
    return this.mediaManager.setAudioInputDevice(deviceId);
  }

  async setAudioOutputDevice(deviceId: string): Promise<void> {
    return this.mediaManager.setAudioOutputDevice(deviceId);
  }

  getAudioConstraints() {
    return this.mediaManager.getAudioConstraints();
  }

  async setAudioConstraints(partial: Partial<AudioConstraints>): Promise<void> {
    return this.mediaManager.setAudioConstraints(partial);
  }

  // ---------------------------------------------------------------------------
  // Call Quality
  // ---------------------------------------------------------------------------

  async getCallStats(lineId: number): Promise<CallStats | null> {
    return this.qualityManager.getCallStats(lineId);
  }

  // ---------------------------------------------------------------------------
  // Server Failover
  // ---------------------------------------------------------------------------

  setBackupServer(uri: string): void {
    this.failoverManager.setBackupServer(uri);
  }

  // ---------------------------------------------------------------------------
  // DND / Blocked Number Checkers
  // ---------------------------------------------------------------------------

  setDndChecker(checker: (() => boolean) | null): void {
    this.dndChecker = checker;
  }

  setBlockedChecker(checker: ((number: string) => boolean) | null): void {
    this.blockedChecker = checker;
  }

  setOwnNumberChecker(checker: ((number: string) => boolean) | null): void {
    this.ownNumberChecker = checker;
  }

  setTelnyxRoute(on: boolean): void {
    this.telnyxRoute = on;
  }

  isDndEnabled(): boolean {
    return this.dndChecker ? this.dndChecker() : false;
  }

  isNumberBlocked(number: string): boolean {
    return this.blockedChecker ? this.blockedChecker(number) : false;
  }

  isOwnNumber(number: string): boolean {
    return this.ownNumberChecker ? this.ownNumberChecker(number) : false;
  }

  // ---------------------------------------------------------------------------
  // Call Control
  // ---------------------------------------------------------------------------

  async makeCall(number: string, options: MakeCallOptions = {}): Promise<number> {
    return this.callManager.makeCall(number, options);
  }

  async answerCall(lineId: number): Promise<void> {
    return this.callManager.answerCall(lineId);
  }

  async rejectCall(lineId: number): Promise<void> {
    return this.callManager.rejectCall(lineId);
  }

  async endCall(lineId: number): Promise<void> {
    return this.callManager.endCall(lineId);
  }

  async holdCall(lineId: number): Promise<void> {
    return this.callManager.holdCall(lineId);
  }

  async unholdCall(lineId: number): Promise<void> {
    return this.callManager.unholdCall(lineId);
  }

  async switchCalls(): Promise<number | null> {
    return this.callManager.switchCalls();
  }

  muteCall(lineId: number): void {
    this.callManager.muteCall(lineId);
  }

  unmuteCall(lineId: number): void {
    this.callManager.unmuteCall(lineId);
  }

  sendDTMF(lineId: number, tone: DTMFTone): void {
    this.callManager.sendDTMF(lineId, tone);
  }

  async transferCall(lineId: number, targetNumber: string): Promise<void> {
    return this.callManager.transferCall(lineId, targetNumber);
  }

  getLineState(lineId: number): CallLine | undefined {
    return this.callManager.getLineState(lineId);
  }

  getAllLines(): CallLine[] {
    return this.callManager.getAllLines();
  }

  // ---------------------------------------------------------------------------
  // Recording
  // ---------------------------------------------------------------------------

  async startRecording(lineId: number): Promise<void> {
    return this.recordingManager.startRecording(lineId);
  }

  async stopRecording(lineId: number): Promise<Blob | null> {
    return this.recordingManager.stopRecording(lineId);
  }

  isRecording(lineId: number): boolean {
    return this.recordingManager.isRecording(lineId);
  }

  // ---------------------------------------------------------------------------
  // Attended Transfer
  // ---------------------------------------------------------------------------

  async startAttendedTransfer(lineId: number, targetNumber: string): Promise<number> {
    return this.transferManager.startAttendedTransfer(lineId, targetNumber);
  }

  async completeAttendedTransfer(consultLineId: number): Promise<void> {
    return this.transferManager.completeAttendedTransfer(consultLineId);
  }

  async cancelAttendedTransfer(consultLineId: number): Promise<void> {
    return this.transferManager.cancelAttendedTransfer(consultLineId);
  }

  getAttendedTransferState(
    lineId: number
  ): { originalLineId: number; consultLineId: number } | null {
    return this.transferManager.getAttendedTransferState(lineId);
  }

  // ---------------------------------------------------------------------------
  // Conference
  // ---------------------------------------------------------------------------

  async mergeLines(lineId1: number, lineId2: number): Promise<void> {
    return this.conferenceManager.mergeLines(lineId1, lineId2);
  }

  /**
   * SIP forms conferences with the hold + second-line + explicit-merge flow
   * (`instantConference: false`), so the UI never routes add-call here — the
   * page uses makeCall + mergeLines instead. Present only to satisfy ICallEngine.
   */
  async addConferenceParty(_number: string): Promise<void> {
    throw new Error('SIP uses the merge flow — add a second line, then mergeLines');
  }

  async splitConference(lineIdToKeep: number): Promise<void> {
    return this.conferenceManager.splitConference(lineIdToKeep);
  }

  isInConference(lineId: number): boolean {
    return this.conferenceManager.isInConference(lineId);
  }

  getConferencedLines(): number[] {
    return this.conferenceManager.getConferencedLines();
  }

  // ---------------------------------------------------------------------------
  // Private Utilities (shared via context)
  // ---------------------------------------------------------------------------

  private findAvailableLine(): number | null {
    for (let i = 1; i <= this.config.call.maxLines; i++) {
      if (!this.sessions.has(i)) {
        return i;
      }
    }
    return null;
  }

  private formatPhoneNumber(number: string): string {
    // Region-aware E.164 via the shared normalizer (honors DEFAULT_PHONE_REGION,
    // e.g. 'GB' for this client). Replaces the old hardcoded +1 assumption so
    // international (UK) numbers dial correctly; US output is unchanged.
    return toE164(number) || `+${number.replace(/\D/g, '')}`;
  }

  private getPeerConnection(session: Session): RTCPeerConnection | null {
    const sdh = session.sessionDescriptionHandler as {
      peerConnection?: RTCPeerConnection;
    };
    return sdh?.peerConnection || null;
  }

  private updateLineState(lineId: number, updates: Partial<CallLine>): void {
    const lineState = this.lineStates.get(lineId);
    if (lineState) {
      Object.assign(lineState, updates);
      this.lineStates.set(lineId, lineState);

      if (updates.state) {
        this.emit({ type: 'callStateChanged', lineId, state: updates.state });
      }
    }
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

// Persist on globalThis so the instance survives Next.js Fast Refresh (HMR).
// Without this, each module re-evaluation creates a NEW SipManager which opens
// a second WebSocket → duplicate REGISTER → duplicate INVITEs per call.
const SIP_KEY = '__bitnex_sipManager';

function getSipManager(): SipManager {
  if (typeof globalThis !== 'undefined' && (globalThis as Record<string, unknown>)[SIP_KEY]) {
    return (globalThis as Record<string, unknown>)[SIP_KEY] as SipManager;
  }
  const instance = new SipManager();
  if (typeof globalThis !== 'undefined') {
    (globalThis as Record<string, unknown>)[SIP_KEY] = instance;
  }
  return instance;
}

export const sipManager = getSipManager();
