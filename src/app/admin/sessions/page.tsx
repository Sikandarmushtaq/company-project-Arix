'use client';

import React, { useState, useCallback } from 'react';
import {
  FiRefreshCw,
  FiTrash2,
  FiUser,
  FiMonitor,
  FiClock,
  FiGlobe,
  FiAlertCircle,
  FiLoader,
  FiSearch,
  FiSmartphone,
  FiTablet,
} from 'react-icons/fi';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Button,
  Input,
  Pagination,
} from '@/components/ui';
import {
  useAdminSessions,
  useSessionStats,
  useLogoutSession,
  useLogoutAllSessions,
  useConfirm,
  useAlert,
} from '@/lib/hooks';
import { useAdminRealtimeSync } from '@/lib/hooks/useAdminRealtimeSync';
import { formatAdminDateTime } from '@/lib/utils/datetime';
import type { Session } from '@/lib/api/services';
import { useDebounce } from '@/lib/hooks';

/**
 * Get device icon based on device type
 */
function getDeviceIcon(deviceType: string | null) {
  switch (deviceType) {
    case 'mobile':
      return <FiSmartphone className="w-4 h-4" />;
    case 'tablet':
      return <FiTablet className="w-4 h-4" />;
    case 'desktop':
    default:
      return <FiMonitor className="w-4 h-4" />;
  }
}

/**
 * Get role badge color
 */
function getRoleBadgeClass(role: string) {
  switch (role) {
    case 'admin':
      return 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300';
    case 'manager':
      return 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300';
    default:
      return 'bg-gray-100 text-gray-700 dark:bg-gray-900 dark:text-gray-300';
  }
}

/**
 * Memoized session row component for performance
 */
const SessionRow = React.memo(function SessionRow({
  session,
  onLogout,
  isLoggingOut,
}: {
  session: Session;
  onLogout: (sessionId: string, username: string) => void;
  isLoggingOut: boolean;
}) {
  return (
    <tr className="border-b border-[var(--border)] hover:bg-[var(--muted)] transition-colors">
      {/* User Info */}
      <td className="py-3 px-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-[var(--primary-100)] dark:bg-[var(--primary-900)] flex items-center justify-center">
            <FiUser className="w-4 h-4 text-[var(--foreground)]" aria-hidden="true" />
          </div>
          <div>
            <div className="font-medium text-[var(--foreground)]">
              {session.fullName || session.userEmail || 'Unknown'}
            </div>
            <div className="text-xs text-[var(--muted-foreground)]">{session.userEmail}</div>
          </div>
        </div>
      </td>

      {/* Role */}
      <td className="py-3 px-4">
        <span
          className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getRoleBadgeClass(session.userRole)}`}
        >
          {session.userRole}
        </span>
      </td>

      {/* Device */}
      <td className="py-3 px-4">
        <div className="flex items-center gap-2">
          <div className="text-[var(--muted-foreground)]">{getDeviceIcon(session.deviceType)}</div>
          <div>
            <div className="text-sm text-[var(--foreground)]">
              {session.deviceName || 'Unknown Device'}
            </div>
            <div className="text-xs text-[var(--muted-foreground)]">
              {session.browser} / {session.os}
            </div>
          </div>
        </div>
      </td>

      {/* IP Address */}
      <td className="py-3 px-4">
        <div className="flex items-center gap-2 text-[var(--muted-foreground)]">
          <FiGlobe className="w-4 h-4" aria-hidden="true" />
          <span className="font-mono text-sm">{session.ipAddress || '-'}</span>
        </div>
      </td>

      {/* Login Time */}
      <td className="py-3 px-4 text-[var(--muted-foreground)]">
        {formatAdminDateTime(session.createdAt)}
      </td>

      {/* Last Active */}
      <td className="py-3 px-4 text-[var(--muted-foreground)]">
        {formatAdminDateTime(session.lastActive)}
      </td>

      {/* Actions */}
      <td className="py-3 px-4 text-right">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onLogout(session.id, session.fullName || session.userEmail)}
          disabled={isLoggingOut}
          className="text-[var(--danger)] hover:bg-red-50 dark:hover:bg-red-900/20"
          aria-label={`End session for ${session.fullName || session.userEmail}`}
        >
          <FiTrash2 className="w-4 h-4 mr-1" aria-hidden="true" />
          Kick
        </Button>
      </td>
    </tr>
  );
});

export default function SessionsPage() {
  // Search and pagination state
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const debouncedSearch = useDebounce(searchQuery, 300);

  // Server-side search and pagination
  const { data, isLoading, error, isFetching, refetch } = useAdminSessions({
    page,
    limit: pageSize,
    search: debouncedSearch || undefined,
  });
  const { data: stats } = useSessionStats();
  const logoutSessionMutation = useLogoutSession();
  const logoutAllMutation = useLogoutAllSessions();
  const { confirm } = useConfirm();
  const { success } = useAlert();

  // Enable real-time updates
  useAdminRealtimeSync();

  // Track search state to reset page on change (avoids setState in effect)
  const [trackedSearch, setTrackedSearch] = useState('');
  if (debouncedSearch !== trackedSearch) {
    setTrackedSearch(debouncedSearch);
    if (page !== 1) {
      setPage(1);
    }
  }

  // Get sessions and pagination info from server response
  const sessions = data?.sessions || [];
  const totalItems = data?.total || 0;
  const totalPages = data?.totalPages || 1;

  const handleLogoutSession = useCallback(
    async (sessionId: string, username: string) => {
      const confirmed = await confirm({
        title: 'Kick User',
        message: `Are you sure you want to kick "${username}" from this device?`,
        confirmText: 'Kick',
        variant: 'warning',
      });
      if (confirmed) {
        try {
          await logoutSessionMutation.mutateAsync(sessionId);
        } catch (err) {
          console.error('Failed to logout session:', err);
        }
      }
    },
    [logoutSessionMutation, confirm]
  );

  const handleLogoutAll = useCallback(async () => {
    const confirmed = await confirm({
      title: 'End All Sessions',
      message:
        'Are you sure you want to end ALL active sessions? This will log out all users from all devices.',
      confirmText: 'End All',
      variant: 'danger',
    });
    if (confirmed) {
      try {
        const count = await logoutAllMutation.mutateAsync();
        await success(`${count} sessions terminated`);
      } catch (err) {
        console.error('Failed to logout all sessions:', err);
      }
    }
  }, [logoutAllMutation, confirm, success]);

  const handleRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  }, []);

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <FiAlertCircle
            className="w-12 h-12 text-[var(--danger)] mx-auto mb-4"
            aria-hidden="true"
          />
          <p className="text-[var(--danger)]">Failed to load sessions</p>
          <p className="text-sm text-[var(--muted-foreground)] mt-2">
            {error instanceof Error ? error.message : 'Unknown error'}
          </p>
          <Button onClick={handleRefresh} className="mt-4">
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">Sessions</h1>
          <p className="text-[var(--muted-foreground)] mt-1">
            Manage logged-in devices. Each login creates a separate session.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleRefresh}
            disabled={isFetching}
            aria-label="Refresh sessions"
          >
            <FiRefreshCw
              className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`}
              aria-hidden="true"
            />
            Refresh
          </Button>
          <Button
            variant="danger"
            onClick={handleLogoutAll}
            disabled={logoutAllMutation.isPending || !sessions?.length}
            aria-label="Revoke all sessions"
          >
            <FiTrash2 className="w-4 h-4" aria-hidden="true" />
            Kick All
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-lg bg-green-100 dark:bg-green-900">
              <FiUser className="w-5 h-5 text-green-600 dark:text-green-400" aria-hidden="true" />
            </div>
            <div>
              <p className="text-2xl font-bold text-[var(--foreground)]">
                {isLoading ? '-' : (stats?.totalActive ?? sessions?.length ?? 0)}
              </p>
              <p className="text-sm text-[var(--muted-foreground)]">Active Sessions</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-lg bg-yellow-100 dark:bg-yellow-900">
              <FiClock
                className="w-5 h-5 text-yellow-600 dark:text-yellow-400"
                aria-hidden="true"
              />
            </div>
            <div>
              <p className="text-2xl font-bold text-[var(--foreground)]">
                {isLoading ? '-' : (stats?.expiringSoon ?? 0)}
              </p>
              <p className="text-sm text-[var(--muted-foreground)]">Expiring Soon</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-lg bg-blue-100 dark:bg-blue-900">
              <FiMonitor className="w-5 h-5 text-blue-600 dark:text-blue-400" aria-hidden="true" />
            </div>
            <div>
              <p className="text-2xl font-bold text-[var(--foreground)]">
                {isLoading
                  ? '-'
                  : stats?.averageDuration
                    ? `${Math.round(stats.averageDuration / 60)}m`
                    : '-'}
              </p>
              <p className="text-sm text-[var(--muted-foreground)]">Avg Duration</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <CardTitle>
              Device Sessions
              <span className="text-sm font-normal text-[var(--muted-foreground)] ml-2">
                ({totalItems})
              </span>
            </CardTitle>
            <div className="w-72">
              <Input
                placeholder="Search by user, device, IP..."
                value={searchQuery}
                onChange={handleSearchChange}
                leftIcon={<FiSearch className="w-4 h-4" aria-hidden="true" />}
                aria-label="Search sessions"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <FiLoader className="w-8 h-8 animate-spin text-[var(--primary)]" aria-hidden="true" />
            </div>
          ) : sessions.length === 0 ? (
            <div className="text-center py-12 text-[var(--muted-foreground)]">
              <FiUser className="w-12 h-12 mx-auto mb-4 opacity-50" aria-hidden="true" />
              <p>{searchQuery ? 'No sessions match your search' : 'No active sessions'}</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <caption className="sr-only">
                    Active user sessions table. {sessions.length} sessions displayed.
                  </caption>
                  <thead>
                    <tr className="border-b border-[var(--border)]">
                      <th className="text-left py-3 px-4 font-medium text-[var(--muted-foreground)]">
                        User
                      </th>
                      <th className="text-left py-3 px-4 font-medium text-[var(--muted-foreground)]">
                        Role
                      </th>
                      <th className="text-left py-3 px-4 font-medium text-[var(--muted-foreground)]">
                        Device
                      </th>
                      <th className="text-left py-3 px-4 font-medium text-[var(--muted-foreground)]">
                        IP Address
                      </th>
                      <th className="text-left py-3 px-4 font-medium text-[var(--muted-foreground)]">
                        Login Time
                      </th>
                      <th className="text-left py-3 px-4 font-medium text-[var(--muted-foreground)]">
                        Last Active
                      </th>
                      <th className="text-right py-3 px-4 font-medium text-[var(--muted-foreground)]">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {sessions.map((session) => (
                      <SessionRow
                        key={session.id}
                        session={session}
                        onLogout={handleLogoutSession}
                        isLoggingOut={logoutSessionMutation.isPending}
                      />
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="mt-6 border-t border-[var(--border)] pt-4">
                  <Pagination
                    page={page}
                    totalPages={totalPages}
                    pageSize={pageSize}
                    totalItems={totalItems}
                    hasNextPage={page < totalPages}
                    hasPreviousPage={page > 1}
                    pageRange={Array.from(
                      { length: Math.min(5, totalPages) },
                      (_, i) => i + Math.max(1, page - 2)
                    ).filter((p) => p <= totalPages)}
                    onPageChange={setPage}
                    disabled={isFetching}
                  />
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
