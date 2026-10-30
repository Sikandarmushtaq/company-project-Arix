'use client';

import { useReducer, useMemo, useEffect, useLayoutEffect, useCallback, useRef } from 'react';
import { useGroupMessages, useMarkGroupAsRead, useDeleteGroupMessages } from '@/lib/hooks';
import { smsGroupService } from '@/lib/api';
import { useToast } from '@/lib/stores/toast';
import { MESSAGES_PER_PAGE, Message } from '../types';

// ============================================================================
// Types
// ============================================================================

interface UseGroupMessagesStateOptions {
  /** Selected group ID */
  selectedGroupId: number | null;
  /** Unread count for selected group */
  unreadCount: number;
}

export interface UseGroupMessagesStateReturn {
  /** Deduplicated, sorted messages (oldest first) with search applied */
  messages: Message[];
  /** Whether initial messages are loading */
  isLoadingMessages: boolean;
  /** Whether messages are being fetched (including background) */
  isFetchingMessages: boolean;
  /** Refetch messages */
  refetchMessages: () => Promise<unknown>;
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
  /** Whether search is visible */
  showMessageSearch: boolean;
  /** Toggle search visibility */
  setShowMessageSearch: (show: boolean) => void;
  /** Whether selection mode is active */
  selectionMode: boolean;
  /** Set of selected message IDs */
  selectedMessageIds: Set<number>;
  /** Toggle selection mode */
  setSelectionMode: (on: boolean) => void;
  /** Toggle message selection */
  handleToggleSelect: (id: number) => void;
  /** Select/deselect all messages */
  handleSelectAll: () => void;
  /** Whether delete confirmation is shown */
  showBulkDeleteConfirm: boolean;
  /** Set delete confirmation visibility */
  setShowBulkDeleteConfirm: (show: boolean) => void;
  /** Confirm bulk delete */
  handleConfirmBulkDelete: () => Promise<void>;
  /** Whether bulk delete is in progress */
  isBulkDeleting: boolean;
  /** Messages container ref (for scroll position restore) */
  containerRef: React.RefObject<HTMLDivElement | null>;
  /** Messages end ref for scrolling to bottom */
  endRef: React.RefObject<HTMLDivElement | null>;
  /** Scroll to bottom */
  scrollToBottom: () => void;
}

// ============================================================================
// Reducer
// ============================================================================

interface GroupMessagesState {
  page: number;
  olderMessages: Message[];
  isLoadingOlder: boolean;
  messageSearch: string;
  showMessageSearch: boolean;
  selectionMode: boolean;
  selectedIds: Set<number>;
  showBulkDeleteConfirm: boolean;
}

type GroupMessagesAction =
  | { type: 'SET_PAGE'; page: number }
  | { type: 'ADD_OLDER_MESSAGES'; messages: Message[] }
  | { type: 'SET_LOADING_OLDER'; loading: boolean }
  | { type: 'SET_MESSAGE_SEARCH'; search: string }
  | { type: 'SET_SHOW_SEARCH'; show: boolean }
  | { type: 'SET_SELECTION_MODE'; on: boolean }
  | { type: 'TOGGLE_SELECT'; id: number }
  | { type: 'SELECT_ALL'; ids: Set<number> }
  | { type: 'CLEAR_SELECTION' }
  | { type: 'SET_SHOW_DELETE_CONFIRM'; show: boolean }
  | { type: 'RESET' };

const initialState: GroupMessagesState = {
  page: 1,
  olderMessages: [],
  isLoadingOlder: false,
  messageSearch: '',
  showMessageSearch: false,
  selectionMode: false,
  selectedIds: new Set(),
  showBulkDeleteConfirm: false,
};

function reducer(state: GroupMessagesState, action: GroupMessagesAction): GroupMessagesState {
  switch (action.type) {
    case 'SET_PAGE':
      return { ...state, page: action.page };
    case 'ADD_OLDER_MESSAGES': {
      const existingIds = new Set(state.olderMessages.map((m) => m.id));
      const newMessages = action.messages.filter((m) => !existingIds.has(m.id));
      if (newMessages.length === 0) return { ...state, isLoadingOlder: false };
      return {
        ...state,
        olderMessages: [...state.olderMessages, ...newMessages],
        isLoadingOlder: false,
      };
    }
    case 'SET_LOADING_OLDER':
      return { ...state, isLoadingOlder: action.loading };
    case 'SET_MESSAGE_SEARCH':
      return { ...state, messageSearch: action.search };
    case 'SET_SHOW_SEARCH':
      return {
        ...state,
        showMessageSearch: action.show,
        messageSearch: action.show ? state.messageSearch : '',
      };
    case 'SET_SELECTION_MODE':
      return {
        ...state,
        selectionMode: action.on,
        selectedIds: action.on ? state.selectedIds : new Set(),
      };
    case 'TOGGLE_SELECT': {
      const next = new Set(state.selectedIds);
      if (next.has(action.id)) next.delete(action.id);
      else next.add(action.id);
      return { ...state, selectedIds: next };
    }
    case 'SELECT_ALL':
      return { ...state, selectedIds: action.ids };
    case 'CLEAR_SELECTION':
      return { ...state, selectedIds: new Set(), selectionMode: false };
    case 'SET_SHOW_DELETE_CONFIRM':
      return { ...state, showBulkDeleteConfirm: action.show };
    case 'RESET':
      return { ...initialState };
    default:
      return state;
  }
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Hook for managing group message list state.
 *
 * Pagination strategy:
 * - React Query always fetches page 1 (keeps newest messages fresh)
 * - Older pages are fetched directly via smsGroupService and accumulated in state
 */
export function useGroupMessagesState({
  selectedGroupId,
  unreadCount,
}: UseGroupMessagesStateOptions): UseGroupMessagesStateReturn {
  const toast = useToast();
  const [state, dispatch] = useReducer(reducer, initialState);

  // Refs
  const containerRef = useRef<HTMLDivElement | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);
  const scrollHeightBeforeLoad = useRef(0);
  const loadingOlderRef = useRef(false);

  // Mutations
  const markGroupAsRead = useMarkGroupAsRead();
  const deleteGroupMsgs = useDeleteGroupMessages(selectedGroupId);

  // Reset during render when group changes (immediate — before any effects or paint)
  const prevGroupIdRef = useRef(selectedGroupId);
  if (selectedGroupId !== prevGroupIdRef.current) {
    if (prevGroupIdRef.current !== null) {
      dispatch({ type: 'RESET' });
      loadingOlderRef.current = false;
      scrollHeightBeforeLoad.current = 0;
    }
    prevGroupIdRef.current = selectedGroupId;
  }

  // Query always fetches page 1 — older pages fetched directly in handleLoadOlder
  const {
    data: messagesData,
    isPending,
    isFetching,
    refetch,
  } = useGroupMessages(selectedGroupId, { page: 1, limit: MESSAGES_PER_PAGE });

  // Show loading when group is selected but no data yet
  const isLoading = isPending && !!selectedGroupId;

  const rawMessages = messagesData?.messages;

  // Combine page 1 (from query) + older pages (from state), reverse, dedup, search
  const messages = useMemo(() => {
    const page1 = rawMessages || [];
    if (page1.length === 0 && state.olderMessages.length === 0) return [];

    const page1Ids = new Set(page1.map((m) => m.id));
    const uniqueOlder = state.olderMessages.filter((m) => !page1Ids.has(m.id));
    const all = [...page1, ...uniqueOlder];
    const reversed = [...all].reverse();

    // Deduplicate outbound group messages (safety net for WebSocket/cache races)
    const seen = new Set<string>();
    const deduped = reversed.filter((msg) => {
      if (msg.direction !== 'outbound') return true;
      const minuteBucket = msg.txRxDatetime?.slice(0, 16) || '';
      const key = `${msg.sender}|${msg.body}|${minuteBucket}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Client-side search
    if (state.messageSearch.trim()) {
      const q = state.messageSearch.trim().toLowerCase();
      return deduped.filter((msg) => msg.body?.toLowerCase().includes(q));
    }
    return deduped;
  }, [rawMessages, state.olderMessages, state.messageSearch]);

  // Has more
  const hasMoreMessages = messagesData ? state.page < messagesData.totalPages : false;

  // Load older — fetches directly, does NOT change the query key
  const handleLoadOlder = useCallback(async () => {
    if (!hasMoreMessages || loadingOlderRef.current || !selectedGroupId) return;
    loadingOlderRef.current = true;

    const groupIdAtFetch = selectedGroupId;

    if (containerRef.current) {
      scrollHeightBeforeLoad.current = containerRef.current.scrollHeight;
    }
    dispatch({ type: 'SET_LOADING_OLDER', loading: true });

    const nextPage = state.page + 1;
    try {
      const data = await smsGroupService.getGroupMessages(groupIdAtFetch, {
        page: nextPage,
        limit: MESSAGES_PER_PAGE,
      });
      // Guard: if group changed while fetching, discard stale results
      if (prevGroupIdRef.current !== groupIdAtFetch) return;
      dispatch({ type: 'SET_PAGE', page: nextPage });
      dispatch({ type: 'ADD_OLDER_MESSAGES', messages: data.messages });
    } catch {
      if (prevGroupIdRef.current === groupIdAtFetch) {
        dispatch({ type: 'SET_LOADING_OLDER', loading: false });
      }
    } finally {
      loadingOlderRef.current = false;
    }
  }, [hasMoreMessages, selectedGroupId, state.page]);

  // Restore scroll after loading older (useLayoutEffect = before paint, prevents glitch)
  useLayoutEffect(() => {
    if (state.page > 1 && !state.isLoadingOlder && scrollHeightBeforeLoad.current > 0) {
      const container = containerRef.current;
      if (container) {
        const scrollDiff = container.scrollHeight - scrollHeightBeforeLoad.current;
        container.scrollTop = scrollDiff;
        scrollHeightBeforeLoad.current = 0;
      }
    }
  }, [messages.length, state.page, state.isLoadingOlder]);

  // Mark as read
  const markAsReadMutate = markGroupAsRead.mutate;
  useEffect(() => {
    if (!selectedGroupId || unreadCount === 0) return;
    markAsReadMutate(selectedGroupId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedGroupId, unreadCount]);

  // Scroll to bottom
  const scrollToBottom = useCallback(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  // Search
  const setMessageSearch = useCallback((search: string) => {
    dispatch({ type: 'SET_MESSAGE_SEARCH', search });
  }, []);

  const setShowMessageSearch = useCallback((show: boolean) => {
    dispatch({ type: 'SET_SHOW_SEARCH', show });
  }, []);

  // Selection
  const setSelectionMode = useCallback((on: boolean) => {
    dispatch({ type: 'SET_SELECTION_MODE', on });
  }, []);

  const handleToggleSelect = useCallback((id: number) => {
    dispatch({ type: 'TOGGLE_SELECT', id });
  }, []);

  const handleSelectAll = useCallback(() => {
    const allSelected = state.selectedIds.size === messages.length;
    dispatch({
      type: 'SELECT_ALL',
      ids: allSelected ? new Set() : new Set(messages.map((m) => m.id)),
    });
  }, [messages, state.selectedIds.size]);

  const setShowBulkDeleteConfirm = useCallback((show: boolean) => {
    dispatch({ type: 'SET_SHOW_DELETE_CONFIRM', show });
  }, []);

  const handleConfirmBulkDelete = useCallback(async () => {
    if (state.selectedIds.size === 0) return;
    try {
      const count = state.selectedIds.size;
      await deleteGroupMsgs.mutateAsync([...state.selectedIds]);
      dispatch({ type: 'SET_SHOW_DELETE_CONFIRM', show: false });
      dispatch({ type: 'CLEAR_SELECTION' });
      toast.success(`${count} message(s) deleted`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete messages');
    }
  }, [state.selectedIds, deleteGroupMsgs, toast]);

  return {
    messages,
    isLoadingMessages: isLoading,
    isFetchingMessages: isFetching,
    refetchMessages: refetch,
    hasMoreMessages,
    isLoadingOlder: state.isLoadingOlder,
    handleLoadOlder,
    messageSearch: state.messageSearch,
    setMessageSearch,
    showMessageSearch: state.showMessageSearch,
    setShowMessageSearch,
    selectionMode: state.selectionMode,
    selectedMessageIds: state.selectedIds,
    setSelectionMode,
    handleToggleSelect,
    handleSelectAll,
    showBulkDeleteConfirm: state.showBulkDeleteConfirm,
    setShowBulkDeleteConfirm,
    handleConfirmBulkDelete,
    isBulkDeleting: deleteGroupMsgs.isPending,
    containerRef,
    endRef,
    scrollToBottom,
  };
}
