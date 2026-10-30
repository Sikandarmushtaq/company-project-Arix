'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  recordingsService,
  type Recording,
  type RecordingParams,
  type PaginatedRecordingsResponse,
  type RecordingQuota,
  type OrganizationQuota,
  type OrganizationsWithQuotasResponse,
  type BulkDeleteInput,
  type BulkDownloadPlanInput,
} from '@/lib/api';
// Direct import — `RecordingStats` is re-exported with three different
// shapes across services (recordings, admin, analytics). Importing from
// the source file picks the right one without renaming the others.
import type { RecordingStats } from '@/lib/api/services/recordings.service';
import { REALTIME_QUERY_CONFIG } from '@/lib/constants/query';
import { useAuthStore } from '@/lib/stores';

// Query keys — include activePhone so switching phones triggers fresh fetch
export const recordingsKeys = {
  all: ['recordings'] as const,
  list: () => [...recordingsKeys.all, 'list'] as const,
  listPaginated: (params: RecordingParams, activePhone?: string) =>
    [...recordingsKeys.all, 'list', activePhone ?? '', params] as const,
  stats: (activePhone?: string) => [...recordingsKeys.all, 'stats', activePhone ?? ''] as const,
  quota: (activePhone?: string) => [...recordingsKeys.all, 'quota', activePhone ?? ''] as const,
  orgQuota: (organizationId?: number) => [...recordingsKeys.all, 'orgQuota', organizationId ?? 'self'] as const,
  orgsWithQuotas: (params?: { page?: number; limit?: number; search?: string }) =>
    [...recordingsKeys.all, 'orgsWithQuotas', params] as const,
  audio: (recordingId: string) => [...recordingsKeys.all, 'audio', recordingId] as const,
};

/**
 * Hook to fetch recording stats (totals from backend)
 */
export function useMyRecordingStats() {
  const activePhone = useAuthStore((s) => s.user?.senderPhone);
  return useQuery({
    queryKey: recordingsKeys.stats(activePhone),
    queryFn: () => recordingsService.getStats(),
    ...REALTIME_QUERY_CONFIG,
  });
}

/**
 * Hook to fetch recording quota status
 * Returns usage, limit, and status (ok/warning/exceeded)
 * Fails silently - quota is optional, page works without it
 */
export function useRecordingQuota() {
  const activePhone = useAuthStore((s) => s.user?.senderPhone);
  return useQuery({
    queryKey: recordingsKeys.quota(activePhone),
    queryFn: () => recordingsService.getQuota(),
    staleTime: 30 * 1000, // Refresh every 30 seconds
    refetchInterval: 60 * 1000, // Auto-refresh every minute
    retry: false, // Don't retry on failure - quota is optional
  });
}

/**
 * Hook to fetch recordings with pagination
 * Uses real-time config - data updated via WebSocket events
 */
export function useRecordingsPaginated(params: RecordingParams = {}) {
  const activePhone = useAuthStore((s) => s.user?.senderPhone);
  return useQuery({
    queryKey: recordingsKeys.listPaginated(params, activePhone),
    queryFn: () => recordingsService.getRecordingsPaginated(params),
    ...REALTIME_QUERY_CONFIG,
  });
}

/**
 * Hook to fetch recordings with optional params
 * Supports page, limit, search, direction, etc.
 */
export function useRecordings(params: RecordingParams = {}) {
  const activePhone = useAuthStore((s) => s.user?.senderPhone);
  return useQuery({
    queryKey: recordingsKeys.listPaginated(params, activePhone),
    queryFn: () => recordingsService.getRecordingsPaginated(params),
    ...REALTIME_QUERY_CONFIG,
  });
}

/**
 * Hook to get recording audio URL (cached blob URLs)
 */
export function useRecordingAudio(recordingId: string, enabled = false) {
  return useQuery({
    queryKey: recordingsKeys.audio(recordingId),
    queryFn: async () => {
      const blob = await recordingsService.getAudio(recordingId);
      return URL.createObjectURL(blob);
    },
    enabled,
    staleTime: Infinity, // Audio blobs never become stale
    gcTime: 60 * 60 * 1000, // Keep audio in cache for 1 hour
  });
}

/**
 * Apply an optimistic quota delta after a delete so the storage gauge moves the
 * instant a recording is removed (before the server refetch in onSettled
 * reconciles). Handles BOTH quota models the backend can return, without mixing
 * unit bases:
 *   - Byte cap (auto-signup orgs): `limitSeconds === 0` and `limitGB > 0`. The
 *     gauge + "Storage left" render `usedGB`/`remainingGB`, so decrement those by
 *     the freed bytes and derive percent from GB.
 *   - Legacy seconds quota: `limitSeconds > 0`. The server derives `usedGB` from
 *     seconds, so decrement `usedSeconds` and keep the GB mirror consistent with
 *     it (never subtract bytes from a seconds-derived GB).
 */
function applyQuotaDelta(old: RecordingQuota, freed: { bytes: number; seconds: number }): RecordingQuota {
  const round3 = (n: number) => Math.round(n * 1000) / 1000;
  const byteCap = (old.limitSeconds ?? 0) === 0 && (old.limitGB ?? 0) > 0;

  if (byteCap) {
    const limitGB = old.limitGB ?? 0;
    const newUsedGB = Math.max(0, round3((old.usedGB ?? 0) - freed.bytes / 1_000_000_000));
    const pct = limitGB > 0 ? Math.min(100, (newUsedGB / limitGB) * 100) : (old.percentUsed ?? 0);
    return {
      ...old,
      usedGB: newUsedGB,
      remainingGB: Math.max(0, round3(limitGB - newUsedGB)),
      percentUsed: Math.round(pct * 10) / 10,
      status: pct >= 100 ? 'exceeded' : pct >= 80 ? 'warning' : (old.status ?? 'ok'),
      canRecord: pct < 100,
    };
  }

  // Legacy seconds model — percent + GB mirror both derive from seconds.
  const secLimit = old.limitSeconds || 0;
  const newUsedSec = Math.max(0, (old.usedSeconds ?? 0) - freed.seconds);
  const limitGB = old.limitGB ?? 0;
  const usedGB =
    secLimit > 0 && limitGB > 0 ? round3(limitGB * (newUsedSec / secLimit)) : (old.usedGB ?? 0);
  const pct = secLimit > 0 ? Math.min(100, (newUsedSec / secLimit) * 100) : (old.percentUsed ?? 0);
  return {
    ...old,
    usedSeconds: newUsedSec,
    usedHours: newUsedSec / 3600,
    usedGB,
    remainingSeconds: Math.max(0, secLimit - newUsedSec),
    remainingHours: Math.max(0, secLimit - newUsedSec) / 3600,
    remainingGB: limitGB > 0 ? Math.max(0, round3(limitGB - usedGB)) : (old.remainingGB ?? 0),
    percentUsed: Math.round(pct * 10) / 10,
    status: pct >= 100 ? 'exceeded' : pct >= 80 ? 'warning' : (old.status ?? 'ok'),
    canRecord: pct < 100,
  };
}

/**
 * Hook to delete a recording
 * Handles both legacy Recording[] and new PaginatedRecordingsResponse formats
 */
export function useDeleteRecording(organizationId?: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (recordingId: string) =>
      recordingsService.deleteRecording(recordingId, organizationId),
    onMutate: async (recordingId) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: recordingsKeys.all });

      // Snapshot for rollback
      const previousData = queryClient.getQueriesData({
        queryKey: recordingsKeys.all,
      });

      // Find the row being deleted in any cached page so we can apply exact
      // optimistic deltas to the stats + storage gauge (bytes/duration/direction).
      let deleted: Recording | undefined;
      for (const [, data] of queryClient.getQueriesData<PaginatedRecordingsResponse>({
        queryKey: recordingsKeys.list(),
        exact: false,
      })) {
        deleted = data?.recordings?.find((r) => r.id === recordingId || r.filename === recordingId);
        if (deleted) break;
      }

      // Optimistically update paginated recording lists
      queryClient.setQueriesData<PaginatedRecordingsResponse>(
        { queryKey: recordingsKeys.all },
        (old) => {
          if (!old) return old;
          // Handle paginated response format
          if ('recordings' in old && Array.isArray(old.recordings)) {
            return {
              ...old,
              recordings: old.recordings.filter(
                (r) => r.id !== recordingId && r.filename !== recordingId
              ),
              total: Math.max(0, old.total - 1),
            };
          }
          return old;
        }
      );

      // Optimistically tick the storage gauge down so the number + green bar
      // move the instant the row goes. onSettled reconciles with the server.
      const dBytes = deleted?.fileSize ?? 0;
      const dSec = deleted?.duration ?? 0;
      if (dBytes > 0 || dSec > 0) {
        queryClient.setQueriesData<RecordingQuota>(
          { queryKey: recordingsKeys.quota(), exact: false },
          (old) => (old ? applyQuotaDelta(old, { bytes: dBytes, seconds: dSec }) : old)
        );
      }

      return { previousData };
    },
    onError: (_err, _id, context) => {
      // Rollback on error
      context?.previousData?.forEach(([queryKey, data]) => {
        queryClient.setQueryData(queryKey, data);
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: recordingsKeys.all });
    },
  });
}

/**
 * Bulk delete — supports both `ids` mode (explicit selection) and `filter`
 * mode (delete-all-matching-filter).
 *
 * Optimistic UI: the moment the user confirms, the deleted recordings
 * disappear from the list, the "Total Recordings" stat drops, and the
 * quota gauge ticks down — all without waiting for the server. On any
 * error, we restore the previous cache snapshot. On success, `onSettled`
 * reconciles by refetching authoritative state (catches the filter-mode
 * `truncated` case where 5000+ matches existed and the server only got
 * to the first 5000).
 *
 * Pattern: standard React Query optimistic-update with rollback. Same
 * shape as Linear / Slack / Gmail mass-delete UX — feels instant.
 */
export function useBulkDeleteRecordings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: BulkDeleteInput) => recordingsService.bulkDelete(input),
    onMutate: async (input: BulkDeleteInput) => {
      // Stop in-flight refetches from racing the optimistic state
      await queryClient.cancelQueries({ queryKey: recordingsKeys.all });

      // Snapshot for rollback
      const previousData = queryClient.getQueriesData({ queryKey: recordingsKeys.all });

      // Stats/quota delta we'll apply to the cards below the search bar.
      // Computed differently per mode — see each branch.
      let deltaCount = 0;
      let deltaInbound = 0;
      let deltaOutbound = 0;
      let deltaDurationSec = 0;
      // Bytes freed — drives the byte-capped storage bar (usedGB/remainingGB).
      let deltaBytes = 0;

      if (input.mode === 'ids') {
        // Explicit selection: walk every cached list, find rows being
        // deleted, sum their direction + duration so we can apply
        // exact deltas to stats and quota. Then drop the rows from
        // each cache page. Using the same "remaining" Set per page
        // means a recording appearing in two cached pages doesn't
        // double-count.
        const idsToDelete = new Set(input.ids);
        const accountedFor = new Set<string>();

        queryClient.setQueriesData<PaginatedRecordingsResponse>(
          { queryKey: recordingsKeys.list(), exact: false },
          (old) => {
            if (!old || !Array.isArray(old.recordings)) return old;
            const remaining: Recording[] = [];
            for (const rec of old.recordings) {
              if (idsToDelete.has(rec.id)) {
                if (!accountedFor.has(rec.id)) {
                  accountedFor.add(rec.id);
                  deltaCount += 1;
                  if (rec.direction === 'inbound') deltaInbound += 1;
                  else if (rec.direction === 'outbound') deltaOutbound += 1;
                  deltaDurationSec += rec.duration ?? 0;
                  deltaBytes += rec.fileSize ?? 0;
                }
              } else {
                remaining.push(rec);
              }
            }
            const removedFromThisPage = old.recordings.length - remaining.length;
            return {
              ...old,
              recordings: remaining,
              total: Math.max(0, (old.total ?? 0) - removedFromThisPage),
            };
          }
        );
      } else {
        // filter mode (delete-all-matching-filter): we don't have the
        // exact IDs client-side, so wipe every cached list. Read total
        // from any one of them to drive the stats/quota delta — that's
        // the closest approximation we have without a separate server
        // call. Server caps at FILTER_DELETE_HARD_CAP=5000; if more
        // matched, the response will set `truncated: true` and
        // onSettled's refetch will reconcile.
        const cachedLists = queryClient.getQueriesData<PaginatedRecordingsResponse>({
          queryKey: recordingsKeys.list(),
          exact: false,
        });
        deltaCount = cachedLists[0]?.[1]?.total ?? 0;
        // Best-effort duration delta: sum of durations on the visible page
        // (only one page is loaded at a time). Better than nothing; the
        // refetch in onSettled corrects any drift.
        deltaDurationSec = (cachedLists[0]?.[1]?.recordings ?? []).reduce(
          (sum, r) => sum + (r.duration ?? 0),
          0
        );
        deltaBytes = (cachedLists[0]?.[1]?.recordings ?? []).reduce(
          (sum, r) => sum + (r.fileSize ?? 0),
          0
        );

        queryClient.setQueriesData<PaginatedRecordingsResponse>(
          { queryKey: recordingsKeys.list(), exact: false },
          (old) => {
            if (!old || !Array.isArray(old.recordings)) return old;
            return { ...old, recordings: [], total: 0 };
          }
        );
      }

      // Stats card optimistic decrement
      if (deltaCount > 0) {
        queryClient.setQueriesData<RecordingStats>(
          { queryKey: recordingsKeys.stats(), exact: false },
          (old) => {
            if (!old) return old;
            return {
              ...old,
              total: Math.max(0, (old.total ?? 0) - deltaCount),
              inbound: Math.max(0, (old.inbound ?? 0) - deltaInbound),
              outbound: Math.max(0, (old.outbound ?? 0) - deltaOutbound),
              totalDuration: Math.max(0, (old.totalDuration ?? 0) - deltaDurationSec),
            };
          }
        );
      }

      // Quota gauge optimistic tick-down — moves live for both quota models
      // (byte cap uses GB, legacy uses seconds); see applyQuotaDelta. onSettled
      // reconciles any filter-mode approximation with the server.
      if (deltaDurationSec > 0 || deltaBytes > 0) {
        queryClient.setQueriesData<RecordingQuota>(
          { queryKey: recordingsKeys.quota(), exact: false },
          (old) => (old ? applyQuotaDelta(old, { bytes: deltaBytes, seconds: deltaDurationSec }) : old)
        );
      }

      return { previousData };
    },
    onError: (_err, _input, context) => {
      // Roll every snapshotted query back. The snapshot was taken
      // before any optimistic write, so this restores list + stats +
      // quota in lockstep.
      context?.previousData?.forEach(([queryKey, data]) => {
        queryClient.setQueryData(queryKey, data);
      });
    },
    onSettled: () => {
      // Reconcile with server (catches truncated filter-mode deletes
      // and any drift from the optimistic delta approximations above)
      queryClient.invalidateQueries({ queryKey: recordingsKeys.all });
    },
  });
}

/**
 * Compute a chunked-download plan for the user's confirmation modal.
 *
 * Returns the total count + suggested batch breakdown so the UI can
 * render "X recordings will download as Y ZIPs". This is a server query
 * (the user's filter must be re-run server-side for accuracy + org
 * scoping), not a local computation.
 */
export function useBulkDownloadPlan(organizationId?: number) {
  return useMutation({
    mutationFn: (input: BulkDownloadPlanInput) =>
      recordingsService.bulkDownloadPlan(input, organizationId),
  });
}

// ============================================================
// Organization Quota Hooks
// ============================================================

/**
 * Hook to fetch organization recording quota (for managers)
 * Returns the quota status for the current user's organization
 */
export function useOrganizationQuota(organizationId?: number) {
  return useQuery({
    queryKey: recordingsKeys.orgQuota(organizationId),
    queryFn: () => recordingsService.getOrganizationQuota(organizationId),
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
    retry: false,
  });
}

/**
 * Hook to fetch all organizations with their quota status (admin only)
 */
export function useOrganizationsWithQuotas(params?: {
  page?: number;
  limit?: number;
  search?: string;
}) {
  return useQuery({
    queryKey: recordingsKeys.orgsWithQuotas(params),
    queryFn: () => recordingsService.getOrganizationsWithQuotas(params),
    staleTime: 30 * 1000,
  });
}

/**
 * Hook to update organization recording quota limit (admin only)
 */
export function useUpdateOrganizationQuota() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ organizationId, limitGB }: { organizationId: number; limitGB: number }) =>
      recordingsService.updateOrganizationQuota(organizationId, limitGB),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: recordingsKeys.orgsWithQuotas() });
    },
  });
}
