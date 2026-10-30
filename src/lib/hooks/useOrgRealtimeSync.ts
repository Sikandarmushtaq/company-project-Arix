'use client';

/**
 * Organization Portal Real-time Sync Hook
 *
 * Listens to org-scoped Socket.IO events and invalidates React Query caches.
 * Managers join `org:{orgId}` room on WebSocket connect, so all events
 * emitted via `wsServer.emitToOrganization()` are received here.
 *
 * @module lib/hooks/useOrgRealtimeSync
 */

import { useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSocket } from '@/lib/providers/SocketProvider';
import { REALTIME_EVENTS } from '@/lib/constants/events';
import { orgKeys } from './useOrg';

interface OrgUserEventPayload {
  organizationId: number;
  userId: number;
  fullName?: string;
  extension?: string;
  changes?: string[];
  passwordChanged?: boolean;
}

interface OrgNumberEventPayload {
  organizationId: number;
  numberId?: number;
  assignedUserId?: number | null;
  numberCount?: number;
}

export function useOrgRealtimeSync() {
  const { socket, isConnected } = useSocket();
  const queryClient = useQueryClient();

  const handleOrgUserCreated = useCallback(
    (_payload: OrgUserEventPayload) => {
      queryClient.invalidateQueries({ queryKey: ['org', 'users'] });
      queryClient.invalidateQueries({ queryKey: orgKeys.dashboard });
    },
    [queryClient]
  );

  const handleOrgUserUpdated = useCallback(
    (_payload: OrgUserEventPayload) => {
      queryClient.invalidateQueries({ queryKey: ['org', 'users'] });
    },
    [queryClient]
  );

  const handleOrgUserDeleted = useCallback(
    (_payload: OrgUserEventPayload) => {
      queryClient.invalidateQueries({ queryKey: ['org', 'users'] });
      queryClient.invalidateQueries({ queryKey: orgKeys.dashboard });
    },
    [queryClient]
  );

  const handleOrgNumberAssigned = useCallback(
    (_payload: OrgNumberEventPayload) => {
      queryClient.invalidateQueries({ queryKey: orgKeys.numbers });
    },
    [queryClient]
  );

  const handleOrgNumberPurchased = useCallback(
    (_payload: OrgNumberEventPayload) => {
      queryClient.invalidateQueries({ queryKey: orgKeys.numbers });
      queryClient.invalidateQueries({ queryKey: orgKeys.dashboard });
    },
    [queryClient]
  );

  const handleReconnect = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: orgKeys.all });
  }, [queryClient]);

  useEffect(() => {
    if (!socket || !isConnected) return;

    socket.on(REALTIME_EVENTS.ORG_USER_CREATED, handleOrgUserCreated);
    socket.on(REALTIME_EVENTS.ORG_USER_UPDATED, handleOrgUserUpdated);
    socket.on(REALTIME_EVENTS.ORG_USER_DELETED, handleOrgUserDeleted);
    socket.on(REALTIME_EVENTS.ORG_NUMBER_ASSIGNED, handleOrgNumberAssigned);
    socket.on(REALTIME_EVENTS.ORG_NUMBER_PURCHASED, handleOrgNumberPurchased);
    // Socket.IO v4: `reconnect` fires on the Manager (socket.io), not the Socket.
    socket.io.on('reconnect', handleReconnect);

    return () => {
      socket.off(REALTIME_EVENTS.ORG_USER_CREATED, handleOrgUserCreated);
      socket.off(REALTIME_EVENTS.ORG_USER_UPDATED, handleOrgUserUpdated);
      socket.off(REALTIME_EVENTS.ORG_USER_DELETED, handleOrgUserDeleted);
      socket.off(REALTIME_EVENTS.ORG_NUMBER_ASSIGNED, handleOrgNumberAssigned);
      socket.off(REALTIME_EVENTS.ORG_NUMBER_PURCHASED, handleOrgNumberPurchased);
      socket.io.off('reconnect', handleReconnect);
    };
  }, [
    socket,
    isConnected,
    handleOrgUserCreated,
    handleOrgUserUpdated,
    handleOrgUserDeleted,
    handleOrgNumberAssigned,
    handleOrgNumberPurchased,
    handleReconnect,
  ]);

  return { isConnected };
}
