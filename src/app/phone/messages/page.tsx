'use client';

import React, {
  useState,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useMemo,
  type RefCallback,
} from 'react';
import { FiUsers } from 'react-icons/fi';
import { formatPhoneNumber } from '@/lib/utils/formatting';
import { normalizePhone } from '@/lib/utils/phone';
import { useSendGroupMessage, useGroup, useMarkConversationUnread } from '@/lib/hooks';
import { mediaService } from '@/lib/api';
import { useToast } from '@/lib/stores/toast';
import { useAuthStore } from '@/lib/stores/auth';
import { useSipStore } from '@/lib/stores/sip';
import { useContactLookupStore } from '@/lib/stores/contactLookup';
import { isOwnNumber, toE164 } from '@/lib/utils/phone';
import { DEFAULT_PHONE_REGION } from '@/lib/utils/phone-format';
import { AddContactFlow } from '@/components/phone/chrome/CallsPanel';

// Import extracted components and hooks
import {
  useUnifiedConversationState,
  useMessagesState,
  useGroupMessagesState,
  useSendMessageState,
  MessageInput,
  NewConversationModal,
  DeleteConfirmationModal,
  ImagePreviewModal,
  CreateGroupModal,
  GroupInfoPanel,
} from './_components';

// Import split sub-components
import { PageTransition } from '@/components/phone';
import { SmsRegistrationBanner } from '@/components/phone/SmsRegistrationBanner';
import { SmsBlockedBanner } from '@/components/phone/TrialLimitBanner';
import { ConversationList } from './ConversationList';
import { MessageThread } from './MessageThread';
import { MessageComposer } from './MessageComposer';
import { ConversationDetails, type DetailsMember } from './_components/ConversationDetails';

// ============================================================================
// Main Component
// ============================================================================

export default function MessagesPage() {
  // ── Isolated phone selector (does NOT change global active phone) ──
  // Same pattern as bulk-sms page: local state for "send from" number.
  const user = useAuthStore((s) => s.user);
  const makeCall = useSipStore((s) => s.makeCall);
  const phoneNumbers = user?.phoneNumbers || [];
  const [sendFromPhone, setSendFromPhone] = useState('');
  const [addContactNumber, setAddContactNumber] = useState<string | null>(null);
  const sendFromPhoneRef = useRef('');

  // Initialize to user's active phone (once, or when global phone changes)
  useEffect(() => {
    if (sendFromPhone || !user?.senderPhone) return;
    const senderDigits = user.senderPhone.replace(/\D/g, '');
    const match = phoneNumbers.find((p) => p.phoneNumber.replace(/\D/g, '') === senderDigits);
    const initial = match?.phoneNumber || user.senderPhone;
    setSendFromPhone(initial);
    sendFromPhoneRef.current = initial;
  }, [user?.senderPhone, phoneNumbers.length]); // eslint-disable-line react-hooks/exhaustive-deps -- init once

  // Keep ref in sync for mutation closures
  useEffect(() => {
    sendFromPhoneRef.current = sendFromPhone;
  }, [sendFromPhone]);

  // Image preview state (local to this component)
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  // Conversation Details right column (RingCentral) — direct conversations only.
  const [showDetails, setShowDetails] = useState(true);
  const newPhoneInputRef = useRef<HTMLInputElement>(null);

  // Unified conversation state (supports both direct and group)
  const {
    conversationSearch,
    setConversationSearch,
    debouncedSearch,
    conversations,
    isLoadingConversations,
    isFetchingConversations,
    refetchConversations,
    selectedConversation,
    setSelectedConversation,
    selectedUnifiedConversation,
    effectivePhone,
    normalizedSelectedPhone,
    selectedGroupId,
    selectionMode,
    selectedIds,
    handleToggleSelectionMode,
    handleToggleSelect,
    handleSelectAll,
    showDeleteConfirmation,
    setShowDeleteConfirmation,
    showBulkDeleteConfirm,
    setShowBulkDeleteConfirm,
    handleConfirmDelete,
    handleConfirmBulkDelete,
    isDeleting,
    isBulkDeleting,
    showNewConversation,
    setShowNewConversation,
    showCreateGroup,
    setShowCreateGroup,
    newPhoneInput,
    setNewPhoneInput,
    handleStartNewConversation,
    showGroupInfo,
    setShowGroupInfo,
    groupedMessageResults,
    isLoadingMessageSearch,
    isFetchingMessageSearch,
    groupMemberships,
    isSelectedConversationInGroup,
    selectedConversationGroupInfo,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = useUnifiedConversationState();

  // Direct message state (for direct conversations)
  const {
    messages: directMessages,
    messagesData,
    isLoadingMessages: isLoadingDirectMessages,
    isFetchingMessages: isFetchingDirectMessages,
    refetchMessages: refetchDirectMessages,
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
    scrollToMessage,
    highlightedMessageId,
    messagesContainerRef,
    messagesEndRef,
    scrollToBottom,
  } = useMessagesState({
    normalizedSelectedPhone,
    effectivePhone,
    selectedConversation: selectedUnifiedConversation
      ? { unreadCount: selectedUnifiedConversation.unreadCount }
      : null,
  });

  // Determine which messages to show
  const isGroupSelected = selectedConversation?.type === 'group';

  // Group messages state (mirrors useMessagesState pattern)
  const groupState = useGroupMessagesState({
    selectedGroupId,
    unreadCount: selectedUnifiedConversation?.unreadCount ?? 0,
  });

  const sendGroupMessage = useSendGroupMessage();

  // Fetch group detail with members (for sender name labels in group chat)
  const { data: groupDetail } = useGroup(selectedGroupId);
  // Contact lookup store — SSOT for phone → name resolution
  const contactsMap = useContactLookupStore((state) => state.contacts);
  // Build name map: contact store (SSOT) > group member name > formatted phone
  const groupMemberNames = useMemo(() => {
    const map: Record<string, string> = {};
    if (groupDetail?.members) {
      for (const m of groupDetail.members) {
        const phone = normalizePhone(m.phoneNumber);
        const contact = contactsMap.get(phone);
        map[phone] = contact?.name || m.name || formatPhoneNumber(phone);
      }
    }
    return map;
  }, [groupDetail?.members, contactsMap]);

  // Unified messages / loading for the active conversation
  const messages = isGroupSelected ? groupState.messages : directMessages;
  const isLoadingMessages = isGroupSelected
    ? groupState.isLoadingMessages
    : isLoadingDirectMessages;
  const isFetchingMessages = isGroupSelected
    ? groupState.isFetchingMessages
    : isFetchingDirectMessages;

  // Send message state (for direct messages)
  const {
    newMessage,
    setNewMessage,
    selectedFiles,
    setSelectedFiles,
    isSending: isSendingDirect,
    isUploading,
    isDragging,
    handleSend: handleSendDirect,
    handleDragEnter,
    handleDragLeave,
    handleDragOver,
    handleDrop,
  } = useSendMessageState({
    effectivePhone: isGroupSelected ? null : effectivePhone,
    sendFromPhone: sendFromPhoneRef.current || undefined,
    onMessageSent: () => {
      requestAnimationFrame(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      });
    },
  });

  // Group message sending state
  const [groupMessageText, setGroupMessageText] = useState('');
  const [groupSelectedFiles, setGroupSelectedFiles] = useState<
    Array<{ file: File; preview: string }>
  >([]);
  const [isGroupUploading, setIsGroupUploading] = useState(false);
  const isSendingGroup = sendGroupMessage.isPending;

  // Handle group message send (with media support)
  const toast = useToast();
  const handleSendGroupMessage = useCallback(async () => {
    const hasText = groupMessageText.trim().length > 0;
    const hasFiles = groupSelectedFiles.length > 0;

    if ((!hasText && !hasFiles) || !selectedGroupId || isSendingGroup || isGroupUploading) {
      return;
    }

    try {
      let mediaUrls: string[] = [];

      // Upload files if any
      if (hasFiles) {
        setIsGroupUploading(true);
        try {
          const files = groupSelectedFiles.map((f) => f.file);
          const uploadResult = await mediaService.upload(files);
          mediaUrls = uploadResult.urls;
        } catch (uploadErr) {
          toast.error(uploadErr instanceof Error ? uploadErr.message : 'Failed to upload images');
          setIsGroupUploading(false);
          return;
        }
        setIsGroupUploading(false);
      }

      // Clear input immediately for responsive feel
      const messageText = groupMessageText.trim();
      const filesToClean = [...groupSelectedFiles];
      setGroupMessageText('');
      setGroupSelectedFiles([]);

      // Send group message (fire-and-forget style)
      sendGroupMessage.mutate(
        {
          groupId: selectedGroupId,
          data: {
            body: messageText,
            mediaUrls: mediaUrls.length > 0 ? mediaUrls : undefined,
            from: sendFromPhoneRef.current || undefined,
          },
        },
        {
          onError: () => {
            // Restore input and files on failure
            setGroupMessageText(messageText);
            setGroupSelectedFiles(filesToClean);
          },
          onSuccess: async () => {
            filesToClean.forEach((f) => URL.revokeObjectURL(f.preview));
            // Wait for refetch so new message is rendered before scrolling
            await groupState.refetchMessages();
            requestAnimationFrame(() => {
              groupState.endRef.current?.scrollIntoView({ behavior: 'smooth' });
            });
          },
        }
      );
    } catch {
      // Error handled by mutation
    }
  }, [
    selectedGroupId,
    groupMessageText,
    groupSelectedFiles,
    sendGroupMessage,
    messagesEndRef,
    isSendingGroup,
    isGroupUploading,
    toast,
  ]);

  // Infinite scroll: IntersectionObserver sentinel at top of message list
  const observerRef = useRef<IntersectionObserver | null>(null);
  const hasMore = isGroupSelected ? groupState.hasMoreMessages : hasMoreMessages;
  const activeIsLoadingOlder = isGroupSelected ? groupState.isLoadingOlder : isLoadingOlder;
  const activeHandleLoadOlder = isGroupSelected ? groupState.handleLoadOlder : handleLoadOlder;

  // Stable ref so the observer callback always reads the latest handleLoadOlder
  const handleLoadOlderRef = useRef(activeHandleLoadOlder);
  handleLoadOlderRef.current = activeHandleLoadOlder;

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

  // Conversation key — changes trigger scroll-to-bottom reset
  const conversationKey =
    normalizedSelectedPhone || (selectedGroupId ? `group-${selectedGroupId}` : null);

  // Scroll to bottom on initial load or conversation switch.
  const activeEndRef = isGroupSelected ? groupState.endRef : messagesEndRef;
  const prevMessageCountRef = useRef(0);
  const prevConversationKeyRef = useRef<string | null>(null);

  useLayoutEffect(() => {
    // Reset on conversation change
    if (conversationKey !== prevConversationKeyRef.current) {
      prevConversationKeyRef.current = conversationKey;
      prevMessageCountRef.current = 0;
    }

    if (isLoadingMessages || messages.length === 0) return;

    // Scroll to bottom on initial load (0 → N) for this conversation
    if (prevMessageCountRef.current === 0) {
      activeEndRef.current?.scrollIntoView({ behavior: 'auto' });
    }
    prevMessageCountRef.current = messages.length;
  }, [isLoadingMessages, messages.length, activeEndRef, conversationKey]);

  // Handlers
  const handleRefresh = useCallback(() => {
    refetchConversations();
    if (isGroupSelected && selectedGroupId) {
      groupState.refetchMessages();
    } else if (effectivePhone) {
      refetchDirectMessages();
    }
  }, [
    refetchConversations,
    isGroupSelected,
    selectedGroupId,
    groupState.refetchMessages,
    effectivePhone,
    refetchDirectMessages,
  ]);

  const handleMessageSearchResultClick = useCallback(
    (phoneNumber: string, messageId: number) => {
      const normalized = normalizePhone(phoneNumber);
      setSelectedConversation({
        type: 'direct',
        id: normalized,
        phoneNumber: normalized,
      });
      setConversationSearch('');
      scrollToMessage(messageId, normalized);
    },
    [setSelectedConversation, setConversationSearch, scrollToMessage]
  );

  const handleImageClick = useCallback((url: string) => {
    setPreviewImage(url);
  }, []);

  const handleOpenNewConversation = useCallback(() => {
    setShowNewConversation(true);
    setNewPhoneInput('');
    requestAnimationFrame(() => newPhoneInputRef.current?.focus());
  }, [setShowNewConversation, setNewPhoneInput]);

  const handleOpenDeleteConfirmation = useCallback(() => {
    if (!selectedConversation) return;
    setShowDeleteConfirmation(true);
  }, [selectedConversation, setShowDeleteConfirmation]);

  const handleGroupCreated = useCallback(
    (groupId: number) => {
      setSelectedConversation({
        type: 'group',
        id: `group-${groupId}`,
        groupId,
      });
      refetchConversations();
    },
    [setSelectedConversation, refetchConversations]
  );

  // Thread-header actions (RingCentral). Call places a global SIP call (shows in
  // the top-bar active-call widget); add-contact reuses the shared flow.
  const handleHeaderCall = useCallback(
    async (num: string) => {
      if (isOwnNumber(num, user?.senderPhone, user?.phoneNumbers)) {
        toast.error('You cannot call your own number');
        return;
      }
      try {
        await makeCall(toE164(num, DEFAULT_PHONE_REGION) || num);
        toast.info('Calling…');
      } catch {
        toast.error('Failed to make call');
      }
    },
    [makeCall, user?.senderPhone, user?.phoneNumbers, toast]
  );

  // Mark the open direct conversation as unread (opened by mistake) and return
  // to the list so it re-surfaces as unread (and under the Unread filter).
  const markUnreadMutation = useMarkConversationUnread();
  const handleMarkUnread = useCallback(() => {
    if (!effectivePhone) return;
    markUnreadMutation.mutate(effectivePhone);
    setSelectedConversation(null);
  }, [effectivePhone, markUnreadMutation, setSelectedConversation]);

  // Clear message selection when conversation changes
  useEffect(() => {
    setShowMessageSearch(false);
  }, [selectedConversation, setShowMessageSearch]);

  // Escape key for preview
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && previewImage) setPreviewImage(null);
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [previewImage]);

  // Mobile: show messages panel when a conversation is selected
  const showMessagesPanelOnMobile = !!selectedConversation;

  // Conversation Details column — direct conversations only (groups keep GroupInfoPanel).
  const detailsShown = !!selectedConversation && !isGroupSelected && showDetails;
  const directMembers: DetailsMember[] = detailsShown
    ? [
        { number: user?.senderPhone || '', contactName: user?.fullName, isMe: true },
        { number: effectivePhone || '', contactName: selectedUnifiedConversation?.contactName },
      ]
    : [];

  // ── Robot state for layout robot ──
  const messageText = isGroupSelected ? groupMessageText : newMessage;
  const isSending = isGroupSelected ? isSendingGroup : isSendingDirect;
  const prevMessageCount = useRef(messages.length);
  const idleTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [idleSeconds, setIdleSeconds] = useState(0);

  // Detect last emoji in message text
  const lastEmoji = useMemo(() => {
    const emojiRegex = /(\p{Emoji_Presentation}|\p{Extended_Pictographic})/gu;
    const matches = messageText.match(emojiRegex);
    return matches ? matches[matches.length - 1] : null;
  }, [messageText]);

  // Detect new incoming message
  const [newMsgFlash, setNewMsgFlash] = useState(false);
  useEffect(() => {
    if (messages.length > prevMessageCount.current && prevMessageCount.current > 0) {
      // New message appeared
      setNewMsgFlash(true);
      setTimeout(() => setNewMsgFlash(false), 1500);
    }
    prevMessageCount.current = messages.length;
  }, [messages.length]);

  // Idle timer — resets on clicks, typing, scrolling, and significant mouse movement
  const lastMousePos = useRef({ x: 0, y: 0 });
  useEffect(() => {
    setIdleSeconds(0);
    if (idleTimerRef.current) clearInterval(idleTimerRef.current);
    idleTimerRef.current = setInterval(() => setIdleSeconds((s) => s + 1), 1000);

    const resetIdle = () => setIdleSeconds(0);
    const handleMouseMove = (e: MouseEvent) => {
      const dx = e.clientX - lastMousePos.current.x;
      const dy = e.clientY - lastMousePos.current.y;
      if (Math.abs(dx) > 30 || Math.abs(dy) > 30) {
        setIdleSeconds(0);
        lastMousePos.current = { x: e.clientX, y: e.clientY };
      }
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('keydown', resetIdle);
    window.addEventListener('click', resetIdle);
    window.addEventListener('scroll', resetIdle, true);
    return () => {
      if (idleTimerRef.current) clearInterval(idleTimerRef.current);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('keydown', resetIdle);
      window.removeEventListener('click', resetIdle);
      window.removeEventListener('scroll', resetIdle, true);
    };
  }, [selectedConversation]);

  // Detect send success/failure
  const [justSent, setJustSent] = useState(false);
  const [justFailed, setJustFailed] = useState(false);
  const prevSending = useRef(false);
  useEffect(() => {
    if (prevSending.current && !isSending) {
      // Send finished — check if text was cleared (success) or not (failure restored text)
      if (messageText.length === 0) {
        setJustSent(true);
        setTimeout(() => setJustSent(false), 2000);
      }
    }
    prevSending.current = isSending;
  }, [isSending, messageText.length]);

  // Check for unread
  const hasUnread =
    Array.isArray(conversations) && conversations.some((c) => c.unreadCount > 0);

  // Expose to global robot
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).__messagesRobotState = {
      isTyping: messageText.length > 0,
      justSent,
      justFailed,
      newMessageReceived: newMsgFlash,
      idleSeconds,
      lastEmoji,
      isGroupChat: isGroupSelected,
      hasUnread,
      isSending,
      longMessage: messages.length > 0 && (messages[messages.length - 1]?.body?.length ?? 0) > 200,
    };
    return () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (globalThis as any).__messagesRobotState = null;
    };
  });

  return (
    <PageTransition className="absolute inset-0 overflow-hidden">
      <div className="flex h-full flex-col">
        {/* 10DLC registration nudge — owners without an approved SMS registration.
            US carriers block SMS until the business is registered. */}
        <SmsRegistrationBanner />
        {/* Monthly SMS limit reached → prominent block banner (upgrade / contact admin). */}
        <SmsBlockedBanner className="mx-3 mt-2" />
        <div className="flex min-h-0 flex-1">
          {/* Conversations List */}
          <ConversationList
            conversationSearch={conversationSearch}
            setConversationSearch={setConversationSearch}
            debouncedSearch={debouncedSearch}
            conversations={conversations}
            isLoadingConversations={isLoadingConversations}
            isFetchingConversations={isFetchingConversations}
            isFetchingMessageSearch={isFetchingMessageSearch}
            hasNextPage={hasNextPage}
            isFetchingNextPage={isFetchingNextPage}
            fetchNextPage={fetchNextPage}
            selectionMode={selectionMode}
            selectedIds={selectedIds}
            isBulkDeleting={isBulkDeleting}
            handleSelectAll={handleSelectAll}
            handleToggleSelectionMode={handleToggleSelectionMode}
            handleToggleSelect={handleToggleSelect}
            setShowBulkDeleteConfirm={setShowBulkDeleteConfirm}
            selectedConversation={selectedConversation}
            setSelectedConversation={setSelectedConversation}
            handleRefresh={handleRefresh}
            handleOpenNewConversation={handleOpenNewConversation}
            setShowCreateGroup={setShowCreateGroup}
            groupedMessageResults={groupedMessageResults}
            isLoadingMessageSearch={isLoadingMessageSearch}
            handleMessageSearchResultClick={handleMessageSearchResultClick}
            groupMemberships={groupMemberships}
            showMessagesPanelOnMobile={showMessagesPanelOnMobile}
          />

          {/* Messages View */}
          <MessageThread
            selectedConversation={selectedConversation}
            setSelectedConversation={setSelectedConversation}
            selectedUnifiedConversation={selectedUnifiedConversation}
            messages={messages}
            isLoadingMessages={isLoadingMessages}
            isFetchingMessages={isFetchingMessages}
            isGroupSelected={isGroupSelected ?? false}
            selectedGroupId={selectedGroupId}
            groupState={groupState}
            groupMemberNames={groupMemberNames}
            messagesContainerRef={messagesContainerRef}
            messagesEndRef={messagesEndRef}
            activeEndRef={activeEndRef}
            messageSearch={messageSearch}
            setMessageSearch={setMessageSearch}
            debouncedMessageSearch={debouncedMessageSearch}
            showMessageSearch={showMessageSearch}
            setShowMessageSearch={setShowMessageSearch}
            messagesData={messagesData ? { total: messagesData.total } : null}
            messageSelectionMode={messageSelectionMode}
            selectedMessagesCount={selectedMessagesCount}
            isMessageSelected={isMessageSelected}
            handleToggleMessageSelectionMode={handleToggleMessageSelectionMode}
            handleToggleMessageSelect={handleToggleMessageSelect}
            handleSelectAllMessages={handleSelectAllMessages}
            setShowBulkMessageDeleteConfirm={setShowBulkMessageDeleteConfirm}
            isBulkDeletingMessages={isBulkDeletingMessages}
            highlightedMessageId={highlightedMessageId}
            hasMore={hasMore}
            activeIsLoadingOlder={activeIsLoadingOlder}
            loadOlderSentinelRef={loadOlderSentinelRef}
            effectivePhone={effectivePhone}
            normalizedSelectedPhone={normalizedSelectedPhone}
            isDragging={isDragging}
            handleDragEnter={handleDragEnter}
            handleDragLeave={handleDragLeave}
            handleDragOver={handleDragOver}
            handleDrop={handleDrop}
            handleImageClick={handleImageClick}
            setShowGroupInfo={setShowGroupInfo}
            onCall={handleHeaderCall}
            onAddContact={setAddContactNumber}
            onDeleteConversation={handleOpenDeleteConfirmation}
            onMarkUnread={handleMarkUnread}
            onToggleDetails={
              isGroupSelected ? undefined : () => setShowDetails((v) => !v)
            }
            detailsOpen={detailsShown}
            mainColSpanClass="flex-1 min-w-0"
            showMessagesPanelOnMobile={showMessagesPanelOnMobile}
          >
            {/* MessageComposer as children of MessageThread */}
            <MessageComposer
              isGroupSelected={isGroupSelected ?? false}
              groupMessageText={groupMessageText}
              setGroupMessageText={setGroupMessageText}
              handleSendGroupMessage={handleSendGroupMessage}
              groupSelectedFiles={groupSelectedFiles}
              setGroupSelectedFiles={setGroupSelectedFiles}
              isSendingGroup={isSendingGroup}
              isGroupUploading={isGroupUploading}
              groupMemberCount={Math.max(0, (selectedUnifiedConversation?.memberCount || 0) - 1)}
              newMessage={newMessage}
              setNewMessage={setNewMessage}
              handleSendDirect={handleSendDirect}
              selectedFiles={selectedFiles}
              setSelectedFiles={setSelectedFiles}
              isSendingDirect={isSendingDirect}
              isUploading={isUploading}
              sendFromPhone={sendFromPhone}
              onSendFromChange={setSendFromPhone}
              phoneNumbers={phoneNumbers}
            />
          </MessageThread>

          {/* Conversation Details (right column) */}
          {detailsShown && (
            <ConversationDetails
              members={directMembers}
              onClose={() => setShowDetails(false)}
              campaignId={selectedUnifiedConversation?.attributedCampaignId}
              campaignName={selectedUnifiedConversation?.attributedCampaignName}
              campaignIsOrigin={selectedUnifiedConversation?.campaignIsOrigin}
            />
          )}
          </div>
        </div>

        {/* Modals */}
        {addContactNumber && (
          <AddContactFlow number={addContactNumber} onClose={() => setAddContactNumber(null)} />
        )}

        <ImagePreviewModal imageUrl={previewImage} onClose={() => setPreviewImage(null)} />

        <NewConversationModal
          isOpen={showNewConversation}
          phoneValue={newPhoneInput}
          onPhoneChange={setNewPhoneInput}
          onSubmit={handleStartNewConversation}
          onClose={() => setShowNewConversation(false)}
          inputRef={newPhoneInputRef}
          fromPhone={sendFromPhone}
        />

        <CreateGroupModal
          isOpen={showCreateGroup}
          onClose={() => setShowCreateGroup(false)}
          onGroupCreated={handleGroupCreated}
        />

        {selectedGroupId && (
          <GroupInfoPanel
            groupId={selectedGroupId}
            isOpen={showGroupInfo}
            onClose={() => setShowGroupInfo(false)}
            onDeleted={() => {
              setSelectedConversation(null);
              refetchConversations();
            }}
          />
        )}

        <DeleteConfirmationModal
          isOpen={showDeleteConfirmation}
          title={isGroupSelected ? 'Delete Group' : 'Delete Conversation'}
          message={
            isGroupSelected ? (
              <>
                Are you sure you want to delete the group{' '}
                <span className="font-medium text-[var(--foreground)]">
                  {selectedUnifiedConversation?.displayName || 'this group'}
                </span>
                ? This will remove the group for all members.
              </>
            ) : (
              <>
                Are you sure you want to delete your conversation with{' '}
                <span className="font-medium text-[var(--foreground)]">
                  {selectedUnifiedConversation?.contactName ||
                    (effectivePhone ? formatPhoneNumber(effectivePhone) : 'Unknown')}
                </span>
                ? This will permanently delete all messages in this conversation.
              </>
            )
          }
          isDeleting={isDeleting}
          onConfirm={handleConfirmDelete}
          onClose={() => setShowDeleteConfirmation(false)}
        />

        <DeleteConfirmationModal
          isOpen={showBulkDeleteConfirm}
          title="Delete Selected"
          message={
            <>
              Are you sure you want to delete{' '}
              <span className="font-medium text-[var(--foreground)]">
                {selectedIds.size} item{selectedIds.size !== 1 ? 's' : ''}
              </span>
              ? This action cannot be undone.
            </>
          }
          isDeleting={isBulkDeleting}
          onConfirm={handleConfirmBulkDelete}
          onClose={() => setShowBulkDeleteConfirm(false)}
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

        <DeleteConfirmationModal
          isOpen={groupState.showBulkDeleteConfirm}
          title="Delete Messages"
          message={
            <>
              Are you sure you want to delete{' '}
              <span className="font-medium text-[var(--foreground)]">
                {groupState.selectedMessageIds.size} message
                {groupState.selectedMessageIds.size !== 1 ? 's' : ''}
              </span>
              ? This action cannot be undone.
            </>
          }
          isDeleting={groupState.isBulkDeleting}
          onConfirm={groupState.handleConfirmBulkDelete}
          onClose={() => groupState.setShowBulkDeleteConfirm(false)}
        />
    </PageTransition>
  );
}
