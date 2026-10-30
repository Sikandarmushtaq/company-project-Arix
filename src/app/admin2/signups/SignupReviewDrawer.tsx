'use client';

/**
 * Signup review drawer — inspect a self-serve signup (SMS-campaign or KYC
 * call-verification) and act on it: Approve · Request more info · Reject. Reuses
 * the deployed /admin/signup-reviews API. Read details + documents; decisions
 * write immediately and refresh the queue.
 */

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { superadminApiService, type SmsReview } from '@/lib/api/services/superadmin.service';
import { Btn, StatusDot, fieldInput } from '../_components/ui';

const STATUS_TONE: Record<SmsReview['status'], 'ok' | 'warn' | 'bad' | 'off'> = {
  pending: 'warn', in_review: 'warn', more_info_needed: 'warn', approved: 'ok', rejected: 'bad',
};

/** camelCase → "Spaced label" (postalCode → Postal code). */
function humanize(k: string): string {
  const s = k.replace(/([A-Z])/g, ' $1').replace(/[_-]/g, ' ').trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function Row({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-slate-100 py-2 text-sm last:border-0 dark:border-slate-800/60">
      <dt className="text-slate-500 dark:text-slate-400">{k}</dt>
      <dd className="text-right font-semibold break-words">{children}</dd>
    </div>
  );
}

export function SignupReviewDrawer({ review, onClose, onDone }: { review: SmsReview; onClose: () => void; onDone: () => void }) {
  const [mode, setMode] = useState<'approve' | 'info' | 'reject' | null>(null);
  const [text, setText] = useState('');

  const act = useMutation({
    mutationFn: async () => {
      if (mode === 'approve') return superadminApiService.approveSmsReview(review.id, text.trim() || undefined);
      if (mode === 'info') return superadminApiService.requestMoreInfo(review.id, text.trim());
      if (mode === 'reject') return superadminApiService.rejectSmsReview(review.id, text.trim());
      return;
    },
    onSuccess: () => onDone(),
  });

  const dash = <span className="text-slate-400">—</span>;
  const canSubmit = mode === 'approve' || ((mode === 'info' || mode === 'reject') && text.trim().length > 2);

  return (
    <div className="fixed inset-0 z-[60] bg-slate-950/40" onClick={onClose}>
      <aside className="absolute right-0 top-0 h-full w-full max-w-lg overflow-auto border-l border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-800 dark:bg-slate-900" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between">
          <div>
            <div className="text-lg font-black">{review.businessName || review.legalCompanyName}</div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              <span className="rounded-full bg-slate-500/10 px-2 py-0.5 font-bold">{review.reviewType === 'call_verification' ? 'KYC / call verification' : 'SMS campaign'}</span>
              <span className="ml-2">order #{review.orderId}</span>
            </div>
          </div>
          <button type="button" onClick={onClose} className="grid h-8 w-8 place-items-center rounded-lg bg-slate-100 text-lg text-slate-500 hover:bg-slate-200 dark:bg-slate-800">×</button>
        </div>

        <div className="mb-3 flex flex-wrap items-center gap-2">
          <StatusDot health={STATUS_TONE[review.status]} label={review.status.replace(/_/g, ' ')} />
          {review.orderStatus && <span className="rounded-full bg-slate-500/10 px-2 py-0.5 text-xs font-bold text-slate-500">order: {review.orderStatus}</span>}
          <span className="text-xs text-slate-400">submitted {new Date(review.createdAt).toLocaleString()}</span>
        </div>

        <dl className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
          <Row k="Legal name">{review.legalCompanyName || dash}</Row>
          <Row k="Business name">{review.businessName || dash}</Row>
          <Row k="Contact">{review.contactName}{review.contactEmail ? <div className="font-normal text-slate-500">{review.contactEmail}</div> : null}</Row>
          <Row k="Reg. number">{review.companyRegistrationNumber || dash}</Row>
          <Row k="Address">{review.companyAddress || dash}</Row>
          <Row k="Country">{review.companyCountry || dash}</Row>
          {review.reviewerNotes && <Row k="Reviewer notes">{review.reviewerNotes}</Row>}
          {review.rejectionReason && <Row k="Rejection reason"><span className="text-red-600 dark:text-red-400">{review.rejectionReason}</span></Row>}
        </dl>

        {/* KYC business details — the rich fields the applicant submitted, in payload */}
        {review.payload && (review.payload.registrationType || review.payload.brand) && (
          <div className="mt-4">
            <div className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-400">Business details (KYC)</div>
            <dl className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
              {review.payload.registrationType && <Row k="Registration type">{humanize(review.payload.registrationType)}</Row>}
              {review.payload.brand &&
                Object.entries(review.payload.brand)
                  .filter(([k, v]) => v && k !== 'legalCompanyName')
                  .map(([k, v]) => (
                    <Row key={k} k={humanize(k)}>
                      {k === 'website' ? (
                        <a href={v} target="_blank" rel="noreferrer" className="text-[#FF6542] underline">{v}</a>
                      ) : (
                        v
                      )}
                    </Row>
                  ))}
            </dl>
          </div>
        )}

        {review.documents?.length > 0 && (
          <div className="mt-4">
            <div className="text-xs font-bold text-slate-500 dark:text-slate-400">Documents ({review.documents.length})</div>
            <ul className="mt-1.5 space-y-1">
              {review.documents.map((d) => (
                <li key={d.key} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-1.5 text-xs dark:border-slate-800">
                  <span className="truncate font-semibold">{d.name}</span>
                  <span className="text-slate-400">{d.type} · {Math.round(d.size / 1024)}KB</span>
                </li>
              ))}
            </ul>
            <p className="mt-1 text-[11px] text-slate-400">Document download is available in the legacy admin.</p>
          </div>
        )}

        {/* Decision */}
        {review.status === 'approved' || review.status === 'rejected' ? (
          <div className="mt-5 rounded-xl bg-slate-50 p-3 text-sm text-slate-500 dark:bg-slate-800/40 dark:text-slate-400">
            This review is {review.status}. No further action needed.
          </div>
        ) : (
          <div className="mt-5 border-t border-slate-200 pt-4 dark:border-slate-800">
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => { setMode('approve'); setText(''); }} className={`rounded-lg px-3 py-1.5 text-xs font-bold ${mode === 'approve' ? 'bg-emerald-600 text-white' : 'border border-slate-200 dark:border-slate-700'}`}>Approve</button>
              <button type="button" onClick={() => { setMode('info'); setText(''); }} className={`rounded-lg px-3 py-1.5 text-xs font-bold ${mode === 'info' ? 'bg-amber-500 text-white' : 'border border-slate-200 dark:border-slate-700'}`}>Request info</button>
              <button type="button" onClick={() => { setMode('reject'); setText(''); }} className={`rounded-lg px-3 py-1.5 text-xs font-bold ${mode === 'reject' ? 'bg-red-600 text-white' : 'border border-slate-200 dark:border-slate-700'}`}>Reject</button>
            </div>
            {mode && (
              <div className="mt-3">
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  rows={3}
                  placeholder={mode === 'approve' ? 'Optional approval note…' : mode === 'info' ? 'What additional info is needed? (sent to the applicant)' : 'Reason for rejection (sent to the applicant)'}
                  className={`${fieldInput} resize-none`}
                />
                {act.isError && <p className="mt-1 text-xs font-semibold text-red-600">{(act.error as Error)?.message || 'Action failed.'}</p>}
                <div className="mt-2 flex justify-end gap-2">
                  <Btn size="sm" disabled={act.isPending} onClick={() => setMode(null)}>Cancel</Btn>
                  <Btn
                    size="sm"
                    variant="primary"
                    disabled={!canSubmit || act.isPending}
                    onClick={() => act.mutate()}
                  >
                    {act.isPending ? 'Submitting…' : mode === 'approve' ? 'Confirm approve' : mode === 'info' ? 'Send request' : 'Confirm reject'}
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
