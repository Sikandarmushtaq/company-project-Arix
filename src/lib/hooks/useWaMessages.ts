'use client';

/**
 * WhatsApp Messages Hook (Orchestrator)
 *
 * Re-exports all WhatsApp message-related hooks from sub-modules:
 * - useWaConversationQueries: Status, conversation list, unread, windows, templates
 * - useWaMessageQueries: Message fetching for specific conversations
 * - useWaMessageMutations: Send, delete, mark-as-read mutations
 *
 * Also defines the SSOT waMessagesKeys for cache key management.
 *
 * @module lib/hooks/useWaMessages
 */

import type { WaConversationQueryParams, WaMessageQueryParams, WaSearchParams } from '@/lib/api';
import { normalizePhone } from '@/lib/utils/phone';

/**
 * Query keys for WhatsApp messages - SSOT Phone Normalization
 *
 * CRITICAL: All phone-based keys use normalizePhone (11 digits)
 * This ensures cache hits regardless of phone format variations.
 *
 * @see lib/utils/phone.ts for normalization logic
 */
export const waMessagesKeys = {
  all: ['wa-messages'] as const,
  status: () => [...waMessagesKeys.all, 'status'] as const,
  conversations: () => [...waMessagesKeys.all, 'conversations'] as const,
  conversationsPaginated: (params: WaConversationQueryParams) =>
    [...waMessagesKeys.all, 'conversations', params] as const,
  // Use normalized 11-digit format for thread cache keys
  messages: (phoneNumber: string) =>
    [...waMessagesKeys.all, 'thread', normalizePhone(phoneNumber)] as const,
  messagesPaginated: (phoneNumber: string, params: WaMessageQueryParams) =>
    [...waMessagesKeys.all, 'thread', normalizePhone(phoneNumber), params] as const,
  // Global search across all WA conversations
  search: (params: WaSearchParams) => [...waMessagesKeys.all, 'search', params] as const,
  unreadCount: () => [...waMessagesKeys.all, 'unread'] as const,
  windows: () => [...waMessagesKeys.all, 'windows'] as const,
  window: (phoneNumber: string) =>
    [...waMessagesKeys.all, 'window', normalizePhone(phoneNumber)] as const,
  templates: () => [...waMessagesKeys.all, 'templates'] as const,
  usage: () => [...waMessagesKeys.all, 'usage'] as const,
};

// Re-export conversation queries
export {
  useWaStatus,
  useWaConversationsPaginated,
  useWaConversationsInfinite,
  useWaUnreadCount,
  useWaConversationWindows,
  useWaConversationWindow,
  useWaTemplates,
} from './useWaConversationQueries';

// Re-export message queries
export { useWaMessagesInfinite, useWaSearchMessages } from './useWaMessageQueries';

// Re-export message mutations
export {
  useWaSendMessage,
  useWaSendTemplate,
  useWaDeleteMessages,
  useWaDeleteConversation,
  useWaMarkAsRead,
  updateWaConversationsCache,
  prependWaMessage,
  replaceWaMessage,
  replaceOrPrependWaMessage,
  removeWaMessages,
  mapWaMessages,
  coerceWaMessage,
} from './useWaMessageMutations';
