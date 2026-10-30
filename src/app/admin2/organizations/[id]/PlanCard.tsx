'use client';

/**
 * Plan (upgrade / downgrade) — admin2 Org Detail → Usage tab.
 *
 * Super-admin control for an org's subscription plan (BILLING-SPEC §1.3):
 *   - UPGRADE (higher-priced) → applies immediately, prorated; entitlements flip now.
 *   - DOWNGRADE (lower-priced) → scheduled for the end of the current billing cycle;
 *     the org keeps what it paid for until then. A scheduled downgrade is cancelable.
 * The SERVER decides the direction from the price, so the UI stays neutral and
 * reports what actually happened via the result toast.
 *
 * Backed by `GET/POST /admin/organizations/:id/plan` + `DELETE /:id/pending-downgrade`
 * (superadminApiService). Placed next to Account status because both decide the
 * tier/limits the usage counters below reflect.
 */

import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  superadminApiService,
  type PlanSlug,
  type PlanBillingPeriod,
} from '@/lib/api/services/superadmin.service';
import { toast } from '@/lib/stores/toast';
import { Card, SectionTitle, Btn, StatusDot, Modal } from '../../_components/ui';

const PLAN_LABEL: Record<PlanSlug, string> = { starter: 'Basic', professional: 'Professional' };
const PLANS: PlanSlug[] = ['starter', 'professional'];
const PERIODS: PlanBillingPeriod[] = ['monthly', 'yearly'];
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const selectCls =
  'rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 ' +
  'focus:outline-none focus:ring-2 focus:ring-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100';

export function PlanCard({ orgId }: { orgId: number }) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ['admin2', 'org-plan', orgId],
    queryFn: () => superadminApiService.getOrgPlan(orgId),
    staleTime: 15_000,
    refetchOnMount: 'always',
  });
  const data = q.data?.data;

  const [sel, setSel] = useState<{ slug: PlanSlug; period: PlanBillingPeriod } | null>(null);
  const [confirm, setConfirm] = useState(false);

  // Seed the selectors from the current plan once, when it first loads.
  useEffect(() => {
    if (data && !sel) setSel({ slug: data.slug ?? 'starter', period: data.period });
  }, [data, sel]);

  const change = useMutation({
    mutationFn: () => superadminApiService.changeOrgPlan(orgId, sel!.slug, sel!.period),
    onSuccess: (res) => {
      setConfirm(false);
      const o = res.data.outcome;
      toast.success(
        o === 'upgraded'
          ? 'Plan upgraded — applied now (prorated)'
          : o === 'downgraded'
            ? 'Downgrade scheduled for the next billing cycle'
            : 'No change — already on that plan'
      );
      qc.invalidateQueries({ queryKey: ['admin2', 'org-plan', orgId] });
      qc.invalidateQueries({ queryKey: ['admin2', 'org-usage-snapshot', orgId] });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : 'Could not change plan'),
  });

  const cancel = useMutation({
    mutationFn: () => superadminApiService.cancelOrgPendingDowngrade(orgId),
    onSuccess: () => {
      toast.success('Pending downgrade canceled');
      qc.invalidateQueries({ queryKey: ['admin2', 'org-plan', orgId] });
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : 'Could not cancel downgrade'),
  });

  if (q.isLoading) {
    return (
      <Card className="p-5">
        <div className="h-20 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
      </Card>
    );
  }
  if (q.isError || !data) return null;

  const hasSub = !!data.subscriptionId;
  const selectionChanged = !!sel && (data.slug !== sel.slug || data.period !== sel.period);

  return (
    <Card className="p-5">
      <SectionTitle>Plan</SectionTitle>

      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="text-2xl font-black">
            {data.slug ? PLAN_LABEL[data.slug] : 'No plan'}
            <span className="ml-2 align-middle">
              <StatusDot health={data.slug ? 'ok' : 'warn'} label={cap(data.period)} />
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {hasSub
              ? 'Billed on the organization’s Stripe subscription.'
              : 'No active Stripe subscription — plan change unavailable.'}
          </p>
        </div>
      </div>

      {data.pending && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm dark:border-amber-500/40 dark:bg-amber-500/10">
          <span className="text-amber-700 dark:text-amber-300">
            Downgrade to <b>{PLAN_LABEL[data.pending.slug]}</b> ({data.pending.period}) scheduled for
            the end of the current cycle.
          </span>
          <Btn size="sm" variant="default" onClick={() => cancel.mutate()} disabled={cancel.isPending}>
            {cancel.isPending ? 'Canceling…' : 'Cancel downgrade'}
          </Btn>
        </div>
      )}

      {hasSub && sel && (
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Plan
            <select
              className={selectCls}
              value={sel.slug}
              onChange={(e) => setSel({ ...sel, slug: e.target.value as PlanSlug })}
            >
              {PLANS.map((p) => (
                <option key={p} value={p}>
                  {PLAN_LABEL[p]}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Billing period
            <select
              className={selectCls}
              value={sel.period}
              onChange={(e) => setSel({ ...sel, period: e.target.value as PlanBillingPeriod })}
            >
              {PERIODS.map((p) => (
                <option key={p} value={p}>
                  {cap(p)}
                </option>
              ))}
            </select>
          </label>
          <Btn
            variant="primary"
            onClick={() => setConfirm(true)}
            disabled={!selectionChanged || change.isPending}
          >
            {change.isPending ? 'Working…' : 'Change plan'}
          </Btn>
        </div>
      )}

      {confirm && sel && (
        <Modal
          title="Change this org’s plan?"
          subtitle={`${data.slug ? PLAN_LABEL[data.slug] : '—'} (${cap(data.period)}) → ${PLAN_LABEL[sel.slug]} (${cap(sel.period)})`}
          onClose={() => (change.isPending ? undefined : setConfirm(false))}
          footer={
            <>
              <Btn onClick={() => setConfirm(false)} disabled={change.isPending}>
                Cancel
              </Btn>
              <Btn variant="primary" onClick={() => change.mutate()} disabled={change.isPending}>
                {change.isPending ? 'Working…' : 'Confirm'}
              </Btn>
            </>
          }
        >
          <div className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
            <p>
              An <b>upgrade</b> (to a higher-priced plan) applies <b>immediately</b>; the difference is{' '}
              <b>prorated</b> on the next invoice and entitlements change now.
            </p>
            <p>
              A <b>downgrade</b> (to a lower-priced plan) is <b>scheduled for the end of the current
              billing cycle</b> — the org keeps what it paid for until then, and you can cancel the
              scheduled downgrade before it takes effect.
            </p>
            <p className="text-xs text-slate-500">
              The server decides which applies, based on the plan price.
            </p>
          </div>
        </Modal>
      )}
    </Card>
  );
}
