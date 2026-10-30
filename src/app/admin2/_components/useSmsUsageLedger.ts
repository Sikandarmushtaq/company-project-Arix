'use client';

/**
 * Shared live SMS-usage ledger for /admin2 — the SMS twin of useCallUsageLedger.
 * ONE source for the Organizations column, the Dashboard card, and the per-org
 * counter.
 *
 * NO POLLING. Initial fetch for the snapshot, then event-driven updates: the
 * backend emits `admin:sms_usage` (one org's row) on an SMS send / package grant /
 * cap change, and super-admins are auto-joined to the shared usage-ledger room on
 * socket connect (same room the call ledger uses). We patch the single row into the
 * React Query cache. Accurate + live, zero overhead between events.
 */

import { useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSocket } from '@/lib/providers/SocketProvider';
import { REALTIME_EVENTS } from '@/lib/constants/events';
import {
  getSmsUsageLedger,
  type SmsUsageLedger,
  type SmsUsageLedgerRow,
} from '@/lib/api/services/admin-analytics.api';

export const SMS_USAGE_LEDGER_KEY = ['admin2', 'sms-usage-ledger'] as const;

export function useSmsUsageLedger(enabled: boolean) {
  const qc = useQueryClient();
  const { socket } = useSocket();

  const query = useQuery({
    queryKey: SMS_USAGE_LEDGER_KEY,
    queryFn: () => getSmsUsageLedger(),
    enabled,
    staleTime: 60_000,
    refetchOnWindowFocus: true,
    // No refetchInterval — WS pushes keep it fresh (see below).
  });

  useEffect(() => {
    if (!enabled || !socket) return;
    const handler = (row: SmsUsageLedgerRow) => {
      qc.setQueryData<SmsUsageLedger>(SMS_USAGE_LEDGER_KEY, (prev) => {
        if (!prev) return prev;
        const idx = prev.rows.findIndex((r) => r.orgId === row.orgId);
        const rows = idx >= 0 ? prev.rows.map((r) => (r.orgId === row.orgId ? row : r)) : [row, ...prev.rows];
        return { ...prev, rows, generatedAt: new Date().toISOString() };
      });
    };
    socket.on(REALTIME_EVENTS.ADMIN_SMS_USAGE, handler);
    return () => {
      socket.off(REALTIME_EVENTS.ADMIN_SMS_USAGE, handler);
    };
  }, [enabled, socket, qc]);

  const byOrg = useMemo(
    () => new Map((query.data?.rows ?? []).map((r) => [r.orgId, r])),
    [query.data]
  );

  return {
    rows: query.data?.rows ?? [],
    byOrg,
    generatedAt: query.data?.generatedAt,
    isLoading: query.isLoading,
    /** true once the initial snapshot has loaded (so callers don't mislabel while loading). */
    ready: !query.isLoading && query.data != null,
    live: !!socket,
  };
}
