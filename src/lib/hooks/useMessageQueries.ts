'use client';

/**
 * Message Query Hooks
 *
 * Handles fetching messages for specific conversations:
 * - useMessages (legacy)
 * - useMessagesPaginated
 * - useSearchMessages
 *
 * @module lib/hooks/useMessageQueries
 */

import { useEffect, useRef } from 'react';
import { useQuery, skipToken } from '@tanstack/react-query';
import { smsService, type MessageQueryParams, type SearchMessagesParams } from '@/lib/api';
import { normalizePhone } from '@/lib/utils/phone';
import { messagesKeys } from './useMessages';

/**
 * Hook to fetch messages for a specific conversation with pagination
 *
 * @param phoneNumber - The phone number of the conversation
 * @param params - Pagination and search parameters (page, limit, search)
 */
export function useMessagesPaginated(phoneNumber: string | null, params: MessageQueryParams = {}) {
  const normalizedPhone = phoneNumber ? normalizePhone(phoneNumber) : null;
  const fetchTriggeredForRef = useRef<string | null>(null);

  const query = useQuery({
    queryKey: messagesKeys.messagesPaginated(normalizedPhone || '', params),
    queryFn: normalizedPhone
      ? () =>
          smsService.getMessagesPaginated(normalizedPhone, {
            page: params.page || 1,
            limit: params.limit || 50,
            search: params.search,
          })
      : skipToken,
    staleTime: 30 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 2,
  });

  // Dependent query workaround: global refetchOnMount: false (QueryProvider)
  // prevents the initial fetch when the query transitions from disabled to
  // enabled. requestAnimationFrame defers until the query observer is fully
  // subscribed to the new key after React commits the render.
  useEffect(() => {
    if (normalizedPhone && fetchTriggeredForRef.current !== normalizedPhone) {
      fetchTriggeredForRef.current = normalizedPhone;
      requestAnimationFrame(() => {
        query.refetch();
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [normalizedPhone]);

  return query;
}

/**
 * Hook to fetch messages for a specific conversation (legacy - no pagination)
 * @deprecated Use useMessagesPaginated for better performance
 */
export function useMessagesLegacy(phoneNumber: string | null) {
  return useQuery({
    queryKey: messagesKeys.messages(phoneNumber || ''),
    queryFn: () => smsService.getMessages(phoneNumber!),
    enabled: !!phoneNumber,
    ...({ staleTime: 30 * 1000, gcTime: 5 * 60 * 1000, refetchOnWindowFocus: false } as const),
  });
}

/**
 * Hook to search messages globally across all conversations
 * @param params - Search parameters (q, page, limit)
 */
export function useSearchMessages(params: SearchMessagesParams | null) {
  return useQuery({
    queryKey: messagesKeys.search(params || { q: '' }),
    queryFn: () => smsService.searchMessages(params!),
    enabled: !!params?.q && params.q.length >= 2,
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
  });
}
