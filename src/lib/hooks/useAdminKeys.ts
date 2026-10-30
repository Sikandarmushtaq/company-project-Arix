/**
 * Admin Query Keys
 * Centralized query key definitions for all admin hooks
 */

import type { UserParams } from '@/lib/api/services/admin.service';

export const adminKeys = {
  all: ['admin'] as const,
  stats: () => [...adminKeys.all, 'stats'] as const,
  users: () => [...adminKeys.all, 'users'] as const,
  user: (id: number) => [...adminKeys.users(), 'detail', id] as const,
  usersList: (params?: UserParams) => [...adminKeys.users(), 'list', params] as const,
  userDetail: (id: number) => [...adminKeys.users(), 'detail', id] as const,
  userExtensionSettings: (id: number) => [...adminKeys.users(), 'extension-settings', id] as const,
  unassignedUsers: () => [...adminKeys.users(), 'unassigned'] as const,
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
  settings: () => [...adminKeys.all, 'settings'] as const,
  // Organizations
  organizations: () => [...adminKeys.all, 'organizations'] as const,
  organizationsList: (params?: { page?: number; limit?: number; search?: string }) =>
    [...adminKeys.organizations(), 'list', params] as const,
  organizationDetail: (id: number) => [...adminKeys.organizations(), 'detail', id] as const,
  organizationStats: (id: number) => [...adminKeys.organizations(), 'stats', id] as const,
  organizationUsers: (id: number, params?: { page?: number; limit?: number }) =>
    [...adminKeys.organizations(), 'users', id, params] as const,
  // Call Health
  callHealth: () => [...adminKeys.all, 'callHealth'] as const,
  callHealthSummary: (hours: number) => [...adminKeys.callHealth(), 'summary', hours] as const,
  callHealthUsers: (hours: number, limit: number) =>
    [...adminKeys.callHealth(), 'users', hours, limit] as const,
  callHealthCalls: (params?: {
    userId?: number;
    state?: string;
    hours?: number;
    limit?: number;
    offset?: number;
  }) => [...adminKeys.callHealth(), 'calls', params] as const,
  callHealthDetail: (id: number) => [...adminKeys.callHealth(), 'detail', id] as const,
};
