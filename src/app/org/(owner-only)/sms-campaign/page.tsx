'use client';

import React from 'react';
import {
  FiClock,
  FiSearch,
  FiCheck,
  FiX,
  FiAlertCircle,
  FiMessageSquare,
  FiLoader,
} from 'react-icons/fi';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui';
import { formatLocalDate } from '@/lib/utils/datetime';
import { useOrgSmsCampaign, useSubmitOrgSmsCampaign } from '@/lib/hooks/useOrg';
import { orgApiService } from '@/lib/api/services/org.service';
import TenDlcRegistrationForm from '@/components/signup/TenDlcRegistrationForm';

const STATUS_CONFIG: Record<
  string,
  { icon: React.ReactNode; bg: string; text: string; message: string }
> = {
  pending: {
    icon: <FiClock className="w-5 h-5 text-amber-600" />,
    bg: 'border-amber-200 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-800',
    text: 'text-amber-800 dark:text-amber-200',
    message: 'Your SMS campaign is under review. This typically takes 24-48 hours.',
  },
  in_review: {
    icon: <FiSearch className="w-5 h-5 text-blue-600" />,
    bg: 'border-blue-200 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-800',
    text: 'text-blue-800 dark:text-blue-200',
    message: 'Our team is currently reviewing your SMS campaign submission.',
  },
  approved: {
    icon: <FiCheck className="w-5 h-5 text-green-600" />,
    bg: 'border-green-200 bg-green-50 dark:bg-green-900/20 dark:border-green-800',
    text: 'text-green-800 dark:text-green-200',
    message: 'Your SMS campaign has been approved! SMS messaging is now enabled.',
  },
  rejected: {
    icon: <FiX className="w-5 h-5 text-red-600" />,
    bg: 'border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800',
    text: 'text-red-800 dark:text-red-200',
    message: 'Your SMS campaign was not approved. Update the details below and resubmit.',
  },
  more_info_needed: {
    icon: <FiAlertCircle className="w-5 h-5 text-orange-600" />,
    bg: 'border-orange-200 bg-orange-50 dark:bg-orange-900/20 dark:border-orange-800',
    text: 'text-orange-800 dark:text-orange-200',
    message: 'Additional information is needed. Update the details below and resubmit.',
  },
};


export default function SmsCampaignPage() {
  const { data, isLoading, isError, refetch } = useOrgSmsCampaign();
  const submitMutation = useSubmitOrgSmsCampaign();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <FiLoader className="w-8 h-8 animate-spin text-[var(--foreground)]" />
      </div>
    );
  }

  if (isError || !data)
    return (
      <div className="p-8 text-center text-[var(--danger)]">
        Failed to load SMS campaign. Please try again.
      </div>
    );

  const { review, eligible, canSubmit, prefill, numbers, submission } = data;

  const Header = (
    <div>
      <h1 className="text-2xl font-bold text-[var(--foreground)]">SMS Campaign</h1>
      <p className="text-[var(--muted-foreground)] mt-1">
        Register your business to send SMS (10DLC)
      </p>
    </div>
  );

  // Plan doesn't include SMS.
  if (!eligible) {
    return (
      <div className="space-y-6">
        {Header}
        <Card>
          <CardContent className="p-8 text-center">
            <FiMessageSquare className="w-12 h-12 text-[var(--muted-foreground)] mx-auto mb-4" />
            <p className="text-[var(--foreground)] font-medium">SMS isn&apos;t part of your current plan</p>
            <p className="text-[var(--muted-foreground)] mt-1 text-sm">
              Upgrade to the Professional plan to enable SMS messaging and register a 10DLC campaign.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const showStatus = review && ['pending', 'in_review', 'approved'].includes(review.status);

  return (
    <div className="space-y-6">
      {Header}

      {showStatus ? (
        <>
          {/* Status Banner */}
          {STATUS_CONFIG[review.status] && (
            <div className={`rounded-xl border p-6 ${STATUS_CONFIG[review.status].bg}`}>
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 mt-0.5">{STATUS_CONFIG[review.status].icon}</div>
                <div>
                  <p className={`font-semibold ${STATUS_CONFIG[review.status].text}`}>
                    Status: <span className="capitalize">{review.status.replace(/_/g, ' ')}</span>
                  </p>
                  <p className={`text-sm mt-1 ${STATUS_CONFIG[review.status].text} opacity-80`}>
                    {STATUS_CONFIG[review.status].message}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Details */}
          <Card>
            <CardHeader>
              <CardTitle>Campaign Details</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="space-y-4">
                <div>
                  <dt className="text-sm text-[var(--muted-foreground)]">Company</dt>
                  <dd className="text-sm font-medium text-[var(--foreground)] mt-0.5">
                    {review.legalCompanyName}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-[var(--muted-foreground)]">Submitted</dt>
                  <dd className="text-sm text-[var(--foreground)] mt-0.5">
                    {formatLocalDate(review.createdAt)}
                  </dd>
                </div>
                {review.reviewedAt && (
                  <div>
                    <dt className="text-sm text-[var(--muted-foreground)]">Reviewed</dt>
                    <dd className="text-sm text-[var(--foreground)] mt-0.5">
                      {formatLocalDate(review.reviewedAt)}
                    </dd>
                  </div>
                )}
                {review.reviewerNotes && (
                  <div>
                    <dt className="text-sm text-[var(--muted-foreground)]">Notes</dt>
                    <dd className="text-sm text-[var(--foreground)] mt-0.5">{review.reviewerNotes}</dd>
                  </div>
                )}
              </dl>
            </CardContent>
          </Card>
        </>
      ) : (
        <>
          {/* A previous submission bounced back — surface why, above the form. */}
          {review && STATUS_CONFIG[review.status] && (
            <div className={`rounded-xl border p-6 ${STATUS_CONFIG[review.status].bg}`}>
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 mt-0.5">{STATUS_CONFIG[review.status].icon}</div>
                <div>
                  <p className={`font-semibold ${STATUS_CONFIG[review.status].text}`}>
                    {STATUS_CONFIG[review.status].message}
                  </p>
                  {review.rejectionReason && (
                    <p className={`text-sm mt-1 ${STATUS_CONFIG[review.status].text} opacity-80`}>
                      Reason: {review.rejectionReason}
                    </p>
                  )}
                  {review.reviewerNotes && (
                    <p className={`text-sm mt-1 ${STATUS_CONFIG[review.status].text} opacity-80`}>
                      {review.reviewerNotes}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {canSubmit ? (
            <TenDlcRegistrationForm
              numbers={numbers}
              prefill={prefill}
              submission={submission}
              uploadFile={async (file) => {
                const res = await orgApiService.getSmsCampaignUploadUrl(file);
                return res.data;
              }}
              onSubmit={async (payload) => {
                await submitMutation.mutateAsync(payload);
                await refetch();
              }}
              submitting={submitMutation.isPending}
              heading={review ? 'Update your SMS registration' : 'Register for SMS (10DLC)'}
              submitLabel={review ? 'Resubmit registration' : 'Submit registration'}
            />
          ) : (
            <Card>
              <CardContent className="p-8 text-center">
                <FiMessageSquare className="w-12 h-12 text-[var(--muted-foreground)] mx-auto mb-4" />
                <p className="text-[var(--muted-foreground)]">
                  No SMS campaign has been requested for your organization yet.
                </p>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
