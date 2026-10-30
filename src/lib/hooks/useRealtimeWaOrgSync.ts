'use client';

/**
 * Real-time cache sync for the WA-org management surface.
 *
 * Mounted inside <WaAgentGroupsManager /> and <OrgWaNumbersManager /> so
 * the listeners run on the routes that actually display this data
 * (`/org/whatsapp/groups`, `/org/whatsapp/numbers`,
 *  `/admin/whatsapp/groups`, `/admin/whatsapp/numbers`).
 *
 * Why a focused hook (vs. the global `useRealtimeCacheSync`):
 * the global hook is mounted under `/phone` only. This one runs only
 * while a manager is on a WA-org page — same SSOT pattern, narrower
 * scope, no wasted subscriptions on routes that don't render this data.
 *
 * Cache reconciliation strategy (no polling):
 * - WA_GROUP_UPDATED / WA_GROUP_DELETED   → groups + numbers + (specific group)
 * - WA_NUMBER_ASSIGNMENT_CHANGED          → numbers + groups (numberIds shift)
 * - reconnect                             → full waOrgKeys.all (recover from a
 *                                           brief disconnect that may have
 *                                           dropped events)
 *
 * @module lib/hooks/useRealtimeWaOrgSync
 */

import { useCallback, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSocket } from '@/lib/providers/SocketProvider';
import { REALTIME_EVENTS } from '@/lib/constants/events';
import { waOrgKeys } from './useWaOrg';

export function useRealtimeWaOrgSync() {
  const { socket, isConnected } = useSocket();
  const queryClient = useQueryClient();

  const handleGroupEvent = useCallback(
    (payload?: { groupId?: number }) => {
      queryClient.invalidateQueries({ queryKey: waOrgKeys.groups });
      queryClient.invalidateQueries({ queryKey: waOrgKeys.numbers });
      if (payload?.groupId !== undefined) {
        queryClient.invalidateQueries({ queryKey: waOrgKeys.group(payload.groupId) });
      }
    },
    [queryClient]
  );

  const handleNumberAssignmentChanged = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: waOrgKeys.numbers });
    queryClient.invalidateQueries({ queryKey: waOrgKeys.groups });
  }, [queryClient]);

  const handleReconnect = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: waOrgKeys.all });
  }, [queryClient]);

  useEffect(() => {
    if (!socket || !isConnected) return;

    socket.on(REALTIME_EVENTS.WA_GROUP_UPDATED, handleGroupEvent);
    socket.on(REALTIME_EVENTS.WA_GROUP_DELETED, handleGroupEvent);
    socket.on(REALTIME_EVENTS.WA_NUMBER_ASSIGNMENT_CHANGED, handleNumberAssignmentChanged);
    // Socket.IO v4: `reconnect` fires on the Manager (socket.io), not the Socket.
    socket.io.on('reconnect', handleReconnect);

    return () => {
      socket.off(REALTIME_EVENTS.WA_GROUP_UPDATED, handleGroupEvent);
      socket.off(REALTIME_EVENTS.WA_GROUP_DELETED, handleGroupEvent);
      socket.off(REALTIME_EVENTS.WA_NUMBER_ASSIGNMENT_CHANGED, handleNumberAssignmentChanged);
      socket.io.off('reconnect', handleReconnect);
    };
  }, [socket, isConnected, handleGroupEvent, handleNumberAssignmentChanged, handleReconnect]);
}
