/**
 * WhatsApp Service - Barrel Re-export
 *
 * Re-exports all WhatsApp sub-services and types.
 * Provides `whatsappService` and `whatsappAdminService` singletons.
 */

// Re-export all types
export type {
  WaMessageType,
  WaStatus,
  WaMessage,
  WaConversation,
  WaUsage,
  SendWaMessageRequest,
  WaConversationQueryParams,
  WaMessageQueryParams,
  WaSearchParams,
  PaginatedWaConversationsResponse,
  PaginatedWaMessagesResponse,
  WaMessageWsPayload,
  WaStatusWsPayload,
  WaReactionWsPayload,
  WaReadWsPayload,
  WaDeletedWsPayload,
  WaConversationDeletedWsPayload,
  WaConfigUpdatedWsPayload,
  WaConfig,
  UpdateWaConfigRequest,
  WaPricingConfig,
  UpdateWaPricingRequest,
  WaUsageSummary,
  UserWaUsage,
  WaUsageHistoryEntry,
  WaTemplate,
  CreateWaTemplateRequest,
  EditWaTemplateRequest,
  WaNumber,
} from './whatsapp-types';

// Import sub-module functions
import * as waApi from './whatsapp.api';
import * as waAdminApi from './whatsapp-admin.api';

// Re-import types for method signatures
import type {
  WaConversationQueryParams,
  WaMessageQueryParams,
  WaSearchParams,
  SendWaMessageRequest,
  UpdateWaConfigRequest,
  UpdateWaPricingRequest,
  CreateWaTemplateRequest,
  EditWaTemplateRequest,
} from './whatsapp-types';

// ============================================================
// WhatsAppService Class Facade
// ============================================================

class WhatsAppService {
  getStatus = waApi.getStatus;
  saveEmbeddedSignup = waApi.saveEmbeddedSignup;
  getConversationWindows = waApi.getConversationWindows;
  getConversationWindow = waApi.getConversationWindow;
  getConversationsPaginated = waApi.getConversationsPaginated;
  getConversations = waApi.getConversations;
  getMessages = (phoneNumber: string, params: WaMessageQueryParams = {}) =>
    waApi.getMessages(phoneNumber, params);
  sendMessage = (data: SendWaMessageRequest) => waApi.sendMessage(data);
  uploadMedia = (file: File) => waApi.uploadMedia(file);
  getUnreadCount = waApi.getUnreadCount;
  getUsage = waApi.getUsage;
  markAsRead = waApi.markAsRead;
  searchMessages = (params: WaSearchParams) => waApi.searchMessages(params);
  deleteConversation = waApi.deleteConversation;
  deleteMessages = waApi.deleteMessages;
}

export const whatsappService = new WhatsAppService();

// ============================================================
// WhatsAppAdminService Class Facade
// ============================================================

class WhatsAppAdminService {
  getConfig = waAdminApi.getConfig;
  updateConfig = (data: UpdateWaConfigRequest) => waAdminApi.updateConfig(data);
  getPricing = waAdminApi.getPricing;
  updatePricing = (data: UpdateWaPricingRequest) => waAdminApi.updatePricing(data);
  getUsageSummary = waAdminApi.getUsageSummary;
  getUserUsageStats = waAdminApi.getUserUsageStats;
  resetCounters = waAdminApi.resetCounters;
  getUserHistory = waAdminApi.getUserHistory;
  getUserLimit = waAdminApi.getUserLimit;
  updateUserLimit = waAdminApi.updateUserLimit;
  getTemplates = waAdminApi.getTemplates;
  refreshTemplates = waAdminApi.refreshTemplates;
  createTemplate = (data: CreateWaTemplateRequest) => waAdminApi.createTemplate(data);
  editTemplate = (templateId: string, data: EditWaTemplateRequest) =>
    waAdminApi.editTemplate(templateId, data);
  deleteTemplate = (templateName: string) => waAdminApi.deleteTemplate(templateName);
  getNumbers = waAdminApi.getNumbers;
  syncNumbers = waAdminApi.syncNumbers;
  assignNumber = waAdminApi.assignNumber;
  getUserWaEnabled = waAdminApi.getUserWaEnabled;
  setUserWaEnabled = waAdminApi.setUserWaEnabled;
}

export const whatsappAdminService = new WhatsAppAdminService();
