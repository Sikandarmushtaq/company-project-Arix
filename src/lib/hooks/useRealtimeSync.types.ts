/**
 * Shared types for real-time sync sub-hooks
 *
 * @module lib/hooks/useRealtimeSync.types
 */

import type { UserRole } from '@/lib/types';

/**
 * Safely parse unreadCount to a number.
 * API might return string like "001" or "0" which causes string concatenation issues.
 */
export function parseUnreadCount(count: unknown): number {
  if (typeof count === 'number') return count;
  if (typeof count === 'string') return parseInt(count, 10) || 0;
  return 0;
}

// ============================================================
// Deduplication Constants & Helpers
// ============================================================
export const DEDUPE_WINDOW_MS = 5000; // 5 seconds
export const MAX_DEDUPE_CACHE_SIZE = 100; // Maximum entries before forced cleanup

/**
 * LRU-like cleanup for deduplication maps
 * Removes oldest entries when cache exceeds max size
 */
export function cleanupDedupeMap(map: Map<number, number>, maxSize: number): void {
  if (map.size <= maxSize) return;

  const now = Date.now();
  const cutoff = now - DEDUPE_WINDOW_MS;

  // First pass: remove expired entries
  map.forEach((time, key) => {
    if (time < cutoff) map.delete(key);
  });

  // Second pass: if still over limit, remove oldest entries
  if (map.size > maxSize) {
    const entries = Array.from(map.entries()).sort((a, b) => a[1] - b[1]);
    const toRemove = entries.slice(0, map.size - maxSize);
    toRemove.forEach(([key]) => map.delete(key));
  }
}

// Event payload types
export interface SmsEventPayload {
  id: number;
  sender: string;
  receiver: string;
  body: string;
  direction: 'inbound' | 'outbound';
  status?: string;
  txRxDatetime?: string;
  mediaUrl?: string;
  delivered?: boolean;
  read?: boolean;
  // Group ID if message belongs to a group (should NOT be handled in 1-1 chat)
  groupId?: number | null;
}

export interface SmsReadPayload {
  phoneNumber: string;
  userPhone?: string;
  count: number;
}

export interface CallEventPayload {
  id: number;
  caller: string; // Phone number of the caller
  callee: string; // Phone number of the callee
  direction: 'inbound' | 'outbound';
  contactName?: string; // Contact name if matched
  status?: string;
  reasonText?: string;
}

export interface ContactEventPayload {
  action: 'created' | 'updated' | 'deleted';
  contact?: { id: number; contact: string; name: string; type?: string };
  contactId?: number;
  contactIds?: number[];
}

export interface CampaignEventPayload {
  id: number;
}

export interface GroupMessageEventPayload {
  id: number;
  sender: string;
  receiver: string;
  body: string;
  direction: 'inbound' | 'outbound';
  status?: string;
  txRxDatetime?: string;
  mediaUrl?: string;
  groupId: number;
  groupName: string;
  groupUuid: string;
}

export interface CallAnsweredElsewherePayload {
  callId: number;
  sipCallId: string;
  answeredAt: string;
}

export interface GroupMemberPayload {
  id: number;
  groupId: number;
  phoneNumber: string;
  name: string | null;
  addedBy: number | null;
  addedAt: string;
  isAdmin: boolean;
  isMuted: boolean;
}

export interface GroupCreatedPayload {
  id: number;
  uuid: string;
  name: string;
  description: string | null;
  createdBy: number;
  organizationId: number | null;
  isArchived: boolean;
  memberCount?: number;
  members: GroupMemberPayload[];
}

export interface GroupDeletedPayload {
  groupId: number;
  groupUuid?: string;
  groupName?: string;
}

export interface UserSettingsUpdatePayload {
  smsEnabled?: boolean;
  autoDialerEnabled?: boolean;
  smsType?: 'standard' | 'auto' | 'both' | null;
  smsLimit?: number;
  bulkSmsInterval?: number;
  bulkSmsIntervalControl?: boolean;
  userBulkSmsInterval?: number | null;
  banned?: boolean;
  isActive?: boolean;
  role?: UserRole;
  /** New voice/phone capability fields. Null means the capability was
   *  cleared by an admin (Voice off, or phone number removed). */
  sipUsername?: string | null;
  senderPhone?: string | null;
  /** waEnabled + waNumberAssigned changes are handled separately via
   *  wa-status query invalidation (see useRealtimeCacheSync). */
  waEnabled?: boolean;
  /** True when admin assigned a WA number to this user; false when the
   *  number was reassigned away (the previous user is notified so their
   *  PhoneSelector / settings drop the stale number). */
  waNumberAssigned?: boolean;
  /** Privacy mode (WA + contacts pages hide phone numbers). Lives directly
   *  on the auth User object — flipping it must update the store so the
   *  display utility re-renders without a refresh. */
  waPhoneMaskEnabled?: boolean;
  phoneNumbers?: Array<{
    id: number;
    userId: number;
    phoneNumber: string;
    label: string | null;
    isPrimary: boolean;
    smsEnabled: boolean;
    autoSmsEnabled: boolean;
    createdAt: string;
  }>;
  timestamp: string;
}
