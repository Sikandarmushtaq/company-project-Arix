'use client';

import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSocket } from '@/lib/providers/SocketProvider';
import { bundleApiService, type BundleState, type BundleSlug } from '@/lib/api/services/bundle.service';
import { orgKeys } from '@/lib/hooks/useOrg';
import { REALTIME_EVENTS } from '@/lib/constants/events';
import { toast } from '@/lib/stores/toast';

export const bundleKeys = { state: ['bundles'] as const };

/**
 * Live bundle state for Plan & billing. Fetches once, then stays current via the
 * `bundle:updated` push (bought/switched/canceled/renewed) — no polling. Also
 * refreshes the call-verification usage on a bundle change so the dialer/SMS
 * pills reflect the new allowance for every member in the room.
 */
export function useBundles() {
  const qc = useQueryClient();
  const { socket } = useSocket();

  const query = useQuery({
    queryKey: bundleKeys.state,
    queryFn: async () => (await bundleApiService.getState()).data,
    staleTime: 30_000,
  });

  useEffect(() => {
    if (!socket) return;
    const handler = (state: BundleState) => {
      qc.setQueryData(bundleKeys.state, state);
      qc.invalidateQueries({ queryKey: orgKeys.callVerification });
      // A bundle change is a prorated charge/credit on the subscription — refresh
      // billing so the new invoice + amount show up (else it looks free).
      qc.invalidateQueries({ queryKey: orgKeys.billing });
    };
    // A usage push (call ended / SMS sent) means the active bundle's meters moved
    // — refetch the bundle state so the Plan & billing meters stay live too.
    const usageHandler = () => qc.invalidateQueries({ queryKey: bundleKeys.state });
    socket.on(REALTIME_EVENTS.BUNDLE_UPDATED, handler);
    socket.on(REALTIME_EVENTS.CALL_VERIFICATION_USAGE, usageHandler);
    return () => {
      socket.off(REALTIME_EVENTS.BUNDLE_UPDATED, handler);
      socket.off(REALTIME_EVENTS.CALL_VERIFICATION_USAGE, usageHandler);
    };
  }, [socket, qc]);

  return query;
}

export function usePurchaseBundle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (slug: BundleSlug) => bundleApiService.purchase(slug),
    onSuccess: (res) => {
      qc.setQueryData(bundleKeys.state, res.data);
      qc.invalidateQueries({ queryKey: orgKeys.callVerification });
      qc.invalidateQueries({ queryKey: orgKeys.billing });
      toast.success(res.message || 'Bundle activated');
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Could not activate the bundle'),
  });
}

export function useCancelBundle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => bundleApiService.cancel(),
    onSuccess: (res) => {
      qc.setQueryData(bundleKeys.state, res.data);
      qc.invalidateQueries({ queryKey: orgKeys.callVerification });
      qc.invalidateQueries({ queryKey: orgKeys.billing });
      toast.success(res.message || 'Bundle canceled');
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Could not cancel the bundle'),
  });
}
