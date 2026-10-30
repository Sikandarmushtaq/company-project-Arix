'use client';

import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../stores';
import { apiClient } from '../api/client';
import { useSocket } from '../providers/SocketProvider';
import { REALTIME_EVENTS } from '../constants/events';

/**
 * Permission response from API
 */
interface PermissionResponse {
  success: boolean;
  data: {
    userId: number;
    role: string;
    effectivePermissions: Record<string, boolean>;
    /** The tenant's enabled feature modules (calling, sms, whatsapp, …). */
    modules?: Record<string, boolean>;
    overrides: Array<{
      code: string;
      granted: boolean;
      expiresAt: string | null;
      grantedBy: number;
      notes: string | null;
    }>;
    roleDefaults: string[];
  };
}

/**
 * Permission codes matching backend constants
 */
export const PERMISSIONS = {
  // Viewing
  VIEW_DASHBOARD: 'view.dashboard',
  VIEW_USERS: 'view.users',
  VIEW_USER_DETAILS: 'view.user_details',
  VIEW_AUDIT_LOGS: 'view.audit_logs',
  VIEW_RECORDINGS: 'view.recordings',
  VIEW_VOICEMAIL_AUDIT: 'view.voicemail_audit',
  VIEW_CALL_HISTORY: 'view.call_history',
  VIEW_SMS_HISTORY: 'view.sms_history',
  VIEW_WHATSAPP: 'view.whatsapp',
  VIEW_DEVICES: 'view.devices',
  VIEW_SESSIONS: 'view.sessions',
  VIEW_ANALYTICS: 'view.analytics',
  VIEW_LIVE_CALLS: 'view.live_calls',
  VIEW_CALL_HEALTH: 'view.call_health',
  VIEW_LIVE_CONNECTIONS: 'view.live_connections',
  VIEW_SYSTEM_HEALTH: 'view.system_health',
  VIEW_FAILOVER: 'view.failover',
  VIEW_BANS: 'view.bans',
  VIEW_SETTINGS: 'view.settings',
  VIEW_DIALER: 'view.dialer',

  // Managing - Users
  MANAGE_USERS: 'manage.users',
  CREATE_USERS: 'manage.users.create',
  UPDATE_USERS: 'manage.users.update',
  DELETE_USERS: 'manage.users.delete',
  MANAGE_USER_ROLES: 'manage.users.roles',
  MANAGE_USER_PERMISSIONS: 'manage.users.permissions',

  // Managing - Sessions
  MANAGE_SESSIONS: 'manage.sessions',
  TERMINATE_SESSIONS: 'manage.sessions.terminate',
  TERMINATE_ALL_SESSIONS: 'manage.sessions.terminate_all',

  // Managing - Devices
  MANAGE_DEVICES: 'manage.devices',
  KICK_DEVICES: 'manage.devices.kick',
  BAN_DEVICES: 'manage.devices.ban',

  // Managing - Recordings
  MANAGE_RECORDINGS: 'manage.recordings',
  DELETE_RECORDINGS: 'manage.recordings.delete',
  DOWNLOAD_RECORDINGS: 'manage.recordings.download',

  // Managing - Bans
  MANAGE_BANS: 'manage.bans',
  BAN_USERS: 'manage.bans.users',
  UNBAN_USERS: 'manage.bans.unban',

  // Managing - Phone Numbers
  MANAGE_PHONE_NUMBERS: 'manage.phone_numbers',
  TRANSFER_PHONE_NUMBERS: 'manage.phone_numbers.transfer',

  // Managing - SMS
  MANAGE_SMS: 'manage.sms',
  TOGGLE_SMS: 'manage.sms.toggle',
  SET_SMS_LIMIT: 'manage.sms.limit',
  // SMS usage dashboard — hidden by default; a super-admin grants it per user.
  VIEW_SMS_USAGE: 'view.sms_usage',

  // Managing - AutoDialer
  MANAGE_AUTODIALER: 'manage.autodialer',
  TOGGLE_AUTODIALER: 'manage.autodialer.toggle',

  // System
  ACCESS_SETTINGS: 'system.settings',
  UPDATE_SETTINGS: 'system.settings.update',
  ACCESS_FAILOVER: 'system.failover',
  SWITCH_SERVER: 'system.failover.switch',
  ACCESS_MAINTENANCE: 'system.maintenance',
  RUN_MAINTENANCE: 'system.maintenance.run',
  VIEW_SYSTEM_LOGS: 'system.logs.view',

  // Security
  RESET_PASSWORDS: 'security.passwords.reset',
  FORCE_LOGOUT: 'security.force_logout',
  VIEW_SECURITY_EVENTS: 'security.events.view',
  MANAGE_IP_BANS: 'security.ip_bans',

  // Reporting
  EXPORT_DATA: 'reporting.export',
  EXPORT_USERS: 'reporting.export.users',
  EXPORT_CALLS: 'reporting.export.calls',
  EXPORT_SMS: 'reporting.export.sms',
  EXPORT_AUDIT: 'reporting.export.audit',
  GENERATE_REPORTS: 'reporting.generate',

  // Bulk Operations
  BULK_OPERATIONS: 'bulk.operations',
  BULK_BAN: 'bulk.ban',
  BULK_DELETE: 'bulk.delete',
  BULK_UPDATE: 'bulk.update',
} as const;

export type PermissionCode = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

/**
 * Hook for checking user permissions
 */
export function usePermissions() {
  const { user, isAuthenticated } = useAuthStore();
  const queryClient = useQueryClient();
  const { socket } = useSocket();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['permissions', user?.id],
    queryFn: async () => {
      const response = await apiClient.get<PermissionResponse>('/permissions/me');
      return response.data;
    },
    enabled: isAuthenticated && !!user,
    staleTime: 60 * 1000, // 1 minute — reflect permission/module changes promptly
    gcTime: 10 * 60 * 1000, // 10 minutes
  });

  // Listen for real-time permission changes to current user
  useEffect(() => {
    if (!socket || !user?.id) return;

    const handlePermissionChanged = (payload: { targetUserId: number }) => {
      // Only refetch if the change affects this user
      if (payload.targetUserId === user.id) {
        queryClient.invalidateQueries({ queryKey: ['permissions', user.id] });
      }
    };

    socket.on(REALTIME_EVENTS.PERMISSION_CHANGED, handlePermissionChanged);

    return () => {
      socket.off(REALTIME_EVENTS.PERMISSION_CHANGED, handlePermissionChanged);
    };
  }, [socket, user?.id, queryClient]);

  /**
   * Check if user has a specific permission
   */
  const hasPermission = (permissionCode: string): boolean => {
    // Admin always has all permissions
    if (user?.role === 'super_admin') return true;

    // Not loaded yet - deny by default
    if (!data?.effectivePermissions) return false;

    return data.effectivePermissions[permissionCode] === true;
  };

  /**
   * Check if user has ANY of the specified permissions
   */
  const hasAnyPermission = (...codes: string[]): boolean => {
    if (user?.role === 'super_admin') return true;
    return codes.some((code) => hasPermission(code));
  };

  /**
   * Check if user has ALL of the specified permissions
   */
  const hasAllPermissions = (...codes: string[]): boolean => {
    if (user?.role === 'super_admin') return true;
    return codes.every((code) => hasPermission(code));
  };

  /**
   * Get all effective permissions
   */
  const getEffectivePermissions = (): Record<string, boolean> => {
    if (user?.role === 'super_admin') {
      // Return all permissions as true for the platform super admin
      const allPerms: Record<string, boolean> = {};
      Object.values(PERMISSIONS).forEach((code) => {
        allPerms[code] = true;
      });
      return allPerms;
    }
    return data?.effectivePermissions || {};
  };

  /**
   * Get user's permission overrides
   */
  const getOverrides = () => {
    return data?.overrides || [];
  };

  /**
   * Get role default permissions
   */
  const getRoleDefaults = () => {
    return data?.roleDefaults || [];
  };

  /**
   * Platform super admin — sees everything, controls tenant entitlements.
   */
  const isSuperAdmin = user?.role === 'super_admin';

  /**
   * Check if user is admin (tenant/client admin) OR super admin.
   */
  const isAdmin = user?.role === 'admin' || isSuperAdmin;

  /**
   * Check if user is manager
   */
  const isManager = user?.role === 'manager';

  /**
   * Check if user is the tenant owner.
   */
  const isOwner = user?.role === 'owner';

  /**
   * Is a tenant feature module enabled for this user's org?
   * super_admin => always; while loading / field absent => true (fail-open, so
   * we never flash "Not subscribed" before the data arrives).
   */
  const modules = data?.modules;
  const isModuleEnabled = (moduleCode: string): boolean => {
    if (isSuperAdmin) return true;
    if (!modules) return true;
    return modules[moduleCode] !== false;
  };

  return {
    // Permission checks
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,

    // Data access
    permissions: data?.effectivePermissions || {},
    overrides: getOverrides(),
    roleDefaults: getRoleDefaults(),
    getEffectivePermissions,

    // Tenant module entitlements
    modules: modules || {},
    isModuleEnabled,

    // Role checks
    isSuperAdmin,
    isAdmin,
    isManager,
    isOwner,

    // Query state
    isLoading,
    error,
    refetch,
  };
}
