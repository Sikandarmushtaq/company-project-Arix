'use client';

/**
 * Purchase review drawer — inspect a card-less add-on request: the org, who
 * requested it, what they're buying, the amount, and the uploaded bank-transfer
 * payment screenshot. Act on it: Approve (provisions the add-on immediately) or
 * Reject (nothing is provisioned; the customer can resubmit). Reuses the
 * deployed /admin/addon-requests API.
 */

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { addonApiService, type AddonPurchaseRequest } from '@/lib/api/services/addon.service';
import { formatCents } from '@/lib/utils/formatting';
import { formatPhoneUS } from '@/lib/utils/phone';
import { Btn, StatusDot, fieldInput, type Health } from '../_components/ui';

const STATUS_TONE: Record<string, Health> = {
  pending: 'warn', approved: 'ok', rejected: 'off', failed: 'bad',
};

/** Human label for an add-on row (phone number or SMS package). */
export function addonLabel(r: AddonPurchaseRequest): string {
  if (r.addonType === 'number') return r.phoneNumber ? formatPhoneUS(r.phoneNumber) : 'Phone number';
  if (r.bundleSlug) return `${r.bundleSlug.replace(/sms/i, '').toUpperCase()} SMS package`;
  return 'SMS package';
}

function Row({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-slate-100 py-2 text-sm last:border-0 dark:border-slate-800/60">
      <dt className="text-slate-500 dark:text-slate-400">{k}</dt>
      <dd className="text-right font-semibold break-words">{children}</dd>
    </div>
  );
}

export function PurchaseReviewDrawer({ request: r, onClose, onDone }: { request: AddonPurchaseRequest; onClose: () => void; onDone: () => void }) {
  const [mode, setMode] = useState<'approve' | 'reject' | null>(null);
  const [notes, setNotes] = useState('');

  const act = useMutation({
    mutationFn: async () => {
      if (mode === 'approve') return addonApiService.adminApprove(r.id);
      if (mode === 'reject') return addonApiService.adminReject(r.id, notes.trim() || undefined);
      return;
    },
    onSuccess: () => onDone(),
  });

  const dash = <span className="text-slate-400">—</span>;
  const canSubmit = mode === 'approve' || (mode === 'reject' && notes.trim().length > 2);
  const isOpen = r.status === 'pending';

  return (
    <div className="fixed inset-0 z-[60] bg-slate-950/40" onClick={onClose}>
      <aside className="absolute right-0 top-0 h-full w-full max-w-lg overflow-auto border-l border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-800 dark:bg-slate-900" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between">
          <div>
            <div className="text-lg font-black">{r.organizationName || `Org ${r.organizationId}`}</div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              <span className="rounded-full bg-slate-500/10 px-2 py-0.5 font-bold">{r.addonType === 'number' ? 'Phone number' : 'SMS package'}</span>
              <span className="ml-2">request #{r.id}</span>
            </div>
          </div>
          <button type="button" onClick={onClose} className="grid h-8 w-8 place-items-center rounded-lg bg-slate-100 text-lg text-slate-500 hover:bg-slate-200 dark:bg-slate-800">×</button>
        </div>

        <div className="mb-3 flex flex-wrap items-center gap-2">
          <StatusDot health={STATUS_TONE[r.status] ?? 'off'} label={r.status} />
          <span className="rounded-full bg-slate-500/10 px-2 py-0.5 text-xs font-bold text-slate-500">bank transfer</span>
          <span className="text-xs text-slate-400">submitted {new Date(r.createdAt).toLocaleString()}</span>
        </div>

        <dl className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
          <Row k="Add-on">{addonLabel(r)}</Row>
          <Row k="Amount">{formatCents(r.amountCents)} <span className="font-normal text-slate-500">{r.currency?.toUpperCase()}</span></Row>
          {r.addonType === 'number' && <Row k="Number type">{r.numberType || dash}</Row>}
          {r.addonType === 'number' && r.countryCode && <Row k="Country">{r.countryCode}</Row>}
          <Row k="Requested by">{r.requestedByName || (r.requestedBy ? `User ${r.requestedBy}` : dash)}</Row>
          {r.reviewedAt && <Row k="Reviewed">{new Date(r.reviewedAt).toLocaleString()}</Row>}
          {r.reviewNotes && <Row k="Review notes">{r.reviewNotes}</Row>}
          {r.status === 'failed' && r.errorMessage && <Row k="Error"><span className="text-red-600 dark:text-red-400">{r.errorMessage}</span></Row>}
        </dl>

        {/* Payment proof — the uploaded bank-transfer screenshot */}
        <div className="mt-4">
          <div className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-400">Payment proof</div>
          {r.proofUrl ? (
            <a href={r.proofUrl} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={r.proofUrl} alt="Bank transfer payment screenshot" className="max-h-80 w-full bg-slate-50 object-contain dark:bg-slate-950" />
              <div className="border-t border-slate-200 px-3 py-2 text-xs font-bold text-[#FF6542] dark:border-slate-800">Open full size ↗</div>
            </a>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-950/40">No screenshot was attached.</div>
          )}
        </div>

        {/* Decision */}
        {!isOpen ? (
          <div className="mt-5 rounded-xl bg-slate-50 p-3 text-sm text-slate-500 dark:bg-slate-800/40 dark:text-slate-400">
            This request is {r.status}. No further action needed.
          </div>
        ) : (
          <div className="mt-5 border-t border-slate-200 pt-4 dark:border-slate-800">
            <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
              Approve only after confirming the <span className="font-bold">{formatCents(r.amountCents)}</span> bank transfer has landed. Approving provisions {addonLabel(r)} immediately.
            </p>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => { setMode('approve'); setNotes(''); }} className={`rounded-lg px-3 py-1.5 text-xs font-bold ${mode === 'approve' ? 'bg-emerald-600 text-white' : 'border border-slate-200 dark:border-slate-700'}`}>Approve &amp; provision</button>
              <button type="button" onClick={() => { setMode('reject'); setNotes(''); }} className={`rounded-lg px-3 py-1.5 text-xs font-bold ${mode === 'reject' ? 'bg-red-600 text-white' : 'border border-slate-200 dark:border-slate-700'}`}>Reject</button>
            </div>
            {mode && (
              <div className="mt-3">
                {mode === 'reject' && (
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                    maxLength={500}
                    placeholder="Reason for rejection (saved to the record) — e.g. payment not received, wrong amount…"
                    className={`${fieldInput} resize-none`}
                  />
                )}
                {act.isError && <p className="mt-1 text-xs font-semibold text-red-600">{(act.error as Error)?.message || 'Action failed.'}</p>}
                <div className="mt-2 flex justify-end gap-2">
                  <Btn size="sm" disabled={act.isPending} onClick={() => setMode(null)}>Cancel</Btn>
                  <Btn
                    size="sm"
                    variant="primary"
                    disabled={!canSubmit || act.isPending}
                    onClick={() => act.mutate()}
                  >
                    {act.isPending ? 'Submitting…' : mode === 'approve' ? 'Confirm approve' : 'Confirm reject'}
                  </Btn>
                </div>
              </div>
            )}
          </div>
        )}
      </aside>
    </div>
  );
}
