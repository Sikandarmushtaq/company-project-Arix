/**
 * Admin Real-time Sync Hook
 *
 * Handles real-time updates for admin pages via Socket.IO.
 * Updates React Query cache directly for instant UI updates.
 */

'use client';

import { useEffect, useCallback, useState, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSocket } from '@/lib/providers/SocketProvider';
import { REALTIME_EVENTS } from '@/lib/constants/events';
import { adminKeys } from './useAdmin';
import type { AdminUser, AdminStats, Device, Session } from '@/lib/api/services';

/**
 * Dismissed alert entry stored in localStorage
 */
interface DismissedAlertEntry {
  alertId: string;
  dismissedAt: number; // Unix timestamp in milliseconds
}

/**
 * localStorage key for dismissed alerts
 */
const DISMISSED_ALERTS_STORAGE_KEY = 'admin_dismissed_alerts';

/**
 * Dismissed alerts expiry time (24 hours in milliseconds)
 */
const DISMISSED_ALERTS_EXPIRY_MS = 24 * 60 * 60 * 1000;

/**
 * Audit log entry from server
 */
export interface AuditLogEntry {
  id: string;
  action: string;
  adminId: number;
  adminName: string;
  targetType: 'user' | 'device' | 'session' | 'system' | 'recording' | 'settings';
  targetId?: string | number;
  targetName?: string;
  details?: Record<string, unknown>;
  timestamp: string;
}

/**
 * Admin alert from server
 */
export interface AdminAlert {
  id: string;
  type: 'info' | 'warning' | 'error' | 'success';
  title: string;
  message: string;
  action?: string;
  timestamp: string;
}

/**
 * Online user event payload
 */
interface UserOnlinePayload {
  userId: number;
  userPhone: string;
  timestamp: string;
}

/**
 * User event payloads
 */
interface UserCreatedPayload {
  user: Partial<AdminUser>;
  timestamp: string;
}

interface UserUpdatedPayload {
  user: Partial<AdminUser>;
  timestamp: string;
}

interface UserDeletedPayload {
  userId: number;
  username: string;
  timestamp: string;
}

interface UserBannedPayload {
  userId: number;
  username: string;
  reason?: string;
  timestamp: string;
}

interface StatsUpdatePayload {
  totalUsers?: number;
  activeUsers?: number;
  onlineDevices?: number;
  activeSessions?: number;
  activeCalls?: number;
  timestamp: string;
}

/**
 * Hook options
 */
interface UseAdminRealtimeSyncOptions {
  onAuditLog?: (entry: AuditLogEntry) => void;
  onAlert?: (alert: AdminAlert) => void;
  onUserOnline?: (payload: UserOnlinePayload) => void;
  onUserOffline?: (payload: { userId: number; timestamp: string }) => void;
}

/**
 * Load dismissed alerts from localStorage and filter out expired entries
 */
function loadDismissedAlerts(): DismissedAlertEntry[] {
  if (typeof window === 'undefined') return [];

  try {
    const stored = localStorage.getItem(DISMISSED_ALERTS_STORAGE_KEY);
    if (!stored) return [];

    const entries: DismissedAlertEntry[] = JSON.parse(stored);
    const now = Date.now();

    // Filter out expired entries (older than 24 hours)
    const validEntries = entries.filter(
      (entry) => now - entry.dismissedAt < DISMISSED_ALERTS_EXPIRY_MS
    );

    // If we filtered out any entries, update localStorage
    if (validEntries.length !== entries.length) {
      localStorage.setItem(DISMISSED_ALERTS_STORAGE_KEY, JSON.stringify(validEntries));
    }

    return validEntries;
  } catch (error) {
    console.error('Failed to load dismissed alerts from localStorage:', error);
    return [];
  }
}

/**
 * Save dismissed alerts to localStorage
 */
function saveDismissedAlerts(entries: DismissedAlertEntry[]): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem(DISMISSED_ALERTS_STORAGE_KEY, JSON.stringify(entries));
  } catch (error) {
    console.error('Failed to save dismissed alerts to localStorage:', error);
  }
}

/**
 * Admin real-time sync hook
 */
export function useAdminRealtimeSync(options: UseAdminRealtimeSyncOptions = {}) {
  const { socket, isConnected } = useSocket();
  const queryClient = useQueryClient();

  // Track online users
  const [onlineUsers, setOnlineUsers] = useState<Set<number>>(new Set());

  // Track recent audit logs (last 20)
  const [recentAuditLogs, setRecentAuditLogs] = useState<AuditLogEntry[]>([]);

  // Track recent alerts (all alerts including dismissed ones for storage purposes)
  const [alerts, setAlerts] = useState<AdminAlert[]>([]);

  // Track dismissed alert IDs with timestamps (persisted in localStorage)
  // Uses lazy initialization to load from localStorage only on first render
  const [dismissedAlerts, setDismissedAlerts] = useState<DismissedAlertEntry[]>(() =>
    loadDismissedAlerts()
  );

  // Track whether to show dismissed alerts
  const [showDismissedAlerts, setShowDismissedAlerts] = useState<boolean>(false);

  // Create a Set of dismissed alert IDs for efficient lookup
  const dismissedAlertIds = useMemo(
    () => new Set(dismissedAlerts.map((entry) => entry.alertId)),
    [dismissedAlerts]
  );

  // Filter alerts based on dismissed state and showDismissedAlerts toggle
  const visibleAlerts = useMemo(() => {
    if (showDismissedAlerts) {
      return alerts;
    }
    return alerts.filter((alert) => !dismissedAlertIds.has(alert.id));
  }, [alerts, dismissedAlertIds, showDismissedAlerts]);

  // Get list of dismissed alerts (for display in "Show dismissed alerts" section)
  const dismissedAlertsList = useMemo(
    () => alerts.filter((alert) => dismissedAlertIds.has(alert.id)),
    [alerts, dismissedAlertIds]
  );

  // Handle user created event
  const handleUserCreated = useCallback(
    (payload: UserCreatedPayload) => {
      if (!payload?.user) return;

      // Invalidate users list to refetch
      queryClient.invalidateQueries({ queryKey: adminKeys.users() });

      // Update stats
      queryClient.invalidateQueries({ queryKey: adminKeys.stats() });
    },
    [queryClient]
  );

  // Handle user updated event
  const handleUserUpdated = useCallback(
    (payload: UserUpdatedPayload) => {
      if (!payload?.user?.id) return;

      // Update user in cache if it exists
      queryClient.setQueriesData<{ users: AdminUser[]; meta: unknown }>(
        { queryKey: adminKeys.users() },
        (old) => {
          if (!old?.users) return old;
          return {
            ...old,
            users: old.users.map((u) => (u.id === payload.user.id ? { ...u, ...payload.user } : u)),
          };
        }
      );

      // Update single user cache
      queryClient.setQueryData(adminKeys.user(payload.user.id), (old: AdminUser | undefined) => {
        if (!old) return old;
        return { ...old, ...payload.user };
      });
    },
    [queryClient]
  );

  // Handle user deleted event
  const handleUserDeleted = useCallback(
    (payload: UserDeletedPayload) => {
      if (!payload?.userId) return;

      // Remove from users list
      queryClient.setQueriesData<{ users: AdminUser[]; meta: unknown }>(
        { queryKey: adminKeys.users() },
        (old) => {
          if (!old?.users) return old;
          return {
            ...old,
            users: old.users.filter((u) => u.id !== payload.userId),
          };
        }
      );

      // Remove single user cache
      queryClient.removeQueries({ queryKey: adminKeys.user(payload.userId) });

      // Update stats
      queryClient.invalidateQueries({ queryKey: adminKeys.stats() });
    },
    [queryClient]
  );

  // Handle user banned event
  const handleUserBanned = useCallback(
    (payload: UserBannedPayload) => {
      if (!payload?.userId) return;

      // Update user banned status in cache
      queryClient.setQueriesData<{ users: AdminUser[]; meta: unknown }>(
        { queryKey: adminKeys.users() },
        (old) => {
          if (!old?.users) return old;
          return {
            ...old,
            users: old.users.map((u) => (u.id === payload.userId ? { ...u, banned: true } : u)),
          };
        }
      );

      // Invalidate banned users list
      queryClient.invalidateQueries({ queryKey: adminKeys.bannedUsers() });

      // Update stats
      queryClient.invalidateQueries({ queryKey: adminKeys.stats() });
    },
    [queryClient]
  );

  // Handle user unbanned event
  const handleUserUnbanned = useCallback(
    (payload: UserBannedPayload) => {
      if (!payload?.userId) return;

      // Update user banned status in cache
      queryClient.setQueriesData<{ users: AdminUser[]; meta: unknown }>(
        { queryKey: adminKeys.users() },
        (old) => {
          if (!old?.users) return old;
          return {
            ...old,
            users: old.users.map((u) => (u.id === payload.userId ? { ...u, banned: false } : u)),
          };
        }
      );

      // Invalidate banned users list
      queryClient.invalidateQueries({ queryKey: adminKeys.bannedUsers() });

      // Update stats
      queryClient.invalidateQueries({ queryKey: adminKeys.stats() });
    },
    [queryClient]
  );

  // Handle stats update event
  const handleStatsUpdate = useCallback(
    (payload: StatsUpdatePayload) => {
      if (!payload) return;

      queryClient.setQueryData<AdminStats>(adminKeys.stats(), (old) => {
        if (!old) return old;
        return {
          ...old,
          totalUsers: payload.totalUsers ?? old.totalUsers,
          activeUsers: payload.activeUsers ?? old.activeUsers,
          activeDevices: payload.onlineDevices ?? old.activeDevices,
          activeSessions: payload.activeSessions ?? old.activeSessions,
        };
      });
    },
    [queryClient]
  );

  // Handle device events
  const handleDeviceConnected = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: adminKeys.devices() });
    queryClient.invalidateQueries({ queryKey: adminKeys.stats() });
  }, [queryClient]);

  const handleDeviceDisconnected = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: adminKeys.devices() });
    queryClient.invalidateQueries({ queryKey: adminKeys.stats() });
  }, [queryClient]);

  const handleDeviceKicked = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: adminKeys.devices() });
  }, [queryClient]);

  // Handle session events
  const handleSessionCreated = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: adminKeys.sessions() });
    queryClient.invalidateQueries({ queryKey: adminKeys.sessionStats() });
    queryClient.invalidateQueries({ queryKey: adminKeys.stats() });
  }, [queryClient]);

  const handleSessionTerminated = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: adminKeys.sessions() });
    queryClient.invalidateQueries({ queryKey: adminKeys.sessionStats() });
    queryClient.invalidateQueries({ queryKey: adminKeys.stats() });
  }, [queryClient]);

  const handleAllSessionsTerminated = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: adminKeys.sessions() });
    queryClient.invalidateQueries({ queryKey: adminKeys.sessionStats() });
    queryClient.invalidateQueries({ queryKey: adminKeys.stats() });
  }, [queryClient]);

  // Handle audit log event
  const handleAuditLog = useCallback(
    (entry: AuditLogEntry) => {
      if (!entry?.id) return;

      // Add to recent logs (keep last 20)
      setRecentAuditLogs((prev) => {
        const exists = prev.some((e) => e.id === entry.id);
        if (exists) return prev;
        return [entry, ...prev].slice(0, 20);
      });

      // Call callback if provided
      options.onAuditLog?.(entry);
    },
    [options]
  );

  // Handle admin alert
  const handleAdminAlert = useCallback(
    (alert: AdminAlert) => {
      if (!alert?.id) return;

      setAlerts((prev) => {
        const exists = prev.some((a) => a.id === alert.id);
        if (exists) return prev;
        return [alert, ...prev].slice(0, 10);
      });

      options.onAlert?.(alert);
    },
    [options]
  );

  // Handle user online/offline
  const handleUserOnline = useCallback(
    (payload: UserOnlinePayload) => {
      if (!payload?.userId) return;

      setOnlineUsers((prev) => new Set([...prev, payload.userId]));
      options.onUserOnline?.(payload);
    },
    [options]
  );

  const handleUserOffline = useCallback(
    (payload: { userId: number; timestamp: string }) => {
      if (!payload?.userId) return;

      setOnlineUsers((prev) => {
        const next = new Set(prev);
        next.delete(payload.userId);
        return next;
      });
      options.onUserOffline?.(payload);
    },
    [options]
  );

  // Dismiss an alert (persists to localStorage with timestamp)
  const dismissAlert = useCallback((alertId: string) => {
    setDismissedAlerts((prev) => {
      // Check if already dismissed
      if (prev.some((entry) => entry.alertId === alertId)) {
        return prev;
      }

      const newEntry: DismissedAlertEntry = {
        alertId,
        dismissedAt: Date.now(),
      };

      const updated = [...prev, newEntry];
      saveDismissedAlerts(updated);
      return updated;
    });
  }, []);

  // Restore a dismissed alert (remove from dismissed list)
  const restoreAlert = useCallback((alertId: string) => {
    setDismissedAlerts((prev) => {
      const updated = prev.filter((entry) => entry.alertId !== alertId);
      saveDismissedAlerts(updated);
      return updated;
    });
  }, []);

  // Clear all dismissed alerts (restore all)
  const clearAllDismissedAlerts = useCallback(() => {
    setDismissedAlerts([]);
    saveDismissedAlerts([]);
  }, []);

  // Permanently remove an alert from the list entirely
  const removeAlert = useCallback((alertId: string) => {
    setAlerts((prev) => prev.filter((a) => a.id !== alertId));
    // Also remove from dismissed if it was there
    setDismissedAlerts((prev) => {
      const updated = prev.filter((entry) => entry.alertId !== alertId);
      saveDismissedAlerts(updated);
      return updated;
    });
  }, []);

  // Toggle showing dismissed alerts
  const toggleShowDismissedAlerts = useCallback(() => {
    setShowDismissedAlerts((prev) => !prev);
  }, []);

  // Register event listeners
  useEffect(() => {
    if (!socket) return;

    // User events
    socket.on(REALTIME_EVENTS.ADMIN_USER_CREATED, handleUserCreated);
    socket.on(REALTIME_EVENTS.ADMIN_USER_UPDATED, handleUserUpdated);
    socket.on(REALTIME_EVENTS.ADMIN_USER_DELETED, handleUserDeleted);
    socket.on(REALTIME_EVENTS.ADMIN_USER_BANNED, handleUserBanned);
    socket.on(REALTIME_EVENTS.ADMIN_USER_UNBANNED, handleUserUnbanned);

    // Stats events
    socket.on(REALTIME_EVENTS.ADMIN_STATS_UPDATE, handleStatsUpdate);

    // Device events
    socket.on(REALTIME_EVENTS.ADMIN_DEVICE_CONNECTED, handleDeviceConnected);
    socket.on(REALTIME_EVENTS.ADMIN_DEVICE_DISCONNECTED, handleDeviceDisconnected);
    socket.on(REALTIME_EVENTS.ADMIN_DEVICE_KICKED, handleDeviceKicked);

    // Session events
    socket.on(REALTIME_EVENTS.ADMIN_SESSION_CREATED, handleSessionCreated);
    socket.on(REALTIME_EVENTS.ADMIN_SESSION_TERMINATED, handleSessionTerminated);
    socket.on(REALTIME_EVENTS.ADMIN_SESSION_ALL_TERMINATED, handleAllSessionsTerminated);

    // Audit log events
    socket.on(REALTIME_EVENTS.ADMIN_AUDIT_LOG, handleAuditLog);

    // Alert events
    socket.on(REALTIME_EVENTS.ADMIN_ALERT, handleAdminAlert);

    // Presence events
    socket.on(REALTIME_EVENTS.USER_ONLINE, handleUserOnline);
    socket.on(REALTIME_EVENTS.USER_OFFLINE, handleUserOffline);

    // WhatsApp call stats update — dedicated event for analytics refresh
    // (separate from wa:call_ended/missed which control the agent's call UI)
    const handleWaCallStatsUpdate = () => {
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: adminKeys.analytics(), refetchType: 'all' });
        queryClient.invalidateQueries({ queryKey: ['wa-calls'], refetchType: 'all' });
      }, 500);
    };
    socket.on('wa:call_stats_updated', handleWaCallStatsUpdate);

    return () => {
      socket.off(REALTIME_EVENTS.ADMIN_USER_CREATED, handleUserCreated);
      socket.off(REALTIME_EVENTS.ADMIN_USER_UPDATED, handleUserUpdated);
      socket.off(REALTIME_EVENTS.ADMIN_USER_DELETED, handleUserDeleted);
      socket.off(REALTIME_EVENTS.ADMIN_USER_BANNED, handleUserBanned);
      socket.off(REALTIME_EVENTS.ADMIN_USER_UNBANNED, handleUserUnbanned);
      socket.off(REALTIME_EVENTS.ADMIN_STATS_UPDATE, handleStatsUpdate);
      socket.off(REALTIME_EVENTS.ADMIN_DEVICE_CONNECTED, handleDeviceConnected);
      socket.off(REALTIME_EVENTS.ADMIN_DEVICE_DISCONNECTED, handleDeviceDisconnected);
      socket.off(REALTIME_EVENTS.ADMIN_DEVICE_KICKED, handleDeviceKicked);
      socket.off(REALTIME_EVENTS.ADMIN_SESSION_CREATED, handleSessionCreated);
      socket.off(REALTIME_EVENTS.ADMIN_SESSION_TERMINATED, handleSessionTerminated);
      socket.off(REALTIME_EVENTS.ADMIN_SESSION_ALL_TERMINATED, handleAllSessionsTerminated);
      socket.off(REALTIME_EVENTS.ADMIN_AUDIT_LOG, handleAuditLog);
      socket.off(REALTIME_EVENTS.ADMIN_ALERT, handleAdminAlert);
      socket.off(REALTIME_EVENTS.USER_ONLINE, handleUserOnline);
      socket.off(REALTIME_EVENTS.USER_OFFLINE, handleUserOffline);
      socket.off('wa:call_stats_updated', handleWaCallStatsUpdate);
    };
  }, [
    socket,
    handleUserCreated,
    handleUserUpdated,
    handleUserDeleted,
    handleUserBanned,
    handleUserUnbanned,
    handleStatsUpdate,
    handleDeviceConnected,
    handleDeviceDisconnected,
    handleDeviceKicked,
    handleSessionCreated,
    handleSessionTerminated,
    handleAllSessionsTerminated,
    handleAuditLog,
    handleAdminAlert,
    handleUserOnline,
    handleUserOffline,
  ]);

  return {
    isConnected,
    onlineUsers,
    recentAuditLogs,
    // Returns visible alerts (filtered by dismissed state unless showDismissedAlerts is true)
    alerts: visibleAlerts,
    // Returns all alerts including dismissed ones
    allAlerts: alerts,
    // Returns only dismissed alerts
    dismissedAlerts: dismissedAlertsList,
    // Dismiss an alert (persists to localStorage for 24 hours)
    dismissAlert,
    // Restore a previously dismissed alert
    restoreAlert,
    // Clear all dismissed alerts
    clearAllDismissedAlerts,
    // Permanently remove an alert
    removeAlert,
    // Whether dismissed alerts are currently shown
    showDismissedAlerts,
    // Toggle showing dismissed alerts
    toggleShowDismissedAlerts,
    // Set whether to show dismissed alerts directly
    setShowDismissedAlerts,
    // Check if an alert is dismissed
    isAlertDismissed: (alertId: string) => dismissedAlertIds.has(alertId),
    // Get count of dismissed alerts
    dismissedAlertsCount: dismissedAlerts.length,
    isUserOnline: (userId: number) => onlineUsers.has(userId),
  };
}
