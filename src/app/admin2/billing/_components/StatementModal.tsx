'use client';

import React, { useEffect, useCallback } from 'react';
import {
  FiX,
  FiPrinter,
  FiCheckCircle,
  FiClock,
  FiAlertCircle,
  FiShield,
  FiExternalLink,
} from 'react-icons/fi';
import type { OrgInvoice, OrgBillingDetail } from '@/lib/api/services/admin-billing.api';
import { printInvoice } from './printInvoice';
import { useAuthStore } from '@/lib/stores/auth';

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

const fmtMonth = (m?: string): string => {
  if (!m) return '—';
  try {
    const [y, mo] = m.split('-').map(Number);
    const dt = new Date(Date.UTC(y, mo - 1, 1));
    return dt.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  } catch {
    return m;
  }
};

export function StatementModal({
  invoice,
  detail,
  onClose,
}: {
  invoice: OrgInvoice;
  detail: OrgBillingDetail;
  onClose: () => void;
}) {
  const { user } = useAuthStore();
  const printedBy = user?.fullName
    ? `${user.fullName} (${user.email || 'Admin'})`
    : user?.email || 'Platform Superadmin';
  const printedAt = new Date().toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  const isPaid = invoice.status === 'paid';
  const isPartial = invoice.status === 'partially_paid';

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
  } else if (invoice.status === 'unpaid') {
    statusBadge = {
      label: 'Balance Due',
      color: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800',
      icon: FiAlertCircle,
    };
  } else if (invoice.status === 'void') {
    statusBadge = {
      label: 'Voided',
      color: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
      icon: FiAlertCircle,
    };
  }

  const org = {
    id: invoice.organizationId,
    name: detail?.organization?.name || `Organization #${invoice.organizationId}`,
    slug: detail?.organization?.slug || '',
    contactName: detail?.organization?.contactName,
    contactEmail: detail?.organization?.contactEmail,
    contactPhone: detail?.organization?.contactPhone,
    createdAt: detail?.organization?.createdAt,
  };

  const handlePrint = useCallback(() => {
    printInvoice({
      org,
      detail,
      docNumber: invoice.invoiceNumber,
      targetMonth: invoice.cycleStart.slice(0, 7),
      statusBadge,
      cyclePayments: invoice.payments ?? [],
      billedCents: invoice.totalDueCents,
      paidCents: invoice.paidCents,
      balanceCents: invoice.balanceCents,
      printedBy,
      printedAt,
    });
  }, [org, detail, invoice, statusBadge, printedBy, printedAt]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        handlePrint();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handlePrint]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-900/60 p-4 backdrop-blur-sm sm:p-6 print:hidden">
      <div className="relative my-8 w-full max-w-4xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900">
        {/* Sticky Action Top Bar */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/80 px-6 py-4 backdrop-blur dark:border-slate-800 dark:bg-slate-950/80">
          <div className="flex items-center gap-2 font-mono text-sm font-extrabold text-slate-900 dark:text-white">
            <span>Statement</span>
            <span className="text-[#FF6542]">{invoice.invoiceNumber}</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#FF6542] px-3.5 py-1.5 text-xs font-bold text-white shadow-sm transition hover:bg-[#e85535]"
            >
              <FiPrinter className="h-3.5 w-3.5" />
              <span>Print / Save PDF</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:border-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            >
              <FiX className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Printable Document Body */}
        <div className="max-h-[80vh] overflow-y-auto p-6 sm:p-10">
          {/* Document Header & Company Branding */}
          <div className="flex flex-wrap items-start justify-between gap-6 border-b border-slate-200 pb-8 dark:border-slate-800">
            <div>
              <div className="flex items-center gap-3">
                <img
                  src="/logo.png"
                  alt="ArixCall"
                  className="h-10 w-auto object-contain dark:hidden"
                />
                <img
                  src="/logo-light.png"
                  alt="ArixCall"
                  className="h-10 w-auto object-contain hidden dark:block"
                />
                <div>
                  <h1 className="text-xl font-black tracking-tight text-slate-900 dark:text-white">ArixCall</h1>
                  <p className="text-xs font-semibold text-slate-400">Enterprise Cloud PBX & Communications System</p>
                </div>
              </div>
              <div className="mt-4 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                <p>Global Billing & Telephony Operations</p>
                <p>support@arixcall.com · billing@arixcall.com · https://arixcall.com</p>
              </div>
            </div>

            <div className="text-right">
              <div className="inline-block rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 text-left shadow-sm dark:border-slate-800 dark:bg-slate-950/60">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Official Billing Statement
                </div>
                <div className="mt-1 font-mono text-base font-black text-slate-900 dark:text-slate-100">
                  {invoice.invoiceNumber}
                </div>
                <div className="mt-2.5 space-y-1 text-xs text-slate-600 dark:text-slate-400">
                  <div>
                    <span className="text-slate-400">Period: </span>
                    <span className="font-semibold tabular-nums">
                      {fmtDate(invoice.cycleStart)} – {fmtDate(invoice.cycleEnd)}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400">Due Date: </span>
                    <span className="font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                      {fmtDate(invoice.dueDate)}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400">Status: </span>
                    <span
                      className={`inline-flex items-center gap-1 font-bold ${
                        isPaid ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'
                      }`}
                    >
                      {statusBadge.label}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Billed To / Account Info */}
          <div className="flex flex-col sm:flex-row items-start justify-between gap-6 py-6 border-b border-slate-200 dark:border-slate-800">
            <div className="w-full sm:w-1/2">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-400">Billed To Customer</div>
              <div className="mt-1 text-base font-black text-slate-900 dark:text-white">{org.name}</div>
              <div className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                {org.contactName && <p className="font-bold text-slate-700 dark:text-slate-200">{org.contactName}</p>}
                {org.contactEmail && <p>{org.contactEmail}</p>}
                {org.contactPhone && <p className="font-mono">{org.contactPhone}</p>}
                <p className="font-mono text-slate-400 mt-1">Account ID: #{org.id} {org.slug ? `· ${org.slug}` : ''}</p>
              </div>
            </div>

            <div className="w-full sm:w-1/2 sm:text-right">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-400">Payment Clearance</div>
              <div className="mt-1 text-sm font-extrabold text-slate-900 dark:text-slate-100">
                Direct Bank Transfer (Manual Clearance)
              </div>
              <div className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                <p>Cycle Start: <span className="font-semibold">{fmtDate(invoice.cycleStart)}</span></p>
                <p>Cycle End: <span className="font-semibold">{fmtDate(invoice.cycleEnd)}</span></p>
                <p>All Ledger Amounts in USD ($)</p>
              </div>
            </div>
          </div>

          {/* Itemized Products & Licences Table */}
          <div className="py-6">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">
                Product Licences & Itemized Charges
              </h3>
            </div>
            <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:bg-slate-950 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="px-4 py-3">Product / Service Description</th>
                    <th className="px-4 py-3 text-center">Qty</th>
                    <th className="px-4 py-3 text-right">Unit Rate</th>
                    <th className="px-4 py-3 text-right">Total Monthly</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {(invoice.items ?? []).map((item) => {
                    const attrs = item.itemAttributes ?? {};
                    const explicitPercent = typeof attrs.deviationPercent === 'number' ? attrs.deviationPercent : null;
                    const standard = typeof attrs.standardRateCents === 'number' ? attrs.standardRateCents : 0;
                    const agreed = typeof attrs.agreedRateCents === 'number' ? attrs.agreedRateCents : 0;
                    const deviationPercent = explicitPercent ?? (standard > 0 ? ((agreed - standard) / standard) * 100 : null);
                    return (
                    <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/50">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-800 dark:text-slate-200">
                          {item.productNameSnapshot}
                        </div>
                        <div className="mt-0.5 text-[11px] text-slate-500">
                          {item.description}
                          {deviationPercent != null && (
                            <span className={`ml-1.5 inline-flex rounded-full px-2 py-0.5 text-[10px] font-black ${Math.abs(deviationPercent) < 0.005
                              ? 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                              : deviationPercent < 0
                              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
                              : 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400'}`}>
                              {Math.abs(deviationPercent) < 0.005
                                ? '0.00% deviation'
                                : `${Math.abs(deviationPercent).toFixed(2)}% ${deviationPercent < 0 ? 'discount' : 'premium'}`}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center font-semibold text-slate-700 dark:text-slate-300">
                        {item.quantity}
                      </td>
                      <td className="px-4 py-3 text-right font-medium tabular-nums text-slate-600 dark:text-slate-400">
                        {fmtUsd(item.unitPriceCents)}
                      </td>
                      <td className="px-4 py-3 text-right font-black tabular-nums text-slate-900 dark:text-slate-100">
                        {fmtUsd(item.totalCents)}
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Totals & Payments Applied Summary */}
          <div className="flex flex-col sm:flex-row items-start justify-between gap-8 border-t border-slate-200 pt-6 dark:border-slate-800">
            {/* Left: Payments Applied History */}
            <div className="w-full sm:w-1/2">
              <div className="text-xs font-black uppercase tracking-wider text-slate-400">
                Payments Applied for this Cycle
              </div>
              {(invoice.payments ?? []).length === 0 ? (
                <div className="mt-2 rounded-xl border border-dashed border-slate-200 p-4 text-xs text-slate-400 dark:border-slate-800">
                  No bank transfer payments recorded yet for this billing cycle.
                </div>
              ) : (
                <div className="mt-2 space-y-2">
                  {(invoice.payments ?? []).map((p) => (
                    <div
                      key={p.id}
                      className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs dark:border-slate-800 dark:bg-slate-950/40"
                    >
                      <div className="flex items-center justify-between font-bold text-slate-800 dark:text-slate-200">
                        <span>Paid on {fmtDate(p.actualPaymentDate || p.paidAt)}</span>
                        <span className="font-mono text-emerald-600 dark:text-emerald-400 font-black">
                          -{fmtUsd(p.amountCents)}
                        </span>
                      </div>
                      <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 space-y-0.5">
                        {p.bankName && <div><span className="font-semibold">Bank:</span> {p.bankName}</div>}
                        {p.senderName && <div><span className="font-semibold">Sender:</span> {p.senderName}</div>}
                        {p.reference && <div><span className="font-semibold">Ref:</span> {p.reference}</div>}
                        {p.currency === 'PKR' && p.originalAmountCents && (
                          <div>
                            <span className="font-semibold">Original:</span> Rs {(p.originalAmountCents / 100).toLocaleString()} PKR @ {p.exchangeRate}
                          </div>
                        )}
                        {p.receiptUrl && (
                          <div className="pt-1">
                            <a
                              href={p.receiptUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 font-bold text-[#FF6542] hover:underline"
                            >
                              <FiExternalLink className="h-3 w-3" /> View Bank Slip Attachment
                            </a>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Right: Balance Due Summary Box */}
            <div className="w-full sm:w-5/12">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-950/60">
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between text-slate-600 dark:text-slate-400">
                    <span>Total Billed Charges:</span>
                    <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
                      {fmtUsd(invoice.totalDueCents)}
                    </span>
                  </div>
                  <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                    <span>Less Payments Applied:</span>
                    <span className="font-mono font-bold">-{fmtUsd(invoice.paidCents)}</span>
                  </div>
                  <div className="border-t border-slate-200 pt-2 dark:border-slate-800">
                    <div className="flex justify-between text-sm font-black">
                      <span className="text-slate-900 dark:text-white">Outstanding Balance Due:</span>
                      <span
                        className={`font-mono text-base ${
                          invoice.balanceCents > 0
                            ? 'text-rose-600 dark:text-rose-400 font-black'
                            : 'text-emerald-600 dark:text-emerald-400 font-black'
                        }`}
                      >
                        {fmtUsd(invoice.balanceCents)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
