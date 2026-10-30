'use client';

/**
 * useWaTypingIndicators
 *
 * Manager-side hook. Subscribes to the org's typing room and exposes
 * a stable lookup of "is anyone currently typing to this customer?".
 *
 * Wired into:
 *   - WaConversationList: shows a "typing…" badge on rows with active
 *     pulses, so managers see at a glance which conversations are
 *     being attended to right now.
 *   - WaMessageThread: surfaces "Agent X is typing" when watching.
 *
 * Cleanup: unsubscribes on unmount and clears in-memory state so a
 * stale typing pulse from before role/feature changes doesn't linger.
 *
 * Server guarantees:
 *   - 6 s silence timer: if the agent crashes or goes idle, the server
 *     emits an isTyping=false within 6 s. Manager doesn't see ghosts.
 *   - Disconnect flush: on agent disconnect, server emits explicit
 *     stops for every active pulse the agent had.
 *
 * @module lib/hooks/useWaTypingIndicators
 */

import { useCallback, useEffect, useState } from 'react';
import { useSocket } from '@/lib/providers/SocketProvider';
import { useAuthStore } from '@/lib/stores';
import { REALTIME_EVENTS } from '@/lib/constants/events';
import { useWaStatus } from './useWaConversationQueries';

export interface WaTypingState {
  customerPhone: string;
  userId: number;
  userName: string;
  at: number;
}

interface WaTypingEventPayload {
  customerPhone: string;
  userId: number;
  userName: string;
  isTyping: boolean;
  at: number;
}

/**
 * Soft-ceiling for how many distinct customer pulses we'll track. Bounded
 * to keep memory + render cost predictable on a large org; pulses past
 * this cap are dropped. In practice an org with >500 simultaneously-
 * typing agents doesn't exist, so this is mostly a safety net.
 */
const MAX_PULSES = 500;

export function useWaTypingIndicators() {
  // IMPORTANT: read `isConnected` as a separate state from `socket`.
  // `socket?.connected` is a property on the socket object that mutates
  // in place as the connection state changes — React doesn't observe
  // those mutations. If the effect uses `socket?.connected` to gate
  // subscribe and `socket` reference never changes (which is the
  // common case once the provider has constructed the socket), the
  // effect runs once with `connected === false`, bails, and never
  // re-runs even after the socket connects. Using `isConnected` (which
  // IS React state inside the SocketProvider) means the effect re-runs
  // on every connection transition and subscribes the moment the
  // socket is up.
  const { socket, isConnected } = useSocket();
  const user = useAuthStore((s) => s.user);
  // orgId comes from /whatsapp/status (server-derived, never client-
  // supplied). Frontend's User type doesn't carry orgId, but waStatus
  // does and it's the existing pattern for every WA feature.
  const { data: waStatus } = useWaStatus();
  const orgId = waStatus?.organizationId ?? null;
  const role = user?.role;
  const canReceive = role === 'manager' || role === 'admin';

  // Map<customerPhone, WaTypingState>. Setting state to a new Map each
  // time keeps React's diffing simple — we're operating on a max of a
  // few hundred entries, so allocation cost is negligible.
  const [typingByCustomer, setTypingByCustomer] = useState<Map<string, WaTypingState>>(new Map());

  useEffect(() => {
    if (!socket || !isConnected || !orgId || !canReceive) {
      // Not currently eligible — but DELIBERATELY do NOT clear state.
      //
      // The bail conditions include transient states like "socket
      // briefly disconnected during reconnect" — clearing state here
      // would empty the typingByCustomer map every time the socket
      // bounces, which makes the row pulse vanish for ~100ms until the
      // server's state-replay on resubscribe restores it. Result: the
      // manager sees the pulse flicker on every reconnect.
      //
      // Leaving state intact during transient bails means: when
      // re-subscription completes, replay catches us up; in the
      // meantime we display the last-known state, which is correct.
      // The only stale-state risk is role/feature revocation, which
      // requires a fresh page load anyway (the layout's role gate
      // redirects).
      return;
    }

    // NOTE: deliberately NOT gating on `flags.typingIndicators` here.
    // The server is the SSOT for feature flag state — it validates on
    // subscribe and rejects with `subscribe_denied` when the org's
    // flag is off. Gating client-side too creates a race against the
    // feature-flags API: the hook mounts on the conversation list's
    // first render (placeholder `flags.typingIndicators === false`),
    // bails, and the re-fire after the API resolves can be missed if
    // React batches the update with other state changes. Removing the
    // gate means we always attempt the subscribe; the server's
    // authoritative decision handles the off case.

    const room = `wa:typing:org:${orgId}`;
    socket.emit('subscribe', room);

    const onTyping = (payload: WaTypingEventPayload) => {
      if (!payload || typeof payload.customerPhone !== 'string') return;
      setTypingByCustomer((prev) => {
        const next = new Map(prev);
        if (payload.isTyping) {
          if (next.size >= MAX_PULSES && !next.has(payload.customerPhone)) return prev;
          next.set(payload.customerPhone, {
            customerPhone: payload.customerPhone,
            userId: payload.userId,
            userName: payload.userName,
            at: payload.at,
          });
        } else {
          // Stop event — only clear if we still have an entry for this
          // customer (ignore stops for state we never tracked, which
          // can happen on hot reload or after a reconnect storm).
          if (!next.has(payload.customerPhone)) return prev;
          next.delete(payload.customerPhone);
        }
        return next;
      });
    };

    socket.on(REALTIME_EVENTS.WA_TYPING, onTyping);

    return () => {
      socket.off(REALTIME_EVENTS.WA_TYPING, onTyping);
      socket.emit('unsubscribe', room);
      // DELIBERATELY do NOT clear state on cleanup. The cleanup fires
      // every time `socket` changes reference (which happens on every
      // Socket.IO reconnect), and clearing state there would empty
      // the map for ~100ms before the new subscription's replay
      // arrives. State persists across reconnects; replay corrects
      // anything stale.
    };
  }, [socket, isConnected, orgId, canReceive]);

  const isCustomerBeingTypedTo = useCallback(
    (customerPhone: string) => typingByCustomer.has(customerPhone),
    [typingByCustomer]
  );

  const getTyper = useCallback(
    (customerPhone: string): WaTypingState | null => typingByCustomer.get(customerPhone) ?? null,
    [typingByCustomer]
  );

  return { isCustomerBeingTypedTo, getTyper, typingByCustomer };
}
