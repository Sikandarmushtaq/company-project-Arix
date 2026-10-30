'use client';

/**
 * useCallHealth
 *
 * React Query hooks + WebSocket-driven cache invalidation for the admin
 * `/admin/call-health` dashboard. No polling — fresh data arrives via the
 * `admin:call_health:recorded` socket event emitted by the backend each
 * time a dialer ingests a new telemetry record.
 *
 * @module lib/hooks/useCallHealth
 */

import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSocket } from '@/lib/providers/SocketProvider';
import { callHealthService } from '@/lib/api/services/callHealth.service';
import type { IceFinalState } from '@/lib/api/services/callHealth.service';
import { adminKeys } from './useAdminKeys';

/** Server event name (mirrors REALTIME_EVENTS.ADMIN_CALL_HEALTH_RECORDED). */
const EVENT_CALL_HEALTH_RECORDED = 'admin:call_health:recorded';

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export function useCallHealthSummary(hours = 24) {
  return useQuery({
    queryKey: adminKeys.callHealthSummary(hours),
    queryFn: () => callHealthService.getSummary(hours),
    // Cache for 5 minutes; background WebSocket invalidation keeps it fresh.
    staleTime: 5 * 60 * 1000,
  });
}

export function useCallHealthUserStats(hours = 24, limit = 50) {
  return useQuery({
    queryKey: adminKeys.callHealthUsers(hours, limit),
    queryFn: () => callHealthService.getUserStats(hours, limit),
    staleTime: 5 * 60 * 1000,
  });
}

export function useCallHealthCalls(params: {
  userId?: number;
  state?: IceFinalState;
  hours?: number;
  limit?: number;
  offset?: number;
}) {
  return useQuery({
    queryKey: adminKeys.callHealthCalls(params),
    queryFn: () => callHealthService.listCalls(params),
    staleTime: 30 * 1000,
  });
}

export function useCallHealthDetail(id: number | null) {
  return useQuery({
    queryKey: adminKeys.callHealthDetail(id ?? 0),
    queryFn: () => callHealthService.getCallById(id as number),
    enabled: id !== null && id > 0,
    staleTime: 10 * 60 * 1000,
  });
}

/**
 * Desk-phone monitor (Call Health → Hardphones). Polls for a near-real-time
 * "online" view of registration status + live calls. `pollMs=0` disables polling.
 */
export function useHardphoneMonitor(pollMs = 5000) {
  return useQuery({
    queryKey: ['admin', 'hardphone-monitor'],
    queryFn: () => callHealthService.getHardphones(),
    refetchInterval: pollMs > 0 ? pollMs : false,
    staleTime: 0,
  });
}

// ---------------------------------------------------------------------------
// Live updates via WebSocket — no polling
// ---------------------------------------------------------------------------

/**
 * Subscribe the current component to the ADMIN_CALL_HEALTH_RECORDED socket
 * event. On every new telemetry record, invalidate summary + user stats +
 * list queries so the dashboard refreshes within ms of a call ending.
 *
 * Mount once at the top of the dashboard page.
 */
export function useCallHealthRealtimeSync(): void {
  const { socket, isConnected } = useSocket();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!socket || !isConnected) return;

    const handler = () => {
      // Invalidate all aggregates — React Query will refetch those that are
      // currently observed (mounted) and leave the others stale.
      queryClient.invalidateQueries({ queryKey: adminKeys.callHealth() });
    };

    socket.on(EVENT_CALL_HEALTH_RECORDED, handler);
    return () => {
      socket.off(EVENT_CALL_HEALTH_RECORDED, handler);
    };
  }, [socket, isConnected, queryClient]);
}
