/**
 * Monitoring Hooks
 *
 * React Query hooks for system monitoring data.
 */

'use client';

import { useQuery } from '@tanstack/react-query';
import { useEffect, useState, useCallback } from 'react';
import {
  monitoringService,
  type SystemMetrics,
  type HealthSummary,
} from '@/lib/api/services/monitoring.service';
import { useSocket } from '@/lib/providers/SocketProvider';
import { REALTIME_EVENTS } from '@/lib/constants/events';

/**
 * Query keys
 */
export const monitoringKeys = {
  all: ['monitoring'] as const,
  metrics: () => [...monitoringKeys.all, 'metrics'] as const,
  history: (minutes: number) => [...monitoringKeys.all, 'history', minutes] as const,
  health: () => [...monitoringKeys.all, 'health'] as const,
  cpu: () => [...monitoringKeys.all, 'cpu'] as const,
  memory: () => [...monitoringKeys.all, 'memory'] as const,
  database: () => [...monitoringKeys.all, 'database'] as const,
  redis: () => [...monitoringKeys.all, 'redis'] as const,
  websocket: () => [...monitoringKeys.all, 'websocket'] as const,
  api: () => [...monitoringKeys.all, 'api'] as const,
};

/**
 * Hook for current system metrics
 */
export function useSystemMetrics() {
  return useQuery({
    queryKey: monitoringKeys.metrics(),
    queryFn: () => monitoringService.getMetrics(),
    refetchInterval: 10000, // Refresh every 10 seconds
    staleTime: 5000,
  });
}

/**
 * Hook for metrics history
 */
export function useMetricsHistory(minutes: number = 60) {
  return useQuery({
    queryKey: monitoringKeys.history(minutes),
    queryFn: () => monitoringService.getHistory(minutes),
    refetchInterval: 60000, // Refresh every minute
    staleTime: 30000,
  });
}

/**
 * Hook for system health summary
 */
export function useHealthSummary() {
  return useQuery({
    queryKey: monitoringKeys.health(),
    queryFn: () => monitoringService.getHealthSummary(),
    refetchInterval: 15000, // Refresh every 15 seconds
    staleTime: 10000,
  });
}

/**
 * Hook for real-time system metrics via WebSocket
 */
export function useRealtimeMetrics() {
  const { socket, isConnected } = useSocket();
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Handle real-time metrics updates
  const handleMetricsUpdate = useCallback((data: SystemMetrics) => {
    setMetrics(data);
    setLastUpdated(new Date());
  }, []);

  useEffect(() => {
    if (!socket || !isConnected) return;

    // Listen for health updates
    socket.on(REALTIME_EVENTS.ADMIN_HEALTH_UPDATE, handleMetricsUpdate);

    return () => {
      socket.off(REALTIME_EVENTS.ADMIN_HEALTH_UPDATE, handleMetricsUpdate);
    };
  }, [socket, isConnected, handleMetricsUpdate]);

  return {
    metrics,
    lastUpdated,
    isConnected,
  };
}

/**
 * Hook that combines API polling with real-time updates
 */
export function useSystemMonitoring() {
  const apiMetrics = useSystemMetrics();
  const realtimeMetrics = useRealtimeMetrics();
  const healthSummary = useHealthSummary();

  // Use real-time data if available and fresh, otherwise fall back to API
  const metrics = realtimeMetrics.metrics || apiMetrics.data;
  const isLoading = apiMetrics.isLoading && !realtimeMetrics.metrics;
  const isError = apiMetrics.isError && !realtimeMetrics.metrics;

  return {
    metrics,
    healthSummary: healthSummary.data,
    isLoading,
    isError,
    error: apiMetrics.error,
    lastUpdated: realtimeMetrics.lastUpdated || new Date(),
    isRealtime: !!realtimeMetrics.metrics && realtimeMetrics.isConnected,
    refetch: apiMetrics.refetch,
  };
}

/**
 * Hook for CPU metrics
 */
export function useCpuMetrics() {
  return useQuery({
    queryKey: monitoringKeys.cpu(),
    queryFn: () => monitoringService.getCpuMetrics(),
    refetchInterval: 10000,
    staleTime: 5000,
  });
}

/**
 * Hook for memory metrics
 */
export function useMemoryMetrics() {
  return useQuery({
    queryKey: monitoringKeys.memory(),
    queryFn: () => monitoringService.getMemoryMetrics(),
    refetchInterval: 10000,
    staleTime: 5000,
  });
}

/**
 * Hook for database metrics
 */
export function useDatabaseMetrics() {
  return useQuery({
    queryKey: monitoringKeys.database(),
    queryFn: () => monitoringService.getDatabaseMetrics(),
    refetchInterval: 15000,
    staleTime: 10000,
  });
}

/**
 * Hook for Redis metrics
 */
export function useRedisMetricsData() {
  return useQuery({
    queryKey: monitoringKeys.redis(),
    queryFn: () => monitoringService.getRedisMetrics(),
    refetchInterval: 15000,
    staleTime: 10000,
  });
}

/**
 * Hook for WebSocket metrics
 */
export function useWebSocketMetrics() {
  return useQuery({
    queryKey: monitoringKeys.websocket(),
    queryFn: () => monitoringService.getWebSocketMetrics(),
    refetchInterval: 10000,
    staleTime: 5000,
  });
}

/**
 * Hook for API performance metrics
 */
export function useApiPerformanceMetrics() {
  return useQuery({
    queryKey: monitoringKeys.api(),
    queryFn: () => monitoringService.getApiMetrics(),
    refetchInterval: 30000,
    staleTime: 15000,
  });
}
