'use client';

/**
 * useWaOversightConversations
 *
 * Manager-side hook for the WhatsApp Oversight page's conversation list.
 * Returns the cross-agent conversation list for the manager's org (or
 * any org, if the caller is a platform admin and passes `orgId`).
 *
 * Pagination is infinite — each page is 50 rows, sorted by latest
 * activity. Filters (`search`, `agentUserId`, `unreadOnly`) reset the
 * query key so React Query starts fresh when they change.
 *
 * Real-time freshness comes from the same WS events that power the
 * regular WhatsApp page — `wa:received` and `wa:sent` get fanned to the
 * org room, and the oversight page's parent invalidates this query on
 * arrival. We don't subscribe here directly because the parent owns the
 * socket effect and dispatches invalidations centrally.
 *
 * @module lib/hooks/useWaOversightConversations
 */

import { useInfiniteQuery } from '@tanstack/react-query';
import {
  getOversightConversations,
  type WaOversightConversationsParams,
} from '@/lib/api/services/whatsapp.api';
import { REALTIME_QUERY_CONFIG } from '@/lib/constants/query';

const PAGE_SIZE = 50;

export const waOversightKeys = {
  all: ['whatsapp', 'oversight'] as const,
  conversations: (filters: Omit<WaOversightConversationsParams, 'page' | 'limit'>) =>
    [...waOversightKeys.all, 'conversations', filters] as const,
  messages: (customerPhone: string, orgId?: number) =>
    [...waOversightKeys.all, 'messages', customerPhone, orgId ?? null] as const,
  agents: (orgId?: number) => [...waOversightKeys.all, 'agents', orgId ?? null] as const,
};

export function useWaOversightConversations(
  filters: Omit<WaOversightConversationsParams, 'page' | 'limit'> = {}
) {
  // Normalize filter values so cache keys stay stable across cosmetic
  // changes (e.g. empty string vs undefined search).
  const stableFilters = {
    search: filters.search?.trim() || undefined,
    agentUserId: typeof filters.agentUserId === 'number' ? filters.agentUserId : undefined,
    unreadOnly: filters.unreadOnly || undefined,
    orgId: typeof filters.orgId === 'number' ? filters.orgId : undefined,
  };

  return useInfiniteQuery({
    queryKey: waOversightKeys.conversations(stableFilters),
    queryFn: async ({ pageParam = 1 }) => {
      return getOversightConversations({
        ...stableFilters,
        page: pageParam,
        limit: PAGE_SIZE,
      });
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      const totalPages = Math.max(1, Math.ceil(lastPage.total / lastPage.limit));
      return lastPage.page < totalPages ? lastPage.page + 1 : undefined;
    },
    ...REALTIME_QUERY_CONFIG,
    refetchOnMount: 'always',
  });
}
