'use client';

import { FiLock } from 'react-icons/fi';

/**
 * Shown in place of a feature when the user's tenant is not subscribed to the
 * module that powers it. We keep the nav item visible (so agents know the
 * feature exists) but gate the page behind this notice — they contact their
 * admin rather than being confused by a missing menu entry.
 */
export function NotSubscribed({ feature }: { feature: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center min-h-[60vh] px-6 text-center">
      <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--muted)]">
        <FiLock className="h-7 w-7 text-[var(--muted-foreground)]" aria-hidden="true" />
      </div>
      <h2 className="mb-2 text-xl font-semibold text-[var(--foreground)]">
        {feature} isn&apos;t enabled
      </h2>
      <p className="max-w-md text-[var(--muted-foreground)]">
        Your organization isn&apos;t subscribed to {feature}. Please contact your administrator to
        enable it for your account.
      </p>
    </div>
  );
}
