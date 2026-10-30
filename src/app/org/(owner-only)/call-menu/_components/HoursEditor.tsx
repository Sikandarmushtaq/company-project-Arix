'use client';

/**
 * Business-hours editor for the "Business hours" step: a weekly open/closed grid,
 * a timezone the schedule is read in, and a holiday list with one-click US
 * federal-holiday presets. Emits IvrNodeData patches ({hours, holidays, timezone}).
 */

import React, { useState } from 'react';
import { FiPlus, FiTrash2 } from 'react-icons/fi';
import { StyledSelect } from '@/components/ui';
import type { IvrNodeData, IvrHoursInterval, IvrHoliday } from '@/lib/api/services/ivr.api';

const fieldCls =
  'w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:border-[var(--primary-600)]';
const labelCls =
  'mb-1 block text-[11px] font-semibold uppercase tracking-wide text-[var(--muted-foreground)]';

// FreeSWITCH wday: 1=Sun … 7=Sat. Show Mon→Sun (how businesses think about a week).
const DAYS: { n: number; label: string }[] = [
  { n: 2, label: 'Monday' },
  { n: 3, label: 'Tuesday' },
  { n: 4, label: 'Wednesday' },
  { n: 5, label: 'Thursday' },
  { n: 6, label: 'Friday' },
  { n: 7, label: 'Saturday' },
  { n: 1, label: 'Sunday' },
];

// A curated timezone list (US first). The current value is always included.
const TIMEZONES = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Phoenix',
  'America/Los_Angeles',
  'America/Anchorage',
  'Pacific/Honolulu',
  'America/Toronto',
  'America/Vancouver',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Asia/Karachi',
  'Asia/Dubai',
  'Asia/Kolkata',
  'Australia/Sydney',
  'UTC',
];

// Fixed-date US federal holidays (recurring MM-DD). Floating ones (Thanksgiving,
// MLK, Memorial, Labor) vary yearly — add those as a specific date below.
const HOLIDAY_PRESETS: { name: string; date: string }[] = [
  { name: 'New Year’s Day', date: '01-01' },
  { name: 'Juneteenth', date: '06-19' },
  { name: 'Independence Day', date: '07-04' },
  { name: 'Veterans Day', date: '11-11' },
  { name: 'Christmas Day', date: '12-25' },
];

function tzLabel(tz: string): string {
  return tz.replace(/_/g, ' ');
}

const HHMM_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/** "HH:MM" 24h → "9:00 AM" for display. */
function fmt12(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  const ap = h < 12 ? 'AM' : 'PM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ap}`;
}

/** Time-of-day choices in 30-minute steps (value = "HH:MM" 24h, label = 12h). */
const TIME_OPTIONS: { value: string; label: string }[] = Array.from({ length: 48 }, (_, i) => {
  const h = Math.floor((i * 30) / 60);
  const m = (i * 30) % 60;
  const value = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  return { value, label: fmt12(value) };
});

/** Options that always include the current value (a stored off-grid time stays selectable). */
function timeOptionsWith(value: string): { value: string; label: string }[] {
  if (!value || TIME_OPTIONS.some((o) => o.value === value)) return TIME_OPTIONS;
  return [{ value, label: fmt12(value) }, ...TIME_OPTIONS].sort((a, b) => a.value.localeCompare(b.value));
}

/** "MM-DD" (yearly) or "YYYY-MM-DD" (one-off) → a friendly label. */
function holidayDateLabel(h: IvrHoliday): string {
  const range = h.endDate ? `${h.date} → ${h.endDate}` : h.date;
  return /^\d{2}-\d{2}$/.test(h.date) ? `${range} (every year)` : `${range} (this date only)`;
}

export function HoursEditor({
  data,
  onPatch,
}: {
  data: IvrNodeData;
  onPatch: (patch: Partial<IvrNodeData>) => void;
}) {
  const intervals = data.hours ?? [];
  const holidays = data.holidays ?? [];
  const timezone = data.timezone ?? '';
  const tzOptions = timezone && !TIMEZONES.includes(timezone) ? [timezone, ...TIMEZONES] : TIMEZONES;

  const [newName, setNewName] = useState('');
  const [newDate, setNewDate] = useState('');

  const dayInterval = (n: number): IvrHoursInterval | undefined => intervals.find((iv) => iv.day === n);

  const setDayOpen = (n: number, open: boolean) => {
    const others = intervals.filter((iv) => iv.day !== n);
    onPatch({ hours: open ? [...others, { day: n, start: '09:00', end: '17:00' }] : others });
  };
  const setDayTime = (n: number, field: 'start' | 'end', value: string) => {
    // Ignore empty/partial values (a cleared native time input emits "") — otherwise
    // an invalid "" would be saved and the backend would 400 the whole flow.
    if (!HHMM_RE.test(value)) return;
    onPatch({
      hours: intervals.map((iv) => (iv.day === n ? { ...iv, [field]: value } : iv)),
    });
  };
  /** Copy Monday's hours to the other WEEKDAYS (Tue–Fri); leave the weekend as set. */
  const applyToWeekdays = () => {
    const mon = dayInterval(2);
    if (!mon) return;
    const weekend = intervals.filter((iv) => iv.day === 1 || iv.day === 7);
    onPatch({
      hours: [...weekend, ...[2, 3, 4, 5, 6].map((day) => ({ day, start: mon.start, end: mon.end }))],
    });
  };

  const addHoliday = (h: IvrHoliday) => {
    if (holidays.some((x) => x.date === h.date)) return; // no dup dates
    onPatch({ holidays: [...holidays, h] });
  };
  const removeHoliday = (i: number) => onPatch({ holidays: holidays.filter((_, j) => j !== i) });

  return (
    <div className="space-y-4">
      {/* Timezone */}
      <div>
        <label className={labelCls}>Timezone</label>
        <StyledSelect
          className={fieldCls}
          aria-label="Business-hours timezone"
          value={timezone}
          placeholder="Choose a timezone…"
          onChange={(v) => onPatch({ timezone: v || undefined })}
        >
          {tzOptions.map((tz) => (
            <option key={tz} value={tz}>
              {tzLabel(tz)}
            </option>
          ))}
        </StyledSelect>
        <p className="mt-1 text-[11px] text-[var(--muted-foreground)]">
          Open/closed is decided in this timezone.
        </p>
      </div>

      {/* Weekly grid */}
      <div>
        <div className="mb-1 flex items-center justify-between">
          <label className={labelCls}>Open hours</label>
          <button
            type="button"
            onClick={applyToWeekdays}
            disabled={!dayInterval(2)}
            className="text-[11px] font-medium text-[var(--primary-600)] hover:underline disabled:opacity-40"
          >
            Copy Monday to weekdays
          </button>
        </div>
        <div className="space-y-1.5">
          {DAYS.map((d) => {
            const iv = dayInterval(d.n);
            const open = !!iv;
            // Inverted/equal range (overnight isn't supported) — flag it inline so
            // the owner sees it in the grid, not only at publish time.
            const invalid = open && iv!.start >= iv!.end;
            // Each time select: shrinks (min-w-0) so it can't overflow the panel,
            // caps (max-w) so it doesn't stretch huge on a wide panel.
            const timeCls = `min-w-0 flex-1 max-w-[150px] ${invalid ? 'border-red-500' : ''}`;
            return (
              <div
                key={d.n}
                className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-2.5 py-2"
              >
                {/* Toggle + day (compact, left-aligned — no stretched gap). */}
                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={open}
                    aria-label={`${d.label} ${open ? 'open' : 'closed'}`}
                    onClick={() => setDayOpen(d.n, !open)}
                    className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--primary-600)]/40 ${
                      open ? 'bg-[var(--primary-600)]' : 'bg-[var(--muted-foreground)]/40'
                    }`}
                  >
                    <span
                      aria-hidden
                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-1 ring-black/10 transition-transform ${
                        open ? 'translate-x-4' : 'translate-x-0.5'
                      }`}
                    />
                  </button>
                  <span className="text-sm font-medium text-[var(--foreground)]">{d.label}</span>
                  {!open && (
                    <span className="text-xs text-[var(--muted-foreground)]">· Closed</span>
                  )}
                </div>

                {/* From–to range on its OWN full-width line (fixed narrow panel → always
                    stacked; min-w-0 selects never overflow / horizontal-scroll). */}
                {open && (
                  <div className="mt-2 flex items-center gap-2">
                    <StyledSelect
                      aria-label={`${d.label} opens at`}
                      value={iv!.start}
                      onChange={(v) => setDayTime(d.n, 'start', v)}
                      className={timeCls}
                    >
                      {timeOptionsWith(iv!.start).map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </StyledSelect>
                    <span className="shrink-0 text-xs text-[var(--muted-foreground)]">to</span>
                    <StyledSelect
                      aria-label={`${d.label} closes at`}
                      value={iv!.end}
                      onChange={(v) => setDayTime(d.n, 'end', v)}
                      className={timeCls}
                    >
                      {timeOptionsWith(iv!.end).map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </StyledSelect>
                  </div>
                )}
                {invalid && (
                  <p className="mt-1 text-[11px] text-red-500">
                    Closing time must be after opening (overnight hours aren’t supported yet).
                  </p>
                )}
              </div>
            );
          })}
        </div>
        <p className="mt-1 text-[11px] text-[var(--muted-foreground)]">
          Calls inside these hours take the <b>Open</b> branch; all others take <b>Closed</b>. Overnight
          hours (e.g. 10pm–2am) aren’t supported yet.
        </p>
      </div>

      {/* Holidays */}
      <div>
        <label className={labelCls}>Holidays</label>
        {holidays.length > 0 && (
          <div className="mb-2 space-y-1">
            {holidays.map((h, i) => (
              <div
                key={`${h.date}-${i}`}
                className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--muted)]/30 px-2.5 py-1.5 text-xs"
              >
                <span className="min-w-0 flex-1 truncate text-[var(--foreground)]">
                  {h.name ? <b>{h.name}</b> : 'Holiday'}{' '}
                  <span className="text-[var(--muted-foreground)]">· {holidayDateLabel(h)}</span>
                </span>
                <button
                  type="button"
                  onClick={() => removeHoliday(i)}
                  aria-label={`Remove ${h.name || 'holiday'}`}
                  title="Remove"
                  className="shrink-0 rounded p-1 text-[var(--muted-foreground)] hover:bg-red-500/10 hover:text-red-500"
                >
                  <FiTrash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Add a specific-date holiday (handles floating dates like Thanksgiving). */}
        <div className="space-y-1.5 rounded-lg border border-[var(--border)] bg-[var(--muted)]/30 p-2">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Holiday name (optional)"
            className={`${fieldCls} px-2 py-1.5`}
          />
          <div className="flex items-center gap-1.5">
            <input
              type="date"
              aria-label="Holiday date"
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
              style={{ colorScheme: 'light dark' }}
              className="min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-[var(--card)] px-2 py-1.5 text-sm text-[var(--foreground)] outline-none focus:border-[var(--primary-600)]"
            />
            <button
              type="button"
              disabled={!newDate}
              onClick={() => {
                addHoliday({ name: newName.trim() || undefined, date: newDate });
                setNewName('');
                setNewDate('');
              }}
              className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-[var(--primary-600)] px-3 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              <FiPlus className="h-3.5 w-3.5" /> Add
            </button>
          </div>
        </div>

        {/* One-click fixed-date US federal holidays. */}
        <div className="mt-2 flex flex-wrap gap-1.5">
          {HOLIDAY_PRESETS.map((p) => {
            const added = holidays.some((h) => h.date === p.date);
            return (
              <button
                key={p.date}
                type="button"
                disabled={added}
                onClick={() => addHoliday(p)}
                className="rounded-full border border-[var(--border)] px-2.5 py-1 text-[11px] font-medium text-[var(--muted-foreground)] transition-colors hover:border-[var(--primary-600)] hover:text-[var(--primary-600)] disabled:opacity-40"
              >
                {added ? '✓ ' : '+ '}
                {p.name}
              </button>
            );
          })}
        </div>
        <p className="mt-1.5 text-[11px] text-[var(--muted-foreground)]">
          Holidays route to the <b>Holiday</b> branch (or <b>Closed</b> if it isn’t connected). Presets
          repeat every year; add a specific date for floating holidays like Thanksgiving.
        </p>
      </div>
    </div>
  );
}
