'use client';

/**
 * Purchase Requests — the super-admin approval queue for card-less (bank
 * transfer) add-on buys: an org owner with no Stripe card uploads a payment
 * screenshot to buy a phone number or an SMS package, and it lands here for
 * review. Approving provisions the add-on immediately. Card (Stripe) buys never
 * touch this queue — they activate on their own. Reuses the deployed
 * /admin/addon-requests API (server-side paginated: page / limit / total).
 */

import { useEffect, useState } from 'react';
import { useQuery, keepPreviousData, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/lib/stores/auth';
import { useSocket } from '@/lib/providers/SocketProvider';
import { REALTIME_EVENTS } from '@/lib/constants/events';
import { addonApiService, type AddonPurchaseRequest } from '@/lib/api/services/addon.service';
import { formatCents } from '@/lib/utils/formatting';
import { PageHead, Card, Metric, StatusDot, Pill, type Health } from '../_components/ui';
import { PurchaseReviewDrawer, addonLabel } from './PurchaseReviewDrawer';

const LIMIT = 20;

const FILTERS = [
  { key: 'pending', label: 'Pending' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'failed', label: 'Failed' },
  { key: '', label: 'All' },
] as const;

const STATUS_TONE: Record<string, Health> = {
  pending: 'warn', approved: 'ok', rejected: 'off', failed: 'bad',
};

export default function PurchasesPage() {
  const { user } = useAuthStore();
  const isAdmin =
    user?.role === 'super_admin' || user?.role === 'superadmin' || user?.role === 'admin';

  const [status, setStatus] = useState<string>('pending');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<AddonPurchaseRequest | null>(null);

  // Push-live: refetch the queue + pending count the instant a request is
  // created or decided (backend emits admin:purchase:request). No polling.
  const qc = useQueryClient();
  const { socket } = useSocket();
  useEffect(() => {
    if (!isAdmin || !socket) return;
    const onPurchase = () => {
      qc.invalidateQueries({ queryKey: ['admin2', 'addon-requests'] });
      qc.invalidateQueries({ queryKey: ['admin2', 'addon-pending-count'] });
    };
    socket.on(REALTIME_EVENTS.ADMIN_PURCHASE_REQUEST, onPurchase);
    return () => { socket.off(REALTIME_EVENTS.ADMIN_PURCHASE_REQUEST, onPurchase); };
  }, [isAdmin, socket, qc]);

  const pendingQ = useQuery({
    queryKey: ['admin2', 'addon-pending-count'],
    queryFn: () => addonApiService.adminPendingCount(),
    enabled: isAdmin,
    staleTime: 15_000,
    // Realtime-driven data: the global default is refetchOnMount:false, which
    // would show a stale cached list when you navigate in from the dashboard
    // after a new request arrived. Always refetch on mount so the page opens
    // in sync; the WS subscription keeps it live while open.
    refetchOnMount: 'always',
  });
  const listQ = useQuery({
    queryKey: ['admin2', 'addon-requests', status, page],
    queryFn: () => addonApiService.adminList({ status: status || undefined, page, limit: LIMIT }),
    enabled: isAdmin,
    staleTime: 10_000,
    placeholderData: keepPreviousData,
    refetchOnMount: 'always',
  });

  const rows = listQ.data?.data ?? [];
  const meta = listQ.data?.meta;
  const totalPages = meta?.totalPages ?? 1;
  const pending = pendingQ.data?.data?.count ?? 0;

  const refresh = () => { listQ.refetch(); pendingQ.refetch(); };

  if (!isAdmin) {
    return (
      <section>
        <h1 className="text-3xl font-black tracking-tight">Purchase Requests</h1>
        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900">
          Purchase review is available to platform admins.
        </div>
      </section>
    );
  }

  const filterLabel = FILTERS.find((f) => f.key === status)?.label.toLowerCase();

  return (
    <section>
      <PageHead
        title="Purchase Requests"
        subtitle="Card-less add-on buys — an org uploads a bank-transfer payment screenshot to buy a number or SMS package. Approving provisions it immediately."
      />

      {/* Two honest headline numbers: the global pending count, and how many
          rows match the current filter (both from the API, not the page). */}
      <div className="mb-4 grid max-w-md gap-4 sm:grid-cols-2">
        <Metric label="Pending approval" value={pendingQ.isLoading ? '—' : pending} sub={pending > 0 ? 'awaiting review' : 'all clear'} subTone={pending > 0 ? 'warn' : 'ok'} />
        <Metric label={`In "${filterLabel}"`} value={meta ? meta.total : '—'} sub="matching requests" subTone="off" />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex rounded-xl border border-slate-200 p-1 dark:border-slate-800">
          {FILTERS.map((f) => (
            <button key={f.key} type="button" onClick={() => { setStatus(f.key); setPage(1); }} className={`rounded-lg px-3 py-1.5 text-xs font-bold ${status === f.key ? 'bg-[#FF6542] text-white' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}>{f.label}</button>
          ))}
        </div>
        {listQ.isFetching && !listQ.isLoading && <span className="text-xs font-semibold text-slate-400">Updating…</span>}
      </div>

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-950/70 dark:text-slate-400">
              <tr>
                <th className="px-4 py-3">Organization</th>
                <th className="px-4 py-3">Add-on</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3">Proof</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Submitted</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {listQ.isLoading ? (
                [0, 1, 2, 3].map((i) => <tr key={i} className="animate-pulse">{[0, 1, 2, 3, 4, 5].map((j) => <td key={j} className="px-4 py-4"><div className="h-4 rounded bg-slate-200 dark:bg-slate-800" /></td>)}</tr>)
              ) : listQ.isError ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-red-600">Could not load purchase requests.</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-10 text-center text-sm text-slate-400">No {filterLabel} requests.</td></tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id} onClick={() => setSelected(r)} className="cursor-pointer hover:bg-[#FF6542]/5">
                    <td className="px-4 py-4">
                      <div className="font-extrabold">{r.organizationName || `Org ${r.organizationId}`}</div>
                      {r.requestedByName && <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">by {r.requestedByName}</div>}
                    </td>
                    <td className="px-4 py-4">
                      <Pill tone={r.addonType === 'number' ? 'coral' : 'neutral'}>{r.addonType === 'number' ? 'Number' : 'SMS'}</Pill>
                      <div className="mt-1 text-xs font-semibold">{addonLabel(r)}</div>
                    </td>
                    <td className="px-4 py-4 text-right font-mono tabular-nums">{formatCents(r.amountCents)}</td>
                    <td className="px-4 py-4">{r.proofUrl ? <span className="text-xs font-bold text-[#FF6542]">screenshot</span> : <span className="text-xs text-slate-400">—</span>}</td>
                    <td className="px-4 py-4"><StatusDot health={STATUS_TONE[r.status] ?? 'off'} label={r.status} /></td>
                    <td className="px-4 py-4 text-slate-500 dark:text-slate-400">{new Date(r.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 text-sm dark:border-slate-800">
            <span className="text-slate-500 dark:text-slate-400">Page {page} of {totalPages}</span>
            <div className="flex gap-2">
              <button type="button" disabled={page <= 1 || listQ.isFetching} onClick={() => setPage((p) => Math.max(1, p - 1))} className="rounded-xl border border-slate-200 px-3 py-2 font-bold disabled:opacity-40 dark:border-slate-700">← Prev</button>
              <button type="button" disabled={page >= totalPages || listQ.isFetching} onClick={() => setPage((p) => Math.min(totalPages, p + 1))} className="rounded-xl border border-slate-200 px-3 py-2 font-bold disabled:opacity-40 dark:border-slate-700">Next →</button>
            </div>
          </div>
        )}
      </Card>

      {selected && <PurchaseReviewDrawer request={selected} onClose={() => setSelected(null)} onDone={() => { setSelected(null); refresh(); }} />}
    </section>
  );
}
