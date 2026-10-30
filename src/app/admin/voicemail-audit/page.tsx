'use client';

/**
 * Voicemail Audit — admin queue of voicemail calls auto-flagged by feature A
 * (voicemail that ran longer than the audit threshold). It's the flagged subset
 * of the Dispositions feed, so it reuses the same filter bar (agent + date
 * range), CSV export, and list endpoint — with `flagged` locked on. Access is
 * gated by the `view.voicemail_audit` permission via the admin layout.
 *
 * @module app/admin/voicemail-audit/page
 */

import React, { useMemo, useState } from 'react';
import {
  FiAlertTriangle,
  FiLoader,
  FiPhoneOutgoing,
  FiPhoneIncoming,
  FiRefreshCw,
  FiDownload,
} from 'react-icons/fi';
import { Card, CardContent, CardHeader, CardTitle, Button, Pagination } from '@/components/ui';
import { useDispositions, useDispositionCatalog } from '@/lib/hooks/useCallDisposition';
import { useDispositionFilters } from '@/components/dispositions/useDispositionFilters';
import { DispositionFilterBar } from '@/components/dispositions/DispositionFilterBar';
import { exportDispositionsCsv } from '@/components/dispositions/exportDispositions';
import { formatAdminDateTime } from '@/lib/utils/datetime';
import { formatDuration, formatPhoneNumber } from '@/lib/utils/formatting';
import type { AuditItem } from '@/lib/api';

/** The customer side of the call (outbound → callee, inbound → caller). */
function counterparty(item: AuditItem): string {
  const raw = item.direction === 'outbound' ? item.callee : item.caller;
  return raw ? formatPhoneNumber(raw) : '—';
}

export default function VoicemailAuditPage() {
  // The audit queue is the flagged subset — lock `flagged` on.
  const filters = useDispositionFilters({ lockedFlagged: true });
  const { data: catalog } = useDispositionCatalog();

  const { data, isLoading, isError, isFetching, refetch } = useDispositions({
    page: filters.page,
    limit: filters.pageSize,
    ...filters.queryParams,
  });

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / filters.pageSize));

  /** Outcome code → human label (for the CSV export). */
  const labelFor = useMemo(() => {
    const m = new Map<string, string>();
    for (const o of catalog?.outcomes ?? []) m.set(o.code, o.label);
    return (code: string) => m.get(code) ?? code;
  }, [catalog]);

  const [exporting, setExporting] = useState(false);
  const handleExport = async () => {
    setExporting(true);
    try {
      await exportDispositionsCsv({
        filter: filters.queryParams,
        labelFor,
        filenamePrefix: 'voicemail-audit',
      });
    } catch {
      // Non-fatal — leave the view as-is; the user can retry the export.
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--foreground)]">Voicemail Audit</h1>
          <p className="text-sm text-[var(--muted-foreground)]">
            Voicemail calls automatically flagged for review because they ran longer than the
            allowed threshold.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            disabled={exporting || isLoading || isError || total === 0}
          >
            {exporting ? (
              <FiLoader className="w-4 h-4 mr-1.5 animate-spin" />
            ) : (
              <FiDownload className="w-4 h-4 mr-1.5" />
            )}
            {exporting ? 'Exporting…' : 'Export CSV'}
          </Button>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <FiRefreshCw className={`w-4 h-4 mr-1.5 ${isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3">
            <CardTitle>Flagged voicemails{total > 0 ? ` (${total})` : ''}</CardTitle>
            <DispositionFilterBar filters={filters} />
          </div>
        </CardHeader>
        <CardContent>
          {isError ? (
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <FiAlertTriangle className="w-8 h-8 text-[var(--destructive)]" />
              <p className="text-sm text-[var(--muted-foreground)]">
                Couldn’t load the audit queue.
              </p>
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                Retry
              </Button>
            </div>
          ) : isLoading ? (
            <div className="flex items-center justify-center py-12 text-[var(--muted-foreground)]">
              <FiLoader className="w-5 h-5 animate-spin mr-2" /> Loading…
            </div>
          ) : items.length === 0 ? (
            <div className="py-12 text-center text-sm text-[var(--muted-foreground)]">
              {filters.filtered ? 'No flagged voicemails match these filters.' : 'No flagged voicemails.'}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--border)] text-left text-xs uppercase tracking-wide text-[var(--muted-foreground)]">
                      <th className="py-2 pr-4 font-medium">Agent</th>
                      <th className="py-2 pr-4 font-medium">Number</th>
                      <th className="py-2 pr-4 font-medium">Duration</th>
                      <th className="py-2 pr-4 font-medium">Reason</th>
                      <th className="py-2 pr-4 font-medium">When</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => (
                      <tr key={item.id} className="border-b border-[var(--border)] last:border-0">
                        <td className="py-2.5 pr-4">
                          <span className="font-medium text-[var(--foreground)]">
                            {item.agentName ||
                              (item.agentPhone
                                ? formatPhoneNumber(item.agentPhone)
                                : `User #${item.agentUserId}`)}
                          </span>
                        </td>
                        <td className="py-2.5 pr-4">
                          <span className="inline-flex items-center gap-1.5">
                            {item.direction === 'outbound' ? (
                              <FiPhoneOutgoing className="w-3.5 h-3.5 text-[var(--muted-foreground)]" />
                            ) : (
                              <FiPhoneIncoming className="w-3.5 h-3.5 text-[var(--muted-foreground)]" />
                            )}
                            {counterparty(item)}
                          </span>
                        </td>
                        <td className="py-2.5 pr-4 tabular-nums">
                          <span className="font-medium text-amber-600 dark:text-amber-400">
                            {item.callDurationSecs != null
                              ? formatDuration(item.callDurationSecs)
                              : '—'}
                          </span>
                        </td>
                        <td className="py-2.5 pr-4 max-w-[280px]">
                          <div className="text-[var(--foreground)]">
                            {item.reason || <span className="text-[var(--muted-foreground)]">—</span>}
                          </div>
                          {item.auditReason && (
                            <div className="text-xs text-[var(--muted-foreground)]">
                              {item.auditReason}
                            </div>
                          )}
                        </td>
                        <td className="py-2.5 pr-4 whitespace-nowrap text-[var(--muted-foreground)]">
                          {formatAdminDateTime(item.callStartTime || item.createdAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-6 border-t border-[var(--border)] pt-4">
                <Pagination
                  page={filters.page}
                  totalPages={totalPages}
                  pageSize={filters.pageSize}
                  totalItems={total}
                  hasNextPage={filters.page < totalPages}
                  hasPreviousPage={filters.page > 1}
                  pageRange={Array.from(
                    { length: Math.min(5, totalPages) },
                    (_, i) => i + Math.max(1, filters.page - 2)
                  ).filter((p) => p <= totalPages)}
                  onPageChange={filters.setPage}
                  onPageSizeChange={filters.setPageSize}
                  disabled={isFetching}
                />
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
