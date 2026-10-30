'use client';

/**
 * AI Auto-Dialer — Campaign List Page
 *
 * Main dashboard showing all campaigns with status, stats, and actions.
 * Real-time updates via WebSocket (no polling). Flush, on-theme layout
 * matching the reskinned phone pages.
 *
 * @module app/phone/auto-dialer/page
 */

import React, { useState, useCallback, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  FiPlus,
  FiPlay,
  FiSquare,
  FiPause,
  FiRefreshCw,
  FiTrash2,
  FiCpu,
  FiUsers,
  FiShield,
  FiCopy,
} from 'react-icons/fi';
import { Button, Pagination } from '@/components/ui';
import { PageTransition } from '@/components/phone';
import {
  useCampaignsPaginated,
  useStartCampaign,
  useStopCampaign,
  usePauseCampaign,
  useResumeCampaign,
  useDeleteCampaign,
  useAllCampaignStats,
} from '@/lib/hooks/useCampaigns';
import { usePagination } from '@/lib/hooks';
import { useAuthStore } from '@/lib/stores/auth';
import type { CampaignStatus } from '@/lib/api';

const statusConfig: Record<CampaignStatus, { label: string; dot: string; badge: string }> = {
  draft: {
    label: 'Draft',
    dot: 'bg-gray-400',
    badge: 'bg-[var(--muted)] text-[var(--muted-foreground)]',
  },
  scheduled: {
    label: 'Scheduled',
    dot: 'bg-blue-500',
    badge: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  },
  running: {
    label: 'Running',
    dot: 'bg-green-500',
    badge: 'bg-green-500/10 text-green-600 dark:text-green-400',
  },
  paused: {
    label: 'Paused',
    dot: 'bg-yellow-500',
    badge: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400',
  },
  completed: {
    label: 'Completed',
    dot: 'bg-purple-500',
    badge: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
  },
  cancelled: {
    label: 'Cancelled',
    dot: 'bg-red-500',
    badge: 'bg-red-500/10 text-red-600 dark:text-red-400',
  },
};

function FilterPill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 rounded-full border px-3 py-1 text-[12.5px] font-bold transition-colors ${
        active
          ? 'border-[var(--border)] bg-[var(--primary-600)] text-white'
          : 'border-[var(--border)] text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)]'
      }`}
    >
      {children}
    </button>
  );
}

export default function AIAutoDialerPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const isEnabled = user?.autoDialerEnabled ?? false;
  const pagination = usePagination({ initialPageSize: 20 });
  const [statusFilter, setStatusFilter] = useState<CampaignStatus | undefined>();

  const { data, isLoading } = useCampaignsPaginated({
    page: pagination.page,
    limit: pagination.pageSize,
    status: statusFilter,
  });
  const campaigns = data?.campaigns || [];
  const campaignIds = campaigns.map((c) => c.id);
  const { data: allStats } = useAllCampaignStats(campaignIds);

  useEffect(() => {
    if (data?.total !== undefined) pagination.setTotalItems(data.total);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- pagination.setTotalItems is stable
  }, [data?.total]);

  useEffect(() => {
    pagination.goToPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- pagination.goToPage is stable
  }, [statusFilter]);

  const startCampaign = useStartCampaign();
  const stopCampaign = useStopCampaign();
  const pauseCampaign = usePauseCampaign();
  const resumeCampaign = useResumeCampaign();
  const deleteCampaign = useDeleteCampaign();
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: number; name: string } | null>(null);

  const handleAction = useCallback(
    async (action: string, id: number, name?: string) => {
      switch (action) {
        case 'start':
          await startCampaign.mutateAsync(id);
          break;
        case 'stop':
          await stopCampaign.mutateAsync(id);
          break;
        case 'pause':
          await pauseCampaign.mutateAsync(id);
          break;
        case 'resume':
          await resumeCampaign.mutateAsync(id);
          break;
        case 'delete':
          setDeleteConfirm({ id, name: name || 'this campaign' });
          break;
      }
    },
    [startCampaign, stopCampaign, pauseCampaign, resumeCampaign]
  );

  const confirmDelete = useCallback(async () => {
    if (!deleteConfirm) return;
    await deleteCampaign.mutateAsync(deleteConfirm.id);
    setDeleteConfirm(null);
  }, [deleteConfirm, deleteCampaign]);

  // Gate: admin hasn't enabled AI dialer for this user.
  if (!isEnabled) {
    return (
      <PageTransition className="absolute inset-0 overflow-hidden">
        <div className="flex h-full min-h-0 items-center justify-center bg-[var(--card)] p-4">
          <div className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--card)] p-10 text-center">
            <div className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-2xl bg-amber-500/10">
              <FiShield className="h-8 w-8 text-amber-500" />
            </div>
            <h3 className="mb-2 text-lg font-bold text-[var(--foreground)]">
              AI Auto-Dialer Not Enabled
            </h3>
            <p className="mb-2 text-sm text-[var(--muted-foreground)]">
              Your phone number hasn&apos;t been set up for AI calling yet.
            </p>
            <p className="text-xs text-[var(--muted-foreground)]">
              Contact your administrator to enable the AI Auto-Dialer for your account and import
              your number to the voice platform.
            </p>
          </div>
        </div>
      </PageTransition>
    );
  }

  const showLoading = isLoading && campaigns.length === 0;
  const showEmpty = !isLoading && campaigns.length === 0;

  return (
    <PageTransition className="absolute inset-0 overflow-hidden">
      <div className="flex h-full min-h-0 flex-col bg-[var(--card)]">
        {/* Unified header region */}
        <div className="shrink-0 border-b border-[var(--border)]">
          <div className="flex items-center justify-between gap-3 px-5 pt-3.5 pb-2.5">
            <div className="flex min-w-0 items-center gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[var(--primary-50)] text-[var(--foreground)] dark:bg-[var(--primary-900)]/30">
                <FiCpu className="h-6 w-6" />
              </span>
              <div className="min-w-0">
                <h1 className="truncate text-2xl font-black text-[var(--foreground)]">
                  AI Auto-Dialer
                </h1>
                <p className="mt-0.5 text-sm text-[var(--muted-foreground)]">
                  {data?.total !== undefined
                    ? `${data.total.toLocaleString()} campaign${data.total === 1 ? '' : 's'}`
                    : 'AI-powered outbound calling'}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Link href="/phone/auto-dialer/agents">
                <Button variant="secondary" size="sm">
                  <FiCpu className="mr-2 h-4 w-4" />
                  <span className="hidden sm:inline">Agents</span>
                </Button>
              </Link>
              <Link href="/phone/auto-dialer/dnc">
                <Button variant="secondary" size="sm">
                  <FiShield className="mr-2 h-4 w-4" />
                  <span className="hidden sm:inline">DNC</span>
                </Button>
              </Link>
              <Link href="/phone/auto-dialer/campaigns/new">
                <Button size="sm">
                  <FiPlus className="mr-2 h-4 w-4" />
                  New Campaign
                </Button>
              </Link>
            </div>
          </div>

          {/* status filter pills */}
          <div className="flex items-center gap-2 overflow-x-auto border-t border-[var(--border)] px-5 py-2.5">
            <FilterPill active={!statusFilter} onClick={() => setStatusFilter(undefined)}>
              All
            </FilterPill>
            {Object.entries(statusConfig).map(([key, { label }]) => (
              <FilterPill
                key={key}
                active={statusFilter === key}
                onClick={() => setStatusFilter(key as CampaignStatus)}
              >
                {label}
              </FilterPill>
            ))}
          </div>
        </div>

        {/* Scroll area */}
        <div className="min-h-0 flex-1 overflow-auto">
          {showLoading ? (
            <div className="space-y-3 px-5 py-4">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-24 animate-pulse rounded-xl border border-[var(--border)] bg-[var(--muted)]/30"
                />
              ))}
            </div>
          ) : showEmpty ? (
            <div className="grid place-items-center px-6 py-20 text-center">
              <div>
                <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-[var(--muted)]">
                  <FiCpu className="h-7 w-7 text-[var(--muted-foreground)]" />
                </div>
                <h3 className="mb-1 text-base font-bold text-[var(--foreground)]">
                  {statusFilter
                    ? `No ${statusConfig[statusFilter].label.toLowerCase()} campaigns`
                    : 'No campaigns yet'}
                </h3>
                <p className="mb-4 text-sm text-[var(--muted-foreground)]">
                  Create your first AI calling campaign to get started.
                </p>
                <Link href="/phone/auto-dialer/campaigns/new">
                  <Button>
                    <FiPlus className="mr-2 h-4 w-4" />
                    Create Campaign
                  </Button>
                </Link>
              </div>
            </div>
          ) : (
            <>
              <div className="space-y-3 px-5 py-4">
                {campaigns.map((campaign) => {
                  const stats = allStats?.[campaign.id];
                  const config = statusConfig[campaign.status];

                  return (
                    <Link
                      key={campaign.id}
                      href={`/phone/auto-dialer/campaigns/${campaign.id}`}
                      className="block"
                    >
                      <div className="group rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 transition-colors hover:border-[var(--primary-300)] hover:bg-[var(--muted)]/30">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex min-w-0 items-center gap-2">
                              <span className={`h-2 w-2 shrink-0 rounded-full ${config.dot}`} />
                              <h3 className="min-w-0 truncate font-bold text-[var(--foreground)]">
                                {campaign.name}
                              </h3>
                              <span
                                className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${config.badge}`}
                              >
                                {config.label}
                              </span>
                            </div>
                            {campaign.description && (
                              <p className="mt-1 truncate text-[13px] text-[var(--muted-foreground)]">
                                {campaign.description}
                              </p>
                            )}
                            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[var(--muted-foreground)]">
                              <span className="flex items-center gap-1">
                                <FiUsers className="h-3.5 w-3.5" />
                                {stats?.totalNumbers || 0} numbers
                              </span>
                              {stats && stats.completed > 0 && (
                                <span className="font-medium text-green-600 dark:text-green-400">
                                  {stats.completed} completed
                                </span>
                              )}
                              {stats && stats.failed > 0 && (
                                <span className="font-medium text-red-600 dark:text-red-400">
                                  {stats.failed} failed
                                </span>
                              )}
                              {campaign.startedAt && (
                                <span>
                                  Started {new Date(campaign.startedAt).toLocaleDateString()}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Actions */}
                          <div
                            className="flex shrink-0 items-center gap-0.5"
                            onClick={(e) => e.preventDefault()}
                          >
                            {(campaign.status === 'draft' ||
                              campaign.status === 'scheduled' ||
                              campaign.status === 'completed' ||
                              campaign.status === 'cancelled') && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleAction('start', campaign.id)}
                                disabled={startCampaign.isPending}
                                title={
                                  campaign.status === 'completed' || campaign.status === 'cancelled'
                                    ? 'Restart campaign'
                                    : 'Start campaign'
                                }
                              >
                                <FiPlay className="h-4 w-4 text-green-500" />
                              </Button>
                            )}
                            {campaign.status === 'running' && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleAction('pause', campaign.id)}
                                  title="Pause"
                                >
                                  <FiPause className="h-4 w-4 text-yellow-500" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleAction('stop', campaign.id)}
                                  title="Stop"
                                >
                                  <FiSquare className="h-4 w-4 text-red-500" />
                                </Button>
                              </>
                            )}
                            {campaign.status === 'paused' && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleAction('resume', campaign.id)}
                                  title="Resume"
                                >
                                  <FiRefreshCw className="h-4 w-4 text-green-500" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleAction('stop', campaign.id)}
                                  title="Stop"
                                >
                                  <FiSquare className="h-4 w-4 text-red-500" />
                                </Button>
                              </>
                            )}
                            {(campaign.status === 'completed' ||
                              campaign.status === 'cancelled') && (
                              <Button
                                variant="ghost"
                                size="sm"
                                title="Reuse campaign"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  router.push(`/phone/auto-dialer/campaigns/new?reuse=${campaign.id}`);
                                }}
                              >
                                <FiCopy className="h-4 w-4 text-blue-500" />
                              </Button>
                            )}
                            {campaign.status !== 'running' && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleAction('delete', campaign.id, campaign.name)}
                                title="Delete"
                              >
                                <FiTrash2 className="h-4 w-4 text-red-500" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>

              {/* Pagination — inside the scroll (matches the other pages) */}
              <div className="border-t border-[var(--border)] px-5 py-3">
                <Pagination
                  page={pagination.page}
                  totalPages={pagination.totalPages}
                  totalItems={pagination.totalItems}
                  pageSize={pagination.pageSize}
                  hasNextPage={pagination.hasNextPage}
                  hasPreviousPage={pagination.hasPreviousPage}
                  pageRange={pagination.pageRange}
                  onPageChange={pagination.goToPage}
                  showTotalItems={true}
                />
              </div>
            </>
          )}
        </div>

        {/* Delete Confirmation Modal */}
        {deleteConfirm && (
          <div
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
            onClick={() => setDeleteConfirm(null)}
          >
            <div
              className="w-full max-w-sm rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-red-500/10">
                <FiTrash2 className="h-6 w-6 text-red-500" />
              </div>
              <h3 className="mb-2 text-center text-lg font-bold text-[var(--foreground)]">
                Delete Campaign
              </h3>
              <p className="mb-6 text-center text-sm text-[var(--muted-foreground)]">
                Are you sure you want to delete <strong>{deleteConfirm.name}</strong>? All phone
                numbers and call data in this campaign will be permanently removed.
              </p>
              <div className="flex gap-3">
                <Button variant="secondary" className="flex-1" onClick={() => setDeleteConfirm(null)}>
                  Cancel
                </Button>
                <button
                  className="flex-1 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
                  onClick={confirmDelete}
                  disabled={deleteCampaign.isPending}
                >
                  {deleteCampaign.isPending ? 'Deleting...' : 'Delete Campaign'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </PageTransition>
  );
}
