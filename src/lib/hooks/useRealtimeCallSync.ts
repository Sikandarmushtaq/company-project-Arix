'use client';

/**
 * Real-time Call Sync Hook
 *
 * Handles all call-related Socket.IO events:
 * - CALL_INCOMING, CALL_STARTED, CALL_UPDATED, CALL_ENDED, CALL_MISSED
 * - CALL_ANSWERED_ELSEWHERE (multi-device)
 *
 * @module lib/hooks/useRealtimeCallSync
 */

import { useEffect, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSocket } from '@/lib/providers/SocketProvider';
import { REALTIME_EVENTS } from '@/lib/constants/events';
import { callsKeys } from './useCalls';
import { userSettingsKeys } from './useUserSettings';
import { recordingsKeys } from './useRecordings';
import type { DndStatus } from '@/lib/api';
import {
  notifyIncomingCall,
  notifyMissedCall,
  stopIncomingCallNotification,
  clearFaviconBadge,
} from '@/lib/utils/notifications';
import { callAudioService } from '@/lib/sip/call-audio-service';
import { useSipStore } from '@/lib/stores/sip';
import { toast } from '@/lib/stores/toast';
import type { CallEventPayload, CallAnsweredElsewherePayload } from './useRealtimeSync.types';
import { DEDUPE_WINDOW_MS, MAX_DEDUPE_CACHE_SIZE, cleanupDedupeMap } from './useRealtimeSync.types';

/** Max one call-history refetch per this window, per client (burst coalescing). */
const CALLS_INVALIDATE_THROTTLE_MS = 1500;

/**
 * Hook to sync call-related React Query cache with Socket.IO events
 */
export function useRealtimeCallSync() {
  const { socket, isConnected } = useSocket();
  const queryClient = useQueryClient();

  // Dedupe call events within a short window (prevents multi-device duplicate notifications)
  const recentCallIds = useRef<Map<number, number>>(new Map());

  const isDuplicateCall = useCallback((id: number): boolean => {
    const now = Date.now();
    const lastSeen = recentCallIds.current.get(id);

    if (lastSeen && now - lastSeen < DEDUPE_WINDOW_MS) {
      return true;
    }

    recentCallIds.current.set(id, now);

    // LRU-like cleanup to prevent unbounded growth
    cleanupDedupeMap(recentCallIds.current, MAX_DEDUPE_CACHE_SIZE);

    return false;
  }, []);

  // Throttle call-history cache invalidation. A single call fires ~5 events
  // (incoming/started/updated/ended/missed), and org broadcasts multiply that
  // across every connected agent — invalidating on each one hammered the
  // backend's call-history query and pinned MySQL. This coalesces a burst into
  // at most one refetch per window (leading edge fires immediately so the UI
  // still feels live; a trailing flush catches events that arrived during the
  // window). Notifications are NOT throttled — only the refetch.
  const callsThrottle = useRef<{ timer: ReturnType<typeof setTimeout> | null; pending: boolean }>({
    timer: null,
    pending: false,
  });

  const invalidateCalls = useCallback(() => {
    const s = callsThrottle.current;
    if (s.timer) {
      // Inside the cooldown window — remember that more happened, flush at the end.
      s.pending = true;
      return;
    }
    // Leading edge: refresh now, then open a cooldown window.
    queryClient.invalidateQueries({ queryKey: callsKeys.all });
    s.pending = false;
    const flush = () => {
      const st = callsThrottle.current;
      if (st.pending) {
        queryClient.invalidateQueries({ queryKey: callsKeys.all });
        st.pending = false;
        st.timer = setTimeout(flush, CALLS_INVALIDATE_THROTTLE_MS);
      } else {
        st.timer = null;
      }
    };
    s.timer = setTimeout(flush, CALLS_INVALIDATE_THROTTLE_MS);
  }, [queryClient]);

  // Clear the throttle timer on unmount.
  useEffect(() => {
    const s = callsThrottle.current;
    return () => {
      if (s.timer) clearTimeout(s.timer);
      s.timer = null;
      s.pending = false;
    };
  }, []);

  // === CALL HANDLERS ===
  const handleCallIncoming = useCallback(
    (call: CallEventPayload) => {
      if (!call?.id) return;
      // Dedupe call notifications (prevents duplicate notifications on multi-device setups)
      if (isDuplicateCall(call.id)) {
        console.log('[RealtimeSync] Duplicate call incoming event ignored:', call.id);
        return;
      }
      // Check DND status from cache — SIP manager already rejects the INVITE,
      // but we also suppress the browser notification here as defense-in-depth
      const dndStatus = queryClient.getQueryData<DndStatus>(userSettingsKeys.dnd());
      if (dndStatus?.enabled) {
        console.log('[RealtimeSync] DND active, suppressing incoming call notification:', call.id);
        invalidateCalls();
        return;
      }

      // For incoming calls, the caller is who's calling us
      const phoneNumber = call.caller || 'Unknown';
      notifyIncomingCall(phoneNumber, call.contactName || null);
      invalidateCalls();
    },
    [queryClient, isDuplicateCall, invalidateCalls]
  );

  const handleCallStarted = useCallback(
    (call: CallEventPayload) => {
      if (!call?.id) return;
      invalidateCalls();
    },
    [invalidateCalls]
  );

  const handleCallUpdated = useCallback(
    (call: CallEventPayload) => {
      if (!call?.id) return;
      invalidateCalls();
    },
    [invalidateCalls]
  );

  const handleCallEnded = useCallback(
    (call: CallEventPayload) => {
      console.log('[RealtimeSync] CALL_ENDED received:', call);
      if (!call?.id) return;
      invalidateCalls();

      // When a call ends, a new recording may be available
      // Invalidate recordings after a delay to allow FusionPBX CDR to be written
      // FusionPBX writes CDR asynchronously, 5 seconds gives enough time
      setTimeout(() => {
        console.log('[RealtimeSync] Invalidating recordings after CALL_ENDED');
        queryClient.invalidateQueries({ queryKey: recordingsKeys.all });
        // Also force refetch all recordings queries
        queryClient.refetchQueries({ queryKey: recordingsKeys.all, type: 'active' });
      }, 5000);
    },
    [queryClient, invalidateCalls]
  );

  const handleCallMissed = useCallback(
    (call: CallEventPayload) => {
      if (!call?.id) return;
      const phoneNumber = call.caller || 'Unknown';

      // DND-rejected calls: show a subtle DND toast instead of a missed-call notification
      if (call.status === 'dnd' || call.reasonText === 'dnd') {
        toast.info(`Call from ${call.contactName || phoneNumber} rejected — Do Not Disturb`);
      } else {
        // Regular missed call notification
        notifyMissedCall(phoneNumber, call.contactName || null);
      }

      invalidateCalls();
    },
    [invalidateCalls]
  );

  // Org storage cap reached — recordings/voicemail are being dropped. The
  // server throttles this (once per org per 5 min), so a plain toast is fine.
  const handleStorageFull = useCallback((data: { message?: string } | undefined) => {
    toast.warning(
      data?.message ||
        'Storage full — new recordings and voicemails are not being saved. Free space or upgrade.'
    );
  }, []);

  /**
   * Handle call answered on another device
   * This clears the incoming call UI, stops ringtone, and clears notifications
   * on all devices except the one that answered the call.
   *
   * Note: The SIP server will send a CANCEL to other devices, which will
   * clean up the SIP session. This handler just clears the UI notifications.
   */
  const handleCallAnsweredElsewhere = useCallback((data: CallAnsweredElsewherePayload) => {
    if (!data?.sipCallId) return;

    // Get current SIP store state
    const sipState = useSipStore.getState();

    // Check if we have a ringing call with matching sipCallId
    // This means this device still has the call ringing (wasn't the one that answered)
    const ringingLine = sipState.lines.find(
      (line) => line.sipCallId === data.sipCallId && line.state === 'ringing'
    );

    // Only process if we have a matching ringing call
    // The device that answered will have state 'established', not 'ringing'
    if (ringingLine) {
      console.log('[RealtimeSync] Call answered on another device, clearing notifications', {
        sipCallId: data.sipCallId,
        callId: data.callId,
        lineId: ringingLine.id,
      });

      // Stop ringtone immediately
      callAudioService.stopRingtone();

      // Stop title flashing and clear favicon badge
      stopIncomingCallNotification();
      clearFaviconBadge();

      // Clear incoming call from SIP store
      sipState.clearIncomingCall();

      // Note: Don't manually remove the line from lines array here.
      // The SIP server will send a CANCEL/BYE which the SIP manager handles,
      // and that will properly clean up the session and emit callEnded event.
    }
  }, []);

  // Register event listeners
  useEffect(() => {
    if (!socket || !isConnected) return;

    socket.on(REALTIME_EVENTS.CALL_INCOMING, handleCallIncoming);
    socket.on(REALTIME_EVENTS.CALL_STARTED, handleCallStarted);
    socket.on(REALTIME_EVENTS.CALL_UPDATED, handleCallUpdated);
    socket.on(REALTIME_EVENTS.CALL_ENDED, handleCallEnded);
    socket.on(REALTIME_EVENTS.CALL_MISSED, handleCallMissed);
    socket.on(REALTIME_EVENTS.CALL_ANSWERED_ELSEWHERE, handleCallAnsweredElsewhere);
    socket.on(REALTIME_EVENTS.STORAGE_FULL, handleStorageFull);

    return () => {
      socket.off(REALTIME_EVENTS.CALL_INCOMING, handleCallIncoming);
      socket.off(REALTIME_EVENTS.CALL_STARTED, handleCallStarted);
      socket.off(REALTIME_EVENTS.CALL_UPDATED, handleCallUpdated);
      socket.off(REALTIME_EVENTS.CALL_ENDED, handleCallEnded);
      socket.off(REALTIME_EVENTS.CALL_MISSED, handleCallMissed);
      socket.off(REALTIME_EVENTS.CALL_ANSWERED_ELSEWHERE, handleCallAnsweredElsewhere);
      socket.off(REALTIME_EVENTS.STORAGE_FULL, handleStorageFull);
    };
  }, [
    socket,
    isConnected,
    handleCallIncoming,
    handleCallStarted,
    handleCallUpdated,
    handleCallEnded,
    handleCallMissed,
    handleCallAnsweredElsewhere,
    handleStorageFull,
  ]);
}
