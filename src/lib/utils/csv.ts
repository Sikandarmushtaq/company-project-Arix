/**
 * Client-side CSV export.
 *
 * Builds a CSV from in-memory rows already fetched into the UI and triggers a
 * browser download — no server round-trip. (Distinct from admin-user.api's
 * `downloadCsv()`, which streams a server-generated export.)
 *
 * @module lib/utils/csv
 */

type Cell = string | number | null | undefined;

/** RFC-4180 escape: quote when the value contains a comma, quote or newline. */
function escapeCell(v: Cell): string {
  const s = v == null ? '' : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Strip characters that make for an unfriendly filename. */
export function safeFilename(name: string): string {
  return name.replace(/[^a-z0-9_.-]+/gi, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}

/**
 * Download `rows` (with a `headers` row) as a UTF-8 CSV file. A BOM is
 * prepended so Excel detects UTF-8 correctly.
 */
export function downloadCsvRows(filename: string, headers: string[], rows: Cell[][]): void {
  const body = [headers, ...rows].map((r) => r.map(escapeCell).join(',')).join('\r\n');
  // Prepend a UTF-8 BOM (U+FEFF) so Excel opens non-ASCII correctly.
  const blob = new Blob(['﻿' + body], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
