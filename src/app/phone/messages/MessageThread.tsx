'use client';

import React, { useMemo, useState, type RefCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  FiSearch,
  FiImage,
  FiX,
  FiCheckSquare,
  FiUsers,
  FiInfo,
  FiArrowLeft,
  FiSend,
  FiMessageSquare,
  FiPhone,
  FiUserPlus,
  FiMoreHorizontal,
  FiTrash2,
  FiChevronsLeft,
  FiMail,
} from 'react-icons/fi';
import { Button, Input } from '@/components/ui';
import { formatPhoneNumber } from '@/lib/utils/formatting';
import { normalizePhone } from '@/lib/utils/phone';
import { useAuthStore } from '@/lib/stores/auth';
import {
  MessageBubble,
  ConversationHeaderContent,
  type SelectedConversation,
  type UseGroupMessagesStateReturn,
  type Message,
  type GroupedMessageResult,
} from './_components';
import type { UnifiedConversation as ApiUnifiedConversation } from '@/lib/api/services/sms.service';
import { SelectionModeHeader, Spinner } from './ConversationList';

// ============================================================================
// Sub-Components
// ============================================================================

interface DragOverlayProps {
  isVisible: boolean;
}

function DragOverlay({ isVisible }: DragOverlayProps) {
  if (!isVisible) return null;
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-[var(--primary-100)]/95 dark:bg-[var(--primary-900)]/95 backdrop-blur-sm">
      <div className="text-center p-8 rounded-2xl bg-white/80 dark:bg-gray-900/80 shadow-xl border-2 border-dashed border-[var(--border)]">
        <FiImage className="w-16 h-16 mx-auto mb-4 text-[var(--foreground)]" />
        <p className="text-xl font-semibold text-[var(--foreground)]">Drop images here</p>
      </div>
    </div>
  );
}

interface GroupHeaderProps {
  groupName: string;
  memberCount?: number;
  isFetching?: boolean;
  onInfoClick: () => void;
  onSearchClick: () => void;
  onSelectClick: () => void;
  showSearch: boolean;
  hasMessages: boolean;
}

function GroupHeader({
  groupName,
  memberCount,
  isFetching,
  onInfoClick,
  onSearchClick,
  onSelectClick,
  showSearch,
  hasMessages,
}: GroupHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-[var(--primary-100)] dark:bg-[var(--primary-900)] flex items-center justify-center">
          <FiUsers className="w-5 h-5 text-[var(--foreground)]" />
        </div>
        <div>
          <h2 className="font-semibold text-[var(--foreground)]">{groupName}</h2>
          {memberCount !== undefined && (
            <p className="text-xs text-[var(--muted-foreground)]">{memberCount} members</p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        {isFetching && <Spinner className="w-4 h-4" />}
        <Button
          size="icon"
          variant={showSearch ? 'primary' : 'ghost'}
          onClick={onSearchClick}
          aria-label="Search messages"
          title="Search in this conversation"
          className={showSearch ? '' : 'text-[var(--muted-foreground)]'}
        >
          <FiSearch className="w-4 h-4" />
        </Button>
        {hasMessages && (
          <Button
            size="icon"
            variant="ghost"
            onClick={onSelectClick}
            aria-label="Select messages"
            title="Select messages to delete"
            className="text-[var(--muted-foreground)]"
          >
            <FiCheckSquare className="w-4 h-4" />
          </Button>
        )}
        <Button
          size="icon"
          variant="ghost"
          onClick={onInfoClick}
          aria-label="Group info"
          title="View group info"
          className="text-[var(--muted-foreground)]"
        >
          <FiInfo className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

// ============================================================================
// Types
// ============================================================================

export interface MessageThreadProps {
  // Selection
  selectedConversation: SelectedConversation | null;
  setSelectedConversation: (conv: SelectedConversation | null) => void;
  selectedUnifiedConversation: ApiUnifiedConversation | null;

  // Messages
  messages: Message[];
  isLoadingMessages: boolean;
  isFetchingMessages: boolean;

  // Group
  isGroupSelected: boolean;
  selectedGroupId: number | null;
  groupState: UseGroupMessagesStateReturn;
  groupMemberNames: Record<string, string>;

  // Direct messages
  messagesContainerRef: React.RefObject<HTMLDivElement | null>;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
  activeEndRef: React.RefObject<HTMLDivElement | null>;

  // Direct message search
  messageSearch: string;
  setMessageSearch: (value: string) => void;
  debouncedMessageSearch: string;
  showMessageSearch: boolean;
  setShowMessageSearch: (value: boolean) => void;
  messagesData: { total: number } | null;

  // Direct message selection
  messageSelectionMode: boolean;
  selectedMessagesCount: number;
  isMessageSelected: (id: number) => boolean;
  handleToggleMessageSelectionMode: () => void;
  handleToggleMessageSelect: (id: number) => void;
  handleSelectAllMessages: () => void;
  setShowBulkMessageDeleteConfirm: (value: boolean) => void;
  isBulkDeletingMessages: boolean;

  // Scroll
  highlightedMessageId: number | null;
  hasMore: boolean;
  activeIsLoadingOlder: boolean;
  loadOlderSentinelRef: RefCallback<HTMLDivElement>;

  // Phone
  effectivePhone: string | null;
  normalizedSelectedPhone: string | null;

  // Drag
  isDragging: boolean;
  handleDragEnter: (e: React.DragEvent) => void;
  handleDragLeave: (e: React.DragEvent) => void;
  handleDragOver: (e: React.DragEvent) => void;
  handleDrop: (e: React.DragEvent) => void;

  // Actions
  handleImageClick: (url: string) => void;
  setShowGroupInfo: (value: boolean) => void;

  // Direct-conversation header actions (RingCentral)
  onCall?: (num: string) => void;
  onAddContact?: (num: string) => void;
  onDeleteConversation?: () => void;
  onMarkUnread?: () => void;
  onToggleDetails?: () => void;
  detailsOpen?: boolean;

  // Grid width (narrows when the Conversation Details column is open)
  mainColSpanClass?: string;

  // Mobile visibility
  showMessagesPanelOnMobile: boolean;

  // Children (MessageComposer)
  children: React.ReactNode;
}

// ============================================================================
// Component
// ============================================================================

export function MessageThread({
  selectedConversation,
  setSelectedConversation,
  selectedUnifiedConversation,
  messages,
  isLoadingMessages,
  isFetchingMessages,
  isGroupSelected,
  selectedGroupId,
  groupState,
  groupMemberNames,
  messagesContainerRef,
  messagesEndRef,
  activeEndRef,
  messageSearch,
  setMessageSearch,
  debouncedMessageSearch,
  showMessageSearch,
  setShowMessageSearch,
  messagesData,
  messageSelectionMode,
  selectedMessagesCount,
  isMessageSelected,
  handleToggleMessageSelectionMode,
  handleToggleMessageSelect,
  handleSelectAllMessages,
  setShowBulkMessageDeleteConfirm,
  isBulkDeletingMessages,
  highlightedMessageId,
  hasMore,
  activeIsLoadingOlder,
  loadOlderSentinelRef,
  effectivePhone,
  normalizedSelectedPhone,
  isDragging,
  handleDragEnter,
  handleDragLeave,
  handleDragOver,
  handleDrop,
  handleImageClick,
  setShowGroupInfo,
  onCall,
  onAddContact,
  onDeleteConversation,
  onMarkUnread,
  onToggleDetails,
  detailsOpen,
  mainColSpanClass = 'lg:col-span-2',
  showMessagesPanelOnMobile,
  children,
}: MessageThreadProps) {
  // Multi-number: determine user's phones for "via" labels
  const user = useAuthStore((s) => s.user);
  const userPhones = useMemo(() => {
    if (!user?.phoneNumbers || user.phoneNumbers.length <= 1) return null;
    return new Set(user.phoneNumbers.map((p) => normalizePhone(p.phoneNumber)));
  }, [user?.phoneNumbers]);

  const [headerMenuOpen, setHeaderMenuOpen] = useState(false);
  const [headerMenuPos, setHeaderMenuPos] = useState<{ top: number; right: number } | null>(null);

  return (
    <div
      className={`${mainColSpanClass} flex flex-col h-full min-h-0 bg-[var(--card)] border-r border-[var(--border)] overflow-hidden relative ${
        isDragging ? 'ring-2 ring-inset ring-[var(--primary-600)]' : ''
      } ${showMessagesPanelOnMobile ? 'flex' : 'hidden md:flex'}`}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <DragOverlay isVisible={isDragging} />

      <div className="p-0 flex flex-col h-full min-h-0">
        {selectedConversation ? (
          <>
            {/* Header */}
            <div className="p-4 border-b border-[var(--border)]">
              {/* Mobile back button */}
              <button
                onClick={() => setSelectedConversation(null)}
                className="md:hidden flex items-center gap-1 text-sm text-[var(--foreground)] mb-2 -ml-1"
              >
                <FiArrowLeft className="w-4 h-4" />
                Conversations
              </button>
              {/* Selection mode header (works for both direct and group) */}
              {(messageSelectionMode && !isGroupSelected) ||
              (groupState.selectionMode && isGroupSelected) ? (
                <SelectionModeHeader
                  selectedCount={
                    isGroupSelected ? groupState.selectedMessageIds.size : selectedMessagesCount
                  }
                  totalCount={messages.length}
                  isDeleting={isGroupSelected ? groupState.isBulkDeleting : isBulkDeletingMessages}
                  onSelectAll={() => {
                    if (isGroupSelected) {
                      groupState.handleSelectAll();
                    } else {
                      handleSelectAllMessages();
                    }
                  }}
                  onDelete={() => {
                    if (isGroupSelected) {
                      groupState.setShowBulkDeleteConfirm(true);
                    } else {
                      setShowBulkMessageDeleteConfirm(true);
                    }
                  }}
                  onCancel={() => {
                    if (isGroupSelected) {
                      groupState.setSelectionMode(false);
                    } else {
                      handleToggleMessageSelectionMode();
                    }
                  }}
                />
              ) : isGroupSelected && selectedUnifiedConversation ? (
                <div className="flex flex-col gap-2">
                  <GroupHeader
                    groupName={selectedUnifiedConversation.displayName}
                    memberCount={Math.max(0, (selectedUnifiedConversation.memberCount ?? 0) - 1)}
                    isFetching={groupState.isFetchingMessages}
                    onInfoClick={() => setShowGroupInfo(true)}
                    onSearchClick={() => {
                      groupState.setShowMessageSearch(!groupState.showMessageSearch);
                    }}
                    onSelectClick={() => groupState.setSelectionMode(true)}
                    showSearch={groupState.showMessageSearch}
                    hasMessages={messages.length > 0}
                  />
                  {groupState.showMessageSearch && (
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted-foreground)]" />
                        <Input
                          type="text"
                          placeholder="Search in this group..."
                          value={groupState.messageSearch}
                          onChange={(e) => groupState.setMessageSearch(e.target.value)}
                          className="pl-10 w-full"
                          autoFocus
                        />
                        {groupState.messageSearch && (
                          <button
                            onClick={() => groupState.setMessageSearch('')}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                          >
                            <FiX className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-2">
                    {/* left — name + add-contact */}
                    <div className="flex items-center gap-1.5 min-w-0">
                      <ConversationHeaderContent
                        phone={effectivePhone || ''}
                        contactName={selectedUnifiedConversation?.contactName}
                        isNewConversation={!selectedUnifiedConversation}
                      />
                      <button
                        type="button"
                        onClick={() => effectivePhone && onAddContact?.(effectivePhone)}
                        title="Add contact"
                        aria-label="Add contact"
                        className="w-8 h-8 grid place-items-center rounded-full text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)] shrink-0"
                      >
                        <FiUserPlus className="w-[18px] h-[18px]" />
                      </button>
                    </div>
                    {/* right — call + search + details + more */}
                    <div className="flex items-center gap-1 shrink-0">
                      {isFetchingMessages && <Spinner className="w-4 h-4" />}
                      <button
                        type="button"
                        onClick={() => effectivePhone && onCall?.(effectivePhone)}
                        title="Call"
                        aria-label="Call"
                        className="w-9 h-9 grid place-items-center rounded-full text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-green-600 transition-colors"
                      >
                        <FiPhone className="w-[18px] h-[18px]" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowMessageSearch(!showMessageSearch);
                          if (showMessageSearch) setMessageSearch('');
                        }}
                        title="Search in this conversation"
                        aria-label="Search messages"
                        className={`w-9 h-9 grid place-items-center rounded-full transition-colors ${showMessageSearch ? 'bg-[var(--primary-600)] text-white' : 'text-[var(--muted-foreground)] hover:bg-[var(--muted)]'}`}
                      >
                        <FiSearch className="w-[18px] h-[18px]" />
                      </button>
                      <div className="relative">
                        <button
                          type="button"
                          onClick={(e) => {
                            if (headerMenuOpen) { setHeaderMenuOpen(false); return; }
                            const r = e.currentTarget.getBoundingClientRect();
                            setHeaderMenuPos({ top: r.bottom + 6, right: window.innerWidth - r.right });
                            setHeaderMenuOpen(true);
                          }}
                          title="More"
                          aria-haspopup="menu"
                          aria-expanded={headerMenuOpen}
                          className="w-9 h-9 grid place-items-center rounded-full text-[var(--muted-foreground)] hover:bg-[var(--muted)] transition-colors"
                        >
                          <FiMoreHorizontal className="w-[18px] h-[18px]" />
                        </button>
                        {headerMenuOpen && headerMenuPos && createPortal(
                          <>
                            <div className="fixed inset-0 z-[55]" onClick={() => setHeaderMenuOpen(false)} />
                            <div
                              role="menu"
                              style={{ position: 'fixed', top: headerMenuPos.top, right: headerMenuPos.right }}
                              className="z-[56] min-w-[200px] rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-xl p-1.5"
                            >
                              {messages.length > 0 && onMarkUnread && (
                                <button type="button" onClick={() => { setHeaderMenuOpen(false); onMarkUnread(); }} className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm font-medium text-left text-[var(--foreground)] hover:bg-[var(--muted)] [&_svg]:w-[18px] [&_svg]:h-[18px]">
                                  <FiMail /> Mark as unread
                                </button>
                              )}
                              {messages.length > 0 && (
                                <button type="button" onClick={() => { setHeaderMenuOpen(false); handleToggleMessageSelectionMode(); }} className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm font-medium text-left text-[var(--foreground)] hover:bg-[var(--muted)] [&_svg]:w-[18px] [&_svg]:h-[18px]">
                                  <FiCheckSquare /> Select text messages
                                </button>
                              )}
                              {onDeleteConversation && (
                                <button type="button" onClick={() => { setHeaderMenuOpen(false); onDeleteConversation(); }} className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm font-medium text-left text-[var(--danger)] hover:bg-red-50 dark:hover:bg-red-900/20 [&_svg]:w-[18px] [&_svg]:h-[18px]">
                                  <FiTrash2 /> Delete conversation
                                </button>
                              )}
                            </div>
                          </>,
                          document.body
                        )}
                      </div>
                      {/* Show-details toggle — always the RIGHTMOST control so it
                          keeps the same far-right position whether the panel is
                          closed (shown here) or open (the Details panel renders its
                          own close button at this same x). Matches RingCentral. */}
                      {onToggleDetails && !detailsOpen && (
                        <button
                          type="button"
                          onClick={onToggleDetails}
                          title="Show details"
                          aria-label="Show details"
                          className="w-9 h-9 hidden lg:grid place-items-center rounded-full text-[var(--muted-foreground)] hover:bg-[var(--muted)] transition-colors"
                        >
                          <FiChevronsLeft className="w-[18px] h-[18px]" />
                        </button>
                      )}
                    </div>
                  </div>
                  {showMessageSearch && (
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted-foreground)]" />
                        <Input
                          type="text"
                          placeholder="Search in this conversation..."
                          value={messageSearch}
                          onChange={(e) => setMessageSearch(e.target.value)}
                          className="pl-10 w-full"
                          autoFocus
                        />
                        {messageSearch && (
                          <button
                            onClick={() => setMessageSearch('')}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                          >
                            <FiX className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                      {debouncedMessageSearch && messagesData && (
                        <span className="text-xs text-[var(--muted-foreground)] whitespace-nowrap">
                          {messagesData.total} result
                          {messagesData.total !== 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* (Recipient number is shown by the header title itself — as the title
                for number-only chats, or beneath the contact name — so no separate
                sub-label here; RingCentral shows it once.) */}

            {/* Messages */}
            <div className="relative flex-1 min-h-0">
              <div
                key={
                  normalizedSelectedPhone ||
                  (selectedGroupId ? `group-${selectedGroupId}` : 'no-conversation')
                }
                ref={
                  (isGroupSelected
                    ? groupState.containerRef
                    : messagesContainerRef) as React.RefObject<HTMLDivElement>
                }
                className="h-full overflow-y-auto"
              >
                {isLoadingMessages ? (
                  <div className="flex items-center justify-center h-full">
                    <Spinner />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-[var(--muted-foreground)] gap-2 px-6 text-center">
                    {debouncedMessageSearch ? (
                      <>
                        <FiSearch className="w-8 h-8 opacity-30" />
                        <p className="text-sm">
                          No messages matching &quot;{debouncedMessageSearch}&quot;
                        </p>
                      </>
                    ) : (
                      <>
                        <FiSend className="w-8 h-8 opacity-30" />
                        <p className="text-sm">
                          {isGroupSelected
                            ? 'No messages in this group yet'
                            : 'No messages yet — start the conversation below'}
                        </p>
                      </>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col py-4 gap-2">
                    {hasMore && (
                      <div ref={loadOlderSentinelRef} className="flex justify-center py-2">
                        {activeIsLoadingOlder && <Spinner className="w-4 h-4" />}
                      </div>
                    )}
                    {messages.map((msg, index) => {
                      const prevMsg = index > 0 ? messages[index - 1] : null;
                      const showSenderLabel =
                        !prevMsg ||
                        prevMsg.sender !== msg.sender ||
                        prevMsg.direction !== msg.direction;

                      return (
                        <MessageBubble
                          key={msg.id}
                          message={msg}
                          isSelectionMode={
                            isGroupSelected ? groupState.selectionMode : messageSelectionMode
                          }
                          isSelected={
                            isGroupSelected
                              ? groupState.selectedMessageIds.has(msg.id)
                              : isMessageSelected(msg.id)
                          }
                          isHighlighted={highlightedMessageId === msg.id}
                          onImageClick={handleImageClick}
                          onToggleSelect={() =>
                            isGroupSelected
                              ? groupState.handleToggleSelect(msg.id)
                              : handleToggleMessageSelect(msg.id)
                          }
                          isGroupChat={isGroupSelected}
                          senderName={
                            isGroupSelected && msg.sender
                              ? groupMemberNames[normalizePhone(msg.sender)] ||
                                formatPhoneNumber(msg.sender)
                              : undefined
                          }
                          showSenderLabel={showSenderLabel}
                          viaPhone={
                            userPhones
                              ? msg.direction === 'outbound'
                                ? msg.sender
                                : msg.receiver
                              : undefined
                          }
                          selfName={user?.fullName}
                          onStartSelect={() => {
                            if (isGroupSelected) {
                              groupState.setSelectionMode(true);
                              groupState.handleToggleSelect(msg.id);
                            } else {
                              handleToggleMessageSelectionMode();
                              handleToggleMessageSelect(msg.id);
                            }
                          }}
                        />
                      );
                    })}
                    <div ref={activeEndRef as React.RefObject<HTMLDivElement>} className="h-1" />
                  </div>
                )}
              </div>
            </div>

            {/* Input Area (children = MessageComposer) */}
            {children}
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-[var(--muted-foreground)] gap-3 px-8 text-center">
            <FiMessageSquare className="w-12 h-12 opacity-20" />
            <div>
              <p className="font-medium text-[var(--foreground)]">Your messages</p>
              <p className="text-sm mt-1">Select a conversation from the list to view messages</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
