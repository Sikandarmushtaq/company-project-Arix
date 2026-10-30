'use client';

/**
 * DateTimeField — a compact, app-matching date + time picker that replaces the
 * OS-native (boxy) `<input type="datetime-local">`.
 *
 * A trigger button (styled like StyledSelect) opens a portaled popover with a
 * month calendar + a time field. The value in/out is the SAME
 * `datetime-local` string the native input used (`YYYY-MM-DDTHH:mm`, '' = unset),
 * so it's a drop-in: existing `localInputToISO()` / state keep working.
 *
 * `min` / `max` (also datetime-local strings) bound the selection and are used
 * to prevent an inverted range — pass the other end of the range and the
 * component clamps + disables out-of-range days. String compare is valid
 * because the format sorts chronologically.
 *
 * @module components/ui/DateTimeField
 */

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { FiCalendar, FiChevronLeft, FiChevronRight, FiX } from 'react-icons/fi';
import { cn } from '@/lib/utils/cn';
import { StyledSelect } from './StyledSelect';

export interface DateTimeFieldProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** Applied to the trigger button. */
  className?: string;
  /** datetime-local lower/upper bounds (inclusive). */
  min?: string;
  max?: string;
  disabled?: boolean;
  id?: string;
  'aria-label'?: string;
}

const pad = (n: number): string => String(n).padStart(2, '0');
const HOURS = Array.from({ length: 24 }, (_, i) => pad(i));
const MINUTES = Array.from({ length: 60 }, (_, i) => pad(i));
const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

interface Parts {
  y: number;
  mo: number; // 0-indexed
  d: number;
  hh: number;
  mm: number;
}

function parse(v: string): Parts | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(v);
  if (!m) return null;
  return {
    y: Number(m[1]),
    mo: Number(m[2]) - 1,
    d: Number(m[3]),
    hh: Number(m[4]),
    mm: Number(m[5]),
  };
}

function build(p: Parts): string {
  return `${p.y}-${pad(p.mo + 1)}-${pad(p.d)}T${pad(p.hh)}:${pad(p.mm)}`;
}

/** Chronological string compare (safe for this fixed-width format). */
function clamp(v: string, min?: string, max?: string): string {
  if (min && v < min) return min;
  if (max && v > max) return max;
  return v;
}

function formatDisplay(v: string): string {
  const p = parse(v);
  if (!p) return '';
  return `${p.d} ${MONTHS[p.mo].slice(0, 3)} ${p.y}, ${pad(p.hh)}:${pad(p.mm)}`;
}

export function DateTimeField({
  value,
  onChange,
  placeholder = 'Pick date & time…',
  className,
  min,
  max,
  disabled,
  id,
  'aria-label': ariaLabel,
}: DateTimeFieldProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number; flip: boolean }>({
    top: 0,
    left: 0,
    flip: false,
  });

  const parsed = parse(value);
  // Which month the calendar is showing — defaults to the value's month, else
  // the min/max bound, else today.
  const [view, setView] = useState<{ y: number; mo: number }>(() => {
    const p = parsed ?? parse(min ?? '') ?? parse(max ?? '');
    if (p) return { y: p.y, mo: p.mo };
    const now = new Date();
    return { y: now.getFullYear(), mo: now.getMonth() };
  });

  // Re-anchor the view to the value's month whenever the popover is opened.
  useEffect(() => {
    if (!open) return;
    const p = parse(value);
    if (p) setView({ y: p.y, mo: p.mo });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const reposition = () => {
    const t = triggerRef.current;
    if (!t) return;
    const r = t.getBoundingClientRect();
    const menuH = menuRef.current?.offsetHeight ?? 0;
    const menuW = menuRef.current?.offsetWidth ?? 0;
    const spaceBelow = window.innerHeight - r.bottom;
    const flip = menuH > 0 && spaceBelow < menuH + 8 && r.top > spaceBelow;
    const left = menuW > 0 ? Math.max(8, Math.min(r.left, window.innerWidth - menuW - 8)) : r.left;
    setPos({ top: flip ? r.top - menuH - 4 : r.bottom + 4, left, flip });
  };

  useLayoutEffect(() => {
    if (!open) return;
    reposition();
    const onScroll = () => reposition();
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      // The HH/MM StyledSelect menus portal to <body>, so they live outside this
      // popover's DOM — a click inside one (role="listbox") is NOT an outside
      // click and must not close the picker.
      if (
        !triggerRef.current?.contains(target) &&
        !menuRef.current?.contains(target) &&
        !target.closest?.('[role="listbox"]')
      ) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      // Let an open HH/MM menu swallow Escape first; only then close the picker.
      if (e.key === 'Escape' && !document.querySelector('[role="listbox"]')) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const minP = useMemo(() => parse(min ?? ''), [min]);
  const maxP = useMemo(() => parse(max ?? ''), [max]);

  // Grid of day cells for the shown month (Monday-first; leading nulls pad).
  const grid = useMemo(() => {
    const first = new Date(view.y, view.mo, 1);
    const lead = (first.getDay() + 6) % 7; // Monday = 0
    const total = new Date(view.y, view.mo + 1, 0).getDate();
    const cells: (number | null)[] = [];
    for (let i = 0; i < lead; i++) cells.push(null);
    for (let day = 1; day <= total; day++) cells.push(day);
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [view]);

  const dayDisabled = (day: number): boolean => {
    // Compare at day granularity against the min/max day.
    const dv = view.y * 10000 + view.mo * 100 + day;
    if (minP && dv < minP.y * 10000 + minP.mo * 100 + minP.d) return true;
    if (maxP && dv > maxP.y * 10000 + maxP.mo * 100 + maxP.d) return true;
    return false;
  };

  const isSelected = (day: number): boolean =>
    !!parsed && parsed.y === view.y && parsed.mo === view.mo && parsed.d === day;

  const isToday = (day: number): boolean => {
    const n = new Date();
    return n.getFullYear() === view.y && n.getMonth() === view.mo && n.getDate() === day;
  };

  const commit = (next: Parts) => {
    onChange(clamp(build(next), min, max));
  };

  const pickDay = (day: number) => {
    // Keep the current time if set, else default to 00:00.
    const base: Parts = parsed ?? { y: view.y, mo: view.mo, d: day, hh: 0, mm: 0 };
    commit({ ...base, y: view.y, mo: view.mo, d: day });
  };

  // Base for a time-only change when no date is chosen yet — anchor to the
  // shown month's first day so the time is applied to a valid date.
  const timeBase = (): Parts => parsed ?? { y: view.y, mo: view.mo, d: 1, hh: 0, mm: 0 };
  const setHour = (h: string) => commit({ ...timeBase(), hh: Number(h) });
  const setMinute = (m: string) => commit({ ...timeBase(), mm: Number(m) });

  const gotoMonth = (delta: number) => {
    setView((v) => {
      const d = new Date(v.y, v.mo + delta, 1);
      return { y: d.getFullYear(), mo: d.getMonth() };
    });
  };

  const display = formatDisplay(value);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        id={id}
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => !disabled && setOpen((o) => !o)}
        className={cn(
          'flex h-10 w-full items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--input)] px-3 text-sm text-[var(--foreground)] transition-colors',
          'hover:border-[var(--primary-400)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-600)]',
          'disabled:cursor-not-allowed disabled:opacity-50',
          className
        )}
      >
        <FiCalendar className="h-4 w-4 flex-shrink-0 text-[var(--muted-foreground)]" aria-hidden="true" />
        <span className={cn('flex-1 truncate text-left', !display && 'text-[var(--muted-foreground)]')}>
          {display || placeholder}
        </span>
        {display && (
          <FiX
            className="h-4 w-4 flex-shrink-0 text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            aria-hidden="true"
            onClick={(e) => {
              e.stopPropagation();
              onChange('');
            }}
          />
        )}
      </button>

      {open &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={menuRef}
            role="dialog"
            aria-label="Choose date and time"
            className="fixed z-[60] w-[268px] rounded-xl border border-[var(--border)] bg-[var(--card)] p-3 shadow-lg"
            style={{ top: pos.top, left: pos.left }}
          >
            {/* Month header */}
            <div className="mb-2 flex items-center justify-between">
              <button
                type="button"
                onClick={() => gotoMonth(-1)}
                aria-label="Previous month"
                className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)]"
              >
                <FiChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-sm font-semibold text-[var(--foreground)]">
                {MONTHS[view.mo]} {view.y}
              </span>
              <button
                type="button"
                onClick={() => gotoMonth(1)}
                aria-label="Next month"
                className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)]"
              >
                <FiChevronRight className="h-4 w-4" />
              </button>
            </div>

            {/* Weekday row */}
            <div className="grid grid-cols-7 gap-0.5">
              {WEEKDAYS.map((w) => (
                <div
                  key={w}
                  className="py-1 text-center text-[11px] font-medium text-[var(--muted-foreground)]"
                >
                  {w}
                </div>
              ))}
            </div>

            {/* Day grid */}
            <div className="grid grid-cols-7 gap-0.5">
              {grid.map((day, i) => {
                if (day === null) return <div key={`e-${i}`} />;
                const off = dayDisabled(day);
                const sel = isSelected(day);
                const tod = isToday(day);
                return (
                  <button
                    key={day}
                    type="button"
                    disabled={off}
                    onClick={() => pickDay(day)}
                    aria-current={tod ? 'date' : undefined}
                    className={cn(
                      'h-8 rounded-md text-sm transition-colors',
                      off && 'cursor-not-allowed text-[var(--muted-foreground)]/40',
                      !off && !sel && 'text-[var(--foreground)] hover:bg-[var(--muted)]',
                      // Today: ring outline (unless it's the selected day, which is filled).
                      tod && !sel && 'font-semibold ring-1 ring-inset ring-[var(--primary-500)]',
                      sel && 'bg-[var(--primary-600)] font-semibold text-white'
                    )}
                  >
                    {day}
                  </button>
                );
              })}
            </div>

            {/* Time + actions */}
            <div className="mt-3 flex items-center justify-between gap-2 border-t border-[var(--border)] pt-3">
              <div className="flex items-center gap-1.5 text-xs text-[var(--muted-foreground)]">
                <span>Time</span>
                <StyledSelect
                  className="w-[62px]"
                  value={parsed ? pad(parsed.hh) : ''}
                  onChange={setHour}
                  placeholder="HH"
                  aria-label="Hour"
                >
                  {HOURS.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </StyledSelect>
                <span className="text-[var(--muted-foreground)]">:</span>
                <StyledSelect
                  className="w-[62px]"
                  value={parsed ? pad(parsed.mm) : ''}
                  onChange={setMinute}
                  placeholder="MM"
                  aria-label="Minute"
                >
                  {MINUTES.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </StyledSelect>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md bg-[var(--primary-600)] px-3 py-1.5 text-xs font-medium text-white hover:bg-[var(--primary-700)]"
              >
                Done
              </button>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}

export default DateTimeField;
