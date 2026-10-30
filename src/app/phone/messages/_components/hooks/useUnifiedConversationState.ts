'use client';

import { useReducer, useMemo, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import { useSearchMessages, useDeleteConversation, useDeleteGroup } from '@/lib/hooks';
import { normalizePhone } from '@/lib/utils/phone';
import { useToast } from '@/lib/stores/toast';
import { smsGroupService, smsService, type UnifiedConversation } from '@/lib/api';
import { useAuthStore } from '@/lib/stores';
import { groupsKeys, convertToUnifiedConversations } from '@/lib/hooks/useGroups';
import type { GroupedMessageResult } from '../types';
import type { GroupMembershipInfo } from '../UnifiedConversationItem';

// ============================================================================
// Types
// ============================================================================

export type ConversationViewType = 'direct' | 'group';

export interface SelectedConversation {
  type: ConversationViewType;
  /** For direct: phone number; For group: group ID string */
  id: string;
  /** Group ID (only for groups) */
  groupId?: number;
  /** Phone number (only for direct) */
  phoneNumber?: string;
}

export interface UseUnifiedConversationStateReturn {
  // Search
  conversationSearch: string;
  setConversationSearch: (value: string) => void;
  debouncedSearch: string;

  // Unified conversations
  conversations: UnifiedConversation[];
  isLoadingConversations: boolean;
  isFetchingConversations: boolean;
  refetchConversations: () => void;

  // Selection
  selectedConversation: SelectedConversation | null;
  setSelectedConversation: (conv: SelectedConversation | null) => void;
  selectedUnifiedConversation: UnifiedConversation | null;

  // For direct conversations
  effectivePhone: string | null;
  normalizedSelectedPhone: string | null;

  // For group conversations
  selectedGroupId: number | null;

  // Selection mode (bulk delete)
  selectionMode: boolean;
  selectedIds: Set<string>;
  handleToggleSelectionMode: () => void;
  handleToggleSelect: (id: string) => void;
  handleSelectAll: () => void;

  // Delete
  showDeleteConfirmation: boolean;
  setShowDeleteConfirmation: (show: boolean) => void;
  showBulkDeleteConfirm: boolean;
  setShowBulkDeleteConfirm: (show: boolean) => void;
  handleConfirmDelete: () => Promise<void>;
  handleConfirmBulkDelete: () => Promise<void>;
  isDeleting: boolean;
  isBulkDeleting: boolean;

  // New conversation/group modals
  showNewConversation: boolean;
  setShowNewConversation: (show: boolean) => void;
  showCreateGroup: boolean;
  setShowCreateGroup: (show: boolean) => void;
  newPhoneInput: string;
  setNewPhoneInput: (value: string) => void;
  handleStartNewConversation: () => void;

  // Group info panel
  showGroupInfo: boolean;
  setShowGroupInfo: (show: boolean) => void;

  // Message search results
  groupedMessageResults: GroupedMessageResult[];
  isLoadingMessageSearch: boolean;
  isFetchingMessageSearch: boolean;

  // Group membership info for direct conversations
  // Map of phone number -> group info (for contacts that are in groups with user)
  groupMemberships: Record<string, GroupMembershipInfo>;
  isLoadingMemberships: boolean;

  // Check if selected conversation is in a group (for blocking send)
  isSelectedConversationInGroup: boolean;
  selectedConversationGroupInfo: GroupMembershipInfo | null;

  // Infinite scroll
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => void;
}

// ============================================================================
// Reducer
// ============================================================================

interface State {
  conversationSearch: string;
  debouncedSearch: string;
  selectedConversation: SelectedConversation | null;
  selectionMode: boolean;
  selectedIds: string[];
  showDeleteConfirmation: boolean;
  showBulkDeleteConfirm: boolean;
  showNewConversation: boolean;
  showCreateGroup: boolean;
  showGroupInfo: boolean;
  newPhoneInput: string;
  urlProcessed: string | null;
}

type Action =
  | { type: 'SET_SEARCH'; search: string }
  | { type: 'SET_DEBOUNCED_SEARCH'; search: string }
  | { type: 'SET_SELECTED'; conversation: SelectedConversation | null }
  | { type: 'TOGGLE_SELECTION_MODE' }
  | { type: 'TOGGLE_SELECT'; id: string }
  | { type: 'SELECT_ALL'; ids: string[] }
  | { type: 'CLEAR_SELECTION' }
  | { type: 'SET_SHOW_DELETE'; show: boolean }
  | { type: 'SET_SHOW_BULK_DELETE'; show: boolean }
  | { type: 'SET_SHOW_NEW_CONVERSATION'; show: boolean }
  | { type: 'SET_SHOW_CREATE_GROUP'; show: boolean }
  | { type: 'SET_SHOW_GROUP_INFO'; show: boolean }
  | { type: 'SET_NEW_PHONE'; value: string }
  | { type: 'URL_PROCESSED'; value: string }
  | { type: 'START_NEW_CONVERSATION'; phone: string };

const initialState: State = {
  conversationSearch: '',
  debouncedSearch: '',
  selectedConversation: null,
  selectionMode: false,
  selectedIds: [],
  showDeleteConfirmation: false,
  showBulkDeleteConfirm: false,
  showNewConversation: false,
  showCreateGroup: false,
  showGroupInfo: false,
  newPhoneInput: '',
  urlProcessed: null,
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'SET_SEARCH':
      return { ...state, conversationSearch: action.search };
    case 'SET_DEBOUNCED_SEARCH':
      return { ...state, debouncedSearch: action.search };
    case 'SET_SELECTED':
      return { ...state, selectedConversation: action.conversation, showGroupInfo: false };
    case 'TOGGLE_SELECTION_MODE':
      return {
        ...state,
        selectionMode: !state.selectionMode,
        selectedIds: state.selectionMode ? [] : state.selectedIds,
      };
    case 'TOGGLE_SELECT': {
      const exists = state.selectedIds.includes(action.id);
      return {
        ...state,
        selectedIds: exists
          ? state.selectedIds.filter((id) => id !== action.id)
          : [...state.selectedIds, action.id],
      };
    }
    case 'SELECT_ALL':
      return { ...state, selectedIds: action.ids };
    case 'CLEAR_SELECTION':
      return { ...state, selectedIds: [], selectionMode: false };
    case 'SET_SHOW_DELETE':
      return { ...state, showDeleteConfirmation: action.show };
    case 'SET_SHOW_BULK_DELETE':
      return { ...state, showBulkDeleteConfirm: action.show };
    case 'SET_SHOW_NEW_CONVERSATION':
      return { ...state, showNewConversation: action.show };
    case 'SET_SHOW_CREATE_GROUP':
      return { ...state, showCreateGroup: action.show };
    case 'SET_SHOW_GROUP_INFO':
      return { ...state, showGroupInfo: action.show };
    case 'SET_NEW_PHONE':
      return { ...state, newPhoneInput: action.value };
    case 'URL_PROCESSED':
      return { ...state, urlProcessed: action.value };
    case 'START_NEW_CONVERSATION':
      return {
        ...state,
        selectedConversation: { type: 'direct', id: action.phone, phoneNumber: action.phone },
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
 * Hook for managing unified conversation state (direct + groups)
 */
export function useUnifiedConversationState(): UseUnifiedConversationStateReturn {
  const toast = useToast();
  const searchParams = useSearchParams();
  const [state, dispatch] = useReducer(reducer, initialState);
  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (state.conversationSearch !== state.debouncedSearch) {
        dispatch({ type: 'SET_DEBOUNCED_SEARCH', search: state.conversationSearch });
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [state.conversationSearch, state.debouncedSearch]);

  // Fetch unified conversations with infinite scroll
  const CONVERSATIONS_LIMIT = 50;
  const searchParam = state.debouncedSearch || undefined;

  const {
    data: infiniteData,
    isLoading: isLoadingConversations,
    isFetching: isFetchingConversations,
    refetch: refetchConversations,
    hasNextPage: hasNextPage = false,
    isFetchingNextPage,
    fetchNextPage,
  } = useInfiniteQuery({
    queryKey: groupsKeys.unified({ search: searchParam }),
    queryFn: async ({ pageParam = 1 }) => {
      try {
        return await smsGroupService.getUnifiedConversations({
          page: pageParam,
          limit: CONVERSATIONS_LIMIT,
          search: searchParam,
        });
      } catch (error: unknown) {
        // Fallback to old /sms/conversations endpoint
        console.warn(
          '[useUnifiedConversationState] /sms/unified failed, falling back to /sms/conversations',
          error instanceof Error ? error.message : 'Unknown error'
        );
        const oldData = await smsService.getConversationsPaginated({
          page: pageParam,
          limit: CONVERSATIONS_LIMIT,
          search: searchParam,
        });
        return convertToUnifiedConversations(oldData);
      }
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      if (lastPage.page < lastPage.totalPages) {
        return lastPage.page + 1;
      }
      return undefined;
    },
    staleTime: 30 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: 'always',
    refetchOnReconnect: true,
    retry: 2,
  });

  // Flatten all pages into a single conversations array (deduplicated)
  const serverConversations = useMemo(() => {
    if (!infiniteData?.pages) return [];
    const all = infiniteData.pages.flatMap((page) => page.conversations);
    const seen = new Set<string>();
    return all.filter((conv) => {
      const key = conv.isGroup ? `group-${conv.groupId}` : normalizePhone(conv.phoneNumber || '');
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [infiniteData?.pages]);

  // Keep a snapshot of the FULL (unfiltered) conversation list so a phone-number
  // search can be matched locally. The server search is a raw `phoneNumber LIKE
  // '%query%'`, so a number typed in a different digit grouping than it's stored
  // (e.g. 10-digit "2107593062" vs stored "12107593062") returns nothing even
  // though the conversation exists — which is why "New SMS" finds it (it compares
  // via normalizePhone) but search doesn't. We mirror that normalized match here.
  const fullListRef = useRef<UnifiedConversation[]>([]);
  useEffect(() => {
    if (!state.debouncedSearch) fullListRef.current = serverConversations;
  }, [state.debouncedSearch, serverConversations]);

  const conversations = useMemo(() => {
    const queryDigits = state.debouncedSearch.replace(/\D/g, '');
    // Only augment for phone-like queries (≥4 digits); name search stays server-side.
    if (queryDigits.length < 4) return serverConversations;

    const seen = new Set(
      serverConversations.map((c) =>
        c.isGroup ? `group-${c.groupId}` : normalizePhone(c.phoneNumber || '')
      )
    );
    const localMatches = fullListRef.current.filter((c) => {
      if (c.isGroup || !c.phoneNumber) return false;
      const key = normalizePhone(c.phoneNumber);
      if (!key || seen.has(key)) return false;
      // Match on normalized digits OR the raw stored digits, so either grouping hits.
      return key.includes(queryDigits) || c.phoneNumber.replace(/\D/g, '').includes(queryDigits);
    });

    return localMatches.length ? [...serverConversations, ...localMatches] : serverConversations;
  }, [serverConversations, state.debouncedSearch]);

  // Extract direct conversation phone numbers for membership check
  const directPhoneNumbers = useMemo(() => {
    return conversations
      .filter((c) => !c.isGroup && c.phoneNumber)
      .map((c) => normalizePhone(c.phoneNumber!));
  }, [conversations]);

  // Fetch group memberships for all direct conversations
  const { data: membershipsData, isLoading: isLoadingMemberships } = useQuery({
    queryKey: ['group-memberships', directPhoneNumbers],
    queryFn: async () => {
      if (directPhoneNumbers.length === 0) return {};
      try {
        return await smsGroupService.checkMemberships(directPhoneNumbers);
      } catch (error) {
        // Silently fail if endpoint not available
        console.warn('[useUnifiedConversationState] checkMemberships failed:', error);
        return {};
      }
    },
    enabled: directPhoneNumbers.length > 0,
    staleTime: 30_000, // 30 seconds
    gcTime: 5 * 60_000, // 5 minutes
  });

  const groupMemberships = membershipsData || {};

  // Global message search
  const {
    data: messageSearchResults,
    isLoading: isLoadingMessageSearch,
    isFetching: isFetchingMessageSearch,
  } = useSearchMessages(
    state.debouncedSearch.length >= 2 ? { q: state.debouncedSearch, page: 1, limit: 50 } : null
  );

  // Group message search results by conversation
  const groupedMessageResults = useMemo<GroupedMessageResult[]>(() => {
    if (!messageSearchResults?.messages) return [];
    const groups = new Map<string, GroupedMessageResult>();

    for (const msg of messageSearchResults.messages) {
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
  }, [messageSearchResults?.messages]);

  // URL parameters (phone or group)
  const phoneFromUrl = searchParams.get('phone');
  const groupFromUrl = searchParams.get('group');
  const normalizedUrlPhone = phoneFromUrl ? normalizePhone(phoneFromUrl) : null;
  const groupIdFromUrl = groupFromUrl ? parseInt(groupFromUrl, 10) : null;

  // Handle phone URL parameter
  useEffect(() => {
    if (!normalizedUrlPhone) return;
    if (state.urlProcessed === `phone:${normalizedUrlPhone}`) return;
    if (isLoadingConversations) return;

    dispatch({ type: 'URL_PROCESSED', value: `phone:${normalizedUrlPhone}` });

    const existingConv = conversations.find(
      (c) => !c.isGroup && c.phoneNumber && normalizePhone(c.phoneNumber) === normalizedUrlPhone
    );

    if (existingConv) {
      dispatch({
        type: 'SET_SELECTED',
        conversation: {
          type: 'direct',
          id: normalizedUrlPhone,
          phoneNumber: normalizedUrlPhone,
        },
      });
    } else {
      dispatch({ type: 'SET_NEW_PHONE', value: normalizedUrlPhone });
      dispatch({ type: 'SET_SHOW_NEW_CONVERSATION', show: true });
    }
  }, [normalizedUrlPhone, state.urlProcessed, conversations, isLoadingConversations]);

  // Handle group URL parameter
  useEffect(() => {
    if (!groupIdFromUrl || isNaN(groupIdFromUrl)) return;
    if (state.urlProcessed === `group:${groupIdFromUrl}`) return;
    if (isLoadingConversations) return;

    dispatch({ type: 'URL_PROCESSED', value: `group:${groupIdFromUrl}` });

    const existingGroup = conversations.find((c) => c.isGroup && c.groupId === groupIdFromUrl);

    if (existingGroup) {
      dispatch({
        type: 'SET_SELECTED',
        conversation: {
          type: 'group',
          id: `group-${groupIdFromUrl}`,
          groupId: groupIdFromUrl,
        },
      });
    }
  }, [groupIdFromUrl, state.urlProcessed, conversations, isLoadingConversations]);

  // NOTE: Auto-select first conversation is DISABLED for professional UX
  // Users must manually click a conversation to open it.
  // This prevents the "badge flash" issue where:
  // 1. User navigates to messages page
  // 2. First conversation auto-opens
  // 3. Unread badge immediately disappears
  // 4. User is confused whether the message was new or not
  //
  // Professional apps (WhatsApp, Slack, iMessage, Gmail) all require
  // manual click to open conversations.

  // Computed values
  const selectedUnifiedConversation = useMemo(() => {
    if (!state.selectedConversation) return null;
    return (
      conversations.find((c) => {
        if (state.selectedConversation!.type === 'group') {
          return c.isGroup && c.groupId === state.selectedConversation!.groupId;
        }
        return (
          !c.isGroup &&
          c.phoneNumber &&
          normalizePhone(c.phoneNumber) === state.selectedConversation!.id
        );
      }) || null
    );
  }, [conversations, state.selectedConversation]);

  // Clear selection when selected group no longer exists (e.g., deleted via WebSocket)
  // This prevents "Unknown" / "New conversation" showing after group deletion
  useEffect(() => {
    // Only handle group conversations
    if (!state.selectedConversation || state.selectedConversation.type !== 'group') return;
    // Wait until conversations have loaded
    if (isLoadingConversations) return;
    // Check if the selected group still exists in the conversations list
    const groupStillExists = conversations.some(
      (c) => c.isGroup && c.groupId === state.selectedConversation!.groupId
    );
    // If the group no longer exists, clear the selection to trigger auto-select
    if (!groupStillExists) {
      dispatch({ type: 'SET_SELECTED', conversation: null });
    }
  }, [state.selectedConversation, conversations, isLoadingConversations]);

  const effectivePhone = useMemo(() => {
    if (state.selectedConversation?.type === 'direct') {
      return state.selectedConversation.phoneNumber || null;
    }
    return null;
  }, [state.selectedConversation]);

  const normalizedSelectedPhone = useMemo(
    () => (effectivePhone ? normalizePhone(effectivePhone) : null),
    [effectivePhone]
  );

  const selectedGroupId = useMemo(() => {
    if (state.selectedConversation?.type === 'group') {
      return state.selectedConversation.groupId || null;
    }
    return null;
  }, [state.selectedConversation]);

  const selectedIds = useMemo(() => new Set(state.selectedIds), [state.selectedIds]);

  // Check if the selected direct conversation is in a group (for blocking send)
  const selectedConversationGroupInfo = useMemo<GroupMembershipInfo | null>(() => {
    if (!normalizedSelectedPhone) return null;
    return groupMemberships[normalizedSelectedPhone] || null;
  }, [normalizedSelectedPhone, groupMemberships]);

  const isSelectedConversationInGroup = !!selectedConversationGroupInfo;

  // Mutations
  const deleteConversation = useDeleteConversation();
  const deleteGroup = useDeleteGroup();

  // Callbacks
  const setConversationSearch = useCallback((search: string) => {
    dispatch({ type: 'SET_SEARCH', search });
  }, []);

  const setSelectedConversation = useCallback((conv: SelectedConversation | null) => {
    dispatch({ type: 'SET_SELECTED', conversation: conv });
  }, []);

  const handleToggleSelectionMode = useCallback(() => {
    dispatch({ type: 'TOGGLE_SELECTION_MODE' });
  }, []);

  const handleToggleSelect = useCallback((id: string) => {
    dispatch({ type: 'TOGGLE_SELECT', id });
  }, []);

  const handleSelectAll = useCallback(() => {
    const allIds = conversations.map((c) =>
      c.isGroup ? `group-${c.groupId}` : normalizePhone(c.phoneNumber || '')
    );
    const allSelected = state.selectedIds.length === allIds.length;
    dispatch({ type: 'SELECT_ALL', ids: allSelected ? [] : allIds });
  }, [conversations, state.selectedIds.length]);

  const setShowDeleteConfirmation = useCallback((show: boolean) => {
    dispatch({ type: 'SET_SHOW_DELETE', show });
  }, []);

  const setShowBulkDeleteConfirm = useCallback((show: boolean) => {
    dispatch({ type: 'SET_SHOW_BULK_DELETE', show });
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    if (!state.selectedConversation) return;

    try {
      if (state.selectedConversation.type === 'group' && state.selectedConversation.groupId) {
        await deleteGroup.mutateAsync(state.selectedConversation.groupId);
        toast.success('Group deleted');
      } else if (state.selectedConversation.phoneNumber) {
        await deleteConversation.mutateAsync(state.selectedConversation.phoneNumber);
        toast.success('Conversation deleted');
      }
      dispatch({ type: 'SET_SHOW_DELETE', show: false });
      dispatch({ type: 'SET_SELECTED', conversation: null });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete');
    }
  }, [state.selectedConversation, deleteConversation, deleteGroup, toast]);

  const handleConfirmBulkDelete = useCallback(async () => {
    if (state.selectedIds.length === 0) return;

    const count = state.selectedIds.length;

    // Run all deletes in parallel
    const results = await Promise.allSettled(
      state.selectedIds.map((id) => {
        if (id.startsWith('group-')) {
          const groupId = parseInt(id.replace('group-', ''), 10);
          return deleteGroup.mutateAsync(groupId);
        }
        return deleteConversation.mutateAsync(id);
      })
    );

    const failed = results.filter((r) => r.status === 'rejected').length;

    dispatch({ type: 'SET_SHOW_BULK_DELETE', show: false });
    dispatch({ type: 'CLEAR_SELECTION' });
    dispatch({ type: 'SET_SELECTED', conversation: null });

    if (failed === 0) {
      toast.success(`${count} item(s) deleted`);
    } else {
      toast.error(`${count - failed} deleted, ${failed} failed`);
    }
  }, [state.selectedIds, deleteConversation, deleteGroup, toast]);

  const setShowNewConversation = useCallback((show: boolean) => {
    dispatch({ type: 'SET_SHOW_NEW_CONVERSATION', show });
  }, []);

  const setShowCreateGroup = useCallback((show: boolean) => {
    dispatch({ type: 'SET_SHOW_CREATE_GROUP', show });
  }, []);

  const setShowGroupInfo = useCallback((show: boolean) => {
    dispatch({ type: 'SET_SHOW_GROUP_INFO', show });
  }, []);

  const setNewPhoneInput = useCallback((value: string) => {
    dispatch({ type: 'SET_NEW_PHONE', value });
  }, []);

  const handleStartNewConversation = useCallback(() => {
    const normalized = normalizePhone(state.newPhoneInput);
    if (!normalized || normalized.length < 10) {
      toast.error('Please enter a valid phone number');
      return;
    }

    // Prevent sending to any of the user's own phone numbers
    const user = useAuthStore.getState().user;
    const ownPhones = new Set((user?.phoneNumbers || []).map((p) => normalizePhone(p.phoneNumber)));
    if (user?.senderPhone) ownPhones.add(normalizePhone(user.senderPhone));
    if (ownPhones.has(normalized)) {
      toast.error('Cannot start a conversation with your own phone number');
      return;
    }

    const existingConv = conversations.find(
      (c) => !c.isGroup && c.phoneNumber && normalizePhone(c.phoneNumber) === normalized
    );

    if (existingConv) {
      dispatch({
        type: 'SET_SELECTED',
        conversation: {
          type: 'direct',
          id: normalized,
          phoneNumber: existingConv.phoneNumber,
        },
      });
      dispatch({ type: 'SET_SHOW_NEW_CONVERSATION', show: false });
      toast.info('Conversation already exists');
    } else {
      dispatch({ type: 'START_NEW_CONVERSATION', phone: normalized });
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

    selectedConversation: state.selectedConversation,
    setSelectedConversation,
    selectedUnifiedConversation,

    effectivePhone,
    normalizedSelectedPhone,
    selectedGroupId,

    selectionMode: state.selectionMode,
    selectedIds,
    handleToggleSelectionMode,
    handleToggleSelect,
    handleSelectAll,

    showDeleteConfirmation: state.showDeleteConfirmation,
    setShowDeleteConfirmation,
    showBulkDeleteConfirm: state.showBulkDeleteConfirm,
    setShowBulkDeleteConfirm,
    handleConfirmDelete,
    handleConfirmBulkDelete,
    isDeleting: deleteConversation.isPending || deleteGroup.isPending,
    isBulkDeleting: deleteConversation.isPending || deleteGroup.isPending,

    showNewConversation: state.showNewConversation,
    setShowNewConversation,
    showCreateGroup: state.showCreateGroup,
    setShowCreateGroup,
    newPhoneInput: state.newPhoneInput,
    setNewPhoneInput,
    handleStartNewConversation,

    showGroupInfo: state.showGroupInfo,
    setShowGroupInfo,

    groupedMessageResults,
    isLoadingMessageSearch,
    isFetchingMessageSearch,

    groupMemberships,
    isLoadingMemberships,
    isSelectedConversationInGroup,
    selectedConversationGroupInfo,

    hasNextPage,
    isFetchingNextPage,
    fetchNextPage: () => fetchNextPage(),
  };
}
