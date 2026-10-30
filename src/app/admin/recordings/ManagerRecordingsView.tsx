'use client';

/**
 * Manager Recordings View
 *
 * Organization recordings management for managers: search, filter, play, download, delete.
 *
 * @module app/admin/recordings/ManagerRecordingsView
 */

import React, { useState, useCallback, useMemo } from 'react';
import { FiDisc, FiAlertCircle, FiLoader } from 'react-icons/fi';
import { Card, CardContent, Pagination } from '@/components/ui';
import {
  useOrganizationQuota,
  useRecordings,
  useDeleteRecording,
  useBulkDownloadPlan,
  useConfirm,
  useDebounce,
  usePagination,
} from '@/lib/hooks';
import { recordingsService, type Recording, type BulkOperationFilter } from '@/lib/api';
import { toast } from '@/lib/stores/toast';
import { usePermissions, PERMISSIONS } from '@/lib/hooks/usePermissions';
import { useOrgAgents } from '@/lib/hooks/useAdminAnalytics';
import { localInputToISO, presetRange, type DateRangePreset } from '@/lib/utils/date-range';
import type { AgentOption } from './RecordingsFilters';
import { PLAYBACK_SPEEDS } from './RecordingPlayer';
import { RecordingsFilters } from './RecordingsFilters';
import {
  RecordingsTable,
  BulkActionsBar,
  DownloadPartsPanel,
  type DownloadPartStatus,
  type SortConfig,
  type SortField,
} from './RecordingsTable';
import { useRecordingExport } from './useRecordingExport';
import { RecordingExportPanel } from './RecordingExportPanel';

/**
 * Cutover flag: when set, "download all matching" uses the async server-side
 * export (resumable, session-proof) instead of the 262-part in-browser flow.
 * Default OFF keeps the existing path until the backend feature is enabled.
 */
const RECORDING_EXPORT_ENABLED = process.env.NEXT_PUBLIC_RECORDING_EXPORT_ENABLED === 'true';

const formatGB = (gb: number): string => {
  if (gb < 1) {
    return `${Math.round(gb * 1000)} MB`;
  }
  return `${gb.toFixed(1)} GB`;
};

/** Hand a fetched ZIP blob to the browser as a file download. */
function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}

export function ManagerRecordingsView({
  organizationId,
  organizationName,
  readOnly = false,
}: {
  organizationId?: number;
  organizationName?: string;
  readOnly?: boolean;
} = {}) {
  const { hasPermission, isSuperAdmin } = usePermissions();
  // Gates the delete UI. The backend enforces manage.recordings.delete too;
  // this just hides the buttons when the admin has turned delete off.
  const canDelete =
    !readOnly && (isSuperAdmin || hasPermission(PERMISSIONS.DELETE_RECORDINGS));
  const recordingExportEnabled = RECORDING_EXPORT_ENABLED && !organizationId;
  const pagination = usePagination({ initialPageSize: 20 });
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  // True when the user chose "Select all N matching" — bulk actions then run
  // server-side over the WHOLE filtered set (all pages), not just selectedIds.
  const [isSelectAllMatchingFilter, setIsSelectAllMatchingFilter] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [downloadProgressLabel, setDownloadProgressLabel] = useState<string | null>(null);
  // Numeric batch progress for the progress bar during a chunked download.
  const [downloadProgress, setDownloadProgress] = useState<{
    current: number;
    total: number;
  } | null>(null);
  // Per-part tracker for chunked downloads. Kept AFTER the run finishes so the
  // user can re-download any ZIP the browser dropped (multiple-download
  // permission prompt, transient error) without re-running all N parts.
  const [downloadParts, setDownloadParts] = useState<{
    totalCount: number;
    batchSize: number;
    // Snapshot of the filter the plan was made for — part re-downloads keep
    // using it even if the on-screen filter changes afterwards.
    filter: BulkOperationFilter;
    statuses: DownloadPartStatus[];
  } | null>(null);
  const { confirm } = useConfirm();
  const deleteRecordingMutation = useDeleteRecording(organizationId);
  const bulkDownloadPlan = useBulkDownloadPlan(organizationId);
  const {
    activeJob: exportJob,
    progress: exportProgress,
    startExport: startRecordingExport,
    cancelExport: cancelRecordingExport,
    downloadReady: downloadRecordingExport,
    dismiss: dismissRecordingExport,
  } = useRecordingExport(recordingExportEnabled);

  // Advanced filters — datetime-local strings + direction + duration + agent.
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [direction, setDirection] = useState<'' | 'inbound' | 'outbound'>('');
  const [minDuration, setMinDuration] = useState('');
  const [maxDuration, setMaxDuration] = useState('');
  const [agentUserId, setAgentUserId] = useState<number | undefined>(undefined);
  // Selected quick-range preset ('' = custom), so the dropdown reflects it.
  const [preset, setPreset] = useState<DateRangePreset | ''>('');

  // Agent dropdown — org-scoped agents from a manager-safe endpoint
  // (/admin/users needs view.users, which managers lack).
  // injectOrgFilter accepts org_id only from super admins. Managers omit it
  // and remain scoped to their authenticated organization.
  const { data: agentsData } = useOrgAgents(true, organizationId);
  const agents: AgentOption[] = useMemo(
    () => (agentsData ?? []).map((a) => ({ id: a.id, label: a.name })),
    [agentsData]
  );

  // Sort state (server-side)
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    field: 'startTime',
    direction: 'desc',
  });

  // Audio playback state with progress
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [pausedId, setPausedId] = useState<string | null>(null);
  const [audioLoading, setAudioLoading] = useState<string | null>(null);
  const [audioProgress, setAudioProgress] = useState<Record<string, number>>({});
  const [currentTime, setCurrentTime] = useState<Record<string, number>>({});
  const [audioDurations, setAudioDurations] = useState<Record<string, number>>({});
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('manager-recording-playback-speed');
      return saved ? parseFloat(saved) : 1;
    }
    return 1;
  });
  // One shared <audio> element — a single element can only ever play one
  // source, so two recordings can never overlap. currentKeyRef tracks which
  // recording it's loaded with; audioUrlsRef caches the resolved src per id.
  const audioRef = React.useRef<HTMLAudioElement | null>(null);
  const currentKeyRef = React.useRef<string | null>(null);
  const audioUrlsRef = React.useRef<Record<string, string>>({});

  // Refs that mirror state for stable callbacks
  const playingIdRef = React.useRef(playingId);
  playingIdRef.current = playingId;
  const playbackSpeedRef = React.useRef(playbackSpeed);
  playbackSpeedRef.current = playbackSpeed;
  // The intended recording, updated SYNCHRONOUSLY the instant a play is
  // requested (playingId only updates on the next render). The switch guards
  // and error handling compare against this, so a losing recording that
  // resolves late can neither hijack nor wipe the winner's state.
  const activeKeyRef = React.useRef<string | null>(null);

  // Fetch organization quota
  const { data: orgQuota } = useOrganizationQuota(organizationId);

  // Fetch recordings with server-side sorting and date filter
  const {
    data: recordings,
    isLoading,
    error,
    refetch,
  } = useRecordings({
    page: pagination.page,
    limit: pagination.pageSize,
    search: debouncedSearch || undefined,
    startDate: localInputToISO(startDate),
    endDate: localInputToISO(endDate),
    direction: direction || undefined,
    minDuration: minDuration ? parseInt(minDuration, 10) : undefined,
    maxDuration: maxDuration ? parseInt(maxDuration, 10) : undefined,
    agentUserId,
    sortBy: sortConfig.field,
    sortOrder: sortConfig.direction,
    organizationId,
  });

  // Update pagination when data changes
  React.useEffect(() => {
    if (recordings?.total !== undefined) {
      pagination.setTotalItems(recordings.total);
    }
  }, [recordings?.total, pagination]);

  // Clear selection (real + virtual) when page/filter/sort changes — otherwise
  // the "selected" set could stop matching what's on screen.
  React.useEffect(() => {
    setSelectedIds(new Set());
    setIsSelectAllMatchingFilter(false);
  }, [
    pagination.page,
    debouncedSearch,
    startDate,
    endDate,
    direction,
    minDuration,
    maxDuration,
    agentUserId,
    sortConfig,
  ]);

  // The filter as the server understands it. Sent to the bulk endpoints so the
  // server-side enumeration matches exactly what the user is looking at.
  // Bulk ops reuse the same filter (minus the agent filter — see the
  // select-all guard below). Dates are converted to the exact ISO bounds the
  // list query used, so the bulk set matches what the user sees.
  const currentFilter = useMemo<BulkOperationFilter>(
    () => ({
      startDate: localInputToISO(startDate),
      endDate: localInputToISO(endDate),
      search: debouncedSearch || undefined,
      direction: direction || undefined,
      minDuration: minDuration ? parseInt(minDuration, 10) : undefined,
      maxDuration: maxDuration ? parseInt(maxDuration, 10) : undefined,
    }),
    [startDate, endDate, debouncedSearch, direction, minDuration, maxDuration]
  );

  // Audio cleanup on unmount. We intentionally read audioRef/audioUrlsRef at
  // cleanup time (not a setup-time snapshot): blob URLs accumulate over the
  // component's life, so we must revoke whatever exists at unmount.
  React.useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
      Object.values(audioUrlsRef.current).forEach((u) => {
        if (u.startsWith('blob:')) URL.revokeObjectURL(u);
      });
    };
  }, []);

  // Stop audio on page/filter change
  React.useEffect(() => {
    audioRef.current?.pause();
    activeKeyRef.current = null;
    setPlayingId(null);
    setPausedId(null);
  }, [pagination.page, debouncedSearch, startDate, endDate]);

  const toggleSelection = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    const allIds = recordings?.recordings?.map((r) => r.id) || [];
    const allSelected = allIds.every((id) => selectedIds.has(id));
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(allIds));
    }
    // A page-scoped toggle always exits all-matching-filter mode.
    setIsSelectAllMatchingFilter(false);
  }, [recordings?.recordings, selectedIds]);

  // Virtual "select everything matching the filter" — selectedIds stays as the
  // current page; the flag is what the bulk actions read.
  const handleSelectAllMatchingFilter = useCallback(() => {
    // Safety: bulk ops run server-side over `currentFilter`, which does NOT
    // carry the agent filter (agent scoping isn't wired into the bulk path
    // yet). If an agent filter is active, "select all matching" would act on
    // the whole org — so block it. The user can still select visible rows.
    if (agentUserId != null) {
      toast.info('Clear the agent filter to select all matching, or select rows individually.');
      return;
    }
    setIsSelectAllMatchingFilter(true);
  }, [agentUserId]);

  const handleClearSelection = useCallback(() => {
    setSelectedIds(new Set());
    setIsSelectAllMatchingFilter(false);
  }, []);

  // Single recording download
  const handleDownloadSingle = useCallback(async (recording: Recording) => {
    try {
      const blob = await recordingsService.downloadRecording(recording.id, organizationId);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = recording.filename || `${recording.id}.wav`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download failed:', err);
      toast.error('Failed to download recording');
    }
  }, [organizationId]);

  const setPartStatus = useCallback((batch: number, status: DownloadPartStatus) => {
    setDownloadParts((prev) =>
      prev
        ? { ...prev, statuses: prev.statuses.map((s, i) => (i === batch ? status : s)) }
        : prev
    );
  }, []);

  // Fetch + hand off ONE ZIP part of a filter-mode plan, updating its chip in
  // the parts panel. Returns true on success.
  const downloadOnePart = useCallback(
    async (filter: BulkOperationFilter, batch: number): Promise<boolean> => {
      setPartStatus(batch, 'downloading');
      try {
        const { blob, filename } = await recordingsService.bulkDownload(
          {
            mode: 'filter',
            filter,
            batch,
          },
          organizationId
        );
        triggerBlobDownload(blob, filename);
        setPartStatus(batch, 'done');
        return true;
      } catch (err) {
        console.error(`Bulk download part ${batch + 1} failed:`, err);
        setPartStatus(batch, 'failed');
        return false;
      }
    },
    [organizationId, setPartStatus]
  );

  const handleBulkDownload = useCallback(async () => {
    if (!isSelectAllMatchingFilter && selectedIds.size === 0) return;
    setIsDownloading(true);
    setDownloadProgressLabel(null);
    try {
      // Page-selection fast path: an explicit id list is always one ZIP
      // (the schema caps ids at 100), so no /plan round trip is needed.
      if (!isSelectAllMatchingFilter) {
        const { blob, filename } = await recordingsService.bulkDownload({
          mode: 'ids',
          ids: Array.from(selectedIds),
        }, organizationId);
        triggerBlobDownload(blob, filename);
        toast.success(`Downloaded ${selectedIds.size} recording${selectedIds.size > 1 ? 's' : ''}`);
        return;
      }

      // Select-all-matching. Preferred path: hand off to the async server-side
      // export (one resumable download, survives token expiry + link drops).
      // The RecordingExportPanel then shows progress + the download button.
      if (recordingExportEnabled) {
        await startRecordingExport(currentFilter);
        return;
      }

      // Legacy fallback (flag off): ask for the chunk plan, then stream one ZIP
      // per batch of up to `batchSize` (Part 1, Part 2, …).
      const plan = await bulkDownloadPlan.mutateAsync({ mode: 'filter', filter: currentFilter });
      if (plan.totalCount === 0) {
        toast.info('No recordings to download');
        return;
      }
      if (plan.batchCount > 1) {
        const confirmed = await confirm({
          title: 'Download Recordings',
          message: `${plan.totalCount} recordings will be packaged into ${plan.batchCount} ZIP files of up to ${plan.batchSize} each. Your browser will download them one after another. Continue?`,
          confirmText: `Download ${plan.batchCount} ZIPs`,
        });
        if (!confirmed) return;
      }

      // Multi-part runs get the parts panel (it persists after the run so
      // missed ZIPs can be re-downloaded individually).
      const planFilter = currentFilter;
      setDownloadParts(
        plan.batchCount > 1
          ? {
              totalCount: plan.totalCount,
              batchSize: plan.batchSize,
              filter: planFilter,
              statuses: Array.from({ length: plan.batchCount }, () => 'pending' as const),
            }
          : null
      );

      let succeeded = 0;
      let failed = 0;
      setDownloadProgress({ current: 0, total: plan.batchCount });
      for (let batch = 0; batch < plan.batchCount; batch++) {
        setDownloadProgressLabel(`Part ${batch + 1} of ${plan.batchCount}`);
        const ok = await downloadOnePart(planFilter, batch);
        if (ok) succeeded++;
        else failed++;
        // Advance the bar as each ZIP finishes (whether it succeeded or not).
        setDownloadProgress({ current: batch + 1, total: plan.batchCount });
        // Browsers pop-block multiple downloads fired back-to-back; a short
        // spacing lets each ZIP settle into the downloads bar before the next.
        if (batch < plan.batchCount - 1) {
          await new Promise((resolve) => setTimeout(resolve, 1500));
        }
      }

      if (failed === 0) {
        toast.success(
          plan.batchCount === 1
            ? 'Download started'
            : `Downloaded ${succeeded} ZIPs (${plan.totalCount} recordings) — check the parts list below if any are missing from your Downloads folder`
        );
      } else {
        toast.error(`Downloaded ${succeeded} ZIPs, ${failed} failed — retry them from the parts list below`);
      }
    } catch (err) {
      console.error('Bulk download failed:', err);
      toast.error('Failed to download recordings');
    } finally {
      setIsDownloading(false);
      setDownloadProgressLabel(null);
      setDownloadProgress(null);
    }
  }, [
    isSelectAllMatchingFilter,
    selectedIds,
    currentFilter,
    bulkDownloadPlan,
    confirm,
    downloadOnePart,
    startRecordingExport,
    recordingExportEnabled,
    organizationId,
  ]);

  // Re-download a single ZIP part from the parts panel (uses the plan's
  // snapshotted filter, not the current on-screen filter).
  const handleDownloadPart = useCallback(
    (batch: number) => {
      if (!downloadParts || isDownloading) return;
      void downloadOnePart(downloadParts.filter, batch);
    },
    [downloadParts, isDownloading, downloadOnePart]
  );

  // Run a set of batches through downloadOnePart one after another, with the
  // same 1.5s spacing the initial run uses (avoids browser pop-up blocking of
  // back-to-back downloads). Shared by "Retry failed" and "Download remaining".
  const runBatchesSequentially = useCallback(
    async (batches: number[], filter: BulkOperationFilter) => {
      if (batches.length === 0) return;
      setIsDownloading(true);
      try {
        for (let k = 0; k < batches.length; k++) {
          await downloadOnePart(filter, batches[k]);
          if (k < batches.length - 1) {
            await new Promise((resolve) => setTimeout(resolve, 1500));
          }
        }
      } finally {
        setIsDownloading(false);
      }
    },
    [downloadOnePart]
  );

  const handleRetryFailedParts = useCallback(() => {
    if (!downloadParts || isDownloading) return;
    const failedBatches = downloadParts.statuses
      .map((s, i) => (s === 'failed' ? i : -1))
      .filter((i) => i >= 0);
    void runBatchesSequentially(failedBatches, downloadParts.filter);
  }, [downloadParts, isDownloading, runBatchesSequentially]);

  // Bulk delete using API endpoint. In select-all-matching mode the server
  // deletes the whole filtered set (server-side iteration), not just the page.
  const handleBulkDelete = useCallback(async () => {
    const totalCount = isSelectAllMatchingFilter ? (recordings?.total ?? 0) : selectedIds.size;
    if (totalCount === 0) return;
    const confirmed = await confirm({
      title: 'Delete Selected Recordings',
      message: `Are you sure you want to delete ${totalCount} recording${totalCount > 1 ? 's' : ''}? This action cannot be undone.`,
      confirmText: totalCount > 1 ? `Delete ${totalCount}` : 'Delete',
      variant: 'danger',
    });
    if (!confirmed) return;

    setIsBulkDeleting(true);
    try {
      const result = await recordingsService.bulkDelete(
        isSelectAllMatchingFilter
          ? { mode: 'filter', filter: currentFilter }
          : { mode: 'ids', ids: Array.from(selectedIds) },
        organizationId
      );
      setSelectedIds(new Set());
      setIsSelectAllMatchingFilter(false);
      refetch();
      if (result.failCount === 0) {
        toast.success(result.message);
        // Filter-mode is capped per request; if it truncated, more remain.
        if (result.truncated) {
          toast.info('More recordings matched than one pass could clear — run delete again.');
        }
      } else {
        toast.error(`Deleted ${result.successCount}, failed ${result.failCount}`);
      }
    } catch (err) {
      console.error('Bulk delete failed:', err);
      toast.error('Failed to delete recordings');
    } finally {
      setIsBulkDeleting(false);
    }
  }, [
    isSelectAllMatchingFilter,
    selectedIds,
    currentFilter,
    recordings?.total,
    confirm,
    refetch,
    organizationId,
  ]);

  const handleDeleteSingle = useCallback(
    async (recording: Recording) => {
      const confirmed = await confirm({
        title: 'Delete Recording',
        message: 'Are you sure you want to delete this recording? This action cannot be undone.',
        confirmText: 'Delete',
        variant: 'danger',
      });
      if (confirmed) {
        try {
          await deleteRecordingMutation.mutateAsync(recording.id);
          toast.success('Recording deleted');
        } catch {
          toast.error('Failed to delete recording');
        }
      }
    },
    [confirm, deleteRecordingMutation]
  );

  // Playback speed change handler
  const handleSpeedChange = useCallback(() => {
    setPlaybackSpeed((prev) => {
      const idx = PLAYBACK_SPEEDS.indexOf(prev);
      const next = PLAYBACK_SPEEDS[(idx + 1) % PLAYBACK_SPEEDS.length];
      localStorage.setItem('manager-recording-playback-speed', String(next));
      if (audioRef.current) audioRef.current.playbackRate = next;
      return next;
    });
  }, []);

  // The single shared audio element, created lazily with its listeners bound
  // ONCE. timeupdate/loadedmetadata/ended read currentKeyRef so they always
  // update the row the element is currently loaded with.
  const ensureAudio = useCallback((): HTMLAudioElement => {
    if (audioRef.current) return audioRef.current;
    const audio = new Audio();
    audio.preload = 'auto';
    audio.addEventListener('timeupdate', () => {
      const key = currentKeyRef.current;
      if (key && audio.duration && !isNaN(audio.duration) && isFinite(audio.duration)) {
        setAudioProgress((prev) => ({ ...prev, [key]: (audio.currentTime / audio.duration) * 100 }));
        setCurrentTime((prev) => ({ ...prev, [key]: audio.currentTime }));
      }
      // Playback is advancing ⇒ definitely not buffering. Safety net so the
      // spinner can never stick (React bails out if the value is unchanged).
      if (key) setAudioLoading((prev) => (prev === key ? null : prev));
    });
    audio.addEventListener('loadedmetadata', () => {
      const key = currentKeyRef.current;
      if (key && audio.duration && !isNaN(audio.duration) && isFinite(audio.duration)) {
        setAudioDurations((prev) => ({ ...prev, [key]: audio.duration }));
      }
    });
    audio.addEventListener('ended', () => {
      const key = currentKeyRef.current;
      activeKeyRef.current = null;
      setPlayingId(null);
      setPausedId(null);
      if (key) {
        setAudioProgress((prev) => ({ ...prev, [key]: 0 }));
        setCurrentTime((prev) => ({ ...prev, [key]: 0 }));
      }
    });
    // Buffering feedback: the play() promise can resolve before the media has
    // actually buffered, so on a slow/large recording it stalls with no
    // indicator (looked frozen). Show the spinner whenever playback is waiting
    // on data (initial load or a mid-play stall) and clear it once it's
    // playing / ready / paused.
    const markLoading = () => {
      const key = currentKeyRef.current;
      if (key && activeKeyRef.current === key) setAudioLoading(key);
    };
    const clearLoading = () => {
      const key = currentKeyRef.current;
      setAudioLoading((prev) => (prev === key ? null : prev));
    };
    // Buffering feedback: the spinner is set the moment a recording is clicked
    // (in togglePlay), then driven by the element itself — `waiting` (playback
    // halted for data) re-shows it and `playing` hides it once audio actually
    // starts; the `timeupdate` handler above is the safety net so it can never
    // stick. Failures are handled in togglePlay's catch (which clears it), and
    // `stalled`/`canplay`/`pause`/`loadstart`/`error` are deliberately NOT used
    // — they fire in ways that flicker, stale-clear, or hide the spinner during
    // the fallback download.
    audio.addEventListener('waiting', markLoading);
    audio.addEventListener('playing', clearLoading);
    audioRef.current = audio;
    return audio;
  }, []);

  // Audio playback. ONE element ⇒ two recordings can never overlap; pointing it
  // at a new source stops the previous automatically. activeKeyRef (set
  // synchronously) is the source of truth for "the recording the user last
  // chose", so a superseded click's late load/play callbacks bail cleanly.
  const togglePlay = useCallback(
    async (recording: Recording) => {
      const recKey = recording.id;
      const audio = ensureAudio();

      // Toggle off the currently-playing recording.
      if (playingIdRef.current === recKey) {
        activeKeyRef.current = null;
        audio.pause();
        setPlayingId(null);
        setPausedId(recKey);
        setAudioLoading((prev) => (prev === recKey ? null : prev));
        return;
      }

      // Claim the element for this recording synchronously, stopping whatever
      // was playing.
      activeKeyRef.current = recKey;
      audio.pause();
      setPlayingId(recKey);
      setPausedId(null);

      // Point it at this recording unless it's already loaded with it (resuming
      // from pause keeps the buffered position). Prefer streaming:
      //  - S3-backed recordings stream direct from Spaces (presigned URL);
      //  - otherwise the same-origin proxy /stream endpoint (progressive).
      if (currentKeyRef.current !== recKey) {
        const src =
          audioUrlsRef.current[recKey] ||
          (recording.audioUrl?.includes('digitaloceanspaces.com')
            ? recording.audioUrl
            : recordingsService.getPlaybackStreamUrl(recording.id, organizationId));
        audioUrlsRef.current[recKey] = src;
        currentKeyRef.current = recKey;
        audio.src = src;
        // Show the spinner right away. It's cleared by the audio events once
        // playback actually starts (`playing`/`timeupdate`) and re-shown on a
        // stall (`waiting`). Resuming from pause skips this (no reload).
        setAudioLoading(recKey);
      }
      audio.playbackRate = playbackSpeedRef.current;

      try {
        await audio.play();
        // Loading is cleared by the audio element events, NOT here — play()
        // usually resolves before the media has actually buffered.
        if (activeKeyRef.current !== recKey) return;
        setPlayingId(recKey);
      } catch {
        // Superseded (src replaced → AbortError): the newer click owns the
        // element and its spinner now.
        if (activeKeyRef.current !== recKey) return;
        // Genuine failure on a progressive stream → fall back to a full,
        // authenticated blob download (always works) and retry once.
        const wasStreaming = !audioUrlsRef.current[recKey]?.startsWith('blob:');
        if (wasStreaming) {
          try {
            // Keep the spinner up through the (slow) full download.
            setAudioLoading(recKey);
            const blob = await recordingsService.getAudio(recording.id, organizationId);
            if (activeKeyRef.current !== recKey) return;
            const blobUrl = URL.createObjectURL(blob);
            audioUrlsRef.current[recKey] = blobUrl;
            audio.src = blobUrl;
            audio.playbackRate = playbackSpeedRef.current;
            await audio.play();
            if (activeKeyRef.current !== recKey) return;
            setPlayingId(recKey);
            return;
          } catch {
            if (activeKeyRef.current !== recKey) return;
          }
        }
        setAudioLoading(null);
        setPlayingId(null);
        toast.error('Unable to play recording. The file may be unavailable.');
      }
    },
    [ensureAudio, organizationId]
  );

  // Seek in audio (only meaningful for the recording the element is loaded with)
  const handleSeek = useCallback((recKey: string, e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    if (!audio || currentKeyRef.current !== recKey || !audio.duration || !isFinite(audio.duration))
      return;

    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, clickX / rect.width));
    audio.currentTime = ratio * audio.duration;
  }, []);

  // Sort handler (triggers server-side sort)
  const handleSort = useCallback(
    (field: SortField) => {
      setSortConfig((prev) => ({
        field,
        direction: prev.field === field && prev.direction === 'desc' ? 'asc' : 'desc',
      }));
      pagination.goToPage(1);
    },
    [pagination]
  );

  const recordingsList = recordings?.recordings || [];
  const resolvedOrganizationName = organizationName || orgQuota?.organizationName;
  const allSelected =
    recordingsList.length > 0 && recordingsList.every((r) => selectedIds.has(r.id));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[var(--foreground)]">
          {resolvedOrganizationName
            ? `${resolvedOrganizationName} Recordings`
            : 'Organization Recordings'}
        </h1>
        <p className="text-[var(--muted-foreground)] mt-1">
          {readOnly
            ? resolvedOrganizationName
              ? `Listen to and download recordings for ${resolvedOrganizationName}`
              : 'Listen to and download this organization’s recordings'
            : resolvedOrganizationName
              ? `Manage recordings for ${resolvedOrganizationName}`
              : 'Manage recordings for your organization'}
        </p>
      </div>

      {/* Organization Quota Card */}
      {orgQuota && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-[var(--primary)]/10">
                  <FiDisc className="w-6 h-6 text-[var(--primary)]" />
                </div>
                <div>
                  <p className="text-lg font-semibold text-[var(--foreground)]">
                    {orgQuota.organizationName}
                  </p>
                  <p className="text-sm text-[var(--muted-foreground)]">
                    {orgQuota.userCount} users • {formatGB(orgQuota.usedGB)} /{' '}
                    {formatGB(orgQuota.limitGB)} used
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-32 h-2 bg-[var(--muted)] rounded-full overflow-hidden">
                  <div
                    className={`h-full ${
                      orgQuota.status === 'exceeded'
                        ? 'bg-red-500'
                        : orgQuota.status === 'warning'
                          ? 'bg-amber-500'
                          : 'bg-green-500'
                    }`}
                    style={{ width: `${Math.min(orgQuota.percentUsed, 100)}%` }}
                  />
                </div>
                <span className="text-sm font-medium">{orgQuota.percentUsed.toFixed(0)}%</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Advanced filter bar */}
      <RecordingsFilters
        search={search}
        onSearchChange={setSearch}
        startDate={startDate}
        endDate={endDate}
        onStartDateChange={(v) => {
          setStartDate(v);
          setPreset('');
        }}
        onEndDateChange={(v) => {
          setEndDate(v);
          setPreset('');
        }}
        onPreset={(p) => {
          setPreset(p);
          const r = presetRange(p);
          setStartDate(r.start);
          setEndDate(r.end);
        }}
        preset={preset}
        showAgentFilter
        agents={agents}
        agentUserId={agentUserId}
        onAgentChange={setAgentUserId}
        direction={direction}
        onDirectionChange={setDirection}
        minDuration={minDuration}
        maxDuration={maxDuration}
        onMinDurationChange={setMinDuration}
        onMaxDurationChange={setMaxDuration}
        onClearAll={() => {
          setSearch('');
          setStartDate('');
          setEndDate('');
          setDirection('');
          setMinDuration('');
          setMaxDuration('');
          setAgentUserId(undefined);
          setPreset('');
        }}
      />

      {/* Bulk Actions Bar */}
      {!readOnly && <BulkActionsBar
        recordingsCount={recordingsList.length}
        total={recordings?.total ?? 0}
        selectedIds={selectedIds}
        allSelected={allSelected}
        isSelectAllMatchingFilter={isSelectAllMatchingFilter}
        isDownloading={isDownloading}
        isBulkDeleting={isBulkDeleting}
        downloadProgressLabel={downloadProgressLabel}
        downloadProgress={downloadProgress}
        onToggleSelectAll={toggleSelectAll}
        onSelectAllMatchingFilter={handleSelectAllMatchingFilter}
        onClearSelection={handleClearSelection}
        onBulkDownload={handleBulkDownload}
        onBulkDelete={handleBulkDelete}
        canDelete={canDelete}
      />}

      {/* Async server-side export — live progress + one resumable download. */}
      {recordingExportEnabled && exportJob && (
        <RecordingExportPanel
          job={exportJob}
          progress={exportProgress}
          onDownload={downloadRecordingExport}
          onCancel={cancelRecordingExport}
          onDismiss={dismissRecordingExport}
        />
      )}

      {/* Legacy chunked-download parts (flag off) — persists for selective re-download */}
      {downloadParts && (
        <DownloadPartsPanel
          statuses={downloadParts.statuses}
          totalCount={downloadParts.totalCount}
          batchSize={downloadParts.batchSize}
          isDownloading={isDownloading}
          onDownloadPart={handleDownloadPart}
          onRetryFailed={handleRetryFailedParts}
          onClose={() => setDownloadParts(null)}
        />
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <FiLoader className="w-8 h-8 animate-spin text-[var(--primary)]" />
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="text-center py-8">
          <FiAlertCircle className="w-12 h-12 text-[var(--danger)] mx-auto mb-4" />
          <p className="text-[var(--danger)]">Failed to load recordings</p>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && recordingsList.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center text-[var(--muted-foreground)]">
            {search ? 'No recordings match your search' : 'No recordings found'}
          </CardContent>
        </Card>
      )}

      {/* Recordings Table */}
      {!isLoading && !error && recordingsList.length > 0 && (
        <RecordingsTable
          recordings={recordingsList}
          selectedIds={selectedIds}
          sortConfig={sortConfig}
          playingId={playingId}
          pausedId={pausedId}
          audioLoading={audioLoading}
          audioProgress={audioProgress}
          currentTime={currentTime}
          audioDurations={audioDurations}
          playbackSpeed={playbackSpeed}
          onSort={handleSort}
          onToggleSelection={toggleSelection}
          onTogglePlay={togglePlay}
          onSeek={handleSeek}
          onSpeedChange={handleSpeedChange}
          onDownload={handleDownloadSingle}
          onDelete={handleDeleteSingle}
          canDelete={canDelete}
          selectable={!readOnly}
        />
      )}

      {/* Pagination */}
      {recordings && recordings.totalPages > 1 && (
        <Pagination
          page={pagination.page}
          totalPages={pagination.totalPages}
          totalItems={pagination.totalItems}
          pageSize={pagination.pageSize}
          hasNextPage={pagination.hasNextPage}
          hasPreviousPage={pagination.hasPreviousPage}
          pageRange={pagination.pageRange}
          onPageChange={pagination.goToPage}
          onPageSizeChange={pagination.setPageSize}
        />
      )}
    </div>
  );
}
