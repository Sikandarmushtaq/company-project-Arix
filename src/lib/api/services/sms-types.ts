/**
 * SMS Types
 * Shared type definitions for all SMS sub-services
 */

// ============================================================
// Core Message & Conversation Types
// ============================================================

/**
 * SMS Message - matches backend SmsMessage (camelCase)
 * @see server/src/modules/sms/sms.repository.ts
 */
export interface Message {
  id: number;
  messageUuid: string | null;
  sender: string;
  receiver: string;
  body: string;
  direction: 'inbound' | 'outbound';
  txRxDatetime: string;
  delivered: boolean;
  read: boolean;
  threadId: string;
  didId: number;
  mediaUrl: string | null;
  groupId: number | null;
  deletedForMe: boolean;
  updatedAt: string;
  segments: number;
  price: number | null;
  messageType: string;
  status: string;
  failureReason: string | null;
  deliveredAt: string | null;
  failedAt: string | null;
  providerSid: string | null;
  sentAt: string | null;
}

/**
 * SMS Conversation/Thread - matches backend SmsThread (camelCase)
 * @see server/src/modules/sms/sms.repository.ts
 */
export interface Conversation {
  phoneNumber: string;
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
  contactName: string | null;
}

/**
 * SMS Usage - matches backend getSmsUsage response.
 *
 * Semantics (2026-05-23 metric switch from messages → segments):
 *   - `sent`: message COUNT (rows in sms_messages). For display only.
 *   - `received`: message COUNT (rows in sms_messages). For display only.
 *   - `used`: SEGMENT total (segmentsSent + segmentsReceived). This is
 *     the value compared against `limit` for the outbound block
 *     decision. Twilio bills per segment, so the cap must enforce
 *     against the same unit.
 *   - `limit`: SEGMENT limit (was message-count limit pre-migration;
 *     existing values were scaled by each user's historical
 *     segments-per-message ratio so effective capacity is preserved).
 *   - `remaining`: `limit - used` in SEGMENTS. Can be negative when a
 *     user is over the cap (server clamps to 0 for display purposes).
 *
 * @see server/src/modules/sms/sms.service.ts (getSmsUsage)
 */
export interface SmsUsage {
  /** Message count, outbound — for display. */
  sent: number;
  /** Message count, inbound — for display. */
  received: number;
  /** Segment total (segmentsSent + segmentsReceived) — gates against `limit`. */
  used: number;
  /** Segment limit (post-migration). */
  limit: number;
  /** `limit - used` in segments. */
  remaining: number;
}

export interface SendSmsRequest {
  to: string;
  body: string;
  mediaUrls?: string[];
  /** Explicit sender phone. If omitted, backend uses the user's current active phone. */
  from?: string;
  /** Bulk-SMS campaign id — tags the message for inbox un-mixing + lead attribution. */
  bulkCampaignId?: number;
}

/**
 * Conversation query parameters
 */
export interface ConversationQueryParams {
  page?: number;
  limit?: number;
  search?: string;
}

/**
 * Message query parameters
 */
export interface MessageQueryParams {
  page?: number;
  limit?: number;
  search?: string;
}

/**
 * Global search query parameters
 */
export interface SearchMessagesParams {
  q: string;
  page?: number;
  limit?: number;
}

/**
 * Paginated conversations response
 */
export interface PaginatedConversationsResponse {
  conversations: Conversation[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * Paginated messages response
 */
export interface PaginatedMessagesResponse {
  messages: Message[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ============================================================
// Group Messaging Types
// ============================================================

/**
 * SMS Group - matches backend SmsGroup
 */
export interface SmsGroup {
  id: number;
  uuid: string;
  name: string;
  description: string | null;
  createdBy: number;
  organizationId: number | null;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
  memberCount?: number;
  lastMessageAt?: string | null;
  lastMessage?: string | null;
  unreadCount?: number;
}

/**
 * SMS Group Member
 */
export interface SmsGroupMember {
  id: number;
  groupId: number;
  phoneNumber: string;
  name: string | null;
  addedBy: number | null;
  addedAt: string;
  isAdmin: boolean;
  isMuted: boolean;
}

/**
 * Group with members
 */
export interface SmsGroupWithMembers extends SmsGroup {
  members: SmsGroupMember[];
}

/**
 * Unified conversation (direct or group)
 */
export interface UnifiedConversation {
  type: 'direct' | 'group';
  id: string;
  displayName: string;
  lastMessage: string | null;
  lastMessageAt: string | null;
  lastMessageMediaUrl?: string | null;
  unreadCount: number;
  isGroup: boolean;
  // Group-specific
  groupId?: number;
  groupUuid?: string;
  memberCount?: number;
  // Direct-specific
  phoneNumber?: string;
  contactName?: string | null;
  // Bulk-SMS lead attribution (present when the thread was touched by a campaign).
  attributedCampaignId?: number | null;
  attributedCampaignName?: string | null;
  /** true = "From campaign" (origin), false = "Included in campaign". */
  campaignIsOrigin?: boolean;
}

/**
 * Create group request
 */
export interface CreateGroupRequest {
  name: string;
  description?: string;
  members: string[];
}

/**
 * Update group request
 */
export interface UpdateGroupRequest {
  name?: string;
  description?: string;
}

/**
 * Add members request
 */
export interface AddMembersRequest {
  members: Array<{ phoneNumber: string; name?: string }>;
}

/**
 * Send group message request
 */
export interface SendGroupMessageRequest {
  body: string;
  mediaUrls?: string[];
  from?: string;
}

/**
 * Group message result
 */
export interface GroupMessageResult {
  groupId: number;
  messageCount: number;
  successCount: number;
  failedCount: number;
  messages: Array<{
    memberId: number;
    phoneNumber: string;
    messageId: number | null;
    status: 'sent' | 'failed';
    error?: string;
  }>;
}

/**
 * Paginated groups response
 */
export interface PaginatedGroupsResponse {
  groups: SmsGroup[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * Paginated unified conversations response
 */
export interface PaginatedUnifiedConversationsResponse {
  conversations: UnifiedConversation[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ============================================================
// Admin SMS Pricing Types
// ============================================================

/**
 * SMS Pricing Configuration
 */
export interface SmsPricingConfig {
  id: number;
  smsOutboundPrice: number;
  smsInboundPrice: number;
  mmsOutboundPrice: number;
  mmsInboundPrice: number;
  carrierSurcharge: number;
  failedMessageFee: number;
  markupPercentage: number;
  updatedBy: number | null;
  updatedAt: string;
}

/**
 * SMS Usage Summary for Admin Dashboard
 *
 * Financial breakdown:
 * - totalCostTwilioCents: What we pay Twilio (base + carrier surcharge)
 * - totalBilledUserCents: What user is charged (cost + markup)
 * - totalProfitCents: Our profit (markup amount)
 */
export interface SmsUsageSummary {
  totalUsers: number;
  totalSmsSent: number;
  totalSmsReceived: number;
  totalMmsSent: number;
  totalMmsReceived: number;
  totalSegments: number;
  totalCostTwilioCents: number;
  totalBilledUserCents: number;
  totalProfitCents: number;
  periodStart: string;
  periodEnd: string;
}

/**
 * Per-user SMS usage stats
 *
 * Financial breakdown:
 * - totalCostTwilioCents: What we pay Twilio (base + carrier surcharge)
 * - totalBilledUserCents: What user is charged (cost + markup)
 * - totalProfitCents: Our profit (markup amount)
 */
export interface UserSmsUsage {
  phone: string;
  userName: string | null;
  userEmail: string | null;
  /** Message count, outbound. Display only. */
  totalSent: number;
  /** Message count, inbound. Display only. */
  totalReceived: number;
  /**
   * SEGMENT total (totalSegmentsSent + totalSegmentsReceived).
   *
   * This is the value compared against the user's `smsLimit` for the
   * outbound block decision. Twilio bills per segment (a 300-char
   * SMS = 3 segments), so the cap must enforce on segments — not on
   * rows — to match what we're being billed.
   *
   * Display this in the "Segments / Limit" column and progress bar
   * (not totalSent, which is messages).
   *
   * Changed from messages → segments on 2026-05-23. Existing
   * `smsLimit` values were scaled by each user's historical seg/msg
   * ratio in migration 026 so effective capacity is preserved.
   */
  totalUsed: number;
  totalSegmentsSent: number;
  totalSegmentsReceived: number;
  totalMmsSent: number;
  totalMmsReceived: number;
  totalCostTwilioCents: number;
  totalBilledUserCents: number;
  totalProfitCents: number;
  smsLimit: number | null;
  status: 'ok' | 'warning' | 'near_limit' | 'limit_reached';
  /**
   * True when the org is METERED (reskin) — the limit above is the org's SHARED
   * bundle package (counted in messages), spent across ALL of the org's users,
   * which is what the send-gate enforces. In that case `totalUsed`/`smsLimit`/
   * `status` are the ORG pool (identical for every user in the org), the per-user
   * `sms_limit` is NOT in effect, and per-user "Edit limit" is a no-op. When
   * false (nuxcall/prod + legacy), `smsLimit` is the per-user segment cap.
   */
  metered?: boolean;
  /** For metered rows: where the shared allowance comes from — a bought bundle or the base plan. */
  smsAllowanceSource?: 'base' | 'bundle' | null;
  periodStart: string;
  lastUpdated: string;
}

export interface SmsUsageHistoryEntry {
  id: number;
  periodStart: string;
  periodEnd: string;
  totalSent: number;
  totalReceived: number;
  totalSegmentsSent: number;
  totalSegmentsReceived: number;
  totalMmsSent: number;
  totalMmsReceived: number;
  totalCostCents: number;
  smsLimit: number | null;
  resetReason: string | null;
  createdAt: string;
}

/**
 * Update pricing config request
 */
export interface UpdateSmsPricingRequest {
  smsOutboundPrice?: number;
  smsInboundPrice?: number;
  mmsOutboundPrice?: number;
  mmsInboundPrice?: number;
  carrierSurcharge?: number;
  failedMessageFee?: number;
  markupPercentage?: number;
}
