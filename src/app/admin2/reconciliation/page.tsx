'use client';

/**
 * Reconciliation — super-admin billing console. For a date range: the daily
 * tie-out banner, fleet totals, and a per-org row (calls · minutes · Telnyx cost
 * · billed · margin · review count) with a click-to-drill call list.
 *
 * Sourced from the LOCAL billing spine (telnyx_cdr + ledger) via
 * /admin/billing/recon/*. Reflects imported data only — dormant until the
 * Telnyx usage importer is enabled on the backend.
 */

import { useState } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { useAuthStore } from '@/lib/stores/auth';
import { billingApi, type OrgConsoleRow } from '@/lib/api/services/billing.api';
import { PageHead, Card, Metric, Btn, StatusDot, Pill, Modal, RowSkeleton, ErrorState } from '../_components/ui';

function fmtInt(n: number): string {
  return (n ?? 0).toLocaleString();
}
function fmtUsd(cents: number): string {
  const v = (cents ?? 0) / 100;
  return `$${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function ReconciliationPage() {
  const { user } = useAuthStore();
  const isSuperAdmin = user?.role === 'super_admin' || user?.role === 'superadmin';

  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [drillOrg, setDrillOrg] = useState<OrgConsoleRow | null>(null);

  const rangeParams = { from: from || undefined, to: to || undefined };

  const statusQ = useQuery({
    queryKey: ['admin2', 'billing', 'daily'],
    queryFn: () => billingApi.getDailyReconStatus(),
    enabled: isSuperAdmin,
    staleTime: 30_000,
  });

  const orgsQ = useQuery({
    queryKey: ['admin2', 'billing', 'orgs', from, to],
    queryFn: () => billingApi.getOrgConsole(rangeParams),
    enabled: isSuperAdmin,
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  });

  if (!isSuperAdmin) {
    return (
      <section>
        <h1 className="text-3xl font-black tracking-tight">Reconciliation</h1>
        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900">
          Billing reconciliation is available to platform super-admins.
        </div>
      </section>
    );
  }

  const rows: OrgConsoleRow[] = orgsQ.data ?? [];
  const totals = rows.reduce(
    (a, r) => ({
      calls: a.calls + r.calls,
      minutes: a.minutes + r.minutes,
      cost: a.cost + r.telnyxCostCents,
      billed: a.billed + r.billedCents,
      collected: a.collected + r.collectedCents,
      margin: a.margin + r.marginCents,
      review: a.review + r.telnyxOnly,
    }),
    { calls: 0, minutes: 0, cost: 0, billed: 0, collected: 0, margin: 0, review: 0 }
  );
  const s = statusQ.data;

  return (
    <section>
      <PageHead
        title="Reconciliation"
        subtitle="Telnyx cost vs what we billed, per organization — reconciled against our own call log."
      />

      {/* Daily status banner */}
      <Card className={`mb-4 flex items-center gap-4 border-l-4 p-4 ${s?.tiedOut ? 'border-l-emerald-500' : 'border-l-amber-500'}`}>
        <StatusDot
          health={statusQ.isLoading ? 'off' : s?.tiedOut ? 'ok' : 'warn'}
          label={statusQ.isLoading ? 'Checking…' : s?.tiedOut ? 'Tied out' : `${fmtInt(s?.telnyxOnly ?? 0)} to review`}
        />
        <div className="text-sm text-slate-500 dark:text-slate-400">
          {s
            ? `${s.day} · ${fmtInt(s.imported)} calls imported · ${fmtInt(s.matched)} matched our call log`
            : '—'}
        </div>
      </Card>

      {/* Fleet totals */}
      <div className="mb-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
        <Metric label="Calls" value={orgsQ.isLoading ? '—' : fmtInt(totals.calls)} sub="in range" subTone="off" />
        <Metric label="Minutes" value={orgsQ.isLoading ? '—' : fmtInt(totals.minutes)} sub="billed" subTone="off" />
        <Metric label="Telnyx cost" value={orgsQ.isLoading ? '—' : fmtUsd(totals.cost)} sub="what we're charged" subTone="off" />
        <Metric label="Billed" value={orgsQ.isLoading ? '—' : fmtUsd(totals.billed)} sub="what we charge" subTone="off" />
        <Metric label="Collected" value={orgsQ.isLoading ? '—' : fmtUsd(totals.collected)} sub="paid via Stripe" subTone="off" />
        <Metric label="Margin" value={orgsQ.isLoading ? '—' : fmtUsd(totals.margin)} sub="billed − cost" subTone={totals.margin >= 0 ? 'ok' : 'bad'} />
      </div>

      {/* Range */}
      <Card className="mb-4 flex flex-wrap items-end gap-3 p-4">
        <div className="text-xs font-bold text-slate-500 dark:text-slate-400">
          <span className="mb-1 block">From</span>
          <input type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} className="block rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold dark:border-slate-700 dark:bg-slate-950" />
        </div>
        <div className="text-xs font-bold text-slate-500 dark:text-slate-400">
          <span className="mb-1 block">To</span>
          <input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} className="block rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold dark:border-slate-700 dark:bg-slate-950" />
        </div>
        {(from || to) && (
          <Btn variant="default" size="sm" onClick={() => { setFrom(''); setTo(''); }}>
            Clear (this month)
          </Btn>
        )}
        <span className="ml-auto text-xs text-slate-400">Defaults to the current month → now (UTC).</span>
      </Card>

      {/* Per-org table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:border-slate-800">
                <th className="px-4 py-3">Organization</th>
                <th className="px-4 py-3 text-right">Calls</th>
                <th className="px-4 py-3 text-right">Minutes</th>
                <th className="px-4 py-3 text-right">Telnyx cost</th>
                <th className="px-4 py-3 text-right">Billed</th>
                <th className="px-4 py-3 text-right">Collected</th>
                <th className="px-4 py-3 text-right">Margin</th>
                <th className="px-4 py-3 text-left">Reconciliation</th>
              </tr>
            </thead>
            <tbody>
              {orgsQ.isLoading ? (
                Array.from({ length: 5 }).map((_, i) => <RowSkeleton key={i} cols={8} />)
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-sm text-slate-500">
                    No usage imported for this range yet.
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr
                    key={r.organizationId ?? 'none'}
                    onClick={() => r.organizationId != null && setDrillOrg(r)}
                    className="cursor-pointer border-b border-slate-100 hover:bg-slate-50 dark:border-slate-800/60 dark:hover:bg-slate-800/40"
                  >
                    <td className="px-4 py-3 font-semibold">
                      {r.organizationName || (r.organizationId != null ? `Org #${r.organizationId}` : 'Unattributed')}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{fmtInt(r.calls)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{fmtInt(r.minutes)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{fmtUsd(r.telnyxCostCents)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{fmtUsd(r.billedCents)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{fmtUsd(r.collectedCents)}</td>
                    <td className={`px-4 py-3 text-right font-semibold tabular-nums ${r.marginCents >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                      {fmtUsd(r.marginCents)}
                    </td>
                    <td className="px-4 py-3">
                      {r.telnyxOnly > 0 ? (
                        <StatusDot health="warn" label={`${fmtInt(r.telnyxOnly)} to review`} />
                      ) : (
                        <StatusDot health="ok" label="Tied out" />
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {orgsQ.isError && <div className="mt-4"><ErrorState>Failed to load reconciliation data.</ErrorState></div>}

      {drillOrg && <DrillModal org={drillOrg} from={from} to={to} onClose={() => setDrillOrg(null)} />}
    </section>
  );
}

/* ---------- per-org call drill-down ---------- */
function DrillModal({ org, from, to, onClose }: { org: OrgConsoleRow; from: string; to: string; onClose: () => void }) {
  const callsQ = useQuery({
    queryKey: ['admin2', 'billing', 'calls', org.organizationId, from, to],
    queryFn: () => billingApi.getOrgCalls(org.organizationId as number, { from: from || undefined, to: to || undefined }),
    enabled: org.organizationId != null,
    staleTime: 30_000,
  });
  const calls = callsQ.data ?? [];

  return (
    <Modal
      title={org.organizationName || `Org #${org.organizationId}`}
      subtitle="Call-level reconciliation — Telnyx CDRs and whether each matched our call log"
      size="lg"
      onClose={onClose}
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:border-slate-800">
              <th className="px-3 py-2">Started (UTC)</th>
              <th className="px-3 py-2">Destination</th>
              <th className="px-3 py-2 text-right">Billed s</th>
              <th className="px-3 py-2 text-right">Cost</th>
              <th className="px-3 py-2">Match</th>
            </tr>
          </thead>
          <tbody>
            {callsQ.isLoading ? (
              Array.from({ length: 4 }).map((_, i) => <RowSkeleton key={i} cols={5} />)
            ) : calls.length === 0 ? (
              <tr><td colSpan={5} className="px-3 py-8 text-center text-sm text-slate-500">No calls in this range.</td></tr>
            ) : (
              calls.map((c) => (
                <tr key={c.call_session_id} className={`border-b border-slate-100 dark:border-slate-800/60 ${c.match_status === 'telnyx_only' ? 'bg-amber-50 dark:bg-amber-950/20' : ''}`}>
                  <td className="px-3 py-2 tabular-nums">{c.started_at ?? '—'}</td>
                  <td className="px-3 py-2 tabular-nums">{c.other_number ?? '—'}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmtInt(c.billed_sec ?? 0)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{c.cost != null ? `$${Number(c.cost).toFixed(4)}` : '—'}</td>
                  <td className="px-3 py-2">
                    {c.match_status === 'matched' ? (
                      <Pill tone="neutral">✓ matched</Pill>
                    ) : c.match_status === 'telnyx_only' ? (
                      <Pill tone="coral">⚠ review</Pill>
                    ) : (
                      <Pill tone="neutral">{c.match_status}</Pill>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </Modal>
  );
}
