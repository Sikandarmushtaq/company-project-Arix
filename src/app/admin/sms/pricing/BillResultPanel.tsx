'use client';

import React, { useState } from 'react';
import { FiDownload, FiInfo, FiLoader } from 'react-icons/fi';
import { toast } from 'sonner';
import { Button } from '@/components/ui';
import { smsAdminService, type TwilioBill } from '@/lib/api/services';
import type { TwilioBillProvider } from '@/lib/api/services/sms-usage.api';
import CustomerChargeCard from './CustomerChargeCard';

interface Props {
  bill: TwilioBill;
  /** Twilio sub-account override matching the one used to fetch `bill` —
   *  ensures the CSV export hits the same account, not the auto-resolved one. */
  provider?: TwilioBillProvider;
}

function statusBadgeClass(status: string): string {
  const s = status.toLowerCase();
  if (s === 'delivered' || s === 'sent' || s === 'received') {
    return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
  }
  if (s === 'failed' || s === 'undelivered') {
    return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
  }
  if (s === 'queued' || s === 'sending' || s === 'accepted') {
    return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
  }
  return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300';
}

function directionBadgeClass(dir: 'outbound' | 'inbound'): string {
  return dir === 'outbound'
    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
    : 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300';
}

/**
 * Renders the result of a TwilioBill fetch — summary cards, status +
 * direction breakdowns, capped messages table with full-list CSV export.
 *
 * The visible table shows up to 200 rows (server-side cap). The CSV
 * export hits a separate uncapped endpoint that returns EVERY message
 * for the period, so the download contains the complete list regardless
 * of the on-screen cap.
 */
export default function BillResultPanel({ bill, provider }: Props) {
  const [csvLoading, setCsvLoading] = useState(false);
  const month = bill.periodStart.slice(0, 7);

  const handleExportCsv = async () => {
    if (csvLoading) return;
    setCsvLoading(true);
    try {
      await smsAdminService.downloadTwilioBillCsv(bill.phone, month, provider);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to download CSV');
    } finally {
      setCsvLoading(false);
    }
  };

  if (bill.totalMessages === 0) {
    return (
      <div className="rounded-lg border border-[var(--border)] bg-[var(--muted)]/40 p-6 text-center">
        <FiInfo className="w-8 h-8 text-[var(--muted-foreground)] mx-auto mb-2" />
        <p className="text-sm text-[var(--muted-foreground)]">
          No messages for this number in this month (neither outbound nor inbound).
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 pt-2">
      {/* Period info — UTC so admin knows what window Twilio billed */}
      <div className="flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
        <FiInfo className="w-3.5 h-3.5" />
        Billing period:{' '}
        <span className="font-mono">{bill.periodStart.replace('T', ' ').slice(0, 16)} UTC</span> →{' '}
        <span className="font-mono">{bill.periodEnd.replace('T', ' ').slice(0, 16)} UTC</span>
        <span className="ml-1">(message timestamps below shown in your local timezone)</span>
      </div>

      {/* Customer charge calculator — what to bill this user, including tax */}
      <CustomerChargeCard bill={bill} />

      {/* Summary cards: total + messages + segments + SMS/MMS split + pending */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="rounded-lg border border-[var(--border)] bg-[var(--muted)]/40 p-3">
          <p className="text-xs text-[var(--muted-foreground)] uppercase tracking-wider">
            Total billed
          </p>
          <p className="mt-1 text-2xl font-bold text-green-600 dark:text-green-400">
            {bill.totalCost.toFixed(4)} {bill.priceUnit}
          </p>
          <p className="text-xs text-[var(--muted-foreground)] mt-1">
            out {bill.outboundCost.toFixed(4)} · in {bill.inboundCost.toFixed(4)}
          </p>
        </div>
        <div className="rounded-lg border border-[var(--border)] bg-[var(--muted)]/40 p-3">
          <p className="text-xs text-[var(--muted-foreground)] uppercase tracking-wider">
            Messages
          </p>
          <p className="mt-1 text-2xl font-bold text-[var(--foreground)]">{bill.totalMessages}</p>
          <p className="text-xs text-[var(--muted-foreground)] mt-1">
            out {bill.byDirection.outbound} · in {bill.byDirection.inbound}
          </p>
        </div>
        <div className="rounded-lg border border-[var(--border)] bg-[var(--muted)]/40 p-3">
          <p className="text-xs text-[var(--muted-foreground)] uppercase tracking-wider">
            Segments
          </p>
          <p className="mt-1 text-2xl font-bold text-[var(--foreground)]">{bill.totalSegments}</p>
          <p className="text-xs text-[var(--muted-foreground)] mt-1">all messages</p>
        </div>
        <div className="rounded-lg border border-[var(--border)] bg-[var(--muted)]/40 p-3">
          <p className="text-xs text-[var(--muted-foreground)] uppercase tracking-wider">
            SMS / MMS
          </p>
          {typeof bill.outboundSmsSegments === 'number' &&
          typeof bill.inboundSmsSegments === 'number' &&
          typeof bill.outboundMmsCount === 'number' &&
          typeof bill.inboundMmsCount === 'number' ? (
            <>
              <p className="mt-1 text-2xl font-bold text-[var(--foreground)]">
                {bill.outboundSmsSegments + bill.inboundSmsSegments}
                <span className="text-base font-normal text-[var(--muted-foreground)] mx-1">/</span>
                {bill.outboundMmsCount + bill.inboundMmsCount}
              </p>
              <p className="text-xs text-[var(--muted-foreground)] mt-1">
                SMS segs · MMS msgs
              </p>
            </>
          ) : (
            <>
              <p className="mt-1 text-2xl font-bold text-[var(--muted-foreground)]">—</p>
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                Backend update pending
              </p>
            </>
          )}
        </div>
        <div className="rounded-lg border border-[var(--border)] bg-[var(--muted)]/40 p-3">
          <p className="text-xs text-[var(--muted-foreground)] uppercase tracking-wider">
            Pending price
          </p>
          <p className="mt-1 text-2xl font-bold text-amber-600 dark:text-amber-400">
            {bill.pendingPriceCount}
          </p>
          <p className="text-xs text-[var(--muted-foreground)] mt-1">
            Twilio prices messages async
          </p>
        </div>
      </div>

      {/* Status breakdown */}
      {Object.keys(bill.byStatus).length > 0 && (
        <div className="flex flex-wrap gap-2">
          {Object.entries(bill.byStatus).map(([status, count]) => (
            <span
              key={status}
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${statusBadgeClass(status)}`}
            >
              {status}: {count}
            </span>
          ))}
        </div>
      )}

      {/* Messages table */}
      <div className="rounded-lg border border-[var(--border)] overflow-hidden">
        <div className="bg-[var(--muted)]/40 px-4 py-2 border-b border-[var(--border)] flex items-center justify-between">
          <p className="text-xs font-bold uppercase tracking-wider text-[var(--muted-foreground)]">
            Messages — showing {bill.totalMessagesShown} of {bill.totalMessages}
            {bill.totalMessagesNotShown > 0 && (
              <span className="text-amber-600 dark:text-amber-400 normal-case ml-2 font-normal">
                ({bill.totalMessagesNotShown} more not shown on screen — Export CSV downloads all {bill.totalMessages})
              </span>
            )}
          </p>
          <Button variant="ghost" size="sm" onClick={handleExportCsv} disabled={csvLoading}>
            {csvLoading ? (
              <>
                <FiLoader className="w-4 h-4 animate-spin" />
                Downloading…
              </>
            ) : (
              <>
                <FiDownload className="w-4 h-4" />
                Export CSV (all {bill.totalMessages})
              </>
            )}
          </Button>
        </div>
        <div className="max-h-96 overflow-auto">
          <table className="w-full text-sm">
            <thead className="bg-[var(--muted)]/20 sticky top-0">
              <tr>
                <th className="text-left py-2 px-3 text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">
                  Sent
                </th>
                <th className="text-left py-2 px-3 text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">
                  Dir
                </th>
                <th className="text-left py-2 px-3 text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">
                  Counterparty
                </th>
                <th className="text-left py-2 px-3 text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">
                  Status
                </th>
                <th className="text-left py-2 px-3 text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">
                  Type
                </th>
                <th className="text-right py-2 px-3 text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">
                  Segs
                </th>
                <th className="text-right py-2 px-3 text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">
                  Price
                </th>
              </tr>
            </thead>
            <tbody>
              {bill.messages.map((m) => (
                <tr key={m.sid} className="border-t border-[var(--border)]">
                  <td className="py-2 px-3 text-[var(--foreground)] whitespace-nowrap font-mono text-xs">
                    {m.dateSent ? new Date(m.dateSent).toLocaleString() : '—'}
                  </td>
                  <td className="py-2 px-3">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${directionBadgeClass(m.direction)}`}
                    >
                      {m.direction === 'outbound' ? 'OUT' : 'IN'}
                    </span>
                  </td>
                  <td className="py-2 px-3 text-[var(--foreground)] font-mono text-xs">
                    {m.counterparty}
                  </td>
                  <td className="py-2 px-3">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusBadgeClass(m.status)}`}
                    >
                      {m.status}
                    </span>
                    {m.errorCode && (
                      <span className="ml-1.5 text-xs text-red-500">(err {m.errorCode})</span>
                    )}
                  </td>
                  <td className="py-2 px-3">
                    {typeof m.numMedia === 'number' ? (
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          m.numMedia > 0
                            ? 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300'
                            : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                        }`}
                      >
                        {m.numMedia > 0 ? `MMS ×${m.numMedia}` : 'SMS'}
                      </span>
                    ) : (
                      <span className="text-xs text-[var(--muted-foreground)]">—</span>
                    )}
                  </td>
                  <td className="text-right py-2 px-3 text-[var(--foreground)] font-mono">
                    {m.numSegments}
                  </td>
                  <td className="text-right py-2 px-3 font-mono text-xs">
                    {m.price !== null ? (
                      <span className="text-green-600 dark:text-green-400">
                        {m.price.toFixed(4)} {m.priceUnit}
                      </span>
                    ) : (
                      <span className="text-amber-600 dark:text-amber-400">pending</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
