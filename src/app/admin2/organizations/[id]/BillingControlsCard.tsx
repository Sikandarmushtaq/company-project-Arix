'use client';

/**
 * Billing controls — admin2 Org Detail → Usage. Super-admin editors for the two
 * Phase-2 knobs:
 *   • Billing-cycle anchor override — the day all admin-set limits reset on. A
 *     manual pin wins over the Stripe billing day, which wins over created_at.
 *     Clear it to revert to the Stripe day / created_at.
 *   • Trial caps — the post-signup call-minute + SMS caps for the trial tier.
 *     Blank = fall back to the deployment default.
 *
 * Wired to superadminApiService.getOrgBillingAnchor/setOrgBillingAnchor +
 * getOrgTrialCaps/setOrgTrialCaps.
 */

import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { superadminApiService } from '@/lib/api/services/superadmin.service';
import { toast } from '@/lib/stores/toast';
import { Card, SectionTitle, Btn } from '../../_components/ui';

const fieldCls =
  'rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 ' +
  'focus:outline-none focus:ring-2 focus:ring-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100';
const fmt = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
const toDateInput = (iso: string | null) => (iso ? new Date(iso).toISOString().slice(0, 10) : '');

export function BillingControlsCard({ orgId }: { orgId: number }) {
  const qc = useQueryClient();

  // ---- Billing anchor ----
  const anchorQ = useQuery({
    queryKey: ['admin2', 'org-anchor', orgId],
    queryFn: () => superadminApiService.getOrgBillingAnchor(orgId),
    refetchOnMount: 'always',
  });
  const [anchorDate, setAnchorDate] = useState<string | null>(null);
  useEffect(() => {
    if (anchorQ.data && anchorDate === null) setAnchorDate(toDateInput(anchorQ.data.data.override));
  }, [anchorQ.data, anchorDate]);

  const setAnchor = useMutation({
    mutationFn: (iso: string | null) => superadminApiService.setOrgBillingAnchor(orgId, iso),
    onSuccess: () => {
      toast.success('Billing anchor updated');
      qc.invalidateQueries({ queryKey: ['admin2', 'org-anchor', orgId] });
      qc.invalidateQueries({ queryKey: ['admin2', 'org-usage-snapshot', orgId] });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : 'Could not update anchor'),
  });

  // ---- Trial caps ----
  const capsQ = useQuery({
    queryKey: ['admin2', 'org-trial-caps', orgId],
    queryFn: () => superadminApiService.getOrgTrialCaps(orgId),
    refetchOnMount: 'always',
  });
  const [minutes, setMinutes] = useState<string | null>(null);
  const [sms, setSms] = useState<string | null>(null);
  useEffect(() => {
    if (capsQ.data && minutes === null) {
      setMinutes(capsQ.data.data.callMinutes == null ? '' : String(capsQ.data.data.callMinutes));
      setSms(capsQ.data.data.sms == null ? '' : String(capsQ.data.data.sms));
    }
  }, [capsQ.data, minutes]);

  const setCaps = useMutation({
    mutationFn: () =>
      superadminApiService.setOrgTrialCaps(orgId, {
        callMinutes: (minutes ?? '').trim() === '' ? null : Math.max(0, parseInt(minutes ?? '0', 10) || 0),
        sms: (sms ?? '').trim() === '' ? null : Math.max(0, parseInt(sms ?? '0', 10) || 0),
      }),
    onSuccess: () => {
      toast.success('Trial caps updated');
      qc.invalidateQueries({ queryKey: ['admin2', 'org-trial-caps', orgId] });
      qc.invalidateQueries({ queryKey: ['admin2', 'org-usage-snapshot', orgId] });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : 'Could not update trial caps'),
  });

  if (anchorQ.isLoading) {
    return <Card className="p-5"><div className="h-24 animate-pulse rounded bg-slate-200 dark:bg-slate-800" /></Card>;
  }
  if (anchorQ.isError || !anchorQ.data) return null;
  const a = anchorQ.data.data;

  const anchorDirty = anchorDate !== null && anchorDate !== toDateInput(a.override);
  const caps = capsQ.data?.data;
  const capsDirty =
    caps != null &&
    ((minutes ?? '') !== (caps.callMinutes == null ? '' : String(caps.callMinutes)) ||
      (sms ?? '') !== (caps.sms == null ? '' : String(caps.sms)));

  return (
    <Card className="p-5">
      <SectionTitle>Billing controls</SectionTitle>

      {/* Billing anchor */}
      <div className="mb-5">
        <div className="text-xs font-bold uppercase tracking-wide text-slate-400">Billing-cycle anchor</div>
        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
          All admin-set limits reset on this day each month. Effective: <b>{fmt(a.effectiveAnchorIso)}</b>
          {a.stripeAnchor && <> · Stripe day {fmt(a.stripeAnchor)}</>}
          {!a.stripeAnchor && a.activatedAt && <> · Live day {fmt(a.activatedAt)}</>}
          {a.override ? ' · manual pin set' : ' · using the default'}.
        </p>
        <div className="mt-2 flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Manual anchor date
            <input
              type="date"
              className={fieldCls}
              value={anchorDate ?? ''}
              disabled={setAnchor.isPending}
              onChange={(e) => setAnchorDate(e.target.value)}
            />
          </label>
          <Btn
            variant="primary"
            disabled={!anchorDirty || !anchorDate || setAnchor.isPending}
            onClick={() => setAnchor.mutate(new Date(`${anchorDate}T00:00:00.000Z`).toISOString())}
          >
            {setAnchor.isPending ? 'Working…' : 'Set anchor'}
          </Btn>
          {a.override && (
            <Btn
              size="sm"
              disabled={setAnchor.isPending}
              onClick={() => {
                setAnchorDate('');
                setAnchor.mutate(null);
              }}
            >
              Revert to default
            </Btn>
          )}
        </div>
      </div>

      {/* Trial caps */}
      <div className="border-t border-slate-200 pt-4 dark:border-slate-800">
        <div className="text-xs font-bold uppercase tracking-wide text-slate-400">Trial caps</div>
        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
          Post-signup caps for the trial tier (before the org is made live). Blank = deployment default.
        </p>
        <div className="mt-2 flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Call minutes / mo
            <input
              type="number"
              min={0}
              placeholder="default"
              className={fieldCls}
              value={minutes ?? ''}
              disabled={setCaps.isPending}
              onChange={(e) => setMinutes(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
            SMS / mo
            <input
              type="number"
              min={0}
              placeholder="default"
              className={fieldCls}
              value={sms ?? ''}
              disabled={setCaps.isPending}
              onChange={(e) => setSms(e.target.value)}
            />
          </label>
          <Btn variant="primary" disabled={!capsDirty || setCaps.isPending} onClick={() => setCaps.mutate()}>
            {setCaps.isPending ? 'Working…' : 'Save caps'}
          </Btn>
        </div>
      </div>
    </Card>
  );
}
