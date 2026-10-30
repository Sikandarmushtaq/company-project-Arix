'use client';

/**
 * Admin per-org Verification override card.
 *
 * Lets a super-admin approve (or reset/revoke) an org's KYC (Call Verification)
 * and 10DLC gates DIRECTLY — even if the owner never submitted via their panel.
 * KYC-approved → unlimited calling; 10DLC-approved → may buy SMS packages.
 *
 * @module app/admin/organizations/[id]/VerificationCard
 */

import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FiLoader, FiShield, FiMessageSquare, FiCheck, FiX, FiRotateCcw } from 'react-icons/fi';
import { Card, CardContent, CardHeader, CardTitle, Button } from '@/components/ui';
import { ConfirmModal } from '@/components/ui/Modal';
import { toast } from '@/lib/stores/toast';
import {
  superadminApiService,
  type OrgVerificationState,
} from '@/lib/api/services/superadmin.service';

function StatusBadge({ status }: { status: string }) {
  const tone =
    status === 'approved'
      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
      : status === 'pending'
        ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
        : status === 'rejected'
          ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
          : 'bg-[var(--muted)] text-[var(--muted-foreground)]';
  return (
    <span className={`inline-flex px-2 py-0.5 text-[11px] font-semibold rounded-full ${tone}`}>
      {status.replace('_', ' ')}
    </span>
  );
}

export function VerificationCard({ orgId }: { orgId: number }) {
  const qc = useQueryClient();
  // Re-capping a live org (Reset → pending, or Reject) is confirmed to avoid a
  // mis-click cutting off a paying customer's calling. Approve stays one-click.
  const [confirmRecap, setConfirmRecap] = useState<'pending' | 'rejected' | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['admin', 'org-verification', orgId],
    queryFn: () => superadminApiService.getOrgVerification(orgId),
    staleTime: 15_000,
  });

  const invalidate = () =>
    qc.invalidateQueries({ queryKey: ['admin', 'org-verification', orgId] });

  const kycMutation = useMutation({
    mutationFn: (status: 'approved' | 'pending' | 'rejected') =>
      superadminApiService.setOrgKyc(orgId, status),
    onSuccess: (r) => {
      toast.success(r.message || 'Updated');
      invalidate();
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : 'Failed to update KYC'),
  });

  const tenDlcMutation = useMutation({
    mutationFn: (approved: boolean) => superadminApiService.setOrg10dlc(orgId, approved),
    onSuccess: (r) => {
      toast.success(r.message || 'Updated');
      invalidate();
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : 'Failed to update 10DLC'),
  });

  const v: OrgVerificationState | undefined = data?.data;
  const busy = kycMutation.isPending || tenDlcMutation.isPending;

  return (
    <>
    <Card>
      <CardHeader>
        <CardTitle>Verification &amp; Access</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <FiLoader className="w-6 h-6 animate-spin text-[var(--muted-foreground)]" />
          </div>
        ) : isError || !v ? (
          <p className="text-sm text-[var(--danger)]">Failed to load verification state.</p>
        ) : v.status === 'not_required' ? (
          <p className="text-sm text-[var(--muted-foreground)]">
            This organization is not on the arixcall self-serve trial (status{' '}
            <StatusBadge status="not_required" />) — no verification gate applies.
          </p>
        ) : (
          <div className="space-y-5">
            {/* KYC / Call Verification */}
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3 min-w-0">
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-blue-500">
                  <FiShield className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-[var(--foreground)]">
                      Call Verification (KYC)
                    </p>
                    <StatusBadge status={v.status} />
                  </div>
                  <p className="text-xs text-[var(--muted-foreground)]">
                    Approved → unlimited calling.{' '}
                    {v.submitted ? 'Owner submitted.' : 'No submission from the owner.'}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Button
                  size="sm"
                  variant="success"
                  disabled={busy || v.status === 'approved'}
                  onClick={() => kycMutation.mutate('approved')}
                >
                  <FiCheck className="w-3 h-3" /> Approve
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy || v.status === 'pending'}
                  onClick={() => setConfirmRecap('pending')}
                  title="Reset to pending (re-caps calling)"
                >
                  <FiRotateCcw className="w-3 h-3" /> Reset
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  disabled={busy || v.status === 'rejected'}
                  onClick={() => setConfirmRecap('rejected')}
                >
                  <FiX className="w-3 h-3" /> Reject
                </Button>
              </div>
            </div>

            <div className="h-px bg-[var(--border)]" />

            {/* 10DLC */}
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3 min-w-0">
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-purple-500/10 text-purple-500">
                  <FiMessageSquare className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-[var(--foreground)]">
                      10DLC (SMS registration)
                    </p>
                    <StatusBadge status={v.tenDlcApproved ? 'approved' : 'pending'} />
                  </div>
                  <p className="text-xs text-[var(--muted-foreground)]">
                    Approved → may buy SMS packages.
                    {!v.hasOrder && ' (Unavailable — org has no signup order.)'}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Button
                  size="sm"
                  variant="success"
                  disabled={busy || v.tenDlcApproved || !v.hasOrder}
                  onClick={() => tenDlcMutation.mutate(true)}
                >
                  <FiCheck className="w-3 h-3" /> Approve
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy || !v.tenDlcApproved}
                  onClick={() => tenDlcMutation.mutate(false)}
                >
                  <FiX className="w-3 h-3" /> Revoke
                </Button>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>

    <ConfirmModal
      isOpen={confirmRecap !== null}
      onClose={() => setConfirmRecap(null)}
      onConfirm={() => {
        if (confirmRecap) kycMutation.mutate(confirmRecap);
        setConfirmRecap(null);
      }}
      title={confirmRecap === 'rejected' ? 'Reject Call Verification?' : 'Reset to pending?'}
      message={
        confirmRecap === 'rejected'
          ? "This re-caps the org's outbound calling to 100 min/month and marks them rejected. You can approve again any time."
          : "This puts the org back on the trial cap (100 min/month calling) until re-approved."
      }
      confirmText={confirmRecap === 'rejected' ? 'Reject' : 'Reset'}
      variant="danger"
      loading={kycMutation.isPending}
    />
    </>
  );
}
