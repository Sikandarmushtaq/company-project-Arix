'use client';

/**
 * Per-org WhatsApp Billing panel (owner + manager).
 *
 * Monthly view of WhatsApp spend:
 *   • Messages — billed at the provider's authoritative price (accurate),
 *     broken down by pricing category.
 *   • Calls — DURATION only (the provider exposes no per-call price), split
 *     inbound (free) / outbound, shown as total minutes.
 *
 * The month's full line-item ledger is downloadable as CSV. Vendor-neutral.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { FiDownload, FiAlertCircle, FiMessageSquare, FiPhone } from 'react-icons/fi';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle, Button, StyledSelect } from '@/components/ui';
import {
  getMyBilling,
  getMyBillingAccount,
  downloadMyBillingCsv,
  type WaBillingSummary,
  type WaBillingAccount,
} from '@/lib/api/services/whatsapp-org.api';

/** Build the last 12 months as 'YYYY-MM', newest first. */
function recentMonths(): string[] {
  const out: string[] = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    out.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`);
  }
  return out;
}

function monthLabel(m: string): string {
  const [y, mo] = m.split('-').map(Number);
  return new Date(Date.UTC(y, mo - 1, 1)).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/** Seconds → "1h 02m 03s" / "2m 03s" / "0s". */
function fmtDuration(secs: number): string {
  const s = Math.max(0, Math.floor(secs));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m ${String(ss).padStart(2, '0')}s`;
  if (m > 0) return `${m}m ${String(ss).padStart(2, '0')}s`;
  return `${ss}s`;
}

function fmtMoney(amount: number, currency: string): string {
  // Provider prices can be sub-cent; show up to 4 decimals, trimmed.
  const n = Number(amount || 0);
  const str = n.toFixed(4).replace(/\.?0+$/, '');
  return `${currency} ${str === '' || str === '-0' ? '0' : str}`;
}

export function OrgWaBillingManager() {
  const months = recentMonths();
  const [month, setMonth] = useState(months[0]);
  const [data, setData] = useState<WaBillingSummary | null>(null);
  const [account, setAccount] = useState<WaBillingAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  // Billing mode + prepaid balance (independent of the selected month).
  useEffect(() => {
    let cancelled = false;
    getMyBillingAccount()
      .then((a) => {
        if (!cancelled) setAccount(a);
      })
      .catch(() => {
        /* non-fatal — the monthly view still works without the wallet banner */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getMyBilling(month)
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load billing.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [month]);

  const onDownload = useCallback(async () => {
    setDownloading(true);
    try {
      await downloadMyBillingCsv(month);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to download CSV.');
    } finally {
      setDownloading(false);
    }
  }, [month]);

  const currency = data?.currency || 'USD';
  const callMins = data
    ? Math.round((data.calls.outbound.durationSecs + data.calls.inbound.durationSecs) / 6) / 10
    : 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <CardTitle>Billing</CardTitle>
            <p className="text-sm text-[var(--muted-foreground)] mt-1">
              Monthly WhatsApp usage. Messages are billed at the exact provider price; calls show
              duration only (inbound calls are free).
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <StyledSelect
              value={month}
              onChange={(v) => setMonth(v)}
              className="bg-[var(--background)] w-auto"
              aria-label="Billing month"
            >
              {months.map((m) => (
                <option key={m} value={m}>
                  {monthLabel(m)}
                </option>
              ))}
            </StyledSelect>
            <Button onClick={onDownload} variant="outline" disabled={downloading || loading}>
              <FiDownload className="w-4 h-4" />
              {downloading ? 'Preparing…' : 'Download CSV'}
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {account?.mode === 'prepaid' && (
          <div
            className={`rounded-lg border p-3 mb-4 flex items-center justify-between gap-3 ${
              account.balance <= 0
                ? 'border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/20'
                : account.balance < 5
                  ? 'border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20'
                  : 'border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/20'
            }`}
          >
            <div>
              <div className="text-xs text-[var(--muted-foreground)]">Prepaid balance</div>
              <div className="text-lg font-bold text-[var(--foreground)]">
                {fmtMoney(account.balance, account.currency)}
              </div>
            </div>
            <p className="text-xs text-[var(--muted-foreground)] text-right max-w-[55%]">
              {account.balance <= 0
                ? 'Out of credit — sending and calling are paused until you top up.'
                : 'Each message is deducted at the exact provider price; outbound calls per minute.'}
            </p>
          </div>
        )}
        {account?.mode === 'postpaid' && (
          <p className="text-xs text-[var(--muted-foreground)] mb-4">
            Pay-as-you-go: usage below is billed monthly (your fee + actual usage).
          </p>
        )}
        {error && (
          <div className="rounded-lg border border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/20 p-3 flex items-start gap-2 mb-4">
            <FiAlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
            <p className="text-sm text-red-800 dark:text-red-300">{error}</p>
          </div>
        )}

        {loading ? (
          <p className="text-sm text-[var(--muted-foreground)]">Loading {monthLabel(month)}…</p>
        ) : data ? (
          <div className="space-y-6">
            {/* Headline cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="rounded-xl border border-[var(--border)] p-4">
                <div className="flex items-center gap-2 text-[var(--muted-foreground)] text-xs mb-1">
                  <FiMessageSquare className="w-4 h-4" /> Message cost
                </div>
                <div className="text-xl font-bold text-[var(--foreground)]">
                  {fmtMoney(data.messages.totalCost, currency)}
                </div>
                <div className="text-xs text-[var(--muted-foreground)] mt-1">
                  {data.messages.totalCount} message{data.messages.totalCount === 1 ? '' : 's'}
                </div>
              </div>
              <div className="rounded-xl border border-[var(--border)] p-4">
                <div className="flex items-center gap-2 text-[var(--muted-foreground)] text-xs mb-1">
                  <FiPhone className="w-4 h-4" /> Call time
                </div>
                <div className="text-xl font-bold text-[var(--foreground)]">{callMins} min</div>
                <div className="text-xs text-[var(--muted-foreground)] mt-1">
                  {data.calls.outbound.count + data.calls.inbound.count} call
                  {data.calls.outbound.count + data.calls.inbound.count === 1 ? '' : 's'}
                </div>
              </div>
              <div className="rounded-xl border border-[var(--border)] p-4">
                <div className="text-[var(--muted-foreground)] text-xs mb-1">Billed total</div>
                <div className="text-xl font-bold text-[var(--foreground)]">
                  {fmtMoney(data.messages.totalCost, currency)}
                </div>
                <div className="text-xs text-[var(--muted-foreground)] mt-1">
                  messages only — calls billed by the provider per minute
                </div>
              </div>
            </div>

            {/* Messages by category */}
            <div>
              <h3 className="text-sm font-semibold text-[var(--foreground)] mb-2">
                Messages by category
              </h3>
              {data.messages.byCategory.length === 0 ? (
                <p className="text-sm text-[var(--muted-foreground)]">No messages this month.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-[var(--muted-foreground)] border-b border-[var(--border)]">
                        <th className="py-2 pr-4 font-medium">Category</th>
                        <th className="py-2 pr-4 font-medium text-right">Count</th>
                        <th className="py-2 font-medium text-right">Cost</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.messages.byCategory.map((c) => (
                        <tr
                          key={c.category}
                          className="border-b border-[var(--border)] last:border-0"
                        >
                          <td className="py-2 pr-4 text-[var(--foreground)]">{c.category}</td>
                          <td className="py-2 pr-4 text-right">{c.count}</td>
                          <td className="py-2 text-right">{fmtMoney(c.cost, currency)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Calls */}
            <div>
              <h3 className="text-sm font-semibold text-[var(--foreground)] mb-2">Calls</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[var(--muted-foreground)] border-b border-[var(--border)]">
                      <th className="py-2 pr-4 font-medium">Direction</th>
                      <th className="py-2 pr-4 font-medium text-right">Count</th>
                      <th className="py-2 font-medium text-right">Duration</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-[var(--border)]">
                      <td className="py-2 pr-4 text-[var(--foreground)]">Outbound</td>
                      <td className="py-2 pr-4 text-right">{data.calls.outbound.count}</td>
                      <td className="py-2 text-right">
                        {fmtDuration(data.calls.outbound.durationSecs)}
                      </td>
                    </tr>
                    <tr className="last:border-0">
                      <td className="py-2 pr-4 text-[var(--foreground)]">Inbound (free)</td>
                      <td className="py-2 pr-4 text-right">{data.calls.inbound.count}</td>
                      <td className="py-2 text-right">
                        {fmtDuration(data.calls.inbound.durationSecs)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-[var(--muted-foreground)] mt-2">
                Outbound calls are billed by the provider per connected minute; the exact charge
                appears on the account. Inbound calls are free.
              </p>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

export default OrgWaBillingManager;
