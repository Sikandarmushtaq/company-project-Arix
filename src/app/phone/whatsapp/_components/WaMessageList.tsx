'use client';

/**
 * WaMessageList — shared message-list view for both surfaces:
 *
 *   - Agent's `WaMessageThread` (interactive: composer below, selection
 *     mode, reactions, image preview)
 *   - Manager's `WaOversightMessageThread` (read-only: live-watch
 *     banner above, no composer, no selection)
 *
 * Both pages render the same scrollable list of message bubbles with
 * identical mechanics:
 *
 *   - Initial scroll-to-bottom when the conversation opens (instant)
 *   - Auto-scroll on new inbound IF the user was already at the bottom
 *     (don't yank them away from older history)
 *   - Load-older sentinel at the top + scroll-position anchoring when
 *     older messages prepend (no visible jump)
 *   - Conversation switch resets the initial-scroll trigger
 *
 * Owning this in one place eliminates the previous drift between the
 * two views: any improvement (date dividers, search highlight, etc.)
 * lands in both at once.
 *
 * Refs are passed IN by the parent (rather than owned internally) so
 * parents that need imperative scroll-on-action — e.g. the agent's
 * "scroll to bottom right after send" — can drive `endRef.scrollIntoView`
 * directly. The shared component still owns the scroll-mechanics
 * effects; refs are just the binding point.
 *
 * @module app/phone/whatsapp/_components/WaMessageList
 */

import React, { useEffect, useLayoutEffect, useRef } from 'react';
import { FiSearch, FiSend } from 'react-icons/fi';
import type { RefCallback } from 'react';
import type { WaMessage } from '@/lib/api/services/whatsapp-types';
import { Spinner } from './Spinner';
import { WaMessageBubble } from './WaMessageBubble';

// ============================================================================
// Types
// ============================================================================

export interface WaMessageListProps {
  /**
   * Identity of the current conversation. Used to detect conversation
   * switches and reset the initial-scroll-to-bottom trigger so each
   * new conversation lands at the bottom. Typically the normalized
   * customer phone.
   */
  conversationKey: string | null;

  /** Messages in chronological order (oldest first, newest last). */
  messages: WaMessage[];

  /** True while the FIRST page of messages is loading. */
  isLoading: boolean;

  /**
   * The scroll container ref. Owned by the parent so it can also
   * query scroll position (e.g., "is the user near the bottom") for
   * its own logic. Pass the same ref instance to keep the binding.
   */
  containerRef: React.RefObject<HTMLDivElement | null>;

  /**
   * Bottom sentinel ref. The shared component uses it to scroll to
   * the bottom on initial load and on auto-scroll. Parent can ALSO
   * call `endRef.current?.scrollIntoView(...)` directly for
   * imperative scroll (e.g., after send).
   */
  endRef: React.RefObject<HTMLDivElement | null>;

  /** True if there are older messages still to load. */
  hasMore: boolean;
  /** True while the "load older" page request is in flight. */
  isLoadingOlder: boolean;
  /**
   * Top sentinel ref. Parent wires this to an IntersectionObserver
   * (or whatever pagination mechanism) so it can call `fetchNextPage`
   * when the sentinel comes into view.
   */
  loadOlderSentinelRef: React.RefObject<HTMLDivElement | null> | RefCallback<HTMLDivElement>;

  /**
   * If set, the empty state shows "no messages matching {term}"
   * instead of the generic "no messages yet" copy.
   */
  searchTerm?: string;
  /** Custom empty-state node, overrides the default. */
  emptyState?: React.ReactNode;

  /** Selection mode (agent flow only). Defaults to disabled. */
  selectionMode?: boolean;
  isMessageSelected?: (id: number) => boolean;
  onToggleMessageSelect?: (id: number) => void;

  /** Optional interaction handlers. Read-only viewers omit them. */
  onImageClick?: (url: string) => void;
  onReact?: (waMessageId: string, emoji: string) => void;
  onRemoveReaction?: (waMessageId: string) => void;
}

// ============================================================================
// Component
// ============================================================================

export function WaMessageList({
  conversationKey,
  messages,
  isLoading,
  containerRef,
  endRef,
  hasMore,
  isLoadingOlder,
  loadOlderSentinelRef,
  searchTerm,
  emptyState,
  selectionMode = false,
  isMessageSelected,
  onToggleMessageSelect,
  onImageClick,
  onReact,
  onRemoveReaction,
}: WaMessageListProps) {
  // ----- Initial scroll-to-bottom + auto-scroll-on-new -----
  //
  // Tracks the last-rendered message count + last-rendered
  // conversation key. When the conversation changes, reset count to 0
  // so the new conversation triggers its own initial scroll. When
  // count transitions 0 → N, snap to the bottom instantly. When count
  // grows AFTER that, only scroll if the user was already near the
  // bottom (within 200 px) — otherwise leave them reading older
  // history.
  const prevMessageCountRef = useRef(0);
  const prevConversationKeyRef = useRef<string | null>(null);

  useLayoutEffect(() => {
    if (conversationKey !== prevConversationKeyRef.current) {
      prevConversationKeyRef.current = conversationKey;
      prevMessageCountRef.current = 0;
    }

    if (isLoading || messages.length === 0) return;

    if (prevMessageCountRef.current === 0) {
      // Initial load — instant scroll (no animation on mount).
      endRef.current?.scrollIntoView({ behavior: 'auto' });
      prevMessageCountRef.current = messages.length;
      return;
    }

    const grew = messages.length > prevMessageCountRef.current;
    prevMessageCountRef.current = messages.length;
    if (!grew) return;

    const c = containerRef.current;
    if (!c) return;
    const distFromBottom = c.scrollHeight - c.scrollTop - c.clientHeight;
    if (distFromBottom < 200) {
      endRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [conversationKey, isLoading, messages, containerRef, endRef]);

  // ----- Scroll-position anchor when older messages prepend -----
  //
  // When `isLoadingOlder` transitions true → false (the pagination
  // fetch completed and new items were prepended), the DOM grows
  // above the viewport. Without intervention, `scrollTop` stays put
  // and the user's visible content shifts downward — they "lose their
  // place." We capture scrollHeight just before the prepend
  // (triggered by the loading flag flipping ON) and restore the
  // offset right after the new messages commit (loading flag flips
  // OFF). `useLayoutEffect` runs sync after DOM update, before paint,
  // so the user never sees the jump.
  const prevScrollHeightBeforePrependRef = useRef<number | null>(null);
  useEffect(() => {
    if (isLoadingOlder && containerRef.current) {
      prevScrollHeightBeforePrependRef.current = containerRef.current.scrollHeight;
    }
  }, [isLoadingOlder, containerRef]);

  useLayoutEffect(() => {
    if (prevScrollHeightBeforePrependRef.current === null || !containerRef.current) {
      return;
    }
    const newHeight = containerRef.current.scrollHeight;
    const delta = newHeight - prevScrollHeightBeforePrependRef.current;
    if (delta > 0) {
      containerRef.current.scrollTop += delta;
    }
    prevScrollHeightBeforePrependRef.current = null;
  }, [messages, containerRef]);

  // ----- Render -----

  if (isLoading) {
    return (
      <div ref={containerRef} className="h-full overflow-y-auto">
        <div className="flex items-center justify-center h-full">
          <Spinner />
        </div>
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div ref={containerRef} className="h-full overflow-y-auto">
        {emptyState ?? (
          <div className="flex flex-col items-center justify-center h-full text-[var(--muted-foreground)] gap-2 px-6 text-center">
            {searchTerm ? (
              <>
                <FiSearch className="w-8 h-8 opacity-30" />
                <p className="text-sm">No messages matching &quot;{searchTerm}&quot;</p>
              </>
            ) : (
              <>
                <FiSend className="w-8 h-8 opacity-30" />
                <p className="text-sm">No messages yet.</p>
              </>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div ref={containerRef} className="h-full overflow-y-auto">
      <div className="flex flex-col py-4 gap-2">
        {hasMore && (
          <div
            ref={loadOlderSentinelRef as React.RefObject<HTMLDivElement>}
            className="flex justify-center py-2"
          >
            {isLoadingOlder && <Spinner className="w-4 h-4" />}
          </div>
        )}
        {messages.map((msg) => (
          <WaMessageBubble
            key={msg.id}
            message={msg}
            isSelectionMode={selectionMode}
            isSelected={isMessageSelected?.(msg.id) ?? false}
            onToggleSelect={() => onToggleMessageSelect?.(msg.id)}
            onImageClick={onImageClick}
            onReact={onReact}
            onRemoveReaction={onRemoveReaction}
          />
        ))}
        <div ref={endRef} className="h-1" />
      </div>
    </div>
  );
}
