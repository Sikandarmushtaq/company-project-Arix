'use client';

/**
 * Support Ring Banner (super-admin only).
 *
 * Mounted in the admin layout so it persists across every admin page. Listens
 * for support events and, while any ticket is unclaimed-and-ringing, plays the
 * distinct support tone and shows a persistent banner. The ring stops when the
 * ticket is claimed / read / closed, or when this admin opens the inbox.
 *
 * @module components/support/SupportRingBanner
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { FiBell, FiLifeBuoy, FiX } from 'react-icons/fi';
import { useSocket } from '@/lib/providers/SocketProvider';
import { useAuthStore } from '@/lib/stores/auth';
import { REALTIME_EVENTS } from '@/lib/constants/events';
import { supportKeys } from '@/lib/hooks/useSupport';
import { supportApi } from '@/lib/api/services/support.api';
import { playSupportRing, stopSupportRing } from '@/lib/support-ring';
import { useAfkPresence } from '@/lib/hooks/useAfkPresence';
import {
  getNotificationPermission,
  requestNotificationPermission,
  showDesktopNotification,
  type NotifyPermission,
} from '@/lib/notifications/desktop-notify';

interface RingItem {
  id: number;
  subject: string;
  who: string;
}
interface TicketPayload {
  ticket?: { id: number; subject?: string; userName?: string | null };
  toAdminId?: number;
  ticketId?: number;
}

export function SupportRingBanner() {
  const { socket, isConnected } = useSocket();
  const qc = useQueryClient();
  const router = useRouter();
  const pathname = usePathname();
  // While the admin is actually on the inbox they can see every waiting ticket,
  // so suppress the audible ring + banner there (but keep ringing everywhere else
  // until a ticket is CLAIMED — a viewed-but-unclaimed ticket must keep nagging).
  const onInbox = pathname === '/admin/support';
  const seededRef = useRef(false);
  const [ringing, setRinging] = useState<Map<number, RingItem>>(new Map());
  const [notifPerm, setNotifPerm] = useState<NotifyPermission>('default');

  // Emit this super-admin's AFK/at-the-desk heartbeat (feeds server-side
  // escalation: when nobody is present, a waiting ticket gets an off-seat alert).
  useAfkPresence();

  // Read the real notification permission after hydration. This MUST be an
  // effect, not a lazy initializer: the value drives what's rendered, so the
  // first client render has to match the server's ('default') to avoid a
  // hydration mismatch — we correct to the actual permission once mounted.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional SSR-safe post-hydration read
    setNotifPerm(getNotificationPermission());
  }, []);

  const enableAlerts = useCallback(async () => {
    setNotifPerm(await requestNotificationPermission());
  }, []);

  const refreshInbox = useCallback(() => {
    qc.invalidateQueries({ queryKey: supportKeys.adminTickets() });
    qc.invalidateQueries({ queryKey: [...supportKeys.all, 'admin-messages'] });
  }, [qc]);

  useEffect(() => {
    if (!socket || !isConnected) return;

    const add = (p: TicketPayload) => {
      if (!p?.ticket?.id) return;
      setRinging((prev) => {
        const next = new Map(prev);
        next.set(p.ticket!.id, {
          id: p.ticket!.id,
          subject: p.ticket!.subject || 'Support request',
          who: p.ticket!.userName || 'A user',
        });
        return next;
      });
    };
    const remove = (id?: number) => {
      if (!id) return;
      setRinging((prev) => {
        if (!prev.has(id)) return prev;
        const next = new Map(prev);
        next.delete(id);
        return next;
      });
    };

    const onNew = (p: TicketPayload) => {
      add(p);
      refreshInbox();
      // If this super-admin isn't looking at the tab (another tab / another
      // app / minimised), pop an OS desktop notification so they see it anyway.
      // The in-tab ring + banner still cover the focused case.
      const unfocused =
        typeof document !== 'undefined' && (document.hidden || !document.hasFocus());
      if (unfocused && p?.ticket?.id) {
        showDesktopNotification('New support request', {
          body: `${p.ticket.userName || 'A user'}: ${p.ticket.subject || 'Support request'}`,
          tag: `support-${p.ticket.id}`,
          onClick: () => router.push('/admin/support'),
        });
      }
    };
    const onTransferred = (p: TicketPayload) => {
      refreshInbox();
      const myId = useAuthStore.getState().user?.id;
      if (p.toAdminId && myId && p.toAdminId === myId) add(p);
      else remove(p.ticket?.id);
    };
    const onClaimed = (p: TicketPayload) => {
      remove(p.ticket?.id);
      refreshInbox();
    };
    const onClosed = (p: TicketPayload) => {
      remove(p.ticket?.id);
      refreshInbox();
    };
    const onMessage = () => refreshInbox();

    socket.on(REALTIME_EVENTS.SUPPORT_TICKET_NEW, onNew);
    socket.on(REALTIME_EVENTS.SUPPORT_TRANSFERRED, onTransferred);
    socket.on(REALTIME_EVENTS.SUPPORT_CLAIMED, onClaimed);
    socket.on(REALTIME_EVENTS.SUPPORT_CLOSED, onClosed);
    socket.on(REALTIME_EVENTS.SUPPORT_MESSAGE, onMessage);
    return () => {
      socket.off(REALTIME_EVENTS.SUPPORT_TICKET_NEW, onNew);
      socket.off(REALTIME_EVENTS.SUPPORT_TRANSFERRED, onTransferred);
      socket.off(REALTIME_EVENTS.SUPPORT_CLAIMED, onClaimed);
      socket.off(REALTIME_EVENTS.SUPPORT_CLOSED, onClosed);
      socket.off(REALTIME_EVENTS.SUPPORT_MESSAGE, onMessage);
    };
  }, [socket, isConnected, refreshInbox, router]);

  // (#1) Seed the ring from already-open (unclaimed) tickets on every (re)connect,
  // so a request submitted while every super-admin was offline still rings the
  // moment one comes online — not only on the next live event.
  useEffect(() => {
    if (!socket || !isConnected) {
      seededRef.current = false; // re-seed on the next reconnect
      return;
    }
    if (seededRef.current) return;
    seededRef.current = true;
    let cancelled = false;
    supportApi
      .listTickets('open')
      .then((res) => {
        if (cancelled) return;
        const open = res?.items ?? [];
        if (open.length === 0) return;
        setRinging((prev) => {
          const next = new Map(prev);
          for (const t of open) {
            if (!next.has(t.id)) {
              next.set(t.id, {
                id: t.id,
                subject: t.subject || 'Support request',
                who: t.userName || 'A user',
              });
            }
          }
          return next;
        });
      })
      .catch(() => {
        /* best-effort seed — a live event will still ring subsequent tickets */
      });
    return () => {
      cancelled = true;
    };
  }, [socket, isConnected]);

  // Play/stop the distinct support tone while anything is ringing — but stay
  // silent while the admin is on the inbox itself (they can already see them).
  useEffect(() => {
    if (ringing.size > 0 && !onInbox) playSupportRing();
    else stopSupportRing();
    return () => stopSupportRing();
  }, [ringing.size, onInbox]);

  // Just navigate — do NOT clear the ring. Unclaimed tickets keep nagging once
  // the admin leaves the inbox; only CLAIM/close removes them (ring-until-claimed).
  const openInbox = useCallback(() => {
    router.push('/admin/support');
  }, [router]);

  const dismiss = useCallback(() => {
    stopSupportRing();
    setRinging(new Map());
  }, []);

  const items = Array.from(ringing.values());
  const count = items.length;
  const showBanner = count > 0 && !onInbox;
  // Offer to turn on OS desktop pop-ups while permission is still undecided, so a
  // super-admin can grant it BEFORE the first ticket arrives — from a real click,
  // never an auto-prompt on load.
  const showEnable = notifPerm === 'default';

  if (!showBanner && !showEnable) return null;

  if (!showBanner) {
    return (
      <div className="fixed bottom-6 right-6 z-[100] flex max-w-[calc(100vw-2rem)] items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 shadow-2xl">
        <FiBell className="h-4 w-4 shrink-0 text-[var(--coral-700)]" />
        <span className="text-sm text-[var(--foreground)]">Get desktop alerts for support</span>
        <button
          type="button"
          onClick={enableAlerts}
          className="ml-1 shrink-0 rounded-lg bg-[var(--coral)] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[var(--coral-700)]"
        >
          Enable
        </button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-[100] w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-2xl">
      <div className="flex items-center gap-2 border-b border-[var(--border)] bg-[var(--coral)] px-4 py-2.5 text-white">
        <span className="relative flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-white" />
        </span>
        <FiLifeBuoy className="h-4 w-4" />
        <span className="text-sm font-semibold">
          {count} support {count === 1 ? 'request' : 'requests'} waiting
        </span>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Silence"
          className="ml-auto rounded p-1 hover:bg-white/20"
        >
          <FiX className="h-4 w-4" />
        </button>
      </div>
      <div className="max-h-40 overflow-y-auto px-4 py-2">
        {items.slice(0, 4).map((it) => (
          <div key={it.id} className="border-b border-[var(--border)] py-1.5 last:border-0">
            <p className="text-xs font-medium text-[var(--foreground)]">{it.who}</p>
            <p className="truncate text-xs text-[var(--muted-foreground)]">{it.subject}</p>
          </div>
        ))}
        {count > 4 && (
          <p className="pt-1 text-xs text-[var(--muted-foreground)]">+{count - 4} more…</p>
        )}
      </div>
      <div className="space-y-2 p-3">
        {showEnable && (
          <button
            type="button"
            onClick={enableAlerts}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-[var(--coral)]/40 px-4 py-2 text-xs font-semibold text-[var(--coral-700)] transition hover:bg-[var(--coral)]/10"
          >
            <FiBell className="h-3.5 w-3.5" />
            Enable desktop alerts
          </button>
        )}
        <button
          type="button"
          onClick={openInbox}
          className="w-full rounded-lg bg-[var(--coral)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--coral-700)]"
        >
          Open support inbox
        </button>
      </div>
    </div>
  );
}
