'use client';

/**
 * Real-time support sync (USER side).
 *
 * Keeps the /phone/support chat live: appends admin replies to the thread cache
 * and refreshes the ticket on claim/close. Surgical cache updates (no broad
 * invalidation of the thread) so scroll/state is preserved.
 *
 * @module lib/hooks/useRealtimeSupportSync
 */

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSocket } from '@/lib/providers/SocketProvider';
import { REALTIME_EVENTS } from '@/lib/constants/events';
import { supportKeys } from './useSupport';
import type {
  SupportMessage,
  SupportTicket,
  PaginatedMessages,
} from '@/lib/api/services/support.api';

interface MsgPayload {
  ticket: SupportTicket;
  message: SupportMessage;
}

export function useRealtimeSupportSync() {
  const { socket, isConnected } = useSocket();
  const qc = useQueryClient();

  useEffect(() => {
    if (!socket || !isConnected) return;

    const onMessage = (p: MsgPayload) => {
      if (!p?.message?.id || !p?.ticket?.id) return;
      qc.setQueriesData<PaginatedMessages>(
        { queryKey: supportKeys.myMessages(p.ticket.id), exact: false },
        (old) => {
          if (!old?.items) return old;
          if (old.items.some((m) => m.id === p.message.id)) return old;
          return { ...old, items: [...old.items, p.message], total: old.total + 1 };
        }
      );
      qc.invalidateQueries({ queryKey: supportKeys.myTicket() });
    };

    const onTicketState = () => qc.invalidateQueries({ queryKey: supportKeys.myTicket() });

    socket.on(REALTIME_EVENTS.SUPPORT_MESSAGE, onMessage);
    socket.on(REALTIME_EVENTS.SUPPORT_CLAIMED, onTicketState);
    socket.on(REALTIME_EVENTS.SUPPORT_CLOSED, onTicketState);
    return () => {
      socket.off(REALTIME_EVENTS.SUPPORT_MESSAGE, onMessage);
      socket.off(REALTIME_EVENTS.SUPPORT_CLAIMED, onTicketState);
      socket.off(REALTIME_EVENTS.SUPPORT_CLOSED, onTicketState);
    };
  }, [socket, isConnected, qc]);
}
