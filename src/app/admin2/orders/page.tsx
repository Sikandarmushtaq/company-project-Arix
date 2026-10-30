'use client';

/**
 * Signups / Orders — admin2. Super-admin view of signup ORDERS (distinct from the
 * SMS-review queue under "Signups"): authorize a pending order, reject it, and
 * retry a failed/pending number purchase — the org-#124 recovery from the UI.
 * Wired to superadminApiService.getOrders + the OrderDrawer.
 */

import { useState } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { superadminApiService, type SignupOrder } from '@/lib/api/services/superadmin.service';
import { PageHead, Card, StatusDot, type Health } from '../_components/ui';
import { OrderDrawer } from './OrderDrawer';

const FILTERS = [
  { key: 'pending_verification', label: 'Needs review' },
  { key: 'failed', label: 'Failed' },
  { key: 'active', label: 'Active' },
  { key: 'rejected', label: 'Rejected' },
  { key: '', label: 'All' },
];
const STATUS_HEALTH: Record<string, Health> = {
  active: 'ok',
  paid: 'ok',
  pending_verification: 'warn',
  pending: 'warn',
  failed: 'bad',
  rejected: 'bad',
};
const LIMIT = 20;

export default function OrdersPage() {
  const [status, setStatus] = useState('pending_verification');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<number | null>(null);

  const q = useQuery({
    queryKey: ['admin2', 'orders', status, page],
    queryFn: () => superadminApiService.getOrders({ status: status || undefined, page, limit: LIMIT }),
    placeholderData: keepPreviousData,
    staleTime: 15_000,
  });
  const orders: SignupOrder[] = q.data?.data ?? [];
  const totalPages = q.data?.meta?.totalPages ?? 1;

  return (
    <section>
      <PageHead
        title="Orders"
        subtitle="Signup orders — authorize a pending order, reject it, or retry a failed number purchase."
      />

      <div className="mb-4 flex flex-wrap gap-1">
        {FILTERS.map((f) => (
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

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-950/70 dark:text-slate-400">
              <tr>
                <th className="px-4 py-3">Business</th>
                <th className="px-4 py-3">Payment</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {q.isLoading ? (
                [0, 1, 2].map((i) => (
                  <tr key={i} className="animate-pulse">{[0, 1, 2, 3].map((j) => (<td key={j} className="px-4 py-4"><div className="h-4 rounded bg-slate-200 dark:bg-slate-800" /></td>))}</tr>
                ))
              ) : orders.length === 0 ? (
                <tr><td colSpan={4} className="px-4 py-10 text-center text-sm text-slate-400">No {FILTERS.find((f) => f.key === status)?.label.toLowerCase() ?? ''} orders.</td></tr>
              ) : (
                orders.map((o) => (
                  <tr key={o.id} className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50" onClick={() => setSelected(o.id)}>
                    <td className="px-4 py-4">
                      <div className="font-extrabold">{o.businessName || '—'}</div>
                      <div className="mt-0.5 text-xs text-slate-500">{o.contactEmail}</div>
                    </td>
                    <td className="px-4 py-4">{o.paymentAmountCents ? `$${(o.paymentAmountCents / 100).toFixed(0)}` : '—'}</td>
                    <td className="px-4 py-4"><StatusDot health={STATUS_HEALTH[o.status] ?? 'off'} label={o.status.replace(/_/g, ' ')} /></td>
                    <td className="px-4 py-4 text-xs text-slate-500">{new Date(o.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {totalPages > 1 && (
        <div className="mt-3 flex items-center justify-end gap-2 text-sm">
          <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded-lg border border-slate-200 px-3 py-1.5 font-bold disabled:opacity-40 dark:border-slate-700">Prev</button>
          <span className="text-slate-500">Page {page} / {totalPages}</span>
          <button type="button" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="rounded-lg border border-slate-200 px-3 py-1.5 font-bold disabled:opacity-40 dark:border-slate-700">Next</button>
        </div>
      )}

      {selected !== null && (
        <OrderDrawer orderId={selected} onClose={() => setSelected(null)} onChanged={() => q.refetch()} />
      )}
    </section>
  );
}
