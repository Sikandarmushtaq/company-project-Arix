'use client';

/**
 * Usage hub → Calls ledger (default tab).
 *
 * Real, live per-org outbound call minutes this calendar month vs the HIDDEN
 * fair-use soft cap. Super-admin only — these are real numbers the customer never
 * sees. Initial fetch + live `admin:call_usage` WebSocket patches (no polling);
 * refetches on window focus as a safety net.
 *
 * @module app/admin/usage/page
 */

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  FiSearch,
  FiRefreshCw,
  FiAlertTriangle,
  FiSettings,
  FiBriefcase,
  FiSlash,
  FiTarget,
  FiActivity,
} from 'react-icons/fi';
import { Card, CardContent, Button, Input } from '@/components/ui';
import { usePermissions } from '@/lib/hooks/usePermissions';
import { useSocket } from '@/lib/providers/SocketProvider';
import { REALTIME_EVENTS } from '@/lib/constants/events';
import {
  getCallUsageLedger,
  type CallUsageLedger,
  type CallUsageLedgerRow,
} from '@/lib/api/services/admin-analytics.api';

const LEDGER_KEY = ['admin', 'call-usage-ledger'] as const;

/** "1,234" with thousands separators; tabular so columns line up. */
function num(n: number): string {
  return n.toLocaleString();
}

/** A calm, semantic status chip for the verification tier. */
function StatusChip({ status }: { status: string }) {
  const map: Record<string, string> = {
    approved: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
    not_required: 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/30',
  };
  const label = status === 'approved' ? 'Verified' : status === 'not_required' ? 'Admin-created' : status;
  const cls = map[status] ?? 'bg-[var(--muted)] text-[var(--muted-foreground)] border-[var(--border)]';
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${cls}`}>
      {label}
    </span>
  );
}

/** Usage bar + percent. Amber ≥80%, red when blocked/over. Null cap = unlimited. */
function UsageBar({ row }: { row: CallUsageLedgerRow }) {
  if (row.capMinutes == null) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-[var(--muted-foreground)]">
        <span aria-hidden className="text-sm leading-none">∞</span>
        Unlimited
      </span>
    );
  }
  const pct = Math.min(1, row.pctUsed ?? 0);
  const over = (row.pctUsed ?? 0) >= 1 || row.blocked;
  const near = !over && pct >= 0.8;
  const barColor = over ? 'bg-red-500' : near ? 'bg-amber-500' : 'bg-[var(--primary)]';
  const label = `${Math.round((row.pctUsed ?? 0) * 100)}%`;
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-[var(--muted)]">
        <div className={`h-full rounded-full ${barColor}`} style={{ width: `${Math.max(2, pct * 100)}%` }} />
      </div>
      <span
        className={`w-9 text-right text-xs font-medium tabular-nums ${
          over ? 'text-red-600 dark:text-red-400' : near ? 'text-amber-600 dark:text-amber-400' : 'text-[var(--muted-foreground)]'
        }`}
      >
        {label}
      </span>
    </div>
  );
}

function StatTile({
  icon: Icon,
  label,
  value,
  tone = 'default',
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  tone?: 'default' | 'danger' | 'warning';
}) {
  const toneCls =
    tone === 'danger'
      ? 'text-red-600 dark:text-red-400'
      : tone === 'warning'
        ? 'text-amber-600 dark:text-amber-400'
        : 'text-[var(--foreground)]';
  return (
    <Card>
      <CardContent className="flex items-center gap-3 py-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--muted)]/60 text-[var(--muted-foreground)]">
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <div className={`text-xl font-bold tabular-nums ${toneCls}`}>{value}</div>
          <div className="truncate text-xs text-[var(--muted-foreground)]">{label}</div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function CallUsageLedgerPage() {
  const { isSuperAdmin } = usePermissions();
  const queryClient = useQueryClient();
  const { socket, isConnected } = useSocket();
  const [search, setSearch] = useState('');

  const { data, isLoading, isError, isFetching, refetch } = useQuery<CallUsageLedger>({
    queryKey: LEDGER_KEY,
    queryFn: getCallUsageLedger,
    enabled: isSuperAdmin,
    staleTime: 15_000,
    refetchOnWindowFocus: true,
  });

  // Live: patch the affected org's row on a cap change or call-end (no polling).
  useEffect(() => {
    if (!isSuperAdmin || !socket) return;
    const handler = (row: CallUsageLedgerRow) => {
      queryClient.setQueryData<CallUsageLedger>(LEDGER_KEY, (prev) => {
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
  }, [isSuperAdmin, socket, queryClient]);

  const rows = useMemo(() => {
    const all = data?.rows ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return all;
    return all.filter((r) => r.name.toLowerCase().includes(q) || (r.slug ?? '').toLowerCase().includes(q));
  }, [data?.rows, search]);

  const stats = useMemo(() => {
    const all = data?.rows ?? [];
    const blocked = all.filter((r) => r.blocked).length;
    const near = all.filter((r) => !r.blocked && r.capMinutes != null && (r.pctUsed ?? 0) >= 0.8).length;
    return { total: all.length, blocked, near };
  }, [data?.rows]);

  if (!isSuperAdmin) return null; // layout redirects; guard the direct render too

  return (
    <div className="space-y-5">
      {/* Summary */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile icon={FiBriefcase} label="Unlimited-tier orgs" value={num(stats.total)} />
        <StatTile icon={FiActivity} label="Approaching cap (≥80%)" value={num(stats.near)} tone={stats.near ? 'warning' : 'default'} />
        <StatTile icon={FiSlash} label="Blocked (cap reached)" value={num(stats.blocked)} tone={stats.blocked ? 'danger' : 'default'} />
        <StatTile
          icon={FiTarget}
          label="Default cap"
          value={data && data.defaultMinutes > 0 ? `${num(data.defaultMinutes)} min` : 'Off'}
        />
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative max-w-xs flex-1">
          <FiSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted-foreground)]" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search organizations…"
            className="pl-9"
            aria-label="Search organizations"
          />
        </div>
        <div className="flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
          {isConnected ? (
            <span className="inline-flex items-center gap-1.5" title="Live — updates arrive over WebSocket, no polling">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              Live
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5" title="Realtime connection lost — reconnecting; use Refresh meanwhile">
              <span className="h-2 w-2 rounded-full bg-amber-500" />
              Reconnecting…
            </span>
          )}
          <Button variant="outline" size="icon" onClick={() => refetch()} disabled={isFetching} aria-label="Refresh">
            <FiRefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Dormant hint */}
      {data && data.defaultMinutes === 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-[var(--border)] bg-[var(--muted)]/40 p-3 text-xs text-[var(--muted-foreground)]">
          <FiActivity className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            The fleet-wide default cap is <b>off</b>. Only orgs with a custom per-org limit are capped;
            everyone else is truly unlimited. Set a per-org limit from an organization&rsquo;s page, or
            enable the deployment default to cap all unlimited orgs at once.
          </span>
        </div>
      )}

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <FiRefreshCw className="h-6 w-6 animate-spin text-[var(--primary)]" />
            </div>
          ) : isError ? (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
              <FiAlertTriangle className="h-8 w-8 text-[var(--danger)]" />
              <p className="text-sm text-[var(--danger)]">Failed to load call usage.</p>
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                Try again
              </Button>
            </div>
          ) : rows.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-1 py-16 text-center">
              <FiBriefcase className="h-8 w-8 text-[var(--muted-foreground)]" />
              <p className="text-sm text-[var(--foreground)]">
                {search ? 'No organizations match your search.' : 'No unlimited-tier organizations yet.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)] text-left text-xs uppercase tracking-wide text-[var(--muted-foreground)]">
                    <th className="px-4 py-3 font-medium">Organization</th>
                    <th className="px-4 py-3 font-medium">Tier</th>
                    <th className="px-4 py-3 text-right font-medium">Used this month</th>
                    <th className="px-4 py-3 text-right font-medium">Cap</th>
                    <th className="px-4 py-3 font-medium">Usage</th>
                    <th className="px-4 py-3 text-right font-medium">Manage</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr
                      key={r.orgId}
                      className={`border-b border-[var(--border)] last:border-0 transition-colors hover:bg-[var(--muted)]/40 ${
                        r.blocked ? 'bg-red-500/5' : ''
                      }`}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-[var(--foreground)]">{r.name}</span>
                          {r.blocked && (
                            <span className="inline-flex items-center gap-1 rounded-full border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-[11px] font-semibold text-red-600 dark:text-red-400">
                              <FiSlash className="h-3 w-3" />
                              Blocked
                            </span>
                          )}
                        </div>
                        {r.slug && <div className="text-xs text-[var(--muted-foreground)]">{r.slug}</div>}
                      </td>
                      <td className="px-4 py-3">
                        <StatusChip status={r.status} />
                      </td>
                      <td className="px-4 py-3 text-right font-medium tabular-nums text-[var(--foreground)]">
                        {num(r.minutesUsed)} <span className="text-xs font-normal text-[var(--muted-foreground)]">min</span>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {r.capMinutes == null ? (
                          <span className="text-xs text-[var(--muted-foreground)]">Unlimited</span>
                        ) : (
                          <span className="text-[var(--foreground)]">
                            {num(r.capMinutes)} <span className="text-xs font-normal text-[var(--muted-foreground)]">min</span>
                            {r.custom ? (
                              <span className="ml-1 text-[11px] text-[var(--primary)]">· custom</span>
                            ) : (
                              <span className="ml-1 text-[11px] text-[var(--muted-foreground)]">· default</span>
                            )}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <UsageBar row={r} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/admin/organizations/${r.orgId}`}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-2.5 py-1.5 text-xs font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--muted)]"
                        >
                          <FiSettings className="h-3.5 w-3.5" />
                          Set limit
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
