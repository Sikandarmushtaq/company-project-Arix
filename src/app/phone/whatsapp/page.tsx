'use client';

import React, { useCallback, useEffect, useRef, useLayoutEffect } from 'react';
import { FaWhatsapp } from 'react-icons/fa';
import { FiLock } from 'react-icons/fi';
import { Card, CardContent } from '@/components/ui';
import { PageTransition } from '@/components/phone';
import {
  useWaStatus,
  useWaUnreadCount,
  useWaConversationWindow,
  useWaSendMessage,
} from '@/lib/hooks';
import { useToast } from '@/lib/stores/toast';
import { DeleteConfirmationModal, ImagePreviewModal } from '@/app/phone/messages/_components';
import { formatPhoneNumber } from '@/lib/utils/formatting';

// Page-level hooks
import { useWaConversationState, useWaMessagesState, useWaSendMessageState } from './_components';

// Page-level sub-components
import { WaConversationList } from './WaConversationList';
import { WaMessageThread } from './WaMessageThread';
import { WaMessageComposer } from './WaMessageComposer';
import { WaNewConversationModal } from './_components/WaNewConversationModal';
import { useGlobalWaCall } from '@/lib/providers/WaCallProvider';
import { WaCallButton } from '@/components/phone/WaCallButton';

import type { RefCallback } from 'react';

// ============================================================
// State 1: WA Disabled
// ============================================================

function WaDisabledState() {
  return (
    <div className="h-[calc(100dvh-8rem)] flex items-center justify-center">
      <div className="text-center max-w-md px-6">
        <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-[var(--card)] border border-[var(--border)] flex items-center justify-center">
          <FiLock className="w-8 h-8 text-[var(--muted-foreground)]" />
        </div>
        <h2 className="text-xl font-bold mb-2">WhatsApp Messaging</h2>
        <p className="text-[var(--muted-foreground)] text-sm mb-6">
          WhatsApp messaging is not enabled on your account. Contact your administrator to enable
          this feature.
        </p>
        <Card>
          <CardContent className="p-4 text-left">
            <h3 className="font-semibold text-sm mb-2">How to get started</h3>
            <ol className="space-y-2 text-sm text-[var(--muted-foreground)]">
              <li className="flex gap-2">
                <span className="text-green-500 font-bold">1.</span>Contact your admin and request
                WhatsApp access
              </li>
              <li className="flex gap-2">
                <span className="text-green-500 font-bold">2.</span>Your admin will enable WhatsApp
                and assign a number
              </li>
              <li className="flex gap-2">
                <span className="text-green-500 font-bold">3.</span>This page will automatically
                update — no refresh needed
              </li>
            </ol>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ============================================================
// State 2: WA Enabled but no number assigned
// ============================================================

function WaSetupState() {
  return (
    <div className="h-[calc(100dvh-8rem)] flex items-center justify-center">
      <div className="text-center max-w-md px-6">
        <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-green-500/10 border border-green-500/30 flex items-center justify-center">
          <FaWhatsapp className="w-10 h-10 text-green-500" />
        </div>
        <h2 className="text-xl font-bold mb-2">WhatsApp Enabled</h2>
        <p className="text-[var(--muted-foreground)] text-sm mb-6">
          Your account is approved for WhatsApp. Your administrator needs to assign a WhatsApp
          Business number to complete the setup.
        </p>
        <Card>
          <CardContent className="p-4 text-left">
            <h3 className="font-semibold text-sm mb-2">Waiting for number assignment</h3>
            <p className="text-sm text-[var(--muted-foreground)]">
              Contact your admin to assign a WhatsApp Business number. This page will update
              automatically once assigned.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ============================================================
// State 3: Full Messaging UI
// ============================================================

function WaMessagingState() {
  // Real-time WA cache sync is already mounted globally via
  // `phone/layout.tsx` → `useRealtimeSync()` → `useRealtimeWaSync()`.
  // Mounting it again here would create a second instance with its
  // own dedupe ref, causing each wa:received event to optimistically
  // increment the unread badge twice (visible flash like "2 → 1"
  // before the eventual refetch corrects it).

  // WhatsApp calling state (global — provider runs in layout)
  const waCall = useGlobalWaCall();

  // "Request Call" opens the template composer pre-selected on the org's
  // call-permission template; this flag drives that pre-selection and is
  // cleared when the picker closes.
  const [autoCallTemplate, setAutoCallTemplate] = React.useState(false);

  // Image preview state
  const [previewImage, setPreviewImage] = React.useState<string | null>(null);

  // Conversation state
  const {
    conversationSearch,
    setConversationSearch,
    conversations,
    isLoadingConversations,
    isFetchingConversations,
    refetchConversations,
    selectedPhone,
    setSelectedPhone,
    normalizedSelectedPhone,
    selectionSource,
    selectedConversation,
    conversationSelectionMode,
    selectedConversations,
    handleToggleConversationSelectionMode,
    handleToggleConversationSelect,
    handleSelectAllConversations,
    showDeleteConfirmation,
    setShowDeleteConfirmation,
    showBulkConversationDeleteConfirm,
    setShowBulkConversationDeleteConfirm,
    handleConfirmDelete,
    handleConfirmBulkConversationDelete,
    isDeleting,
    isBulkDeleting,
    showNewConversation,
    setShowNewConversation,
    newPhoneInput,
    setNewPhoneInput,
    handleStartNewConversation,
    windowMap,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = useWaConversationState();

  // Messages state
  const {
    messages,
    isLoadingMessages,
    isFetchingMessages,
    refetchMessages,
    hasMoreMessages,
    isLoadingOlder,
    handleLoadOlder,
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
    showBulkMessageDeleteConfirm,
    setShowBulkMessageDeleteConfirm,
    handleConfirmBulkMessageDelete,
    isBulkDeleting: isBulkDeletingMessages,
  } = useWaMessagesState({
    normalizedSelectedPhone,
    selectedConversation: selectedConversation
      ? { unreadCount: selectedConversation.unreadCount }
      : null,
    selectionSource,
  });

  // Refs for the message-list scroll container + bottom sentinel.
  // Owned here (not in `useWaMessagesState`) because the after-send
  // imperative scroll below is the only consumer that needs them,
  // and the page is the only owner of the "send completed" signal.
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Send message state
  const {
    newMessage,
    setNewMessage,
    handleSend,
    isSending,
    hasActiveWindow,
    isWindowLoading,
    showTemplatePicker,
    setShowTemplatePicker,
    handleSendTemplate,
    isSendingTemplate,
    selectedFile,
    setSelectedFile,
    isUploading,
    isDragging,
    handleDragEnter,
    handleDragLeave,
    handleDragOver,
    handleDrop,
  } = useWaSendMessageState({
    selectedPhone: normalizedSelectedPhone,
    onMessageSent: () => {
      // After-send scroll lives here because the page is the only
      // signal-aware owner: it knows when a send completes AND owns
      // the refs to drive scroll imperatively. The shared
      // `WaMessageList` handles initial-scroll-to-bottom and
      // auto-scroll-on-new — this path is specifically the
      // send→smooth-scroll animation.
      requestAnimationFrame(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      });
    },
  });

  // Conversation window for the selected phone (for header display)
  const { data: currentWindow } = useWaConversationWindow(normalizedSelectedPhone);

  // Unread count
  const { data: unreadCount } = useWaUnreadCount();

  // Infinite scroll: IntersectionObserver sentinel at top of message list
  const observerRef = useRef<IntersectionObserver | null>(null);
  const handleLoadOlderRef = useRef(handleLoadOlder);
  handleLoadOlderRef.current = handleLoadOlder;

  const loadOlderSentinelRef: RefCallback<HTMLDivElement> = useCallback((node) => {
    if (observerRef.current) {
      observerRef.current.disconnect();
      observerRef.current = null;
    }
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          handleLoadOlderRef.current();
        }
      },
      { rootMargin: '200px' }
    );
    observer.observe(node);
    observerRef.current = observer;
  }, []);

  // Clean up observer on unmount
  useEffect(() => {
    return () => {
      observerRef.current?.disconnect();
    };
  }, []);

  // Scroll-to-bottom on initial load + conversation switch is now
  // owned by the shared `WaMessageList` component (see
  // `_components/WaMessageList.tsx`). The explicit scroll-after-send
  // path stays here as `onMessageSent` further down — that's a
  // different signal (user-action-driven, smooth animation) and
  // belongs at the parent that knows when the send completes.

  // Handlers
  const handleRefresh = useCallback(() => {
    refetchConversations();
    if (normalizedSelectedPhone) {
      refetchMessages();
    }
  }, [refetchConversations, normalizedSelectedPhone, refetchMessages]);

  const handleOpenNewConversation = useCallback(() => {
    setShowNewConversation(true);
    setNewPhoneInput('');
  }, [setShowNewConversation, setNewPhoneInput]);

  const handleImageClick = useCallback((url: string) => {
    setPreviewImage(url);
  }, []);

  // Reaction handlers
  const sendReaction = useWaSendMessage();
  const toast = useToast();

  const handleReact = useCallback(
    (waMessageId: string, emoji: string) => {
      if (!normalizedSelectedPhone) return;
      sendReaction.mutate(
        {
          to: normalizedSelectedPhone,
          type: 'reaction',
          reactionEmoji: emoji,
          reactionMessageId: waMessageId,
        },
        {
          onError: (err) => {
            toast.error(err instanceof Error ? err.message : 'Failed to send reaction');
          },
        }
      );
    },
    [normalizedSelectedPhone, sendReaction, toast]
  );

  const handleRemoveReaction = useCallback(
    (waMessageId: string) => {
      if (!normalizedSelectedPhone) return;
      sendReaction.mutate(
        {
          to: normalizedSelectedPhone,
          type: 'reaction',
          reactionEmoji: '',
          reactionMessageId: waMessageId,
        },
        {
          onError: (err) => {
            toast.error(err instanceof Error ? err.message : 'Failed to remove reaction');
          },
        }
      );
    },
    [normalizedSelectedPhone, sendReaction, toast]
  );

  // Clear message search when conversation changes
  useEffect(() => {
    setShowMessageSearch(false);
  }, [selectedPhone, setShowMessageSearch]);

  // Escape key for preview
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && previewImage) setPreviewImage(null);
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [previewImage]);

  // Mobile: show messages panel when a conversation is selected
  const showMessagesPanelOnMobile = !!selectedPhone;

  return (
    <div className="absolute inset-0 overflow-hidden">
      {/* Incoming call modal + active call controls are now handled globally
          by WaCallFloatingPanel in phone/layout.tsx */}

      <div className="flex h-full">
        {/* Conversations List */}
        <WaConversationList
          conversationSearch={conversationSearch}
          setConversationSearch={setConversationSearch}
          conversations={conversations}
          isLoadingConversations={isLoadingConversations}
          isFetchingConversations={isFetchingConversations}
          selectionMode={conversationSelectionMode}
          selectedConversations={selectedConversations}
          isBulkDeleting={isBulkDeleting}
          handleSelectAll={handleSelectAllConversations}
          handleToggleSelectionMode={handleToggleConversationSelectionMode}
          handleToggleSelect={handleToggleConversationSelect}
          setShowBulkDeleteConfirm={setShowBulkConversationDeleteConfirm}
          selectedPhone={selectedPhone}
          setSelectedPhone={setSelectedPhone}
          handleRefresh={handleRefresh}
          handleOpenNewConversation={handleOpenNewConversation}
          windowMap={windowMap}
          unreadCount={unreadCount ?? 0}
          hasNextPage={hasNextPage}
          isFetchingNextPage={isFetchingNextPage}
          fetchNextPage={fetchNextPage}
          showMessagesPanelOnMobile={showMessagesPanelOnMobile}
        />

        {/* Messages View */}
        <WaMessageThread
          selectedPhone={selectedPhone}
          setSelectedPhone={setSelectedPhone}
          selectedConversation={selectedConversation}
          messages={messages}
          isLoadingMessages={isLoadingMessages}
          isFetchingMessages={isFetchingMessages}
          messagesContainerRef={messagesContainerRef}
          messagesEndRef={messagesEndRef}
          messageSearch={messageSearch}
          setMessageSearch={setMessageSearch}
          debouncedMessageSearch={debouncedMessageSearch}
          showMessageSearch={showMessageSearch}
          setShowMessageSearch={setShowMessageSearch}
          messageSelectionMode={messageSelectionMode}
          selectedMessagesCount={selectedMessagesCount}
          isMessageSelected={isMessageSelected}
          handleToggleMessageSelectionMode={handleToggleMessageSelectionMode}
          handleToggleMessageSelect={handleToggleMessageSelect}
          handleSelectAllMessages={handleSelectAllMessages}
          setShowBulkMessageDeleteConfirm={setShowBulkMessageDeleteConfirm}
          isBulkDeletingMessages={isBulkDeletingMessages}
          hasMore={hasMoreMessages}
          activeIsLoadingOlder={isLoadingOlder}
          loadOlderSentinelRef={loadOlderSentinelRef}
          currentWindow={currentWindow}
          hasActiveWindow={hasActiveWindow}
          onImageClick={handleImageClick}
          onReact={handleReact}
          onRemoveReaction={handleRemoveReaction}
          showMessagesPanelOnMobile={showMessagesPanelOnMobile}
          isDragging={isDragging}
          handleDragEnter={handleDragEnter}
          handleDragLeave={handleDragLeave}
          handleDragOver={handleDragOver}
          handleDrop={handleDrop}
          headerAction={
            normalizedSelectedPhone && waCall.state.status === 'idle' ? (
              <WaCallButton
                customerNumber={normalizedSelectedPhone}
                customerName={selectedConversation?.contactName ?? undefined}
                onRequestCall={() => {
                  setAutoCallTemplate(true);
                  setShowTemplatePicker(true);
                }}
                onInitiateCall={waCall.initiateCall}
                permissionEvent={waCall.permissionEvent}
                isCallActive={waCall.state.status !== 'idle'}
              />
            ) : undefined
          }
        >
          <WaMessageComposer
            hasActiveWindow={hasActiveWindow}
            newMessage={newMessage}
            setNewMessage={setNewMessage}
            handleSend={handleSend}
            isSending={isSending}
            showTemplatePicker={showTemplatePicker}
            setShowTemplatePicker={(show) => {
              setShowTemplatePicker(show);
              if (!show) setAutoCallTemplate(false);
            }}
            templatePickerAutoSelectCallPermission={autoCallTemplate}
            handleSendTemplate={handleSendTemplate}
            isSendingTemplate={isSendingTemplate}
            selectedFile={selectedFile}
            setSelectedFile={setSelectedFile}
            isUploading={isUploading}
            customerPhone={selectedPhone}
          />
        </WaMessageThread>
      </div>

      {/* Modals */}
      <ImagePreviewModal imageUrl={previewImage} onClose={() => setPreviewImage(null)} />

      <WaNewConversationModal
        isOpen={showNewConversation}
        phoneValue={newPhoneInput}
        onPhoneChange={setNewPhoneInput}
        onSubmit={handleStartNewConversation}
        onClose={() => setShowNewConversation(false)}
      />

      <DeleteConfirmationModal
        isOpen={showDeleteConfirmation}
        title="Delete Conversation"
        message={
          <>
            Are you sure you want to delete your WhatsApp conversation with{' '}
            <span className="font-medium text-[var(--foreground)]">
              {selectedConversation?.contactName ||
                (selectedPhone ? formatPhoneNumber(selectedPhone) : 'Unknown')}
            </span>
            ? This will permanently delete all messages in this conversation.
          </>
        }
        isDeleting={isDeleting}
        onConfirm={handleConfirmDelete}
        onClose={() => setShowDeleteConfirmation(false)}
      />

      <DeleteConfirmationModal
        isOpen={showBulkConversationDeleteConfirm}
        title="Delete Selected"
        message={
          <>
            Are you sure you want to delete{' '}
            <span className="font-medium text-[var(--foreground)]">
              {selectedConversations.size} conversation
              {selectedConversations.size !== 1 ? 's' : ''}
            </span>
            ? This action cannot be undone.
          </>
        }
        isDeleting={isBulkDeleting}
        onConfirm={handleConfirmBulkConversationDelete}
        onClose={() => setShowBulkConversationDeleteConfirm(false)}
      />

      <DeleteConfirmationModal
        isOpen={showBulkMessageDeleteConfirm}
        title="Delete Messages"
        message={
          <>
            Are you sure you want to delete{' '}
            <span className="font-medium text-[var(--foreground)]">
              {selectedMessagesCount} message
              {selectedMessagesCount !== 1 ? 's' : ''}
            </span>
            ? This action cannot be undone.
          </>
        }
        isDeleting={isBulkDeletingMessages}
        onConfirm={handleConfirmBulkMessageDelete}
        onClose={() => setShowBulkMessageDeleteConfirm(false)}
      />
    </div>
  );
}

// ============================================================
// Main Page — State Router
// ============================================================

export default function WhatsAppPage() {
  const { data: status, isLoading, isPending } = useWaStatus();

  // Show spinner while loading OR when data hasn't arrived yet (prevents flash of wrong state)
  if (isLoading || isPending || !status) {
    return (
      <div className="h-[calc(100dvh-8rem)] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500" />
      </div>
    );
  }

  if (!status.waEnabled) return <WaDisabledState />;
  if (!status.configured) return <WaSetupState />;

  return (
    <PageTransition>
      <WaMessagingState />
    </PageTransition>
  );
}
