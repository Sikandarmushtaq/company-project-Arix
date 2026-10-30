'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import {
  FiUsers,
  FiPhone,
  FiMessageSquare,
  FiClock,
  FiCheckCircle,
  FiLoader,
  FiAlertTriangle,
  FiAlertCircle,
} from 'react-icons/fi';
import { Card, CardContent } from '@/components/ui';
import { useOrgDashboard, useOrgBilling } from '@/lib/hooks/useOrg';
import { ApiError } from '@/lib/api/client';

export default function OrgDashboard() {
  const router = useRouter();
  const { data: stats, isLoading, isError, error } = useOrgDashboard();
  const { data: billing } = useOrgBilling();

  // A suspended org is blocked everywhere EXCEPT Plan & billing (the API 403s with
  // the reason). Route the owner there instead of showing a dead "Failed to load"
  // screen — the billing page shows WHY and how to restore service.
  const isSuspended = error instanceof ApiError && error.status === 403;
  React.useEffect(() => {
    if (isSuspended) router.replace('/org/billing');
  }, [isSuspended, router]);

  if (isLoading || isSuspended) {
    return (
      <div className="flex items-center justify-center h-64">
        <FiLoader className="w-8 h-8 animate-spin text-[var(--foreground)]" />
      </div>
    );
  }

  if (isError)
    return (
      <div className="p-8 text-center text-[var(--danger)]">
        Failed to load dashboard. Please try again.
      </div>
    );

  const isPending = stats?.organizationStatus === 'pending';
  const billingStatus = billing?.billingStatus;
  const isTrial = Boolean(billing?.isTrial) || billingStatus === 'trial' || billingStatus === 'trialing';
  const isPastDue = !isTrial && billingStatus === 'past_due';
  const isCanceled = billingStatus === 'canceled' || billingStatus === 'cancelled';

  return (
    <div className="space-y-6">
      {isPending && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-800 p-6">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 bg-amber-100 dark:bg-amber-900/40 rounded-full flex items-center justify-center flex-shrink-0">
              <FiClock className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h3 className="font-semibold text-amber-800 dark:text-amber-200">
                Account Under Review
              </h3>
              <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                Your account is being verified by our team. This typically takes 24-48 hours.
                You&apos;ll receive an email once approved.
              </p>
              <p className="text-sm text-amber-600 dark:text-amber-400 mt-2">
                Need help? Contact{' '}
                <a href="mailto:support@bitnexdial.com" className="underline font-medium">
                  support@bitnexdial.com
                </a>
              </p>
            </div>
          </div>
        </div>
      )}

      <div>
        <h1 className="text-2xl font-bold text-[var(--foreground)]">
          {stats?.organizationName || 'Organization'} Dashboard
        </h1>
        <p className="text-[var(--muted-foreground)] mt-1">Overview of your organization</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div
                className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                  isTrial
                    ? 'bg-blue-100 dark:bg-blue-900/30'
                    : isPastDue
                      ? 'bg-amber-100 dark:bg-amber-900/30'
                      : isCanceled
                        ? 'bg-rose-100 dark:bg-rose-900/30'
                        : isPending
                          ? 'bg-amber-100 dark:bg-amber-900/30'
                          : 'bg-emerald-100 dark:bg-emerald-900/30'
                }`}
              >
                {isTrial ? (
                  <FiClock className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                ) : isPastDue ? (
                  <FiAlertTriangle className="w-5 h-5 text-amber-600" />
                ) : isCanceled ? (
                  <FiAlertCircle className="w-5 h-5 text-rose-600" />
                ) : isPending ? (
                  <FiClock className="w-5 h-5 text-amber-600" />
                ) : (
                  <FiCheckCircle className="w-5 h-5 text-emerald-600" />
                )}
              </div>
              <div>
                <p className="text-sm text-[var(--muted-foreground)]">Status</p>
                <p
                  className={`text-lg font-bold ${
                    isTrial
                      ? 'text-blue-600 dark:text-blue-400'
                      : isPastDue
                        ? 'text-amber-600'
                        : isCanceled
                          ? 'text-rose-600'
                          : isPending
                            ? 'text-amber-600'
                            : 'text-emerald-600'
                  }`}
                >
                  {isTrial
                    ? 'Trial'
                    : isPastDue
                      ? 'Past Due'
                      : isCanceled
                        ? 'Canceled'
                        : isPending
                          ? 'Pending'
                          : 'Active'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-blue-100 dark:bg-blue-900/30">
                <FiUsers className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-[var(--muted-foreground)]">Team Members</p>
                <p className="text-2xl font-bold text-[var(--foreground)]">
                  {stats?.totalUsers ?? 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-indigo-100 dark:bg-indigo-900/30">
                <FiPhone className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                <p className="text-sm text-[var(--muted-foreground)]">Phone Numbers</p>
                <p className="text-2xl font-bold text-[var(--foreground)]">
                  {stats?.activeNumbers ?? 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-purple-100 dark:bg-purple-900/30">
                <FiMessageSquare className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-[var(--muted-foreground)]">SMS Campaign</p>
                <p className="text-lg font-bold text-[var(--foreground)] capitalize">
                  {stats?.smsCampaignStatus?.replace(/_/g, ' ') || 'Not Requested'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
