'use client';

/**
 * useWaFeatureFlags
 *
 * Returns the WhatsApp manager-oversight feature flags for the current
 * user's organization. Cached + auto-invalidated on `wa:feature_flags_updated`
 * WebSocket events so admin toggles propagate to every open client tab
 * in the org within one round-trip — no manual refresh needed.
 *
 * Used by:
 *   - Manager UI: gates "Watch live" buttons, typing badges, watch banner.
 *   - Agent emit hooks: skips emitting drafts when no one can subscribe.
 *   - Admin org settings page: shows current state of the toggles.
 *
 * Always returns a result (the query has a sensible default) so callers
 * can do `flags?.liveWatch ?? false` without null-checking the whole tree.
 *
 * @module lib/hooks/useWaFeatureFlags
 */

import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getFeatureFlags, type WaFeatureFlags } from '@/lib/api/services/whatsapp.api';
import { REALTIME_EVENTS } from '@/lib/constants/events';
import { useSocket } from '@/lib/providers/SocketProvider';

const QUERY_KEY = ['whatsapp', 'feature-flags'] as const;

// 60 s stale window — server pushes an invalidation event on every toggle,
// so this stale time only governs the *cold-start* freshness when a tab
// reconnects after sleep / network drop. A minute is fine.
const STALE_MS = 60_000;

const DEFAULT_FLAGS: WaFeatureFlags = {
  typingIndicators: false,
  liveWatch: false,
  customerTypingIndicator: false,
};

export function useWaFeatureFlags() {
  const queryClient = useQueryClient();
  const { socket } = useSocket();

  const query = useQuery({
    queryKey: QUERY_KEY,
    queryFn: getFeatureFlags,
    staleTime: STALE_MS,
    // If the user's session has no org we still want a deterministic
    // "everything off" answer rather than a perpetual loading state.
    placeholderData: DEFAULT_FLAGS,
  });

  // Invalidate cache on the WS broadcast so a flag flip in the admin
  // panel propagates to this tab within a single RTT. The handler is
  // intentionally narrow: re-fetch on event arrival; the *new* values
  // come from the GET endpoint (single source of truth), not from the
  // event payload itself. That guards against a malformed payload from
  // a future server version corrupting the cache.
  useEffect(() => {
    if (!socket) return;
    const onUpdate = () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    };
    socket.on(REALTIME_EVENTS.WA_FEATURE_FLAGS_UPDATED, onUpdate);
    return () => {
      socket.off(REALTIME_EVENTS.WA_FEATURE_FLAGS_UPDATED, onUpdate);
    };
  }, [socket, queryClient]);

  return {
    flags: query.data ?? DEFAULT_FLAGS,
    isLoading: query.isLoading,
    isError: query.isError,
  };
}
