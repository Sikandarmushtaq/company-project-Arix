'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  FiMessageSquare,
  FiImage,
  FiDollarSign,
  FiUsers,
  FiLoader,
  FiAlertTriangle,
  FiDownload,
  FiRefreshCw,
  FiSearch,
  FiArrowUp,
  FiArrowDown,
  FiEdit2,
  FiClock,
  FiX,
} from 'react-icons/fi';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, Button, Input } from '@/components/ui';
import { smsAdminService, type SmsUsageHistoryEntry } from '@/lib/api/services';
import { toast } from 'sonner';
import { useSocket } from '@/lib/providers/SocketProvider';
import { REALTIME_EVENTS } from '@/lib/constants/events';
import { usePermissions } from '@/lib/hooks/usePermissions';
import { PERMISSIONS } from '@/lib/constants/permissions';

type SortField = 'totalSent' | 'totalReceived' | 'totalUsed' | 'totalCost' | 'phone';
type SortDirection = 'asc' | 'desc';

/**
 * Sort indicator component
 */
function SortIndicator({
  field,
  sortField,
  sortDirection,
}: {
  field: SortField;
  sortField: SortField;
  sortDirection: SortDirection;
}) {
  if (sortField !== field) return null;
  return sortDirection === 'asc' ? (
    <FiArrowUp className="w-4 h-4 inline ml-1" />
  ) : (
    <FiArrowDown className="w-4 h-4 inline ml-1" />
  );
}

/**
 * Format tenths of cents to dollars
 * Values are stored in tenths of cents (0.1¢ = $0.001)
 */
function formatCost(tenthCents: number): string {
  const dollars = tenthCents / 1000;
  if (dollars === 0) return '$0.00';
  if (dollars >= 1) return `$${dollars.toFixed(2)}`;
  return `$${dollars.toFixed(3)}`;
}

/**
 * Get status badge color
 */
function getStatusColor(status: string): string {
  switch (status) {
    case 'ok':
      return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
    case 'warning':
      return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
    case 'near_limit':
      return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400';
    case 'limit_reached':
      return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
    default:
      return 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400';
  }
}

/**
 * Format status for display
 */
function formatStatus(status: string): string {
  switch (status) {
    case 'ok':
      return 'OK';
    case 'warning':
      return 'Warning (80%+)';
    case 'near_limit':
      return 'Near Limit (90%+)';
    case 'limit_reached':
      return 'Limit Reached';
    default:
      return status;
  }
}

/**
 * Escape a value for CSV export
 */
function escapeCsvValue(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  const str = String(value);

  const dangerousChars = ['=', '+', '-', '@', '\t', '\r'];
  if (dangerousChars.some((char) => str.startsWith(char))) {
    return `"'${str.replace(/"/g, '""')}"`;
  }

  if (str.includes(',') || str.includes('\n') || str.includes('"') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }

  return str;
}

export default function SmsUsagePage() {
  const queryClient = useQueryClient();
  const { socket } = useSocket();
  const { isAdmin, hasPermission } = usePermissions();
  // SMS Usage is hidden unless a super-admin grants VIEW_SMS_USAGE (super_admin
  // itself bypasses). Gate the data fetch + guard the page against direct nav.
  const canView = hasPermission(PERMISSIONS.VIEW_SMS_USAGE);
  const [searchTerm, setSearchTerm] = useState('');
  // Default to totalUsed desc — under the hybrid policy this is the
  // column that determines limit_reached / near_limit / warning status,
  // so an admin opening the page lands on the at-risk users at the top
  // without having to click a header first.
  const [sortField, setSortField] = useState<SortField>('totalUsed');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  // Modal states
  const [editLimitUser, setEditLimitUser] = useState<{
    phone: string;
    currentLimit: number | null;
  } | null>(null);
  const [editLimitValue, setEditLimitValue] = useState<string>('');
  const [historyUser, setHistoryUser] = useState<string | null>(null);
  const [historyData, setHistoryData] = useState<SmsUsageHistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Real-time update indicator
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [isUpdating, setIsUpdating] = useState(false);

  // Real-time updates
  const handleSmsUsageUpdate = useCallback(() => {
    setIsUpdating(true);
    queryClient.invalidateQueries({ queryKey: ['sms-usage-summary'] });
    queryClient.invalidateQueries({ queryKey: ['sms-user-stats'] });
    setLastUpdated(new Date());
    // Clear the updating indicator after a short delay
    setTimeout(() => setIsUpdating(false), 1000);
  }, [queryClient]);

  useEffect(() => {
    if (!socket) return;
    socket.on(REALTIME_EVENTS.SMS_ADMIN_USAGE_UPDATE, handleSmsUsageUpdate);
    return () => {
      socket.off(REALTIME_EVENTS.SMS_ADMIN_USAGE_UPDATE, handleSmsUsageUpdate);
    };
  }, [socket, handleSmsUsageUpdate]);

  // Fetch usage summary
  const {
    data: summary,
    isLoading: summaryLoading,
    error: summaryError,
  } = useQuery({
    queryKey: ['sms-usage-summary'],
    queryFn: () => smsAdminService.getUsageSummary(),
    refetchInterval: 30000,
    enabled: canView,
  });

  // Fetch per-user stats
  const {
    data: userStats,
    isLoading: statsLoading,
    error: statsError,
  } = useQuery({
    queryKey: ['sms-user-stats'],
    queryFn: () => smsAdminService.getUserUsageStats(),
    refetchInterval: 30000,
    enabled: canView,
  });

  // Reset counters mutation
  const resetMutation = useMutation({
    mutationFn: (userPhone?: string) => smsAdminService.resetCounters(userPhone),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sms-usage-summary'] });
      queryClient.invalidateQueries({ queryKey: ['sms-user-stats'] });
      toast.success('Counters reset successfully');
      setShowResetConfirm(false);
    },
    onError: () => {
      toast.error('Failed to reset counters');
    },
  });

  // Update limit mutation
  const updateLimitMutation = useMutation({
    mutationFn: ({ phone, limit }: { phone: string; limit: number | null }) =>
      smsAdminService.updateUserLimit(phone, limit),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sms-user-stats'] });
      toast.success('SMS limit updated');
      setEditLimitUser(null);
    },
    onError: () => {
      toast.error('Failed to update SMS limit');
    },
  });

  // Load user history
  const loadUserHistory = useCallback(async (phone: string) => {
    setHistoryUser(phone);
    setHistoryLoading(true);
    try {
      const data = await smsAdminService.getUserHistory(phone);
      setHistoryData(data);
    } catch {
      toast.error('Failed to load usage history');
      setHistoryUser(null);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  // Handle edit limit
  const handleEditLimit = (phone: string, currentLimit: number | null) => {
    setEditLimitUser({ phone, currentLimit });
    setEditLimitValue(currentLimit?.toString() || '');
  };

  // Save limit
  const handleSaveLimit = () => {
    if (!editLimitUser) return;
    const limit = editLimitValue === '' ? null : parseInt(editLimitValue, 10);
    if (editLimitValue !== '' && (isNaN(limit!) || limit! < 0)) {
      toast.error('Please enter a valid limit (0 or more, or leave empty for unlimited)');
      return;
    }
    updateLimitMutation.mutate({ phone: editLimitUser.phone, limit });
  };

  // Sort and filter users
  const filteredAndSortedUsers = useMemo(() => {
    if (!userStats) return [];

    let filtered = userStats;

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (user) =>
          user.phone.toLowerCase().includes(term) ||
          user.userName?.toLowerCase().includes(term) ||
          user.userEmail?.toLowerCase().includes(term)
      );
    }

    return [...filtered].sort((a, b) => {
      let aVal: number | string;
      let bVal: number | string;

      switch (sortField) {
        case 'phone':
          aVal = a.phone;
          bVal = b.phone;
          break;
        case 'totalSent':
          // Column displays SMS-only segments (totalSegmentsSent has
          // MMS × 3 baked in by migration 027 — strip it back out so
          // clicking the header sorts what the user actually sees).
          aVal = a.totalSegmentsSent - a.totalMmsSent * 3;
          bVal = b.totalSegmentsSent - b.totalMmsSent * 3;
          break;
        case 'totalReceived':
          aVal = a.totalSegmentsReceived - a.totalMmsReceived * 3;
          bVal = b.totalSegmentsReceived - b.totalMmsReceived * 3;
          break;
        case 'totalUsed':
          aVal = a.totalUsed;
          bVal = b.totalUsed;
          break;
        case 'totalCost':
          aVal = a.totalCostTwilioCents;
          bVal = b.totalCostTwilioCents;
          break;
        default:
          return 0;
      }

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }

      return sortDirection === 'asc'
        ? (aVal as number) - (bVal as number)
        : (bVal as number) - (aVal as number);
    });
  }, [userStats, searchTerm, sortField, sortDirection]);

  // Handle sort click
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  // Export to CSV
  const handleExport = () => {
    if (!userStats || userStats.length === 0) return;

    // Column order mirrors the dashboard so auditors don't have to
    // re-map. Three "limit-unit" columns break the cap down by source:
    //   SMS Sent Segs   = SMS-only outbound segments
    //   SMS Recv Segs   = SMS-only inbound segments
    //   MMS Units (×3)  = (MMS Sent + MMS Received) × 3, the MMS
    //                     contribution to the cap
    // Their sum = "Segments Used", which is what smsLimit gates on.
    // Raw message counts (totalSent / totalReceived) and per-direction
    // MMS counts are kept for billing reconciliation.
    const headers = [
      'Phone',
      'User Name',
      'Email',
      'SMS Sent (messages)',
      'SMS Received (messages)',
      'MMS Sent (messages)',
      'MMS Received (messages)',
      'SMS Sent (segments)',
      'SMS Received (segments)',
      'MMS Units toward Limit (×3)',
      'Segments Used (the gated metric)',
      'Total Cost ($)',
      'Limit (segments)',
      'Remaining (segments)',
      'Status',
    ];

    const rows = userStats.map((u) => {
      const remaining =
        u.smsLimit != null && u.smsLimit > 0
          ? Math.max(0, u.smsLimit - u.totalUsed).toString()
          : 'Unlimited';
      // Strip the MMS×3 contribution baked into total_segments_* by
      // migration 027 to recover the pure SMS-only segment counts.
      const smsSentSegs = u.totalSegmentsSent - u.totalMmsSent * 3;
      const smsRecvSegs = u.totalSegmentsReceived - u.totalMmsReceived * 3;
      const mmsUnits = (u.totalMmsSent + u.totalMmsReceived) * 3;
      return [
        escapeCsvValue(u.phone),
        escapeCsvValue(u.userName),
        escapeCsvValue(u.userEmail),
        escapeCsvValue(u.totalSent),
        escapeCsvValue(u.totalReceived),
        escapeCsvValue(u.totalMmsSent),
        escapeCsvValue(u.totalMmsReceived),
        escapeCsvValue(smsSentSegs),
        escapeCsvValue(smsRecvSegs),
        escapeCsvValue(mmsUnits),
        escapeCsvValue(u.totalUsed),
        escapeCsvValue((u.totalCostTwilioCents / 1000).toFixed(3)),
        escapeCsvValue(u.smsLimit || 'Unlimited'),
        escapeCsvValue(remaining),
        escapeCsvValue(formatStatus(u.status)),
      ];
    });

    const csv = [headers.map(escapeCsvValue).join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sms-usage-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // No access → render nothing; the admin layout's route guard redirects the
  // user away. We intentionally show no "unavailable" message — the page simply
  // doesn't exist for them until a super-admin enables the SMS Usage module.
  if (!canView) return null;

  const isLoading = summaryLoading || statsLoading;
  const error = summaryError || statsError;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <FiLoader className="w-8 h-8 animate-spin text-[var(--primary)]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <FiAlertTriangle className="w-12 h-12 text-[var(--danger)] mx-auto mb-4" />
          <p className="text-[var(--danger)]">Failed to load SMS usage data</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-[var(--foreground)]">SMS Usage</h1>
            <div
              className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium transition-all ${
                isUpdating
                  ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                  : 'bg-[var(--muted)] text-[var(--muted-foreground)]'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  isUpdating ? 'bg-green-500 animate-pulse' : 'bg-green-500'
                }`}
              />
              <span>{isUpdating ? 'Updating...' : 'Live'}</span>
            </div>
          </div>
          <p className="text-[var(--muted-foreground)] mt-1">
            {isAdmin
              ? 'Monitor SMS/MMS usage across all users'
              : 'Monitor SMS/MMS usage for your organization'}
            <span className="text-xs ml-2">· Last updated: {lastUpdated.toLocaleTimeString()}</span>
          </p>
        </div>
        <div className="flex gap-3">
          {isAdmin &&
            (showResetConfirm ? (
              <div className="flex items-center gap-2 p-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                <span className="text-sm text-amber-700 dark:text-amber-300">
                  Reset all counters?
                </span>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => resetMutation.mutate(undefined)}
                  disabled={resetMutation.isPending}
                >
                  {resetMutation.isPending ? <FiLoader className="w-4 h-4 animate-spin" /> : 'Yes'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowResetConfirm(false)}
                  disabled={resetMutation.isPending}
                >
                  Cancel
                </Button>
              </div>
            ) : (
              <Button
                variant="outline"
                onClick={() => setShowResetConfirm(true)}
                disabled={resetMutation.isPending}
              >
                <FiRefreshCw className="w-4 h-4" />
                Reset All
              </Button>
            ))}
          <Button onClick={handleExport} disabled={!userStats || userStats.length === 0}>
            <FiDownload className="w-4 h-4" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                <FiMessageSquare className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-sm text-[var(--muted-foreground)]">Total SMS</p>
                <p className="text-2xl font-bold text-[var(--foreground)]">
                  {(summary?.totalSmsSent || 0) + (summary?.totalSmsReceived || 0)}
                </p>
                <p className="text-xs text-[var(--muted-foreground)]">
                  {summary?.totalSmsSent || 0} sent / {summary?.totalSmsReceived || 0} received
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-purple-100 dark:bg-purple-900/30">
                <FiImage className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-sm text-[var(--muted-foreground)]">Total MMS</p>
                <p className="text-2xl font-bold text-[var(--foreground)]">
                  {(summary?.totalMmsSent || 0) + (summary?.totalMmsReceived || 0)}
                </p>
                <p className="text-xs text-[var(--muted-foreground)]">
                  {summary?.totalMmsSent || 0} sent / {summary?.totalMmsReceived || 0} received
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-green-100 dark:bg-green-900/30">
                <FiDollarSign className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-sm text-[var(--muted-foreground)]">Total Cost</p>
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {formatCost(summary?.totalCostTwilioCents || 0)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-amber-100 dark:bg-amber-900/30">
                <FiAlertTriangle className="w-6 h-6 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-sm text-[var(--muted-foreground)]">Limit Status</p>
                <p className="text-2xl font-bold text-[var(--foreground)]">
                  {userStats?.filter((u) => u.status === 'limit_reached').length || 0}
                </p>
                <p className="text-xs text-[var(--muted-foreground)]">
                  {userStats?.filter((u) => u.status === 'near_limit' || u.status === 'warning')
                    .length || 0}{' '}
                  approaching limit
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <FiUsers className="w-5 h-5 text-[var(--foreground)]" />
              Per-User Usage ({filteredAndSortedUsers.length} users)
            </CardTitle>
            <div className="relative w-64">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted-foreground)]" />
              <Input
                placeholder="Search by phone, name, email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredAndSortedUsers.length === 0 ? (
            <div className="text-center py-8 text-[var(--muted-foreground)]">
              {searchTerm ? 'No users match your search' : 'No usage data available'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[var(--border)]">
                    <th
                      className="text-left py-3 px-4 font-medium text-[var(--muted-foreground)] cursor-pointer hover:text-[var(--foreground)]"
                      onClick={() => handleSort('phone')}
                    >
                      User{' '}
                      <SortIndicator
                        field="phone"
                        sortField={sortField}
                        sortDirection={sortDirection}
                      />
                    </th>
                    <th
                      className="text-right py-3 px-4 font-medium text-[var(--muted-foreground)] cursor-pointer hover:text-[var(--foreground)]"
                      onClick={() => handleSort('totalSent')}
                      title="SMS-only segments sent (MMS shown separately in the MMS column)."
                    >
                      SMS Sent (segs){' '}
                      <SortIndicator
                        field="totalSent"
                        sortField={sortField}
                        sortDirection={sortDirection}
                      />
                    </th>
                    <th
                      className="text-right py-3 px-4 font-medium text-[var(--muted-foreground)] cursor-pointer hover:text-[var(--foreground)]"
                      onClick={() => handleSort('totalReceived')}
                      title="SMS-only segments received (MMS shown separately in the MMS column)."
                    >
                      SMS Received (segs){' '}
                      <SortIndicator
                        field="totalReceived"
                        sortField={sortField}
                        sortDirection={sortDirection}
                      />
                    </th>
                    <th
                      className="text-right py-3 px-4 font-medium text-[var(--muted-foreground)]"
                      title="MMS messages (count) — each contributes 3 segments to the limit."
                    >
                      MMS (×3)
                    </th>
                    <th
                      className="text-right py-3 px-4 font-medium text-[var(--muted-foreground)] cursor-pointer hover:text-[var(--foreground)]"
                      onClick={() => handleSort('totalCost')}
                    >
                      Cost{' '}
                      <SortIndicator
                        field="totalCost"
                        sortField={sortField}
                        sortDirection={sortDirection}
                      />
                    </th>
                    <th
                      className="text-right py-3 px-4 font-medium text-[var(--muted-foreground)] cursor-pointer hover:text-[var(--foreground)]"
                      onClick={() => handleSort('totalUsed')}
                      title="Segment-based usage. SMS counts as actual segments (a 300-char SMS = 3 segments). MMS counts as 3 segments per message (matches Twilio's MMS pricing ratio). Both directions count toward the limit."
                    >
                      Segments / Limit{' '}
                      <SortIndicator
                        field="totalUsed"
                        sortField={sortField}
                        sortDirection={sortDirection}
                      />
                    </th>
                    <th className="text-right py-3 px-4 font-medium text-[var(--muted-foreground)]">
                      Remaining
                    </th>
                    <th className="text-center py-3 px-4 font-medium text-[var(--muted-foreground)]">
                      Status
                    </th>
                    {isAdmin && (
                      <th className="text-right py-3 px-4 font-medium text-[var(--muted-foreground)]">
                        Actions
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {filteredAndSortedUsers.map((user) => (
                    <tr
                      key={user.phone}
                      className="border-b border-[var(--border)] hover:bg-[var(--muted)]"
                    >
                      <td className="py-3 px-4">
                        <div>
                          <p className="font-medium text-[var(--foreground)]">{user.phone}</p>
                          {(user.userName || user.userEmail) && (
                            <p className="text-sm text-[var(--muted-foreground)]">
                              {user.userName || user.userEmail}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="text-right py-3 px-4 text-[var(--foreground)]">
                        {/* SMS-only segments — backend's totalSegmentsSent
                            has MMS × 3 baked in (migration 027); subtract
                            the MMS contribution to show the pure SMS half. */}
                        {user.totalSegmentsSent - user.totalMmsSent * 3}
                      </td>
                      <td className="text-right py-3 px-4 text-[var(--foreground)]">
                        {user.totalSegmentsReceived - user.totalMmsReceived * 3}
                      </td>
                      <td className="text-right py-3 px-4 text-[var(--foreground)]">
                        {/* MMS message count + the limit-unit contribution
                            (× 3 per MMS, both directions combined). The
                            small "= N segs" makes the cap math visible:
                            SMS Sent + SMS Received + this = Segments/Limit. */}
                        <div>{user.totalMmsSent + user.totalMmsReceived}</div>
                        <div className="text-xs text-[var(--muted-foreground)]">
                          = {(user.totalMmsSent + user.totalMmsReceived) * 3} segs
                        </div>
                      </td>
                      <td className="text-right py-3 px-4 font-medium text-green-600 dark:text-green-400">
                        {formatCost(user.totalCostTwilioCents)}
                      </td>
                      <td className="text-right py-3 px-4 text-[var(--foreground)]">
                        <div className="flex flex-col items-end gap-1">
                          {/* totalUsed is now SEGMENTS (segmentsSent +
                              segmentsReceived) — the metric the cap is
                              enforced against. Twilio bills per segment
                              and our smsLimit was scaled accordingly in
                              the messages→segments migration (2026-05-23).
                              The progress bar and status badge both compute
                              off this value. */}
                          <span>
                            {user.totalUsed} / {user.smsLimit || '∞'}
                          </span>
                          {/* Metered (reskin) orgs are governed by a SHARED org
                              package — the figure above is the whole org's usage
                              vs its bundle allowance (what the send-gate enforces),
                              identical for every user in the org. Label it so an
                              admin doesn't read it as a per-user cap. */}
                          {user.metered && (
                            <span className="text-[10px] uppercase tracking-wide text-[var(--muted-foreground)]">
                              shared org {user.smsAllowanceSource === 'bundle' ? 'package' : 'plan'}
                            </span>
                          )}
                          {user.smsLimit != null && user.smsLimit > 0 && (
                            <div className="w-20 h-1.5 bg-[var(--muted)] rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${
                                  user.status === 'limit_reached'
                                    ? 'bg-red-500'
                                    : user.status === 'near_limit'
                                      ? 'bg-orange-500'
                                      : user.status === 'warning'
                                        ? 'bg-amber-500'
                                        : 'bg-green-500'
                                }`}
                                style={{
                                  width: `${Math.min(100, (user.totalUsed / user.smsLimit) * 100)}%`,
                                }}
                              />
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="text-right py-3 px-4">
                        {user.smsLimit != null && user.smsLimit > 0 ? (
                          <span
                            className={`font-medium ${
                              user.smsLimit - user.totalUsed <= 0
                                ? 'text-red-600 dark:text-red-400'
                                : user.smsLimit - user.totalUsed <= user.smsLimit * 0.1
                                  ? 'text-orange-600 dark:text-orange-400'
                                  : 'text-green-600 dark:text-green-400'
                            }`}
                          >
                            {Math.max(0, user.smsLimit - user.totalUsed)}
                          </span>
                        ) : (
                          <span className="text-[var(--muted-foreground)]">∞</span>
                        )}
                      </td>
                      <td className="text-center py-3 px-4">
                        <span
                          className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(user.status)}`}
                        >
                          {formatStatus(user.status)}
                        </span>
                      </td>
                      {isAdmin && (
                        <td className="text-right py-3 px-4">
                          <div className="flex items-center justify-end gap-1">
                            {/* Per-user limit editing is meaningless for a metered
                                org (its cap is the shared org package, not this
                                field), so hide it there to prevent editing a value
                                that has no effect. */}
                            {!user.metered && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleEditLimit(user.phone, user.smsLimit)}
                                title="Edit SMS limit"
                              >
                                <FiEdit2 className="w-4 h-4" />
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => loadUserHistory(user.phone)}
                              title="View usage history"
                            >
                              <FiClock className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => resetMutation.mutate(user.phone)}
                              disabled={resetMutation.isPending}
                              title="Reset counter"
                            >
                              <FiRefreshCw className="w-4 h-4" />
                            </Button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Period Info */}
      {summary?.periodStart && (
        <div className="text-sm text-[var(--muted-foreground)] text-right">
          Period: {new Date(summary.periodStart).toLocaleDateString()} -{' '}
          {new Date(summary.periodEnd).toLocaleDateString()}
        </div>
      )}

      {/* Edit Limit Modal - Admin only */}
      {isAdmin && editLimitUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[var(--card)] rounded-lg p-6 w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-[var(--foreground)]">Edit SMS Limit</h3>
              <button
                onClick={() => setEditLimitUser(null)}
                className="text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              >
                <FiX className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-[var(--muted-foreground)] mb-4">
              Set monthly SMS limit for <strong>{editLimitUser.phone}</strong>
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
                Monthly Limit
              </label>
              <Input
                type="number"
                min="0"
                value={editLimitValue}
                onChange={(e) => setEditLimitValue(e.target.value)}
                placeholder="Enter limit (empty = unlimited)"
                className="w-full"
              />
              <p className="text-xs text-[var(--muted-foreground)] mt-1">
                Current: {editLimitUser.currentLimit ?? 'Unlimited'}
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setEditLimitUser(null)}>
                Cancel
              </Button>
              <Button onClick={handleSaveLimit} disabled={updateLimitMutation.isPending}>
                {updateLimitMutation.isPending ? 'Saving...' : 'Save'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Usage History Modal - Admin only */}
      {isAdmin && historyUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[var(--card)] rounded-lg p-6 w-full max-w-2xl shadow-xl max-h-[80vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-[var(--foreground)]">
                Usage History: {historyUser}
              </h3>
              <button
                onClick={() => setHistoryUser(null)}
                className="text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              >
                <FiX className="w-5 h-5" />
              </button>
            </div>

            {historyLoading ? (
              <div className="flex items-center justify-center py-8">
                <FiLoader className="w-6 h-6 animate-spin text-[var(--muted-foreground)]" />
              </div>
            ) : historyData.length === 0 ? (
              <div className="text-center py-8 text-[var(--muted-foreground)]">
                No usage history found.
              </div>
            ) : (
              // Used = Sent + Received under the hybrid policy. Red when
              // that period actually went over the cap so an admin
              // scanning history can spot months the user maxed out.
              <div className="overflow-auto flex-1">
                <table className="w-full text-sm">
                  <thead className="bg-[var(--muted)] sticky top-0">
                    <tr>
                      <th className="text-left py-2 px-3">Period</th>
                      <th className="text-right py-2 px-3">Sent</th>
                      <th className="text-right py-2 px-3">Received</th>
                      <th className="text-right py-2 px-3">Used</th>
                      <th className="text-right py-2 px-3">Cost</th>
                      <th className="text-right py-2 px-3">Limit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historyData.map((entry) => {
                      const used = entry.totalSent + entry.totalReceived;
                      const overLimit =
                        entry.smsLimit != null && entry.smsLimit > 0 && used >= entry.smsLimit;
                      return (
                        <tr key={entry.id} className="border-b border-[var(--border)]">
                          <td className="py-2 px-3">
                            {new Date(entry.periodStart).toLocaleDateString()} -{' '}
                            {new Date(entry.periodEnd).toLocaleDateString()}
                          </td>
                          <td className="text-right py-2 px-3">{entry.totalSent}</td>
                          <td className="text-right py-2 px-3">{entry.totalReceived}</td>
                          <td
                            className={`text-right py-2 px-3 font-medium ${
                              overLimit ? 'text-red-600 dark:text-red-400' : ''
                            }`}
                          >
                            {used}
                          </td>
                          <td className="text-right py-2 px-3">
                            {formatCost(entry.totalCostCents)}
                          </td>
                          <td className="text-right py-2 px-3">{entry.smsLimit ?? '∞'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex justify-end mt-4 pt-4 border-t border-[var(--border)]">
              <Button variant="ghost" onClick={() => setHistoryUser(null)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
