import { normalizePhone } from './phone';

export interface ParsedPhoneNumber {
  phone: string;
  name?: string;
  address?: string;
  row: number;
}

export async function parseExcelFile(file: File): Promise<ParsedPhoneNumber[]> {
  const ext = file.name.split('.').pop()?.toLowerCase();

  let results: ParsedPhoneNumber[];
  if (ext === 'csv') {
    results = await parseCSVFile(file);
  } else if (ext === 'xlsx' || ext === 'xls') {
    results = await parseXLSXFile(file);
  } else {
    throw new Error('Unsupported file format. Please upload a CSV or Excel file.');
  }

  return deduplicatePhones(results);
}

async function parseCSVFile(file: File): Promise<ParsedPhoneNumber[]> {
  const text = await file.text();
  const lines = text.split('\n').filter((line) => line.trim());
  const results: ParsedPhoneNumber[] = [];

  // Detect if first row is a header (no digits in first column)
  const firstLine = lines[0];
  const firstCols = firstLine?.split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
  const hasHeader = firstCols && !normalizePhone(firstCols[0]) && !/\d{7,}/.test(firstCols[0]);
  const startIndex = hasHeader ? 1 : 0;

  for (let i = startIndex; i < lines.length; i++) {
    const columns = lines[i].split(',').map((col) => col.trim().replace(/^"|"$/g, ''));

    for (let j = 0; j < columns.length; j++) {
      const normalized = normalizePhone(columns[j]);
      if (normalized && normalized.length >= 10) {
        const addressCol = columns[j + 1]?.trim();
        results.push({
          phone: normalized,
          name: j > 0 ? columns[0] : undefined,
          address: addressCol || undefined,
          row: i + 1,
        });
        break;
      }
    }
  }

  return results;
}

async function parseXLSXFile(file: File): Promise<ParsedPhoneNumber[]> {
  const XLSX = await import('xlsx');

  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 }) as unknown[][];

        const results: ParsedPhoneNumber[] = [];

        // Detect header row
        const firstRow = jsonData[0];
        const hasHeader =
          Array.isArray(firstRow) &&
          firstRow.length > 0 &&
          !normalizePhone(String(firstRow[0])) &&
          !/\d{7,}/.test(String(firstRow[0]));
        const startIndex = hasHeader ? 1 : 0;

        for (let i = startIndex; i < jsonData.length; i++) {
          const row = jsonData[i];
          const rowArray = Array.isArray(row) ? row : Object.values(row);

          for (let j = 0; j < rowArray.length; j++) {
            const value = String(rowArray[j] || '').trim();
            const normalized = normalizePhone(value);

            if (normalized && normalized.length >= 10) {
              const addressCol = String(rowArray[j + 1] || '').trim();
              results.push({
                phone: normalized,
                name: j > 0 ? String(rowArray[0] || '') : undefined,
                address: addressCol || undefined,
                row: i + 1,
              });
              break;
            }
          }
        }

        resolve(results);
      } catch (error) {
        reject(
          new Error(
            'Failed to parse Excel file: ' +
              (error instanceof Error ? error.message : 'Unknown error')
          )
        );
      }
    };

    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsArrayBuffer(file);
  });
}

// Matches a NANP phone token so several numbers on one line (space-separated)
// are picked up individually instead of collapsing into one giant string.
const PHONE_TOKEN_RE = /\+?1?[\s.-]?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/g;

// Invisible bidi / zero-width formatting marks that copy-paste injects around
// numbers (e.g. U+202A…U+202C) — strip them or normalization mangles the digits.
const INVISIBLE_MARKS_RE = /[\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g;

export function parseManualList(text: string): ParsedPhoneNumber[] {
  const lines = text.replace(INVISIBLE_MARKS_RE, '').split('\n').filter((line) => line.trim());
  const results: ParsedPhoneNumber[] = [];

  lines.forEach((line, index) => {
    // Structured "Name, phone[, address]" rows use tab/comma → keep name + address.
    if (/[\t,]/.test(line)) {
      const parts = line.split(/[\t,]/).map((p) => p.trim());
      for (let j = 0; j < parts.length; j++) {
        const normalized = normalizePhone(parts[j]);
        if (normalized && normalized.length >= 10) {
          const addressPart = parts[j + 1]?.trim();
          results.push({
            phone: normalized,
            name: j > 0 ? parts[0] : undefined,
            address: addressPart || undefined,
            row: index + 1,
          });
          break;
        }
      }
      return;
    }

    // Plain line — one or more phone numbers separated by spaces or newlines.
    const matches = line.match(PHONE_TOKEN_RE);
    if (matches && matches.length > 0) {
      for (const m of matches) {
        const normalized = normalizePhone(m);
        if (normalized && normalized.length >= 10) {
          results.push({ phone: normalized, row: index + 1 });
        }
      }
      return;
    }

    // Fallback: a single oddly-formatted number the pattern missed.
    const normalized = normalizePhone(line);
    if (normalized && normalized.length >= 10) {
      results.push({ phone: normalized, row: index + 1 });
    }
  });

  return deduplicatePhones(results);
}

function deduplicatePhones(phones: ParsedPhoneNumber[]): ParsedPhoneNumber[] {
  const seen = new Set<string>();
  return phones.filter((p) => {
    if (seen.has(p.phone)) return false;
    seen.add(p.phone);
    return true;
  });
}
