'use client';

/**
 * Real-time SMS Sync Hook
 *
 * Handles all SMS and group message Socket.IO events:
 * - SMS_RECEIVED, SMS_SENT, SMS_STATUS, SMS_USAGE_UPDATE
 * - GROUP_MESSAGE_RECEIVED, GROUP_MESSAGE_SENT
 * - GROUP_CREATED, GROUP_DELETED
 *
 * IMPORTANT: For SMS messages, we use DIRECT cache updates only.
 * We do NOT invalidate the entire messages cache because that would
 * clear pagination state and cause older messages to disappear.
 *
 * @module lib/hooks/useRealtimeSmsSync
 */

import { useEffect, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSocket } from '@/lib/providers/SocketProvider';
import { useAuthStore } from '@/lib/stores/auth';
import { REALTIME_EVENTS } from '@/lib/constants/events';
import { messagesKeys } from './useMessages';
import { groupsKeys, updateAnyUnifiedCache } from './useGroups';
import type { UnifiedConversation } from '@/lib/api';
import { notifyIncomingSms } from '@/lib/utils/notifications';
import { normalizePhone } from '@/lib/utils/phone';
import { toast } from '@/lib/stores/toast';

import type {
  SmsEventPayload,
  SmsReadPayload,
  GroupMessageEventPayload,
  GroupCreatedPayload,
  GroupDeletedPayload,
} from './useRealtimeSync.types';
import {
  parseUnreadCount,
  DEDUPE_WINDOW_MS,
  MAX_DEDUPE_CACHE_SIZE,
  cleanupDedupeMap,
} from './useRealtimeSync.types';

/**
 * Hook to sync SMS-related React Query cache with Socket.IO events
 */
export function useRealtimeSmsSync() {
  const { socket, isConnected } = useSocket();
  const queryClient = useQueryClient();

  // Dedupe SMS events within a short window (prevents double-processing)
  const recentSmsIds = useRef<Map<number, number>>(new Map());

  const isDuplicateSms = useCallback((id: number): boolean => {
    const now = Date.now();
    const lastSeen = recentSmsIds.current.get(id);

    if (lastSeen && now - lastSeen < DEDUPE_WINDOW_MS) {
      return true;
    }

    recentSmsIds.current.set(id, now);

    // LRU-like cleanup to prevent unbounded growth
    cleanupDedupeMap(recentSmsIds.current, MAX_DEDUPE_CACHE_SIZE);

    return false;
  }, []);

  /**
   * Get the user's currently active phone number (normalized).
   * Reads from auth store at call time — no re-render subscription needed.
   */
  const getActivePhone = useCallback((): string | null => {
    const phone = useAuthStore.getState().user?.senderPhone;
    return phone ? normalizePhone(phone) : null;
  }, []);

  // === SMS HANDLERS ===

  /**
   * Handle incoming SMS - update cache directly without full invalidation
   * Group-tagged messages are handled by handleGroupMessageReceived (which also
   * updates the direct thread cache for dual display). Skipping here avoids
   * dedupe conflicts since GROUP_MESSAGE_RECEIVED fires first on the same socket.
   */
  const handleSmsReceived = useCallback(
    (message: SmsEventPayload) => {
      if (!message?.id) return;
      if (isDuplicateSms(message.id)) return;

      // Group-tagged inbound messages are owned by handleGroupMessageReceived,
      // which updates both group AND direct caches (dual display)
      if (message.groupId) return;

      // Show notification - handle MMS (media) messages
      const notificationBody = message.body?.trim() || (message.mediaUrl ? '📷 Image' : '');
      notifyIncomingSms(message.sender || 'Unknown', notificationBody, null);

      // NOTE: No phone filtering here. The backend is cross-phone — all queries
      // (conversations, threads, unread counts) use getAllPhonesForPhone() and return
      // data across ALL user phone numbers. Real-time updates must match this behavior
      // so the notification bell and conversation lists stay consistent.

      // The other party's phone (for cache key lookup)
      const otherPhone = normalizePhone(message.sender);

      // 1. Update the specific thread cache (add message)
      let cacheUpdated = false;

      queryClient.setQueriesData(
        { queryKey: ['messages', 'thread', otherPhone], exact: false },
        (
          old:
            | { messages?: SmsEventPayload[]; total?: number; page?: number; totalPages?: number }
            | undefined
        ) => {
          if (!old?.messages) return old;
          cacheUpdated = true;
          // Check if message already exists
          if (old.messages.some((m) => m.id === message.id)) return old;
          // Add new message at the beginning (newest first)
          return {
            ...old,
            messages: [message, ...old.messages],
            total: (old.total || 0) + 1,
          };
        }
      );

      // If cache wasn't updated (no existing cache), invalidate to trigger refetch
      if (!cacheUpdated) {
        queryClient.invalidateQueries({
          queryKey: ['messages', 'thread', otherPhone],
          exact: false,
        });
      }

      // Determine preview text - handle MMS (media) messages
      const previewText = message.body?.trim() || (message.mediaUrl ? '📷 Image' : '');

      // 2. Update conversations list directly (preserves MMS preview)
      queryClient.setQueriesData(
        { queryKey: messagesKeys.conversations(), exact: false },
        (
          old:
            | {
                conversations?: Array<{
                  phoneNumber: string;
                  lastMessage: string;
                  lastMessageTime: string;
                  unreadCount: number;
                  contactName: string | null;
                }>;
                total?: number;
              }
            | undefined
        ) => {
          if (!old?.conversations) return old;

          const existingIndex = old.conversations.findIndex(
            (c) => normalizePhone(c.phoneNumber) === otherPhone
          );

          if (existingIndex >= 0) {
            // Update existing conversation and move to top
            const updated = [...old.conversations];
            const [existing] = updated.splice(existingIndex, 1);
            updated.unshift({
              ...existing,
              lastMessage: previewText,
              lastMessageTime: message.txRxDatetime || new Date().toISOString(),
              unreadCount: parseUnreadCount(existing.unreadCount) + 1,
            });
            return { ...old, conversations: updated };
          }

          // New conversation - add at top
          return {
            ...old,
            conversations: [
              {
                phoneNumber: otherPhone,
                lastMessage: previewText,
                lastMessageTime: message.txRxDatetime || new Date().toISOString(),
                unreadCount: 1,
                contactName: null,
              },
              ...old.conversations,
            ],
          };
        }
      );

      // 3. Update unified conversations cache (messages page + notification dropdown)
      queryClient.setQueriesData<unknown>(
        { predicate: groupsKeys.unifiedPredicate },
        (old: unknown) =>
          updateAnyUnifiedCache(old, (conversations, total) => {
            const existingIndex = conversations.findIndex(
              (c) => !c.isGroup && c.phoneNumber && normalizePhone(c.phoneNumber) === otherPhone
            );

            if (existingIndex >= 0) {
              const [existing] = conversations.splice(existingIndex, 1);
              conversations.unshift({
                ...existing,
                lastMessage: previewText,
                lastMessageAt: message.txRxDatetime || new Date().toISOString(),
                unreadCount: parseUnreadCount(existing.unreadCount) + 1,
              });
              return { conversations, total };
            }

            // New conversation - add at top
            conversations.unshift({
              type: 'direct' as const,
              id: otherPhone,
              displayName: otherPhone,
              lastMessage: previewText,
              lastMessageAt: message.txRxDatetime || new Date().toISOString(),
              unreadCount: 1,
              isGroup: false,
              phoneNumber: otherPhone,
              contactName: null,
            } as UnifiedConversation);
            return { conversations, total: total + 1 };
          })
      );

      // 4. Update unread count and unread conversations list (for notification dropdown)
      queryClient.invalidateQueries({ queryKey: messagesKeys.unreadCount() });
      queryClient.invalidateQueries({ queryKey: messagesKeys.unreadConversations(), exact: false });
    },
    [queryClient, isDuplicateSms]
  );

  /**
   * Handle sent SMS - update cache directly without full invalidation
   * Only handles 1-1 direct messages. Group messages use handleGroupMessageSent.
   */
  const handleSmsSent = useCallback(
    (message: SmsEventPayload) => {
      if (!message?.id) return;
      if (isDuplicateSms(message.id)) return;

      // Group outbound messages are owned by handleGroupMessageSent
      if (message.groupId) return;

      // The other party's phone (for cache key lookup)
      const otherPhone = normalizePhone(message.receiver);

      // Determine preview text - handle MMS (media) messages
      const previewText = message.body?.trim() || (message.mediaUrl ? '📷 Image' : '');

      // 1. Update the specific thread cache (add message)
      let cacheUpdated = false;
      queryClient.setQueriesData(
        { queryKey: ['messages', 'thread', otherPhone], exact: false },
        (
          old:
            | { messages?: SmsEventPayload[]; total?: number; page?: number; totalPages?: number }
            | undefined
        ) => {
          if (!old?.messages) return old;
          cacheUpdated = true;
          // Check if message already exists
          if (old.messages.some((m) => m.id === message.id)) return old;
          // Add new message at the beginning (newest first)
          return {
            ...old,
            messages: [message, ...old.messages],
            total: (old.total || 0) + 1,
          };
        }
      );

      // If cache wasn't updated, invalidate to trigger refetch
      if (!cacheUpdated) {
        queryClient.invalidateQueries({
          queryKey: ['messages', 'thread', otherPhone],
          exact: false,
        });
      }

      // 2. Update conversations list directly (don't invalidate - preserves MMS preview)
      queryClient.setQueriesData(
        { queryKey: messagesKeys.conversations(), exact: false },
        (
          old:
            | {
                conversations?: Array<{
                  phoneNumber: string;
                  lastMessage: string;
                  lastMessageTime: string;
                  unreadCount: number;
                  contactName: string | null;
                }>;
                total?: number;
              }
            | undefined
        ) => {
          if (!old?.conversations) return old;

          const existingIndex = old.conversations.findIndex(
            (c) => normalizePhone(c.phoneNumber) === otherPhone
          );

          if (existingIndex >= 0) {
            // Update existing conversation and move to top
            const updated = [...old.conversations];
            const [existing] = updated.splice(existingIndex, 1);
            updated.unshift({
              ...existing,
              lastMessage: previewText,
              lastMessageTime: message.txRxDatetime || new Date().toISOString(),
            });
            return { ...old, conversations: updated };
          }

          return old;
        }
      );

      // 3. Update unified conversations cache (messages page + notification dropdown)
      queryClient.setQueriesData<unknown>(
        { predicate: groupsKeys.unifiedPredicate },
        (old: unknown) =>
          updateAnyUnifiedCache(old, (conversations, total) => {
            const existingIndex = conversations.findIndex(
              (c) => !c.isGroup && c.phoneNumber && normalizePhone(c.phoneNumber) === otherPhone
            );

            if (existingIndex >= 0) {
              // Update existing direct conversation and move to top (no unread change for sent)
              const [existing] = conversations.splice(existingIndex, 1);
              conversations.unshift({
                ...existing,
                lastMessage: previewText,
                lastMessageAt: message.txRxDatetime || new Date().toISOString(),
              });
            }

            return { conversations, total };
          })
      );
    },
    [queryClient, isDuplicateSms]
  );

  /**
   * Handle SMS status update - update specific message in cache
   */
  const handleSmsStatus = useCallback(
    (data: SmsEventPayload) => {
      if (!data?.id) return;

      // Update the message status in cache without full refetch
      queryClient.setQueriesData(
        { queryKey: ['messages', 'thread'], exact: false },
        (old: { messages?: SmsEventPayload[] } | undefined) => {
          if (!old?.messages) return old;
          const messageIndex = old.messages.findIndex((m) => m.id === data.id);
          if (messageIndex === -1) return old;

          const updatedMessages = [...old.messages];
          updatedMessages[messageIndex] = { ...updatedMessages[messageIndex], ...data };
          return { ...old, messages: updatedMessages };
        }
      );
    },
    [queryClient]
  );

  /**
   * Handle SMS usage update — show toast notification for limit warnings.
   *
   * Hybrid policy: the threshold figures the user sees here must match
   * what the admin sees in the dashboard, so we read `used` (sent +
   * received) — NOT `sent`. The payload also still carries `sent`
   * separately for any caller that needs the breakdown, but everything
   * tied to the user-visible cap is keyed off `used`.
   *
   * Older SMS_USAGE_UPDATE payloads from a stale backend won't have
   * `used`; we fall back to `sent` so the toast still appears (just
   * outbound-only, mirroring the legacy behavior) during a partial
   * deploy window.
   */
  const handleSmsUsageUpdate = useCallback(
    (data: {
      sent: number;
      received?: number;
      used?: number;
      limit: number;
      remaining: number;
      usagePercentage: number;
      costCents: number;
    }) => {
      // Only show warnings if user has a limit set
      if (data.limit <= 0) return;

      const used = data.used ?? data.sent;

      // Show toast notifications at threshold levels.
      // `used` and `data.limit` are SEGMENT counts (not messages) since
      // the 2026-05-23 metric switch — Twilio bills per segment and
      // the cap enforces against segments. Text reflects that.
      if (data.usagePercentage >= 100) {
        toast.error(
          `SMS Limit Reached: ${used}/${data.limit} segments used this period (both directions count). Sending is paused — incoming messages still arrive.`,
          {
            duration: 10000,
          }
        );
      } else if (data.usagePercentage >= 90 && data.usagePercentage < 100) {
        toast.warning(
          `SMS Limit Warning: ${data.usagePercentage}% used (${used}/${data.limit} segments). ${data.remaining} segments remaining.`,
          { duration: 8000 }
        );
      } else if (data.usagePercentage >= 80 && data.usagePercentage < 90) {
        toast.info(
          `SMS Usage: ${data.usagePercentage}% of segment limit used (${used}/${data.limit}).`,
          {
            duration: 5000,
          }
        );
      }
    },
    []
  );

  /**
   * Handle SMS read event from another session — sync read status across devices
   */
  const handleSmsRead = useCallback(
    (payload: SmsReadPayload) => {
      if (!payload?.phoneNumber) return;

      // Only process read events for the currently active phone.
      // Without this, reading contact X on phone-B would incorrectly clear
      // unread counts for contact X on phone-A's cache.
      const activePhone = getActivePhone();
      if (activePhone && payload.userPhone && normalizePhone(payload.userPhone) !== activePhone)
        return;

      const otherPhone = normalizePhone(payload.phoneNumber);

      // 1. Update unread conversations cache (notification dropdown)
      queryClient.setQueriesData(
        { queryKey: messagesKeys.unreadConversations(), exact: false },
        (old: { conversations?: Array<{ phoneNumber: string }> } | undefined) => {
          if (!old?.conversations) return old;
          return {
            ...old,
            conversations: old.conversations.filter(
              (c) => normalizePhone(c.phoneNumber) !== otherPhone
            ),
          };
        }
      );

      // 2. Update conversations cache (messages page sidebar)
      queryClient.setQueriesData(
        { queryKey: messagesKeys.conversations(), exact: false },
        (old: { threads?: Array<{ phoneNumber: string; unreadCount: number }> } | undefined) => {
          if (!old?.threads) return old;
          return {
            ...old,
            threads: old.threads.map((t) =>
              normalizePhone(t.phoneNumber) === otherPhone ? { ...t, unreadCount: 0 } : t
            ),
          };
        }
      );

      // 3. Update unified conversations cache (messages page + notification dropdown)
      queryClient.setQueriesData<unknown>(
        { predicate: groupsKeys.unifiedPredicate },
        (old: unknown) =>
          updateAnyUnifiedCache(old, (conversations, total) => ({
            conversations: conversations.map((c) =>
              !c.isGroup && c.phoneNumber && normalizePhone(c.phoneNumber) === otherPhone
                ? { ...c, unreadCount: 0 }
                : c
            ),
            total,
          }))
      );

      // 4. Update global unread count
      queryClient.setQueryData<number>(messagesKeys.unreadCount(), (old) =>
        Math.max(0, (old ?? 0) - (payload.count || 1))
      );

      // 5. Mark messages as read in thread cache
      queryClient.setQueriesData(
        { queryKey: ['messages', 'thread', otherPhone], exact: false },
        (old: { messages?: Array<{ read: boolean; direction: string }> } | undefined) => {
          if (!old?.messages) return old;
          return {
            ...old,
            messages: old.messages.map((m) =>
              m.direction === 'inbound' ? { ...m, read: true } : m
            ),
          };
        }
      );
    },
    [queryClient, getActivePhone]
  );

  // === GROUP MESSAGE HANDLERS ===

  /**
   * Handle incoming group message - update cache directly without full invalidation
   *
   * DUAL DISPLAY: This handler owns ALL inbound messages from group members.
   * It updates the group cache AND the direct (1-1) cache from a single event,
   * so the message appears in both views in real-time. handleSmsReceived skips
   * group-tagged messages to avoid dedupe conflicts.
   *
   * Query key pattern: ['groups', 'messages', groupId, params]
   * Messages are stored in DESC order (newest first) and reversed for display
   */
  const handleGroupMessageReceived = useCallback(
    (message: GroupMessageEventPayload) => {
      if (!message?.id || !message?.groupId) return;
      if (isDuplicateSms(message.id)) return;

      // Show notification with group name
      const notificationBody = message.body?.trim() || (message.mediaUrl ? '📷 Image' : '');
      notifyIncomingSms(`${message.groupName} - ${message.sender}`, notificationBody, null);

      const previewText = message.body?.trim() || (message.mediaUrl ? '📷 Image' : '');
      const otherPhone = normalizePhone(message.sender);

      // NOTE: No phone filtering. Backend is cross-phone — all queries use
      // getAllPhonesForPhone(). Real-time updates must match.

      // ── 1. GROUP CACHE: Update the specific group thread ──
      let groupCacheUpdated = false;
      queryClient.setQueriesData(
        { queryKey: ['groups', 'messages', message.groupId], exact: false },
        (
          old:
            | {
                messages?: GroupMessageEventPayload[];
                total?: number;
                page?: number;
                totalPages?: number;
              }
            | undefined
        ) => {
          if (!old?.messages) return old;
          groupCacheUpdated = true;
          if (old.messages.some((m) => m.id === message.id)) return old;
          return {
            ...old,
            messages: [message, ...old.messages],
            total: (old.total || 0) + 1,
          };
        }
      );

      if (!groupCacheUpdated) {
        queryClient.invalidateQueries({
          queryKey: ['groups', 'messages', message.groupId],
          exact: false,
        });
      }

      // ── 2. DIRECT CACHE: Update the 1-1 thread (dual display) ──
      let directCacheUpdated = false;
      queryClient.setQueriesData(
        { queryKey: ['messages', 'thread', otherPhone], exact: false },
        (old: { messages?: GroupMessageEventPayload[]; total?: number } | undefined) => {
          if (!old?.messages) return old;
          directCacheUpdated = true;
          if (old.messages.some((m) => m.id === message.id)) return old;
          return {
            ...old,
            messages: [message, ...old.messages],
            total: (old.total || 0) + 1,
          };
        }
      );

      if (!directCacheUpdated) {
        queryClient.invalidateQueries({
          queryKey: ['messages', 'thread', otherPhone],
          exact: false,
        });
      }

      // ── 3. UNIFIED CONVERSATIONS: Update both group AND direct entries ──
      queryClient.setQueriesData<unknown>(
        { predicate: groupsKeys.unifiedPredicate },
        (old: unknown) =>
          updateAnyUnifiedCache(old, (conversations, total) => {
            // Update group conversation entry
            const groupIdx = conversations.findIndex(
              (c) => c.isGroup && c.groupId === message.groupId
            );
            if (groupIdx >= 0) {
              const [existing] = conversations.splice(groupIdx, 1);
              conversations.unshift({
                ...existing,
                lastMessage: previewText,
                lastMessageAt: message.txRxDatetime || new Date().toISOString(),
                unreadCount: parseUnreadCount(existing.unreadCount) + 1,
              });
            }

            // Update direct conversation entry (dual display — preview only, NO unread bump)
            const directIdx = conversations.findIndex(
              (c) => !c.isGroup && c.phoneNumber && normalizePhone(c.phoneNumber) === otherPhone
            );
            if (directIdx >= 0) {
              const [existing] = conversations.splice(directIdx, 1);
              const insertAt = groupIdx >= 0 ? 1 : 0;
              conversations.splice(insertAt, 0, {
                ...existing,
                lastMessage: previewText,
                lastMessageAt: message.txRxDatetime || new Date().toISOString(),
              });
            } else {
              const insertAt = groupIdx >= 0 ? 1 : 0;
              conversations.splice(insertAt, 0, {
                type: 'direct' as const,
                id: otherPhone,
                isGroup: false,
                phoneNumber: otherPhone,
                displayName: otherPhone,
                lastMessage: previewText,
                lastMessageAt: message.txRxDatetime || new Date().toISOString(),
                unreadCount: 0,
                contactName: null,
              } as UnifiedConversation);
            }

            return { conversations, total };
          })
      );

      // ── 4. Update direct conversations list (legacy cache key — preview only, NO unread bump) ──
      queryClient.setQueriesData(
        { queryKey: messagesKeys.conversations(), exact: false },
        (
          old:
            | {
                conversations?: Array<{
                  phoneNumber: string;
                  lastMessage: string;
                  lastMessageTime: string;
                  unreadCount: number;
                  contactName: string | null;
                }>;
                total?: number;
              }
            | undefined
        ) => {
          if (!old?.conversations) return old;

          const existingIndex = old.conversations.findIndex(
            (c) => normalizePhone(c.phoneNumber) === otherPhone
          );

          if (existingIndex >= 0) {
            const updated = [...old.conversations];
            const [existing] = updated.splice(existingIndex, 1);
            updated.unshift({
              ...existing,
              lastMessage: previewText,
              lastMessageTime: message.txRxDatetime || new Date().toISOString(),
            });
            return { ...old, conversations: updated };
          }

          return {
            ...old,
            conversations: [
              {
                phoneNumber: otherPhone,
                lastMessage: previewText,
                lastMessageTime: message.txRxDatetime || new Date().toISOString(),
                unreadCount: 0,
                contactName: null,
              },
              ...old.conversations,
            ],
          };
        }
      );

      // ── 5. Invalidate unread counts ──
      // NOTE: Do NOT broadly invalidate ['groups'] — that overwrites our optimistic
      // unreadCount on the unified conversations cache. Be targeted instead.
      queryClient.invalidateQueries({ queryKey: ['groups', 'list'] });
      queryClient.invalidateQueries({ queryKey: messagesKeys.unreadCount() });
      queryClient.invalidateQueries({ queryKey: messagesKeys.unreadConversations(), exact: false });
    },
    [queryClient, isDuplicateSms]
  );

  /**
   * Handle sent group messages - update cache directly without full invalidation
   *
   * This mirrors handleGroupMessageReceived but for outbound messages.
   * Query key pattern: ['groups', 'messages', groupId, params]
   */
  const handleGroupMessageSent = useCallback(
    (message: GroupMessageEventPayload) => {
      if (!message?.id || !message?.groupId) return;
      if (isDuplicateSms(message.id)) return;

      // 1. Update the specific group thread cache (add message)
      let cacheUpdated = false;
      queryClient.setQueriesData(
        { queryKey: ['groups', 'messages', message.groupId], exact: false },
        (
          old:
            | {
                messages?: GroupMessageEventPayload[];
                total?: number;
                page?: number;
                totalPages?: number;
              }
            | undefined
        ) => {
          if (!old?.messages) return old;
          cacheUpdated = true;
          // Check if message already exists (by ID)
          if (old.messages.some((m) => m.id === message.id)) return old;
          // For outbound group messages, deduplicate by sender+body+minute
          // The backend sends one SMS per member, creating duplicate events
          if (message.direction === 'outbound') {
            const minuteBucket = (message.txRxDatetime || '').slice(0, 16);
            const isDup = old.messages.some(
              (m) =>
                m.direction === 'outbound' &&
                m.sender === message.sender &&
                m.body === message.body &&
                (m.txRxDatetime || '').slice(0, 16) === minuteBucket
            );
            if (isDup) return old;
          }
          // Add new message at the beginning (DESC order - newest first)
          return {
            ...old,
            messages: [message, ...old.messages],
            total: (old.total || 0) + 1,
          };
        }
      );

      // If cache wasn't updated (no existing cache), invalidate to trigger refetch
      if (!cacheUpdated) {
        queryClient.invalidateQueries({
          queryKey: ['groups', 'messages', message.groupId],
          exact: false,
        });
      }

      // 2. Update unified conversations list (move group to top with new message preview)
      const previewText = message.body?.trim() || (message.mediaUrl ? '📷 Image' : '');
      queryClient.setQueriesData<unknown>(
        { predicate: groupsKeys.unifiedPredicate },
        (old: unknown) =>
          updateAnyUnifiedCache(old, (conversations, total) => {
            const existingIndex = conversations.findIndex(
              (c) => c.isGroup && c.groupId === message.groupId
            );

            if (existingIndex >= 0) {
              // Update existing group conversation and move to top
              const [existing] = conversations.splice(existingIndex, 1);
              conversations.unshift({
                ...existing,
                lastMessage: previewText,
                lastMessageAt: message.txRxDatetime || new Date().toISOString(),
              });
            }

            return { conversations, total };
          })
      );
    },
    [queryClient, isDuplicateSms]
  );

  // === GROUP LIFECYCLE HANDLERS ===

  /**
   * Handle group created event
   * Invalidates group-memberships to update group badge on 1-1 conversations
   */
  const handleGroupCreated = useCallback(
    (payload: GroupCreatedPayload) => {
      if (!payload?.id) return;

      // Invalidate group-memberships query (updates group badge on 1-1 conversations)
      queryClient.invalidateQueries({ queryKey: ['group-memberships'] });

      // Refresh conversation lists to show the new group
      // Use predicate for reliable matching of all unified queries
      queryClient.invalidateQueries({
        predicate: (query) =>
          Array.isArray(query.queryKey) &&
          query.queryKey[0] === 'groups' &&
          query.queryKey[1] === 'unified',
      });
      queryClient.invalidateQueries({ queryKey: ['groups', 'list'] });
    },
    [queryClient]
  );

  /**
   * Handle group deleted/archived event
   * Removes group from cache and updates group badge on 1-1 conversations
   */
  const handleGroupDeleted = useCallback(
    (payload: GroupDeletedPayload) => {
      if (!payload?.groupId) return;

      // Optimistically remove from unified conversations (prevents "Unknown" flash)
      queryClient.setQueriesData<unknown>(
        { predicate: groupsKeys.unifiedPredicate },
        (old: unknown) =>
          updateAnyUnifiedCache(old, (conversations, total) => ({
            conversations: conversations.filter(
              (c) => !(c.isGroup && c.groupId === payload.groupId)
            ),
            total: Math.max(0, total - 1),
          }))
      );

      // Optimistically remove from groups list
      queryClient.setQueriesData<{ groups?: Array<{ id: number }> }>(
        { queryKey: ['groups', 'list'], exact: false },
        (old) => {
          if (!old?.groups) return old;
          return {
            ...old,
            groups: old.groups.filter((g) => g.id !== payload.groupId),
          };
        }
      );

      // Invalidate group-memberships query (removes group badge from 1-1 conversations)
      queryClient.invalidateQueries({ queryKey: ['group-memberships'] });

      // Clean up cached data for the deleted group
      queryClient.removeQueries({ queryKey: ['groups', 'detail', payload.groupId] });
      queryClient.removeQueries({ queryKey: ['groups', 'messages', payload.groupId] });
    },
    [queryClient]
  );

  // Register event listeners
  useEffect(() => {
    if (!socket || !isConnected) return;

    socket.on(REALTIME_EVENTS.SMS_RECEIVED, handleSmsReceived);
    socket.on(REALTIME_EVENTS.SMS_SENT, handleSmsSent);
    socket.on(REALTIME_EVENTS.SMS_STATUS, handleSmsStatus);
    socket.on(REALTIME_EVENTS.SMS_READ, handleSmsRead);
    socket.on(REALTIME_EVENTS.SMS_USAGE_UPDATE, handleSmsUsageUpdate);
    socket.on(REALTIME_EVENTS.GROUP_MESSAGE_RECEIVED, handleGroupMessageReceived);
    socket.on(REALTIME_EVENTS.GROUP_MESSAGE_SENT, handleGroupMessageSent);
    socket.on(REALTIME_EVENTS.GROUP_CREATED, handleGroupCreated);
    socket.on(REALTIME_EVENTS.GROUP_DELETED, handleGroupDeleted);

    return () => {
      socket.off(REALTIME_EVENTS.SMS_RECEIVED, handleSmsReceived);
      socket.off(REALTIME_EVENTS.SMS_SENT, handleSmsSent);
      socket.off(REALTIME_EVENTS.SMS_STATUS, handleSmsStatus);
      socket.off(REALTIME_EVENTS.SMS_READ, handleSmsRead);
      socket.off(REALTIME_EVENTS.SMS_USAGE_UPDATE, handleSmsUsageUpdate);
      socket.off(REALTIME_EVENTS.GROUP_MESSAGE_RECEIVED, handleGroupMessageReceived);
      socket.off(REALTIME_EVENTS.GROUP_MESSAGE_SENT, handleGroupMessageSent);
      socket.off(REALTIME_EVENTS.GROUP_CREATED, handleGroupCreated);
      socket.off(REALTIME_EVENTS.GROUP_DELETED, handleGroupDeleted);
    };
  }, [
    socket,
    isConnected,
    handleSmsReceived,
    handleSmsSent,
    handleSmsStatus,
    handleSmsRead,
    handleSmsUsageUpdate,
    handleGroupMessageReceived,
    handleGroupMessageSent,
    handleGroupCreated,
    handleGroupDeleted,
  ]);
}
