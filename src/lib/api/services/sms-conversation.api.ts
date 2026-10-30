/**
 * SMS Conversation API Service
 * Conversation/thread queries and operations
 */

import { apiClient } from '../client';
import type { ApiResponse } from '@/lib/types';
import type {
  Conversation,
  ConversationQueryParams,
  PaginatedConversationsResponse,
} from './sms-types';

// ============================================================
// Conversation API Methods
// ============================================================

/**
 * Get conversations with pagination
 * Backend returns: { success: true, data: { threads: [...], total, page, limit, totalPages } }
 */
export async function getConversationsPaginated(
  params: ConversationQueryParams = {}
): Promise<PaginatedConversationsResponse> {
  const response = await apiClient.get<
    ApiResponse<{
      threads: Conversation[];
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    }>
  >('/sms/conversations', {
    params: {
      page: params.page || 1,
      limit: params.limit || 20,
      ...(params.search ? { search: params.search } : {}),
    },
  });
  return {
    conversations: response.data.threads,
    total: response.data.total || response.data.threads.length,
    page: response.data.page || params.page || 1,
    limit: response.data.limit || params.limit || 20,
    totalPages:
      response.data.totalPages ||
      Math.ceil((response.data.total || response.data.threads.length) / (params.limit || 20)),
  };
}

/**
 * Get all conversations (legacy - no pagination)
 * @deprecated Use getConversationsPaginated instead
 */
export async function getConversations(): Promise<Conversation[]> {
  const response = await getConversationsPaginated({ limit: 1000 });
  return response.conversations;
}

/**
 * Get unread message count
 * Backend returns: { success: true, data: { unreadCount: number } }
 */
export async function getUnreadCount(): Promise<number> {
  const response = await apiClient.get<ApiResponse<{ unreadCount: number }>>('/sms/unread-count');
  return response.data.unreadCount;
}

/**
 * Get recent unread conversations for notifications dropdown
 * Backend returns: { success: true, data: { conversations: [...] } }
 */
export async function getUnreadConversations(limit: number = 5): Promise<Conversation[]> {
  const response = await apiClient.get<ApiResponse<{ conversations: Conversation[] }>>(
    '/sms/unread',
    { params: { limit } }
  );
  return response.data.conversations;
}

/**
 * Mark messages as read
 */
export async function markAsRead(phoneNumber: string): Promise<void> {
  await apiClient.post('/sms/mark-read', { phoneNumber });
}

/**
 * Mark a conversation as unread (chat opened by mistake). Flips the latest
 * inbound message back to unread server-side.
 */
export async function markAsUnread(phoneNumber: string): Promise<void> {
  await apiClient.post('/sms/mark-unread', { phoneNumber });
}

/**
 * Delete a conversation
 */
export async function deleteConversation(phoneNumber: string): Promise<void> {
  await apiClient.delete(`/sms/conversations/${encodeURIComponent(phoneNumber)}`);
}
