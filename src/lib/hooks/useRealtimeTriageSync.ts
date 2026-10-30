'use client';

/**
 * Realtime sync for the Triage badge + toast.
 *
 * Mounted at the /admin and /org layout level so managers see the badge
 * grow + a toast pop the moment a new triage customer arrives — no
 * polling, no manual refresh.
 *
 * Why a focused hook (not folded into useRealtimeCacheSync):
 *  - useRealtimeCacheSync runs only under /phone. Managers don't go
 *    through /phone, so the triage handler there would never fire for
 *    them. This hook fires wherever it's mounted.
 *  - Single concern: triage arrival. The customer-list cache-invalidate
 *    handlers already live elsewhere; we only add the user-visible
 *    notification here.
 *
 * @module lib/hooks/useRealtimeTriageSync
 */

import { useCallback, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSocket } from '@/lib/providers/SocketProvider';
import { REALTIME_EVENTS } from '@/lib/constants/events';
import { useTriageBadgeStore } from '@/lib/stores/triageBadge';
import { customersKeys } from './useCustomers';
import { toast } from '@/lib/stores/toast';

export function useRealtimeTriageSync() {
  const { socket, isConnected } = useSocket();
  const queryClient = useQueryClient();

  const handleTriageArrived = useCallback(
    (payload?: { customerId?: number; phone?: string }) => {
      // Cache: refresh the customer list so the new entry appears.
      queryClient.invalidateQueries({ queryKey: customersKeys.all });

      const store = useTriageBadgeStore.getState();
      const isViewing = store.viewingTriageTab;

      // When the manager is already looking at the Triage tab, the row
      // appears in their list via cache invalidation. Skip the badge
      // bump AND the toast — both would be redundant noise.
      if (isViewing) return;

      store.increment();

      const lastFour = payload?.phone ? payload.phone.slice(-4) : '';
      toast.info(lastFour ? `New customer in triage (••••${lastFour})` : 'New customer in triage', {
        duration: 4500,
      });
    },
    [queryClient]
  );

  useEffect(() => {
    if (!socket || !isConnected) return;
    socket.on(REALTIME_EVENTS.CUSTOMER_TRIAGE_ARRIVED, handleTriageArrived);
    return () => {
      socket.off(REALTIME_EVENTS.CUSTOMER_TRIAGE_ARRIVED, handleTriageArrived);
    };
  }, [socket, isConnected, handleTriageArrived]);
}
