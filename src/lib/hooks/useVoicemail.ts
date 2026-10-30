'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  voicemailService,
  type Voicemail,
  type VoicemailCounts,
  type VoicemailQueryParams,
  type PaginatedVoicemailResponse,
} from '@/lib/api';
import { REALTIME_QUERY_CONFIG } from '@/lib/constants/query';

// Query keys
export const voicemailKeys = {
  all: ['voicemail'] as const,
  list: () => [...voicemailKeys.all, 'list'] as const,
  listPaginated: (params: VoicemailQueryParams) => [...voicemailKeys.all, 'list', params] as const,
  counts: () => [...voicemailKeys.all, 'counts'] as const,
  audio: (extension: string, msgId: string) =>
    [...voicemailKeys.all, 'audio', extension, msgId] as const,
};

/**
 * Hook to fetch voicemails with pagination
 * Uses real-time config - data updated via WebSocket events
 */
export function useVoicemailsPaginated(params: VoicemailQueryParams = {}) {
  return useQuery({
    queryKey: voicemailKeys.listPaginated(params),
    queryFn: () => voicemailService.getVoicemailsPaginated(params),
    ...REALTIME_QUERY_CONFIG,
  });
}

/**
 * Hook to fetch all voicemails (legacy - no pagination)
 * @deprecated Use useVoicemailsPaginated for better performance
 */
export function useVoicemails() {
  return useQuery({
    queryKey: voicemailKeys.list(),
    queryFn: () => voicemailService.getVoicemails(),
    ...REALTIME_QUERY_CONFIG,
  });
}

/**
 * Hook to fetch voicemail counts
 * Uses real-time config - count updated via WebSocket events
 */
export function useVoicemailCounts() {
  return useQuery({
    queryKey: voicemailKeys.counts(),
    queryFn: () => voicemailService.getCounts(),
    ...REALTIME_QUERY_CONFIG,
  });
}

/**
 * Hook to fetch recent unread voicemails (for notification dropdown)
 * Uses server-side unreadOnly filter so we always get unread voicemails
 */
export function useUnreadVoicemails(limit = 5) {
  const query = useVoicemailsPaginated({ page: 1, limit, unreadOnly: true });

  return {
    ...query,
    data: query.data?.voicemails || [],
  };
}

/**
 * Hook to get voicemail audio URL (cached blob URLs)
 */
export function useVoicemailAudio(extension: string, msgId: string, enabled = false) {
  return useQuery({
    queryKey: voicemailKeys.audio(extension, msgId),
    queryFn: async () => {
      const blob = await voicemailService.getAudio(extension, msgId);
      return URL.createObjectURL(blob);
    },
    enabled,
    staleTime: Infinity, // Audio blobs never become stale
    gcTime: 60 * 60 * 1000, // Keep audio in cache for 1 hour
  });
}

/**
 * Hook to mark voicemail as read
 */
export function useMarkVoicemailAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ extension, msgId }: { extension: string; msgId: string }) =>
      voicemailService.markAsRead(extension, msgId),
    onMutate: async ({ msgId }) => {
      await queryClient.cancelQueries({ queryKey: voicemailKeys.all });

      // Optimistically update all paginated query caches
      let wasUnread = false;
      queryClient.setQueriesData<PaginatedVoicemailResponse>(
        { queryKey: voicemailKeys.list() },
        (old) => {
          if (!old) return old;
          return {
            ...old,
            voicemails: old.voicemails.map((vm) => {
              if (vm.id === msgId && !vm.read) {
                wasUnread = true;
                return { ...vm, read: true, folder: 'Old' };
              }
              return vm;
            }),
          };
        }
      );

      // Optimistically update counts
      if (wasUnread) {
        queryClient.setQueryData<VoicemailCounts>(voicemailKeys.counts(), (old) =>
          old ? { ...old, unread: Math.max(0, old.unread - 1) } : old
        );
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: voicemailKeys.counts() });
    },
  });
}

/**
 * Hook to delete voicemail
 */
export function useDeleteVoicemail() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ extension, msgId }: { extension: string; msgId: string }) =>
      voicemailService.deleteVoicemail(extension, msgId),
    onMutate: async ({ msgId }) => {
      await queryClient.cancelQueries({ queryKey: voicemailKeys.all });

      // Snapshot for rollback
      const previousData = queryClient.getQueriesData<PaginatedVoicemailResponse>({
        queryKey: voicemailKeys.list(),
      });

      // Optimistically remove from all paginated query caches
      queryClient.setQueriesData<PaginatedVoicemailResponse>(
        { queryKey: voicemailKeys.list() },
        (old) => {
          if (!old) return old;
          return {
            ...old,
            voicemails: old.voicemails.filter((vm) => vm.id !== msgId),
            total: old.total - 1,
          };
        }
      );

      return { previousData };
    },
    onError: (_err, _vars, context) => {
      // Restore snapshot on failure
      if (context?.previousData) {
        for (const [queryKey, data] of context.previousData) {
          if (data) queryClient.setQueryData(queryKey, data);
        }
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: voicemailKeys.all });
    },
  });
}

/**
 * Hook to delete multiple voicemails (batch)
 */
export function useDeleteVoicemails() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (ids: Array<{ extension: string; msgId: string }>) =>
      voicemailService.deleteVoicemails(ids),
    onMutate: async (ids) => {
      await queryClient.cancelQueries({ queryKey: voicemailKeys.all });

      const previousData = queryClient.getQueriesData<PaginatedVoicemailResponse>({
        queryKey: voicemailKeys.list(),
      });

      const msgIdSet = new Set(ids.map((i) => i.msgId));
      queryClient.setQueriesData<PaginatedVoicemailResponse>(
        { queryKey: voicemailKeys.list() },
        (old) => {
          if (!old) return old;
          const filtered = old.voicemails.filter((vm) => !msgIdSet.has(vm.id));
          return {
            ...old,
            voicemails: filtered,
            total: old.total - (old.voicemails.length - filtered.length),
          };
        }
      );

      return { previousData };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousData) {
        for (const [queryKey, data] of context.previousData) {
          if (data) queryClient.setQueryData(queryKey, data);
        }
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: voicemailKeys.all });
    },
  });
}

/**
 * Hook to mark all voicemails as read
 */
export function useMarkAllVoicemailsAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => voicemailService.markAllAsRead(),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: voicemailKeys.all });

      // Optimistically mark all as read in paginated caches
      queryClient.setQueriesData<PaginatedVoicemailResponse>(
        { queryKey: voicemailKeys.list() },
        (old) => {
          if (!old) return old;
          return {
            ...old,
            voicemails: old.voicemails.map((vm) => ({ ...vm, read: true, folder: 'Old' })),
          };
        }
      );

      // Optimistically zero out unread count
      queryClient.setQueryData<VoicemailCounts>(voicemailKeys.counts(), (old) =>
        old ? { ...old, unread: 0 } : old
      );
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: voicemailKeys.all });
    },
  });
}
