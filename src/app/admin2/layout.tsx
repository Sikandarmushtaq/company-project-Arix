'use client';

/**
 * /admin2 — redesigned platform admin (parallel build).
 *
 * Runs ALONGSIDE the live /admin so nothing in production breaks while the new
 * SaaS admin is built page by page. Role-gated to the platform plane
 * (super_admin / admin). Owner/manager/user are bounced to their home.
 *
 * Shell only (Page 0): sidebar nav + topbar + theme toggle. Each nav target has
 * a stub page that later pages replace one at a time.
 */

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/lib/stores/auth';
import { getDefaultRouteForRole } from '@/lib/utils/routing';
import { applyTheme, type ThemeChoice } from '@/lib/theme';
import { SocketProvider, useSocketEvent } from '@/lib/providers/SocketProvider';
import { superadminApiService } from '@/lib/api/services/superadmin.service';
import { addonApiService } from '@/lib/api/services/addon.service';
import { CommandPalette } from './_components/CommandPalette';
import { NotificationsPanel } from './_components/NotificationsPanel';

/** Instant logout when the server kicks this session (deleted / session-terminated).
 *  Must live inside SocketProvider. */
function ForceLogoutSync() {
  const router = useRouter();
  const { logout } = useAuthStore();
  useSocketEvent<{ reason?: string }>('force_logout', () => {
    logout();
    router.replace('/login');
  });
  return null;
}

type NavItem = { label: string; href: string };
type NavGroup = { label: string; items: NavItem[] };

const NAV: NavGroup[] = [
  {
    label: 'Overview',
    items: [
      { label: 'Dashboard', href: '/admin2' },
      { label: 'Live Operations', href: '/admin2/live' },
      { label: 'Analytics', href: '/admin2/analytics' },
    ],
  },
  {
    label: 'Customers',
    items: [
      { label: 'Organizations', href: '/admin2/organizations' },
      { label: 'Users', href: '/admin2/users' },
      { label: 'Signups', href: '/admin2/signups' },
      { label: 'Orders', href: '/admin2/orders' },
      { label: 'Purchase Requests', href: '/admin2/purchases' },
      { label: 'Onboarding', href: '/admin2/onboarding' },
    ],
  },
  {
    label: 'Communication',
    items: [
      { label: 'Phone Numbers', href: '/admin2/phone-numbers' },
      { label: 'Calls & Recordings', href: '/admin2/calls' },
    ],
  },
  {
    label: 'Infrastructure',
    items: [
      { label: 'Telephony Accounts', href: '/admin2/telephony' },
      { label: 'Trunk Usage', href: '/admin2/trunk-usage' },
      { label: 'Diagnostics', href: '/admin2/diagnostics' },
    ],
  },
  {
    label: 'Platform',
    items: [
      { label: 'Access Control', href: '/admin2/access' },
      { label: 'Pricing Plans', href: '/admin2/pricing' },
      { label: 'Customer Plans', href: '/admin2/plans' },
      { label: 'Billing', href: '/admin2/billing' },
      { label: 'Reconciliation', href: '/admin2/reconciliation' },
      { label: 'Audit Log', href: '/admin2/audit' },
      { label: 'Settings', href: '/admin2/settings' },
    ],
  },
];

/** Contextual breadcrumb "Group / Page" for the current path (prototype parity). */
function breadcrumbFor(pathname: string): string {
  // Org detail: Customers / Organizations / Detail
  if (/^\/admin2\/organizations\/.+/.test(pathname)) return 'Customers / Organizations / Detail';
  for (const group of NAV) {
    for (const item of group.items) {
      if (item.href === '/admin2' ? pathname === '/admin2' : pathname === item.href || pathname.startsWith(`${item.href}/`)) {
        return `${group.label} / ${item.label}`;
      }
    }
  }
  return 'ArixCall Admin';
}

const ALLOWED = new Set(['super_admin', 'superadmin', 'admin']);

function isActive(pathname: string, href: string): boolean {
  if (href === '/admin2') return pathname === '/admin2';
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function Admin2Layout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, _hasHydrated, logout } = useAuthStore();
  const [isDark, setIsDark] = useState(false);
  const [cmdOpen, setCmdOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);

  // Pending-work counts for the sidebar badges (Signups / Purchase Requests).
  // CRITICAL: use the SAME query keys the realtime sync invalidates
  // (`signup-stats` / `addon-pending-count` — see useDashboardRealtime) so a new
  // pending request pushes the badge live. The old keys (`review-stats` /
  // `addon-pending`) were never invalidated by anything, so the badge froze on its
  // first fetch and a request that arrived afterwards never showed (count stuck at
  // 0). `refetchOnMount: 'always'` also makes the count correct on a fresh load,
  // overriding the global `refetchOnMount: false`. Shared with NotificationsPanel.
  const canView = _hasHydrated && !!user && ALLOWED.has(user.role);
  const pendingReviewsQ = useQuery({
    queryKey: ['admin2', 'signup-stats'],
    queryFn: () => superadminApiService.getSmsReviewStats(),
    enabled: canView,
    staleTime: 30_000,
    refetchOnMount: 'always',
  });
  const pendingAddonsQ = useQuery({
    queryKey: ['admin2', 'addon-pending-count'],
    queryFn: () => addonApiService.adminPendingCount(),
    enabled: canView,
    staleTime: 30_000,
    refetchOnMount: 'always',
  });
  const navBadges: Record<string, number> = {
    '/admin2/signups': pendingReviewsQ.data?.data?.pending ?? 0,
    '/admin2/purchases': pendingAddonsQ.data?.data?.count ?? 0,
  };

  const handleLogout = () => {
    logout();
    router.replace('/login');
  };

  // ⌘K / Ctrl-K opens the command palette anywhere in /admin2.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCmdOpen((v) => !v);
      }
      if (e.key === 'Escape') {
        setCmdOpen(false);
        setNotifOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Mirror the global theme (.dark on <html>) into the toggle button label.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    setIsDark(document.documentElement.classList.contains('dark'));
  }, []);

  // Platform-plane gate: anyone who isn't super_admin/admin goes to their home.
  useEffect(() => {
    if (!_hasHydrated) return;
    if (!user) {
      router.replace('/login');
      return;
    }
    if (!ALLOWED.has(user.role)) {
      router.replace(getDefaultRouteForRole(user.role));
    }
  }, [_hasHydrated, user, router]);

  const toggleTheme = () => {
    const next: ThemeChoice = isDark ? 'light' : 'dark';
    applyTheme(next);
    setIsDark(next === 'dark');
  };

  if (!_hasHydrated || !user || !ALLOWED.has(user.role)) {
    return (
      <div className="grid min-h-screen place-items-center bg-slate-50 text-slate-500 dark:bg-slate-950 dark:text-slate-400">
        <div className="animate-pulse text-sm font-semibold">Loading admin…</div>
      </div>
    );
  }

  const initials = (user.fullName || user.email || 'SA')
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <SocketProvider>
    <ForceLogoutSync />
    <div className="min-h-screen bg-slate-50 text-slate-950 dark:bg-slate-950 dark:text-slate-100">
      <div className="grid min-h-screen grid-cols-[248px_minmax(0,1fr)] max-lg:grid-cols-[76px_minmax(0,1fr)]">
        {/* Sidebar */}
        <aside className="sticky top-0 h-screen overflow-y-auto border-r border-slate-800 bg-slate-950 px-3 py-5 text-white">
          <div className="mb-6 flex items-center gap-3 px-2 max-lg:justify-center">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-[#FF6542] to-[#FFB547] font-black text-slate-950">
              A
            </div>
            <div className="font-extrabold tracking-tight max-lg:hidden">ArixCall</div>
          </div>

          <nav className="space-y-5">
            {NAV.map((group) => (
              <div key={group.label}>
                <div className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500 max-lg:hidden">
                  {group.label}
                </div>
                <div className="space-y-1">
                  {group.items.map((item) => {
                    const active = isActive(pathname, item.href);
                    const badge = navBadges[item.href] ?? 0;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={`relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition max-lg:justify-center ${
                          active
                            ? 'bg-white/10 text-white'
                            : 'text-slate-400 hover:bg-white/5 hover:text-white'
                        }`}
                      >
                        <span className={`h-2.5 w-2.5 rounded-full ${active ? 'bg-[#FF6542]' : 'bg-slate-700'}`} />
                        <span className="max-lg:hidden">{item.label}</span>
                        {badge > 0 && (
                          <>
                            {/* Expanded: count pill on the right. */}
                            <span
                              className="ml-auto grid h-5 min-w-5 place-items-center rounded-full bg-[#FF6542] px-1.5 text-[11px] font-bold tabular-nums text-white max-lg:hidden"
                              aria-label={`${badge} pending`}
                            >
                              {badge > 99 ? '99+' : badge}
                            </span>
                            {/* Collapsed: a dot is all there's room for. */}
                            <span
                              className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-[#FF6542] lg:hidden"
                              aria-hidden="true"
                            />
                          </>
                        )}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>

          <div className="mt-8 border-t border-slate-800 pt-4">
            <div className="flex items-center gap-3 px-2 max-lg:justify-center">
              <div className="grid h-9 w-9 place-items-center rounded-full bg-slate-800 text-xs font-extrabold">
                {initials}
              </div>
              <div className="max-lg:hidden">
                <div className="truncate text-sm font-semibold">{user.fullName || user.email}</div>
                <div className="text-xs capitalize text-slate-500">{user.role.replace('_', ' ')}</div>
              </div>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              aria-label="Log out"
              title="Log out"
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-slate-800 px-3 py-2 text-sm font-semibold text-slate-400 transition hover:bg-white/5 hover:text-white max-lg:px-0"
            >
              <span aria-hidden="true" className="text-base leading-none">⏻</span>
              <span className="max-lg:hidden">Log out</span>
            </button>
          </div>
        </aside>

        {/* Main column */}
        <div className="min-w-0">
          <header className="sticky top-0 z-20 flex h-[70px] items-center gap-4 border-b border-slate-200 bg-white/95 px-6 backdrop-blur dark:border-slate-800 dark:bg-slate-950/95">
            <div className="hidden min-w-[180px] shrink-0 text-sm text-slate-500 dark:text-slate-400 lg:block">
              {breadcrumbFor(pathname)}
            </div>
            <button
              type="button"
              onClick={() => setCmdOpen(true)}
              className="flex min-w-0 max-w-2xl flex-1 items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-left text-sm text-slate-500 hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400"
            >
              <span className="truncate">Search organization, user, phone number…</span>
              <span className="ml-4 rounded border border-slate-200 bg-white px-2 py-0.5 text-[11px] dark:border-slate-700 dark:bg-slate-800">
                Ctrl K
              </span>
            </button>
            <button
              type="button"
              onClick={() => setNotifOpen(true)}
              aria-label="Notifications"
              className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              🔔
            </button>
            <button
              type="button"
              onClick={toggleTheme}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              {isDark ? 'Light' : 'Dark'}
            </button>
          </header>

          <CommandPalette open={cmdOpen} onClose={() => setCmdOpen(false)} />
          <NotificationsPanel open={notifOpen} onClose={() => setNotifOpen(false)} />

          <main className="mx-auto max-w-[1500px] p-6 md:p-8">{children}</main>
        </div>
      </div>
    </div>
    </SocketProvider>
  );
}
