'use client';

import { useEffect, useRef } from 'react';
import {
  useQuery,
  useMutation,
  useQueryClient,
  skipToken,
  type InfiniteData,
} from '@tanstack/react-query';
import {
  smsGroupService,
  smsService,
  type SmsGroup,
  type SmsGroupWithMembers,
  type CreateGroupRequest,
  type UpdateGroupRequest,
  type AddMembersRequest,
  type SendGroupMessageRequest,
  type PaginatedGroupsResponse,
  type PaginatedUnifiedConversationsResponse,
  type PaginatedMessagesResponse,
  type GroupMessageResult,
  type UnifiedConversation,
} from '@/lib/api';
import { REALTIME_QUERY_CONFIG } from '@/lib/constants/query';
import { messagesKeys } from './useMessages';

/**
 * Query keys for groups - SSOT
 */
export const groupsKeys = {
  all: ['groups'] as const,
  list: () => [...groupsKeys.all, 'list'] as const,
  listPaginated: (params: { page?: number; limit?: number; includeArchived?: boolean }) =>
    [...groupsKeys.all, 'list', params] as const,
  detail: (groupId: number) => [...groupsKeys.all, 'detail', groupId] as const,
  messages: (groupId: number, params?: { page?: number; limit?: number }) =>
    [...groupsKeys.all, 'messages', groupId, params] as const,
  unified: (params?: { page?: number; limit?: number; search?: string }) =>
    [...groupsKeys.all, 'unified', params] as const,
  /**
   * Predicate to match ALL unified conversation queries regardless of params.
   * Use this with setQueriesData/invalidateQueries for reliable cache updates.
   *
   * Why predicate instead of prefix matching?
   * - Query keys like ['groups', 'unified', { page: 1, limit: 50 }] have object params
   * - Prefix matching with exact:false can be unreliable with object elements
   * - Predicate gives us explicit control over matching logic
   */
  unifiedPredicate: (query: { queryKey: unknown }) =>
    Array.isArray(query.queryKey) &&
    query.queryKey[0] === 'groups' &&
    query.queryKey[1] === 'unified',
};

/**
 * Helper to convert old conversation format to unified format
 */
export function convertToUnifiedConversations(
  conversations: Awaited<ReturnType<typeof smsService.getConversationsPaginated>>
): PaginatedUnifiedConversationsResponse {
  const unifiedConversations: UnifiedConversation[] = conversations.conversations.map((conv) => ({
    type: 'direct' as const,
    id: conv.phoneNumber,
    displayName: conv.contactName || conv.phoneNumber,
    lastMessage: conv.lastMessage,
    lastMessageAt: conv.lastMessageTime,
    // Ensure unreadCount is a number (API might return string like "001")
    unreadCount:
      typeof conv.unreadCount === 'string' ? parseInt(conv.unreadCount, 10) : conv.unreadCount || 0,
    isGroup: false,
    phoneNumber: conv.phoneNumber,
    contactName: conv.contactName,
  }));

  return {
    conversations: unifiedConversations,
    total: conversations.total,
    page: conversations.page,
    limit: conversations.limit,
    totalPages: conversations.totalPages,
  };
}

/**
 * Updates unified conversations in InfiniteData cache.
 * Internal — use updateAnyUnifiedCache for predicate-based updates.
 */
function updateInfiniteUnifiedCache(
  data: InfiniteData<PaginatedUnifiedConversationsResponse> | undefined,
  updater: (
    conversations: UnifiedConversation[],
    total: number
  ) => { conversations: UnifiedConversation[]; total: number }
): InfiniteData<PaginatedUnifiedConversationsResponse> | undefined {
  if (!data?.pages?.length) return data;

  const allConversations = data.pages.flatMap((p) => p.conversations);
  const currentTotal = data.pages[0].total;
  const limit = data.pages[0].limit || 50;

  const result = updater([...allConversations], currentTotal);
  const newTotal = result.total;
  const newTotalPages = Math.ceil(newTotal / limit);

  const newPages = data.pages.map((page, i) => {
    const start = i * limit;
    return {
      ...page,
      conversations: result.conversations.slice(start, start + limit),
      total: newTotal,
      totalPages: newTotalPages,
    };
  });

  return { ...data, pages: newPages, pageParams: data.pageParams };
}

/**
 * Updates unified conversations in any cache shape (InfiniteData or regular).
 * The notification dropdown uses regular useQuery while the messages page
 * uses useInfiniteQuery — this handles both transparently.
 */
export function updateAnyUnifiedCache(
  data: unknown,
  updater: (
    conversations: UnifiedConversation[],
    total: number
  ) => { conversations: UnifiedConversation[]; total: number }
): unknown {
  if (!data || typeof data !== 'object') return data;

  const obj = data as Record<string, unknown>;

  // InfiniteData shape (messages page — has .pages array)
  if (Array.isArray(obj.pages) && obj.pages.length > 0) {
    return updateInfiniteUnifiedCache(
      data as InfiniteData<PaginatedUnifiedConversationsResponse>,
      updater
    );
  }

  // Regular query shape (notification dropdown)
  if (Array.isArray(obj.conversations)) {
    const regular = data as PaginatedUnifiedConversationsResponse;
    const result = updater([...regular.conversations], regular.total);
    return { ...regular, ...result, totalPages: Math.ceil(result.total / (regular.limit || 50)) };
  }

  return data;
}

/**
 * Reads conversations from InfiniteData cache as flat array.
 * Internal — use readAnyUnifiedConversations for predicate-based reads.
 */
function readInfiniteUnifiedConversations(
  data: InfiniteData<PaginatedUnifiedConversationsResponse> | undefined
): UnifiedConversation[] {
  if (!data?.pages?.length) return [];
  return data.pages.flatMap((p) => p.conversations);
}

/**
 * Reads conversations from any unified cache shape (InfiniteData or regular).
 * Use this when reading via predicate that matches both messages page and bell icon.
 */
export function readAnyUnifiedConversations(data: unknown): UnifiedConversation[] {
  if (!data || typeof data !== 'object') return [];

  const obj = data as Record<string, unknown>;

  // InfiniteData shape (messages page)
  if (Array.isArray(obj.pages) && obj.pages.length > 0) {
    return readInfiniteUnifiedConversations(
      data as InfiniteData<PaginatedUnifiedConversationsResponse>
    );
  }

  // Regular query shape (notification dropdown)
  if (Array.isArray(obj.conversations)) {
    return (data as PaginatedUnifiedConversationsResponse).conversations;
  }

  return [];
}

/**
 * Hook to fetch unified conversations (direct + groups)
 * Uses real-time config - data updated via WebSocket events
 * Falls back to old /sms/conversations endpoint if /sms/unified is not available (production)
 * Handles both 404 (endpoint not found) and 500 (sms_groups table missing) errors
 */
export function useUnifiedConversations(
  params: { page?: number; limit?: number; search?: string } = {}
) {
  return useQuery({
    queryKey: groupsKeys.unified(params),
    queryFn: async () => {
      try {
        // Try the new unified endpoint first
        return await smsGroupService.getUnifiedConversations(params);
      } catch (error: unknown) {
        // Fallback to old /sms/conversations endpoint on any error
        // This handles both 404 (endpoint not deployed) and 500 (sms_groups table missing)
        console.warn(
          '[useUnifiedConversations] /sms/unified failed, falling back to /sms/conversations',
          error instanceof Error ? error.message : 'Unknown error'
        );
        const oldConversations = await smsService.getConversationsPaginated({
          page: params.page,
          limit: params.limit,
          search: params.search,
        });
        return convertToUnifiedConversations(oldConversations);
      }
    },
    ...REALTIME_QUERY_CONFIG,
  });
}

/**
 * Hook to fetch user's groups with pagination
 * Uses real-time config
 */
export function useGroups(
  params: { page?: number; limit?: number; includeArchived?: boolean } = {}
) {
  return useQuery({
    queryKey: groupsKeys.listPaginated(params),
    queryFn: () => smsGroupService.getGroups(params),
    ...REALTIME_QUERY_CONFIG,
  });
}

/**
 * Hook to fetch a single group with members
 */
export function useGroup(groupId: number | null) {
  return useQuery({
    queryKey: groupsKeys.detail(groupId || 0),
    queryFn: () => smsGroupService.getGroup(groupId!),
    enabled: !!groupId,
    staleTime: 30 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

/**
 * Hook to fetch group messages with pagination
 */
export function useGroupMessages(
  groupId: number | null,
  params: { page?: number; limit?: number } = {}
) {
  const fetchTriggeredForRef = useRef<number | null>(null);

  const query = useQuery({
    queryKey: groupsKeys.messages(groupId || 0, params),
    queryFn: groupId ? () => smsGroupService.getGroupMessages(groupId, params) : skipToken,
    staleTime: 30 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (groupId && fetchTriggeredForRef.current !== groupId) {
      fetchTriggeredForRef.current = groupId;
      requestAnimationFrame(() => {
        query.refetch();
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId]);

  return query;
}

/**
 * Hook to create a new group
 * Invalidates groups and unified lists on success
 */
export function useCreateGroup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateGroupRequest) => smsGroupService.createGroup(data),
    onSuccess: (newGroup) => {
      // Add to groups cache
      queryClient.setQueriesData<PaginatedGroupsResponse>(
        { queryKey: groupsKeys.list(), exact: false },
        (old) => {
          if (!old?.groups) return old;
          return {
            ...old,
            groups: [newGroup, ...old.groups],
            total: old.total + 1,
          };
        }
      );

      // Invalidate unified conversations
      queryClient.invalidateQueries({ predicate: groupsKeys.unifiedPredicate });
    },
  });
}

/**
 * Hook to update a group
 */
export function useUpdateGroup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ groupId, data }: { groupId: number; data: UpdateGroupRequest }) =>
      smsGroupService.updateGroup(groupId, data),
    onSuccess: (updatedGroup, { groupId }) => {
      // Update in detail cache
      queryClient.setQueryData<SmsGroupWithMembers>(groupsKeys.detail(groupId), (old) =>
        old ? { ...old, ...updatedGroup } : old
      );

      // Update in lists
      queryClient.setQueriesData<PaginatedGroupsResponse>(
        { queryKey: groupsKeys.list(), exact: false },
        (old) => {
          if (!old?.groups) return old;
          return {
            ...old,
            groups: old.groups.map((g) => (g.id === groupId ? { ...g, ...updatedGroup } : g)),
          };
        }
      );

      // Invalidate unified
      queryClient.invalidateQueries({ predicate: groupsKeys.unifiedPredicate });
    },
  });
}

/**
 * Hook to delete/archive a group
 */
export function useDeleteGroup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (groupId: number) => smsGroupService.deleteGroup(groupId),
    onMutate: async (groupId) => {
      await queryClient.cancelQueries({ queryKey: groupsKeys.all });

      const previousGroups = queryClient.getQueriesData({
        queryKey: groupsKeys.list(),
        exact: false,
      });

      // Optimistically remove from cache
      queryClient.setQueriesData<PaginatedGroupsResponse>(
        { queryKey: groupsKeys.list(), exact: false },
        (old) => {
          if (!old?.groups) return old;
          return {
            ...old,
            groups: old.groups.filter((g) => g.id !== groupId),
            total: Math.max(0, old.total - 1),
          };
        }
      );

      return { previousGroups, groupId };
    },
    onError: (_err, _groupId, context) => {
      if (context?.previousGroups) {
        context.previousGroups.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
    },
    onSettled: (_, __, groupId) => {
      queryClient.removeQueries({ queryKey: groupsKeys.detail(groupId) });
      queryClient.removeQueries({ queryKey: groupsKeys.messages(groupId) });
      queryClient.invalidateQueries({ predicate: groupsKeys.unifiedPredicate });
    },
  });
}

/**
 * Hook to add members to a group
 */
export function useAddGroupMembers() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ groupId, data }: { groupId: number; data: AddMembersRequest }) =>
      smsGroupService.addMembers(groupId, data),
    onSuccess: (newMembers, { groupId }) => {
      // Update group detail with new members
      queryClient.setQueryData<SmsGroupWithMembers>(groupsKeys.detail(groupId), (old) => {
        if (!old) return old;
        return {
          ...old,
          members: [...old.members, ...newMembers],
          memberCount: (old.memberCount || 0) + newMembers.length,
        };
      });

      // Invalidate lists
      queryClient.invalidateQueries({ queryKey: groupsKeys.list(), exact: false });
    },
  });
}

/**
 * Hook to remove a member from a group
 */
export function useRemoveGroupMember() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ groupId, phoneNumber }: { groupId: number; phoneNumber: string }) =>
      smsGroupService.removeMember(groupId, phoneNumber),
    onMutate: async ({ groupId, phoneNumber }) => {
      await queryClient.cancelQueries({ queryKey: groupsKeys.detail(groupId) });

      const previousDetail = queryClient.getQueryData<SmsGroupWithMembers>(
        groupsKeys.detail(groupId)
      );

      // Optimistically remove member
      queryClient.setQueryData<SmsGroupWithMembers>(groupsKeys.detail(groupId), (old) => {
        if (!old) return old;
        return {
          ...old,
          members: old.members.filter((m) => m.phoneNumber !== phoneNumber),
          memberCount: Math.max(0, (old.memberCount || 0) - 1),
        };
      });

      return { previousDetail, groupId };
    },
    onError: (_err, { groupId }, context) => {
      if (context?.previousDetail) {
        queryClient.setQueryData(groupsKeys.detail(groupId), context.previousDetail);
      }
    },
    onSettled: (_, __, { groupId }) => {
      queryClient.invalidateQueries({ queryKey: groupsKeys.list(), exact: false });
    },
  });
}

/**
 * Hook to send a message to a group
 * Sends to all group members
 */
export function useSendGroupMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ groupId, data }: { groupId: number; data: SendGroupMessageRequest }) =>
      smsGroupService.sendGroupMessage(groupId, data),
    onMutate: async ({ groupId, data }) => {
      await queryClient.cancelQueries({ queryKey: groupsKeys.messages(groupId) });

      const optimisticId = -Date.now();
      const now = new Date().toISOString();
      const optimisticMessage = {
        id: optimisticId,
        messageUuid: null,
        sender: '',
        receiver: '',
        body: data.body,
        direction: 'outbound' as const,
        status: 'pending',
        txRxDatetime: now,
        delivered: false,
        read: true,
        threadId: '',
        didId: 0,
        mediaUrl: data.mediaUrls?.join(',') || null,
        groupId: groupId,
        deletedForMe: false,
        updatedAt: now,
        segments: 0,
        price: null,
        messageType: 'sms',
        failureReason: null,
        deliveredAt: null,
        failedAt: null,
        providerSid: null,
        sentAt: null,
      };

      queryClient.setQueriesData<PaginatedMessagesResponse>(
        { queryKey: groupsKeys.messages(groupId), exact: false },
        (old) => {
          if (!old?.messages) return old;
          return { ...old, messages: [optimisticMessage, ...old.messages], total: old.total + 1 };
        }
      );

      return { optimisticId, groupId };
    },
    onError: (_err, _vars, context) => {
      if (context) {
        queryClient.setQueriesData<PaginatedMessagesResponse>(
          { queryKey: groupsKeys.messages(context.groupId), exact: false },
          (old) => {
            if (!old?.messages) return old;
            return {
              ...old,
              messages: old.messages.filter((m) => m.id !== context.optimisticId),
              total: Math.max(0, old.total - 1),
            };
          }
        );
      }
    },
    onSuccess: (result, { groupId }, context) => {
      // Remove optimistic message before invalidation triggers refetch
      if (context?.optimisticId) {
        queryClient.setQueriesData<PaginatedMessagesResponse>(
          { queryKey: groupsKeys.messages(groupId), exact: false },
          (old) => {
            if (!old?.messages) return old;
            return {
              ...old,
              messages: old.messages.filter((m) => m.id !== context.optimisticId),
              total: Math.max(0, old.total - 1),
            };
          }
        );
      }

      // Update group's last message in lists
      queryClient.setQueriesData<PaginatedGroupsResponse>(
        { queryKey: groupsKeys.list(), exact: false },
        (old) => {
          if (!old?.groups) return old;
          return {
            ...old,
            groups: old.groups.map((g) => {
              if (g.id === groupId) {
                return {
                  ...g,
                  lastMessageAt: new Date().toISOString(),
                  lastMessage:
                    result.messages[0]?.status === 'sent' ? 'Message sent' : 'Sending...',
                };
              }
              return g;
            }),
          };
        }
      );

      // Invalidate messages cache
      queryClient.invalidateQueries({ queryKey: groupsKeys.messages(groupId) });
      queryClient.invalidateQueries({ predicate: groupsKeys.unifiedPredicate });
    },
  });
}

/**
 * Hook to get total unread count across all groups
 * Uses dedicated efficient backend endpoint (single query)
 */
export function useGroupUnreadCount() {
  return useQuery({
    queryKey: [...groupsKeys.all, 'totalUnread'] as const,
    queryFn: () => smsGroupService.getGroupUnreadCount(),
    ...REALTIME_QUERY_CONFIG,
  });
}

/**
 * Hook to delete specific messages within a group conversation
 * Optimistically removes from group messages cache for immediate UI update
 */
export function useDeleteGroupMessages(groupId: number | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (messageIds: number[]) => smsService.deleteMessages(messageIds),
    onMutate: async (messageIds: number[]) => {
      if (!groupId) return {};

      // Cancel outgoing refetches for this group's messages
      await queryClient.cancelQueries({ queryKey: groupsKeys.messages(groupId) });

      // Snapshot for rollback
      const previousMessages = queryClient.getQueriesData<PaginatedMessagesResponse>({
        queryKey: groupsKeys.messages(groupId),
        exact: false,
      });

      // Optimistically remove messages from group cache
      const idsSet = new Set(messageIds);
      queryClient.setQueriesData<PaginatedMessagesResponse>(
        { queryKey: groupsKeys.messages(groupId), exact: false },
        (old) => {
          if (!old?.messages) return old;
          const filtered = old.messages.filter((m) => !idsSet.has(m.id));
          return {
            ...old,
            messages: filtered,
            total: Math.max(0, old.total - (old.messages.length - filtered.length)),
          };
        }
      );

      return { previousMessages };
    },
    onError: (_err, _messageIds, context) => {
      // Rollback on error
      if (context?.previousMessages) {
        context.previousMessages.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
    },
    onSettled: () => {
      if (!groupId) return;
      // Refetch group messages + unified conversations (for last message preview)
      queryClient.invalidateQueries({ queryKey: groupsKeys.messages(groupId), exact: false });
      queryClient.invalidateQueries({ predicate: groupsKeys.unifiedPredicate });
    },
  });
}

/**
 * Hook to mark group messages as read
 */
export function useMarkGroupAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (groupId: number) => smsGroupService.markGroupAsRead(groupId),
    onMutate: async (groupId) => {
      // Optimistically update unread count
      queryClient.setQueriesData<PaginatedGroupsResponse>(
        { queryKey: groupsKeys.list(), exact: false },
        (old) => {
          if (!old?.groups) return old;
          return {
            ...old,
            groups: old.groups.map((g) => (g.id === groupId ? { ...g, unreadCount: 0 } : g)),
          };
        }
      );

      // Update in unified (messages page + notification dropdown)
      queryClient.setQueriesData<unknown>(
        { predicate: groupsKeys.unifiedPredicate },
        (old: unknown) =>
          updateAnyUnifiedCache(old, (conversations, total) => ({
            conversations: conversations.map((c) =>
              c.isGroup && c.groupId === groupId ? { ...c, unreadCount: 0 } : c
            ),
            total,
          }))
      );
    },
    onSettled: () => {
      // Refetch group unread count for badge
      queryClient.refetchQueries({ queryKey: [...groupsKeys.all, 'totalUnread'], exact: true });
    },
  });
}
