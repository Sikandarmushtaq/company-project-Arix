'use client';

import React, { useState, useMemo, useCallback } from 'react';
import {
  FiMonitor,
  FiAlertCircle,
  FiLoader,
  FiXCircle,
  FiWifi,
  FiSearch,
  FiRefreshCw,
  FiUser,
  FiShield,
  FiSlash,
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
  useAdminConnections,
  useKickConnection,
  useBanIpFromConnection,
  useConfirm,
} from '@/lib/hooks';
import { useAdminRealtimeSync } from '@/lib/hooks/useAdminRealtimeSync';
import { usePagination } from '@/lib/hooks/usePagination';
import { formatAdminDateTime } from '@/lib/utils/datetime';
import type { WebSocketConnection } from '@/lib/api/services';

/**
 * Memoized connection row component for performance
 */
const ConnectionRow = React.memo(function ConnectionRow({
  connection,
  onKick,
  onBanIp,
  isKicking,
  isBanningIp,
}: {
  connection: WebSocketConnection;
  onKick: (socketId: string, userPhone: string) => void;
  onBanIp: (socketId: string, userPhone: string) => void;
  isKicking: boolean;
  isBanningIp: boolean;
}) {
  return (
    <tr className="border-b border-[var(--border)] hover:bg-[var(--muted)] transition-colors">
      <td className="py-3 px-4">
        <div className="flex items-center gap-2">
          <div
            className={`w-2 h-2 rounded-full ${connection.userRole === 'admin' ? 'bg-amber-500' : 'bg-green-500'}`}
          />
          <span className="font-medium text-[var(--foreground)]">{connection.userPhone}</span>
        </div>
      </td>
      <td className="py-3 px-4">
        <div className="flex items-center gap-2 text-[var(--muted-foreground)]">
          <FiUser className="w-4 h-4" aria-hidden="true" />
          <span>{connection.userId}</span>
        </div>
      </td>
      <td className="py-3 px-4">
        <span
          className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
            connection.userRole === 'admin'
              ? 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200'
              : 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
          }`}
        >
          <FiShield className="w-3 h-3" aria-hidden="true" />
          {connection.userRole}
        </span>
      </td>
      <td className="py-3 px-4 text-[var(--muted-foreground)]">
        {formatAdminDateTime(connection.connectedAt)}
      </td>
      <td
        className="py-3 px-4 text-[var(--muted-foreground)] font-mono text-xs truncate max-w-[150px]"
        title={connection.socketId}
      >
        {connection.socketId}
      </td>
      <td className="py-3 px-4 text-right">
        <div className="flex items-center justify-end gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onKick(connection.socketId, connection.userPhone)}
            disabled={isKicking || isBanningIp}
            className="text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            aria-label={`Kick connection for ${connection.userPhone}`}
          >
            <FiXCircle className="w-4 h-4 mr-1" aria-hidden="true" />
            Kick
          </Button>
          {connection.userRole !== 'admin' && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onBanIp(connection.socketId, connection.userPhone)}
              disabled={isKicking || isBanningIp}
              className="text-[var(--danger)] hover:bg-red-50 dark:hover:bg-red-900/20"
              aria-label={`Ban IP for ${connection.userPhone}`}
            >
              <FiSlash className="w-4 h-4 mr-1" aria-hidden="true" />
              Ban IP
            </Button>
          )}
        </div>
      </td>
    </tr>
  );
});

export default function DevicesPage() {
  const { data: connections, isLoading, error, isFetching, refetch } = useAdminConnections();
  const kickConnectionMutation = useKickConnection();
  const { confirm } = useConfirm();
  const banIpMutation = useBanIpFromConnection();

  // Enable real-time updates
  useAdminRealtimeSync();

  // Search state
  const [searchQuery, setSearchQuery] = useState('');

  // Client-side pagination
  const pagination = usePagination({ initialPageSize: 20 });

  // Filter connections by search
  const filteredConnections = useMemo(() => {
    if (!connections) return [];
    if (!searchQuery.trim()) return connections;

    const query = searchQuery.toLowerCase();
    return connections.filter(
      (conn) =>
        conn.userPhone.toLowerCase().includes(query) ||
        conn.socketId.toLowerCase().includes(query) ||
        conn.userRole.toLowerCase().includes(query) ||
        conn.userId.toString().includes(query)
    );
  }, [connections, searchQuery]);

  // Update pagination total when filtered data changes
  React.useEffect(() => {
    pagination.setTotalItems(filteredConnections.length);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- pagination.setTotalItems is stable
  }, [filteredConnections.length]);

  // Get current page of connections
  const paginatedConnections = useMemo(() => {
    const start = (pagination.page - 1) * pagination.pageSize;
    const end = start + pagination.pageSize;
    return filteredConnections.slice(start, end);
  }, [filteredConnections, pagination.page, pagination.pageSize]);

  // Count admins and users
  const stats = useMemo(() => {
    if (!connections) return { total: 0, admins: 0, users: 0 };
    const admins = connections.filter((c) => c.userRole === 'admin').length;
    return {
      total: connections.length,
      admins,
      users: connections.length - admins,
    };
  }, [connections]);

  const handleKick = useCallback(
    async (socketId: string, userPhone: string) => {
      const confirmed = await confirm({
        title: 'Kick Connection',
        message: `Are you sure you want to kick the connection for ${userPhone}?`,
        confirmText: 'Kick',
        variant: 'warning',
      });
      if (confirmed) {
        try {
          await kickConnectionMutation.mutateAsync(socketId);
        } catch (err) {
          console.error('Failed to kick connection:', err);
        }
      }
    },
    [kickConnectionMutation, confirm]
  );

  const handleBanIp = useCallback(
    async (socketId: string, userPhone: string) => {
      const confirmed = await confirm({
        title: 'Ban IP Address',
        message: `Ban the IP address for ${userPhone}?\n\nThis will ban the device's IP address and logout from this device only. The user can still login from a different device/IP.`,
        confirmText: 'Ban IP',
        variant: 'danger',
      });
      if (confirmed) {
        try {
          await banIpMutation.mutateAsync({ socketId, reason: undefined });
        } catch (err) {
          console.error('Failed to ban IP:', err);
        }
      }
    },
    [banIpMutation]
  );

  const handleRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setSearchQuery(e.target.value);
      pagination.goToPage(1);
    },
    [pagination]
  );

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <FiAlertCircle
            className="w-12 h-12 text-[var(--danger)] mx-auto mb-4"
            aria-hidden="true"
          />
          <p className="text-[var(--danger)]">Failed to load connections</p>
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
      <div>
        <h1 className="text-2xl font-bold text-[var(--foreground)]">Live Connections</h1>
        <p className="text-[var(--muted-foreground)] mt-1">
          Real-time WebSocket connections (active while browser tab is open)
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-lg bg-green-100 dark:bg-green-900">
              <FiWifi className="w-5 h-5 text-green-600 dark:text-green-400" aria-hidden="true" />
            </div>
            <div>
              <p className="text-2xl font-bold text-[var(--foreground)]">
                {isLoading ? '-' : stats.total}
              </p>
              <p className="text-sm text-[var(--muted-foreground)]">Total Connections</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-lg bg-blue-100 dark:bg-blue-900">
              <FiUser className="w-5 h-5 text-blue-600 dark:text-blue-400" aria-hidden="true" />
            </div>
            <div>
              <p className="text-2xl font-bold text-[var(--foreground)]">
                {isLoading ? '-' : stats.users}
              </p>
              <p className="text-sm text-[var(--muted-foreground)]">User Connections</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-lg bg-amber-100 dark:bg-amber-900">
              <FiShield className="w-5 h-5 text-amber-600 dark:text-amber-400" aria-hidden="true" />
            </div>
            <div>
              <p className="text-2xl font-bold text-[var(--foreground)]">
                {isLoading ? '-' : stats.admins}
              </p>
              <p className="text-sm text-[var(--muted-foreground)]">Admin Connections</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <CardTitle>
              Active Connections
              {connections && (
                <span className="text-sm font-normal text-[var(--muted-foreground)] ml-2">
                  ({filteredConnections.length}
                  {searchQuery && ` of ${connections.length}`})
                </span>
              )}
            </CardTitle>
            <div className="flex items-center gap-2">
              <div className="w-72">
                <Input
                  placeholder="Search by phone, user ID, role..."
                  value={searchQuery}
                  onChange={handleSearchChange}
                  leftIcon={<FiSearch className="w-4 h-4" aria-hidden="true" />}
                  aria-label="Search connections"
                />
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={handleRefresh}
                disabled={isFetching}
                aria-label="Refresh connections"
              >
                <FiRefreshCw
                  className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`}
                  aria-hidden="true"
                />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <FiLoader className="w-8 h-8 animate-spin text-[var(--primary)]" aria-hidden="true" />
            </div>
          ) : paginatedConnections.length === 0 ? (
            <div className="text-center py-12 text-[var(--muted-foreground)]">
              <FiMonitor className="w-12 h-12 mx-auto mb-4 opacity-50" aria-hidden="true" />
              <p>
                {searchQuery
                  ? 'No connections match your search'
                  : 'No active WebSocket connections'}
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <caption className="sr-only">
                    Live WebSocket connections table. {paginatedConnections.length} connections
                    displayed.
                  </caption>
                  <thead>
                    <tr className="border-b border-[var(--border)]">
                      <th className="text-left py-3 px-4 font-medium text-[var(--muted-foreground)]">
                        Phone
                      </th>
                      <th className="text-left py-3 px-4 font-medium text-[var(--muted-foreground)]">
                        User ID
                      </th>
                      <th className="text-left py-3 px-4 font-medium text-[var(--muted-foreground)]">
                        Role
                      </th>
                      <th className="text-left py-3 px-4 font-medium text-[var(--muted-foreground)]">
                        Connected
                      </th>
                      <th className="text-left py-3 px-4 font-medium text-[var(--muted-foreground)]">
                        Socket ID
                      </th>
                      <th className="text-right py-3 px-4 font-medium text-[var(--muted-foreground)]">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedConnections.map((connection) => (
                      <ConnectionRow
                        key={connection.socketId}
                        connection={connection}
                        onKick={handleKick}
                        onBanIp={handleBanIp}
                        isKicking={kickConnectionMutation.isPending}
                        isBanningIp={banIpMutation.isPending}
                      />
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {pagination.totalPages > 1 && (
                <div className="mt-6 border-t border-[var(--border)] pt-4">
                  <Pagination
                    page={pagination.page}
                    totalPages={pagination.totalPages}
                    pageSize={pagination.pageSize}
                    totalItems={filteredConnections.length}
                    hasNextPage={pagination.hasNextPage}
                    hasPreviousPage={pagination.hasPreviousPage}
                    pageRange={pagination.pageRange}
                    onPageChange={pagination.goToPage}
                    onPageSizeChange={pagination.setPageSize}
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
