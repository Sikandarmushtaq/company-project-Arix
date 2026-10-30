'use client';

/**
 * useWaCall — React hook for WhatsApp call state + actions.
 *
 * Subscribes to WaCallManager state changes + WebSocket events.
 * Provides a reactive interface for UI components.
 *
 * @module lib/hooks/useWaCall
 */

import { useCallback, useEffect, useState } from 'react';
import { useSocket } from '@/lib/providers/SocketProvider';
import { waCallManager } from '@/lib/whatsapp-call/WaCallManager';
import { emptyWaCallState } from '@/lib/whatsapp-call/types';
import { waCallService } from '@/lib/api/services/waCall.service';
import type {
  WaCallState,
  WaCallIncomingEvent,
  WaCallEndedEvent,
  WaCallSdpAnswerEvent,
  WaCallPermissionEvent,
} from '@/lib/whatsapp-call/types';

// WebSocket event names (mirror REALTIME_EVENTS on server)
const WS_EVENTS = {
  INCOMING: 'wa:call_incoming',
  ANSWERED: 'wa:call_answered',
  REJECTED: 'wa:call_rejected',
  ENDED: 'wa:call_ended',
  MISSED: 'wa:call_missed',
  SDP_ANSWER: 'wa:call_sdp_answer',
  PERMISSION_GRANTED: 'wa:call_permission_granted',
  PERMISSION_REJECTED: 'wa:call_permission_rejected',
} as const;

export interface UseWaCallReturn {
  /** Current call state */
  state: WaCallState;
  /** Answer incoming call (with SDP offer from the incoming event) */
  answerCall: (sdpOffer: string) => Promise<void>;
  /** Reject incoming call */
  rejectCall: () => Promise<void>;
  /** End active call */
  endCall: () => Promise<void>;
  /** Toggle mute */
  toggleMute: () => void;
  /** Start recording */
  startRecording: () => void;
  /** Request outbound call permission from customer */
  requestPermission: (phoneNumberId: string, customerNumber: string) => Promise<void>;
  /** Initiate outbound call (requires prior permission) */
  initiateCall: (
    phoneNumberId: string,
    customerNumber: string,
    customerName?: string
  ) => Promise<void>;
  /** Whether a permission request is in flight */
  isRequestingPermission: boolean;
  /** Latest incoming call event (for the modal to read SDP) */
  incomingEvent: WaCallIncomingEvent | null;
  /** Latest permission event */
  permissionEvent: WaCallPermissionEvent | null;
}

export function useWaCall(): UseWaCallReturn {
  const [state, setState] = useState<WaCallState>(emptyWaCallState());
  const [incomingEvent, setIncomingEvent] = useState<WaCallIncomingEvent | null>(null);
  const [permissionEvent, setPermissionEvent] = useState<WaCallPermissionEvent | null>(null);
  const [isRequestingPermission, setIsRequestingPermission] = useState(false);
  const { socket, isConnected } = useSocket();

  // Subscribe to WaCallManager state changes
  useEffect(() => {
    const unsubscribe = waCallManager.subscribe((newState) => {
      setState(newState);
    });
    return unsubscribe;
  }, []);

  // Subscribe to WebSocket events
  useEffect(() => {
    if (!socket || !isConnected) return;

    const onIncoming = (data: WaCallIncomingEvent) => {
      setIncomingEvent(data);
      waCallManager.handleIncomingCall(data);
    };

    const onEnded = (data: WaCallEndedEvent) => {
      waCallManager.handleCallEnded(data);
      setIncomingEvent(null);
    };

    const onMissed = (data: { callId?: string }) => {
      const currentCallId = waCallManager.getState().callId;
      waCallManager.handleCallEnded({
        callId: data?.callId || currentCallId || '',
        reason: 'missed',
        durationSecs: 0,
      });
      setIncomingEvent(null);
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

    // Multi-device: another device (Android, second tab) answered/rejected.
    // Tear down the incoming UI here. See WaCallManager docs for state-aware
    // logic — these are safe no-ops when this device is the one acting.
    const onAnsweredElsewhere = (data: { callId: string }) => {
      if (!data?.callId) return;
      waCallManager.handleAnsweredElsewhere(data.callId);
      setIncomingEvent(null);
    };

    const onRejectedElsewhere = (data: { callId: string }) => {
      if (!data?.callId) return;
      waCallManager.handleRejectedElsewhere(data.callId);
      setIncomingEvent(null);
    };

    socket.on(WS_EVENTS.INCOMING, onIncoming);
    socket.on(WS_EVENTS.ANSWERED, onAnsweredElsewhere);
    socket.on(WS_EVENTS.REJECTED, onRejectedElsewhere);
    socket.on(WS_EVENTS.ENDED, onEnded);
    socket.on(WS_EVENTS.MISSED, onMissed);
    socket.on(WS_EVENTS.SDP_ANSWER, onSdpAnswer);
    socket.on(WS_EVENTS.PERMISSION_GRANTED, onPermissionGranted);
    socket.on(WS_EVENTS.PERMISSION_REJECTED, onPermissionRejected);

    return () => {
      socket.off(WS_EVENTS.INCOMING, onIncoming);
      socket.off(WS_EVENTS.ANSWERED, onAnsweredElsewhere);
      socket.off(WS_EVENTS.REJECTED, onRejectedElsewhere);
      socket.off(WS_EVENTS.ENDED, onEnded);
      socket.off(WS_EVENTS.MISSED, onMissed);
      socket.off(WS_EVENTS.SDP_ANSWER, onSdpAnswer);
      socket.off(WS_EVENTS.PERMISSION_GRANTED, onPermissionGranted);
      socket.off(WS_EVENTS.PERMISSION_REJECTED, onPermissionRejected);
    };
  }, [socket, isConnected]);

  const answerCall = useCallback(async (sdpOffer: string) => {
    await waCallManager.answerCall(sdpOffer);
  }, []);

  const rejectCall = useCallback(async () => {
    await waCallManager.rejectCall();
    setIncomingEvent(null);
  }, []);

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
      // phoneNumberId can be empty — backend auto-resolves from user's assigned WA number
      const result = await waCallService.requestPermission(
        phoneNumberId || undefined,
        customerNumber
      );
      // Store the resolved phoneNumberId from the server response
      if (result?.phoneNumberId) {
        setPermissionEvent(null); // Clear any stale event
      }
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

  return {
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
  };
}
