'use client';

/**
 * Hidden call-minute soft cap (admin).
 *
 * Every "unlimited" org actually has an internal monthly outbound-minute ceiling
 * (a fair-use limit). It is HIDDEN from the customer: when reached, their calls
 * stop and they see a neutral "contact your administrator" message — never a
 * limit or a usage number. This card lets a super-admin see and edit the ceiling
 * per org.
 *
 * Values (organizations.call_minutes_soft_cap):
 *   blank → deployment default (env CALL_SOFT_CAP_DEFAULT_MINUTES)
 *   0     → exempt (truly unlimited)
 *   N>0   → cap this org at N minutes/month
 *
 * @module app/admin/organizations/[id]/CallSoftCapCard
 */

import React, { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FiLoader, FiPhone } from 'react-icons/fi';
import { Card, CardContent, CardHeader, CardTitle, Button } from '@/components/ui';
import { toast } from '@/lib/stores/toast';
import { getOrgCallSoftCap, updateOrgCallSoftCap } from '@/lib/api/services/admin-analytics.api';

export function CallSoftCapCard({ orgId }: { orgId: number }) {
  const queryClient = useQueryClient();
  const queryKey = ['admin', 'organizations', orgId, 'call-soft-cap'] as const;

  const { data, isLoading, isError } = useQuery({
    queryKey,
    queryFn: () => getOrgCallSoftCap(orgId),
    staleTime: 30_000,
  });

  // Text input mirrors the RAW per-org value: '' = deployment default, '0' = exempt.
  const [input, setInput] = useState('');
  useEffect(() => {
    if (data) setInput(data.rawMinutes != null ? String(data.rawMinutes) : '');
  }, [data]);

  const mutation = useMutation({
    mutationFn: (minutes: number | null) => updateOrgCallSoftCap(orgId, minutes),
    onSuccess: (next) => {
      queryClient.setQueryData(queryKey, next);
      toast.success('Call limit updated');
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Failed to update call limit');
    },
  });

  const save = () => {
    const trimmed = input.trim();
    if (trimmed === '') {
      mutation.mutate(null); // revert to deployment default
      return;
    }
    const n = Number(trimmed);
    if (!Number.isInteger(n) || n < 0) {
      toast.error('Enter a whole number of minutes (0 = unlimited)');
      return;
    }
    mutation.mutate(n);
  };

  const effLabel = !data
    ? '—'
    : data.effectiveMinutes == null
      ? data.rawMinutes === 0
        ? 'Unlimited (exempt)'
        : 'Unlimited'
      : `${data.effectiveMinutes.toLocaleString()} min / month${
          data.rawMinutes == null ? ' (deployment default)' : ' (custom)'
        }`;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Call minutes (fair-use)</CardTitle>
        <p className="text-sm text-[var(--muted-foreground)] mt-1">
          Internal monthly outbound-minute ceiling for this org. Hidden from the customer — when
          reached, their calls stop and they see a neutral &ldquo;contact your administrator&rdquo;
          message (no limit or number shown). Leave blank for the default; <b>0</b> = unlimited
          (exempt).
        </p>
      </CardHeader>
      <CardContent>
        {isLoading || !data ? (
          <div className="flex items-center justify-center py-6">
            <FiLoader className="w-6 h-6 animate-spin text-[var(--primary)]" />
          </div>
        ) : isError ? (
          <p className="text-sm text-[var(--danger)]">Failed to load the call limit.</p>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <FiPhone className="h-4 w-4 text-[var(--muted-foreground)]" />
              <span className="text-[var(--muted-foreground)]">Current:</span>
              <span className="font-semibold text-[var(--foreground)]">{effLabel}</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="number"
                min={0}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={data.defaultMinutes > 0 ? `Default (${data.defaultMinutes})` : 'Unlimited'}
                className="w-40 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--primary)]/40"
                aria-label="Call minutes soft cap"
              />
              <span className="text-sm text-[var(--muted-foreground)]">min / month</span>
              <Button onClick={save} loading={mutation.isPending}>
                Save
              </Button>
            </div>
            <div className="flex flex-wrap gap-3 text-xs">
              <button
                type="button"
                className="text-[var(--primary)] hover:underline disabled:opacity-50"
                disabled={mutation.isPending}
                onClick={() => {
                  setInput('');
                  mutation.mutate(null);
                }}
              >
                Reset to default{data.defaultMinutes > 0 ? ` (${data.defaultMinutes})` : ''}
              </button>
              <button
                type="button"
                className="text-[var(--primary)] hover:underline disabled:opacity-50"
                disabled={mutation.isPending}
                onClick={() => {
                  setInput('0');
                  mutation.mutate(0);
                }}
              >
                Set unlimited (exempt)
              </button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
