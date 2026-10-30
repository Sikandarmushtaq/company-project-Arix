'use client';

/**
 * Account status (Trial ↔ Live) — admin2 Org Detail → Usage tab.
 *
 * A trial org (`call_verification_status` = pending/rejected) runs on the capped
 * trial allowance. Making it LIVE flips the gate to `approved`: the backend lifts
 * the trial caps and moves the org to the UNLIMITED tier — which still carries the
 * hidden ~4,000 min/mo fair-use soft cap shown in the counter below (adjustable,
 * or exempt per-org). Reuses the existing super-admin override endpoint
 * (`PUT /call-verification/admin/:orgId/status`) via superadminApiService — no new
 * backend. Reversible: a live org can be moved back to trial.
 *
 * Placed on the Usage tab deliberately: it sits next to the very caps it changes,
 * so the state (Trial/Live) and the fair-use counter read together.
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { superadminApiService } from '@/lib/api/services/superadmin.service';
import { toast } from '@/lib/stores/toast';
import { Card, SectionTitle, Btn, StatusDot, Modal } from '../../_components/ui';

type Target = 'approved' | 'pending';

export function AccountStatusCard({ orgId }: { orgId: number }) {
  const qc = useQueryClient();
  const [confirm, setConfirm] = useState<Target | null>(null);

  const stateQ = useQuery({
    queryKey: ['admin2', 'org-verification', orgId],
    queryFn: () => superadminApiService.getOrgVerification(orgId),
    staleTime: 15_000,
    // Global default is refetchOnMount:false — refetch on mount so the Trial/Live
    // state is fresh when the Usage tab reopens (not a stale pre-change value).
    refetchOnMount: 'always',
  });

  const mutate = useMutation({
    mutationFn: (status: Target) => superadminApiService.setOrgKyc(orgId, status),
    onSuccess: (_res, status) => {
      setConfirm(null);
      toast.success(status === 'approved' ? 'Account is now live' : 'Account moved back to trial');
      // Status change lifts/re-applies caps → refresh the verification state AND every
      // usage surface that reads the cap (both ledgers + the per-org counters).
      qc.invalidateQueries({ queryKey: ['admin2', 'org-verification', orgId] });
      qc.invalidateQueries({ queryKey: ['admin2', 'org-usage-snapshot', orgId] });
      qc.invalidateQueries({ queryKey: ['admin2', 'call-usage-ledger'] });
      qc.invalidateQueries({ queryKey: ['admin2', 'sms-usage-ledger'] });
      qc.invalidateQueries({ queryKey: ['admin2', 'soft-cap', orgId] });
    },
    onError: (e: unknown) => {
      toast.error(e instanceof Error ? e.message : 'Could not update account status');
    },
  });

  if (stateQ.isLoading) {
    return <Card className="p-5"><div className="h-20 animate-pulse rounded bg-slate-200 dark:bg-slate-800" /></Card>;
  }
  if (stateQ.isError || !stateQ.data) return null;

  const status = stateQ.data.data.status;
  // Three distinct states — NOT a binary. Trial = capped (pending/rejected).
  // Approved = the self-serve org has been made live (unlimited tier + soft cap).
  // not_required = NOT a self-serve trial org at all (nuxcall/legacy) — it has no
  // verification gate and must NEVER be pushed onto the trial, so it gets no toggle.
  const isTrial = status === 'pending' || status === 'rejected';
  const isApproved = status === 'approved';
  const isNotRequired = status === 'not_required';
  const live = isApproved || isNotRequired;

  return (
    <Card className="p-5">
      <SectionTitle>Account status</SectionTitle>

      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="text-2xl font-black">
            {live ? 'Live' : 'Trial'}
            <span className="ml-2 align-middle">
              <StatusDot
                health={live ? 'ok' : 'warn'}
                label={isNotRequired ? 'Not metered' : live ? 'Unlimited tier' : 'Capped'}
              />
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {isNotRequired
              ? 'Not on the self-serve trial — no verification gate applies to this organization.'
              : isApproved
                ? 'Calling is on the unlimited tier — still subject to the fair-use soft cap below.'
                : 'Running on the capped trial allowance (calls + SMS).'}
            {status === 'rejected' && ' KYC was rejected.'}
          </p>
        </div>
        {isTrial ? (
          <Btn variant="primary" onClick={() => setConfirm('approved')} disabled={mutate.isPending}>
            Make live
          </Btn>
        ) : isApproved ? (
          <Btn variant="default" size="sm" onClick={() => setConfirm('pending')} disabled={mutate.isPending}>
            Move to trial
          </Btn>
        ) : null /* not_required → no trial toggle (would wrongly cap a non-trial org) */}
      </div>

      {confirm && (
        <Modal
          title={confirm === 'approved' ? 'Make this account live?' : 'Move account back to trial?'}
          subtitle={confirm === 'approved' ? 'Lifts the trial caps' : 'Re-applies the capped trial allowance'}
          onClose={() => (mutate.isPending ? undefined : setConfirm(null))}
          footer={
            <>
              <Btn onClick={() => setConfirm(null)} disabled={mutate.isPending}>Cancel</Btn>
              <Btn
                variant={confirm === 'approved' ? 'primary' : 'danger'}
                onClick={() => mutate.mutate(confirm)}
                disabled={mutate.isPending}
              >
                {mutate.isPending ? 'Working…' : confirm === 'approved' ? 'Make live' : 'Move to trial'}
              </Btn>
            </>
          }
        >
          {confirm === 'approved' ? (
            <div className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
              <p>The org moves to the <b>unlimited tier</b>: the trial call &amp; SMS caps are removed and all its users can call/text without the trial limit.</p>
              <p>
                Calling then falls under the hidden <b>fair-use soft cap</b> (deployment default
                <b> ~4,000 min/mo</b>) shown in the counter below — adjustable per-org, or set to
                unlimited/exempt there. SMS keeps metering against its base allowance or an active package.
              </p>
            </div>
          ) : (
            <div className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
              <p>The org returns to the <b>capped trial</b> (status <code>pending</code>): calls and SMS are limited to the base trial allowance again.</p>
              <p className="text-amber-600 dark:text-amber-400">Any custom trial caps set earlier were cleared when it went live, so it reverts to the default trial allowance.</p>
            </div>
          )}
        </Modal>
      )}
    </Card>
  );
}
