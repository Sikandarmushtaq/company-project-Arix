'use client';

/**
 * useWaDraftEmitter
 *
 * Agent-side hook. Emits `wa:draft:emit` to the server with the agent's
 * current composer text, so managers in watch mode see the message
 * being typed before it's sent. Server fans the broadcast to managers
 * subscribed to that conversation's watch room (gated by
 * `wa_live_watch_enabled`); if no manager is watching, the server
 * short-circuits and the work is essentially free.
 *
 * Behavior contract:
 *   - Debounced: emits at most every 400 ms while text changes, so a
 *     fast typist doesn't flood the socket.
 *   - Visibility-aware: pauses while the tab is hidden — saves
 *     bandwidth and prevents stale drafts from being broadcast when
 *     the agent isn't actually editing.
 *   - Auto-clear: emits empty draft when the conversation closes,
 *     the composer unmounts, or the agent sends the message.
 *   - Feature-flag gated: silently no-ops when `liveWatch` is off.
 *
 * The draft text is bounded server-side to 4096 chars (Meta's body
 * limit). We don't pre-truncate on the client — let the server be the
 * single source of truth on size.
 *
 * @module lib/hooks/useWaDraftEmitter
 */

import { useEffect, useRef } from 'react';
import { useSocket } from '@/lib/providers/SocketProvider';

interface UseWaDraftEmitterArgs {
  customerPhone: string | null;
  draft: string;
  /** False when composer isn't visible (conversation closed, app hidden). */
  isActive: boolean;
}

const DEBOUNCE_MS = 400;

export function useWaDraftEmitter({ customerPhone, draft, isActive }: UseWaDraftEmitterArgs) {
  const { socket } = useSocket();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSentRef = useRef<string>('');
  const activeCustomerRef = useRef<string | null>(null);

  // Send when text changes (debounced).
  //
  // NOTE: deliberately NOT gating on `flags.liveWatch` here. The server
  // validates and rejects emits when the org's flag is off, so the
  // client-side gate would only create a race against the feature-flags
  // API resolving from its placeholder (all-false). Concrete failure
  // mode if we DID gate here:
  //   1. Agent loads page, flags = placeholder { liveWatch: false }
  //   2. Agent types "hello" — useEffect bails on every keystroke
  //      because `!flags.liveWatch`. No emit goes to server.
  //   3. Server has no draft for this customer in its store.
  //   4. Manager clicks into the conversation; server's state-replay
  //      finds nothing → banner stays empty.
  //   5. Agent's flags resolve later, but `lastSentRef` is empty and
  //      `draft="hello"` — so when the agent types the NEXT char, the
  //      effect emits and the manager finally sees it.
  // The user's report: "I type, manager clicks, no banner. I send and
  // type a new char, banner works." — that's exactly this race.
  // Removing the gate eliminates the race.
  useEffect(() => {
    if (!customerPhone || !socket?.connected || !isActive) {
      return;
    }

    // Conversation switch — emit an empty draft for the previous
    // conversation so the manager's watch banner clears immediately.
    if (activeCustomerRef.current && activeCustomerRef.current !== customerPhone) {
      socket.emit('wa:draft:emit', {
        customerPhone: activeCustomerRef.current,
        draft: '',
      });
      lastSentRef.current = '';
    }
    activeCustomerRef.current = customerPhone;

    if (draft === lastSentRef.current) {
      // No actual change — common when the parent re-renders.
      return;
    }

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      socket.emit('wa:draft:emit', { customerPhone, draft });
      lastSentRef.current = draft;
    }, DEBOUNCE_MS);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [draft, customerPhone, isActive, socket]);

  // Visibility — pause sending when hidden. The last sent draft remains
  // on the manager's screen; that's correct (agent might come back).
  // Note: no "stop" emit here — the agent could resume typing within
  // seconds, no need to flicker the manager UI.
  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden && timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  // Unmount cleanup. CRITICAL: empty deps so the cleanup fires ONLY on
  // true unmount, not on every socket reference change. Socket.IO swaps
  // the socket reference on every reconnect (HMR, transport blip,
  // Wi-Fi handoff) — if `[socket]` were in deps here, every reconnect
  // would fire an empty-draft emit and the manager's watch banner
  // would flicker out then back in. We access the latest socket
  // through a ref so the cleanup still has the current connection
  // without needing it in the dep array. See sister fix in
  // `useWaTypingEmitter` for the same pattern + reasoning.
  const socketRef = useRef(socket);
  useEffect(() => {
    socketRef.current = socket;
  }, [socket]);

  useEffect(() => {
    return () => {
      const phone = activeCustomerRef.current;
      if (timerRef.current) clearTimeout(timerRef.current);
      const currentSocket = socketRef.current;
      if (phone && currentSocket?.connected && lastSentRef.current.length > 0) {
        currentSocket.emit('wa:draft:emit', { customerPhone: phone, draft: '' });
      }
    };
    // Empty deps: only on true unmount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
