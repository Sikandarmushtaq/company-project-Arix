'use client';

/**
 * Analytics — per-organization usage (calls · connected minutes · SMS) over a
 * date range, for the whole reskin fleet. Sourced from the LOCAL call/SMS
 * records (authoritative + real-time, already org-stamped) via
 * GET /admin/org-usage. Org customers only; no-org/platform traffic is excluded
 * by the backend. (Billing-grade per-org SPEND from Telnyx detail records is a
 * later phase — this page is volume/minutes, which local data gives accurately.)
 */

import { useState } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { useAuthStore } from '@/lib/stores/auth';
import { adminAccountApi, type OrgUsage } from '@/lib/api/services/admin-account.api';
import { PageHead, Card, Metric, Btn } from '../_components/ui';

const LIMIT = 25;

function fmtInt(n: number): string {
  return (n ?? 0).toLocaleString();
}
/** seconds → "Hh Mm" (connected minutes, human). */
function fmtMinutes(mins: number): string {
  if (!mins) return '0m';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h ? `${h}h ${m}m` : `${m}m`;
}

type SortKey = 'totalCalls' | 'callMinutes' | 'totalSms';

/** Sortable right-aligned header cell (module-scope so it isn't recreated per render). */
function SortTh({ k, label, sort, onSort }: { k: SortKey; label: string; sort: SortKey; onSort: (k: SortKey) => void }) {
  return (
    <th className="px-4 py-3 text-right">
      <button type="button" onClick={() => onSort(k)} className={`font-bold ${sort === k ? 'text-[#FF6542]' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}>
        {label}{sort === k ? ' ↓' : ''}
      </button>
    </th>
  );
}

export default function AnalyticsPage() {
  const { user } = useAuthStore();
  const isSuperAdmin = user?.role === 'super_admin' || user?.role === 'superadmin';

  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [activePreset, setActivePreset] = useState<number | null>(null);
  const [sort, setSort] = useState<SortKey>('totalCalls');
  const [page, setPage] = useState(1);

  // Sort + range are server-driven (full-set sort then paginate), so changing
  // either resets to page 1. Editing a date switches the range to "custom" so
  // no preset stays falsely highlighted.
  const changeSort = (k: SortKey) => { setSort(k); setPage(1); };
  const changeFrom = (v: string) => { setFrom(v); setActivePreset(null); setPage(1); };
  const changeTo = (v: string) => { setTo(v); setActivePreset(null); setPage(1); };

  const ranged = !!(from || to);
  const applyPreset = (days: number) => {
    const t = new Date();
    const f = new Date();
    f.setDate(f.getDate() - days);
    setFrom(f.toISOString().slice(0, 10));
    setTo(t.toISOString().slice(0, 10));
    setActivePreset(days);
    setPage(1);
  };
  const clearRange = () => { setFrom(''); setTo(''); setActivePreset(null); setPage(1); };

  const q = useQuery({
    queryKey: ['admin2', 'org-usage', from, to, sort, page],
    queryFn: () =>
      adminAccountApi.getOrgUsage({ from: from || undefined, to: to || undefined, sort, page, limit: LIMIT }),
    enabled: isSuperAdmin,
    staleTime: 30_000,
    refetchOnMount: 'always',
    placeholderData: keepPreviousData,
  });

  const rows: OrgUsage[] = q.data?.data ?? []; // already server-sorted
  const meta = q.data?.meta;
  const totals = meta?.totals ?? { orgs: 0, calls: 0, minutes: 0, sms: 0 }; // fleet-wide, not page
  const totalPages = meta?.totalPages ?? 1;

  if (!isSuperAdmin) {
    return (
      <section>
        <h1 className="text-3xl font-black tracking-tight">Analytics</h1>
        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900">
          Fleet analytics is available to platform super-admins.
        </div>
      </section>
    );
  }

  return (
    <section>
      <PageHead
        title="Analytics"
        subtitle="Per-organization usage across the fleet — calls, connected minutes, and SMS over the selected range."
      />

      <div className="mb-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Organizations" value={q.isLoading ? '—' : fmtInt(totals.orgs)} sub="with activity" subTone="off" />
        <Metric label="Calls" value={q.isLoading ? '—' : fmtInt(totals.calls)} sub={ranged ? 'in range' : 'last 30 days'} subTone="off" />
        <Metric label="Connected minutes" value={q.isLoading ? '—' : fmtMinutes(totals.minutes)} sub={ranged ? 'in range' : 'last 30 days'} subTone="off" />
        <Metric label="SMS" value={q.isLoading ? '—' : fmtInt(totals.sms)} sub={ranged ? 'in range' : 'last 30 days'} subTone="off" />
      </div>

      <Card className="mb-4 flex flex-wrap items-end gap-3 p-4">
        {/* NOT a <label> wrapping the input — a label forwards a second click to
            the date input, which makes the native picker open twice / not close. */}
        <div className="text-xs font-bold text-slate-500 dark:text-slate-400">
          <span className="mb-1 block">From</span>
          <input type="date" value={from} max={to || undefined} onChange={(e) => changeFrom(e.target.value)} className="block rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold dark:border-slate-700 dark:bg-slate-950" />
        </div>
        <div className="text-xs font-bold text-slate-500 dark:text-slate-400">
          <span className="mb-1 block">To</span>
          <input type="date" value={to} min={from || undefined} onChange={(e) => changeTo(e.target.value)} className="block rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold dark:border-slate-700 dark:bg-slate-950" />
        </div>
        <div className="flex items-center gap-1.5">
          {[7, 30, 90].map((d) => {
            const active = activePreset === d;
            return (
              <button
                key={d}
                type="button"
                onClick={() => applyPreset(d)}
                aria-pressed={active}
                className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                  active
                    ? 'bg-[#FF6542] text-white'
                    : 'border border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800'
                }`}
              >
                {d}d
              </button>
            );
          })}
          {ranged && <Btn size="sm" onClick={clearRange}>Clear</Btn>}
        </div>
        <span className="ml-auto text-xs font-semibold text-slate-400">
          {q.isFetching
            ? 'Updating…'
            : activePreset
              ? `Last ${activePreset} days`
              : ranged
                ? `${from || '…'} → ${to || '…'}`
                : 'Last 30 days'}
        </span>
      </Card>

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-950/70 dark:text-slate-400">
              <tr>
                <th className="px-4 py-3">Organization</th>
                <SortTh k="totalCalls" label="Calls" sort={sort} onSort={changeSort} />
                <th className="px-4 py-3 text-right">Answered</th>
                <th className="px-4 py-3 text-right">In / Out</th>
                <SortTh k="callMinutes" label="Minutes" sort={sort} onSort={changeSort} />
                <SortTh k="totalSms" label="SMS" sort={sort} onSort={changeSort} />
                <th className="px-4 py-3 text-right">Sent / Recv</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {q.isLoading ? (
                [0, 1, 2, 3, 4].map((i) => <tr key={i} className="animate-pulse">{Array.from({ length: 7 }).map((_, j) => <td key={j} className="px-4 py-4"><div className="h-4 rounded bg-slate-200 dark:bg-slate-800" /></td>)}</tr>)
              ) : q.isError ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-red-600">Could not load analytics.</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-slate-400">No organization activity in this range.</td></tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.organizationId} className="hover:bg-[#FF6542]/5">
                    <td className="px-4 py-3">
                      <a href={`/admin2/organizations/${r.organizationId}`} className="font-extrabold hover:text-[#FF6542]">{r.organizationName}</a>
                      {r.slug && <div className="text-xs text-slate-400">{r.slug}</div>}
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums font-semibold">{fmtInt(r.totalCalls)}</td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-500">{fmtInt(r.answeredCalls)}</td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-500">{fmtInt(r.inboundCalls)} / {fmtInt(r.outboundCalls)}</td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums font-semibold">{fmtMinutes(r.callMinutes)}</td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums font-semibold">{fmtInt(r.totalSms)}</td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-500">{fmtInt(r.smsSent)} / {fmtInt(r.smsReceived)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 text-sm dark:border-slate-800">
            <span className="text-slate-500 dark:text-slate-400">
              Page {page} of {totalPages}{meta ? ` · ${fmtInt(meta.total)} orgs` : ''}
            </span>
            <div className="flex gap-2">
              <button type="button" disabled={page <= 1 || q.isFetching} onClick={() => setPage((p) => Math.max(1, p - 1))} className="rounded-xl border border-slate-200 px-3 py-2 font-bold disabled:opacity-40 dark:border-slate-700">← Prev</button>
              <button type="button" disabled={page >= totalPages || q.isFetching} onClick={() => setPage((p) => Math.min(totalPages, p + 1))} className="rounded-xl border border-slate-200 px-3 py-2 font-bold disabled:opacity-40 dark:border-slate-700">Next →</button>
            </div>
          </div>
        )}
      </Card>

      <p className="mt-3 text-xs text-slate-400">
        Volume &amp; minutes are over the selected range, from live call/SMS records (org customers only; platform/no-org traffic excluded). Fair-use soft-cap usage is on each org&apos;s Usage tab. Billing-grade per-org spend (Telnyx) is a later phase.
      </p>
    </section>
  );
}
