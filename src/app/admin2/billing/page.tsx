'use client';

/**
 * Billing — super-admin customer billing (flat monthly subscription).
 *
 * One calm list of every org with its plan, payment method, monthly bill and
 * status. Click an org to see the itemized bill (plan + numbers + bundle) and the
 * monthly payment ledger — Stripe invoices for card orgs, recorded payments for
 * bank/cash orgs (with a "Record payment" action). This is the customer billing
 * surface; the internal Telnyx cost/margin view lives on the Reconciliation page.
 */

import { useEffect, useMemo, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { useAuthStore } from '@/lib/stores/auth';
import { toast } from '@/lib/stores/toast';
import {
  adminBillingApi,
  type OrgBillingRow,
  type OrgBillingDetail,
  type CurrentCycle,
} from '@/lib/api/services/admin-billing.api';
import { FiCalendar, FiChevronLeft, FiChevronRight, FiImage, FiX, FiFileText, FiLayers, FiDollarSign, FiExternalLink, FiSearch } from 'react-icons/fi';
import {
  PageHead,
  Card,
  Metric,
  Btn,
  Pill,
  Modal,
  RowSkeleton,
  StatusDot,
  SubscriptionBadge,
  Field,
  fieldInput,
  type Health,
} from '../_components/ui';
// SSOT for custom billing — the same editor used on Org Detail → Usage.
import { BillingPlanForm } from './_components/BillingPlanForm';
import { fmtPkr, convertUsdCentsToPkrMinor } from '@/lib/utils/currency';

const fmtUsd = (cents: number): string =>
  `$${((cents ?? 0) / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtInt = (n: number): string => (n ?? 0).toLocaleString();
const fmtUnix = (s: number | null): string => (s ? new Date(s * 1000).toISOString().slice(0, 10) : '—');
/** Short, local date for a YYYY-MM-DD due date (e.g. "Oct 18"). */
const fmtDay = (iso: string | null): string =>
  iso ? new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—';

const ordinal = (n?: number | null): string => {
  if (!n) return '';
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
};

/** Month label for a YYYY-MM period (e.g. "October 2026"). */
const fmtMonth = (ym: string): string =>
  new Date(`${ym}-01T00:00:00`).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

/** Status health + label + panel border for the drawer's current-cycle panel. */
function cycleLook(cycle: CurrentCycle): { health: Health; label: string; border: string } {
  const p = cycle.partiallyPaid;
  switch (cycle.collectionStatus) {
    case 'paid':
      return { health: 'ok', label: 'Paid in full', border: 'border-emerald-200 bg-emerald-50/50 dark:border-emerald-950/60 dark:bg-emerald-950/20' };
    case 'overdue':
      return { health: 'bad', label: p ? 'Overdue · partial' : 'Overdue', border: 'border-red-200 bg-red-50/60 dark:border-red-950/60 dark:bg-red-950/20' };
    case 'due_soon':
      return { health: 'warn', label: p ? 'Due soon · partial' : 'Due soon', border: 'border-amber-200 bg-amber-50/60 dark:border-amber-950/60 dark:bg-amber-950/20' };
    default:
      return { health: 'off', label: p ? 'Upcoming · partial' : 'Upcoming', border: 'border-slate-200 dark:border-slate-800' };
  }
}

/** Collection chip for the current cycle — the amber→red "going due" signal. */
function PaymentChip({ row }: { row: OrgBillingRow }) {
  if (row.isTrial || row.periodBillingStatus === 'trial' || row.billingStatus === 'trial') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-500/10 px-2.5 py-0.5 text-xs font-bold text-blue-600 dark:text-blue-400">
        <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
        Trial
      </span>
    );
  }
  const s = row.collectionStatus;
  if (s === 'auto' || row.method === 'stripe') return <span className="text-xs font-semibold text-slate-400">Auto · Stripe</span>;
  if (s === 'none') return <span className="text-xs text-slate-400">—</span>;
  if (s === 'paid' || row.periodBillingStatus === 'paid') return <StatusDot health="ok" label="Paid" />;
  if (row.partiallyPaid || row.periodBillingStatus === 'partially_paid') {
    return <StatusDot health="warn" label={`Partially Paid · ${fmtUsd(row.balanceCents ?? row.pendingCents ?? 0)} left`} />;
  }
  const left = row.partiallyPaid || (row.balanceCents && row.balanceCents > 0)
    ? ` · ${fmtUsd(row.balanceCents ?? row.pendingCents ?? 0)} left`
    : '';
  if (s === 'overdue' || row.periodBillingStatus === 'past_due') return <StatusDot health="bad" label={`Overdue${left}`} />;
  if (s === 'due_soon') return <StatusDot health="warn" label={`Due ${fmtDay(row.dueDateIso ?? null)}${left}`} />;
  return <StatusDot health="off" label={`Due ${fmtDay(row.dueDateIso ?? null)}`} />; // upcoming
}

export default function BillingPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const isSuperAdmin = user?.role === 'super_admin' || user?.role === 'superadmin';

  const [q, setQ] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [limit] = useState(50);
  // Two populations, kept on separate tabs so they never read as one list: orgs we
  // collect from BY HAND (the AR sheet — due dates, record payment, balances) vs
  // STRIPE orgs (auto-charged — monitor only, no due-date/record flow).
  const [tab, setTab] = useState<'byhand' | 'stripe'>('byhand');
  const [filter, setFilter] = useState<'all' | 'owing' | 'overdue' | 'paid'>('all');

  // Month / period stepper & range picker
  const currentMonthStr = useMemo(() => new Date().toISOString().slice(0, 7), []);
  const [period, setPeriod] = useState(currentMonthStr);
  const [isCustom, setIsCustom] = useState(false);
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  const monthOptions = useMemo(() => {
    const opts: Array<{ value: string; label: string }> = [];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
      const val = d.toISOString().slice(0, 7);
      const monthName = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
      opts.push({
        value: val,
        label: i === 0 ? `${monthName} (Current)` : monthName,
      });
    }
    return opts;
  }, []);

  const stepMonth = (delta: number) => {
    const [year, month] = period.split('-').map(Number);
    const d = new Date(Date.UTC(year, month - 1 + delta, 1));
    const nextVal = d.toISOString().slice(0, 7);
    setPeriod(nextVal);
    setPage(1);
  };

  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(q.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [q]);

  // Tab (method) + filter (status) are applied SERVER-SIDE before pagination, so
  // the table and pager cover the whole fleet, not just the current 50-row page.
  // `status` only applies on the by-hand tab (Stripe has no collection filter).
  const statusParam = tab === 'byhand' && filter !== 'all' ? filter : undefined;
  const methodParam: 'manual' | 'stripe' = tab === 'stripe' ? 'stripe' : 'manual';

  // Keep page in range when the tab/filter narrows the result set.
  useEffect(() => { setPage(1); }, [tab, filter]);

  const fxQuery = useQuery({
    queryKey: ['admin2', 'exchange-rate-current'],
    queryFn: () => adminBillingApi.getCurrentExchangeRate('USD', 'PKR'),
    staleTime: 60_000,
  });
  const liveFxRate = parseFloat(fxQuery.data?.operational?.rate || '278.50');

  const orgsQ = useQuery({
    queryKey: ['admin2', 'billing', 'orgs', page, limit, search, isCustom ? customFrom : period, isCustom ? customTo : '', methodParam, statusParam ?? ''],
    queryFn: () =>
      adminBillingApi.getOrgsBilling({
        page,
        limit,
        search: search || undefined,
        period: isCustom ? undefined : period,
        from: isCustom ? customFrom || undefined : undefined,
        to: isCustom ? customTo || undefined : undefined,
        method: methodParam,
        status: statusParam,
      }),
    enabled: isSuperAdmin,
    staleTime: 15_000,
    placeholderData: keepPreviousData,
  });

  const allRows = useMemo(() => orgsQ.data?.rows ?? [], [orgsQ.data?.rows]);
  const meta = orgsQ.data?.meta;
  const serverTotals = orgsQ.data?.totals;

  // The server already filtered by method (tab) + status (filter), so the page
  // rows are exactly what to show — no client-side slicing (which would only see
  // the current page and silently drop matches on other pages).
  const rows = allRows;

  // All tile + badge numbers come from the FLEET-WIDE server totals, so they stay
  // correct regardless of the active tab/filter or which page is loaded. Page-row
  // fallbacks are only used if the server omits a field.
  const totals = useMemo(() => {
    const byHand = allRows.filter((r) => r.method !== 'stripe');
    const stripe = allRows.filter((r) => r.method === 'stripe');
    return {
      byHandCount: serverTotals?.manual ?? byHand.length,
      stripeCount: serverTotals?.stripe ?? stripe.length,
      byHandMonthly: serverTotals?.manualBilledCents ?? byHand.reduce((s, r) => s + r.monthlyCents, 0),
      stripeMonthly: serverTotals?.stripeBilledCents ?? stripe.reduce((s, r) => s + r.monthlyCents, 0),
      collected: serverTotals?.paidManualCents ?? 0,
      outstanding: serverTotals?.pendingManualCents ?? 0,
      overdue: serverTotals?.manualOverdueCount ?? 0,
      owingCount: serverTotals?.manualOwingCount ?? serverTotals?.owingCount ?? 0,
      paid: serverTotals?.manualPaidCount ?? 0,
      stripeLive: serverTotals?.stripeLiveCount ?? stripe.filter((r) => r.stripeLive).length,
      stripeEstimated: serverTotals?.stripeEstimatedCount ?? stripe.filter((r) => !r.stripeLive).length,
    };
  }, [allRows, serverTotals]);

  if (!isSuperAdmin) {
    return (
      <section>
        <h1 className="text-3xl font-black tracking-tight">Billing</h1>
        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900">
          Billing is available to platform super-admins.
        </div>
      </section>
    );
  }

  return (
    <section>
      <PageHead
        title="Billing"
        subtitle="Customers you collect from by hand (with due dates & balances) and customers charged automatically by Stripe."
      />

      {/* Month / Date Range Filter Bar */}
      <Card className="mb-4 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <FiCalendar className="h-4 w-4 text-[#FF6542]" />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
              Billing Period
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {!isCustom ? (
              <div className="flex items-center rounded-xl border border-slate-200 bg-white p-1 dark:border-slate-800 dark:bg-slate-950">
                <button
                  type="button"
                  onClick={() => stepMonth(-1)}
                  title="Previous month"
                  className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                >
                  <FiChevronLeft className="h-4 w-4" />
                </button>
                <select
                  value={period}
                  onChange={(e) => {
                    setPeriod(e.target.value);
                    setPage(1);
                  }}
                  className="cursor-pointer bg-transparent px-2 py-1 text-xs font-bold text-slate-800 outline-none dark:text-slate-100"
                >
                  {monthOptions.map((opt) => (
                    <option key={opt.value} value={opt.value} className="bg-white text-slate-800 dark:bg-slate-900 dark:text-slate-100">
                      {opt.label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => stepMonth(1)}
                  title="Next month"
                  className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                >
                  <FiChevronRight className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1.5 text-xs">
                  <span className="text-slate-400">From:</span>
                  <input
                    type="date"
                    value={customFrom}
                    onChange={(e) => {
                      setCustomFrom(e.target.value);
                      setPage(1);
                    }}
                    className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700 outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200"
                  />
                </div>
                <div className="flex items-center gap-1.5 text-xs">
                  <span className="text-slate-400">To:</span>
                  <input
                    type="date"
                    value={customTo}
                    onChange={(e) => {
                      setCustomTo(e.target.value);
                      setPage(1);
                    }}
                    className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700 outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200"
                  />
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={() => {
                setIsCustom(!isCustom);
                setPage(1);
              }}
              className={`rounded-xl border px-3 py-1.5 text-xs font-semibold transition-colors ${
                isCustom
                  ? 'border-[#FF6542] bg-[#FF6542]/10 text-[#FF6542]'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-slate-900'
              }`}
            >
              <span className="flex items-center gap-1.5">
                <FiCalendar className="h-3.5 w-3.5" />
                {isCustom ? 'Use Month Picker' : 'Custom Range'}
              </span>
            </button>
          </div>
        </div>
      </Card>

      {/* Dashboard is SEPARATE per tab — by-hand money and Stripe money never mix. */}
      <div className="mb-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tab === 'byhand' ? (
          <>
            <Metric label="By-hand customers" value={orgsQ.isLoading ? '—' : fmtInt(totals.byHandCount)} sub="collected manually" subTone="off" />
            <Metric label="Monthly billed" value={orgsQ.isLoading ? '—' : fmtPkr(convertUsdCentsToPkrMinor(totals.byHandMonthly, liveFxRate))} sub={orgsQ.isLoading ? 'plans + add-ons' : `USD ${(totals.byHandMonthly / 100).toFixed(0)} eq.`} subTone="off" />
            <Metric label="Collected this month" value={orgsQ.isLoading ? '—' : fmtPkr(convertUsdCentsToPkrMinor(totals.collected, liveFxRate))} sub={orgsQ.isLoading ? 'recorded by hand' : `USD ${(totals.collected / 100).toFixed(0)} eq.`} subTone="ok" />
            <Metric
              label="Outstanding"
              value={orgsQ.isLoading ? '—' : fmtPkr(convertUsdCentsToPkrMinor(totals.outstanding, liveFxRate))}
              sub={orgsQ.isLoading ? undefined : totals.overdue > 0 ? `${fmtInt(totals.overdue)} overdue` : 'all current'}
              subTone={totals.outstanding > 0 ? 'bad' : 'ok'}
            />
          </>
        ) : (
          <>
            <Metric label="Stripe customers" value={orgsQ.isLoading ? '—' : fmtInt(totals.stripeCount)} sub="auto-charged" subTone="off" />
            <Metric label="Monthly recurring" value={orgsQ.isLoading ? '—' : fmtPkr(convertUsdCentsToPkrMinor(totals.stripeMonthly, liveFxRate))} sub={orgsQ.isLoading ? 'charged by Stripe' : `Stripe: USD ${(totals.stripeMonthly / 100).toFixed(0)} @ ${liveFxRate}`} subTone="ok" />
            <Metric label="Live subscriptions" value={orgsQ.isLoading ? '—' : fmtInt(totals.stripeLive)} sub="verified against Stripe" subTone="off" />
            <Metric
              label="Estimated"
              value={orgsQ.isLoading ? '—' : fmtInt(totals.stripeEstimated)}
              sub={orgsQ.isLoading ? undefined : totals.stripeEstimated > 0 ? 'no live sub — amount is a guess' : 'all verified'}
              subTone={totals.stripeEstimated > 0 ? 'warn' : 'ok'}
            />
          </>
        )}
      </div>

      {/* Tabs — the two populations never share a list. By hand = the collections
          sheet; Stripe = auto-charged customers to monitor. */}
      <div className="mb-4 flex items-center gap-1 border-b border-slate-200 dark:border-slate-800">
        {([
          ['byhand', 'By hand', totals.byHandCount],
          ['stripe', 'Stripe', totals.stripeCount],
        ] as const).map(([key, label, count]) => (
          <button
            key={key}
            onClick={() => {
              setTab(key);
              setFilter('all');
            }}
            className={`relative -mb-px px-4 py-2.5 text-sm font-bold transition ${
              tab === key
                ? 'border-b-2 border-[#FF6542] text-[#FF6542]'
                : 'border-b-2 border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            {label}
            <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[11px] font-bold ${tab === key ? 'bg-[#FF6542]/15 text-[#FF6542]' : 'bg-slate-500/10 text-slate-500'}`}>
              {orgsQ.isLoading ? '…' : fmtInt(count)}
            </span>
          </button>
        ))}
      </div>

      <Card className="mb-4 p-4 space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <FiSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400" />
            <input
              type="text"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
              placeholder="Search by organization, email, phone, or ID…"
              className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-8 text-xs text-slate-800 placeholder-slate-400 focus:border-[#FF6542] focus:outline-none focus:ring-1 focus:ring-[#FF6542] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder-slate-500"
            />
            {q && (
              <button
                type="button"
                onClick={() => {
                  setQ('');
                  setPage(1);
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                title="Clear search"
              >
                ✕
              </button>
            )}
          </div>

          {tab === 'byhand' ? (
            <div className="flex flex-wrap items-center gap-1.5">
              {([
                ['all', 'All'],
                ['owing', `Owing${totals.owingCount > 0 ? ` (${totals.owingCount})` : ''}`],
                ['overdue', `Overdue${totals.overdue > 0 ? ` (${totals.overdue})` : ''}`],
                ['paid', `Paid${totals.paid > 0 ? ` (${totals.paid})` : ''}`],
              ] as const).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setFilter(key)}
                  className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${
                    filter === key
                      ? key === 'overdue'
                        ? 'bg-red-500 text-white'
                        : key === 'paid'
                          ? 'bg-emerald-500 text-white'
                          : 'bg-[#FF6542] text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          ) : (
            <span className="text-xs font-semibold text-slate-400">Auto-charged by Stripe — nothing to record here</span>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-2 text-xs text-slate-500 dark:border-slate-800/60 font-medium">
          <div>
            Showing <strong className="font-bold text-slate-700 dark:text-slate-200">{rows.length}</strong> of{' '}
            <strong className="font-bold text-slate-700 dark:text-slate-200">{meta?.total ?? rows.length}</strong>{' '}
            {tab === 'byhand' ? 'by-hand' : 'Stripe'} {(meta?.total ?? rows.length) === 1 ? 'organization' : 'organizations'}
            {q && (
              <span className="ml-1 font-medium text-[#FF6542]">matching &ldquo;{q}&rdquo;</span>
            )}
            {statusParam ? ` · ${statusParam}` : ''}
          </div>
          <div className="text-[11px] text-slate-400">
            Searches: org name · ID · owner email · phone
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:border-slate-800">
                <th className="px-4 py-3">Organization</th>
                <th className="px-4 py-3">Plan</th>
                <th className="px-4 py-3">Add-ons</th>
                <th className="px-4 py-3">Billing Cycle</th>
                <th className="px-4 py-3 text-right">Monthly</th>
                {tab === 'byhand' && <th className="px-4 py-3 text-left">Payment</th>}
                <th className="px-4 py-3 text-left">Status</th>
              </tr>
            </thead>
            <tbody>
              {orgsQ.isLoading ? (
                Array.from({ length: 6 }).map((_, i) => <RowSkeleton key={i} cols={tab === 'byhand' ? 7 : 6} />)
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={tab === 'byhand' ? 7 : 6} className="px-4 py-12 text-center text-sm text-slate-500">
                    {q || filter !== 'all' ? 'No organizations match.' : 'No organizations.'}
                  </td>
                </tr>
              ) : (
                rows.map((r) => {
                  const isTrial = r.isTrial || r.periodBillingStatus === 'trial' || r.billingStatus === 'trial';
                  // The "going due" tint: amber as it approaches, red once overdue with a balance.
                  // Only on by-hand tab, and never for trial accounts.
                  const tint =
                    !isTrial && tab === 'byhand'
                      ? r.collectionStatus === 'overdue' || r.periodBillingStatus === 'past_due'
                        ? 'bg-red-50/70 hover:bg-red-100/70 dark:bg-red-950/20 dark:hover:bg-red-950/30'
                        : r.collectionStatus === 'due_soon'
                          ? 'bg-amber-50/60 hover:bg-amber-100/60 dark:bg-amber-950/15 dark:hover:bg-amber-950/25'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/40';

                  const numbersLabel =
                    r.numbersCount > 0 ? (
                      <span className="tabular-nums">
                        {r.numbersCount} {r.numbersCount === 1 ? 'number' : 'numbers'}
                        {r.numbersCount > 1 && (
                          <span className="text-slate-400"> ({r.includedNumbers ?? 1} free)</span>
                        )}
                      </span>
                    ) : null;

                  return (
                    <tr
                      key={r.orgId}
                      onClick={() => router.push(`/admin2/billing/${r.orgId}`)}
                      className={`cursor-pointer border-b border-slate-100 dark:border-slate-800/60 ${tint}`}
                    >
                      <td className="px-4 py-3 font-semibold">{r.name}</td>
                      <td className="px-4 py-3">{r.planLabel}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
                          {numbersLabel}
                          {r.bundleSlug && <Pill tone="neutral">{r.bundleSlug}</Pill>}
                          {r.numbersCount === 0 && !r.bundleSlug && <span className="text-slate-400">—</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {r.cycleStartIso && r.cycleEndIso ? (
                          <div>
                            <div className="font-semibold tabular-nums text-slate-800 dark:text-slate-200 text-xs">
                              {fmtDay(r.cycleStartIso.slice(0, 10))} – {fmtDay(r.cycleEndIso.slice(0, 10))}
                            </div>
                            <div className="text-[11px] text-slate-400">
                              {r.anchorDay ? `Renews ${r.anchorDay}${ordinal(r.anchorDay)}` : 'Monthly'}
                              {r.dueDateIso && r.collectionStatus !== 'paid' && r.periodBillingStatus !== 'paid'
                                ? ` · Due ${fmtDay(r.dueDateIso.slice(0, 10))}`
                                : ''}
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums">
                        {r.method === 'stripe' && !r.stripeLive && (
                          <span title="Estimated — no live Stripe subscription found" className="mr-0.5 text-amber-500">~</span>
                        )}
                        <div>{fmtPkr(convertUsdCentsToPkrMinor(r.monthlyCents, liveFxRate))}</div>
                        {r.method === 'stripe' && (
                          <div className="text-[11px] font-normal text-slate-400 dark:text-slate-500">
                            Stripe: {fmtUsd(r.monthlyCents)}
                          </div>
                        )}
                      </td>
                      {tab === 'byhand' && <td className="px-4 py-3"><PaymentChip row={r} /></td>}
                      <td className="px-4 py-3"><SubscriptionBadge status={r.billingStatus} /></td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination controls if total organizations exceed limit */}
        {meta && meta.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 text-xs text-slate-500 dark:border-slate-800">
            <div>
              Showing {Math.min((page - 1) * limit + 1, meta.total)} to{' '}
              {Math.min(page * limit, meta.total)} of {meta.total} organizations
            </div>
            <div className="flex items-center gap-2">
              <Btn size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
                Previous
              </Btn>
              <span className="font-semibold text-slate-700 dark:text-slate-200">
                {page} / {meta.totalPages}
              </span>
              <Btn size="sm" onClick={() => setPage((p) => Math.min(meta.totalPages, p + 1))} disabled={page >= meta.totalPages}>
                Next
              </Btn>
            </div>
          </div>
        )}
      </Card>
    </section>
  );
}

/* ---------- per-org detail: itemization + ledger + record payment ---------- */
function OrgBillingDrawer({ org, onClose }: { org: OrgBillingRow; onClose: () => void }) {
  const router = useRouter();
  const qc = useQueryClient();
  const [recording, setRecording] = useState(false);
  const [showDisable, setShowDisable] = useState(false);
  const [disableReason, setDisableReason] = useState('');
  const [planModalOpen, setPlanModalOpen] = useState(false);
  const [drawerTab, setDrawerTab] = useState<'overview' | 'licenses' | 'documents'>('overview');

  const detailQ = useQuery({
    queryKey: ['admin2', 'billing', 'detail', org.orgId],
    queryFn: () => adminBillingApi.getOrgBillingDetail(org.orgId),
    staleTime: 15_000,
  });
  const refreshBilling = () => qc.invalidateQueries({ queryKey: ['admin2', 'billing'] });
  const suspend = useMutation({
    mutationFn: () => adminBillingApi.suspendOrg(org.orgId, disableReason),
    onSuccess: () => { toast.success('Organization disabled'); setShowDisable(false); setDisableReason(''); refreshBilling(); },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : 'Could not disable the organization'),
  });
  const reactivate = useMutation({
    mutationFn: () => adminBillingApi.reactivateOrg(org.orgId),
    onSuccess: () => { toast.success('Organization re-enabled'); refreshBilling(); },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : 'Could not re-enable the organization'),
  });
  const d: OrgBillingDetail | undefined = detailQ.data;
  // "By hand" = everyone NOT auto-charged by Stripe → gets record-payment, the
  // manual ledger and the collections (due-date) panel. Stripe orgs are auto-charged.
  const byHand = d ? d.paymentType !== 'stripe' : org.method !== 'stripe';
  const cycle = d?.currentCycle;
  const noPlan = (d?.planLabel ?? org.planLabel) === 'No plan';
  const isTrialOrg = Boolean(
    org.isTrial ||
    org.periodBillingStatus === 'trial' ||
    org.billingStatus === 'trial' ||
    d?.subscription?.status === 'trialing'
  );

  const openInvoice = (period?: string) => {
    const p = period || cycle?.periodMonth;
    const url = `/admin2/billing/${org.orgId}${p ? `?period=${encodeURIComponent(p)}` : ''}`;
    try {
      window.open(url, '_blank');
    } catch {
      router.push(url);
    }
  };

  const monthlyBilled = d?.subscription?.amountCents ?? d?.itemization.monthlyCents ?? org.monthlyCents;
  const targetDocNumber = `INV-${(cycle?.periodMonth || new Date().toISOString().slice(0, 7)).replace(/-/g, '')}-${org.orgId.toString().padStart(4, '0')}`;

  return (
    <Modal
      title={org.name}
      subtitle={`${org.planLabel} · ${fmtUsd(org.monthlyCents)}/mo · ${org.method === 'stripe' ? 'Stripe Auto' : org.method === 'manual' ? 'Bank Transfer (Manual)' : 'No method'}`}
      size="lg"
      onClose={onClose}
    >
      {/* RingCentral-Style Drawer Tab Navigation */}
      <div className="-mt-1 mb-5 flex border-b border-slate-200 dark:border-slate-800">
        <button
          type="button"
          onClick={() => setDrawerTab('overview')}
          className={`flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-xs font-bold transition ${
            drawerTab === 'overview'
              ? 'border-[#FF6542] text-[#FF6542]'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <FiDollarSign className="h-3.5 w-3.5" />
          Overview & Charges
        </button>
        <button
          type="button"
          onClick={() => setDrawerTab('licenses')}
          className={`flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-xs font-bold transition ${
            drawerTab === 'licenses'
              ? 'border-[#FF6542] text-[#FF6542]'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <FiLayers className="h-3.5 w-3.5" />
          Product Details & Licences
        </button>
        <button
          type="button"
          onClick={() => setDrawerTab('documents')}
          className={`flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-xs font-bold transition ${
            drawerTab === 'documents'
              ? 'border-[#FF6542] text-[#FF6542]'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <FiFileText className="h-3.5 w-3.5" />
          Statements & Payments
        </button>
      </div>

      {detailQ.isLoading || !d ? (
        <div className="space-y-3">
          <div className="h-5 w-40 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
          <div className="h-24 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800/50" />
        </div>
      ) : (
        <div className="space-y-6">
          {/* TAB 1: OVERVIEW & CHARGES */}
          {drawerTab === 'overview' && (
            <>
              {/* This billing cycle — collections view for by-hand orgs (hidden on trial and stripe) */}
              {byHand && !isTrialOrg && cycle && cycle.collectionStatus !== 'none' && (() => {
                const look = cycleLook(cycle);
                return (
                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Current Billing Cycle</h3>
                      <button
                        type="button"
                        onClick={() => openInvoice()}
                        className="inline-flex items-center gap-1 text-xs font-bold text-[#FF6542] hover:underline"
                      >
                        <FiFileText className="h-3.5 w-3.5" /> View Statement ({targetDocNumber})
                      </button>
                    </div>
                    <div className={`rounded-xl border p-4 ${look.border}`}>
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="text-2xl font-black tabular-nums">
                            {fmtUsd(cycle.balanceCents)} <span className="text-sm font-semibold text-slate-400">balance</span>
                          </div>
                          <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                            {fmtUsd(cycle.paidThisCycleCents)} paid of {fmtUsd(cycle.amountDueCents)} · for {fmtMonth(cycle.periodMonth)}
                          </div>
                        </div>
                        <div className="text-right">
                          <StatusDot health={look.health} label={look.label} />
                          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">Due {fmtDay(cycle.dueDateIso)}</div>
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        {cycle.balanceCents > 0 && (
                          <Btn size="sm" variant="primary" onClick={() => setRecording(true)}>
                            Record {cycle.paidThisCycleCents > 0 ? 'another ' : ''}payment
                          </Btn>
                        )}
                        <Btn size="sm" variant="default" onClick={() => openInvoice()}>
                          <FiFileText className="mr-1 text-[#FF6542]" /> View Statement / Invoice
                        </Btn>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* What they pay monthly */}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">What they pay monthly</h3>
                  <button
                    type="button"
                    onClick={() => setDrawerTab('licenses')}
                    className="inline-flex items-center gap-1 text-xs font-bold text-[#FF6542] hover:underline"
                  >
                    <FiLayers className="h-3.5 w-3.5" /> View Full Licences Breakdown
                  </button>
                </div>
                <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
                  <div className="flex items-center justify-between px-4 py-2.5">
                    <span className="text-sm text-slate-600 dark:text-slate-300">
                      Plan — {noPlan ? <span className="italic text-slate-400">No plan set</span> : d.planLabel}
                    </span>
                    <div className="flex items-center gap-3">
                      {!noPlan && <span className="text-sm tabular-nums">{fmtUsd(d.itemization.planCents)}</span>}
                      <button
                        onClick={() => setPlanModalOpen(true)}
                        className="text-xs font-bold text-[#FF6542] hover:underline"
                      >
                        {noPlan ? 'Set plan' : 'Change'}
                      </button>
                    </div>
                  </div>
                  {d.itemization.numbers.length > 0 && (() => {
                    const count = d.itemization.numbers.length;
                    const freeShown = d.itemization.numbers.filter((n) => n.included).length;
                    const paid = count - freeShown;
                    return (
                      <Line
                        label={
                          paid > 0
                            ? `Phone numbers (${count} — ${freeShown} free, ${paid} × $5)`
                            : `Phone number${count === 1 ? '' : 's'} (${count} — included free)`
                        }
                        value={fmtUsd(d.itemization.numbersCents)}
                      />
                    );
                  })()}
                  {d.itemization.bundle && (
                    <Line label={`Bundle — ${d.itemization.bundle.slug}`} value={fmtUsd(d.itemization.bundle.monthlyCents)} />
                  )}
                  {d.itemization.smsAddonCents ? (
                    <Line label="SMS Package Add-on" value={fmtUsd(d.itemization.smsAddonCents)} />
                  ) : null}
                  <div className="flex items-center justify-between px-4 py-3">
                    <span className="text-sm font-black">Monthly total{d.subscription ? ' (Stripe)' : ''}</span>
                    <span className="text-sm font-black tabular-nums">
                      {fmtUsd(d.subscription?.amountCents ?? d.itemization.monthlyCents)}
                    </span>
                  </div>
                </div>
                {d.subscription && d.subscription.amountCents !== d.itemization.monthlyCents && (
                  <p className="mt-1.5 text-[11px] text-slate-400">
                    Components are approximate — Stripe bills the total above (line prices / discounts may differ).
                  </p>
                )}
              </div>

              {/* Custom-plan contents */}
              {d.customPlan && (
                <div>
                  <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">Plan details</h3>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {([
                      ['Seats', d.customPlan.seats == null ? '—' : String(d.customPlan.seats)],
                      ['Devices / user', d.customPlan.devicesPerUser === 0 ? 'Unlimited' : d.customPlan.devicesPerUser == null ? '—' : String(d.customPlan.devicesPerUser)],
                      ['Numbers', `${d.customPlan.includedNumbers} free of ${d.customPlan.maxNumbers ?? '—'}`],
                      ['SMS Allowance', d.customPlan.smsAllowance ? `${d.customPlan.smsAllowance}/mo` : 'Standard'],
                    ] as const).map(([k, v]) => (
                      <div key={k} className="rounded-xl border border-slate-200 px-3 py-2.5 dark:border-slate-800">
                        <div className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{k}</div>
                        <div className="mt-0.5 text-sm font-bold tabular-nums">{v}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Account control */}
              <div>
                <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">Account</h3>
                {d.billingStatus === 'suspended' ? (
                  <div className="rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-950 dark:bg-red-950/30">
                    <div className="text-sm font-black text-red-700 dark:text-red-300">Disabled</div>
                    {d.suspendReason && (
                      <p className="mt-1 text-sm text-red-700/80 dark:text-red-300/80">Reason shown to the org: “{d.suspendReason}”</p>
                    )}
                    <div className="mt-3">
                      <Btn size="sm" variant="primary" onClick={() => reactivate.mutate()} disabled={reactivate.isPending}>
                        {reactivate.isPending ? 'Enabling…' : 'Re-enable account'}
                      </Btn>
                    </div>
                  </div>
                ) : !showDisable ? (
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-4 dark:border-slate-800">
                    <span className="text-sm text-slate-500 dark:text-slate-400">Disabling blocks the org from calling, texting and signing in until you re-enable it. The reason is shown on their billing page.</span>
                    <Btn size="sm" variant="danger" onClick={() => setShowDisable(true)}>Disable account</Btn>
                  </div>
                ) : (
                  <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
                    <label className="text-sm font-bold">Reason (shown to the organization)
                      <textarea
                        value={disableReason}
                        onChange={(e) => setDisableReason(e.target.value)}
                        rows={2}
                        className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#FF6542] dark:border-slate-700 dark:bg-slate-950"
                        placeholder="e.g. Payment overdue — please settle the outstanding invoice to restore service."
                      />
                    </label>
                    <div className="mt-3 flex justify-end gap-2">
                      <Btn size="sm" onClick={() => { setShowDisable(false); setDisableReason(''); }} disabled={suspend.isPending}>Cancel</Btn>
                      <Btn size="sm" variant="danger" onClick={() => suspend.mutate()} disabled={suspend.isPending || !disableReason.trim()}>
                        {suspend.isPending ? 'Disabling…' : 'Disable account'}
                      </Btn>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {/* TAB 2: PRODUCT DETAILS & LICENCES (RingCentral Image 2 Style) */}
          {drawerTab === 'licenses' && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">Active Licences & Product Catalog</h3>
                  <p className="text-xs text-slate-500">Every seat, DID line, and feature package billed to this customer</p>
                </div>
                <div className="flex items-center gap-2">
                  <Btn size="sm" variant="default" onClick={() => openInvoice()}>
                    <FiFileText className="mr-1 text-[#FF6542]" /> View Statement
                  </Btn>
                  <Btn size="sm" variant="primary" onClick={() => setPlanModalOpen(true)}>
                    Edit Plan & Quotas
                  </Btn>
                </div>
              </div>

              {/* RingCentral-style Metrics Cards */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3.5 dark:border-slate-800 dark:bg-slate-900">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Monthly Bill</div>
                  <div className="mt-1 text-lg font-black text-slate-900 dark:text-white">{fmtUsd(monthlyBilled)}</div>
                  <div className="mt-0.5 text-[11px] text-slate-500">{byHand ? 'Offline Bank Transfer' : 'Auto-Stripe'}</div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3.5 dark:border-slate-800 dark:bg-slate-900">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Voice Licences</div>
                  <div className="mt-1 text-lg font-black text-slate-900 dark:text-white">{d.customPlan?.seats ?? 1} Seats</div>
                  <div className="mt-0.5 text-[11px] text-slate-500">{d.planLabel}</div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3.5 dark:border-slate-800 dark:bg-slate-900">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Direct Lines (DID)</div>
                  <div className="mt-1 text-lg font-black text-slate-900 dark:text-white">{d.itemization.numbers.length} Lines</div>
                  <div className="mt-0.5 text-[11px] text-slate-500">{d.itemization.numbers.filter(n => n.included).length} free included</div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3.5 dark:border-slate-800 dark:bg-slate-900">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Device Quota</div>
                  <div className="mt-1 text-lg font-black text-slate-900 dark:text-white">
                    {d.customPlan?.devicesPerUser === 0 ? 'Unlimited' : `${d.customPlan?.devicesPerUser ?? 5} / seat`}
                  </div>
                  <div className="mt-0.5 text-[11px] text-slate-500">SIP & WebRTC devices</div>
                </div>
              </div>

              {/* Items Purchased & Active Licences Table */}
              <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-200 bg-slate-50/80 font-bold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-400">
                    <tr>
                      <th className="px-4 py-3">Product / Service</th>
                      <th className="px-4 py-3">Specifications & Allowances</th>
                      <th className="px-4 py-3 text-center">Qty</th>
                      <th className="px-4 py-3 text-right">Unit Rate</th>
                      <th className="px-4 py-3 text-right">Total Monthly</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                    <tr>
                      <td className="px-4 py-3 font-bold text-slate-900 dark:text-white">
                        {d.planLabel} — Core Cloud PBX Seat
                      </td>
                      <td className="px-4 py-3 text-slate-500">
                        Unlimited inbound calling, WebRTC dialer, {d.customPlan?.devicesPerUser === 0 ? 'Unlimited' : d.customPlan?.devicesPerUser ?? 5} SIP devices/user
                      </td>
                      <td className="px-4 py-3 text-center font-semibold tabular-nums text-slate-700 dark:text-slate-300">
                        {d.customPlan?.seats ?? 1}
                      </td>
                      <td className="px-4 py-3 text-right font-medium tabular-nums text-slate-600 dark:text-slate-300">
                        {fmtUsd(d.customPlan && d.customPlan.seats ? Math.round(d.itemization.planCents / Math.max(1, d.customPlan.seats)) : d.itemization.planCents)}
                      </td>
                      <td className="px-4 py-3 text-right font-black tabular-nums text-slate-900 dark:text-white">
                        {fmtUsd(d.itemization.planCents)}
                      </td>
                    </tr>
                    {d.itemization.numbers.length > 0 && (
                      <tr>
                        <td className="px-4 py-3 font-bold text-slate-900 dark:text-white">
                          Direct Inward Dialing (DID) Phone Numbers
                        </td>
                        <td className="px-4 py-3 text-slate-500">
                          USA/Canada & Local voice/SMS routes. First {d.customPlan?.includedNumbers ?? 1} free; $5.00/mo per extra DID
                        </td>
                        <td className="px-4 py-3 text-center font-semibold tabular-nums text-slate-700 dark:text-slate-300">
                          {d.itemization.numbers.length}
                        </td>
                        <td className="px-4 py-3 text-right font-medium tabular-nums text-slate-600 dark:text-slate-300">
                          $5.00 (extra)
                        </td>
                        <td className="px-4 py-3 text-right font-black tabular-nums text-slate-900 dark:text-white">
                          {fmtUsd(d.itemization.numbersCents)}
                        </td>
                      </tr>
                    )}
                    {d.itemization.bundle && (
                      <tr>
                        <td className="px-4 py-3 font-bold text-slate-900 dark:text-white">
                          Bundle — {d.itemization.bundle.slug}
                        </td>
                        <td className="px-4 py-3 text-slate-500">
                          {d.itemization.bundle.minutes} included voice minutes · {d.itemization.bundle.sms} SMS pool
                        </td>
                        <td className="px-4 py-3 text-center font-semibold tabular-nums text-slate-700 dark:text-slate-300">
                          1
                        </td>
                        <td className="px-4 py-3 text-right font-medium tabular-nums text-slate-600 dark:text-slate-300">
                          {fmtUsd(d.itemization.bundle.monthlyCents)}
                        </td>
                        <td className="px-4 py-3 text-right font-black tabular-nums text-slate-900 dark:text-white">
                          {fmtUsd(d.itemization.bundle.monthlyCents)}
                        </td>
                      </tr>
                    )}
                    {d.itemization.smsAddonCents ? (
                      <tr>
                        <td className="px-4 py-3 font-bold text-slate-900 dark:text-white">
                          High-Volume SMS Add-On Package
                        </td>
                        <td className="px-4 py-3 text-slate-500">
                          Pooled 10DLC compliant carrier texting package
                        </td>
                        <td className="px-4 py-3 text-center font-semibold tabular-nums text-slate-700 dark:text-slate-300">
                          {d.itemization.smsAddons?.length ?? 1}
                        </td>
                        <td className="px-4 py-3 text-right font-medium tabular-nums text-slate-600 dark:text-slate-300">
                          {fmtUsd(d.itemization.smsAddonCents)}
                        </td>
                        <td className="px-4 py-3 text-right font-black tabular-nums text-slate-900 dark:text-white">
                          {fmtUsd(d.itemization.smsAddonCents)}
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                  <tfoot className="border-t border-slate-200 bg-slate-50 font-bold dark:border-slate-800 dark:bg-slate-950/60">
                    <tr>
                      <td colSpan={4} className="px-4 py-3 text-right uppercase tracking-wider text-slate-500">
                        Total Monthly Recurring Charge:
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-black tabular-nums text-slate-900 dark:text-white">
                        {fmtUsd(monthlyBilled)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Individual Phone Numbers Roster */}
              {d.itemization.numbers.length > 0 && (
                <div>
                  <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">Assigned Digital Phone Lines (DIDs)</h4>
                  <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
                    <table className="w-full text-xs">
                      <thead className="border-b border-slate-200 bg-slate-50/60 font-semibold text-slate-500 dark:border-slate-800 dark:bg-slate-950/40">
                        <tr>
                          <th className="px-3.5 py-2 text-left">Phone Number</th>
                          <th className="px-3.5 py-2 text-left">Type</th>
                          <th className="px-3.5 py-2 text-left">Plan Allowance Tier</th>
                          <th className="px-3.5 py-2 text-right">Assigned Target</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                        {d.itemization.numbers.map((n, i) => (
                          <tr key={i}>
                            <td className="px-3.5 py-2 font-mono font-bold text-slate-800 dark:text-slate-200">{n.number}</td>
                            <td className="px-3.5 py-2 capitalize text-slate-500">{n.type || 'Local DID'}</td>
                            <td className="px-3.5 py-2">
                              {n.included ? (
                                <span className="inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
                                  Included in Plan (Free)
                                </span>
                              ) : (
                                <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                  $5.00 / month
                                </span>
                              )}
                            </td>
                            <td className="px-3.5 py-2 text-right text-slate-500">
                              {n.assignedUserId ? `User ID #${n.assignedUserId}` : 'Company Inbound Pool'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: STATEMENTS & PAYMENTS (RingCentral Image 1 Style) */}
          {drawerTab === 'documents' && (
            <div className="space-y-6">
              {/* Document History Table (RingCentral Image 1) */}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">Billing Statements & Invoices</h3>
                    <p className="text-xs text-slate-500">Official monthly accounting statements and download center</p>
                  </div>
                  <Btn size="sm" variant="primary" onClick={() => openInvoice()}>
                    <FiFileText className="mr-1" /> View Active Statement
                  </Btn>
                </div>

                <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                  <table className="w-full text-xs">
                    <thead className="border-b border-slate-200 bg-slate-50/80 font-bold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-400">
                      <tr>
                        <th className="px-4 py-3 text-left">Document #</th>
                        <th className="px-4 py-3 text-left">Period / Date</th>
                        <th className="px-4 py-3 text-right">Billed</th>
                        <th className="px-4 py-3 text-right">Paid to Date</th>
                        <th className="px-4 py-3 text-right">Balance Due</th>
                        <th className="px-4 py-3 text-center">Status</th>
                        <th className="px-4 py-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                      <tr>
                        <td className="px-4 py-3 font-mono font-bold text-slate-900 dark:text-white">
                          {targetDocNumber}
                        </td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                          {fmtMonth(cycle?.periodMonth ?? new Date().toISOString().slice(0, 7))}
                          {cycle?.dueDateIso && <div className="text-[10px] text-slate-400">Due: {fmtDay(cycle.dueDateIso)}</div>}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold tabular-nums text-slate-900 dark:text-white">
                          {fmtUsd(cycle?.amountDueCents ?? monthlyBilled)}
                        </td>
                        <td className="px-4 py-3 text-right font-medium tabular-nums text-emerald-600 dark:text-emerald-400">
                          {fmtUsd(cycle?.paidThisCycleCents ?? 0)}
                        </td>
                        <td className="px-4 py-3 text-right font-black tabular-nums text-rose-600 dark:text-rose-400">
                          {fmtUsd(cycle?.balanceCents ?? monthlyBilled)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {isTrialOrg ? (
                            <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-bold text-blue-700 dark:bg-blue-950/40 dark:text-blue-400">
                              Trial Active
                            </span>
                          ) : (cycle?.balanceCents ?? monthlyBilled) === 0 ? (
                            <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
                              Paid in Full
                            </span>
                          ) : (cycle?.paidThisCycleCents ?? 0) > 0 ? (
                            <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-bold text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
                              Partially Paid
                            </span>
                          ) : (
                            <span className="rounded-full bg-rose-50 px-2.5 py-0.5 text-[11px] font-bold text-rose-700 dark:bg-rose-950/40 dark:text-rose-400">
                              Unpaid / Due
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => openInvoice(cycle?.periodMonth)}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                          >
                            <FiFileText className="h-3.5 w-3.5 text-[#FF6542]" /> Statement
                          </button>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Payment ledger */}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      Recorded Payment Receipts {byHand ? '(Bank Transfer)' : '(Stripe Auto)'}
                    </h3>
                    <p className="text-xs text-slate-500">Itemized ledger of all settled transactions and proofs</p>
                  </div>
                  {byHand && !isTrialOrg && (
                    <Btn size="sm" variant="primary" onClick={() => setRecording(true)}>
                      Record payment
                    </Btn>
                  )}
                </div>

                {byHand ? (
                  d.manualPayments.length === 0 ? (
                    <Empty>No payments recorded yet for this organization.</Empty>
                  ) : (
                    <LedgerTable
                      rows={d.manualPayments.map((p) => ({
                        key: String(p.id),
                        date: (p.paidAt ?? '').slice(0, 10) || '—',
                        amount: fmtUsd(p.amountCents),
                        meta: [
                          p.period
                            ? `For ${new Date(`${p.period.slice(0, 10)}T00:00:00`).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`
                            : null,
                          p.senderName ? `Sender: ${p.senderName}` : null,
                          p.bankName ? `Bank: ${p.bankName}` : null,
                          p.accountNumber ? `A/C: ${p.accountNumber}` : null,
                          p.reference ? `Ref: ${p.reference}` : null,
                        ]
                          .filter(Boolean)
                          .join(' · ') || '—',
                        note: p.note,
                        status: 'paid',
                        receiptUrl: p.receiptUrl,
                        onViewStatement: () => openInvoice(p.period ? p.period.slice(0, 7) : undefined),
                      }))}
                    />
                  )
                ) : d.invoices.length === 0 ? (
                  <Empty>No Stripe invoices yet.</Empty>
                ) : (
                  <LedgerTable
                    rows={d.invoices.map((inv) => ({
                      key: inv.id,
                      date: fmtUnix(inv.created),
                      amount: fmtUsd(inv.amountCents),
                      meta: inv.number || inv.id,
                      status: inv.status,
                      href: inv.hostedUrl || inv.pdfUrl || undefined,
                      onViewStatement: () => openInvoice(),
                    }))}
                  />
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Record Payment Modal */}
      {recording && (
        <RecordPaymentModal
          orgId={org.orgId}
          balanceCents={cycle?.balanceCents ?? d?.itemization.monthlyCents ?? org.monthlyCents}
          amountDueCents={cycle?.amountDueCents ?? d?.itemization.monthlyCents ?? org.monthlyCents}
          paidSoFarCents={cycle?.paidThisCycleCents ?? 0}
          periodMonth={cycle?.periodMonth}
          onClose={() => setRecording(false)}
          onSaved={() => {
            setRecording(false);
            qc.invalidateQueries({ queryKey: ['admin2', 'billing', 'detail', org.orgId] });
            qc.invalidateQueries({ queryKey: ['admin2', 'billing', 'orgs'] });
          }}
        />
      )}

      {/* Plan Template / Deviation Modal */}
      {planModalOpen && (
        <Modal
          title={noPlan ? 'Select a billing plan' : 'Change billing plan'}
          subtitle={`${org.name} — choose a catalog plan or define a custom agreement`}
          size="lg"
          onClose={() => setPlanModalOpen(false)}
        >
          <BillingPlanForm
            orgId={org.orgId}
            onSaved={() => {
              setPlanModalOpen(false);
              refreshBilling();
            }}
          />
        </Modal>
      )}
    </Modal>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between px-4 py-2.5">
      <span className="text-sm text-slate-600 dark:text-slate-300">{label}</span>
      <span className="text-sm tabular-nums">{value}</span>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 px-4 py-6 text-center text-sm text-slate-500 dark:border-slate-700">
      {children}
    </div>
  );
}

function LedgerTable({
  rows,
}: {
  rows: Array<{
    key: string;
    date: string;
    amount: string;
    meta: string;
    note?: string | null;
    status: string;
    href?: string;
    receiptUrl?: string | null;
    onViewStatement?: () => void;
  }>;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
      <table className="w-full text-sm">
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} className="border-b border-slate-100 last:border-0 dark:border-slate-800/60">
              <td className="px-4 py-2.5 tabular-nums text-slate-600 dark:text-slate-300">{r.date}</td>
              <td className="px-4 py-2.5 font-semibold tabular-nums">{r.amount}</td>
              <td className="px-4 py-2.5 text-xs text-slate-500">
                {r.meta}
                {r.note && <div className="mt-0.5 italic text-slate-400">“{r.note}”</div>}
              </td>
              <td className="px-4 py-2.5">
                <span className="text-xs font-semibold capitalize text-slate-500">{r.status}</span>
              </td>
              <td className="px-4 py-2.5 text-right whitespace-nowrap">
                {r.receiptUrl ? (
                  <a href={r.receiptUrl} target="_blank" rel="noreferrer" className="mr-2 inline-flex items-center gap-1 text-xs font-bold text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200">
                    <FiImage className="h-3 w-3" /> Receipt
                  </a>
                ) : null}
                {r.onViewStatement ? (
                  <button
                    type="button"
                    onClick={r.onViewStatement}
                    className="mr-2 inline-flex items-center gap-1 text-xs font-bold text-[#FF6542] hover:underline"
                  >
                    <FiFileText className="h-3 w-3" /> Invoice
                  </button>
                ) : null}
                {r.href ? (
                  <a href={r.href} target="_blank" rel="noreferrer" className="text-xs font-bold text-[#FF6542] hover:underline">
                    View
                  </a>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RecordPaymentModal({
  orgId,
  balanceCents,
  amountDueCents,
  paidSoFarCents,
  periodMonth,
  onClose,
  onSaved,
}: {
  orgId: number;
  /** Remaining balance for the cycle (the default amount). */
  balanceCents: number;
  /** Full charge for the cycle (for the "paid X of Y" line + Full/Half fills). */
  amountDueCents: number;
  /** Already collected this cycle. */
  paidSoFarCents: number;
  /** Service month this payment defaults to (YYYY-MM). */
  periodMonth?: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [amount, setAmount] = useState(((balanceCents ?? 0) / 100).toFixed(2));
  const [currency, setCurrency] = useState('USD');
  const [exchangeRate, setExchangeRate] = useState('280.00');
  const [pkrAmount, setPkrAmount] = useState(() => {
    const usd = parseFloat(amount) || 0;
    return (usd * 280).toFixed(0);
  });
  const [month, setMonth] = useState(periodMonth || new Date().toISOString().slice(0, 7)); // YYYY-MM
  const [bankName, setBankName] = useState('');
  const [senderName, setSenderName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');
  const [confirmOver, setConfirmOver] = useState(false);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    return () => {
      if (receiptPreview) URL.revokeObjectURL(receiptPreview);
    };
  }, [receiptPreview]);

  const updateUsd = (newUsd: string) => {
    setAmount(newUsd);
    setConfirmOver(false);
    const usdVal = parseFloat(newUsd);
    const rateVal = parseFloat(exchangeRate) || 280;
    if (!Number.isNaN(usdVal) && usdVal > 0) {
      setPkrAmount((usdVal * rateVal).toFixed(0));
    }
  };

  const bankValid = senderName.trim().length > 0 && bankName.trim().length > 0;

  const save = useMutation({
    mutationFn: () => {
      const cents = Math.round(parseFloat(amount) * 100);
      const isPkr = currency === 'PKR';
      const usdVal = parseFloat(amount) || 0;
      const rateVal = isPkr ? parseFloat(exchangeRate) || 280 : null;
      const pkrVal = isPkr ? parseFloat(pkrAmount) || (usdVal * (rateVal || 280)) : null;
      const pkrCents = pkrVal != null && pkrVal > 0 ? Math.round(pkrVal * 100) : null;

      return adminBillingApi.recordOrgPayment(orgId, {
        amountCents: cents,
        currency,
        exchangeRate: rateVal,
        originalAmountCents: pkrCents,
        period: month ? `${month}-01` : null,
        method: 'bank_transfer',
        bankName: bankName.trim(),
        senderName: senderName.trim(),
        accountNumber: accountNumber.trim() || null,
        reference: reference.trim() || null,
        note: note.trim() || null,
        receiptFile,
      });
    },
    onSuccess: onSaved,
  });

  const enteredCents = Math.round(parseFloat(amount) * 100);
  const amountValid = Number.isFinite(parseFloat(amount)) && parseFloat(amount) > 0;
  const isOver = amountValid && balanceCents > 0 && enteredCents > balanceCents;
  const setFill = (cents: number) => {
    updateUsd((cents / 100).toFixed(2));
  };

  return (
    <Modal title="Record payment" subtitle="Log an offline payment (bank transfer / cash)" onClose={onClose}>
      <div className="space-y-4">
        {/* Where this cycle stands, so a partial payment is recorded knowingly. */}
        {amountDueCents > 0 && (
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm dark:border-slate-800 dark:bg-slate-950/40">
            <span className="font-semibold tabular-nums">{fmtUsd(paidSoFarCents)}</span>
            <span className="text-slate-500"> paid of </span>
            <span className="font-semibold tabular-nums">{fmtUsd(amountDueCents)}</span>
            <span className="text-slate-500"> · </span>
            <span className={`font-semibold tabular-nums ${balanceCents > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
              {fmtUsd(balanceCents)} left
            </span>
          </div>
        )}

        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2">
            <Field label={currency === 'PKR' ? 'USD Credited ($)' : 'Amount (USD)'}>
              <input className={fieldInput} value={amount} onChange={(e) => updateUsd(e.target.value)} inputMode="decimal" />
              {balanceCents > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <Btn size="sm" onClick={() => setFill(balanceCents)}>Full balance ({fmtUsd(balanceCents)})</Btn>
                  <Btn size="sm" onClick={() => setFill(Math.round(balanceCents / 2))}>Half ({fmtUsd(Math.round(balanceCents / 2))})</Btn>
                </div>
              )}
            </Field>
          </div>
          <div>
            <Field label="Currency">
              <select
                className={fieldInput}
                value={currency}
                onChange={(e) => {
                  const newCurr = e.target.value;
                  setCurrency(newCurr);
                  if (newCurr === 'PKR') {
                    const usdVal = parseFloat(amount) || 0;
                    const rateVal = parseFloat(exchangeRate) || 280;
                    setPkrAmount((usdVal * rateVal).toFixed(0));
                  }
                }}
              >
                <option value="USD">USD ($)</option>
                <option value="PKR">PKR (Rs)</option>
              </select>
            </Field>
          </div>
        </div>

        {currency === 'PKR' && (
          <div className="space-y-2 rounded-xl border border-emerald-200 bg-emerald-50/60 p-3.5 text-xs dark:border-emerald-950/60 dark:bg-emerald-950/20">
            <div className="flex items-center justify-between font-bold text-emerald-900 dark:text-emerald-200">
              <span>Pakistani Rupee (PKR) Conversion</span>
              <span className="text-[11px] font-normal text-emerald-700 dark:text-emerald-400">Auto-calculated</span>
            </div>
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <Field label="PKR Received (Rs)" hint="Rupees paid into bank">
                  <input
                    className={fieldInput}
                    value={pkrAmount}
                    onChange={(e) => {
                      const newPkr = e.target.value;
                      setPkrAmount(newPkr);
                      const pkrVal = parseFloat(newPkr);
                      const usdVal = parseFloat(amount);
                      if (!Number.isNaN(pkrVal) && !Number.isNaN(usdVal) && usdVal > 0) {
                        setExchangeRate((pkrVal / usdVal).toFixed(2));
                      }
                    }}
                    inputMode="decimal"
                    placeholder="e.g. 25000"
                  />
                </Field>
              </div>
              <div>
                <Field label="Exchange Rate (PKR/USD)" hint="Current market / bank rate">
                  <input
                    className={fieldInput}
                    value={exchangeRate}
                    onChange={(e) => {
                      const newRate = e.target.value;
                      setExchangeRate(newRate);
                      const rateVal = parseFloat(newRate);
                      const usdVal = parseFloat(amount);
                      if (!Number.isNaN(rateVal) && !Number.isNaN(usdVal) && usdVal > 0) {
                        setPkrAmount((usdVal * rateVal).toFixed(0));
                      }
                    }}
                    inputMode="decimal"
                    placeholder="280.00"
                  />
                </Field>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Field label="For month">
            <input type="month" className={fieldInput} value={month} onChange={(e) => setMonth(e.target.value)} />
          </Field>
          <Field label="Method">
            <div className="flex h-[38px] items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-800 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-200">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              Bank transfer
            </div>
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Sender Name *" hint="Account title / payer">
            <input
              className={fieldInput}
              value={senderName}
              onChange={(e) => setSenderName(e.target.value)}
              placeholder="e.g. Muhammad Ali / Company"
            />
          </Field>
          <Field label="Bank Name *" hint="Sent from or received in">
            <input
              className={fieldInput}
              value={bankName}
              onChange={(e) => setBankName(e.target.value)}
              placeholder="e.g. Meezan Bank, Chase, HBL"
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Account / IBAN" hint="Optional account number or IBAN">
            <input
              className={fieldInput}
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value)}
              placeholder="e.g. PK00MEZN... or Account #"
            />
          </Field>
          <Field label="Reference" hint="Bank reference / txn id (optional)">
            <input
              className={fieldInput}
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="e.g. TXN-12345"
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3 items-start">
          <Field label="Note" hint="Internal note (optional)">
            <input
              className={fieldInput}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Optional notes..."
            />
          </Field>

          {/* Receipt attachment */}
          <Field label="Payment Receipt / Proof" hint="Upload image (JPG, PNG up to 10MB)">
            <div className="flex items-center gap-2">
              <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) {
                    setReceiptFile(f);
                    if (f.type.startsWith('image/')) {
                      setReceiptPreview(URL.createObjectURL(f));
                    } else {
                      setReceiptPreview(null);
                    }
                  }
                }}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                <FiImage className="h-4 w-4" />
                {receiptFile ? 'Change' : 'Attach receipt'}
              </button>
              {receiptFile && (
                <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
                  <span className="max-w-[90px] truncate">{receiptFile.name}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setReceiptFile(null);
                      setReceiptPreview(null);
                      if (fileInputRef.current) fileInputRef.current.value = '';
                    }}
                    className="rounded p-0.5 text-slate-400 hover:text-red-500"
                  >
                    <FiX className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>
            {receiptPreview && (
              <div className="mt-2 h-16 w-24 overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800">
                <img src={receiptPreview} alt="Receipt preview" className="h-full w-full object-cover" />
              </div>
            )}
          </Field>
        </div>

        {isOver && (
          <label className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
            <input
              type="checkbox"
              checked={confirmOver}
              onChange={(e) => setConfirmOver(e.target.checked)}
              className="mt-0.5"
            />
            <span>
              This is more than the {fmtUsd(balanceCents)} still owed this cycle — the account
              will show an overpayment (credit) of {fmtUsd(enteredCents - balanceCents)}. Confirm
              the amount is correct.
            </span>
          </label>
        )}
        {save.isError && (
          <div className="rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 dark:bg-red-950/30 dark:text-red-300">
            Could not record payment. Check the amount and try again.
          </div>
        )}
        <div className="flex justify-end gap-2 pt-1">
          <Btn variant="default" size="sm" onClick={onClose} disabled={save.isPending}>
            Cancel
          </Btn>
          <Btn variant="primary" size="sm" onClick={() => save.mutate()} disabled={!amountValid || !bankValid || save.isPending || (isOver && !confirmOver)}>
            {save.isPending ? 'Saving…' : 'Record payment'}
          </Btn>
        </div>
      </div>
    </Modal>
  );
}
