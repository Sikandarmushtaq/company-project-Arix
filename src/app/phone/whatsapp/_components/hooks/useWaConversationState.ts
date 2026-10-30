'use client';

import { useReducer, useMemo, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  useWaConversationsInfinite,
  useWaDeleteConversation,
  useWaConversationWindows,
  useMyCustomers,
} from '@/lib/hooks';
import { normalizePhone } from '@/lib/utils/phone';
import { useToast } from '@/lib/stores/toast';
import type { WaConversation } from '@/lib/api/services/whatsapp-types';

// ============================================================================
// Types
// ============================================================================

export interface UseWaConversationStateReturn {
  /** Current search query */
  conversationSearch: string;
  /** Set search query */
  setConversationSearch: (value: string) => void;
  /** Debounced search query */
  debouncedSearch: string;
  /** List of conversations */
  conversations: WaConversation[];
  /** Whether conversations are loading */
  isLoadingConversations: boolean;
  /** Whether conversations are being fetched */
  isFetchingConversations: boolean;
  /** Refetch conversations */
  refetchConversations: () => void;
  /** Currently selected phone */
  selectedPhone: string | null;
  /** Set selected phone — defaults to source 'click' (user-initiated). */
  setSelectedPhone: (phone: string | null, source?: SelectionSource) => void;
  /** Normalized selected phone */
  normalizedSelectedPhone: string | null;
  /**
   * How the current selection was made. Used by downstream effects to
   * distinguish user clicks from URL/route-driven hydration so they don't
   * fire side effects (e.g. markAsRead) on a refresh-with-chat-open.
   */
  selectionSource: SelectionSource;
  /** Selected conversation object */
  selectedConversation: WaConversation | null;
  /** Whether selection mode is active */
  conversationSelectionMode: boolean;
  /** Set of selected conversation phones */
  selectedConversations: Set<string>;
  /** Toggle selection mode */
  handleToggleConversationSelectionMode: () => void;
  /** Toggle conversation selection */
  handleToggleConversationSelect: (phone: string) => void;
  /** Select/deselect all conversations */
  handleSelectAllConversations: () => void;
  /** Whether delete confirmation is shown */
  showDeleteConfirmation: boolean;
  /** Set delete confirmation visibility */
  setShowDeleteConfirmation: (show: boolean) => void;
  /** Whether bulk delete confirmation is shown */
  showBulkConversationDeleteConfirm: boolean;
  /** Set bulk delete confirmation visibility */
  setShowBulkConversationDeleteConfirm: (show: boolean) => void;
  /** Confirm single delete */
  handleConfirmDelete: () => Promise<void>;
  /** Confirm bulk delete */
  handleConfirmBulkConversationDelete: () => Promise<void>;
  /** Whether single delete is in progress */
  isDeleting: boolean;
  /** Whether bulk delete is in progress */
  isBulkDeleting: boolean;
  /** Whether new conversation modal is shown */
  showNewConversation: boolean;
  /** Set new conversation modal visibility */
  setShowNewConversation: (show: boolean) => void;
  /** New phone input value */
  newPhoneInput: string;
  /** Set new phone input */
  setNewPhoneInput: (value: string) => void;
  /** Start new conversation handler */
  handleStartNewConversation: () => void;
  /** Map of phone -> windowEnd for active 24h windows */
  windowMap: Map<string, string>;
  /** Whether there are more conversations to load */
  hasNextPage: boolean;
  /** Whether next page is being fetched */
  isFetchingNextPage: boolean;
  /** Fetch next page of conversations */
  fetchNextPage: () => void;
}

// ============================================================================
// Reducer
// ============================================================================

/**
 * Why a chat is selected.
 *
 * - `click`        — user explicitly clicked the conversation row. Implies
 *                     active engagement → safe to auto-mark-read.
 * - `url`          — URL `?phone=` param hydrated on mount (refresh). User
 *                     may not have re-engaged — DO NOT auto-mark-read here.
 * - `new`          — opened from the "new conversation" flow.
 * - `none`         — no selection (initial state).
 */
export type SelectionSource = 'click' | 'url' | 'new' | 'none';

interface ConversationState {
  conversationSearch: string;
  debouncedSearch: string;
  selectedPhone: string | null;
  selectionSource: SelectionSource;
  conversationSelectionMode: boolean;
  selectedConversationPhones: string[];
  showDeleteConfirmation: boolean;
  showBulkConversationDeleteConfirm: boolean;
  showNewConversation: boolean;
  newPhoneInput: string;
  urlPhoneProcessed: string | null;
}

type ConversationAction =
  | { type: 'SET_SEARCH'; search: string }
  | { type: 'SET_DEBOUNCED_SEARCH'; search: string }
  | { type: 'SET_SELECTED_PHONE'; phone: string | null; source: SelectionSource }
  | { type: 'TOGGLE_SELECTION_MODE' }
  | { type: 'TOGGLE_CONVERSATION_SELECT'; phone: string }
  | { type: 'SELECT_ALL_CONVERSATIONS'; phones: string[] }
  | { type: 'CLEAR_CONVERSATION_SELECTION' }
  | { type: 'SET_SHOW_DELETE_CONFIRMATION'; show: boolean }
  | { type: 'SET_SHOW_BULK_DELETE_CONFIRM'; show: boolean }
  | { type: 'SET_SHOW_NEW_CONVERSATION'; show: boolean }
  | { type: 'SET_NEW_PHONE_INPUT'; value: string }
  | { type: 'URL_PHONE_PROCESSED'; phone: string }
  | { type: 'START_NEW_CONVERSATION'; phone: string; isExisting: boolean };

const initialState: ConversationState = {
  conversationSearch: '',
  debouncedSearch: '',
  selectedPhone: null,
  selectionSource: 'none',
  conversationSelectionMode: false,
  selectedConversationPhones: [],
  showDeleteConfirmation: false,
  showBulkConversationDeleteConfirm: false,
  showNewConversation: false,
  newPhoneInput: '',
  urlPhoneProcessed: null,
};

function conversationReducer(
  state: ConversationState,
  action: ConversationAction
): ConversationState {
  switch (action.type) {
    case 'SET_SEARCH':
      return { ...state, conversationSearch: action.search };
    case 'SET_DEBOUNCED_SEARCH':
      return { ...state, debouncedSearch: action.search };
    case 'SET_SELECTED_PHONE':
      return {
        ...state,
        selectedPhone: action.phone,
        selectionSource: action.phone === null ? 'none' : action.source,
      };
    case 'TOGGLE_SELECTION_MODE':
      return {
        ...state,
        conversationSelectionMode: !state.conversationSelectionMode,
        selectedConversationPhones: state.conversationSelectionMode
          ? []
          : state.selectedConversationPhones,
      };
    case 'TOGGLE_CONVERSATION_SELECT': {
      const normalized = normalizePhone(action.phone);
      const exists = state.selectedConversationPhones.includes(normalized);
      return {
        ...state,
        selectedConversationPhones: exists
          ? state.selectedConversationPhones.filter((p) => p !== normalized)
          : [...state.selectedConversationPhones, normalized],
      };
    }
    case 'SELECT_ALL_CONVERSATIONS':
      return { ...state, selectedConversationPhones: action.phones };
    case 'CLEAR_CONVERSATION_SELECTION':
      return { ...state, selectedConversationPhones: [], conversationSelectionMode: false };
    case 'SET_SHOW_DELETE_CONFIRMATION':
      return { ...state, showDeleteConfirmation: action.show };
    case 'SET_SHOW_BULK_DELETE_CONFIRM':
      return { ...state, showBulkConversationDeleteConfirm: action.show };
    case 'SET_SHOW_NEW_CONVERSATION':
      return { ...state, showNewConversation: action.show };
    case 'SET_NEW_PHONE_INPUT':
      return { ...state, newPhoneInput: action.value };
    case 'URL_PHONE_PROCESSED':
      return { ...state, urlPhoneProcessed: action.phone };
    case 'START_NEW_CONVERSATION':
      return {
        ...state,
        selectedPhone: action.phone,
        // 'new' = the user started/picked this chat via the new-conversation
        // flow. They DID engage — auto-mark-read is appropriate when the
        // chat already has unread messages (existing conversation case).
        selectionSource: 'new',
        showNewConversation: false,
        newPhoneInput: '',
      };
    default:
      return state;
  }
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Hook for managing WhatsApp conversation list state.
 * Handles search, selection, deletion, and new conversation creation.
 * Mirrors useConversationState from SMS but without group support.
 */
export function useWaConversationState(): UseWaConversationStateReturn {
  const toast = useToast();
  const searchParams = useSearchParams();
  const [state, dispatch] = useReducer(conversationReducer, initialState);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (state.conversationSearch !== state.debouncedSearch) {
        dispatch({ type: 'SET_DEBOUNCED_SEARCH', search: state.conversationSearch });
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [state.conversationSearch, state.debouncedSearch]);

  // Fetch conversations with infinite scroll
  const {
    data: infiniteData,
    isLoading: isLoadingConversations,
    isFetching: isFetchingConversations,
    refetch: refetchConversations,
    hasNextPage: hasNextPageRaw,
    isFetchingNextPage,
    fetchNextPage,
  } = useWaConversationsInfinite({
    search: state.debouncedSearch || undefined,
  });

  const hasNextPage = !!hasNextPageRaw;

  // Pull the agent's assigned customers — used to merge into the
  // conversation list so customers with no messages yet appear as
  // entry points (one unified list, no separate "My Customers" stack).
  const { data: myCustomers } = useMyCustomers();

  // Flatten pages + deduplicate conversations, then merge with assigned
  // customers so the left rail is a single ordered list:
  //
  //   - Real conversations (have messages) — sorted by last activity
  //   - Assigned customers without conversations — appended at the end
  //     as "no messages yet" entries
  //
  // Modern messaging UX (WhatsApp / iMessage / Telegram): one list, one
  // mental model. Customers are conversations-in-waiting.
  const conversations = useMemo(() => {
    const seen = new Set<string>();
    const result: WaConversation[] = [];
    if (infiniteData?.pages) {
      for (const page of infiniteData.pages) {
        for (const c of page.conversations) {
          const normalized = normalizePhone(c.phoneNumber);
          if (!seen.has(normalized)) {
            seen.add(normalized);
            result.push(c);
          }
        }
      }
    }
    // Append assigned customers with no conversation yet.
    if (myCustomers) {
      for (const cust of myCustomers) {
        const normalized = normalizePhone(cust.phone);
        if (seen.has(normalized)) continue;
        seen.add(normalized);
        result.push({
          phoneNumber: cust.phone,
          lastMessage: null,
          lastMessageType: 'text',
          // Use assignedAt so the row sorts after real activity but
          // still has a stable timestamp for ordering / display.
          lastMessageTime: cust.assignedAt,
          unreadCount: cust.unreadCount ?? 0,
          contactName: cust.name,
        });
      }
    }
    // Sort: real activity first (lastMessage non-null), then customers-
    // without-messages in assignedAt order. Within each group, newer
    // first. This keeps active conversations at the top while preserving
    // assigned-customers as visible entry points below.
    result.sort((a, b) => {
      const aHasMsg = !!a.lastMessage;
      const bHasMsg = !!b.lastMessage;
      if (aHasMsg !== bHasMsg) return aHasMsg ? -1 : 1;
      return new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime();
    });
    return result;
  }, [infiniteData?.pages, myCustomers]);

  // Fetch all active 24h windows
  const { data: windows } = useWaConversationWindows();

  const windowMap = useMemo(() => {
    const map = new Map<string, string>();
    if (windows) {
      for (const w of windows) {
        map.set(normalizePhone(w.contactPhone), w.windowEnd);
      }
    }
    return map;
  }, [windows]);

  // Get phone from URL
  const phoneFromUrl = searchParams.get('phone');
  const normalizedUrlPhone = phoneFromUrl ? normalizePhone(phoneFromUrl) : null;

  // Process URL phone parameter
  useEffect(() => {
    if (!normalizedUrlPhone) return;
    if (state.urlPhoneProcessed === normalizedUrlPhone) return;
    if (isLoadingConversations) return;

    dispatch({ type: 'URL_PHONE_PROCESSED', phone: normalizedUrlPhone });

    const existingConversation = conversations.find(
      (c) => normalizePhone(c.phoneNumber) === normalizedUrlPhone
    );

    if (existingConversation) {
      // source: 'url' — refresh/deep-link hydration. Downstream effects
      // (notably markAsRead in useWaMessagesState) MUST NOT treat this as
      // an explicit user engagement. The user may be returning to a page
      // they had open, not actively re-reading the chat.
      dispatch({
        type: 'SET_SELECTED_PHONE',
        phone: normalizePhone(existingConversation.phoneNumber),
        source: 'url',
      });
      dispatch({ type: 'SET_SHOW_NEW_CONVERSATION', show: false });
    } else {
      dispatch({ type: 'SET_NEW_PHONE_INPUT', value: normalizedUrlPhone });
      dispatch({ type: 'SET_SHOW_NEW_CONVERSATION', show: true });
      dispatch({ type: 'SET_SELECTED_PHONE', phone: null, source: 'none' });
    }
  }, [normalizedUrlPhone, state.urlPhoneProcessed, conversations, isLoadingConversations]);

  const normalizedSelectedPhone = useMemo(
    () => (state.selectedPhone ? normalizePhone(state.selectedPhone) : null),
    [state.selectedPhone]
  );

  // Get selected conversation
  const selectedConversation = useMemo(() => {
    if (!state.selectedPhone) return null;
    const selectedNormalized = normalizePhone(state.selectedPhone);
    return conversations.find((c) => normalizePhone(c.phoneNumber) === selectedNormalized) || null;
  }, [conversations, state.selectedPhone]);

  // Convert array to Set for return
  const selectedConversations = useMemo(
    () => new Set(state.selectedConversationPhones),
    [state.selectedConversationPhones]
  );

  // Mutations
  const deleteConversation = useWaDeleteConversation();

  // Callbacks
  const setConversationSearch = useCallback((search: string) => {
    dispatch({ type: 'SET_SEARCH', search });
  }, []);

  /**
   * Set the selected phone. Default source is 'click' — that's the call
   * site that needs to fire markAsRead (the conversation list's onClick).
   * URL hydration, programmatic clears, and the "new conversation" flow
   * explicitly pass their own source so downstream effects can branch.
   */
  const setSelectedPhone = useCallback(
    (phone: string | null, source: SelectionSource = 'click') => {
      dispatch({ type: 'SET_SELECTED_PHONE', phone, source });
    },
    []
  );

  const handleToggleConversationSelectionMode = useCallback(() => {
    dispatch({ type: 'TOGGLE_SELECTION_MODE' });
  }, []);

  const handleToggleConversationSelect = useCallback((phoneNumber: string) => {
    dispatch({ type: 'TOGGLE_CONVERSATION_SELECT', phone: phoneNumber });
  }, []);

  const handleSelectAllConversations = useCallback(() => {
    const allSelected = state.selectedConversationPhones.length === conversations.length;
    dispatch({
      type: 'SELECT_ALL_CONVERSATIONS',
      phones: allSelected ? [] : conversations.map((c) => normalizePhone(c.phoneNumber)),
    });
  }, [conversations, state.selectedConversationPhones.length]);

  const setShowDeleteConfirmation = useCallback((show: boolean) => {
    dispatch({ type: 'SET_SHOW_DELETE_CONFIRMATION', show });
  }, []);

  const setShowBulkConversationDeleteConfirm = useCallback((show: boolean) => {
    dispatch({ type: 'SET_SHOW_BULK_DELETE_CONFIRM', show });
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    if (!state.selectedPhone) return;
    try {
      await deleteConversation.mutateAsync(state.selectedPhone);
      dispatch({ type: 'SET_SHOW_DELETE_CONFIRMATION', show: false });
      dispatch({ type: 'SET_SELECTED_PHONE', phone: null, source: 'none' });
      toast.success('Conversation deleted');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete conversation');
    }
  }, [state.selectedPhone, deleteConversation, toast]);

  const handleConfirmBulkConversationDelete = useCallback(async () => {
    if (state.selectedConversationPhones.length === 0) return;

    const count = state.selectedConversationPhones.length;
    const results = await Promise.allSettled(
      state.selectedConversationPhones.map((phone) => deleteConversation.mutateAsync(phone))
    );
    const failed = results.filter((r) => r.status === 'rejected').length;

    dispatch({ type: 'SET_SHOW_BULK_DELETE_CONFIRM', show: false });
    dispatch({ type: 'CLEAR_CONVERSATION_SELECTION' });
    dispatch({ type: 'SET_SELECTED_PHONE', phone: null, source: 'none' });

    if (failed === 0) {
      toast.success(`${count} conversation(s) deleted`);
    } else {
      toast.error(`${count - failed} deleted, ${failed} failed`);
    }
  }, [state.selectedConversationPhones, deleteConversation, toast]);

  const setShowNewConversation = useCallback((show: boolean) => {
    dispatch({ type: 'SET_SHOW_NEW_CONVERSATION', show });
  }, []);

  const setNewPhoneInput = useCallback((value: string) => {
    dispatch({ type: 'SET_NEW_PHONE_INPUT', value });
  }, []);

  const handleStartNewConversation = useCallback(() => {
    const cleaned = state.newPhoneInput.replace(/[^0-9]/g, '');
    if (!cleaned || cleaned.length < 7 || cleaned.length > 15) {
      toast.error('Enter a valid phone number (7-15 digits with country code)');
      return;
    }

    const existingConversation = conversations.find(
      (c) => normalizePhone(c.phoneNumber) === cleaned
    );

    if (existingConversation) {
      dispatch({
        type: 'START_NEW_CONVERSATION',
        phone: existingConversation.phoneNumber,
        isExisting: true,
      });
      toast.info('Conversation already exists');
    } else {
      dispatch({ type: 'START_NEW_CONVERSATION', phone: cleaned, isExisting: false });
    }
  }, [state.newPhoneInput, conversations, toast]);

  return {
    conversationSearch: state.conversationSearch,
    setConversationSearch,
    debouncedSearch: state.debouncedSearch,
    conversations,
    isLoadingConversations,
    isFetchingConversations,
    refetchConversations,
    selectedPhone: state.selectedPhone,
    setSelectedPhone,
    normalizedSelectedPhone,
    selectionSource: state.selectionSource,
    selectedConversation,
    conversationSelectionMode: state.conversationSelectionMode,
    selectedConversations,
    handleToggleConversationSelectionMode,
    handleToggleConversationSelect,
    handleSelectAllConversations,
    showDeleteConfirmation: state.showDeleteConfirmation,
    setShowDeleteConfirmation,
    showBulkConversationDeleteConfirm: state.showBulkConversationDeleteConfirm,
    setShowBulkConversationDeleteConfirm,
    handleConfirmDelete,
    handleConfirmBulkConversationDelete,
    isDeleting: deleteConversation.isPending,
    isBulkDeleting: deleteConversation.isPending,
    showNewConversation: state.showNewConversation,
    setShowNewConversation,
    newPhoneInput: state.newPhoneInput,
    setNewPhoneInput,
    handleStartNewConversation,
    windowMap,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  };
}
