/**
 * Date-range helpers for advanced filters.
 *
 * The list filter matches how recordings are DISPLAYED — i.e. the viewer's
 * local wall clock (for a UK admin that is Europe/London). Inputs are
 * `datetime-local` (to-the-minute); we convert to a UTC ISO instant before
 * sending, and the backend compares against the UTC `start_stamp` exactly.
 * (Explicit Europe/London calendar bucketing is a separate concern handled in
 * the analytics phase, where the viewer's own timezone must not change which
 * UK day a call belongs to.)
 *
 * @module lib/utils/date-range
 */

export type DateRangePreset =
  | 'today'
  | 'yesterday'
  | 'thisWeek'
  | 'thisMonth'
  | 'lastMonth'
  | 'last7'
  | 'last30';

const pad = (n: number): string => String(n).padStart(2, '0');

/** Format a Date as a `datetime-local` input value (local wall clock, minute precision). */
export function toLocalInput(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(
    d.getMinutes()
  )}`;
}

/** Convert a `datetime-local` value (local) to a UTC ISO string for the API. Empty → undefined. */
export function localInputToISO(v: string | undefined | null): string | undefined {
  if (!v) return undefined;
  const d = new Date(v); // a datetime-local string is parsed in the browser's local zone
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

/** Compute a preset range as `datetime-local` input values (local wall clock). */
export function presetRange(preset: DateRangePreset): { start: string; end: string } {
  const now = new Date();
  const startOfDay = (d: Date): Date => {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
  };
  const endOfDay = (d: Date): Date => {
    const x = new Date(d);
    x.setHours(23, 59, 0, 0);
    return x;
  };

  switch (preset) {
    case 'today':
      return { start: toLocalInput(startOfDay(now)), end: toLocalInput(now) };
    case 'yesterday': {
      const y = new Date(now);
      y.setDate(now.getDate() - 1);
      return { start: toLocalInput(startOfDay(y)), end: toLocalInput(endOfDay(y)) };
    }
    case 'thisWeek': {
      const s = startOfDay(now);
      const mondayOffset = (s.getDay() + 6) % 7; // Monday = 0
      s.setDate(s.getDate() - mondayOffset);
      return { start: toLocalInput(s), end: toLocalInput(now) };
    }
    case 'thisMonth': {
      const s = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      return { start: toLocalInput(s), end: toLocalInput(now) };
    }
    case 'lastMonth': {
      const s = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
      const e = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 0, 0); // last day of prev month
      return { start: toLocalInput(s), end: toLocalInput(e) };
    }
    case 'last7': {
      const s = new Date(now);
      s.setDate(now.getDate() - 7);
      return { start: toLocalInput(s), end: toLocalInput(now) };
    }
    case 'last30': {
      const s = new Date(now);
      s.setDate(now.getDate() - 30);
      return { start: toLocalInput(s), end: toLocalInput(now) };
    }
  }
}

export const DATE_PRESETS: { key: DateRangePreset; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: 'thisWeek', label: 'This week' },
  { key: 'thisMonth', label: 'This month' },
  { key: 'lastMonth', label: 'Last month' },
  { key: 'last7', label: 'Last 7 days' },
  { key: 'last30', label: 'Last 30 days' },
];
