'use client';

/**
 * PhoneProviders Component
 *
 * Consolidates the deeply nested provider tree from the phone layout
 * into a single wrapper component. Each provider is documented.
 *
 * @module app/phone/PhoneProviders
 */

import React, { useEffect, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { SipProvider } from '@/lib/providers';
import { QueryProvider } from '@/lib/providers';
import { SocketProvider, useSocketEvent } from '@/lib/providers/SocketProvider';
import { ContactLookupProvider } from '@/lib/providers/ContactLookupProvider';
import { useRealtimeSync, ConfirmProvider, AlertProvider, useBlockedContacts } from '@/lib/hooks';
import { useDndStatus } from '@/lib/hooks/useUserSettings';
// Engine router (SIP.js or LiveKit, whichever is active) — see lib/call/call-engine.
import { callEngine as sipManager } from '@/lib/call/call-engine';
import { phonesMatch, isOwnNumber } from '@/lib/utils/phone';
import { useSipStore } from '@/lib/stores/sip';
import { useAuthStore } from '@/lib/stores';
import { SipErrorBoundary, CommandPaletteProvider } from '@/components/ui';
import { useKeyboardShortcuts, CALL_SHORTCUTS } from '@/lib/hooks/useKeyboardShortcuts';

// ============================================================
// Internal Provider Components
// ============================================================

/**
 * Enables real-time cache sync and handles force logout.
 */
function RealtimeSyncProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { logout } = useAuthStore();
  const { disconnect, lines } = useSipStore();

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

  return <>{children}</>;
}

/**
 * Persistent DND + blocked number enforcement for the SIP connection lifetime.
 * Subscribes to DND and blocked contacts queries so data is always fresh,
 * then wires checkers into the SIP manager via refs (no stale closures).
 */
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

    // Phantom fork detection: FreeSWITCH parallel-forks to both Kamailio
    // nodes, and one fork can arrive with the user's own number in
    // remoteIdentity. This checker lets SipCallManager silently ignore it.
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

/**
 * Keyboard shortcuts provider for the phone app.
 */
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

// ============================================================
// Public PhoneProviders Wrapper
// ============================================================

interface PhoneProvidersProps {
  children: React.ReactNode;
  onShowShortcuts: () => void;
  onSipError: (error: Error, errorType: string) => void;
}

export function PhoneProviders({ children, onShowShortcuts, onSipError }: PhoneProvidersProps) {
  return (
    <SocketProvider>
      <SipErrorBoundary onError={onSipError}>
        <SipProvider autoConnect={true} initializeAudio={true}>
          <QueryProvider>
            <ConfirmProvider>
              <AlertProvider>
                <ContactLookupProvider>
                  <RealtimeSyncProvider>
                    <CallEnforcementProvider>
                      <KeyboardShortcutsProvider onShowShortcuts={onShowShortcuts}>
                        <CommandPaletteProvider>{children}</CommandPaletteProvider>
                      </KeyboardShortcutsProvider>
                    </CallEnforcementProvider>
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
