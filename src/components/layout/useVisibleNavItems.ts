'use client';

import { useMemo } from 'react';
import { usePermissions } from '@/lib/hooks/usePermissions';
import { useAuthStore } from '@/lib/stores';
import { useWaStatus } from '@/lib/hooks';
import type { NavItem } from './Sidebar';

// The reskin (arixcall) does NOT offer WhatsApp. This is a build-time flag
// (unset → false on the reskin), so WhatsApp nav/URLs are blocked SYNCHRONOUSLY
// and never flash during the initial data load. A nuxcall-style build sets
// NEXT_PUBLIC_ENABLE_WHATSAPP=true to restore the per-user runtime gating.
const WHATSAPP_UI_ENABLED = process.env.NEXT_PUBLIC_ENABLE_WHATSAPP === 'true';

/**
 * Whether a phone page is BLOCKED for the current user. Two layers must BOTH be
 * allowed for a page to show:
 *   1. Org module entitlement (super-admin grant, `tenant_module_entitlements`).
 *   2. Per-user access flag from the Edit User modal — WhatsApp (`waEnabled`),
 *      Auto-Dialer (`autoDialerEnabled`). Bulk SMS / Auto-SMS is NOT per-user: it
 *      is gated purely at the ORG level by the `sms` + `auto_sms` tenant modules
 *      (enabled for the org ⇒ available to every user in it). Per-user `smsType`
 *      only selects the sending gateway, never page access.
 * A page is blocked if EITHER layer is off. These pages are hidden from the nav
 * AND redirected away from their URL (see ModuleGate). Fail-open while loading —
 * never hide/redirect before we know the real state. Per-user flags live-sync
 * over WebSocket (useRealtimeCacheSync), so admin toggles apply without refresh.
 */
export function usePhonePageAccess() {
  const { user } = useAuthStore();
  const { data: waStatus, isLoading: waLoading } = useWaStatus();
  const { modules, isLoading: permLoading } = usePermissions();
  const isLoading = waLoading || permLoading;

  const waEnabled = waStatus?.waEnabled;
  const autoDialerEnabled = user?.autoDialerEnabled;
  const userLoaded = !!user;

  const isBlocked = useMemo(() => {
    const moduleOn = (code: string) => modules?.[code] !== false;
    return (href: string): boolean => {
      // WhatsApp is blocked SYNCHRONOUSLY (before the loading fail-open) so it
      // never flashes in the nav. On the reskin WHATSAPP_UI_ENABLED is false, so
      // it's always blocked; a WhatsApp-enabled build keeps the runtime gating.
      if (href === '/phone/whatsapp' || href === '/phone/whatsapp-calls') {
        if (!WHATSAPP_UI_ENABLED) return true;
        if (isLoading) return false;
        return waEnabled === false || !moduleOn('whatsapp');
      }
      if (isLoading) return false; // fail-open
      switch (href) {
        case '/phone/auto-dialer':
          // Mirrors the Auto-Dialer page's gate (`autoDialerEnabled ?? false`):
          // enabled only if strictly true. The flag rides the login/user payload
          // and can be undefined at runtime, so `=== false` alone would miss it.
          if (!moduleOn('autodialer')) return true;
          if (!userLoaded) return false; // fail-open until store hydrates
          return autoDialerEnabled !== true;
        case '/phone/bulk-sms':
          // Auto-SMS is an ORG-level module — enabled for the org ⇒ available to
          // EVERY user in it (no per-user gate). Needs SMS + Auto-SMS modules on.
          return !moduleOn('sms') || !moduleOn('auto_sms');
        default:
          return false;
      }
    };
  }, [isLoading, waEnabled, autoDialerEnabled, userLoaded, modules]);

  return { isBlocked, isLoading };
}

/**
 * Filters nav items so pages blocked for this user (org module OR per-user flag)
 * are dropped from the menu — instead of showing a "Not subscribed / not enabled"
 * page.
 */
export function useVisibleNavItems(items: NavItem[]): NavItem[] {
  const { isBlocked } = usePhonePageAccess();
  return useMemo(() => items.filter((item) => !isBlocked(item.href)), [items, isBlocked]);
}
