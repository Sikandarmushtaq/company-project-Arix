'use client';

/**
 * Page 1 — Organizations list (STEP 2: wired to real data).
 *
 * Live GET /admin/organizations via useOrganizations({ page, limit, search }).
 * Columns map to the REAL Organization shape (the GPT mock's industry/plan/
 * usagePercent/health/"Trial" don't exist on this endpoint and were dropped;
 * billingStatus + isActive + pagination — which it omitted — are added).
 */

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/stores/auth';
import { useOrganizations } from '@/lib/hooks/useAdmin';
import { adminService, type Organization } from '@/lib/api/services';
import type { CallUsageLedgerRow, SmsUsageLedgerRow } from '@/lib/api/services/admin-analytics.api';
import { downloadCsvRows } from '@/lib/utils/csv';
import { toast } from '@/lib/stores/toast';
import { useCallUsageLedger } from '../_components/useCallUsageLedger';
import { useSmsUsageLedger } from '../_components/useSmsUsageLedger';
import { SubscriptionBadge } from '../_components/ui';

const LIMIT = 25;

/** State label — mirrors the table's State cell EXACTLY so the export agrees with the UI. */
function orgStateLabel(o: Organization): string {
  const s = o.status ?? (o.isActive ? 'active' : 'closed');
  const isDisabled = s === 'suspended' || o.billingStatus === 'suspended';
  if (s === 'closed') return 'Closed';
  if (isDisabled) return 'Disabled';
  if (s === 'pending') return 'Pending';
  return o.isActive ? 'Active' : 'Inactive';
}

/** Subscription label — the humanized billingStatus the SubscriptionBadge shows. */
function orgSubscriptionLabel(o: Organization): string {
  const s = (o.billingStatus || 'active').replace(/_/g, ' ');
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Compact call-minute usage cell. Caps are PER-USER now, so there is no single org
 * ceiling to show a ratio/"Blocked" against — that would falsely flag a busy
 * multi-user org. We show the org's TOTAL minutes this month (informational) plus the
 * per-user default as context. Per-user blocking shows on each user, not here.
 *   • NOT in ledger → "Trial" (pending/unverified — on the trial cap)
 *   • otherwise     → "N min" total this month (· M/user context when a cap applies)
 */
function CallUsageCell({ row, ready }: { row?: CallUsageLedgerRow; ready: boolean }) {
  if (!ready) return <span className="text-xs text-slate-400">…</span>;
  if (!row) return <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Trial</span>;
  return (
    <div className="min-w-[110px] text-xs">
      <span className="font-bold text-slate-700 dark:text-slate-200">
        {row.minutesUsed.toLocaleString()} min
      </span>
      {row.capMinutes == null ? (
        <span className="ml-1 text-slate-400">· no cap</span>
      ) : (
        <span className="ml-1 text-slate-400">· {row.capMinutes.toLocaleString()}/user</span>
      )}
    </div>
  );
}

/**
 * Compact SMS-usage cell — the SMS twin of CallUsageCell. Unlike calls, the SMS
 * allowance applies to EVERY metered reskin org, so a present row always has a cap:
 *   • in-ledger      → "N%  used/cap" bar (metered org: package or base cap)
 *   • NOT in ledger  → "Unlimited" (non-reskin / nuxcall — SMS not metered)
 * While the ledger is still loading we show "…" rather than mislabelling.
 */
function SmsUsageCell({ row, ready }: { row?: SmsUsageLedgerRow; ready: boolean }) {
  if (!ready) return <span className="text-xs text-slate-400">…</span>;
  if (!row || row.smsCap <= 0) return <span className="text-xs text-slate-400">Unlimited</span>;
  const pct = row.pctUsed != null ? Math.min(100, Math.round(row.pctUsed * 100)) : 0;
  const tone = row.blocked || pct >= 90 ? 'bg-red-500' : pct >= 80 ? 'bg-amber-500' : 'bg-emerald-500';
  const txt = row.blocked || pct >= 90 ? 'text-red-600 dark:text-red-400' : pct >= 80 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-500 dark:text-slate-400';
  return (
    <div className="min-w-[110px]">
      <div className={`text-xs font-bold ${txt}`}>
        {row.blocked ? 'Blocked' : `${pct}%`}
        <span className="ml-1 font-normal text-slate-400">{row.smsUsed.toLocaleString()}/{row.smsCap.toLocaleString()}</span>
        {row.source === 'bundle' && <span className="ml-1 font-normal text-slate-400" title="On a purchased SMS package">·pkg</span>}
        {row.source === 'manual' && <span className="ml-1 font-normal text-amber-500" title="Admin manual SMS limit override">·manual</span>}
      </div>
      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
        <div className={`h-full ${tone}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function UsageCell({ used, cap }: { used?: number; cap?: number }) {
  const u = used ?? 0;
  const c = cap ?? 0;
  const pct = c > 0 ? Math.min(100, Math.round((u / c) * 100)) : 0;
  const bar = pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-amber-500' : 'bg-emerald-500';
  return (
    <div className="min-w-[90px]">
      <div className="font-semibold">{u} <span className="text-slate-400">/ {c || '—'}</span></div>
      {c > 0 && (
        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
          <div className={`h-full ${bar}`} style={{ width: `${pct}%` }} />
        </div>
      )}
    </div>
  );
}

function Skeleton() {
  return (
    <tr className="animate-pulse">
      {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
        <td key={i} className="px-4 py-4"><div className="h-4 rounded bg-slate-200 dark:bg-slate-800" /></td>
      ))}
    </tr>
  );
}

export default function OrganizationsPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const isSuperAdmin = user?.role === 'super_admin' || user?.role === 'superadmin';

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);

  // Debounce the search box so we don't fire a request per keystroke.
  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput.trim()); setPage(1); }, 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Fleet call-usage ledger (real minutes vs soft cap) — live via WS push (no
  // polling), joined into each row so you spot near/over-cap orgs without opening
  // them.
  const ledger = useCallUsageLedger(isSuperAdmin);
  const ledgerByOrg = ledger.byOrg;
  // SMS-usage ledger — same live-via-WS pattern, metered orgs (package or base cap).
  const smsLedger = useSmsUsageLedger(isSuperAdmin);
  const smsByOrg = smsLedger.byOrg;

  const { data, isLoading, isError, isFetching } = useOrganizations(
    { page, limit: LIMIT, search: search || undefined, status: status || undefined },
    { enabled: isSuperAdmin }
  );

  const orgs: Organization[] = data?.organizations ?? [];
  const meta = data?.meta;
  const totalPages = meta?.totalPages ?? 1;
  // A search or status filter is active → an empty result means "nothing matched",
  // not "no orgs exist" (drives the empty-state copy).
  const filtered = !!search || !!status;

  const fmtDate = useMemo(
    () => (iso?: string) => (iso ? new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '—'),
    []
  );

  // Export EVERY org matching the current search/status filter (not just the visible
  // page) to CSV — paginate server-side so we don't depend on the page size, then
  // build the file client-side with the reusable downloadCsvRows helper.
  const [exporting, setExporting] = useState(false);
  const handleExport = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const pageSize = 200;
      const all: Organization[] = [];
      for (let p = 1; ; p += 1) {
        const res = await adminService.getOrganizations({
          page: p,
          limit: pageSize,
          search: search || undefined,
          status: status || undefined,
        });
        const batch = res.organizations ?? [];
        all.push(...batch);
        const tp = res.meta?.totalPages ?? 1;
        if (p >= tp || batch.length === 0) break;
      }
      if (all.length === 0) {
        toast.error('Nothing to export for the current filter.');
        return;
      }
      downloadCsvRows(
        `organizations-${new Date().toISOString().slice(0, 10)}`,
        ['Organization', 'Subscription', 'State', 'Users', 'Numbers', 'Created'],
        all.map((o) => [
          o.name,
          orgSubscriptionLabel(o),
          orgStateLabel(o),
          o.userCount ?? 0,
          o.numberCount ?? 0,
          o.createdAt ? new Date(o.createdAt).toISOString().slice(0, 10) : '',
        ])
      );
      toast.success(`Exported ${all.length} organization${all.length === 1 ? '' : 's'}`);
    } catch {
      toast.error('Export failed — please try again.');
    } finally {
      setExporting(false);
    }
  };

  if (!isSuperAdmin) {
    return (
      <section>
        <h1 className="text-3xl font-black tracking-tight">Organizations</h1>
        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900">
          The organization directory is available to platform super-admins.
        </div>
      </section>
    );
  }

  return (
    <section>
      <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-start">
        <div>
          <h1 className="text-3xl font-black tracking-tight">
            Organizations {meta ? <span className="text-slate-400">({meta.total})</span> : null}
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            The primary customer workspace. Users are created and managed inside each organization.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleExport}
            disabled={exporting || isLoading || orgs.length === 0}
            title="Export all organizations (matching the current filter) to CSV"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            {exporting ? 'Exporting…' : 'Export CSV'}
          </button>
          <button
            type="button"
            onClick={() => router.push('/admin2/onboarding')}
            className="rounded-xl bg-[#FF6542] px-4 py-2.5 text-sm font-bold text-white"
          >
            + New Organization
          </button>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          aria-label="Search organizations"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search organization by name…"
          className="min-w-[260px] flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none placeholder:text-slate-400 focus:border-[#FF6542] dark:border-slate-800 dark:bg-slate-900"
        />
        {/* Status filter — mirrors the State column (Disabled = status 'suspended'). */}
        <div className="flex rounded-xl border border-slate-200 p-1 dark:border-slate-800">
          {([
            { key: '', label: 'All' },
            { key: 'active', label: 'Active' },
            { key: 'suspended', label: 'Disabled' },
            { key: 'closed', label: 'Closed' },
          ] as const).map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => { setStatus(f.key); setPage(1); }}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold ${status === f.key ? 'bg-[#FF6542] text-white' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}
            >
              {f.label}
            </button>
          ))}
        </div>
        {isFetching && !isLoading && <span className="text-xs font-semibold text-slate-400">Updating…</span>}
      </div>

      {isError ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm font-semibold text-red-800 dark:border-red-950 dark:bg-red-950/30 dark:text-red-200">
          Organizations could not be loaded. Please retry.
        </div>
      ) : !isLoading && orgs.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center dark:border-slate-700 dark:bg-slate-900">
          <h2 className="text-xl font-extrabold">{filtered ? 'No matching organizations' : 'No organizations yet'}</h2>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            {filtered ? 'Try a different search or filter.' : 'Create the first customer organization.'}
          </p>
          {!filtered && (
            <button
              type="button"
              onClick={() => router.push('/admin2/onboarding')}
              className="mt-5 rounded-xl bg-[#FF6542] px-4 py-2.5 text-sm font-bold text-white"
            >
              Create Organization
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-950/70 dark:text-slate-400">
                  <tr>
                    <th className="px-4 py-3">Organization</th>
                    <th className="px-4 py-3">Subscription</th>
                    <th className="px-4 py-3">State</th>
                    <th className="px-4 py-3">Users</th>
                    <th className="px-4 py-3">Numbers</th>
                    <th className="px-4 py-3">Call usage</th>
                    <th className="px-4 py-3">SMS usage</th>
                    <th className="px-4 py-3">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {isLoading
                    ? [0, 1, 2, 3, 4].map((i) => <Skeleton key={i} />)
                    : orgs.map((o) => (
                        <tr
                          key={o.id}
                          onClick={() => router.push(`/admin2/organizations/${o.id}`)}
                          className="cursor-pointer hover:bg-[#FF6542]/5"
                        >
                          <td className="px-4 py-4">
                            <div className="font-extrabold">{o.name}</div>
                            <div className="mt-1 font-mono text-xs text-slate-500 dark:text-slate-400">{o.slug}</div>
                          </td>
                          <td className="px-4 py-4"><SubscriptionBadge status={o.status === 'pending' ? 'pending' : o.billingStatus} /></td>
                          <td className="px-4 py-4">
                            {(() => {
                              // A disabled org keeps is_active=1 (status='suspended'), so key off
                              // status; fall back to isActive for rows without it.
                              const s = o.status ?? (o.isActive ? 'active' : 'closed');
                              // An org disabled from the BILLING page sets billing_status
                              // ='suspended' (NOT lifecycle status), so without this it showed
                              // "Active" here while the Billing page showed "Disabled". Treat
                              // either suspension as Disabled so both admin views agree.
                              const isDisabled = s === 'suspended' || o.billingStatus === 'suspended';
                              const v =
                                s === 'closed'
                                  ? { c: 'text-red-600 dark:text-red-400', d: 'bg-red-500', l: 'Closed' }
                                  : isDisabled
                                  ? { c: 'text-amber-600 dark:text-amber-400', d: 'bg-amber-500', l: 'Disabled' }
                                  : s === 'pending'
                                      ? { c: 'text-amber-600 dark:text-amber-400', d: 'bg-amber-500', l: 'Pending' }
                                      : o.isActive
                                        ? { c: 'text-emerald-600 dark:text-emerald-400', d: 'bg-emerald-500', l: 'Active' }
                                        : { c: 'text-slate-500', d: 'bg-slate-400', l: 'Inactive' };
                              return (
                                <span className={`inline-flex items-center gap-2 text-xs font-bold ${v.c}`}>
                                  <span className={`h-2 w-2 rounded-full ${v.d}`} />
                                  {v.l}
                                </span>
                              );
                            })()}
                          </td>
                          <td className="px-4 py-4"><UsageCell used={o.userCount} cap={o.maxUsers} /></td>
                          <td className="px-4 py-4"><UsageCell used={o.numberCount} cap={o.maxPhoneNumbers} /></td>
                          <td className="px-4 py-4"><CallUsageCell row={ledgerByOrg.get(o.id)} ready={ledger.ready} /></td>
                          <td className="px-4 py-4"><SmsUsageCell row={smsByOrg.get(o.id)} ready={smsLedger.ready} /></td>
                          <td className="px-4 py-4 text-slate-500 dark:text-slate-400">{fmtDate(o.createdAt)}</td>
                        </tr>
                      ))}
                </tbody>
              </table>
            </div>
          </div>

          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between text-sm">
              <span className="text-slate-500 dark:text-slate-400">Page {page} of {totalPages}</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="rounded-xl border border-slate-200 px-3 py-2 font-bold disabled:opacity-40 dark:border-slate-700"
                >
                  ← Prev
                </button>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="rounded-xl border border-slate-200 px-3 py-2 font-bold disabled:opacity-40 dark:border-slate-700"
                >
                  Next →
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}
