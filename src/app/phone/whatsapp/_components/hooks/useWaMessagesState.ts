'use client';

import { useReducer, useMemo, useEffect, useCallback, useRef } from 'react';
import { useWaMessagesInfinite, useWaMarkAsRead, useWaDeleteMessages } from '@/lib/hooks';
import { useDocumentVisible } from '@/lib/hooks/useDocumentVisible';
import { useToast } from '@/lib/stores/toast';
import { useWaActiveChatStore } from '@/lib/stores/waActiveChat';
import type { WaMessage } from '@/lib/api/services/whatsapp-types';
import type { SelectionSource } from './useWaConversationState';

// ============================================================================
// NOTE: scroll-related refs (messagesContainerRef / messagesEndRef) used
// to live in this hook even though nothing here read them — they were
// surfaced purely so the parent could drive imperative scroll-after-send.
// They've been moved into `phone/whatsapp/page.tsx`, which is the actual
// owner of the post-send scroll signal. This hook now contains only data
// fetching + UI-state reducer for the agent's WA thread view.
// ============================================================================

// ============================================================================
// Types
// ============================================================================

interface UseWaMessagesStateOptions {
  /** Normalized phone number of selected conversation */
  normalizedSelectedPhone: string | null;
  /** Selected conversation with unread count */
  selectedConversation: { unreadCount?: number } | null;
  /**
   * How the current selection happened. Gates the auto-mark-read effect:
   * we only mark on `click` / `new` (explicit user engagement), NOT on
   * `url` (refresh-with-chat-open). The latter used to phantom-decrement
   * the bell when users hadn't actually re-read the chat.
   */
  selectionSource: SelectionSource;
}

export interface UseWaMessagesStateReturn {
  /** Messages in display order (oldest first, newest last) */
  messages: WaMessage[];
  /** Whether initial messages are loading */
  isLoadingMessages: boolean;
  /** Whether messages are being fetched (including background) */
  isFetchingMessages: boolean;
  /** Refetch messages */
  refetchMessages: () => void;
  /** Whether there are more (older) messages to load */
  hasMoreMessages: boolean;
  /** Whether older messages are currently being fetched */
  isLoadingOlder: boolean;
  /** Load older messages handler (wraps fetchNextPage) */
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
}

// ============================================================================
// Reducer
// ============================================================================

interface MessagesState {
  messageSearch: string;
  debouncedMessageSearch: string;
  showMessageSearch: boolean;
  messageSelectionMode: boolean;
  selectedMessageIds: Set<number>;
  showBulkMessageDeleteConfirm: boolean;
}

type MessagesAction =
  | { type: 'SET_MESSAGE_SEARCH'; search: string }
  | { type: 'SET_DEBOUNCED_SEARCH'; search: string }
  | { type: 'SET_SHOW_SEARCH'; show: boolean }
  | { type: 'TOGGLE_SELECTION_MODE' }
  | { type: 'TOGGLE_MESSAGE_SELECT'; messageId: number }
  | { type: 'SELECT_ALL_MESSAGES'; messageIds: Set<number> }
  | { type: 'CLEAR_SELECTION' }
  | { type: 'SET_SHOW_DELETE_CONFIRM'; show: boolean }
  | { type: 'RESET_FOR_NEW_CONVERSATION' };

const initialState: MessagesState = {
  messageSearch: '',
  debouncedMessageSearch: '',
  showMessageSearch: false,
  messageSelectionMode: false,
  selectedMessageIds: new Set<number>(),
  showBulkMessageDeleteConfirm: false,
};

function messagesReducer(state: MessagesState, action: MessagesAction): MessagesState {
  switch (action.type) {
    case 'SET_MESSAGE_SEARCH':
      return { ...state, messageSearch: action.search };
    case 'SET_DEBOUNCED_SEARCH':
      return { ...state, debouncedMessageSearch: action.search };
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
    case 'RESET_FOR_NEW_CONVERSATION':
      return {
        ...state,
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
 * Manages the agent's WhatsApp thread view: data fetching, search,
 * selection, and bulk delete. Data is owned by `useWaMessagesInfinite`
 * (cursor-paginated, same contract as the manager-oversight side); this
 * hook only carries the UI-state reducer + the small wrappers that
 * surface it to the page.
 *
 * Scroll mechanics — initial scroll-to-bottom, auto-scroll on new
 * messages, and the prepend scroll-anchor — live in `WaMessageList`
 * (the shared component). We do NOT duplicate them here.
 */
export function useWaMessagesState({
  normalizedSelectedPhone,
  selectedConversation,
  selectionSource,
}: UseWaMessagesStateOptions): UseWaMessagesStateReturn {
  const toast = useToast();
  const [state, dispatch] = useReducer(messagesReducer, initialState);

  const markAsRead = useWaMarkAsRead();
  const deleteMessages = useWaDeleteMessages();

  // Cursor-paginated thread query (same contract as oversight).
  // Newest page lives at pages[0]; each subsequent page is older than
  // the previous one's tail timestamp.
  const {
    data: messagesData,
    isPending,
    isFetching: isFetchingMessages,
    refetch: refetchMessages,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = useWaMessagesInfinite(normalizedSelectedPhone, state.debouncedMessageSearch);

  const isLoadingMessages = isPending && !!normalizedSelectedPhone;

  // Reset UI state when the conversation changes. Pagination state is
  // owned by React Query and resets automatically on the new queryKey.
  const prevPhoneRef = useRef(normalizedSelectedPhone);
  if (normalizedSelectedPhone !== prevPhoneRef.current) {
    if (prevPhoneRef.current !== null) {
      dispatch({ type: 'RESET_FOR_NEW_CONVERSATION' });
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

  // Flatten all pages (server returns DESC), then reverse for display
  // (oldest→newest). React Query keeps pages stable, so this memo only
  // recomputes when a page is added/refetched.
  const messages = useMemo(() => {
    const flat = messagesData?.pages.flatMap((p) => p.messages) ?? [];
    if (flat.length === 0) return [];
    return flat.slice().reverse();
  }, [messagesData]);

  const hasMoreMessages = !!hasNextPage;

  const handleLoadOlder = useCallback(() => {
    if (!hasNextPage || isFetchingNextPage) return;
    void fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Mark as read on EXPLICIT engagement, and continue marking as read
  // while the agent is actively viewing the open thread.
  //
  // Gates (any one false → skip):
  //   1. `normalizedSelectedPhone` is set (there's a thread open).
  //   2. `unreadCount > 0` (something to mark).
  //   3. `selectionSource` is `click` or `new` — the user actively opened
  //      this thread *this session*. `url` (refresh-with-chat-open
  //      hydration) is deliberately excluded so we don't silently clear a
  //      legitimate prior unread count just because the user reloaded.
  //   4. Tab is visible AND focused. Mirrors Slack/WhatsApp: a backgrounded
  //      tab doesn't count as "actively reading," so the badge survives
  //      until the user returns and the visibility flip re-runs this
  //      effect.
  //
  // Deps include `unreadCount` and `isTabVisible` so the effect re-fires
  // when either changes — that's what makes "new inbound lands in the
  // open thread → badge resets" and "user returns to tab → pending unread
  // gets cleared" both work. We deliberately do NOT use an `isPending`
  // early-return: each `markAsRead.mutate` is idempotent server-side, so
  // letting follow-up arrivals queue a second mutation is the simplest
  // way to avoid the "two messages arrive in ~200ms, the second one stays
  // unread until next refetch" drift.
  const unreadCount = selectedConversation?.unreadCount ?? 0;
  const isTabVisible = useDocumentVisible();

  useEffect(() => {
    if (!normalizedSelectedPhone || unreadCount === 0) return;
    if (selectionSource !== 'click' && selectionSource !== 'new') return;
    if (!isTabVisible) return;
    markAsRead.mutate(normalizedSelectedPhone);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [normalizedSelectedPhone, selectionSource, unreadCount, isTabVisible]);

  // Publish the open thread to the cross-hook active-chat store. The
  // realtime WS handler (`useRealtimeWaSync.handleWaReceived`) reads this
  // to suppress its toast / OS notification when the inbound is for the
  // chat the user is already looking at — they'll see the bubble land
  // in the thread, the popup on top of it is pure noise.
  //
  // Cleanup resets to null on phone change AND on unmount, so leaving
  // `/phone/whatsapp` immediately re-enables notifications globally.
  const setActiveWaChat = useWaActiveChatStore((s) => s.setPhone);
  useEffect(() => {
    setActiveWaChat(normalizedSelectedPhone);
    return () => setActiveWaChat(null);
  }, [normalizedSelectedPhone, setActiveWaChat]);

  // === Callbacks ===

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

  return {
    messages,
    isLoadingMessages,
    isFetchingMessages,
    refetchMessages,
    hasMoreMessages,
    isLoadingOlder: isFetchingNextPage,
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
  };
}
