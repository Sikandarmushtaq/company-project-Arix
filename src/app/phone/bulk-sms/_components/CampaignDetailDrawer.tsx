'use client';

/**
 * Bulk SMS — Campaign detail drawer
 *
 * Right-side slide-over showing a campaign's metadata + recipient roster
 * (delivery status + who replied). Opened from a CampaignHistory card.
 */

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { FiChevronsRight, FiCheckCircle, FiXCircle, FiClock, FiCornerUpLeft } from 'react-icons/fi';
import { Button } from '@/components/ui';
import { formatPhoneNumber, normalizePhone } from '@/lib/utils/phone';
import { useBulkSmsCampaignRecipients } from '@/lib/hooks/useBulkSmsCampaigns';
import type { BulkSmsCampaign } from '@/lib/api/services/bulk-sms-campaign.service';
import { STATUS_META, fmtDate } from './CampaignHistory';

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <span className="shrink-0 text-sm text-[var(--muted-foreground)]">{label}</span>
      <span className="text-right text-sm font-semibold text-[var(--foreground)]">{value}</span>
    </div>
  );
}

function deliveryChip(status: string): { label: string; className: string; icon: React.ReactNode } {
  const s = status.toLowerCase();
  if (s === 'delivered' || s === 'sent')
    return {
      label: s === 'delivered' ? 'Delivered' : 'Sent',
      className: 'bg-green-500/10 text-green-600 dark:text-green-400',
      icon: <FiCheckCircle className="h-3 w-3" />,
    };
  if (s === 'failed' || s === 'undelivered')
    return {
      label: 'Failed',
      className: 'bg-red-500/10 text-red-600 dark:text-red-400',
      icon: <FiXCircle className="h-3 w-3" />,
    };
  return {
    label: status || 'Pending',
    className: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    icon: <FiClock className="h-3 w-3" />,
  };
}

export function CampaignDetailDrawer({
  campaign,
  onClose,
}: {
  campaign: BulkSmsCampaign | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const [page, setPage] = useState(1);

  // Open the 1:1 conversation with a recipient — same deep-link the dialer,
  // contacts and history pages use (Messages reads `?phone=`). Close the drawer
  // first so the user lands cleanly in the thread.
  const openChat = (phoneNumber: string) => {
    onClose();
    router.push(`/phone/messages?phone=${encodeURIComponent(normalizePhone(phoneNumber))}`);
  };

  // Reset paging when a different campaign opens (adjust-state-during-render —
  // React's recommended alternative to a reset effect).
  const [prevId, setPrevId] = useState<number | null>(campaign?.id ?? null);
  if ((campaign?.id ?? null) !== prevId) {
    setPrevId(campaign?.id ?? null);
    setPage(1);
  }

  const { data, isLoading } = useBulkSmsCampaignRecipients(campaign?.id ?? null, page);
  const recipients = data?.recipients ?? [];
  const totalPages = data?.totalPages ?? 1;

  return (
    <AnimatePresence>
      {campaign && (
        <>
          <motion.div
            className="fixed inset-0 z-40 bg-black/40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col bg-[var(--card)] shadow-2xl"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 420, damping: 40 }}
          >
            {/* header */}
            <div className="flex shrink-0 items-center justify-between gap-2 border-b border-[var(--border)] px-4 py-3.5">
              <div className="min-w-0">
                <h2 className="truncate text-[17px] font-black text-[var(--foreground)]">
                  {campaign.name}
                </h2>
                <span
                  className={`mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${STATUS_META[campaign.status].className}`}
                >
                  {STATUS_META[campaign.status].icon}
                  {STATUS_META[campaign.status].label}
                </span>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close details"
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-[var(--muted-foreground)] transition-colors hover:bg-[var(--muted)] hover:text-[var(--foreground)]"
              >
                <FiChevronsRight className="h-[18px] w-[18px]" />
              </button>
            </div>

            {/* body */}
            <div className="min-h-0 flex-1 overflow-auto">
              {/* metadata */}
              <div className="border-b border-[var(--border)] px-4 py-3">
                <div className="divide-y divide-[var(--border)]">
                  <DetailRow label="Sending from" value={formatPhoneNumber(campaign.fromNumber)} />
                  <DetailRow label="Recipients" value={campaign.totalCount} />
                  <DetailRow
                    label="Sent"
                    value={
                      <span className="text-green-600 dark:text-green-400">{campaign.sentCount}</span>
                    }
                  />
                  {campaign.failedCount > 0 && (
                    <DetailRow
                      label="Failed"
                      value={
                        <span className="text-red-600 dark:text-red-400">
                          {campaign.failedCount}
                        </span>
                      }
                    />
                  )}
                  <DetailRow label="Interval" value={`${campaign.intervalSeconds}s`} />
                  <DetailRow label="Started" value={fmtDate(campaign.startedAt || campaign.createdAt)} />
                  {campaign.completedAt && (
                    <DetailRow label="Ended" value={fmtDate(campaign.completedAt)} />
                  )}
                </div>
              </div>

              {/* message */}
              <div className="border-b border-[var(--border)] px-4 py-3">
                <h4 className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-[var(--muted-foreground)]">
                  Message
                </h4>
                <div className="whitespace-pre-wrap rounded-xl bg-[var(--muted)]/50 p-3 text-sm text-[var(--foreground)]">
                  {campaign.messageTemplate}
                </div>
              </div>

              {/* recipients */}
              <div className="px-4 py-3">
                <h4 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-[var(--muted-foreground)]">
                  Recipients
                </h4>
                {isLoading ? (
                  <p className="py-8 text-center text-xs text-[var(--muted-foreground)]">
                    Loading recipients…
                  </p>
                ) : recipients.length === 0 ? (
                  <p className="py-8 text-center text-xs text-[var(--muted-foreground)]">
                    No per-recipient data for this campaign.
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {recipients.map((r, i) => {
                      const chip = deliveryChip(r.status);
                      return (
                        <div
                          key={`${r.phoneNumber}-${i}`}
                          className="flex items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-2"
                        >
                          <button
                            type="button"
                            onClick={() => openChat(r.phoneNumber)}
                            title="Open chat"
                            className="min-w-0 flex-1 truncate text-left font-mono text-xs text-[var(--primary-600)] underline-offset-2 transition-colors hover:text-[var(--primary-700)] hover:underline focus:underline focus:outline-none dark:text-[var(--primary-400)]"
                          >
                            {formatPhoneNumber(r.phoneNumber)}
                          </button>
                          {r.replied && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-[var(--primary-50)] px-2 py-0.5 text-[10px] font-bold text-[var(--foreground)] dark:bg-[var(--primary-900)]/30">
                              <FiCornerUpLeft className="h-3 w-3" />
                              Replied
                            </span>
                          )}
                          <span
                            className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${chip.className}`}
                          >
                            {chip.icon}
                            {chip.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}

                {totalPages > 1 && (
                  <div className="mt-3 flex items-center justify-center gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={page <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                    >
                      Previous
                    </Button>
                    <span className="px-1 text-xs text-[var(--muted-foreground)]">
                      {page} / {totalPages}
                    </span>
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={page >= totalPages}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      Next
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

export default CampaignDetailDrawer;
