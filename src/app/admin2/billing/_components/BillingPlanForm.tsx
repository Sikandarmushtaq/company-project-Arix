'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { adminBillingApi } from '@/lib/api/services/admin-billing.api';
import {
  superadminApiService,
  type PlanSlug,
} from '@/lib/api/services/superadmin.service';
import { toast } from '@/lib/stores/toast';
import { Btn } from '../../_components/ui';
import { CustomPlanCard } from '../../organizations/[id]/CustomPlanCard';

type Choice = PlanSlug | 'custom';

const catalog: Record<PlanSlug, { label: string; unitCents: number; description: string }> = {
  starter: {
    label: 'Basic',
    unitCents: 5900,
    description: 'Standard calling, recording, analytics and SMS access.',
  },
  professional: {
    label: 'Professional',
    unitCents: 12000,
    description: 'Advanced communications with WhatsApp and a larger SMS allowance.',
  },
};

const usd = (cents: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);

export function BillingPlanForm({ orgId, onSaved }: { orgId: number; onSaved?: () => void }) {
  const qc = useQueryClient();
  const detailQ = useQuery({
    queryKey: ['admin2', 'org-billing-detail', orgId],
    queryFn: () => adminBillingApi.getOrgBillingDetail(orgId),
    staleTime: 15_000,
  });
  const detail = detailQ.data;
  const pricingQ = useQuery({
    queryKey: ['admin2', 'pricing-plans'],
    queryFn: () => superadminApiService.getPricingPlans(),
    staleTime: 30_000,
  });
  const current: Choice =
    detail?.planSlug === 'starter' || detail?.planSlug === 'professional'
      ? detail.planSlug
      : 'custom';
  const [selected, setSelected] = useState<Choice | null>(null);

  useEffect(() => {
    if (detail && selected == null) setSelected(current);
  }, [detail, current, selected]);

  const licences = Math.max(1, detail?.activeUsersCount ?? detail?.customPlan?.activeUsers ?? 1);
  const numberCount = detail?.itemization.numbers.length ?? 0;
  const includedNumbers = licences;
  const extraNumbers = Math.max(0, numberCount - includedNumbers);
  const numberPlan = pricingQ.data?.data.find(
    (plan) => plan.planType === 'number' && plan.isActive
  );
  const extraNumberRate =
    numberPlan?.monthlyPriceCents ??
    detail?.itemization.numbers.find((number) => !number.included && number.monthlyCents > 0)
      ?.monthlyCents ??
    0;
  const recurringExtras =
    (detail?.itemization.bundleCents ?? 0) + (detail?.itemization.smsAddonCents ?? 0);
  const selectedPlan = selected && selected !== 'custom' ? catalog[selected] : null;
  const previewTotal = useMemo(
    () => (selectedPlan?.unitCents ?? 0) * licences + extraNumbers * extraNumberRate + recurringExtras,
    [selectedPlan, licences, extraNumbers, extraNumberRate, recurringExtras]
  );

  const change = useMutation({
    mutationFn: (slug: PlanSlug) => superadminApiService.changeOrgPlan(orgId, slug, 'monthly'),
    onSuccess: (response) => {
      const { outcome, effectiveAt } = response.data;
      const message =
        outcome === 'unchanged'
          ? 'This organization is already on that plan'
          : effectiveAt === 'period_end'
            ? 'Plan change scheduled for the next billing cycle'
            : detail?.hasSubscription
              ? 'Plan upgraded and applied to the Stripe subscription'
              : 'Plan changed and the open manual invoice was recalculated';
      toast.success(message);
      qc.invalidateQueries({ queryKey: ['admin2', 'org-plan', orgId] });
      qc.invalidateQueries({ queryKey: ['admin2', 'org-billing-detail', orgId] });
      qc.invalidateQueries({ queryKey: ['admin2', 'billing'] });
      onSaved?.();
    },
    onError: (error: unknown) =>
      toast.error(error instanceof Error ? error.message : 'Could not change the plan'),
  });

  if (detailQ.isLoading || pricingQ.isLoading || selected == null) {
    return <div className="h-32 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />;
  }
  if (!detail) return <p className="text-sm text-red-500">Could not load this organization’s billing plan.</p>;

  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-3">
        {(['starter', 'professional', 'custom'] as Choice[]).map((choice) => {
          const plan = choice === 'custom' ? null : catalog[choice];
          const active = selected === choice;
          return (
            <button
              key={choice}
              type="button"
              onClick={() => setSelected(choice)}
              className={`rounded-xl border p-4 text-left transition ${
                active
                  ? 'border-[#FF6542] bg-[#FF6542]/5 ring-1 ring-[#FF6542]'
                  : 'border-slate-200 hover:border-slate-400 dark:border-slate-700'
              }`}
            >
              <span className="block text-sm font-black">{plan?.label ?? 'Custom'}</span>
              <span className="mt-1 block text-lg font-black">
                {plan ? `${usd(plan.unitCents)} / licence` : 'Sales-defined'}
              </span>
              <span className="mt-2 block text-xs text-slate-500">
                {plan?.description ?? 'Set an agreed price, licence count and account limits.'}
              </span>
              {current === choice && (
                <span className="mt-3 inline-block rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-bold uppercase text-white dark:bg-white dark:text-slate-900">
                  Current
                </span>
              )}
            </button>
          );
        })}
      </div>

      {selected === 'custom' ? (
        <div className="mt-5 border-t border-slate-200 pt-5 dark:border-slate-700">
          <CustomPlanCard orgId={orgId} bare onSaved={onSaved} />
        </div>
      ) : (
        <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900/50">
          <div className="grid gap-3 text-sm sm:grid-cols-2">
            <Row label="Active licences" value={`${licences}`} />
            <Row label="Price per licence" value={usd(catalog[selected].unitCents)} />
            <Row label="Included phone numbers" value={`${includedNumbers} (1 per licence)`} />
            <Row
              label="Extra phone numbers"
              value={`${extraNumbers} × ${usd(extraNumberRate)} = ${usd(extraNumbers * extraNumberRate)}`}
            />
            {recurringExtras > 0 && <Row label="Bundles and SMS add-ons" value={usd(recurringExtras)} />}
          </div>
          <div className="mt-4 flex items-center justify-between border-t border-slate-200 pt-4 dark:border-slate-700">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Estimated monthly total</p>
              <p className="text-2xl font-black">{usd(previewTotal)}</p>
              <p className="mt-1 max-w-xl text-xs text-slate-500">
                SMS bundles are managed separately in Usage. A manual account changes immediately; Stripe upgrades apply now and downgrades remain scheduled for cycle end.
              </p>
            </div>
            <Btn
              variant="primary"
              disabled={change.isPending || current === selected}
              onClick={() => change.mutate(selected)}
            >
              {change.isPending ? 'Applying…' : current === selected ? 'Current plan' : `Apply ${catalog[selected].label}`}
            </Btn>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-slate-500">{label}</span>
      <span className="font-bold tabular-nums">{value}</span>
    </div>
  );
}
