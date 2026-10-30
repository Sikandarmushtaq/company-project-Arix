'use client';

/**
 * Real-time WhatsApp Sync Hook
 *
 * Handles all WhatsApp Socket.IO events:
 * - WA_RECEIVED: Incoming message from contact
 * - WA_SENT: Outbound message confirmed by server
 * - WA_STATUS: Delivery/read status update (sent -> delivered -> read)
 * - WA_REACTION: Emoji reaction on an existing message
 * - WA_READ: Conversation marked as read (cross-device sync)
 * - WA_DELETED: Messages soft-deleted
 * - WA_CONVERSATION_DELETED: Whole conversation deleted from another tab/device
 * - WA_USAGE_UPDATE: Per-org usage counter ticked
 * - WA_CONFIG_UPDATED: WhatsApp configuration changed
 *
 * IMPORTANT: Uses DIRECT cache updates (`updateWaMessagesCache`,
 * `updateWaConversationsCache`) — never blanket invalidation of the
 * thread cache. The cache is now infinite-paginated (cursor-based,
 * `useWaMessagesInfinite`); invalidating it would refetch every loaded
 * page, throw away scroll position, and look like the conversation
 * "jumped" on every event arrival. The shape-aware helpers handle both
 * the legacy `{ messages, total }` and the new
 * `{ pages: [{ messages, total }], pageParams }` shapes from one call
 * site.
 *
 * @module lib/hooks/useRealtimeWaSync
 */

import { useEffect, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSocket } from '@/lib/providers/SocketProvider';
import { useWaActiveChatStore } from '@/lib/stores/waActiveChat';
import { REALTIME_EVENTS } from '@/lib/constants/events';
import { normalizePhone } from '@/lib/utils/phone';
import { notifyIncomingWhatsApp } from '@/lib/utils/notifications';
import {
  waMessagesKeys,
  updateWaConversationsCache,
  prependWaMessage,
  replaceWaMessage,
  replaceOrPrependWaMessage,
  removeWaMessages,
  mapWaMessages,
  coerceWaMessage,
} from './useWaMessages';
import type {
  WaConversation,
  WaMessageWsPayload,
  WaStatusWsPayload,
  WaReactionWsPayload,
  WaReadWsPayload,
  WaDeletedWsPayload,
  WaConversationDeletedWsPayload,
  WaConfigUpdatedWsPayload,
} from '@/lib/api';
import type { ConversationWindow } from '@/lib/api/services/whatsapp.api';
import {
  parseUnreadCount,
  DEDUPE_WINDOW_MS,
  MAX_DEDUPE_CACHE_SIZE,
  cleanupDedupeMap,
} from './useRealtimeSync.types';

/**
 * Hook to sync WhatsApp-related React Query cache with Socket.IO events.
 * Mounted globally from `phone/layout.tsx` via `useRealtimeSync()`.
 */
export function useRealtimeWaSync(): void {
  const { socket, isConnected } = useSocket();
  const queryClient = useQueryClient();

  // Dedupe WA events within a short window (multi-tab + WS reconnect
  // can both replay the same id within seconds).
  const recentWaIds = useRef<Map<number, number>>(new Map());
  const isDuplicateWa = useCallback((id: number): boolean => {
    const now = Date.now();
    const lastSeen = recentWaIds.current.get(id);
    if (lastSeen && now - lastSeen < DEDUPE_WINDOW_MS) return true;
    recentWaIds.current.set(id, now);
    cleanupDedupeMap(recentWaIds.current, MAX_DEDUPE_CACHE_SIZE);
    return false;
  }, []);

  // === WA_RECEIVED ===

  const handleWaReceived = useCallback(
    (message: WaMessageWsPayload) => {
      if (!message?.id) return;
      if (isDuplicateWa(message.id)) return;

      // No client-side scope gate. The server now emits WA_RECEIVED only
      // to the sticky-assigned user (and to the phone room for triage —
      // but that targets agents whose senderPhone matches the WA number,
      // and they DO want the live event). An earlier version of this
      // file gated on `message.receiver === senderPhone`, which silently
      // dropped the event for the assigned user in shared-WA-number
      // setups where the user's `senderPhone` differs from the WA
      // business number on the message. Trusting the server's per-user
      // routing is the right model.
      const otherPhone = normalizePhone(message.sender);

      // Skip the toast / OS notification if the user is already looking
      // at this exact thread. `useWaMessagesState` publishes the open
      // thread's phone into `useWaActiveChatStore` whenever the selection
      // changes; we read it via `.getState()` (no React subscription —
      // this is a one-shot read inside an event handler). The message
      // will still appear in the thread view via the cache prepend below,
      // so the notification on top of it is pure noise. Bell badges and
      // the conversation list move-to-top still happen — those are
      // useful even when the chat is open.
      const activeWaPhone = useWaActiveChatStore.getState().phone;
      const isOpenChat = activeWaPhone !== null && activeWaPhone === otherPhone;

      if (!isOpenChat) {
        const notificationBody =
          message.body?.trim() ||
          (message.mediaUrl ? '📷 Media' : '') ||
          (message.templateName ? `Template: ${message.templateName}` : 'New message');
        notifyIncomingWhatsApp(message.sender, notificationBody, message.contactName);
      }

      // Determine preview text
      const previewText =
        (message.body || '').trim() ||
        (message.mediaUrl ? 'Media' : '') ||
        (message.templateName ? `Template: ${message.templateName}` : '');

      // 1. Append to the head page of the thread cache. If no cache
      //    exists yet (user hasn't opened this thread), invalidate so
      //    the next mount fetches fresh data.
      const normalizedMessage = coerceWaMessage(message);
      const cacheUpdated = prependWaMessage(queryClient, otherPhone, normalizedMessage);
      if (!cacheUpdated) {
        queryClient.invalidateQueries({
          queryKey: ['wa-messages', 'thread', otherPhone],
          exact: false,
        });
      }

      // 2. Update conversations list directly (move to top, increment unread).
      //    If the conversation isn't in this page yet, only PREPEND on
      //    page 0 — otherwise we'd add the same row to every infinite-
      //    scroll page and the user would see duplicates further down
      //    the list. Existing rows are still updated in place on whichever
      //    page they live (the move-to-top happens within a page, which
      //    is fine; the global "this is the newest conversation" position
      //    is ensured by page-0 having the prepend).
      updateWaConversationsCache(queryClient, (conversations, pageIndex) => {
        const existingIndex = conversations.findIndex(
          (c) => normalizePhone(c.phoneNumber) === otherPhone
        );

        if (existingIndex >= 0) {
          const updated = [...conversations];
          const [existing] = updated.splice(existingIndex, 1);
          updated.unshift({
            ...existing,
            lastMessage: previewText,
            lastMessageType: message.messageType,
            lastMessageTime: message.createdAt || new Date().toISOString(),
            unreadCount: parseUnreadCount(existing.unreadCount) + 1,
          });
          return updated;
        }

        // New conversation — only insert on page 0.
        if (pageIndex !== 0) return conversations;
        return [
          {
            phoneNumber: otherPhone,
            lastMessage: previewText,
            lastMessageType: message.messageType,
            lastMessageTime: message.createdAt || new Date().toISOString(),
            unreadCount: 1,
            contactName: message.contactName || null,
          } as WaConversation,
          ...conversations,
        ];
      });

      // 3. Refresh the global unread count from server — invalidate ONLY,
      //    no optimistic +1.
      //
      // Why no optimistic increment: the server emits WA_RECEIVED via
      // emitToOrganization, which fans the event out to EVERY user in
      // the org — including users for whom this message isn't in their
      // per-user scope (i.e. it was routed to a different agent's
      // user_phone). A blanket `setQueryData(+1)` would inflate the
      // bell for those recipients and then "correct itself to 0" on the
      // next refetch, producing the exact "bell briefly shows 1, then
      // vanishes" symptom users were reporting.
      //
      // Matches the WA Calls bell pattern (`['wa-calls', 'unread-missed']`
      // also uses invalidate-only and doesn't exhibit drift). The trade
      // is a ~100ms delay before the bell reflects the new message — but
      // the conversation list still updates instantly (line 119-149
      // updates the per-conversation unreadCount, which is correctly
      // scoped because we know which conversation this event is for),
      // and the OS notification fires instantly (line 98). The bell
      // scalar just snaps to truth on the refetch.
      queryClient.invalidateQueries({
        queryKey: waMessagesKeys.unreadCount(),
        refetchType: 'active',
      });

      // 4. Refresh conversation window cache. Direct write when the
      //    server attached `windowEnd`; otherwise fall back to invalidate
      //    so older backend builds keep working.
      if (message.windowEnd) {
        queryClient.setQueryData<ConversationWindow | null>(waMessagesKeys.window(otherPhone), {
          contactPhone: otherPhone,
          windowEnd: message.windowEnd,
          category: 'service',
        });
        queryClient.invalidateQueries({ queryKey: waMessagesKeys.windows() });
      } else {
        queryClient.invalidateQueries({ queryKey: waMessagesKeys.windows() });
        queryClient.invalidateQueries({
          queryKey: waMessagesKeys.window(otherPhone),
        });
      }
    },
    [queryClient, isDuplicateWa]
  );

  // === WA_SENT ===

  const handleWaSent = useCallback(
    (message: WaMessageWsPayload) => {
      if (!message?.id) return;
      if (isDuplicateWa(message.id)) return;

      const otherPhone = normalizePhone(message.receiver);
      const previewText =
        (message.body || '').trim() ||
        (message.mediaUrl ? 'Media' : '') ||
        (message.templateName ? `Template: ${message.templateName}` : '');

      // 1. Settle the message in the thread cache. One of three cases:
      //    (a) already present by real id → swap in place
      //    (b) matches an optimistic placeholder → replace it
      //    (c) brand new → prepend to head page
      // `replaceOrPrependWaMessage` collapses all three into a single
      // call. Scans every page since the optimistic placeholder may
      // have been pushed off the head page by intervening inbounds.
      const normalizedMessage = coerceWaMessage(message);
      const cacheUpdated = replaceOrPrependWaMessage(
        queryClient,
        otherPhone,
        (m) =>
          m.id === normalizedMessage.id ||
          (m.id < 0 &&
            m.status === 'pending' &&
            normalizePhone(m.receiver) === otherPhone &&
            m.body === normalizedMessage.body),
        normalizedMessage
      );
      if (!cacheUpdated) {
        queryClient.invalidateQueries({
          queryKey: ['wa-messages', 'thread', otherPhone],
          exact: false,
        });
      }

      // 2. Update conversations list (move to top, no unread change for sent)
      updateWaConversationsCache(queryClient, (conversations) => {
        const existingIndex = conversations.findIndex(
          (c) => normalizePhone(c.phoneNumber) === otherPhone
        );

        if (existingIndex >= 0) {
          const updated = [...conversations];
          const [existing] = updated.splice(existingIndex, 1);
          updated.unshift({
            ...existing,
            lastMessage: previewText,
            lastMessageType: message.messageType,
            lastMessageTime: message.createdAt || new Date().toISOString(),
          });
          return updated;
        }

        return conversations;
      });

      // Template sends open a fresh 24h marketing window. Same setQueryData
      // pattern as WA_RECEIVED — direct cache write when the server
      // attached `windowEnd`, invalidate fallback for older deploys.
      if (message.messageType === 'template') {
        if (message.windowEnd) {
          queryClient.setQueryData<ConversationWindow | null>(waMessagesKeys.window(otherPhone), {
            contactPhone: otherPhone,
            windowEnd: message.windowEnd,
            category: 'marketing',
          });
          queryClient.invalidateQueries({ queryKey: waMessagesKeys.windows() });
        } else {
          queryClient.invalidateQueries({ queryKey: waMessagesKeys.windows() });
          queryClient.invalidateQueries({
            queryKey: waMessagesKeys.window(otherPhone),
          });
        }
      }
    },
    [queryClient, isDuplicateWa]
  );

  // === WA_STATUS ===

  /**
   * Delivery/read status update — find the message by `waMessageId`
   * across every page and patch its status fields. Optional date
   * fields are only applied when the server included them, so a
   * delivered event doesn't wipe an already-known readAt.
   */
  const handleWaStatusUpdate = useCallback(
    (data: WaStatusWsPayload) => {
      if (!data?.waMessageId) return;

      // Status updates don't know which thread the message is in
      // (the WS payload carries `waMessageId` only, not phone), so
      // scan every thread for the matching id and patch in place.
      // Map across all messages: identity for non-matches, patched
      // copy for the match. `mapWaMessages` short-circuits the
      // cache write when nothing changed.
      mapWaMessages(queryClient, null, (m) => {
        if (m.waMessageId !== data.waMessageId) return m;
        return {
          ...m,
          status: data.status,
          ...(data.sentAt !== undefined ? { sentAt: data.sentAt } : {}),
          ...(data.deliveredAt !== undefined ? { deliveredAt: data.deliveredAt } : {}),
          ...(data.readAt !== undefined ? { readAt: data.readAt } : {}),
          ...(data.failedAt !== undefined ? { failedAt: data.failedAt } : {}),
          ...(data.failureReason !== undefined ? { failureReason: data.failureReason } : {}),
          ...(data.errorCode !== undefined ? { errorCode: data.errorCode } : {}),
        };
      });
    },
    [queryClient]
  );

  // === WA_REACTION ===

  /**
   * Reaction update — modifies an existing bubble's `reactionEmoji`
   * rather than adding a new message.
   */
  const handleWaReaction = useCallback(
    (data: WaReactionWsPayload) => {
      if (!data?.waMessageId) return;

      mapWaMessages(queryClient, null, (m) =>
        m.waMessageId === data.waMessageId ? { ...m, reactionEmoji: data.emoji } : m
      );
    },
    [queryClient]
  );

  // === WA_READ ===

  /**
   * Cross-device read sync — mark the thread + drop unread badge
   * when the same user reads in another tab/session.
   */
  const handleWaRead = useCallback(
    (payload: WaReadWsPayload) => {
      if (!payload?.phoneNumber) return;

      const otherPhone = normalizePhone(payload.phoneNumber);

      // 1. Update conversations cache (set unreadCount to 0) — handles both shapes.
      updateWaConversationsCache(queryClient, (conversations) =>
        conversations.map((c) =>
          normalizePhone(c.phoneNumber) === otherPhone ? { ...c, unreadCount: 0 } : c
        )
      );

      // 2. Mark every inbound message in every page as read-by-user.
      mapWaMessages(queryClient, otherPhone, (m) =>
        m.direction === 'inbound' && !m.readByUser ? { ...m, readByUser: true } : m
      );

      // 3. Update the global unread count scalar — server truth only.
      //
      // We INTENTIONALLY do not decrement the cache here. WA_READ is a
      // broadcast event: the server fans it out to the actor's phone
      // room AND the entire org room. Any decrement we apply here would
      // wrongly affect:
      //   - Other agents in the same org who never had those N items in
      //     their per-user scope (they'd underflow to 0).
      //   - Managers viewing org-wide counts, where the math is correct
      //     in principle but races with their initial fetch on refresh,
      //     producing the "bell briefly shows 1, then vanishes" symptom.
      //
      // The actor's own instant-feedback decrement is handled by
      // useWaMarkAsRead.onMutate (mutation hook) — same tab, same
      // intent, math is safe. Cross-tab and cross-device sync goes
      // through this WS handler and trusts the server via invalidate.
      // Matches the pattern used by the WA Calls bell which doesn't
      // exhibit this drift.
      queryClient.invalidateQueries({
        queryKey: waMessagesKeys.unreadCount(),
        refetchType: 'active',
      });
    },
    [queryClient]
  );

  // === WA_DELETED ===

  /**
   * Soft-delete from another session — strip the messages from every
   * page so the UI hides them without a refresh.
   */
  const handleWaDeleted = useCallback(
    (payload: WaDeletedWsPayload) => {
      if (!payload?.messageIds?.length) return;
      removeWaMessages(queryClient, null, new Set(payload.messageIds));
    },
    [queryClient]
  );

  // === WA_CONVERSATION_DELETED ===

  /**
   * A whole conversation was deleted in another tab/device — drop it
   * from the list and discard cached messages so the UI cleans up
   * without a refresh.
   */
  const handleWaConversationDeleted = useCallback(
    (payload: WaConversationDeletedWsPayload) => {
      if (!payload?.phoneNumber) return;
      const normalizedPhone = normalizePhone(payload.phoneNumber);

      updateWaConversationsCache(queryClient, (conversations) =>
        conversations.filter((c) => normalizePhone(c.phoneNumber) !== normalizedPhone)
      );

      queryClient.removeQueries({
        queryKey: ['wa-messages', 'thread', normalizedPhone],
        exact: false,
      });

      queryClient.invalidateQueries({ queryKey: waMessagesKeys.unreadCount() });
    },
    [queryClient]
  );

  // === WA_CONFIG_UPDATED ===

  /**
   * Config change (token rotation, number reassignment, etc.) — bust
   * everything that depends on the active credential set.
   */
  const handleWaConfigUpdated = useCallback(
    (_payload: WaConfigUpdatedWsPayload) => {
      queryClient.invalidateQueries({ queryKey: waMessagesKeys.status() });
      queryClient.invalidateQueries({ queryKey: waMessagesKeys.templates() });
      queryClient.invalidateQueries({ queryKey: waMessagesKeys.windows() });
    },
    [queryClient]
  );

  // === WA_USAGE_UPDATE ===

  const handleWaUsageUpdate = useCallback(
    (_data: unknown) => {
      queryClient.invalidateQueries({ queryKey: waMessagesKeys.usage() });
    },
    [queryClient]
  );

  // === Register listeners ===

  useEffect(() => {
    if (!socket || !isConnected) return;

    socket.on(REALTIME_EVENTS.WA_RECEIVED, handleWaReceived);
    socket.on(REALTIME_EVENTS.WA_SENT, handleWaSent);
    socket.on(REALTIME_EVENTS.WA_STATUS, handleWaStatusUpdate);
    socket.on(REALTIME_EVENTS.WA_REACTION, handleWaReaction);
    socket.on(REALTIME_EVENTS.WA_READ, handleWaRead);
    socket.on(REALTIME_EVENTS.WA_DELETED, handleWaDeleted);
    socket.on(REALTIME_EVENTS.WA_CONVERSATION_DELETED, handleWaConversationDeleted);
    socket.on(REALTIME_EVENTS.WA_USAGE_UPDATE, handleWaUsageUpdate);
    socket.on(REALTIME_EVENTS.WA_CONFIG_UPDATED, handleWaConfigUpdated);

    return () => {
      socket.off(REALTIME_EVENTS.WA_RECEIVED, handleWaReceived);
      socket.off(REALTIME_EVENTS.WA_SENT, handleWaSent);
      socket.off(REALTIME_EVENTS.WA_STATUS, handleWaStatusUpdate);
      socket.off(REALTIME_EVENTS.WA_REACTION, handleWaReaction);
      socket.off(REALTIME_EVENTS.WA_READ, handleWaRead);
      socket.off(REALTIME_EVENTS.WA_DELETED, handleWaDeleted);
      socket.off(REALTIME_EVENTS.WA_CONVERSATION_DELETED, handleWaConversationDeleted);
      socket.off(REALTIME_EVENTS.WA_USAGE_UPDATE, handleWaUsageUpdate);
      socket.off(REALTIME_EVENTS.WA_CONFIG_UPDATED, handleWaConfigUpdated);
    };
  }, [
    socket,
    isConnected,
    handleWaReceived,
    handleWaSent,
    handleWaStatusUpdate,
    handleWaReaction,
    handleWaRead,
    handleWaDeleted,
    handleWaConversationDeleted,
    handleWaUsageUpdate,
    handleWaConfigUpdated,
  ]);
}
