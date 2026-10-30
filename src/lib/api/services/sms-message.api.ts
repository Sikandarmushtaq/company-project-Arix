/**
 * SMS Message API Service
 * Message operations: send, get, search, delete
 */

import { apiClient } from '../client';
import type { ApiResponse } from '@/lib/types';
import type {
  Message,
  SendSmsRequest,
  MessageQueryParams,
  SearchMessagesParams,
  PaginatedMessagesResponse,
} from './sms-types';

// ============================================================
// Message API Methods
// ============================================================

/**
 * Get messages in a conversation with pagination
 * Supports search within conversation with ?search= param
 * Backend returns: { success: true, data: { messages: [...], total, page, limit, totalPages } }
 */
export async function getMessagesPaginated(
  phoneNumber: string,
  params: MessageQueryParams = {}
): Promise<PaginatedMessagesResponse> {
  const response = await apiClient.get<
    ApiResponse<{
      messages: Message[];
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    }>
  >(`/sms/messages/${encodeURIComponent(phoneNumber)}`, {
    params: {
      page: params.page || 1,
      limit: params.limit || 50,
      ...(params.search ? { search: params.search } : {}),
    },
  });
  return {
    messages: response.data.messages,
    total: response.data.total || response.data.messages.length,
    page: response.data.page || params.page || 1,
    limit: response.data.limit || params.limit || 50,
    totalPages:
      response.data.totalPages ||
      Math.ceil((response.data.total || response.data.messages.length) / (params.limit || 50)),
  };
}

/**
 * Get messages in a conversation (legacy - no pagination)
 * @deprecated Use getMessagesPaginated instead
 */
export async function getMessages(phoneNumber: string, page = 1, limit = 50): Promise<Message[]> {
  const response = await getMessagesPaginated(phoneNumber, { page, limit });
  return response.messages;
}

/**
 * Send an SMS
 */
export async function sendSms(data: SendSmsRequest): Promise<Message> {
  const response = await apiClient.post<ApiResponse<Message>>('/sms/send', data);
  return response.data;
}

/**
 * Search messages globally across all conversations
 * Backend returns: { success: true, data: { messages: [...], total, page, limit, totalPages } }
 */
export async function searchMessages(
  params: SearchMessagesParams
): Promise<PaginatedMessagesResponse> {
  const response = await apiClient.get<
    ApiResponse<{
      messages: Message[];
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    }>
  >('/sms/search', {
    params: {
      q: params.q,
      page: params.page || 1,
      limit: params.limit || 50,
    },
  });
  return {
    messages: response.data.messages,
    total: response.data.total || response.data.messages.length,
    page: response.data.page || params.page || 1,
    limit: response.data.limit || params.limit || 50,
    totalPages:
      response.data.totalPages ||
      Math.ceil((response.data.total || response.data.messages.length) / (params.limit || 50)),
  };
}

/**
 * Delete messages
 */
export async function deleteMessages(messageIds: number[]): Promise<void> {
  await apiClient.delete('/sms/messages', { params: { ids: messageIds.join(',') } });
}
