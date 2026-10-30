'use client';

/**
 * /admin/whatsapp/oversight — Manager + admin only.
 *
 * Cross-agent WhatsApp read-only oversight: pick any conversation in the
 * org, see who's handling it, watch the timeline + live draft in real
 * time. Composer is intentionally absent; barge-in lands in v2.
 *
 * Route-level gates (UX only — server enforces the same):
 *   1. role must be manager or admin → otherwise redirect to /admin
 *   2. org must have at least one of `typingIndicators` / `liveWatch`
 *      enabled → otherwise show a "feature not enabled" stub
 *
 * Real-time freshness comes from the existing `wa:received` / `wa:sent`
 * org-room broadcasts: managers are already auto-joined to those rooms
 * by the WS server, so the page just listens here and invalidates the
 * conversation list cache on each event arrival.
 *
 * @module app/admin/whatsapp/oversight/page
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { FiEye } from 'react-icons/fi';
import { usePermissions } from '@/lib/hooks/usePermissions';
import { useSocket } from '@/lib/providers/SocketProvider';
import { useWaOversightConversations, waOversightKeys } from '@/lib/hooks';
import { normalizePhone } from '@/lib/utils/phone';
import { WaOversightConversationList } from './_components/WaOversightConversationList';
import { WaOversightMessageThread } from './_components/WaOversightMessageThread';
import type { OversightFilterState } from './_components/WaOversightFilters';

const INITIAL_FILTERS: OversightFilterState = {
  search: '',
  agentUserId: null,
  unreadOnly: false,
};

export default function WaOversightPage() {
  const router = useRouter();
  const { isAdmin, isManager } = usePermissions();
  const canSee = isAdmin || isManager;

  // Hard route guard — even though the sidebar hides this for ineligible
  // roles, a bookmark from before role change shouldn't render the page.
  useEffect(() => {
    if (!canSee) router.replace('/admin');
  }, [canSee, router]);

  const [filters, setFilters] = useState<OversightFilterState>(INITIAL_FILTERS);
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null);

  // Pull the conversation list directly so we can read the agent label
  // from cached data. React Query dedupes this with the identical call
  // inside `WaOversightConversationList`, so it's a free cache read,
  // not a second fetch. Reading from the live cache (instead of a
  // click-time snapshot) means the "Handled by" label updates
  // automatically when an agent is reassigned — no stale snapshot.
  //
  // The hook expects `agentUserId` as `number | undefined`, but
  // `OversightFilterState` carries `null` for "no filter" — coerce
  // here so cache-key normalization inside the hook is identical to
  // the call from the list component.
  const conversationsQuery = useWaOversightConversations({
    search: filters.search,
    agentUserId: filters.agentUserId ?? undefined,
    unreadOnly: filters.unreadOnly,
  });

  // Mobile pane toggling — when a conversation is picked on mobile, the
  // list slides out and the thread takes over. Back button reverses it.
  const showThreadOnMobile = !!selectedPhone;

  // Live invalidation on inbound/outbound WA traffic so the manager's
  // list AND the open thread stay in sync without a manual refresh.
  // We don't try to surgically patch — invalidate is simpler, React
  // Query dedupes refetches, and pages are paginated so cost is bounded.
  //
  // The thread invalidation is keyed by the currently-selected customer:
  // if the inbound/outbound event isn't for the open conversation, only
  // the list is invalidated. Otherwise both the list AND the messages
  // for that customer refetch.
  const { socket } = useSocket();
  const queryClient = useQueryClient();
  // Ref so the socket handler reads the latest `selectedPhone` without
  // re-binding on every selection change (which would tear down + re-bind
  // every WS listener at a high rate during normal manager activity).
  const selectedPhoneRef = useRef<string | null>(selectedPhone);
  useEffect(() => {
    selectedPhoneRef.current = selectedPhone;
  }, [selectedPhone]);

  useEffect(() => {
    if (!socket) return;
    const invalidateList = () => {
      queryClient.invalidateQueries({ queryKey: [...waOversightKeys.all, 'conversations'] });
    };
    const invalidateThreadIfMatch = (payload: unknown) => {
      const open = selectedPhoneRef.current;
      if (!open) return;
      // The event payload shape isn't strictly typed at this boundary.
      // For WA message events, the customer's phone lives in different
      // fields depending on direction:
      //   - wa:received (inbound):  customer = `sender`
      //   - wa:sent     (outbound): customer = `receiver`  ← `sender` is the org's WA number
      //   - typing events:          customer = `customerPhone`
      // We check ALL candidate fields and match if any one equals the
      // open customer. The org's WA number is never equal to a customer
      // phone, so checking both `sender` and `receiver` doesn't risk a
      // false positive — exactly one of them will be the customer.
      // Fallback: if no candidate field is present, invalidate anyway.
      const p = (payload ?? {}) as {
        customerPhone?: string;
        sender?: string;
        receiver?: string;
      };
      const openNorm = normalizePhone(open);
      const candidates = [p.customerPhone, p.sender, p.receiver].filter(
        (v): v is string => typeof v === 'string' && v.length > 0
      );
      const matches =
        candidates.length === 0 || candidates.some((c) => normalizePhone(c) === openNorm);
      if (matches) {
        queryClient.invalidateQueries({
          queryKey: [...waOversightKeys.all, 'messages', openNorm],
        });
      }
    };
    const onTraffic = (payload: unknown) => {
      invalidateList();
      invalidateThreadIfMatch(payload);
    };
    // Subscribe to the oversight-specific inbound event. `wa:received` is
    // now per-user (server only emits it to the customer's sticky-assigned
    // agent), so the org-wide oversight surface uses its own event —
    // `wa:oversight_inbound` — fanned to every member of the org. The
    // payload shape is identical so the same handler works.
    socket.on('wa:oversight_inbound', onTraffic);
    socket.on('wa:sent', onTraffic);
    socket.on('wa:read', invalidateList);
    return () => {
      socket.off('wa:oversight_inbound', onTraffic);
      socket.off('wa:sent', onTraffic);
      socket.off('wa:read', invalidateList);
    };
  }, [socket, queryClient]);

  // Derive the agent label from current cache data (not click-time
  // snapshot), so reassignments and corrections to `agentFullName` flow
  // through to the open thread's header on the next refetch tick.
  const selectedAgentLabel = useMemo(() => {
    if (!selectedPhone) return null;
    const openNorm = normalizePhone(selectedPhone);
    const allRows = conversationsQuery.data?.pages.flatMap((p) => p.conversations) ?? [];
    const conv = allRows.find((c) => normalizePhone(c.customerPhone) === openNorm);
    if (!conv) return null;
    return conv.agentFullName || conv.agentPhone || null;
  }, [selectedPhone, conversationsQuery.data]);

  if (!canSee) {
    // Redirect already fired in useEffect; render nothing to avoid a flash.
    return null;
  }

  // NOTE: deliberately NOT gating render on `flagsLoading` or `!featureOn`.
  // The conversation list works regardless of flag state — it's just a
  // paginated list. The flags only gate live signals (typing pulse,
  // draft banner), and those gracefully no-op when the flag is off
  // server-side. Rendering the list IMMEDIATELY means the hook subscribes
  // the moment the page loads, catching even the very first typing pulse.
  //
  // Previously this page blocked rendering until feature flags resolved
  // from their initial placeholder (all-false), which meant the
  // conversation list — and its `useWaTypingIndicators` subscribe — never
  // mounted in the brief window before the API responded. By the time it
  // resolved, the typing pulse for an already-typing agent had been
  // missed, and the row stayed silent even though the agent was typing.

  return (
    <div className="h-[calc(100vh-7rem)] flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <FiEye className="text-green-500" />
          WhatsApp Oversight
        </h1>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-4 min-h-0">
        <WaOversightConversationList
          filters={filters}
          onFiltersChange={setFilters}
          selectedPhone={selectedPhone}
          onSelect={(conv) => setSelectedPhone(conv.customerPhone)}
          hideOnMobile={showThreadOnMobile}
        />
        <WaOversightMessageThread
          customerPhone={selectedPhone}
          agentName={selectedAgentLabel}
          onBack={() => setSelectedPhone(null)}
          hideOnMobile={!showThreadOnMobile}
        />
      </div>
    </div>
  );
}
