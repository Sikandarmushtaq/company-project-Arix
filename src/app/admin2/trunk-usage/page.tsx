'use client';

/**
 * Trunk Usage console (super-admin). Pick a timeline (Today / 7 days / 30 days /
 * custom range) and see each org's CURRENT outbound trunk, its usage over that
 * range (total + short / long / unanswered, accurate connected talk time), and its
 * average minutes/day over the range. Orgs whose avg/day exceeds the "flag over"
 * threshold turn red. The super-admin can manually switch an org between the Telnyx
 * trunk and the Tozcall fallback.
 */
import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/lib/stores/auth';
import { toast } from '@/lib/stores/toast';
import { adminAccountApi, type TrunkUsageRow } from '@/lib/api/services/admin-account.api';
import {
  PageHead,
  Card,
  Btn,
  Pill,
  StatusDot,
  Modal,
  RowSkeleton,
  EmptyState,
  ErrorState,
  Metric,
  fieldInput,
} from '../_components/ui';

type Trunk = 'telnyx' | 'tozcall';
type Period = 'today' | '7d' | '30d' | 'custom';

const isoDay = (d: Date) => d.toISOString().slice(0, 10);

function periodRange(period: Period, customFrom: string, customTo: string): { from: string; to: string } {
  const today = new Date();
  if (period === 'today') return { from: isoDay(today), to: isoDay(today) };
  if (period === '7d') {
    const f = new Date(today);
    f.setDate(f.getDate() - 6);
    return { from: isoDay(f), to: isoDay(today) };
  }
  if (period === '30d') {
    const f = new Date(today);
    f.setDate(f.getDate() - 29);
    return { from: isoDay(f), to: isoDay(today) };
  }
  return { from: customFrom, to: customTo };
}

const PRESETS: { key: Period; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: '7d', label: 'Last 7 days' },
  { key: '30d', label: 'Last 30 days' },
  { key: 'custom', label: 'Custom' },
];

/** Keep only digits and strip a leading zero — lets a numeric field be cleared and
 *  retyped cleanly (no stuck "0", no "03"). Empty stays empty while typing. */
const digits = (v: string) => v.replace(/[^0-9]/g, '').replace(/^0+(?=\d)/, '');

/** One trunk's minute total tile in the fleet summary card. */
function TrunkTotalTile({
  label,
  tone,
  minutes,
  calls,
  days,
  loading,
}: {
  label: string;
  tone: 'telnyx' | 'tozcall' | 'untagged';
  minutes: number;
  calls: number;
  days: number;
  loading?: boolean;
}) {
  const toneCls =
    tone === 'telnyx'
      ? 'border-emerald-500/30 bg-emerald-500/5'
      : tone === 'tozcall'
        ? 'border-amber-500/30 bg-amber-500/5'
        : 'border-slate-300/50 bg-slate-500/5 dark:border-slate-700';
  const dot =
    tone === 'telnyx' ? 'bg-emerald-500' : tone === 'tozcall' ? 'bg-amber-500' : 'bg-slate-400';
  const avg = days > 0 ? Math.round(minutes / days) : 0;
  return (
    <div className={`rounded-xl border p-4 ${toneCls}`}>
      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        <span className={`h-2 w-2 rounded-full ${dot}`} />
        {label}
      </div>
      {loading ? (
        <div className="mt-2 h-8 w-24 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
      ) : (
        <>
          <div className="mt-1 text-2xl font-black tabular-nums text-slate-900 dark:text-white">
            {minutes.toLocaleString()}
            <span className="ml-1 text-sm font-semibold text-slate-400">min</span>
          </div>
          <div className="mt-0.5 text-xs tabular-nums text-slate-500 dark:text-slate-400">
            {calls.toLocaleString()} call{calls === 1 ? '' : 's'} · {avg.toLocaleString()} min/day avg
          </div>
        </>
      )}
    </div>
  );
}

function TrunkBadge({ trunk }: { trunk: Trunk }) {
  const telnyx = trunk === 'telnyx';
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-bold capitalize ${
        telnyx
          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
          : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
      }`}
    >
      {trunk}
    </span>
  );
}

export default function TrunkUsagePage() {
  const { user } = useAuthStore();
  const isSuperAdmin = user?.role === 'super_admin' || user?.role === 'superadmin';
  const qc = useQueryClient();

  // Numeric fields are string-backed so they can be cleared/retyped; coerced below.
  const [shortCutoff, setShortCutoff] = useState('60');
  const [flagOver, setFlagOver] = useState('100');
  const [flagBy, setFlagBy] = useState<'avgDay' | 'shortCalls'>('avgDay');
  const [flagShortOver, setFlagShortOver] = useState('50');
  const [flaggedOnly, setFlaggedOnly] = useState(false);
  const [search, setSearch] = useState('');
  const [period, setPeriod] = useState<Period>('7d');
  const [customFrom, setCustomFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 6);
    return isoDay(d);
  });
  const [customTo, setCustomTo] = useState(() => isoDay(new Date()));
  const [confirm, setConfirm] = useState<{ org: TrunkUsageRow; trunk: Trunk } | null>(null);

  // Coerced numerics (empty → sensible default; never NaN).
  const shortCutoffNum = Number(shortCutoff) > 0 ? Number(shortCutoff) : 60;
  const flagOverNum = Number(flagOver) || 0;
  const flagShortOverNum = Number(flagShortOver) || 0;

  const { from, to } = useMemo(
    () => periodRange(period, customFrom, customTo),
    [period, customFrom, customTo]
  );
  const rangeValid = !!from && !!to && from <= to;

  const query = useQuery({
    queryKey: ['admin', 'trunk-usage', from, to, shortCutoffNum],
    queryFn: () => adminAccountApi.getTrunkUsage({ from, to, shortCutoffSec: shortCutoffNum }),
    enabled: isSuperAdmin && rangeValid,
    staleTime: 15_000,
    refetchInterval: 30_000,
    refetchOnMount: 'always',
  });

  // Fleet per-trunk connected minutes over the SAME timeline (Telnyx mother+subs
  // vs Tozcall), sourced from the CDR accountcode trunk tag.
  const totalsQuery = useQuery({
    queryKey: ['admin', 'trunk-totals', from, to],
    queryFn: () => adminAccountApi.getTrunkTotals({ from, to }),
    enabled: isSuperAdmin && rangeValid,
    staleTime: 15_000,
    refetchInterval: 30_000,
    refetchOnMount: 'always',
  });

  const switchMut = useMutation({
    mutationFn: ({ orgId, trunk }: { orgId: number; trunk: Trunk }) =>
      adminAccountApi.switchOrgTrunk(orgId, trunk),
    onSuccess: (res) => {
      toast.success(
        `Switched org #${res.organizationId} to ${res.trunk} (${res.extensionsUpdated} extension${
          res.extensionsUpdated === 1 ? '' : 's'
        }${res.extensionsFailed ? `, ${res.extensionsFailed} failed` : ''})`
      );
      if (res.warning) toast.warning(res.warning);
      setConfirm(null);
      qc.invalidateQueries({ queryKey: ['admin', 'trunk-usage'] });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : 'Switch failed'),
  });

  const rows = query.data?.data ?? [];
  const days = query.data?.meta?.days ?? 1;
  // Flag either by avg minutes/day (heavy talkers) or by count of short calls
  // under the cutoff in the range (spam/robo-dialing). Both over the selected timeline.
  const isFlagged = (r: TrunkUsageRow) =>
    flagBy === 'shortCalls' ? r.shortCalls > flagShortOverNum : r.avgDailyMinutes > flagOverNum;
  const sorted = useMemo(
    () =>
      [...rows].sort((a, b) =>
        flagBy === 'shortCalls' ? b.shortCalls - a.shortCalls : b.avgDailyMinutes - a.avgDailyMinutes
      ),
    [rows, flagBy]
  );
  const displayRows = useMemo(() => {
    let list = flaggedOnly ? sorted.filter(isFlagged) : sorted;
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (r) => r.name.toLowerCase().includes(q) || String(r.organizationId).includes(q)
      );
    }
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sorted, flaggedOnly, flagBy, flagOverNum, flagShortOverNum, search]);
  const flaggedCount = useMemo(
    () => rows.filter(isFlagged).length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows, flagBy, flagOverNum, flagShortOverNum]
  );
  const onTozcall = useMemo(() => rows.filter((r) => r.egressTrunk === 'tozcall').length, [rows]);
  const activeOrgs = useMemo(
    () => rows.filter((r) => r.totalMinutes > 0 || r.unansweredCalls > 0).length,
    [rows]
  );

  if (!isSuperAdmin) {
    return (
      <section className="p-6">
        <ErrorState>Super-admin access required.</ErrorState>
      </section>
    );
  }

  return (
    <section className="space-y-5 p-1">
      <PageHead
        title="Trunk Usage"
        subtitle="Per-org outbound trunk + usage over a chosen timeline. Flag heavy orgs by avg/day and switch them to the Tozcall trunk."
        actions={
          <Btn variant="default" size="sm" onClick={() => query.refetch()}>
            Refresh
          </Btn>
        }
      />

      {/* Timeline — scopes the whole page (overview tiles + the org table) */}
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50/70 p-2.5 dark:border-slate-800 dark:bg-slate-900/40">
        <span className="px-1 text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Timeline
        </span>
        {PRESETS.map((p) => (
          <Btn key={p.key} size="sm" variant={period === p.key ? 'primary' : 'default'} onClick={() => setPeriod(p.key)}>
            {p.label}
          </Btn>
        ))}
        {period === 'custom' && (
          <div className="flex items-center gap-2">
            <input type="date" className={`${fieldInput} w-40`} value={customFrom} max={customTo} onChange={(e) => setCustomFrom(e.target.value)} />
            <span className="text-slate-400">→</span>
            <input type="date" className={`${fieldInput} w-40`} value={customTo} min={customFrom} max={isoDay(new Date())} onChange={(e) => setCustomTo(e.target.value)} />
          </div>
        )}
        <span className="ml-auto px-1 text-xs tabular-nums text-slate-500 dark:text-slate-400">
          {rangeValid ? `${from} → ${to} · ${days} day${days === 1 ? '' : 's'}` : 'pick a valid range'}
        </span>
      </div>

      {/* per-trunk minute totals over the timeline (from the CDR accountcode trunk tag) */}
      <Card>
        <div className="mb-3 flex items-start justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
              Outbound trunk minutes <span className="font-normal text-slate-400">· this timeline</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Connected talk minutes placed OUT each trunk — Telnyx (mother + all sub-accounts) vs
              Tozcall. Inbound is all Telnyx today and will be added as a separate column later.
            </p>
          </div>
          {totalsQuery.isFetching && (
            <span className="shrink-0 text-xs text-slate-400">updating…</span>
          )}
        </div>
        {totalsQuery.isError ? (
          <ErrorState>Couldn’t load trunk minutes.</ErrorState>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <TrunkTotalTile
              label="Telnyx (mother + subs)"
              tone="telnyx"
              minutes={totalsQuery.data?.telnyx.minutes ?? 0}
              calls={totalsQuery.data?.telnyx.calls ?? 0}
              days={totalsQuery.data?.days ?? 1}
              loading={totalsQuery.isLoading}
            />
            <TrunkTotalTile
              label="Tozcall"
              tone="tozcall"
              minutes={totalsQuery.data?.tozcall.minutes ?? 0}
              calls={totalsQuery.data?.tozcall.calls ?? 0}
              days={totalsQuery.data?.days ?? 1}
              loading={totalsQuery.isLoading}
            />
            <TrunkTotalTile
              label="Untagged"
              tone="untagged"
              minutes={totalsQuery.data?.untagged.minutes ?? 0}
              calls={totalsQuery.data?.untagged.calls ?? 0}
              days={totalsQuery.data?.days ?? 1}
              loading={totalsQuery.isLoading}
            />
          </div>
        )}
        <p className="mt-3 text-[11px] leading-relaxed text-slate-400">
          Source: our switch CDR (ops truth) — answered talk time, outbound only. Telnyx combines the
          mother account and every sub-account. “Untagged” = other trunks (e.g. the UK DIDLogic trunk)
          or calls placed before trunk-tagging shipped. Auto-refreshes every 30s.
        </p>
      </Card>

      {/* Fleet counts for the selected range */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card><Metric label="Active orgs (range)" value={activeOrgs} /></Card>
        <Card><Metric label="On Telnyx" value={rows.length - onTozcall} subTone="ok" /></Card>
        <Card><Metric label="On Tozcall" value={onTozcall} subTone="warn" /></Card>
        <Card><Metric label="Flagged" value={flaggedCount} subTone={flaggedCount ? 'bad' : 'ok'} sub={flagBy === 'shortCalls' ? `> ${flagShortOverNum} calls < ${shortCutoffNum}s` : `avg > ${flagOverNum} min/day`} /></Card>
      </div>

      {/* Organizations — per-org detail, its flag controls, and the table */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
          Organizations{' '}
          <span className="font-normal text-slate-400">
            · {displayRows.length}
            {flaggedOnly ? ' flagged' : ''}
          </span>
        </h3>
        <input
          type="search"
          aria-label="Search organizations"
          placeholder="Search organization…"
          className={`${fieldInput} w-full sm:w-64`}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* flag controls (table toolbar) */}
      <Card className="flex flex-wrap items-end gap-4">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Flag by</span>
          <div className="flex gap-2">
            <Btn size="sm" variant={flagBy === 'avgDay' ? 'primary' : 'default'} onClick={() => setFlagBy('avgDay')}>Avg min/day</Btn>
            <Btn size="sm" variant={flagBy === 'shortCalls' ? 'primary' : 'default'} onClick={() => setFlagBy('shortCalls')}>Short calls</Btn>
          </div>
        </label>
        {flagBy === 'avgDay' ? (
          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Flag orgs over (avg min/day)</span>
            <input
              type="text"
              inputMode="numeric"
              className={`${fieldInput} w-40`}
              value={flagOver}
              onChange={(e) => setFlagOver(digits(e.target.value))}
            />
          </label>
        ) : (
          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Flag orgs with over (# short calls)</span>
            <input
              type="text"
              inputMode="numeric"
              className={`${fieldInput} w-40`}
              value={flagShortOver}
              onChange={(e) => setFlagShortOver(digits(e.target.value))}
            />
          </label>
        )}
        <label className="flex flex-col gap-1">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Short call under (sec)</span>
          <input
            type="text"
            inputMode="numeric"
            className={`${fieldInput} w-36`}
            value={shortCutoff}
            onChange={(e) => setShortCutoff(digits(e.target.value))}
          />
        </label>
        <label className="flex cursor-pointer items-center gap-2 pb-2.5 text-xs font-semibold text-slate-600 dark:text-slate-300">
          <input type="checkbox" checked={flaggedOnly} onChange={(e) => setFlaggedOnly(e.target.checked)} />
          Show flagged only
        </label>
        <p className="ml-auto max-w-xs text-xs text-slate-500 dark:text-slate-400">
          {flagBy === 'shortCalls'
            ? `Flagging orgs with more than ${flagShortOverNum} calls under ${shortCutoffNum}s in the range (spam/robo-dialing).`
            : 'Flagging orgs by avg talk minutes/day over the range.'}{' '}
          Auto-refreshes every 30s.
        </p>
      </Card>

      {/* table */}
      <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
        <table className="w-full border-collapse text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-900 dark:text-slate-400">
            <tr>
              <th className="px-4 py-3 font-bold">Organization</th>
              <th className="px-4 py-3 font-bold">Trunk</th>
              <th className="px-4 py-3 font-bold">Avg/day</th>
              <th className="px-4 py-3 font-bold">Total (range)</th>
              <th className="px-4 py-3 font-bold">Long (≥{shortCutoffNum}s)</th>
              <th className="px-4 py-3 font-bold">Short (&lt;{shortCutoffNum}s)</th>
              <th className="px-4 py-3 font-bold">Unanswered</th>
              <th className="px-4 py-3 font-bold">Status</th>
              <th className="px-4 py-3 font-bold text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
            {query.isLoading ? (
              Array.from({ length: 8 }).map((_, i) => <RowSkeleton key={i} cols={9} />)
            ) : query.isError ? (
              <tr><td colSpan={9} className="px-4 py-10"><ErrorState>Could not load trunk usage.</ErrorState></td></tr>
            ) : displayRows.length === 0 ? (
              <tr><td colSpan={9} className="px-4 py-10"><EmptyState title={flaggedOnly ? 'No flagged orgs' : 'No organizations'} subtitle={flaggedOnly ? 'No org crosses the flag threshold for this range.' : 'Nothing to show for this range.'} /></td></tr>
            ) : (
              displayRows.map((r) => {
                const flagged = isFlagged(r);
                return (
                  <tr
                    key={r.organizationId}
                    className={flagged ? 'bg-red-50/70 dark:bg-red-950/20' : 'hover:bg-slate-50 dark:hover:bg-slate-900/40'}
                  >
                    <td className="px-4 py-3">
                      <div className="font-extrabold">{r.name || `Org #${r.organizationId}`}</div>
                      <div className="font-mono text-xs text-slate-400">#{r.organizationId}</div>
                    </td>
                    <td className="px-4 py-3"><TrunkBadge trunk={r.egressTrunk} /></td>
                    <td className={`px-4 py-3 font-black tabular-nums ${flagged && flagBy === 'avgDay' ? 'text-red-600 dark:text-red-400' : ''}`}>{r.avgDailyMinutes} min</td>
                    <td className="px-4 py-3 tabular-nums text-slate-600 dark:text-slate-300">{r.totalMinutes} min</td>
                    <td className="px-4 py-3 tabular-nums text-slate-600 dark:text-slate-300">{r.longCalls} · {r.longMinutes}m</td>
                    <td className={`px-4 py-3 tabular-nums ${flagged && flagBy === 'shortCalls' ? 'font-black text-red-600 dark:text-red-400' : 'text-slate-600 dark:text-slate-300'}`}>{r.shortCalls} · {r.shortMinutes}m</td>
                    <td className="px-4 py-3 tabular-nums text-slate-400">{r.unansweredCalls}</td>
                    <td className="px-4 py-3">
                      {flagged ? <StatusDot health="bad" label="Over limit" /> : <StatusDot health="ok" label="OK" />}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {r.egressTrunk === 'telnyx' ? (
                        <Btn variant="danger" size="sm" onClick={() => setConfirm({ org: r, trunk: 'tozcall' })}>
                          Switch to Tozcall
                        </Btn>
                      ) : (
                        <Btn variant="default" size="sm" onClick={() => setConfirm({ org: r, trunk: 'telnyx' })}>
                          Switch back to Telnyx
                        </Btn>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {confirm && (
        <Modal
          title={`Switch ${confirm.org.name || `Org #${confirm.org.organizationId}`} to ${confirm.trunk}`}
          subtitle="Applies to the next call — never mid-call."
          onClose={() => setConfirm(null)}
          footer={
            <>
              <Btn variant="default" onClick={() => setConfirm(null)}>Cancel</Btn>
              <Btn
                variant={confirm.trunk === 'tozcall' ? 'danger' : 'primary'}
                disabled={switchMut.isPending}
                onClick={() => switchMut.mutate({ orgId: confirm.org.organizationId, trunk: confirm.trunk })}
              >
                {switchMut.isPending ? 'Switching…' : `Confirm switch to ${confirm.trunk}`}
              </Btn>
            </>
          }
        >
          <div className="space-y-3 text-sm">
            <p>
              This flips outbound for all of <b>{confirm.org.name || `Org #${confirm.org.organizationId}`}</b>&apos;s
              extensions to the <b className="capitalize">{confirm.trunk}</b> trunk.
            </p>
            {confirm.trunk === 'tozcall' && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300">
                <b>Caller-ID warning:</b> Tozcall rejects Telnyx-owned numbers. If this org&apos;s
                caller IDs aren&apos;t Tozcall-authorized, their outbound will fail with a 403. Only
                switch orgs whose numbers are accepted on Tozcall.
              </div>
            )}
            <p className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              Selected range: <Pill>{confirm.org.avgDailyMinutes} min/day avg</Pill>
              <Pill>{confirm.org.totalMinutes} min total</Pill>
              <Pill>{confirm.org.longCalls} long</Pill>
              <Pill>{confirm.org.shortCalls} short</Pill>
            </p>
          </div>
        </Modal>
      )}
    </section>
  );
}
