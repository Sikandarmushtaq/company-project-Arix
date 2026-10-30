'use client';

/**
 * useLiveKitInboundSync — bridges the server's LiveKit inbound signal to the
 * call engine (Phase 3d).
 *
 * LiveKit inbound has no SIP INVITE, so the ring is socket-driven: when the PSTN
 * caller joins the per-call room, the backend pushes `LIVEKIT_INCOMING` to the
 * target agent's extension room. This hook forwards that to `livekitManager`,
 * which emits an `incomingCall` event → the existing IncomingCallModal rings
 * (full UI reuse). `LIVEKIT_CALL_ENDED` clears the ring if the caller gives up.
 *
 * Only acts when LiveKit is the active engine — a SIP-mode user's router isn't
 * subscribed to livekitManager anyway, so this is a defensive early-out.
 *
 * @module lib/hooks/useLiveKitInboundSync
 */

import { useEffect } from 'react';
import { useSocket } from '@/lib/providers/SocketProvider';
import { REALTIME_EVENTS } from '@/lib/constants/events';
import { livekitManager } from '@/lib/livekit/livekit-manager';
import { callEngine } from '@/lib/call/call-engine';

interface LiveKitInboundPayload {
  room: string;
  caller: string;
  callee: string;
}

export function useLiveKitInboundSync(): void {
  const { socket, isConnected } = useSocket();

  useEffect(() => {
    if (!socket || !isConnected) return;

    // DIAGNOSTIC (temporary, local-dev)
    console.log('[LK-INBOUND] hook active — listening, engine=', callEngine.activeEngine);

    const onIncoming = (payload: LiveKitInboundPayload) => {
      console.log('[LK-INBOUND] GOT livekit:incoming', payload, 'engine=', callEngine.activeEngine);
      if (callEngine.activeEngine !== 'livekit') {
        console.warn('[LK-INBOUND] skipped — engine is not livekit');
        return;
      }
      if (payload?.room) {
        console.log('[LK-INBOUND] -> handleInboundRoom', payload.room);
        livekitManager.handleInboundRoom(payload.room, payload.caller || '');
      }
    };

    const onEnded = (payload: LiveKitInboundPayload) => {
      if (callEngine.activeEngine !== 'livekit') return;
      if (payload?.room) {
        livekitManager.handleInboundEnded(payload.room);
      }
    };

    // Multi-device: one of the agent's devices answered — the others stop ringing.
    // The device that answered ignores its own event (deviceId match, inside the manager).
    const onAnsweredElsewhere = (payload: LiveKitInboundPayload & { deviceId?: string }) => {
      if (callEngine.activeEngine !== 'livekit') return;
      if (payload?.room) {
        livekitManager.handleAnsweredElsewhere(payload.room, payload.deviceId);
      }
    };

    socket.on(REALTIME_EVENTS.LIVEKIT_INCOMING, onIncoming);
    socket.on(REALTIME_EVENTS.LIVEKIT_CALL_ENDED, onEnded);
    socket.on(REALTIME_EVENTS.LIVEKIT_ANSWERED_ELSEWHERE, onAnsweredElsewhere);

    return () => {
      socket.off(REALTIME_EVENTS.LIVEKIT_INCOMING, onIncoming);
      socket.off(REALTIME_EVENTS.LIVEKIT_CALL_ENDED, onEnded);
      socket.off(REALTIME_EVENTS.LIVEKIT_ANSWERED_ELSEWHERE, onAnsweredElsewhere);
    };
  }, [socket, isConnected]);
}
