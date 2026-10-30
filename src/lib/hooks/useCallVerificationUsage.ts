'use client';

import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSocket } from '@/lib/providers/SocketProvider';
import { useAuthStore } from '@/lib/stores/auth';
import { orgApiService, type OrgCallVerification } from '@/lib/api/services/org.service';
import { orgKeys } from '@/lib/hooks/useOrg';
import { REALTIME_EVENTS } from '@/lib/constants/events';

/**
 * Live KYC trial-usage snapshot for the current org. Fetches the initial snapshot
 * once (only when the signed-in user is actually capped, so verified/prod users
 * make zero requests), then keeps it current via the `call_verification:usage`
 * WebSocket push — NO polling. Returns `undefined` for uncapped users so callers
 * render nothing.
 */
export function useCallVerificationUsage(): OrgCallVerification | undefined {
  const user = useAuthStore((s) => s.user);
  // This is the RESKIN-ONLY frontend, so every signed-in user is an arixcall user.
  // Metered orgs (pending/rejected/approved) draw the usage pills; 'not_required'
  // (admin-created unlimited) is now ALSO fetched because it can hit the hidden call
  // soft cap → the snapshot's `callsBlocked` drives the neutral "contact admin"
  // banner. The backend returns a cheap all-zeros snapshot for an unblocked org.
  const enabled = !!user?.callVerificationStatus;
  const queryClient = useQueryClient();
  const { socket } = useSocket();

  const { data } = useQuery({
    queryKey: orgKeys.callVerification,
    queryFn: async () => (await orgApiService.getCallVerification()).data,
    enabled,
    staleTime: 30_000,
    // Always refetch when the dialer/Messages page mounts, so opening it right
    // after buying/canceling a package (elsewhere) shows the new allowance without
    // a manual refresh. While the page stays open, the CALL_VERIFICATION_USAGE
    // WebSocket push keeps it live.
    refetchOnMount: 'always',
  });

  useEffect(() => {
    if (!enabled || !socket) return;
    // The pushed snapshot is ORG-level (one payload for all members), but the call
    // block is PER-USER. So treat the event as a "something changed" trigger and
    // REFETCH our own snapshot — the GET resolves this user's own block state. This
    // is event-driven (WS), NOT polling: it fires only on a real change (call-end,
    // cap change), so raising this user's cap clears their banner in real time.
    const handler = () => {
      void queryClient.invalidateQueries({ queryKey: orgKeys.callVerification });
    };
    socket.on(REALTIME_EVENTS.CALL_VERIFICATION_USAGE, handler);
    return () => {
      socket.off(REALTIME_EVENTS.CALL_VERIFICATION_USAGE, handler);
    };
  }, [enabled, socket, queryClient]);

  return enabled ? data : undefined;
}
