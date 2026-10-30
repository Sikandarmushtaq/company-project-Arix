'use client';

/**
 * Signups — self-serve signup review queue (SMS-campaign + KYC/call-verification).
 * This is where INCOMING self-serve signups land for review/approval, distinct
 * from Onboarding (admin-created accounts). Reuses the deployed
 * /admin/signup-reviews API: queue + stats + approve/request-info/reject.
 */

import { useEffect, useState } from 'react';
import { useQuery, keepPreviousData, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/lib/stores/auth';
import { useSocket } from '@/lib/providers/SocketProvider';
import { REALTIME_EVENTS } from '@/lib/constants/events';
import { superadminApiService, type SmsReview } from '@/lib/api/services/superadmin.service';
import { PageHead, Card, Metric, StatusDot } from '../_components/ui';
import { SignupReviewDrawer } from './SignupReviewDrawer';

const LIMIT = 20;

const FILTERS = [
  { key: 'pending', label: 'Pending' },
  { key: 'more_info_needed', label: 'Awaiting info' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
  { key: '', label: 'All' },
] as const;

const STATUS_TONE: Record<string, 'ok' | 'warn' | 'bad' | 'off'> = {
  pending: 'warn', in_review: 'warn', more_info_needed: 'warn', approved: 'ok', rejected: 'bad',
};

export default function SignupsPage() {
  const { user } = useAuthStore();
  const isSuperAdmin = user?.role === 'super_admin' || user?.role === 'superadmin';

  const [status, setStatus] = useState<string>('pending');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<SmsReview | null>(null);

  // Push-live: refetch the queue + stats when a review is created/decided
  // (backend emits signup:sms_review:updated). No polling.
  const qc = useQueryClient();
  const { socket } = useSocket();
  useEffect(() => {
    if (!isSuperAdmin || !socket) return;
    const onReview = () => {
      qc.invalidateQueries({ queryKey: ['admin2', 'signup-reviews'] });
      qc.invalidateQueries({ queryKey: ['admin2', 'signup-stats'] });
    };
    socket.on(REALTIME_EVENTS.SIGNUP_SMS_REVIEW_UPDATED, onReview);
    return () => { socket.off(REALTIME_EVENTS.SIGNUP_SMS_REVIEW_UPDATED, onReview); };
  }, [isSuperAdmin, socket, qc]);

  const statsQ = useQuery({
    queryKey: ['admin2', 'signup-stats'],
    queryFn: () => superadminApiService.getSmsReviewStats(),
    enabled: isSuperAdmin,
    staleTime: 15_000,
    // See the Purchases page: global default is refetchOnMount:false, so always
    // refetch on mount to open in sync (WS keeps it live while open).
    refetchOnMount: 'always',
  });
  const reviewsQ = useQuery({
    queryKey: ['admin2', 'signup-reviews', status, page],
    queryFn: () => superadminApiService.getSmsReviews({ status: status || undefined, page, limit: LIMIT }),
    enabled: isSuperAdmin,
    staleTime: 10_000,
    placeholderData: keepPreviousData,
    refetchOnMount: 'always',
  });

  const stats = statsQ.data?.data;
  const reviews = reviewsQ.data?.data ?? [];
  const total = reviewsQ.data?.meta?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

  const refresh = () => { reviewsQ.refetch(); statsQ.refetch(); };

  if (!isSuperAdmin) {
    return (
      <section>
        <h1 className="text-3xl font-black tracking-tight">Signups</h1>
        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900">
          Signup review is available to platform super-admins.
        </div>
      </section>
    );
  }

  return (
    <section>
      <PageHead title="Signups" subtitle="Self-serve signup review queue — approve, request info, or reject incoming registrations (KYC / 10DLC)." />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Metric label="Pending" value={stats?.pending ?? '—'} sub="awaiting review" />
        <Metric label="In review" value={stats?.inReview ?? '—'} sub="being worked" subTone="off" />
        <Metric label="Awaiting info" value={stats?.moreInfoNeeded ?? '—'} sub="info requested" subTone="off" />
        <Metric label="Approved" value={stats?.approved ?? '—'} sub="cleared" subTone="off" />
        <Metric label="Rejected" value={stats?.rejected ?? '—'} sub="declined" subTone="off" />
      </div>

      <div className="mb-4 mt-4 flex flex-wrap items-center gap-2">
        <div className="flex rounded-xl border border-slate-200 p-1 dark:border-slate-800">
          {FILTERS.map((f) => (
            <button key={f.key} type="button" onClick={() => { setStatus(f.key); setPage(1); }} className={`rounded-lg px-3 py-1.5 text-xs font-bold ${status === f.key ? 'bg-[#FF6542] text-white' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}>{f.label}</button>
          ))}
        </div>
        {reviewsQ.isFetching && !reviewsQ.isLoading && <span className="text-xs font-semibold text-slate-400">Updating…</span>}
      </div>

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-950/70 dark:text-slate-400">
              <tr><th className="px-4 py-3">Company</th><th className="px-4 py-3">Contact</th><th className="px-4 py-3">Type</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Submitted</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {reviewsQ.isLoading ? (
                [0,1,2,3].map((i) => <tr key={i} className="animate-pulse">{[0,1,2,3,4].map((j)=><td key={j} className="px-4 py-4"><div className="h-4 rounded bg-slate-200 dark:bg-slate-800" /></td>)}</tr>)
              ) : reviewsQ.isError ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-red-600">Could not load signups.</td></tr>
              ) : reviews.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-10 text-center text-sm text-slate-400">No {status ? FILTERS.find((f) => f.key === status)?.label.toLowerCase() : ''} signups.</td></tr>
              ) : (
                reviews.map((r) => (
                  <tr key={r.id} onClick={() => setSelected(r)} className="cursor-pointer hover:bg-[#FF6542]/5">
                    <td className="px-4 py-4"><div className="font-extrabold">{r.businessName || r.legalCompanyName}</div>{r.legalCompanyName && r.legalCompanyName !== r.businessName && <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{r.legalCompanyName}</div>}</td>
                    <td className="px-4 py-4">{r.contactName}<div className="text-xs text-slate-500 dark:text-slate-400">{r.contactEmail}</div></td>
                    <td className="px-4 py-4"><span className="rounded-full bg-slate-500/10 px-2 py-0.5 text-xs font-bold">{r.reviewType === 'call_verification' ? 'KYC' : 'SMS'}</span></td>
                    <td className="px-4 py-4"><StatusDot health={STATUS_TONE[r.status] ?? 'off'} label={r.status.replace(/_/g, ' ')} /></td>
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
              <button type="button" disabled={page <= 1 || reviewsQ.isFetching} onClick={() => setPage((p) => Math.max(1, p - 1))} className="rounded-xl border border-slate-200 px-3 py-2 font-bold disabled:opacity-40 dark:border-slate-700">← Prev</button>
              <button type="button" disabled={page >= totalPages || reviewsQ.isFetching} onClick={() => setPage((p) => Math.min(totalPages, p + 1))} className="rounded-xl border border-slate-200 px-3 py-2 font-bold disabled:opacity-40 dark:border-slate-700">Next →</button>
            </div>
          </div>
        )}
      </Card>

      {selected && <SignupReviewDrawer review={selected} onClose={() => setSelected(null)} onDone={() => { setSelected(null); refresh(); }} />}
    </section>
  );
}
