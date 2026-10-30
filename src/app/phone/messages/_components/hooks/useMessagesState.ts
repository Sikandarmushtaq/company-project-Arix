'use client';

import { useReducer, useMemo, useEffect, useLayoutEffect, useCallback, useRef } from 'react';
import { useMessagesPaginated, useMarkMessagesAsRead, useDeleteMessages } from '@/lib/hooks';
import { smsService } from '@/lib/api';
import { useToast } from '@/lib/stores/toast';
import { MESSAGES_PER_PAGE, Message } from '../types';

// ============================================================================
// Types
// ============================================================================

interface UseMessagesStateOptions {
  /** Normalized phone number of selected conversation */
  normalizedSelectedPhone: string | null;
  /** Effective phone (selected or first conversation) */
  effectivePhone: string | null;
  /** Selected conversation with unread count */
  selectedConversation: { unreadCount?: number } | null;
}

export interface UseMessagesStateReturn {
  /** Sorted messages (oldest first) */
  messages: Message[];
  /** All messages including older pages */
  allMessages: Message[];
  /** Whether initial messages are loading */
  isLoadingMessages: boolean;
  /** Whether messages are being fetched (including background) */
  isFetchingMessages: boolean;
  /** Refetch messages */
  refetchMessages: () => void;
  /** Messages metadata */
  messagesData: { total: number; totalPages: number } | undefined;
  /** Whether there are more messages to load */
  hasMoreMessages: boolean;
  /** Whether older messages are loading */
  isLoadingOlder: boolean;
  /** Load older messages handler */
  handleLoadOlder: () => void;
  /** Current search query */
  messageSearch: string;
  /** Set search query */
  setMessageSearch: (value: string) => void;
  /** Debounced search query */
  debouncedMessageSearch: string;
  /** Whether search is visible */
  showMessageSearch: boolean;
  /** Toggle search visibility */
  setShowMessageSearch: (show: boolean) => void;
  /** Whether selection mode is active */
  messageSelectionMode: boolean;
  /** Number of selected messages */
  selectedMessagesCount: number;
  /** Check if a message is selected */
  isMessageSelected: (id: number) => boolean;
  /** Toggle selection mode */
  handleToggleMessageSelectionMode: () => void;
  /** Toggle message selection */
  handleToggleMessageSelect: (id: number) => void;
  /** Select/deselect all messages */
  handleSelectAllMessages: () => void;
  /** Whether delete confirmation is shown */
  showBulkMessageDeleteConfirm: boolean;
  /** Set delete confirmation visibility */
  setShowBulkMessageDeleteConfirm: (show: boolean) => void;
  /** Confirm bulk delete */
  handleConfirmBulkMessageDelete: () => Promise<void>;
  /** Whether bulk delete is in progress */
  isBulkDeleting: boolean;
  /** Messages container ref */
  messagesContainerRef: React.RefObject<HTMLDivElement | null>;
  /** Messages end ref for scrolling */
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
  /** Scroll to a specific message in a conversation (loads older pages if needed, highlights) */
  scrollToMessage: (messageId: number, phone: string) => void;
  /** Currently highlighted message ID */
  highlightedMessageId: number | null;
  /** Scroll to bottom */
  scrollToBottom: () => void;
}

// ============================================================================
// Reducer
// ============================================================================

interface MessagesState {
  messagesPage: number;
  olderMessages: Message[];
  isLoadingOlder: boolean;
  messageSearch: string;
  debouncedMessageSearch: string;
  showMessageSearch: boolean;
  messageSelectionMode: boolean;
  selectedMessageIds: Set<number>;
  showBulkMessageDeleteConfirm: boolean;
  scrollToMessageId: number | null;
  scrollToPhoneSnapshot: string | null;
  highlightedMessageId: number | null;
  scrollPagesLoaded: number;
}

type MessagesAction =
  | { type: 'SET_PAGE'; page: number }
  | { type: 'ADD_OLDER_MESSAGES'; messages: Message[] }
  | { type: 'SET_LOADING_OLDER'; loading: boolean }
  | { type: 'SET_MESSAGE_SEARCH'; search: string }
  | { type: 'SET_DEBOUNCED_SEARCH'; search: string }
  | { type: 'SET_SHOW_SEARCH'; show: boolean }
  | { type: 'TOGGLE_SELECTION_MODE' }
  | { type: 'TOGGLE_MESSAGE_SELECT'; messageId: number }
  | { type: 'SELECT_ALL_MESSAGES'; messageIds: Set<number> }
  | { type: 'CLEAR_SELECTION' }
  | { type: 'SET_SHOW_DELETE_CONFIRM'; show: boolean }
  | { type: 'SCROLL_TO_MESSAGE'; messageId: number; phone: string }
  | { type: 'CLEAR_SCROLL_TARGET' }
  | { type: 'SET_HIGHLIGHTED'; messageId: number | null }
  | { type: 'RESET_FOR_NEW_CONVERSATION' };

/** Max pages the scroll-to-message effect will load before giving up */
const MAX_SCROLL_SEARCH_PAGES = 10;

const initialState: MessagesState = {
  messagesPage: 1,
  olderMessages: [],
  isLoadingOlder: false,
  messageSearch: '',
  debouncedMessageSearch: '',
  showMessageSearch: false,
  messageSelectionMode: false,
  selectedMessageIds: new Set<number>(),
  showBulkMessageDeleteConfirm: false,
  scrollToMessageId: null,
  scrollToPhoneSnapshot: null,
  highlightedMessageId: null,
  scrollPagesLoaded: 0,
};

function messagesReducer(state: MessagesState, action: MessagesAction): MessagesState {
  switch (action.type) {
    case 'SET_PAGE':
      return { ...state, messagesPage: action.page };
    case 'ADD_OLDER_MESSAGES': {
      const existingIds = new Set(state.olderMessages.map((m) => m.id));
      const newMessages = action.messages.filter((m) => !existingIds.has(m.id));
      if (newMessages.length === 0) return { ...state, isLoadingOlder: false };
      return {
        ...state,
        olderMessages: [...state.olderMessages, ...newMessages],
        isLoadingOlder: false,
        scrollPagesLoaded: state.scrollToMessageId
          ? state.scrollPagesLoaded + 1
          : state.scrollPagesLoaded,
      };
    }
    case 'SET_LOADING_OLDER':
      return { ...state, isLoadingOlder: action.loading };
    case 'SET_MESSAGE_SEARCH':
      return { ...state, messageSearch: action.search };
    case 'SET_DEBOUNCED_SEARCH':
      return {
        ...state,
        debouncedMessageSearch: action.search,
        messagesPage: 1,
        olderMessages: [],
      };
    case 'SET_SHOW_SEARCH':
      return { ...state, showMessageSearch: action.show };
    case 'TOGGLE_SELECTION_MODE':
      return {
        ...state,
        messageSelectionMode: !state.messageSelectionMode,
        selectedMessageIds: state.messageSelectionMode
          ? new Set<number>()
          : state.selectedMessageIds,
      };
    case 'TOGGLE_MESSAGE_SELECT': {
      const next = new Set(state.selectedMessageIds);
      if (next.has(action.messageId)) next.delete(action.messageId);
      else next.add(action.messageId);
      return { ...state, selectedMessageIds: next };
    }
    case 'SELECT_ALL_MESSAGES':
      return { ...state, selectedMessageIds: action.messageIds };
    case 'CLEAR_SELECTION':
      return { ...state, selectedMessageIds: new Set<number>(), messageSelectionMode: false };
    case 'SET_SHOW_DELETE_CONFIRM':
      return { ...state, showBulkMessageDeleteConfirm: action.show };
    case 'SCROLL_TO_MESSAGE':
      return {
        ...state,
        scrollToMessageId: action.messageId,
        scrollToPhoneSnapshot: action.phone,
        highlightedMessageId: action.messageId,
        scrollPagesLoaded: 0,
      };
    case 'CLEAR_SCROLL_TARGET':
      return {
        ...state,
        scrollToMessageId: null,
        scrollToPhoneSnapshot: null,
        scrollPagesLoaded: 0,
      };
    case 'SET_HIGHLIGHTED':
      return { ...state, highlightedMessageId: action.messageId };
    case 'RESET_FOR_NEW_CONVERSATION':
      return {
        ...state,
        messagesPage: 1,
        olderMessages: [],
        messageSearch: '',
        debouncedMessageSearch: '',
        showMessageSearch: false,
        messageSelectionMode: false,
        selectedMessageIds: new Set<number>(),
      };
    default:
      return state;
  }
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Hook for managing message list state.
 * Handles loading, pagination, search, selection, and deletion.
 *
 * Pagination strategy:
 * - React Query always fetches page 1 (keeps newest messages fresh for real-time updates)
 * - Older pages are fetched directly via smsService and accumulated in reducer state
 * - This prevents the query key change from losing page 1 data
 */
export function useMessagesState({
  normalizedSelectedPhone,
  effectivePhone,
  selectedConversation,
}: UseMessagesStateOptions): UseMessagesStateReturn {
  const toast = useToast();
  const [state, dispatch] = useReducer(messagesReducer, initialState);

  // Refs for scroll handling
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const scrollHeightBeforeLoad = useRef(0);
  const loadingOlderRef = useRef(false);

  // Mutations
  const markAsRead = useMarkMessagesAsRead();
  const deleteMessages = useDeleteMessages();

  // Query always fetches page 1 — older pages fetched directly in handleLoadOlder
  const {
    data: messagesData,
    isPending,
    isFetching: isFetchingMessages,
    refetch: refetchMessages,
  } = useMessagesPaginated(normalizedSelectedPhone, {
    page: 1,
    limit: MESSAGES_PER_PAGE,
    search: state.debouncedMessageSearch || undefined,
  });

  // Show loading when we have a phone selected but no data yet.
  // React Query's isLoading (isPending && isFetching) can briefly be false
  // when enabled transitions from false→true before the fetch starts.
  const isLoadingMessages = isPending && !!normalizedSelectedPhone;

  // Extract for stable reference
  const rawMessages = messagesData?.messages;

  // Reset during render when phone changes (immediate — before any effects or paint)
  // This ensures olderMessages is empty and page is 1 for the first render of the new conversation,
  // preventing flashes of stale data from the previously loaded conversation.
  const prevPhoneRef = useRef(normalizedSelectedPhone);
  if (normalizedSelectedPhone !== prevPhoneRef.current) {
    if (prevPhoneRef.current !== null) {
      dispatch({ type: 'RESET_FOR_NEW_CONVERSATION' });
      loadingOlderRef.current = false;
      scrollHeightBeforeLoad.current = 0;
    }
    prevPhoneRef.current = normalizedSelectedPhone;
  }

  // Debounce message search
  useEffect(() => {
    const timer = setTimeout(() => {
      dispatch({ type: 'SET_DEBOUNCED_SEARCH', search: state.messageSearch });
    }, 300);
    return () => clearTimeout(timer);
  }, [state.messageSearch]);

  // Combine page 1 (from query) + older pages (from state)
  const allMessages = useMemo(() => {
    const page1Messages = rawMessages || [];
    if (page1Messages.length === 0 && state.olderMessages.length === 0) return [];
    const page1Ids = new Set(page1Messages.map((m) => m.id));
    const uniqueOlder = state.olderMessages.filter((m) => !page1Ids.has(m.id));
    return [...page1Messages, ...uniqueOlder];
  }, [rawMessages, state.olderMessages]);

  // Sort messages (oldest first for display)
  const messages = useMemo(() => {
    if (!allMessages.length) return [];
    return [...allMessages].reverse();
  }, [allMessages]);

  // Check for more messages (totalPages from page 1 response is valid for all pages)
  const hasMoreMessages = messagesData ? state.messagesPage < messagesData.totalPages : false;

  // Load older handler — fetches directly, does NOT change the query key
  const handleLoadOlder = useCallback(async () => {
    if (!hasMoreMessages || loadingOlderRef.current || !normalizedSelectedPhone) return;
    loadingOlderRef.current = true;

    const phoneAtFetch = normalizedSelectedPhone;

    if (messagesContainerRef.current) {
      scrollHeightBeforeLoad.current = messagesContainerRef.current.scrollHeight;
    }
    dispatch({ type: 'SET_LOADING_OLDER', loading: true });

    const nextPage = state.messagesPage + 1;
    try {
      const data = await smsService.getMessagesPaginated(phoneAtFetch, {
        page: nextPage,
        limit: MESSAGES_PER_PAGE,
        search: state.debouncedMessageSearch || undefined,
      });
      // Guard: if conversation changed while fetching, discard stale results
      if (prevPhoneRef.current !== phoneAtFetch) return;
      dispatch({ type: 'SET_PAGE', page: nextPage });
      dispatch({ type: 'ADD_OLDER_MESSAGES', messages: data.messages });
    } catch {
      if (prevPhoneRef.current === phoneAtFetch) {
        dispatch({ type: 'SET_LOADING_OLDER', loading: false });
      }
    } finally {
      loadingOlderRef.current = false;
    }
  }, [hasMoreMessages, normalizedSelectedPhone, state.messagesPage, state.debouncedMessageSearch]);

  // Restore scroll position after loading older messages (useLayoutEffect = before paint)
  useLayoutEffect(() => {
    if (state.messagesPage > 1 && !state.isLoadingOlder && scrollHeightBeforeLoad.current > 0) {
      const container = messagesContainerRef.current;
      if (container) {
        const newScrollHeight = container.scrollHeight;
        const scrollDiff = newScrollHeight - scrollHeightBeforeLoad.current;
        container.scrollTop = scrollDiff;
        scrollHeightBeforeLoad.current = 0;
      }
    }
  }, [messages.length, state.messagesPage, state.isLoadingOlder]);

  // Scroll to bottom function - exposed to UI
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  // Stable ref so the scroll effect always calls the latest handleLoadOlder
  // without needing it in the dependency array (avoids missed re-triggers)
  const handleLoadOlderRef = useRef(handleLoadOlder);
  handleLoadOlderRef.current = handleLoadOlder;

  // Scroll to specific message from search — progressively loads older pages if needed
  useEffect(() => {
    if (!state.scrollToMessageId || !state.scrollToPhoneSnapshot) return;
    if (normalizedSelectedPhone !== state.scrollToPhoneSnapshot) return;
    if (isLoadingMessages || messages.length === 0) return;
    if (state.isLoadingOlder) return;

    const messageExists = messages.some((m) => m.id === state.scrollToMessageId);
    if (messageExists) {
      const msgId = state.scrollToMessageId;
      // Wait for next paint so the DOM element is rendered
      requestAnimationFrame(() => {
        const element = document.getElementById(`message-${msgId}`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        dispatch({ type: 'CLEAR_SCROLL_TARGET' });
      });
      return;
    }

    // Safety: stop after MAX_SCROLL_SEARCH_PAGES to avoid hammering the server
    if (state.scrollPagesLoaded >= MAX_SCROLL_SEARCH_PAGES || !hasMoreMessages) {
      dispatch({ type: 'CLEAR_SCROLL_TARGET' });
      dispatch({ type: 'SET_HIGHLIGHTED', messageId: null });
      return;
    }

    handleLoadOlderRef.current();
  }, [
    state.scrollToMessageId,
    state.scrollToPhoneSnapshot,
    state.scrollPagesLoaded,
    normalizedSelectedPhone,
    messages,
    hasMoreMessages,
    isLoadingMessages,
    state.isLoadingOlder,
  ]);

  // Clear highlight after delay
  useEffect(() => {
    if (!state.highlightedMessageId) return;
    const timer = setTimeout(() => dispatch({ type: 'SET_HIGHLIGHTED', messageId: null }), 3000);
    return () => clearTimeout(timer);
  }, [state.highlightedMessageId]);

  // Mark as read when viewing a conversation with unread messages.
  // Uses a ref to avoid re-firing while a mark-as-read is already in-flight
  // or for the same conversation that was just marked.
  const markedReadRef = useRef<string | null>(null);
  const unreadCount = selectedConversation?.unreadCount ?? 0;

  useEffect(() => {
    if (!effectivePhone || unreadCount === 0) return;
    // Skip if we already marked this conversation as read (optimistic update set it to 0,
    // but a new inbound message may have bumped it back — that's a legitimate re-mark)
    if (markedReadRef.current === effectivePhone && markAsRead.isPending) return;
    markedReadRef.current = effectivePhone;
    markAsRead.mutate(effectivePhone);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectivePhone, unreadCount]);

  // Callbacks
  const setMessageSearch = useCallback((search: string) => {
    dispatch({ type: 'SET_MESSAGE_SEARCH', search });
  }, []);

  const setShowMessageSearch = useCallback((show: boolean) => {
    dispatch({ type: 'SET_SHOW_SEARCH', show });
    if (!show) {
      dispatch({ type: 'SET_MESSAGE_SEARCH', search: '' });
      dispatch({ type: 'SET_DEBOUNCED_SEARCH', search: '' });
    }
  }, []);

  const handleToggleMessageSelectionMode = useCallback(() => {
    dispatch({ type: 'TOGGLE_SELECTION_MODE' });
  }, []);

  const handleToggleMessageSelect = useCallback((messageId: number) => {
    dispatch({ type: 'TOGGLE_MESSAGE_SELECT', messageId });
  }, []);

  const handleSelectAllMessages = useCallback(() => {
    const allSelected = state.selectedMessageIds.size === messages.length;
    dispatch({
      type: 'SELECT_ALL_MESSAGES',
      messageIds: allSelected ? new Set<number>() : new Set(messages.map((m) => m.id)),
    });
  }, [messages, state.selectedMessageIds.size]);

  const setShowBulkMessageDeleteConfirm = useCallback((show: boolean) => {
    dispatch({ type: 'SET_SHOW_DELETE_CONFIRM', show });
  }, []);

  const handleConfirmBulkMessageDelete = useCallback(async () => {
    if (state.selectedMessageIds.size === 0) return;
    try {
      const count = state.selectedMessageIds.size;
      await deleteMessages.mutateAsync([...state.selectedMessageIds]);
      dispatch({ type: 'SET_SHOW_DELETE_CONFIRM', show: false });
      dispatch({ type: 'CLEAR_SELECTION' });
      toast.success(`${count} message(s) deleted`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete messages');
    }
  }, [state.selectedMessageIds, deleteMessages, toast]);

  const isMessageSelected = useCallback(
    (id: number) => state.selectedMessageIds.has(id),
    [state.selectedMessageIds]
  );

  const scrollToMessage = useCallback((messageId: number, phone: string) => {
    dispatch({ type: 'SCROLL_TO_MESSAGE', messageId, phone });
  }, []);

  // Return plain object (not ref-like)
  return {
    messages,
    allMessages,
    isLoadingMessages,
    isFetchingMessages,
    refetchMessages,
    messagesData: messagesData
      ? { total: messagesData.total, totalPages: messagesData.totalPages }
      : undefined,
    hasMoreMessages,
    isLoadingOlder: state.isLoadingOlder,
    handleLoadOlder,
    messageSearch: state.messageSearch,
    setMessageSearch,
    debouncedMessageSearch: state.debouncedMessageSearch,
    showMessageSearch: state.showMessageSearch,
    setShowMessageSearch,
    messageSelectionMode: state.messageSelectionMode,
    selectedMessagesCount: state.selectedMessageIds.size,
    isMessageSelected,
    handleToggleMessageSelectionMode,
    handleToggleMessageSelect,
    handleSelectAllMessages,
    showBulkMessageDeleteConfirm: state.showBulkMessageDeleteConfirm,
    setShowBulkMessageDeleteConfirm,
    handleConfirmBulkMessageDelete,
    isBulkDeleting: deleteMessages.isPending,
    messagesContainerRef,
    messagesEndRef,
    scrollToMessage,
    highlightedMessageId: state.highlightedMessageId,
    scrollToBottom,
  };
}
