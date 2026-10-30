/**
 * Call Engine Router — the single entry point for call control (Phase 3, 3c).
 *
 * Every consumer (the Zustand call store, providers, connection-status UI) goes
 * through `callEngine` instead of a concrete engine. The router delegates to the
 * currently-active engine and forwards its events, so the store/UI never branch
 * on engine type and the SIP.js path is byte-for-byte unchanged when it's active.
 *
 * Selection (model A): `selectEngine()` asks the server (`GET /livekit/config`,
 * OFF by default) which engine to run. LiveKit only when the backend says so;
 * SIP.js otherwise and on ANY error (fail-safe to the proven path). Only ONE
 * engine is ever connected at a time — the other stays dormant.
 *
 * Event forwarding: the store subscribes ONCE via `callEngine.on(...)`. The
 * router keeps that subscription and re-points it at the active engine whenever
 * selection changes, so consumers keep working across a switch with no re-subscribe.
 *
 * @module lib/call/call-engine
 */

import { apiClient } from '@/lib/api/client';
import type { ApiResponse } from '@/lib/types/common';
import { sipManager } from '../sip/sip-manager';
import { livekitManager } from '../livekit/livekit-manager';
import type { AudioConstraints } from '../sip/config';
import type { CallEngineCapabilities, ICallEngine } from './types';
import type {
  SipConnectionState,
  SipEvent,
  SipEventHandler,
  SipCredentials,
  CallLine,
  CallStats,
  MakeCallOptions,
  DTMFTone,
  ServerInfo,
} from './types';

type EngineName = 'sip' | 'livekit';

class CallEngineRouter implements ICallEngine {
  private active: ICallEngine;
  /** All engines — used for config that must apply regardless of which is active. */
  private readonly engines: ICallEngine[];
  private readonly handlers = new Set<SipEventHandler>();
  private activeUnsub: (() => void) | null = null;
  /** Last credentials passed to connect() — kept so a mid-call LiveKit failure
   *  can connect the (otherwise-dormant) SIP.js engine on demand and fail over. */
  private lastCredentials: SipCredentials | null = null;

  constructor(
    private readonly sip: ICallEngine,
    private readonly livekit: ICallEngine
  ) {
    this.active = sip; // default to the proven path until selectEngine() says otherwise
    this.engines = [sip, livekit];
    this.subscribeActive();
  }

  /** Re-point the internal subscription at whatever engine is now active. */
  private subscribeActive(): void {
    this.activeUnsub?.();
    this.activeUnsub = this.active.on((e) => this.dispatch(e));
  }

  private dispatch(event: SipEvent): void {
    this.handlers.forEach((h) => {
      try {
        h(event);
      } catch (err) {
        console.error('[callEngine] event handler error', err);
      }
    });
  }

  /** Which engine is currently active. */
  get activeEngine(): EngineName {
    return this.active === this.livekit ? 'livekit' : 'sip';
  }

  /**
   * Switch the active engine. Refuses to switch WHILE A CALL IS IN PROGRESS —
   * re-pointing mid-call would orphan the live call in the UI. The check is here
   * (not in selectEngine) so it's evaluated at the actual switch point, after any
   * async work — closing the race where a call starts during config fetch.
   * Returns whether the switch happened.
   */
  private setActiveEngine(engine: ICallEngine): boolean {
    if (engine === this.active) return true;
    if (this.active.hasActiveCalls()) return false;
    this.active = engine;
    this.subscribeActive();
    return true;
  }

  /**
   * Ask the server which engine to run. LiveKit ONLY when `/livekit/config`
   * says enabled for this agent; SIP.js otherwise and on any failure. Call this
   * before connect(). Returns the engine that is actually active afterward (which
   * may be unchanged if a call is in progress — see setActiveEngine).
   */
  async selectEngine(): Promise<EngineName> {
    const [telnyx, livekitRes] = await Promise.all([
      this.getTelnyxConfig(),
      apiClient
        .get<ApiResponse<{ enabled: boolean; url: string | null }>>('/livekit/config')
        .catch(() => null),
    ]);
    // Telnyx SIP-transport pilot: the agent stays on SIP.js, but its outbound
    // INVITEs are tagged so FreeSWITCH routes them out the Telnyx trunk. This is
    // orthogonal to which engine is active — arm it before selecting so it's in
    // place whenever SIP.js runs. This build has no Telnyx WebRTC engine, so only
    // the SIP-transport half of the pilot (`sipRoute`) applies here; the
    // `enabled`/Programmable-Voice half is a prod-only path.
    this.sip.setTelnyxRoute?.(telnyx.sipRoute);
    if (livekitRes?.data?.enabled) {
      this.setActiveEngine(this.livekit);
      return this.activeEngine;
    }
    this.setActiveEngine(this.sip);
    return this.activeEngine;
  }

  /** Telnyx config for this agent. `enabled` = run the Telnyx WebRTC engine
   *  (Programmable Voice — not present in this build); `sipRoute` = stay on SIP.js
   *  but tag INVITEs for the Telnyx trunk (SIP mode). Fail-safe: any error → both
   *  false (proven SIP.js/Tozcall path). */
  private async getTelnyxConfig(): Promise<{ enabled: boolean; sipRoute: boolean }> {
    try {
      const res =
        await apiClient.get<ApiResponse<{ enabled: boolean; sipRoute?: boolean }>>(
          '/telnyx/config'
        );
      return { enabled: res?.data?.enabled === true, sipRoute: res?.data?.sipRoute === true };
    } catch {
      return { enabled: false, sipRoute: false };
    }
  }

  // --- Events --------------------------------------------------------------

  on(handler: SipEventHandler): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  // --- Getters (active engine) ---------------------------------------------

  get connectionState(): SipConnectionState {
    return this.active.connectionState;
  }
  get isRegistered(): boolean {
    return this.active.isRegistered;
  }
  get activeLines(): CallLine[] {
    return this.active.activeLines;
  }
  get audioDevices(): MediaDeviceInfo[] {
    return this.active.audioDevices;
  }
  get selectedInputDeviceId(): string | null {
    return this.active.selectedInputDeviceId;
  }
  get selectedOutputDeviceId(): string | null {
    return this.active.selectedOutputDeviceId;
  }
  get isOnline(): boolean {
    return this.active.isOnline;
  }
  get currentServer(): ServerInfo | null {
    return this.active.currentServer;
  }
  get capabilities(): CallEngineCapabilities {
    return this.active.capabilities;
  }

  // --- Config that must apply to WHICHEVER engine becomes active -----------
  // (set regardless of selection timing, so the checkers are always in place)

  setDndChecker(checker: (() => boolean) | null): void {
    this.engines.forEach((e) => e.setDndChecker(checker));
  }
  setBlockedChecker(checker: ((n: string) => boolean) | null): void {
    this.engines.forEach((e) => e.setBlockedChecker(checker));
  }
  setOwnNumberChecker(checker: ((n: string) => boolean) | null): void {
    this.engines.forEach((e) => e.setOwnNumberChecker(checker));
  }
  setBackupServer(uri: string): void {
    this.engines.forEach((e) => e.setBackupServer(uri));
  }

  // --- Everything else delegates to the active engine ----------------------

  hasActiveCalls(): boolean {
    return this.active.hasActiveCalls();
  }
  getRemoteAudioStream(lineId: number): MediaStream | null {
    return this.active.getRemoteAudioStream(lineId);
  }
  connect(credentials: SipCredentials, preserveActiveCalls?: boolean): Promise<void> {
    this.lastCredentials = credentials;
    return this.active.connect(credentials, preserveActiveCalls);
  }
  markIntentDisconnected(): void {
    this.active.markIntentDisconnected();
  }
  disconnect(): Promise<void> {
    return this.active.disconnect();
  }
  destroy(): Promise<void> {
    return this.active.destroy();
  }
  enumerateAudioDevices(): Promise<MediaDeviceInfo[]> {
    return this.active.enumerateAudioDevices();
  }
  setAudioInputDevice(deviceId: string): Promise<void> {
    return this.active.setAudioInputDevice(deviceId);
  }
  setAudioOutputDevice(deviceId: string): Promise<void> {
    return this.active.setAudioOutputDevice(deviceId);
  }
  getAudioConstraints(): AudioConstraints {
    return (
      this.active.getAudioConstraints?.() ?? {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      }
    );
  }
  setAudioConstraints(partial: Partial<AudioConstraints>): Promise<void> {
    return this.active.setAudioConstraints?.(partial) ?? Promise.resolve();
  }
  getCallStats(lineId: number): Promise<CallStats | null> {
    return this.active.getCallStats(lineId);
  }
  isDndEnabled(): boolean {
    return this.active.isDndEnabled();
  }
  isNumberBlocked(n: string): boolean {
    return this.active.isNumberBlocked(n);
  }
  isOwnNumber(n: string): boolean {
    return this.active.isOwnNumber(n);
  }
  async makeCall(number: string, options?: MakeCallOptions): Promise<number> {
    try {
      return await this.active.makeCall(number, options);
    } catch (err) {
      // Mid-call fallback (the PK "all legs failed" case): if the LiveKit engine
      // couldn't place the call (dial/connect/all-legs-failed), fail over to the
      // INDEPENDENT SIP.js path (browser→Kamailio→FusionPBX — different servers,
      // different protocol, not the SGP SFU) instead of leaving a dead call.
      // Only from LiveKit, only when SIP isn't already carrying a call, and only
      // if we have credentials to bring the (dormant, model-A) SIP engine up.
      const canFallBack =
        this.active === this.livekit &&
        this.sip !== this.active &&
        !!this.lastCredentials &&
        !this.sip.hasActiveCalls();
      if (!canFallBack) throw err;
      console.warn('[callEngine] LiveKit dial failed — falling back to SIP.js', err);
      this.setActiveEngine(this.sip); // re-points event forwarding to SIP.js
      if (!this.sip.isRegistered) {
        await this.sip.connect(this.lastCredentials!);
      }
      return this.sip.makeCall(number, options);
    }
  }
  answerCall(lineId: number): Promise<void> {
    return this.active.answerCall(lineId);
  }
  rejectCall(lineId: number): Promise<void> {
    return this.active.rejectCall(lineId);
  }
  endCall(lineId: number): Promise<void> {
    return this.active.endCall(lineId);
  }
  holdCall(lineId: number): Promise<void> {
    return this.active.holdCall(lineId);
  }
  unholdCall(lineId: number): Promise<void> {
    return this.active.unholdCall(lineId);
  }
  switchCalls(): Promise<number | null> {
    return this.active.switchCalls();
  }
  muteCall(lineId: number): void {
    this.active.muteCall(lineId);
  }
  unmuteCall(lineId: number): void {
    this.active.unmuteCall(lineId);
  }
  sendDTMF(lineId: number, tone: DTMFTone): void {
    this.active.sendDTMF(lineId, tone);
  }
  transferCall(lineId: number, targetNumber: string): Promise<void> {
    return this.active.transferCall(lineId, targetNumber);
  }
  getLineState(lineId: number): CallLine | undefined {
    return this.active.getLineState(lineId);
  }
  getAllLines(): CallLine[] {
    return this.active.getAllLines();
  }
  startRecording(lineId: number): Promise<void> {
    return this.active.startRecording(lineId);
  }
  stopRecording(lineId: number): Promise<Blob | null> {
    return this.active.stopRecording(lineId);
  }
  isRecording(lineId: number): boolean {
    return this.active.isRecording(lineId);
  }
  startAttendedTransfer(lineId: number, targetNumber: string): Promise<number> {
    return this.active.startAttendedTransfer(lineId, targetNumber);
  }
  completeAttendedTransfer(consultLineId: number): Promise<void> {
    return this.active.completeAttendedTransfer(consultLineId);
  }
  cancelAttendedTransfer(consultLineId: number): Promise<void> {
    return this.active.cancelAttendedTransfer(consultLineId);
  }
  getAttendedTransferState(
    lineId: number
  ): { originalLineId: number; consultLineId: number } | null {
    return this.active.getAttendedTransferState(lineId);
  }
  mergeLines(lineId1: number, lineId2: number): Promise<void> {
    return this.active.mergeLines(lineId1, lineId2);
  }
  splitConference(lineIdToKeep: number): Promise<void> {
    return this.active.splitConference(lineIdToKeep);
  }
  isInConference(lineId: number): boolean {
    return this.active.isInConference(lineId);
  }
  addConferenceParty(number: string): Promise<void> {
    return this.active.addConferenceParty(number);
  }
  getConferencedLines(): number[] {
    return this.active.getConferencedLines();
  }
}

// ============================================================================
// Singleton — persisted on globalThis so it survives Next.js Fast Refresh,
// keeping the SAME router (and its event subscription) across HMR.
// ============================================================================

const CE_KEY = '__bitnex_callEngine';

function getCallEngine(): CallEngineRouter {
  if (typeof globalThis !== 'undefined' && (globalThis as Record<string, unknown>)[CE_KEY]) {
    return (globalThis as Record<string, unknown>)[CE_KEY] as CallEngineRouter;
  }
  const instance = new CallEngineRouter(sipManager, livekitManager);
  if (typeof globalThis !== 'undefined') {
    (globalThis as Record<string, unknown>)[CE_KEY] = instance;
  }
  return instance;
}

export const callEngine = getCallEngine();
