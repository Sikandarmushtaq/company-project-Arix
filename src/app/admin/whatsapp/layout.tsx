'use client';

/**
 * /admin/whatsapp/* shared layout — tabbed hub for managers.
 *
 * Mirrors /org/whatsapp/* exactly so the experience is identical
 * regardless of which shell the manager works from. Platform admins also
 * land here when managing global WA config; the Groups tab redirects them
 * to Numbers (they don't have agent groups).
 */

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  FiPhone,
  FiUsers,
  FiSettings,
  FiBarChart2,
  FiDollarSign,
  FiFileText,
  FiDisc,
  FiEye,
  FiCreditCard,
} from 'react-icons/fi';
import { FaWhatsapp } from 'react-icons/fa';
import { useAuthStore } from '@/lib/stores/auth';

interface Tab {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  /** When set, only roles in this list see the tab. */
  roles?: Array<'admin' | 'manager'>;
}

const TABS: Tab[] = [
  { label: 'Numbers', href: '/admin/whatsapp/numbers', icon: FiPhone },
  { label: 'Groups', href: '/admin/whatsapp/groups', icon: FiUsers, roles: ['manager'] },
  // Call Recordings — manager-only. Lists every WA call in the manager's
  // org with the sticky-resolved handling agent and per-row download.
  { label: 'Call Recordings', href: '/admin/whatsapp/calls', icon: FiDisc, roles: ['manager'] },
  // Oversight — cross-agent conversation viewer with live draft + typing.
  // Available to both managers and platform admins (admins use it to
  // assist orgs they're impersonating; same access rule as the page).
  { label: 'Oversight', href: '/admin/whatsapp/oversight', icon: FiEye },
  { label: 'Settings', href: '/admin/whatsapp/settings', icon: FiSettings },
  // Templates — both see it; the page itself is role-aware: admin gets the
  // global Meta template manager, manager gets their org's provider-aware
  // (YCloud/Meta) verified-template sync.
  { label: 'Templates', href: '/admin/whatsapp/templates', icon: FiFileText },
  // Billing — manager-only: their org's monthly WhatsApp spend (accurate
  // message cost + call durations) with CSV export. Admins use Pricing/Usage.
  { label: 'Billing', href: '/admin/whatsapp/billing', icon: FiCreditCard, roles: ['manager'] },
  { label: 'Pricing', href: '/admin/whatsapp/pricing', icon: FiDollarSign, roles: ['admin'] },
  { label: 'Usage', href: '/admin/whatsapp/usage', icon: FiBarChart2, roles: ['admin'] },
];

export default function AdminWhatsAppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user } = useAuthStore();
  const role = (user?.role ?? 'admin') as 'admin' | 'manager';

  const visibleTabs = TABS.filter((tab) => !tab.roles || tab.roles.includes(role));

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
            <FaWhatsapp className="w-6 h-6 text-green-600 dark:text-green-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[var(--foreground)]">WhatsApp</h1>
            <p className="text-sm text-[var(--muted-foreground)]">
              {role === 'manager'
                ? 'Connect Meta, share numbers across agents, keep every conversation sticky.'
                : 'Platform-wide WhatsApp configuration, templates, pricing, and usage.'}
            </p>
          </div>
        </div>

        <nav
          role="tablist"
          aria-label="WhatsApp sections"
          className="flex items-center gap-1 border-b border-[var(--border)]"
        >
          {visibleTabs.map((tab) => {
            const isActive = pathname?.startsWith(tab.href) ?? false;
            const Icon = tab.icon;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                role="tab"
                aria-selected={isActive}
                className={`
                  relative inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium
                  transition-colors whitespace-nowrap
                  ${
                    isActive
                      ? 'text-[var(--foreground)]'
                      : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
                  }
                `}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
                {isActive && (
                  <span
                    aria-hidden
                    className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-[var(--primary)]"
                  />
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      <div>{children}</div>
    </div>
  );
}
