'use client';

/**
 * WhatsApp Conversation Query Hooks
 *
 * Handles fetching WhatsApp conversation lists, status, windows, and templates:
 * - useWaStatus: Check if WhatsApp is enabled + configured
 * - useWaConversationsPaginated: Paginated conversations
 * - useWaUnreadCount: Unread message count
 * - useWaConversationWindows: All active 24h windows
 * - useWaConversationWindow: Single window for a contact
 * - useWaTemplates: Approved templates for the user
 *
 * @module lib/hooks/useWaConversationQueries
 */

import { useQuery, useInfiniteQuery, skipToken, useQueryClient } from '@tanstack/react-query';
import { whatsappService, type WaConversationQueryParams } from '@/lib/api';
import { getApprovedTemplates, type ConversationWindow } from '@/lib/api/services/whatsapp.api';
import { REALTIME_QUERY_CONFIG } from '@/lib/constants/query';
import { normalizePhone } from '@/lib/utils/phone';
import { waMessagesKeys } from './useWaMessages';

/**
 * Hook to check WhatsApp status (enabled + configured)
 * Uses real-time config - status updated via WebSocket events
 */
export function useWaStatus() {
  return useQuery({
    queryKey: waMessagesKeys.status(),
    queryFn: () => whatsappService.getStatus(),
    ...REALTIME_QUERY_CONFIG,
  });
}

/**
 * Hook to fetch WhatsApp conversations with pagination
 * Uses real-time config - data updated via WebSocket events
 */
export function useWaConversationsPaginated(params: WaConversationQueryParams = {}) {
  return useQuery({
    queryKey: waMessagesKeys.conversationsPaginated(params),
    queryFn: () => whatsappService.getConversationsPaginated(params),
    ...REALTIME_QUERY_CONFIG,
  });
}

/**
 * Hook to fetch WhatsApp conversations with infinite scroll pagination.
 * Fetches 50 conversations per page and loads more as the user scrolls.
 */
export function useWaConversationsInfinite(params: { search?: string } = {}) {
  const limit = 50;
  const searchParam = params.search || undefined;

  return useInfiniteQuery({
    queryKey: [...waMessagesKeys.conversations(), 'infinite', { search: searchParam }] as const,
    queryFn: async ({ pageParam = 1 }) => {
      return whatsappService.getConversationsPaginated({
        page: pageParam,
        limit,
        search: searchParam,
      });
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      if (lastPage.page < lastPage.totalPages) {
        return lastPage.page + 1;
      }
      return undefined;
    },
    ...REALTIME_QUERY_CONFIG,
    refetchOnMount: 'always',
  });
}

/**
 * Hook to fetch WhatsApp unread message count
 * Uses real-time config - count updated via WebSocket events
 */
export function useWaUnreadCount() {
  return useQuery({
    queryKey: waMessagesKeys.unreadCount(),
    queryFn: () => whatsappService.getUnreadCount(),
    ...REALTIME_QUERY_CONFIG,
  });
}

/**
 * Hook to fetch all active WhatsApp 24h conversation windows
 * Uses real-time config - windows updated via WebSocket events
 */
export function useWaConversationWindows() {
  return useQuery({
    queryKey: waMessagesKeys.windows(),
    queryFn: () => whatsappService.getConversationWindows(),
    ...REALTIME_QUERY_CONFIG,
  });
}

/**
 * Hook to fetch a single WhatsApp conversation window for a contact.
 *
 * Reads `placeholderData` from the org-wide windows list cache (already
 * loaded by the conversation page via `useWaConversationWindows`) so the
 * composer can render the correct "free-form" vs "send template" UI on
 * first click — no flicker while the per-contact query refetches in the
 * background.
 *
 * Expiry guard: the list is cached with its own staleTime, so an entry
 * may have just passed its `windowEnd`. We check the timestamp before
 * trusting the placeholder; if expired, we return undefined → composer
 * correctly shows "send template" while the per-contact query confirms.
 *
 * @param phoneNumber - The phone number to check window for (null to disable)
 */
export function useWaConversationWindow(phoneNumber: string | null) {
  const queryClient = useQueryClient();
  const normalizedPhone = phoneNumber ? normalizePhone(phoneNumber) : null;

  return useQuery({
    queryKey: waMessagesKeys.window(normalizedPhone || ''),
    queryFn: normalizedPhone
      ? () => whatsappService.getConversationWindow(normalizedPhone)
      : skipToken,
    placeholderData: (): ConversationWindow | undefined => {
      if (!normalizedPhone) return undefined;
      const list = queryClient.getQueryData<ConversationWindow[]>(waMessagesKeys.windows());
      if (!list) return undefined;
      const hit = list.find((w) => normalizePhone(w.contactPhone) === normalizedPhone);
      if (!hit) return undefined;
      // Skip stale list entries that have already expired since the
      // last list refetch — otherwise the composer briefly says
      // "free-form OK" for an expired window and the user types a
      // message that 400s on send.
      if (new Date(hit.windowEnd).getTime() <= Date.now()) return undefined;
      return hit;
    },
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    // If a WS event ever drops during a reconnect gap, tab focus recovers
    // the latest windowEnd — small safety net behind the WS-driven cache
    // updates that handle the happy path.
    refetchOnWindowFocus: true,
    retry: 2,
  });
}

/**
 * Hook to fetch approved WhatsApp templates for the user
 */
export function useWaTemplates() {
  return useQuery({
    queryKey: waMessagesKeys.templates(),
    queryFn: () => getApprovedTemplates(),
    staleTime: 5 * 60 * 1000, // Templates change infrequently
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 2,
  });
}
