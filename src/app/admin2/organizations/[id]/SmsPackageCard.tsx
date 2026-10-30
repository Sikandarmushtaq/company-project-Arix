'use client';

/**
 * SMS package (bundle) — admin2 Org Detail → Usage. Super-admin assign / switch /
 * remove of an org-wide SMS package, wired to the existing bundle admin endpoints
 * (`superadminApiService.getOrgBundle / grantOrgBundle / clearOrgBundle`).
 *
 * The package is an ORG-WIDE shared pool. For metered (self-serve) reskin orgs it's
 * the real lever to raise SMS beyond base; for `not_required` (unmetered) orgs it
 * doesn't apply (the org-wide SMS soft cap governs — Usage tab). Grant here is an admin override — it
 * bypasses the owner-facing 10DLC gate (carriers still gate delivery on 10DLC).
 * Ported from the legacy admin card into the admin2 design system.
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  superadminApiService,
  type AdminOrgBundleState,
} from '@/lib/api/services/superadmin.service';
import { toast } from '@/lib/stores/toast';
import { Card, SectionTitle, Btn, ToggleRow, Modal } from '../../_components/ui';

const selectCls =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 ' +
  'focus:outline-none focus:ring-2 focus:ring-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100';
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

export function SmsPackageCard({ orgId }: { orgId: number }) {
  const qc = useQueryClient();
  const [slug, setSlug] = useState('');
  const [autoRenew, setAutoRenew] = useState(true);
  const [confirmRemove, setConfirmRemove] = useState(false);

  const q = useQuery({
    queryKey: ['admin2', 'org-bundle', orgId],
    queryFn: () => superadminApiService.getOrgBundle(orgId),
    staleTime: 15_000,
    refetchOnMount: 'always',
  });
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['admin2', 'org-bundle', orgId] });
    qc.invalidateQueries({ queryKey: ['admin2', 'org-usage-snapshot', orgId] });
  };

  const grant = useMutation({
    mutationFn: () => superadminApiService.grantOrgBundle(orgId, slug, autoRenew),
    onSuccess: (r) => {
      toast.success(r.message || 'SMS package assigned');
      setSlug('');
      invalidate();
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : 'Could not assign package'),
  });
  const remove = useMutation({
    mutationFn: () => superadminApiService.clearOrgBundle(orgId),
    onSuccess: (r) => {
      toast.success(r.message || 'SMS package removed');
      setConfirmRemove(false);
      invalidate();
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : 'Could not remove package'),
  });

  if (q.isLoading) {
    return <Card className="p-5"><div className="h-24 animate-pulse rounded bg-slate-200 dark:bg-slate-800" /></Card>;
  }
  if (q.isError || !q.data) return null;
  const s: AdminOrgBundleState = q.data.data;
  const busy = grant.isPending || remove.isPending;

  return (
    <Card className="p-5">
      <SectionTitle>SMS package</SectionTitle>

      {s.kycStatus === 'not_required' ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">
          This organization is <b>unmetered</b> — SMS packages don&apos;t apply. Its SMS allowance is
          governed by the org-wide <b>SMS monthly limit</b> (manual override, else the deployment
          default) — set it in the <b>Usage</b> tab.
        </p>
      ) : (
        <div className="space-y-4">
          {/* Current allowance */}
          <div className="rounded-xl border border-slate-200 p-3.5 text-sm dark:border-slate-800">
            <div className="text-xs font-bold uppercase tracking-wide text-slate-400">Current allowance</div>
            {s.active ? (
              <div className="mt-1">
                <span className="font-black">{s.active.label}</span> —{' '}
                {s.active.smsUsed.toLocaleString()} / {s.active.smsIncluded.toLocaleString()} SMS this cycle ·{' '}
                {s.active.canceling
                  ? `canceling — ends ${fmtDate(s.active.periodEnd)}`
                  : s.active.autoRenew
                    ? `auto-renews ${fmtDate(s.active.periodEnd)}`
                    : `expires ${fmtDate(s.active.periodEnd)} (no auto-renew)`}
              </div>
            ) : (
              <div className="mt-1">
                Base plan — <b>{s.basePlan.sms.toLocaleString()}</b> SMS/month (no package). Org-wide shared pool.
              </div>
            )}
          </div>

          {s.active?.isPaid && (
            <div className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-300">
              This org has a <b>paid Stripe subscription</b>. Switching or removing the package here
              cancels that billing line — use only if intended.
            </div>
          )}
          {!s.tenDlcApproved && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-300">
              Not 10DLC-approved yet — a package still applies, but US carriers may filter its SMS
              until 10DLC registration is approved.
            </div>
          )}

          {/* Assign / switch */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <label className="min-w-0 flex-1">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                {s.active ? 'Switch to package' : 'Assign package'}
              </span>
              <select className={selectCls} value={slug} disabled={busy} onChange={(e) => setSlug(e.target.value)}>
                <option value="">Select a package…</option>
                {s.catalog.map((b) => (
                  <option key={b.slug} value={b.slug}>
                    {b.label} — {b.sms.toLocaleString()} SMS (${(b.monthlyCents / 100).toFixed(0)}/mo)
                  </option>
                ))}
              </select>
            </label>
            <Btn variant="primary" disabled={busy || !slug} onClick={() => grant.mutate()}>
              {grant.isPending ? 'Working…' : s.active ? 'Switch' : 'Assign'}
            </Btn>
          </div>

          <ToggleRow
            title="Auto-renew monthly"
            description={`Keep this allowance every cycle. Off = a single month that expires back to base ${s.basePlan.sms.toLocaleString()}.`}
            checked={autoRenew}
            disabled={busy}
            onChange={setAutoRenew}
          />

          {s.active && (
            <Btn variant="danger" size="sm" disabled={busy} onClick={() => setConfirmRemove(true)}>
              Remove package (back to base {s.basePlan.sms.toLocaleString()}/mo)
            </Btn>
          )}
        </div>
      )}

      {confirmRemove && (
        <Modal
          title="Remove SMS package?"
          onClose={() => (remove.isPending ? undefined : setConfirmRemove(false))}
          footer={
            <>
              <Btn onClick={() => setConfirmRemove(false)} disabled={remove.isPending}>Cancel</Btn>
              <Btn variant="danger" onClick={() => remove.mutate()} disabled={remove.isPending}>
                {remove.isPending ? 'Removing…' : 'Remove package'}
              </Btn>
            </>
          }
        >
          <p className="text-sm text-slate-600 dark:text-slate-300">
            This org reverts to the base {s.basePlan.sms.toLocaleString()} SMS/month. Current-cycle
            usage is archived.{s.active?.isPaid ? ' Any paid Stripe line for this package is canceled.' : ''}
          </p>
        </Modal>
      )}
    </Card>
  );
}
