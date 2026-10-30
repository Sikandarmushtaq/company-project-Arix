'use client';

/**
 * Admin SMS-package card for the org-detail page. Lets a super-admin ASSIGN an
 * SMS package (bundle) to an org, or REMOVE it (back to the base 100/mo). The
 * package is an ORG-WIDE shared pool — every user in the org draws from it.
 *
 * Why this exists: the per-user SMS limit on the SMS-usage page does NOT apply to
 * self-serve (metered) reskin orgs — they're gated by their package (or base 100)
 * only. So the only real lever to give a reskin org more SMS is a package; this
 * card is where an admin does that directly (a Stripe purchase by the owner is
 * the other path). Grant here is an admin override — it bypasses the owner-facing
 * 10DLC gate (carriers still gate delivery on 10DLC).
 *
 * @module app/admin/organizations/[id]/SmsPackageCard
 */

import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FiLoader, FiPackage, FiAlertTriangle } from 'react-icons/fi';
import { Card, CardContent, CardHeader, CardTitle, Button, StyledSelect } from '@/components/ui';
import { ConfirmModal } from '@/components/ui/Modal';
import { toast } from '@/lib/stores/toast';
import {
  superadminApiService,
  type AdminOrgBundleState,
} from '@/lib/api/services/superadmin.service';

export function SmsPackageCard({ orgId }: { orgId: number }) {
  const qc = useQueryClient();
  const [slug, setSlug] = useState<string>('');
  // Default ON — an admin comp is usually meant to persist; unchecking makes it a
  // one-month grant that expires (matches a bank-transfer-style single cycle).
  const [autoRenew, setAutoRenew] = useState(true);
  const [confirmRemove, setConfirmRemove] = useState(false);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['admin', 'org-bundle', orgId],
    queryFn: () => superadminApiService.getOrgBundle(orgId),
    staleTime: 15_000,
  });

  const { data: historyRes } = useQuery({
    queryKey: ['admin', 'org-sms-history', orgId],
    queryFn: () => superadminApiService.getOrgSmsUsageHistory(orgId),
    staleTime: 60_000,
  });
  const history = historyRes?.data ?? [];

  const invalidate = () => qc.invalidateQueries({ queryKey: ['admin', 'org-bundle', orgId] });

  const grantMutation = useMutation({
    mutationFn: (v: { slug: string; autoRenew: boolean }) =>
      superadminApiService.grantOrgBundle(orgId, v.slug, v.autoRenew),
    onSuccess: (r) => {
      toast.success(r.message || 'SMS package assigned');
      setSlug('');
      invalidate();
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : 'Failed to assign SMS package'),
  });

  const removeMutation = useMutation({
    mutationFn: () => superadminApiService.clearOrgBundle(orgId),
    onSuccess: (r) => {
      toast.success(r.message || 'SMS package removed');
      setConfirmRemove(false);
      invalidate();
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : 'Failed to remove SMS package'),
  });

  const s: AdminOrgBundleState | undefined = data?.data;
  const busy = grantMutation.isPending || removeMutation.isPending;

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>SMS Package</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <FiLoader className="w-6 h-6 animate-spin text-[var(--muted-foreground)]" />
            </div>
          ) : isError || !s ? (
            <p className="text-sm text-[var(--danger)]">Failed to load SMS package state.</p>
          ) : s.kycStatus === 'not_required' ? (
            <p className="text-sm text-[var(--muted-foreground)]">
              This organization is unmetered (status <span className="font-medium">not_required</span>)
              — SMS packages don&apos;t apply. Its SMS limit is governed by the per-user limit on the
              SMS-usage page instead.
            </p>
          ) : (
            <div className="space-y-5">
              {/* Current allowance */}
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500">
                  <FiPackage className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[var(--foreground)]">Current allowance</p>
                  {s.active ? (
                    <p className="text-xs text-[var(--muted-foreground)]">
                      <span className="font-semibold text-[var(--foreground)]">{s.active.label}</span>{' '}
                      — {s.active.smsUsed.toLocaleString()} / {s.active.smsIncluded.toLocaleString()}{' '}
                      SMS used this cycle ·{' '}
                      {s.active.canceling
                        ? `canceling — ends ${new Date(s.active.periodEnd).toLocaleDateString()}`
                        : s.active.autoRenew
                          ? `auto-renews ${new Date(s.active.periodEnd).toLocaleDateString()}`
                          : `expires ${new Date(s.active.periodEnd).toLocaleDateString()} (no auto-renew)`}
                    </p>
                  ) : (
                    <p className="text-xs text-[var(--muted-foreground)]">
                      Base plan — <span className="font-semibold text-[var(--foreground)]">
                        {s.basePlan.sms.toLocaleString()}
                      </span>{' '}
                      SMS / month (no package). Org-wide shared pool.
                    </p>
                  )}
                </div>
              </div>

              {/* Paid-subscription warning — switching/removing cancels billing */}
              {s.active?.isPaid && (
                <div className="flex items-start gap-2 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-600 dark:text-red-400">
                  <FiAlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    This org has a <span className="font-semibold">paid Stripe subscription</span>.
                    Switching or removing the package here cancels that billing line — use only if
                    that&apos;s intended.
                  </span>
                </div>
              )}

              {/* 10DLC caveat — the allowance is set, but carriers gate delivery */}
              {!s.tenDlcApproved && (
                <div className="flex items-start gap-2 rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-600 dark:text-amber-400">
                  <FiAlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    This org isn&apos;t 10DLC-approved yet. A package still applies, but US carriers
                    may filter its SMS until 10DLC registration is approved.
                  </span>
                </div>
              )}

              {/* Assign / switch */}
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                <div className="min-w-0 flex-1">
                  <label className="mb-1 block text-xs font-medium text-[var(--muted-foreground)]">
                    {s.active ? 'Switch to package' : 'Assign package'}
                  </label>
                  <StyledSelect value={slug} onChange={setSlug} disabled={busy}>
                    <option value="">Select a package…</option>
                    {s.catalog.map((b) => (
                      <option key={b.slug} value={b.slug}>
                        {b.label} (${(b.monthlyCents / 100).toFixed(0)}/mo)
                      </option>
                    ))}
                  </StyledSelect>
                </div>
                <Button
                  onClick={() => grantMutation.mutate({ slug, autoRenew })}
                  disabled={busy || !slug}
                  className="shrink-0"
                >
                  {grantMutation.isPending ? 'Assigning…' : s.active ? 'Switch' : 'Assign'}
                </Button>
              </div>

              {/* Auto-renew toggle */}
              <label className="flex cursor-pointer items-start gap-2 text-xs text-[var(--muted-foreground)]">
                <input
                  type="checkbox"
                  checked={autoRenew}
                  onChange={(e) => setAutoRenew(e.target.checked)}
                  disabled={busy}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--primary)]"
                />
                <span>
                  <span className="font-medium text-[var(--foreground)]">Auto-renew monthly</span> —
                  keep this allowance every cycle. Uncheck to grant a single month that expires back
                  to base {s.basePlan.sms.toLocaleString()} at period end.
                </span>
              </label>

              {s.active && (
                <Button
                  variant="ghost"
                  onClick={() => setConfirmRemove(true)}
                  disabled={busy}
                  className="text-[var(--danger)] hover:bg-[var(--danger)]/10"
                >
                  Remove package (back to base {s.basePlan.sms.toLocaleString()}/mo)
                </Button>
              )}

              {/* Org-wide monthly usage history — derived from messages, never lost. */}
              <div className="border-t border-[var(--border)] pt-4">
                <p className="text-sm font-semibold text-[var(--foreground)]">
                  Monthly SMS usage (org-wide)
                </p>
                <p className="mb-2 text-[11px] text-[var(--muted-foreground)]">
                  Per calendar month, from the actual messages — this record can&apos;t be lost on a
                  limit reset. (The active package&apos;s &ldquo;used this cycle&rdquo; above counts
                  from its billing-cycle start, so it may differ slightly.)
                </p>
                {history.length === 0 ? (
                  <p className="text-xs text-[var(--muted-foreground)]">No SMS usage yet.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-left text-[var(--muted-foreground)]">
                          <th className="py-1 pr-3 font-medium">Month</th>
                          <th className="py-1 pr-3 font-medium text-right">Sent (billed)</th>
                          <th className="py-1 pr-3 font-medium text-right">Received</th>
                          <th className="py-1 font-medium text-right">Segments</th>
                        </tr>
                      </thead>
                      <tbody>
                        {history.map((m) => (
                          <tr key={m.periodStart} className="border-t border-[var(--border)]/60">
                            <td className="py-1.5 pr-3 text-[var(--foreground)]">
                              {new Date(`${m.periodStart}T00:00:00Z`).toLocaleDateString(undefined, {
                                month: 'short',
                                year: 'numeric',
                                timeZone: 'UTC',
                              })}
                            </td>
                            <td className="py-1.5 pr-3 text-right font-semibold tabular-nums text-[var(--foreground)]">
                              {m.totalSent.toLocaleString()}
                            </td>
                            <td className="py-1.5 pr-3 text-right tabular-nums">
                              {m.totalReceived.toLocaleString()}
                            </td>
                            <td className="py-1.5 text-right tabular-nums text-[var(--muted-foreground)]">
                              {m.totalSegmentsSent.toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <ConfirmModal
        isOpen={confirmRemove}
        onClose={() => setConfirmRemove(false)}
        onConfirm={() => removeMutation.mutate()}
        title="Remove SMS package?"
        message={`This org will revert to the base ${s?.basePlan.sms.toLocaleString() ?? 100} SMS/month. Any current-cycle usage is archived.`}
        confirmText="Remove package"
        loading={removeMutation.isPending}
      />
    </>
  );
}
