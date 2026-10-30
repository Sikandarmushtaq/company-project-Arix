'use client';

import React, { useRef, useState, useCallback, useEffect } from 'react';
import { FaWhatsapp } from 'react-icons/fa';
import { FiSearch, FiRefreshCw, FiPlus, FiMessageSquare, FiX } from 'react-icons/fi';
import { Button } from '@/components/ui';
import { normalizePhone } from '@/lib/utils/phone';
import { useAuthStore } from '@/lib/stores';
import { useMyCustomers, useWaTypingIndicators } from '@/lib/hooks';
import { WaConversationItem, SelectionModeHeader, Spinner } from './_components';
import type { WaConversation } from '@/lib/api/services/whatsapp-types';

// ============================================================================
// Types
// ============================================================================

export interface WaConversationListProps {
  // Search
  conversationSearch: string;
  setConversationSearch: (value: string) => void;

  // Conversations data
  conversations: WaConversation[];
  isLoadingConversations: boolean;
  isFetchingConversations: boolean;

  // Selection
  selectionMode: boolean;
  selectedConversations: Set<string>;
  isBulkDeleting: boolean;
  handleSelectAll: () => void;
  handleToggleSelectionMode: () => void;
  handleToggleSelect: (phone: string) => void;
  setShowBulkDeleteConfirm: (value: boolean) => void;

  // Conversation selection
  selectedPhone: string | null;
  setSelectedPhone: (phone: string | null) => void;

  // Actions
  handleRefresh: () => void;
  handleOpenNewConversation: () => void;

  // Window map
  windowMap: Map<string, string>;

  // Unread count
  unreadCount: number;

  // Infinite scroll
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => void;

  // Mobile visibility
  showMessagesPanelOnMobile: boolean;
}

// ============================================================================
// Component
// ============================================================================

export function WaConversationList({
  conversationSearch,
  setConversationSearch,
  conversations,
  isLoadingConversations,
  isFetchingConversations,
  selectionMode,
  selectedConversations,
  isBulkDeleting,
  handleSelectAll,
  handleToggleSelectionMode,
  handleToggleSelect,
  setShowBulkDeleteConfirm,
  selectedPhone,
  setSelectedPhone,
  handleRefresh,
  handleOpenNewConversation,
  windowMap,
  unreadCount,
  hasNextPage,
  isFetchingNextPage,
  fetchNextPage,
  showMessagesPanelOnMobile,
}: WaConversationListProps) {
  // Privacy mode: masked agents can't initiate (typing a number defeats the
  // mask). They can only respond to inbound conversations.
  // Truthy check — TINYINT(1) comes back as number 1, not boolean true.
  const isMasked = useAuthStore((state) => !!state.user?.waPhoneMaskEnabled);
  // Has the agent been assigned customers? Used to refine the empty-state
  // copy — when assignments exist, "no conversations" is technically true
  // but the merged list already shows the customers as entry points, so
  // the empty state changes from a CTA to a soft hint. React Query dedupes
  // this with the conversation-state hook's call.
  const { data: myCustomers } = useMyCustomers();
  const hasAssignedCustomers = (myCustomers?.length ?? 0) > 0;

  // Manager-side typing pulse. The hook itself short-circuits for
  // non-managers and for orgs without the feature flag, so wiring it
  // here is free for users who shouldn't see indicators.
  const { getTyper } = useWaTypingIndicators();

  // ALL / UNREAD view filter over the loaded list (parity with the Text inbox).
  // Client-side view over already-fetched pages; pagination + real-time run on
  // the full `conversations` set.
  const [unreadOnly, setUnreadOnly] = useState(false);
  const shown = unreadOnly ? conversations.filter((c) => c.unreadCount > 0) : conversations;

  // Infinite scroll sentinel observer
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  const setupObserver = useCallback(() => {
    if (observerRef.current) {
      observerRef.current.disconnect();
    }
    if (!sentinelRef.current || !hasNextPage || isFetchingNextPage) return;

    observerRef.current = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          fetchNextPage();
        }
      },
      { rootMargin: '200px' }
    );
    observerRef.current.observe(sentinelRef.current);
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  useEffect(() => {
    setupObserver();
    return () => {
      observerRef.current?.disconnect();
    };
  }, [setupObserver]);
  return (
    <div
      className={`w-full md:w-[320px] md:shrink-0 flex flex-col h-full min-h-0 bg-[var(--card)] border-r border-[var(--border)] overflow-hidden ${showMessagesPanelOnMobile ? 'hidden md:flex' : 'flex'}`}
    >
      {/* Header — WhatsApp + refresh + new chat */}
      <div className="flex items-center justify-between px-4 pt-3.5 pb-1.5">
        <h1 className="text-[21px] font-black text-[var(--foreground)] flex items-center gap-2">
          <FaWhatsapp className="text-green-500 w-5 h-5" />
          WhatsApp
          {unreadCount > 0 && (
            <span className="min-w-[18px] h-[18px] px-1.5 grid place-items-center text-[11px] font-black rounded-full bg-green-500 text-white">
              {unreadCount}
            </span>
          )}
        </h1>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isFetchingConversations}
            title="Refresh"
            aria-label="Refresh"
            className="grid place-items-center w-9 h-9 rounded-full text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)] transition-colors disabled:opacity-50"
          >
            <FiRefreshCw className={`w-[18px] h-[18px] ${isFetchingConversations ? 'animate-spin' : ''}`} />
          </button>
          {!isMasked && (
            <button
              type="button"
              onClick={handleOpenNewConversation}
              title="New chat"
              aria-label="New chat"
              className="grid place-items-center w-9 h-9 rounded-full text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
            >
              <span className="relative grid place-items-center w-[18px] h-[18px]">
                <FiMessageSquare className="w-[18px] h-[18px]" />
                <FiPlus className="absolute -top-1 -right-1.5 w-2.5 h-2.5 stroke-[3.5] rounded-full bg-[var(--card)]" />
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Search / selection bar */}
      {selectionMode ? (
        <div className="px-3 pb-2">
          <SelectionModeHeader
            selectedCount={selectedConversations.size}
            totalCount={conversations.length}
            isDeleting={isBulkDeleting}
            onSelectAll={handleSelectAll}
            onDelete={() => setShowBulkDeleteConfirm(true)}
            onCancel={handleToggleSelectionMode}
          />
        </div>
      ) : (
        <div className="flex items-center gap-3 px-4 py-2 border-b border-[var(--border)]">
          <div className="flex-1 flex items-center gap-2 text-[var(--muted-foreground)]">
            <FiSearch className="w-4 h-4 shrink-0" />
            <input
              value={conversationSearch}
              onChange={(e) => setConversationSearch(e.target.value)}
              placeholder="Search conversations"
              aria-label="Search WhatsApp conversations"
              className="nx-search-input w-full bg-transparent outline-none text-[13.5px] text-[var(--foreground)]"
            />
            {conversationSearch && (
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setConversationSearch('')}
                title="Clear search"
                aria-label="Clear search"
                className="grid place-items-center w-5 h-5 rounded-full shrink-0 text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
              >
                <FiX className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <button onClick={() => setUnreadOnly(false)} className={`text-[13px] font-black ${!unreadOnly ? 'text-green-600' : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'}`}>ALL</button>
          <button onClick={() => setUnreadOnly(true)} className={`text-[13px] font-black ${unreadOnly ? 'text-green-600' : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'}`}>UNREAD</button>
          <button onClick={handleToggleSelectionMode} className="text-[13px] font-black text-green-600">Edit</button>
        </div>
      )}

      {/* Body */}
      <div className="flex-1 flex flex-col min-h-0">
        {isLoadingConversations && conversations.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <Spinner />
          </div>
        ) : shown.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-[var(--muted-foreground)] gap-4 px-6 text-center">
            <FaWhatsapp className="w-12 h-12 opacity-20 text-green-500" />
            {conversationSearch ? (
              <p className="text-sm">No results for &quot;{conversationSearch}&quot;</p>
            ) : unreadOnly ? (
              <p className="text-sm">No unread conversations</p>
            ) : hasAssignedCustomers ? (
              // The agent already has customers visible in the My Customers
              // panel above — pointing at them is more useful than a generic
              // "no conversations" message. Skip the New Chat CTA entirely
              // when customers exist, regardless of mask state.
              <p className="text-sm">
                Pick a customer from the list above to start a conversation.
              </p>
            ) : (
              <>
                <div>
                  <p className="font-medium text-[var(--foreground)]">No conversations yet</p>
                  <p className="text-sm mt-1">
                    {isMasked
                      ? 'Inbound WhatsApp messages will appear here'
                      : 'Start a new WhatsApp chat by sending a template message'}
                  </p>
                </div>
                {!isMasked && (
                  <Button size="sm" onClick={handleOpenNewConversation}>
                    <FiPlus className="w-4 h-4 mr-1" />
                    New Chat
                  </Button>
                )}
              </>
            )}
          </div>
        ) : (
          <div
            className="flex-1 overflow-y-auto min-h-0"
            role="listbox"
            aria-label="WhatsApp Conversations"
          >
            {shown.map((conv) => {
              const normalized = normalizePhone(conv.phoneNumber);
              const isSelected = !!selectedPhone && normalizePhone(selectedPhone) === normalized;
              const isChecked = selectedConversations.has(normalized);
              const windowEnd = windowMap.get(normalized);
              // Typing indicator is keyed by normalized customer phone
              // (matches what the server emits). getTyper returns null
              // for non-managers and for orgs without the feature, so
              // the badge stays invisible until both conditions hold.
              const typer = getTyper(normalized);

              return (
                <WaConversationItem
                  key={normalized}
                  conversation={conv}
                  isSelected={isSelected}
                  isSelectionMode={selectionMode}
                  isChecked={isChecked}
                  onClick={() => setSelectedPhone(conv.phoneNumber)}
                  onToggleSelect={() => handleToggleSelect(conv.phoneNumber)}
                  windowEnd={windowEnd}
                  typingAgentName={typer?.userName ?? null}
                />
              );
            })}
            {/* Infinite scroll sentinel */}
            {hasNextPage && (
              <div ref={sentinelRef} className="flex justify-center py-2">
                {isFetchingNextPage && <Spinner className="w-4 h-4" />}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
