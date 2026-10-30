'use client';

/**
 * SMS limit for the admin2 Org Detail → Usage tab. ONE org-level model with a
 * single ordered precedence (the SSOT the send gate enforces):
 *
 *   manual admin override → active package → base cap → deployment default
 *
 * The card shows the EFFECTIVE limit + where it comes from, and lets the admin set
 * a MANUAL override that wins over everything (incl. a purchased package) — the
 * "manual limit / upgrade" control, available on every org. Blank = no override
 * (use package/base/default); 0 = exempt (unlimited); N = cap at N/month. Hidden
 * from the customer (they get a neutral "contact admin" / upgrade block if reached).
 */

import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getOrgSmsSoftCap, updateOrgSmsSoftCap } from '@/lib/api/services/admin-analytics.api';
import { Card, SectionTitle, Btn, StatusDot, type Health } from '../../_components/ui';

const SOURCE_LABEL: Record<string, string> = {
  manual: 'agent-set allowance',
  package: 'active SMS package / add-on',
  base: 'base allowance',
  default: 'deployment default',
};

export function SmsCapCounter({ orgId }: { orgId: number }) {
  const qc = useQueryClient();
  const capQ = useQuery({
    queryKey: ['admin2', 'sms-soft-cap', orgId],
    queryFn: () => getOrgSmsSoftCap(orgId),
    staleTime: 10_000,
    // Global default is refetchOnMount:false — without this, opening the Usage tab
    // would show a STALE cached limit (e.g. the pre-"Make live" "Unlimited") while
    // the org list shows the fresh value. Always refetch on mount so they agree.
    refetchOnMount: 'always',
  });

  const [input, setInput] = useState('');
  useEffect(() => {
    if (capQ.data) setInput(capQ.data.rawCap != null ? String(capQ.data.rawCap) : '');
  }, [capQ.data]);

  const save = useMutation({
    mutationFn: (cap: number | null) => updateOrgSmsSoftCap(orgId, cap),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin2', 'sms-soft-cap', orgId] });
      qc.invalidateQueries({ queryKey: ['admin2', 'sms-usage-ledger'] });
    },
  });

  if (capQ.isLoading) return <Card className="p-5"><div className="h-24 animate-pulse rounded bg-slate-200 dark:bg-slate-800" /></Card>;
  if (capQ.isError || !capQ.data) return null;

  const d = capQ.data;
  const effective = d.effectiveCap; // null = truly unlimited
  const used = d.usedThisMonth;
  const pct = effective && effective > 0 ? Math.min(100, Math.round((used / effective) * 100)) : 0;
  const blocked = effective != null && used >= effective;
  const health: Health = blocked || pct >= 90 ? 'bad' : pct >= 70 ? 'warn' : 'ok';
  const bar = health === 'bad' ? 'bg-red-500' : health === 'warn' ? 'bg-amber-500' : 'bg-emerald-500';
  const hasOverride = d.rawCap != null;
  const sourceLabel = SOURCE_LABEL[d.source] ?? d.source;
  // When an agent-set allowance (rawCap) has an active package STACKED on top, the
  // effective exceeds the raw — surface the breakdown so "3,001" reads honestly as
  // "1 agent-set + 3,000 package" instead of the misleading "from manual override".
  const raw = d.rawCap;
  const pkgPart = effective != null && raw != null && raw > 0 && effective > raw ? effective - raw : 0;

  const capLabel =
    effective == null
      ? (raw === 0 ? 'Unlimited (agent-set exempt)' : 'Unlimited')
      : pkgPart > 0 && raw != null
        ? `${effective.toLocaleString()} SMS/mo · ${raw.toLocaleString()} agent-set + ${pkgPart.toLocaleString()} package`
        : `${effective.toLocaleString()} SMS/mo · from ${sourceLabel}`;

  const commit = () => {
    const t = input.trim();
    if (t === '') { save.mutate(null); return; } // clear override → use package/base/default
    const n = Number(t);
    if (!Number.isInteger(n) || n < 0) return;
    save.mutate(n);
  };

  return (
    <Card className="p-5">
      <SectionTitle>SMS messages — monthly limit</SectionTitle>

      {effective == null ? (
        <div className="flex items-center justify-between">
          <div className="text-2xl font-black">{used.toLocaleString()} <span className="text-sm font-semibold text-slate-400">sent this month</span></div>
          <StatusDot health="ok" label="Unlimited" />
        </div>
      ) : (
        <>
          <div className="flex items-end justify-between">
            <div className="text-2xl font-black">
              {used.toLocaleString()} <span className="text-sm font-semibold text-slate-400">/ {effective.toLocaleString()} SMS</span>
            </div>
            <StatusDot health={health} label={blocked ? 'Blocked (limit reached)' : `${pct}% used`} />
          </div>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
            <div className={`h-full ${bar}`} style={{ width: `${pct}%` }} />
          </div>
        </>
      )}
      <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
        Current limit: <span className="font-semibold">{capLabel}</span> · resets monthly · shared by all users in the org
      </div>

      <div className="mt-4 border-t border-slate-200 pt-4 dark:border-slate-800">
        <div className="text-xs font-bold text-slate-500 dark:text-slate-400">
          SMS allowance {hasOverride ? '(agent-set)' : '(not set — using package / base)'}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <input
            type="number"
            min={0}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Use package/base"
            className="w-44 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#FF6542] dark:border-slate-800 dark:bg-slate-950"
          />
          <Btn variant="primary" size="sm" disabled={save.isPending} onClick={commit}>
            {save.isPending ? 'Saving…' : 'Set allowance'}
          </Btn>
          <Btn size="sm" disabled={save.isPending || !hasOverride} onClick={() => { setInput(''); save.mutate(null); }}>
            Clear (use package/base)
          </Btn>
          <Btn size="sm" disabled={save.isPending} onClick={() => { setInput('0'); save.mutate(0); }}>
            Set unlimited (exempt)
          </Btn>
        </div>
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
          The org&apos;s SMS allowance that agents set. A purchased <b>package stacks on top</b> of it. Blank = none set (use package / base / default) · <b>0</b> = unlimited/exempt · any number = the org&apos;s monthly SMS allowance (shared by all users). Hidden from the customer.
        </p>
        {save.isError && <p className="mt-1 text-xs font-semibold text-red-600">Couldn’t update — try again.</p>}
      </div>
    </Card>
  );
}
