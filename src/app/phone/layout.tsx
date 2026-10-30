'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import {
  FiPhone,
  FiMessageSquare,
  FiUsers,
  FiVoicemail,
  FiDisc,
  FiZap,
  FiSettings,
  FiHelpCircle,
  FiClock,
  FiSend,
} from 'react-icons/fi';
import { FaWhatsapp } from 'react-icons/fa';
import { MobileBottomNav, usePhonePageAccess, type NavItem } from '@/components/layout';
import { DialerTopBar } from '@/components/phone/chrome/DialerTopBar';
import { DialerRail } from '@/components/phone/chrome/DialerRail';
import OrgBillingTopBar from '@/components/org/OrgBillingTopBar';
import './dialer-theme.css';
import { useAuthStore } from '@/lib/stores';
import { QueryProvider, SipProvider } from '@/lib/providers';
import { SocketProvider, useSocketEvent } from '@/lib/providers/SocketProvider';
import { ContactLookupProvider } from '@/lib/providers/ContactLookupProvider';
import { useRealtimeSync, ConfirmProvider, AlertProvider, useBlockedContacts } from '@/lib/hooks';
import { useDndStatus } from '@/lib/hooks/useUserSettings';
// Engine router (SIP.js or LiveKit, whichever is active) — see lib/call/call-engine.
import { callEngine as sipManager } from '@/lib/call/call-engine';
import { phonesMatch, isOwnNumber } from '@/lib/utils/phone';
import { crossAppHref } from '@/lib/utils/routing';
import { ToastContainer } from '@/components/ui/Toast';
import { RichNotificationContainer } from '@/components/ui/RichNotification';
import {
  ActiveCallIndicator,
  CallPipWindow,
  MonitoringAlert,
  DispositionModal,
} from '@/components/phone';
import { WaCallProvider } from '@/lib/providers/WaCallProvider';
import { WaCallFloatingPanel } from '@/components/phone/WaCallFloatingPanel';
import { useSipStore } from '@/lib/stores/sip';
import {
  SipErrorBoundary,
  KeyboardShortcutsModal,
  CommandPaletteProvider,
} from '@/components/ui';
import {
  useKeyboardShortcuts,
  useShortcutsModal,
  CALL_SHORTCUTS,
} from '@/lib/hooks/useKeyboardShortcuts';
import { usePermissions, PERMISSIONS } from '@/lib/hooks/usePermissions';
import { NotSubscribed } from '@/components/NotSubscribed';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { orgApiService } from '@/lib/api/services/org.service';
import { REALTIME_EVENTS } from '@/lib/constants/events';

const userNavItems: NavItem[] = [
  { label: 'Phone', href: '/phone', icon: <FiPhone className="w-5 h-5" /> },
  { label: 'History', href: '/phone/history', icon: <FiClock className="w-5 h-5" /> },
  { label: 'Messages', href: '/phone/messages', icon: <FiMessageSquare className="w-5 h-5" /> },
  {
    label: 'WhatsApp',
    href: '/phone/whatsapp',
    icon: <FaWhatsapp className="w-5 h-5 text-green-500" />,
  },
  {
    label: 'WA Calls',
    href: '/phone/whatsapp-calls',
    icon: <FiPhone className="w-5 h-5 text-green-500" />,
  },
  { label: 'Contacts', href: '/phone/contacts', icon: <FiUsers className="w-5 h-5" /> },
  { label: 'Voicemail', href: '/phone/voicemail', icon: <FiVoicemail className="w-5 h-5" /> },
  { label: 'Recordings', href: '/phone/recordings', icon: <FiDisc className="w-5 h-5" /> },
  { label: 'AI Auto-Dialer', href: '/phone/auto-dialer', icon: <FiZap className="w-5 h-5" /> },
  { label: 'Bulk SMS', href: '/phone/bulk-sms', icon: <FiSend className="w-5 h-5" /> },
  { label: 'Settings', href: '/phone/settings', icon: <FiSettings className="w-5 h-5" /> },
  { label: 'Support', href: '/phone/support', icon: <FiHelpCircle className="w-5 h-5" /> },
];

// Routes whose feature is gated by a tenant module. When the org isn't
// subscribed to the module, we keep the nav item but show "Not subscribed"
// instead of the feature. Matching is exact-or-subpath, so '/phone/whatsapp'
// never swallows '/phone/whatsapp-calls'.
// `hideWhenDisabled`: these pages are hidden from the nav when the module is off,
// so hitting the URL directly redirects to the keypad instead of showing the
// "Not subscribed" screen. The rest keep the in-page NotSubscribed message.
const GATED_ROUTES: Array<{
  prefix: string;
  module: string;
  feature: string;
  hideWhenDisabled?: boolean;
}> = [
  { prefix: '/phone/whatsapp-calls', module: 'whatsapp', feature: 'WhatsApp Calls', hideWhenDisabled: true },
  { prefix: '/phone/whatsapp', module: 'whatsapp', feature: 'WhatsApp', hideWhenDisabled: true },
  { prefix: '/phone/messages', module: 'sms', feature: 'Messages' },
  { prefix: '/phone/bulk-sms', module: 'sms', feature: 'Bulk SMS', hideWhenDisabled: true },
  { prefix: '/phone/auto-dialer', module: 'autodialer', feature: 'AI Auto-Dialer', hideWhenDisabled: true },
  { prefix: '/phone/recordings', module: 'recordings', feature: 'Recordings' },
];

/**
 * Gates the current route behind its tenant module. Rendered inside the
 * Query/Socket providers so usePermissions() works. Fail-open: while the
 * entitlements load, children render normally (no "Not subscribed" flash).
 */
function ModuleGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { isModuleEnabled, isLoading: permLoading } = usePermissions();
  const { isBlocked, isLoading: accessLoading } = usePhonePageAccess();
  const gated = GATED_ROUTES.find(
    (r) => pathname === r.prefix || pathname.startsWith(r.prefix + '/')
  );
  const isLoading = permLoading || accessLoading;

  // Hidden pages (whatsapp / wa-calls / auto-dialer / bulk-sms) blocked by EITHER
  // the org module OR the per-user access flag (Edit User modal) → bounce to the
  // keypad instead of rendering the "not enabled" screen for a page that isn't in
  // the nav. Redirect in an effect (can't navigate during render).
  const shouldRedirect = !isLoading && !!gated?.hideWhenDisabled && isBlocked(gated.prefix);
  useEffect(() => {
    if (shouldRedirect) router.replace('/phone');
  }, [shouldRedirect, router]);

  // Non-gated routes render immediately — never block the dialer on entitlements.
  if (!gated) return <>{children}</>;

  // On a gated route, wait for entitlements before rendering so the real feature
  // never flashes before we know whether the tenant is subscribed. Only the
  // first (uncached) load shows this; live toggles refetch without isLoading.
  if (isLoading || shouldRedirect) {
    return (
      <div className="flex flex-1 items-center justify-center min-h-[60vh]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--border)] border-t-transparent" />
      </div>
    );
  }

  // Remaining gated routes (Messages, Recordings) keep the in-page "Not
  // subscribed" message when their org module is off.
  if (!isModuleEnabled(gated.module)) {
    return <NotSubscribed feature={gated.feature} />;
  }
  return <>{children}</>;
}

/**
 * Redirect a user who doesn't belong on the dialer to the admin panel in a
 * SINGLE hop. On arixcall.com the portal lives on admin.arixcall.com, so
 * `crossAppHref` returns an absolute URL and we do a hard navigation — this
 * avoids the relative `router.replace('/admin')` → app.arixcall.com/admin →
 * middleware 302 → admin.arixcall.com/admin double-hop (the cross-subdomain
 * flash). Off arixcall (single host / localhost) `crossAppHref` returns the
 * plain '/admin' path and we do an in-app SPA replace. Same idiom as the login
 * page and the DialerTopBar portal switcher.
 */
function redirectToAdminPanel(router: ReturnType<typeof useRouter>): void {
  const href = crossAppHref('admin', '/admin');
  if (href.startsWith('http')) window.location.replace(href);
  else router.replace(href);
}

/**
 * Blocks a manager whose "Dialer Access" capability has been turned off (by an
 * admin, via the Edit User modal) from the /phone dialer, sending them to the
 * admin panel they still have. Rendered inside the providers so usePermissions()
 * works. Users always keep dialer access, and admins are already redirected out
 * by PhoneLayout, so in practice this only affects a toggled-off manager.
 * Fail-open while permissions load (never flash a redirect on first paint).
 */
function DialerAccessGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { permissions, isLoading, isManager } = usePermissions();
  // FAIL-OPEN, managers-only. The dialer is enabled-by-default for everyone, so
  // we block ONLY on an explicit "off" (the key is present AND === false — i.e.
  // an admin deliberately revoked it). If the key is merely absent (perms still
  // loading, or a cached map from before this permission existed), we do NOT
  // block — guaranteeing no dialer outage during a deploy. Agents (non-manager)
  // are never evaluated. Blocked managers keep the admin panel.
  const blocked = !isLoading && isManager && permissions[PERMISSIONS.VIEW_DIALER] === false;

  useEffect(() => {
    if (blocked) {
      redirectToAdminPanel(router);
    }
  }, [blocked, router]);

  if (blocked) {
    return (
      <div className="flex flex-1 items-center justify-center min-h-[60vh]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--border)] border-t-transparent" />
      </div>
    );
  }
  return <>{children}</>;
}

/** Shown to the OWNER of a disabled org in place of the dialer. They can still
 *  reach the org portal (billing/settings) but not the softphone. */
function WorkspaceDisabledScreen({ onSignOut }: { onSignOut: () => void }) {
  const goToPortal = () => {
    // The org portal (/org) is served on the admin subdomain.
    const href = crossAppHref('admin', '/org');
    if (href.startsWith('http')) window.location.assign(href);
    else window.location.href = '/org';
  };
  return (
    <div className="flex min-h-screen flex-1 items-center justify-center bg-[var(--background)] p-6">
      <div className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--card)] p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-amber-500/10 text-2xl">⏸️</div>
        <h1 className="text-xl font-bold text-[var(--foreground)]">Workspace disabled</h1>
        <p className="mt-2 text-sm text-[var(--muted-foreground)]">
          Your workspace has been temporarily disabled by an administrator, so the dialer is
          unavailable right now. You can still manage your organization and billing from the portal.
          Contact your administrator if you think this is a mistake.
        </p>
        <div className="mt-6 flex flex-col gap-2">
          <button
            type="button"
            onClick={goToPortal}
            className="w-full rounded-xl bg-[var(--primary-600)] px-4 py-2.5 text-sm font-bold text-white hover:brightness-95"
          >
            Go to organization portal
          </button>
          <button
            type="button"
            onClick={onSignOut}
            className="w-full rounded-xl border border-[var(--border)] px-4 py-2.5 text-sm font-semibold text-[var(--foreground)] hover:bg-[var(--muted)]"
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}

// Component that enables real-time cache sync and handles force logout
function RealtimeSyncProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { logout, user } = useAuthStore();
  const { disconnect, lines } = useSipStore();
  const qc = useQueryClient();

  useRealtimeSync();

  // Listen for force logout event from server (when kicked/banned)
  useSocketEvent<{ reason: string }>('force_logout', (data) => {
    console.log('[Auth] Force logout received:', data.reason);
    // Disconnect SIP (this will end any active calls)
    if (lines.length > 0) {
      disconnect();
    }
    // Then logout and redirect
    logout();
    router.push('/login');
  });

  // Owner dialer-gate: when the org is DISABLED, non-owner members are logged
  // out entirely (force_logout above), but the OWNER can still sign in — they
  // must just be kept OUT of the dialer. Only owners query this; everyone else
  // skips it (no cost, no flash). The org:status:changed push flips it live.
  const isOwner = user?.role === 'owner';
  const orgStatusQ = useQuery({
    queryKey: ['org', 'lifecycle-status'],
    queryFn: () => orgApiService.getLifecycleStatus(),
    enabled: isOwner && !!user?.organizationId,
    staleTime: 60_000,
    refetchOnMount: 'always',
  });
  useSocketEvent<{ status?: string }>(REALTIME_EVENTS.ORG_STATUS_CHANGED, () => {
    qc.invalidateQueries({ queryKey: ['org', 'lifecycle-status'] });
  });
  // The disabled state is stored as 'suspended' on organizations.status (the enum
  // has no 'disabled'); the owner is gated out of the dialer while it's set.
  const orgDisabledForOwner = isOwner && orgStatusQ.data?.data?.status === 'suspended';

  // Listen for notification navigation events (client-side navigation without reload)
  useEffect(() => {
    const handleNavigate = (event: CustomEvent<{ path: string }>) => {
      const { path } = event.detail;
      console.log('[Navigation] Notification navigation to:', path);
      router.push(path);
    };

    window.addEventListener('app:navigate', handleNavigate as EventListener);
    return () => {
      window.removeEventListener('app:navigate', handleNavigate as EventListener);
    };
  }, [router]);

  // Gate AFTER all hooks (rules-of-hooks): a disabled org's owner gets the
  // "workspace disabled" screen in place of the dialer.
  if (orgDisabledForOwner) {
    return <WorkspaceDisabledScreen onSignOut={() => { logout(); router.push('/login'); }} />;
  }

  return <>{children}</>;
}

// Persistent DND + blocked number + phantom fork enforcement for the SIP connection lifetime.
// Subscribes to DND and blocked contacts queries so data is always fresh,
// then wires checkers into the SIP manager via refs (no stale closures).
function CallEnforcementProvider({ children }: { children: React.ReactNode }) {
  const { data: dndStatus } = useDndStatus();
  const { data: blockedContacts } = useBlockedContacts();
  const user = useAuthStore((s) => s.user);

  // Store latest values in refs so SIP manager callbacks always read current data
  const dndRef = React.useRef(dndStatus);
  const blockedRef = React.useRef(blockedContacts);
  const userRef = React.useRef(user);
  dndRef.current = dndStatus;
  blockedRef.current = blockedContacts;
  userRef.current = user;

  useEffect(() => {
    sipManager.setDndChecker(() => {
      return dndRef.current?.enabled ?? false;
    });

    sipManager.setBlockedChecker((number: string) => {
      const blocked = blockedRef.current;
      if (!blocked || blocked.length === 0) return false;
      return blocked.some((b) => phonesMatch(b.phoneNumber, number));
    });

    sipManager.setOwnNumberChecker((number: string) => {
      const u = userRef.current;
      return isOwnNumber(number, u?.senderPhone, u?.phoneNumbers);
    });

    return () => {
      sipManager.setDndChecker(null);
      sipManager.setBlockedChecker(null);
      sipManager.setOwnNumberChecker(null);
    };
  }, []);

  return <>{children}</>;
}

// Keyboard shortcuts provider for the phone app
function KeyboardShortcutsProvider({
  children,
  onShowShortcuts,
}: {
  children: React.ReactNode;
  onShowShortcuts: () => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { muteCall, unmuteCall, holdCall, unholdCall, endCall, lines, activeLineId } =
    useSipStore();

  // Get active line's state
  const activeLineState = activeLineId !== null ? lines.find((l) => l.id === activeLineId) : null;
  const hasActiveCall =
    activeLineState?.state === 'established' || activeLineState?.state === 'held';
  const isMuted = activeLineState?.isMuted || false;
  const isHeld = activeLineState?.state === 'held';

  // Navigation shortcuts
  const handleNavigatePhone = useCallback(() => router.push('/phone'), [router]);
  const handleNavigateHistory = useCallback(() => router.push('/phone/history'), [router]);
  const handleNavigateMessages = useCallback(() => router.push('/phone/messages'), [router]);
  const handleNavigateContacts = useCallback(() => router.push('/phone/contacts'), [router]);
  const handleNavigateVoicemail = useCallback(() => router.push('/phone/voicemail'), [router]);
  const handleNavigateSettings = useCallback(() => router.push('/phone/settings'), [router]);

  // Call control shortcuts (only active during a call)
  const handleMute = useCallback(() => {
    if (hasActiveCall && activeLineId !== null) {
      if (isMuted) {
        unmuteCall(activeLineId);
      } else {
        muteCall(activeLineId);
      }
    }
  }, [hasActiveCall, activeLineId, isMuted, muteCall, unmuteCall]);

  const handleHold = useCallback(() => {
    if (hasActiveCall && activeLineId !== null) {
      if (isHeld) {
        unholdCall(activeLineId);
      } else {
        holdCall(activeLineId);
      }
    }
  }, [hasActiveCall, activeLineId, isHeld, holdCall, unholdCall]);

  const handleHangUp = useCallback(() => {
    if (hasActiveCall && activeLineId !== null) {
      endCall(activeLineId);
    }
  }, [hasActiveCall, activeLineId, endCall]);

  // Register shortcuts
  useKeyboardShortcuts([
    // Navigation shortcuts (Ctrl/Cmd + number)
    {
      key: '1',
      ctrl: true,
      handler: handleNavigatePhone,
      description: 'Go to Phone',
      category: 'Navigation',
    },
    {
      key: '2',
      ctrl: true,
      handler: handleNavigateHistory,
      description: 'Go to History',
      category: 'Navigation',
    },
    {
      key: '3',
      ctrl: true,
      handler: handleNavigateMessages,
      description: 'Go to Messages',
      category: 'Navigation',
    },
    {
      key: '4',
      ctrl: true,
      handler: handleNavigateContacts,
      description: 'Go to Contacts',
      category: 'Navigation',
    },
    {
      key: '5',
      ctrl: true,
      handler: handleNavigateVoicemail,
      description: 'Go to Voicemail',
      category: 'Navigation',
    },
    {
      key: ',',
      ctrl: true,
      handler: handleNavigateSettings,
      description: 'Go to Settings',
      category: 'Navigation',
    },
    // Call control shortcuts
    {
      ...CALL_SHORTCUTS.mute,
      handler: handleMute,
      disabled: !hasActiveCall,
    },
    {
      ...CALL_SHORTCUTS.hold,
      handler: handleHold,
      disabled: !hasActiveCall,
    },
    {
      key: 'Escape',
      handler: handleHangUp,
      description: 'End call',
      category: 'Call Controls',
      disabled: !hasActiveCall,
    },
    // Help shortcut
    {
      key: '?',
      shift: true,
      handler: onShowShortcuts,
      description: 'Show keyboard shortcuts',
      category: 'Help',
    },
  ]);

  return <>{children}</>;
}

// All available shortcuts for the help modal
const ALL_PHONE_SHORTCUTS = [
  // Navigation
  { key: '1', ctrl: true, description: 'Go to Phone', category: 'Navigation' },
  { key: '2', ctrl: true, description: 'Go to History', category: 'Navigation' },
  { key: '3', ctrl: true, description: 'Go to Messages', category: 'Navigation' },
  { key: '4', ctrl: true, description: 'Go to Contacts', category: 'Navigation' },
  { key: '5', ctrl: true, description: 'Go to Voicemail', category: 'Navigation' },
  { key: ',', ctrl: true, description: 'Go to Settings', category: 'Navigation' },
  // Call Controls
  { key: 'm', description: 'Toggle mute (during call)', category: 'Call Controls' },
  { key: 'h', description: 'Toggle hold (during call)', category: 'Call Controls' },
  { key: 'Escape', description: 'End call (during call)', category: 'Call Controls' },
  // Help
  { key: '?', shift: true, description: 'Show keyboard shortcuts', category: 'Help' },
];


export default function PhoneLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { isAuthenticated, isLoading, _hasHydrated, checkAuth, user } = useAuthStore();

  // The dialer is for agents. Platform (super_admin) and tenant (admin) admins
  // have no SIP extension and manage from the admin panel — they don't belong
  // on /phone. Redirect them out (defense-in-depth beyond login routing).
  const isAdminRole = user?.role === 'super_admin' || user?.role === 'admin';
  const [isValidating, setIsValidating] = useState(true);

  const {
    isOpen: isShortcutsOpen,
    open: openShortcuts,
    close: closeShortcuts,
  } = useShortcutsModal();

  // Wait for hydration, then validate session with backend
  useEffect(() => {
    if (!_hasHydrated) return;

    const validateSession = async () => {
      // Already authenticated — render the dialer NOW and revalidate the session
      // in the BACKGROUND, instead of blocking behind a spinner on a redundant
      // /auth/me round-trip (this is what made the dialer slow to appear after
      // login). If the background check finds the session invalid, it clears auth
      // and the redirect effect below sends the user to /login.
      const { isAuthenticated: authed } = useAuthStore.getState();
      if (authed) {
        void checkAuth();
      }
      setIsValidating(false);
    };

    validateSession();
  }, [_hasHydrated, isAuthenticated, checkAuth]);

  // Redirect to login if not authenticated (after validation)
  useEffect(() => {
    if (isValidating || isLoading) return;
    if (!isAuthenticated) {
      router.replace('/login');
      return;
    }
    // Admins/super-admins don't use the dialer — send them to the admin panel
    // in a single cross-subdomain hop (no relative-redirect flash).
    if (isAdminRole) {
      redirectToAdminPanel(router);
    }
  }, [isAuthenticated, isLoading, isValidating, isAdminRole, router]);

  // Show loading while hydrating/validating — and while redirecting an admin
  // role out, so the dialer never flashes for them.
  if (!_hasHydrated || isValidating || isLoading || !isAuthenticated || isAdminRole) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-[var(--background)]">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-[var(--border)] border-t-transparent" />
      </div>
    );
  }

  return (
    <SocketProvider>
      <SipErrorBoundary
        onError={(error, errorType) => {
          console.error('[Phone Layout] SIP error caught:', errorType, error.message);
        }}
      >
        <SipProvider autoConnect={true} initializeAudio={true}>
          <QueryProvider>
            <ConfirmProvider>
              <AlertProvider>
                <ContactLookupProvider>
                  <RealtimeSyncProvider>
                    <WaCallProvider>
                      <CallEnforcementProvider>
                        <KeyboardShortcutsProvider onShowShortcuts={openShortcuts}>
                          <CommandPaletteProvider>
                            <div className="nx-dialer min-h-dvh bg-[var(--background)] flex flex-col">
                              {/* New UI shell — billing notification + full-width top bar + labeled rail. */}
                              <OrgBillingTopBar />
                              <DialerTopBar />
                              <div className="flex-1 flex min-h-0 overflow-hidden">
                                <DialerRail items={userNavItems} />
                                <main
                                  id="main-content"
                                  className="flex-1 px-4 pt-3 pb-4 md:px-6 md:pt-4 md:pb-6 overflow-auto min-h-0 relative"
                                  role="main"
                                  tabIndex={-1}
                                >
                                  <DialerAccessGuard>
                                    <ModuleGate>{children}</ModuleGate>
                                  </DialerAccessGuard>
                                </main>
                              </div>
                              {/* Mobile-only bottom nav (hidden at md+, where the rail shows) */}
                              <MobileBottomNav items={userNavItems} />
                            </div>
                            {/* Toast notifications */}
                            <ToastContainer />
                            {/* Rich notifications (calls, SMS, voicemail) */}
                            <RichNotificationContainer />
                            {/* Persistent call indicator - shows on all tabs when in a call */}
                            <ActiveCallIndicator />
                            {/* Floating call window (Document PiP) when the user leaves the tab mid-call */}
                            <CallPipWindow />
                            {/* WhatsApp call floating panel - shows on all pages */}
                            <WaCallFloatingPanel />
                            {/* Monitoring alert - shows when admin is monitoring/whispering/barging */}
                            <MonitoringAlert />
                            {/* Post-call disposition prompt (voicemail-QA) */}
                            <DispositionModal />
                            {/* Keyboard shortcuts help modal */}
                            <KeyboardShortcutsModal
                              isOpen={isShortcutsOpen}
                              onClose={closeShortcuts}
                              shortcuts={ALL_PHONE_SHORTCUTS}
                              title="Phone Keyboard Shortcuts"
                            />
                          </CommandPaletteProvider>
                        </KeyboardShortcutsProvider>
                      </CallEnforcementProvider>
                    </WaCallProvider>
                  </RealtimeSyncProvider>
                </ContactLookupProvider>
              </AlertProvider>
            </ConfirmProvider>
          </QueryProvider>
        </SipProvider>
      </SipErrorBoundary>
    </SocketProvider>
  );
}
