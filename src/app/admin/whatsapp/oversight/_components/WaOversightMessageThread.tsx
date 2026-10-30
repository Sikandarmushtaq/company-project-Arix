'use client';

/**
 * Right pane of the WhatsApp manager oversight page — read-only
 * message history for the selected conversation with a live-watch
 * banner above it.
 *
 * What's deliberately absent:
 *   - Composer / send button — read-only by design; v2 adds barge-in
 *   - Selection mode / bulk delete — supervisor doesn't modify history
 *   - Reactions — same reason
 *
 * The bottom of the pane carries an explicit "Read-only view" notice so
 * the missing composer is obviously intentional, and so v2's takeover
 * button has a clear home.
 *
 * @module app/admin/whatsapp/oversight/_components/WaOversightMessageThread
 */

import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { Card, CardContent, Button } from '@/components/ui';
import { FaWhatsapp } from 'react-icons/fa';
import { FiArrowLeft, FiEye, FiLock } from 'react-icons/fi';
import { normalizePhone } from '@/lib/utils/phone';
import { useContactDisplayName, useWaOversightMessages, useWaLiveWatch } from '@/lib/hooks';
import { WaMessageList } from '@/app/phone/whatsapp/_components';
import { useAuthStore } from '@/lib/stores';

interface Props {
  customerPhone: string | null;
  agentName: string | null;
  /** Show back button on mobile (returns to list pane). */
  onBack: () => void;
  /** Hidden on mobile when the list pane is showing instead. */
  hideOnMobile: boolean;
}

/**
 * Banner that surfaces the agent's in-flight draft text. Reuses the
 * same hook the agent-facing view uses, but here we never self-suppress
 * — a manager watching their own conversation (rare in oversight)
 * still benefits from seeing the draft to keep behavior consistent
 * with what they'd see if a peer were typing.
 */
function LiveDraftBanner({ customerPhone }: { customerPhone: string }) {
  const watch = useWaLiveWatch(customerPhone);
  const currentUserId = useAuthStore((s) => s.user?.id);
  const draft = watch.draft.trim();
  const isOwnDraft = watch.draftAgent?.userId === currentUserId;

  // Hide if no draft, or if it's the manager's own draft (avoid noise
  // when a manager is poking around their own thread).
  if (!draft || isOwnDraft) return null;

  return (
    <div className="mx-4 mt-3 p-3 rounded-lg border border-green-500/30 bg-green-500/10 flex items-start gap-3">
      <FiEye className="w-4 h-4 mt-0.5 text-green-500 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-green-700 dark:text-green-400">
          {watch.draftAgent?.userName ?? 'Agent'} is composing…
        </p>
        <p className="text-sm text-[var(--foreground)] break-words mt-0.5">{draft}</p>
      </div>
    </div>
  );
}

export function WaOversightMessageThread({
  customerPhone,
  agentName,
  onBack,
  hideOnMobile,
}: Props) {
  const contactName = useContactDisplayName(customerPhone ?? '', null);

  const normalized = customerPhone ? normalizePhone(customerPhone) : null;

  const { data, isLoading, isFetchingNextPage, fetchNextPage, hasNextPage } =
    useWaOversightMessages(normalized);

  // Flatten, then reverse to display oldest→newest (backend returns
  // DESC so the first page has the latest messages at index 0).
  const messages = useMemo(() => {
    const flat = data?.pages.flatMap((p) => p.messages) ?? [];
    return flat.slice().reverse();
  }, [data]);

  // Scroll mechanics (initial scroll-to-bottom, auto-scroll on new
  // messages, scroll-anchor on prepend) are owned by `WaMessageList`.
  // Parent retains the refs only because (a) the load-older
  // IntersectionObserver below needs the scroll container's
  // scrollHeight, and (b) the agent page passes the same refs in for
  // its own send-scroll path — keeping the API symmetric across
  // surfaces.
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Top sentinel + IntersectionObserver wires the React Query
  // `fetchNextPage` to scroll-into-view. The shared component renders
  // the sentinel div and anchors the scroll position after prepend;
  // we just have to trigger the fetch.
  const topSentinelRef = useRef<HTMLDivElement | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  const setupObserver = useCallback(() => {
    observerRef.current?.disconnect();
    if (!topSentinelRef.current || !hasNextPage || isFetchingNextPage) return;
    observerRef.current = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) fetchNextPage();
      },
      { rootMargin: '100px' }
    );
    observerRef.current.observe(topSentinelRef.current);
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  useEffect(() => {
    setupObserver();
    return () => observerRef.current?.disconnect();
  }, [setupObserver]);

  if (!customerPhone || !normalized) {
    return (
      <Card
        className={`lg:col-span-2 flex flex-col h-full overflow-hidden items-center justify-center ${hideOnMobile ? 'hidden lg:flex' : 'flex'}`}
      >
        <CardContent className="text-center text-[var(--muted-foreground)] py-12">
          <FaWhatsapp className="w-12 h-12 mx-auto opacity-20 text-green-500 mb-3" />
          <p className="text-sm">Pick a conversation on the left to watch it.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card
      className={`lg:col-span-2 flex flex-col h-full overflow-hidden ${hideOnMobile ? 'hidden lg:flex' : 'flex'}`}
    >
      <CardContent className="p-0 flex flex-col h-full min-h-0">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--border)]">
          <Button
            size="icon"
            variant="ghost"
            onClick={onBack}
            className="lg:hidden"
            aria-label="Back to conversations"
          >
            <FiArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex-shrink-0 w-9 h-9 rounded-full bg-green-500/20 flex items-center justify-center">
            <FaWhatsapp className="w-4 h-4 text-green-500" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold truncate">{contactName}</p>
            <p className="text-xs text-[var(--muted-foreground)] truncate">
              Handled by {agentName ?? 'Unassigned'}
            </p>
          </div>
          <span className="text-xs px-2 py-1 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-400 flex items-center gap-1 flex-shrink-0">
            <FiLock className="w-3 h-3" /> Read-only
          </span>
        </div>

        <LiveDraftBanner customerPhone={normalized} />

        {/* Shared message list — same component the agent's
            WaMessageThread uses. Read-only here (no selection, no
            reactions, no image preview handler). */}
        <div className="flex-1 min-h-0">
          <WaMessageList
            conversationKey={normalized}
            messages={messages}
            isLoading={isLoading}
            containerRef={scrollContainerRef}
            endRef={messagesEndRef}
            hasMore={hasNextPage}
            isLoadingOlder={isFetchingNextPage}
            loadOlderSentinelRef={topSentinelRef}
            emptyState={
              <p className="text-center text-sm text-[var(--muted-foreground)] py-12">
                No messages in this conversation yet.
              </p>
            }
          />
        </div>

        {/* Read-only footer — placeholder for v2 Take Over button */}
        <div className="border-t border-[var(--border)] px-4 py-3 bg-[var(--muted)]/50">
          <p className="text-xs text-[var(--muted-foreground)] flex items-center gap-2">
            <FiLock className="w-3 h-3" />
            Read-only view — you cannot send messages from this page. Take-over arrives in a future
            release.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
