'use client';

/**
 * Custom Plan (set / change) — admin2 Org Detail → Usage tab.
 *
 * Shown for EVERY org so a super-admin can either edit an existing custom plan OR
 * switch any org (Starter/Pro/no-plan) onto a custom plan. Sets the per-customer
 * price / seats / devices-per-user / monthly SMS allowance (pooled) / included +
 * max numbers. Saving sets plan='custom', propagates the device + SMS caps to
 * every user in the org, and is audited server-side.
 *
 * Reads current values from `GET /admin/billing/orgs/:id` (customPlan) and writes
 * via `PATCH /admin/accounts/:id/custom-plan`.
 */

import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminBillingApi } from '@/lib/api/services/admin-billing.api';
import { adminAccountApi } from '@/lib/api/services/admin-account.api';
import { superadminApiService } from '@/lib/api/services/superadmin.service';
import { toast } from '@/lib/stores/toast';
import { Card, SectionTitle, Btn } from '../../_components/ui';
import { PlanTemplatePicker } from '../../_components/PlanTemplatePicker';

const inputCls =
  'mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none ' +
  'focus:border-[#FF6542] dark:border-slate-700 dark:bg-slate-900';

export function CustomPlanCard({
  orgId,
  onSaved,
  bare = false,
}: {
  orgId: number;
  /** Fires after a successful save — lets an embedding surface (Billing) refresh. */
  onSaved?: () => void;
  /** Drop the outer Card + section title so the form sits cleanly inside a modal
   *  that already provides a frame + heading (Billing drawer / Org-detail modal). */
  bare?: boolean;
}) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ['admin2', 'org-billing-detail', orgId],
    queryFn: () => adminBillingApi.getOrgBillingDetail(orgId),
    staleTime: 15_000,
  });
  const d = q.data;
  const cp = d?.customPlan ?? null;
  const isCustom = cp != null;

  const pricingQ = useQuery({
    queryKey: ['admin2', 'pricing-plans'],
    queryFn: () => superadminApiService.getPricingPlans(),
    staleTime: 30_000,
  });
  const licensePlan = pricingQ.data?.data?.find(
    (p) => p.planType === 'platform_fee' && p.isActive
  );
  const standardSeatPriceCents = licensePlan ? licensePlan.monthlyPriceCents : 8000;

  const [price, setPrice] = useState('');
  const [seats, setSeats] = useState('');
  const [devices, setDevices] = useState('');
  const [maxNumbers, setMaxNumbers] = useState('');
  const [label, setLabel] = useState('');
  const [seeded, setSeeded] = useState(false);

  // Seed inputs once the detail loads. Existing custom plan → seed from it;
  // otherwise (converting a Starter/Pro/no-plan org) → sensible defaults, price
  // pre-filled from the org's current monthly if known.
  useEffect(() => {
    if (seeded || q.isLoading || !d) return;
    if (d.customPlan) {
      const c = d.customPlan;
      setPrice(((c.priceCents ?? 0) / 100).toString());
      setSeats(String(c.seats ?? 1));
      setDevices(String(c.devicesPerUser ?? 0));
      setMaxNumbers(String(c.maxNumbers ?? 5));
      setLabel(c.label || 'Custom');
    } else {
      setPrice(
        d.monthlyCents != null
          ? (d.monthlyCents / 100).toString()
          : (standardSeatPriceCents / 100).toString()
      );
      setSeats('1');
      setDevices('3');
      setMaxNumbers('5');
      setLabel('Custom');
    }
    setSeeded(true);
  }, [seeded, q.isLoading, d, standardSeatPriceCents]);

  const priceNum = parseFloat(price);
  const maxNum = Math.max(1, parseInt(maxNumbers, 10) || 1);
  const seatsNum = Math.max(1, parseInt(seats, 10) || 1);
  const valid =
    price.trim() !== '' && !Number.isNaN(priceNum) && priceNum >= 0 &&
    (parseInt(seats, 10) || 0) >= 1 && maxNum >= seatsNum;

  const save = useMutation({
    mutationFn: () => {
      const priceCents = Math.max(0, Math.round((parseFloat(price) || 0) * 100));
      const agreedSeatPriceCents =
        seatsNum > 0 ? Math.round(priceCents / seatsNum) : standardSeatPriceCents;
      return adminAccountApi.updateCustomPlan(orgId, {
        priceCents,
        label: label.trim() || 'Custom',
        seats: seatsNum,
        standardSeatPriceCents,
        agreedSeatPriceCents,
        devicesPerUser: Math.max(0, parseInt(devices, 10) || 0),
        // Billing standard: every purchased licence includes exactly one DID.
        includedNumbers: seatsNum,
        maxNumbers: Math.max(1, seatsNum, parseInt(maxNumbers, 10) || 1),
      });
    },
    onSuccess: () => {
      toast.success('Custom plan updated');
      qc.invalidateQueries({ queryKey: ['admin2', 'org-billing-detail', orgId] });
      qc.invalidateQueries({ queryKey: ['admin2', 'org-plan', orgId] });
      onSaved?.();
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : 'Could not update the plan'),
  });

  if (q.isLoading) {
    const sk = <div className="h-20 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />;
    return bare ? sk : <Card className="p-5">{sk}</Card>;
  }
  if (q.isError) return null;

  const inner = (
    <>
      {!bare && <SectionTitle>{isCustom ? 'Custom plan' : 'Change plan → Custom'}</SectionTitle>}
      <p className="mb-4 text-xs text-slate-500 dark:text-slate-400">
        {isCustom
          ? 'The all-inclusive monthly price and this customer’s limits. Saving applies the device cap to every user in the org. SMS allowance and the call fair-use cap are managed separately below.'
          : `This org is currently on “${d?.planLabel ?? 'No plan'}”. Setting a custom plan switches it to Custom with the price and limits below (applied to every user in the org).`}
      </p>
      {d?.hasSubscription && (
        <p className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs text-amber-700 dark:text-amber-300">
          This org has a live Stripe subscription — a custom plan sets the limits + the billing-page amount, but does <b>not</b> change what Stripe charges. Cancel/adjust the Stripe subscription separately if needed.
        </p>
      )}

      <PlanTemplatePicker
        className="mb-4"
        onApply={(t) => {
          setLabel(t.name);
          setPrice((t.monthlyCents / 100).toString());
          setSeats(String(t.seats));
          setDevices(String(t.devicesPerUser));
          setMaxNumbers(String(Math.max(t.maxNumbers, t.seats)));
        }}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-bold">Plan name
          <input value={label} onChange={(e) => setLabel(e.target.value)} className={inputCls} placeholder="Custom" />
        </label>
        <label className="text-sm font-bold">Monthly price (USD)
          <div className="relative mt-1.5">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-400">$</span>
            <input
              inputMode="decimal"
              value={price}
              onChange={(e) => setPrice(e.target.value.replace(/[^\d.]/g, ''))}
              className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-7 pr-3 text-sm outline-none focus:border-[#FF6542] dark:border-slate-700 dark:bg-slate-900"
              placeholder="99"
            />
          </div>
        </label>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-sm font-bold">Seats
          <input inputMode="numeric" value={seats} onChange={(e) => setSeats(e.target.value.replace(/[^\d]/g, ''))} className={inputCls} placeholder="5" />
        </label>
        <label className="text-sm font-bold">Devices / user
          <input inputMode="numeric" value={devices} onChange={(e) => setDevices(e.target.value.replace(/[^\d]/g, ''))} className={inputCls} placeholder="3" />
          <span className="mt-1 block text-xs font-normal text-slate-500">0 = unlimited</span>
        </label>
        <label className="text-sm font-bold">Included numbers
          <div className={`${inputCls} bg-slate-50 font-semibold dark:bg-slate-800`}>{seatsNum}</div>
          <span className="mt-1 block text-xs font-normal text-slate-500">automatic — one DID per licence</span>
        </label>
        <label className="text-sm font-bold">Max numbers
          <input inputMode="numeric" value={maxNumbers} onChange={(e) => setMaxNumbers(e.target.value.replace(/[^\d]/g, ''))} className={inputCls} placeholder="5" />
          <span className={`mt-1 block text-xs font-normal ${maxNum < seatsNum ? 'text-red-500' : 'text-slate-500'}`}>
            {maxNum < seatsNum ? 'must be ≥ licence count' : 'total cap'}
          </span>
        </label>
      </div>

      <div className="mt-4 flex justify-end">
        <Btn variant="primary" onClick={() => save.mutate()} disabled={!valid || save.isPending}>
          {save.isPending ? 'Saving…' : isCustom ? 'Save plan' : 'Set custom plan'}
        </Btn>
      </div>
    </>
  );
  return bare ? <div>{inner}</div> : <Card className="p-5">{inner}</Card>;
}
