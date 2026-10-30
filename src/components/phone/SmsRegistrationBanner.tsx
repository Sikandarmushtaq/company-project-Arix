'use client';

/**
 * SMS registration (10DLC) prompt shown at the top of the SMS page.
 *
 * US carriers block SMS from any number whose business isn't 10DLC-registered
 * (unregistered A2P is dropped, not throttled), so a new org can't text until it
 * registers. This nudges the OWNER — the only role that can register — to do so,
 * linking to /org/registrations. Hidden once approved, and never shown to members
 * (who can't act on it). Owner-gate mirrors the CNAM setup modal: the outer guard
 * returns null BEFORE the owner-only /org hook runs, so members never fetch it.
 *
 * @module components/phone/SmsRegistrationBanner
 */

import Link from 'next/link';
import { FiMessageSquare, FiArrowRight } from 'react-icons/fi';
import { usePermissions } from '@/lib/hooks/usePermissions';
import { useOrgSmsCampaign, useOrgCallVerification } from '@/lib/hooks/useOrg';

export function SmsRegistrationBanner() {
  const { isOwner } = usePermissions();
  if (!isOwner) return null;
  return <SmsRegistrationBannerInner />;
}

function SmsRegistrationBannerInner() {
  const { data: smsCampaign } = useOrgSmsCampaign();
  const { data: cv } = useOrgCallVerification();

  // Wait for the authoritative signal(s) before deciding — otherwise an org that
  // should be hidden would briefly FLASH the prompt on every load. If the query
  // errors (stays undefined) we stay hidden — better to not nag than nag wrongly.
  if (!smsCampaign) return null;

  // ── SSOT path ──────────────────────────────────────────────────────────────
  // `registrationStatus` is a dedicated SMS-send-capability field, decoupled from
  // calling KYC. When present, it alone decides: only nudge when the org still
  // needs to register its OWN 10DLC. 'registered'/'shared' can send; 'pending' is
  // under review; 'not_required' has no SMS plan — all hide.
  const reg = smsCampaign.registrationStatus;
  if (reg) {
    return reg === 'unregistered' || reg === 'rejected' ? <BannerBody /> : null;
  }

  // ── Legacy fallback (reg === null: pre-migration orgs, NOT backfilled) ───────
  // Preserve the prior behaviour exactly so existing orgs are unaffected. Hide
  // when the org was cleared via KYC ('approved'/'not_required', e.g. Wise Choice
  // Realty) or its 10DLC campaign was approved; otherwise nudge.
  if (!cv) return null;
  if (
    cv.status === 'approved' ||
    cv.status === 'not_required' ||
    smsCampaign.review?.status === 'approved'
  ) {
    return null;
  }

  return <BannerBody />;
}

function BannerBody() {
  return (
    <div
      className="flex items-center gap-3 border-b border-amber-200 bg-amber-50 px-4 py-2.5 text-sm
        dark:border-amber-800/60 dark:bg-amber-900/20"
      role="status"
    >
      <span
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-600
          dark:bg-amber-900/40 dark:text-amber-300"
      >
        <FiMessageSquare className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-amber-800 dark:text-amber-200">
          Register your business to send SMS
        </p>
        <p className="truncate text-amber-700 dark:text-amber-300/90">
          US carriers require 10DLC registration before you can send text messages — it takes about
          72 hours.
        </p>
      </div>
      <Link
        href="/org/registrations"
        className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-amber-600 px-3.5 py-2 text-xs
          font-semibold text-white transition hover:bg-amber-700"
      >
        Register now
        <FiArrowRight className="h-4 w-4" />
      </Link>
    </div>
  );
}
