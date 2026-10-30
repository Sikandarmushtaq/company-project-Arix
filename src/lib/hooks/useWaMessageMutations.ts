'use client';

/**
 * WhatsApp Message Mutation Hooks
 *
 * Handles all WhatsApp message-related mutations with optimistic updates:
 * - useWaSendMessage: Send text/media message
 * - useWaSendTemplate: Send template message (invalidates window cache)
 * - useWaDeleteMessages: Soft-delete specific messages
 * - useWaDeleteConversation: Soft-delete entire conversation
 * - useWaMarkAsRead: Mark conversation as read
 *
 * @module lib/hooks/useWaMessageMutations
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  whatsappService,
  type WaMessage,
  type SendWaMessageRequest,
  type PaginatedWaMessagesResponse,
  type PaginatedWaConversationsResponse,
  type WaConversation,
  type WaMessageWsPayload,
} from '@/lib/api';
import { normalizePhone } from '@/lib/utils/phone';
import { waMessagesKeys } from './useWaMessages';

type QueryClient = ReturnType<typeof useQueryClient>;

// ============================================================
// Helper: update WA conversations in both regular and infinite caches
// ============================================================

/**
 * Update WhatsApp conversations cache — handles both PaginatedWaConversationsResponse
 * (regular useQuery) and InfiniteData<PaginatedWaConversationsResponse> (useInfiniteQuery).
 *
 * The infinite query key is [...conversations(), 'infinite', ...] so `exact: false`
 * on the `conversations()` prefix matches both. But the data shapes differ:
 * - Regular: { conversations: [...], total, page, ... }
 * - Infinite: { pages: [{ conversations: [...] }, ...], pageParams: [...] }
 */
export function updateWaConversationsCache(
  queryClient: ReturnType<typeof useQueryClient>,
  updater: (conversations: WaConversation[], pageIndex: number) => WaConversation[]
): void {
  queryClient.setQueriesData<unknown>(
    { queryKey: waMessagesKeys.conversations(), exact: false },
    (old: unknown) => {
      if (!old || typeof old !== 'object') return old;

      // InfiniteData shape: { pages: [...], pageParams: [...] }
      //
      // `pageIndex` is forwarded so callers that prepend NEW entries
      // (e.g. WA_RECEIVED for a customer not yet in the list) can
      // restrict the insert to page 0 only. Without that guard the
      // prepend ran on every page and produced duplicate rows after
      // the user scrolled — visible as the same conversation appearing
      // once per loaded page. Callers that only mutate existing rows
      // (mark-as-read, move-to-top within a page) can ignore the index.
      if ('pages' in old && Array.isArray((old as Record<string, unknown>).pages)) {
        const infiniteData = old as {
          pages: PaginatedWaConversationsResponse[];
          pageParams: unknown[];
        };
        return {
          ...infiniteData,
          pages: infiniteData.pages.map((page, pageIndex) => ({
            ...page,
            conversations: updater(page.conversations, pageIndex),
          })),
        };
      }

      // Regular PaginatedWaConversationsResponse shape — treat as
      // page 0 for callers that condition on pageIndex.
      const paginated = old as PaginatedWaConversationsResponse;
      if (paginated.conversations) {
        return {
          ...paginated,
          conversations: updater(paginated.conversations, 0),
        };
      }

      return old;
    }
  );
}

// ============================================================
// Thread cache helpers (message operations)
// ============================================================
//
// Public API:
//   - prependWaMessage          insert at head of newest page
//   - replaceWaMessage          find-and-replace across all pages
//   - replaceOrPrependWaMessage replace if found, otherwise prepend
//   - removeWaMessages          filter out by id set, across all pages
//   - mapWaMessages             arbitrary per-message transform, all pages
//   - coerceWaMessage           normalize a WS payload to a full WaMessage
//
// Each operation knows about both cache shapes (legacy `{ messages,
// total }` from non-infinite callers + `{ pages: [{ messages, total }],
// pageParams }` from `useWaMessagesInfinite`). Callers never deal with
// the shape, just the intent.
//
// The internal `applyPagesUpdater` primitive does the shape-aware
// dispatch; everything else composes on top.

type PagesScope = 'head' | 'all';

interface MessagePagesFilter {
  /** Restricts the write to a single customer's thread when set.
   *  Omit to fan out across every thread cache (used by global
   *  delete events and the mark-read scan). */
  phone?: string;
}

/**
 * Internal: apply `updater` to a thread cache's messages, on either
 * just the head page or every page, in both cache shapes.
 *
 * Returns `true` if any cache was touched (the user has the thread
 * open and there's data to write to); `false` if no matching cache
 * exists yet — callers can then invalidate to trigger a fresh fetch.
 *
 * Not exported. Callers use the named operations below.
 */
function applyPagesUpdater(
  queryClient: QueryClient,
  filter: MessagePagesFilter,
  updater: (messages: WaMessage[]) => WaMessage[],
  scope: PagesScope
): boolean {
  const queryKey = filter.phone
    ? (['wa-messages', 'thread', filter.phone] as const)
    : (['wa-messages', 'thread'] as const);

  let touched = false;

  queryClient.setQueriesData<unknown>({ queryKey, exact: false }, (old: unknown) => {
    if (!old || typeof old !== 'object') return old;

    // Infinite shape
    if ('pages' in old && Array.isArray((old as Record<string, unknown>).pages)) {
      const infinite = old as {
        pages: PaginatedWaMessagesResponse[];
        pageParams: unknown[];
      };
      if (infinite.pages.length === 0) return old;
      touched = true;

      if (scope === 'all') {
        return {
          ...infinite,
          pages: infinite.pages.map((page) => {
            const next = updater(page.messages);
            if (next === page.messages) return page;
            const delta = page.messages.length - next.length;
            return { ...page, messages: next, total: Math.max(0, page.total - delta) };
          }),
        };
      }

      // head scope: only touch page[0] (newest messages)
      const head = infinite.pages[0];
      const nextMessages = updater(head.messages);
      if (nextMessages === head.messages) return old;
      const delta = nextMessages.length - head.messages.length;
      const newPages = infinite.pages.slice();
      newPages[0] = {
        ...head,
        messages: nextMessages,
        total: Math.max(0, head.total + delta),
      };
      return { ...infinite, pages: newPages };
    }

    // Legacy regular shape — single page, no scope distinction needed
    const regular = old as PaginatedWaMessagesResponse;
    if (regular.messages) {
      touched = true;
      const next = updater(regular.messages);
      if (next === regular.messages) return old;
      const delta = next.length - regular.messages.length;
      return { ...regular, messages: next, total: Math.max(0, regular.total + delta) };
    }
    return old;
  });

  return touched;
}

/**
 * Prepend a message to the head page of a customer's thread cache.
 * Dedupes against an existing entry with the same id.
 *
 * Use for brand-new inbound/outbound messages (`WA_RECEIVED` not
 * matching an existing id; optimistic placeholders on send;
 * `WA_SENT` falling through after no replace target was found).
 *
 * @returns `true` if a cache existed and was updated; `false` if no
 *   cache was present (caller may want to invalidate).
 */
export function prependWaMessage(
  queryClient: QueryClient,
  phone: string,
  message: WaMessage
): boolean {
  return applyPagesUpdater(
    queryClient,
    { phone },
    (msgs) => {
      if (msgs.some((m) => m.id === message.id)) return msgs;
      return [message, ...msgs];
    },
    'head'
  );
}

/**
 * Find a message in any page (via `matcher`) and replace it with
 * `message`. Returns both flags so composite ops can decide whether
 * to follow up with a prepend.
 *
 * Use for in-place updates that don't add a new message: `WA_STATUS`
 * (status field changes), `WA_REACTION` (reactionEmoji), or the
 * "real id arrived" case of `WA_SENT`.
 */
export function replaceWaMessage(
  queryClient: QueryClient,
  phone: string,
  matcher: (m: WaMessage) => boolean,
  message: WaMessage
): { touched: boolean; replaced: boolean } {
  let replaced = false;
  const touched = applyPagesUpdater(
    queryClient,
    { phone },
    (msgs) => {
      const idx = msgs.findIndex(matcher);
      if (idx === -1) return msgs;
      replaced = true;
      const next = msgs.slice();
      next[idx] = message;
      return next;
    },
    'all'
  );
  return { touched, replaced };
}

/**
 * Replace a message in the thread cache (anywhere, any page) if a
 * matcher finds it; otherwise prepend at the head. The right shape
 * for realtime confirm events that might be (a) a known id, (b) an
 * optimistic-placeholder match, or (c) brand new. Three cases in one
 * call site.
 *
 * @returns `true` if any cache existed; `false` if not (caller may
 *   want to invalidate).
 */
export function replaceOrPrependWaMessage(
  queryClient: QueryClient,
  phone: string,
  matcher: (m: WaMessage) => boolean,
  message: WaMessage
): boolean {
  const { touched, replaced } = replaceWaMessage(queryClient, phone, matcher, message);
  if (!touched) return false;
  if (!replaced) prependWaMessage(queryClient, phone, message);
  return true;
}

/**
 * Remove messages by id from every page of one thread, or across
 * every thread when `phone` is omitted. Use for soft-deletes and
 * optimistic-rollback on a failed send.
 */
export function removeWaMessages(
  queryClient: QueryClient,
  phone: string | null,
  ids: ReadonlySet<number>
): boolean {
  if (ids.size === 0) return false;
  return applyPagesUpdater(
    queryClient,
    phone ? { phone } : {},
    (msgs) => {
      if (!msgs.some((m) => ids.has(m.id))) return msgs;
      return msgs.filter((m) => !ids.has(m.id));
    },
    'all'
  );
}

/**
 * Map every message in every page through `mapper`. Mapper MUST
 * return the same array reference when no change is needed (use
 * `m => m` for non-matching messages); the helper short-circuits
 * the cache write on reference-equality, so this is the cheap
 * default for "I'm not sure if anything actually changed."
 *
 * Use for `WA_READ` (mark inbound messages read) and other bulk
 * transformations that don't add or remove messages.
 */
export function mapWaMessages(
  queryClient: QueryClient,
  phone: string | null,
  mapper: (m: WaMessage) => WaMessage
): boolean {
  return applyPagesUpdater(
    queryClient,
    phone ? { phone } : {},
    (msgs) => {
      let changed = false;
      const next = msgs.map((m) => {
        const mapped = mapper(m);
        if (mapped !== m) changed = true;
        return mapped;
      });
      return changed ? next : msgs;
    },
    'all'
  );
}

/**
 * Normalize a realtime WS payload into a full `WaMessage`. The
 * payload is shaped as a full message row plus the server-side
 * enrichments `contactName` / `windowEnd` — but versions of the
 * backend drift, so we backfill any missing field with a sensible
 * default rather than rely on the input being complete. Eliminates
 * the previous `as unknown as WaMessage` foot-guns (where reads of
 * `costCents`, `organizationId`, etc. could come back undefined).
 */
export function coerceWaMessage(payload: WaMessageWsPayload): WaMessage {
  const now = new Date().toISOString();
  return {
    id: payload.id,
    waMessageId: payload.waMessageId ?? null,
    sender: payload.sender ?? '',
    receiver: payload.receiver ?? '',
    direction: payload.direction ?? 'inbound',
    messageType: payload.messageType ?? 'text',
    body: payload.body ?? null,
    mediaId: payload.mediaId ?? null,
    mediaUrl: payload.mediaUrl ?? null,
    mediaMimeType: payload.mediaMimeType ?? null,
    mediaFilename: payload.mediaFilename ?? null,
    latitude: payload.latitude ?? null,
    longitude: payload.longitude ?? null,
    locationName: payload.locationName ?? null,
    locationAddress: payload.locationAddress ?? null,
    templateName: payload.templateName ?? null,
    templateLanguage: payload.templateLanguage ?? null,
    reactionEmoji: payload.reactionEmoji ?? null,
    reactionMessageId: payload.reactionMessageId ?? null,
    contextMessageId: payload.contextMessageId ?? null,
    interactiveType: payload.interactiveType ?? null,
    interactiveData: payload.interactiveData ?? null,
    status: payload.status ?? 'pending',
    failureReason: payload.failureReason ?? null,
    errorCode: payload.errorCode ?? null,
    readByUser: payload.readByUser ?? false,
    organizationId: payload.organizationId ?? null,
    userPhone: payload.userPhone ?? null,
    conversationCategory: payload.conversationCategory ?? null,
    costCents: payload.costCents ?? 0,
    sentAt: payload.sentAt ?? null,
    deliveredAt: payload.deliveredAt ?? null,
    readAt: payload.readAt ?? null,
    failedAt: payload.failedAt ?? null,
    createdAt: payload.createdAt ?? now,
    updatedAt: payload.updatedAt ?? now,
  };
}

/**
 * Find unread count from WA conversations caches (both regular and infinite)
 */
export function findWaUnreadCount(
  queryClient: ReturnType<typeof useQueryClient>,
  normalizedPhone: string
): number {
  const allData = queryClient.getQueriesData<unknown>({
    queryKey: waMessagesKeys.conversations(),
    exact: false,
  });

  for (const [, data] of allData) {
    if (!data || typeof data !== 'object') continue;

    // Infinite data
    if ('pages' in data && Array.isArray((data as Record<string, unknown>).pages)) {
      const infiniteData = data as { pages: PaginatedWaConversationsResponse[] };
      for (const page of infiniteData.pages) {
        const found = page.conversations?.find(
          (c) => normalizePhone(c.phoneNumber) === normalizedPhone
        );
        if (found && found.unreadCount > 0) return found.unreadCount;
      }
    }

    // Regular data
    const paginated = data as PaginatedWaConversationsResponse;
    if (paginated.conversations) {
      const found = paginated.conversations.find(
        (c) => normalizePhone(c.phoneNumber) === normalizedPhone
      );
      if (found && found.unreadCount > 0) return found.unreadCount;
    }
  }

  return 0;
}

/**
 * Hook to send a WhatsApp message (text or media)
 * Adds message directly to cache for instant UI update, then syncs with server
 */
export function useWaSendMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: SendWaMessageRequest) => whatsappService.sendMessage(data),
    onMutate: async (variables) => {
      const normalizedTo = normalizePhone(variables.to);

      // Reactions don't create new messages — skip optimistic insert
      if (variables.type === 'reaction') {
        return { optimisticId: 0, normalizedTo, isReaction: true };
      }

      await queryClient.cancelQueries({
        queryKey: ['wa-messages', 'thread', normalizedTo],
      });

      const optimisticId = -Date.now();
      const now = new Date().toISOString();
      const optimisticMessage: WaMessage = {
        id: optimisticId,
        waMessageId: null,
        sender: '',
        receiver: normalizedTo,
        direction: 'outbound',
        messageType: variables.type || 'text',
        body: variables.body || null,
        mediaId: null,
        mediaUrl: variables.mediaUrl || null,
        mediaMimeType: null,
        mediaFilename: variables.mediaFilename || null,
        latitude: variables.latitude || null,
        longitude: variables.longitude || null,
        locationName: variables.locationName || null,
        locationAddress: variables.locationAddress || null,
        templateName: null,
        templateLanguage: null,
        reactionEmoji: null,
        reactionMessageId: null,
        contextMessageId: variables.contextMessageId || null,
        interactiveType: null,
        interactiveData: null,
        status: 'pending',
        failureReason: null,
        errorCode: null,
        readByUser: true,
        organizationId: null,
        userPhone: null,
        conversationCategory: null,
        costCents: 0,
        sentAt: null,
        deliveredAt: null,
        readAt: null,
        failedAt: null,
        createdAt: now,
        updatedAt: now,
      };

      prependWaMessage(queryClient, normalizedTo, optimisticMessage);

      return { optimisticId, normalizedTo };
    },
    onError: (_err, _vars, context) => {
      if (context && !context.isReaction) {
        removeWaMessages(queryClient, context.normalizedTo, new Set([context.optimisticId]));
      }
    },
    onSuccess: (newMessage, variables, context) => {
      // Reactions are handled by the WA_REACTION WebSocket event — skip cache updates
      if (context?.isReaction) return;

      const normalizedTo = normalizePhone(variables.to);

      // Determine preview text
      const textContent = (newMessage.body || '').trim();
      const hasMedia = !!variables.mediaUrl;
      const previewText = textContent || (hasMedia ? 'Media' : '');

      // Settle the optimistic insert: drop it (if any) and place the
      // real message via replace-or-prepend so we end up with exactly
      // one entry, no matter whether the realtime WS event also
      // wrote it in.
      if (context?.optimisticId) {
        removeWaMessages(queryClient, normalizedTo, new Set([context.optimisticId]));
      }
      replaceOrPrependWaMessage(
        queryClient,
        normalizedTo,
        (m) => m.id === newMessage.id,
        newMessage
      );

      // 2. Update conversations list (move to top, update last message)
      queryClient.setQueriesData<PaginatedWaConversationsResponse>(
        { queryKey: waMessagesKeys.conversations(), exact: false },
        (old) => {
          if (!old?.conversations) return old;

          const existingIndex = old.conversations.findIndex(
            (c) => normalizePhone(c.phoneNumber) === normalizedTo
          );

          if (existingIndex >= 0) {
            const updated = [...old.conversations];
            const [existing] = updated.splice(existingIndex, 1);
            updated.unshift({
              ...existing,
              lastMessage: previewText,
              lastMessageType: newMessage.messageType,
              lastMessageTime: newMessage.createdAt,
            });
            return { ...old, conversations: updated };
          }

          // New conversation - add at top
          return {
            ...old,
            conversations: [
              {
                phoneNumber: normalizedTo,
                lastMessage: previewText,
                lastMessageType: newMessage.messageType,
                lastMessageTime: newMessage.createdAt,
                unreadCount: 0,
                contactName: null,
              },
              ...old.conversations,
            ],
            total: old.total + 1,
          };
        }
      );
    },
  });
}

/**
 * Hook to send a WhatsApp template message
 * Invalidates window cache after send (new 24h window may be opened)
 */
export function useWaSendTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: SendWaMessageRequest) => whatsappService.sendMessage(data),
    onSuccess: (newMessage, variables) => {
      const normalizedTo = normalizePhone(variables.to);
      const previewText =
        (newMessage.body || '').trim() || `Template: ${variables.templateName || 'unknown'}`;

      prependWaMessage(queryClient, normalizedTo, newMessage);

      // 2. Update conversations list
      queryClient.setQueriesData<PaginatedWaConversationsResponse>(
        { queryKey: waMessagesKeys.conversations(), exact: false },
        (old) => {
          if (!old?.conversations) return old;

          const existingIndex = old.conversations.findIndex(
            (c) => normalizePhone(c.phoneNumber) === normalizedTo
          );

          if (existingIndex >= 0) {
            const updated = [...old.conversations];
            const [existing] = updated.splice(existingIndex, 1);
            updated.unshift({
              ...existing,
              lastMessage: previewText,
              lastMessageType: 'template',
              lastMessageTime: newMessage.createdAt,
            });
            return { ...old, conversations: updated };
          }

          return {
            ...old,
            conversations: [
              {
                phoneNumber: normalizedTo,
                lastMessage: previewText,
                lastMessageType: 'template',
                lastMessageTime: newMessage.createdAt,
                unreadCount: 0,
                contactName: null,
              },
              ...old.conversations,
            ],
            total: old.total + 1,
          };
        }
      );

      // 3. Invalidate window cache (template opens a new 24h window)
      queryClient.invalidateQueries({ queryKey: waMessagesKeys.windows() });
      queryClient.invalidateQueries({
        queryKey: waMessagesKeys.window(normalizedTo),
      });
    },
  });
}

/**
 * Hook to delete specific WhatsApp messages within a conversation
 * Removes messages from cache for immediate UI update
 */
export function useWaDeleteMessages() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (messageIds: number[]) => whatsappService.deleteMessages(messageIds),
    onMutate: async (messageIds: number[]) => {
      await queryClient.cancelQueries({ queryKey: waMessagesKeys.all });

      // Snapshot ALL thread caches for rollback (both regular and infinite shapes).
      const previousThreads = queryClient.getQueriesData<unknown>({
        queryKey: ['wa-messages', 'thread'],
        exact: false,
      });

      // Optimistically remove messages from EVERY page of every thread.
      removeWaMessages(queryClient, null, new Set(messageIds));

      return { previousThreads, messageIds };
    },
    onError: (_err, _messageIds, context) => {
      // Rollback on error
      if (context?.previousThreads) {
        context.previousThreads.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: ['wa-messages', 'thread'],
        exact: false,
      });
    },
  });
}

/**
 * Hook to delete an entire WhatsApp conversation
 * Removes conversation from cache and clears messages for that phone number
 */
export function useWaDeleteConversation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (phoneNumber: string) => {
      const normalizedPhone = normalizePhone(phoneNumber);
      return whatsappService.deleteConversation(normalizedPhone);
    },
    onMutate: async (phoneNumber: string) => {
      const normalizedPhone = normalizePhone(phoneNumber);

      await queryClient.cancelQueries({ queryKey: waMessagesKeys.all });

      // Snapshot for rollback
      const previousConversations = queryClient.getQueriesData({
        queryKey: waMessagesKeys.conversations(),
        exact: false,
      });

      // Optimistically remove conversation from cache
      queryClient.setQueriesData<PaginatedWaConversationsResponse>(
        { queryKey: waMessagesKeys.conversations(), exact: false },
        (old) => {
          if (!old?.conversations) return old;
          const filtered = old.conversations.filter(
            (c) => normalizePhone(c.phoneNumber) !== normalizedPhone
          );
          return {
            ...old,
            conversations: filtered,
            total: Math.max(0, old.total - 1),
          };
        }
      );

      // Remove messages for this conversation from cache
      queryClient.removeQueries({
        queryKey: ['wa-messages', 'thread', normalizedPhone],
        exact: false,
      });

      return { previousConversations, normalizedPhone };
    },
    onError: (_err, _phoneNumber, context) => {
      if (context?.previousConversations) {
        context.previousConversations.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: waMessagesKeys.conversations() });
      queryClient.invalidateQueries({ queryKey: waMessagesKeys.unreadCount() });
    },
  });
}

/**
 * Hook to mark WhatsApp conversation as read
 * Updates all relevant caches for instant UI feedback
 */
export function useWaMarkAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (phoneNumber: string) => whatsappService.markAsRead(phoneNumber),
    onMutate: async (phoneNumber: string) => {
      const normalizedPhone = normalizePhone(phoneNumber);

      // SCOPED CANCEL CONTRACT:
      // `cancelQueries` MUST match (or be a subset of) the keys that
      // `onMutate` actually writes to optimistically. The optimistic
      // updates below touch:
      //   - waMessagesKeys.conversations() (conversation unreadCount → 0)
      //   - waMessagesKeys.unreadCount()   (global unread scalar)
      //   - thread cache via mapWaMessages (per-message readByUser flag)
      //
      // We INTENTIONALLY do NOT cancel the thread query. The thread fetch
      // can complete safely alongside our optimistic patch — when fresh
      // data lands it replaces the cache, and by then the server-side
      // markAsRead has committed so the fresh data already has
      // read_by_user=true. Cancelling the thread fetch instead causes
      // "click unread chat → doesn't load on first click": the
      // chat-selection's just-started thread fetch gets killed before
      // any data arrives, the query stays pending, the user sees the
      // empty state until they click a different chat and back.
      //
      // Don't expand this set without also expanding the optimistic
      // updates below — they MUST stay in lockstep.
      await Promise.all([
        queryClient.cancelQueries({ queryKey: waMessagesKeys.conversations(), exact: false }),
        queryClient.cancelQueries({ queryKey: waMessagesKeys.unreadCount() }),
      ]);

      // Snapshot for rollback
      const previousConversations = queryClient.getQueriesData({
        queryKey: waMessagesKeys.conversations(),
        exact: false,
      });
      const previousUnread = queryClient.getQueryData<number>(waMessagesKeys.unreadCount());

      // Find unread count from conversations cache (handles both regular and infinite)
      let unreadToMark = findWaUnreadCount(queryClient, normalizedPhone);

      // Default to 1 if not found in cache but we have unreads
      if (unreadToMark === 0) {
        const currentUnread = typeof previousUnread === 'number' ? previousUnread : 0;
        if (currentUnread > 0) {
          unreadToMark = 1;
        }
      }

      // 1. Set unreadCount to 0 in conversations cache (handles both regular and infinite)
      updateWaConversationsCache(queryClient, (conversations) =>
        conversations.map((c) =>
          normalizePhone(c.phoneNumber) === normalizedPhone ? { ...c, unreadCount: 0 } : c
        )
      );

      // 2. Mark every message in every page as read-by-user.
      mapWaMessages(queryClient, normalizedPhone, (m) =>
        m.readByUser ? m : { ...m, readByUser: true }
      );

      // 3. Decrease global unread count
      queryClient.setQueryData<number>(waMessagesKeys.unreadCount(), (old) => {
        const current = typeof old === 'number' ? old : 0;
        return Math.max(0, current - unreadToMark);
      });

      return { previousConversations, previousUnread, unreadToMark };
    },
    onError: (_err, _phoneNumber, context) => {
      // Rollback all caches on error
      if (context?.previousConversations) {
        context.previousConversations.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
      if (context?.previousUnread !== undefined) {
        queryClient.setQueryData(waMessagesKeys.unreadCount(), context.previousUnread);
      }
    },
    onSettled: () => {
      // Reconciliation — the optimistic `-N` in onMutate is for instant
      // user feedback (bell drops the moment they click), but we don't
      // fully trust the local arithmetic against multi-tab + org-scope
      // edge cases. Invalidating the scalar here triggers a single
      // server fetch that returns truth and snaps the bell to the
      // authoritative value. Active-only refetch keeps it cheap.
      //
      // (The WA_READ WS handler also fires this same invalidate, so a
      // cross-tab user gets reconciled even without this onSettled —
      // but having both means a single-tab user still reconciles
      // without depending on WS round-trip.)
      queryClient.invalidateQueries({
        queryKey: waMessagesKeys.unreadCount(),
        refetchType: 'active',
      });
    },
  });
}
