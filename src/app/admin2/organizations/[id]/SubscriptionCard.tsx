'use client';

/**
 * Subscription — admin2 Org Detail → Usage. Shows the org's Stripe subscription
 * (status, renewal date, recurring amount) and lets a super-admin schedule a
 * cancellation at period end — reversible (Reactivate) until the renewal date.
 * Wired to superadminApiService.getOrgSubscription / cancelOrgSubscription /
 * reactivateOrgSubscription. No subscription → a neutral note.
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { superadminApiService } from '@/lib/api/services/superadmin.service';
import { toast } from '@/lib/stores/toast';
import { Card, SectionTitle, Btn, StatusDot, Modal } from '../../_components/ui';

const fmtDate = (unix: number | null) =>
  unix ? new Date(unix * 1000).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

export function SubscriptionCard({ orgId }: { orgId: number }) {
  const qc = useQueryClient();
  const [confirm, setConfirm] = useState(false);
  const q = useQuery({
    queryKey: ['admin2', 'org-subscription', orgId],
    queryFn: () => superadminApiService.getOrgSubscription(orgId),
    refetchOnMount: 'always',
    staleTime: 30_000,
  });

  const done = (ok: string) => {
    toast.success(ok);
    setConfirm(false);
    qc.invalidateQueries({ queryKey: ['admin2', 'org-subscription', orgId] });
  };
  const onErr = (e: unknown) => toast.error(e instanceof Error ? e.message : 'Action failed');
  const cancel = useMutation({
    mutationFn: () => superadminApiService.cancelOrgSubscription(orgId),
    onSuccess: () => done('Cancellation scheduled'),
    onError: onErr,
  });
  const reactivate = useMutation({
    mutationFn: () => superadminApiService.reactivateOrgSubscription(orgId),
    onSuccess: () => done('Subscription reactivated'),
    onError: onErr,
  });

  if (q.isLoading) {
    return <Card className="p-5"><div className="h-20 animate-pulse rounded bg-slate-200 dark:bg-slate-800" /></Card>;
  }
  if (q.isError) return null;
  const sub = q.data?.data;
  const s = sub?.summary;
  const busy = cancel.isPending || reactivate.isPending;

  return (
    <Card className="p-5">
      <SectionTitle>Subscription</SectionTitle>
      {!s ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">
          No active Stripe subscription (card-less / bank-transfer, or not yet subscribed).
        </p>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <StatusDot
                  health={s.cancelAtPeriodEnd ? 'warn' : s.status === 'active' || s.status === 'trialing' ? 'ok' : s.status === 'past_due' ? 'warn' : 'bad'}
                  label={s.cancelAtPeriodEnd ? 'Canceling' : s.status}
                />
              </div>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {s.amountCents != null && (
                  <>
                    {(s.amountCents / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}{' '}
                    {(s.currency || 'usd').toUpperCase()}{s.interval ? `/${s.interval}` : ''} ·{' '}
                  </>
                )}
                {s.cancelAtPeriodEnd ? 'ends' : 'renews'} {fmtDate(s.currentPeriodEnd)}
              </p>
            </div>
            {s.cancelAtPeriodEnd ? (
              <Btn variant="primary" disabled={busy} onClick={() => reactivate.mutate()}>
                {reactivate.isPending ? 'Working…' : 'Reactivate'}
              </Btn>
            ) : (
              <Btn variant="danger" disabled={busy} onClick={() => setConfirm(true)}>
                Cancel subscription
              </Btn>
            )}
          </div>

          {confirm && (
            <Modal
              title="Cancel this subscription?"
              subtitle="At period end — reversible"
              onClose={() => (cancel.isPending ? undefined : setConfirm(false))}
              footer={
                <>
                  <Btn onClick={() => setConfirm(false)} disabled={cancel.isPending}>Keep active</Btn>
                  <Btn variant="danger" onClick={() => cancel.mutate()} disabled={cancel.isPending}>
                    {cancel.isPending ? 'Working…' : 'Schedule cancellation'}
                  </Btn>
                </>
              }
            >
              <p className="text-sm text-slate-600 dark:text-slate-300">
                The org keeps service until <b>{fmtDate(s.currentPeriodEnd)}</b>, then the subscription
                ends and it stops renewing. You can Reactivate any time before that date. (To cut access
                immediately, use Disable or Close on the org instead.)
              </p>
            </Modal>
          )}
        </>
      )}
    </Card>
  );
}
