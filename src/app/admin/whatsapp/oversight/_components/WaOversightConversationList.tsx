'use client';

/**
 * Left pane of the WhatsApp manager oversight page — paginated
 * cross-agent conversation list with filters.
 *
 * Owns:
 *   - the React Query infinite scroll (via `useWaOversightConversations`)
 *   - the IntersectionObserver sentinel
 *   - per-row typing-pulse lookup via `useWaTypingIndicators`
 *
 * Does NOT own:
 *   - filter state (lifted to the page so the URL can carry it later)
 *   - selection state (lifted to the page so the right pane can react)
 *
 * @module app/admin/whatsapp/oversight/_components/WaOversightConversationList
 */

import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { Card, CardContent } from '@/components/ui';
import { FaWhatsapp } from 'react-icons/fa';
import { normalizePhone } from '@/lib/utils/phone';
import { useWaOversightConversations, useWaTypingIndicators } from '@/lib/hooks';
import { Spinner } from '@/app/phone/whatsapp/_components';
import type { WaOversightConversation } from '@/lib/api/services/whatsapp.api';
import { WaOversightFilters, type OversightFilterState } from './WaOversightFilters';
import { WaOversightConversationItem } from './WaOversightConversationItem';

interface Props {
  filters: OversightFilterState;
  onFiltersChange: (next: OversightFilterState) => void;
  selectedPhone: string | null;
  /**
   * Fired when a row is clicked. We pass the full conversation so the
   * parent can read the agent label without re-querying the cache —
   * the row already has every piece of data the right pane needs.
   */
  onSelect: (conversation: WaOversightConversation) => void;
  /** Hidden on mobile when the thread pane is showing instead. */
  hideOnMobile: boolean;
}

export function WaOversightConversationList({
  filters,
  onFiltersChange,
  selectedPhone,
  onSelect,
  hideOnMobile,
}: Props) {
  const { data, isLoading, isFetchingNextPage, fetchNextPage, hasNextPage } =
    useWaOversightConversations({
      search: filters.search,
      agentUserId: filters.agentUserId ?? undefined,
      unreadOnly: filters.unreadOnly,
    });

  const conversations = useMemo(() => data?.pages.flatMap((p) => p.conversations) ?? [], [data]);
  const totalCount = data?.pages[0]?.total ?? 0;

  // Manager typing-pulse stream. Hook is org-scoped + manager-gated
  // internally, so calling it here is free for non-eligible callers
  // (page-level guard already filters them out).
  const { getTyper } = useWaTypingIndicators();

  // Infinite scroll sentinel
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const setupObserver = useCallback(() => {
    observerRef.current?.disconnect();
    if (!sentinelRef.current || !hasNextPage || isFetchingNextPage) return;
    observerRef.current = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) fetchNextPage();
      },
      { rootMargin: '200px' }
    );
    observerRef.current.observe(sentinelRef.current);
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  useEffect(() => {
    setupObserver();
    return () => observerRef.current?.disconnect();
  }, [setupObserver]);

  const selectedNormalized = selectedPhone ? normalizePhone(selectedPhone) : null;

  return (
    <Card
      className={`lg:col-span-1 flex flex-col h-full overflow-hidden ${hideOnMobile ? 'hidden lg:flex' : 'flex'}`}
    >
      <CardContent className="p-4 flex flex-col h-full min-h-0">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <FaWhatsapp className="text-green-500" />
            Oversight
            {totalCount > 0 && (
              <span className="text-xs font-normal text-[var(--muted-foreground)]">
                ({totalCount})
              </span>
            )}
          </h2>
        </div>

        <WaOversightFilters filters={filters} onChange={onFiltersChange} />

        {isLoading && conversations.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <Spinner />
          </div>
        ) : conversations.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-[var(--muted-foreground)] gap-3 px-6 text-center">
            <FaWhatsapp className="w-10 h-10 opacity-20 text-green-500" />
            <p className="text-sm">
              {filters.search || filters.agentUserId || filters.unreadOnly
                ? 'No conversations match the current filters.'
                : 'No WhatsApp conversations in this organization yet.'}
            </p>
          </div>
        ) : (
          <div
            className="flex-1 overflow-y-auto space-y-1 min-h-0"
            role="listbox"
            aria-label="WhatsApp oversight conversations"
          >
            {conversations.map((conv) => {
              const normalized = normalizePhone(conv.customerPhone);
              const isSelected = normalized === selectedNormalized;
              const typer = getTyper(normalized);
              return (
                <WaOversightConversationItem
                  key={normalized}
                  conversation={conv}
                  isSelected={isSelected}
                  onClick={() => onSelect(conv)}
                  typingAgentName={typer?.userName ?? null}
                />
              );
            })}
            {hasNextPage && (
              <div ref={sentinelRef} className="flex justify-center py-2">
                {isFetchingNextPage && <Spinner className="w-4 h-4" />}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
