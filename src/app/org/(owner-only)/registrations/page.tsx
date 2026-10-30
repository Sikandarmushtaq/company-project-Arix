'use client';

import React from 'react';
import Link from 'next/link';
import { FiPhone, FiMessageSquare, FiCheck, FiClock, FiAlertCircle, FiArrowRight } from 'react-icons/fi';
import { Card, CardContent } from '@/components/ui';
import {
  useOrgCallVerification,
  useOrgCallVerificationReview,
  useOrgSmsCampaign,
} from '@/lib/hooks/useOrg';

type VState = 'approved' | 'action_needed' | 'under_review' | 'not_started';

const BADGE: Record<VState, { label: string; cls: string; icon: React.ReactNode } | null> = {
  approved: {
    label: 'Verified',
    cls: 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-300 dark:border-green-800',
    icon: <FiCheck className="h-3.5 w-3.5" />,
  },
  action_needed: {
    label: 'Action needed',
    cls: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800',
    icon: <FiAlertCircle className="h-3.5 w-3.5" />,
  },
  under_review: {
    label: 'Under review',
    cls: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800',
    icon: <FiClock className="h-3.5 w-3.5" />,
  },
  not_started: null,
};

export default function RegistrationsPage() {
  const { data: cv } = useOrgCallVerification();
  const { data: review } = useOrgCallVerificationReview();
  const { data: smsCampaign } = useOrgSmsCampaign();
  const status = cv?.status ?? 'pending';

  // 10DLC state mirrors the Call Verification state machine (same review queue).
  // Reflects an admin override too — getSmsCampaign reads the same review row.
  const dlcReview = smsCampaign?.review ?? null;
  const dlcState: VState =
    dlcReview?.status === 'approved'
      ? 'approved'
      : dlcReview?.status === 'rejected' || dlcReview?.status === 'more_info_needed'
        ? 'action_needed'
        : dlcReview
          ? 'under_review'
          : 'not_started';
  const dlcBadge = BADGE[dlcState];
  const dlcApproved = dlcState === 'approved';
  const dlcButtonLabel =
    dlcState === 'action_needed'
      ? 'Update & resubmit'
      : dlcState === 'under_review'
        ? 'View status'
        : 'Register for SMS';
  const reviewStatus = review?.reviewStatus ?? null;
  const submitted = !!review?.submitted;

  const vstate: VState =
    status === 'approved'
      ? 'approved'
      : reviewStatus === 'more_info_needed' || status === 'rejected' || reviewStatus === 'rejected'
        ? 'action_needed'
        : submitted
          ? 'under_review'
          : 'not_started';
  const approved = vstate === 'approved';
  const badge = BADGE[vstate];
  const buttonLabel =
    vstate === 'action_needed'
      ? 'Update & resubmit'
      : vstate === 'under_review'
        ? 'View status'
        : 'Start verification';

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--foreground)]">Registrations</h1>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">
          Verify your business to unlock the full service. Complete the steps below.
        </p>
      </div>

      {cv?.capped && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
          <strong className="font-semibold">Your account is in trial mode.</strong> Until your Call
          Verification is approved, outbound calling is limited to{' '}
          <strong>{cv.callMinutesPerMonth} minutes/month</strong> and SMS to{' '}
          <strong>{cv.smsPerMonth}/month</strong>. Verify your business to remove these limits.
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        {/* Call Verification */}
        <Card className="flex flex-col">
          <CardContent className="flex flex-1 flex-col gap-4 p-6">
            <div className="flex items-start justify-between">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--primary)]/10 text-[var(--primary)]">
                <FiPhone className="h-5 w-5" />
              </span>
              {badge && (
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${badge.cls}`}
                >
                  {badge.icon}
                  {badge.label}
                </span>
              )}
            </div>
            <div>
              <h2 className="text-lg font-semibold text-[var(--foreground)]">Call Verification</h2>
              <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                Verify your business to unlock <strong>calling &amp; SMS bundles</strong>. Until then,
                you&apos;re on the base {cv?.callMinutesPerMonth ?? 100} minutes + {cv?.smsPerMonth ?? 100}{' '}
                SMS / month.
              </p>
            </div>
            {vstate === 'action_needed' && (
              <p className="text-sm text-red-600 dark:text-red-400">
                {reviewStatus === 'more_info_needed'
                  ? 'Our team requested more information — open to review and resubmit.'
                  : 'Your submission needs changes — open to review and resubmit.'}
              </p>
            )}
            <div className="mt-auto pt-2">
              {approved ? (
                <span className="inline-flex items-center gap-2 text-sm font-medium text-green-600 dark:text-green-400">
                  <FiCheck className="h-4 w-4" /> Calling is fully unlocked
                </span>
              ) : (
                <Link
                  href="/org/registrations/call-verification"
                  className="inline-flex items-center gap-2 rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-[var(--primary-foreground)] transition hover:opacity-90"
                >
                  {buttonLabel}
                  <FiArrowRight className="h-4 w-4" />
                </Link>
              )}
            </div>
          </CardContent>
        </Card>

        {/* SMS Registration (10DLC) */}
        <Card className="flex flex-col">
          <CardContent className="flex flex-1 flex-col gap-4 p-6">
            <div className="flex items-start justify-between">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--primary)]/10 text-[var(--primary)]">
                <FiMessageSquare className="h-5 w-5" />
              </span>
              {dlcBadge && (
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${dlcBadge.cls}`}
                >
                  {dlcBadge.icon} {dlcBadge.label}
                </span>
              )}
            </div>
            <div>
              <h2 className="text-lg font-semibold text-[var(--foreground)]">
                SMS Registration (10DLC)
              </h2>
              <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                {dlcApproved
                  ? 'Your business is registered for 10DLC — you can now buy SMS packages for higher volume.'
                  : 'Register your business with mobile carriers (10DLC) to send text messages at your full plan allowance.'}
              </p>
            </div>
            {dlcState === 'action_needed' && (
              <p className="text-sm text-red-600 dark:text-red-400">
                {dlcReview?.status === 'more_info_needed'
                  ? 'Our team requested more information — open to review and resubmit.'
                  : 'Your registration needs changes — open to review and resubmit.'}
              </p>
            )}
            <div className="mt-auto pt-2">
              {dlcApproved ? (
                <span className="inline-flex items-center gap-2 text-sm font-medium text-green-600 dark:text-green-400">
                  <FiCheck className="h-4 w-4" /> SMS registration approved
                </span>
              ) : (
                <Link
                  href="/org/sms-campaign"
                  className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--foreground)] transition hover:bg-[var(--muted)]"
                >
                  {dlcButtonLabel}
                  <FiArrowRight className="h-4 w-4" />
                </Link>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
