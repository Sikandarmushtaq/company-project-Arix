/**
 * WhatsApp API Service
 * Conversation and message operations
 */

import { apiClient } from '../client';
import type { ApiResponse } from '@/lib/types';
import type {
  WaConversation,
  WaMessage,
  WaUsage,
  WaConversationQueryParams,
  WaMessageQueryParams,
  WaSearchParams,
  SendWaMessageRequest,
  PaginatedWaConversationsResponse,
  PaginatedWaMessagesResponse,
} from './whatsapp-types';

// ============================================================
// Status & Embedded Signup
// ============================================================

export interface WaUserStatus {
  waEnabled: boolean;
  configured: boolean;
  organizationId: number | null;
  /**
   * The WhatsApp Business number assigned to this user, if any. Surfaced in
   * the global PhoneSelector dropdown and on /phone/settings so users can
   * see which number their outgoing WhatsApp messages are sent from.
   * Null when no number is assigned (or when WA is disabled for the user).
   */
  assignedNumber: { displayPhone: string; verifiedName: string | null } | null;
}

export async function getStatus(): Promise<WaUserStatus> {
  const response = await apiClient.get<ApiResponse<WaUserStatus>>('/whatsapp/status');
  return response.data;
}

/**
 * WhatsApp manager-oversight feature flags, scoped to the calling user's
 * organization. Server derives orgId from session — clients can't peek
 * into another org's flags.
 *
 * Closed by default (all false) for orgs that haven't opted in. Used to
 * gate manager UI affordances (Watch button, typing badges) and agent
 * emit hooks (skip work if no one can subscribe).
 */
export interface WaFeatureFlags {
  typingIndicators: boolean;
  liveWatch: boolean;
  customerTypingIndicator: boolean;
}

export async function getFeatureFlags(): Promise<WaFeatureFlags> {
  const response = await apiClient.get<ApiResponse<WaFeatureFlags>>('/whatsapp/feature-flags');
  return response.data;
}

// ============================================================
// Manager Oversight
// ============================================================

/**
 * One conversation row on the manager oversight page. Mirrors the
 * backend `WaOversightConversation` 1:1. The `agent*` fields tell the
 * manager who's handling each conversation — null when the WA number's
 * `assigned_user_id` is currently unset.
 */
export interface WaOversightConversation {
  customerPhone: string;
  contactName: string | null;
  lastMessage: string | null;
  lastMessageType: string;
  lastMessageTime: string;
  unreadCount: number;
  agentPhone: string | null;
  agentUserId: number | null;
  agentFullName: string | null;
}

export interface WaOversightAgent {
  userId: number;
  fullName: string | null;
  agentPhone: string;
}

export interface WaOversightConversationsParams {
  page?: number;
  limit?: number;
  search?: string;
  agentUserId?: number;
  unreadOnly?: boolean;
  /** Admins only — managers' org is locked to their session. */
  orgId?: number;
}

export interface WaOversightConversationsResponse {
  conversations: WaOversightConversation[];
  total: number;
  page: number;
  limit: number;
}

export async function getOversightConversations(
  params: WaOversightConversationsParams = {}
): Promise<WaOversightConversationsResponse> {
  const response = await apiClient.get<ApiResponse<WaOversightConversationsResponse>>(
    '/whatsapp/oversight/conversations',
    {
      params: {
        page: params.page ?? 1,
        limit: params.limit ?? 50,
        ...(params.search ? { search: params.search } : {}),
        ...(typeof params.agentUserId === 'number' ? { agentUserId: params.agentUserId } : {}),
        ...(params.unreadOnly ? { unreadOnly: true } : {}),
        ...(typeof params.orgId === 'number' ? { orgId: params.orgId } : {}),
      },
    }
  );
  return response.data;
}

export interface WaOversightMessagesParams {
  /** ISO timestamp — return messages strictly older than this. */
  before?: string;
  limit?: number;
  search?: string;
  orgId?: number;
}

export interface WaOversightMessagesResponse {
  messages: WaMessage[];
  total: number;
}

export async function getOversightMessages(
  customerPhone: string,
  params: WaOversightMessagesParams = {}
): Promise<WaOversightMessagesResponse> {
  const response = await apiClient.get<ApiResponse<WaOversightMessagesResponse>>(
    `/whatsapp/oversight/conversations/${encodeURIComponent(customerPhone)}/messages`,
    {
      params: {
        limit: params.limit ?? 100,
        ...(params.before ? { before: params.before } : {}),
        ...(params.search ? { search: params.search } : {}),
        ...(typeof params.orgId === 'number' ? { orgId: params.orgId } : {}),
      },
    }
  );
  return response.data;
}

export async function getOversightAgents(orgId?: number): Promise<WaOversightAgent[]> {
  const response = await apiClient.get<ApiResponse<WaOversightAgent[]>>(
    '/whatsapp/oversight/agents',
    {
      params: typeof orgId === 'number' ? { orgId } : undefined,
    }
  );
  return response.data;
}

export async function saveEmbeddedSignup(data: {
  accessToken: string;
  phoneNumberId: string;
  wabaId: string;
  displayPhone?: string;
}): Promise<{ configured: boolean }> {
  const response = await apiClient.post<ApiResponse<{ configured: boolean }>>(
    '/whatsapp/embedded-signup',
    data
  );
  return response.data;
}

// ============================================================
// Conversation Windows (24h countdown)
// ============================================================

export interface ConversationWindow {
  contactPhone: string;
  windowEnd: string;
  category: string;
}

export async function getConversationWindows(): Promise<ConversationWindow[]> {
  const response = await apiClient.get<ApiResponse<ConversationWindow[]>>(
    '/whatsapp/conversation-windows'
  );
  return response.data;
}

export async function getConversationWindow(
  phoneNumber: string
): Promise<ConversationWindow | null> {
  const response = await apiClient.get<ApiResponse<ConversationWindow | null>>(
    `/whatsapp/conversation-window/${encodeURIComponent(phoneNumber)}`
  );
  return response.data;
}

// ============================================================
// Conversations
// ============================================================

export async function getConversationsPaginated(
  params: WaConversationQueryParams = {}
): Promise<PaginatedWaConversationsResponse> {
  const response = await apiClient.get<
    ApiResponse<{
      threads: WaConversation[];
      total: number;
    }>
  >('/whatsapp/conversations', {
    params: {
      page: params.page || 1,
      limit: params.limit || 20,
      ...(params.search ? { search: params.search } : {}),
    },
  });
  const limit = params.limit || 20;
  return {
    conversations: response.data.threads,
    total: response.data.total || response.data.threads.length,
    page: params.page || 1,
    limit,
    totalPages: Math.ceil((response.data.total || response.data.threads.length) / limit),
  };
}

export async function getConversations(): Promise<WaConversation[]> {
  const response = await getConversationsPaginated({ limit: 1000 });
  return response.conversations;
}

export async function getUnreadCount(): Promise<number> {
  const response =
    await apiClient.get<ApiResponse<{ unreadCount: number }>>('/whatsapp/unread-count');
  return response.data.unreadCount;
}

// ============================================================
// Messages
// ============================================================

export async function getMessages(
  phoneNumber: string,
  params: WaMessageQueryParams = {}
): Promise<PaginatedWaMessagesResponse> {
  const response = await apiClient.get<ApiResponse<{ messages: WaMessage[]; total: number }>>(
    `/whatsapp/messages/${encodeURIComponent(phoneNumber)}`,
    {
      params: {
        page: params.page || 1,
        limit: params.limit || 100,
        ...(params.before ? { before: params.before } : {}),
        ...(params.search ? { search: params.search } : {}),
      },
    }
  );
  return response.data;
}

export async function sendMessage(data: SendWaMessageRequest): Promise<WaMessage> {
  const response = await apiClient.post<ApiResponse<WaMessage>>('/whatsapp/send', data);
  return response.data;
}

/**
 * Upload a media file for WhatsApp send.
 *
 * Meta-recommended pipeline: the backend validates the file (magic bytes,
 * per-MIME size, sticker rules), forwards it to Meta's resumable upload
 * endpoint (`POST /{phone-number-id}/media`) to mint a media_id, and
 * saves a local copy so we can render the outbound bubble in our own UI.
 *
 * Returns both `mediaId` (the canonical value sent to Meta in the
 * subsequent `/whatsapp/send` call) and `mediaUrl` (used only for the
 * local chat-thread preview).
 */
export interface WaUploadedMedia {
  mediaId: string;
  mediaUrl: string;
  mimeType: string;
  filename: string;
  size: number;
}

export async function uploadMedia(file: File): Promise<WaUploadedMedia> {
  const formData = new FormData();
  formData.append('files', file);
  const response = await apiClient.upload<ApiResponse<WaUploadedMedia>>(
    '/whatsapp/media',
    formData
  );
  return response.data;
}

export async function markAsRead(phoneNumber: string): Promise<{ markedCount: number }> {
  const response = await apiClient.post<ApiResponse<{ markedCount: number }>>(
    '/whatsapp/mark-read',
    { phoneNumber }
  );
  return response.data;
}

export async function deleteMessages(ids: number[]): Promise<{ deletedCount: number }> {
  const response = await apiClient.delete<ApiResponse<{ deletedCount: number }>>(
    `/whatsapp/messages?ids=${ids.join(',')}`
  );
  return response.data;
}

export async function deleteConversation(phoneNumber: string): Promise<{ deletedCount: number }> {
  const response = await apiClient.delete<ApiResponse<{ deletedCount: number }>>(
    `/whatsapp/conversations/${encodeURIComponent(phoneNumber)}`
  );
  return response.data;
}

export async function searchMessages(
  params: WaSearchParams
): Promise<{ messages: WaMessage[]; total: number }> {
  const response = await apiClient.get<ApiResponse<{ messages: WaMessage[]; total: number }>>(
    '/whatsapp/search',
    {
      params: {
        q: params.q,
        page: params.page || 1,
        limit: params.limit || 50,
      },
    }
  );
  return response.data;
}

// ============================================================
// Templates (user-facing, approved only)
// ============================================================

export async function getApprovedTemplates(): Promise<
  Array<{
    templateId: string;
    name: string;
    language: string;
    category: string;
    status: string;
    components: Record<string, unknown>[] | null;
    cachedAt: string;
  }>
> {
  const response = await apiClient.get<
    ApiResponse<
      Array<{
        templateId: string;
        name: string;
        language: string;
        category: string;
        status: string;
        components: Record<string, unknown>[] | null;
        cachedAt: string;
      }>
    >
  >('/whatsapp/templates');
  return response.data;
}

// ============================================================
// Usage
// ============================================================

export async function getUsage(): Promise<WaUsage> {
  const response = await apiClient.get<ApiResponse<WaUsage>>('/whatsapp/usage');
  return response.data;
}
