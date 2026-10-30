/**
 * Admin React Query Hooks
 * Hooks for admin data fetching and mutations
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  adminService,
  type AdminUser,
  type UserParams,
  type CreateUserData,
  type UpdateUserData,
  type ExtensionSettings,
  type PhoneNumber,
} from '@/lib/api/services/admin.service';

// ============================================================
// Query Keys
// ============================================================

export const adminKeys = {
  all: ['admin'] as const,
  stats: () => [...adminKeys.all, 'stats'] as const,
  users: () => [...adminKeys.all, 'users'] as const,
  user: (id: number) => [...adminKeys.users(), 'detail', id] as const,
  usersList: (params?: UserParams) => [...adminKeys.users(), 'list', params] as const,
  userDetail: (id: number) => [...adminKeys.users(), 'detail', id] as const,
  userExtensionSettings: (id: number) => [...adminKeys.users(), 'extension-settings', id] as const,
  unassignedUsers: () => [...adminKeys.users(), 'unassigned'] as const,
  userPhoneNumbers: (id: number) => [...adminKeys.users(), 'phone-numbers', id] as const,
  devices: () => [...adminKeys.all, 'devices'] as const,
  connections: () => [...adminKeys.all, 'connections'] as const,
  sessions: () => [...adminKeys.all, 'sessions'] as const,
  sessionStats: () => [...adminKeys.all, 'sessionStats'] as const,
  bans: () => [...adminKeys.all, 'bans'] as const,
  bannedUsers: () => [...adminKeys.bans(), 'users'] as const,
  tempBans: () => [...adminKeys.bans(), 'temp'] as const,
  deviceBans: () => [...adminKeys.bans(), 'devices'] as const,
  ipBans: () => [...adminKeys.bans(), 'ip'] as const,
  failover: () => [...adminKeys.all, 'failover'] as const,
  recordingStats: () => [...adminKeys.all, 'recordingStats'] as const,
  usersWithQuotas: (params?: { page?: number; limit?: number; search?: string }) =>
    [...adminKeys.all, 'usersWithQuotas', params] as const,
  audit: () => [...adminKeys.all, 'audit'] as const,
  auditLogs: (filters?: unknown) => [...adminKeys.audit(), 'logs', filters] as const,
  auditStats: () => [...adminKeys.audit(), 'stats'] as const,
  auditActions: () => [...adminKeys.audit(), 'actions'] as const,
  analytics: () => [...adminKeys.all, 'analytics'] as const,
  analyticsOverview: () => [...adminKeys.analytics(), 'overview'] as const,
  analyticsTimeSeries: (days?: number) => [...adminKeys.analytics(), 'timeseries', days] as const,
  analyticsCall: (days?: number) => [...adminKeys.analytics(), 'call', days] as const,
  analyticsSms: (days?: number) => [...adminKeys.analytics(), 'sms', days] as const,
  analyticsUser: (days?: number) => [...adminKeys.analytics(), 'user', days] as const,
  analyticsCampaign: () => [...adminKeys.analytics(), 'campaign'] as const,
  analyticsWhatsAppCalls: (days?: number) =>
    [...adminKeys.analytics(), 'whatsapp-calls', days] as const,
  settings: () => [...adminKeys.all, 'settings'] as const,
  // Organizations
  organizations: () => [...adminKeys.all, 'organizations'] as const,
  organizationsList: (params?: { page?: number; limit?: number; search?: string }) =>
    [...adminKeys.organizations(), 'list', params] as const,
  organizationDetail: (id: number) => [...adminKeys.organizations(), 'detail', id] as const,
  organizationStats: (id: number) => [...adminKeys.organizations(), 'stats', id] as const,
  organizationUsers: (id: number, params?: { page?: number; limit?: number }) =>
    [...adminKeys.organizations(), 'users', id, params] as const,
};

// ============================================================
// Dashboard Hooks
// ============================================================

export function useAdminStats() {
  return useQuery({
    queryKey: adminKeys.stats(),
    queryFn: () => adminService.getStats(),
    staleTime: 30 * 1000, // 30 seconds
  });
}

// ============================================================
// User Hooks
// ============================================================

export function useAdminUsers(params?: UserParams) {
  return useQuery({
    queryKey: adminKeys.usersList(params),
    queryFn: () => adminService.getUsers(params),
    staleTime: 30 * 1000,
  });
}

export function useAdminUser(id: number) {
  return useQuery({
    queryKey: adminKeys.userDetail(id),
    queryFn: () => adminService.getUser(id),
    enabled: id > 0,
  });
}

export function useUserExtensionSettings(id: number) {
  return useQuery({
    queryKey: adminKeys.userExtensionSettings(id),
    queryFn: () => adminService.getUserExtensionSettings(id),
    enabled: id > 0,
    staleTime: 30 * 1000, // 30 seconds
  });
}

// ============================================================
// Phone Number Hooks
// ============================================================

export function useUserPhoneNumbers(userId: number) {
  return useQuery({
    queryKey: adminKeys.userPhoneNumbers(userId),
    queryFn: () => adminService.getUserPhoneNumbers(userId),
    enabled: userId > 0,
    staleTime: 30 * 1000,
  });
}

export function useAddPhoneNumber() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      userId,
      phoneNumber,
      label,
      isPrimary,
    }: {
      userId: number;
      phoneNumber: string;
      label?: string;
      isPrimary?: boolean;
    }) => adminService.addPhoneNumber(userId, phoneNumber, label, isPrimary),
    onSuccess: (_, { userId }) => {
      queryClient.invalidateQueries({ queryKey: adminKeys.userPhoneNumbers(userId) });
      queryClient.invalidateQueries({ queryKey: adminKeys.userDetail(userId) });
    },
  });
}

export function useRemovePhoneNumber() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ numberId, userId }: { numberId: number; userId: number }) =>
      adminService.removePhoneNumber(numberId),
    onSuccess: (_, { userId }) => {
      queryClient.invalidateQueries({ queryKey: adminKeys.userPhoneNumbers(userId) });
      queryClient.invalidateQueries({ queryKey: adminKeys.userDetail(userId) });
    },
  });
}

export function useSetDefaultPhoneNumber() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userId, numberId }: { userId: number; numberId: number }) =>
      adminService.setDefaultPhoneNumber(userId, numberId),
    onSuccess: (_, { userId }) => {
      queryClient.invalidateQueries({ queryKey: adminKeys.userPhoneNumbers(userId) });
      queryClient.invalidateQueries({ queryKey: adminKeys.userDetail(userId) });
    },
  });
}

export function useToggleAutoSms() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      userId,
      numberId,
      enabled,
    }: {
      userId: number;
      numberId: number;
      enabled: boolean;
    }) => adminService.toggleAutoSms(userId, numberId, enabled),
    onSuccess: (_, { userId }) => {
      queryClient.invalidateQueries({ queryKey: adminKeys.userPhoneNumbers(userId) });
    },
  });
}

export function useToggleAiDialer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      userId,
      numberId,
      enabled,
      elevenlabsPhoneId,
    }: {
      userId: number;
      numberId: number;
      enabled: boolean;
      elevenlabsPhoneId?: string;
    }) => adminService.toggleAiDialer(userId, numberId, enabled, elevenlabsPhoneId),
    onSuccess: (_, { userId }) => {
      queryClient.invalidateQueries({ queryKey: adminKeys.userPhoneNumbers(userId) });
    },
  });
}

// ============================================================
// User Mutation Hooks
// ============================================================

export function useCreateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateUserData) => adminService.createUser(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.users() });
      queryClient.invalidateQueries({ queryKey: adminKeys.stats() });
    },
  });
}

export function useUpdateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateUserData }) =>
      adminService.updateUser(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: adminKeys.users() });
      queryClient.invalidateQueries({ queryKey: adminKeys.userDetail(id) });
    },
  });
}

export function useDeleteUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => adminService.deleteUser(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.users() });
      queryClient.invalidateQueries({ queryKey: adminKeys.stats() });
    },
  });
}

export function useSetBanStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, banned, reason }: { id: number; banned: boolean; reason?: string }) =>
      adminService.setBanStatus(id, banned, reason),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: adminKeys.users() });
      queryClient.invalidateQueries({ queryKey: adminKeys.userDetail(id) });
      queryClient.invalidateQueries({ queryKey: adminKeys.bannedUsers() });
    },
  });
}

export function useToggleSms() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, enabled }: { id: number; enabled: boolean }) =>
      adminService.toggleSms(id, enabled),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: adminKeys.userDetail(id) });
      queryClient.invalidateQueries({ queryKey: adminKeys.users() });
    },
  });
}

export function useToggleAutoDialer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, enabled }: { id: number; enabled: boolean }) =>
      adminService.toggleAutoDialer(id, enabled),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: adminKeys.userDetail(id) });
      queryClient.invalidateQueries({ queryKey: adminKeys.users() });
    },
  });
}

export function useUpdateUserPassword() {
  return useMutation({
    mutationFn: ({ id, password }: { id: number; password: string }) =>
      adminService.updateUserPassword(id, password),
  });
}

export function useForceLogout() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => adminService.forceLogout(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.sessions() });
    },
  });
}

// ============================================================
// Device Hooks
// ============================================================

export function useAdminDevices() {
  return useQuery({
    queryKey: adminKeys.devices(),
    queryFn: () => adminService.getDevices(),
    staleTime: 10 * 1000, // 10 seconds - devices change frequently
  });
}

export function useKickDevice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (contact: string) => adminService.kickDevice(contact),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.devices() });
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
    staleTime: 5 * 1000, // 5 seconds - connections change very frequently
    refetchInterval: 10 * 1000, // Refetch every 10 seconds
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
// Ban Hooks
// ============================================================

export function useBannedUsers(
  params: {
    page?: number;
    limit?: number;
    search?: string;
  } = {}
) {
  return useQuery({
    queryKey: [...adminKeys.bannedUsers(), params.page, params.limit, params.search],
    queryFn: () => adminService.getBannedUsers(params),
    staleTime: 60 * 1000,
  });
}

export function useTempBans() {
  return useQuery({
    queryKey: adminKeys.tempBans(),
    queryFn: () => adminService.getTempBans(),
    staleTime: 60 * 1000,
  });
}

export function useDeviceBans() {
  return useQuery({
    queryKey: adminKeys.deviceBans(),
    queryFn: () => adminService.getDeviceBans(),
    staleTime: 60 * 1000,
  });
}

export function useIpBans() {
  return useQuery({
    queryKey: adminKeys.ipBans(),
    queryFn: () => adminService.getIpBans(),
    staleTime: 60 * 1000,
  });
}

export function useBanIpFromConnection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ socketId, reason }: { socketId: string; reason?: string }) =>
      adminService.banIpFromConnection(socketId, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.connections() });
      queryClient.invalidateQueries({ queryKey: adminKeys.sessions() });
      queryClient.invalidateQueries({ queryKey: adminKeys.ipBans() });
      queryClient.invalidateQueries({ queryKey: adminKeys.stats() });
    },
  });
}

export function useUnbanIp() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (ipAddress: string) => adminService.unbanIp(ipAddress),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.ipBans() });
    },
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
    staleTime: 5 * 60 * 1000, // 5 minutes
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
    staleTime: 60 * 1000, // 1 minute
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

export function useWhatsAppCallAnalytics(days: number = 30) {
  return useQuery({
    queryKey: adminKeys.analyticsWhatsAppCalls(days),
    queryFn: () => adminService.getWhatsAppCallAnalytics(days),
    staleTime: 60 * 1000,
  });
}

// ============================================================
// Bulk Operations Hooks
// ============================================================

export function useBulkBanUsers() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userIds, reason }: { userIds: number[]; reason?: string }) =>
      adminService.bulkBanUsers(userIds, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.users() });
      queryClient.invalidateQueries({ queryKey: adminKeys.stats() });
    },
  });
}

export function useBulkUnbanUsers() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userIds: number[]) => adminService.bulkUnbanUsers(userIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.users() });
      queryClient.invalidateQueries({ queryKey: adminKeys.stats() });
    },
  });
}

export function useBulkEnableSms() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userIds: number[]) => adminService.bulkEnableSms(userIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.users() });
    },
  });
}

export function useBulkDisableSms() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userIds: number[]) => adminService.bulkDisableSms(userIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.users() });
    },
  });
}

export function useBulkEnableAutoDialer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userIds: number[]) => adminService.bulkEnableAutoDialer(userIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.users() });
    },
  });
}

export function useBulkDisableAutoDialer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userIds: number[]) => adminService.bulkDisableAutoDialer(userIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.users() });
    },
  });
}

export function useBulkDeleteUsers() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userIds: number[]) => adminService.bulkDeleteUsers(userIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.users() });
      queryClient.invalidateQueries({ queryKey: adminKeys.stats() });
    },
  });
}

// ============================================================
// Export Hooks
// ============================================================

export function useExportUsers() {
  return useMutation({
    mutationFn: (filters?: {
      search?: string;
      role?: string;
      banned?: string;
      organizationId?: string;
    }) => adminService.exportUsers(filters),
  });
}

export function useExportSessions() {
  return useMutation({
    mutationFn: () => adminService.exportSessions(),
  });
}

export function useExportDevices() {
  return useMutation({
    mutationFn: () => adminService.exportDevices(),
  });
}

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
// System Settings Hooks
// ============================================================

export function useSettings() {
  return useQuery({
    queryKey: adminKeys.settings(),
    queryFn: () => adminService.getSettings(),
    staleTime: 60 * 1000, // 1 minute
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
// Organization Hooks
// ============================================================

export function useOrganizations(
  params?: { page?: number; limit?: number; search?: string; status?: string },
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: adminKeys.organizationsList(params),
    queryFn: () => adminService.getOrganizations(params),
    staleTime: 30 * 1000,
    // Self-heal fallback for the real-time billing updates: the app defaults to
    // refetchOnMount:false, so without this a WS ORG_BILLING_CHANGED missed while
    // the admin was away would leave the list stale until a hard reload. Always
    // refetching on mount guarantees a fresh subscription status on every visit.
    refetchOnMount: 'always',
    // The org list is a super-admin-only endpoint; skip the fetch for tenant
    // admins/managers so they don't hit a 403 (with retries) on modal open.
    enabled: options?.enabled ?? true,
  });
}

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

// Org-related mutations use `refetchType: 'all'` on every invalidation so
// that consumers (other pages, dropdowns, modals) see fresh data even if
// they were inactive at the moment of the mutation. Without this, the
// global `refetchOnMount: false` setting (see QueryProvider) makes
// inactive observers serve stale cache until staleTime expires.
const REFETCH_ALL = { refetchType: 'all' as const };

export function useCreateOrganization() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Parameters<typeof adminService.createOrganization>[0]) =>
      adminService.createOrganization(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.organizations(), ...REFETCH_ALL });
      queryClient.invalidateQueries({ queryKey: ['admin2', 'billing'], ...REFETCH_ALL });
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
      queryClient.invalidateQueries({ queryKey: adminKeys.organizations(), ...REFETCH_ALL });
      queryClient.invalidateQueries({
        queryKey: adminKeys.organizationDetail(id),
        ...REFETCH_ALL,
      });
    },
  });
}

export function useDeleteOrganization() {
  const queryClient = useQueryClient();

  return useMutation({
    // Backward-compatible: accepts a bare id (existing callers) OR an object that
    // also opts into releasing the org's Telnyx numbers + disabling its sub-account.
    mutationFn: (arg: number | { id: number; releaseTelnyxSubAccount?: boolean }) => {
      const id = typeof arg === 'number' ? arg : arg.id;
      const releaseTelnyxSubAccount = typeof arg === 'number' ? undefined : arg.releaseTelnyxSubAccount;
      return adminService.deleteOrganization(id, releaseTelnyxSubAccount);
    },
    onSuccess: () => {
      // Closing an org force-logs-out its members and flips their workspace state —
      // refresh orgs, the users list, and the dashboard counts.
      queryClient.invalidateQueries({ queryKey: adminKeys.organizations(), ...REFETCH_ALL });
      queryClient.invalidateQueries({ queryKey: adminKeys.users(), ...REFETCH_ALL });
      queryClient.invalidateQueries({ queryKey: adminKeys.stats() });
    },
  });
}

export function useReactivateOrganization() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => adminService.reactivateOrganization(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.organizations(), ...REFETCH_ALL });
      queryClient.invalidateQueries({ queryKey: adminKeys.users(), ...REFETCH_ALL });
      queryClient.invalidateQueries({ queryKey: adminKeys.stats() });
    },
  });
}

export function usePurgeOrganization() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (arg: number | { id: number; releaseTelnyxSubAccount?: boolean }) => {
      const id = typeof arg === 'number' ? arg : arg.id;
      const releaseTelnyxSubAccount = typeof arg === 'number' ? undefined : arg.releaseTelnyxSubAccount;
      return adminService.purgeOrganization(id, releaseTelnyxSubAccount);
    },
    onSuccess: () => {
      // Purge hard-deletes the org AND its user accounts (members + owner) —
      // the users list and counts must refresh or deleted users linger on screen.
      queryClient.invalidateQueries({ queryKey: adminKeys.organizations(), ...REFETCH_ALL });
      queryClient.invalidateQueries({ queryKey: adminKeys.users(), ...REFETCH_ALL });
      queryClient.invalidateQueries({ queryKey: adminKeys.stats() });
    },
  });
}

export function useAssignUserToOrganization() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userId, organizationId }: { userId: number; organizationId: number }) =>
      adminService.assignUserToOrganization(userId, organizationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.users(), ...REFETCH_ALL });
      queryClient.invalidateQueries({ queryKey: adminKeys.organizations(), ...REFETCH_ALL });
      queryClient.invalidateQueries({ queryKey: adminKeys.unassignedUsers(), ...REFETCH_ALL });
    },
  });
}

export function useRemoveUserFromOrganization() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userId: number) => adminService.removeUserFromOrganization(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.users(), ...REFETCH_ALL });
      queryClient.invalidateQueries({ queryKey: adminKeys.organizations(), ...REFETCH_ALL });
      queryClient.invalidateQueries({ queryKey: adminKeys.unassignedUsers(), ...REFETCH_ALL });
    },
  });
}

export function useUnassignedUsers() {
  return useQuery({
    queryKey: adminKeys.unassignedUsers(),
    queryFn: () => adminService.getUnassignedUsers(),
    staleTime: 30 * 1000,
  });
}
