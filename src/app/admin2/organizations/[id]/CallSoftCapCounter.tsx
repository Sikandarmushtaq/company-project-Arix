'use client';

/**
 * Call-minute fair-use soft-cap: live COUNTER + management, for the admin2 Org
 * Detail → Usage tab. Reuses the proven backend:
 *   • getOrgCallSoftCap(orgId)      — cap config (raw / effective / deployment default)
 *   • getCallUsageLedger()          — REAL minutes used this month (per-org row)
 *   • updateOrgCallSoftCap(orgId,m) — manage: N=cap, null=reset-to-default, 0=unlimited
 *
 * Realtime: NO polling — the shared useCallUsageLedger hook keeps the counter live
 * via the backend's `admin:call_usage` WS push (fires on call-end / cap-change).
 */

import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getOrgCallSoftCap, updateOrgCallSoftCap } from '@/lib/api/services/admin-analytics.api';
import { useCallUsageLedger } from '../../_components/useCallUsageLedger';
import { Card, SectionTitle, Btn, StatusDot } from '../../_components/ui';

export function CallSoftCapCounter({ orgId }: { orgId: number }) {
  const qc = useQueryClient();

  const capQ = useQuery({
    queryKey: ['admin2', 'soft-cap', orgId],
    queryFn: () => getOrgCallSoftCap(orgId),
    staleTime: 10_000,
  });
  const ledger = useCallUsageLedger(true); // live via WS push, no polling

  const [input, setInput] = useState('');
  useEffect(() => {
    if (capQ.data) setInput(capQ.data.rawMinutes != null ? String(capQ.data.rawMinutes) : '');
  }, [capQ.data]);

  const save = useMutation({
    mutationFn: (minutes: number | null) => updateOrgCallSoftCap(orgId, minutes),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin2', 'soft-cap', orgId] });
      qc.invalidateQueries({ queryKey: ['admin2', 'call-usage-ledger'] });
    },
  });

  if (capQ.isLoading) return <Card className="p-5"><div className="h-20 animate-pulse rounded bg-slate-200 dark:bg-slate-800" /></Card>;
  if (capQ.isError || !capQ.data) return null;

  const cap = capQ.data;
  const row = ledger.byOrg.get(orgId);
  const effective = cap.effectiveMinutes; // null = unlimited; else the PER-USER default
  const orgUsed = row?.minutesUsed ?? 0; // org-wide total (informational only)

  const capLabel =
    effective == null
      ? cap.rawMinutes === 0
        ? 'Unlimited (exempt)'
        : 'Unlimited'
      : `${effective.toLocaleString()} min per user / month${cap.rawMinutes == null ? ' (deployment default)' : ' (org default)'}`;

  const commit = () => {
    const t = input.trim();
    if (t === '') { save.mutate(null); return; } // reset to deployment default
    const n = Number(t);
    if (!Number.isInteger(n) || n < 0) return;
    save.mutate(n);
  };

  return (
    <Card className="p-5">
      <SectionTitle
        action={
          <span className="text-xs font-bold text-slate-400" title="Updates live on call-end / cap change">
            {ledger.live ? '● live' : '○ offline'}
          </span>
        }
      >
        Call minutes — per-user cap
      </SectionTitle>

      {/* The org-wide PER-USER default (every user gets this each). Usage is metered
          and blocked per user individually — so we show the default here, not an
          org pool. The org's total usage is shown as context only. */}
      <div className="flex items-end justify-between">
        <div className="text-2xl font-black">
          {effective == null ? 'Unlimited' : `${effective.toLocaleString()}`}
          {effective != null && <span className="text-sm font-semibold text-slate-400"> min / user / mo</span>}
        </div>
        <StatusDot health="ok" label={effective == null ? 'No cap' : 'Per-user'} />
      </div>
      <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
        Default for each user: <span className="font-semibold">{capLabel}</span> · resets monthly ·
        org used this month (all users): <span className="font-semibold">{orgUsed.toLocaleString()} min</span>
        {ledger.generatedAt && <> · as of {new Date(ledger.generatedAt).toLocaleTimeString()}</>}
      </div>

      {/* Management — the org-wide per-user DEFAULT */}
      <div className="mt-4 border-t border-slate-200 pt-4 dark:border-slate-800">
        <div className="text-xs font-bold text-slate-500 dark:text-slate-400">
          Default cap per user (minutes / month)
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <input
            type="number"
            min={0}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={cap.defaultMinutes > 0 ? `Default (${cap.defaultMinutes})` : 'Unlimited'}
            className="w-40 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#FF6542] dark:border-slate-800 dark:bg-slate-950"
          />
          <Btn variant="primary" size="sm" disabled={save.isPending} onClick={commit}>
            {save.isPending ? 'Saving…' : 'Set'}
          </Btn>
          <Btn size="sm" disabled={save.isPending} onClick={() => { setInput(''); save.mutate(null); }}>
            Reset to default{cap.defaultMinutes > 0 ? ` (${cap.defaultMinutes.toLocaleString()})` : ''}
          </Btn>
          <Btn size="sm" disabled={save.isPending} onClick={() => { setInput('0'); save.mutate(0); }}>
            Set unlimited (exempt)
          </Btn>
        </div>
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
          This sets the default <b>every user</b> in the org gets. Each user is metered and blocked on
          <b> their own</b> minutes — one user hitting the cap never stops the others. To raise or exempt
          <b> one</b> user, open that user in <b>Users → Manage</b>. Blank = deployment default · <b>0</b> = unlimited.
          Hidden from the customer (neutral “contact admin” block if reached).
        </p>
        {save.isError && <p className="mt-1 text-xs font-semibold text-red-600">Couldn’t update — try again.</p>}
      </div>
    </Card>
  );
}
