/**
 * SMS Service - Barrel Re-export
 *
 * Re-exports all SMS sub-services and types.
 * Preserves the `smsService`, `smsGroupService`, and `smsAdminService` singletons
 * for backward compatibility.
 */

// Re-export all types from the shared types module
export type {
  Message,
  Conversation,
  SmsUsage,
  SendSmsRequest,
  ConversationQueryParams,
  MessageQueryParams,
  SearchMessagesParams,
  PaginatedConversationsResponse,
  PaginatedMessagesResponse,
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
  SmsPricingConfig,
  SmsUsageSummary,
  UserSmsUsage,
  SmsUsageHistoryEntry,
  UpdateSmsPricingRequest,
} from './sms-types';

// Re-export Twilio bill types defined in sms-usage.api
export type { TwilioBill, TwilioBillMessage } from './sms-usage.api';

// Import sub-module functions for class facades
import * as conversationApi from './sms-conversation.api';
import * as messageApi from './sms-message.api';
import * as usageApi from './sms-usage.api';
import * as groupApi from './sms-group.api';

// Re-import types for method signatures
import type {
  ConversationQueryParams,
  MessageQueryParams,
  SearchMessagesParams,
  SendSmsRequest,
  CreateGroupRequest,
  UpdateGroupRequest,
  AddMembersRequest,
  SendGroupMessageRequest,
  UpdateSmsPricingRequest,
} from './sms-types';

// ============================================================
// SmsService Class Facade (backward compatibility)
// ============================================================

class SmsService {
  getConversationsPaginated = conversationApi.getConversationsPaginated;
  getConversations = conversationApi.getConversations;
  getMessagesPaginated = (phoneNumber: string, params: MessageQueryParams = {}) =>
    messageApi.getMessagesPaginated(phoneNumber, params);
  getMessages = (phoneNumber: string, page = 1, limit = 50) =>
    messageApi.getMessages(phoneNumber, page, limit);
  sendSms = (data: SendSmsRequest) => messageApi.sendSms(data);
  getUnreadCount = conversationApi.getUnreadCount;
  getUnreadConversations = conversationApi.getUnreadConversations;
  getUsage = usageApi.getUsage;
  markAsRead = conversationApi.markAsRead;
  markAsUnread = conversationApi.markAsUnread;
  searchMessages = (params: SearchMessagesParams) => messageApi.searchMessages(params);
  deleteConversation = conversationApi.deleteConversation;
  deleteMessages = messageApi.deleteMessages;
}

export const smsService = new SmsService();

// ============================================================
// SmsGroupService Class Facade (backward compatibility)
// ============================================================

class SmsGroupService {
  getUnifiedConversations = groupApi.getUnifiedConversations;
  getGroups = groupApi.getGroups;
  createGroup = (data: CreateGroupRequest) => groupApi.createGroup(data);
  getGroup = groupApi.getGroup;
  updateGroup = (groupId: number, data: UpdateGroupRequest) => groupApi.updateGroup(groupId, data);
  deleteGroup = groupApi.deleteGroup;
  getGroupMessages = groupApi.getGroupMessages;
  sendGroupMessage = (groupId: number, data: SendGroupMessageRequest) =>
    groupApi.sendGroupMessage(groupId, data);
  markGroupAsRead = groupApi.markGroupAsRead;
  addMembers = (groupId: number, data: AddMembersRequest) => groupApi.addMembers(groupId, data);
  removeMember = groupApi.removeMember;
  checkMemberships = groupApi.checkMemberships;
  checkConversationStatus = groupApi.checkConversationStatus;
  getGroupUnreadCount = groupApi.getGroupUnreadCount;
}

export const smsGroupService = new SmsGroupService();

// ============================================================
// SmsAdminService Class Facade (backward compatibility)
// ============================================================

class SmsAdminService {
  getPricing = usageApi.getPricing;
  updatePricing = (data: UpdateSmsPricingRequest) => usageApi.updatePricing(data);
  getUsageSummary = usageApi.getUsageSummary;
  getUserUsageStats = usageApi.getUserUsageStats;
  resetCounters = usageApi.resetCounters;
  getUserHistory = usageApi.getUserHistory;
  getUserLimit = usageApi.getUserLimit;
  updateUserLimit = usageApi.updateUserLimit;
  getTwilioBill = usageApi.getTwilioBill;
  downloadTwilioBillCsv = usageApi.downloadTwilioBillCsv;
}

export const smsAdminService = new SmsAdminService();
