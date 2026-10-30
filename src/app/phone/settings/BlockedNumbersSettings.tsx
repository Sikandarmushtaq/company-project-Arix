'use client';

/**
 * Blocked Numbers Settings
 *
 * Block/unblock phone numbers with a searchable list.
 *
 * @module app/phone/settings/BlockedNumbersSettings
 */

import React, { useState, useCallback } from 'react';
import { FiShield } from 'react-icons/fi';
import { Card, CardContent, CardHeader, CardTitle, Button, Input } from '@/components/ui';
import { formatPhoneUS, normalizePhone } from '@/lib/utils/phone';
import { formatRelativeTime } from '@/lib/utils/datetime';
import { useBlockedContacts, useBlockContact, useUnblockContact } from '@/lib/hooks';
import { toast } from '@/lib/stores/toast';

export function BlockedNumbersSettings() {
  const { data: blockedContacts, isLoading: blockedLoading } = useBlockedContacts();
  const blockContact = useBlockContact();
  const unblockContact = useUnblockContact();
  const [blockNumberInput, setBlockNumberInput] = useState('');

  const handleBlockNumber = useCallback(() => {
    const normalized = normalizePhone(blockNumberInput);
    if (!normalized) return;
    blockContact.mutate(normalized, {
      onSuccess: () => {
        toast.success('Number blocked');
        setBlockNumberInput('');
      },
      onError: () => toast.error('Failed to block number'),
    });
  }, [blockContact, blockNumberInput]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <FiShield className="w-4 h-4 text-[var(--foreground)]" />
          Blocked Numbers
          {blockedContacts && blockedContacts.length > 0 && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 font-medium">
              {blockedContacts.length}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 space-y-4">
        <div className="flex items-center gap-2">
          <Input
            placeholder="Phone number to block"
            value={blockNumberInput}
            onChange={(e) => setBlockNumberInput(e.target.value)}
            className="flex-1 h-9 text-sm"
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleBlockNumber();
            }}
          />
          <Button
            size="sm"
            onClick={handleBlockNumber}
            disabled={blockContact.isPending || !blockNumberInput.trim()}
          >
            Block
          </Button>
        </div>

        {blockedLoading ? (
          <div className="flex items-center justify-center py-4">
            <div className="animate-spin rounded-full h-5 w-5 border-2 border-[var(--border)] border-t-transparent" />
          </div>
        ) : blockedContacts && blockedContacts.length > 0 ? (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {blockedContacts.map((blocked) => (
              <div
                key={blocked.id}
                className="flex items-center justify-between py-2 px-3 rounded-lg bg-[var(--muted)]"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[var(--foreground)] truncate">
                    {formatPhoneUS(blocked.phoneNumber)}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
                    {blocked.name && <span>{blocked.name}</span>}
                    <span>{formatRelativeTime(blocked.blockedAt)}</span>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    unblockContact.mutate(blocked.id, {
                      onSuccess: () => toast.success('Number unblocked'),
                      onError: () => toast.error('Failed to unblock number'),
                    })
                  }
                  disabled={unblockContact.isPending}
                  className="text-red-600 hover:text-red-700 dark:text-red-400"
                >
                  Unblock
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-[var(--muted-foreground)] text-center py-4">
            No blocked numbers
          </p>
        )}
      </CardContent>
    </Card>
  );
}
