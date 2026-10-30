/**
 * WhatsApp Types
 * Shared type definitions for all WhatsApp sub-services
 */

// ============================================================
// Core Message & Conversation Types
// ============================================================

export type WaMessageType =
  | 'text'
  | 'image'
  | 'video'
  | 'audio'
  | 'document'
  | 'sticker'
  | 'location'
  | 'contacts'
  | 'reaction'
  | 'interactive'
  | 'template'
  | 'button'
  // Synthetic — inserted by the backend whatsapp-calling service when a call
  // ends so the chat thread shows a WhatsApp-style call entry inline.
  // Rendered as a centered pill in WaMessageBubble (no left/right alignment).
  | 'call_log'
  | 'unknown';

export type WaStatus = 'pending' | 'sent' | 'delivered' | 'read' | 'failed';

/**
 * WhatsApp Message - matches backend WaMessage (camelCase)
 */
export interface WaMessage {
  id: number;
  waMessageId: string | null;
  sender: string;
  receiver: string;
  direction: 'inbound' | 'outbound';
  messageType: WaMessageType;
  body: string | null;
  mediaId: string | null;
  mediaUrl: string | null;
  mediaMimeType: string | null;
  mediaFilename: string | null;
  latitude: number | null;
  longitude: number | null;
  locationName: string | null;
  locationAddress: string | null;
  templateName: string | null;
  templateLanguage: string | null;
  reactionEmoji: string | null;
  reactionMessageId: string | null;
  contextMessageId: string | null;
  interactiveType: string | null;
  interactiveData: Record<string, unknown> | null;
  status: WaStatus;
  failureReason: string | null;
  errorCode: string | null;
  readByUser: boolean;
  organizationId: number | null;
  userPhone: string | null;
  conversationCategory: string | null;
  costCents: number;
  sentAt: string | null;
  deliveredAt: string | null;
  readAt: string | null;
  failedAt: string | null;
  createdAt: string;
  updatedAt: string;
  // Optionally attached by backend
  contactName?: string | null;
}

/**
 * WhatsApp Conversation/Thread
 */
export interface WaConversation {
  phoneNumber: string;
  lastMessage: string | null;
  lastMessageType: WaMessageType;
  lastMessageTime: string;
  unreadCount: number;
  contactName: string | null;
}

/**
 * WhatsApp usage
 */
export interface WaUsage {
  sent: number;
  limit: number;
  remaining: number;
}

/**
 * Send WhatsApp message request
 */
export interface SendWaMessageRequest {
  to: string;
  type?: WaMessageType;
  body?: string;
  // Meta media_id from POST /whatsapp/media (preferred). Sent to Meta as
  // `{ image: { id: mediaId } }` — Meta's recommended resumable-upload path.
  mediaId?: string;
  // Public HTTPS URL fallback for legacy link-based sends.
  mediaUrl?: string;
  mediaFilename?: string;
  caption?: string;
  latitude?: number;
  longitude?: number;
  locationName?: string;
  locationAddress?: string;
  templateName?: string;
  templateLanguage?: string;
  templateComponents?: Record<string, unknown>[];
  reactionEmoji?: string;
  reactionMessageId?: string;
  contextMessageId?: string;
}

/**
 * Query parameters
 */
export interface WaConversationQueryParams {
  page?: number;
  limit?: number;
  search?: string;
}

export interface WaMessageQueryParams {
  page?: number;
  limit?: number;
  before?: string;
  search?: string;
}

export interface WaSearchParams {
  q: string;
  page?: number;
  limit?: number;
}

/**
 * Paginated responses
 */
export interface PaginatedWaConversationsResponse {
  conversations: WaConversation[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface PaginatedWaMessagesResponse {
  messages: WaMessage[];
  total: number;
}

// ============================================================
// WebSocket Event Payloads
// ============================================================
//
// Shape of the payloads the server emits on the `wa:*` Socket.IO
// channels, consumed by `useRealtimeWaSync` on the frontend. The
// server enriches a `WaMessage` row with `contactName` (resolved
// from contacts) and `windowEnd` (the post-event conversation
// window, when known) before emitting — see
// `server/src/modules/whatsapp/whatsapp.service.ts`.
//
// Keeping these types in this file (alongside `WaMessage` itself)
// makes the contract live next to its underlying row type so a
// schema change can't drift undetected. The frontend's realtime
// hook imports from here rather than redefining ad-hoc interfaces.

/** Payload for `wa:received` and `wa:sent`. Full `WaMessage` row plus
 *  the two server-side enrichments. */
export interface WaMessageWsPayload extends WaMessage {
  /** Resolved contact display name at emit time, if matched. */
  contactName?: string | null;
  /** Conversation window end (ISO) when the inbound/outbound event
   *  refreshed it. Lets the client write the window cache directly
   *  and skip the HTTP round-trip. */
  windowEnd?: string;
}

/** Payload for `wa:status` (delivery/read state transitions). */
export interface WaStatusWsPayload {
  waMessageId: string;
  status: WaStatus;
  sentAt?: string | null;
  deliveredAt?: string | null;
  readAt?: string | null;
  failedAt?: string | null;
  failureReason?: string | null;
  errorCode?: string | null;
}

/** Payload for `wa:reaction`. Empty `emoji` means the reaction was
 *  removed (per Meta's reaction semantics). */
export interface WaReactionWsPayload {
  waMessageId: string;
  emoji: string | null;
}

/** Payload for `wa:read` (cross-device read sync). */
export interface WaReadWsPayload {
  phoneNumber: string;
  /** Number of messages just marked read, when known. Defaults to 1
   *  on the client when the server omitted it. */
  count?: number;
}

/** Payload for `wa:deleted` (one or more messages soft-deleted). */
export interface WaDeletedWsPayload {
  messageIds: number[];
}

/** Payload for `wa:conversation_deleted` (whole-thread removal). */
export interface WaConversationDeletedWsPayload {
  phoneNumber: string;
}

/** Payload for `wa:config_updated` (token rotation, number
 *  reassignment, etc.). Currently no fields are required by the
 *  client — invalidates derived caches. */
export interface WaConfigUpdatedWsPayload {
  organizationId?: number;
}

// ============================================================
// Admin Types
// ============================================================

/**
 * WhatsApp Config
 */
export interface WaConfig {
  id: number;
  organizationId: number | null;
  accessToken: string; // Masked by backend
  phoneNumberId: string;
  wabaId: string;
  verifyToken: string;
  appSecret: string | null;
  apiVersion: string;
  displayPhone: string | null;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
  updatedBy: number | null;
}

export interface UpdateWaConfigRequest {
  accessToken?: string;
  phoneNumberId?: string;
  wabaId?: string;
  verifyToken?: string;
  appSecret?: string;
  apiVersion?: string;
  enabled?: boolean;
}

/**
 * WhatsApp Pricing Config
 */
export interface WaPricingConfig {
  id: number;
  marketingConversationPrice: number;
  utilityConversationPrice: number;
  authenticationConversationPrice: number;
  serviceConversationPrice: number;
  markupPercentage: number;
  updatedBy: number | null;
  updatedAt: string;
}

export interface UpdateWaPricingRequest {
  marketingConversationPrice?: number;
  utilityConversationPrice?: number;
  authenticationConversationPrice?: number;
  serviceConversationPrice?: number;
  markupPercentage?: number;
}

/**
 * WhatsApp Usage Summary
 */
export interface WaUsageSummary {
  totalUsers: number;
  totalSent: number;
  totalReceived: number;
  totalConversationsOpened: number;
  totalCostCents: number;
  totalRevenueCents: number;
}

/**
 * Per-user WhatsApp usage
 */
export interface UserWaUsage {
  phone: string;
  user_name: string | null;
  user_email: string | null;
  total_sent: number;
  total_received: number;
  total_conversations_opened: number;
  total_cost_cents: number;
  total_revenue_cents: number;
  wa_limit: number | null;
  period_start: string | null;
  last_updated: string | null;
}

/**
 * WhatsApp usage history entry
 */
export interface WaUsageHistoryEntry {
  id: number;
  phone: string;
  periodStart: string;
  periodEnd: string;
  totalSent: number;
  totalReceived: number;
  totalConversationsOpened: number;
  totalCostCents: number;
  waLimit: number | null;
  resetBy: number | null;
  resetReason: string | null;
  createdAt: string;
}

/**
 * WhatsApp template
 */
export interface WaTemplate {
  templateId: string;
  name: string;
  language: string;
  category: string;
  status: string;
  components: Record<string, unknown>[] | null;
  cachedAt: string;
}

export interface CreateWaTemplateRequest {
  name: string;
  language: string;
  category: string;
  bodyText: string;
}

export interface EditWaTemplateRequest {
  bodyText: string;
}

// ============================================================
// WhatsApp Numbers
// ============================================================

export interface WaNumber {
  id: number;
  organizationId: number | null;
  waPhoneNumberId: string;
  displayPhone: string;
  verifiedName: string | null;
  qualityRating: string | null;
  messagingLimitTier: string | null;
  platformType: string | null;
  status: string | null;
  /** Legacy single-agent column. Used when groupId is null. */
  assignedUserId: number | null;
  assignedUserName?: string | null;
  /**
   * Manager-curated group of agents that own this number. When set,
   * effective agent list = group members. When null, the number is in
   * legacy single-agent mode (assignedUserId is the sole owner) or
   * unassigned.
   */
  groupId: number | null;
  groupName?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// ============================================================
// Agent groups
// ============================================================

export interface WaAgentGroupMember {
  userId: number;
  fullName: string | null;
  email: string | null;
  role: string | null;
  addedAt: string;
  addedBy: number | null;
}

export interface WaAgentGroup {
  id: number;
  organizationId: number;
  name: string;
  description: string | null;
  createdBy: number;
  createdAt: string;
  updatedAt: string;
  members: WaAgentGroupMember[];
  /** Numbers currently assigned to this group. */
  numberIds: number[];
  memberCount: number;
}

export interface CreateWaAgentGroupRequest {
  name: string;
  description?: string | null;
  memberUserIds?: number[];
}

export interface UpdateWaAgentGroupRequest {
  name?: string;
  description?: string | null;
}
