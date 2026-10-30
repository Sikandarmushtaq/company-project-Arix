'use client';

/**
 * Call-usage panel for the admin2 Org Detail → Usage tab — STATUS-AWARE, so it
 * only ever shows the cap that ACTUALLY governs this org (one SSOT per case):
 *
 *   • Trial / capped (pending|rejected)  → the TRIAL call allowance (min used vs
 *     the trial cap), read from buildSnapshot — the same figure the preflight gate
 *     enforces. The fair-use soft cap does NOT apply here, so we don't show it.
 *   • Live / unlimited (approved|not_required) → the CallSoftCapCounter (the
 *     fair-use soft cap + its management), which is the cap that applies once live.
 *
 * This removes the earlier mix-up where a trial org showed "0 / 4,000 (soft cap)"
 * — a ceiling it isn't governed by — directly under a "Trial / Capped" status.
 */

import { useQuery } from '@tanstack/react-query';
import { getOrgUsageSnapshot } from '@/lib/api/services/admin-analytics.api';
import { Card, SectionTitle, StatusDot, type Health } from '../../_components/ui';
import { CallSoftCapCounter } from './CallSoftCapCounter';
import { PerUserCallUsage } from './PerUserCallUsage';

export function OrgCallUsagePanel({ orgId }: { orgId: number }) {
  const snapQ = useQuery({
    queryKey: ['admin2', 'org-usage-snapshot', orgId],
    queryFn: () => getOrgUsageSnapshot(orgId),
    staleTime: 15_000,
    // Global default is refetchOnMount:false — refetch on mount so a trial→live
    // flip (or cap change) is reflected when the Usage tab reopens, not stale.
    refetchOnMount: 'always',
  });

  if (snapQ.isLoading) {
    return <Card className="p-5"><div className="h-24 animate-pulse rounded bg-slate-200 dark:bg-slate-800" /></Card>;
  }
  // On error we DON'T know the org's tier, so we must not render a specific cap —
  // showing the soft cap here would re-introduce the "4,000 on a trial org" mix-up.
  // A neutral, honest state is correct; retry re-fetches the SSOT.
  if (snapQ.isError || !snapQ.data) {
    return (
      <Card className="p-5">
        <SectionTitle>Call minutes</SectionTitle>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Couldn’t load this organization’s usage right now.{' '}
          <button
            type="button"
            onClick={() => snapQ.refetch()}
            className="font-bold text-[#FF6542] hover:underline"
          >
            Retry
          </button>
        </p>
      </Card>
    );
  }

  const s = snapQ.data;

  // LIVE / unlimited tier → the org per-user default (with management) + the
  // per-user usage breakdown (each member's own minutes vs their own cap, editable).
  if (!s.capped) {
    return (
      <div className="space-y-4">
        <CallSoftCapCounter orgId={orgId} />
        <PerUserCallUsage orgId={orgId} />
      </div>
    );
  }

  // TRIAL / capped → the enforced cap is the trial allowance, straight from the
  // SSOT. Read-only: the trial cap is set at account creation, and "Make live"
  // (above) is how you lift it — not a soft-cap edit, which wouldn't apply.
  const cap = s.callMinutesPerMonth;
  const used = s.callMinutesUsedThisMonth;
  const pct = cap > 0 ? Math.min(100, Math.round((used / cap) * 100)) : 0;
  const blocked = s.callsBlocked;
  const health: Health = blocked || pct >= 90 ? 'bad' : pct >= 70 ? 'warn' : 'ok';
  const bar = health === 'bad' ? 'bg-red-500' : health === 'warn' ? 'bg-amber-500' : 'bg-emerald-500';

  return (
    <Card className="p-5">
      <SectionTitle>Call minutes — trial allowance</SectionTitle>

      <div className="flex items-end justify-between">
        <div className="text-2xl font-black">
          {used.toLocaleString()} <span className="text-sm font-semibold text-slate-400">/ {cap.toLocaleString()} min</span>
        </div>
        <StatusDot health={health} label={blocked ? 'Blocked (trial cap reached)' : `${pct}% used`} />
      </div>
      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
        <div className={`h-full ${bar}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
        Capped trial allowance · resets monthly · shared by all users in the org
        {snapQ.isFetching && ' · updating…'}
      </div>
      <p className="mt-3 border-t border-slate-200 pt-3 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
        This is the <b>trial</b> call cap — the fair-use soft cap (~4,000 min/mo) only applies once the account is <b>live</b>. Use <b>Make live</b> above to lift the trial caps.
      </p>
    </Card>
  );
}
