'use client';

/**
 * /admin/usage/* — the consolidated Usage & Billing hub.
 *
 * One home for "where did the minutes and messages go": the live Calls ledger
 * (hidden call-minute soft cap per org), SMS usage, and SMS packages. Mirrors the
 * tabbed shell used by /admin/whatsapp/* so the experience is consistent.
 *
 * Tabs are role-aware. The Calls ledger shows REAL usage numbers, so it's
 * super-admin only; SMS usage keeps its existing VIEW_SMS_USAGE gate so managers
 * who had it don't lose access. A viewer who lands on a tab they can't see is
 * bounced to the first tab they can.
 */

import React, { useEffect, useMemo } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { FiPhoneCall, FiMessageSquare, FiPackage, FiPieChart } from 'react-icons/fi';
import { usePermissions, PERMISSIONS } from '@/lib/hooks/usePermissions';

interface UsageTab {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  visible: boolean;
}

export default function AdminUsageLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { isSuperAdmin, isAdmin, hasPermission, isLoading } = usePermissions();

  const tabs = useMemo<UsageTab[]>(
    () => [
      {
        label: 'Calls',
        href: '/admin/usage',
        icon: FiPhoneCall,
        // Real per-org minutes vs the hidden cap — platform-owner tool only.
        visible: isSuperAdmin,
      },
      {
        label: 'SMS',
        href: '/admin/usage/sms',
        icon: FiMessageSquare,
        visible: isSuperAdmin || hasPermission(PERMISSIONS.VIEW_SMS_USAGE),
      },
      {
        label: 'SMS Packages',
        href: '/admin/usage/packages',
        icon: FiPackage,
        visible: isSuperAdmin || isAdmin,
      },
    ],
    [isSuperAdmin, isAdmin, hasPermission]
  );

  const visibleTabs = useMemo(() => tabs.filter((t) => t.visible), [tabs]);

  // Longest-matching href = the active tab (so /admin/usage/sms doesn't also light
  // up the "/admin/usage" Calls tab, which is a prefix of every sub-route).
  const activeHref = useMemo(() => {
    const matches = tabs
      .filter((t) => pathname === t.href || pathname.startsWith(`${t.href}/`))
      .sort((a, b) => b.href.length - a.href.length);
    return matches[0]?.href ?? null;
  }, [tabs, pathname]);

  // Bounce a viewer off a tab they can't see (e.g. a manager landing on the
  // super-admin-only Calls tab at /admin/usage) to their first available tab.
  useEffect(() => {
    if (isLoading || !activeHref) return;
    const activeVisible = visibleTabs.some((t) => t.href === activeHref);
    if (!activeVisible && visibleTabs[0]) router.replace(visibleTabs[0].href);
  }, [isLoading, activeHref, visibleTabs, router]);

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--primary)]/10 text-[var(--primary)]">
            <FiPieChart className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[var(--foreground)]">Usage &amp; Billing</h1>
            <p className="text-sm text-[var(--muted-foreground)]">
              Calls, SMS, and packages — where the minutes and messages go.
            </p>
          </div>
        </div>

        <nav
          role="tablist"
          aria-label="Usage sections"
          className="flex items-center gap-1 overflow-x-auto border-b border-[var(--border)]"
        >
          {visibleTabs.map((tab) => {
            const isActive = activeHref === tab.href;
            const Icon = tab.icon;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                role="tab"
                aria-selected={isActive}
                className={`relative inline-flex items-center gap-2 whitespace-nowrap px-4 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? 'text-[var(--foreground)]'
                    : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
                }`}
              >
                <Icon className="h-4 w-4" />
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
