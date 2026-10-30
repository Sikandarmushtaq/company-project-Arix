'use client';

/**
 * DataView — the shared multi-view list used across every admin tab.
 *
 * ONE data source, three ways to look at it, chosen per person and remembered:
 *   - Cards  → roomy avatar cards (calm scanning, great on mobile)   [DataList]
 *   - Table  → refined dense grid (power users; color = state only)
 *   - Board  → columns grouped by a field (status/role) for pipelines
 *
 * Plus a toolbar with search, facet filters, and sort. The active view +
 * filters + sort persist per `viewId` in localStorage, so each list reopens the
 * way you left it (a lightweight "saved view"). All views share one row model
 * (avatar/title/subtitle/meta/status/actions) so a page configures it once.
 *
 * SCOPE: facet filters, sort, and board grouping run CLIENT-SIDE over the
 * `items` you pass in. `search` is a controlled input the page wires to its own
 * (usually server-side) query. So for a page that loads all its rows at once,
 * everything is global; for a SERVER-PAGINATED page they act on the loaded page
 * only — fine for single-page lists, but wire server-side params before
 * offering filters/sort/board on a list that spans many pages.
 *
 * @module components/ui/data-list/DataView
 */

import React, { useEffect, useMemo, useState } from 'react';
import { FiGrid, FiList, FiColumns, FiChevronDown, FiFilter, FiSearch } from 'react-icons/fi';
import { cn } from '@/lib/utils/cn';
import { Input } from '@/components/ui/input';
import { Avatar, StatusBadge, DataList, type MetaChip, type StatusTone } from './DataList';

export type ViewMode = 'cards' | 'table' | 'board';

export interface ViewColumn<T> {
  key: string;
  header: string;
  cell: (item: T) => React.ReactNode;
  mono?: boolean;
  align?: 'left' | 'right' | 'center';
  /** Hide this column on narrow screens (adds `hidden md:table-cell`). */
  secondary?: boolean;
}

export interface FacetFilter<T> {
  key: string;
  label: string;
  /** The value used for matching + as the option list (distinct values are auto-derived if `options` omitted). */
  getValue: (item: T) => string | null | undefined;
  options?: { value: string; label: string }[];
}

export interface SortOption<T> {
  key: string;
  label: string;
  cmp: (a: T, b: T) => number;
}

export interface DataViewProps<T> {
  /** Stable id used to persist the chosen view/filters/sort per viewer. */
  viewId: string;
  items: T[];
  getRowId: (item: T) => string | number;
  loading?: boolean;

  // Shared row model (cards + board; table uses columns)
  avatarName?: (item: T) => string | null;
  title: (item: T) => React.ReactNode;
  subtitle?: (item: T) => React.ReactNode;
  meta?: (item: T) => MetaChip[];
  status?: (item: T) => { tone: StatusTone; label: string } | null;
  actions?: (item: T) => React.ReactNode;
  onRowClick?: (item: T) => void;

  /** Table columns (Table view only). */
  columns: ViewColumn<T>[];
  /** Board grouping (Board view). Returns the column an item belongs to. */
  groupBy?: (item: T) => { key: string; label: string; tone?: StatusTone };

  // Toolbar
  search?: { value: string; onChange: (v: string) => void; placeholder?: string };
  filters?: FacetFilter<T>[];
  sortOptions?: SortOption<T>[];
  toolbarRight?: React.ReactNode;

  // Selection (Cards + Table)
  selectable?: boolean;
  selectedIds?: Set<string | number>;
  onToggleRow?: (id: string | number, selected: boolean) => void;
  onToggleAll?: (selected: boolean) => void;
  bulkBar?: React.ReactNode;

  availableViews?: ViewMode[];
  footer?: React.ReactNode;
  emptyTitle?: string;
  emptyHint?: string;
  emptyIcon?: React.ReactNode;
}

interface PersistedState {
  view?: ViewMode;
  filters?: Record<string, string>;
  sort?: string;
}

function loadPersisted(viewId: string): PersistedState {
  try {
    const raw = localStorage.getItem(`dataview:${viewId}`);
    return raw ? (JSON.parse(raw) as PersistedState) : {};
  } catch {
    return {};
  }
}
function savePersisted(viewId: string, s: PersistedState) {
  try {
    localStorage.setItem(`dataview:${viewId}`, JSON.stringify(s));
  } catch {
    /* storage unavailable */
  }
}

// ── small dropdown ───────────────────────────────────────────────────────────
function Dropdown({
  label,
  active,
  children,
  icon,
}: {
  label: React.ReactNode;
  active?: boolean;
  icon?: React.ReactNode;
  children: (close: () => void) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm transition-colors',
          active
            ? 'border-[var(--primary-600)] text-[var(--foreground)] bg-[var(--primary-600)]/5'
            : 'border-[var(--border)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)]/50'
        )}
      >
        {icon}
        {label}
        <FiChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-50 mt-1 min-w-[180px] rounded-lg border border-[var(--border)] bg-[var(--card)] p-1 shadow-lg">
            {children(() => setOpen(false))}
          </div>
        </>
      )}
    </div>
  );
}

function DropdownItem({
  onClick,
  active,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-center justify-between gap-2 rounded-md px-3 py-1.5 text-left text-sm',
        active ? 'bg-[var(--primary-600)]/10 text-[var(--foreground)]' : 'text-[var(--foreground)] hover:bg-[var(--muted)]'
      )}
    >
      {children}
    </button>
  );
}

const VIEW_META: Record<ViewMode, { icon: React.ReactNode; label: string }> = {
  cards: { icon: <FiGrid className="h-4 w-4" />, label: 'Cards' },
  table: { icon: <FiList className="h-4 w-4" />, label: 'Table' },
  board: { icon: <FiColumns className="h-4 w-4" />, label: 'Board' },
};

export function DataView<T>(props: DataViewProps<T>) {
  const {
    viewId,
    items,
    getRowId,
    loading,
    avatarName,
    title,
    subtitle,
    meta,
    status,
    actions,
    onRowClick,
    columns,
    groupBy,
    search,
    filters = [],
    sortOptions = [],
    toolbarRight,
    selectable,
    selectedIds,
    onToggleRow,
    onToggleAll,
    bulkBar,
    availableViews = ['cards', 'table', 'board'],
    footer,
    emptyTitle,
    emptyHint,
    emptyIcon,
  } = props;

  const [view, setView] = useState<ViewMode>(availableViews[0]);
  const [activeFilters, setActiveFilters] = useState<Record<string, string>>({});
  const [sortKey, setSortKey] = useState<string>('');
  const [hydrated, setHydrated] = useState(false);

  // Hydrate persisted state after mount (SSR-safe).
  useEffect(() => {
    const p = loadPersisted(viewId);
    if (p.view && availableViews.includes(p.view)) setView(p.view);
    if (p.filters) setActiveFilters(p.filters);
    if (p.sort) setSortKey(p.sort);
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-time hydration per viewId
  }, [viewId]);

  useEffect(() => {
    if (hydrated) savePersisted(viewId, { view, filters: activeFilters, sort: sortKey });
  }, [hydrated, viewId, view, activeFilters, sortKey]);

  // Derive facet options when not supplied.
  const facetOptions = useMemo(() => {
    const map: Record<string, { value: string; label: string }[]> = {};
    for (const f of filters) {
      if (f.options) {
        map[f.key] = f.options;
        continue;
      }
      const seen = new Set<string>();
      for (const it of items) {
        const v = f.getValue(it);
        if (v != null && v !== '' && !seen.has(v)) seen.add(v);
      }
      map[f.key] = Array.from(seen).map((v) => ({ value: v, label: v }));
    }
    return map;
  }, [filters, items]);

  // Apply facet filters + sort (client-side, over the current page of items).
  const processed = useMemo(() => {
    let out = items;
    for (const f of filters) {
      const want = activeFilters[f.key];
      if (want) out = out.filter((it) => (f.getValue(it) ?? '') === want);
    }
    const sort = sortOptions.find((s) => s.key === sortKey);
    if (sort) out = [...out].sort(sort.cmp);
    return out;
  }, [items, filters, activeFilters, sortOptions, sortKey]);

  const activeFilterCount = Object.values(activeFilters).filter(Boolean).length;

  // ── Toolbar ────────────────────────────────────────────────────────────────
  const toolbar = (
    <div className="flex flex-wrap items-center gap-2">
      {/* View switcher */}
      {availableViews.length > 1 && (
        <div className="inline-flex rounded-lg border border-[var(--border)] p-0.5">
          {availableViews.map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              aria-pressed={view === v}
              title={VIEW_META[v].label}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors',
                view === v
                  ? 'bg-[var(--primary-600)] text-white'
                  : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
              )}
            >
              {VIEW_META[v].icon}
              <span className="hidden sm:inline">{VIEW_META[v].label}</span>
            </button>
          ))}
        </div>
      )}

      {search && (
        <div className="min-w-[180px] flex-1 sm:max-w-xs">
          <Input
            value={search.value}
            onChange={(e) => search.onChange(e.target.value)}
            placeholder={search.placeholder ?? 'Search…'}
            leftIcon={<FiSearch className="h-4 w-4" aria-hidden="true" />}
            aria-label="Search"
          />
        </div>
      )}

      {filters.map((f) => {
        const val = activeFilters[f.key] ?? '';
        const opts = facetOptions[f.key] ?? [];
        const current = opts.find((o) => o.value === val);
        return (
          <Dropdown
            key={f.key}
            active={!!val}
            icon={<FiFilter className="h-3.5 w-3.5" />}
            label={current ? `${f.label}: ${current.label}` : f.label}
          >
            {(close) => (
              <>
                <DropdownItem
                  active={!val}
                  onClick={() => {
                    setActiveFilters((s) => ({ ...s, [f.key]: '' }));
                    close();
                  }}
                >
                  All
                </DropdownItem>
                {opts.map((o) => (
                  <DropdownItem
                    key={o.value}
                    active={val === o.value}
                    onClick={() => {
                      setActiveFilters((s) => ({ ...s, [f.key]: o.value }));
                      close();
                    }}
                  >
                    {o.label}
                  </DropdownItem>
                ))}
              </>
            )}
          </Dropdown>
        );
      })}

      {sortOptions.length > 0 && (
        <Dropdown
          active={!!sortKey}
          label={sortKey ? `Sort: ${sortOptions.find((s) => s.key === sortKey)?.label}` : 'Sort'}
        >
          {(close) => (
            <>
              <DropdownItem
                active={!sortKey}
                onClick={() => {
                  setSortKey('');
                  close();
                }}
              >
                Default
              </DropdownItem>
              {sortOptions.map((s) => (
                <DropdownItem
                  key={s.key}
                  active={sortKey === s.key}
                  onClick={() => {
                    setSortKey(s.key);
                    close();
                  }}
                >
                  {s.label}
                </DropdownItem>
              ))}
            </>
          )}
        </Dropdown>
      )}

      {activeFilterCount > 0 && (
        <button
          type="button"
          onClick={() => setActiveFilters({})}
          className="text-sm text-[var(--muted-foreground)] underline-offset-2 hover:text-[var(--foreground)] hover:underline"
        >
          Clear filters
        </button>
      )}

      {toolbarRight && <div className="ml-auto flex items-center gap-2">{toolbarRight}</div>}
    </div>
  );

  // ── Views ────────────────────────────────────────────────────────────────
  let body: React.ReactNode;
  if (view === 'cards') {
    body = (
      <DataList
        items={processed}
        getRowId={getRowId}
        avatarName={avatarName}
        title={title}
        subtitle={subtitle}
        meta={meta}
        status={status}
        actions={actions}
        onRowClick={onRowClick}
        selectable={selectable}
        selectedIds={selectedIds}
        onToggleRow={onToggleRow}
        onToggleAll={onToggleAll}
        bulkBar={bulkBar}
        loading={loading}
        emptyTitle={emptyTitle}
        emptyHint={emptyHint}
        emptyIcon={emptyIcon}
      />
    );
  } else if (view === 'table') {
    body = (
      <DataTableView
        items={processed}
        getRowId={getRowId}
        columns={columns}
        status={status}
        actions={actions}
        onRowClick={onRowClick}
        selectable={selectable}
        selectedIds={selectedIds}
        onToggleRow={onToggleRow}
        onToggleAll={onToggleAll}
        bulkBar={bulkBar}
        loading={loading}
        emptyTitle={emptyTitle}
        emptyHint={emptyHint}
      />
    );
  } else {
    body = (
      <DataBoardView
        items={processed}
        getRowId={getRowId}
        groupBy={groupBy}
        avatarName={avatarName}
        title={title}
        subtitle={subtitle}
        meta={meta}
        actions={actions}
        onRowClick={onRowClick}
        loading={loading}
        emptyTitle={emptyTitle}
      />
    );
  }

  return (
    <div className="space-y-3">
      {toolbar}
      {body}
      {footer}
    </div>
  );
}

// ── Table view ───────────────────────────────────────────────────────────────
function DataTableView<T>({
  items,
  getRowId,
  columns,
  status,
  actions,
  onRowClick,
  selectable,
  selectedIds,
  onToggleRow,
  onToggleAll,
  bulkBar,
  loading,
  emptyTitle,
  emptyHint,
}: {
  items: T[];
  getRowId: (item: T) => string | number;
  columns: ViewColumn<T>[];
  status?: (item: T) => { tone: StatusTone; label: string } | null;
  actions?: (item: T) => React.ReactNode;
  onRowClick?: (item: T) => void;
  selectable?: boolean;
  selectedIds?: Set<string | number>;
  onToggleRow?: (id: string | number, selected: boolean) => void;
  onToggleAll?: (selected: boolean) => void;
  bulkBar?: React.ReactNode;
  loading?: boolean;
  emptyTitle?: string;
  emptyHint?: string;
}) {
  const selected = selectedIds ?? new Set<string | number>();
  const allSelected = items.length > 0 && items.every((it) => selected.has(getRowId(it)));
  const someSelected = items.some((it) => selected.has(getRowId(it)));

  if (loading && items.length === 0) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-11 animate-pulse rounded-lg bg-[var(--muted)]" />
        ))}
      </div>
    );
  }
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--border)] py-16 text-center">
        <p className="font-medium text-[var(--foreground)]">{emptyTitle ?? 'Nothing here yet'}</p>
        {emptyHint && <p className="text-sm text-[var(--muted-foreground)]">{emptyHint}</p>}
      </div>
    );
  }

  return (
    <div>
      {selectable && selected.size > 0 && (
        <div className="mb-2 flex items-center justify-between gap-3 rounded-lg bg-[var(--primary-600)]/5 px-3 py-2">
          <span className="text-sm font-medium text-[var(--foreground)]">{selected.size} selected</span>
          {bulkBar}
        </div>
      )}
      <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 bg-[var(--muted)]/60 backdrop-blur">
            <tr className="border-b border-[var(--border)] text-left">
              {selectable && (
                <th className="w-10 px-3 py-2.5">
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
                </th>
              )}
              {columns.map((c) => (
                <th
                  key={c.key}
                  className={cn(
                    'px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]',
                    c.align === 'right' && 'text-right',
                    c.align === 'center' && 'text-center',
                    c.secondary && 'hidden md:table-cell'
                  )}
                >
                  {c.header}
                </th>
              ))}
              {status && (
                <th className="px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
                  Status
                </th>
              )}
              {actions && <th className="w-24 px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => {
              const id = getRowId(item);
              const isSelected = selected.has(id);
              const st = status?.(item) ?? null;
              return (
                <tr
                  key={id}
                  onClick={onRowClick ? () => onRowClick(item) : undefined}
                  className={cn(
                    'group border-b border-[var(--border)] last:border-0 transition-colors',
                    idx % 2 === 1 && 'bg-[var(--muted)]/20',
                    isSelected ? 'bg-[var(--primary-600)]/5' : 'hover:bg-[var(--muted)]/50',
                    onRowClick && 'cursor-pointer'
                  )}
                >
                  {selectable && (
                    <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => onToggleRow?.(id, e.target.checked)}
                        className="h-4 w-4 rounded border-[var(--border)] accent-[var(--primary-600)]"
                        aria-label="Select row"
                      />
                    </td>
                  )}
                  {columns.map((c) => (
                    <td
                      key={c.key}
                      className={cn(
                        'px-3 py-2.5 text-[var(--foreground)]',
                        c.align === 'right' && 'text-right',
                        c.align === 'center' && 'text-center',
                        c.mono && 'font-mono text-[var(--muted-foreground)]',
                        c.secondary && 'hidden md:table-cell'
                      )}
                    >
                      {c.cell(item)}
                    </td>
                  ))}
                  {status && <td className="px-3 py-2.5">{st && <StatusBadge tone={st.tone} label={st.label} />}</td>}
                  {actions && (
                    <td className="px-3 py-2.5 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1 opacity-60 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                        {actions(item)}
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Board view ───────────────────────────────────────────────────────────────
function DataBoardView<T>({
  items,
  getRowId,
  groupBy,
  avatarName,
  title,
  subtitle,
  meta,
  actions,
  onRowClick,
  loading,
  emptyTitle,
}: {
  items: T[];
  getRowId: (item: T) => string | number;
  groupBy?: (item: T) => { key: string; label: string; tone?: StatusTone };
  avatarName?: (item: T) => string | null;
  title: (item: T) => React.ReactNode;
  subtitle?: (item: T) => React.ReactNode;
  meta?: (item: T) => MetaChip[];
  actions?: (item: T) => React.ReactNode;
  onRowClick?: (item: T) => void;
  loading?: boolean;
  emptyTitle?: string;
}) {
  const groups = useMemo(() => {
    const g = new Map<string, { label: string; tone?: StatusTone; items: T[] }>();
    for (const it of items) {
      const grp = groupBy?.(it) ?? { key: 'all', label: 'All' };
      if (!g.has(grp.key)) g.set(grp.key, { label: grp.label, tone: grp.tone, items: [] });
      g.get(grp.key)!.items.push(it);
    }
    return Array.from(g.values());
  }, [items, groupBy]);

  if (loading && items.length === 0) {
    return (
      <div className="flex gap-3 overflow-x-auto">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-64 w-72 flex-shrink-0 animate-pulse rounded-xl bg-[var(--muted)]" />
        ))}
      </div>
    );
  }
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--border)] py-16 text-center">
        <p className="font-medium text-[var(--foreground)]">{emptyTitle ?? 'Nothing here yet'}</p>
      </div>
    );
  }

  const toneDot: Record<StatusTone, string> = {
    success: 'bg-emerald-500',
    danger: 'bg-red-500',
    warning: 'bg-amber-500',
    info: 'bg-blue-500',
    neutral: 'bg-neutral-400',
  };

  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {groups.map((grp) => (
        <div
          key={grp.label}
          className="flex w-72 flex-shrink-0 flex-col rounded-xl border border-[var(--border)] bg-[var(--muted)]/30"
        >
          <div className="flex items-center gap-2 border-b border-[var(--border)] px-3 py-2.5">
            {grp.tone && <span className={cn('h-2 w-2 rounded-full', toneDot[grp.tone])} aria-hidden="true" />}
            <span className="text-sm font-semibold text-[var(--foreground)]">{grp.label}</span>
            <span className="ml-auto rounded-full bg-[var(--card)] px-2 py-0.5 text-xs text-[var(--muted-foreground)]">
              {grp.items.length}
            </span>
          </div>
          <div className="flex max-h-[60vh] flex-col gap-2 overflow-y-auto p-2">
            {grp.items.map((item) => (
              <div
                key={getRowId(item)}
                onClick={onRowClick ? () => onRowClick(item) : undefined}
                className={cn(
                  'group rounded-lg border border-[var(--border)] bg-[var(--card)] p-3 transition-all hover:shadow-sm',
                  onRowClick && 'cursor-pointer'
                )}
              >
                <div className="flex items-center gap-2">
                  {avatarName && <Avatar name={avatarName(item)} size={30} />}
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-[var(--foreground)]">{title(item)}</div>
                    {subtitle && (
                      <div className="truncate text-xs text-[var(--muted-foreground)]">{subtitle(item)}</div>
                    )}
                  </div>
                  {actions && (
                    <div
                      className="opacity-0 transition-opacity group-hover:opacity-100"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {actions(item)}
                    </div>
                  )}
                </div>
                {meta && (
                  <div className="mt-2 flex flex-wrap gap-x-2 gap-y-1 text-xs text-[var(--muted-foreground)]">
                    {meta(item)
                      .filter((c) => c.value !== null && c.value !== undefined && c.value !== '')
                      .map((c, i) => (
                        <span key={i} className="inline-flex items-center gap-1">
                          {c.label && <span className="opacity-70">{c.label}</span>}
                          <span className={cn(c.mono && 'font-mono')}>{c.value}</span>
                        </span>
                      ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
