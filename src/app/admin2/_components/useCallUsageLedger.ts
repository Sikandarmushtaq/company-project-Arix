'use client';

/**
 * Shared live call-usage ledger for /admin2 — ONE source for the Organizations
 * column, Dashboard card, Notifications, and the per-org counter.
 *
 * NO POLLING. Initial fetch for the snapshot, then event-driven updates: the
 * backend emits `admin:call_usage` (one org's row) on a CALL-END or CAP-CHANGE,
 * and super-admins are auto-joined to the ledger room on socket connect. We patch
 * the single row into the React Query cache — identical to the old /admin/usage
 * page. Accurate + live, zero overhead between events.
 */

import { useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSocket } from '@/lib/providers/SocketProvider';
import { REALTIME_EVENTS } from '@/lib/constants/events';
import {
  getCallUsageLedger,
  type CallUsageLedger,
  type CallUsageLedgerRow,
} from '@/lib/api/services/admin-analytics.api';

export const CALL_USAGE_LEDGER_KEY = ['admin2', 'call-usage-ledger'] as const;

export function useCallUsageLedger(enabled: boolean) {
  const qc = useQueryClient();
  const { socket } = useSocket();

  const query = useQuery({
    queryKey: CALL_USAGE_LEDGER_KEY,
    queryFn: () => getCallUsageLedger(),
    enabled,
    staleTime: 60_000,
    refetchOnWindowFocus: true,
    // No refetchInterval — WS pushes keep it fresh (see below).
  });

  useEffect(() => {
    if (!enabled || !socket) return;
    const handler = (row: CallUsageLedgerRow) => {
      qc.setQueryData<CallUsageLedger>(CALL_USAGE_LEDGER_KEY, (prev) => {
        if (!prev) return prev;
        const idx = prev.rows.findIndex((r) => r.orgId === row.orgId);
        const rows = idx >= 0 ? prev.rows.map((r) => (r.orgId === row.orgId ? row : r)) : [row, ...prev.rows];
        return { ...prev, rows, generatedAt: new Date().toISOString() };
      });
    };
    socket.on(REALTIME_EVENTS.ADMIN_CALL_USAGE, handler);
    return () => {
      socket.off(REALTIME_EVENTS.ADMIN_CALL_USAGE, handler);
    };
  }, [enabled, socket, qc]);

  const byOrg = useMemo(
    () => new Map((query.data?.rows ?? []).map((r) => [r.orgId, r])),
    [query.data]
  );

  return {
    rows: query.data?.rows ?? [],
    byOrg,
    defaultMinutes: query.data?.defaultMinutes ?? 0,
    generatedAt: query.data?.generatedAt,
    isLoading: query.isLoading,
    /** true once the initial snapshot has loaded (so callers don't mislabel while loading). */
    ready: !query.isLoading && query.data != null,
    live: !!socket,
  };
}
