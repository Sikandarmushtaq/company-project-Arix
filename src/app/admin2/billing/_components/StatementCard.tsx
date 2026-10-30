'use client';

import React from 'react';
import {
  FiEye,
  FiPrinter,
  FiCheckCircle,
  FiClock,
  FiAlertCircle,
  FiCalendar,
  FiLayers,
} from 'react-icons/fi';
import type { OrgInvoice } from '@/lib/api/services/admin-billing.api';

const fmtUsd = (cents: number): string =>
  `$${((cents ?? 0) / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fmtDate = (d?: string | null): string => {
  if (!d) return '—';
  try {
    const dt = new Date(d.includes('T') ? d : `${d}T00:00:00`);
    return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return d;
  }
};

export function StatementCard({
  invoice,
  onView,
  onPrint,
  onRecordPayment,
}: {
  invoice: OrgInvoice;
  onView: () => void;
  onPrint: () => void;
  onRecordPayment?: () => void;
}) {
  const isPaid = invoice.status === 'paid' || invoice.balanceCents <= 0;
  const isPartial = invoice.status === 'partially_paid' && invoice.balanceCents > 0;
  const isUnpaid = (invoice.status as string) === 'open' || invoice.status === 'unpaid' || (!isPaid && !isPartial);

  let statusBadge = {
    label: 'Paid in Full',
    color: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800',
    icon: FiCheckCircle,
  };

  if (isPartial) {
    statusBadge = {
      label: 'Partially Paid',
      color: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800',
      icon: FiClock,
    };
  } else if (isUnpaid && invoice.balanceCents > 0) {
    statusBadge = {
      label: 'Balance Due',
      color: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800',
      icon: FiAlertCircle,
    };
  }

  const StatusIcon = statusBadge.icon;
  const paymentCount = (invoice.payments ?? []).length;
  const itemCount = (invoice.items ?? []).length;

  return (
    <div className="group flex flex-col md:flex-row md:items-center justify-between gap-4 sm:gap-6 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm transition hover:border-slate-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700">
      {/* 1. Left Section: Doc Number, Dates, Status Badge & Metadata */}
      <div className="flex-1 min-w-[260px]">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="font-mono text-sm font-extrabold text-slate-900 dark:text-white">
            {invoice.invoiceNumber}
          </span>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${statusBadge.color}`}
          >
            <StatusIcon className="h-3 w-3" />
            {statusBadge.label}
          </span>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
          <span className="inline-flex items-center gap-1.5 font-medium">
            <FiCalendar className="h-3.5 w-3.5 shrink-0 text-slate-400" />
            {fmtDate(invoice.cycleStart)} – {fmtDate(invoice.cycleEnd)}
          </span>
          <span className="text-slate-300 dark:text-slate-700">·</span>
          <span className="inline-flex items-center gap-1">
            <FiLayers className="h-3 w-3 text-slate-400" />
            {itemCount} {itemCount === 1 ? 'line item' : 'line items'}
          </span>
          <span className="text-slate-300 dark:text-slate-700">·</span>
          <span className="text-slate-400">
            {paymentCount === 0
              ? 'No payments'
              : `${paymentCount} ${paymentCount === 1 ? 'installment' : 'installments'}`}
          </span>
        </div>
      </div>

      {/* 2. Middle Section: Clean Aligned Financial Metrics */}
      <div className="flex items-center gap-6 sm:gap-10 shrink-0 border-y md:border-y-0 md:border-x border-slate-100 dark:border-slate-800/80 py-3 md:py-0 md:px-8">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Billed</div>
          <div className="mt-0.5 font-mono text-sm font-black text-slate-900 dark:text-slate-100">
            {fmtUsd(invoice.totalDueCents)}
          </div>
        </div>

        <div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Paid</div>
          <div className="mt-0.5 font-mono text-sm font-bold text-emerald-600 dark:text-emerald-400">
            {fmtUsd(invoice.paidCents)}
          </div>
        </div>

        <div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Balance</div>
          <div
            className={`mt-0.5 font-mono text-sm font-black ${
              invoice.balanceCents > 0
                ? 'text-rose-600 dark:text-rose-400'
                : 'text-slate-400 dark:text-slate-500'
            }`}
          >
            {fmtUsd(invoice.balanceCents)}
          </div>
        </div>
      </div>

      {/* 3. Right Section: Action Buttons */}
      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={onView}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
        >
          <FiEye className="h-3.5 w-3.5 text-slate-400" />
          <span>View Statement</span>
        </button>

        <button
          type="button"
          onClick={onPrint}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          title="Print / Save PDF"
        >
          <FiPrinter className="h-3.5 w-3.5 text-slate-400" />
          <span>PDF</span>
        </button>
      </div>
    </div>
  );
}
