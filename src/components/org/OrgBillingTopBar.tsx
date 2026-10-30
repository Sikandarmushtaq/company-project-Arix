'use client';

import React from 'react';
import Link from 'next/link';
import { FiInfo, FiArrowRight } from 'react-icons/fi';
import { useAuthStore } from '@/lib/stores/auth';
import { useOrgBilling } from '@/lib/hooks/useOrg';
import { crossAppHref } from '@/lib/utils/routing';

export default function OrgBillingTopBar() {
  const { user } = useAuthStore();
  const { data: billing } = useOrgBilling();

  // Only org owners manage billing
  if (user?.role !== 'owner' || !billing) return null;

  const status = billing.billingStatus;
  const isTrial = Boolean(billing.isTrial) || status === 'trial' || status === 'trialing';
  const isPastDue = !isTrial && status === 'past_due';
  const isCanceled = !isTrial && (status === 'canceled' || status === 'cancelled');

  if (!isPastDue && !isCanceled) return null;

  const billingHref = crossAppHref('admin', '/org/billing');

  return (
    <aside
      aria-label="Billing status notification"
      className="w-full bg-[#00488f] text-white px-4 sm:px-6 py-2.5 flex items-center justify-between font-sans text-sm font-medium tracking-normal select-none shadow-sm flex-shrink-0"
    >
      {/* Left: Badge + Info icon */}
      <div className="flex items-center gap-1.5 shrink-0">
        <span className="font-semibold text-sm tracking-normal">
          {isPastDue ? 'Past Due' : 'Canceled'}
        </span>
        <FiInfo className="w-3.5 h-3.5 text-blue-200" aria-hidden="true" />
      </div>

      {/* Center: Message */}
      <div className="flex-1 text-center px-4 truncate hidden sm:block text-blue-50/95 font-normal text-sm tracking-normal">
        {isPastDue
          ? 'Your organization has an outstanding balance for this billing period. Please settle your payment to prevent service interruption.'
          : 'Your subscription is currently inactive. Reactivate your plan to maintain full services.'}
      </div>

      {/* Right: Direct Action Button */}
      <div className="flex items-center gap-2.5 shrink-0">
        <Link
          href={billingHref}
          className="px-3 py-1 rounded-lg bg-white text-[#00488f] hover:bg-blue-50 font-sans font-semibold text-xs tracking-normal transition-all shadow-sm inline-flex items-center gap-1"
        >
          {isPastDue ? 'Pay now' : 'Reactivate'}
          <FiArrowRight className="w-3 h-3" />
        </Link>
      </div>
    </aside>
  );
}

