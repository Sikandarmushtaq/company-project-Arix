'use client';

/**
 * /org/* root layout — shared shell for owner + manager.
 *
 * This layout deliberately does NOT enforce role === 'owner'. The owner-only
 * gate lives in app/org/(owner-only)/layout.tsx, scoped to the routes inside
 * that route group.
 *
 * Why: per-org WhatsApp setup at /org/whatsapp/* must be reachable by both
 * owners (full org admin) and managers with wa_enabled (delegated WA admin).
 * The backend already gates /api/v1/whatsapp/org/* with requireOwnerOrManager.
 * Restructuring with route groups lets us match that on the frontend without
 * mixed-role rendering inside individual page files.
 *
 * Sidebar items are role-aware: owners see the full org portal; managers only
 * see the items they can actually use (currently just WhatsApp).
 */

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  FiHome,
  FiUsers,
  FiPhone,
  FiShare2,
  FiMessageSquare,
  FiCreditCard,
  FiBarChart2,
  FiActivity,
  FiUser,
  FiLogOut,
  FiShield,
} from 'react-icons/fi';
import { Sidebar, type NavItem } from '@/components/layout';
import { SocketProvider, useSocketEvent } from '@/lib/providers/SocketProvider';
import { useOrgRealtimeSync } from '@/lib/hooks/useOrgRealtimeSync';
import { useRealtimeTriageSync } from '@/lib/hooks/useRealtimeTriageSync';
import { useAuthStore } from '@/lib/stores/auth';
import { usePermissions } from '@/lib/hooks/usePermissions';
import { getDefaultRouteForRole, crossAppHref } from '@/lib/utils/routing';
import OrgBillingTopBar from '@/components/org/OrgBillingTopBar';

interface OrgNavItem extends NavItem {
  /** Roles allowed to see this item. Defaults to owner-only. */
  roles?: Array<'owner' | 'manager'>;
  /** Tenant module this item requires; hidden unless the module is enabled. */
  module?: string;
}

const orgNavItems: OrgNavItem[] = [
  { label: 'Dashboard', href: '/org', icon: <FiHome className="w-5 h-5" />, roles: ['owner'] },
  { label: 'Users', href: '/org/users', icon: <FiUsers className="w-5 h-5" />, roles: ['owner'] },
  {
    label: 'Numbers',
    href: '/org/numbers',
    icon: <FiPhone className="w-5 h-5" />,
    roles: ['owner'],
  },
  {
    label: 'Call Menu',
    href: '/org/call-menu',
    icon: <FiShare2 className="w-5 h-5" />,
    roles: ['owner'],
  },
  {
    label: 'Analytics',
    href: '/org/analytics',
    icon: <FiBarChart2 className="w-5 h-5" />,
    roles: ['owner'],
  },
  {
    label: 'Plan & billing',
    href: '/org/billing',
    icon: <FiCreditCard className="w-5 h-5" />,
    roles: ['owner'],
  },
  {
    // Registrations hub: Call Verification (unlocks uncapped calling — shown for
    // ALL plans, so no module gate) + SMS Registration (10DLC). The SMS card
    // inside the page is itself gated on the sms module.
    label: 'Registrations',
    href: '/org/registrations',
    // The 10DLC campaign flow lives at /org/sms-campaign (a sub-flow of the
    // Registrations hub). Claim it here so the sidebar highlights Registrations
    // on that route instead of falling back to Dashboard (whose '/org' href is a
    // prefix of every org route and would otherwise win the active match).
    matchPaths: ['/org/sms-campaign'],
    icon: <FiShield className="w-5 h-5" />,
    roles: ['owner'],
  },
  {
    label: 'SMS Usage',
    href: '/org/sms-usage',
    icon: <FiActivity className="w-5 h-5" />,
    roles: ['owner'],
    // Gated on the dedicated, off-by-default 'sms_usage' module so it's hidden for
    // every org (auto-signup included) until a super-admin enables it per tenant.
    module: 'sms_usage',
  },
  // Customers + WhatsApp are Custom-tier features and are NOT offered yet —
  // hidden from the org portal for all current plans until the Custom plan
  // launches. Re-add here (gated appropriately) when Custom is built.
  {
    label: 'Profile',
    href: '/org/profile',
    icon: <FiUser className="w-5 h-5" />,
    roles: ['owner'],
  },
];

const ALLOWED_ROLES = new Set(['owner', 'manager']);

export default function OrgLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, isAuthenticated, isLoading, _hasHydrated, checkAuth, logout } = useAuthStore();
  const { isModuleEnabled } = usePermissions();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isValidating, setIsValidating] = useState(true);

  useEffect(() => {
    if (!_hasHydrated) return;

    const validateSession = async () => {
      // Already authenticated (same subdomain: the store hydrated with a real
      // user — e.g. straight after login). Render NOW and revalidate in the
      // BACKGROUND, instead of blocking the page behind a spinner on a redundant
      // /auth/me round-trip. This is what made /org feel slow after login.
      const { isAuthenticated: alreadyAuthed, user: currentUser } = useAuthStore.getState();
      if (alreadyAuthed && currentUser?.role) {
        setIsValidating(false);
        void checkAuth(); // non-blocking refresh
        return;
      }
      // Store looks empty — must BLOCK on the backend. On the admin.* subdomain
      // localStorage is per-origin so the store starts empty, but the HttpOnly
      // `arix_session` cookie authenticates us via the BFF, so `checkAuth()`
      // resolves the real role BEFORE the redirect effect runs (instead of
      // bouncing an owner to /phone or /login). A genuine 401 just leaves us
      // unauthenticated and the next effect redirects to /login.
      try {
        await checkAuth();
      } catch {
        // Session invalid — redirect handled by the next effect.
      }
      setIsValidating(false);
    };

    validateSession();
  }, [_hasHydrated, isAuthenticated, checkAuth]);

  useEffect(() => {
    if (isValidating || isLoading) return;

    if (!isAuthenticated) {
      router.replace('/login');
    } else if (!user?.role || !ALLOWED_ROLES.has(user.role)) {
      router.replace(getDefaultRouteForRole(user?.role));
    }
  }, [isAuthenticated, user, isLoading, isValidating, router]);

  // React Compiler memoizes this automatically — no manual useMemo needed.
  const userRole = user?.role;
  const orgName = user?.organizationName?.trim() || 'Organization';
  const visibleNavItems = !userRole
    ? []
    : orgNavItems.filter((item) => {
        if (item.roles && !item.roles.includes(userRole as 'owner' | 'manager')) return false;
        if (item.module && !isModuleEnabled(item.module)) return false;
        return true;
      });

  const isAuthorized = !!user?.role && ALLOWED_ROLES.has(user.role);

  if (!_hasHydrated || isValidating || isLoading || !isAuthenticated || !isAuthorized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--background)]">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-[var(--border)] border-t-transparent" />
      </div>
    );
  }

  return (
    <SocketProvider>
      <OrgRealtimeSync />
      <div className="min-h-screen bg-[var(--background)] flex">
        <Sidebar
          items={visibleNavItems}
          title={orgName}
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
          footer={
            <div className="space-y-1">
              {/* Switch to the dialer — normal nav-item style. */}
              <button
                type="button"
                onClick={() => {
                  const href = crossAppHref('app', '/phone');
                  if (href.startsWith('http')) window.location.assign(href);
                  else router.push(href);
                }}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-neutral-400 transition-all duration-200 hover:bg-white/5 hover:text-white ${
                  sidebarCollapsed ? 'justify-center px-2' : ''
                }`}
                title="Open Dialer"
              >
                <FiPhone className="h-5 w-5 flex-shrink-0" aria-hidden="true" />
                {!sidebarCollapsed && <span className="flex-1 text-left font-medium">Dialer</span>}
              </button>
              {/* Log out — same style, red to mark the sign-out action. */}
              <button
                type="button"
                onClick={() => {
                  logout();
                  router.replace('/login');
                }}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-red-400 transition-all duration-200 hover:bg-red-500/10 hover:text-red-300 ${
                  sidebarCollapsed ? 'justify-center px-2' : ''
                }`}
                title="Log out"
              >
                <FiLogOut className="h-5 w-5 flex-shrink-0" aria-hidden="true" />
                {!sidebarCollapsed && <span className="flex-1 text-left font-medium">Log out</span>}
              </button>
            </div>
          }
        />
        <div className="flex-1 flex flex-col min-w-0 min-h-screen">
          <OrgBillingTopBar />
          <main className="flex-1 overflow-y-auto">
            <div className="p-6">{children}</div>
          </main>
        </div>
      </div>
    </SocketProvider>
  );
}

/** Must be inside SocketProvider */
function OrgRealtimeSync() {
  const router = useRouter();
  const { logout } = useAuthStore();
  useOrgRealtimeSync();
  // Live triage-arrival toast + Triage-tab badge — mounted here so the
  // counter keeps growing across navigation inside the org shell.
  useRealtimeTriageSync();
  // Instant logout when the server kicks this account (disabled member, deleted,
  // session terminated). Managers hit this when their org is disabled; the owner
  // is NOT force-logged-out (they're dialer-gated instead, see /phone).
  useSocketEvent<{ reason?: string }>('force_logout', () => {
    logout();
    router.replace('/login');
  });
  return null;
}
