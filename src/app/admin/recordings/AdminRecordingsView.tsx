'use client';

/**
 * Admin Recordings View
 *
 * Admin-level recordings management: stats, organization quotas, delete old recordings.
 *
 * @module app/admin/recordings/AdminRecordingsView
 */

import React, { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  FiTrash2,
  FiDisc,
  FiClock,
  FiDownload,
  FiAlertCircle,
  FiLoader,
  FiEdit2,
  FiCheck,
  FiSearch,
  FiBriefcase,
  FiUsers,
  FiPlay,
} from 'react-icons/fi';
import { Card, CardContent, CardHeader, CardTitle, Button, Modal, Input } from '@/components/ui';
import {
  useRecordingStats,
  useDeleteOldRecordings,
  useOrganizationsWithQuotas,
  useUpdateOrganizationQuota,
  useConfirm,
  useAlert,
  useDebounce,
} from '@/lib/hooks';
import type { OrganizationQuota } from '@/lib/api';

const formatGB = (gb: number): string => {
  if (gb < 1) {
    return `${Math.round(gb * 1000)} MB`;
  }
  return `${gb.toFixed(1)} GB`;
};

const formatDuration = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
};

// ─── OrgQuotaRow ───────────────────────────────────────────────
interface OrgQuotaRowProps {
  org: OrganizationQuota;
  onEdit: (org: OrganizationQuota) => void;
  onView: (org: OrganizationQuota) => void;
}

const OrgQuotaRow = React.memo(function OrgQuotaRow({ org, onEdit, onView }: OrgQuotaRowProps) {
  const statusColors = {
    ok: 'bg-green-500',
    warning: 'bg-amber-500',
    exceeded: 'bg-red-500',
  };

  const statusBadgeColors = {
    ok: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    warning: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
    exceeded: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  };

  return (
    <tr className="border-b border-[var(--border)] hover:bg-[var(--muted)]/50">
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-[var(--primary)]/10">
            <FiBriefcase className="w-4 h-4 text-[var(--primary)]" />
          </div>
          <p className="font-medium text-[var(--foreground)]">{org.organizationName}</p>
        </div>
      </td>
      <td className="px-4 py-3 text-[var(--muted-foreground)]">
        <div className="flex items-center gap-2">
          <FiUsers className="w-4 h-4" />
          {org.userCount} users
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex-1 min-w-[100px]">
            <div className="h-2 bg-[var(--muted)] rounded-full overflow-hidden">
              <div
                className={`h-full transition-all ${statusColors[org.status]}`}
                style={{ width: `${Math.min(org.percentUsed, 100)}%` }}
              />
            </div>
          </div>
          <span className="text-sm text-[var(--muted-foreground)] whitespace-nowrap">
            {formatGB(org.usedGB)} / {formatGB(org.limitGB)}
          </span>
        </div>
      </td>
      <td className="px-4 py-3">
        <span
          className={`px-2 py-1 text-xs font-medium rounded-full ${statusBadgeColors[org.status]}`}
        >
          {org.status === 'ok' ? 'OK' : org.status === 'warning' ? 'Warning' : 'Exceeded'}
        </span>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={() => onView(org)}>
            <FiPlay className="w-4 h-4" />
            Manage recordings
          </Button>
          <Button variant="ghost" size="sm" onClick={() => onEdit(org)} aria-label="Edit quota">
            <FiEdit2 className="w-4 h-4" />
          </Button>
        </div>
      </td>
    </tr>
  );
});

// ─── AdminRecordingsView ───────────────────────────────────────
export function AdminRecordingsView() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebounce(searchQuery, 300);
  const { confirm } = useConfirm();
  const { success, error: showError } = useAlert();

  // Fetch stats
  const { data: stats, isLoading: statsLoading, error: statsError } = useRecordingStats();

  // Delete old recordings mutation
  const deleteOldMutation = useDeleteOldRecordings();

  // Fetch organizations with quotas
  const {
    data: quotaData,
    isLoading: quotasLoading,
    refetch: refetchQuotas,
  } = useOrganizationsWithQuotas({
    page,
    limit: 10,
    search: debouncedSearch || undefined,
  });

  // Update organization quota mutation
  const updateQuotaMutation = useUpdateOrganizationQuota();

  // Modal states
  const [showDaysModal, setShowDaysModal] = useState(false);
  const [daysInput, setDaysInput] = useState('30');
  const [editingOrg, setEditingOrg] = useState<OrganizationQuota | null>(null);
  const [editGB, setEditGB] = useState('');

  const handleOpenDeleteModal = useCallback(() => {
    setDaysInput('30');
    setShowDaysModal(true);
  }, []);

  const handleDeleteOld = useCallback(async () => {
    const days = parseInt(daysInput, 10);
    if (isNaN(days) || days < 1) return;

    setShowDaysModal(false);

    const confirmed = await confirm({
      title: 'Delete Old Recordings',
      message: `Are you sure you want to delete all recordings older than ${days} days? This action cannot be undone.`,
      confirmText: 'Delete',
      variant: 'danger',
    });

    if (confirmed) {
      try {
        const count = await deleteOldMutation.mutateAsync(days);
        await success(`${count} recordings deleted`);
      } catch (err) {
        console.error('Failed to delete old recordings:', err);
      }
    }
  }, [daysInput, confirm, deleteOldMutation, success]);

  const handleEditQuota = useCallback((org: OrganizationQuota) => {
    setEditingOrg(org);
    setEditGB(org.limitGB.toString());
  }, []);

  const handleSaveQuota = useCallback(async () => {
    if (!editingOrg) return;

    const gb = parseFloat(editGB);
    if (isNaN(gb) || gb < 0) {
      showError('Please enter a valid number of GB');
      return;
    }

    try {
      await updateQuotaMutation.mutateAsync({
        organizationId: editingOrg.organizationId,
        limitGB: gb,
      });
      await success(`Quota updated for ${editingOrg.organizationName}`);
      setEditingOrg(null);
      refetchQuotas();
    } catch (err) {
      console.error('Failed to update quota:', err);
      showError('Failed to update quota');
    }
  }, [editingOrg, editGB, updateQuotaMutation, success, showError, refetchQuotas]);

  const handleSearch = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    setPage(1);
  }, []);

  const totalPages = quotaData?.totalPages || 1;

  if (statsError) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <FiAlertCircle className="w-12 h-12 text-[var(--danger)] mx-auto mb-4" />
          <p className="text-[var(--danger)]">Failed to load recording statistics</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">Recordings</h1>
          <p className="text-[var(--muted-foreground)] mt-1">
            Manage recording storage and organization quotas
          </p>
        </div>
        <Button
          variant="danger"
          onClick={handleOpenDeleteModal}
          disabled={deleteOldMutation.isPending}
        >
          <FiTrash2 className="w-4 h-4" />
          Delete Old Recordings
        </Button>
      </div>

      {/* Stats Cards */}
      {statsLoading ? (
        <div className="flex items-center justify-center py-12">
          <FiLoader className="w-8 h-8 animate-spin text-[var(--primary)]" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-3 rounded-lg bg-blue-100 dark:bg-blue-900">
                <FiDisc className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-[var(--foreground)]">
                  {stats?.totalRecordings ?? 0}
                </p>
                <p className="text-sm text-[var(--muted-foreground)]">Total Recordings</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-3 rounded-lg bg-green-100 dark:bg-green-900">
                <FiClock className="w-5 h-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-[var(--foreground)]">
                  {stats?.avgDuration ? formatDuration(Math.round(stats.avgDuration)) : '0:00'}
                </p>
                <p className="text-sm text-[var(--muted-foreground)]">Avg Duration</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-3 rounded-lg bg-purple-100 dark:bg-purple-900">
                <FiDownload className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-[var(--foreground)]">
                  {stats?.totalSize ? formatBytes(stats.totalSize) : '0 B'}
                </p>
                <p className="text-sm text-[var(--muted-foreground)]">Total Size</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-3 rounded-lg bg-amber-100 dark:bg-amber-900">
                <FiBriefcase className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-[var(--foreground)]">
                  {quotaData?.total ?? 0}
                </p>
                <p className="text-sm text-[var(--muted-foreground)]">Organizations</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Organization Quotas */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Organization Quotas</CardTitle>
          <div className="relative w-64">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]" />
            <Input
              type="text"
              placeholder="Search organizations..."
              value={searchQuery}
              onChange={handleSearch}
              className="pl-10"
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {quotasLoading ? (
            <div className="flex items-center justify-center py-12">
              <FiLoader className="w-8 h-8 animate-spin text-[var(--primary)]" />
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-[var(--muted)]">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--muted-foreground)] uppercase">
                    Organization
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--muted-foreground)] uppercase">
                    Users
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--muted-foreground)] uppercase">
                    Usage
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--muted-foreground)] uppercase">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--muted-foreground)] uppercase">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {quotaData?.organizations?.map((org) => (
                  <OrgQuotaRow
                    key={org.organizationId}
                    org={org}
                    onEdit={handleEditQuota}
                    onView={(selectedOrg) =>
                      router.push(`/admin/recordings/${selectedOrg.organizationId}`)
                    }
                  />
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            Previous
          </Button>
          <span className="flex items-center px-4 text-sm text-[var(--muted-foreground)]">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
          >
            Next
          </Button>
        </div>
      )}

      {/* Delete Days Modal */}
      <Modal
        isOpen={showDaysModal}
        onClose={() => setShowDaysModal(false)}
        title="Delete Old Recordings"
      >
        <div className="space-y-4">
          <p className="text-[var(--muted-foreground)]">
            Enter the number of days. Recordings older than this will be deleted.
          </p>
          <Input
            type="number"
            min={1}
            value={daysInput}
            onChange={(e) => setDaysInput(e.target.value)}
            placeholder="Days"
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setShowDaysModal(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleDeleteOld}>
              Continue
            </Button>
          </div>
        </div>
      </Modal>

      {/* Edit Quota Modal */}
      <Modal
        isOpen={!!editingOrg}
        onClose={() => setEditingOrg(null)}
        title={`Edit Quota: ${editingOrg?.organizationName || ''}`}
      >
        {editingOrg && (
          <div className="space-y-4">
            <div className="p-3 bg-[var(--muted)] rounded-lg">
              <p className="text-sm text-[var(--muted-foreground)]">
                Current usage: {formatGB(editingOrg.usedGB)} /{' '}
                {formatGB(editingOrg.limitGB)}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
                Storage Limit (GB)
              </label>
              <Input
                type="number"
                min={0}
                step={1}
                value={editGB}
                onChange={(e) => setEditGB(e.target.value)}
                placeholder="Enter GB (e.g., 40)"
              />
              <p className="text-xs text-[var(--muted-foreground)] mt-1">
                Recording storage in GB (~0.69 GB per recorded hour). Set to 0 to disable recording.
              </p>
            </div>

            {parseFloat(editGB) > 0 && parseFloat(editGB) <= editingOrg.usedGB && (
              <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg text-amber-600 dark:text-amber-400 text-sm">
                Warning: This limit is less than or equal to current usage. New recordings will be
                blocked.
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setEditingOrg(null)}>
                Cancel
              </Button>
              <Button onClick={handleSaveQuota} disabled={updateQuotaMutation.isPending}>
                {updateQuotaMutation.isPending ? (
                  <FiLoader className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <FiCheck className="w-4 h-4 mr-2" />
                )}
                Save
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
