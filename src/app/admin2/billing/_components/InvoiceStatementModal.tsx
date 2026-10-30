'use client';

import React, { useRef } from 'react';
import {
  FiPrinter,
  FiX,
  FiCheckCircle,
  FiClock,
  FiAlertCircle,
  FiFileText,
  FiArrowDownRight,
  FiShield,
} from 'react-icons/fi';
import type { OrgBillingDetail, ManualPayment } from '@/lib/api/services/admin-billing.api';

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

interface InvoiceStatementModalProps {
  org: {
    id: number;
    name: string;
    slug?: string;
    contactName?: string | null;
    contactEmail?: string | null;
    contactPhone?: string | null;
    createdAt?: string | null;
  };
  detail: OrgBillingDetail;
  periodMonth?: string; // YYYY-MM
  onClose: () => void;
}

export function InvoiceStatementModal({
  org,
  detail,
  periodMonth,
  onClose,
}: InvoiceStatementModalProps) {
  const printRef = useRef<HTMLDivElement | null>(null);

  const targetMonth = periodMonth || detail.currentCycle?.periodMonth || new Date().toISOString().slice(0, 7);
  const docNumber = `INV-${targetMonth.replace(/-/g, '')}-${org.id.toString().padStart(4, '0')}`;

  const isTrial = detail.isTrial;
  const billedCents = detail.subscription?.amountCents ?? detail.itemization.monthlyCents;

  // Payments matching this cycle/period
  const cyclePayments: ManualPayment[] = (detail.manualPayments ?? []).filter((p) => {
    if (!p.period) return false;
    return p.period.startsWith(targetMonth);
  });

  const paidCents = isTrial
    ? 0
    : cyclePayments.length > 0
    ? cyclePayments.reduce((s, p) => s + p.amountCents, 0)
    : detail.currentCycle?.paidThisCycleCents ?? 0;

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

  const handlePrint = () => {
    window.print();
  };

  const StatusIcon = statusBadge.icon;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm print:static print:bg-white print:p-0 print:backdrop-blur-none">
      {/* Print-specific style tag */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #arixcall-invoice-statement,
          #arixcall-invoice-statement * {
            visibility: visible;
          }
          #arixcall-invoice-statement {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            margin: 0;
            padding: 24px;
            background: white !important;
            color: black !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      <div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900 print:max-h-none print:border-none print:shadow-none">
        {/* Top Control Bar (Hidden when printing) */}
        <div className="no-print flex items-center justify-between border-b border-slate-200 bg-slate-50 px-6 py-4 dark:border-slate-800 dark:bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#FF6542]/10 text-[#FF6542]">
              <FiFileText className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm font-bold text-slate-800 dark:text-slate-100">{docNumber}</span>
                <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-bold ${statusBadge.bg}`}>
                  <StatusIcon className="h-3 w-3" />
                  {statusBadge.label}
                </span>
              </div>
              <p className="text-xs text-slate-500">Service Period: {targetMonth}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-2 rounded-xl bg-[#FF6542] px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-[#e85535]"
            >
              <FiPrinter className="h-4 w-4" />
              Print / Save as PDF
            </button>
            <button
              type="button"
              onClick={onClose}
              className="grid h-8 w-8 place-items-center rounded-xl border border-slate-200 text-slate-400 hover:bg-slate-100 dark:border-slate-800 dark:hover:bg-slate-800"
            >
              <FiX className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Invoice Printable Sheet */}
        <div id="arixcall-invoice-statement" ref={printRef} className="overflow-y-auto p-8 text-slate-800 dark:text-slate-200 print:overflow-visible print:p-0">
          {/* Header & Meta */}
          <div className="flex flex-wrap items-start justify-between gap-6 border-b border-slate-200 pb-8 dark:border-slate-800">
            <div>
              <div className="flex items-center gap-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FF6542] font-black text-white">
                  A
                </div>
                <div>
                  <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">ArixCall</h1>
                  <p className="text-xs font-medium text-slate-400">Enterprise Cloud Communications & PBX</p>
                </div>
              </div>
              <div className="mt-4 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                <p>Global Billing & Telephony Operations</p>
                <p>support@arixcall.com · billing@arixcall.com</p>
              </div>
            </div>

            <div className="text-right">
              <div className="inline-block rounded-xl border border-slate-200 bg-slate-50 px-5 py-3 text-left dark:border-slate-800 dark:bg-slate-950/60">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Billing Statement</div>
                <div className="mt-1 font-mono text-base font-black text-slate-900 dark:text-slate-100">{docNumber}</div>
                <div className="mt-2 space-y-1 text-xs text-slate-600 dark:text-slate-400">
                  <div>
                    <span className="text-slate-400">Date Issued: </span>
                    <span className="font-semibold tabular-nums">{fmtDate(detail.billingCycle?.start ?? `${targetMonth}-01`)}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">Due Date: </span>
                    <span className="font-semibold tabular-nums text-slate-800 dark:text-slate-200">
                      {fmtDate(detail.currentCycle?.dueDateIso ?? detail.billingCycle?.start ?? `${targetMonth}-10`)}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400">Payment Terms: </span>
                    <span className="font-semibold">Due Upon Receipt (Bank Transfer)</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Billed To / Account Info */}
          <div className="grid grid-cols-2 gap-6 py-6 border-b border-slate-200 dark:border-slate-800">
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-slate-400">Billed To</div>
              <div className="mt-1 text-base font-black text-slate-900 dark:text-white">{org.name}</div>
              <div className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                {org.contactName && <p className="font-semibold">{org.contactName}</p>}
                {org.contactEmail && <p>{org.contactEmail}</p>}
                {org.contactPhone && <p className="font-mono">{org.contactPhone}</p>}
                <p className="font-mono text-slate-400">Account ID: #{org.id} · {org.slug}</p>
              </div>
            </div>

            <div className="text-right">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-400">Subscription & Service Window</div>
              <div className="mt-1 text-sm font-extrabold text-slate-900 dark:text-slate-100">
                {detail.customPlan?.label || detail.planLabel || 'Standard'} Plan
              </div>
              <div className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                <p>
                  Cycle: <span className="font-semibold">{fmtDate(detail.billingCycle?.start)}</span> –{' '}
                  <span className="font-semibold">{fmtDate(detail.billingCycle?.end)}</span>
                </p>
                <p>Billing Anchor Day: <span className="font-semibold">{detail.billingCycle?.anchorDay ?? 1}th of each month</span></p>
                <p>Billing Method: <span className="font-semibold">Direct Bank Transfer</span></p>
              </div>
            </div>
          </div>

          {/* Itemized Products & Licences Table */}
          <div className="py-6">
            <h3 className="mb-3 text-xs font-black uppercase tracking-wider text-slate-400">
              Product Licences & Itemized Charges
            </h3>
            <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:bg-slate-950 dark:text-slate-400">
                  <tr>
                    <th className="px-4 py-3">Product / Licence Description</th>
                    <th className="px-4 py-3 text-center">Qty</th>
                    <th className="px-4 py-3 text-right">Unit Rate</th>
                    <th className="px-4 py-3 text-right">Total Price</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {/* Line 1: Core Plan Seats */}
                  <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-900/50">
                    <td className="px-4 py-3">
                      <div className="font-extrabold text-slate-900 dark:text-slate-100">
                        {detail.customPlan?.label ? `${detail.customPlan.label} Plan` : `${detail.planLabel} Subscription`}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {detail.customPlan
                          ? `Includes ${detail.customPlan.seats ?? 1} User Seat(s), ${detail.customPlan.includedNumbers} direct phone number(s), unlimited internal softphone routing`
                          : 'Standard enterprise calling, SIP trunks, inbound routing, and team dialer'}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center font-semibold tabular-nums">{detail.customPlan?.seats ?? 1}</td>
                    <td className="px-4 py-3 text-right font-medium tabular-nums text-slate-500">
                      {detail.customPlan && (detail.customPlan.seats ?? 1) > 0
                        ? fmtUsd(Math.round(detail.itemization.planCents / (detail.customPlan.seats ?? 1)))
                        : fmtUsd(detail.itemization.planCents)}
                    </td>
                    <td className="px-4 py-3 text-right font-bold tabular-nums text-slate-900 dark:text-slate-100">
                      {fmtUsd(detail.itemization.planCents)}
                    </td>
                  </tr>

                  {/* Line 2+: Phone Numbers (DIDs) */}
                  {detail.itemization.numbers.map((num, i) => (
                    <tr key={i} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/50">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-800 dark:text-slate-200">
                          Direct Line (DID) — <span className="font-mono">{num.number}</span>
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {num.included ? 'Plan-included primary phone number' : 'Additional Digital Line standard recurring DID charge'}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center font-semibold">1</td>
                      <td className="px-4 py-3 text-right font-medium tabular-nums text-slate-500">
                        {num.included ? '$0.00' : '$5.00'}
                      </td>
                      <td className="px-4 py-3 text-right font-bold tabular-nums text-slate-900 dark:text-slate-100">
                        {fmtUsd(num.monthlyCents)}
                      </td>
                    </tr>
                  ))}

                  {/* SMS Add-ons */}
                  {(detail.itemization.smsAddons ?? []).map((addon) => (
                    <tr key={addon.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/50">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-800 dark:text-slate-200">
                          SMS Package / Add-on — {addon.name}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {addon.smsCount.toLocaleString()} SMS messages ({addon.isRecurring ? 'Monthly recurring' : 'One-time top-up'})
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center font-semibold">1</td>
                      <td className="px-4 py-3 text-right font-medium tabular-nums text-slate-500">
                        {fmtUsd(addon.priceCents)}
                      </td>
                      <td className="px-4 py-3 text-right font-bold tabular-nums text-slate-900 dark:text-slate-100">
                        {fmtUsd(addon.priceCents)}
                      </td>
                    </tr>
                  ))}

                  {/* Bundle */}
                  {detail.itemization.bundle && (
                    <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-900/50">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-800 dark:text-slate-200">
                          Voice & SMS Bundle — {detail.itemization.bundle.slug}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {detail.itemization.bundle.minutes.toLocaleString()} minutes · {detail.itemization.bundle.sms.toLocaleString()} SMS
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center font-semibold">1</td>
                      <td className="px-4 py-3 text-right font-medium tabular-nums text-slate-500">
                        {fmtUsd(detail.itemization.bundle.monthlyCents)}
                      </td>
                      <td className="px-4 py-3 text-right font-bold tabular-nums text-slate-900 dark:text-slate-100">
                        {fmtUsd(detail.itemization.bundle.monthlyCents)}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Totals & Payments Summary */}
          <div className="grid grid-cols-2 gap-8 border-t border-slate-200 pt-6 dark:border-slate-800">
            {/* Left: Payments Received Log */}
            <div>
              <div className="text-xs font-black uppercase tracking-wider text-slate-400">Payments Applied This Cycle</div>
              {cyclePayments.length === 0 ? (
                <div className="mt-2 rounded-xl border border-dashed border-slate-200 p-4 text-xs text-slate-400 dark:border-slate-800">
                  No bank transfer payments recorded yet for this billing period.
                </div>
              ) : (
                <div className="mt-2 space-y-2">
                  {cyclePayments.map((p) => (
                    <div
                      key={p.id}
                      className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs dark:border-slate-800 dark:bg-slate-950/40"
                    >
                      <div className="flex items-center justify-between font-bold text-slate-800 dark:text-slate-200">
                        <span>Paid on {fmtDate(p.paidAt)}</span>
                        <span className="font-mono text-emerald-600 dark:text-emerald-400">-{fmtUsd(p.amountCents)}</span>
                      </div>
                      <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 space-y-0.5">
                        {p.senderName && <div><span className="font-semibold">Sender:</span> {p.senderName}</div>}
                        {p.bankName && <div><span className="font-semibold">Bank:</span> {p.bankName}</div>}
                        {p.accountNumber && <div><span className="font-semibold">A/C:</span> {p.accountNumber}</div>}
                        {p.reference && <div><span className="font-semibold">Ref:</span> {p.reference}</div>}
                        {p.exchangeRate && p.originalAmountCents && (
                          <div className="text-[10px] text-slate-400">
                            PKR Received: Rs {((p.originalAmountCents) / 100).toLocaleString()} (Rate: {p.exchangeRate})
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Remittance Banking Instructions */}
              <div className="mt-4 rounded-xl border border-slate-200 p-3.5 text-[11px] leading-relaxed text-slate-500 dark:border-slate-800 dark:text-slate-400">
                <div className="flex items-center gap-1.5 font-bold text-slate-700 dark:text-slate-300">
                  <FiShield className="h-3.5 w-3.5 text-[#FF6542]" />
                  Bank Transfer Remittance Details
                </div>
                <p className="mt-1">
                  Please transfer the outstanding amount to the designated company bank account and reference your invoice number <strong className="font-mono text-slate-800 dark:text-slate-200">{docNumber}</strong> in the transfer remarks.
                </p>
              </div>
            </div>

            {/* Right: Balance Due Summary */}
            <div className="flex flex-col justify-between">
              <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm dark:border-slate-800 dark:bg-slate-950/40">
                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>Gross Charges</span>
                  <span className="font-mono font-semibold tabular-nums">{fmtUsd(billedCents)}</span>
                </div>
                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>Contract Discounts / Deviations</span>
                  <span className="font-mono font-semibold tabular-nums">$0.00</span>
                </div>
                <div className="flex justify-between font-bold text-slate-800 dark:text-slate-200 border-t border-slate-200 pt-2 dark:border-slate-800">
                  <span>Total Due This Month</span>
                  <span className="font-mono tabular-nums">{fmtUsd(billedCents)}</span>
                </div>
                <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                  <span>Total Payments Applied</span>
                  <span className="font-mono font-semibold tabular-nums">-{fmtUsd(paidCents)}</span>
                </div>
              </div>

              {/* Outstanding Balance Banner */}
              <div className={`mt-4 rounded-2xl border p-5 ${balanceCents > 0 ? 'border-amber-200 bg-amber-50/70 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200' : 'border-emerald-200 bg-emerald-50/70 text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-200'}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs font-bold uppercase tracking-wider opacity-75">
                      {balanceCents > 0 ? 'Outstanding Amount Due' : 'Balance Remaining'}
                    </div>
                    <div className="text-3xl font-black tabular-nums tracking-tight">
                      {fmtUsd(balanceCents)}
                    </div>
                  </div>
                  <div className="text-right text-xs">
                    <span className="font-bold">
                      {balanceCents > 0 ? `Due: ${fmtDate(detail.currentCycle?.dueDateIso)}` : 'Account Settled'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Footer Notice */}
          <div className="mt-8 border-t border-slate-200 pt-6 text-center text-xs text-slate-400 dark:border-slate-800">
            <p>Thank you for choosing ArixCall Cloud Communications. This document is a computer-generated billing statement.</p>
            <p className="mt-0.5">ArixCall · 100 Lorenz Road, San Antonio, TX · support@arixcall.com</p>
          </div>
        </div>
      </div>
    </div>
  );
}
