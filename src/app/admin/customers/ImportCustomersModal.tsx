'use client';

/**
 * Bulk import customers from CSV / XLSX.
 *
 * Flow:
 *   1. User picks a file → client-side parse via XLSX (already a dep)
 *   2. Preview shows first N rows + summary (X new, Y duplicates, Z invalid)
 *   3. User picks optional "Assign all to" agent + "Update existing" toggle
 *   4. Submit → POST /customers/bulk/import → results modal
 *
 * Why client-side parse: keeps the API stateless and JSON-only, and lets us
 * preview without a round-trip. Server still re-validates everything.
 */

import React, { useState, useCallback } from 'react';
import { FiUploadCloud, FiAlertTriangle, FiCheck, FiDownload } from 'react-icons/fi';
import { Button, StyledSelect } from '@/components/ui';
import { Modal } from '@/components/ui/Modal';
import { useBulkImportCustomers } from '@/lib/hooks';
import type { ImportRow, BulkImportResult, CustomerStatus } from '@/lib/api/services/customers.api';
import { normalizePhone } from '@/lib/utils/phone';

interface OrgMember {
  id: number;
  fullName: string;
  email: string;
  role: 'owner' | 'manager' | 'user';
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  agents: OrgMember[];
  onImported?: (result: BulkImportResult) => void;
}

/**
 * Build a self-explanatory CSV template the manager can fill in.
 * - Real-looking example rows (not lorem-ipsum) so the format is obvious.
 * - Phones use the US 555 fictional range so importing the template
 *   as-is can't collide with anyone's real numbers.
 * - assignedUserEmail uses the agent@example.com placeholder rather than
 *   a real user's address — the template is downloaded and may end up
 *   passed around; injecting a real user's email would be invasive.
 * - RFC-4180 quoting so commas/quotes inside cells survive the round-trip.
 */
function buildTemplateCsv(): string {
  const headers = ['name', 'phone', 'notes', 'status', 'assignedUserEmail'];
  // Use 555-prefix numbers (US fictional range, never assignable to real
  // lines) so users importing the template-as-is can't accidentally create
  // a "customer" that collides with their own business numbers.
  // Use a clearly-fake placeholder email rather than a real agent's
  // address — the template is downloaded and may end up emailed around;
  // leaking a real user's email through it is unprofessional.
  const rows: string[][] = [
    headers,
    ['John Doe', '15551234567', 'Interested in package A', 'new', 'agent@example.com'],
    ['Jane Smith', '15555550199', 'Called yesterday, follow up Friday', 'active', ''],
    ['Acme Corp', '15558675309', '', 'new', ''],
  ];
  return rows
    .map((r) =>
      r
        .map((cell) => {
          const s = String(cell ?? '');
          return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        })
        .join(',')
    )
    .join('\n');
}

function downloadTemplate() {
  const csv = buildTemplateCsv();
  // Prepend BOM so Excel detects UTF-8 (otherwise non-ASCII characters
  // like the bullet in stub names would land as mojibake on Windows).
  const blob = new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'customers-template.csv';
  a.click();
  URL.revokeObjectURL(url);
}

const KNOWN_STATUSES: CustomerStatus[] = ['new', 'active', 'closed', 'dnc'];

/**
 * Map a parsed row's headers (lowercased) onto our schema. Accepts a few
 * common spellings so non-technical users don't have to hand-write the
 * exact column names.
 */
function normalizeHeader(h: string): keyof ImportRow | null {
  const k = h
    .trim()
    .toLowerCase()
    .replace(/[\s_-]/g, '');
  if (k === 'name' || k === 'customername' || k === 'fullname') return 'name';
  if (k === 'phone' || k === 'phonenumber' || k === 'mobile' || k === 'whatsapp') return 'phone';
  if (k === 'notes' || k === 'note' || k === 'remarks' || k === 'comments') return 'notes';
  if (k === 'status') return 'status';
  if (k === 'assigneduseremail' || k === 'agent' || k === 'agentemail' || k === 'assignedto')
    return 'assignedUserEmail';
  return null;
}

interface ParsedSheet {
  rows: ImportRow[];
  newCount: number;
  invalidCount: number;
  warnings: string[];
}

async function parseFile(file: File): Promise<ParsedSheet> {
  const ext = file.name.split('.').pop()?.toLowerCase();
  if (ext !== 'csv' && ext !== 'xlsx' && ext !== 'xls') {
    throw new Error('Unsupported format. Upload .csv or .xlsx');
  }

  const XLSX = await import('xlsx');
  let sheetData: unknown[][];

  if (ext === 'csv') {
    const text = await file.text();
    const wb = XLSX.read(text, { type: 'string' });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    sheetData = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];
  } else {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(new Uint8Array(buf), { type: 'array' });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    sheetData = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];
  }

  if (sheetData.length === 0) {
    return { rows: [], newCount: 0, invalidCount: 0, warnings: ['File is empty'] };
  }

  // Detect header row: first row is a header iff column 0 isn't a phone.
  const firstRow = sheetData[0].map((c) => String(c ?? '').trim());
  const looksLikePhone = !!normalizePhone(firstRow[0]) && firstRow[0].length >= 10;
  const hasHeader = !looksLikePhone;

  let columnMap: Record<keyof ImportRow, number | null> = {
    name: null,
    phone: null,
    notes: null,
    status: null,
    assignedUserEmail: null,
  };

  if (hasHeader) {
    firstRow.forEach((h, idx) => {
      const mapped = normalizeHeader(h);
      if (mapped) columnMap[mapped] = idx;
    });
  } else {
    // No header — assume first two columns are name + phone (the most common
    // export from address books). Extra columns ignored.
    columnMap = { ...columnMap, name: 0, phone: 1 };
  }

  const warnings: string[] = [];
  if (columnMap.phone === null) {
    warnings.push('No "phone" column found — every row will be invalid.');
  }
  if (columnMap.name === null) {
    warnings.push('No "name" column found — every row will be invalid.');
  }

  const dataRows = hasHeader ? sheetData.slice(1) : sheetData;
  const rows: ImportRow[] = [];
  let invalidCount = 0;

  for (const r of dataRows) {
    const row: ImportRow = {};
    if (columnMap.name !== null) row.name = String(r[columnMap.name] ?? '').trim();
    if (columnMap.phone !== null) row.phone = String(r[columnMap.phone] ?? '').trim();
    if (columnMap.notes !== null) row.notes = String(r[columnMap.notes] ?? '').trim();
    if (columnMap.status !== null) {
      const s = String(r[columnMap.status] ?? '')
        .trim()
        .toLowerCase();
      if (KNOWN_STATUSES.includes(s as CustomerStatus)) row.status = s as CustomerStatus;
    }
    if (columnMap.assignedUserEmail !== null) {
      const e = String(r[columnMap.assignedUserEmail] ?? '').trim();
      if (e) row.assignedUserEmail = e;
    }

    // Skip blank lines
    if (!row.name && !row.phone) continue;

    const normalizedPhone = normalizePhone(row.phone || '');
    if (!row.name || normalizedPhone.length < 10) {
      invalidCount++;
      // We still send the row to the server so it can return a precise
      // error per row index — easier than guessing the same logic twice.
    }

    rows.push(row);
  }

  return { rows, newCount: rows.length - invalidCount, invalidCount, warnings };
}

export function ImportCustomersModal({ isOpen, onClose, agents, onImported }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [parsed, setParsed] = useState<ParsedSheet | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [assignToUserId, setAssignToUserId] = useState<number | ''>('');
  const [updateExisting, setUpdateExisting] = useState(false);
  const [transferChat, setTransferChat] = useState(false);
  const [result, setResult] = useState<BulkImportResult | null>(null);

  const importMut = useBulkImportCustomers();

  const reset = useCallback(() => {
    setFile(null);
    setParsed(null);
    setParseError(null);
    setAssignToUserId('');
    setUpdateExisting(false);
    setTransferChat(false);
    setResult(null);
  }, []);

  const handleClose = useCallback(() => {
    reset();
    onClose();
  }, [onClose, reset]);

  const handleFile = useCallback(async (f: File | null) => {
    setFile(f);
    setParsed(null);
    setParseError(null);
    setResult(null);
    if (!f) return;
    try {
      const sheet = await parseFile(f);
      setParsed(sheet);
    } catch (err) {
      setParseError(err instanceof Error ? err.message : 'Failed to parse file');
    }
  }, []);

  const handleSubmit = useCallback(() => {
    if (!parsed || parsed.rows.length === 0) return;
    importMut.mutate(
      {
        rows: parsed.rows,
        options: {
          assignToUserId: assignToUserId === '' ? null : Number(assignToUserId),
          updateExisting,
          // transferChat only matters when an assignee was picked AND the
          // import touches existing customers that already had owners.
          // Server enforces the rules; we just pass the flag through.
          transferChat: assignToUserId !== '' && transferChat,
        },
      },
      {
        onSuccess: (data) => {
          setResult(data);
          onImported?.(data);
        },
      }
    );
  }, [parsed, assignToUserId, updateExisting, transferChat, importMut, onImported]);

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Import Customers">
      {!result && (
        <div className="space-y-4">
          {/* Template download — handy for first-time managers who don't
              know which columns we accept. The CSV opens in Excel cleanly
              and includes one row pre-filled with a real agent email so
              the assignedUserEmail format is obvious. */}
          <div className="flex items-start justify-between gap-3 p-3 rounded-lg bg-[var(--muted)]/30 border border-[var(--border)]">
            <div className="text-xs text-[var(--muted-foreground)]">
              <p className="font-medium text-[var(--foreground)] mb-0.5">First time importing?</p>
              <p>Download a template with the right columns and example rows.</p>
            </div>
            <Button type="button" size="sm" variant="outline" onClick={() => downloadTemplate()}>
              <FiDownload className="w-3.5 h-3.5" /> Template
            </Button>
          </div>

          {/* File picker */}
          <div>
            <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
              CSV or Excel file
            </label>
            <label className="flex items-center gap-3 px-4 py-3 rounded-lg border-2 border-dashed border-[var(--border)] cursor-pointer hover:border-[var(--primary-400)] transition-colors">
              <FiUploadCloud className="w-5 h-5 text-[var(--muted-foreground)] flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[var(--foreground)] truncate">
                  {file ? file.name : 'Choose a file…'}
                </p>
                <p className="text-xs text-[var(--muted-foreground)]">
                  Headers: name, phone (required) · notes, status, assignedUserEmail (optional)
                </p>
              </div>
              <input
                type="file"
                accept=".csv,.xlsx,.xls"
                className="hidden"
                onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
              />
            </label>
          </div>

          {parseError && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 text-sm">
              <FiAlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <div>{parseError}</div>
            </div>
          )}

          {/* Preview */}
          {parsed && (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2">
                <Stat label="Rows" value={parsed.rows.length} tone="neutral" />
                <Stat label="Will import" value={parsed.newCount} tone="success" />
                <Stat label="Invalid" value={parsed.invalidCount} tone="danger" />
              </div>

              {parsed.warnings.length > 0 && (
                <div className="p-3 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-300 text-xs space-y-1">
                  {parsed.warnings.map((w, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <FiAlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                      {w}
                    </div>
                  ))}
                </div>
              )}

              {/* Options */}
              <div>
                <label className="block text-sm font-medium text-[var(--foreground)] mb-1">
                  Assign all imported to (optional)
                </label>
                <StyledSelect
                  value={String(assignToUserId)}
                  onChange={(v) => setAssignToUserId(v === '' ? '' : Number(v))}
                >
                  <option value="">— Don't assign —</option>
                  {agents.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.fullName} ({a.email})
                    </option>
                  ))}
                </StyledSelect>
                <p className="text-xs text-[var(--muted-foreground)] mt-1">
                  Per-row <code className="font-mono">assignedUserEmail</code> in the file overrides
                  this default.
                </p>
              </div>

              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={updateExisting}
                  onChange={(e) => setUpdateExisting(e.target.checked)}
                  className="mt-0.5"
                />
                <div>
                  <p className="text-sm font-medium text-[var(--foreground)]">
                    Update existing customers
                  </p>
                  <p className="text-xs text-[var(--muted-foreground)]">
                    When a phone already exists, overwrite name / notes / status. Default: skip
                    duplicates.
                  </p>
                </div>
              </label>

              {/* Transfer-chat is only meaningful when an assignee was
                  picked. Hidden otherwise so it doesn't lead managers to
                  think it does something on its own. */}
              {assignToUserId !== '' && (
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={transferChat}
                    onChange={(e) => setTransferChat(e.target.checked)}
                    className="mt-0.5"
                  />
                  <div>
                    <p className="text-sm font-medium text-[var(--foreground)]">
                      Also transfer chat history
                    </p>
                    <p className="text-xs text-[var(--muted-foreground)]">
                      When a row matches an existing customer, the new agent inherits the past
                      WhatsApp conversation and the previous agent is locked out. Has no effect on
                      brand-new customers. Default off.
                    </p>
                  </div>
                </label>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={handleClose} disabled={importMut.isPending}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!parsed || parsed.rows.length === 0 || importMut.isPending}
            >
              {importMut.isPending
                ? 'Importing…'
                : `Import ${parsed?.newCount ?? 0} customer${parsed?.newCount === 1 ? '' : 's'}`}
            </Button>
          </div>
        </div>
      )}

      {/* Results screen */}
      {result && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 p-3 rounded-lg bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300">
            <FiCheck className="w-5 h-5 flex-shrink-0" />
            <span className="text-sm font-medium">Import complete</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            <Stat label="Created" value={result.created} tone="success" />
            <Stat label="Updated" value={result.updated} tone="success" />
            <Stat label="Assigned" value={result.assigned} tone="neutral" />
            <Stat label="Duplicates" value={result.duplicates} tone="warning" />
            <Stat label="Invalid" value={result.invalid} tone="danger" />
          </div>

          {result.errors.length > 0 && (
            <div>
              <p className="text-sm font-medium text-[var(--foreground)] mb-2">
                {result.errors.length} row{result.errors.length === 1 ? '' : 's'} reported issues
              </p>
              <div className="max-h-40 overflow-y-auto space-y-1 text-xs">
                {result.errors.map((e, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-2 px-2 py-1 rounded bg-[var(--muted)]/40"
                  >
                    <span className="font-mono text-[var(--muted-foreground)]">Row {e.row}</span>
                    <span className="text-[var(--foreground)]">{e.reason}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={reset}>
              Import another file
            </Button>
            <Button onClick={handleClose}>Done</Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: 'neutral' | 'success' | 'warning' | 'danger';
}) {
  const colors = {
    neutral: 'bg-[var(--muted)]/40 text-[var(--foreground)]',
    success: 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-300',
    warning: 'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300',
    danger: 'bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-300',
  };
  return (
    <div className={`px-3 py-2 rounded-lg ${colors[tone]}`}>
      <div className="text-lg font-semibold tabular-nums">{value}</div>
      <div className="text-[10px] uppercase tracking-wider opacity-75">{label}</div>
    </div>
  );
}
