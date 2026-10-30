'use client';

/**
 * useAfkPresence — super-admin "at the desk" heartbeat for support.
 *
 * Emits `support:presence {status}` transitions over the socket so the backend
 * knows whether a super-admin is actually watching, not merely connected. A web
 * page can only observe activity in its OWN tab, so "away" here means "not on
 * this tab right now" (idle 3 min, tab hidden, or window blurred) — which is
 * exactly the moment the backend should consider escalating a waiting ticket.
 *
 * Emission is transition-based + throttled: we send `active` on interaction (at
 * most once per heartbeat window, so the server's decay timer stays fresh) and
 * `away` once activity stops. Mount this only for super-admins.
 *
 * @module lib/hooks/useAfkPresence
 */

import { useEffect } from 'react';
import { useSocket } from '@/lib/providers/SocketProvider';
import { REALTIME_EVENTS } from '@/lib/constants/events';

/** Idle with no interaction for this long → away. Mirrors the server default. */
const IDLE_MS = 180_000; // 3 min
/** While active, re-assert `active` at most this often (keeps server fresh). */
const HEARTBEAT_MS = 60_000;

const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'click'];

export function useAfkPresence({ enabled = true }: { enabled?: boolean } = {}): void {
  const { socket, isConnected } = useSocket();

  useEffect(() => {
    if (!enabled || !socket || !isConnected) return;

    let status: 'active' | 'away' = 'active';
    let lastEmitAt = 0;
    let idleTimer: ReturnType<typeof setTimeout> | null = null;

    const emit = (next: 'active' | 'away') => {
      status = next;
      lastEmitAt = Date.now();
      socket.emit(REALTIME_EVENTS.SUPPORT_PRESENCE, { status: next });
    };

    const armIdle = () => {
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        if (status !== 'away') emit('away');
      }, IDLE_MS);
    };

    const goActive = () => {
      if (status === 'away') emit('active');
      else if (Date.now() - lastEmitAt >= HEARTBEAT_MS) emit('active');
      armIdle();
    };

    const goAwayNow = () => {
      if (idleTimer) {
        clearTimeout(idleTimer);
        idleTimer = null;
      }
      if (status !== 'away') emit('away');
    };

    const onActivity = () => {
      if (typeof document !== 'undefined' && document.hidden) return;
      goActive();
    };
    const onVisibility = () => {
      if (document.hidden) goAwayNow();
      else goActive();
    };

    ACTIVITY_EVENTS.forEach((e) => window.addEventListener(e, onActivity, { passive: true }));
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('focus', goActive);
    window.addEventListener('blur', goAwayNow);

    // Seed initial state on (re)connect.
    const startHidden = typeof document !== 'undefined' && document.hidden;
    emit(startHidden ? 'away' : 'active');
    if (!startHidden) armIdle();

    return () => {
      ACTIVITY_EVENTS.forEach((e) => window.removeEventListener(e, onActivity));
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('focus', goActive);
      window.removeEventListener('blur', goAwayNow);
      if (idleTimer) clearTimeout(idleTimer);
    };
  }, [enabled, socket, isConnected]);
}
