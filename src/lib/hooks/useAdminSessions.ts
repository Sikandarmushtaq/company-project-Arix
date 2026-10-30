/**
 * Admin Session Hooks
 * React Query hooks for session and connection management
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminService } from '@/lib/api/services/admin.service';
import { adminKeys } from './useAdminKeys';

// ============================================================
// Session Hooks
// ============================================================

export function useAdminSessions(
  params: {
    page?: number;
    limit?: number;
    search?: string;
  } = {}
) {
  return useQuery({
    queryKey: [...adminKeys.sessions(), params.page, params.limit, params.search],
    queryFn: () => adminService.getSessions(params),
    staleTime: 10 * 1000,
  });
}

export function useSessionStats() {
  return useQuery({
    queryKey: adminKeys.sessionStats(),
    queryFn: () => adminService.getSessionStats(),
    staleTime: 30 * 1000,
  });
}

export function useLogoutSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (sessionId: string) => adminService.logoutSession(sessionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.sessions() });
      queryClient.invalidateQueries({ queryKey: adminKeys.stats() });
    },
  });
}

export function useLogoutAllSessions() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => adminService.logoutAllSessions(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.sessions() });
      queryClient.invalidateQueries({ queryKey: adminKeys.stats() });
    },
  });
}

// ============================================================
// WebSocket Connection Hooks
// ============================================================

export function useAdminConnections() {
  return useQuery({
    queryKey: adminKeys.connections(),
    queryFn: () => adminService.getConnections(),
    staleTime: 5 * 1000,
    refetchInterval: 10 * 1000,
  });
}

export function useKickConnection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (socketId: string) => adminService.kickConnection(socketId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.connections() });
      queryClient.invalidateQueries({ queryKey: adminKeys.stats() });
    },
  });
}

export function useKickUserConnections() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userId: number) => adminService.kickUserConnections(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.connections() });
      queryClient.invalidateQueries({ queryKey: adminKeys.stats() });
      queryClient.invalidateQueries({ queryKey: adminKeys.sessions() });
    },
  });
}

// ============================================================
// Export Hooks
// ============================================================

export function useExportSessions() {
  return useMutation({
    mutationFn: () => adminService.exportSessions(),
  });
}
