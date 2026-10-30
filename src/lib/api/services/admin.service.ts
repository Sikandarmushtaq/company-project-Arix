/**
 * Admin Service
 * API service for admin operations
 */

import { apiClient } from '../client';
import type { ApiResponse } from '@/lib/types';

// ============================================================
// Types
// ============================================================

export interface AdminStats {
  totalUsers: number;
  activeUsers: number;
  activeCalls: number;
  activeDevices: number;
  activeSessions: number;
  recentActivity: Array<{
    user: string;
    action: string;
    time: string;
  }>;
  systemStatus: Array<{
    name: string;
    status: 'Operational' | 'Degraded' | 'Down';
  }>;
}

export interface AdminUser {
  id: number;
  fullName: string;
  senderPhone: string;
  email: string;
  role: 'admin' | 'user' | 'manager';
  extension: string;
  sipPassword?: string;
  isActive: boolean;
  banned: boolean;
  banReason?: string;
  smsEnabled: boolean;
  /** Call-recording gate (admin toggle; gates Telnyx recording for the user). */
  recordingEnabled?: boolean;
  autoDialerEnabled: boolean;
  smsType: 'standard' | 'auto' | 'both' | null;
  /** SMS send gateway: 'twilio' (default) or 'telnyx'. Orthogonal to smsType. */
  smsProvider?: 'twilio' | 'telnyx';
  smsLimit: number | null;
  /**
   * Per-user concurrent-login (device) cap. null = inherit the global default;
   * 0 = unlimited; N = at most N devices (oldest evicted on overflow).
   */
  maxLoginSessions?: number | null;
  waEnabled: boolean;
  /**
   * WhatsApp/contacts privacy mode. Hides customer phones in the WA + contacts
   * UI for this agent. Only applicable to role=user; backend silently coerces
   * to false for owner/manager/admin.
   */
  waPhoneMaskEnabled?: boolean;
  bulkSmsInterval: number;
  bulkSmsIntervalControl: boolean;
  userBulkSmsInterval: number | null;
  createdAt: string;
  lastLogin?: string;
  organizationId?: number | null;
  organizationName?: string | null;
}

export interface SmsProvider {
  id: number;
  type: 'standard' | 'auto';
  displayName: string;
  twilioAccountSid: string;
  twilioAuthToken: string; // masked: ••••••XXXX
  enabled: boolean;
  userCount: number;
  updatedAt: string;
}

export interface AdminUserMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface UserParams {
  page?: number;
  limit?: number;
  search?: string;
  role?: string;
  banned?: boolean;
  /** Super-admin only: scope the cross-org user list to a single org. */
  organizationId?: number;
}

export interface CreateUserData {
  fullName: string;
  /** Optional — required only when Voice or SMS capability is enabled. */
  senderPhone?: string;
  email: string;
  password: string;
  role: 'admin' | 'manager' | 'user';
  /** Optional — required only when Voice (calling) capability is enabled. */
  extension?: string;
  sipPassword?: string;
  serverPreference?: 'main' | 'backup';
  smsEnabled?: boolean;
  autoDialerEnabled?: boolean;
  smsType?: 'standard' | 'auto' | 'both' | null;
  smsProvider?: 'twilio' | 'telnyx';
  limitMax?: number;
  callTimeout?: number;
}

export interface ExtensionSettings {
  extension: string;
  effectiveCallerIdName: string | null;
  effectiveCallerIdNumber: string | null;
  outboundCallerIdName: string | null;
  outboundCallerIdNumber: string | null;
  limitMax: number | null;
  callTimeout: number | null;
  enabled: boolean;
}

export interface UpdateUserData {
  fullName?: string;
  email?: string;
  role?: 'admin' | 'user' | 'manager';
  extension?: string;
  isActive?: boolean;
  sipPassword?: string;
  smsType?: 'standard' | 'auto' | 'both' | null;
  smsProvider?: 'twilio' | 'telnyx';
  bulkSmsInterval?: number;
  bulkSmsIntervalControl?: boolean;
  limitMax?: number;
  callTimeout?: number;
}

export interface Device {
  aor: string;
  contact: string;
  userAgent: string;
  expires: number;
  lastRegistered: string;
}

export interface WebSocketConnection {
  socketId: string;
  userId: number;
  userPhone: string;
  userRole: string;
  connectedAt: string;
  rooms: string[];
}

export interface Session {
  id: string;
  sessionId: string;
  userId: number;
  fullName: string;
  userEmail: string;
  userRole: string;
  senderPhone: string;
  deviceName: string | null;
  deviceType: string | null;
  browser: string | null;
  os: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  lastActive: string;
  createdAt: string;
}

export interface SessionStats {
  totalActive: number;
  expiringSoon: number;
  averageDuration: number;
}

export interface BannedUser {
  id: number;
  fullName: string;
  email: string;
  banReason: string;
  bannedAt: string;
}

export interface FailoverStatus {
  primaryServer: string;
  backupServer: string;
  activeServer: 'primary' | 'backup';
  usersOnPrimary: number;
  usersOnBackup: number;
  lastFailover: string | null;
}

export interface RecordingStats {
  totalRecordings: number;
  totalSize: number;
  avgDuration: number;
  oldestRecording: string | null;
}

export interface UserQuota {
  id: number;
  fullName: string;
  email: string;
  sipUsername: string;
  senderPhone: string;
  usedSeconds: number;
  limitSeconds: number;
  usedHours: number;
  limitHours: number;
  percentUsed: number;
  status: 'ok' | 'warning' | 'exceeded';
}

export interface UsersWithQuotasResponse {
  users: UserQuota[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface PhoneNumber {
  id: number;
  phoneNumber: string;
  label: string | null;
  isPrimary: boolean;
  smsEnabled: boolean;
  autoSmsEnabled: boolean;
  aiDialerEnabled?: boolean;
  elevenlabsPhoneId?: string | null;
  userId: number;
  createdAt?: string;
}

// Audit Log Types
export interface AuditLog {
  id: number;
  action: string;
  adminId: number;
  adminName: string;
  adminEmail: string;
  targetType: 'user' | 'device' | 'session' | 'system' | 'recording' | 'settings';
  targetId: string | null;
  targetName: string | null;
  details: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

export interface AuditLogFilters {
  action?: string;
  adminId?: number;
  targetType?: string;
  targetId?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
}

export interface AuditLogMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface AuditStats {
  totalLogs: number;
  todayLogs: number;
  topActions: { action: string; count: number }[];
  topAdmins: { adminName: string; count: number }[];
}

// Analytics Types
export interface TimeSeriesPoint {
  date: string;
  value: number;
}

export interface CallStats {
  answered: number;
  missed: number;
  voicemail: number;
  total: number;
}

export interface SmsStats {
  sent: number;
  received: number;
  failed: number;
  total: number;
}

export interface UserGrowthStats {
  total: number;
  newThisWeek: number;
  newThisMonth: number;
  activeToday: number;
}

export interface CampaignStats {
  active: number;
  completed: number;
  totalCalls: number;
  successRate: number;
}

export interface AnalyticsOverview {
  calls: CallStats;
  sms: SmsStats;
  users: UserGrowthStats;
  campaigns: CampaignStats;
}

export interface TimeSeriesData {
  calls: TimeSeriesPoint[];
  sms: TimeSeriesPoint[];
  signups: TimeSeriesPoint[];
}

export interface CallAnalytics {
  timeSeries: TimeSeriesPoint[];
  stats: CallStats;
  hourly: { hour: number; value: number }[];
}

export interface SmsAnalytics {
  timeSeries: TimeSeriesPoint[];
  stats: SmsStats;
}

export interface UserAnalytics {
  timeSeries: TimeSeriesPoint[];
  stats: UserGrowthStats;
  topCallers: { phone: string; name: string | null; count: number }[];
}

// ============================================================
// Admin Service Class
// ============================================================

/**
 * Active call interface for Live Call Monitor
 */
export interface ActiveCall {
  id: string;
  callerId: string;
  callerName: string;
  calleeId: string;
  calleeName: string;
  direction: 'inbound' | 'outbound';
  status: 'ringing' | 'active' | 'on-hold';
  startTime: string;
  duration: number;
  extension: string;
  userPhone: string;
  remotePhone: string;
  isRecording: boolean;
  isMuted: boolean;
  isOnHold: boolean;
  isStale?: boolean; // True if call record is orphaned/stale
}

class AdminService {
  // Dashboard
  async getStats(): Promise<AdminStats> {
    const response = await apiClient.get<ApiResponse<AdminStats>>('/admin/stats');
    return response.data;
  }

  /**
   * Get active/ongoing calls for Live Call Monitor
   * @param includeStale - If true, includes stale calls with isStale flag
   */
  async getLiveCalls(includeStale = true): Promise<ActiveCall[]> {
    const response = await apiClient.get<ApiResponse<ActiveCall[]>>('/admin/live-calls', {
      params: { includeStale: includeStale ? 'true' : 'false' },
    });
    return response.data;
  }

  /**
   * Clear a specific stale call from Live Call Monitor
   */
  async clearStaleCall(callId: string): Promise<void> {
    await apiClient.delete<ApiResponse<{ message: string }>>(`/admin/live-calls/${callId}`);
  }

  /**
   * Clear all stale calls from Live Call Monitor
   */
  async clearAllStaleCalls(): Promise<{ clearedCount: number }> {
    const response =
      await apiClient.delete<ApiResponse<{ clearedCount: number }>>('/admin/live-calls/stale');
    return response.data;
  }

  // Users
  async getUsers(params?: UserParams): Promise<{ users: AdminUser[]; meta: AdminUserMeta }> {
    const response = await apiClient.get<ApiResponse<AdminUser[]> & { meta: AdminUserMeta }>(
      '/admin/users',
      { params: params as Record<string, string | number | boolean | undefined> }
    );
    return { users: response.data, meta: response.meta };
  }

  async getUser(id: number): Promise<AdminUser> {
    const response = await apiClient.get<ApiResponse<AdminUser>>(`/admin/users/${id}`);
    return response.data;
  }

  async getUserExtensionSettings(id: number): Promise<{
    success: boolean;
    data?: ExtensionSettings;
    error?: { message: string };
  }> {
    const response = await apiClient.get<{
      success: boolean;
      data?: ExtensionSettings;
      error?: { message: string };
    }>(`/admin/users/${id}/extension-settings`);
    return response;
  }

  async createUser(data: CreateUserData): Promise<AdminUser> {
    const response = await apiClient.post<ApiResponse<AdminUser>>('/admin/users', data);
    return response.data;
  }

  async updateUser(id: number, data: UpdateUserData): Promise<AdminUser> {
    const response = await apiClient.put<ApiResponse<AdminUser>>(`/admin/users/${id}`, data);
    return response.data;
  }

  async deleteUser(id: number, releaseNumbers = false): Promise<void> {
    // Default keeps the user's number in the org (freed for reassignment). Pass
    // releaseNumbers=true to also release the DID back to Telnyx + stop billing.
    await apiClient.delete(`/admin/users/${id}${releaseNumbers ? '?releaseNumber=true' : ''}`);
  }

  async setBanStatus(id: number, banned: boolean, reason?: string): Promise<AdminUser> {
    const response = await apiClient.put<ApiResponse<AdminUser>>(`/admin/users/${id}/ban`, {
      banned,
      reason,
    });
    return response.data;
  }

  async toggleSms(id: number, enabled: boolean): Promise<AdminUser> {
    const response = await apiClient.put<ApiResponse<AdminUser>>(`/admin/users/${id}/sms`, {
      enabled,
    });
    return response.data;
  }

  async toggleAutoDialer(id: number, enabled: boolean): Promise<AdminUser> {
    const response = await apiClient.put<ApiResponse<AdminUser>>(`/admin/users/${id}/auto-dialer`, {
      enabled,
    });
    return response.data;
  }

  async toggleRecording(id: number, enabled: boolean): Promise<AdminUser> {
    const response = await apiClient.put<ApiResponse<AdminUser>>(`/admin/users/${id}/recording`, {
      enabled,
    });
    return response.data;
  }

  async updateUserPassword(id: number, password: string): Promise<void> {
    await apiClient.put(`/admin/users/${id}/password`, { password });
  }

  async forceLogout(id: number): Promise<number> {
    const response = await apiClient.put<ApiResponse<{ terminatedSessions: number }>>(
      `/admin/users/${id}/force-logout`,
      {}
    );
    return response.data.terminatedSessions;
  }

  async setSmsLimit(id: number, limit: number | null): Promise<AdminUser> {
    const response = await apiClient.put<ApiResponse<AdminUser>>(`/admin/users/${id}/sms-limit`, {
      limit,
    });
    return response.data;
  }

  async transferPhoneNumber(
    fromUserId: number,
    toUserId: number,
    phoneNumber: string
  ): Promise<void> {
    await apiClient.post(`/admin/users/${fromUserId}/transfer`, { toUserId, phoneNumber });
  }

  // Phone Numbers
  async getUserPhoneNumbers(userId: number): Promise<PhoneNumber[]> {
    const response = await apiClient.get<ApiResponse<PhoneNumber[]>>(
      `/admin/numbers/user/${userId}`
    );
    return response.data;
  }

  async addPhoneNumber(
    userId: number,
    phoneNumber: string,
    label?: string,
    isPrimary?: boolean
  ): Promise<PhoneNumber> {
    const response = await apiClient.post<ApiResponse<PhoneNumber>>('/admin/numbers', {
      userId,
      phoneNumber,
      label,
      isPrimary,
    });
    return response.data;
  }

  async removePhoneNumber(numberId: number): Promise<void> {
    await apiClient.delete(`/admin/numbers/${numberId}`);
  }

  async setDefaultPhoneNumber(userId: number, numberId: number): Promise<void> {
    await apiClient.patch(`/admin/users/${userId}/phone-numbers/${numberId}/default`);
  }

  async toggleAutoSms(userId: number, numberId: number, enabled: boolean): Promise<void> {
    await apiClient.patch(`/admin/users/${userId}/phone-numbers/${numberId}/sending`, {
      enabled,
    });
  }

  async toggleAiDialer(
    userId: number,
    numberId: number,
    enabled: boolean,
    elevenlabsPhoneId?: string
  ): Promise<void> {
    await apiClient.patch(`/admin/users/${userId}/phone-numbers/${numberId}/ai-dialer`, {
      enabled,
      elevenlabsPhoneId,
    });
  }

  // Devices
  async getDevices(): Promise<Device[]> {
    const response = await apiClient.get<ApiResponse<Device[]>>('/admin/devices');
    return response.data;
  }

  async getUserDevices(aor: string): Promise<Device[]> {
    const response = await apiClient.get<ApiResponse<Device[]>>(
      `/admin/devices/user/${encodeURIComponent(aor)}`
    );
    return response.data;
  }

  async kickDevice(contact: string): Promise<void> {
    await apiClient.post('/admin/devices/kick', { contact });
  }

  async banDevice(contact: string, duration?: number): Promise<void> {
    await apiClient.post('/admin/devices/ban', { contact, duration });
  }

  // WebSocket Connections
  async getConnections(): Promise<WebSocketConnection[]> {
    const response = await apiClient.get<ApiResponse<WebSocketConnection[]>>('/admin/connections');
    return response.data;
  }

  async kickConnection(socketId: string): Promise<void> {
    await apiClient.post('/admin/connections/kick', { socketId });
  }

  async kickUserConnections(userId: number): Promise<number> {
    const response = await apiClient.post<ApiResponse<{ kickedCount: number }>>(
      `/admin/connections/kick-user/${userId}`,
      {}
    );
    return response.data.kickedCount;
  }

  async banIpFromConnection(
    socketId: string,
    reason?: string
  ): Promise<{ banned: boolean; ip?: string }> {
    const response = await apiClient.post<ApiResponse<{ banned: boolean; ip?: string }>>(
      '/admin/connections/ban-ip',
      { socketId, reason }
    );
    return response.data;
  }

  async getIpBans(): Promise<
    Array<{
      id: number;
      ipAddress: string;
      reason: string | null;
      bannedBy: number | null;
      createdAt: string;
      expiresAt: string | null;
    }>
  > {
    const response = await apiClient.get<
      ApiResponse<
        Array<{
          id: number;
          ipAddress: string;
          reason: string | null;
          bannedBy: number | null;
          createdAt: string;
          expiresAt: string | null;
        }>
      >
    >('/admin/ip-bans');
    return response.data;
  }

  async unbanIp(ipAddress: string): Promise<boolean> {
    const response = await apiClient.delete<ApiResponse<{ unbanned: boolean }>>(
      `/admin/ip-bans/${encodeURIComponent(ipAddress)}`
    );
    return response.data.unbanned;
  }

  // Sessions
  async getSessions(
    params: {
      page?: number;
      limit?: number;
      search?: string;
    } = {}
  ): Promise<{
    sessions: Session[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const response = await apiClient.get<
      ApiResponse<{
        sessions: Session[];
        total: number;
        page: number;
        limit: number;
        totalPages: number;
      }>
    >('/admin/sessions', {
      params: {
        page: params.page || 1,
        limit: params.limit || 50,
        ...(params.search ? { search: params.search } : {}),
      },
    });
    return response.data;
  }

  async getSessionStats(): Promise<SessionStats> {
    const response = await apiClient.get<ApiResponse<SessionStats>>('/admin/sessions/stats');
    return response.data;
  }

  async logoutSession(sessionId: string): Promise<void> {
    await apiClient.post(`/admin/sessions/${sessionId}/logout`, {});
  }

  async logoutAllSessions(): Promise<number> {
    const response = await apiClient.post<ApiResponse<{ terminatedSessions: number }>>(
      '/admin/sessions/logout-all',
      {}
    );
    return response.data.terminatedSessions;
  }

  // Bans
  async getBannedUsers(
    params: {
      page?: number;
      limit?: number;
      search?: string;
    } = {}
  ): Promise<{
    users: BannedUser[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const response = await apiClient.get<
      ApiResponse<{
        users: BannedUser[];
        total: number;
        page: number;
        limit: number;
        totalPages: number;
      }>
    >('/admin/bans/users', {
      params: {
        page: params.page || 1,
        limit: params.limit || 50,
        ...(params.search ? { search: params.search } : {}),
      },
    });
    return response.data;
  }

  async getTempBans(): Promise<Array<{ ip: string; reason: string; expiresAt: string }>> {
    const response =
      await apiClient.get<ApiResponse<Array<{ ip: string; reason: string; expiresAt: string }>>>(
        '/admin/bans/temp'
      );
    return response.data;
  }

  async getDeviceBans(): Promise<Array<{ contact: string; reason: string; expiresAt: string }>> {
    const response =
      await apiClient.get<
        ApiResponse<Array<{ contact: string; reason: string; expiresAt: string }>>
      >('/admin/bans/devices');
    return response.data;
  }

  // Failover
  async getFailoverStatus(): Promise<FailoverStatus> {
    const response = await apiClient.get<ApiResponse<FailoverStatus>>('/admin/failover/status');
    return response.data;
  }

  async switchAllToBackup(): Promise<number> {
    const response = await apiClient.post<ApiResponse<{ switchedUsers: number }>>(
      '/admin/failover/switch-all',
      {}
    );
    return response.data.switchedUsers;
  }

  async switchUserServer(userId: number, server: 'primary' | 'backup'): Promise<void> {
    await apiClient.post('/admin/failover/switch-user', { userId, server });
  }

  // Recordings
  async getRecordingStats(): Promise<RecordingStats> {
    const response = await apiClient.get<ApiResponse<RecordingStats>>('/admin/recordings/stats');
    return response.data;
  }

  async deleteOldRecordings(days: number = 30): Promise<number> {
    const response = await apiClient.delete<ApiResponse<{ deleted: number }>>(
      '/admin/recordings/old',
      { params: { days } }
    );
    return response.data.deleted;
  }

  async getUsersWithQuotas(params?: {
    page?: number;
    limit?: number;
    search?: string;
  }): Promise<UsersWithQuotasResponse> {
    const response = await apiClient.get<ApiResponse<UsersWithQuotasResponse>>(
      '/admin/recordings/quotas',
      { params }
    );
    return response.data;
  }

  async updateUserQuota(sipUsername: string, limitHours: number): Promise<void> {
    await apiClient.put(`/admin/recordings/quotas/${encodeURIComponent(sipUsername)}`, {
      limitHours,
    });
  }

  // Audit Logs
  async getAuditLogs(
    filters?: AuditLogFilters & { page?: number; limit?: number }
  ): Promise<{ logs: AuditLog[]; meta: AuditLogMeta }> {
    const response = await apiClient.get<ApiResponse<AuditLog[]> & { meta: AuditLogMeta }>(
      '/admin/audit',
      { params: filters as Record<string, string | number | boolean | undefined> }
    );
    return { logs: response.data, meta: response.meta };
  }

  async getAuditLog(id: number): Promise<AuditLog> {
    const response = await apiClient.get<ApiResponse<AuditLog>>(`/admin/audit/${id}`);
    return response.data;
  }

  async getAuditStats(): Promise<AuditStats> {
    const response = await apiClient.get<ApiResponse<AuditStats>>('/admin/audit/stats');
    return response.data;
  }

  async getAuditActions(): Promise<string[]> {
    const response = await apiClient.get<ApiResponse<string[]>>('/admin/audit/actions');
    return response.data;
  }

  async cleanupAuditLogs(days: number = 90): Promise<number> {
    const response = await apiClient.delete<ApiResponse<{ deleted: number }>>(
      '/admin/audit/cleanup',
      { params: { days } }
    );
    return response.data.deleted;
  }

  // Analytics
  async getAnalyticsOverview(): Promise<AnalyticsOverview> {
    const response = await apiClient.get<ApiResponse<AnalyticsOverview>>(
      '/admin/analytics/overview'
    );
    return response.data;
  }

  async getTimeSeriesData(days: number = 30): Promise<TimeSeriesData> {
    const response = await apiClient.get<ApiResponse<TimeSeriesData>>(
      '/admin/analytics/timeseries',
      {
        params: { days },
      }
    );
    return response.data;
  }

  async getCallAnalytics(days: number = 30): Promise<CallAnalytics> {
    const response = await apiClient.get<ApiResponse<CallAnalytics>>('/admin/analytics/calls', {
      params: { days },
    });
    return response.data;
  }

  async getSmsAnalytics(days: number = 30): Promise<SmsAnalytics> {
    const response = await apiClient.get<ApiResponse<SmsAnalytics>>('/admin/analytics/sms', {
      params: { days },
    });
    return response.data;
  }

  async getUserAnalytics(days: number = 30): Promise<UserAnalytics> {
    const response = await apiClient.get<ApiResponse<UserAnalytics>>('/admin/analytics/users', {
      params: { days },
    });
    return response.data;
  }

  async getCampaignAnalytics(): Promise<CampaignStats> {
    const response = await apiClient.get<ApiResponse<CampaignStats>>('/admin/analytics/campaigns');
    return response.data;
  }

  async getWhatsAppCallAnalytics(days: number = 30): Promise<{
    stats: {
      total: number;
      inbound: number;
      outbound: number;
      answered: number;
      missed: number;
      avgDuration: number;
    };
    timeSeries: Array<{ date: string; value: number }>;
    hourly: Array<{ hour: number; value: number }>;
  }> {
    const response = await apiClient.get('/admin/analytics/whatsapp-calls', { params: { days } });
    return (response as { data: any }).data;
  }

  // Bulk Operations
  async bulkBanUsers(userIds: number[], reason?: string): Promise<{ affected: number }> {
    const response = await apiClient.post<ApiResponse<{ affected: number }>>(
      '/admin/users/bulk/ban',
      {
        userIds,
        reason,
      }
    );
    return response.data;
  }

  async bulkUnbanUsers(userIds: number[]): Promise<{ affected: number }> {
    const response = await apiClient.post<ApiResponse<{ affected: number }>>(
      '/admin/users/bulk/unban',
      {
        userIds,
      }
    );
    return response.data;
  }

  async bulkEnableSms(userIds: number[]): Promise<{ affected: number }> {
    const response = await apiClient.post<ApiResponse<{ affected: number }>>(
      '/admin/users/bulk/enable-sms',
      {
        userIds,
      }
    );
    return response.data;
  }

  async bulkDisableSms(userIds: number[]): Promise<{ affected: number }> {
    const response = await apiClient.post<ApiResponse<{ affected: number }>>(
      '/admin/users/bulk/disable-sms',
      {
        userIds,
      }
    );
    return response.data;
  }

  async bulkEnableAutoDialer(userIds: number[]): Promise<{ affected: number }> {
    const response = await apiClient.post<ApiResponse<{ affected: number }>>(
      '/admin/users/bulk/enable-autodialer',
      {
        userIds,
      }
    );
    return response.data;
  }

  async bulkDisableAutoDialer(userIds: number[]): Promise<{ affected: number }> {
    const response = await apiClient.post<ApiResponse<{ affected: number }>>(
      '/admin/users/bulk/disable-autodialer',
      {
        userIds,
      }
    );
    return response.data;
  }

  async bulkEnableWhatsApp(userIds: number[]): Promise<{ affected: number }> {
    const response = await apiClient.post<ApiResponse<{ affected: number }>>(
      '/whatsapp/admin/users/bulk/enable-wa',
      { userIds }
    );
    return response.data;
  }

  async bulkDisableWhatsApp(userIds: number[]): Promise<{ affected: number }> {
    const response = await apiClient.post<ApiResponse<{ affected: number }>>(
      '/whatsapp/admin/users/bulk/disable-wa',
      { userIds }
    );
    return response.data;
  }

  async bulkDeleteUsers(userIds: number[]): Promise<{ affected: number }> {
    const response = await apiClient.post<ApiResponse<{ affected: number }>>(
      '/admin/users/bulk/delete',
      {
        userIds,
      }
    );
    return response.data;
  }

  // ============================================================
  // SMS Providers
  // ============================================================

  async getSmsProviders(): Promise<SmsProvider[]> {
    const response = await apiClient.get<ApiResponse<SmsProvider[]>>('/sms/admin/providers');
    return response.data;
  }

  async upsertSmsProvider(
    type: 'standard' | 'auto',
    data: { displayName: string; twilioAccountSid: string; twilioAuthToken: string }
  ): Promise<SmsProvider> {
    const response = await apiClient.put<ApiResponse<SmsProvider>>(
      `/sms/admin/providers/${type}`,
      data
    );
    return response.data;
  }

  async toggleSmsProvider(type: 'standard' | 'auto', enabled: boolean): Promise<void> {
    await apiClient.patch(`/sms/admin/providers/${type}/toggle`, { enabled });
  }

  // ============================================================
  // Data Export
  // ============================================================

  /**
   * Download a CSV export file
   */
  private async downloadCsv(
    endpoint: string,
    filename: string,
    params?: Record<string, string>
  ): Promise<void> {
    const queryString = params ? `?${new URLSearchParams(params)}` : '';
    const url = `${process.env.NEXT_PUBLIC_API_URL || ''}/api/v1/admin/export/${endpoint}${queryString}`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('token')}`,
      },
    });

    if (!response.ok) {
      throw new Error('Export failed');
    }

    const blob = await response.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(downloadUrl);
  }

  async exportUsers(filters?: {
    search?: string;
    role?: string;
    banned?: string;
    organizationId?: string;
  }): Promise<void> {
    await this.downloadCsv('users', `users-${Date.now()}.csv`, filters as Record<string, string>);
  }

  async exportSessions(): Promise<void> {
    await this.downloadCsv('sessions', `sessions-${Date.now()}.csv`);
  }

  async exportDevices(): Promise<void> {
    await this.downloadCsv('devices', `devices-${Date.now()}.csv`);
  }

  async exportAuditLogs(filters?: {
    action?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<void> {
    await this.downloadCsv(
      'audit-logs',
      `audit-logs-${Date.now()}.csv`,
      filters as Record<string, string>
    );
  }

  async exportCalls(filters?: {
    startDate?: string;
    endDate?: string;
    direction?: string;
    status?: string;
  }): Promise<void> {
    await this.downloadCsv('calls', `calls-${Date.now()}.csv`, filters as Record<string, string>);
  }

  async exportSms(filters?: {
    startDate?: string;
    endDate?: string;
    direction?: string;
  }): Promise<void> {
    await this.downloadCsv('sms', `sms-${Date.now()}.csv`, filters as Record<string, string>);
  }

  async exportVoicemails(filters?: {
    startDate?: string;
    endDate?: string;
    read?: string;
  }): Promise<void> {
    await this.downloadCsv(
      'voicemails',
      `voicemails-${Date.now()}.csv`,
      filters as Record<string, string>
    );
  }

  async exportRecordings(filters?: { startDate?: string; endDate?: string }): Promise<void> {
    await this.downloadCsv(
      'recordings',
      `recordings-${Date.now()}.csv`,
      filters as Record<string, string>
    );
  }

  // ============================================================
  // System Settings
  // ============================================================

  async getSettings(): Promise<SystemSettings> {
    const response = await apiClient.get<ApiResponse<SystemSettings>>('/admin/settings');
    return response.data;
  }

  async updateSettings(settings: Partial<SystemSettings>): Promise<SystemSettings> {
    const response = await apiClient.put<ApiResponse<SystemSettings>>('/admin/settings', settings);
    return response.data;
  }

  // ============================================================
  // Organizations
  // ============================================================

  async getOrganizations(params?: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
  }): Promise<{ organizations: Organization[]; meta: OrganizationMeta }> {
    const response = await apiClient.get<ApiResponse<Organization[]> & { meta: OrganizationMeta }>(
      '/admin/organizations',
      { params: params as Record<string, string | number | boolean | undefined> }
    );
    return { organizations: response.data, meta: response.meta };
  }

  async getOrganization(id: number): Promise<Organization> {
    const response = await apiClient.get<ApiResponse<Organization>>(`/admin/organizations/${id}`);
    return response.data;
  }

  async createOrganization(data: CreateOrganizationData): Promise<Organization> {
    const response = await apiClient.post<ApiResponse<Organization>>('/admin/organizations', data);
    return response.data;
  }

  async updateOrganization(id: number, data: UpdateOrganizationData): Promise<Organization> {
    const response = await apiClient.put<ApiResponse<Organization>>(
      `/admin/organizations/${id}`,
      data
    );
    return response.data;
  }

  /** CLOSE an org (reversible, 30-day grace before auto-purge). */
  async deleteOrganization(id: number, releaseTelnyxSubAccount?: boolean): Promise<void> {
    await apiClient.delete(`/admin/organizations/${id}`, {
      data: { releaseTelnyxSubAccount: releaseTelnyxSubAccount === true },
    });
  }

  /** Reactivate a closed org within its grace window. */
  async reactivateOrganization(id: number): Promise<void> {
    await apiClient.post(`/admin/organizations/${id}/reactivate`, {});
  }

  /** DISABLE an org (reversible lockout — members blocked, owner dialer-gated). */
  async disableOrganization(id: number): Promise<void> {
    await apiClient.post(`/admin/organizations/${id}/disable`, {});
  }

  /** ENABLE a disabled org (reversal of disable). */
  async enableOrganization(id: number): Promise<void> {
    await apiClient.post(`/admin/organizations/${id}/enable`, {});
  }

  /** PERMANENTLY delete (hard purge) an org and all its data. Irreversible. */
  async purgeOrganization(id: number, releaseTelnyxSubAccount?: boolean): Promise<void> {
    await apiClient.delete(`/admin/organizations/${id}/permanent`, {
      data: { releaseTelnyxSubAccount: releaseTelnyxSubAccount === true },
    });
  }

  /** RESET an organization's trial data (comms, contacts, recordings, quotas). */
  async resetOrganization(id: number): Promise<{
    subUsersDeleted: number;
    callsCleared: boolean;
    smsCleared: boolean;
    contactsCleared: boolean;
    recordingsCleared: boolean;
    externalCleanupWarnings: string[];
  }> {
    const response = await apiClient.post<ApiResponse<{
      subUsersDeleted: number;
      callsCleared: boolean;
      smsCleared: boolean;
      contactsCleared: boolean;
      recordingsCleared: boolean;
      externalCleanupWarnings: string[];
    }>>(`/admin/organizations/${id}/reset`, {});
    return response.data;
  }

  async getOrganizationStats(
    id: number,
    range?: { from?: string; to?: string }
  ): Promise<OrganizationStats> {
    const response = await apiClient.get<ApiResponse<OrganizationStats>>(
      `/admin/organizations/${id}/stats`,
      { params: { from: range?.from, to: range?.to } }
    );
    return response.data;
  }

  async getOrganizationUsers(
    id: number,
    params?: { page?: number; limit?: number }
  ): Promise<{ users: AdminUser[]; meta: AdminUserMeta }> {
    const response = await apiClient.get<ApiResponse<AdminUser[]> & { meta: AdminUserMeta }>(
      `/admin/organizations/${id}/users`,
      { params: params as Record<string, string | number | boolean | undefined> }
    );
    return { users: response.data, meta: response.meta };
  }

  async assignUserToOrganization(userId: number, organizationId: number): Promise<void> {
    await apiClient.put(`/admin/users/${userId}/organization`, { organizationId });
  }

  async removeUserFromOrganization(userId: number): Promise<void> {
    await apiClient.delete(`/admin/users/${userId}/organization`);
  }

  async getUnassignedUsers(): Promise<AdminUser[]> {
    const response = await apiClient.get<ApiResponse<AdminUser[]>>('/admin/users/unassigned');
    return response.data;
  }
}

// ============================================================
// Organization Types
// ============================================================

export interface Organization {
  id: number;
  name: string;
  slug: string;
  isActive: boolean;
  /** Lifecycle status: 'active' | 'disabled' | 'closed'. */
  status?: string;
  maxUsers: number;
  maxPhoneNumbers: number;
  /** Subscription state: active | canceling | past_due | suspended. */
  billingStatus?: string;
  settings: Record<string, unknown> | null;
  createdBy: number | null;
  createdAt: string;
  updatedAt: string;
  userCount?: number;
  /** Phone numbers the org currently holds — for the list "used / cap" column. */
  numberCount?: number;
}

export interface OrganizationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface OrganizationStats {
  totalUsers: number;
  activeUsers: number;
  totalCalls: number;
  totalSms: number;
  managerCount?: number;
  recordingCount?: number;
}

export interface CreateOrganizationData {
  name: string;
  slug?: string;
  maxUsers?: number;
  maxPhoneNumbers?: number;
  isActive?: boolean;
}

export interface UpdateOrganizationData {
  name?: string;
  slug?: string;
  maxUsers?: number;
  maxPhoneNumbers?: number;
  isActive?: boolean;
  settings?: Record<string, unknown>;
}

// System Settings Types
export interface SystemSettings {
  sipServer: string;
  sipPort: string;
  sipTransport: string;
  sipRealm: string;
  recordingsEnabled: boolean;
  recordingsPath: string;
  maxCallDuration: number;
  smtpServer: string;
  smtpPort: string;
  smtpUser: string;
  smtpPassword: string;
  sessionTimeout: number;
  maxLoginAttempts: number;
  /**
   * Global default for max concurrent logged-in devices per user. A user's own
   * override (admin_users.max_login_sessions) wins. 0 = unlimited (feature off).
   */
  maxLoginSessions: number;
  banDuration: number;
  maintenanceMode: boolean;
  maintenanceMessage: string;
  // FreePBX Server Configuration
  mainServerDomain: string;
  mainServerWssPort: string;
  mainServerWssPath: string;
  backupServerDomain: string;
  backupServerWssPort: string;
  backupServerWssPath: string;
}

export const adminService = new AdminService();
