'use client';

import { useReducer, useMemo, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  useConversationsPaginated,
  useSearchMessages,
  useDeleteConversation,
  useDeleteConversations,
} from '@/lib/hooks';
import { normalizePhone } from '@/lib/utils/phone';
import { useToast } from '@/lib/stores/toast';
import type { Conversation, GroupedMessageResult } from '../types';

// ============================================================================
// Types
// ============================================================================

/**
 * Return type for useConversationState hook
 */
export interface UseConversationStateReturn {
  /** Current search query */
  conversationSearch: string;
  /** Set search query */
  setConversationSearch: (value: string) => void;
  /** Debounced search query */
  debouncedSearch: string;
  /** List of conversations */
  conversations: Conversation[];
  /** Whether conversations are loading */
  isLoadingConversations: boolean;
  /** Whether conversations are being fetched */
  isFetchingConversations: boolean;
  /** Refetch conversations */
  refetchConversations: () => void;
  /** Currently selected phone */
  selectedPhone: string | null;
  /** Set selected phone */
  setSelectedPhone: (phone: string | null) => void;
  /** Effective phone (selected or first) */
  effectivePhone: string | null;
  /** Normalized selected phone */
  normalizedSelectedPhone: string | null;
  /** Selected conversation object */
  selectedConversation: Conversation | null;
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
  /** Grouped message search results */
  groupedMessageResults: GroupedMessageResult[];
  /** Whether message search is loading */
  isLoadingMessageSearch: boolean;
  /** Whether message search is fetching */
  isFetchingMessageSearch: boolean;
}

// ============================================================================
// Reducer
// ============================================================================

interface ConversationState {
  conversationSearch: string;
  debouncedSearch: string;
  conversationPage: number;
  messageSearchPage: number;
  selectedPhone: string | null;
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
  | { type: 'SET_SELECTED_PHONE'; phone: string | null }
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
  conversationPage: 1,
  messageSearchPage: 1,
  selectedPhone: null,
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
      return {
        ...state,
        debouncedSearch: action.search,
        conversationPage: 1,
        messageSearchPage: 1,
      };
    case 'SET_SELECTED_PHONE':
      return { ...state, selectedPhone: action.phone };
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
 * Hook for managing conversation list state.
 * Handles search, selection, deletion, and new conversation creation.
 */
export function useConversationState(): UseConversationStateReturn {
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

  // Fetch conversations
  const {
    data: conversationsData,
    isLoading: isLoadingConversations,
    isFetching: isFetchingConversations,
    refetch: refetchConversations,
  } = useConversationsPaginated({
    page: state.conversationPage,
    limit: 20,
    search: state.debouncedSearch || undefined,
  });

  // Extract for stable reference
  const rawConversations = conversationsData?.conversations;

  // Deduplicate conversations
  const conversations = useMemo(() => {
    if (!rawConversations) return [];
    const seen = new Set<string>();
    return rawConversations.filter((c) => {
      const normalized = normalizePhone(c.phoneNumber);
      if (seen.has(normalized)) return false;
      seen.add(normalized);
      return true;
    });
  }, [rawConversations]);

  // Global message search
  const {
    data: messageSearchResults,
    isLoading: isLoadingMessageSearch,
    isFetching: isFetchingMessageSearch,
  } = useSearchMessages(
    state.debouncedSearch.length >= 2
      ? { q: state.debouncedSearch, page: state.messageSearchPage, limit: 50 }
      : null
  );

  // Extract for stable reference
  const rawSearchMessages = messageSearchResults?.messages;

  // Group message search results by conversation
  const groupedMessageResults = useMemo<GroupedMessageResult[]>(() => {
    if (!rawSearchMessages) return [];
    const groups = new Map<string, GroupedMessageResult>();

    for (const msg of rawSearchMessages) {
      const otherPhone = msg.direction === 'inbound' ? msg.sender : msg.receiver;
      const normalized = normalizePhone(otherPhone);
      if (!groups.has(normalized)) {
        groups.set(normalized, { phone: normalized, messages: [] });
      }
      groups.get(normalized)!.messages.push(msg);
    }

    return Array.from(groups.values()).sort((a, b) => {
      const aTime = new Date(a.messages[0].txRxDatetime).getTime();
      const bTime = new Date(b.messages[0].txRxDatetime).getTime();
      return bTime - aTime;
    });
  }, [rawSearchMessages]);

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
      dispatch({
        type: 'SET_SELECTED_PHONE',
        phone: normalizePhone(existingConversation.phoneNumber),
      });
      dispatch({ type: 'SET_SHOW_NEW_CONVERSATION', show: false });
    } else {
      dispatch({ type: 'SET_NEW_PHONE_INPUT', value: normalizedUrlPhone });
      dispatch({ type: 'SET_SHOW_NEW_CONVERSATION', show: true });
      dispatch({ type: 'SET_SELECTED_PHONE', phone: null });
    }
  }, [normalizedUrlPhone, state.urlPhoneProcessed, conversations, isLoadingConversations]);

  // Compute effective phone
  const effectivePhone = useMemo(() => {
    if (state.selectedPhone) return state.selectedPhone;
    if (conversations.length > 0) return conversations[0].phoneNumber;
    return null;
  }, [state.selectedPhone, conversations]);

  const normalizedSelectedPhone = useMemo(
    () => (effectivePhone ? normalizePhone(effectivePhone) : null),
    [effectivePhone]
  );

  // Get selected conversation
  const selectedConversation = useMemo(() => {
    if (!effectivePhone) return null;
    const selectedNormalized = normalizePhone(effectivePhone);
    return conversations.find((c) => normalizePhone(c.phoneNumber) === selectedNormalized) || null;
  }, [conversations, effectivePhone]);

  // Convert array to Set for return (computed, not stored)
  const selectedConversations = useMemo(
    () => new Set(state.selectedConversationPhones),
    [state.selectedConversationPhones]
  );

  // Mutations
  const deleteConversation = useDeleteConversation();
  const deleteConversations = useDeleteConversations();

  // Callbacks
  const setConversationSearch = useCallback((search: string) => {
    dispatch({ type: 'SET_SEARCH', search });
  }, []);

  const setSelectedPhone = useCallback((phone: string | null) => {
    dispatch({ type: 'SET_SELECTED_PHONE', phone });
  }, []);

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
    if (!effectivePhone) return;
    try {
      await deleteConversation.mutateAsync(effectivePhone);
      dispatch({ type: 'SET_SHOW_DELETE_CONFIRMATION', show: false });
      dispatch({ type: 'SET_SELECTED_PHONE', phone: null });
      toast.success('Conversation deleted');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete conversation');
    }
  }, [effectivePhone, deleteConversation, toast]);

  const handleConfirmBulkConversationDelete = useCallback(async () => {
    if (state.selectedConversationPhones.length === 0) return;
    try {
      const count = state.selectedConversationPhones.length;
      await deleteConversations.mutateAsync(state.selectedConversationPhones);
      dispatch({ type: 'SET_SHOW_BULK_DELETE_CONFIRM', show: false });
      dispatch({ type: 'CLEAR_CONVERSATION_SELECTION' });
      dispatch({ type: 'SET_SELECTED_PHONE', phone: null });
      toast.success(`${count} conversation(s) deleted`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete conversations');
    }
  }, [state.selectedConversationPhones, deleteConversations, toast]);

  const setShowNewConversation = useCallback((show: boolean) => {
    dispatch({ type: 'SET_SHOW_NEW_CONVERSATION', show });
  }, []);

  const setNewPhoneInput = useCallback((value: string) => {
    dispatch({ type: 'SET_NEW_PHONE_INPUT', value });
  }, []);

  const handleStartNewConversation = useCallback(() => {
    const normalized = normalizePhone(state.newPhoneInput);
    if (!normalized || normalized.length < 10) {
      toast.error('Please enter a valid phone number');
      return;
    }

    const existingConversation = conversations.find(
      (c) => normalizePhone(c.phoneNumber) === normalized
    );

    if (existingConversation) {
      dispatch({
        type: 'START_NEW_CONVERSATION',
        phone: existingConversation.phoneNumber,
        isExisting: true,
      });
      toast.info('Conversation already exists');
    } else {
      dispatch({ type: 'START_NEW_CONVERSATION', phone: normalized, isExisting: false });
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
    effectivePhone,
    normalizedSelectedPhone,
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
    isBulkDeleting: deleteConversations.isPending,
    showNewConversation: state.showNewConversation,
    setShowNewConversation,
    newPhoneInput: state.newPhoneInput,
    setNewPhoneInput,
    handleStartNewConversation,
    groupedMessageResults,
    isLoadingMessageSearch,
    isFetchingMessageSearch,
  };
}
