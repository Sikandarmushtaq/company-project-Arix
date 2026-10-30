'use client';

/**
 * Per-user call-minute usage + caps — on the admin2 Org Detail → Usage tab, right
 * under the org per-user default. Shows EACH member's own minutes used this cycle vs
 * THEIR own effective cap, and lets the admin edit that user's cap inline (no trip to
 * the member drawer). Wired to:
 *   • getOrgPerUserCallUsage(orgId)     — per-user usage + effective cap + override
 *   • updateUserCallCap(userId, mins)   — blank=inherit org default, 0=unlimited, N=cap
 */

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getOrgPerUserCallUsage,
  updateUserCallCap,
  type PerUserCallUsageRow,
} from '@/lib/api/services/admin-analytics.api';
import { useSocket } from '@/lib/providers/SocketProvider';
import { REALTIME_EVENTS } from '@/lib/constants/events';
import { toast } from '@/lib/stores/toast';
import { Card, SectionTitle } from '../../_components/ui';

function UserRow({
  row,
  orgDefault,
  onSaved,
}: {
  row: PerUserCallUsageRow;
  orgDefault: number | null;
  onSaved: () => void;
}) {
  // Draft holds the user's OWN override; empty = inherit the org default.
  const [draft, setDraft] = useState<string>(row.rawOverrideMinutes == null ? '' : String(row.rawOverrideMinutes));
  const save = useMutation({
    mutationFn: (minutes: number | null) => updateUserCallCap(row.userId, minutes),
    onSuccess: () => {
      toast.success(`Cap updated for ${row.name || 'user'}`);
      onSaved();
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : 'Could not update cap'),
  });

  const eff = row.effectiveMinutes; // null = unlimited
  const pct = eff && eff > 0 ? Math.min(100, Math.round((row.minutesUsed / eff) * 100)) : 0;
  const tone = row.blocked || pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-amber-500' : 'bg-emerald-500';
  const txt = row.blocked ? 'text-red-600 dark:text-red-400' : 'text-slate-500 dark:text-slate-400';

  const commit = () => {
    const t = draft.trim();
    if (t === '') { save.mutate(null); return; } // inherit org default
    const n = parseInt(t, 10);
    if (!Number.isInteger(n) || n < 0) return;
    save.mutate(n);
  };

  const inherits = row.rawOverrideMinutes == null;

  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 py-3 last:border-0 dark:border-slate-800/60">
      <div className="min-w-[140px] flex-1">
        <div className="truncate text-sm font-bold text-slate-800 dark:text-slate-100">{row.name || '—'}</div>
        <div className="truncate font-mono text-[11px] text-slate-400">{row.number ?? 'no number'}</div>
      </div>

      {/* Usage vs this user's own cap */}
      <div className="min-w-[150px] flex-1">
        <div className={`text-xs font-bold ${txt}`}>
          {eff == null ? (
            <span className="text-slate-500">{row.minutesUsed.toLocaleString()} min · Unlimited</span>
          ) : (
            <>
              {row.blocked ? 'Blocked · ' : `${pct}% · `}
              {row.minutesUsed.toLocaleString()}/{eff.toLocaleString()} min
            </>
          )}
        </div>
        {eff != null && (
          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
            <div className={`h-full ${tone}`} style={{ width: `${pct}%` }} />
          </div>
        )}
      </div>

      {/* Inline cap editor for THIS user */}
      <div className="flex items-center gap-1.5">
        <input
          type="number"
          min={0}
          value={draft}
          disabled={save.isPending}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={orgDefault != null ? `Default (${orgDefault.toLocaleString()})` : 'Unlimited'}
          className="w-28 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-[#FF6542] dark:border-slate-800 dark:bg-slate-950"
        />
        <button
          type="button"
          disabled={save.isPending}
          onClick={commit}
          className="rounded-lg bg-[#FF6542] px-3 py-1.5 text-xs font-bold text-white disabled:opacity-40"
        >
          {save.isPending ? '…' : 'Set'}
        </button>
      </div>
      <div className="w-full text-[11px] text-slate-400 sm:w-auto sm:min-w-[120px] sm:text-right">
        {inherits ? 'inherits org default' : row.rawOverrideMinutes === 0 ? 'exempt (unlimited)' : 'custom override'}
      </div>
    </div>
  );
}

export function PerUserCallUsage({ orgId }: { orgId: number }) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ['admin2', 'per-user-call-usage', orgId],
    queryFn: () => getOrgPerUserCallUsage(orgId),
    staleTime: 15_000,
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ['admin2', 'per-user-call-usage', orgId] });

  // Live (WS, no polling): the backend emits ADMIN_CALL_USAGE on a call-end or any
  // cap change — refetch the per-user list so usage + caps update without a manual
  // refresh. Same channel the fleet ledger already uses.
  const { socket } = useSocket();
  useEffect(() => {
    if (!socket) return;
    const handler = () => refresh();
    socket.on(REALTIME_EVENTS.ADMIN_CALL_USAGE, handler);
    return () => {
      socket.off(REALTIME_EVENTS.ADMIN_CALL_USAGE, handler);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, orgId]);

  if (q.isLoading) {
    return <Card className="p-5"><div className="h-24 animate-pulse rounded bg-slate-200 dark:bg-slate-800" /></Card>;
  }
  // Never silently vanish — show an explicit, retryable error so a failing fetch is
  // visible rather than an invisible missing card.
  if (q.isError || !q.data) {
    return (
      <Card className="p-5">
        <SectionTitle>Per-user call minutes — usage &amp; caps</SectionTitle>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Couldn’t load per-user call usage.{' '}
          <button type="button" onClick={() => q.refetch()} className="font-bold text-[#FF6542] hover:underline">
            Retry
          </button>
        </p>
      </Card>
    );
  }
  const { users, orgDefaultMinutes } = q.data;

  return (
    <Card className="p-5">
      <SectionTitle>Per-user call minutes — usage &amp; caps</SectionTitle>
      <p className="mb-2 text-xs text-slate-500 dark:text-slate-400">
        Each member&apos;s own minutes this cycle vs their own cap. Edit a user&apos;s cap right here —
        blank = inherit the org default{orgDefaultMinutes != null ? ` (${orgDefaultMinutes.toLocaleString()})` : ''} ·{' '}
        <b>0</b> = unlimited. Only that user is blocked when they reach their cap.
      </p>
      {users.length === 0 ? (
        <div className="py-6 text-center text-sm text-slate-400">No active users in this organization.</div>
      ) : (
        <div>
          {users.map((u) => (
            <UserRow key={u.userId} row={u} orgDefault={orgDefaultMinutes} onSaved={refresh} />
          ))}
        </div>
      )}
    </Card>
  );
}
