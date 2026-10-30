'use client';

/**
 * Signup-order drawer — admin2 Orders. Super-admin lifecycle on one signup order,
 * wired to the existing endpoints via superadminApiService:
 *   • Authorize  — activate a pending_verification order (org + owner go live).
 *   • Reject     — release numbers, refund, email the applicant (reason required).
 *   • Retry      — re-attempt a failed/pending number purchase (the org-#124
 *                  recovery, now one click instead of a script).
 * Fetches fresh detail (incl. numbers) on open.
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { superadminApiService, type SignupOrder } from '@/lib/api/services/superadmin.service';
import { toast } from '@/lib/stores/toast';
import { Btn, StatusDot, type Health } from '../_components/ui';

interface OrderNumber {
  id: number;
  phoneNumber: string;
  countryCode: string;
  numberType: string;
  provisioningStatus: string;
}
type OrderDetail = SignupOrder & { numbers?: OrderNumber[] };

const STATUS_HEALTH: Record<string, Health> = {
  active: 'ok',
  paid: 'ok',
  pending_verification: 'warn',
  pending: 'warn',
  failed: 'bad',
  rejected: 'bad',
};
const NUM_HEALTH: Record<string, Health> = {
  active: 'ok',
  configured: 'ok',
  purchased: 'ok',
  pending: 'warn',
  failed: 'bad',
  released: 'off',
};

export function OrderDrawer({
  orderId,
  onClose,
  onChanged,
}: {
  orderId: number;
  onClose: () => void;
  onChanged: () => void;
}) {
  const qc = useQueryClient();
  const [mode, setMode] = useState<null | 'reject'>(null);
  const [reason, setReason] = useState('');
  const [retrying, setRetrying] = useState<number | null>(null);

  const q = useQuery({
    queryKey: ['admin2', 'order', orderId],
    queryFn: () => superadminApiService.getOrder(orderId),
    refetchOnMount: 'always',
  });
  const o = q.data?.data as OrderDetail | undefined;

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['admin2', 'order', orderId] });
    onChanged();
  };

  const authorize = useMutation({
    mutationFn: () => superadminApiService.authorizeOrder(orderId),
    onSuccess: (r) => {
      toast.success(r.message || 'Order authorized — org is live');
      refresh();
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : 'Could not authorize'),
  });
  const reject = useMutation({
    mutationFn: () => superadminApiService.rejectOrder(orderId, reason.trim()),
    onSuccess: (r) => {
      toast.success(r.message || 'Order rejected');
      setMode(null);
      setReason('');
      refresh();
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : 'Could not reject'),
  });
  const retry = useMutation({
    mutationFn: (numberId: number) => superadminApiService.retryNumberPurchase(orderId, numberId),
    onSuccess: (r) => {
      toast.success(r.message || 'Number purchase retried');
      setRetrying(null);
      refresh();
    },
    onError: (e: unknown) => {
      setRetrying(null);
      toast.error(e instanceof Error ? e.message : 'Retry failed');
    },
  });

  const busy = authorize.isPending || reject.isPending || retry.isPending;
  const terminal = o?.status === 'active' || o?.status === 'rejected';

  return (
    <div className="fixed inset-0 z-[60] bg-slate-950/40" onClick={onClose}>
      <aside
        className="absolute right-0 top-0 h-full w-full max-w-lg overflow-auto border-l border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-800 dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <div className="text-lg font-black">{o?.businessName ?? `Order #${orderId}`}</div>
            <div className="text-xs text-slate-500">{o?.contactEmail}</div>
          </div>
          <button type="button" onClick={onClose} className="grid h-8 w-8 place-items-center rounded-lg bg-slate-100 text-lg text-slate-500 hover:bg-slate-200 dark:bg-slate-800">×</button>
        </div>

        {q.isLoading ? (
          <div className="h-40 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
        ) : q.isError || !o ? (
          <p className="text-sm text-red-500">Could not load this order.</p>
        ) : (
          <>
            <dl className="space-y-2 rounded-xl border border-slate-200 p-4 text-sm dark:border-slate-800">
              <Row k="Status"><StatusDot health={STATUS_HEALTH[o.status] ?? 'off'} label={o.status.replace(/_/g, ' ')} /></Row>
              <Row k="Business type">{o.businessNature || '—'}</Row>
              <Row k="Contact">{o.contactName || '—'}{o.contactPhone ? ` · ${o.contactPhone}` : ''}</Row>
              <Row k="Payment">{o.paymentAmountCents ? `$${(o.paymentAmountCents / 100).toFixed(2)} ${(o.paymentCurrency || 'usd').toUpperCase()}` : '—'}{o.paymentMethod ? ` · ${o.paymentMethod}` : ''}{o.paidAt ? ' · paid' : ''}</Row>
              <Row k="Email verified"><StatusDot health={o.emailVerified ? 'ok' : 'warn'} label={o.emailVerified ? 'Verified' : 'Not verified'} /></Row>
              <Row k="Organization">{o.organizationId ? `org #${o.organizationId}` : <span className="text-slate-400">not created</span>}</Row>
              <Row k="Created">{new Date(o.createdAt).toLocaleString()}</Row>
            </dl>

            {/* Numbers + per-number retry */}
            <div className="mt-4">
              <div className="text-xs font-bold text-slate-500 dark:text-slate-400">Numbers</div>
              {(o.numbers ?? []).length === 0 ? (
                <p className="mt-1 text-xs text-slate-400">No numbers on this order.</p>
              ) : (
                <div className="mt-1 space-y-1.5">
                  {(o.numbers ?? []).map((n) => {
                    const canRetry = n.provisioningStatus === 'failed' || n.provisioningStatus === 'pending';
                    return (
                      <div key={n.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-800">
                        <span className="font-mono">{n.phoneNumber}</span>
                        <span className="flex items-center gap-2">
                          <StatusDot health={NUM_HEALTH[n.provisioningStatus] ?? 'off'} label={n.provisioningStatus.replace(/_/g, ' ')} />
                          {canRetry && (
                            <Btn size="sm" disabled={busy} onClick={() => { setRetrying(n.id); retry.mutate(n.id); }}>
                              {retrying === n.id && retry.isPending ? 'Retrying…' : 'Retry'}
                            </Btn>
                          )}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Lifecycle actions */}
            <div className="mt-5 border-t border-slate-200 pt-4 dark:border-slate-800">
              {terminal ? (
                <p className="text-xs text-slate-500">This order is {o.status}. No further action.</p>
              ) : mode === 'reject' ? (
                <div className="space-y-2">
                  <textarea
                    rows={3}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Reason for rejection (emailed to the applicant)…"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#FF6542] dark:border-slate-800 dark:bg-slate-950"
                  />
                  <div className="flex justify-end gap-2">
                    <Btn size="sm" onClick={() => setMode(null)} disabled={reject.isPending}>Cancel</Btn>
                    <Btn size="sm" variant="danger" disabled={reject.isPending || reason.trim().length < 3} onClick={() => reject.mutate()}>
                      {reject.isPending ? 'Rejecting…' : 'Confirm reject'}
                    </Btn>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {o.status === 'pending_verification' && (
                    <Btn variant="primary" disabled={busy} onClick={() => authorize.mutate()}>
                      {authorize.isPending ? 'Authorizing…' : 'Authorize (make live)'}
                    </Btn>
                  )}
                  <Btn variant="danger" disabled={busy} onClick={() => { setMode('reject'); setReason(''); }}>Reject</Btn>
                </div>
              )}
            </div>
          </>
        )}
      </aside>
    </div>
  );
}

function Row({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-slate-500 dark:text-slate-400">{k}</dt>
      <dd className="text-right font-semibold">{children}</dd>
    </div>
  );
}
