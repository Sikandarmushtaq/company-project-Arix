'use client';

/**
 * Item 13 — Notifications slide-over, matching the prototype (Critical/Warning/Info
 * with an action). DERIVED FROM REAL SIGNALS — not a mock feed:
 *   • Critical — any non-Operational service (useAdminStats.systemStatus)
 *   • Warning  — pending signup reviews (getSmsReviewStats) + pending add-on requests
 *   • Info     — none pending → a clean "all clear"
 */

import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useAdminStats } from '@/lib/hooks/useAdmin';
import { superadminApiService } from '@/lib/api/services/superadmin.service';
import { addonApiService } from '@/lib/api/services/addon.service';
import { useCallUsageLedger } from './useCallUsageLedger';
import { Btn } from './ui';

type Props = { open: boolean; onClose: () => void };

export function NotificationsPanel({ open, onClose }: Props) {
  const router = useRouter();
  const { data: stats } = useAdminStats();
  // Same keys the sidebar badge + realtime sync use (signup-stats /
  // addon-pending-count) so all three share one cache and update live.
  const reviews = useQuery({
    queryKey: ['admin2', 'signup-stats'],
    queryFn: () => superadminApiService.getSmsReviewStats(),
    enabled: open,
    staleTime: 30_000,
  });
  const addons = useQuery({
    queryKey: ['admin2', 'addon-pending-count'],
    queryFn: () => addonApiService.adminPendingCount(),
    enabled: open,
    staleTime: 30_000,
  });
  const ledger = useCallUsageLedger(true); // live via WS push, no polling

  if (!open) return null;

  const downServices = (stats?.systemStatus ?? []).filter((s) => s.status !== 'Operational');
  const pendingReviews = reviews.data?.data?.pending ?? 0;
  const pendingAddons = addons.data?.data?.count ?? 0;

  // Call soft-cap watch: blocked orgs (Critical) + orgs ≥80% (Warning).
  const capRows = ledger.rows.filter((r) => r.capMinutes != null);
  const blockedOrgs = capRows.filter((r) => r.blocked);
  const nearOrgs = capRows.filter((r) => !r.blocked && (r.pctUsed ?? 0) >= 0.8);

  const anything =
    downServices.length > 0 || pendingReviews > 0 || pendingAddons > 0 || blockedOrgs.length > 0 || nearOrgs.length > 0;

  const go = (href: string) => {
    onClose();
    router.push(href);
  };

  return (
    <div className="fixed inset-0 z-[60] bg-slate-950/40" onClick={onClose}>
      <aside
        className="absolute right-0 top-0 h-full w-full max-w-md overflow-auto border-l border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-800 dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-black">Notifications</h2>
          <button
            type="button"
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-lg bg-slate-100 text-lg text-slate-500 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700"
          >
            ×
          </button>
        </div>

        {downServices.map((s) => (
          <Notice key={s.name} tone="Critical" title={`${s.name} — ${s.status}`} body="A platform service is not fully operational.">
            <Btn size="sm" onClick={() => go('/admin2/diagnostics')}>Diagnose</Btn>
          </Notice>
        ))}

        {pendingReviews > 0 && (
          <Notice tone="Warning" title={`${pendingReviews} signup review${pendingReviews > 1 ? 's' : ''} pending`} body="New customers are waiting on 10DLC / KYC review.">
            <Btn size="sm" onClick={() => go('/admin2/signups')}>Review</Btn>
          </Notice>
        )}

        {pendingAddons > 0 && (
          <Notice tone="Warning" title={`${pendingAddons} purchase request${pendingAddons > 1 ? 's' : ''} pending`} body="Bank-transfer add-on purchases (numbers / SMS packages) are awaiting approval.">
            <Btn size="sm" onClick={() => go('/admin2/purchases')}>Review</Btn>
          </Notice>
        )}

        {blockedOrgs.length > 0 && (
          <Notice
            tone="Critical"
            title={`${blockedOrgs.length} org${blockedOrgs.length > 1 ? 's' : ''} blocked — call cap reached`}
            body={blockedOrgs.slice(0, 3).map((r) => r.name).join(', ') + (blockedOrgs.length > 3 ? '…' : '') + '. Outbound is blocked until the cap is raised or the month resets.'}
          >
            <Btn size="sm" onClick={() => go(`/admin2/organizations/${blockedOrgs[0].orgId}?tab=usage`)}>Manage cap</Btn>
          </Notice>
        )}

        {nearOrgs.length > 0 && (
          <Notice
            tone="Warning"
            title={`${nearOrgs.length} org${nearOrgs.length > 1 ? 's' : ''} near the call cap (≥80%)`}
            body={nearOrgs.slice(0, 3).map((r) => `${r.name} (${Math.round((r.pctUsed ?? 0) * 100)}%)`).join(', ') + (nearOrgs.length > 3 ? '…' : '')}
          >
            <Btn size="sm" onClick={() => go('/admin2/organizations')}>Review</Btn>
          </Notice>
        )}

        {!anything && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300">
            All clear — no services down and nothing pending review.
          </div>
        )}
      </aside>
    </div>
  );
}

function Notice({ tone, title, body, children }: { tone: 'Critical' | 'Warning' | 'Info'; title: string; body: string; children?: React.ReactNode }) {
  const pill =
    tone === 'Critical'
      ? 'bg-[#FF6542]/10 text-[#b8462c] dark:text-[#ffb09a]'
      : tone === 'Warning'
        ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
        : 'bg-slate-500/10 text-slate-500';
  return (
    <div className="border-b border-slate-200 py-4 last:border-0 dark:border-slate-800">
      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-bold ${pill}`}>{tone}</span>
      <h4 className="mt-2 text-sm font-bold">{title}</h4>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{body}</p>
      {children && <div className="mt-2">{children}</div>}
    </div>
  );
}
