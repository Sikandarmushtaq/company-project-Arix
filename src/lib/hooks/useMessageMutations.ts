'use client';

/**
 * Message Mutation Hooks
 *
 * Handles all message-related mutations with optimistic updates:
 * - useSendMessage
 * - useDeleteConversation
 * - useDeleteConversations
 * - useDeleteMessages
 * - useMarkMessagesAsRead
 *
 * @module lib/hooks/useMessageMutations
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  smsService,
  type Conversation,
  type PaginatedMessagesResponse,
  type PaginatedConversationsResponse,
} from '@/lib/api';
import { normalizePhone } from '@/lib/utils/phone';
import { useAuthStore } from '@/lib/stores';
import { groupsKeys, updateAnyUnifiedCache, readAnyUnifiedConversations } from './useGroups';
import { messagesKeys } from './useMessages';

/** Get current active phone from auth store (for sending — NOT for cache keys) */
function getActivePhone(): string {
  return useAuthStore.getState().user?.senderPhone || '';
}

/**
 * Hook to send a message (SMS or MMS with images)
 * Adds message directly to cache for instant UI update, then invalidates for sync
 */
export function useSendMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      to,
      body,
      mediaUrls,
      from,
    }: {
      to: string;
      body: string;
      mediaUrls?: string[];
      from?: string;
    }) => smsService.sendSms({ to, body, mediaUrls, from: from || getActivePhone() }),
    onMutate: async (variables) => {
      const normalizedTo = normalizePhone(variables.to);
      await queryClient.cancelQueries({ queryKey: ['messages', 'thread', normalizedTo] });

      const optimisticId = -Date.now();
      const now = new Date().toISOString();
      const optimisticMessage = {
        id: optimisticId,
        messageUuid: null,
        sender: '',
        receiver: normalizedTo,
        body: variables.body,
        direction: 'outbound' as const,
        status: 'pending',
        txRxDatetime: now,
        delivered: false,
        read: true,
        threadId: normalizedTo,
        didId: 0,
        mediaUrl: variables.mediaUrls?.join(',') || null,
        groupId: null,
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
        { queryKey: ['messages', 'thread', normalizedTo], exact: false },
        (old) => {
          if (!old?.messages) return old;
          return { ...old, messages: [optimisticMessage, ...old.messages], total: old.total + 1 };
        }
      );

      return { optimisticId, normalizedTo };
    },
    onError: (_err, _vars, context) => {
      if (context) {
        queryClient.setQueriesData<PaginatedMessagesResponse>(
          { queryKey: ['messages', 'thread', context.normalizedTo], exact: false },
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
    onSuccess: (newMessage, variables, context) => {
      const normalizedTo = normalizePhone(variables.to);

      // Determine preview text for conversation list
      const hasMedia = variables.mediaUrls && variables.mediaUrls.length > 0;
      const textContent = (newMessage.body || '').trim();
      const previewText = textContent || (hasMedia ? '📷 Image' : '');

      // 1. Replace optimistic message with real message in thread cache
      queryClient.setQueriesData<PaginatedMessagesResponse>(
        { queryKey: ['messages', 'thread', normalizedTo], exact: false },
        (old) => {
          if (!old?.messages) return old;

          // Remove optimistic message if present
          const filtered = context?.optimisticId
            ? old.messages.filter((m) => m.id !== context.optimisticId)
            : old.messages;
          const hadOptimistic = filtered.length < old.messages.length;

          // Prevent duplicates
          if (filtered.some((m) => m.id === newMessage.id)) {
            return {
              ...old,
              messages: filtered.map((m) => (m.id === newMessage.id ? newMessage : m)),
              total: hadOptimistic ? old.total - 1 : old.total,
            };
          }

          return {
            ...old,
            messages: [newMessage, ...filtered],
            total: hadOptimistic ? old.total : old.total + 1,
          };
        }
      );

      // 2. Update conversations list (move to top, update last message)
      queryClient.setQueriesData<PaginatedConversationsResponse>(
        { queryKey: messagesKeys.conversations(), exact: false },
        (old) => {
          if (!old?.conversations) return old;

          const existingIndex = old.conversations.findIndex(
            (c) => normalizePhone(c.phoneNumber) === normalizedTo
          );

          if (existingIndex >= 0) {
            // Update existing conversation and move to top
            const updated = [...old.conversations];
            const [existing] = updated.splice(existingIndex, 1);
            updated.unshift({
              ...existing,
              lastMessage: previewText,
              lastMessageTime: newMessage.txRxDatetime,
            });
            return { ...old, conversations: updated };
          }

          // New conversation - add at top
          return {
            ...old,
            conversations: [
              {
                phoneNumber: normalizedTo,
                lastMessage: previewText,
                lastMessageTime: newMessage.txRxDatetime,
                unreadCount: 0,
                contactName: null,
              },
              ...old.conversations,
            ],
            total: old.total + 1,
          };
        }
      );

      // 3. Update unified conversations cache (messages page + notification dropdown)
      const mediaUrl = newMessage.mediaUrl || (hasMedia ? variables.mediaUrls!.join(',') : null);
      queryClient.setQueriesData<unknown>(
        { predicate: groupsKeys.unifiedPredicate },
        (old: unknown) =>
          updateAnyUnifiedCache(old, (conversations, total) => {
            const existingIndex = conversations.findIndex(
              (c) => !c.isGroup && c.phoneNumber && normalizePhone(c.phoneNumber) === normalizedTo
            );

            if (existingIndex >= 0) {
              const [existing] = conversations.splice(existingIndex, 1);
              conversations.unshift({
                ...existing,
                lastMessage: previewText,
                lastMessageAt: newMessage.txRxDatetime,
                lastMessageMediaUrl: mediaUrl,
              });
              return { conversations, total };
            }

            // New conversation
            conversations.unshift({
              type: 'direct' as const,
              id: normalizedTo,
              displayName: normalizedTo,
              lastMessage: previewText,
              lastMessageAt: newMessage.txRxDatetime,
              lastMessageMediaUrl: mediaUrl,
              unreadCount: 0,
              isGroup: false,
              phoneNumber: normalizedTo,
              contactName: null,
            } as any);
            return { conversations, total: total + 1 };
          })
      );

      // 4. Invalidate unified conversations to sync (e.g. new conversation appears)
      queryClient.invalidateQueries({
        predicate: groupsKeys.unifiedPredicate,
      });
    },
  });
}

/**
 * Hook to delete a conversation
 * Removes conversation from cache and clears messages for that phone number
 */
export function useDeleteConversation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (phoneNumber: string) => {
      const normalizedPhone = normalizePhone(phoneNumber);
      return smsService.deleteConversation(normalizedPhone);
    },
    onMutate: async (phoneNumber: string) => {
      const normalizedPhone = normalizePhone(phoneNumber);

      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: messagesKeys.all });

      // Snapshot previous values for rollback
      const previousConversations = queryClient.getQueriesData({
        queryKey: messagesKeys.conversations(),
        exact: false,
      });

      // Optimistically remove conversation from cache
      queryClient.setQueriesData<PaginatedConversationsResponse | Conversation[]>(
        { queryKey: messagesKeys.conversations(), exact: false },
        (old) => {
          if (!old) return old;

          // Handle paginated response
          if ('conversations' in old && Array.isArray(old.conversations)) {
            const filtered = old.conversations.filter(
              (c) => normalizePhone(c.phoneNumber) !== normalizedPhone
            );
            return {
              ...old,
              conversations: filtered,
              total: Math.max(0, (old.total || 0) - 1),
            };
          }

          // Handle array response (legacy)
          if (Array.isArray(old)) {
            return old.filter((c) => normalizePhone(c.phoneNumber) !== normalizedPhone);
          }

          return old;
        }
      );

      // Remove messages for this conversation from cache
      queryClient.removeQueries({
        queryKey: ['messages', 'thread', normalizedPhone],
        exact: false,
      });

      // Optimistically remove from unified conversations cache (messages page + bell)
      queryClient.setQueriesData<unknown>(
        { predicate: groupsKeys.unifiedPredicate },
        (old: unknown) =>
          updateAnyUnifiedCache(old, (conversations, total) => ({
            conversations: conversations.filter(
              (c) =>
                c.isGroup || !c.phoneNumber || normalizePhone(c.phoneNumber) !== normalizedPhone
            ),
            total: Math.max(0, total - 1),
          }))
      );

      return { previousConversations, normalizedPhone };
    },
    onError: (_err, _phoneNumber, context) => {
      // Rollback on error
      if (context?.previousConversations) {
        context.previousConversations.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
    },
    onSettled: () => {
      // Refetch to ensure sync with server
      queryClient.invalidateQueries({ queryKey: messagesKeys.conversations() });
      queryClient.invalidateQueries({ queryKey: messagesKeys.unreadCount() });
      queryClient.invalidateQueries({ predicate: groupsKeys.unifiedPredicate });
    },
  });
}

/**
 * Hook to mark a conversation as unread (chat opened by mistake). Flips the
 * latest inbound message back to unread server-side, then refreshes the inbox
 * queries so the chat resurfaces as unread (and re-appears under the Unread tab).
 */
export function useMarkConversationUnread() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (phoneNumber: string) => smsService.markAsUnread(phoneNumber),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: messagesKeys.conversations() });
      queryClient.invalidateQueries({ queryKey: messagesKeys.unreadCount() });
      queryClient.invalidateQueries({ predicate: groupsKeys.unifiedPredicate });
    },
  });
}

/**
 * Hook to delete multiple conversations at once (bulk delete)
 * Removes conversations from cache and clears messages
 */
export function useDeleteConversations() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (phoneNumbers: string[]) => {
      // Delete conversations sequentially to avoid overwhelming the server
      const results = await Promise.all(
        phoneNumbers.map((phone) => {
          const normalizedPhone = normalizePhone(phone);
          return smsService.deleteConversation(normalizedPhone);
        })
      );
      return results;
    },
    onMutate: async (phoneNumbers: string[]) => {
      const normalizedPhones = phoneNumbers.map((p) => normalizePhone(p));

      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: messagesKeys.all });

      // Snapshot previous values for rollback
      const previousConversations = queryClient.getQueriesData({
        queryKey: messagesKeys.conversations(),
        exact: false,
      });

      // Optimistically remove all conversations from cache
      queryClient.setQueriesData<PaginatedConversationsResponse | Conversation[]>(
        { queryKey: messagesKeys.conversations(), exact: false },
        (old) => {
          if (!old) return old;

          // Handle paginated response
          if ('conversations' in old && Array.isArray(old.conversations)) {
            const filtered = old.conversations.filter(
              (c) => !normalizedPhones.includes(normalizePhone(c.phoneNumber))
            );
            return {
              ...old,
              conversations: filtered,
              total: Math.max(0, (old.total || 0) - (old.conversations.length - filtered.length)),
            };
          }

          // Handle array response (legacy)
          if (Array.isArray(old)) {
            return old.filter((c) => !normalizedPhones.includes(normalizePhone(c.phoneNumber)));
          }

          return old;
        }
      );

      // Remove messages for all these conversations from cache
      normalizedPhones.forEach((phone) => {
        queryClient.removeQueries({
          queryKey: ['messages', 'thread', phone],
          exact: false,
        });
      });

      // Optimistically remove from unified conversations cache (messages page + bell)
      queryClient.setQueriesData<unknown>(
        { predicate: groupsKeys.unifiedPredicate },
        (old: unknown) =>
          updateAnyUnifiedCache(old, (conversations, total) => {
            const filtered = conversations.filter(
              (c) =>
                c.isGroup ||
                !c.phoneNumber ||
                !normalizedPhones.includes(normalizePhone(c.phoneNumber))
            );
            return {
              conversations: filtered,
              total: Math.max(0, total - (conversations.length - filtered.length)),
            };
          })
      );

      return { previousConversations, normalizedPhones };
    },
    onError: (_err, _phoneNumbers, context) => {
      // Rollback on error
      if (context?.previousConversations) {
        context.previousConversations.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
    },
    onSettled: () => {
      // Refetch to ensure sync with server
      queryClient.invalidateQueries({ queryKey: messagesKeys.conversations() });
      queryClient.invalidateQueries({ queryKey: messagesKeys.unreadCount() });
      queryClient.invalidateQueries({ predicate: groupsKeys.unifiedPredicate });
    },
  });
}

/**
 * Hook to delete specific messages within a conversation
 * Removes messages from cache for immediate UI update
 */
export function useDeleteMessages() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (messageIds: number[]) => smsService.deleteMessages(messageIds),
    onMutate: async (messageIds: number[]) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: messagesKeys.all });

      // Snapshot previous thread data for rollback
      const previousThreads = queryClient.getQueriesData<PaginatedMessagesResponse>({
        queryKey: ['messages', 'thread'],
        exact: false,
      });

      // Optimistically remove messages from all thread caches
      queryClient.setQueriesData<PaginatedMessagesResponse>(
        { queryKey: ['messages', 'thread'], exact: false },
        (old) => {
          if (!old?.messages) return old;
          const filtered = old.messages.filter((m) => !messageIds.includes(m.id));
          return {
            ...old,
            messages: filtered,
            total: Math.max(0, old.total - (old.messages.length - filtered.length)),
          };
        }
      );

      return { previousThreads, messageIds };
    },
    onError: (_err, _messageIds, context) => {
      // Rollback on error
      if (context?.previousThreads) {
        context.previousThreads.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
    },
    onSettled: () => {
      // Refetch thread to ensure sync
      queryClient.invalidateQueries({ queryKey: ['messages', 'thread'], exact: false });
    },
  });
}

/**
 * Hook to mark messages as read
 *
 * SSOT Architecture:
 * - Searches ALL cache sources for the conversation's unread count
 * - Updates ALL caches consistently (conversations, unified, unreadList)
 * - Provides instant UI feedback via optimistic updates
 * - Forces immediate server sync with refetchQueries
 *
 * Cache sources checked (in order):
 * 1. unreadConversations (notification dropdown)
 * 2. conversations (legacy)
 * 3. unified conversations (messages page)
 * 4. If not found in any cache, defaults to 1 (we're marking something as read)
 */
export function useMarkMessagesAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (phoneNumber: string) => smsService.markAsRead(phoneNumber),
    onMutate: async (phoneNumber: string) => {
      // Normalize phone for consistent cache key lookup
      const normalizedPhone = normalizePhone(phoneNumber);

      // SCOPED CANCEL CONTRACT:
      // Cancel ONLY the queries the optimistic updates below actually
      // write to. The thread messages query (`messagesKeys.messages` /
      // `messagesPaginated`) is INTENTIONALLY excluded — see the same
      // comment block in `useWaMarkAsRead.onMutate` for the full
      // rationale. Latent bug here was masked by the
      // `requestAnimationFrame` refetch workaround in
      // `useMessagesPaginated`; that hack stays in place as defense
      // in depth but the underlying overreach is now fixed at the
      // source.
      await Promise.all([
        queryClient.cancelQueries({ queryKey: messagesKeys.conversations(), exact: false }),
        queryClient.cancelQueries({ queryKey: messagesKeys.unreadCount() }),
        queryClient.cancelQueries({
          queryKey: messagesKeys.unreadConversations(),
          exact: false,
        }),
        queryClient.cancelQueries({ predicate: groupsKeys.unifiedPredicate }),
      ]);

      // Snapshot previous values for rollback
      const previousConversations = queryClient.getQueriesData({
        queryKey: messagesKeys.conversations(),
        exact: false,
      });
      const previousUnified = queryClient.getQueriesData({
        predicate: groupsKeys.unifiedPredicate,
      });
      const previousUnread = queryClient.getQueryData<number>(messagesKeys.unreadCount());
      const previousUnreadList = queryClient.getQueriesData<Conversation[]>({
        queryKey: messagesKeys.unreadConversations(),
        exact: false,
      });

      // SSOT: Find unread count from ALL cache sources
      let unreadToMark = 0;
      let foundInCache = false;

      // Source 1: Check unreadConversations cache FIRST
      const unreadListData = queryClient.getQueriesData<Conversation[]>({
        queryKey: messagesKeys.unreadConversations(),
        exact: false,
      });
      for (const [, conversations] of unreadListData) {
        if (Array.isArray(conversations)) {
          const found = conversations.find(
            (c) => normalizePhone(c.phoneNumber) === normalizedPhone
          );
          if (found) {
            foundInCache = true;
            if (found.unreadCount && found.unreadCount > 0) {
              unreadToMark = found.unreadCount;
              break;
            }
          }
        }
      }

      // Source 2: Check conversations cache
      if (unreadToMark === 0) {
        const conversationsData = queryClient.getQueriesData<PaginatedConversationsResponse>({
          queryKey: messagesKeys.conversations(),
          exact: false,
        });
        for (const [, data] of conversationsData) {
          if (data?.conversations) {
            const found = data.conversations.find(
              (c) => normalizePhone(c.phoneNumber) === normalizedPhone
            );
            if (found) {
              foundInCache = true;
              if (found.unreadCount && found.unreadCount > 0) {
                unreadToMark = found.unreadCount;
                break;
              }
            }
          }
        }
      }

      // Source 3: Check unified conversations cache (messages page + bell icon)
      if (unreadToMark === 0) {
        const unifiedData = queryClient.getQueriesData({
          predicate: groupsKeys.unifiedPredicate,
        });
        for (const [, data] of unifiedData) {
          const flatConversations = readAnyUnifiedConversations(data);
          const found = flatConversations.find(
            (c) => !c.isGroup && c.phoneNumber && normalizePhone(c.phoneNumber) === normalizedPhone
          );
          if (found) {
            foundInCache = true;
            if (found.unreadCount && found.unreadCount > 0) {
              unreadToMark = found.unreadCount;
              break;
            }
          }
        }
      }

      // Source 4: default to 1 if the current unread count suggests unreads
      if (unreadToMark === 0) {
        const currentUnread = typeof previousUnread === 'number' ? previousUnread : 0;
        if (currentUnread > 0) {
          unreadToMark = 1;
        }
      }

      // Now update ALL caches consistently

      // Update 1: Remove from unread conversations list (notification dropdown)
      queryClient.setQueriesData<Conversation[]>(
        { queryKey: messagesKeys.unreadConversations(), exact: false },
        (old) => {
          if (!old || !Array.isArray(old)) return old;
          return old.filter((c) => normalizePhone(c.phoneNumber) !== normalizedPhone);
        }
      );

      // Update 2: Set unreadCount to 0 in conversations cache
      queryClient.setQueriesData<PaginatedConversationsResponse | Conversation[]>(
        { queryKey: messagesKeys.conversations(), exact: false },
        (old) => {
          if (!old) return old;

          if ('conversations' in old && Array.isArray(old.conversations)) {
            return {
              ...old,
              conversations: old.conversations.map((c) =>
                normalizePhone(c.phoneNumber) === normalizedPhone ? { ...c, unreadCount: 0 } : c
              ),
            };
          }

          if (Array.isArray(old)) {
            return old.map((c) =>
              normalizePhone(c.phoneNumber) === normalizedPhone ? { ...c, unreadCount: 0 } : c
            );
          }

          return old;
        }
      );

      // Update 3: Set unreadCount to 0 in unified conversations cache (messages page + bell)
      queryClient.setQueriesData<unknown>(
        { predicate: groupsKeys.unifiedPredicate },
        (old: unknown) =>
          updateAnyUnifiedCache(old, (conversations, total) => ({
            conversations: conversations.map((c) =>
              !c.isGroup && c.phoneNumber && normalizePhone(c.phoneNumber) === normalizedPhone
                ? { ...c, unreadCount: 0 }
                : c
            ),
            total,
          }))
      );

      // Update 4: Mark messages in thread as read
      queryClient.setQueriesData<PaginatedMessagesResponse>(
        { queryKey: ['messages', 'thread', normalizedPhone], exact: false },
        (old) => {
          if (!old?.messages) return old;
          return {
            ...old,
            messages: old.messages.map((m) => ({ ...m, read: true })),
          };
        }
      );

      // Update 5: Decrease global unread count
      queryClient.setQueryData<number>(messagesKeys.unreadCount(), (old) => {
        const current = typeof old === 'number' ? old : 0;
        return Math.max(0, current - unreadToMark);
      });

      return {
        previousConversations,
        previousUnified,
        previousUnread,
        previousUnreadList,
        unreadToMark,
        foundInCache,
      };
    },
    onError: (_err, _phoneNumber, context) => {
      // Rollback all caches on error
      if (context?.previousConversations) {
        context.previousConversations.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
      if (context?.previousUnified) {
        context.previousUnified.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
      if (context?.previousUnread !== undefined) {
        queryClient.setQueryData(messagesKeys.unreadCount(), context.previousUnread);
      }
      if (context?.previousUnreadList) {
        context.previousUnreadList.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
    },
    // No onSettled refetches — optimistic update (onMutate) handles UI instantly,
    // and the WebSocket SMS_READ event handles cross-device/tab sync.
    // Refetching here caused 4 redundant network requests per mark-as-read.
  });
}
