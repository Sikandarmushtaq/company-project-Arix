'use client';

/**
 * Conversation Query Hooks
 *
 * Handles fetching conversation lists and unread counts:
 * - useConversations (legacy)
 * - useConversationsPaginated
 * - useUnreadMessageCount
 * - useUnreadConversations
 *
 * @module lib/hooks/useConversationQueries
 */

import { useQuery } from '@tanstack/react-query';
import { smsService, type ConversationQueryParams } from '@/lib/api';
import { REALTIME_QUERY_CONFIG } from '@/lib/constants/query';
import { messagesKeys } from './useMessages';

/**
 * Hook to fetch conversations with pagination
 * Uses real-time config - data updated via WebSocket events
 */
export function useConversationsPaginated(params: ConversationQueryParams = {}) {
  return useQuery({
    queryKey: messagesKeys.conversationsPaginated(params),
    queryFn: () => smsService.getConversationsPaginated(params),
    ...REALTIME_QUERY_CONFIG,
  });
}

/**
 * Hook to fetch conversations (legacy - no pagination)
 * @deprecated Use useConversationsPaginated for better performance
 */
export function useConversations() {
  return useQuery({
    queryKey: messagesKeys.conversations(),
    queryFn: () => smsService.getConversations(),
    ...REALTIME_QUERY_CONFIG,
  });
}

/**
 * Hook to fetch unread message count
 * Uses real-time config - count updated via WebSocket events
 */
export function useUnreadMessageCount() {
  return useQuery({
    queryKey: messagesKeys.unreadCount(),
    queryFn: () => smsService.getUnreadCount(),
    ...REALTIME_QUERY_CONFIG,
  });
}

/**
 * Hook to fetch recent unread conversations for notifications dropdown
 * Uses real-time config - data updated via WebSocket events
 */
export function useUnreadConversations(limit: number = 5) {
  return useQuery({
    queryKey: messagesKeys.unreadConversations(limit),
    queryFn: () => smsService.getUnreadConversations(limit),
    ...REALTIME_QUERY_CONFIG,
  });
}
