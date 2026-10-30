'use client';

/**
 * WhatsApp Call Button
 *
 * Context-aware button for the WhatsApp conversation view.
 * Handles the full outbound call flow:
 *   1. No permission → "Request Call Permission" button
 *   2. Permission pending → "Waiting for approval..." (disabled)
 *   3. Permission granted → "Call via WhatsApp" button
 *   4. Call active → hidden (WaCallControls shown instead)
 *
 * Also shows a call icon for user-initiated inbound calls
 * (the customer can always call the business directly).
 *
 * @module components/phone/WaCallButton
 */

import React, { useCallback, useEffect, useState } from 'react';
import { FiPhone, FiLoader, FiClock } from 'react-icons/fi';
import { FaWhatsapp } from 'react-icons/fa';
import { waCallService } from '@/lib/api/services/waCall.service';
import type { WaCallPermission, WaCallPermissionEvent } from '@/lib/whatsapp-call/types';

interface WaCallButtonProps {
  /** Customer's WhatsApp number */
  customerNumber: string;
  /** Customer's display name (for call UI) */
  customerName?: string;
  /** Business phone number ID — resolved from permission API if empty */
  phoneNumberId?: string;
  /**
   * Open the message composer pre-selected on the call-permission template.
   * The agent reviews it and hits Send; the customer taps the in-message button
   * to allow calls (which flips this to "Call" via the WS grant event).
   */
  onRequestCall: () => void;
  /** Initiate call callback */
  onInitiateCall: (
    phoneNumberId: string,
    customerNumber: string,
    customerName?: string
  ) => Promise<void>;
  /** Latest permission event from WebSocket */
  permissionEvent: WaCallPermissionEvent | null;
  /** Whether a call is currently active */
  isCallActive: boolean;
}

export function WaCallButton({
  customerNumber,
  customerName,
  phoneNumberId: phoneNumberIdProp,
  onRequestCall,
  onInitiateCall,
  permissionEvent,
  isCallActive,
}: WaCallButtonProps) {
  const [permission, setPermission] = useState<WaCallPermission | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isInitiating, setIsInitiating] = useState(false);

  // Resolve phoneNumberId: use prop if provided, otherwise from permission record
  const phoneNumberId = phoneNumberIdProp || permission?.phoneNumberId || '';

  // Single fetcher used by both the on-mount effect and the WS-event effect.
  // `showLoading` is true only on the initial fetch — WS-triggered refetches
  // stay silent so the user doesn't see a spinner flash mid-conversation.
  // The returned cleanup flips `ignore`, preventing a slow fetch from
  // stomping newer state if the user switches conversations mid-flight.
  const refetchPermission = useCallback(
    (showLoading: boolean) => {
      if (!customerNumber) return () => {};
      const state = { ignore: false };
      if (showLoading) setIsLoading(true);
      waCallService
        .getPermission(customerNumber)
        .then((p) => {
          if (!state.ignore) setPermission(p);
        })
        .catch(() => {
          if (!state.ignore && showLoading) setPermission(null);
          // On a silent refetch failure, keep existing state instead of nulling it.
        })
        .finally(() => {
          if (!state.ignore && showLoading) setIsLoading(false);
        });
      return () => {
        state.ignore = true;
      };
    },
    [customerNumber]
  );

  // On mount / customer change: fetch with loading spinner.
  useEffect(() => refetchPermission(true), [refetchPermission]);

  // On permission event for this customer: silent refetch from DB.
  // Refetching (rather than synthesizing local state from the event) keeps
  // callsUsed, expiresAt, and id grounded in the source of truth — the
  // previous synthesize-on-event approach hardcoded callsUsed: 0 and raced
  // with the on-mount fetch.
  useEffect(() => {
    if (!permissionEvent) return;
    if (permissionEvent.customerNumber !== customerNumber) return;
    return refetchPermission(false);
  }, [permissionEvent, customerNumber, refetchPermission]);

  // Don't show button during active call
  if (isCallActive) return null;

  // Loading state
  if (isLoading) return null;

  // Backend is the SSOT for "can the agent place a call right now". It
  // accounts for permission status, expiry, AND the rolling 24h quota
  // (Meta's 5-per-24h rule). Never re-derive that rule here.
  const hasActivePermission = permission?.canCall === true;

  // Permission granted — show "Call via WhatsApp"
  if (hasActivePermission) {
    return (
      <button
        type="button"
        onClick={async () => {
          setIsInitiating(true);
          try {
            await onInitiateCall(phoneNumberId, customerNumber, customerName);
          } finally {
            setIsInitiating(false);
          }
        }}
        disabled={isInitiating}
        className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg bg-green-500 text-white hover:bg-green-600 transition-colors disabled:opacity-50"
        title="Call this contact via WhatsApp"
      >
        {isInitiating ? (
          <FiLoader className="w-4 h-4 animate-spin" />
        ) : (
          <FiPhone className="w-4 h-4" />
        )}
        <FaWhatsapp className="w-3.5 h-3.5" />
        Call
      </button>
    );
  }

  // Permission is still valid but the rolling 24h quota is spent. Re-requesting
  // won't help (Meta returns 138017 = already permitted), so we surface the
  // window reset time instead of falling through to "Request Call" — that's
  // the bug the original `calls_used >= 5` lockout caused.
  if (
    permission?.status === 'accepted' &&
    permission.canCall === false &&
    permission.windowResetsAt
  ) {
    const resetTime = new Date(permission.windowResetsAt).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
    return (
      <span
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/30"
        title={`WhatsApp allows 5 calls per 24h to a single contact. Try again at ${resetTime}.`}
      >
        <FiClock className="w-3.5 h-3.5" />
        Quota reached, retry at {resetTime}
      </span>
    );
  }

  // Request sent, awaiting the customer's approval — show a disabled
  // "Waiting for approval" pill (the WS grant event flips this to "Call").
  if (permission?.status === 'pending') {
    return (
      <span
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-[var(--muted)] text-[var(--muted-foreground)] border border-[var(--border)]"
        title="Call request sent — waiting for the customer to allow calls"
      >
        <FiClock className="w-3.5 h-3.5" />
        Waiting for approval…
      </span>
    );
  }

  // No permission — show "Request Permission"
  // phoneNumberId can be empty — backend auto-resolves from user's assigned WA number
  return (
    <button
      type="button"
      onClick={onRequestCall}
      className="flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg border border-green-500 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors"
      title="Send the call-permission template so the customer can allow WhatsApp calls"
    >
      <FiPhone className="w-4 h-4" />
      <FaWhatsapp className="w-3.5 h-3.5" />
      Request Call
    </button>
  );
}
