'use client';

/**
 * DataList — the shared "roomy card list" used across every admin tab.
 *
 * Replaces the old dense 11-column tables (a wall of pills + dots at equal
 * weight, hard to scan). Design principles (Linear/Stripe/Vercel, 2026):
 *   - ONE anchor per row: an avatar monogram + a bold title + a muted subtitle.
 *   - Color = STATE ONLY: a single calm status badge, never a rainbow of pills.
 *   - Secondary info as quiet "meta chips" (Org · Ext · Role …).
 *   - Row actions stay out of the way until hover (or focus / touch).
 *   - Considered loading (skeleton) and empty states.
 *
 * Each page configures it with small accessor functions, so all lists look and
 * behave the same while showing their own data.
 *
 * @module components/ui/data-list/DataList
 */

import React from 'react';
import { cn } from '@/lib/utils/cn';

export type StatusTone = 'success' | 'neutral' | 'danger' | 'warning' | 'info';

export interface MetaChip {
  /** Optional small leading icon. */
  icon?: React.ReactNode;
  /** Optional muted label shown before the value (e.g. "Ext"). */
  label?: string;
  value: React.ReactNode;
  /** Render the value in a monospace face (IDs, extensions, phone numbers). */
  mono?: boolean;
}

// ── Avatar monogram ──────────────────────────────────────────────────────────
// Deterministic, low-saturation tint per name so rows get a stable visual anchor
// without a loud rainbow. Readable in both themes (mid-tone bg, white text).
const AVATAR_HUES = [210, 260, 330, 20, 45, 160, 190, 285]; // calm spread

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function Avatar({
  name,
  size = 40,
  className,
}: {
  name?: string | null;
  size?: number;
  className?: string;
}) {
  const label = (name || '').trim() || '?';
  const hue = AVATAR_HUES[hashString(label) % AVATAR_HUES.length];
  return (
    <div
      aria-hidden="true"
      className={cn('flex flex-shrink-0 items-center justify-center rounded-full font-semibold', className)}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.38,
        background: `hsl(${hue} 45% 42%)`,
        color: '#fff',
      }}
    >
      {initialsOf(label)}
    </div>
  );
}

// ── Status badge (color = state only) ────────────────────────────────────────
const TONE_STYLES: Record<StatusTone, { dot: string; text: string; ring: string }> = {
  success: { dot: 'bg-emerald-500', text: 'text-emerald-700 dark:text-emerald-400', ring: 'ring-emerald-500/20' },
  danger: { dot: 'bg-red-500', text: 'text-red-700 dark:text-red-400', ring: 'ring-red-500/20' },
  warning: { dot: 'bg-amber-500', text: 'text-amber-700 dark:text-amber-400', ring: 'ring-amber-500/20' },
  info: { dot: 'bg-blue-500', text: 'text-blue-700 dark:text-blue-400', ring: 'ring-blue-500/20' },
  neutral: { dot: 'bg-neutral-400', text: 'text-[var(--muted-foreground)]', ring: 'ring-black/5 dark:ring-white/10' },
};

export function StatusBadge({ tone, label }: { tone: StatusTone; label: string }) {
  const s = TONE_STYLES[tone];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset',
        s.text,
        s.ring
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', s.dot)} aria-hidden="true" />
      {label}
    </span>
  );
}

// ── Meta chips row ───────────────────────────────────────────────────────────
function MetaRow({ chips }: { chips: MetaChip[] }) {
  const shown = chips.filter((c) => c.value !== null && c.value !== undefined && c.value !== '');
  if (shown.length === 0) return null;
  return (
    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[var(--muted-foreground)]">
      {shown.map((c, i) => (
        <React.Fragment key={i}>
          {i > 0 && <span className="text-[var(--border)]" aria-hidden="true">·</span>}
          <span className="inline-flex items-center gap-1">
            {c.icon}
            {c.label && <span className="opacity-70">{c.label}</span>}
            <span className={cn('text-[var(--foreground)]/80', c.mono && 'font-mono')}>{c.value}</span>
          </span>
        </React.Fragment>
      ))}
    </div>
  );
}

// ── DataList ─────────────────────────────────────────────────────────────────
export interface DataListProps<T> {
  items: T[];
  getRowId: (item: T) => string | number;

  /** Name used for the monogram avatar. Return null to hide the avatar. */
  avatarName?: (item: T) => string | null;
  title: (item: T) => React.ReactNode;
  subtitle?: (item: T) => React.ReactNode;
  meta?: (item: T) => MetaChip[];
  status?: (item: T) => { tone: StatusTone; label: string } | null;
  /** Right-aligned actions (edit / kebab). Emphasized on row hover/focus. */
  actions?: (item: T) => React.ReactNode;
  onRowClick?: (item: T) => void;

  // Selection (optional)
  selectable?: boolean;
  selectedIds?: Set<string | number>;
  onToggleRow?: (id: string | number, selected: boolean) => void;
  onToggleAll?: (selected: boolean) => void;

  // Toolbar rendered above the list (search, filters, bulk actions, …)
  toolbar?: React.ReactNode;
  /** Slot shown in the selection strip when 1+ rows are selected. */
  bulkBar?: React.ReactNode;

  // States
  loading?: boolean;
  skeletonRows?: number;
  emptyTitle?: string;
  emptyHint?: string;
  emptyIcon?: React.ReactNode;

  footer?: React.ReactNode;
  className?: string;
}

function SkeletonCard() {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--card)] p-3.5">
      <div className="h-10 w-10 flex-shrink-0 animate-pulse rounded-full bg-[var(--muted)]" />
      <div className="flex-1 space-y-2">
        <div className="h-3.5 w-40 animate-pulse rounded bg-[var(--muted)]" />
        <div className="h-3 w-56 animate-pulse rounded bg-[var(--muted)]" />
      </div>
      <div className="h-6 w-16 animate-pulse rounded-full bg-[var(--muted)]" />
    </div>
  );
}

export function DataList<T>({
  items,
  getRowId,
  avatarName,
  title,
  subtitle,
  meta,
  status,
  actions,
  onRowClick,
  selectable = false,
  selectedIds,
  onToggleRow,
  onToggleAll,
  toolbar,
  bulkBar,
  loading = false,
  skeletonRows = 6,
  emptyTitle = 'Nothing here yet',
  emptyHint,
  emptyIcon,
  footer,
  className,
}: DataListProps<T>) {
  const selected = selectedIds ?? new Set<string | number>();
  const selectedCount = selected.size;
  const allSelected = items.length > 0 && items.every((it) => selected.has(getRowId(it)));
  const someSelected = items.some((it) => selected.has(getRowId(it)));

  return (
    <div className={cn('space-y-3', className)}>
      {toolbar}

      {/* Selection strip — only when selectable. Shows select-all + bulk slot. */}
      {selectable && (items.length > 0 || selectedCount > 0) && (
        <div className="flex min-h-[36px] items-center justify-between gap-3 px-1">
          <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-[var(--muted-foreground)]">
            <input
              type="checkbox"
              checked={allSelected}
              ref={(el) => {
                if (el) el.indeterminate = someSelected && !allSelected;
              }}
              onChange={(e) => onToggleAll?.(e.target.checked)}
              className="h-4 w-4 rounded border-[var(--border)] accent-[var(--primary-600)]"
              aria-label="Select all"
            />
            {selectedCount > 0 ? (
              <span className="font-medium text-[var(--foreground)]">{selectedCount} selected</span>
            ) : (
              <span>Select all</span>
            )}
          </label>
          {selectedCount > 0 && bulkBar}
        </div>
      )}

      {/* Body */}
      {loading && items.length === 0 ? (
        <div className="space-y-2">
          {Array.from({ length: skeletonRows }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--border)] py-16 text-center">
          {emptyIcon && <div className="text-[var(--muted-foreground)]">{emptyIcon}</div>}
          <p className="font-medium text-[var(--foreground)]">{emptyTitle}</p>
          {emptyHint && <p className="text-sm text-[var(--muted-foreground)]">{emptyHint}</p>}
        </div>
      ) : (
        <ul className="space-y-2" role="list">
          {items.map((item) => {
            const id = getRowId(item);
            const isSelected = selected.has(id);
            const st = status?.(item) ?? null;
            const clickable = !!onRowClick;
            return (
              <li key={id}>
                <div
                  className={cn(
                    'group relative flex items-center gap-3 rounded-xl border bg-[var(--card)] p-3.5 transition-all',
                    isSelected
                      ? 'border-[var(--primary-600)] ring-1 ring-[var(--primary-600)]/30'
                      : 'border-[var(--border)] hover:border-[var(--muted-foreground)]/30 hover:shadow-sm',
                    clickable &&
                      'cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary-600)]'
                  )}
                  onClick={clickable ? () => onRowClick?.(item) : undefined}
                  role={clickable ? 'button' : undefined}
                  tabIndex={clickable ? 0 : undefined}
                  onKeyDown={
                    clickable
                      ? (e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            onRowClick?.(item);
                          }
                        }
                      : undefined
                  }
                >
                  {selectable && (
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => onToggleRow?.(id, e.target.checked)}
                      className={cn(
                        'h-4 w-4 flex-shrink-0 rounded border-[var(--border)] accent-[var(--primary-600)] transition-opacity',
                        isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 focus:opacity-100'
                      )}
                      aria-label="Select row"
                    />
                  )}

                  {avatarName && <Avatar name={avatarName(item)} />}

                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold text-[var(--foreground)]">{title(item)}</div>
                    {subtitle && (
                      <div className="truncate text-sm text-[var(--muted-foreground)]">{subtitle(item)}</div>
                    )}
                    {meta && <MetaRow chips={meta(item)} />}
                  </div>

                  <div className="flex flex-shrink-0 items-center gap-2 pl-2">
                    {st && <StatusBadge tone={st.tone} label={st.label} />}
                    {actions && (
                      <div
                        className="flex items-center gap-1 opacity-60 transition-opacity group-hover:opacity-100 focus-within:opacity-100"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {actions(item)}
                      </div>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {footer}
    </div>
  );
}
