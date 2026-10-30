/**
 * Shared CSV export for disposition-based lists (Dispositions + Voicemail Audit).
 *
 * Pages through the admin `/call-dispositions/list` endpoint (session-auth, not
 * rate limited), builds the file in the browser, and triggers a download —
 * respecting whatever filters are passed. Used by both admin pages so the export
 * format stays identical.
 *
 * @module components/dispositions/exportDispositions
 */

import { callDispositionService } from '@/lib/api';
import type { AuditItem } from '@/lib/api';

/** Filter subset accepted by the disposition list endpoint. */
export interface DispositionExportFilter {
  outcome?: string;
  flagged?: boolean;
  from?: string;
  to?: string;
  agentUserId?: number;
}

/** Escape a value for a CSV cell (quote when it contains a comma/quote/newline). */
function csvCell(v: string | number | null | undefined): string {
  const s = v == null ? '' : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * Fetch every row matching `filter` (all pages) and download it as a CSV.
 * @param filter        the active list filters (page-independent)
 * @param labelFor      outcome-code → human label (from the catalog)
 * @param filenamePrefix e.g. "dispositions" or "voicemail-audit"
 */
export async function exportDispositionsCsv(opts: {
  filter: DispositionExportFilter;
  labelFor: (code: string) => string;
  filenamePrefix: string;
}): Promise<void> {
  const { filter, labelFor, filenamePrefix } = opts;

  const all: AuditItem[] = [];
  const LIMIT = 100;
  for (let p = 1; p <= 1000; p++) {
    const res = await callDispositionService.listDispositions({ page: p, limit: LIMIT, ...filter });
    all.push(...res.items);
    if (res.items.length === 0 || all.length >= res.total) break;
  }

  const header = [
    'Call ID',
    'When',
    'Agent',
    'Agent Phone',
    'Direction',
    'Caller',
    'Callee',
    'Outcome',
    'Outcome Code',
    'Duration (s)',
    'Flagged',
    'Reason',
    'Audit Reason',
  ];
  const rows = all.map((it) => [
    it.callRecordId,
    it.callStartTime || it.createdAt,
    it.agentName || '',
    it.agentPhone || '',
    it.direction,
    it.caller,
    it.callee,
    labelFor(it.outcomeCode),
    it.outcomeCode,
    it.callDurationSecs ?? '',
    it.auditReason != null ? 'Yes' : 'No',
    it.reason || '',
    it.auditReason || '',
  ]);
  const csv = [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n');

  // Prepend a BOM so Excel reads the UTF-8 correctly.
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filenamePrefix}-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
