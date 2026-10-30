'use client';

/**
 * Sales-assisted SMS Add-ons Manager — admin2 Org Detail → Usage tab.
 * Allows super-admins and sales reps to grant extra pooled SMS to an organization
 * (either as a one-time top-up or monthly recurring add-on) at custom negotiated pricing.
 * Base plan limits remain intact.
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  smsAddonApi,
  type OrgSmsAddon,
  type GrantSmsAddonInput,
} from '@/lib/api/services/sms-addon.api';
import { superadminApiService } from '@/lib/api/services/superadmin.service';
import { toast } from '@/lib/stores/toast';
import { Card, SectionTitle, Btn, Modal } from '../../_components/ui';
import { FiPlus, FiZap, FiTrash2, FiClock, FiRepeat, FiCheckCircle } from 'react-icons/fi';

const inputCls =
  'mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none ' +
  'focus:border-[#FF6542] dark:border-slate-700 dark:bg-slate-900';

function fmtUsd(cents: number): string {
  return `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function SmsAddonManagerCard({ orgId }: { orgId: number }) {
  const qc = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [cancelingId, setCancelingId] = useState<number | null>(null);

  // Form State
  const [smsCount, setSmsCount] = useState('2500');
  const [price, setPrice] = useState('31.25');
  const [isPriceCustom, setIsPriceCustom] = useState(false);
  const [isRecurring, setIsRecurring] = useState(true);
  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');

  const pricingQ = useQuery({
    queryKey: ['admin2', 'pricing-plans'],
    queryFn: () => superadminApiService.getPricingPlans(),
    staleTime: 30_000,
  });
  const smsPlan = pricingQ.data?.data?.find(
    (p) => p.planType === 'sms_service' && p.isActive
  );
  // Standard rate is 3.50 PKR per SMS. At 280 exchange rate, 3.5 / 280 = 0.0125 USD.
  const standardUnitRateUsd = smsPlan
    ? smsPlan.currency?.toUpperCase() === 'PKR'
      ? (smsPlan.monthlyPriceCents / 100) / 280
      : smsPlan.monthlyPriceCents / 100
    : 3.5 / 280;
  const standardUnitRatePkr =
    smsPlan && smsPlan.currency?.toUpperCase() === 'PKR'
      ? smsPlan.monthlyPriceCents / 100
      : 3.5;

  const q = useQuery({
    queryKey: ['admin2', 'org-sms-addons', orgId],
    queryFn: () => smsAddonApi.list(orgId),
    staleTime: 10_000,
    refetchOnMount: 'always',
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['admin2', 'org-sms-addons', orgId] });
    qc.invalidateQueries({ queryKey: ['admin2', 'sms-soft-cap', orgId] });
    qc.invalidateQueries({ queryKey: ['admin2', 'org-billing-detail', orgId] });
    qc.invalidateQueries({ queryKey: ['admin2', 'billing'] });
  };

  const grantMutation = useMutation({
    mutationFn: (input: GrantSmsAddonInput) => smsAddonApi.grant(orgId, input),
    onSuccess: () => {
      toast.success('Extra SMS add-on successfully granted');
      setModalOpen(false);
      setName('');
      setNotes('');
      invalidate();
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : 'Could not grant SMS add-on');
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (addonId: number) => smsAddonApi.cancel(orgId, addonId),
    onSuccess: () => {
      toast.success('SMS add-on canceled');
      setCancelingId(null);
      invalidate();
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : 'Could not cancel add-on');
    },
  });

  const countNum = parseInt(smsCount, 10) || 0;
  const priceNum = parseFloat(price) || 0;
  const standardTotalUsd = countNum * standardUnitRateUsd;
  const standardTotalPkr = countNum * standardUnitRatePkr;
  const diffUsd = priceNum - standardTotalUsd;
  const isValid = countNum > 0 && price.trim() !== '' && priceNum >= 0;

  const handleSmsCountChange = (val: string) => {
    setSmsCount(val);
    const n = parseInt(val, 10) || 0;
    if (!isPriceCustom) {
      setPrice((n * standardUnitRateUsd).toFixed(2));
    }
  };

  const handlePriceChange = (val: string) => {
    setPrice(val);
    setIsPriceCustom(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;

    const autoNotes = notes.trim()
      ? notes.trim()
      : Math.abs(diffUsd) > 0.05
        ? `Agreed deviation: ${diffUsd > 0 ? '+' : '-'}$${Math.abs(diffUsd).toFixed(2)} vs standard baseline ($${standardTotalUsd.toFixed(2)})`
        : undefined;

    grantMutation.mutate({
      smsCount: countNum,
      priceCents: Math.round(priceNum * 100),
      isRecurring,
      name: name.trim() || undefined,
      notes: autoNotes,
    });
  };

  const summary = q.data;
  const addons = summary?.addons ?? [];
  const activeAddons = addons.filter((a) => a.status === 'active');

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <SectionTitle>Extra SMS Add-ons (Sales & Custom)</SectionTitle>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            Grant custom pooled SMS on top of the base plan. Addons stack onto the base limit.
          </p>
        </div>
        <Btn variant="primary" size="sm" onClick={() => setModalOpen(true)}>
          <FiPlus className="mr-1.5 h-3.5 w-3.5 inline" /> Grant Extra SMS
        </Btn>
      </div>

      {/* Active Summary Badges */}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3 dark:border-slate-800 dark:bg-slate-900/40">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Extra SMS Pool</div>
          <div className="mt-1 text-lg font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
            +{summary ? summary.activeSmsTotal.toLocaleString() : '0'} <span className="text-xs font-semibold text-slate-400">SMS</span>
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3 dark:border-slate-800 dark:bg-slate-900/40">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Recurring Charge</div>
          <div className="mt-1 text-lg font-black text-slate-800 dark:text-slate-200 tabular-nums">
            {summary ? fmtUsd(summary.activeRecurringMonthlyCents) : '$0.00'} <span className="text-xs font-semibold text-slate-400">/mo</span>
          </div>
        </div>
        <div className="col-span-2 rounded-xl border border-slate-200 bg-slate-50/50 p-3 dark:border-slate-800 dark:bg-slate-900/40 sm:col-span-1">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Active Packages</div>
          <div className="mt-1 text-lg font-black text-slate-800 dark:text-slate-200 tabular-nums">
            {activeAddons.length}
          </div>
        </div>
      </div>

      {/* Add-ons List */}
      <div className="mt-4 divide-y divide-slate-100 rounded-xl border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
        {q.isLoading ? (
          <div className="p-4 text-center text-xs text-slate-400">Loading add-ons…</div>
        ) : addons.length === 0 ? (
          <div className="p-4 text-center text-xs text-slate-400">
            No extra SMS packages currently assigned. Click &quot;Grant Extra SMS&quot; to add one.
          </div>
        ) : (
          addons.map((a) => {
            const isActive = a.status === 'active';
            return (
              <div key={a.id} className="flex flex-wrap items-center justify-between gap-3 p-3 text-sm">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 dark:text-slate-100">{a.name}</span>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 text-[10px] font-bold rounded-full ${
                        isActive
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                          : a.status === 'expired'
                            ? 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                            : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                      }`}
                    >
                      {a.status}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                      {a.isRecurring ? <FiRepeat className="h-2.5 w-2.5" /> : <FiClock className="h-2.5 w-2.5" />}
                      {a.isRecurring ? 'Recurring' : 'One-time'}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    <span className="font-semibold text-slate-700 dark:text-slate-300">
                      +{a.smsCount.toLocaleString()} SMS
                    </span>{' '}
                    · {fmtUsd(a.priceCents)}
                    {a.isRecurring ? '/mo' : ' flat'} · Valid through {fmtDate(a.periodEnd)}
                    {a.notes && <span className="ml-1.5 italic text-slate-400">— {a.notes}</span>}
                  </div>
                </div>

                {isActive && (
                  <Btn
                    size="sm"
                    disabled={cancelMutation.isPending && cancelingId === a.id}
                    onClick={() => {
                      if (confirm(`Cancel "${a.name}"?`)) {
                        setCancelingId(a.id);
                        cancelMutation.mutate(a.id);
                      }
                    }}
                  >
                    <FiTrash2 className="mr-1 h-3 w-3 inline text-red-500" />
                    {cancelMutation.isPending && cancelingId === a.id ? 'Canceling…' : 'Cancel'}
                  </Btn>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Grant Modal */}
      {modalOpen && (
        <Modal title="Grant Extra SMS Add-on" subtitle="Add pooled SMS to this organization at a custom price." onClose={() => setModalOpen(false)}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Extra SMS Count</label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  required
                  value={smsCount}
                  onChange={(e) => handleSmsCountChange(e.target.value)}
                  placeholder="2500"
                  className={inputCls}
                />
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Agreed Price ($ USD)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  value={price}
                  onChange={(e) => handlePriceChange(e.target.value)}
                  placeholder="31.25"
                  className={inputCls}
                />
              </div>
            </div>

            {/* Standard Rate & Deviation Calculation */}
            {countNum > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200/80 bg-slate-50/70 p-3 text-xs dark:border-slate-800 dark:bg-slate-900/50">
                <div className="text-slate-600 dark:text-slate-400">
                  <span className="font-semibold text-slate-800 dark:text-slate-200">Standard Rate:</span> Rs {standardUnitRatePkr.toFixed(2)} PKR/SMS · Baseline total: <b>${standardTotalUsd.toFixed(2)} USD</b> (Rs {standardTotalPkr.toLocaleString()} PKR)
                </div>
                {(() => {
                  if (Math.abs(diffUsd) < 0.05) {
                    return (
                      <span className="rounded-md bg-emerald-100 px-2 py-0.5 font-bold text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
                        Standard Rate
                      </span>
                    );
                  } else if (diffUsd < 0) {
                    const pct = standardTotalUsd > 0 ? ((Math.abs(diffUsd) / standardTotalUsd) * 100).toFixed(1) : '0';
                    return (
                      <span className="rounded-md bg-amber-100 px-2 py-0.5 font-bold text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                        Negotiated Discount: -${Math.abs(diffUsd).toFixed(2)} ({pct}%)
                      </span>
                    );
                  } else {
                    const pct = standardTotalUsd > 0 ? ((diffUsd / standardTotalUsd) * 100).toFixed(1) : '0';
                    return (
                      <span className="rounded-md bg-blue-100 px-2 py-0.5 font-bold text-blue-800 dark:bg-blue-950/40 dark:text-blue-300">
                        Negotiated Premium: +${diffUsd.toFixed(2)} (+{pct}%)
                      </span>
                    );
                  }
                })()}
              </div>
            )}

            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Billing Renewal Type</label>
              <div className="mt-1.5 grid grid-cols-2 gap-3">
                <label
                  className={`flex cursor-pointer items-start gap-2.5 rounded-xl border p-3 transition ${
                    isRecurring
                      ? 'border-[#FF6542] bg-[#FF6542]/5 font-semibold text-slate-900 dark:text-slate-100'
                      : 'border-slate-200 hover:border-slate-300 dark:border-slate-700'
                  }`}
                >
                  <input
                    type="radio"
                    name="renewalType"
                    checked={isRecurring}
                    onChange={() => setIsRecurring(true)}
                    className="mt-0.5 accent-[#FF6542]"
                  />
                  <div className="text-xs">
                    <div className="font-bold">Recurring Monthly</div>
                    <div className="mt-0.5 text-[11px] text-slate-500">Renews every billing cycle alongside the plan</div>
                  </div>
                </label>
                <label
                  className={`flex cursor-pointer items-start gap-2.5 rounded-xl border p-3 transition ${
                    !isRecurring
                      ? 'border-[#FF6542] bg-[#FF6542]/5 font-semibold text-slate-900 dark:text-slate-100'
                      : 'border-slate-200 hover:border-slate-300 dark:border-slate-700'
                  }`}
                >
                  <input
                    type="radio"
                    name="renewalType"
                    checked={!isRecurring}
                    onChange={() => setIsRecurring(false)}
                    className="mt-0.5 accent-[#FF6542]"
                  />
                  <div className="text-xs">
                    <div className="font-bold">One-Time Top-Up</div>
                    <div className="mt-0.5 text-[11px] text-slate-500">Expires automatically at current billing cycle end</div>
                  </div>
                </label>
              </div>
            </div>

            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Custom Package Name (Optional)</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={`Extra ${countNum > 0 ? countNum.toLocaleString() : '2,500'} SMS ${isRecurring ? 'Add-on' : 'Top-Up'}`}
                className={inputCls}
              />
            </div>

            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Sales Notes / Quote Ref (Optional)</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Agreed via phone call, quote #1024"
                className={inputCls}
              />
            </div>

            {/* Live Preview Box */}
            <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-3.5 text-xs text-slate-700 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-300">
              <div className="font-semibold text-slate-900 dark:text-slate-100">Package Impact Summary:</div>
              <ul className="mt-1.5 list-disc pl-4 space-y-1 text-[11px] text-slate-600 dark:text-slate-400">
                <li>Adds <b className="text-slate-900 dark:text-slate-200">+{countNum.toLocaleString()} SMS</b> to organization pool ({isRecurring ? 'Recurring monthly' : 'One-time top-up'}).</li>
                <li>Base plan allowance stays intact.</li>
                <li>
                  Standard baseline: <b>${standardTotalUsd.toFixed(2)} USD</b> (Rs {standardTotalPkr.toLocaleString()} PKR at standard Rs {standardUnitRatePkr.toFixed(2)}/SMS).
                </li>
                <li>
                  Agreed billed: <b className="text-slate-900 dark:text-slate-200">${priceNum.toFixed(2)} USD</b> ({Math.abs(diffUsd) < 0.05 ? 'Standard baseline rate' : diffUsd < 0 ? `-$${Math.abs(diffUsd).toFixed(2)} discount recorded` : `+$${diffUsd.toFixed(2)} premium recorded`}).
                </li>
              </ul>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Btn type="button" onClick={() => setModalOpen(false)}>
                Cancel
              </Btn>
              <Btn variant="primary" type="submit" disabled={!isValid || grantMutation.isPending}>
                {grantMutation.isPending ? 'Granting…' : 'Grant Extra SMS'}
              </Btn>
            </div>
          </form>
        </Modal>
      )}
    </Card>
  );
}
