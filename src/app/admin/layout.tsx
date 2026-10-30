'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import {
  FiPhone,
  FiHome,
  FiUsers,
  FiMonitor,
  FiActivity,
  FiShield,
  FiRefreshCw,
  FiDisc,
  FiVoicemail,
  FiLink,
  FiSettings,
  FiFileText,
  FiBarChart2,
  FiCpu,
  FiPhoneCall,
  FiLock,
  FiBriefcase,
  FiGrid,
  FiDollarSign,
  FiWifi,
  FiEye,
  FiUserPlus,
  FiTag,
  FiInbox,
  FiPackage,
  FiSliders,
  FiList,
  FiLifeBuoy,
  FiPieChart,
} from 'react-icons/fi';
import { FaWhatsapp } from 'react-icons/fa';
import { Sidebar, type NavItem } from '@/components/layout';
import { useAuthStore } from '@/lib/stores';
import { SocketProvider, useSocketEvent } from '@/lib/providers/SocketProvider';
import { SipProvider } from '@/lib/providers';
import { AdminHeader, AdminAlertToast } from '@/components/admin';
import { ActiveCallIndicator } from '@/components/phone';
import { SupportRingBanner } from '@/components/support/SupportRingBanner';
import { useAdminRealtimeSync } from '@/lib/hooks/useAdminRealtimeSync';
import { useRealtimeTriageSync } from '@/lib/hooks/useRealtimeTriageSync';
import { usePermissions, PERMISSIONS } from '@/lib/hooks/usePermissions';
import { useWaStatus } from '@/lib/hooks/useWaConversationQueries';
import { CommandPaletteProvider, ThemeLogo } from '@/components/ui';
import { ConfirmProvider, AlertProvider } from '@/lib/hooks';

/**
 * Nav items with permission requirements
 */
// The reskin (arixcall) does NOT offer WhatsApp. Build-time flag (unset → false
// on the reskin) drops the whole WhatsApp nav section. A nuxcall build sets
// NEXT_PUBLIC_ENABLE_WHATSAPP=true to restore it.
const WHATSAPP_UI_ENABLED = process.env.NEXT_PUBLIC_ENABLE_WHATSAPP === 'true';

interface PermissionNavItem extends NavItem {
  permission?: string | string[];
  permissionMode?: 'all' | 'any';
  adminOnly?: boolean; // Only visible to the platform super admin (legacy name)
  superAdminOnly?: boolean; // Only visible to the platform super admin
  ownerAdmin?: boolean; // Visible to the tenant owner or admin (+ super admin) — mirrors owner/admin backend gates
  requiresWaEnabled?: boolean; // Only visible to managers if their wa_enabled flag is on
}

interface AdminNavSection {
  title: string;
  items: PermissionNavItem[];
}

// Grouped admin navigation. Sections render with a header and empty sections
// (all items hidden by permissions/entitlements — e.g. WhatsApp on the reskin)
// are dropped entirely. Every item keeps its exact permission/role gate.
const adminNavSections: AdminNavSection[] = [
  {
    title: 'Overview',
    items: [
      { label: 'Dashboard', href: '/admin', icon: <FiHome className="w-5 h-5" />, permission: PERMISSIONS.VIEW_DASHBOARD },
      { label: 'Live Calls', href: '/admin/live-calls', icon: <FiPhoneCall className="w-5 h-5" />, permission: PERMISSIONS.VIEW_LIVE_CALLS },
      { label: 'Analytics', href: '/admin/analytics', icon: <FiBarChart2 className="w-5 h-5" />, permission: PERMISSIONS.VIEW_ANALYTICS },
    ],
  },
  {
    title: 'Customers & Access',
    items: [
      { label: 'Users', href: '/admin/users', icon: <FiUsers className="w-5 h-5" />, permission: PERMISSIONS.VIEW_USERS, matchPaths: ['/admin/accounts'] },
      { label: 'Organizations', href: '/admin/organizations', icon: <FiBriefcase className="w-5 h-5" />, adminOnly: true },
      { label: 'Tenant Access', href: '/admin/entitlements', icon: <FiSliders className="w-5 h-5" />, superAdminOnly: true },
      { label: 'Permissions', href: '/admin/permissions', icon: <FiLock className="w-5 h-5" />, permission: PERMISSIONS.MANAGE_USER_PERMISSIONS, superAdminOnly: true },
      { label: 'Sessions', href: '/admin/sessions', icon: <FiActivity className="w-5 h-5" />, permission: PERMISSIONS.VIEW_SESSIONS },
      { label: 'Bans', href: '/admin/bans', icon: <FiShield className="w-5 h-5" />, permission: PERMISSIONS.VIEW_BANS },
    ],
  },
  {
    title: 'Onboarding & Billing',
    items: [
      { label: 'Signups', href: '/admin/signups', icon: <FiUserPlus className="w-5 h-5" />, adminOnly: true },
      { label: 'Signup Reviews', href: '/admin/signups/reviews', icon: <FiInbox className="w-5 h-5" />, adminOnly: true },
      { label: 'Add-on Requests', href: '/admin/addon-requests', icon: <FiPackage className="w-5 h-5" />, adminOnly: true },
      { label: 'Plans & Pricing', href: '/admin/billing', icon: <FiTag className="w-5 h-5" />, adminOnly: true },
      // Consolidated Usage hub (Calls ledger + SMS usage + SMS packages). Visible to
      // super-admins and to managers with SMS-usage access; the hub's tabs are
      // role-gated internally (Calls ledger is super-admin only).
      { label: 'Usage', href: '/admin/usage', icon: <FiPieChart className="w-5 h-5" />, permission: PERMISSIONS.VIEW_SMS_USAGE },
    ],
  },
  {
    title: 'Telephony',
    items: [
      { label: 'Live Connections', href: '/admin/devices', icon: <FiMonitor className="w-5 h-5" />, permission: PERMISSIONS.VIEW_LIVE_CONNECTIONS },
      { label: 'Hardphones', href: '/admin/hardphones', icon: <FiPhone className="w-5 h-5" />, permission: PERMISSIONS.VIEW_DEVICES },
      { label: 'Call Groups', href: '/admin/call-groups', icon: <FiUsers className="w-5 h-5" />, permission: PERMISSIONS.MANAGE_PHONE_NUMBERS },
      { label: 'Call Settings', href: '/admin/call-settings', icon: <FiSettings className="w-5 h-5" />, ownerAdmin: true },
    ],
  },
  {
    title: 'Recordings & QA',
    items: [
      { label: 'Recordings', href: '/admin/recordings', icon: <FiDisc className="w-5 h-5" />, permission: PERMISSIONS.VIEW_RECORDINGS },
      { label: 'Dispositions', href: '/admin/dispositions', icon: <FiList className="w-5 h-5" />, permission: PERMISSIONS.VIEW_VOICEMAIL_AUDIT },
      { label: 'Voicemail Audit', href: '/admin/voicemail-audit', icon: <FiVoicemail className="w-5 h-5" />, permission: PERMISSIONS.VIEW_VOICEMAIL_AUDIT },
    ],
  },
  {
    title: 'Messaging',
    items: [
      { label: 'SMS Providers', href: '/admin/sms/providers', icon: <FiSettings className="w-5 h-5" />, adminOnly: true },
      { label: 'SMS Pricing', href: '/admin/sms/pricing', icon: <FiDollarSign className="w-5 h-5" />, adminOnly: true },
      { label: 'SMS Sub-accounts', href: '/admin/telnyx/sms-subaccounts', icon: <FiLink className="w-5 h-5" />, superAdminOnly: true },
      // SMS Usage now lives in the consolidated Usage hub (/admin/usage → SMS tab).
    ],
  },
  {
    // WhatsApp — hidden on the reskin (no WA), so this whole section drops out.
    title: 'WhatsApp',
    items: [
      { label: 'WA Settings', href: '/admin/whatsapp/settings', icon: <FaWhatsapp className="w-5 h-5" />, requiresWaEnabled: true },
      { label: 'WA Numbers', href: '/admin/whatsapp/numbers', icon: <FiPhone className="w-5 h-5" />, requiresWaEnabled: true },
      { label: 'WA Groups', href: '/admin/whatsapp/groups', icon: <FiUsers className="w-5 h-5" />, requiresWaEnabled: true },
      { label: 'WA Call Recordings', href: '/admin/whatsapp/calls', icon: <FiDisc className="w-5 h-5" />, requiresWaEnabled: true },
      { label: 'Customers', href: '/admin/customers', icon: <FiUsers className="w-5 h-5" />, requiresWaEnabled: true },
      { label: 'WA Oversight', href: '/admin/whatsapp/oversight', icon: <FiEye className="w-5 h-5" />, superAdminOnly: true },
      { label: 'WA Pricing', href: '/admin/whatsapp/pricing', icon: <FiDollarSign className="w-5 h-5" />, adminOnly: true },
      { label: 'WA Usage', href: '/admin/whatsapp/usage', icon: <FiBarChart2 className="w-5 h-5" />, permission: PERMISSIONS.VIEW_WHATSAPP },
      { label: 'WA Templates', href: '/admin/whatsapp/templates', icon: <FiFileText className="w-5 h-5" />, adminOnly: true },
    ],
  },
  {
    title: 'System & Settings',
    items: [
      { label: 'System Health', href: '/admin/health', icon: <FiCpu className="w-5 h-5" />, permission: PERMISSIONS.VIEW_SYSTEM_HEALTH },
      { label: 'Call Health', href: '/admin/call-health', icon: <FiWifi className="w-5 h-5" />, permission: PERMISSIONS.VIEW_CALL_HEALTH },
      { label: 'Failover', href: '/admin/failover', icon: <FiRefreshCw className="w-5 h-5" />, permission: PERMISSIONS.VIEW_FAILOVER },
      { label: 'HA Monitor', href: '/admin/ha-monitor', icon: <FiGrid className="w-5 h-5" />, permission: PERMISSIONS.VIEW_FAILOVER, adminOnly: true },
      { label: 'Audit Logs', href: '/admin/audit', icon: <FiFileText className="w-5 h-5" />, permission: PERMISSIONS.VIEW_AUDIT_LOGS, adminOnly: true },
      { label: 'CRM Webhook', href: '/admin/crm-webhook', icon: <FiLink className="w-5 h-5" />, ownerAdmin: true },
      { label: 'Settings', href: '/admin/settings', icon: <FiSettings className="w-5 h-5" />, permission: PERMISSIONS.VIEW_SETTINGS },
      { label: 'Support', href: '/admin/support', icon: <FiLifeBuoy className="w-5 h-5" />, superAdminOnly: true },
    ],
  },
];

// Flat list derived from the sections — used by the route guard below.
const adminNavItems: PermissionNavItem[] = adminNavSections.flatMap((s) => s.items);

/**
 * Inner layout component that uses the admin realtime sync hook
 * Must be inside SocketProvider
 */
function AdminLayoutInner({ children }: { children: React.ReactNode }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const router = useRouter();
  const { logout } = useAuthStore();
  const {
    hasPermission,
    hasAnyPermission,
    isSuperAdmin,
    isAdmin,
    isOwner,
    isLoading: permissionsLoading,
  } = usePermissions();

  // Use admin real-time sync to get alerts
  const { alerts, dismissAlert } = useAdminRealtimeSync();
  // Live triage-arrival toast + Triage-tab badge for managers viewing
  // /admin/customers. Mounted at the layout so the badge counter keeps
  // climbing even while the manager is on a different admin page.
  useRealtimeTriageSync();

  // Per-user WhatsApp enabled flag — gates WA sidebar items for managers.
  const { data: waStatus } = useWaStatus();
  const waEnabled = waStatus?.waEnabled ?? false;

  // Filter nav items based on permissions
  // Filter each section's items by role/permission, then drop empty sections.
  // The reskin (no WhatsApp) drops the whole WhatsApp section via the build flag.
  const filteredSections = useMemo(() => {
    const canView = (item: PermissionNavItem): boolean => {
      // Only the platform super admin sees everything else.
      if (item.superAdminOnly) return isSuperAdmin;
      if (isSuperAdmin) return true;
      if (item.adminOnly) return false;
      // Owner/admin config pages (e.g. CRM Webhook): visible to the tenant
      // owner or admin, hidden from managers/agents — mirrors the backend gate.
      if (item.ownerAdmin) return isAdmin || isOwner;
      if (item.requiresWaEnabled && !waEnabled) return false;
      if (!item.permission) return true;

      const permissions = Array.isArray(item.permission) ? item.permission : [item.permission];
      const mode = item.permissionMode || 'all';
      if (mode === 'any') return hasAnyPermission(...permissions);
      return permissions.every((p) => hasPermission(p));
    };

    return adminNavSections
      // WhatsApp is a build-time feature — the reskin (arixcall) drops it entirely.
      .filter((s) => WHATSAPP_UI_ENABLED || s.title !== 'WhatsApp')
      .map((s) => ({ title: s.title, items: s.items.filter(canView) }))
      .filter((s) => s.items.length > 0);
  }, [isSuperAdmin, isAdmin, isOwner, waEnabled, hasPermission, hasAnyPermission]);

  // Flat list derived from the visible sections — drives the route guard below.
  const filteredNavItems = useMemo(
    () => filteredSections.flatMap((s) => s.items),
    [filteredSections]
  );

  // Route guard: nav-hiding alone doesn't block a user who lands on (or is
  // defaulted to, e.g. /admin) a page they lack permission for — the page
  // still renders its shell and any data from endpoints gated by OTHER
  // permissions. So if the current admin page isn't in the user's allowed
  // nav set, redirect them to the first page they CAN access. This makes the
  // per-manager page toggles actually block the page, not just hide the link.
  const pathname = usePathname();
  useEffect(() => {
    if (isSuperAdmin || permissionsLoading) return;
    // Most specific nav item for the current path (longest matching href).
    const match = adminNavItems
      .filter((it) => pathname === it.href || pathname.startsWith(`${it.href}/`))
      .sort((a, b) => b.href.length - a.href.length)[0];
    if (!match) return; // page has no nav entry (e.g. a detail route) — leave it
    const allowed = filteredNavItems.some((it) => it.href === match.href);
    if (!allowed) {
      router.replace(filteredNavItems[0]?.href || '/phone');
    }
  }, [pathname, filteredNavItems, isSuperAdmin, permissionsLoading, router]);

  // Listen for force logout event from server
  useSocketEvent<{ reason: string }>('force_logout', (data) => {
    console.log('[Auth] Force logout received:', data.reason);
    logout();
    router.push('/login');
  });

  return (
    <>
      <div className="min-h-screen bg-[var(--background)] flex">
        <Sidebar
          sections={filteredSections}
          title="ArixCall Admin"
          logo={
            <ThemeLogo
              lightSrc="/logo.png?v=3"
              darkSrc="/logo-light.png?v=3"
              alt="ArixCall"
              className="h-14 w-auto object-contain"
            />
          }
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        />
        <div className="flex-1 flex flex-col min-h-screen">
          <AdminHeader />
          <main id="main-content" className="flex-1 p-6" role="main" tabIndex={-1}>
            {children}
          </main>
        </div>

        {/* Real-time toast notifications */}
        <AdminAlertToast
          alerts={alerts}
          onDismiss={dismissAlert}
          maxToasts={5}
          autoDismissMs={8000}
        />

        {/* Persistent call indicator for normal incoming calls */}
        {/* Note: Monitoring calls are handled by AdminMonitorPanel in the header */}
        <ActiveCallIndicator />

        {/* Super-admin support ring: rings + toasts while tickets wait unclaimed */}
        {isSuperAdmin && <SupportRingBanner />}
      </div>
    </>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { isAuthenticated, user, isLoading, _hasHydrated, checkAuth } = useAuthStore();
  const [isValidating, setIsValidating] = useState(true);

  // Allow admin, superadmin (legacy — migration 022 upgrades these to
  // 'admin' but pre-migration JWTs may still carry the old role), and
  // manager roles to access admin panel.
  const hasAdminAccess =
    user?.role === 'admin' ||
    user?.role === 'super_admin' ||
    user?.role === 'owner' ||
    user?.role === 'manager';

  // Wait for hydration, then validate session with backend
  useEffect(() => {
    if (!_hasHydrated) return;

    const validateSession = async () => {
      if (isAuthenticated) {
        // Validate the session is still valid on the backend
        try {
          await checkAuth();
        } catch {
          // Session invalid, will redirect below
        }
      }
      setIsValidating(false);
    };

    validateSession();
  }, [_hasHydrated, isAuthenticated, checkAuth]);

  // Redirect after validation complete
  useEffect(() => {
    if (isValidating || isLoading) return;

    if (!isAuthenticated) {
      router.replace('/login');
    } else if (user && !hasAdminAccess) {
      router.replace('/phone');
    }
  }, [isAuthenticated, user, isLoading, isValidating, router, hasAdminAccess]);

  // Show loading while hydrating or validating
  if (!_hasHydrated || isValidating || isLoading || !isAuthenticated || !hasAdminAccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--background)]">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-[var(--border)] border-t-transparent" />
      </div>
    );
  }

  return (
    <SocketProvider>
      <SipProvider autoConnect={true} initializeAudio={true}>
        <ConfirmProvider>
          <AlertProvider>
            <CommandPaletteProvider>
              <AdminLayoutInner>{children}</AdminLayoutInner>
            </CommandPaletteProvider>
          </AlertProvider>
        </ConfirmProvider>
      </SipProvider>
    </SocketProvider>
  );
}
