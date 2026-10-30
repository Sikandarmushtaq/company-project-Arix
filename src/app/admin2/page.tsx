'use client';

/**
 * Page 7 — Dashboard. Real data only: useAdminStats (metrics + recent activity +
 * service status), useOrganizations (org count), useTimeSeriesData (14-day call
 * volume chart). "Needs attention" is DERIVED from real service status (any
 * non-Operational) — not a mock feed. No fabricated figures.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/lib/stores/auth';
import { useAdminStats, useOrganizations, useTimeSeriesData } from '@/lib/hooks/useAdmin';
import { adminService } from '@/lib/api/services/admin.service';
import { adminAccountApi } from '@/lib/api/services/admin-account.api';
import { superadminApiService } from '@/lib/api/services/superadmin.service';
import { addonApiService } from '@/lib/api/services/addon.service';
import { useCallUsageLedger } from './_components/useCallUsageLedger';
import { useSmsUsageLedger } from './_components/useSmsUsageLedger';
import { useDashboardRealtime } from './_components/useDashboardRealtime';
import { useSocket } from '@/lib/providers/SocketProvider';
import { Btn, Card, Metric, PageHead, SectionTitle, StatusDot, HealthRow } from './_components/ui';

function greeting(): string {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

export default function Admin2Dashboard() {
  const router = useRouter();
  const { user } = useAuthStore();
  const isSuperAdmin = user?.role === 'super_admin' || user?.role === 'superadmin';

  const { data: stats, isLoading: statsLoading } = useAdminStats();
  const { data: orgs } = useOrganizations({ page: 1, limit: 1 }, { enabled: isSuperAdmin });
  const { data: series } = useTimeSeriesData(14);
  const ledger = useCallUsageLedger(isSuperAdmin); // live via WS push, no polling
  const smsLedger = useSmsUsageLedger(isSuperAdmin); // SMS twin, same live-via-WS pattern
  const { isConnected } = useSocket();
  useDashboardRealtime(isSuperAdmin); // push-live: invalidate on WS events, no polling
  const numberStats = useQuery({
    queryKey: ['admin2', 'number-stats'],
    queryFn: () => adminAccountApi.getNumberStats(),
    enabled: isSuperAdmin,
    staleTime: 30_000,
  });
  const platformStats = useQuery({
    queryKey: ['admin2', 'platform-stats'],
    queryFn: () => adminAccountApi.getPlatformStats(),
    enabled: isSuperAdmin,
    staleTime: 60_000,
  });
  // Real active-call count from the Live Call Monitor — the dashboard stats
  // payload doesn't carry activeCalls (it would always read 0).
  const liveCalls = useQuery({
    queryKey: ['admin2', 'live-calls'],
    queryFn: () => adminService.getLiveCalls(false),
    enabled: isSuperAdmin,
    staleTime: 5_000,
  });
  const signupStats = useQuery({
    queryKey: ['admin2', 'signup-stats'],
    queryFn: () => superadminApiService.getSmsReviewStats(),
    enabled: isSuperAdmin,
    staleTime: 30_000,
  });
  const purchasePending = useQuery({
    queryKey: ['admin2', 'addon-pending-count'],
    queryFn: () => addonApiService.adminPendingCount(),
    enabled: isSuperAdmin,
    staleTime: 30_000,
  });

  // Orgs at/approaching the call-minute soft cap — surfaced so you never have to
  // open each org to check. Blocked first, then by %-used desc; ≥80% only.
  const nearCap = ledger.rows
    .filter((r) => r.capMinutes != null && (r.blocked || (r.pctUsed ?? 0) >= 0.8))
    .sort((a, b) => Number(b.blocked) - Number(a.blocked) || (b.pctUsed ?? 0) - (a.pctUsed ?? 0))
    .slice(0, 8);

  // SMS twin — metered orgs at/approaching their SMS allowance (package or base cap).
  const smsNearCap = smsLedger.rows
    .filter((r) => r.smsCap > 0 && (r.blocked || (r.pctUsed ?? 0) >= 0.8))
    .sort((a, b) => Number(b.blocked) - Number(a.blocked) || (b.pctUsed ?? 0) - (a.pctUsed ?? 0))
    .slice(0, 8);

  // Manual refresh — re-pull every active dashboard query on demand (no polling).
  // The near-cap card stays live via its WS push regardless.
  const qc = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const [refreshedAt, setRefreshedAt] = useState<Date | null>(null);
  const refresh = async () => {
    setRefreshing(true);
    try {
      await qc.invalidateQueries(); // refetchType 'active' → only what's on-screen
      setRefreshedAt(new Date());
    } finally {
      setRefreshing(false);
    }
  };

  const svc = stats?.systemStatus ?? [];
  const attnServices = svc.filter((s) => s.status !== 'Operational');
  // Orgs blocked by the call soft cap are a real, actionable problem — surface
  // them in "Needs attention" too, not only in the usage card.
  const blockedOrgs = ledger.rows.filter((r) => r.capMinutes != null && r.blocked);
  // Orgs that have hit their SMS allowance — texting is blocked until a package is
  // bought or the cap is raised/resets. Actionable → surfaced in Needs attention too.
  const blockedSmsOrgs = smsLedger.rows.filter((r) => r.smsCap > 0 && r.blocked);
  const pendingSignups = signupStats.data?.data?.pending ?? 0;
  const pendingPurchases = purchasePending.data?.data?.count ?? 0;
  const attentionCount =
    attnServices.length + blockedOrgs.length + blockedSmsOrgs.length + (pendingSignups > 0 ? 1 : 0) + (pendingPurchases > 0 ? 1 : 0);
  const calls14 = series?.calls ?? [];
  const maxCall = Math.max(1, ...calls14.map((p) => p.value));

  return (
    <section>
      <PageHead
        title={greeting()}
        subtitle={
          <span className="inline-flex flex-wrap items-center gap-2">
            <span>
              {attentionCount > 0
                ? `${attentionCount} item${attentionCount > 1 ? 's' : ''} need attention.`
                : 'ArixCall is operating normally.'}
            </span>
            <span className={`inline-flex items-center gap-1.5 text-xs font-bold ${isConnected ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${isConnected ? 'bg-emerald-500' : 'bg-slate-400'}`} />
              {isConnected ? 'Live' : 'Offline'}
            </span>
            {refreshedAt && <span className="text-xs text-slate-400">· updated {refreshedAt.toLocaleTimeString()}</span>}
          </span>
        }
        actions={
          <>
            <Btn onClick={refresh} disabled={refreshing}>{refreshing ? 'Refreshing…' : '↻ Refresh'}</Btn>
            <Btn onClick={() => router.push('/admin2/diagnostics')}>Run diagnostics</Btn>
            <Btn variant="primary" onClick={() => router.push('/admin2/onboarding')}>+ New Organization</Btn>
          </>
        }
      />

      {/* Metrics (all real) */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Metric label="Organizations" value={orgs?.meta?.total ?? '—'} sub="customers" subTone="off" />
        <Metric label="Active Users" value={(stats?.activeUsers ?? 0).toLocaleString()} sub={`${(stats?.totalUsers ?? 0).toLocaleString()} total`} subTone="off" />
        <Metric label="Active Calls" value={liveCalls.isLoading ? '…' : (liveCalls.data?.length ?? 0).toLocaleString()} sub="in progress" />
        <Metric label="Active Sessions" value={(stats?.activeSessions ?? 0).toLocaleString()} sub={`${stats?.activeDevices ?? 0} devices`} subTone="off" />
      </div>

      {/* Telnyx balance (credit early-warning) + SMS-active sub-accounts */}
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <SectionTitle>Telnyx account credit</SectionTitle>
          {platformStats.isLoading ? (
            <div className="h-20 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
          ) : platformStats.isError || !platformStats.data ? (
            <div className="text-sm text-slate-400">Could not load platform stats.</div>
          ) : (() => {
            const b = platformStats.data.balance;
            const subs = platformStats.data.subs;
            if (!b || b.availableCredit == null) {
              return <div className="text-sm text-slate-400">Balance unavailable from Telnyx right now.</div>;
            }
            const cur = b.currency ?? 'USD';
            const avail = b.availableCredit;
            // Thresholds from backend config (TELNYX_LOW_CREDIT_WARN), not a
            // hardcoded UI magic number: <=0 genuinely out (red); at/below the
            // low-water mark warns (amber); otherwise ok. Not a usage prediction.
            const warnAt = platformStats.data.lowCreditWarn ?? 50;
            const tone = avail <= 0 ? 'bad' : avail <= warnAt ? 'warn' : 'ok';
            const toneText = tone === 'bad' ? 'text-red-600 dark:text-red-400' : tone === 'warn' ? 'text-amber-600 dark:text-amber-400' : '';
            const fmt = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            return (
              <div>
                <div className="flex items-end justify-between">
                  <div>
                    <div className={`text-3xl font-black ${toneText}`}>{cur} {fmt(avail)}</div>
                    <div className="text-xs font-semibold text-slate-400">available credit</div>
                  </div>
                  <StatusDot health={tone} label={tone === 'bad' ? 'Out of credit' : tone === 'warn' ? 'Low' : 'Healthy'} />
                </div>
                {tone !== 'ok' && (
                  <p className={`mt-2 rounded-lg px-3 py-2 text-xs font-semibold ${tone === 'bad' ? 'bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-300' : 'bg-amber-50 text-amber-800 dark:bg-amber-950/30 dark:text-amber-200'}`}>
                    {tone === 'bad' ? 'Platform credit is exhausted — calls and SMS may fail. Top up the Telnyx account.' : 'Platform credit is low — consider topping up to avoid interruption.'}
                  </p>
                )}
                <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                  {b.balance != null && <span>Balance: <b className="text-slate-700 dark:text-slate-200">{cur} {fmt(b.balance)}</b></span>}
                  {b.creditLimit != null && <span>Credit limit: <b className="text-slate-700 dark:text-slate-200">{cur} {fmt(b.creditLimit)}</b></span>}
                  <span title="From the sub-account registry's last-verified state, not a live re-check">SMS-active sub-accounts: <b className="text-slate-700 dark:text-slate-200">{subs.smsActive}/{subs.total}</b></span>
                </div>
              </div>
            );
          })()}
        </Card>

        <Card className="p-5">
          <SectionTitle
            action={<button type="button" onClick={() => router.push('/admin2/phone-numbers')} className="text-xs font-bold text-slate-400 hover:text-[#FF6542]">Manage →</button>}
          >
            Phone numbers
          </SectionTitle>
          {numberStats.isLoading ? (
            <div className="h-20 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
          ) : numberStats.isError || !numberStats.data ? (
            <div className="text-sm text-slate-400">Could not load number inventory.</div>
          ) : (() => {
            const s = numberStats.data;
            const motherPct = s.total ? Math.round((s.mother / s.total) * 100) : 0;
            const subPct = s.total ? 100 - motherPct : 0;
            return (
              <div className="grid gap-5 sm:grid-cols-[auto_1fr] sm:items-center">
                <div>
                  <div className="text-3xl font-black">{s.total.toLocaleString()}</div>
                  <div className="text-xs font-semibold text-slate-400">total DIDs · {s.active.toLocaleString()} active</div>
                </div>
                <div>
                  {/* proportion bar */}
                  <div className="flex h-3 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                    <div className="h-full bg-[#FF6542]" style={{ width: `${subPct}%` }} title={`${s.sub} in sub-accounts`} />
                    <div className="h-full bg-slate-400 dark:bg-slate-600" style={{ width: `${motherPct}%` }} title={`${s.mother} on mother trunk`} />
                  </div>
                  <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-sm">
                    <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-[#FF6542]" /><b>{s.sub.toLocaleString()}</b> <span className="text-slate-500 dark:text-slate-400">in sub-accounts ({subPct}%)</span></span>
                    <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-slate-400 dark:bg-slate-600" /><b>{s.mother.toLocaleString()}</b> <span className="text-slate-500 dark:text-slate-400">on mother trunk ({motherPct}%)</span></span>
                  </div>
                </div>
              </div>
            );
          })()}
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.4fr_0.6fr]">
        {/* Call volume chart (real timeseries) */}
        <Card className="p-5">
          <SectionTitle action={<span className="rounded-full bg-slate-500/10 px-2 py-0.5 text-xs font-bold text-slate-500">14D</span>}>
            Call volume — last 14 days
          </SectionTitle>
          {calls14.length === 0 ? (
            <div className="grid h-[220px] place-items-center text-sm text-slate-400">No call data for this period.</div>
          ) : (
            <div className="flex h-[220px] items-end gap-2 pt-4">
              {calls14.map((p) => (
                <div key={p.date} className="group relative flex-1" title={`${p.date}: ${p.value.toLocaleString()} calls`}>
                  <div
                    className="w-full rounded-t-md bg-gradient-to-b from-[#ffc5b7] to-[#FF6542]"
                    style={{ height: `${Math.max(4, Math.round((p.value / maxCall) * 100))}%` }}
                  />
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Needs attention — real signals: non-operational services + orgs blocked
            by the call soft cap (both actionable). */}
        <Card className="p-5">
          <SectionTitle>Needs attention</SectionTitle>
          {attentionCount === 0 ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300">
              All clear — no services down and no orgs blocked.
            </div>
          ) : (
            <>
              {attnServices.map((s) => (
                <div key={s.name} className="mb-2.5 rounded-xl border border-amber-200 bg-amber-50 p-3.5 dark:border-amber-900 dark:bg-amber-950/30">
                  <div className="text-sm font-bold text-amber-900 dark:text-amber-200">{s.name} — {s.status}</div>
                  <Btn size="sm" onClick={() => router.push('/admin2/diagnostics')}>Diagnose</Btn>
                </div>
              ))}
              {pendingSignups > 0 && (
                <div className="mb-2.5 rounded-xl border border-amber-200 bg-amber-50 p-3.5 dark:border-amber-900 dark:bg-amber-950/30">
                  <div className="text-sm font-bold text-amber-900 dark:text-amber-200">{pendingSignups} signup{pendingSignups > 1 ? 's' : ''} awaiting review</div>
                  <div className="mb-1.5 text-xs text-amber-800/80 dark:text-amber-300/70">New customers are pending KYC / 10DLC review before they go live.</div>
                  <Btn size="sm" onClick={() => router.push('/admin2/signups')}>Review signups</Btn>
                </div>
              )}
              {pendingPurchases > 0 && (
                <div className="mb-2.5 rounded-xl border border-amber-200 bg-amber-50 p-3.5 dark:border-amber-900 dark:bg-amber-950/30">
                  <div className="text-sm font-bold text-amber-900 dark:text-amber-200">{pendingPurchases} purchase request{pendingPurchases > 1 ? 's' : ''} pending</div>
                  <div className="mb-1.5 text-xs text-amber-800/80 dark:text-amber-300/70">Bank-transfer add-on buys (numbers / SMS packages) are awaiting approval.</div>
                  <Btn size="sm" onClick={() => router.push('/admin2/purchases')}>Review purchases</Btn>
                </div>
              )}
              {blockedOrgs.map((r) => (
                <div key={r.orgId} className="mb-2.5 rounded-xl border border-red-200 bg-red-50 p-3.5 dark:border-red-950 dark:bg-red-950/30">
                  <div className="text-sm font-bold text-red-800 dark:text-red-300">{r.name} — call cap reached</div>
                  <div className="mb-1.5 text-xs text-red-700/80 dark:text-red-300/70">Outbound is blocked until the cap is raised or the month resets ({r.minutesUsed.toLocaleString()}/{(r.capMinutes ?? 0).toLocaleString()} min).</div>
                  <Btn size="sm" onClick={() => router.push(`/admin2/organizations/${r.orgId}?tab=usage`)}>Manage cap</Btn>
                </div>
              ))}
              {blockedSmsOrgs.map((r) => (
                <div key={`sms-${r.orgId}`} className="mb-2.5 rounded-xl border border-red-200 bg-red-50 p-3.5 dark:border-red-950 dark:bg-red-950/30">
                  <div className="text-sm font-bold text-red-800 dark:text-red-300">{r.name} — SMS limit reached</div>
                  <div className="mb-1.5 text-xs text-red-700/80 dark:text-red-300/70">Texting is blocked until an SMS package is bought or the allowance resets ({r.smsUsed.toLocaleString()}/{r.smsCap.toLocaleString()} SMS).</div>
                  <Btn size="sm" onClick={() => router.push(`/admin2/organizations/${r.orgId}?tab=usage`)}>View usage</Btn>
                </div>
              ))}
            </>
          )}
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {/* Recent activity (real) */}
        <Card className="p-5">
          <SectionTitle>Recent activity</SectionTitle>
          {statsLoading ? (
            <div className="space-y-2">{[0,1,2].map((i)=>(<div key={i} className="h-10 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />))}</div>
          ) : (stats?.recentActivity ?? []).length === 0 ? (
            <div className="py-6 text-center text-sm text-slate-400">No recent activity.</div>
          ) : (
            (stats?.recentActivity ?? []).slice(0, 6).map((a, i) => (
              <HealthRow key={i} label={<span><span className="font-semibold">{a.user}</span> {a.action}</span>}>
                <small className="text-xs text-slate-400">{a.time}</small>
              </HealthRow>
            ))
          )}
        </Card>

        {/* Service status (real) */}
        <Card className="p-5">
          <SectionTitle>Service status</SectionTitle>
          {svc.length === 0 ? (
            <div className="py-6 text-center text-sm text-slate-400">Status unavailable.</div>
          ) : (
            svc.map((s) => (
              <HealthRow key={s.name} label={s.name}>
                <StatusDot health={s.status === 'Operational' ? 'ok' : s.status === 'Degraded' ? 'warn' : 'bad'} label={s.status} />
              </HealthRow>
            ))
          )}
        </Card>
      </div>

      {/* Call usage near cap — proactive fleet watch (no per-org clicking) */}
      <div className="mt-4">
        <Card className="p-5">
          <SectionTitle
            action={<button type="button" onClick={() => router.push('/admin2/organizations')} className="text-xs font-bold text-slate-400 hover:text-[#FF6542]">View all →</button>}
          >
            Call usage near cap
          </SectionTitle>
          {nearCap.length === 0 ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300">
              No organization is near its fair-use call cap.
            </div>
          ) : (
            nearCap.map((r) => {
              const pct = r.pctUsed != null ? Math.min(100, Math.round(r.pctUsed * 100)) : 0;
              const bad = r.blocked || pct >= 90;
              return (
                <button
                  key={r.orgId}
                  type="button"
                  onClick={() => router.push(`/admin2/organizations/${r.orgId}`)}
                  className="flex w-full items-center justify-between gap-4 border-b border-slate-200 py-2.5 text-left last:border-0 hover:text-[#FF6542] dark:border-slate-800"
                >
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold">{r.name}</span>
                  <span className="w-28 shrink-0">
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                      <div className={`h-full ${bad ? 'bg-red-500' : 'bg-amber-500'}`} style={{ width: `${pct}%` }} />
                    </div>
                  </span>
                  <StatusDot health={bad ? 'bad' : 'warn'} label={r.blocked ? 'Blocked' : `${pct}% · ${r.minutesUsed.toLocaleString()}/${(r.capMinutes ?? 0).toLocaleString()}`} />
                </button>
              );
            })
          )}
        </Card>
      </div>

      {/* SMS usage near cap — the SMS twin of the call card (metered orgs) */}
      <div className="mt-4">
        <Card className="p-5">
          <SectionTitle
            action={<button type="button" onClick={() => router.push('/admin2/organizations')} className="text-xs font-bold text-slate-400 hover:text-[#FF6542]">View all →</button>}
          >
            SMS usage near limit
          </SectionTitle>
          {smsNearCap.length === 0 ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300">
              No organization is near its SMS limit.
            </div>
          ) : (
            smsNearCap.map((r) => {
              const pct = r.pctUsed != null ? Math.min(100, Math.round(r.pctUsed * 100)) : 0;
              const bad = r.blocked || pct >= 90;
              return (
                <button
                  key={r.orgId}
                  type="button"
                  onClick={() => router.push(`/admin2/organizations/${r.orgId}?tab=usage`)}
                  className="flex w-full items-center justify-between gap-4 border-b border-slate-200 py-2.5 text-left last:border-0 hover:text-[#FF6542] dark:border-slate-800"
                >
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold">{r.name}</span>
                  <span className="w-28 shrink-0">
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                      <div className={`h-full ${bad ? 'bg-red-500' : 'bg-amber-500'}`} style={{ width: `${pct}%` }} />
                    </div>
                  </span>
                  <StatusDot health={bad ? 'bad' : 'warn'} label={r.blocked ? 'Blocked' : `${pct}% · ${r.smsUsed.toLocaleString()}/${r.smsCap.toLocaleString()}`} />
                </button>
              );
            })
          )}
        </Card>
      </div>
    </section>
  );
}
