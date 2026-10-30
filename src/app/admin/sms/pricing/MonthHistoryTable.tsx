'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FiClock, FiLoader, FiTrendingUp } from 'react-icons/fi';
import { Button, Card, CardContent, CardHeader, CardTitle } from '@/components/ui';
import { smsAdminService, type TwilioBill } from '@/lib/api/services';

interface Props {
  selectedPhone: string;
}

interface MonthRow {
  month: string;
  label: string;
  bill: TwilioBill | null;
  error?: string;
}

/** Build the last N months (newest first) as { value:YYYY-MM, label:"Month YYYY" }. */
function recentMonths(count: number): Array<{ value: string; label: string }> {
  const out: Array<{ value: string; label: string }> = [];
  const now = new Date();
  for (let i = 0; i < count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleString(undefined, { month: 'long', year: 'numeric' });
    out.push({ value, label });
  }
  return out;
}

/**
 * 6-month Twilio bill history for the selected phone. Manual-fetch button
 * — each load fires 6 Twilio API calls in parallel.
 *
 * Stale-result protection: a generation counter in a ref (not state, to
 * avoid extra renders) tags each fetch. If the user changes phones or
 * re-clicks before the in-flight fetch resolves, the older results are
 * discarded — but `historyLoading` is ALWAYS cleared at fetch resolution,
 * so the button never gets stuck. Note: this doesn't cancel the actual
 * HTTP requests (Twilio still bills the rate-limit budget), just the UI.
 */
export default function MonthHistoryTable({ selectedPhone }: Props) {
  const [history, setHistory] = useState<MonthRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const generationRef = useRef(0);

  // Reset history AND any in-flight loading whenever the phone changes —
  // old data for a different phone would be misleading, and we shouldn't
  // keep showing "Loading…" for results that will be dropped.
  useEffect(() => {
    generationRef.current += 1; // invalidate any in-flight fetch
    setHistory([]);
    setHistoryLoading(false);
  }, [selectedPhone]);

  const handleFetchHistory = useCallback(async () => {
    if (!selectedPhone || historyLoading) return;
    generationRef.current += 1;
    const myGen = generationRef.current;
    setHistoryLoading(true);
    const months = recentMonths(6);

    const results = await Promise.all(
      months.map(async (m) => {
        try {
          const bill = await smsAdminService.getTwilioBill(selectedPhone, m.value);
          return { month: m.value, label: m.label, bill };
        } catch (err) {
          return {
            month: m.value,
            label: m.label,
            bill: null as TwilioBill | null,
            error: err instanceof Error ? err.message : 'Failed',
          };
        }
      })
    );

    // Drop stale results when the user navigated away mid-fetch — but
    // ALWAYS clear loading so the button doesn't lock up.
    if (myGen === generationRef.current) {
      setHistory(results);
    }
    setHistoryLoading(false);
  }, [selectedPhone, historyLoading]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <FiClock className="w-5 h-5 text-[var(--foreground)]" />
            6-Month Twilio History
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={handleFetchHistory}
            disabled={!selectedPhone || historyLoading}
          >
            {historyLoading ? (
              <>
                <FiLoader className="w-4 h-4 animate-spin" />
                Loading…
              </>
            ) : (
              <>
                <FiTrendingUp className="w-4 h-4" />
                Load last 6 months
              </>
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {history.length === 0 ? (
          <p className="text-sm text-[var(--muted-foreground)] py-4 text-center">
            Click <strong>Load last 6 months</strong> to fetch monthly bills for the selected
            phone. Each load fires 6 Twilio API calls in parallel — intentionally manual.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)]">
                  <th className="text-left py-2 px-3 text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">
                    Month
                  </th>
                  <th className="text-right py-2 px-3 text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">
                    Messages
                  </th>
                  <th className="text-right py-2 px-3 text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">
                    Segments
                  </th>
                  <th className="text-right py-2 px-3 text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">
                    Outbound
                  </th>
                  <th className="text-right py-2 px-3 text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">
                    Inbound
                  </th>
                  <th className="text-right py-2 px-3 text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">
                    Total billed
                  </th>
                </tr>
              </thead>
              <tbody>
                {history.map((row) => (
                  <tr key={row.month} className="border-b border-[var(--border)]">
                    <td className="py-2 px-3 text-[var(--foreground)]">{row.label}</td>
                    {row.error ? (
                      <td colSpan={5} className="py-2 px-3 text-red-600 text-xs">
                        {row.error}
                      </td>
                    ) : row.bill ? (
                      <>
                        <td className="text-right py-2 px-3 text-[var(--foreground)] font-mono">
                          {row.bill.totalMessages}
                        </td>
                        <td className="text-right py-2 px-3 text-[var(--foreground)] font-mono">
                          {row.bill.totalSegments}
                        </td>
                        <td className="text-right py-2 px-3 font-mono text-xs text-blue-600 dark:text-blue-400">
                          {row.bill.outboundCost.toFixed(4)}
                        </td>
                        <td className="text-right py-2 px-3 font-mono text-xs text-purple-600 dark:text-purple-400">
                          {row.bill.inboundCost.toFixed(4)}
                        </td>
                        <td className="text-right py-2 px-3 font-mono">
                          <span className="text-green-600 dark:text-green-400 font-semibold">
                            {row.bill.totalCost.toFixed(4)} {row.bill.priceUnit}
                          </span>
                          {row.bill.pendingPriceCount > 0 && (
                            <span className="ml-2 text-xs text-amber-600 dark:text-amber-400">
                              ({row.bill.pendingPriceCount} pending)
                            </span>
                          )}
                        </td>
                      </>
                    ) : (
                      <td colSpan={5} className="py-2 px-3 text-[var(--muted-foreground)] text-xs">
                        —
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
  );
}
