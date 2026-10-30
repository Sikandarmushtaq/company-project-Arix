'use client';

/**
 * useWaTypingEmitter
 *
 * Agent-side hook. Signals to managers that the agent is currently
 * composing a reply for the open conversation. Purely STATE-DRIVEN —
 * no silence timers, no periodic refresh, no debounces, no visibility
 * tracking.
 *
 * Behavioral model:
 *
 *   "composing" = (customerPhone set) ∧ (composer active) ∧ (draft has text)
 *
 *   The hook watches these three inputs. Whenever the boolean
 *   transitions, ONE event fires — `wa:typing:emit { isTyping: true }`
 *   on entry, `{ isTyping: false }` on exit. The server stores the
 *   state and broadcasts to managers. Between transitions, no events
 *   are sent — the manager UI persists the pulse because the SERVER
 *   STATE says the agent is composing, not because the client keeps
 *   reminding it.
 *
 * What we deliberately do NOT gate on:
 *   - `document.visibilityState` / `tabVisible`. The Page Visibility
 *     API fires events on subtly-different focus transitions (DevTools
 *     popouts, multi-window orchestration on some OSes, browser-
 *     specific quirks). Each transition would flip `shouldCompose`
 *     and emit a redundant start/stop pair. Reality: if the tab is
 *     hidden, the user isn't typing — the draft prop doesn't change,
 *     no events fire anyway. The visibility gate was redundant
 *     defense and a flicker source. Removed.
 *
 *   - `isConnected` as a gate. Used internally only to access the
 *     latest socket reference; emits gracefully no-op via the inner
 *     `socket?.connected` check.
 *
 * Stop conditions (one explicit stop event each):
 *   - Draft becomes empty (user erased everything OR send-clear)
 *   - Customer switches (stop fires for old customer)
 *   - Composer becomes inactive (conversation closed, `isActive=false`)
 *   - Hook unmounts (page navigation)
 *   - `onSent()` invoked by caller (instant stop on message send)
 *   - Socket disconnects → server's deferred-flush handles it
 *
 * @module lib/hooks/useWaTypingEmitter
 */

import { useCallback, useEffect, useRef } from 'react';
import { useSocket } from '@/lib/providers/SocketProvider';

interface UseWaTypingEmitterArgs {
  /** Customer phone of the active conversation. Null means no conversation open. */
  customerPhone: string | null;
  /** Whether the composer is currently visible / open (conversation open and window active). */
  isActive: boolean;
  /** Current draft text. Empty string means the composer is empty. */
  draft: string;
}

export function useWaTypingEmitter({ customerPhone, isActive, draft }: UseWaTypingEmitterArgs) {
  const { socket } = useSocket();

  // Tracks (customer, composing, socketId) we last told the server.
  // socketId is included so we re-emit start whenever Socket.IO swaps
  // the underlying socket (transparent reconnect) — without that, the
  // new socket has no pulse on the server side, and the server's
  // disconnect-flush will eventually emit a spurious stop. The
  // re-emit creates the matching pulse on the new socket so dedup
  // works.
  const lastEmittedRef = useRef<{
    customerPhone: string;
    composing: boolean;
    socketId: string;
  } | null>(null);

  // Derived "composing" boolean — single source of truth for whether
  // we should be signaling typing right now.
  const shouldCompose = !!customerPhone && isActive && draft.length > 0;

  const emit = useCallback(
    (phone: string, composing: boolean) => {
      if (!socket?.connected) return;
      socket.emit('wa:typing:emit', { customerPhone: phone, isTyping: composing });
    },
    [socket]
  );

  useEffect(() => {
    const prev = lastEmittedRef.current;
    const currentSocketId = socket?.id ?? null;

    // Customer switch: stop the old customer before doing anything new.
    if (prev && prev.composing && customerPhone !== prev.customerPhone) {
      emit(prev.customerPhone, false);
      lastEmittedRef.current = null;
    }

    // Should compose now — emit start if not already, or if the
    // tracked socket has been swapped (reconnect).
    if (shouldCompose && customerPhone && currentSocketId) {
      const current = lastEmittedRef.current;
      if (
        !current ||
        !current.composing ||
        current.customerPhone !== customerPhone ||
        current.socketId !== currentSocketId
      ) {
        emit(customerPhone, true);
        lastEmittedRef.current = {
          customerPhone,
          composing: true,
          socketId: currentSocketId,
        };
      }
      return;
    }

    // Should NOT compose, but we previously told the server we were.
    if (!shouldCompose) {
      const current = lastEmittedRef.current;
      if (current && current.composing) {
        emit(current.customerPhone, false);
        lastEmittedRef.current = null;
      }
    }
  }, [shouldCompose, customerPhone, emit, socket]);

  // Unmount cleanup. Empty deps so it ONLY fires on true unmount, not
  // on every socket reference change. Uses a ref for the latest
  // socket. See `useWaDraftEmitter` for the same pattern + rationale.
  const socketRef = useRef(socket);
  useEffect(() => {
    socketRef.current = socket;
  }, [socket]);

  useEffect(() => {
    return () => {
      const last = lastEmittedRef.current;
      const currentSocket = socketRef.current;
      if (last && last.composing && currentSocket?.connected) {
        currentSocket.emit('wa:typing:emit', {
          customerPhone: last.customerPhone,
          isTyping: false,
        });
        lastEmittedRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Caller invokes this immediately on message send for an instant
   * "draft cleared" signal — the state-driven flow would also catch
   * this when the parent clears the draft prop, but this one tick
   * earlier looks crisper to the manager.
   */
  const onSent = useCallback(() => {
    const last = lastEmittedRef.current;
    if (last && last.composing && socket?.connected) {
      socket.emit('wa:typing:emit', {
        customerPhone: last.customerPhone,
        isTyping: false,
      });
      lastEmittedRef.current = null;
    }
  }, [socket]);

  /**
   * Legacy no-op kept for API compatibility with callers that pass
   * `onActivity` to `onChange`. State-driven emission handles all
   * keystrokes via the `draft` prop.
   */
  const onActivity = useCallback(() => {
    // intentionally empty
  }, []);

  return { onActivity, onSent };
}
