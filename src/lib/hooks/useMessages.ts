'use client';

/**
 * Messages Hook (Orchestrator)
 *
 * Re-exports all message-related hooks from sub-modules:
 * - useConversationQueries: Conversation list fetching and unread counts
 * - useMessageQueries: Message fetching for specific conversations
 * - useMessageMutations: Send, delete, mark-as-read mutations
 *
 * Also defines the SSOT messagesKeys for cache key management.
 *
 * @module lib/hooks/useMessages
 */

import type { ConversationQueryParams, MessageQueryParams, SearchMessagesParams } from '@/lib/api';
import { normalizePhone } from '@/lib/utils/phone';

/**
 * Query keys for messages - SSOT Phone Normalization
 *
 * CRITICAL: All phone-based keys use normalizePhone (11 digits)
 * This ensures cache hits regardless of phone format variations:
 * - +12164281997 → 12164281997
 * - 12164281997 → 12164281997
 * - 2164281997 → 12164281997
 *
 * @see lib/utils/phone.ts for normalization logic
 */
export const messagesKeys = {
  all: ['messages'] as const,
  conversations: () => [...messagesKeys.all, 'conversations'] as const,
  conversationsPaginated: (params: ConversationQueryParams) =>
    [...messagesKeys.all, 'conversations', params] as const,
  // Use normalized 11-digit format for thread cache keys
  messages: (phoneNumber: string) =>
    [...messagesKeys.all, 'thread', normalizePhone(phoneNumber)] as const,
  messagesPaginated: (phoneNumber: string, params: MessageQueryParams) =>
    [...messagesKeys.all, 'thread', normalizePhone(phoneNumber), params] as const,
  // Global search across all conversations
  search: (params: SearchMessagesParams) => [...messagesKeys.all, 'search', params] as const,
  unreadCount: () => [...messagesKeys.all, 'unread'] as const,
  unreadConversations: (limit?: number) => [...messagesKeys.all, 'unread-list', limit] as const,
};

// Re-export conversation queries
export {
  useConversations,
  useConversationsPaginated,
  useUnreadMessageCount,
  useUnreadConversations,
} from './useConversationQueries';

// Re-export message queries
// Note: useMessagesLegacy is re-exported as useMessages to preserve the public API
export { useMessagesPaginated, useSearchMessages } from './useMessageQueries';
export { useMessagesLegacy as useMessages } from './useMessageQueries';

// Re-export message mutations
export {
  useSendMessage,
  useDeleteConversation,
  useDeleteConversations,
  useDeleteMessages,
  useMarkMessagesAsRead,
  useMarkConversationUnread,
} from './useMessageMutations';
