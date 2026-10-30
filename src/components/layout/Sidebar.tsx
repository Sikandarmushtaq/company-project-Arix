'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils/cn';
import { FiChevronLeft, FiChevronRight, FiChevronDown, FiStar } from 'react-icons/fi';

const PINNED_STORAGE_KEY = 'sidebar:pinnedHrefs';

export interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  badge?: string | number;
  /**
   * Extra path prefixes that also mark this item active (and open its section) —
   * e.g. a page launched from here that has no nav entry of its own. Prevents the
   * root item from wrongly lighting up on an unowned sub-route.
   */
  matchPaths?: string[];
}

/** A titled group of nav items. Empty groups are not rendered. */
export interface NavSection {
  title: string;
  items: NavItem[];
}

interface SidebarProps {
  /** Flat list (legacy). Use `sections` for grouped navigation. */
  items?: NavItem[];
  /** Grouped navigation. Takes precedence over `items`; empty groups are skipped. */
  sections?: NavSection[];
  title: string;
  logo?: React.ReactNode;
  collapsed?: boolean;
  onToggle?: () => void;
  footer?: React.ReactNode;
}

export const Sidebar: React.FC<SidebarProps> = ({
  items,
  sections,
  title,
  logo,
  collapsed = false,
  onToggle,
  footer,
}) => {
  const pathname = usePathname();

  // The full flat list (across all groups) drives active-state detection so a
  // more-specific match in ANY group still wins. Memoized so downstream memos
  // (pinnedItems) stay stable across renders.
  const allItems: NavItem[] = useMemo(
    () => (sections ? sections.flatMap((s) => s.items) : (items ?? [])),
    [sections, items]
  );
  const visibleSections = useMemo(
    () => sections?.filter((s) => s.items.length > 0) ?? [],
    [sections]
  );

  // Longest matching path-prefix length for an item — its href OR any of its
  // matchPaths; -1 when nothing matches. Longest match wins, so a specific item
  // (or one claiming a sub-route via matchPaths) beats the root's bare href.
  const matchLen = useCallback(
    (item: NavItem): number => {
      let best = -1;
      for (const p of [item.href, ...(item.matchPaths ?? [])]) {
        if (pathname === p || pathname.startsWith(`${p}/`)) best = Math.max(best, p.length);
      }
      return best;
    },
    [pathname]
  );

  // The section that contains the current route — the one whose item has the
  // LONGEST path match, not merely the first section with any match. This matters
  // because the Dashboard item's href ('/admin') is a prefix of every admin route,
  // so a naive "first section with a match" always resolves to Overview and, on
  // navigation, collapses whatever dropdown you'd opened. Longest-match picks the
  // real active page's section, so its dropdown stays open across page clicks.
  const activeSectionTitle = useMemo(() => {
    let bestTitle: string | undefined;
    let bestLen = -1;
    for (const s of visibleSections) {
      for (const it of s.items) {
        const len = matchLen(it);
        if (len > bestLen) {
          bestLen = len;
          bestTitle = s.title;
        }
      }
    }
    return bestTitle ?? visibleSections[0]?.title;
  }, [visibleSections, matchLen]);

  // ---- Single-open accordion --------------------------------------------------
  // Only ONE section is open at a time; opening another closes the previous one.
  // Computed during render (no effect): a manual toggle is scoped to the pathname
  // it was made on, so the open section defaults to — and re-derives from — the
  // active route. Navigating opens the section you land in and closes the rest;
  // a manual toggle holds only while you stay on that page.
  const [manualOpen, setManualOpen] = useState<{ path: string; section: string | null } | null>(
    null
  );
  const openSection =
    manualOpen && manualOpen.path === pathname ? manualOpen.section : (activeSectionTitle ?? null);
  const toggleSection = (sectionTitle: string) =>
    setManualOpen({ path: pathname, section: openSection === sectionTitle ? null : sectionTitle });

  // ---- Pinned pages -----------------------------------------------------------
  // Star any page to pin it to a "Pinned" group at the top for one-click access.
  // Persisted per-viewer in localStorage.
  // Hydrate pins AFTER mount (not a lazy useState initializer) so the first
  // client render matches the server's (empty) render — avoids a hydration
  // mismatch. localStorage is client-only, so this is the correct SSR-safe shape.
  const [pinned, setPinned] = useState<string[]>([]);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(PINNED_STORAGE_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time SSR-safe hydration from localStorage
      if (raw) setPinned(JSON.parse(raw));
    } catch {
      /* storage unavailable */
    }
  }, []);
  const isPinned = useCallback((href: string) => pinned.includes(href), [pinned]);
  const togglePin = useCallback((href: string) => {
    setPinned((prev) => {
      const next = prev.includes(href) ? prev.filter((h) => h !== href) : [...prev, href];
      try {
        localStorage.setItem(PINNED_STORAGE_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);
  // Resolve pinned hrefs to items (dropping any that are no longer visible).
  const pinnedItems = useMemo(
    () => pinned.map((h) => allItems.find((it) => it.href === h)).filter(Boolean) as NavItem[],
    [pinned, allItems]
  );

  const renderItem = (item: NavItem) => {
    // Active if this item matches the path AND no other item matches more
    // specifically (longer prefix). matchPaths lets an item claim sub-routes it
    // owns (e.g. Users owns /admin/accounts), so the root never wrongly wins.
    const myLen = matchLen(item);
    const isActive =
      myLen >= 0 && !allItems.some((other) => other.href !== item.href && matchLen(other) > myLen);
    const pinnedNow = isPinned(item.href);

    return (
      <div key={item.href} className="group relative">
        <Link
          href={item.href}
          // In dev, prefetching every sidebar link compiles all routes on-demand
          // at once → a slow compile storm. Disable prefetch in dev only.
          prefetch={process.env.NODE_ENV === 'development' ? false : undefined}
          aria-current={isActive ? 'page' : undefined}
          className={cn(
            'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200',
            isActive
              ? 'bg-white/10 text-white font-medium'
              : 'text-neutral-400 hover:bg-white/5 hover:text-white',
            collapsed && 'justify-center px-2'
          )}
          title={collapsed ? item.label : undefined}
        >
          <span className="flex-shrink-0" aria-hidden="true">
            {item.icon}
          </span>
          {!collapsed && (
            <>
              <span className="flex-1 truncate font-medium">{item.label}</span>
              {item.badge !== undefined && (
                <span
                  className={cn(
                    'px-2 py-0.5 text-xs font-semibold rounded-full',
                    isActive ? 'bg-white/20 text-white' : 'bg-white/10 text-neutral-300'
                  )}
                  aria-label={`${item.badge} notifications`}
                >
                  {item.badge}
                </span>
              )}
            </>
          )}
        </Link>

        {/* Pin / star toggle — appears on hover, stays visible when pinned.
            Only in grouped navs, where the "Pinned" group at the top exists. */}
        {!collapsed && !!sections && (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              togglePin(item.href);
            }}
            aria-label={pinnedNow ? `Unpin ${item.label}` : `Pin ${item.label} to top`}
            title={pinnedNow ? 'Unpin' : 'Pin to top'}
            className={cn(
              'absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md p-1 transition-opacity',
              pinnedNow
                ? 'opacity-100 text-amber-400 hover:text-amber-300'
                : 'opacity-0 group-hover:opacity-100 text-neutral-500 hover:text-amber-400 focus:opacity-100'
            )}
          >
            <FiStar className={cn('w-3.5 h-3.5', pinnedNow && 'fill-current')} aria-hidden="true" />
          </button>
        )}
      </div>
    );
  };

  return (
    <aside
      className={cn(
        // Hidden on mobile (the MobileBottomNav takes over); flex column on md+.
        // h-dvh (not h-screen) so it tracks the real viewport on mobile browsers.
        // Always-dark panel (independent of the app light/dark theme) — a clean
        // near-black sidebar with light text, like Linear/Vercel.
        'hidden md:flex h-dvh bg-[#101114] border-r border-white/10 flex-col transition-all duration-300 sticky top-0',
        collapsed ? 'w-16' : 'w-64'
      )}
    >
      {/* Header */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-white/10">
        {!collapsed && (
          <div className="flex min-w-0 items-center gap-3">
            {logo}
            <span className="truncate text-lg font-bold text-white" title={title}>
              {title}
            </span>
          </div>
        )}
        {collapsed && logo && <div className="mx-auto">{logo}</div>}
        {onToggle && (
          <button
            onClick={onToggle}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-expanded={!collapsed}
            className={cn(
              'p-1.5 rounded-lg hover:bg-white/10 transition-colors text-neutral-400 hover:text-white',
              collapsed && 'mx-auto'
            )}
          >
            {collapsed ? (
              <FiChevronRight className="w-4 h-4" aria-hidden="true" />
            ) : (
              <FiChevronLeft className="w-4 h-4" aria-hidden="true" />
            )}
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-3 space-y-1" aria-label="Main navigation">
        {/* Pinned group (top) — only in expanded mode with grouped nav. */}
        {sections && !collapsed && pinnedItems.length > 0 && (
          <div className="mb-2 pb-2 border-b border-white/10">
            <div className="flex items-center gap-1.5 px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-amber-400/80 select-none">
              <FiStar className="w-3 h-3 fill-current" aria-hidden="true" />
              Pinned
            </div>
            <div className="space-y-1">{pinnedItems.map(renderItem)}</div>
          </div>
        )}

        {sections
          ? visibleSections.map((section, i) => {
              // Icon-collapsed: no room for headers/accordion — show every item
              // with a divider between groups.
              if (collapsed) {
                return (
                  <div key={section.title} className={cn('space-y-1', i > 0 && 'pt-1')}>
                    {i > 0 && (
                      <div className="mx-2 mb-1 border-t border-white/10" aria-hidden="true" />
                    )}
                    {section.items.map(renderItem)}
                  </div>
                );
              }
              const open = openSection === section.title;
              return (
                <div key={section.title} className={cn(i > 0 && 'pt-2')}>
                  <button
                    type="button"
                    onClick={() => toggleSection(section.title)}
                    aria-expanded={open}
                    className="flex w-full items-center justify-between rounded-lg px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-500 hover:text-neutral-300 transition-colors select-none"
                  >
                    <span>{section.title}</span>
                    <FiChevronDown
                      className={cn(
                        'w-3.5 h-3.5 transition-transform duration-200',
                        open ? 'rotate-0' : '-rotate-90'
                      )}
                      aria-hidden="true"
                    />
                  </button>
                  {open && <div className="mt-1 space-y-1">{section.items.map(renderItem)}</div>}
                </div>
              );
            })
          : allItems.map(renderItem)}
      </nav>

      {/* Footer */}
      {footer && <div className="p-3 border-t border-white/10">{footer}</div>}
    </aside>
  );
};
