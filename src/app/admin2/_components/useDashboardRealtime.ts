'use client';

/**
 * admin2 dashboard realtime sync — turns the dashboard live over WebSocket so it
 * reflects reality without a manual refresh. It does NOT poll: each backend push
 * invalidates only the matching (active) React Query, which then refetches.
 *
 * Push sources (all emitted to the admin dashboard room, which super_admin now
 * joins — see websocket/server.ts):
 *   • admin:health:update / admin:stats:update / user+session+device events
 *     → the stats payload (service status, active users/sessions, and recent
 *       activity, which recomputes on each stats refetch)  → adminKeys.stats()
 *   • signup:sms_review:updated                 → signup review stats + queue
 *   • org:status:changed                        → stats + org directory + signups
 *   • admin:purchase:request                    → purchase pending badge + queue
 *   • call:* (start/end/…)                      → the live active-call count
 *
 * The near-cap card is already live via its own ledger socket (useCallUsageLedger)
 * and is intentionally not duplicated here.
 */

import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSocket } from '@/lib/providers/SocketProvider';
import { REALTIME_EVENTS } from '@/lib/constants/events';
import { adminKeys } from '@/lib/hooks/useAdmin';

/**
 * The backend broadcasts a health pulse every 10s, and user/session/device churn
 * can also burst. Refetching the full stats payload (DB/Redis/telephony health
 * checks + counts) on every one of those would be wasteful, so the stats refetch
 * is throttled to at most once per this window. User-facing queues (signups,
 * purchases, calls) are NOT throttled — those invalidate immediately.
 */
const STATS_REFETCH_MIN_INTERVAL_MS = 20_000;

export function useDashboardRealtime(enabled: boolean): void {
  const { socket } = useSocket();
  const qc = useQueryClient();
  const lastStatsAt = useRef(0);

  useEffect(() => {
    if (!enabled || !socket) return;

    // The dashboard "stats" payload carries metrics + service status + recent
    // activity, so anything that changes any of those invalidates it — throttled
    // (leading-edge) so the 10s health heartbeat can't trigger a refetch storm.
    const invalidateStats = () => {
      const now = Date.now();
      if (now - lastStatsAt.current < STATS_REFETCH_MIN_INTERVAL_MS) return;
      lastStatsAt.current = now;
      qc.invalidateQueries({ queryKey: adminKeys.stats() });
    };
    const statsEvents = [
      REALTIME_EVENTS.ADMIN_HEALTH_UPDATE,
      REALTIME_EVENTS.ADMIN_STATS_UPDATE,
      REALTIME_EVENTS.ADMIN_USER_CREATED,
      REALTIME_EVENTS.ADMIN_USER_UPDATED,
      REALTIME_EVENTS.ADMIN_USER_DELETED,
      REALTIME_EVENTS.ADMIN_USER_BANNED,
      REALTIME_EVENTS.ADMIN_USER_UNBANNED,
      REALTIME_EVENTS.ADMIN_SESSION_CREATED,
      REALTIME_EVENTS.ADMIN_SESSION_TERMINATED,
      REALTIME_EVENTS.ADMIN_SESSION_ALL_TERMINATED,
      REALTIME_EVENTS.ADMIN_DEVICE_CONNECTED,
      REALTIME_EVENTS.ADMIN_DEVICE_DISCONNECTED,
      REALTIME_EVENTS.USER_ONLINE,
      REALTIME_EVENTS.USER_OFFLINE,
    ];

    const onSignup = () => {
      qc.invalidateQueries({ queryKey: ['admin2', 'signup-stats'] });
      qc.invalidateQueries({ queryKey: ['admin2', 'signup-reviews'] });
    };
    const onOrgStatus = () => {
      invalidateStats();
      qc.invalidateQueries({ queryKey: adminKeys.organizations() });
      qc.invalidateQueries({ queryKey: ['admin2', 'signup-stats'] });
    };
    const onPurchase = () => {
      qc.invalidateQueries({ queryKey: ['admin2', 'addon-pending-count'] });
      qc.invalidateQueries({ queryKey: ['admin2', 'addon-requests'] });
    };
    // Use the ADMIN-scoped call events — the plain call:* events are emitted to
    // the caller's phone room (emitToPhone), NOT to admins, so they never reach a
    // super_admin. These three go to the admin dashboard room via emitToAdmins.
    const onCall = () => qc.invalidateQueries({ queryKey: ['admin2', 'live-calls'] });
    const callEvents = [
      REALTIME_EVENTS.ADMIN_CALL_ACTIVE,
      REALTIME_EVENTS.ADMIN_CALL_ENDED,
      REALTIME_EVENTS.ADMIN_CALLS_REFRESHED,
    ];

    statsEvents.forEach((e) => socket.on(e, invalidateStats));
    callEvents.forEach((e) => socket.on(e, onCall));
    socket.on(REALTIME_EVENTS.SIGNUP_SMS_REVIEW_UPDATED, onSignup);
    socket.on(REALTIME_EVENTS.ORG_STATUS_CHANGED, onOrgStatus);
    socket.on(REALTIME_EVENTS.ADMIN_PURCHASE_REQUEST, onPurchase);

    return () => {
      statsEvents.forEach((e) => socket.off(e, invalidateStats));
      callEvents.forEach((e) => socket.off(e, onCall));
      socket.off(REALTIME_EVENTS.SIGNUP_SMS_REVIEW_UPDATED, onSignup);
      socket.off(REALTIME_EVENTS.ORG_STATUS_CHANGED, onOrgStatus);
      socket.off(REALTIME_EVENTS.ADMIN_PURCHASE_REQUEST, onPurchase);
    };
  }, [enabled, socket, qc]);
}
