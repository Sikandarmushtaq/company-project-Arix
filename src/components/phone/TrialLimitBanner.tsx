'use client';

import React from 'react';
import Link from 'next/link';
import { FiPhone, FiMessageSquare, FiArrowRight, FiShield, FiClock } from 'react-icons/fi';
import { useCallVerificationUsage } from '@/lib/hooks/useCallVerificationUsage';
import { useAuthStore } from '@/lib/stores/auth';

type Variant = 'calls' | 'sms';

/** Human duration from seconds: "45s", "3m", "99m 29s". */
function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  if (m === 0) return `${rem}s`;
  if (rem === 0) return `${m}m`;
  return `${m}m ${rem}s`;
}

/**
 * Ultra-compact "call minutes left this month" pill for the dialer status row — sits
 * to the LEFT of the Ready indicator. Capped (pre-KYC) reskin orgs only; renders
 * nothing for verified/prod users. Live via the same WS usage snapshot (no poll).
 */
export function TrialMinutesLeft() {
  const usage = useCallVerificationUsage();
  // Calling is only limited while UNVERIFIED (capped). Once business KYC is
  // approved, calling is unlimited — no pill. Prod/verified: nothing.
  if (!usage || !usage.metered || !usage.capped) return null;

  const capSeconds = usage.callMinutesPerMonth * 60;
  const remainingSeconds = Math.max(0, capSeconds - usage.callSecondsUsedThisMonth);
  // Show remaining minutes with sub-minute precision (one decimal) so a short call
  // is reflected accurately — e.g. a 30s call shows "499.5 min left", not a whole
  // minute deducted (499) nor nothing (500). Whole values render without a decimal.
  const remainingMin = remainingSeconds / 60;
  const remainingMinutesLabel = Number.isInteger(remainingMin)
    ? String(remainingMin)
    : remainingMin.toFixed(1);
  const atLimit = remainingSeconds <= 0;
  const low = !atLimit && remainingSeconds <= 10 * 60;

  const tone = atLimit
    ? 'border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400'
    : low
      ? 'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400'
      : 'border-[var(--border)] bg-[var(--muted)]/40 text-[var(--muted-foreground)]';

  const label = atLimit
    ? 'Limit reached'
    : remainingSeconds < 60
      ? `${remainingSeconds}s left`
      : `${remainingMinutesLabel} min left`;

  return (
    <span
      title={
        atLimit
          ? 'Monthly calling limit reached — verify your business to unlock unlimited calling'
          : `${formatDuration(remainingSeconds)} of your ${usage.callMinutesPerMonth} plan minutes this month remaining · unlimited after verification`
      }
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium tabular-nums transition-colors ${tone}`}
    >
      <FiClock className="h-3.5 w-3.5 shrink-0" />
      {label}
    </span>
  );
}

/**
 * Ultra-compact "SMS left this month" pill for the Messages header — sits next to the
 * "Messages" title. Capped (pre-KYC) reskin orgs only; renders nothing for
 * verified/prod users. Live via the same WS usage snapshot (no polling).
 */
export function TrialSmsLeft() {
  const usage = useCallVerificationUsage();
  if (!usage || !usage.metered) return null;

  const remaining = Math.max(0, usage.smsPerMonth - usage.smsUsedThisMonth);
  const atLimit = remaining <= 0;
  const low = !atLimit && remaining <= 10;

  const tone = atLimit
    ? 'border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400'
    : low
      ? 'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400'
      : 'border-[var(--border)] bg-[var(--muted)]/40 text-[var(--muted-foreground)]';

  return (
    <span
      title={
        atLimit
          ? usage.allowanceSource === 'bundle'
            ? "You've used all your SMS package this cycle — buy a larger SMS package in Plan & billing"
            : usage.capped
              ? 'Monthly SMS limit reached — verify your business, then complete 10DLC to add SMS packages'
              : 'Monthly SMS limit reached — complete 10DLC, then add an SMS package in Plan & billing'
          : `${remaining} of your ${usage.smsPerMonth} ${
              usage.allowanceSource === 'bundle' ? 'SMS package this cycle' : 'plan SMS this month'
            } remaining`
      }
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium tabular-nums transition-colors ${tone}`}
    >
      <FiMessageSquare className="h-3.5 w-3.5 shrink-0" />
      {atLimit ? 'Limit reached' : `${remaining} SMS left`}
    </span>
  );
}

/**
 * NEUTRAL "calling unavailable" banner shown when an org has hit its HIDDEN monthly
 * call soft cap. DELIBERATELY reveals NOTHING about a limit/quota/usage — it just
 * tells the user to contact their admin (a product decision). Applies to the
 * "unlimited" tier (approved / admin-created) — independent of the trial `capped`
 * state, so it renders even for orgs that show as unlimited. Live via the WS usage
 * snapshot. Do NOT add minutes, a progress bar, or the word "limit" here.
 */
export function CallsBlockedBanner({ className = '' }: { className?: string }) {
  const usage = useCallVerificationUsage();
  if (!usage?.callsBlocked) return null;

  return (
    <div
      className={`rounded-xl border border-red-500/30 bg-red-500/10 p-3.5 shadow-sm ${className}`}
      role="alert"
    >
      <div className="flex items-center gap-2.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-red-500/15 text-red-600 dark:text-red-400">
          <FiPhone className="h-4 w-4" />
        </span>
        <p className="text-[13px] font-medium text-red-700 dark:text-red-300">
          Calling is currently unavailable. Please contact your administrator to continue making
          calls.
        </p>
      </div>
    </div>
  );
}

/**
 * "Monthly SMS limit reached" banner — the SMS twin of CallsBlockedBanner, shown on
 * the Messages page when outbound SMS is blocked (`usage.smsBlocked`). Message is
 * tier-aware: a METERED org has a VISIBLE allowance it can top up → an "add an SMS
 * package" upgrade prompt; the UNLIMITED (soft-cap) tier is a HIDDEN fair-use
 * ceiling → a neutral "contact your administrator" line (no numbers), mirroring the
 * call soft cap. Live via the WS usage snapshot.
 */
export function SmsBlockedBanner({ className = '' }: { className?: string }) {
  const usage = useCallVerificationUsage();
  if (!usage?.smsBlocked) return null;
  // smsPerMonth > 0 = a visible, toppable allowance (metered); 0 = hidden soft cap.
  const hasVisibleAllowance = usage.smsPerMonth > 0;

  return (
    <div
      className={`rounded-xl border border-red-500/30 bg-red-500/10 p-3.5 shadow-sm ${className}`}
      role="alert"
    >
      <div className="flex items-center gap-2.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-red-500/15 text-red-600 dark:text-red-400">
          <FiMessageSquare className="h-4 w-4" />
        </span>
        <p className="text-[13px] font-medium text-red-700 dark:text-red-300">
          {hasVisibleAllowance
            ? "You've reached your monthly SMS limit. Add an SMS package in Plan & billing — or contact your administrator — to keep sending messages. (Incoming messages still arrive.)"
            : 'Texting is currently unavailable. Please contact your administrator to continue sending messages.'}
        </p>
      </div>
    </div>
  );
}

/**
 * Compact, live "trial limits" banner for capped (pre-KYC) reskin orgs. Shows the
 * relevant monthly allowance for the page it's on (calls on the dialer, SMS on the
 * messaging page) with a live progress bar driven over WebSocket. Renders nothing
 * for verified/prod orgs.
 */
export function TrialLimitBanner({
  variant,
  className = '',
}: {
  variant: Variant;
  className?: string;
}) {
  const usage = useCallVerificationUsage();
  const role = useAuthStore((s) => s.user?.role);

  // The "Trial mode / Verify" banner is the pre-KYC state only. Once verified,
  // calling is unlimited and the compact SMS pill handles ongoing usage — no banner.
  if (!usage || !usage.capped) return null;

  const isCalls = variant === 'calls';

  // Calls are metered in SECONDS so a sub-minute call still visibly moves the
  // meter (the cap itself is second-precise: it blocks at callMinutesPerMonth×60).
  // SMS is metered in whole messages.
  const usedRaw = isCalls ? usage.callSecondsUsedThisMonth : usage.smsUsedThisMonth;
  const maxRaw = isCalls ? usage.callMinutesPerMonth * 60 : usage.smsPerMonth;
  const remainingRaw = Math.max(0, maxRaw - usedRaw);
  const pct = Math.min(100, Math.round((usedRaw / Math.max(1, maxRaw)) * 100));
  const atLimit = usedRaw >= maxRaw;

  const remainingLabel = isCalls ? formatDuration(remainingRaw) : `${remainingRaw} SMS`;
  const usedLabel = isCalls
    ? `${formatDuration(usedRaw)} / ${usage.callMinutesPerMonth}m`
    : `${usedRaw} / ${usage.smsPerMonth} SMS`;
  const label = isCalls ? 'Calling' : 'Messaging';
  const Icon = isCalls ? FiPhone : FiMessageSquare;

  // Progress colour ramps green → amber → red as the month's allowance is consumed.
  const barColor = atLimit
    ? 'bg-red-500'
    : pct >= 70
      ? 'bg-amber-500'
      : 'bg-emerald-500';
  const isOwner = role === 'owner';

  return (
    <div className={`rounded-xl border border-[var(--border)] bg-[var(--card)] p-3.5 shadow-sm ${className}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--primary)]/10 text-[var(--primary)]">
            <Icon className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400">
                Trial mode
              </span>
              <span className="text-xs text-[var(--muted-foreground)]">· {label} limit</span>
            </div>
            <p className="truncate text-[13px] text-[var(--muted-foreground)]">
              {atLimit ? (
                <span className="font-medium text-red-600 dark:text-red-400">
                  Monthly limit reached
                </span>
              ) : (
                <>
                  <span className="font-semibold text-[var(--foreground)]">{remainingLabel}</span>{' '}
                  left this month
                </>
              )}
            </p>
          </div>
        </div>

        {isOwner ? (
          <Link
            href="/org/registrations/call-verification"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-[var(--primary)] px-3 py-1.5 text-xs font-semibold text-[var(--primary-foreground)] transition hover:opacity-90"
          >
            <FiShield className="h-3.5 w-3.5" />
            Verify
            <FiArrowRight className="h-3.5 w-3.5" />
          </Link>
        ) : (
          <span className="shrink-0 text-[11px] text-[var(--muted-foreground)]">
            Ask your admin to verify
          </span>
        )}
      </div>

      {/* Progress */}
      <div className="mt-2.5">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--muted)]">
          <div
            className={`h-full rounded-full transition-all duration-500 ${barColor}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="mt-1 flex items-center justify-between text-[11px] text-[var(--muted-foreground)]">
          <span>{usedLabel} used</span>
          <span>{isCalls ? 'Unlimited after verification' : 'SMS packages after 10DLC'}</span>
        </div>
      </div>
    </div>
  );
}
