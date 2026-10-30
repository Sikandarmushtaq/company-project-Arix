'use client';

/**
 * SIP Store - Zustand store for SIP state management
 *
 * Provides reactive state for:
 * - Connection status
 * - Registration status
 * - Active calls/lines
 * - Incoming calls
 * - Audio devices
 * - Network status
 *
 * @module lib/stores/sip
 */

import { create } from 'zustand';
// Phase 3 seam: the store talks to the engine ROUTER (`callEngine`), not the
// SIP engine directly. Aliased to `sipManager` so every existing call site in
// this file is untouched. Today `callEngine === sipManager` (pass-through, zero
// behavior change); in 3c it becomes the SIP.js/LiveKit selector.
import { callEngine as sipManager } from '../call/call-engine';
import { callAudioService } from '../sip/call-audio-service';
import { useAuthStore } from './auth';
import { toast } from './toast';
import { callsService } from '../api/services/calls.service';
import { stopIncomingCallNotification } from '../utils/notifications';
import type { CallEngineCapabilities } from '../call/types';

import type {
  SipConnectionState,
  CallState,
  CallLine,
  IncomingCall,
  SipCredentials,
  MakeCallOptions,
  DTMFTone,
  CallStats,
  ServerInfo,
} from '../sip/types';
import type { AudioConstraints } from '../sip/config';

// Store the unsubscribe function for cleanup
let sipEventUnsubscribe: (() => void) | null = null;

/** How long an outbound-failure outcome notice stays before the store expires it. */
const CALL_OUTCOME_TTL_MS = 5000;

/** Snapshot of a just-ended call, consumed by the post-call DispositionModal. */
export interface EndedCallSnapshot {
  callRecordId: number;
  durationSecs: number;
  direction: 'inbound' | 'outbound';
  remoteNumber: string;
  remoteName?: string;
}

interface SipStore {
  // Connection state
  connectionState: SipConnectionState;
  isRegistered: boolean;
  registrationError: string | null;

  // Call state
  lines: CallLine[];
  activeLineId: number | null;
  incomingCall: IncomingCall | null;
  isAnswering: boolean; // Centralized state: true while answer is in progress
  isCallBusy: boolean; // true while makeCall/endCall is in progress — prevents rapid overlap
  isHoldBusy: boolean; // true while a hold/unhold request is in flight — prevents rapid-click overlap
  isTransferBusy: boolean; // true while a (blind/attended) transfer op is in flight — prevents rapid-click overlap

  // Audio devices
  audioDevices: MediaDeviceInfo[];
  selectedAudioInput: string | null;
  selectedAudioOutput: string | null;
  /** Call-audio processing (noise suppression / auto-gain / echo cancel). */
  audioConstraints: AudioConstraints;

  // Network status
  isOnline: boolean;

  // Call quality stats
  callStats: Record<number, CallStats>;

  // Server failover
  currentServer: ServerInfo | null;

  // Auto-download recording when call ends
  lastAutoRecording: { lineId: number; blob: Blob } | null;

  // Post-call disposition prompt — snapshot of the call that just ended, so the
  // global DispositionModal can ask the agent for an outcome. Cleared on submit.
  lastEndedCall: EndedCallSnapshot | null;

  // Professional outcome for an outbound INVITE rejected before answer (e.g.
  // "Not in Service"). Rendered as an inline notice anchored to the dialpad
  // (see CallOutcomeNotice) rather than a corner toast. `nonce` changes on every
  // occurrence so re-dialing the same dead number re-shows the notice.
  lastCallOutcome: { message: string; nonce: number } | null;

  // When set, the next call to end with this callRecordId skips the disposition
  // prompt — used by "Leave Voicemail & Drop", which already logs the outcome.
  suppressDispositionFor: number | null;

  // Attended transfer state (single source of truth)
  attendedTransferLineId: number | null;

  // In-call controls the ACTIVE engine supports (LiveKit lacks hold/transfer/etc
  // until 3e). The UI disables unsupported controls; the actions below also guard,
  // so keyboard shortcuts / any caller can't invoke an unsupported (throwing) op.
  capabilities: CallEngineCapabilities;

  // Actions
  connect: (credentials: SipCredentials) => Promise<void>;
  disconnect: () => Promise<void>;
  makeCall: (number: string, options?: MakeCallOptions) => Promise<number>;
  answerCall: (lineId: number) => Promise<void>;
  rejectCall: (lineId: number) => Promise<void>;
  endCall: (lineId: number) => Promise<void>;
  holdCall: (lineId: number) => Promise<void>;
  unholdCall: (lineId: number) => Promise<void>;
  switchToLine: (lineId: number) => Promise<void>;
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
  setAudioConstraints: (partial: Partial<AudioConstraints>) => Promise<void>;
  // Recording actions
  startRecording: (lineId: number) => Promise<void>;
  stopRecording: (lineId: number) => Promise<Blob | null>;
  // Attended transfer actions
  startAttendedTransfer: (lineId: number, targetNumber: string) => Promise<number>;
  completeAttendedTransfer: (consultLineId: number) => Promise<void>;
  cancelAttendedTransfer: (consultLineId: number) => Promise<void>;
  clearAttendedTransfer: () => void;
  // Conference actions
  mergeLines: (lineId1: number, lineId2: number) => Promise<void>;
  splitConference: (lineIdToKeep: number) => Promise<void>;
  addConferenceParty: (number: string) => Promise<void>;
  // Recording auto-download
  clearLastAutoRecording: () => void;
  // Dismiss the outbound-failure outcome notice (manual close / on answer)
  clearCallOutcome: () => void;
  // Post-call disposition prompt
  clearLastEndedCall: () => void;
  suppressDispositionOnce: (callRecordId: number) => void;
  clearDispositionSuppress: () => void;
  // Cleanup action
  destroy: () => Promise<void>;
}

/**
 * Anti-spam caller-ID guard: minimum ANSWERED talk time (ms) before the agent may
 * end an OUTBOUND call. Ultra-short connected calls are the robo-dialer/spam
 * fingerprint that flags caller IDs to voicemail. Enforced in the store's endCall
 * (the single chokepoint every End button goes through). Ringing/inbound and
 * internal cleanup/transfer (which call the manager directly, below this) are exempt.
 */
export const CALL_END_LOCK_MS = 6000;

export const useSipStore = create<SipStore>((set, get) => {
  // Unsubscribe from previous subscription if any (prevents duplicates on HMR)
  if (sipEventUnsubscribe) {
    sipEventUnsubscribe();
  }

  // Subscribe to SIP events and store unsubscribe function
  sipEventUnsubscribe = sipManager.on((event) => {
    switch (event.type) {
      case 'connectionStateChanged':
        // Refresh capabilities: the active engine (hence its control set) can
        // change when selectEngine() switches SIP.js ↔ LiveKit at connect time.
        set({ connectionState: event.state, capabilities: sipManager.capabilities });
        // Reset SIP state when disconnected (e.g., on logout)
        // This ensures clean state for next user login
        if (event.state === 'disconnected') {
          set({
            isRegistered: false,
            registrationError: null,
            lines: [],
            activeLineId: null,
            incomingCall: null,
            isAnswering: false,
            isCallBusy: false,
            isHoldBusy: false,
            isTransferBusy: false,
            callStats: {},
            attendedTransferLineId: null,
          });
        }
        break;

      case 'registrationStateChanged':
        set({
          isRegistered: event.isRegistered,
          registrationError: event.error || null,
        });
        break;

      case 'incomingCall':
        // Atomic update for immediate UI response
        // Only set activeLineId if no other call is active (don't interrupt ongoing calls)
        // Don't overwrite incomingCall if one is already ringing — parallel fork
        // from FreeSWITCH sends duplicate INVITEs via both Kamailio nodes.
        // The first INVITE controls the UI; duplicates are ignored here and
        // get CANCEL'd naturally when the user answers the first.
        {
          const existingIncoming = get().incomingCall;
          if (existingIncoming) {
            // Just update lines (the duplicate line exists) but don't touch incomingCall
            set({ lines: sipManager.getAllLines() });
            break;
          }

          const currentActive = get().activeLineId;
          const hasActiveCall =
            currentActive !== null &&
            get().lines.some((l) => l.id === currentActive && l.state === 'established');

          set({
            incomingCall: event.call,
            lines: sipManager.getAllLines(),
            // Don't switch active line if user is on an established call
            ...(hasActiveCall ? {} : { activeLineId: event.call.lineId }),
          });
        }
        break;

      case 'callStateChanged':
        // Update lines immediately for responsive UI
        set({ lines: sipManager.getAllLines() });

        // Auto-select active line for call states that need immediate UI feedback
        // - 'dialing': User initiated outbound call, show dialing UI immediately
        // - 'ringing': Call is ringing (inbound or outbound ringback)
        // - 'connecting': Call is being connected
        // - 'established': Call is active
        {
          const activeCallStates: CallState[] = ['dialing', 'ringing', 'connecting', 'established'];
          if (activeCallStates.includes(event.state)) {
            const currentActive = get().activeLineId;
            if (!currentActive) {
              set({ activeLineId: event.lineId });
            }
          }
        }

        // Stop title flashing when call is answered
        if (event.state === 'established') {
          stopIncomingCallNotification();
        }
        break;

      case 'callOutcome':
        // Professional outcome for an outbound INVITE rejected before answer
        // (e.g. 404 → "Not in Service"). Emitted directly from the engine's
        // onReject, decoupled from the callEnded / Terminated-stateChange race,
        // so the label is reliable. onReject only fires for outbound pre-answer
        // failures and never on ICE-retry, so this is always safe to surface.
        // Surfaced as an inline notice anchored to the dialpad (CallOutcomeNotice),
        // not a corner toast — the failure belongs next to the dial controls.
        //
        // The outcome is a TRANSIENT signal owned entirely by the store: it
        // auto-expires here (a store-level timer that survives the notice
        // component unmounting during a call), and is cleared at the start of any
        // new call (see makeCall) and when a call is answered. The notice is a
        // pure reflection of this state, so it can never resurface a stale label
        // on remount — which is exactly the bug where a connected call showed
        // "Not in Service" left over from an earlier dead-number test.
        {
          const nonce = Date.now();
          set({ lastCallOutcome: { message: event.outcome, nonce } });
          setTimeout(() => {
            const current = get().lastCallOutcome;
            // Only clear if THIS outcome is still the one showing (a newer call
            // may have replaced it, and that newer timer owns the clear).
            if (current && current.nonce === nonce) {
              set({ lastCallOutcome: null });
            }
          }, CALL_OUTCOME_TTL_MS);
        }
        break;

      case 'callEnded':
        // Snapshot the ended call for the post-call disposition prompt BEFORE it
        // is dropped from the store. The SIP layer already removed it from
        // getAllLines(), but our cached `lines` still holds it (with callRecordId
        // + duration). Only prompt when the agent was involved: any outbound
        // call, or an answered inbound call.
        {
          const endedForDisposition = get().lines.find((l) => l.id === event.lineId);
          if (endedForDisposition?.callRecordId != null) {
            if (get().suppressDispositionFor === endedForDisposition.callRecordId) {
              // Already logged via "Leave Voicemail & Drop" — skip the prompt.
              set({ suppressDispositionFor: null });
            } else if (
              endedForDisposition.direction === 'outbound' ||
              endedForDisposition.wasAnswered === true
            ) {
              set({
                lastEndedCall: {
                  callRecordId: endedForDisposition.callRecordId,
                  // line.duration is only finalized at hangup (and not written
                  // back to the line), so compute talk-time from answerTime —
                  // otherwise every prompt shows 0s and posts clientDurationSecs=0.
                  durationSecs: endedForDisposition.answerTime
                    ? Math.max(
                        0,
                        Math.floor((Date.now() - endedForDisposition.answerTime.getTime()) / 1000)
                      )
                    : endedForDisposition.duration || 0,
                  direction: endedForDisposition.direction,
                  remoteNumber: endedForDisposition.remoteNumber,
                  remoteName: endedForDisposition.remoteName,
                },
              });
            }
          }

          // Surface a professional outcome for an OUTBOUND call that failed
          // before it was answered (e.g. a dead number → "Not in Service"
          // instead of a bare "Call failed"). The engine sets `outcome` only
          // for definite failures; user-cancelled / normal ends leave it unset.
          // NOTE: the outbound-failure toast is now driven by the dedicated
          // 'callOutcome' event (emitted from the engine's onReject), NOT from
          // callEnded — SIP.js fires the Terminated stateChange before onReject,
          // so callEnded races ahead of the outcome being known. See the
          // 'callOutcome' case above. event.outcome may still arrive here in the
          // non-racing engines/paths; it is intentionally not used for the toast.
        }

        // Stop ringback (outbound only, always safe to stop)
        callAudioService.stopRingback();
        // Only stop ringtone if no other inbound lines are still ringing.
        // Parallel fork (FreeSWITCH bridges to both Kamailio nodes) can CANCEL
        // one fork quickly — the ringtone must keep playing for the surviving line.
        {
          const allLines = sipManager.getAllLines();
          const hasRingingInbound = allLines.some(
            (l) => l.direction === 'inbound' && l.state === 'ringing'
          );
          if (!hasRingingInbound) {
            callAudioService.stopRingtone();
            stopIncomingCallNotification();
          }
        }

        {
          const remainingLines = sipManager.getAllLines();
          const wasActive = get().activeLineId === event.lineId;

          set({ lines: remainingLines });

          // Clear active line if it was the one that ended
          if (wasActive) {
            set({
              activeLineId: remainingLines.length > 0 ? remainingLines[0].id : null,
            });
          }

          // Auto-unhold: If exactly one call remains and it's held, resume it.
          // This handles: ending second call after add-call, ending one side of split conference, etc.
          // SKIP auto-unhold if the ended call was the attended transfer consultation line —
          // cancelAttendedTransfer will explicitly unhold after SIP cleanup completes.
          const isAttendedTransferEnd = get().attendedTransferLineId === event.lineId;
          if (remainingLines.length === 1 && remainingLines[0].isHeld && !isAttendedTransferEnd) {
            const heldLineId = remainingLines[0].id;
            sipManager
              .unholdCall(heldLineId)
              .then(() => {
                set({ lines: sipManager.getAllLines(), activeLineId: heldLineId });
              })
              .catch((err) => {
                // Non-fatal — user can manually resume
                console.warn('Auto-unhold failed:', err);
              });
          }
        }

        // Clear incoming call if it was rejected/ended.
        // If another ringing inbound line exists (parallel fork), fall back to it
        // so the UI stays visible instead of disappearing.
        if (get().incomingCall?.lineId === event.lineId) {
          const updatedLines = sipManager.getAllLines();
          const otherRinging = updatedLines.find(
            (l) => l.id !== event.lineId && l.direction === 'inbound' && l.state === 'ringing'
          );
          if (otherRinging) {
            set({
              incomingCall: {
                lineId: otherRinging.id,
                callerNumber: otherRinging.remoteNumber,
                callerName: otherRinging.remoteName,
                timestamp: otherRinging.startTime || new Date(),
              },
            });
          } else {
            set({ incomingCall: null });
          }
        }
        // Clear attended transfer if consultation line ended
        if (get().attendedTransferLineId === event.lineId) {
          set({ attendedTransferLineId: null });
        }
        // Clear call stats for ended call
        set((state) => {
          const newStats = { ...state.callStats };
          delete newStats[event.lineId];
          return { callStats: newStats };
        });
        break;

      // Audio device events
      case 'audioDevicesChanged':
        set({ audioDevices: event.devices });
        break;

      case 'audioInputChanged':
        set({ selectedAudioInput: event.deviceId });
        break;

      case 'audioOutputChanged':
        set({ selectedAudioOutput: event.deviceId });
        break;

      // Network events
      case 'networkStatusChanged':
        set({ isOnline: event.isOnline });
        break;

      // Call quality events
      case 'callStatsUpdate':
        set((state) => ({
          callStats: {
            ...state.callStats,
            [event.lineId]: event.stats,
          },
        }));
        break;

      // Server failover events
      case 'serverHealthChanged':
        set({ currentServer: event.server });
        break;

      case 'serverFailover':
        // Server info will be updated via serverHealthChanged
        break;

      // Recording events
      case 'recordingStarted':
        set({ lines: sipManager.getAllLines() });
        break;

      case 'recordingStopped':
        set({ lines: sipManager.getAllLines() });
        // Capture recording for auto-download when call ends during recording
        if (event.recording && event.recording.size > 0) {
          set({ lastAutoRecording: { lineId: event.lineId, blob: event.recording } });
        }
        break;

      // Transfer events
      case 'transferCompleted':
      case 'transferFailed':
        set({ lines: sipManager.getAllLines(), attendedTransferLineId: null });
        break;

      // Call switching events
      case 'callsSwitched':
        set({ lines: sipManager.getAllLines(), activeLineId: event.newActiveLineId });
        break;

      // Conference events — merging clears any in-progress transfer UI
      case 'conferenceStarted':
        set({ lines: sipManager.getAllLines(), attendedTransferLineId: null });
        break;
      case 'conferenceSplit':
        set({ lines: sipManager.getAllLines() });
        break;
    }
  });

  return {
    // Initial state
    connectionState: 'disconnected',
    isRegistered: false,
    registrationError: null,
    lines: [],
    activeLineId: null,
    incomingCall: null,
    isAnswering: false,
    isCallBusy: false,
    isHoldBusy: false,
    isTransferBusy: false,
    audioDevices: [],
    selectedAudioInput: sipManager.selectedInputDeviceId,
    selectedAudioOutput: sipManager.selectedOutputDeviceId,
    audioConstraints: sipManager.getAudioConstraints(),
    isOnline: sipManager.isOnline,
    callStats: {},
    currentServer: sipManager.currentServer,
    lastAutoRecording: null,
    lastEndedCall: null,
    lastCallOutcome: null,
    suppressDispositionFor: null,
    attendedTransferLineId: null,
    capabilities: sipManager.capabilities,

    // Connection actions
    connect: async (credentials: SipCredentials) => {
      try {
        set({ registrationError: null });
        await sipManager.connect(credentials);
      } catch (error) {
        set({
          registrationError: error instanceof Error ? error.message : 'Connection failed',
        });
        throw error;
      }
    },

    disconnect: async () => {
      await sipManager.disconnect();
      set({
        connectionState: 'disconnected',
        isRegistered: false,
        lines: [],
        activeLineId: null,
        incomingCall: null,
        isAnswering: false,
        isCallBusy: false,
        callStats: {},
        attendedTransferLineId: null,
      });
    },

    // Call actions
    makeCall: async (number: string, options?: MakeCallOptions) => {
      if (get().isCallBusy) return -1; // Block rapid overlapping calls

      // A new call supersedes any prior call's outcome notice — clear it now so a
      // stale "Not in Service" from an earlier dead-number test can never be
      // attributed to this call (e.g. after the dialpad remounts post-call).
      set({ lastCallOutcome: null });

      // Allowance gate (reskin-only frontend). Checked for EVERY signed-in user:
      // metered orgs hit the pre-KYC base cap or a bundle/base allowance, and
      // "unlimited" orgs (approved / admin-created not_required) can hit the HIDDEN
      // monthly call soft cap — the backend returns a NEUTRAL reason we surface
      // verbatim (never a limit/number). The backend is fast (cached) for a truly
      // unlimited org, so this adds negligible latency. Fail-open: a preflight error
      // never blocks a call.
      const cvStatus = useAuthStore.getState().user?.callVerificationStatus;
      if (cvStatus) {
        try {
          const pf = await callsService.getPreflight();
          if (!pf.allowed) {
            toast.error(
              pf.reason ||
                'Calling is currently unavailable. Please contact your administrator to continue making calls.'
            );
            return -1;
          }
        } catch {
          // ignore — never block a call on a preflight failure
        }
      }

      set({ isCallBusy: true });
      // Safety net: guarantee the busy lock releases even if sipManager.makeCall
      // never settles (a hung SIP layer on a dead transport). Without this, a stuck
      // `isCallBusy` greys the call button until a page refresh. The SIP awaits are
      // individually bounded now; this defends the class of bug regardless.
      const busyWatchdog = setTimeout(() => set({ isCallBusy: false }), 20000);
      try {
        const lineId = await sipManager.makeCall(number, options);
        set({
          lines: sipManager.getAllLines(),
          activeLineId: lineId,
        });
        return lineId;
      } finally {
        clearTimeout(busyWatchdog);
        set({ isCallBusy: false });
      }
    },

    answerCall: async (lineId: number) => {
      // Guard: Check if already answering (prevents double-click issues)
      const state = get();
      if (state.isAnswering) {
        // Already answering - silently return
        return;
      }
      if (!state.incomingCall || state.incomingCall.lineId !== lineId) {
        // Already answered or different call - silently return
        return;
      }

      // IMMEDIATELY set answering state and clear incoming call to prevent double-clicks
      // This must happen BEFORE the async sipManager call. Also clear any lingering
      // outbound-failure notice — a live answered call must never show a stale label.
      set({ isAnswering: true, incomingCall: null, activeLineId: lineId, lastCallOutcome: null });

      // Stop ringtone/ringback/notifications immediately on user action (don't wait for async events)
      callAudioService.stopRingtone();
      callAudioService.stopRingback();
      stopIncomingCallNotification();

      try {
        await sipManager.answerCall(lineId);
        set({ lines: sipManager.getAllLines() });
      } finally {
        // Always clear answering state
        set({ isAnswering: false });
      }
    },

    rejectCall: async (lineId: number) => {
      // Stop ringtone/ringback/notifications immediately on user action
      callAudioService.stopRingtone();
      callAudioService.stopRingback();
      stopIncomingCallNotification();

      await sipManager.rejectCall(lineId);
      set({
        lines: sipManager.getAllLines(),
        incomingCall: null,
      });
    },

    endCall: async (lineId: number) => {
      // Anti-spam caller-ID guard (see CALL_END_LOCK_MS). An OUTBOUND call that has
      // been ANSWERED cannot be ended by the agent within the lock window. Only the
      // agent's manual end is delayed — ringing/inbound have no answerTime, and a
      // remote/system hangup or transfer/cleanup terminates via the manager directly
      // (below this store action), so neither is affected.
      const line = get().lines.find((l) => l.id === lineId);
      // Org policy (pushed live via ORG_CALL_POLICY_UPDATED): the lock is OFF when
      // the org's end-call-lock flag is explicitly disabled — e.g. the org is on
      // the Tozcall trunk. Absent/null → ON (fail-safe: the anti-spam guard stays
      // on unless deliberately turned off). MySQL sends 0/1, so treat 0 or false as off.
      const lockFlag = useAuthStore.getState().user?.endCallLockEnabled;
      const lockEnabled = lockFlag !== false && lockFlag !== 0;
      if (lockEnabled && line?.direction === 'outbound' && line.answerTime) {
        const connectedMs = Date.now() - new Date(line.answerTime).getTime();
        if (connectedMs < CALL_END_LOCK_MS) {
          const left = Math.ceil((CALL_END_LOCK_MS - connectedMs) / 1000);
          toast.error(`Please stay on the call — you can end it in ${left}s.`);
          return;
        }
      }
      set({ isCallBusy: true });
      try {
        await sipManager.endCall(lineId);
        set({ lines: sipManager.getAllLines() });
      } finally {
        set({ isCallBusy: false });
      }
    },

    holdCall: async (lineId: number) => {
      if (!sipManager.capabilities.hold) return; // active engine has no hold (e.g. LiveKit pre-3e)
      if (get().isHoldBusy) return; // guard rapid-click overlap — see isHoldBusy
      set({ isHoldBusy: true });
      try {
        await sipManager.holdCall(lineId);
      } catch (err) {
        console.error('[hold] failed', err);
      } finally {
        // Resync the UI to the engine's real state regardless of outcome, so a
        // failed hold never leaves the button showing the wrong label.
        set({ lines: sipManager.getAllLines(), isHoldBusy: false });
      }
    },

    unholdCall: async (lineId: number) => {
      if (!sipManager.capabilities.hold) return;
      if (get().isHoldBusy) return;
      set({ isHoldBusy: true });
      try {
        await sipManager.unholdCall(lineId);
      } catch (err) {
        console.error('[unhold] failed', err);
      } finally {
        set({ lines: sipManager.getAllLines(), isHoldBusy: false });
      }
    },

    switchToLine: async (lineId: number) => {
      // Atomically hold the current active call and unhold the target line
      const currentActiveId = get().activeLineId;
      const lines = sipManager.getAllLines();
      const targetLine = lines.find((l) => l.id === lineId);

      if (!targetLine) return;

      // If the target is already active and not held, just switch UI focus
      if (!targetLine.isHeld && targetLine.state === 'established') {
        set({ activeLineId: lineId });
        return;
      }

      // Hold current active call (if it's established and not held)
      if (currentActiveId && currentActiveId !== lineId) {
        const currentLine = lines.find((l) => l.id === currentActiveId);
        if (currentLine && currentLine.state === 'established' && !currentLine.isHeld) {
          await sipManager.holdCall(currentActiveId);
        }
      }

      // Unhold the target call
      if (targetLine.isHeld) {
        await sipManager.unholdCall(lineId);
      }

      set({ lines: sipManager.getAllLines(), activeLineId: lineId });
    },

    muteCall: (lineId: number) => {
      sipManager.muteCall(lineId);
      set({ lines: sipManager.getAllLines() });
    },

    unmuteCall: (lineId: number) => {
      sipManager.unmuteCall(lineId);
      set({ lines: sipManager.getAllLines() });
    },

    sendDTMF: (lineId: number, tone: DTMFTone) => {
      sipManager.sendDTMF(lineId, tone);
    },

    transferCall: async (lineId: number, targetNumber: string) => {
      if (!sipManager.capabilities.transfer) return;
      if (get().isTransferBusy) return; // guard rapid-click overlap — avoids double REFER
      set({ isTransferBusy: true });
      try {
        await sipManager.transferCall(lineId, targetNumber);
      } catch (err) {
        console.error('[transfer] failed', err);
      } finally {
        set({ lines: sipManager.getAllLines(), isTransferBusy: false });
      }
    },

    setActiveLineId: (lineId: number | null) => {
      set({ activeLineId: lineId });
    },

    clearIncomingCall: () => {
      set({ incomingCall: null });
    },

    // Audio device actions
    refreshAudioDevices: async () => {
      const devices = await sipManager.enumerateAudioDevices();
      set({ audioDevices: devices });
    },

    setAudioInput: async (deviceId: string) => {
      await sipManager.setAudioInputDevice(deviceId);
      set({ selectedAudioInput: deviceId });
    },

    setAudioConstraints: async (partial: Partial<AudioConstraints>) => {
      await sipManager.setAudioConstraints(partial);
      set({ audioConstraints: sipManager.getAudioConstraints() });
    },

    setAudioOutput: async (deviceId: string) => {
      await sipManager.setAudioOutputDevice(deviceId);
      set({ selectedAudioOutput: deviceId });
    },

    // Recording actions
    startRecording: async (lineId: number) => {
      if (!sipManager.capabilities.recording) return;
      await sipManager.startRecording(lineId);
      set({ lines: sipManager.getAllLines() });
    },

    stopRecording: async (lineId: number) => {
      if (!sipManager.capabilities.recording) return null;
      const recording = await sipManager.stopRecording(lineId);
      set({ lines: sipManager.getAllLines() });
      return recording;
    },

    // Attended transfer actions
    startAttendedTransfer: async (lineId: number, targetNumber: string) => {
      if (!sipManager.capabilities.attendedTransfer) return -1;
      if (get().isTransferBusy) return -1; // guard rapid-click overlap — avoids a double consult leg
      set({ isTransferBusy: true });
      try {
        const consultLineId = await sipManager.startAttendedTransfer(lineId, targetNumber);
        set({ lines: sipManager.getAllLines(), attendedTransferLineId: consultLineId });
        return consultLineId;
      } catch (err) {
        console.error('[attended-transfer:start] failed', err);
        set({ lines: sipManager.getAllLines() });
        return -1;
      } finally {
        set({ isTransferBusy: false });
      }
    },

    completeAttendedTransfer: async (consultLineId: number) => {
      if (get().isTransferBusy) return; // guard rapid-click overlap — avoids a double bridge
      set({ isTransferBusy: true });
      try {
        await sipManager.completeAttendedTransfer(consultLineId);
        set({ lines: sipManager.getAllLines(), attendedTransferLineId: null });
      } catch (err) {
        // Re-throw: the caller (handleCompleteAttendedTransfer) shows a failure
        // toast on throw and a success toast otherwise, and on failure the consult
        // stays up so the agent can retry — swallowing here would falsely report
        // success and clear that UI. Resync lines first so state stays truthful.
        set({ lines: sipManager.getAllLines() });
        throw err;
      } finally {
        set({ isTransferBusy: false });
      }
    },

    cancelAttendedTransfer: async (consultLineId: number) => {
      // cancelAttendedTransfer now includes the explicit unhold with a delay,
      // so getAllLines() after it returns reflects the resumed call state.
      await sipManager.cancelAttendedTransfer(consultLineId);
      const lines = sipManager.getAllLines();
      set({
        lines,
        attendedTransferLineId: null,
        activeLineId: lines.length > 0 ? lines[0].id : null,
      });
    },

    clearAttendedTransfer: () => {
      set({ attendedTransferLineId: null });
    },

    // Conference actions
    mergeLines: async (lineId1: number, lineId2: number) => {
      if (!sipManager.capabilities.conference) return;
      await sipManager.mergeLines(lineId1, lineId2);
      set({ lines: sipManager.getAllLines() });
    },

    splitConference: async (lineIdToKeep: number) => {
      if (!sipManager.capabilities.conference) return;
      await sipManager.splitConference(lineIdToKeep);
      set({ lines: sipManager.getAllLines() });
    },

    // Instant-conference add (LiveKit): dial a party straight into the current
    // room. Guarded like a transfer — it dials a billable PSTN leg, so rapid or
    // overlapping adds are dropped. Rethrows so the caller can toast on failure.
    addConferenceParty: async (number: string) => {
      if (!sipManager.capabilities.conference) return;
      if (get().isTransferBusy) return;
      set({ isTransferBusy: true });
      try {
        await sipManager.addConferenceParty(number);
        set({ lines: sipManager.getAllLines() });
      } catch (err) {
        console.error('[conference:add] failed', err);
        set({ lines: sipManager.getAllLines() });
        throw err;
      } finally {
        set({ isTransferBusy: false });
      }
    },

    // Recording auto-download
    clearLastAutoRecording: () => {
      set({ lastAutoRecording: null });
    },

    clearCallOutcome: () => {
      set({ lastCallOutcome: null });
    },

    // Post-call disposition prompt
    clearLastEndedCall: () => {
      set({ lastEndedCall: null });
    },

    // Mark a call so its end skips the disposition prompt (already logged).
    suppressDispositionOnce: (callRecordId: number) => {
      set({ suppressDispositionFor: callRecordId });
    },

    // Undo a pending suppression (e.g. the voicemail-drop request failed).
    clearDispositionSuppress: () => {
      set({ suppressDispositionFor: null });
    },

    // Cleanup action - call when destroying the store/app
    destroy: async () => {
      // Unsubscribe from SIP events
      if (sipEventUnsubscribe) {
        sipEventUnsubscribe();
        sipEventUnsubscribe = null;
      }

      // Destroy SIP manager (removes event listeners)
      await sipManager.destroy();

      // Reset store state
      set({
        connectionState: 'disconnected',
        isRegistered: false,
        registrationError: null,
        lines: [],
        activeLineId: null,
        incomingCall: null,
        isAnswering: false,
        audioDevices: [],
        selectedAudioInput: null,
        selectedAudioOutput: null,
        callStats: {},
        currentServer: null,
        lastAutoRecording: null,
        lastEndedCall: null,
        suppressDispositionFor: null,
        attendedTransferLineId: null,
      });
    },
  };
});
