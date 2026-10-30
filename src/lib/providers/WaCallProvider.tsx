'use client';

/**
 * Global WhatsApp Call Provider
 *
 * Runs in the phone layout (same level as SipProvider) so WA call events
 * are handled on ALL pages — not just /phone/whatsapp.
 *
 * Responsibilities:
 * - Subscribe to WA call WebSocket events globally
 * - Play ringtone on incoming calls
 * - Show browser notifications for incoming/missed calls
 * - Expose call state + actions via React context
 *
 * @module lib/providers/WaCallProvider
 */

import React, { createContext, useContext, useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useSocket } from '@/lib/providers/SocketProvider';
import { waCallManager } from '@/lib/whatsapp-call/WaCallManager';
import { emptyWaCallState } from '@/lib/whatsapp-call/types';
import { waCallService } from '@/lib/api/services/waCall.service';
import { playWaRingback, stopWaRingback } from '@/lib/whatsapp-call/ringback';
// WA calls use their own ringtone instance — cannot share callAudioService
// because the SIP store stops the shared ringtone when no SIP lines are ringing.
let waRingtoneAudio: HTMLAudioElement | null = null;

function playWaRingtone(): void {
  try {
    if (!waRingtoneAudio) {
      waRingtoneAudio = new Audio('/audio/classic-phone-ringtone.mp3');
      waRingtoneAudio.loop = true;
      waRingtoneAudio.volume = 0.7;
    }
    waRingtoneAudio.currentTime = 0;
    waRingtoneAudio.play().catch(() => {
      /* ignore autoplay block */
    });
  } catch {
    // ignore
  }
}

function stopWaRingtone(): void {
  if (waRingtoneAudio) {
    waRingtoneAudio.pause();
    waRingtoneAudio.currentTime = 0;
  }
}
import type {
  WaCallState,
  WaCallIncomingEvent,
  WaCallEndedEvent,
  WaCallSdpAnswerEvent,
  WaCallPermissionEvent,
} from '@/lib/whatsapp-call/types';
import { useQueryClient } from '@tanstack/react-query';
import {
  playNotificationSound,
  showBrowserNotification,
  startTitleFlash,
  incrementFaviconBadge,
} from '@/lib/utils/notifications-shared';
import { richNotification } from '@/lib/stores/richNotification';
import { useNotificationSettings } from '@/lib/stores/notificationSettings';

const WS_EVENTS = {
  INCOMING: 'wa:call_incoming',
  // Outbound only — Meta confirmed the customer's phone is ringing. UI uses
  // it to switch "Calling..." → "Ringing..." while the local ringback tone
  // continues. Distinct from INCOMING (which is the inbound "your phone is
  // ringing" signal).
  OUTBOUND_RINGING: 'wa:call_outbound_ringing',
  // Outbound: customer accepted → drive "Connected" deterministically.
  OUTBOUND_ANSWERED: 'wa:call_outbound_answered',
  ANSWERED: 'wa:call_answered',
  REJECTED: 'wa:call_rejected',
  ENDED: 'wa:call_ended',
  MISSED: 'wa:call_missed',
  SDP_ANSWER: 'wa:call_sdp_answer',
  PERMISSION_GRANTED: 'wa:call_permission_granted',
  PERMISSION_REJECTED: 'wa:call_permission_rejected',
} as const;

/**
 * Max time a WhatsApp call may ring before this client gives up locally.
 * Slightly longer than Meta's ~30s ring timeout — the server's WA_CALL_MISSED
 * (from Meta's `terminate` webhook) should land first under normal conditions.
 * This is the safety net for: server crash, WebSocket reconnect that misses
 * the broadcast, or any other path where neither WA_CALL_ANSWERED nor
 * WA_CALL_MISSED reaches this tab. Prevents forever-ring.
 */
const MAX_RING_MS = 35_000;

export interface WaCallContextValue {
  state: WaCallState;
  answerCall: (sdpOffer: string, callId?: string) => Promise<void>;
  rejectCall: () => Promise<void>;
  endCall: () => Promise<void>;
  toggleMute: () => void;
  startRecording: () => void;
  requestPermission: (phoneNumberId: string, customerNumber: string) => Promise<void>;
  initiateCall: (
    phoneNumberId: string,
    customerNumber: string,
    customerName?: string
  ) => Promise<void>;
  isRequestingPermission: boolean;
  incomingEvent: WaCallIncomingEvent | null;
  permissionEvent: WaCallPermissionEvent | null;
  /**
   * Outbound calls only. `false` until Meta sends the RINGING webhook
   * confirming the customer's phone is now ringing; flips to `true` then.
   * UI uses this to refine the "Calling..." label into "Ringing..." once
   * the call has actually reached the customer's device.
   */
  outboundRingingConfirmed: boolean;
  missedCalls: Array<{
    callId: string;
    customerNumber: string;
    customerName: string | null;
    timestamp: number;
  }>;
  clearMissedCalls: () => void;
}

const WaCallContext = createContext<WaCallContextValue | null>(null);

export function useGlobalWaCall(): WaCallContextValue {
  const ctx = useContext(WaCallContext);
  if (!ctx) throw new Error('useGlobalWaCall must be used within WaCallProvider');
  return ctx;
}

/**
 * Notify user of a missed WhatsApp call.
 * Mirrors the SIP missed call notification (tone + rich notification + browser notification + title flash).
 */
function notifyWaMissedCall(customerNumber: string, customerName?: string | null) {
  const displayName = customerName || customerNumber;
  const settings = useNotificationSettings.getState();

  // Play missed call sound
  playNotificationSound('MISSED_CALL');

  // Rich notification toast
  if (settings.toastEnabled) {
    richNotification.missedCall(customerNumber, { contactName: customerName ?? undefined });
  }

  // Browser notification + title flash when tab not focused
  if (typeof document !== 'undefined' && !document.hasFocus()) {
    const notification = showBrowserNotification('Missed WhatsApp Call', {
      body: `${displayName} tried to call you on WhatsApp`,
      tag: 'wa-missed-call',
      silent: false,
    });

    if (notification) {
      notification.onclick = () => {
        window.focus();
        window.dispatchEvent(
          new CustomEvent('app:navigate', { detail: { path: '/phone/whatsapp-calls' } })
        );
        notification.close();
      };
    }

    startTitleFlash(`Missed WA call from ${displayName}`, '📵');
    incrementFaviconBadge();
  }
}

/**
 * Browser notification for incoming WA call (no tone — ringtone handles that).
 */
function notifyWaIncoming(customerNumber: string, customerName?: string | null) {
  if (typeof document !== 'undefined' && !document.hasFocus()) {
    const displayName = customerName || customerNumber;
    showBrowserNotification('Incoming WhatsApp Call', {
      body: `${displayName} is calling on WhatsApp`,
      tag: 'wa-incoming-call',
      silent: true, // ringtone is already playing
      requireInteraction: true,
    });
    startTitleFlash(`WhatsApp call from ${displayName}`, '📞');
  }
}

export function WaCallProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<WaCallState>(emptyWaCallState());
  const [incomingEvent, setIncomingEvent] = useState<WaCallIncomingEvent | null>(null);
  const [permissionEvent, setPermissionEvent] = useState<WaCallPermissionEvent | null>(null);
  const [isRequestingPermission, setIsRequestingPermission] = useState(false);
  // Outbound-only flag: Meta has confirmed the customer's phone is ringing.
  // Set by the WA_CALL_OUTBOUND_RINGING WS event; reset when the call leaves
  // the connecting state. Drives the "Calling..." → "Ringing..." label flip.
  const [outboundRingingConfirmed, setOutboundRingingConfirmed] = useState(false);
  const [missedCalls, setMissedCalls] = useState<
    Array<{
      callId: string;
      customerNumber: string;
      customerName: string | null;
      timestamp: number;
    }>
  >([]);
  const { socket, isConnected } = useSocket();
  const queryClient = useQueryClient();

  // Safety-net timer that fires if a call rings beyond MAX_RING_MS without
  // any server-side resolution (ANSWERED, REJECTED, ENDED, MISSED). Stored
  // in a ref keyed by callId so a second concurrent inbound call doesn't
  // clobber the first's timer.
  const ringTimeoutRef = useRef<{ callId: string; handle: ReturnType<typeof setTimeout> } | null>(
    null
  );
  const clearRingTimeout = useCallback(() => {
    if (ringTimeoutRef.current) {
      clearTimeout(ringTimeoutRef.current.handle);
      ringTimeoutRef.current = null;
    }
  }, []);
  // Cleanup on unmount — prevents stray timer firing after the provider
  // is gone (would leak setState into a dead component).
  useEffect(() => () => clearRingTimeout(), [clearRingTimeout]);

  // Subscribe to WaCallManager state changes
  useEffect(() => {
    const unsubscribe = waCallManager.subscribe((newState) => {
      setState(newState);
    });
    return unsubscribe;
  }, []);

  // Outbound ringback tone: locally-generated US-standard 440+480Hz, 2s on /
  // 4s off. Meta does NOT send early-media RTP for business-initiated calls
  // (per the Cloud Calling API spec) — the calling client is responsible for
  // its own ringback, same as any softphone. Without this the agent hears
  // silence between pressing Call and the customer picking up.
  //
  // Lifecycle: start as soon as the call enters `connecting` with outbound
  // direction (we begin ringing the moment the request goes to Meta —
  // earlier than Meta's RINGING webhook, so the agent never hears silence);
  // stop on transition to `active` (customer picked up) or `ended`. Also
  // reset the "Meta confirmed ringing" flag whenever we leave connecting,
  // so a subsequent fresh outbound call starts at "Calling..." again.
  useEffect(() => {
    const isOutboundConnecting =
      state.direction === 'outbound' &&
      (state.status === 'connecting' || state.status === 'incoming');
    if (isOutboundConnecting) {
      playWaRingback();
    } else {
      stopWaRingback();
      if (outboundRingingConfirmed) setOutboundRingingConfirmed(false);
    }
  }, [state.status, state.direction, outboundRingingConfirmed]);

  // Belt-and-braces: stop ringback when the provider unmounts (route
  // change, logout, hot reload) so the tone can't outlive the call UI.
  useEffect(() => () => stopWaRingback(), []);

  // Refresh call history + storage quota after recording upload completes
  useEffect(() => {
    waCallManager.setOnRecordingUploaded(() => {
      queryClient.invalidateQueries({ queryKey: ['wa-calls'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['recordings'], refetchType: 'all' });
    });
    return () => waCallManager.setOnRecordingUploaded(null);
  }, [queryClient]);

  // Subscribe to WebSocket events globally
  useEffect(() => {
    if (!socket || !isConnected) return;

    const invalidateCallHistory = () => {
      // Small delay to ensure DB write is committed before refetch
      setTimeout(() => {
        // WA call history page
        queryClient.invalidateQueries({ queryKey: ['wa-calls'], refetchType: 'all' });
        // Admin analytics — force refetch even if staleTime hasn't expired
        queryClient.invalidateQueries({ queryKey: ['admin', 'analytics'], refetchType: 'all' });
      }, 500);
    };

    const onIncoming = (data: WaCallIncomingEvent) => {
      // Meta sends MULTIPLE webhooks for the same inbound call:
      //   1. 'ringing'  — no SDP yet
      //   2. 'connect'  — SDP offer present
      // Backend forwards both as WA_CALL_INCOMING. Meta may also retry
      // the webhook for ack-perceived failures. So this handler runs
      // once or more per call, sometimes AFTER the user has already
      // clicked Answer.
      //
      // Without idempotency: each fire calls handleIncomingCall which
      // setState({ status: 'incoming', ... }) → if a second event lands
      // after the user clicks Answer (status: 'connecting'), it
      // overwrites the progress and the UI gets stuck on Incoming
      // forever even though the customer side has bridged audio.
      //
      // Defensive: only reset state to 'incoming' if this is a NEW call
      // (different callId) or we're starting from idle. For the same-
      // callId case, just update incomingEvent so the SDP from the
      // later 'connect' event becomes available to the Answer button.
      const currentState = waCallManager.getState();
      const isSameCall = currentState.callId === data.callId;
      const isPastIncoming =
        currentState.status === 'connecting' ||
        currentState.status === 'active' ||
        currentState.status === 'ending';

      if (isSameCall && isPastIncoming) {
        // Same call already past the ringing phase — agent has answered
        // (or is in the middle of answering). Skip ringtone, browser
        // notification, and state reset. Refresh the cached event so
        // anything still listening (rare, but harmless) sees the
        // freshest payload. Always overwrite — latest webhook is the
        // most authoritative source.
        if (data.sdpOffer) {
          setIncomingEvent(data);
        }
        return;
      }

      setIncomingEvent(data);
      waCallManager.handleIncomingCall(data);
      playWaRingtone();
      notifyWaIncoming(data.customerNumber, data.customerName);
      invalidateCallHistory();

      // Arm safety-net timer — see MAX_RING_MS comment. Cancel any prior
      // timer first (e.g. retried INCOMING webhook for the same call).
      clearRingTimeout();
      const armedCallId = data.callId;
      ringTimeoutRef.current = {
        callId: armedCallId,
        handle: setTimeout(() => {
          const cur = waCallManager.getState();
          // Only fire if we're STILL ringing for THIS exact call. Anything
          // else means the normal flow already resolved it.
          if (cur.callId !== armedCallId || cur.status !== 'incoming') return;
          console.warn('[WaCallProvider] Ring timeout — tearing down stuck ringing UI', {
            callId: armedCallId,
          });
          stopWaRingtone();
          waCallManager.handleCallEnded({
            callId: armedCallId,
            reason: 'ring_timeout',
            durationSecs: 0,
          });
          setIncomingEvent(null);
          ringTimeoutRef.current = null;
        }, MAX_RING_MS),
      };
    };

    const onEnded = (data: WaCallEndedEvent) => {
      // Real resolution arrived — kill the safety timer if it was for
      // this call (no-op otherwise).
      if (ringTimeoutRef.current?.callId === data.callId) clearRingTimeout();

      const currentState = waCallManager.getState();

      // If the call was still ringing (user never answered), treat as missed
      if (currentState.status === 'incoming') {
        stopWaRingtone();
        const customerNumber = currentState.customerNumber || '';
        const customerName = currentState.customerName || null;

        setMissedCalls((prev) => [
          { callId: data.callId, customerNumber, customerName, timestamp: Date.now() },
          ...prev.slice(0, 19),
        ]);
        notifyWaMissedCall(customerNumber, customerName);

        waCallManager.handleCallEnded(data);
        setIncomingEvent(null);
        invalidateCallHistory();
        return;
      }

      stopWaRingtone();
      waCallManager.handleCallEnded(data);
      setIncomingEvent(null);
      invalidateCallHistory();
    };

    const onMissed = (data: {
      callId?: string;
      customerNumber?: string;
      customerName?: string;
    }) => {
      if (data?.callId && ringTimeoutRef.current?.callId === data.callId) clearRingTimeout();

      stopWaRingtone();
      const currentCallId = waCallManager.getState().callId;
      waCallManager.handleCallEnded({
        callId: data?.callId || currentCallId || '',
        reason: 'missed',
        durationSecs: 0,
      });
      setIncomingEvent(null);
      invalidateCallHistory();

      setMissedCalls((prev) => [
        {
          callId: data?.callId || '',
          customerNumber: data?.customerNumber || '',
          customerName: data?.customerName || null,
          timestamp: Date.now(),
        },
        ...prev.slice(0, 19),
      ]);
      notifyWaMissedCall(data?.customerNumber || '', data?.customerName);
    };

    /**
     * Same user, different device answered the call. Stop ringing here.
     *
     * `emitToUser` on the server fans out to every socket the user has —
     * including the answering tab's socket. The defensive logic inside
     * `waCallManager.handleAnsweredElsewhere` ignores the event for any
     * status past 'incoming', so the answering tab safely no-ops.
     *
     * Distinct from 'missed' — the user DID answer (just elsewhere), so we
     * don't show a missed-call notification or push a missed-call entry.
     */
    const onAnswered = (data: { callId: string; answeredByUserId?: number }) => {
      if (!data?.callId) return;
      if (ringTimeoutRef.current?.callId === data.callId) clearRingTimeout();

      const cur = waCallManager.getState();
      if (cur.callId !== data.callId) return;
      if (cur.status !== 'incoming') return; // already past — no-op

      stopWaRingtone();
      waCallManager.handleAnsweredElsewhere(data.callId);
      setIncomingEvent(null);
      invalidateCallHistory();
    };

    /**
     * Same user, different device rejected the call. Stop ringing here
     * WITHOUT logging a missed-call entry (the user actively rejected,
     * just from a different device).
     */
    const onRejected = (data: { callId: string; rejectedByUserId?: number }) => {
      if (!data?.callId) return;
      if (ringTimeoutRef.current?.callId === data.callId) clearRingTimeout();

      const cur = waCallManager.getState();
      if (cur.callId !== data.callId) return;
      if (cur.status !== 'incoming') return; // already past — no-op

      stopWaRingtone();
      waCallManager.handleRejectedElsewhere(data.callId);
      setIncomingEvent(null);
      invalidateCallHistory();
    };

    const onSdpAnswer = (data: WaCallSdpAnswerEvent) => {
      waCallManager.handleSdpAnswer(data);
    };

    const onPermissionGranted = (data: WaCallPermissionEvent) => {
      setPermissionEvent({ ...data, status: 'accepted' });
    };

    const onPermissionRejected = (data: WaCallPermissionEvent) => {
      setPermissionEvent({ ...data, status: 'rejected' });
    };

    // Outbound only: Meta has confirmed the customer's phone is ringing.
    // We don't change call state here — the manager is already in
    // `connecting` from `initiateCall`, and the ringback effect above
    // started the tone the moment we entered that state. This handler
    // just flips a flag so the floating panel's label can refine from
    // "Calling..." to "Ringing...".
    const onOutboundRinging = (data: { callId: string }) => {
      const cur = waCallManager.getState();
      if (cur.callId !== data.callId) return;
      if (cur.direction !== 'outbound') return;
      if (cur.status !== 'connecting') return;
      setOutboundRingingConfirmed(true);
    };

    // Outbound: customer accepted → "Ringing…"/"Calling…" becomes "Connected".
    const onOutboundAnswered = (data: { callId: string }) => {
      waCallManager.handleOutboundAnswered(data.callId);
    };

    socket.on(WS_EVENTS.INCOMING, onIncoming);
    socket.on(WS_EVENTS.OUTBOUND_RINGING, onOutboundRinging);
    socket.on(WS_EVENTS.OUTBOUND_ANSWERED, onOutboundAnswered);
    socket.on(WS_EVENTS.ANSWERED, onAnswered);
    socket.on(WS_EVENTS.REJECTED, onRejected);
    socket.on(WS_EVENTS.ENDED, onEnded);
    socket.on(WS_EVENTS.MISSED, onMissed);
    socket.on(WS_EVENTS.SDP_ANSWER, onSdpAnswer);
    socket.on(WS_EVENTS.PERMISSION_GRANTED, onPermissionGranted);
    socket.on(WS_EVENTS.PERMISSION_REJECTED, onPermissionRejected);

    return () => {
      socket.off(WS_EVENTS.INCOMING, onIncoming);
      socket.off(WS_EVENTS.OUTBOUND_RINGING, onOutboundRinging);
      socket.off(WS_EVENTS.OUTBOUND_ANSWERED, onOutboundAnswered);
      socket.off(WS_EVENTS.ANSWERED, onAnswered);
      socket.off(WS_EVENTS.REJECTED, onRejected);
      socket.off(WS_EVENTS.ENDED, onEnded);
      socket.off(WS_EVENTS.MISSED, onMissed);
      socket.off(WS_EVENTS.SDP_ANSWER, onSdpAnswer);
      socket.off(WS_EVENTS.PERMISSION_GRANTED, onPermissionGranted);
      socket.off(WS_EVENTS.PERMISSION_REJECTED, onPermissionRejected);
    };
  }, [socket, isConnected, queryClient, clearRingTimeout]);

  const answerCall = useCallback(
    async (sdpOffer: string, callId?: string) => {
      // Local pickup — server-side WA_CALL_ANSWERED broadcast will arrive
      // shortly and harmlessly no-op (status is no longer 'incoming' by
      // then). Cancel the safety timer here directly so it can't fire
      // during the connecting handshake.
      clearRingTimeout();
      stopWaRingtone();
      await waCallManager.answerCall(sdpOffer, callId);
    },
    [clearRingTimeout]
  );

  const rejectCall = useCallback(async () => {
    clearRingTimeout();
    stopWaRingtone();
    await waCallManager.rejectCall();
    setIncomingEvent(null);
  }, [clearRingTimeout]);

  const endCall = useCallback(async () => {
    await waCallManager.endCall();
  }, []);

  const toggleMute = useCallback(() => {
    waCallManager.toggleMute();
  }, []);

  const startRecording = useCallback(() => {
    waCallManager.startRecording();
  }, []);

  const requestPermission = useCallback(async (phoneNumberId: string, customerNumber: string) => {
    setIsRequestingPermission(true);
    try {
      const result = await waCallService.requestPermission(
        phoneNumberId || undefined,
        customerNumber
      );
      // Already-granted permission comes back accepted; a fresh request is pending.
      if (result?.status === 'accepted') {
        toast.success('Call permission already granted — you can call now.');
      } else {
        toast.success('Call request sent. Waiting for the customer to allow calls.');
      }
    } catch (err) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        (err instanceof Error ? err.message : 'Failed to send the call request.');
      toast.error(msg);
    } finally {
      setIsRequestingPermission(false);
    }
  }, []);

  const initiateCall = useCallback(
    async (phoneNumberId: string, customerNumber: string, customerName?: string) => {
      await waCallManager.initiateCall(phoneNumberId, customerNumber, customerName);
    },
    []
  );

  const clearMissedCalls = useCallback(() => {
    setMissedCalls([]);
  }, []);

  const value: WaCallContextValue = {
    state,
    answerCall,
    rejectCall,
    endCall,
    toggleMute,
    startRecording,
    requestPermission,
    initiateCall,
    isRequestingPermission,
    incomingEvent,
    permissionEvent,
    outboundRingingConfirmed,
    missedCalls,
    clearMissedCalls,
  };

  return <WaCallContext.Provider value={value}>{children}</WaCallContext.Provider>;
}
