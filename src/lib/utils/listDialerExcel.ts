/**
 * List Dialer Excel Utility
 *
 * Parses uploaded XLSX/CSV files for the manual sequential dialer on
 * /phone. Unlike the bulk-sms parser in `excelParser.ts`, this one
 * KEEPS every original column intact so the UI can show "who am I
 * talking to" details (name, address, notes, account-id, …whatever
 * the user has in their spreadsheet) and the export can round-trip
 * the same shape back out with extra columns for the call outcome.
 *
 * @module lib/utils/listDialerExcel
 */

// xlsx (~400KB) is loaded via dynamic import() inside parseXlsx /
// exportListDialerResults, so the spreadsheet engine only downloads when the
// user actually imports or exports a file — never on initial page load.
import { normalizePhone } from './phone';

/**
 * A single row from the uploaded list. `extraColumns` preserves the
 * original ordering and labels so the export can write columns back
 * out in the same order the user gave us.
 */
export interface ListDialerRow {
  /** Stable id for React keys + state tracking across renders. */
  id: string;
  /** Normalized phone (11 digits, no +). Empty if no phone found in this row — that row gets filtered out. */
  phoneNumber: string;
  /** Original cell value of the detected phone column, preserved for display. */
  phoneNumberRaw: string;
  /** All non-phone columns from the row, in original sheet order. */
  extraColumns: Array<{ header: string; value: string }>;
  /** 1-based original row index in the spreadsheet (for "Row 14 had a bad number" style errors). */
  sourceRow: number;
}

export interface ListDialerParseResult {
  /** Ordered headers from the original file (excluding the detected phone column). */
  extraHeaders: string[];
  /** The detected phone column header — shown in the upload summary so the user can sanity-check. */
  phoneColumnHeader: string;
  /** Valid, deduplicated rows. */
  rows: ListDialerRow[];
  /** Raw rows that had no detectable phone number — surfaced as a warning, not a hard fail. */
  skippedRowCount: number;
}

// Common header tokens we recognise as "this column has the phone."
// Compared case-insensitively after stripping non-alphanumerics.
const PHONE_HEADER_TOKENS = [
  'phone',
  'phonenumber',
  'number',
  'mobile',
  'cell',
  'cellphone',
  'mobilenumber',
  'contact',
  'contactnumber',
  'tel',
  'telephone',
  'phonenum',
  'msisdn',
];

const normalizeHeader = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]/g, '');

/**
 * Pick which column holds the phone numbers.
 *
 * Priority:
 *   1. A header whose normalised name matches one of `PHONE_HEADER_TOKENS`.
 *   2. Otherwise the column where ≥60% of the non-empty values normalise
 *      to a valid phone (≥10 digits). The 60% threshold tolerates a few
 *      junk cells without picking up an address column that happens to
 *      contain a phone-shaped string.
 *
 * Returns the column index, or -1 if no column qualifies.
 */
function detectPhoneColumn(headers: string[], rows: string[][]): number {
  // Header match
  for (let i = 0; i < headers.length; i++) {
    const norm = normalizeHeader(headers[i] || '');
    if (PHONE_HEADER_TOKENS.includes(norm)) return i;
  }

  // Content match — phone-shaped majority
  const colCount = headers.length;
  let bestIdx = -1;
  let bestRatio = 0;
  for (let col = 0; col < colCount; col++) {
    let total = 0;
    let phoneLike = 0;
    for (const row of rows) {
      const cell = String(row[col] ?? '').trim();
      if (!cell) continue;
      total++;
      const normalized = normalizePhone(cell);
      if (normalized && normalized.length >= 10) phoneLike++;
    }
    if (total === 0) continue;
    const ratio = phoneLike / total;
    if (ratio >= 0.6 && ratio > bestRatio) {
      bestRatio = ratio;
      bestIdx = col;
    }
  }
  return bestIdx;
}

/**
 * Read the user-uploaded file and produce a structured list. The same
 * function handles CSV and XLSX — XLSX takes the dynamic-import path
 * because `xlsx` is ~600KB minified and only the list-dialer feature
 * uses it on this page.
 */
export async function parseListDialerFile(file: File): Promise<ListDialerParseResult> {
  const ext = file.name.split('.').pop()?.toLowerCase();
  if (ext === 'csv') {
    return parseCsv(file);
  }
  if (ext === 'xlsx' || ext === 'xls') {
    return parseXlsx(file);
  }
  throw new Error('Unsupported file format. Please upload a .xlsx, .xls, or .csv file.');
}

async function parseCsv(file: File): Promise<ListDialerParseResult> {
  const text = await file.text();
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== '');
  if (lines.length === 0) {
    throw new Error('File is empty.');
  }

  // Naive CSV split — good enough for the typical sales-list CSV. If
  // we hit quoted commas we'll improve this; not worth pulling in
  // papaparse for v1.
  const rows = lines.map((line) => line.split(',').map((c) => c.trim().replace(/^"|"$/g, '')));

  // Heuristic: first row is a header if NONE of its cells look like a phone.
  const firstRowHasPhone = rows[0].some((c) => {
    const n = normalizePhone(c);
    return n && n.length >= 10;
  });

  let headers: string[];
  let dataRows: string[][];
  if (firstRowHasPhone) {
    headers = rows[0].map((_, i) => `Column ${i + 1}`);
    dataRows = rows;
  } else {
    headers = rows[0];
    dataRows = rows.slice(1);
  }

  return buildResult(headers, dataRows, firstRowHasPhone ? 1 : 2);
}

async function parseXlsx(file: File): Promise<ListDialerParseResult> {
  const XLSX = await import('xlsx');
  const buf = await file.arrayBuffer();
  const workbook = XLSX.read(new Uint8Array(buf), { type: 'array' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  // header:1 returns an array of arrays (cell values keyed by index).
  // Empty cells come back undefined; we coerce to '' downstream.
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' });

  if (rows.length === 0) {
    throw new Error('Spreadsheet is empty.');
  }

  const firstRow = (rows[0] || []).map((c) => String(c ?? '').trim());
  const firstRowHasPhone = firstRow.some((c) => {
    const n = normalizePhone(c);
    return n && n.length >= 10;
  });

  let headers: string[];
  let dataRows: string[][];
  if (firstRowHasPhone) {
    headers = firstRow.map((_, i) => `Column ${i + 1}`);
    dataRows = rows.map((r) => (r as unknown[]).map((c) => String(c ?? '').trim()));
  } else {
    headers = firstRow;
    dataRows = rows.slice(1).map((r) => (r as unknown[]).map((c) => String(c ?? '').trim()));
  }

  return buildResult(headers, dataRows, firstRowHasPhone ? 1 : 2);
}

function buildResult(
  headers: string[],
  dataRows: string[][],
  firstDataRowIndex: number
): ListDialerParseResult {
  const phoneCol = detectPhoneColumn(headers, dataRows);
  if (phoneCol === -1) {
    throw new Error(
      'No phone-number column detected. Make sure one column has values that look like phone numbers.'
    );
  }

  const phoneHeader = headers[phoneCol] || `Column ${phoneCol + 1}`;
  const extraHeaders = headers.filter((_, i) => i !== phoneCol);

  const seenPhones = new Set<string>();
  const out: ListDialerRow[] = [];
  let skipped = 0;

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];
    const raw = String(row[phoneCol] ?? '').trim();
    const normalized = normalizePhone(raw);
    if (!normalized || normalized.length < 10) {
      skipped++;
      continue;
    }
    if (seenPhones.has(normalized)) {
      // Duplicates in the source list become a single attempt — sales
      // teams routinely re-paste the same lead into multiple sheets and
      // we don't want to dial the same person back-to-back.
      skipped++;
      continue;
    }
    seenPhones.add(normalized);

    const extraColumns = headers
      .map((header, idx) =>
        idx === phoneCol ? null : { header, value: String(row[idx] ?? '').trim() }
      )
      .filter((c): c is { header: string; value: string } => c !== null);

    out.push({
      id: `${normalized}-${i}`,
      phoneNumber: normalized,
      phoneNumberRaw: raw,
      extraColumns,
      sourceRow: i + firstDataRowIndex,
    });
  }

  return {
    extraHeaders,
    phoneColumnHeader: phoneHeader,
    rows: out,
    skippedRowCount: skipped,
  };
}

/**
 * Outcome of a single attempted call. Shape mirrors what we ask the
 * user to pick on the disposition card; `note` is the optional free-text.
 */
export interface ListDialerOutcome {
  disposition: string;
  note: string;
  durationSeconds: number;
  attemptedAt: string;
}

/**
 * Build a new XLSX file with the original columns intact plus
 * five outcome columns at the end. Returned as a Blob the caller
 * hands to a download anchor.
 *
 * Status values:
 *   - 'called'   — call attempt was made (disposition recorded)
 *   - 'skipped'  — user clicked Skip without dialing
 *   - 'pending'  — never reached this row before campaign ended
 */
export async function exportListDialerResults(args: {
  fileName: string;
  phoneColumnHeader: string;
  extraHeaders: string[];
  rows: Array<
    ListDialerRow & {
      status: 'called' | 'skipped' | 'pending';
      outcome?: ListDialerOutcome;
    }
  >;
}): Promise<Blob> {
  const headerRow = [
    args.phoneColumnHeader,
    ...args.extraHeaders,
    'Status',
    'Disposition',
    'Note',
    'Duration (sec)',
    'Attempted At',
  ];

  const dataRows = args.rows.map((r) => {
    const extras = args.extraHeaders.map((h) => {
      const found = r.extraColumns.find((c) => c.header === h);
      return found ? found.value : '';
    });
    return [
      r.phoneNumberRaw || r.phoneNumber,
      ...extras,
      r.status,
      r.outcome?.disposition ?? '',
      r.outcome?.note ?? '',
      r.outcome?.durationSeconds ?? '',
      r.outcome?.attemptedAt ?? '',
    ];
  });

  const XLSX = await import('xlsx');
  const sheet = XLSX.utils.aoa_to_sheet([headerRow, ...dataRows]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, 'Call List');

  // writeFile triggers a download in browsers — we want a Blob the
  // caller controls instead, so use write() with type:'array' and
  // wrap it ourselves.
  const buf = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
  return new Blob([buf], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

/**
 * Canonical disposition list. Order matters — this is the order the
 * picker buttons render in.
 */
export const LIST_DIALER_DISPOSITIONS = [
  { value: 'interested', label: 'Interested', tone: 'positive' as const },
  { value: 'callback', label: 'Call Back Later', tone: 'neutral' as const },
  { value: 'busy', label: 'Busy', tone: 'neutral' as const },
  { value: 'no_answer', label: 'No Answer', tone: 'neutral' as const },
  { value: 'voicemail', label: 'Voicemail', tone: 'neutral' as const },
  { value: 'not_interested', label: 'Not Interested', tone: 'negative' as const },
  { value: 'wrong_number', label: 'Wrong Number', tone: 'negative' as const },
  { value: 'do_not_call', label: 'Do Not Call', tone: 'negative' as const },
];

export type DispositionTone = 'positive' | 'neutral' | 'negative';
