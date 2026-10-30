'use client';

/**
 * WhatsApp Manager-Oversight Feature Toggles
 *
 * Admin-only panel on the org detail page. Three independent toggles:
 *   1. Typing Indicators       — managers see "Agent X is typing…"
 *   2. Live Conversation Watch — managers open any conversation and see
 *                                the customer's incoming messages + the
 *                                agent's draft text live, before send.
 *   3. Customer Typing (Meta)  — when an agent types, also tell Meta's
 *                                WhatsApp Cloud API to show "Business is
 *                                typing…" on the customer's screen.
 *                                Free per Meta's pricing, but only valid
 *                                inside an open service window.
 *
 * Each toggle PATCHes a single flag (partial body on the backend),
 * audit-logged + broadcast over `wa:feature_flags_updated` so every
 * open client in the org refreshes their cache without a page reload.
 *
 * @module app/admin/organizations/[id]/WaFeaturesCard
 */

import React, { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FiLoader, FiEye, FiEdit3, FiMessageCircle } from 'react-icons/fi';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui';
import { toast } from '@/lib/stores/toast';
import {
  getOrgWaFeatures,
  updateOrgWaFeatures,
  type WaFeatureFlags,
} from '@/lib/api/services/admin-analytics.api';

interface ToggleRowProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  value: boolean;
  disabled: boolean;
  onChange: (value: boolean) => void;
}

function ToggleRow({ icon, title, description, value, disabled, onChange }: ToggleRowProps) {
  // Local optimistic state — flips immediately on click, then the parent
  // sends the PATCH and either accepts the change (re-renders with the
  // new server value) or rolls back via toast + revert.
  return (
    <div className="flex items-start gap-4 py-4 border-b border-[var(--border)] last:border-b-0">
      <div className="mt-1 text-[var(--muted-foreground)]">{icon}</div>
      <div className="flex-1 min-w-0">
        <h4 className="font-medium text-[var(--foreground)]">{title}</h4>
        <p className="text-sm text-[var(--muted-foreground)] mt-1">{description}</p>
      </div>
      <label
        className={`relative inline-flex items-center cursor-pointer ${
          disabled ? 'opacity-50 cursor-not-allowed' : ''
        }`}
      >
        <input
          type="checkbox"
          className="sr-only peer"
          checked={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
          aria-label={`Toggle ${title}`}
        />
        <span
          className="
            w-11 h-6 rounded-full bg-[var(--muted)]
            peer-checked:bg-[var(--primary)]
            peer-focus-visible:ring-2 peer-focus-visible:ring-[var(--primary)]/40
            after:content-[''] after:absolute after:top-0.5 after:left-0.5
            after:bg-white after:rounded-full after:h-5 after:w-5
            after:transition-transform after:duration-200
            peer-checked:after:translate-x-5
          "
        />
      </label>
    </div>
  );
}

export function WaFeaturesCard({ orgId }: { orgId: number }) {
  const queryClient = useQueryClient();
  const queryKey = ['admin', 'organizations', orgId, 'wa-features'] as const;

  const { data, isLoading, isError } = useQuery({
    queryKey,
    queryFn: () => getOrgWaFeatures(orgId),
    staleTime: 30_000,
  });

  // Track which key is currently flipping so we can show a tiny spinner
  // on just that row instead of a global lockout. The whole flag set
  // re-renders together on success regardless.
  const [pendingKey, setPendingKey] = useState<keyof WaFeatureFlags | null>(null);

  const mutation = useMutation({
    mutationFn: (patch: Partial<WaFeatureFlags>) => updateOrgWaFeatures(orgId, patch),
    onSuccess: (next) => {
      // Cache write avoids a needless refetch — backend returns the
      // post-update flag set so we already have the truth in hand.
      queryClient.setQueryData(queryKey, next);
      toast.success('WhatsApp features updated');
    },
    onError: (err) => {
      // Server rejected (validation, auth, network). Re-fetch to undo
      // the optimistic flip — easier than tracking the previous value
      // per toggle since the cache is the source of truth.
      queryClient.invalidateQueries({ queryKey });
      const message = err instanceof Error ? err.message : 'Failed to update features';
      toast.error(message);
    },
    onSettled: () => {
      setPendingKey(null);
    },
  });

  // Optimistic local copy so the toggle visually flips the instant the
  // user clicks — the PATCH is in flight in the background.
  const [optimistic, setOptimistic] = useState<WaFeatureFlags | null>(null);
  useEffect(() => {
    if (data) setOptimistic(data);
  }, [data]);

  const flags = optimistic ?? data;

  const handleToggle = (key: keyof WaFeatureFlags, next: boolean) => {
    if (!flags) return;
    setOptimistic({ ...flags, [key]: next });
    setPendingKey(key);
    mutation.mutate({ [key]: next });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>WhatsApp Manager Oversight</CardTitle>
        <p className="text-sm text-[var(--muted-foreground)] mt-1">
          Per-org controls for typing indicators and live conversation watch. All toggles default to
          off — managers see nothing extra until opted in.
        </p>
      </CardHeader>
      <CardContent>
        {isLoading || !flags ? (
          <div className="flex items-center justify-center py-6">
            <FiLoader className="w-6 h-6 animate-spin text-[var(--primary)]" />
          </div>
        ) : isError ? (
          <p className="text-sm text-[var(--danger)]">Failed to load feature flags.</p>
        ) : (
          <div>
            <ToggleRow
              icon={
                pendingKey === 'typingIndicators' ? (
                  <FiLoader className="w-5 h-5 animate-spin" />
                ) : (
                  <FiEdit3 className="w-5 h-5" />
                )
              }
              title="Typing Indicators"
              description="Managers see a 'typing…' badge on conversations where an agent is currently composing a reply. No message content is exposed — just presence."
              value={flags.typingIndicators}
              disabled={pendingKey !== null}
              onChange={(v) => handleToggle('typingIndicators', v)}
            />
            <ToggleRow
              icon={
                pendingKey === 'liveWatch' ? (
                  <FiLoader className="w-5 h-5 animate-spin" />
                ) : (
                  <FiEye className="w-5 h-5" />
                )
              }
              title="Live Conversation Watch"
              description="Managers can open any agent's conversation and watch it in real time — customer messages as they arrive AND the agent's draft text before it's sent. Useful for training and stepping in on tricky cases."
              value={flags.liveWatch}
              disabled={pendingKey !== null}
              onChange={(v) => handleToggle('liveWatch', v)}
            />
            <ToggleRow
              icon={
                pendingKey === 'customerTypingIndicator' ? (
                  <FiLoader className="w-5 h-5 animate-spin" />
                ) : (
                  <FiMessageCircle className="w-5 h-5" />
                )
              }
              title="Show typing to customer (via Meta)"
              description="When an agent types, also tell Meta's WhatsApp Cloud API to show 'Business is typing…' on the customer's screen. Free from Meta, but only valid inside an open 24-hour service window."
              value={flags.customerTypingIndicator}
              disabled={pendingKey !== null}
              onChange={(v) => handleToggle('customerTypingIndicator', v)}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
