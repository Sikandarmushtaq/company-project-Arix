/**
 * SMS Group API Service
 * Group messaging operations
 */

import { apiClient } from '../client';
import type { ApiResponse } from '@/lib/types';
import type {
  Message,
  SmsGroup,
  SmsGroupMember,
  SmsGroupWithMembers,
  UnifiedConversation,
  CreateGroupRequest,
  UpdateGroupRequest,
  AddMembersRequest,
  SendGroupMessageRequest,
  GroupMessageResult,
  PaginatedGroupsResponse,
  PaginatedUnifiedConversationsResponse,
  PaginatedMessagesResponse,
} from './sms-types';

// ============================================================
// Group API Methods
// ============================================================

/**
 * Get unified conversations (direct + groups)
 */
export async function getUnifiedConversations(
  params: { page?: number; limit?: number; search?: string } = {}
): Promise<PaginatedUnifiedConversationsResponse> {
  const response = await apiClient.get<
    ApiResponse<{
      conversations: UnifiedConversation[];
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    }>
  >('/sms/unified', {
    params: {
      page: params.page || 1,
      limit: params.limit || 50,
      ...(params.search ? { search: params.search } : {}),
    },
  });
  return response.data;
}

/**
 * Get user's groups
 */
export async function getGroups(
  params: { page?: number; limit?: number; includeArchived?: boolean } = {}
): Promise<PaginatedGroupsResponse> {
  const response = await apiClient.get<
    ApiResponse<{
      groups: SmsGroup[];
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    }>
  >('/sms/groups', {
    params: {
      page: params.page || 1,
      limit: params.limit || 50,
      includeArchived: params.includeArchived || false,
    },
  });
  return response.data;
}

/**
 * Create a new group
 */
export async function createGroup(data: CreateGroupRequest): Promise<SmsGroupWithMembers> {
  const response = await apiClient.post<ApiResponse<SmsGroupWithMembers>>('/sms/groups', data);
  return response.data;
}

/**
 * Get group details with members
 */
export async function getGroup(groupId: number): Promise<SmsGroupWithMembers> {
  const response = await apiClient.get<ApiResponse<SmsGroupWithMembers>>(`/sms/groups/${groupId}`);
  return response.data;
}

/**
 * Update group details
 */
export async function updateGroup(groupId: number, data: UpdateGroupRequest): Promise<SmsGroup> {
  const response = await apiClient.put<ApiResponse<SmsGroup>>(`/sms/groups/${groupId}`, data);
  return response.data;
}

/**
 * Archive/delete a group
 */
export async function deleteGroup(groupId: number): Promise<void> {
  await apiClient.delete(`/sms/groups/${groupId}`);
}

/**
 * Get group messages
 */
export async function getGroupMessages(
  groupId: number,
  params: { page?: number; limit?: number } = {}
): Promise<PaginatedMessagesResponse> {
  const response = await apiClient.get<
    ApiResponse<{
      messages: Message[];
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    }>
  >(`/sms/groups/${groupId}/messages`, {
    params: {
      page: params.page || 1,
      limit: params.limit || 100,
    },
  });
  return response.data;
}

/**
 * Send message to group
 */
export async function sendGroupMessage(
  groupId: number,
  data: SendGroupMessageRequest
): Promise<GroupMessageResult> {
  const response = await apiClient.post<ApiResponse<GroupMessageResult>>(
    `/sms/groups/${groupId}/send`,
    data
  );
  return response.data;
}

/**
 * Mark group messages as read
 */
export async function markGroupAsRead(groupId: number): Promise<void> {
  await apiClient.post(`/sms/groups/${groupId}/mark-read`);
}

/**
 * Add members to group
 */
export async function addMembers(
  groupId: number,
  data: AddMembersRequest
): Promise<SmsGroupMember[]> {
  const response = await apiClient.post<ApiResponse<{ members: SmsGroupMember[] }>>(
    `/sms/groups/${groupId}/members`,
    data
  );
  return response.data.members;
}

/**
 * Remove member from group
 */
export async function removeMember(groupId: number, phoneNumber: string): Promise<void> {
  await apiClient.delete(`/sms/groups/${groupId}/members/${encodeURIComponent(phoneNumber)}`);
}

/**
 * Check if phone numbers are in groups with the user
 * Returns a map of phone number -> group info
 */
export async function checkMemberships(
  phoneNumbers: string[]
): Promise<Record<string, { groupId: number; groupName: string; groupUuid: string }>> {
  const response = await apiClient.post<
    ApiResponse<Record<string, { groupId: number; groupName: string; groupUuid: string }>>
  >('/sms/groups/check-memberships', { phoneNumbers });
  return response.data;
}

/**
 * Check if a conversation is in a group
 * Returns group info if the contact is in a group, null otherwise
 */
export async function checkConversationStatus(
  phoneNumber: string
): Promise<{ inGroup: boolean; groupId?: number; groupName?: string; groupUuid?: string }> {
  const response = await apiClient.get<
    ApiResponse<{ inGroup: boolean; groupId?: number; groupName?: string; groupUuid?: string }>
  >(`/sms/groups/conversation-status/${encodeURIComponent(phoneNumber)}`);
  return response.data;
}

/**
 * Get total unread count across all groups
 */
export async function getGroupUnreadCount(): Promise<number> {
  const response = await apiClient.get<ApiResponse<{ unreadCount: number }>>(
    '/sms/groups/unread-count'
  );
  return response.data.unreadCount;
}
