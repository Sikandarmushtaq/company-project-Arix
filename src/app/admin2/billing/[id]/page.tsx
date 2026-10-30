'use client';

/**
 * Dedicated Customer Billing Page — /admin2/billing/[id]
 *
 * Full-page, enterprise-grade billing management modeled after RingCentral.
 * Accessible directly at /admin2/billing/[id] (e.g. /admin2/billing/2).
 * Features:
 *  - 3 RingCentral Tabs: Overview & Charges, Product Details & Licences, Statements & Invoices
 *  - Interactive / Printable Official Statement Sheet (INV-YYYYMM-XXXX) with @media print
 *  - Offline Bank Transfer Payment Recording
 *  - Custom Plan & Quotas Editor
 *  - Account Suspension / Reactivation Control
 */

import React, { useRef, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  FiArrowLeft,
  FiPrinter,
  FiCheckCircle,
  FiClock,
  FiAlertCircle,
  FiFileText,
  FiShield,
  FiExternalLink,
  FiDollarSign,
  FiLayers,
  FiImage,
} from 'react-icons/fi';
import { toast } from '@/lib/stores/toast';
import { useAuthStore } from '@/lib/stores/auth';
import {
  adminBillingApi,
  type ManualPayment,
  type OrgBillingDetail,
  type CurrentCycle,
} from '@/lib/api/services/admin-billing.api';
import {
  Btn,
  Modal,
  StatusDot,
  type Health,
} from '../../_components/ui';
import { BillingPlanForm } from '../_components/BillingPlanForm';
import { RecordPaymentModal } from '../_components/RecordPaymentModal';
import { printInvoice } from '../_components/printInvoice';
import { StatementCard } from '../_components/StatementCard';
import { StatementModal } from '../_components/StatementModal';
import { StatementsFilterBar, type RangeFilterOption } from '../_components/StatementsFilterBar';
import type { OrgInvoice } from '@/lib/api/services/admin-billing.api';

const fmtUsd = (cents: number): string =>
  `$${((cents ?? 0) / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function DeviationBadge({ percent }: { percent?: number | null }) {
  if (percent == null || !Number.isFinite(percent)) return null;
  const discount = percent < 0;
  const matchesStandard = Math.abs(percent) < 0.005;
  return (
    <span className={`ml-1.5 inline-flex rounded-full px-2 py-0.5 text-[10px] font-black ${matchesStandard
      ? 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
      : discount
      ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
      : 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400'}`}>
      {matchesStandard ? '0.00% deviation' : `${Math.abs(percent).toFixed(2)}% ${discount ? 'discount' : 'premium'}`}
    </span>
  );
}

const fmtDate = (d?: string | null): string => {
  if (!d) return '—';
  try {
    const dt = new Date(d.includes('T') ? d : `${d}T00:00:00`);
    return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return d;
  }
};

const fmtMonth = (m?: string | null): string => {
  if (!m) return '—';
  try {
    const [y, mo] = m.split('-').map(Number);
    const d = new Date(y, (mo || 1) - 1, 1);
    return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  } catch {
    return m;
  }
};

const fmtDay = (d?: string): string => {
  if (!d) return '—';
  try {
    const dt = new Date(d.includes('T') ? d : `${d}T00:00:00`);
    return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return d;
  }
};

function cycleLook(c: CurrentCycle): { border: string; health: Health; label: string } {
  switch (c.collectionStatus) {
    case 'paid':
      return { border: 'border-emerald-200 bg-emerald-50/40 dark:border-emerald-950 dark:bg-emerald-950/20', health: 'ok', label: 'Paid in full' };
    case 'upcoming':
      return { border: 'border-slate-200 bg-slate-50/60 dark:border-slate-800 dark:bg-slate-900/40', health: 'off', label: 'Upcoming' };
    case 'due_soon':
      return { border: 'border-amber-200 bg-amber-50/50 dark:border-amber-950 dark:bg-amber-950/20', health: 'warn', label: c.partiallyPaid ? 'Partially paid' : 'Due soon' };
    case 'overdue':
      return { border: 'border-red-200 bg-red-50/50 dark:border-red-950 dark:bg-red-950/20', health: 'bad', label: c.partiallyPaid ? 'Overdue - partial' : 'Overdue' };
    default:
      return { border: 'border-slate-200 bg-slate-50/60 dark:border-slate-800 dark:bg-slate-900/40', health: 'off', label: '—' };
  }
}

export default function OrgBillingInvoicePage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const orgId = Number(params?.id);
  const router = useRouter();
  const qc = useQueryClient();
  const printRef = useRef<HTMLDivElement | null>(null);

  const queryPeriod = searchParams.get('period');
  const [selectedPeriod, setSelectedPeriod] = useState<string | null>(queryPeriod);
  const [tab, setTab] = useState<'overview' | 'licenses' | 'statements'>('overview');

  const [recording, setRecording] = useState(false);
  const [planModalOpen, setPlanModalOpen] = useState(false);
  const [showDisable, setShowDisable] = useState(false);
  const [disableReason, setDisableReason] = useState('');

  const [filterRange, setFilterRange] = useState<RangeFilterOption>('3m');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [statementPage, setStatementPage] = useState(1);
  const [previewInvoice, setPreviewInvoice] = useState<OrgInvoice | null>(null);
  const [selectedInvoiceForPayment, setSelectedInvoiceForPayment] = useState<OrgInvoice | null>(null);

  const detailQ = useQuery({
    queryKey: ['admin2', 'billing', 'detail', orgId],
    queryFn: () => adminBillingApi.getOrgBillingDetail(orgId),
    enabled: Boolean(orgId && !Number.isNaN(orgId)),
    staleTime: 15_000,
  });

  const statementsQ = useQuery({
    queryKey: ['admin2', 'billing', 'statements', orgId, filterRange, customFrom, customTo, statusFilter, statementPage],
    queryFn: () =>
      adminBillingApi.getOrgStatements(orgId, {
        range: filterRange,
        from: filterRange === 'custom' ? customFrom : undefined,
        to: filterRange === 'custom' ? customTo : undefined,
        status: statusFilter,
        page: statementPage,
        limit: 6,
      }),
    enabled: Boolean(orgId && !Number.isNaN(orgId)),
  });

  const refreshBilling = () => {
    qc.invalidateQueries({ queryKey: ['admin2', 'billing', 'detail', orgId] });
    qc.invalidateQueries({ queryKey: ['admin2', 'billing', 'orgs'] });
    qc.invalidateQueries({ queryKey: ['admin2', 'billing', 'statements', orgId] });
  };

  const suspend = useMutation({
    mutationFn: () => adminBillingApi.suspendOrg(orgId, disableReason),
    onSuccess: () => {
      toast.success('Organization disabled');
      setShowDisable(false);
      setDisableReason('');
      refreshBilling();
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : 'Could not disable the organization'),
  });

  const reactivate = useMutation({
    mutationFn: () => adminBillingApi.reactivateOrg(orgId),
    onSuccess: () => {
      toast.success('Organization re-enabled');
      refreshBilling();
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : 'Could not re-enable the organization'),
  });

  const d: OrgBillingDetail | undefined = detailQ.data;

  // Determine active period month (YYYY-MM)
  const currentMonth = d?.currentCycle?.periodMonth || new Date().toISOString().slice(0, 7);
  const targetMonth = selectedPeriod || currentMonth;

  // Document Number: INV-YYYYMM-XXXX
  const docNumber = `INV - ${targetMonth.replace(/-/g, '')} -${orgId.toString().padStart(4, '0')} `;

  const org = {
    id: orgId,
    name: d?.organization?.name || `Organization #${orgId} `,
    slug: d?.organization?.slug || '',
    contactName: d?.organization?.contactName,
    contactEmail: d?.organization?.contactEmail,
    contactPhone: d?.organization?.contactPhone,
    createdAt: d?.organization?.createdAt,
  };

  const isTrial = d?.isTrial || d?.detailBillingStatus === 'trial';
  const byHand = d ? d.paymentType !== 'stripe' : true;
  const cycle = d?.currentCycle;
  const noPlan = (d?.planLabel || 'No plan') === 'No plan';
  const billedCents = d?.subscription?.amountCents ?? d?.itemization.monthlyCents ?? 0;

  // Payments matching this cycle/period
  const cyclePayments: ManualPayment[] = (d?.manualPayments ?? []).filter((p) => {
    if (!p.period) return false;
    return p.period.startsWith(targetMonth);
  });
  const visibleManualPayments: ManualPayment[] = (d?.manualPayments ?? []).filter((p) => {
    if (filterRange !== 'custom' || !customFrom || !customTo) return true;
    const valueDate = p.actualPaymentDate || (p.paidAt ?? '').slice(0, 10);
    return Boolean(valueDate && valueDate >= customFrom && valueDate <= customTo);
  });

  const paidCents = isTrial
    ? 0
    : cyclePayments.length > 0
      ? cyclePayments.reduce((s, p) => s + p.amountCents, 0)
      : d?.currentCycle?.paidThisCycleCents ?? 0;

  const balanceCents = isTrial ? 0 : Math.max(0, billedCents - paidCents);

  // Status computation
  let statusBadge = {
    label: 'Paid in Full',
    bg: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800',
    icon: FiCheckCircle,
  };
  if (isTrial) {
    statusBadge = {
      label: 'Trial Active',
      bg: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-800',
      icon: FiClock,
    };
  } else if (balanceCents === 0 && billedCents > 0) {
    statusBadge = {
      label: 'Paid in Full',
      bg: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800',
      icon: FiCheckCircle,
    };
  } else if (paidCents > 0 && balanceCents > 0) {
    statusBadge = {
      label: 'Partially Paid',
      bg: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800',
      icon: FiClock,
    };
  } else if (billedCents > 0) {
    statusBadge = {
      label: 'Unpaid / Past Due',
      bg: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800',
      icon: FiAlertCircle,
    };
  } else {
    statusBadge = {
      label: 'Free / Comped',
      bg: 'bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-900 dark:text-slate-400 dark:border-slate-800',
      icon: FiCheckCircle,
    };
  }

  const StatusIcon = statusBadge.icon;

  const { user } = useAuthStore();
  const printedBy = user?.fullName
    ? `${user.fullName} (${user.email || 'Admin'})`
    : (user?.email || 'Platform Superadmin');
  const printedAt = new Date().toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  const handlePrint = () => {
    if (!d) return;
    printInvoice({
      org,
      detail: d,
      docNumber,
      targetMonth,
      statusBadge,
      cyclePayments,
      billedCents,
      paidCents,
      balanceCents,
      printedBy,
      printedAt,
    });
  };

  const handlePrintStatement = (inv: OrgInvoice) => {
    if (!d) return;
    let badge = {
      label: 'Paid in Full',
      color: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800',
      icon: FiCheckCircle,
    };
    if (inv.status === 'partially_paid') {
      badge = {
        label: 'Partially Paid',
        color: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800',
        icon: FiClock,
      };
    } else if (inv.status === 'unpaid') {
      badge = {
        label: 'Balance Due',
        color: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800',
        icon: FiAlertCircle,
      };
    } else if (inv.status === 'void') {
      badge = {
        label: 'Voided',
        color: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
        icon: FiAlertCircle,
      };
    }

    printInvoice({
      org,
      detail: d,
      docNumber: inv.invoiceNumber,
      targetMonth: inv.cycleStart.slice(0, 7),
      statusBadge: badge,
      cyclePayments: inv.payments ?? [],
      billedCents: inv.totalDueCents,
      paidCents: inv.paidCents,
      balanceCents: inv.balanceCents,
      printedBy,
      printedAt,
    });
  };

  // Distinct periods for quick switcher
  const availablePeriods = Array.from(
    new Set(
      [
        currentMonth,
        ...(d?.manualPayments || []).map((p) => (p.period ? p.period.slice(0, 7) : null)).filter(Boolean),
      ].filter(Boolean) as string[]
    )
  ).sort().reverse();

  if (detailQ.isLoading) {
    return (
      <div className="mx-auto max-w-5xl p-6 sm:p-10 space-y-6">
        <div className="h-6 w-48 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
        <div className="h-40 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800/50" />
        <div className="h-96 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800/50" />
      </div>
    );
  }

  if (detailQ.isError || !d) {
    return (
      <div className="mx-auto max-w-2xl p-10 text-center">
        <FiAlertCircle className="mx-auto h-12 w-12 text-rose-500 mb-3" />
        <h2 className="text-lg font-black">Billing Record Not Found</h2>
        <p className="mt-1 text-sm text-slate-500">
          Could not find billing details for Organization ID #{orgId}.
        </p>
        <div className="mt-6">
          <Link
            href="/admin2/billing"
            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white dark:bg-white dark:text-slate-900"
          >
            <FiArrowLeft className="h-4 w-4" /> Back to Billing
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100/70 p-4 sm:p-8 dark:bg-slate-950 print:bg-white print:p-0">
      {/* Print Stylesheet */}
      <style>{`
        @media print {
          nav, header, aside, .no-print {
            display: none !important;
          }
          body {
            background: white !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          #arixcall-invoice-statement {
            box-shadow: none !important;
            border: none !important;
            max-width: 100% !important;
            width: 100% !important;
            padding: 0 !important;
            margin: 0 !important;
          }
        }
      `}</style>

      {/* Top Header Bar (Hidden when printing) */}
      <div className="no-print mx-auto mb-6 max-w-7xl">
        {/* Row 1: Back to billing list button on top */}
        <div className="mb-4">
          <Link
            href="/admin2/billing"
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <FiArrowLeft className="h-4 w-4" />
            Back to Billing List
          </Link>
        </div>

        {/* Row 2: Organization Title & Subtitle at start of line, action buttons on right */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
              {org.name}
              {!org.name.includes(`#${org.id} `) && (
                <span className="text-sm font-normal text-slate-400">#{org.id}</span>
              )}
            </h1>
            <p className="mt-1 text-xs font-medium text-slate-500">
              {d.planLabel} · {fmtUsd(d.itemization.monthlyCents)}/mo · {byHand ? 'Bank Transfer (Manual)' : 'Stripe Auto'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Btn size="sm" variant="default" onClick={() => setPlanModalOpen(true)}>
              {noPlan ? 'Set plan' : 'Change plan'}
            </Btn>
            <Link
              href={`/admin2/organizations/${orgId}`}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <FiExternalLink className="h-3.5 w-3.5" />
              Org Profile
            </Link>
          </div>
        </div>
      </div>

      {/* Main Layout: Vertical Tabs Navigation (Left) + Content Workspace (Right) */}
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col lg:flex-row items-start gap-6">
          {/* Vertical 3-Tab Bar (Hidden when printing) */}
          <aside className="no-print w-full lg:w-64 shrink-0">
            <div className="rounded-2xl border border-slate-200 bg-white p-2.5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sticky top-6">
              <div className="px-3 py-2 text-[11px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Billing Menu
              </div>
              <nav className="flex flex-col space-y-1">
                <button
                  type="button"
                  onClick={() => setTab('overview')}
                  className={`flex w-full items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-xs font-bold transition text-left ${tab === 'overview'
                    ? 'bg-[#FF6542]/10 text-[#FF6542] dark:bg-[#FF6542]/20 font-black'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200'
                    }`}
                >
                  <FiDollarSign className="h-4 w-4 shrink-0" />
                  <span>Overview & Charges</span>
                </button>

                <button
                  type="button"
                  onClick={() => setTab('licenses')}
                  className={`flex w-full items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-xs font-bold transition text-left ${tab === 'licenses'
                    ? 'bg-[#FF6542]/10 text-[#FF6542] dark:bg-[#FF6542]/20 font-black'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200'
                    }`}
                >
                  <FiLayers className="h-4 w-4 shrink-0" />
                  <span>Product Details & Licences</span>
                </button>

                <button
                  type="button"
                  onClick={() => setTab('statements')}
                  className={`flex w-full items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-xs font-bold transition text-left ${tab === 'statements'
                    ? 'bg-[#FF6542]/10 text-[#FF6542] dark:bg-[#FF6542]/20 font-black'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200'
                    }`}
                >
                  <FiFileText className="h-4 w-4 shrink-0" />
                  <span>Statements & Invoices</span>
                </button>
              </nav>
            </div>
          </aside>

          {/* Main Content Workspace */}
          <main className="w-full flex-1 min-w-0 space-y-6">
            {/* TAB 1: OVERVIEW & CHARGES */}
            {tab === 'overview' && (
              <div className="space-y-6">
                {/* This billing cycle — collections view for by-hand orgs */}
                {byHand && !isTrial && cycle && cycle.collectionStatus !== 'none' && (() => {
                  const look = cycleLook(cycle);
                  return (
                    <div className="rounded-2xl border bg-white p-6 shadow-sm dark:bg-slate-900 border-slate-200 dark:border-slate-800">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="text-xs font-bold uppercase tracking-wider text-slate-400">Current Billing Cycle</div>
                          <div className="mt-1 text-3xl font-black tabular-nums text-slate-900 dark:text-white">
                            {fmtUsd(cycle.balanceCents)} <span className="text-sm font-semibold text-slate-400">balance due</span>
                          </div>
                          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                            {fmtUsd(cycle.paidThisCycleCents)} paid of {fmtUsd(cycle.amountDueCents)} · for {fmtMonth(cycle.periodMonth)}
                          </div>
                        </div>
                        <div className="text-right">
                          <StatusDot health={look.health} label={look.label} />
                          <div className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">Due {fmtDay(cycle.dueDateIso)}</div>
                        </div>
                      </div>
                      <div className="mt-4 flex flex-wrap items-center gap-2">
                        {byHand && !isTrial && (
                          <Btn size="sm" variant="primary" onClick={() => setRecording(true)}>
                            Record payment
                          </Btn>
                        )}
                        <button
                          type="button"
                          onClick={() => setTab('statements')}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                        >
                          <FiFileText className="h-3.5 w-3.5 text-[#FF6542]" /> View Full Invoice Statement
                        </button>
                      </div>
                    </div>
                  );
                })()}

                {/* What they pay monthly */}
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white">Monthly Subscription Components</h3>
                      <p className="text-xs text-slate-500">Breakdown of base plan, digital lines, and recurring add-ons</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setTab('licenses')}
                      className="inline-flex items-center gap-1 text-xs font-bold text-[#FF6542] hover:underline"
                    >
                      <FiLayers className="h-3.5 w-3.5" /> View Licences Catalog
                    </button>
                  </div>

                  <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
                    <div className="flex items-center justify-between px-4 py-3">
                      <span className="text-sm text-slate-600 dark:text-slate-300">
                        Plan — {noPlan ? <span className="italic text-slate-400">No plan set</span> : d.planLabel}
                      </span>
                      <div className="flex items-center gap-3">
                        {!noPlan && <span className="text-sm tabular-nums font-semibold">{fmtUsd(d.itemization.planCents)}</span>}
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
                        <div className="flex items-center justify-between px-4 py-3">
                          <span className="text-sm text-slate-600 dark:text-slate-300">
                            {paid > 0
                              ? `Phone numbers(${count} — ${freeShown} free, ${paid} × $5)`
                              : `Phone number${count === 1 ? '' : 's'} (${count} — included free)`}
                          </span>
                          <span className="text-sm tabular-nums font-semibold">{fmtUsd(d.itemization.numbersCents)}</span>
                        </div>
                      );
                    })()}
                    {d.itemization.bundle && (
                      <div className="flex items-center justify-between px-4 py-3">
                        <span className="text-sm text-slate-600 dark:text-slate-300">Bundle — {d.itemization.bundle.slug}</span>
                        <span className="text-sm tabular-nums font-semibold">{fmtUsd(d.itemization.bundle.monthlyCents)}</span>
                      </div>
                    )}
                    {d.itemization.smsAddonCents ? (
                      <div className="flex items-center justify-between px-4 py-3">
                        <span className="text-sm text-slate-600 dark:text-slate-300">High-Volume SMS Add-On</span>
                        <span className="text-sm tabular-nums font-semibold">{fmtUsd(d.itemization.smsAddonCents)}</span>
                      </div>
                    ) : null}
                    {(d.itemization.proratedSeatAddons ?? []).map((sp) => (
                      <div key={sp.id} className="flex items-center justify-between px-4 py-3 bg-amber-50/40 dark:bg-amber-950/20">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                            Additional Seat License (Prorated)
                          </span>
                          <span className="text-xs text-slate-400">
                            {sp.notes || `${sp.seatsAdded} seat added mid-cycle`}
                          </span>
                        </div>
                        <span className="text-sm tabular-nums font-semibold text-amber-700 dark:text-amber-400">
                          {fmtUsd(sp.proratedAmountCents)}
                        </span>
                      </div>
                    ))}
                    <div className="flex items-center justify-between bg-slate-50/70 px-4 py-3.5 dark:bg-slate-950/40">
                      <span className="text-sm font-black">Monthly Total{d.subscription ? ' (Stripe)' : ''}</span>
                      <span className="text-base font-black tabular-nums text-slate-900 dark:text-white">
                        {fmtUsd(d.subscription?.amountCents ?? d.itemization.monthlyCents)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Custom Plan Specs Chips */}
                {d.customPlan && (
                  <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                    <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-400">Plan Quotas & Limits</h3>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                      {([
                        ['Seats', d.customPlan.seats == null ? '—' : `${d.customPlan.activeUsers ?? d.activeUsersCount ?? 1} of ${d.customPlan.seats} seats`],
                        ['Devices / user', d.customPlan.devicesPerUser === 0 ? 'Unlimited' : `${d.customPlan.devicesPerUser ?? 5} devices`],
                        ['Numbers', `${d.customPlan.includedNumbers} free of ${d.customPlan.maxNumbers ?? 'unlimited'} `],
                        ['SMS Allowance', d.customPlan.smsAllowance ? `${d.customPlan.smsAllowance} / mo` : 'Standard'],
                      ] as const).map(([k, v]) => (
                        <div key={k} className="rounded-xl border border-slate-200 bg-slate-50/50 p-3.5 dark:border-slate-800 dark:bg-slate-950/40">
                          <div className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{k}</div>
                          <div className="mt-1 text-sm font-black tabular-nums text-slate-900 dark:text-white">{v}</div>
                        </div>
                      ))
                      }
                    </div >
                  </div >
                )}

                {/* Account Suspension / Enable */}
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">Account Access Control</h3>
                  {d.billingStatus === 'suspended' ? (
                    <div className="rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-950 dark:bg-red-950/30">
                      <div className="text-sm font-black text-red-700 dark:text-red-300">Account Disabled / Suspended</div>
                      {d.suspendReason && (
                        <p className="mt-1 text-sm text-red-700/80 dark:text-red-300/80">Reason shown to customer: “{d.suspendReason}”</p>
                      )}
                      <div className="mt-3">
                        <Btn size="sm" variant="primary" onClick={() => reactivate.mutate()} disabled={reactivate.isPending}>
                          {reactivate.isPending ? 'Enabling…' : 'Re-enable account'}
                        </Btn>
                      </div>
                    </div>
                  ) : !showDisable ? (
                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-4 dark:border-slate-800">
                      <span className="text-sm text-slate-500 dark:text-slate-400">
                        Disabling blocks this organization from calling, texting and signing in until re-enabled.
                      </span>
                      <Btn size="sm" variant="danger" onClick={() => setShowDisable(true)}>
                        Disable account
                      </Btn>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
                      <label className="text-sm font-bold">
                        Reason (shown to customer)
                        <textarea
                          value={disableReason}
                          onChange={(e) => setDisableReason(e.target.value)}
                          rows={2}
                          className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#FF6542] dark:border-slate-700 dark:bg-slate-950"
                          placeholder="e.g. Payment overdue — please settle the outstanding invoice to restore service."
                        />
                      </label>
                      <div className="mt-3 flex justify-end gap-2">
                        <Btn size="sm" onClick={() => { setShowDisable(false); setDisableReason(''); }} disabled={suspend.isPending}>
                          Cancel
                        </Btn>
                        <Btn size="sm" variant="danger" onClick={() => suspend.mutate()} disabled={suspend.isPending || !disableReason.trim()}>
                          {suspend.isPending ? 'Disabling…' : 'Disable account'}
                        </Btn>
                      </div>
                    </div>
                  )}
                </div>
              </div >
            )}

            {/* TAB 2: PRODUCT DETAILS & LICENCES (RingCentral Design 2) */}
            {
              tab === 'licenses' && (
                <div className="space-y-6">
                  {/* KPI Summary Cards */}
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                      <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Monthly Bill</div>
                      <div className="mt-1 text-xl font-black text-slate-900 dark:text-white">{fmtUsd(billedCents)}</div>
                      <div className="mt-0.5 text-[11px] text-slate-500">{byHand ? 'Offline Bank Transfer' : 'Auto-Stripe'}</div>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                      <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Voice Licences</div>
                      <div className="mt-1 text-xl font-black text-slate-900 dark:text-white">
                        {d.customPlan?.activeUsers ?? d.activeUsersCount ?? 1} Active Seats
                      </div>
                      <div className="mt-0.5 text-[11px] text-slate-500">
                        {d.customPlan?.seats ? `${d.customPlan.seats} max quota (${d.planLabel})` : d.planLabel}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                      <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Direct Lines (DID)</div>
                      <div className="mt-1 text-xl font-black text-slate-900 dark:text-white">{d.itemization.numbers.length} Lines</div>
                      <div className="mt-0.5 text-[11px] text-slate-500">{d.itemization.numbers.filter(n => n.included).length} free included</div>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                      <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Device Quota</div>
                      <div className="mt-1 text-xl font-black text-slate-900 dark:text-white">
                        {d.customPlan?.devicesPerUser === 0 ? 'Unlimited' : `${d.customPlan?.devicesPerUser ?? 5} / seat`}
                      </div>
                      <div className="mt-0.5 text-[11px] text-slate-500">SIP & WebRTC devices</div>
                    </div>
                  </div>

                  {/* Enterprise Itemized Catalog Table */}
                  <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
                    <div className="border-b border-slate-200 px-6 py-4 dark:border-slate-800 flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white">Active Licences & Itemized Breakdown</h3>
                        <p className="text-xs text-slate-500">Standard software seats, digital phone numbers, and communication packages</p>
                      </div>
                      <Btn size="sm" variant="default" onClick={() => setPlanModalOpen(true)}>
                        Edit Plan & Quotas
                      </Btn>
                    </div>

                    <table className="w-full text-left text-xs">
                      <thead className="border-b border-slate-200 bg-slate-50 font-bold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-400">
                        <tr>
                          <th className="px-6 py-3.5">Product / Service</th>
                          <th className="px-6 py-3.5">Specifications & Inclusions</th>
                          <th className="px-6 py-3.5 text-center">Qty</th>
                          <th className="px-6 py-3.5 text-right">Unit Rate</th>
                          <th className="px-6 py-3.5 text-right">Total Monthly</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                        <tr>
                          <td className="px-6 py-4 font-bold text-slate-900 dark:text-white">
                            {d.planLabel} — Core Cloud PBX Base Seat
                          </td>
                          <td className="px-6 py-4 text-slate-500">
                            1 included primary seat license (out of {d.customPlan?.seats ?? 5} max quota) · Unlimited calling & dialer
                            <div className="mt-1">
                              Standard {fmtUsd(d.customPlan?.standardSeatPriceCents ?? d.standardSeatPriceCents ?? d.itemization.planCents)}
                              <DeviationBadge
                                percent={(() => {
                                  const standard = d.customPlan?.standardSeatPriceCents ?? d.standardSeatPriceCents ?? 0;
                                  const agreed = d.customPlan?.agreedSeatPriceCents ?? d.agreedSeatPriceCents ?? d.itemization.planCents;
                                  return standard > 0 ? ((agreed - standard) / standard) * 100 : null;
                                })()}
                              />
                            </div>
                          </td>
                          <td className="px-6 py-4 text-center font-semibold tabular-nums text-slate-700 dark:text-slate-300">
                            1
                          </td>
                          <td className="px-6 py-4 text-right font-medium tabular-nums text-slate-600 dark:text-slate-300">
                            {fmtUsd(d.customPlan?.agreedSeatPriceCents ?? d.itemization.planCents)}
                          </td>
                          <td className="px-6 py-4 text-right font-black tabular-nums text-slate-900 dark:text-white">
                            {fmtUsd(d.itemization.planCents)}
                          </td>
                        </tr>
                        {(d.itemization.proratedSeatAddons ?? []).map((sp) => (
                          <tr key={sp.id} className="bg-amber-50/20 dark:bg-amber-950/10">
                            <td className="px-6 py-4 font-bold text-slate-900 dark:text-white">
                              Additional Software Seat License (Prorated)
                            </td>
                            <td className="px-6 py-4 text-slate-500">
                              {sp.notes || 'Mid-cycle licensed user addition (prorated for remaining days in cycle)'}
                            </td>
                            <td className="px-6 py-4 text-center font-semibold tabular-nums text-slate-700 dark:text-slate-300">
                              {sp.seatsAdded}
                            </td>
                            <td className="px-6 py-4 text-right font-medium tabular-nums text-slate-600 dark:text-slate-300">
                              {fmtUsd(sp.proratedAmountCents)}
                            </td>
                            <td className="px-6 py-4 text-right font-black tabular-nums text-amber-700 dark:text-amber-400">
                              {fmtUsd(sp.proratedAmountCents)}
                            </td>
                          </tr>
                        ))}
                        {d.itemization.numbers.length > 0 && (
                          <tr>
                            <td className="px-6 py-4 font-bold text-slate-900 dark:text-white">
                              Direct Inward Dialing (DID) Phone Numbers
                            </td>
                            <td className="px-6 py-4 text-slate-500">
                              USA/Canada & Local voice/SMS routes. First {d.customPlan?.includedNumbers ?? 1} free; $5.00/mo per extra DID
                            </td>
                            <td className="px-6 py-4 text-center font-semibold tabular-nums text-slate-700 dark:text-slate-300">
                              {d.itemization.numbers.length}
                            </td>
                            <td className="px-6 py-4 text-right font-medium tabular-nums text-slate-600 dark:text-slate-300">
                              $5.00 (extra)
                            </td>
                            <td className="px-6 py-4 text-right font-black tabular-nums text-slate-900 dark:text-white">
                              {fmtUsd(d.itemization.numbersCents)}
                            </td>
                          </tr>
                        )}
                        {d.itemization.bundle && (
                          <tr>
                            <td className="px-6 py-4 font-bold text-slate-900 dark:text-white">
                              Bundle — {d.itemization.bundle.slug}
                            </td>
                            <td className="px-6 py-4 text-slate-500">
                              {d.itemization.bundle.minutes} included voice minutes · {d.itemization.bundle.sms} SMS pool
                            </td>
                            <td className="px-6 py-4 text-center font-semibold tabular-nums text-slate-700 dark:text-slate-300">
                              1
                            </td>
                            <td className="px-6 py-4 text-right font-medium tabular-nums text-slate-600 dark:text-slate-300">
                              {fmtUsd(d.itemization.bundle.monthlyCents)}
                            </td>
                            <td className="px-6 py-4 text-right font-black tabular-nums text-slate-900 dark:text-white">
                              {fmtUsd(d.itemization.bundle.monthlyCents)}
                            </td>
                          </tr>
                        )}
                        {(d.itemization.smsAddons ?? []).map((addon) => (
                          <tr key={addon.id}>
                            <td className="px-6 py-4 font-bold text-slate-900 dark:text-white">
                              {addon.name}
                            </td>
                            <td className="px-6 py-4 text-slate-500">
                              {addon.smsCount.toLocaleString()} individual SMS credits · Standard total {fmtUsd(addon.standardTotalCents ?? 0)}
                              <DeviationBadge percent={addon.deviationPercent} />
                            </td>
                            <td className="px-6 py-4 text-center font-semibold tabular-nums text-slate-700 dark:text-slate-300">
                              {addon.smsCount}
                            </td>
                            <td className="px-6 py-4 text-right font-medium tabular-nums text-slate-600 dark:text-slate-300">
                              {fmtUsd(addon.priceCents)} agreed
                            </td>
                            <td className="px-6 py-4 text-right font-black tabular-nums text-slate-900 dark:text-white">
                              {fmtUsd(addon.priceCents)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="border-t border-slate-200 bg-slate-50 font-bold dark:border-slate-800 dark:bg-slate-950/60">
                        <tr>
                          <td colSpan={4} className="px-6 py-4 text-right uppercase tracking-wider text-slate-500">
                            Total Monthly Recurring Charge:
                          </td>
                          <td className="px-6 py-4 text-right text-base font-black tabular-nums text-slate-900 dark:text-white">
                            {fmtUsd(billedCents)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>

                  {/* Individual Phone Numbers Roster */}
                  {d.itemization.numbers.length > 0 && (
                    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
                      <div className="border-b border-slate-200 px-6 py-4 dark:border-slate-800">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Assigned Direct Digital Phone Lines (DIDs)</h4>
                      </div>
                      <table className="w-full text-xs">
                        <thead className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-500 dark:border-slate-800 dark:bg-slate-950/40">
                          <tr>
                            <th className="px-6 py-2.5 text-left">Phone Number</th>
                            <th className="px-6 py-2.5 text-left">Type</th>
                            <th className="px-6 py-2.5 text-left">Plan Allowance Tier</th>
                            <th className="px-6 py-2.5 text-right">Assigned User / Destination</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                          {d.itemization.numbers.map((n, i) => (
                            <tr key={i}>
                              <td className="px-6 py-3 font-mono font-bold text-slate-800 dark:text-slate-200">{n.number}</td>
                              <td className="px-6 py-3 capitalize text-slate-500">{n.type || 'Local DID'}</td>
                              <td className="px-6 py-3">
                                {n.included ? (
                                  <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
                                    Included in Plan (Free)
                                  </span>
                                ) : (
                                  <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                    $5.00 / month
                                  </span>
                                )}
                              </td>
                              <td className="px-6 py-3 text-right text-slate-500">
                                {n.assignedUserId ? `User ID #${n.assignedUserId}` : 'Company Inbound Pool'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )
            }

            {/* TAB 3: STATEMENTS & INVOICES (RingCentral Design 1) */}
            {
              tab === 'statements' && (
                <div className="space-y-8">
                  {/* Filter Bar with Period Tabs, Status Dropdown, and Custom Date Pickers */}
                  <StatementsFilterBar
                    range={filterRange}
                    onRangeChange={(r) => {
                      setFilterRange(r);
                      setStatementPage(1);
                    }}
                    status={statusFilter}
                    onStatusChange={(s) => {
                      setStatusFilter(s);
                      setStatementPage(1);
                    }}
                    customFrom={customFrom}
                    customTo={customTo}
                    onCustomFromChange={setCustomFrom}
                    onCustomToChange={setCustomTo}
                    summary={statementsQ.data?.summary}
                  />

                  {/* Statements List (Horizontal Rectangular Cards) */}
                  {statementsQ.isLoading ? (
                    <div className="space-y-3">
                      {[1, 2, 3].map((i) => (
                        <div
                          key={i}
                          className="h-24 rounded-2xl border border-slate-200/80 bg-white p-5 animate-pulse dark:border-slate-800 dark:bg-slate-900"
                        />
                      ))}
                    </div>
                  ) : statementsQ.isError ? (
                    <div className="rounded-2xl border border-rose-200 bg-rose-50/50 p-8 text-center dark:border-rose-900/60 dark:bg-rose-950/20">
                      <FiAlertCircle className="mx-auto h-8 w-8 text-rose-500 mb-2" />
                      <h4 className="text-sm font-bold text-rose-900 dark:text-rose-200">
                        Unable to load billing statements
                      </h4>
                      <p className="mt-1 text-xs text-rose-700/80 dark:text-rose-300/80 max-w-sm mx-auto">
                        {(statementsQ.error as Error)?.message || 'A network error occurred while loading statements.'}
                      </p>
                      <div className="mt-4">
                        <Btn size="sm" variant="default" onClick={() => statementsQ.refetch()}>
                          Retry
                        </Btn>
                      </div>
                    </div>
                  ) : (statementsQ.data?.statements.length ?? 0) === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center dark:border-slate-800 dark:bg-slate-900">
                      <FiFileText className="mx-auto h-10 w-10 text-slate-300 dark:text-slate-600 mb-3" />
                      <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                        No billing statements found
                      </h4>
                      <p className="mt-1 text-xs text-slate-500 max-w-sm mx-auto">
                        No statements match the selected period or status filter. Try switching to a wider date range or clearing filters.
                      </p>
                      <div className="mt-4">
                        <Btn
                          size="sm"
                          variant="default"
                          onClick={() => {
                            setFilterRange('all');
                            setStatusFilter('all');
                            setStatementPage(1);
                          }}
                        >
                          Reset Filters
                        </Btn>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {statementsQ.data!.statements.map((inv) => (
                        <StatementCard
                          key={inv.id}
                          invoice={inv}
                          onView={() => setPreviewInvoice(inv)}
                          onPrint={() => handlePrintStatement(inv)}
                          onRecordPayment={() => {
                            setSelectedInvoiceForPayment(inv);
                            setRecording(true);
                          }}
                        />
                      ))}

                      {/* Pagination Controls */}
                      {statementsQ.data?.pagination && statementsQ.data.pagination.totalPages > 1 && (
                        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-white px-5 py-3.5 rounded-2xl dark:border-slate-800 dark:bg-slate-900 mt-4 shadow-sm">
                          <span className="text-xs text-slate-500">
                            Showing page <strong className="text-slate-900 dark:text-white font-mono">{statementsQ.data.pagination.page}</strong> of{' '}
                            <strong className="text-slate-900 dark:text-white font-mono">{statementsQ.data.pagination.totalPages}</strong> ({statementsQ.data.pagination.total} statements total)
                          </span>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              disabled={!statementsQ.data.pagination.hasPrev}
                              onClick={() => setStatementPage((p) => Math.max(1, p - 1))}
                              className="rounded-xl border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                            >
                              Previous
                            </button>
                            <button
                              type="button"
                              disabled={!statementsQ.data.pagination.hasNext}
                              onClick={() => setStatementPage((p) => p + 1)}
                              className="rounded-xl border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                            >
                              Next
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Payment Ledger Table */}
                  <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                    <div className="mb-4 flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                          Recorded Payment Receipts {byHand ? '(Bank Transfer)' : '(Stripe Auto)'}
                        </h3>
                        <p className="text-xs text-slate-500">
                          {filterRange === 'custom' && customFrom && customTo
                            ? 'Settled transactions whose payment date falls in the selected range'
                            : 'Historical ledger of all settled transactions and proofs'}
                        </p>
                      </div>
                      {byHand && !isTrial && (
                        <Btn size="sm" variant="primary" onClick={() => setRecording(true)}>
                          Record Payment
                        </Btn>
                      )}
                    </div>

                    {byHand ? (
                      visibleManualPayments.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500 dark:border-slate-700">
                          No payments recorded yet for this organization.
                        </div>
                      ) : (
                        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                          <table className="w-full text-sm">
                            <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-400">
                              <tr>
                                <th className="px-4 py-2.5 text-left">Payment Date</th>
                                <th className="px-4 py-2.5 text-left">System Entry</th>
                                <th className="px-4 py-2.5 text-left">Target Statement</th>
                                <th className="px-4 py-2.5 text-left">Amount</th>
                                <th className="px-4 py-2.5 text-left">Bank & Sender Details</th>
                                <th className="px-4 py-2.5 text-center">Status</th>
                                <th className="px-4 py-2.5 text-right">Receipt</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs">
                              {visibleManualPayments.map((p) => {
                                const linkedInvoice = p.invoiceId ? statementsQ.data?.statements.find((s) => s.id === p.invoiceId) : null;
                                const valueDate = p.actualPaymentDate || (p.paidAt ?? '').slice(0, 10) || '—';
                                const systemDate = (p.systemEntryAt || p.paidAt || '').slice(0, 10) || '—';

                                return (
                                  <tr key={p.id}>
                                    <td className="px-4 py-3 tabular-nums font-medium text-slate-700 dark:text-slate-200">
                                      {valueDate}
                                    </td>
                                    <td className="px-4 py-3 tabular-nums text-slate-500 text-[11px]">
                                      {systemDate}
                                    </td>
                                    <td className="px-4 py-3">
                                      {linkedInvoice ? (
                                        <button
                                          type="button"
                                          onClick={() => setPreviewInvoice(linkedInvoice)}
                                          className="font-mono text-xs font-bold text-[#FF6542] hover:underline"
                                        >
                                          {linkedInvoice.invoiceNumber}
                                        </button>
                                      ) : p.invoiceId ? (
                                        <span className="font-mono text-xs text-slate-600 dark:text-slate-400">
                                          Inv #{p.invoiceId}
                                        </span>
                                      ) : (
                                        <span className="text-slate-400 italic">Unallocated</span>
                                      )}
                                    </td>
                                    <td className="px-4 py-3 font-bold tabular-nums text-slate-900 dark:text-white">
                                      {fmtUsd(p.amountCents)}
                                    </td>
                                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                                      <div>
                                        {p.senderName && <span className="font-semibold text-slate-800 dark:text-slate-200">{p.senderName} · </span>}
                                        {p.bankName && <span>{p.bankName}</span>}
                                        {p.accountNumber && <span className="text-slate-400"> ({p.accountNumber})</span>}
                                      </div>
                                      {p.reference && <div className="text-[11px] text-slate-400 font-mono">Ref: {p.reference}</div>}
                                      {p.note && <div className="italic text-slate-400 mt-0.5">“{p.note}”</div>}
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                      <span className="inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
                                        Settled
                                      </span>
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                      {p.receiptUrl ? (
                                        <a
                                          href={p.receiptUrl}
                                          target="_blank"
                                          rel="noreferrer"
                                          className="inline-flex items-center gap-1 font-bold text-[#FF6542] hover:underline"
                                        >
                                          <FiImage className="h-3.5 w-3.5" /> Receipt
                                        </a>
                                      ) : (
                                        <span className="text-slate-400">—</span>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )
                    ) : d.invoices.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500 dark:border-slate-700">
                        No Stripe invoices recorded.
                      </div>
                    ) : (
                      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                        <table className="w-full text-sm text-xs">
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                            {d.invoices.map((inv) => (
                              <tr key={inv.id}>
                                <td className="px-4 py-3">{new Date(inv.created * 1000).toISOString().slice(0, 10)}</td>
                                <td className="px-4 py-3 font-bold">{fmtUsd(inv.amountCents)}</td>
                                <td className="px-4 py-3 text-slate-500 font-mono">{inv.number || inv.id}</td>
                                <td className="px-4 py-3 text-center capitalize">{inv.status}</td>
                                <td className="px-4 py-3 text-right">
                                  {inv.hostedUrl ? (
                                    <a href={inv.hostedUrl} target="_blank" rel="noreferrer" className="font-bold text-[#FF6542] hover:underline">
                                      View
                                    </a>
                                  ) : null}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              )
            }
          </main >
        </div >
      </div >

      {/* Record Payment Modal */}
      {recording && (
        <RecordPaymentModal
          orgId={orgId}
          balanceCents={selectedInvoiceForPayment?.balanceCents ?? cycle?.balanceCents ?? d.itemization.monthlyCents}
          amountDueCents={selectedInvoiceForPayment?.totalDueCents ?? cycle?.amountDueCents ?? d.itemization.monthlyCents}
          paidSoFarCents={selectedInvoiceForPayment?.paidCents ?? cycle?.paidThisCycleCents ?? 0}
          periodMonth={selectedInvoiceForPayment?.cycleStart.slice(0, 7) ?? cycle?.periodMonth}
          invoiceId={selectedInvoiceForPayment?.id}
          invoices={statementsQ.data?.statements}
          onClose={() => {
            setRecording(false);
            setSelectedInvoiceForPayment(null);
          }}
          onSaved={() => {
            setRecording(false);
            setSelectedInvoiceForPayment(null);
            refreshBilling();
          }}
        />
      )}

      {/* Statement Detail Modal */}
      {previewInvoice && d && (
        <StatementModal
          invoice={previewInvoice}
          detail={d}
          onClose={() => setPreviewInvoice(null)}
        />
      )}

      {/* Plan Template / Deviations Modal */}
      {planModalOpen && (
        <Modal
          title={noPlan ? 'Select a billing plan' : 'Change billing plan'}
          subtitle={`${org.name} — choose a catalog plan or define a custom agreement`}
          size="lg"
          onClose={() => setPlanModalOpen(false)}
        >
          <BillingPlanForm
            orgId={orgId}
            onSaved={() => {
              setPlanModalOpen(false);
              refreshBilling();
            }}
          />
        </Modal>
      )}
    </div>
  );
}
