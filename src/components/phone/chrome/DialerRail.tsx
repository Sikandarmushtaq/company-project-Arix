'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { FiMoreHorizontal } from 'react-icons/fi';
import { type NavItem, useVisibleNavItems } from '@/components/layout';

/**
 * DialerRail — Phase 1 left rail (new UI). Labeled icons, RingCentral-style.
 * Reuses `userNavItems` (SSOT for nav) + pathname for active state. Primary
 * channels stay visible; the rest live under "More". Not a fork of the shared
 * Sidebar — a distinct, phone-only component.
 */
const PRIMARY = [
  '/phone',
  '/phone/history',
  '/phone/messages',
  '/phone/bulk-sms',
  '/phone/whatsapp',
  '/phone/contacts',
];
// Support sits at the bottom with Settings (utility items), not under "More".
const BOTTOM = ['/phone/support', '/phone/settings'];

function useIsActive() {
  const pathname = usePathname();
  return (href: string) =>
    href === '/phone' ? pathname === '/phone' : pathname === href || pathname.startsWith(href + '/');
}

function RailLink({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <Link href={item.href} className="nx-rail-item" data-active={active} title={item.label}>
      <span className="w-6 h-6 grid place-items-center [&_svg]:w-[22px] [&_svg]:h-[22px]">
        {item.icon}
      </span>
      <span>{item.label}</span>
    </Link>
  );
}

export function DialerRail({ items: allItems }: { items: NavItem[] }) {
  const items = useVisibleNavItems(allItems);
  const isActive = useIsActive();
  const [moreOpen, setMoreOpen] = React.useState(false);
  const moreRef = React.useRef<HTMLDivElement>(null);

  const primary = PRIMARY.map((h) => items.find((i) => i.href === h)).filter(Boolean) as NavItem[];
  const bottom = BOTTOM.map((h) => items.find((i) => i.href === h)).filter(Boolean) as NavItem[];
  const more = items.filter((i) => !PRIMARY.includes(i.href) && !BOTTOM.includes(i.href));
  const moreActive = more.some((i) => isActive(i.href));

  React.useEffect(() => {
    if (!moreOpen) return;
    const onDown = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) setMoreOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [moreOpen]);

  return (
    <nav className="nx-rail hidden md:flex flex-col w-[80px] shrink-0 border-r border-[var(--border)] bg-[var(--card)] py-1.5 overflow-visible">
      {primary.map((item) => (
        <RailLink key={item.href} item={item} active={isActive(item.href)} />
      ))}

      {/* More */}
      <div ref={moreRef} className="relative">
        <button
          type="button"
          className="nx-rail-item w-full"
          data-active={moreActive || moreOpen}
          onClick={() => setMoreOpen((v) => !v)}
          aria-expanded={moreOpen}
          aria-haspopup="menu"
        >
          <span className="w-6 h-6 grid place-items-center">
            <FiMoreHorizontal className="w-[22px] h-[22px]" />
          </span>
          <span>More</span>
        </button>

        {moreOpen && (
          <div
            role="menu"
            className="absolute left-[72px] top-0 z-50 min-w-[200px] rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-xl p-1.5 animate-[fadeIn_.12s_ease]"
          >
            {more.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                role="menuitem"
                onClick={() => setMoreOpen(false)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold text-[var(--foreground)] hover:bg-[var(--muted)] transition-colors data-[active=true]:text-[var(--foreground)]"
                data-active={isActive(item.href)}
              >
                <span className="w-5 h-5 grid place-items-center [&_svg]:w-5 [&_svg]:h-5">
                  {item.icon}
                </span>
                {item.label}
              </Link>
            ))}
          </div>
        )}
      </div>

      <div className="flex-1" />

      {bottom.map((item) => (
        <RailLink key={item.href} item={item} active={isActive(item.href)} />
      ))}
    </nav>
  );
}
