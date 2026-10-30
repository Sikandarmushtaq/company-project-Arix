'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { FiMoreHorizontal, FiX } from 'react-icons/fi';
import { cn } from '@/lib/utils/cn';
import type { NavItem } from './Sidebar';
import { useVisibleNavItems } from './useVisibleNavItems';

interface MobileBottomNavProps {
  items: NavItem[];
  /**
   * hrefs to surface as primary tabs in the bar (in order). Anything not listed
   * still appears in the "More" sheet. Defaults to the first 4 items.
   */
  primaryHrefs?: string[];
}

/** Active-path check matching the desktop Sidebar's logic. */
function useIsActive(items: NavItem[]) {
  const pathname = usePathname();
  return (href: string) => {
    const matches = pathname === href || pathname.startsWith(`${href}/`);
    const hasMoreSpecific = items.some(
      (o) =>
        o.href !== href &&
        o.href.startsWith(`${href}/`) &&
        (pathname === o.href || pathname.startsWith(`${o.href}/`))
    );
    return matches && !hasMoreSpecific;
  };
}

/**
 * Mobile-only bottom navigation. Hidden at `md` and up (the desktop Sidebar
 * takes over). Shows up to 4 primary destinations plus a "More" button that
 * opens a bottom sheet with the full menu. Clears the Android gesture bar via
 * the `pb-safe-nav` safe-area utility.
 */
export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  items: allItems,
  primaryHrefs,
}) => {
  const items = useVisibleNavItems(allItems);
  const [sheetOpen, setSheetOpen] = useState(false);
  const isActive = useIsActive(items);

  const defaults = ['/phone', '/phone/messages', '/phone/contacts', '/phone/history'];
  const wanted = primaryHrefs ?? defaults;
  const primary = wanted
    .map((href) => items.find((i) => i.href === href))
    .filter((i): i is NavItem => Boolean(i))
    .slice(0, 4);
  // Fallback: if none matched, just take the first four items.
  const primaryItems = primary.length ? primary : items.slice(0, 4);
  const moreActive = !primaryItems.some((i) => isActive(i.href));

  const tabClass = (active: boolean) =>
    cn(
      'flex flex-1 flex-col items-center justify-center gap-0.5 min-h-[56px] px-1 rounded-lg transition-colors',
      active
        ? 'text-[var(--foreground)]'
        : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
    );

  return (
    <>
      <nav
        className="md:hidden shrink-0 border-t border-[var(--border)] bg-[var(--card)] px-1 pt-1 pb-safe-nav flex items-stretch gap-1"
        aria-label="Primary"
      >
        {primaryItems.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={tabClass(active)}
            >
              <span className="relative" aria-hidden="true">
                {item.icon}
                {item.badge !== undefined && (
                  <span className="absolute -right-2 -top-1.5 min-w-4 rounded-full bg-[var(--coral)] px-1 text-[10px] font-semibold leading-4 text-white">
                    {item.badge}
                  </span>
                )}
              </span>
              <span className="text-[10px] font-medium leading-tight">{item.label}</span>
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={sheetOpen}
          className={tabClass(moreActive && sheetOpen)}
        >
          <FiMoreHorizontal className="w-5 h-5" aria-hidden="true" />
          <span className="text-[10px] font-medium leading-tight">More</span>
        </button>
      </nav>

      {/* "More" bottom sheet — full menu */}
      {sheetOpen && (
        <div
          className="md:hidden fixed inset-0 z-50 flex flex-col justify-end"
          role="dialog"
          aria-modal="true"
          aria-label="All navigation"
        >
          <button
            type="button"
            aria-label="Close menu"
            className="absolute inset-0 bg-black/50"
            onClick={() => setSheetOpen(false)}
          />
          <div className="relative max-h-[80dvh] overflow-y-auto rounded-t-2xl border-t border-[var(--border)] bg-[var(--card)] pb-safe">
            <div className="sticky top-0 flex items-center justify-between border-b border-[var(--border)] bg-[var(--card)] px-4 py-3">
              <span className="font-semibold text-[var(--foreground)]">Menu</span>
              <button
                type="button"
                onClick={() => setSheetOpen(false)}
                aria-label="Close"
                className="rounded-lg p-2 text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
              >
                <FiX className="w-5 h-5" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2 p-3">
              {items.map((item) => {
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setSheetOpen(false)}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'flex items-center gap-3 rounded-xl px-3 py-3 transition-colors',
                      active
                        ? 'bg-[var(--primary-600)] text-white'
                        : 'bg-[var(--muted)]/40 text-[var(--foreground)] hover:bg-[var(--muted)]'
                    )}
                  >
                    <span className="flex-shrink-0" aria-hidden="true">
                      {item.icon}
                    </span>
                    <span className="flex-1 text-sm font-medium">{item.label}</span>
                    {item.badge !== undefined && (
                      <span
                        className={cn(
                          'rounded-full px-2 py-0.5 text-xs font-semibold',
                          active
                            ? 'bg-white/20 text-white'
                            : 'bg-[var(--primary-100)] text-[var(--foreground)] dark:bg-[var(--primary-900)] dark:text-[var(--primary-300)]'
                        )}
                      >
                        {item.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
