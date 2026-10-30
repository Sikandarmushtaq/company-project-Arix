'use client';

import { useQuery, useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';
import {
  callsService,
  type Call,
  type CallHistoryParams,
  type PaginatedCallsResponse,
} from '@/lib/api';
import { REALTIME_QUERY_CONFIG } from '@/lib/constants/query';
import { useAuthStore } from '@/lib/stores/auth';

// Query keys — include activePhone so switching phones triggers fresh fetch
export const callsKeys = {
  all: ['calls'] as const,
  list: (limit?: number, activePhone?: string) =>
    [...callsKeys.all, 'list', activePhone ?? '', limit] as const,
  paginated: (params?: CallHistoryParams, activePhone?: string) =>
    [...callsKeys.all, 'paginated', activePhone ?? '', params] as const,
  stats: (activePhone?: string) => [...callsKeys.all, 'stats', activePhone ?? ''] as const,
  unreadCount: (activePhone?: string) => [...callsKeys.all, 'unread', activePhone ?? ''] as const,
  unreadCalls: (limit?: number, activePhone?: string) =>
    [...callsKeys.all, 'unread-list', activePhone ?? '', limit] as const,
};

/**
 * Predicate helpers for matching query keys across all activePhone variants.
 * Mutations need these because they operate on all cached data regardless of phone.
 */
function isPaginatedCallQuery(queryKey: readonly unknown[]): boolean {
  return queryKey.length >= 2 && queryKey[0] === 'calls' && queryKey[1] === 'paginated';
}

function isListCallQuery(queryKey: readonly unknown[]): boolean {
  return queryKey.length >= 2 && queryKey[0] === 'calls' && queryKey[1] === 'list';
}

function isUnreadCountQuery(queryKey: readonly unknown[]): boolean {
  return queryKey.length >= 2 && queryKey[0] === 'calls' && queryKey[1] === 'unread';
}

function isUnreadCallsQuery(queryKey: readonly unknown[]): boolean {
  return queryKey.length >= 2 && queryKey[0] === 'calls' && queryKey[1] === 'unread-list';
}

/**
 * Snapshot all paginated call caches for rollback
 */
function snapshotPaginatedCallCaches(
  queryClient: QueryClient
): Map<string, PaginatedCallsResponse> {
  const snapshot = new Map<string, PaginatedCallsResponse>();
  const queries = queryClient.getQueriesData<PaginatedCallsResponse>({
    predicate: (q) => isPaginatedCallQuery(q.queryKey),
  });
  for (const [key, data] of queries) {
    if (data) {
      snapshot.set(JSON.stringify(key), data);
    }
  }
  return snapshot;
}

/**
 * Restore paginated call caches from snapshot
 */
function restorePaginatedCallCaches(
  queryClient: QueryClient,
  snapshot: Map<string, PaginatedCallsResponse>
): void {
  for (const [keyStr, data] of snapshot) {
    queryClient.setQueryData(JSON.parse(keyStr), data);
  }
}

/**
 * Hook to fetch call history
 * Uses real-time config - data updated via WebSocket events
 */
export function useCalls(limit: number = 50) {
  const activePhone = useAuthStore((s) => s.user?.senderPhone);
  return useQuery({
    queryKey: callsKeys.list(limit, activePhone),
    queryFn: () => callsService.getHistory({ limit }),
    ...REALTIME_QUERY_CONFIG,
  });
}

/**
 * Hook to fetch paginated call history with filters
 */
export function useCallsPaginated(params: CallHistoryParams) {
  const activePhone = useAuthStore((s) => s.user?.senderPhone);
  return useQuery<PaginatedCallsResponse>({
    queryKey: callsKeys.paginated(params, activePhone),
    queryFn: () => callsService.getHistoryPaginated(params),
    ...REALTIME_QUERY_CONFIG,
  });
}

/**
 * Hook to fetch call stats
 * Uses real-time config - data updated via WebSocket events
 */
export function useCallStats() {
  const activePhone = useAuthStore((s) => s.user?.senderPhone);
  return useQuery({
    queryKey: callsKeys.stats(activePhone),
    queryFn: () => callsService.getStats(),
    ...REALTIME_QUERY_CONFIG,
  });
}

/**
 * Hook to fetch unread call count
 * Uses real-time config - count updated via WebSocket events
 */
export function useUnreadCallCount() {
  const activePhone = useAuthStore((s) => s.user?.senderPhone);
  return useQuery({
    queryKey: callsKeys.unreadCount(activePhone),
    queryFn: () => callsService.getUnreadCount(),
    ...REALTIME_QUERY_CONFIG,
  });
}

/**
 * Hook to fetch recent unread/missed calls for notifications dropdown
 * Uses real-time config - data updated via WebSocket events
 */
export function useUnreadCalls(limit: number = 5) {
  const activePhone = useAuthStore((s) => s.user?.senderPhone);
  return useQuery({
    queryKey: callsKeys.unreadCalls(limit, activePhone),
    queryFn: () => callsService.getUnreadCalls(limit),
    ...REALTIME_QUERY_CONFIG,
  });
}

/**
 * Hook to mark calls as read
 * Updates call list, unread calls list, and unread count for immediate UI feedback
 */
export function useMarkCallsAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (callIds?: number[]) => callsService.markAsRead(callIds),
    onMutate: async (callIds) => {
      await queryClient.cancelQueries({ queryKey: callsKeys.all });

      // Snapshot previous values for rollback (use predicates to match all phone variants)
      const previousCalls = queryClient.getQueriesData<Call[]>({
        predicate: (q) => isListCallQuery(q.queryKey),
      });
      const previousPaginated = snapshotPaginatedCallCaches(queryClient);
      const previousUnreadCalls = queryClient.getQueriesData<Call[]>({
        predicate: (q) => isUnreadCallsQuery(q.queryKey),
      });
      const previousUnreadCount = queryClient.getQueriesData<number>({
        predicate: (q) => isUnreadCountQuery(q.queryKey),
      });

      // Update calls in legacy list cache
      queryClient.setQueriesData<Call[]>({ predicate: (q) => isListCallQuery(q.queryKey) }, (old) =>
        old?.map((call) => (!callIds || callIds.includes(call.id) ? { ...call, read: true } : call))
      );

      // Update paginated calls
      queryClient.setQueriesData<PaginatedCallsResponse>(
        { predicate: (q) => isPaginatedCallQuery(q.queryKey) },
        (old) => {
          if (!old?.calls) return old;
          return {
            ...old,
            calls: old.calls.map((call) =>
              !callIds || callIds.includes(call.id) ? { ...call, read: true } : call
            ),
          };
        }
      );

      // Update unread calls list - remove marked calls or clear all
      queryClient.setQueriesData<Call[]>(
        { predicate: (q) => isUnreadCallsQuery(q.queryKey) },
        (old) => {
          if (!old) return old;
          if (!callIds) return [];
          return old.filter((call) => !callIds.includes(call.id));
        }
      );

      // Update unread count (all variants)
      queryClient.setQueriesData<number>(
        { predicate: (q) => isUnreadCountQuery(q.queryKey) },
        (old) => (callIds ? Math.max(0, (old || 0) - callIds.length) : 0)
      );

      return { previousCalls, previousPaginated, previousUnreadCalls, previousUnreadCount };
    },
    onError: (_err, _callIds, context) => {
      // Rollback on error
      if (context?.previousCalls) {
        context.previousCalls.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
      if (context?.previousPaginated) {
        restorePaginatedCallCaches(queryClient, context.previousPaginated);
      }
      if (context?.previousUnreadCalls) {
        context.previousUnreadCalls.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
      if (context?.previousUnreadCount) {
        context.previousUnreadCount.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
    },
    onSettled: () => {
      // Invalidate all call queries for server sync
      queryClient.invalidateQueries({ queryKey: callsKeys.all });
    },
  });
}

/**
 * Hook to delete calls — optimistic removal from paginated caches
 */
export function useDeleteCalls() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (callIds: number[]) => callsService.deleteCalls(callIds),
    onMutate: async (callIds) => {
      await queryClient.cancelQueries({ predicate: (q) => isPaginatedCallQuery(q.queryKey) });

      const snapshot = snapshotPaginatedCallCaches(queryClient);
      const idSet = new Set(callIds);

      // Remove from all paginated caches
      queryClient.setQueriesData<PaginatedCallsResponse>(
        { predicate: (q) => isPaginatedCallQuery(q.queryKey) },
        (old) => {
          if (!old?.calls) return old;
          const filtered = old.calls.filter((c) => !idSet.has(c.id));
          if (filtered.length === old.calls.length) return old;
          return {
            ...old,
            calls: filtered,
            total: Math.max(0, old.total - (old.calls.length - filtered.length)),
            totalPages: Math.max(
              1,
              Math.ceil((old.total - (old.calls.length - filtered.length)) / old.limit)
            ),
          };
        }
      );

      return { snapshot };
    },
    onError: (_err, _ids, context) => {
      if (context?.snapshot) {
        restorePaginatedCallCaches(queryClient, context.snapshot);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: callsKeys.all });
    },
  });
}
