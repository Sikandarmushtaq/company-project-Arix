'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  FiRefreshCw,
  FiDownload,
  FiSearch,
  FiArrowUp,
  FiArrowDown,
  FiEdit2,
  FiClock,
  FiRotateCcw,
  FiX,
  FiMessageSquare,
  FiDollarSign,
  FiUsers,
} from 'react-icons/fi';
import { FaWhatsapp } from 'react-icons/fa';
import { whatsappAdminService } from '@/lib/api/services/whatsapp.service';
import type { UserWaUsage, WaUsageHistoryEntry } from '@/lib/api/services/whatsapp-types';
import { useSocketEvent } from '@/lib/providers/SocketProvider';
import { REALTIME_EVENTS } from '@/lib/constants/events';
import { toast } from 'sonner';

type SortField = 'total_sent' | 'total_received' | 'total_cost_cents' | 'phone';
type SortDir = 'asc' | 'desc';

function formatCost(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function getStatusInfo(user: UserWaUsage): { label: string; className: string } {
  if (!user.wa_limit || user.wa_limit <= 0)
    return { label: 'OK', className: 'bg-green-500/20 text-green-400' };
  const pct = (user.total_sent / user.wa_limit) * 100;
  if (pct >= 100) return { label: 'Limit Reached', className: 'bg-red-500/20 text-red-400' };
  if (pct >= 90) return { label: 'Near Limit', className: 'bg-amber-500/20 text-amber-400' };
  if (pct >= 80) return { label: 'Warning', className: 'bg-yellow-500/20 text-yellow-400' };
  return { label: 'OK', className: 'bg-green-500/20 text-green-400' };
}

export default function WhatsAppUsagePage() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<SortField>('total_sent');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [editLimitUser, setEditLimitUser] = useState<{
    phone: string;
    currentLimit: number | null;
  } | null>(null);
  const [editLimitValue, setEditLimitValue] = useState('');
  const [historyUser, setHistoryUser] = useState<string | null>(null);
  const [historyData, setHistoryData] = useState<WaUsageHistoryEntry[]>([]);

  const { data: summary } = useQuery({
    queryKey: ['wa-usage-summary'],
    queryFn: () => whatsappAdminService.getUsageSummary(),
    refetchInterval: 30000,
  });

  const { data: userStats } = useQuery({
    queryKey: ['wa-user-stats'],
    queryFn: () => whatsappAdminService.getUserUsageStats(),
    refetchInterval: 30000,
  });

  // Real-time updates
  useSocketEvent(REALTIME_EVENTS.WA_ADMIN_USAGE_UPDATE, () => {
    queryClient.invalidateQueries({ queryKey: ['wa-usage-summary'] });
    queryClient.invalidateQueries({ queryKey: ['wa-user-stats'] });
  });

  const resetMutation = useMutation({
    mutationFn: ({ phone, reason }: { phone?: string; reason?: string }) =>
      whatsappAdminService.resetCounters(phone, reason),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['wa-usage-summary'] });
      queryClient.invalidateQueries({ queryKey: ['wa-user-stats'] });
      toast.success(vars.phone ? `Counter reset for ${vars.phone}` : 'All counters reset');
      setShowResetConfirm(false);
    },
    onError: () => toast.error('Failed to reset counters'),
  });

  const updateLimitMutation = useMutation({
    mutationFn: ({ phone, limit }: { phone: string; limit: number | null }) =>
      whatsappAdminService.updateUserLimit(phone, limit),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wa-user-stats'] });
      toast.success('Limit updated');
      setEditLimitUser(null);
    },
    onError: () => toast.error('Failed to update limit'),
  });

  // Sort & filter
  const filteredUsers = (userStats || [])
    .filter((u) => {
      if (!searchTerm) return true;
      const term = searchTerm.toLowerCase();
      return (
        u.phone?.toLowerCase().includes(term) ||
        u.user_name?.toLowerCase().includes(term) ||
        u.user_email?.toLowerCase().includes(term)
      );
    })
    .sort((a, b) => {
      const aVal = a[sortField] ?? 0;
      const bVal = b[sortField] ?? 0;
      return sortDir === 'asc' ? (aVal > bVal ? 1 : -1) : aVal < bVal ? 1 : -1;
    });

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  const SortIcon = ({ field }: { field: SortField }) =>
    sortField === field ? (
      sortDir === 'asc' ? (
        <FiArrowUp className="w-3 h-3" />
      ) : (
        <FiArrowDown className="w-3 h-3" />
      )
    ) : null;

  const handleViewHistory = async (phone: string) => {
    setHistoryUser(phone);
    try {
      const history = await whatsappAdminService.getUserHistory(phone);
      setHistoryData(history);
    } catch {
      toast.error('Failed to load history');
    }
  };

  const exportCSV = () => {
    const headers = [
      'Phone',
      'Name',
      'Email',
      'Sent',
      'Received',
      'Conversations',
      'Cost ($)',
      'Limit',
      'Status',
    ];
    const rows = filteredUsers.map((u) => {
      const status = getStatusInfo(u);
      return [
        u.phone,
        u.user_name || '',
        u.user_email || '',
        u.total_sent,
        u.total_received,
        u.total_conversations_opened,
        (u.total_cost_cents / 100).toFixed(2),
        u.wa_limit || 'Unlimited',
        status.label,
      ];
    });
    const csv = [headers, ...rows]
      .map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `whatsapp-usage-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FaWhatsapp className="text-green-500" />
            WhatsApp Usage
          </h1>
          <span className="flex items-center gap-1 text-xs text-green-400">
            <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            Live
          </span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowResetConfirm(true)}
            className="flex items-center gap-2 px-3 py-2 text-sm border border-[var(--border)] rounded-lg hover:bg-[var(--card)]"
          >
            <FiRefreshCw className="w-4 h-4" /> Reset All
          </button>
          <button
            onClick={exportCSV}
            className="flex items-center gap-2 px-3 py-2 text-sm border border-[var(--border)] rounded-lg hover:bg-[var(--card)]"
          >
            <FiDownload className="w-4 h-4" /> Export CSV
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: 'Total Users',
            value: summary?.totalUsers || 0,
            icon: <FiUsers className="w-5 h-5 text-blue-400" />,
          },
          {
            label: 'Messages Sent',
            value: summary?.totalSent || 0,
            icon: <FiMessageSquare className="w-5 h-5 text-green-400" />,
          },
          {
            label: 'Messages Received',
            value: summary?.totalReceived || 0,
            icon: <FiMessageSquare className="w-5 h-5 text-purple-400" />,
          },
          {
            label: 'Total Cost',
            value: formatCost(summary?.totalCostCents || 0),
            icon: <FiDollarSign className="w-5 h-5 text-amber-400" />,
          },
        ].map(({ label, value, icon }) => (
          <div
            key={label}
            className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4"
          >
            <div className="flex items-center gap-2 text-sm text-[var(--muted-foreground)]">
              {icon} {label}
            </div>
            <div className="text-2xl font-bold mt-1">{value}</div>
          </div>
        ))}
      </div>

      {/* Users Table */}
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl">
        <div className="p-4 border-b border-[var(--border)] flex items-center justify-between">
          <h2 className="font-semibold">Per-User Usage</h2>
          <div className="relative">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted-foreground)]" />
            <input
              type="text"
              placeholder="Search users..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-3 py-1.5 bg-[var(--background)] border border-[var(--border)] rounded-lg text-sm w-64"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] text-[var(--muted-foreground)]">
                <th
                  className="px-4 py-3 text-left cursor-pointer"
                  onClick={() => handleSort('phone')}
                >
                  User <SortIcon field="phone" />
                </th>
                <th
                  className="px-4 py-3 text-right cursor-pointer"
                  onClick={() => handleSort('total_sent')}
                >
                  Sent <SortIcon field="total_sent" />
                </th>
                <th
                  className="px-4 py-3 text-right cursor-pointer"
                  onClick={() => handleSort('total_received')}
                >
                  Received <SortIcon field="total_received" />
                </th>
                <th
                  className="px-4 py-3 text-right cursor-pointer"
                  onClick={() => handleSort('total_cost_cents')}
                >
                  Cost <SortIcon field="total_cost_cents" />
                </th>
                <th className="px-4 py-3 text-center">Limit</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user) => {
                const status = getStatusInfo(user);
                return (
                  <tr
                    key={user.phone}
                    className="border-b border-[var(--border)] hover:bg-[var(--background)]/50"
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium">{user.user_name || user.phone}</div>
                      {user.user_name && (
                        <div className="text-xs text-[var(--muted-foreground)]">{user.phone}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">{user.total_sent}</td>
                    <td className="px-4 py-3 text-right">{user.total_received}</td>
                    <td className="px-4 py-3 text-right">{formatCost(user.total_cost_cents)}</td>
                    <td className="px-4 py-3 text-center">{user.wa_limit || '∞'}</td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-medium ${status.className}`}
                      >
                        {status.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => {
                            setEditLimitUser({ phone: user.phone, currentLimit: user.wa_limit });
                            setEditLimitValue(user.wa_limit ? String(user.wa_limit) : '');
                          }}
                          className="p-1.5 rounded hover:bg-[var(--background)]"
                          title="Edit limit"
                        >
                          <FiEdit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleViewHistory(user.phone)}
                          className="p-1.5 rounded hover:bg-[var(--background)]"
                          title="View history"
                        >
                          <FiClock className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() =>
                            resetMutation.mutate({
                              phone: user.phone,
                              reason: 'Manual admin reset',
                            })
                          }
                          className="p-1.5 rounded hover:bg-[var(--background)]"
                          title="Reset counter"
                        >
                          <FiRotateCcw className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredUsers.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-[var(--muted-foreground)]">
                    No usage data yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Reset All Confirm Modal */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-6 max-w-sm w-full mx-4">
            <h3 className="text-lg font-semibold mb-2">Reset All Counters?</h3>
            <p className="text-sm text-[var(--muted-foreground)] mb-4">
              This will reset all WhatsApp usage counters. History will be preserved.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowResetConfirm(false)}
                className="px-3 py-1.5 text-sm border border-[var(--border)] rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={() => resetMutation.mutate({ reason: 'Bulk admin reset' })}
                className="px-3 py-1.5 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Reset All
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Limit Modal */}
      {editLimitUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-6 max-w-sm w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Set WA Limit</h3>
              <button onClick={() => setEditLimitUser(null)}>
                <FiX className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-[var(--muted-foreground)] mb-3">{editLimitUser.phone}</p>
            <input
              type="number"
              min="0"
              value={editLimitValue}
              onChange={(e) => setEditLimitValue(e.target.value)}
              placeholder="Leave blank for unlimited"
              className="w-full px-3 py-2 bg-[var(--background)] border border-[var(--border)] rounded-lg text-sm mb-4"
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setEditLimitUser(null)}
                className="px-3 py-1.5 text-sm border border-[var(--border)] rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const limit = editLimitValue ? parseInt(editLimitValue, 10) : null;
                  updateLimitMutation.mutate({ phone: editLimitUser.phone, limit });
                }}
                className="px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* History Modal */}
      {historyUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-6 max-w-lg w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Usage History — {historyUser}</h3>
              <button onClick={() => setHistoryUser(null)}>
                <FiX className="w-5 h-5" />
              </button>
            </div>
            {historyData.length === 0 ? (
              <p className="text-sm text-[var(--muted-foreground)]">No history records</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)] text-[var(--muted-foreground)]">
                    <th className="px-2 py-2 text-left">Period</th>
                    <th className="px-2 py-2 text-right">Sent</th>
                    <th className="px-2 py-2 text-right">Received</th>
                    <th className="px-2 py-2 text-right">Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {historyData.map((h) => (
                    <tr key={h.id} className="border-b border-[var(--border)]">
                      <td className="px-2 py-2">
                        {h.periodStart?.slice(0, 10)} — {h.periodEnd?.slice(0, 10)}
                      </td>
                      <td className="px-2 py-2 text-right">{h.totalSent}</td>
                      <td className="px-2 py-2 text-right">{h.totalReceived}</td>
                      <td className="px-2 py-2 text-right">{formatCost(h.totalCostCents)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
