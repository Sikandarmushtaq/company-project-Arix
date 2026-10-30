'use client';

import React, { type RefCallback } from 'react';
import { FaWhatsapp } from 'react-icons/fa';
import {
  FiSearch,
  FiX,
  FiCheckSquare,
  FiArrowLeft,
  FiSend,
  FiUploadCloud,
  FiEye,
} from 'react-icons/fi';
import { GenericAvatar } from '@/components/phone/chrome/avatarUtils';
import { useContactDisplayName, useWaLiveWatch } from '@/lib/hooks';
import { useAuthStore } from '@/lib/stores';
import { CountdownTimer, WaMessageList, SelectionModeHeader, Spinner } from './_components';
import type { WaMessage, WaConversation } from '@/lib/api/services/whatsapp-types';
import type { ConversationWindow } from '@/lib/api/services/whatsapp.api';

// ============================================================================
// Live-watch banner (manager-only)
// ============================================================================

/**
 * Shows the agent's current draft text live, just above the composer.
 * Subscribes to the per-conversation watch room (server-gated by the
 * org's `wa_live_watch_enabled` flag + customer-belongs-to-org check).
 *
 * Hides itself when:
 *   - The hook returns no draft (no one's typing, or feature off).
 *   - The drafting agent IS the current user — we never watch ourselves;
 *     the textarea is already showing us our own text.
 *   - The user has no role to receive the broadcast (hook short-circuits).
 *
 * Server emits an empty `draft` when the agent disconnects, so a crashed
 * tab clears this banner immediately — managers never see stale text.
 */
function WaLiveWatchBanner({ customerPhone }: { customerPhone: string | null }) {
  const watch = useWaLiveWatch(customerPhone);
  const currentUserId = useAuthStore((s) => s.user?.id);
  const draft = watch.draft.trim();
  const isOwnDraft = watch.draftAgent?.userId === currentUserId;
  if (!draft || isOwnDraft) return null;
  return (
    <div
      role="status"
      aria-label={`${watch.draftAgent?.userName ?? 'Agent'} is typing`}
      className="mx-3 mb-2 px-3 py-2 rounded-lg border border-green-200 bg-green-50 dark:bg-green-900/20 dark:border-green-800"
    >
      <div className="flex items-center gap-2 text-xs text-[var(--muted-foreground)] mb-1">
        <FiEye className="w-3.5 h-3.5" />
        <span>
          <strong className="text-[var(--foreground)]">
            {watch.draftAgent?.userName ?? 'Agent'}
          </strong>{' '}
          is typing…
        </span>
      </div>
      <p className="text-sm text-[var(--foreground)] whitespace-pre-wrap break-words">{draft}</p>
    </div>
  );
}

// ============================================================================
// Types
// ============================================================================

export interface WaMessageThreadProps {
  // Selection
  selectedPhone: string | null;
  setSelectedPhone: (phone: string | null) => void;
  selectedConversation: WaConversation | null;

  // Messages
  messages: WaMessage[];
  isLoadingMessages: boolean;
  isFetchingMessages: boolean;

  // Refs
  messagesContainerRef: React.RefObject<HTMLDivElement | null>;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;

  // Search
  messageSearch: string;
  setMessageSearch: (value: string) => void;
  debouncedMessageSearch: string;
  showMessageSearch: boolean;
  setShowMessageSearch: (value: boolean) => void;

  // Selection mode
  messageSelectionMode: boolean;
  selectedMessagesCount: number;
  isMessageSelected: (id: number) => boolean;
  handleToggleMessageSelectionMode: () => void;
  handleToggleMessageSelect: (id: number) => void;
  handleSelectAllMessages: () => void;
  setShowBulkMessageDeleteConfirm: (value: boolean) => void;
  isBulkDeletingMessages: boolean;

  // Scroll
  hasMore: boolean;
  activeIsLoadingOlder: boolean;
  loadOlderSentinelRef: RefCallback<HTMLDivElement>;

  // Window
  currentWindow: ConversationWindow | null | undefined;
  hasActiveWindow: boolean;

  // Image preview
  onImageClick: (url: string) => void;

  // Reactions
  onReact?: (waMessageId: string, emoji: string) => void;
  onRemoveReaction?: (waMessageId: string) => void;

  // Drag-drop
  isDragging: boolean;
  handleDragEnter: (e: React.DragEvent) => void;
  handleDragLeave: (e: React.DragEvent) => void;
  handleDragOver: (e: React.DragEvent) => void;
  handleDrop: (e: React.DragEvent) => void;

  // Mobile visibility
  showMessagesPanelOnMobile: boolean;

  // Header action (e.g. WaCallButton)
  headerAction?: React.ReactNode;

  // Children (WaMessageComposer)
  children: React.ReactNode;
}

// ============================================================================
// Component
// ============================================================================

export function WaMessageThread({
  selectedPhone,
  setSelectedPhone,
  selectedConversation,
  messages,
  isLoadingMessages,
  isFetchingMessages,
  messagesContainerRef,
  messagesEndRef,
  messageSearch,
  setMessageSearch,
  debouncedMessageSearch,
  showMessageSearch,
  setShowMessageSearch,
  messageSelectionMode,
  selectedMessagesCount,
  isMessageSelected,
  handleToggleMessageSelectionMode,
  handleToggleMessageSelect,
  handleSelectAllMessages,
  setShowBulkMessageDeleteConfirm,
  isBulkDeletingMessages,
  hasMore,
  activeIsLoadingOlder,
  loadOlderSentinelRef,
  currentWindow,
  hasActiveWindow,
  onImageClick,
  onReact,
  onRemoveReaction,
  isDragging,
  handleDragEnter,
  handleDragLeave,
  handleDragOver,
  handleDrop,
  showMessagesPanelOnMobile,
  headerAction,
  children,
}: WaMessageThreadProps) {
  const contactDisplayName = useContactDisplayName(
    selectedConversation?.phoneNumber || selectedPhone || '',
    selectedConversation?.contactName
  );
  // Privacy mode hides the raw phone subtitle under the contact name.
  // Truthy check — TINYINT(1) comes back as number 1, not boolean true.
  const isMasked = useAuthStore((state) => !!state.user?.waPhoneMaskEnabled);

  return (
    <div
      className={`flex-1 min-w-0 flex flex-col h-full min-h-0 bg-[var(--card)] overflow-hidden relative ${
        showMessagesPanelOnMobile ? 'flex' : 'hidden md:flex'
      }`}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Drag-drop overlay */}
      {isDragging && (
        <div className="absolute inset-0 z-20 bg-green-500/10 border-2 border-dashed border-green-500 rounded-xl flex items-center justify-center backdrop-blur-sm">
          <div className="text-center">
            <FiUploadCloud className="w-12 h-12 text-green-500 mx-auto mb-2" />
            <p className="text-sm font-medium text-green-600">Drop file to attach</p>
            <p className="text-xs text-[var(--muted-foreground)]">
              Images, video, audio, or documents
            </p>
          </div>
        </div>
      )}
      <div className="p-0 flex flex-col h-full min-h-0">
        {selectedPhone ? (
          <>
            {/* Header */}
            <div className="p-4 border-b border-[var(--border)]">
              {/* Mobile back button */}
              <button
                onClick={() => setSelectedPhone(null)}
                className="md:hidden flex items-center gap-1 text-sm text-green-600 mb-2 -ml-1"
              >
                <FiArrowLeft className="w-4 h-4" />
                Conversations
              </button>

              {/* Selection mode header */}
              {messageSelectionMode ? (
                <SelectionModeHeader
                  selectedCount={selectedMessagesCount}
                  totalCount={messages.length}
                  isDeleting={isBulkDeletingMessages}
                  onSelectAll={handleSelectAllMessages}
                  onDelete={() => setShowBulkMessageDeleteConfirm(true)}
                  onCancel={handleToggleMessageSelectionMode}
                />
              ) : (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="relative shrink-0">
                        <GenericAvatar
                          name={contactDisplayName}
                          number={selectedConversation?.phoneNumber || selectedPhone || ''}
                          size={40}
                        />
                        <span className="absolute -bottom-0.5 -right-0.5 w-[15px] h-[15px] rounded-full bg-white dark:bg-[var(--card)] grid place-items-center">
                          <FaWhatsapp className="w-[11px] h-[11px] text-green-500" />
                        </span>
                      </span>
                      <div className="min-w-0">
                        <div className="text-lg font-bold text-[var(--foreground)] truncate">{contactDisplayName}</div>
                        {selectedConversation?.contactName && !isMasked && (
                          <div className="text-[13px] text-[var(--muted-foreground)] truncate">+{selectedPhone}</div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {headerAction}
                      {isFetchingMessages && <Spinner className="w-4 h-4" />}
                      {currentWindow && hasActiveWindow && (
                        <CountdownTimer windowEnd={currentWindow.windowEnd} />
                      )}
                      <button
                        type="button"
                        onClick={() => setShowMessageSearch(!showMessageSearch)}
                        title="Search in this conversation"
                        aria-label="Search messages"
                        className={`w-9 h-9 grid place-items-center rounded-full transition-colors ${showMessageSearch ? 'bg-green-600 text-white' : 'text-[var(--muted-foreground)] hover:bg-[var(--muted)]'}`}
                      >
                        <FiSearch className="w-[18px] h-[18px]" />
                      </button>
                      {messages.length > 0 && (
                        <button
                          type="button"
                          onClick={handleToggleMessageSelectionMode}
                          title="Select messages to delete"
                          aria-label="Select messages"
                          className="w-9 h-9 grid place-items-center rounded-full text-[var(--muted-foreground)] hover:bg-[var(--muted)] transition-colors"
                        >
                          <FiCheckSquare className="w-[18px] h-[18px]" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Message search bar */}
                  {showMessageSearch && (
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted-foreground)]" />
                        <input
                          type="text"
                          placeholder="Search in this conversation…"
                          value={messageSearch}
                          onChange={(e) => setMessageSearch(e.target.value)}
                          autoFocus
                          className="w-full rounded-xl border border-[var(--border)] bg-[var(--card)] pl-10 pr-9 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-green-500"
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
                    </div>
                  )}

                  {/* Window expired banner */}
                  {!hasActiveWindow && messages.length > 0 && (
                    <div className="px-3 py-1.5 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                      <p className="text-xs text-amber-600 dark:text-amber-400">
                        24-hour conversation window expired. Send a template to re-open.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Messages — shared component, identical mechanics to oversight */}
            <div className="relative flex-1 min-h-0">
              <WaMessageList
                conversationKey={selectedPhone}
                messages={messages}
                isLoading={isLoadingMessages}
                containerRef={messagesContainerRef}
                endRef={messagesEndRef}
                hasMore={hasMore}
                isLoadingOlder={activeIsLoadingOlder}
                loadOlderSentinelRef={loadOlderSentinelRef}
                searchTerm={debouncedMessageSearch}
                emptyState={
                  !debouncedMessageSearch ? (
                    <div className="flex flex-col items-center justify-center h-full text-[var(--muted-foreground)] gap-2 px-6 text-center">
                      <FiSend className="w-8 h-8 opacity-30" />
                      <p className="text-sm">
                        No messages yet. Send a template to start the conversation.
                      </p>
                    </div>
                  ) : undefined
                }
                selectionMode={messageSelectionMode}
                isMessageSelected={isMessageSelected}
                onToggleMessageSelect={handleToggleMessageSelect}
                onImageClick={onImageClick}
                onReact={onReact}
                onRemoveReaction={onRemoveReaction}
              />
            </div>

            {/* Manager live-watch banner — shows the agent's draft text
                in real time when another agent is currently composing a
                reply to this customer. Hidden when it's the current
                user's own draft (we don't watch ourselves). */}
            <WaLiveWatchBanner customerPhone={selectedPhone} />

            {/* Input Area (children = WaMessageComposer) */}
            {children}
          </>
        ) : (
          /* Empty state */
          <div className="flex-1 flex flex-col items-center justify-center text-[var(--muted-foreground)] gap-3 px-8 text-center">
            <FaWhatsapp className="w-16 h-16 text-green-500/20" />
            <div>
              <p className="font-medium text-[var(--foreground)]">Select a conversation</p>
              <p className="text-sm mt-1">Choose a chat or start a new one</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
