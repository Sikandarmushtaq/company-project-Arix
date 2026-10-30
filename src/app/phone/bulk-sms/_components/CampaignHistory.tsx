'use client';

/**
 * Bulk SMS — Campaign History
 *
 * Auto-dialer-style list of past bulk-SMS runs: status filter tabs, cards with
 * counts + timestamps, and pagination. Read from the client-reported campaign
 * records (see bulk-sms backend module).
 */

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  FiPlus,
  FiZap,
  FiCornerUpLeft,
  FiPlay,
  FiTrash2,
  FiSend,
  FiCheckCircle,
  FiXCircle,
  FiPause,
  FiLoader,
  FiInbox,
} from 'react-icons/fi';
import { Button } from '@/components/ui';
import {
  useBulkSmsCampaigns,
  useDeleteBulkSmsCampaign,
  useBulkSmsCampaign,
} from '@/lib/hooks/useBulkSmsCampaigns';
import { useConfirm } from '@/lib/hooks';
import type {
  BulkSmsCampaign,
  BulkSmsCampaignStatus,
} from '@/lib/api/services/bulk-sms-campaign.service';
import { CampaignDetailDrawer } from './CampaignDetailDrawer';

const STATUS_TABS: { label: string; value: BulkSmsCampaignStatus | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Running', value: 'running' },
  { label: 'Paused', value: 'paused' },
  { label: 'Completed', value: 'completed' },
  { label: 'Cancelled', value: 'cancelled' },
];

export const STATUS_META: Record<
  BulkSmsCampaignStatus,
  { label: string; className: string; icon: React.ReactNode }
> = {
  running: {
    label: 'Running',
    className: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
    icon: <FiLoader className="h-3 w-3 animate-spin" />,
  },
  paused: {
    label: 'Paused',
    className: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    icon: <FiPause className="h-3 w-3" />,
  },
  completed: {
    label: 'Completed',
    className: 'bg-green-500/10 text-green-600 dark:text-green-400',
    icon: <FiCheckCircle className="h-3 w-3" />,
  },
  cancelled: {
    label: 'Cancelled',
    className: 'bg-[var(--muted)] text-[var(--muted-foreground)]',
    icon: <FiXCircle className="h-3 w-3" />,
  },
};

export function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
}

export function CampaignHistory({
  onNewCampaign,
  openCampaignId,
  resumableCampaignId,
  onResume,
}: {
  onNewCampaign: () => void;
  /** When set (e.g. deep-linked from a chat), open that campaign's drawer. */
  openCampaignId?: number | null;
  /** The parked paused campaign that can be resumed (its queue is still in the store). */
  resumableCampaignId?: number | null;
  onResume?: () => void;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<BulkSmsCampaignStatus | 'all'>('all');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<BulkSmsCampaign | null>(null);
  const [consumedDeepLink, setConsumedDeepLink] = useState<number | null>(null);
  const limit = 10;
  const { confirm } = useConfirm();
  const deleteCampaign = useDeleteBulkSmsCampaign();

  // Deep-link: fetch + auto-open the drawer for a campaign referenced in the URL
  // (once — so closing it doesn't immediately reopen). Adjust-during-render.
  const { data: deepLinked } = useBulkSmsCampaign(openCampaignId ?? null);
  if (deepLinked && openCampaignId && openCampaignId !== consumedDeepLink && !selected) {
    setConsumedDeepLink(openCampaignId);
    setSelected(deepLinked);
  }

  const { data, isLoading, isError } = useBulkSmsCampaigns({
    page,
    limit,
    ...(status !== 'all' ? { status } : {}),
  });

  const campaigns = data?.campaigns ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;
  const from = total === 0 ? 0 : (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);

  const handleDelete = async (c: BulkSmsCampaign) => {
    const confirmed = await confirm({
      title: 'Delete campaign',
      message: `Remove "${c.name}" from your campaign history? This cannot be undone.`,
      confirmText: 'Delete',
      variant: 'danger',
    });
    if (confirmed) deleteCampaign.mutate(c.id);
  };

  return (
    <div className="space-y-4">
      {/* Filter tabs + New Campaign */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {STATUS_TABS.map((t) => {
            const active = status === t.value;
            return (
              <button
                key={t.value}
                type="button"
                onClick={() => {
                  setStatus(t.value);
                  setPage(1);
                }}
                className={`rounded-full px-3 py-1.5 text-xs font-bold transition-colors ${
                  active
                    ? 'bg-[var(--primary-600)] text-white'
                    : 'bg-[var(--muted)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => router.push('/phone/bulk-sms/auto-reply')}>
            <FiCornerUpLeft className="mr-1.5 h-4 w-4" />
            Auto-reply
          </Button>
          <Button variant="outline" size="sm" onClick={() => router.push('/phone/bulk-sms/sequences')}>
            <FiZap className="mr-1.5 h-4 w-4" />
            Drip sequences
          </Button>
          <Button onClick={onNewCampaign} size="sm">
            <FiPlus className="mr-1.5 h-4 w-4" />
            New Campaign
          </Button>
        </div>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="py-16 text-center text-sm text-[var(--muted-foreground)]">
          Loading campaigns…
        </div>
      ) : isError ? (
        <div className="py-16 text-center text-sm text-[var(--muted-foreground)]">
          Couldn&apos;t load campaign history.
        </div>
      ) : campaigns.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--border)] py-16 text-center">
          <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-full bg-[var(--muted)]">
            <FiInbox className="h-7 w-7 text-[var(--muted-foreground)]" />
          </div>
          <p className="text-sm font-semibold text-[var(--foreground)]">
            {status === 'all' ? 'No campaigns yet' : `No ${status} campaigns`}
          </p>
          <p className="mx-auto mt-1 max-w-xs text-xs text-[var(--muted-foreground)]">
            Start a bulk SMS campaign and it will show up here with its status and results.
          </p>
          {status === 'all' && (
            <Button onClick={onNewCampaign} size="sm" className="mt-4">
              <FiSend className="mr-1.5 h-4 w-4" />
              Start your first campaign
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-2.5">
          {campaigns.map((c) => {
            const meta = STATUS_META[c.status];
            return (
              <div
                key={c.id}
                role="button"
                tabIndex={0}
                onClick={() => setSelected(c)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setSelected(c);
                  }
                }}
                className={`group flex cursor-pointer items-start gap-3 rounded-xl border bg-[var(--card)] p-4 transition-colors ${
                  selected?.id === c.id
                    ? 'border-[var(--primary-500)] ring-1 ring-[var(--primary-500)]'
                    : 'border-[var(--border)] hover:border-[var(--primary-400)]'
                }`}
              >
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[var(--primary-50)] text-[var(--foreground)] dark:bg-[var(--primary-900)]/30">
                  <FiSend className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="truncate font-bold text-[var(--foreground)]">{c.name}</h3>
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${meta.className}`}
                    >
                      {meta.icon}
                      {meta.label}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-[var(--muted-foreground)]">
                    <span className="tabular-nums">{c.totalCount} numbers</span>
                    <span className="text-green-600 tabular-nums dark:text-green-400">
                      {c.sentCount} sent
                    </span>
                    {c.failedCount > 0 && (
                      <span className="text-red-600 tabular-nums dark:text-red-400">
                        {c.failedCount} failed
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-[11px] text-[var(--muted-foreground)]">
                    Started {fmtDate(c.startedAt || c.createdAt)}
                    {c.completedAt ? ` · Ended ${fmtDate(c.completedAt)}` : ''}
                  </p>
                </div>
                {c.id === resumableCampaignId && onResume && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onResume();
                    }}
                    aria-label={`Resume ${c.name}`}
                    className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-[var(--primary-600)] px-2.5 py-1.5 text-xs font-bold text-white transition-colors hover:bg-[var(--primary-700)]"
                  >
                    <FiPlay className="h-3.5 w-3.5" />
                    Resume
                  </button>
                )}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(c);
                  }}
                  aria-label={`Delete ${c.name}`}
                  className="shrink-0 rounded-lg p-2 text-[var(--muted-foreground)] opacity-0 transition-all hover:bg-[var(--muted)] hover:text-red-500 group-hover:opacity-100"
                >
                  <FiTrash2 className="h-4 w-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {campaigns.length > 0 && (
        <div className="flex items-center justify-between gap-3 pt-1">
          <span className="text-xs text-[var(--muted-foreground)]">
            Showing {from}–{to} of {total} {total === 1 ? 'item' : 'items'}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      <CampaignDetailDrawer campaign={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

export default CampaignHistory;
