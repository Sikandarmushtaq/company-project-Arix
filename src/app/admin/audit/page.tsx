'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  FiSearch,
  FiDownload,
  FiRefreshCw,
  FiFilter,
  FiAlertCircle,
  FiLoader,
  FiUser,
  FiMonitor,
  FiClock,
  FiActivity,
  FiTrash2,
  FiX,
} from 'react-icons/fi';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Button,
  Input,
  Pagination,
  StyledSelect,
} from '@/components/ui';
import {
  useAuditLogs,
  useAuditStats,
  useAuditActions,
  useExportAuditLogs,
  useCleanupAuditLogs,
  useConfirm,
} from '@/lib/hooks';
import { usePagination } from '@/lib/hooks/usePagination';
import { useAdminRealtimeSync } from '@/lib/hooks/useAdminRealtimeSync';
import { formatLocalDate } from '@/lib/utils/datetime';
import type { AuditLog, AuditLogFilters } from '@/lib/api/services';

/**
 * Get action color based on action type
 */
function getActionColor(action: string): string {
  if (action.includes('created') || action.includes('added')) {
    return 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300';
  }
  if (action.includes('deleted') || action.includes('removed')) {
    return 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300';
  }
  if (action.includes('banned')) {
    return 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300';
  }
  if (action.includes('password') || action.includes('security')) {
    return 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300';
  }
  return 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300';
}

/**
 * Get target type icon
 */
function getTargetIcon(targetType: string) {
  switch (targetType) {
    case 'user':
      return <FiUser className="w-4 h-4" aria-hidden="true" />;
    case 'device':
      return <FiMonitor className="w-4 h-4" aria-hidden="true" />;
    case 'session':
      return <FiClock className="w-4 h-4" aria-hidden="true" />;
    default:
      return <FiActivity className="w-4 h-4" aria-hidden="true" />;
  }
}

/**
 * Format action name for display
 */
function formatActionName(action: string): string {
  return action
    .replace(/\./g, ' ')
    .replace(/_/g, ' ')
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Memoized audit log row component
 */
const AuditLogRow = React.memo(function AuditLogRow({
  log,
  onViewDetails,
}: {
  log: AuditLog;
  onViewDetails: (log: AuditLog) => void;
}) {
  return (
    <tr className="border-b border-[var(--border)] hover:bg-[var(--muted)] transition-colors">
      <td className="py-3 px-4">
        <div className="flex items-center gap-2">
          <span className="text-[var(--muted-foreground)]">{getTargetIcon(log.targetType)}</span>
          <span
            className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getActionColor(
              log.action
            )}`}
          >
            {formatActionName(log.action)}
          </span>
        </div>
      </td>
      <td className="py-3 px-4 text-[var(--foreground)]">{log.adminName}</td>
      <td className="py-3 px-4">
        <span className="inline-flex items-center gap-1 text-[var(--muted-foreground)]">
          <span className="capitalize">{log.targetType}</span>
          {log.targetName && (
            <>
              <span>:</span>
              <span className="font-medium text-[var(--foreground)]">{log.targetName}</span>
            </>
          )}
        </span>
      </td>
      <td className="py-3 px-4 text-[var(--muted-foreground)] font-mono text-sm">
        {log.ipAddress || '-'}
      </td>
      <td className="py-3 px-4 text-[var(--muted-foreground)]">{formatLocalDate(log.createdAt)}</td>
      <td className="py-3 px-4 text-right">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onViewDetails(log)}
          aria-label="View details"
        >
          Details
        </Button>
      </td>
    </tr>
  );
});

export default function AuditLogsPage() {
  // Pagination state
  const pagination = usePagination({ initialPageSize: 50 });

  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [targetTypeFilter, setTargetTypeFilter] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  // Real-time sync
  const { recentAuditLogs, isConnected } = useAdminRealtimeSync();

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      pagination.goToPage(1);
    }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- pagination.goToPage is stable from usePagination hook
  }, [searchQuery]);

  // Build filters - memoized for stable reference in useCallback
  const filters = React.useMemo<AuditLogFilters & { page?: number; limit?: number }>(
    () => ({
      page: pagination.page,
      limit: pagination.pageSize,
      search: debouncedSearch || undefined,
      action: actionFilter || undefined,
      targetType: targetTypeFilter || undefined,
    }),
    [pagination.page, pagination.pageSize, debouncedSearch, actionFilter, targetTypeFilter]
  );

  // Fetch data
  const { data, isLoading, error, isFetching, refetch } = useAuditLogs(filters);
  const { data: stats } = useAuditStats();
  const { data: actions } = useAuditActions();
  const exportMutation = useExportAuditLogs();
  const cleanupMutation = useCleanupAuditLogs();
  const { confirm } = useConfirm();

  // Update pagination total when data changes
  useEffect(() => {
    if (data?.meta) {
      pagination.setTotalItems(data.meta.total);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- pagination.setTotalItems is stable from usePagination hook
  }, [data?.meta]);

  // Handlers
  const handleRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  const handleExport = useCallback(async () => {
    try {
      // The export service handles the download internally
      await exportMutation.mutateAsync(filters);
    } catch (err) {
      console.error('Failed to export audit logs:', err);
    }
  }, [exportMutation, filters]);

  const handleCleanup = useCallback(async () => {
    const confirmed = await confirm({
      title: 'Delete Old Audit Logs',
      message:
        'Are you sure you want to delete audit logs older than 90 days? This action cannot be undone.',
      confirmText: 'Delete Old Logs',
      variant: 'danger',
    });
    if (confirmed) {
      try {
        await cleanupMutation.mutateAsync(90);
        refetch();
      } catch (err) {
        console.error('Failed to cleanup audit logs:', err);
      }
    }
  }, [cleanupMutation, refetch, confirm]);

  const handleViewDetails = useCallback((log: AuditLog) => {
    setSelectedLog(log);
  }, []);

  const handleClearFilters = useCallback(() => {
    setSearchQuery('');
    setActionFilter('');
    setTargetTypeFilter('');
  }, []);

  const logs = data?.logs ?? [];

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <FiAlertCircle
            className="w-12 h-12 text-[var(--danger)] mx-auto mb-4"
            aria-hidden="true"
          />
          <p className="text-[var(--danger)]">Failed to load audit logs</p>
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">Audit Logs</h1>
          <p className="text-[var(--muted-foreground)] mt-1">
            Track all admin actions and changes
            {isConnected && (
              <span className="ml-2 inline-flex items-center gap-1 text-green-600 dark:text-green-400">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                Live
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={handleExport}
            disabled={exportMutation.isPending}
            aria-label="Export logs"
          >
            <FiDownload className="w-4 h-4 mr-2" aria-hidden="true" />
            {exportMutation.isPending ? 'Exporting...' : 'Export CSV'}
          </Button>
          <Button
            variant="outline"
            onClick={handleCleanup}
            disabled={cleanupMutation.isPending}
            aria-label="Cleanup old logs"
          >
            <FiTrash2 className="w-4 h-4 mr-2" aria-hidden="true" />
            Cleanup
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-[var(--foreground)]">
                {stats.totalLogs.toLocaleString()}
              </div>
              <div className="text-sm text-[var(--muted-foreground)]">Total Logs</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-[var(--foreground)]">
                {stats.todayLogs.toLocaleString()}
              </div>
              <div className="text-sm text-[var(--muted-foreground)]">Today</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-sm text-[var(--muted-foreground)] mb-2">Top Actions</div>
              <div className="space-y-1">
                {stats.topActions.slice(0, 3).map((a) => (
                  <div key={a.action} className="flex justify-between text-sm">
                    <span className="truncate">{formatActionName(a.action)}</span>
                    <span className="text-[var(--muted-foreground)]">{a.count}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-sm text-[var(--muted-foreground)] mb-2">Top Admins</div>
              <div className="space-y-1">
                {stats.topAdmins.slice(0, 3).map((a) => (
                  <div key={a.adminName} className="flex justify-between text-sm">
                    <span className="truncate">{a.adminName}</span>
                    <span className="text-[var(--muted-foreground)]">{a.count}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Real-time Updates */}
      {recentAuditLogs.length > 0 && (
        <Card className="border-green-500 dark:border-green-700">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              Recent Activity (Live)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {recentAuditLogs.slice(0, 5).map((log) => (
                <div
                  key={log.id}
                  className="flex items-center justify-between text-sm py-2 border-b border-[var(--border)] last:border-0"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${getActionColor(
                        log.action
                      )}`}
                    >
                      {formatActionName(log.action)}
                    </span>
                    <span className="text-[var(--muted-foreground)]">by</span>
                    <span className="font-medium">{log.adminName}</span>
                  </div>
                  <span className="text-[var(--muted-foreground)] text-xs">
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Logs Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <CardTitle>
              All Logs
              {data?.meta && (
                <span className="text-sm font-normal text-[var(--muted-foreground)] ml-2">
                  ({data.meta.total.toLocaleString()})
                </span>
              )}
            </CardTitle>
            <div className="flex items-center gap-2">
              <div className="w-72">
                <Input
                  placeholder="Search logs..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  leftIcon={<FiSearch className="w-4 h-4" aria-hidden="true" />}
                  aria-label="Search logs"
                />
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setShowFilters(!showFilters)}
                aria-label="Toggle filters"
              >
                <FiFilter className="w-4 h-4" aria-hidden="true" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={handleRefresh}
                disabled={isFetching}
                aria-label="Refresh logs"
              >
                <FiRefreshCw
                  className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`}
                  aria-hidden="true"
                />
              </Button>
            </div>
          </div>

          {/* Filters */}
          {showFilters && (
            <div className="flex items-center gap-4 mt-4 pt-4 border-t border-[var(--border)]">
              <div className="flex-1">
                <label className="text-sm text-[var(--muted-foreground)]">Action</label>
                <StyledSelect
                  className="mt-1 w-full bg-[var(--background)]"
                  value={actionFilter}
                  onChange={(v) => setActionFilter(v)}
                >
                  <option value="">All Actions</option>
                  {actions?.map((action) => (
                    <option key={action} value={action}>
                      {formatActionName(action)}
                    </option>
                  ))}
                </StyledSelect>
              </div>
              <div className="flex-1">
                <label className="text-sm text-[var(--muted-foreground)]">Target Type</label>
                <StyledSelect
                  className="mt-1 w-full bg-[var(--background)]"
                  value={targetTypeFilter}
                  onChange={(v) => setTargetTypeFilter(v)}
                >
                  <option value="">All Types</option>
                  <option value="user">User</option>
                  <option value="device">Device</option>
                  <option value="session">Session</option>
                  <option value="recording">Recording</option>
                  <option value="settings">Settings</option>
                  <option value="system">System</option>
                </StyledSelect>
              </div>
              <div className="pt-6">
                <Button variant="ghost" onClick={handleClearFilters}>
                  <FiX className="w-4 h-4 mr-1" aria-hidden="true" />
                  Clear
                </Button>
              </div>
            </div>
          )}
        </CardHeader>
        <CardContent>
          {isLoading && logs.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <FiLoader className="w-8 h-8 animate-spin text-[var(--primary)]" aria-hidden="true" />
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-12 text-[var(--muted-foreground)]">
              {searchQuery || actionFilter || targetTypeFilter
                ? 'No logs found matching your filters'
                : 'No audit logs yet'}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <caption className="sr-only">Audit logs table showing system activity.</caption>
                  <thead>
                    <tr className="border-b border-[var(--border)]">
                      <th className="text-left py-3 px-4 font-medium text-[var(--muted-foreground)]">
                        Action
                      </th>
                      <th className="text-left py-3 px-4 font-medium text-[var(--muted-foreground)]">
                        Admin
                      </th>
                      <th className="text-left py-3 px-4 font-medium text-[var(--muted-foreground)]">
                        Target
                      </th>
                      <th className="text-left py-3 px-4 font-medium text-[var(--muted-foreground)]">
                        IP Address
                      </th>
                      <th className="text-left py-3 px-4 font-medium text-[var(--muted-foreground)]">
                        Timestamp
                      </th>
                      <th className="text-right py-3 px-4 font-medium text-[var(--muted-foreground)]">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((log) => (
                      <AuditLogRow key={log.id} log={log} onViewDetails={handleViewDetails} />
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {data?.meta && data.meta.totalPages > 1 && (
                <div className="mt-6 border-t border-[var(--border)] pt-4">
                  <Pagination
                    page={pagination.page}
                    totalPages={pagination.totalPages}
                    pageSize={pagination.pageSize}
                    totalItems={pagination.totalItems}
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

      {/* Details Modal */}
      {selectedLog && (
        <>
          <div className="fixed inset-0 z-40 bg-black/50" onClick={() => setSelectedLog(null)} />
          <div
            className="fixed inset-4 md:inset-auto md:left-1/2 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-[600px] md:max-h-[80vh] z-50 bg-[var(--card)] rounded-xl shadow-xl overflow-hidden"
            role="dialog"
            aria-modal="true"
            aria-labelledby="details-title"
          >
            <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
              <h2 id="details-title" className="text-lg font-semibold text-[var(--foreground)]">
                Audit Log Details
              </h2>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setSelectedLog(null)}
                aria-label="Close"
              >
                <FiX className="w-4 h-4" aria-hidden="true" />
              </Button>
            </div>
            <div className="p-4 overflow-y-auto max-h-[60vh]">
              <dl className="space-y-4">
                <div>
                  <dt className="text-sm text-[var(--muted-foreground)]">Action</dt>
                  <dd className="mt-1">
                    <span
                      className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getActionColor(
                        selectedLog.action
                      )}`}
                    >
                      {formatActionName(selectedLog.action)}
                    </span>
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-[var(--muted-foreground)]">Admin</dt>
                  <dd className="mt-1 text-[var(--foreground)]">
                    {selectedLog.adminName} ({selectedLog.adminEmail})
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-[var(--muted-foreground)]">Target</dt>
                  <dd className="mt-1 text-[var(--foreground)]">
                    <span className="capitalize">{selectedLog.targetType}</span>
                    {selectedLog.targetId && ` #${selectedLog.targetId}`}
                    {selectedLog.targetName && ` - ${selectedLog.targetName}`}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-[var(--muted-foreground)]">Timestamp</dt>
                  <dd className="mt-1 text-[var(--foreground)]">
                    {new Date(selectedLog.createdAt).toLocaleString()}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-[var(--muted-foreground)]">IP Address</dt>
                  <dd className="mt-1 font-mono text-[var(--foreground)]">
                    {selectedLog.ipAddress || 'N/A'}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-[var(--muted-foreground)]">User Agent</dt>
                  <dd className="mt-1 text-sm text-[var(--foreground)] break-all">
                    {selectedLog.userAgent || 'N/A'}
                  </dd>
                </div>
                {selectedLog.details && Object.keys(selectedLog.details).length > 0 && (
                  <div>
                    <dt className="text-sm text-[var(--muted-foreground)]">Details</dt>
                    <dd className="mt-1">
                      <pre className="p-3 bg-[var(--muted)] rounded-lg text-sm overflow-x-auto">
                        {JSON.stringify(selectedLog.details, null, 2)}
                      </pre>
                    </dd>
                  </div>
                )}
              </dl>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
