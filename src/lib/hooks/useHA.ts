/**
 * HA Monitoring Hooks
 *
 * Event-driven React Query hooks for HA monitoring and failover.
 * Uses WebSocket for real-time updates - NO POLLING.
 *
 * @module lib/hooks/useHA
 */

'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useCallback, useRef } from 'react';
import {
  haService,
  type HAClusterState,
  type HAFailoverEvent,
} from '@/lib/api/services/ha.service';
import { useSocket } from '@/lib/providers/SocketProvider';
import { REALTIME_EVENTS } from '@/lib/constants/events';
import { toast } from 'sonner';

/**
 * Query keys for React Query cache
 */
export const haKeys = {
  all: ['ha'] as const,
  status: () => [...haKeys.all, 'status'] as const,
  config: () => [...haKeys.all, 'config'] as const,
  events: (limit?: number) => [...haKeys.all, 'events', limit] as const,
  server: (id: string) => [...haKeys.all, 'server', id] as const,
};

/**
 * Hook for HA cluster status
 *
 * Event-driven: Fetches once on mount, then updates via WebSocket.
 * No polling - backend pushes updates only when state changes.
 */
export function useHAStatus() {
  const queryClient = useQueryClient();
  const { socket, isConnected } = useSocket();

  // Subscribe to WebSocket updates and sync with React Query cache
  useEffect(() => {
    if (!socket || !isConnected) return;

    const handleStatusUpdate = (data: HAClusterState) => {
      // Update React Query cache directly from WebSocket push
      queryClient.setQueryData(haKeys.status(), data);
    };

    socket.on(REALTIME_EVENTS.HA_STATUS_UPDATE, handleStatusUpdate);

    return () => {
      socket.off(REALTIME_EVENTS.HA_STATUS_UPDATE, handleStatusUpdate);
    };
  }, [socket, isConnected, queryClient]);

  return useQuery({
    queryKey: haKeys.status(),
    queryFn: () => haService.getStatus(),
    // No refetchInterval - we use WebSocket for updates
    staleTime: Infinity, // Data is always fresh (updated via WebSocket)
    gcTime: 1000 * 60 * 10, // Keep in cache for 10 minutes
  });
}

/**
 * Hook for HA server configuration
 *
 * Config rarely changes, so we fetch once and cache.
 */
export function useHAConfig() {
  return useQuery({
    queryKey: haKeys.config(),
    queryFn: () => haService.getConfig(),
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 30, // 30 minutes
  });
}

/**
 * Hook for failover event history
 *
 * Events are pushed via WebSocket when they occur.
 */
export function useHAEvents(limit: number = 50) {
  const queryClient = useQueryClient();
  const { socket, isConnected } = useSocket();

  // Subscribe to new failover events
  useEffect(() => {
    if (!socket || !isConnected) return;

    const handleFailoverCompleted = (event: HAFailoverEvent) => {
      // Prepend new event to the list
      queryClient.setQueryData<HAFailoverEvent[]>(haKeys.events(limit), (old) => {
        if (!old) return [event];
        // Keep only the most recent events
        return [event, ...old].slice(0, limit);
      });
    };

    const handleFailoverFailed = (event: HAFailoverEvent) => {
      queryClient.setQueryData<HAFailoverEvent[]>(haKeys.events(limit), (old) => {
        if (!old) return [event];
        return [event, ...old].slice(0, limit);
      });
    };

    socket.on(REALTIME_EVENTS.HA_FAILOVER_COMPLETED, handleFailoverCompleted);
    socket.on(REALTIME_EVENTS.HA_FAILOVER_FAILED, handleFailoverFailed);

    return () => {
      socket.off(REALTIME_EVENTS.HA_FAILOVER_COMPLETED, handleFailoverCompleted);
      socket.off(REALTIME_EVENTS.HA_FAILOVER_FAILED, handleFailoverFailed);
    };
  }, [socket, isConnected, queryClient, limit]);

  return useQuery({
    queryKey: haKeys.events(limit),
    queryFn: () => haService.getEvents(limit),
    staleTime: Infinity, // Updated via WebSocket
    gcTime: 1000 * 60 * 10,
  });
}

/**
 * Combined hook for HA monitoring dashboard
 *
 * Provides:
 * - Initial data fetch
 * - Real-time WebSocket updates
 * - Toast notifications for failover events and alerts
 * - Connection status indicator
 */
export function useHAMonitoring() {
  const queryClient = useQueryClient();
  const { socket, isConnected } = useSocket();
  const statusQuery = useHAStatus();
  const eventsQuery = useHAEvents();
  const lastUpdateRef = useRef<Date>(new Date());

  // Handle failover event notifications
  const handleFailoverStarted = useCallback(
    (data: { component: string; target: string; triggeredBy: string }) => {
      toast.warning(`Failover initiated: ${data.component}`, {
        description: `Switching to ${data.target}. Triggered by ${data.triggeredBy}`,
        duration: 10000,
      });
    },
    []
  );

  const handleFailoverCompleted = useCallback((data: HAFailoverEvent) => {
    toast.success(`Failover completed: ${data.component}`, {
      description: `Now active on ${data.toServer}. Duration: ${data.duration}ms`,
      duration: 8000,
    });
  }, []);

  const handleFailoverFailed = useCallback((data: HAFailoverEvent) => {
    toast.error(`Failover failed: ${data.component}`, {
      description: data.error || 'Unknown error occurred',
      duration: 15000,
    });
  }, []);

  const handleHAAlert = useCallback(
    (data: {
      type: 'error' | 'warning' | 'info';
      title: string;
      message: string;
      serverId?: string;
    }) => {
      const toastFn =
        data.type === 'error' ? toast.error : data.type === 'warning' ? toast.warning : toast.info;
      toastFn(data.title, {
        description: data.message,
        duration: data.type === 'error' ? 15000 : 8000,
      });
    },
    []
  );

  const handleServerChanged = useCallback(
    (data: { serverId: string; field: string; oldValue: unknown; newValue: unknown }) => {
      // Log granular changes for debugging
      console.log(`[HA] Server ${data.serverId} changed: ${data.field}`, {
        old: data.oldValue,
        new: data.newValue,
      });
    },
    []
  );

  const handleStatusUpdate = useCallback(() => {
    lastUpdateRef.current = new Date();
  }, []);

  // Subscribe to all HA events
  useEffect(() => {
    if (!socket || !isConnected) return;

    socket.on(REALTIME_EVENTS.HA_STATUS_UPDATE, handleStatusUpdate);
    socket.on(REALTIME_EVENTS.HA_FAILOVER_STARTED, handleFailoverStarted);
    socket.on(REALTIME_EVENTS.HA_FAILOVER_COMPLETED, handleFailoverCompleted);
    socket.on(REALTIME_EVENTS.HA_FAILOVER_FAILED, handleFailoverFailed);
    socket.on(REALTIME_EVENTS.HA_ALERT, handleHAAlert);
    socket.on(REALTIME_EVENTS.HA_SERVER_CHANGED, handleServerChanged);

    return () => {
      socket.off(REALTIME_EVENTS.HA_STATUS_UPDATE, handleStatusUpdate);
      socket.off(REALTIME_EVENTS.HA_FAILOVER_STARTED, handleFailoverStarted);
      socket.off(REALTIME_EVENTS.HA_FAILOVER_COMPLETED, handleFailoverCompleted);
      socket.off(REALTIME_EVENTS.HA_FAILOVER_FAILED, handleFailoverFailed);
      socket.off(REALTIME_EVENTS.HA_ALERT, handleHAAlert);
      socket.off(REALTIME_EVENTS.HA_SERVER_CHANGED, handleServerChanged);
    };
  }, [
    socket,
    isConnected,
    handleStatusUpdate,
    handleFailoverStarted,
    handleFailoverCompleted,
    handleFailoverFailed,
    handleHAAlert,
    handleServerChanged,
  ]);

  // Manual refetch function (for user-initiated refresh)
  const refetch = useCallback(async () => {
    await Promise.all([statusQuery.refetch(), eventsQuery.refetch()]);
  }, [statusQuery, eventsQuery]);

  return {
    // Data
    status: statusQuery.data,
    events: eventsQuery.data || [],

    // Loading states
    isLoading: statusQuery.isLoading,
    isError: statusQuery.isError,
    error: statusQuery.error,

    // Real-time indicator
    isRealtime: isConnected,
    lastUpdated: lastUpdateRef.current,

    // Actions
    refetch,
  };
}

/**
 * Hook for generating failover confirmation code
 */
export function useGenerateFailoverCode() {
  return useMutation({
    mutationFn: (component: 'kamailio' | 'postgresql') => haService.generateFailoverCode(component),
    onError: (error) => {
      toast.error('Failed to generate confirmation code', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    },
  });
}

/**
 * Hook for initiating Kamailio failover
 */
export function useKamailioFailover() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      target,
      confirmationCode,
      reason,
    }: {
      target: 'primary' | 'secondary';
      confirmationCode: string;
      reason?: string;
    }) => haService.initiateKamailioFailover(target, confirmationCode, reason),
    onSuccess: () => {
      // Invalidate to force refresh after failover
      queryClient.invalidateQueries({ queryKey: haKeys.status() });
      queryClient.invalidateQueries({ queryKey: haKeys.events() });
      toast.info('Failover command sent', {
        description: 'Monitoring failover progress...',
      });
    },
    onError: (error) => {
      toast.error('Failover failed', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    },
  });
}

/**
 * Hook for initiating PostgreSQL failover
 */
export function usePostgresFailover() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      target,
      confirmationCode,
      reason,
    }: {
      target: 'primary' | 'secondary';
      confirmationCode: string;
      reason?: string;
    }) => haService.initiatePostgresFailover(target, confirmationCode, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: haKeys.status() });
      queryClient.invalidateQueries({ queryKey: haKeys.events() });
      toast.info('Switchover command sent', {
        description: 'Monitoring PostgreSQL switchover progress...',
      });
    },
    onError: (error) => {
      toast.error('Switchover failed', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    },
  });
}

/**
 * Hook for testing connectivity between servers
 */
export function useTestConnectivity() {
  return useMutation({
    mutationFn: () => haService.testConnectivity(),
    onSuccess: (results) => {
      const failed = results.filter((r) => !r.success);
      if (failed.length === 0) {
        toast.success('All connectivity tests passed');
      } else {
        toast.warning(`${failed.length} connectivity tests failed`, {
          description: failed.map((f) => `${f.from} → ${f.to}`).join(', '),
        });
      }
    },
    onError: (error) => {
      toast.error('Connectivity test failed', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    },
  });
}

/**
 * Hook for getting individual server health
 *
 * Uses WebSocket updates from main status, no separate polling.
 */
export function useServerHealth(serverId: string) {
  const { status } = useHAMonitoring();

  // Extract server health from overall status
  const serverHealth = status ? extractServerHealth(status, serverId) : null;

  return {
    data: serverHealth,
    isLoading: !status,
  };
}

/**
 * Hook for executing server actions (restart, diagnostics, etc.)
 */
export function useServerAction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ serverId, actionId }: { serverId: string; actionId: string }) =>
      haService.executeServerAction(serverId, actionId),
    onSuccess: (data, variables) => {
      if (data.actionSuccess) {
        toast.success(`Action completed on ${variables.serverId}`, {
          description: data.output.slice(0, 100),
        });
      } else {
        toast.warning(`Action returned with issues`, {
          description: data.output.slice(0, 150),
        });
      }
      // Refresh status after action
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: haKeys.status() });
      }, 2000);
    },
    onError: (error) => {
      toast.error('Action failed', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    },
  });
}

/**
 * Hook for getting service logs
 */
export function useServiceLogs() {
  return useMutation({
    mutationFn: ({
      serverId,
      service,
      lines,
    }: {
      serverId: string;
      service: string;
      lines?: number;
    }) => haService.getServiceLogs(serverId, service, lines),
    onError: (error) => {
      toast.error('Failed to fetch logs', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    },
  });
}

/**
 * Extract individual server health from cluster state
 */
function extractServerHealth(state: HAClusterState, serverId: string) {
  switch (serverId) {
    case 'kamailio-primary':
      return state.kamailio.primary;
    case 'kamailio-secondary':
      return state.kamailio.secondary;
    case 'fusionpbx-primary':
      return state.fusionpbx.primary;
    case 'fusionpbx-secondary':
      return state.fusionpbx.secondary;
    case 'postgresql-primary':
      return state.postgresql.primary;
    case 'postgresql-secondary':
      return state.postgresql.secondary;
    case 'monitor':
      return state.monitor;
    case 'bkpserver':
      return state.bkpserver;
    case 'apigateway':
      return state.apigateway;
    default:
      return null;
  }
}
