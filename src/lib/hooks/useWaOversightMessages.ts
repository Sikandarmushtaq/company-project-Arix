'use client';

/**
 * useWaOversightMessages
 *
 * Manager-side hook for the read-only message thread on the oversight
 * page. Cursor-paginated (by ISO timestamp `before`) so the UI can do
 * "scroll up = load older" without page math.
 *
 * Key vs the agent-facing `useWaMessages`:
 *   - org-scoped on the server (manager sees the full unfiltered
 *     timeline; per-user "delete for me" entries are NOT applied)
 *   - no mutations exported — this is a read surface
 *   - oldest-first display order is the consumer's job; the API returns
 *     `created_at DESC` so the latest page sits at the head of `messages`
 *
 * The hook is `enabled: !!customerPhone` — passing `null` disables the
 * query entirely, useful when no conversation is selected yet.
 *
 * @module lib/hooks/useWaOversightMessages
 */

import { useInfiniteQuery } from '@tanstack/react-query';
import { getOversightMessages } from '@/lib/api/services/whatsapp.api';
import { REALTIME_QUERY_CONFIG } from '@/lib/constants/query';
import { waOversightKeys } from './useWaOversightConversations';

const PAGE_SIZE = 100;

export function useWaOversightMessages(customerPhone: string | null, orgId?: number) {
  return useInfiniteQuery({
    queryKey: waOversightKeys.messages(customerPhone ?? '', orgId),
    enabled: !!customerPhone,
    queryFn: async ({ pageParam }) => {
      // Server treats undefined `before` as "from the head"; for older
      // pages we pass the oldest seen timestamp as the cursor.
      return getOversightMessages(customerPhone!, {
        limit: PAGE_SIZE,
        before: pageParam ?? undefined,
        orgId,
      });
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => {
      // Cursor for the next (older) page = the oldest `createdAt` in
      // this page. Server returns DESC, so the last element is oldest.
      if (lastPage.messages.length < PAGE_SIZE) return undefined;
      const last = lastPage.messages[lastPage.messages.length - 1];
      return last?.createdAt;
    },
    ...REALTIME_QUERY_CONFIG,
    refetchOnMount: 'always',
  });
}
