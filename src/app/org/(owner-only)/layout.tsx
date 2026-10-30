'use client';

/**
 * Owner-only gate for /org/* routes that require full org-admin access.
 *
 * Scoped to this route group so that other /org/* routes (specifically
 * /org/whatsapp/*) can stay reachable for managers. The parent
 * app/org/layout.tsx already authenticates and allows owner+manager — this
 * layer only narrows the role to owner.
 *
 * If a manager somehow lands on a route inside this group (e.g. via a
 * stale link), they're redirected to their default destination.
 */

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/stores/auth';
import { getDefaultRouteForRole } from '@/lib/utils/routing';

export default function OwnerOnlyLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, _hasHydrated } = useAuthStore();

  useEffect(() => {
    if (!_hasHydrated) return;
    if (user?.role && user.role !== 'owner') {
      router.replace(getDefaultRouteForRole(user.role));
    }
  }, [_hasHydrated, user?.role, router]);

  if (!_hasHydrated || user?.role !== 'owner') {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-[var(--border)] border-t-transparent" />
      </div>
    );
  }

  return <>{children}</>;
}

