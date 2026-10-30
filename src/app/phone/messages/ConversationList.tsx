'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  FiSearch,
  FiRefreshCw,
  FiTrash2,
  FiX,
  FiPlus,
  FiSquare,
  FiCheckSquare,
  FiUsers,
  FiMessageSquare,
  FiChevronUp,
} from 'react-icons/fi';
import { Button, StyledSelect } from '@/components/ui';
import { TrialSmsLeft } from '@/components/phone/TrialLimitBanner';
import { normalizePhone } from '@/lib/utils/phone';
import { useInfiniteScroll } from '@/lib/hooks';
import {
  UnifiedConversationItem,
  GlobalSearchResultItem,
  type GroupMembershipInfo,
  type SelectedConversation,
  type GroupedMessageResult,
} from './_components';
import type { UnifiedConversation } from '@/lib/api/services/sms.service';

// ============================================================================
// Shared Sub-Components
// ============================================================================

export interface SelectionModeHeaderProps {
  selectedCount: number;
  totalCount: number;
  isDeleting: boolean;
  onSelectAll: () => void;
  onDelete: () => void;
  onCancel: () => void;
}

export function SelectionModeHeader({
  selectedCount,
  totalCount,
  isDeleting,
  onSelectAll,
  onDelete,
  onCancel,
}: SelectionModeHeaderProps) {
  return (
    <div className="flex items-center gap-2 p-2 bg-[var(--muted)] rounded-lg">
      <Button size="sm" variant="ghost" onClick={onSelectAll} className="text-sm">
        {selectedCount === totalCount ? (
          <>
            <FiCheckSquare className="w-4 h-4 mr-1" /> Deselect All
          </>
        ) : (
          <>
            <FiSquare className="w-4 h-4 mr-1" /> Select All
          </>
        )}
      </Button>
      <span className="text-sm text-[var(--muted-foreground)] flex-1">
        {selectedCount} selected
      </span>
      <Button
        size="sm"
        variant="ghost"
        onClick={onDelete}
        disabled={selectedCount === 0 || isDeleting}
        className="text-red-600 hover:text-red-700 hover:bg-red-100 dark:hover:bg-red-900/30"
      >
        {isDeleting ? (
          <div className="w-4 h-4 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
        ) : (
          <FiTrash2 className="w-4 h-4" />
        )}
      </Button>
      <Button size="sm" variant="ghost" onClick={onCancel}>
        <FiX className="w-4 h-4" />
      </Button>
    </div>
  );
}

export function Spinner({ className = 'h-8 w-8' }: { className?: string }) {
  return (
    <div
      className={`animate-spin rounded-full border-2 border-[var(--border)] border-t-transparent ${className}`}
    />
  );
}

// ============================================================================
// Types
// ============================================================================

export interface ConversationListProps {
  // Search
  conversationSearch: string;
  setConversationSearch: (value: string) => void;
  debouncedSearch: string;

  // Conversations data
  conversations: UnifiedConversation[];
  isLoadingConversations: boolean;
  isFetchingConversations: boolean;
  isFetchingMessageSearch: boolean;

  // Infinite scroll
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => void;

  // Selection
  selectionMode: boolean;
  selectedIds: Set<string>;
  isBulkDeleting: boolean;
  handleSelectAll: () => void;
  handleToggleSelectionMode: () => void;
  handleToggleSelect: (id: string) => void;
  setShowBulkDeleteConfirm: (value: boolean) => void;

  // Conversation selection
  selectedConversation: SelectedConversation | null;
  setSelectedConversation: (conv: SelectedConversation | null) => void;

  // Actions
  handleRefresh: () => void;
  handleOpenNewConversation: () => void;
  setShowCreateGroup: (value: boolean) => void;

  // Message search results
  groupedMessageResults: GroupedMessageResult[];
  isLoadingMessageSearch: boolean;
  handleMessageSearchResultClick: (phoneNumber: string, messageId: number) => void;

  // Group memberships
  groupMemberships: Record<string, GroupMembershipInfo>;

  // Mobile visibility
  showMessagesPanelOnMobile: boolean;
}

// ============================================================================
// Component
// ============================================================================

export function ConversationList({
  conversationSearch,
  setConversationSearch,
  debouncedSearch,
  conversations,
  isLoadingConversations,
  isFetchingConversations,
  isFetchingMessageSearch,
  hasNextPage,
  isFetchingNextPage,
  fetchNextPage,
  selectionMode,
  selectedIds,
  isBulkDeleting,
  handleSelectAll,
  handleToggleSelectionMode,
  handleToggleSelect,
  setShowBulkDeleteConfirm,
  selectedConversation,
  setSelectedConversation,
  handleRefresh,
  handleOpenNewConversation,
  setShowCreateGroup,
  groupedMessageResults,
  isLoadingMessageSearch,
  handleMessageSearchResultClick,
  groupMemberships,
  showMessagesPanelOnMobile,
}: ConversationListProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const prevFirstConvKeyRef = useRef<string | null>(null);
  const [showNewMessagePill, setShowNewMessagePill] = useState(false);
  const isNearTopRef = useRef(true);
  const [filter, setFilter] = useState<'all' | 'unread' | 'campaigns' | 'chats'>('all');
  const [composeOpen, setComposeOpen] = useState(false);
  // Portal-anchored position for the compose menu (right-aligned to the button), so
  // it escapes the list panel's `overflow-hidden` instead of being clipped on the right.
  const [composeMenuPos, setComposeMenuPos] = useState<{ top: number; right: number } | null>(null);
  // Search focus drives the expand pattern: when the search is focused (or holds a
  // query) it grows to fill the row and the filter + Edit controls hide, so the field
  // is never clipped. It collapses back to a compact field beside the filter on blur.
  const [searchFocused, setSearchFocused] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  // Expanded while focused OR holding a query, so a typed search stays full-width
  // (filter hidden) even after the field loses focus, until it's cleared.
  const searchExpanded = searchFocused || conversationSearch.length > 0;
  // Close the expanded search: clear the query, drop focus and collapse back to the
  // compact field + filter. Gives the expanded state an explicit exit.
  const closeSearch = () => {
    setConversationSearch('');
    setSearchFocused(false);
    searchInputRef.current?.blur();
  };

  // Client-side view filter over the already-fetched list; pagination +
  // real-time still run on the full `conversations` set.
  // campaigns = bulk-SMS-touched threads; chats = everything except those.
  const shown =
    filter === 'unread'
      ? conversations.filter((c) => c.unreadCount > 0)
      : filter === 'campaigns'
        ? conversations.filter((c) => !c.isGroup && c.attributedCampaignId != null)
        : filter === 'chats'
          ? conversations.filter((c) => c.isGroup || c.attributedCampaignId == null)
          : conversations;

  const { sentinelRef } = useInfiniteScroll({
    onLoadMore: () => hasNextPage && fetchNextPage(),
    enabled: hasNextPage && !isFetchingNextPage,
    threshold: 200,
  });

  // Track scroll position to know if user is near the top
  const handleScroll = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const nearTop = el.scrollTop < 100;
    isNearTopRef.current = nearTop;
    if (nearTop) setShowNewMessagePill(false);
  }, []);

  // When first conversation changes: auto-scroll if near top, show pill otherwise
  useEffect(() => {
    if (conversations.length === 0) return;
    const first = conversations[0];
    const key = `${first.isGroup ? `g${first.groupId}` : first.phoneNumber}-${first.lastMessageAt}`;
    if (prevFirstConvKeyRef.current !== null && prevFirstConvKeyRef.current !== key) {
      if (isNearTopRef.current) {
        scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        setShowNewMessagePill(true);
      }
    }
    prevFirstConvKeyRef.current = key;
  }, [conversations]);

  const handleNewMessagePillClick = useCallback(() => {
    scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    setShowNewMessagePill(false);
  }, []);

  const getConversationId = (conv: UnifiedConversation) => {
    return conv.isGroup ? `group-${conv.groupId}` : normalizePhone(conv.phoneNumber || '');
  };

  const isConversationSelected = (conv: UnifiedConversation) => {
    if (!selectedConversation) return false;
    if (conv.isGroup && selectedConversation.type === 'group') {
      return conv.groupId === selectedConversation.groupId;
    }
    if (!conv.isGroup && selectedConversation.type === 'direct' && conv.phoneNumber) {
      return normalizePhone(conv.phoneNumber) === selectedConversation.id;
    }
    return false;
  };

  const handleConversationClick = (conv: UnifiedConversation) => {
    if (conv.isGroup === true && conv.groupId !== undefined && conv.groupId !== null) {
      setSelectedConversation({
        type: 'group',
        id: `group-${conv.groupId}`,
        groupId: conv.groupId,
      });
    } else if (conv.phoneNumber) {
      setSelectedConversation({
        type: 'direct',
        id: normalizePhone(conv.phoneNumber),
        phoneNumber: conv.phoneNumber,
      });
    } else if (conv.id) {
      setSelectedConversation({
        type: 'direct',
        id: normalizePhone(conv.id),
        phoneNumber: conv.id,
      });
    }
  };

  return (
    <div
      className={`w-full md:w-[320px] md:shrink-0 flex flex-col h-full min-h-0 bg-[var(--card)] border-r border-[var(--border)] overflow-hidden ${showMessagesPanelOnMobile ? 'hidden md:flex' : 'flex'}`}
    >
      {/* Header — Messages + refresh + compose */}
      <div className="flex items-center justify-between px-4 pt-3.5 pb-1.5">
        <div className="flex items-center gap-2.5 min-w-0">
          <h1 className="text-[21px] font-black text-[var(--foreground)]">Messages</h1>
          {/* KYC trial: remaining SMS today (capped orgs only — renders nothing
              otherwise, so the header is unchanged for verified/prod users). */}
          <TrialSmsLeft />
        </div>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isFetchingConversations || isFetchingMessageSearch}
            title="Refresh"
            aria-label="Refresh"
            className="grid place-items-center w-9 h-9 rounded-full text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)] transition-colors disabled:opacity-50"
          >
            <FiRefreshCw className={`w-[18px] h-[18px] ${isFetchingConversations || isFetchingMessageSearch ? 'animate-spin' : ''}`} />
          </button>
          <div className="relative">
            <button
              type="button"
              onClick={(e) => {
                if (composeOpen) { setComposeOpen(false); return; }
                const r = e.currentTarget.getBoundingClientRect();
                setComposeMenuPos({ top: r.bottom + 8, right: window.innerWidth - r.right });
                setComposeOpen(true);
              }}
              title="Compose"
              aria-label="Compose"
              aria-haspopup="menu"
              aria-expanded={composeOpen}
              className="grid place-items-center w-9 h-9 rounded-full text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
            >
              <span className="relative grid place-items-center w-[18px] h-[18px]">
                <FiMessageSquare className="w-[18px] h-[18px]" />
                <FiPlus className="absolute -top-1 -right-1.5 w-2.5 h-2.5 stroke-[3.5] rounded-full bg-[var(--card)]" />
              </span>
            </button>
            {composeOpen && composeMenuPos && createPortal(
              <>
                <div className="fixed inset-0 z-[55]" onClick={() => setComposeOpen(false)} />
                <div
                  role="menu"
                  style={{ position: 'fixed', top: composeMenuPos.top, right: composeMenuPos.right }}
                  className="z-[56] min-w-[180px] rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-xl p-1.5"
                >
                  <button type="button" onClick={() => { setComposeOpen(false); handleOpenNewConversation(); }} className="flex items-center gap-2.5 w-full text-left text-sm px-3 py-2 rounded-lg font-semibold text-[var(--foreground)] hover:bg-[var(--muted)] [&_svg]:w-[18px] [&_svg]:h-[18px]">
                    <FiMessageSquare /> New message
                  </button>
                  <button type="button" onClick={() => { setComposeOpen(false); setShowCreateGroup(true); }} className="flex items-center gap-2.5 w-full text-left text-sm px-3 py-2 rounded-lg font-semibold text-[var(--foreground)] hover:bg-[var(--muted)] [&_svg]:w-[18px] [&_svg]:h-[18px]">
                    <FiUsers /> New group
                  </button>
                </div>
              </>,
              document.body
            )}
          </div>
        </div>
      </div>

      {/* Filter / selection bar */}
      {selectionMode ? (
        <div className="px-3 pb-2">
          <SelectionModeHeader
            selectedCount={selectedIds.size}
            totalCount={conversations.length}
            isDeleting={isBulkDeleting}
            onSelectAll={handleSelectAll}
            onDelete={() => setShowBulkDeleteConfirm(true)}
            onCancel={handleToggleSelectionMode}
          />
        </div>
      ) : (
        <div className="flex items-center gap-3 px-4 py-2 border-b border-[var(--border)]">
          <div className="flex-1 min-w-0 flex items-center gap-2 text-[var(--muted-foreground)]">
            <FiSearch className="w-4 h-4 shrink-0" />
            <input
              ref={searchInputRef}
              value={conversationSearch}
              onChange={(e) => setConversationSearch(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              placeholder={searchExpanded ? 'Search texts' : 'Search'}
              aria-label="Search conversations and messages"
              className="nx-search-input w-full min-w-0 bg-transparent outline-none text-[13.5px] text-[var(--foreground)]"
            />
            {searchExpanded && (
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={closeSearch}
                title="Close search"
                aria-label="Close search"
                className="grid place-items-center w-5 h-5 rounded-full shrink-0 text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
              >
                <FiX className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          {/* Filter + Edit hide while the search is active so the field expands to
              fill the row (and is never clipped). The filter's fixed-width wrapper
              keeps the StyledSelect trigger — whose base `w-full` beats any width we
              pass, since cn = clsx with no tailwind-merge — inside the panel. */}
          {!searchExpanded && (
            <>
              <div className="w-[150px] shrink-0">
                <StyledSelect
                  value={filter}
                  onChange={(v) => setFilter(v as 'all' | 'unread' | 'campaigns' | 'chats')}
                  aria-label="Filter conversations"
                  className="w-full text-[13px] font-bold"
                >
                  <option value="all">All</option>
                  <option value="unread">Unread</option>
                  <option value="campaigns">Campaigns</option>
                  <option value="chats">Non-campaign</option>
                </StyledSelect>
              </div>
              <button onClick={handleToggleSelectionMode} className="shrink-0 text-[13px] font-black text-[var(--foreground)]">Edit</button>
            </>
          )}
        </div>
      )}

      {/* Body */}
      {isLoadingConversations && conversations.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <Spinner />
        </div>
      ) : shown.length === 0 && groupedMessageResults.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-[var(--muted-foreground)] gap-4 px-6 text-center">
          <FiMessageSquare className="w-12 h-12 opacity-30" />
          {filter === 'unread' ? (
            <p className="text-sm">No unread messages</p>
          ) : filter === 'campaigns' ? (
            <p className="text-sm">No campaign conversations</p>
          ) : conversationSearch ? (
            <p className="text-sm">No results for &quot;{conversationSearch}&quot;</p>
          ) : (
            <>
              <div>
                <p className="font-medium text-[var(--foreground)]">No conversations yet</p>
                <p className="text-sm mt-1">Send a message or create a group to get started</p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={handleOpenNewConversation}>
                  <FiPlus className="w-4 h-4 mr-1" />
                  New Message
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setShowCreateGroup(true)}>
                  <FiUsers className="w-4 h-4 mr-1" />
                  New Group
                </Button>
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="flex-1 relative min-h-0">
          {/* New message pill */}
          {showNewMessagePill && (
            <button
              onClick={handleNewMessagePillClick}
              className="absolute top-2 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1.5 px-3 py-1.5 bg-[var(--coral)] text-white text-xs font-medium rounded-full shadow-lg hover:bg-[var(--coral-700)] transition-all animate-in slide-in-from-top-2 duration-200"
            >
              <FiChevronUp className="w-3 h-3" />
              New message
            </button>
          )}
          <div
            ref={scrollContainerRef}
            onScroll={handleScroll}
            className="h-full overflow-y-auto"
            role="listbox"
            aria-label="Conversations"
          >
            {shown.map((conv) => {
              const convId = getConversationId(conv);
              const isSelected = isConversationSelected(conv);
              const isChecked = selectedIds.has(convId);
              const groupInfo =
                !conv.isGroup && conv.phoneNumber
                  ? groupMemberships[normalizePhone(conv.phoneNumber)]
                  : undefined;
              return (
                <UnifiedConversationItem
                  key={convId}
                  conversation={conv}
                  isSelected={isSelected}
                  isSelectionMode={selectionMode}
                  isChecked={isChecked}
                  onClick={() => handleConversationClick(conv)}
                  onToggleSelect={() => handleToggleSelect(convId)}
                  groupMembership={groupInfo}
                />
              );
            })}

            {/* Infinite scroll sentinel */}
            <div ref={sentinelRef} className="h-1" />
            {isFetchingNextPage && (
              <div className="flex items-center justify-center py-3">
                <Spinner className="w-5 h-5" />
              </div>
            )}

            {debouncedSearch.length >= 2 && groupedMessageResults.length > 0 && (
              <>
                <div className="px-3 py-2 mt-2 border-t border-[var(--border)]">
                  <p className="text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wider">
                    Messages containing &quot;{debouncedSearch}&quot;
                  </p>
                </div>
                {groupedMessageResults.map((group) => (
                  <GlobalSearchResultItem
                    key={group.phone}
                    phone={group.phone}
                    messages={group.messages}
                    searchQuery={debouncedSearch}
                    onMessageClick={(messageId) =>
                      handleMessageSearchResultClick(group.phone, messageId)
                    }
                  />
                ))}
              </>
            )}

            {debouncedSearch.length >= 2 && isLoadingMessageSearch && (
              <div className="flex items-center justify-center py-4">
                <Spinner className="w-5 h-5" />
                <span className="ml-2 text-sm text-[var(--muted-foreground)]">
                  Searching messages...
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
