'use client';

/**
 * Dispositions — admin/oversight view of every call outcome agents have logged
 * (the superset of the Voicemail Audit queue). Filter by outcome, agent, date
 * range, or to flagged rows only; export the filtered set as CSV. Access is
 * gated by the `view.voicemail_audit` permission via the admin layout's route
 * guard + nav (same oversight audience as the audit queue).
 *
 * @module app/admin/dispositions/page
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
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Button,
  Pagination,
  Badge,
} from '@/components/ui';
import { useDispositions, useDispositionCatalog } from '@/lib/hooks/useCallDisposition';
import { formatAdminDateTime } from '@/lib/utils/datetime';
import { formatDuration, formatPhoneNumber } from '@/lib/utils/formatting';
import { useDispositionFilters } from '@/components/dispositions/useDispositionFilters';
import { DispositionFilterBar } from '@/components/dispositions/DispositionFilterBar';
import { exportDispositionsCsv } from '@/components/dispositions/exportDispositions';
import type { AuditItem } from '@/lib/api';

/** The customer side of the call (outbound → callee, inbound → caller). */
function counterparty(item: AuditItem): string {
  const raw = item.direction === 'outbound' ? item.callee : item.caller;
  return raw ? formatPhoneNumber(raw) : '—';
}

/** Badge tone per outcome family (semantic, not the accent). */
function outcomeVariant(code: string): 'success' | 'info' | 'warning' | 'danger' | 'secondary' {
  switch (code) {
    case 'sale':
      return 'success';
    case 'callback_requested':
    case 'in_process':
      return 'info';
    case 'voice_mail':
      return 'warning';
    case 'not_interested':
    case 'wrong_number':
    case 'do_not_call':
      return 'danger';
    default:
      return 'secondary';
  }
}

export default function DispositionsPage() {
  const filters = useDispositionFilters();
  const { data: catalog } = useDispositionCatalog();

  const { data, isLoading, isError, isFetching, refetch } = useDispositions({
    page: filters.page,
    limit: filters.pageSize,
    ...filters.queryParams,
  });

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / filters.pageSize));

  /** Outcome code → human label (from the catalog). */
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
        filenamePrefix: 'dispositions',
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
          <h1 className="text-2xl font-semibold text-[var(--foreground)]">Dispositions</h1>
          <p className="text-sm text-[var(--muted-foreground)]">
            Every call outcome your agents have logged. Filter by outcome, agent or date, or show
            only the calls flagged for review.
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
            <CardTitle>Dispositions{total > 0 ? ` (${total})` : ''}</CardTitle>
            <DispositionFilterBar
              filters={filters}
              showOutcome
              showFlaggedToggle
              outcomes={catalog?.outcomes ?? []}
              labelFor={labelFor}
            />
          </div>
        </CardHeader>
        <CardContent>
          {isError ? (
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <FiAlertTriangle className="w-8 h-8 text-[var(--destructive)]" />
              <p className="text-sm text-[var(--muted-foreground)]">Couldn’t load dispositions.</p>
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
              {filters.filtered
                ? 'No dispositions match these filters.'
                : 'No dispositions logged yet.'}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--border)] text-left text-xs uppercase tracking-wide text-[var(--muted-foreground)]">
                      <th className="py-2 pr-4 font-medium">Agent</th>
                      <th className="py-2 pr-4 font-medium">Number</th>
                      <th className="py-2 pr-4 font-medium">Outcome</th>
                      <th className="py-2 pr-4 font-medium">Duration</th>
                      <th className="py-2 pr-4 font-medium">Reason</th>
                      <th className="py-2 pr-4 font-medium">When</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => {
                      const flagged = item.auditReason != null;
                      return (
                        <tr
                          key={item.id}
                          className="border-b border-[var(--border)] last:border-0"
                        >
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
                          <td className="py-2.5 pr-4">
                            <span className="inline-flex items-center gap-2">
                              <Badge variant={outcomeVariant(item.outcomeCode)}>
                                {labelFor(item.outcomeCode)}
                              </Badge>
                              {flagged && <Badge variant="danger">Flagged</Badge>}
                            </span>
                          </td>
                          <td className="py-2.5 pr-4 tabular-nums text-[var(--foreground)]">
                            {item.callDurationSecs != null
                              ? formatDuration(item.callDurationSecs)
                              : '—'}
                          </td>
                          <td className="py-2.5 pr-4 max-w-[280px]">
                            <div className="text-[var(--foreground)]">
                              {item.reason || (
                                <span className="text-[var(--muted-foreground)]">—</span>
                              )}
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
                      );
                    })}
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
