'use client';

/**
 * Locked-out agents panel. Shown inside the Edit Customer modal so a
 * manager can see who's been locked out via chat-transfer and restore
 * any of them with one click. Closes the one-way-door gap that the raw
 * chat-transfer feature otherwise leaves.
 *
 * Returns null when there are no lockouts so the modal stays clean for
 * the common case.
 */

import React from 'react';
import { Button } from '@/components/ui';
import { useCustomerLockouts, useRemoveCustomerLockout } from '@/lib/hooks';
import { formatRelativeTime } from '@/lib/utils/datetime';

interface Props {
  customerId: number;
}

export function CustomerLockoutsSection({ customerId }: Props) {
  const { data: lockouts, isLoading } = useCustomerLockouts(customerId);
  const removeMut = useRemoveCustomerLockout();

  if (isLoading) return null;
  if (!lockouts || lockouts.length === 0) return null;

  return (
    <div className="border-t border-[var(--border)] pt-4">
      <h4 className="text-sm font-medium text-[var(--foreground)] mb-1">Locked-out agents</h4>
      <p className="text-xs text-[var(--muted-foreground)] mb-3">
        These agents can no longer see this customer's conversation. Restore access to give them
        visibility back via their own past activity.
      </p>
      <div className="space-y-1">
        {lockouts.map((l) => (
          <div
            key={l.userId}
            className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-[var(--muted)]/40 text-sm"
          >
            <div className="min-w-0">
              <p className="font-medium text-[var(--foreground)] truncate">{l.userName}</p>
              <p className="text-xs text-[var(--muted-foreground)] truncate">
                Locked out {formatRelativeTime(l.lockedAt)}
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => removeMut.mutate({ customerId, userId: l.userId })}
              disabled={removeMut.isPending}
            >
              Restore access
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
