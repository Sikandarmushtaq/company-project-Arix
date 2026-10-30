'use client';

/**
 * useWaLiveWatch
 *
 * Manager-side hook. Joins the per-conversation watch room for ONE
 * customer and surfaces three pieces of live state:
 *
 *   1. `draft`     — the agent's current composer text (empty when
 *                    no agent is typing or the agent cleared it).
 *   2. `draftAgent`— who's typing it (userId + display name).
 *   3. `lastEvent` — timestamp of the most recent event in this
 *                    conversation, so the watch UI can show a
 *                    "live" pulse indicator.
 *
 * Inbound customer messages and outbound agent sends are NOT delivered
 * via the watch room — managers already receive `wa:received` /
 * `wa:sent` via the org-wide broadcast (managers join the org room
 * automatically on connect). The watch room is exclusively for the
 * agent's draft text, which only exists for managers who opt into
 * watch mode.
 *
 * Server gates the room join on:
 *   - manager (or admin) role
 *   - matching organizationId
 *   - org has `wa_live_watch_enabled`
 *   - customer phone actually belongs to this org (customer pool OR
 *     historical WA message)
 *
 * If the gate fails, the hook receives a `subscribe_denied` event and
 * surfaces it via `error`. The caller can then unmount the watch UI
 * and toast the reason.
 *
 * @module lib/hooks/useWaLiveWatch
 */

import { useEffect, useState } from 'react';
import { useSocket } from '@/lib/providers/SocketProvider';
import { useAuthStore } from '@/lib/stores';
import { REALTIME_EVENTS } from '@/lib/constants/events';
import { normalizePhone } from '@/lib/utils/phone';
import { useWaStatus } from './useWaConversationQueries';

interface WaDraftEventPayload {
  customerPhone: string;
  userId: number;
  userName: string;
  draft: string;
  at: number;
}

export interface WaWatchState {
  /** Current draft text from the agent, '' when none / cleared. */
  draft: string;
  /** Identity of the agent currently typing the draft, null when idle. */
  draftAgent: { userId: number; userName: string } | null;
  /** Last activity timestamp (any event), used to render the live pulse. */
  lastEventAt: number | null;
  /** Subscription error from server, if any. */
  error: string | null;
}

const EMPTY: WaWatchState = {
  draft: '',
  draftAgent: null,
  lastEventAt: null,
  error: null,
};

export function useWaLiveWatch(customerPhone: string | null): WaWatchState {
  // Read `isConnected` as separate React state — see sister note in
  // useWaTypingIndicators for why `socket?.connected` is NOT safe as a
  // useEffect gate.
  const { socket, isConnected } = useSocket();
  const user = useAuthStore((s) => s.user);
  // orgId via /whatsapp/status — server-derived, can't be spoofed.
  const { data: waStatus } = useWaStatus();
  const orgId = waStatus?.organizationId ?? null;
  const role = user?.role;
  const canWatch = role === 'manager' || role === 'admin';

  const [state, setState] = useState<WaWatchState>(EMPTY);

  // Normalize defensively. The server builds the broadcast room name with
  // normalizePhone(), so any caller that passes a non-normalized phone
  // (e.g. `+12164281997` or formatted display string) would otherwise
  // subscribe to a different room than the one the server emits into —
  // and live-watch would silently produce nothing.
  const normalizedPhone = customerPhone ? normalizePhone(customerPhone) : null;

  // Reset state ONLY when the customer (conversation) changes — not on
  // every effect re-run. Putting `setState(EMPTY)` inside the main
  // effect would reset the banner on every transient socket reconnect
  // (Socket.IO swaps the socket reference on each reconnect, so any
  // effect with `[socket, ...]` in deps fires) — manager sees the live
  // banner flicker out then back in. Tying the reset to
  // `normalizedPhone` only resets on real conversation switches.
  useEffect(() => {
    setState(EMPTY);
  }, [normalizedPhone]);

  useEffect(() => {
    if (!socket || !isConnected || !orgId || !canWatch || !normalizedPhone) {
      return;
    }

    // NOTE: deliberately NOT gating on `flags.liveWatch` here. Server
    // validates and rejects on subscribe when the flag is off, so the
    // client gate would only create a race against the feature-flags
    // API resolving from its placeholder. See sister note in
    // useWaTypingIndicators for the full reasoning.

    const room = `wa:watch:org:${orgId}:cust:${normalizedPhone}`;
    socket.emit('subscribe', room);

    const onDraft = (payload: WaDraftEventPayload) => {
      if (!payload || payload.customerPhone !== normalizedPhone) return;
      setState((prev) => ({
        ...prev,
        draft: payload.draft,
        draftAgent: payload.draft ? { userId: payload.userId, userName: payload.userName } : null,
        lastEventAt: payload.at ?? Date.now(),
      }));
    };

    const onDenied = (payload: { room?: string; reason?: string }) => {
      if (payload?.room !== room) return;
      setState((prev) => ({ ...prev, error: payload.reason || 'Subscription denied' }));
    };

    socket.on(REALTIME_EVENTS.WA_DRAFT, onDraft);
    socket.on('subscribe_denied', onDenied);

    return () => {
      socket.off(REALTIME_EVENTS.WA_DRAFT, onDraft);
      socket.off('subscribe_denied', onDenied);
      socket.emit('unsubscribe', room);
    };
  }, [socket, isConnected, orgId, canWatch, normalizedPhone]);

  return state;
}
