/**
 * Admin Analytics Hooks
 * React Query hooks for stats, analytics, audit logs, recordings, settings, and organizations
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminService } from '@/lib/api/services/admin.service';
import {
  getCallPerformance,
  getAgentLeaderboard,
  getOrgAgents,
  type CallPerformanceParams,
  type AgentLeaderboardParams,
} from '@/lib/api/services/admin-analytics.api';
import { adminKeys } from './useAdminKeys';

/**
 * CDR-backed call performance (per-agent, per-day/week/month, direction).
 * Requires a valid start+end range before it fires.
 */
export function useCallPerformance(params: CallPerformanceParams, enabled = true) {
  return useQuery({
    queryKey: ['admin', 'analytics', 'call-performance', params],
    queryFn: () => getCallPerformance(params),
    enabled: enabled && !!params.startDate && !!params.endDate,
  });
}

/** CDR-backed per-agent leaderboard over a range. */
export function useAgentLeaderboard(params: AgentLeaderboardParams, enabled = true) {
  return useQuery({
    queryKey: ['admin', 'analytics', 'agent-leaderboard', params],
    queryFn: () => getAgentLeaderboard(params),
    enabled: enabled && !!params.startDate && !!params.endDate,
  });
}

/** Org-scoped agent list for the per-agent filter dropdowns (manager-safe). */
export function useOrgAgents(enabled = true, organizationId?: number) {
  return useQuery({
    queryKey: ['admin', 'agents', organizationId ?? 'self'],
    queryFn: () => getOrgAgents(organizationId),
    staleTime: 5 * 60 * 1000,
    enabled,
  });
}

// ============================================================
// Dashboard Hooks
// ============================================================

export function useAdminStats() {
  return useQuery({
    queryKey: adminKeys.stats(),
    queryFn: () => adminService.getStats(),
    staleTime: 30 * 1000,
  });
}

// ============================================================
// Failover Hooks
// ============================================================

export function useFailoverStatus() {
  return useQuery({
    queryKey: adminKeys.failover(),
    queryFn: () => adminService.getFailoverStatus(),
    staleTime: 30 * 1000,
  });
}

export function useSwitchAllToBackup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => adminService.switchAllToBackup(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.failover() });
    },
  });
}

export function useSwitchUserServer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userId, server }: { userId: number; server: 'primary' | 'backup' }) =>
      adminService.switchUserServer(userId, server),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.failover() });
    },
  });
}

// ============================================================
// Recording Hooks
// ============================================================

export function useRecordingStats() {
  return useQuery({
    queryKey: adminKeys.recordingStats(),
    queryFn: () => adminService.getRecordingStats(),
    staleTime: 60 * 1000,
  });
}

export function useDeleteOldRecordings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (days: number = 30) => adminService.deleteOldRecordings(days),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.recordingStats() });
    },
  });
}

export function useUsersWithQuotas(params?: { page?: number; limit?: number; search?: string }) {
  return useQuery({
    queryKey: adminKeys.usersWithQuotas(params),
    queryFn: () => adminService.getUsersWithQuotas(params),
    staleTime: 30 * 1000,
  });
}

export function useUpdateUserQuota() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ sipUsername, limitHours }: { sipUsername: string; limitHours: number }) =>
      adminService.updateUserQuota(sipUsername, limitHours),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.usersWithQuotas() });
    },
  });
}

// ============================================================
// Audit Log Hooks
// ============================================================

export function useAuditLogs(filters?: Parameters<typeof adminService.getAuditLogs>[0]) {
  return useQuery({
    queryKey: adminKeys.auditLogs(filters),
    queryFn: () => adminService.getAuditLogs(filters),
    staleTime: 30 * 1000,
  });
}

export function useAuditStats() {
  return useQuery({
    queryKey: adminKeys.auditStats(),
    queryFn: () => adminService.getAuditStats(),
    staleTime: 60 * 1000,
  });
}

export function useAuditActions() {
  return useQuery({
    queryKey: adminKeys.auditActions(),
    queryFn: () => adminService.getAuditActions(),
    staleTime: 5 * 60 * 1000,
  });
}

export function useExportAuditLogs() {
  return useMutation({
    mutationFn: (filters?: Parameters<typeof adminService.exportAuditLogs>[0]) =>
      adminService.exportAuditLogs(filters),
  });
}

export function useCleanupAuditLogs() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (days: number = 90) => adminService.cleanupAuditLogs(days),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.audit() });
    },
  });
}

// ============================================================
// Analytics Hooks
// ============================================================

export function useAnalyticsOverview() {
  return useQuery({
    queryKey: adminKeys.analyticsOverview(),
    queryFn: () => adminService.getAnalyticsOverview(),
    staleTime: 60 * 1000,
  });
}

export function useTimeSeriesData(days: number = 30) {
  return useQuery({
    queryKey: adminKeys.analyticsTimeSeries(days),
    queryFn: () => adminService.getTimeSeriesData(days),
    staleTime: 60 * 1000,
  });
}

export function useCallAnalytics(days: number = 30) {
  return useQuery({
    queryKey: adminKeys.analyticsCall(days),
    queryFn: () => adminService.getCallAnalytics(days),
    staleTime: 60 * 1000,
  });
}

export function useSmsAnalytics(days: number = 30) {
  return useQuery({
    queryKey: adminKeys.analyticsSms(days),
    queryFn: () => adminService.getSmsAnalytics(days),
    staleTime: 60 * 1000,
  });
}

export function useUserAnalytics(days: number = 30) {
  return useQuery({
    queryKey: adminKeys.analyticsUser(days),
    queryFn: () => adminService.getUserAnalytics(days),
    staleTime: 60 * 1000,
  });
}

export function useCampaignAnalytics() {
  return useQuery({
    queryKey: adminKeys.analyticsCampaign(),
    queryFn: () => adminService.getCampaignAnalytics(),
    staleTime: 60 * 1000,
  });
}

// ============================================================
// System Settings Hooks
// ============================================================

export function useSettings() {
  return useQuery({
    queryKey: adminKeys.settings(),
    queryFn: () => adminService.getSettings(),
    staleTime: 60 * 1000,
  });
}

export function useUpdateSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (settings: Parameters<typeof adminService.updateSettings>[0]) =>
      adminService.updateSettings(settings),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.settings() });
    },
  });
}

// ============================================================
// Export Hooks
// ============================================================

export function useExportCalls() {
  return useMutation({
    mutationFn: (filters?: {
      startDate?: string;
      endDate?: string;
      direction?: string;
      status?: string;
    }) => adminService.exportCalls(filters),
  });
}

export function useExportSms() {
  return useMutation({
    mutationFn: (filters?: { startDate?: string; endDate?: string; direction?: string }) =>
      adminService.exportSms(filters),
  });
}

export function useExportVoicemails() {
  return useMutation({
    mutationFn: (filters?: { startDate?: string; endDate?: string; read?: string }) =>
      adminService.exportVoicemails(filters),
  });
}

export function useExportRecordings() {
  return useMutation({
    mutationFn: (filters?: { startDate?: string; endDate?: string }) =>
      adminService.exportRecordings(filters),
  });
}

// ============================================================
// Organization Hooks
// ============================================================

// NOTE: the canonical organizations-list hook lives in useAdmin.ts — it forwards the
// `status` filter (active / suspended / closed). A status-less duplicate used to live
// here and silently dropped that filter; it was removed to avoid the trap. Import
// `useOrganizations` from '@/lib/hooks/useAdmin'.

export function useOrganization(id: number) {
  return useQuery({
    queryKey: adminKeys.organizationDetail(id),
    queryFn: () => adminService.getOrganization(id),
    enabled: id > 0,
  });
}

export function useOrganizationStats(id: number) {
  return useQuery({
    queryKey: adminKeys.organizationStats(id),
    queryFn: () => adminService.getOrganizationStats(id),
    enabled: id > 0,
    staleTime: 30 * 1000,
  });
}

export function useOrganizationUsers(id: number, params?: { page?: number; limit?: number }) {
  return useQuery({
    queryKey: adminKeys.organizationUsers(id, params),
    queryFn: () => adminService.getOrganizationUsers(id, params),
    enabled: id > 0,
    staleTime: 30 * 1000,
  });
}

export function useCreateOrganization() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Parameters<typeof adminService.createOrganization>[0]) =>
      adminService.createOrganization(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.organizations() });
    },
  });
}

export function useUpdateOrganization() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: number;
      data: Parameters<typeof adminService.updateOrganization>[1];
    }) => adminService.updateOrganization(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: adminKeys.organizations() });
      queryClient.invalidateQueries({ queryKey: adminKeys.organizationDetail(id) });
    },
  });
}

export function useDeleteOrganization() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => adminService.deleteOrganization(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.organizations() });
    },
  });
}

export function useAssignUserToOrganization() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userId, organizationId }: { userId: number; organizationId: number }) =>
      adminService.assignUserToOrganization(userId, organizationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.users() });
      queryClient.invalidateQueries({ queryKey: adminKeys.organizations() });
      queryClient.invalidateQueries({ queryKey: adminKeys.unassignedUsers() });
    },
  });
}

export function useRemoveUserFromOrganization() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userId: number) => adminService.removeUserFromOrganization(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.users() });
      queryClient.invalidateQueries({ queryKey: adminKeys.organizations() });
      queryClient.invalidateQueries({ queryKey: adminKeys.unassignedUsers() });
    },
  });
}
