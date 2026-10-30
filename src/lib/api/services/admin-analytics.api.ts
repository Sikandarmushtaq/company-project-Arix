/**
 * Admin Analytics API Service
 * Stats, analytics, audit logs, recordings, and system settings
 */

import { apiClient } from '../client';
import type { ApiResponse } from '@/lib/types';
import { downloadCsv } from './admin-user.api';

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
  isStale?: boolean;
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

// Organization Types
export interface Organization {
  id: number;
  name: string;
  slug: string;
  isActive: boolean;
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

// ============================================================
// Dashboard & Stats API Methods
// ============================================================

export async function getStats(): Promise<AdminStats> {
  const response = await apiClient.get<ApiResponse<AdminStats>>('/admin/stats');
  return response.data;
}

export async function getLiveCalls(includeStale = true): Promise<ActiveCall[]> {
  const response = await apiClient.get<ApiResponse<ActiveCall[]>>('/admin/live-calls', {
    params: { includeStale: includeStale ? 'true' : 'false' },
  });
  return response.data;
}

export async function clearStaleCall(callId: string): Promise<void> {
  await apiClient.delete<ApiResponse<{ message: string }>>(`/admin/live-calls/${callId}`);
}

export async function clearAllStaleCalls(): Promise<{ clearedCount: number }> {
  const response =
    await apiClient.delete<ApiResponse<{ clearedCount: number }>>('/admin/live-calls/stale');
  return response.data;
}

// Failover
export async function getFailoverStatus(): Promise<FailoverStatus> {
  const response = await apiClient.get<ApiResponse<FailoverStatus>>('/admin/failover/status');
  return response.data;
}

export async function switchAllToBackup(): Promise<number> {
  const response = await apiClient.post<ApiResponse<{ switchedUsers: number }>>(
    '/admin/failover/switch-all',
    {}
  );
  return response.data.switchedUsers;
}

export async function switchUserServer(
  userId: number,
  server: 'primary' | 'backup'
): Promise<void> {
  await apiClient.post('/admin/failover/switch-user', { userId, server });
}

// Recordings
export async function getRecordingStats(): Promise<RecordingStats> {
  const response = await apiClient.get<ApiResponse<RecordingStats>>('/admin/recordings/stats');
  return response.data;
}

export async function deleteOldRecordings(days: number = 30): Promise<number> {
  const response = await apiClient.delete<ApiResponse<{ deleted: number }>>(
    '/admin/recordings/old',
    { params: { days } }
  );
  return response.data.deleted;
}

export async function getUsersWithQuotas(params?: {
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

export async function updateUserQuota(sipUsername: string, limitHours: number): Promise<void> {
  await apiClient.put(`/admin/recordings/quotas/${encodeURIComponent(sipUsername)}`, {
    limitHours,
  });
}

// Audit Logs
export async function getAuditLogs(
  filters?: AuditLogFilters & { page?: number; limit?: number }
): Promise<{ logs: AuditLog[]; meta: AuditLogMeta }> {
  const response = await apiClient.get<ApiResponse<AuditLog[]> & { meta: AuditLogMeta }>(
    '/admin/audit',
    { params: filters as Record<string, string | number | boolean | undefined> }
  );
  return { logs: response.data, meta: response.meta };
}

export async function getAuditLog(id: number): Promise<AuditLog> {
  const response = await apiClient.get<ApiResponse<AuditLog>>(`/admin/audit/${id}`);
  return response.data;
}

export async function getAuditStats(): Promise<AuditStats> {
  const response = await apiClient.get<ApiResponse<AuditStats>>('/admin/audit/stats');
  return response.data;
}

export async function getAuditActions(): Promise<string[]> {
  const response = await apiClient.get<ApiResponse<string[]>>('/admin/audit/actions');
  return response.data;
}

export async function cleanupAuditLogs(days: number = 90): Promise<number> {
  const response = await apiClient.delete<ApiResponse<{ deleted: number }>>(
    '/admin/audit/cleanup',
    { params: { days } }
  );
  return response.data.deleted;
}

// Analytics
export async function getAnalyticsOverview(): Promise<AnalyticsOverview> {
  const response = await apiClient.get<ApiResponse<AnalyticsOverview>>('/admin/analytics/overview');
  return response.data;
}

export async function getTimeSeriesData(days: number = 30): Promise<TimeSeriesData> {
  const response = await apiClient.get<ApiResponse<TimeSeriesData>>('/admin/analytics/timeseries', {
    params: { days },
  });
  return response.data;
}

export async function getCallAnalytics(days: number = 30): Promise<CallAnalytics> {
  const response = await apiClient.get<ApiResponse<CallAnalytics>>('/admin/analytics/calls', {
    params: { days },
  });
  return response.data;
}

// CDR-backed call performance (accurate volume + MOS + hangup), bucketed
// day/week/month in Europe/London, optional per-agent + direction filter.
export interface CallPerfBucket {
  bucket: string;
  calls: number;
  inbound: number;
  outbound: number;
  connected: number;
  talkSec: number;
  avgMos: number | null;
  belowMos3: number;
  mosScored: number;
}
export interface CallPerformanceResponse {
  buckets: CallPerfBucket[];
  totals: Omit<CallPerfBucket, 'bucket'>;
}
export interface CallPerformanceParams {
  startDate: string;
  endDate: string;
  granularity: 'day' | 'week' | 'month';
  agentUserId?: number;
  direction?: 'inbound' | 'outbound';
}
export async function getCallPerformance(
  params: CallPerformanceParams
): Promise<CallPerformanceResponse> {
  const response = await apiClient.get<ApiResponse<CallPerformanceResponse>>(
    '/admin/analytics/call-performance',
    {
      params: {
        startDate: params.startDate,
        endDate: params.endDate,
        granularity: params.granularity,
        ...(params.agentUserId != null ? { agentUserId: params.agentUserId } : {}),
        ...(params.direction ? { direction: params.direction } : {}),
      },
    }
  );
  return response.data;
}

// Per-agent leaderboard (CDR-backed) over a range.
export interface AgentLeaderEntry {
  userId: number;
  name: string;
  did: string;
  calls: number;
  inbound: number;
  outbound: number;
  connected: number;
  talkSec: number;
  avgMos: number | null;
  belowMos3: number;
  mosScored: number;
  lastActive: string | null;
}
export interface AgentLeaderboardParams {
  startDate: string;
  endDate: string;
  direction?: 'inbound' | 'outbound';
}
export async function getAgentLeaderboard(
  params: AgentLeaderboardParams
): Promise<AgentLeaderEntry[]> {
  const response = await apiClient.get<ApiResponse<AgentLeaderEntry[]>>(
    '/admin/analytics/agent-leaderboard',
    {
      params: {
        startDate: params.startDate,
        endDate: params.endDate,
        ...(params.direction ? { direction: params.direction } : {}),
      },
    }
  );
  return response.data;
}

// Org-scoped agent list for filter dropdowns. Unlike /admin/users (which needs
// view.users, denied to managers), this is gated by view.dashboard so managers
// can populate the per-agent filters on recordings/analytics.
export interface OrgAgent {
  id: number;
  name: string;
  senderPhone: string;
}
export async function getOrgAgents(organizationId?: number): Promise<OrgAgent[]> {
  const response = await apiClient.get<ApiResponse<OrgAgent[]>>('/admin/agents', {
    params: organizationId ? { org_id: organizationId } : undefined,
  });
  return response.data;
}

export async function getSmsAnalytics(days: number = 30): Promise<SmsAnalytics> {
  const response = await apiClient.get<ApiResponse<SmsAnalytics>>('/admin/analytics/sms', {
    params: { days },
  });
  return response.data;
}

export async function getUserAnalytics(days: number = 30): Promise<UserAnalytics> {
  const response = await apiClient.get<ApiResponse<UserAnalytics>>('/admin/analytics/users', {
    params: { days },
  });
  return response.data;
}

export async function getCampaignAnalytics(): Promise<CampaignStats> {
  const response = await apiClient.get<ApiResponse<CampaignStats>>('/admin/analytics/campaigns');
  return response.data;
}

// System Settings
export async function getSettings(): Promise<SystemSettings> {
  const response = await apiClient.get<ApiResponse<SystemSettings>>('/admin/settings');
  return response.data;
}

export async function updateSettings(settings: Partial<SystemSettings>): Promise<SystemSettings> {
  const response = await apiClient.put<ApiResponse<SystemSettings>>('/admin/settings', settings);
  return response.data;
}

// Organizations
// NOTE: the organizations LIST call lives on adminService (admin.service.ts) — it
// forwards the `status` filter. A duplicate here used to omit `status` and silently
// drop the filter; removed to avoid that trap. Use adminService.getOrganizations.

export async function getOrganization(id: number): Promise<Organization> {
  const response = await apiClient.get<ApiResponse<Organization>>(`/admin/organizations/${id}`);
  return response.data;
}

export async function createOrganization(data: CreateOrganizationData): Promise<Organization> {
  const response = await apiClient.post<ApiResponse<Organization>>('/admin/organizations', data);
  return response.data;
}

export async function updateOrganization(
  id: number,
  data: UpdateOrganizationData
): Promise<Organization> {
  const response = await apiClient.put<ApiResponse<Organization>>(
    `/admin/organizations/${id}`,
    data
  );
  return response.data;
}

export async function deleteOrganization(id: number): Promise<void> {
  await apiClient.delete(`/admin/organizations/${id}`);
}

/**
 * WhatsApp manager-oversight feature flags, per organization.
 *
 * Closed by default — managers see nothing extra until an admin opts the
 * org in. Mirrors the backend `WaFeatureFlags` interface 1:1.
 */
export interface WaFeatureFlags {
  /** Managers see "Agent X is typing…" badges on conversations in their org. */
  typingIndicators: boolean;
  /** Managers can open any conversation in watch mode and see live customer messages + agent draft text. */
  liveWatch: boolean;
  /**
   * When agents type, also notify Meta's WhatsApp API to show
   * "Business is typing…" on the customer's screen. Free from Meta but
   * only valid inside an open service window.
   */
  customerTypingIndicator: boolean;
}

/**
 * Read WA feature flags for an organization (admin-only — takes an
 * explicit orgId so platform admins can audit any org's settings).
 * The user-facing `getFeatureFlags()` in whatsapp.api is scoped to the
 * caller's session-derived org instead.
 */
export async function getOrgWaFeatures(id: number): Promise<WaFeatureFlags> {
  const response = await apiClient.get<ApiResponse<WaFeatureFlags>>(
    `/admin/organizations/${id}/wa-features`
  );
  return response.data;
}

/**
 * Patch one or more WA feature flags on an org. Partial body — only
 * specified flags are touched. Backend audits the diff + broadcasts
 * `wa:feature_flags_updated` to org members so client gates refresh
 * without a page reload.
 */
export async function updateOrgWaFeatures(
  id: number,
  patch: Partial<WaFeatureFlags>
): Promise<WaFeatureFlags> {
  const response = await apiClient.patch<ApiResponse<WaFeatureFlags>>(
    `/admin/organizations/${id}/wa-features`,
    patch
  );
  return response.data;
}

/** An org's call-minute soft cap (admin view) — the org-wide PER-USER default. */
export interface OrgCallSoftCap {
  /** Per-org override: null = deployment default, 0 = exempt (unlimited), N = cap. */
  rawMinutes: number | null;
  /** The effective PER-USER default in minutes (every user gets this), or null = unlimited. */
  effectiveMinutes: number | null;
  /** The deployment default (0 = the soft cap is disabled for this deployment). */
  defaultMinutes: number;
  /** Always true — this value is applied per user, NOT as one org-wide pool. */
  perUser: true;
}

/** Read an org's call-minute soft cap (the org-wide per-user default). */
export async function getOrgCallSoftCap(id: number): Promise<OrgCallSoftCap> {
  const response = await apiClient.get<ApiResponse<OrgCallSoftCap>>(
    `/admin/organizations/${id}/call-soft-cap`
  );
  return response.data;
}

/**
 * Set an org's call-minute soft cap (the org-wide PER-USER default — every user gets
 * this many minutes each). minutes: null=deployment default, 0=exempt, N=cap/user.
 */
export async function updateOrgCallSoftCap(
  id: number,
  minutes: number | null
): Promise<OrgCallSoftCap> {
  const response = await apiClient.patch<ApiResponse<OrgCallSoftCap>>(
    `/admin/organizations/${id}/call-soft-cap`,
    { minutes }
  );
  return response.data;
}

/** A user's effective per-user monthly call-minute cap (admin view). */
export interface UserCallCap {
  /** This user's own override: null = inherit, 0 = exempt (unlimited), N = cap. */
  rawMinutes: number | null;
  /** Resolved effective cap (override → org default → deployment default), or null = unlimited. */
  effectiveMinutes: number | null;
  /** The org-wide per-user default this user inherits when they have no override. */
  orgDefaultMinutes: number | null;
  /** The deployment default. */
  deploymentDefaultMinutes: number;
}

/** Read ONE user's per-user call-minute cap. */
export async function getUserCallCap(userId: number): Promise<UserCallCap> {
  const response = await apiClient.get<ApiResponse<UserCallCap>>(
    `/admin/users/${userId}/call-cap`
  );
  return response.data;
}

/** Set ONE user's per-user call-minute cap override. null=inherit, 0=exempt, N=cap. */
export async function updateUserCallCap(
  userId: number,
  minutes: number | null
): Promise<UserCallCap> {
  const response = await apiClient.put<ApiResponse<UserCallCap>>(
    `/admin/users/${userId}/call-cap`,
    { minutes }
  );
  return response.data;
}

/** One member's call-minute usage + cap for the per-user Usage view. */
export interface PerUserCallUsageRow {
  userId: number;
  name: string;
  number: string | null;
  /** This user's OWN minutes used this cycle. */
  minutesUsed: number;
  /** This user's effective cap, or null = unlimited. */
  effectiveMinutes: number | null;
  /** The user's own override (null = inheriting the org default). */
  rawOverrideMinutes: number | null;
  /** True when this user is at/over their own cap right now. */
  blocked: boolean;
}

export interface OrgPerUserCallUsage {
  periodStartIso: string;
  orgDefaultMinutes: number | null;
  users: PerUserCallUsageRow[];
}

/** Per-user call-minute usage + caps for an org (the Usage tab breakdown). */
export async function getOrgPerUserCallUsage(id: number): Promise<OrgPerUserCallUsage> {
  const response = await apiClient.get<ApiResponse<OrgPerUserCallUsage>>(
    `/admin/organizations/${id}/call-usage-by-user`
  );
  return response.data;
}

/** An org's hidden monthly SMS soft cap (admin view) — the SMS twin of OrgCallSoftCap. */
export interface OrgSmsSoftCap {
  /** The MANUAL per-org override: null = no override (use package/base/default), 0 = exempt (unlimited), N = cap. */
  rawCap: number | null;
  /** Resolved effective SMS limit (manual override → package → base → default), or null = truly unlimited. */
  effectiveCap: number | null;
  /** Where the effective limit comes from. */
  source: 'manual' | 'package' | 'base' | 'default';
  /** The deployment default (0 = the SMS soft cap is disabled for this deployment). */
  defaultCap: number;
  /** Org-wide SMS used this period (for the used/cap display). */
  usedThisMonth: number;
}

/** Read an org's hidden SMS soft cap. */
export async function getOrgSmsSoftCap(id: number): Promise<OrgSmsSoftCap> {
  const response = await apiClient.get<ApiResponse<OrgSmsSoftCap>>(
    `/admin/organizations/${id}/sms-soft-cap`
  );
  return response.data;
}

/** Set an org's hidden SMS soft cap. cap: null=default, 0=exempt, N=cap. */
export async function updateOrgSmsSoftCap(id: number, cap: number | null): Promise<OrgSmsSoftCap> {
  const response = await apiClient.patch<ApiResponse<OrgSmsSoftCap>>(
    `/admin/organizations/${id}/sms-soft-cap`,
    { cap }
  );
  return response.data;
}

/** One org's row in the admin call-usage ledger (REAL numbers — admin-only). */
export interface CallUsageLedgerRow {
  orgId: number;
  name: string;
  slug: string | null;
  /** 'approved' (business-verified) or 'not_required' (admin-created unlimited). */
  status: string;
  /** Effective monthly cap in minutes, or null = truly unlimited (exempt / no default). */
  capMinutes: number | null;
  minutesUsed: number;
  secondsUsed: number;
  /** true = this org has a custom per-org override; false = inheriting the default. */
  custom: boolean;
  blocked: boolean;
  /** Fraction of the cap used (0–1+), or null when uncapped. */
  pctUsed: number | null;
}

export interface CallUsageLedger {
  rows: CallUsageLedgerRow[];
  /** Deployment default cap in minutes (0 = the soft cap is disabled deployment-wide). */
  defaultMinutes: number;
  generatedAt: string;
}

/**
 * Whole-fleet call-usage ledger — REAL minutes used this month vs the hidden soft
 * cap, per unlimited-tier org. Super-admin only. The page keeps it live via the
 * `admin:call_usage` WebSocket push (no polling).
 */
export async function getCallUsageLedger(): Promise<CallUsageLedger> {
  const response = await apiClient.get<ApiResponse<CallUsageLedger>>(
    '/admin/organizations/call-usage'
  );
  return response.data;
}

/** One org's row in the admin SMS-usage ledger — the SMS twin of CallUsageLedgerRow. */
export interface SmsUsageLedgerRow {
  orgId: number;
  name: string;
  slug: string | null;
  status: string;
  /** Effective SMS allowance for the current period (active package, else base cap). */
  smsCap: number;
  smsUsed: number;
  /** 'bundle'=package, 'base'=base cap, 'manual'=admin manual override. */
  source: 'bundle' | 'base' | 'manual';
  blocked: boolean;
  /** Fraction of the allowance used (0–1+), or null when the allowance is 0. */
  pctUsed: number | null;
  /** ISO bundle cycle end, or null for the base calendar-month window. */
  periodEndIso: string | null;
}

export interface SmsUsageLedger {
  rows: SmsUsageLedgerRow[];
  generatedAt: string;
}

/**
 * Whole-fleet SMS-usage ledger — REAL SMS used this period vs the effective SMS
 * allowance (active package, else the base/trial cap), per metered reskin org.
 * Super-admin only. Kept live via the `admin:sms_usage` WebSocket push (no polling).
 */
export async function getSmsUsageLedger(): Promise<SmsUsageLedger> {
  const response = await apiClient.get<ApiResponse<SmsUsageLedger>>(
    '/admin/organizations/sms-usage'
  );
  return response.data;
}

/**
 * One org's live usage snapshot — the SSOT the enforcement gate uses. Tells the
 * Usage tab the cap that ACTUALLY applies: a capped (trial) org meters calls
 * against `callMinutesPerMonth` (its trial allowance), while an unlimited org
 * (capped=false) is governed by the hidden fair-use soft cap instead.
 */
export interface OrgUsageSnapshot {
  status: 'not_required' | 'pending' | 'approved' | 'rejected';
  /** Reskin self-serve org subject to a meter at all (false = nuxcall/legacy). */
  metered: boolean;
  /** Pre-KYC (pending/rejected): calls run on the TRIAL cap below, not the soft cap. */
  capped: boolean;
  callsBlocked: boolean;
  allowanceSource: 'bundle' | 'base';
  /** Trial call allowance (min/mo) when capped; 0 = unlimited tier (soft cap applies). */
  callMinutesPerMonth: number;
  callMinutesUsedThisMonth: number;
  smsPerMonth: number;
  smsUsedThisMonth: number;
  periodEndIso: string | null;
  /** The org's monthly billing cycle for admin-set limits (anchored at creation day). */
  billingCycleStartIso: string;
  billingCycleEndIso: string;
  billingAnchorIso: string | null;
}

export async function getOrgUsageSnapshot(orgId: number): Promise<OrgUsageSnapshot> {
  const response = await apiClient.get<ApiResponse<OrgUsageSnapshot>>(
    `/admin/organizations/${orgId}/usage-snapshot`
  );
  return response.data;
}

export async function getOrganizationStats(id: number): Promise<OrganizationStats> {
  const response = await apiClient.get<ApiResponse<OrganizationStats>>(
    `/admin/organizations/${id}/stats`
  );
  return response.data;
}

import type { AdminUser, AdminUserMeta } from './admin-user.api';

export async function getOrganizationUsers(
  id: number,
  params?: { page?: number; limit?: number }
): Promise<{ users: AdminUser[]; meta: AdminUserMeta }> {
  const response = await apiClient.get<ApiResponse<AdminUser[]> & { meta: AdminUserMeta }>(
    `/admin/organizations/${id}/users`,
    { params: params as Record<string, string | number | boolean | undefined> }
  );
  return { users: response.data, meta: response.meta };
}

export async function assignUserToOrganization(
  userId: number,
  organizationId: number
): Promise<void> {
  await apiClient.put(`/admin/users/${userId}/organization`, { organizationId });
}

export async function removeUserFromOrganization(userId: number): Promise<void> {
  await apiClient.delete(`/admin/users/${userId}/organization`);
}

// Exports
export async function exportAuditLogs(filters?: {
  action?: string;
  startDate?: string;
  endDate?: string;
}): Promise<void> {
  await downloadCsv(
    'audit-logs',
    `audit-logs-${Date.now()}.csv`,
    filters as Record<string, string>
  );
}

export async function exportCalls(filters?: {
  startDate?: string;
  endDate?: string;
  direction?: string;
  status?: string;
}): Promise<void> {
  await downloadCsv('calls', `calls-${Date.now()}.csv`, filters as Record<string, string>);
}

export async function exportSms(filters?: {
  startDate?: string;
  endDate?: string;
  direction?: string;
}): Promise<void> {
  await downloadCsv('sms', `sms-${Date.now()}.csv`, filters as Record<string, string>);
}

export async function exportVoicemails(filters?: {
  startDate?: string;
  endDate?: string;
  read?: string;
}): Promise<void> {
  await downloadCsv(
    'voicemails',
    `voicemails-${Date.now()}.csv`,
    filters as Record<string, string>
  );
}

export async function exportRecordings(filters?: {
  startDate?: string;
  endDate?: string;
}): Promise<void> {
  await downloadCsv(
    'recordings',
    `recordings-${Date.now()}.csv`,
    filters as Record<string, string>
  );
}
