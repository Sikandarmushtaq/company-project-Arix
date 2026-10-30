'use client';

import React from 'react';
import Link from 'next/link';
import { FiArrowLeft, FiClock, FiCheck, FiRefreshCw, FiAlertCircle } from 'react-icons/fi';
import { CallVerificationForm } from '@/components/org/CallVerificationForm';
import { orgApiService } from '@/lib/api/services/org.service';
import {
  useOrgCallVerification,
  useOrgCallVerificationReview,
  useSubmitOrgCallVerification,
} from '@/lib/hooks/useOrg';

// Trial base allowance shown in copy. The SMS portion is HIDDEN for now — 10DLC
// registration is required before any SMS can be sent (US carrier rule) — but the
// code is kept so it can be re-enabled later by flipping this flag back to true.
const SHOW_SMS_TRIAL_ALLOWANCE = false;
const TRIAL_ALLOWANCE_TEXT = SHOW_SMS_TRIAL_ALLOWANCE
  ? '100 minutes + 100 SMS / month'
  : '100 minutes / month';

export default function CallVerificationPage() {
  const { data: cv, isLoading, refetch } = useOrgCallVerification();
  const { data: review, isLoading: reviewLoading, refetch: refetchReview } =
    useOrgCallVerificationReview();
  const submitMutation = useSubmitOrgCallVerification();
  const status = cv?.status ?? 'pending';
  const reviewStatus = review?.reviewStatus ?? null;

  const [refreshing, setRefreshing] = React.useState(false);
  const [checkedStillPending, setCheckedStillPending] = React.useState(false);
  const handleRefresh = async () => {
    setRefreshing(true);
    setCheckedStillPending(false);
    try {
      const [cvRes] = await Promise.all([refetch(), refetchReview()]);
      // approved/rejected/more-info re-render the view automatically; a still-
      // pending check just needs a soft acknowledgement.
      if ((cvRes.data?.status ?? 'pending') !== 'approved') setCheckedStillPending(true);
    } finally {
      setRefreshing(false);
    }
  };

  const uploadFile = async (file: { name: string; contentType: string; size: number }) => {
    const res = await orgApiService.getSmsCampaignUploadUrl(file);
    return res.data;
  };

  const Back = (
    <Link
      href="/org/registrations"
      className="inline-flex items-center gap-1.5 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
    >
      <FiArrowLeft className="h-4 w-4" /> Back to Registrations
    </Link>
  );

  if (isLoading || reviewLoading) {
    return <div className="p-6 text-sm text-[var(--muted-foreground)]">Loading…</div>;
  }

  // Prefill a resubmit with the last submission so the owner isn't re-typing
  // everything (blank form on a "more info" / rejection is not acceptable).
  const sub = review?.submission;
  const prefill = sub?.brand ? { registrationType: sub.registrationType, ...sub.brand } : undefined;

  // Approved → nothing to do.
  if (status === 'approved') {
    return (
      <div className="mx-auto max-w-2xl space-y-4 p-6">
        {Back}
        <div className="flex items-start gap-3 rounded-lg border border-green-200 bg-green-50 p-5 dark:border-green-800 dark:bg-green-900/20">
          <FiCheck className="mt-0.5 h-5 w-5 text-green-600" />
          <div>
            <h2 className="font-semibold text-green-800 dark:text-green-200">Business verified</h2>
            <p className="text-sm text-green-700 dark:text-green-300">
              Your account is verified — buy calling &amp; SMS bundles in Plan &amp; billing to scale
              beyond the base {TRIAL_ALLOWANCE_TEXT}.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const moreInfo = reviewStatus === 'more_info_needed';
  const rejected = status === 'rejected' || reviewStatus === 'rejected';
  const submitted = !!review?.submitted || submitMutation.isSuccess;
  // Submitted and still in the queue (not action-needed) → show a persistent
  // status card, NOT the form. This survives reloads (driven by the review row,
  // not an in-session flag).
  const underReview = submitted && !moreInfo && !rejected;

  return (
    <div className="mx-auto max-w-3xl space-y-5 p-6">
      {Back}
      <div>
        <h1 className="text-2xl font-bold text-[var(--foreground)]">Call Verification</h1>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">
          Tell us about your business. Once approved, you can buy calling &amp; SMS bundles in Plan
          &amp; billing to scale beyond the base {TRIAL_ALLOWANCE_TEXT}.
        </p>
      </div>

      {underReview ? (
        <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-5 dark:border-amber-800 dark:bg-amber-900/20">
          <FiClock className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <div>
            <h2 className="font-semibold text-amber-800 dark:text-amber-200">Under review</h2>
            <p className="text-sm text-amber-700 dark:text-amber-300">
              Thanks! Our team is reviewing your business details, typically within 24–48 hours.
              We&apos;ll unlock calling &amp; SMS bundles as soon as you&apos;re approved.
            </p>
            <div className="mt-3 flex items-center gap-3">
              <button
                type="button"
                onClick={handleRefresh}
                disabled={refreshing}
                className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-white/70 px-3 py-1.5 text-sm font-semibold text-amber-800 transition hover:bg-white disabled:opacity-60 dark:border-amber-700 dark:bg-transparent dark:text-amber-200 dark:hover:bg-amber-900/30"
              >
                <FiRefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
                {refreshing ? 'Checking…' : 'Refresh status'}
              </button>
              {checkedStillPending && !refreshing && (
                <span className="text-xs text-amber-700 dark:text-amber-300">
                  Still under review — we&apos;ll update the moment you&apos;re approved.
                </span>
              )}
            </div>
          </div>
        </div>
      ) : (
        <>
          {moreInfo && (
            <div className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-900/20">
              <FiAlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
              <div className="text-sm text-amber-800 dark:text-amber-200">
                <p className="font-semibold">Our team needs a bit more information</p>
                {review?.notes && <p className="mt-1 whitespace-pre-line">{review.notes}</p>}
                <p className="mt-1 text-amber-700 dark:text-amber-300">
                  Update the details below and resubmit.
                </p>
              </div>
            </div>
          )}

          {rejected && (
            <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
              <FiAlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
              <div className="text-sm text-red-800 dark:text-red-200">
                <p className="font-semibold">Your submission was not approved</p>
                {review?.notes && <p className="mt-1 whitespace-pre-line">{review.notes}</p>}
                <p className="mt-1 text-red-700 dark:text-red-300">
                  Please review your details and resubmit.
                </p>
              </div>
            </div>
          )}

          {!submitted && !moreInfo && !rejected && (
            <div className="rounded-lg border border-[var(--border)] bg-[var(--muted)]/40 p-4 text-sm text-[var(--muted-foreground)]">
              Your account is in trial mode until your business is verified. Submitting the form
              below puts you in the review queue.
            </div>
          )}

          <CallVerificationForm
            prefill={prefill}
            onSubmit={async (payload) => {
              await submitMutation.mutateAsync(payload);
            }}
            submitting={submitMutation.isPending}
            uploadFile={uploadFile}
          />
        </>
      )}
    </div>
  );
}
