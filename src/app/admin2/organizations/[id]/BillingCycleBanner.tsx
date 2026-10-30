'use client';

/**
 * One-line billing-cycle header for the admin2 Org Detail → Usage tab.
 *
 * All of an org's admin-set limits (base/trial caps, call + SMS soft caps, manual
 * override) now reset on ONE monthly cycle anchored at the org's creation day — so
 * we show that single cycle here, once, above the per-limit cards (instead of a
 * vague "resets monthly" on each). Purchased packages keep their own purchase cycle
 * (shown on the SMS/package card), so this is explicitly the caps' reset window.
 *
 * Shares the ['admin2','org-usage-snapshot',orgId] query with OrgCallUsagePanel, so
 * it adds no extra request.
 */

import { useQuery } from '@tanstack/react-query';
import { getOrgUsageSnapshot } from '@/lib/api/services/admin-analytics.api';
import { Card } from '../../_components/ui';

function fmt(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}
function ordinalDay(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso).getDate();
  const s = d % 100;
  const suffix = s >= 11 && s <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][d % 10] || 'th';
  return `${d}${suffix}`;
}

export function BillingCycleBanner({ orgId }: { orgId: number }) {
  const q = useQuery({
    queryKey: ['admin2', 'org-usage-snapshot', orgId],
    queryFn: () => getOrgUsageSnapshot(orgId),
    staleTime: 15_000,
    refetchOnMount: 'always',
  });

  if (q.isLoading || q.isError || !q.data) return null;
  const s = q.data;

  return (
    <Card className="flex flex-wrap items-center justify-between gap-2 p-4">
      <div>
        <div className="text-xs font-bold uppercase tracking-wide text-slate-400">Billing cycle</div>
        <div className="mt-0.5 text-sm font-black text-slate-900 dark:text-slate-100">
          {fmt(s.billingCycleStartIso)} → {fmt(s.billingCycleEndIso)}
          <span className="ml-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
            · limits reset the {ordinalDay(s.billingAnchorIso)} each month
          </span>
        </div>
      </div>
      <div className="text-right text-xs text-slate-500 dark:text-slate-400">
        anchored to the account’s creation date
        {s.billingAnchorIso && <> ({fmt(s.billingAnchorIso)})</>}
        <div className="mt-0.5 text-[11px] text-slate-400">Purchased packages renew on their own purchase date.</div>
      </div>
    </Card>
  );
}
