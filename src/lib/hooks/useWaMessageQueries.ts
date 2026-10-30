'use client';

/**
 * WhatsApp Message Query Hooks
 *
 * Handles fetching WhatsApp messages for specific conversations:
 * - useWaMessagesInfinite: Cursor-paginated thread (scroll-up to load older)
 * - useWaSearchMessages: Full-text search across all WA messages
 *
 * The server uses a `before` ISO-timestamp cursor — page numbers are
 * ignored. The hook mirrors `useWaOversightMessages` so both surfaces
 * share the same data-fetching contract.
 *
 * @module lib/hooks/useWaMessageQueries
 */

import { useInfiniteQuery, useQuery, skipToken } from '@tanstack/react-query';
import { whatsappService, type WaSearchParams } from '@/lib/api';
import { normalizePhone } from '@/lib/utils/phone';
import { waMessagesKeys } from './useWaMessages';
import { WA_MESSAGES_PER_PAGE } from '@/app/phone/whatsapp/_components/types';

/**
 * Hook to fetch WhatsApp messages for a specific conversation,
 * cursor-paginated for "load older on scroll up." Server returns
 * messages newest-first (DESC), so the LAST element of each page is
 * the oldest — that timestamp becomes the next page's `before` cursor.
 *
 * Disabled (returns nothing) when `phoneNumber` is null.
 *
 * The query key uses the same `['wa-messages', 'thread', phone, ...]`
 * prefix as the legacy non-infinite hook, so all existing realtime
 * invalidations and optimistic-update writes (in
 * `useWaMessageMutations` and `useRealtimeWaSync`) still match via
 * `exact: false`. Mutation helpers know about both cache shapes — see
 * `updateWaMessagesCache` in `useWaMessageMutations`.
 *
 * @param phoneNumber  Customer phone (null to disable the query).
 * @param search       Optional in-thread search term. Changing it resets pagination.
 */
export function useWaMessagesInfinite(phoneNumber: string | null, search?: string) {
  const normalizedPhone = phoneNumber ? normalizePhone(phoneNumber) : null;
  const trimmedSearch = search?.trim() || undefined;

  return useInfiniteQuery({
    queryKey: waMessagesKeys.messagesPaginated(normalizedPhone || '', {
      search: trimmedSearch,
    }),
    enabled: !!normalizedPhone,
    queryFn: normalizedPhone
      ? async ({ pageParam }) => {
          return whatsappService.getMessages(normalizedPhone, {
            limit: WA_MESSAGES_PER_PAGE,
            before: pageParam ?? undefined,
            search: trimmedSearch,
          });
        }
      : skipToken,
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => {
      // A short page means we've hit the start of the conversation.
      if (lastPage.messages.length < WA_MESSAGES_PER_PAGE) return undefined;
      // Server returns DESC, so the oldest message is the last in the page.
      const oldest = lastPage.messages[lastPage.messages.length - 1];
      return oldest?.createdAt;
    },
    staleTime: 30 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: 'always',
  });
}

/**
 * Hook to search WhatsApp messages globally across all conversations
 * @param params - Search parameters (q, page, limit)
 */
export function useWaSearchMessages(params: WaSearchParams | null) {
  return useQuery({
    queryKey: waMessagesKeys.search(params || { q: '' }),
    queryFn: () => whatsappService.searchMessages(params!),
    enabled: !!params?.q && params.q.length >= 2,
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
  });
}
