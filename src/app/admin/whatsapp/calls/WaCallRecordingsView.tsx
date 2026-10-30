'use client';

/**
 * WhatsApp Call Recordings View
 *
 * Manager-only orchestrator for /admin/whatsapp/calls. Owns:
 *   - filter state (search, direction, recording presence, date range)
 *   - selection state for bulk operations
 *   - audio playback state (HTMLAudioElement refs, progress, speed)
 *   - per-row + bulk download/delete handlers with toast + confirm
 *
 * Pure logic — rendering is delegated to BulkActionsBar +
 * WaCallRecordingsTable. Mirrors `ManagerRecordingsView` for SIP
 * recordings so the two manager surfaces feel consistent.
 *
 * @module app/admin/whatsapp/calls/WaCallRecordingsView
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FiFilter, FiLoader, FiRefreshCw, FiSearch, FiX } from 'react-icons/fi';
import { Button, Card, CardContent, Input, Pagination, StyledSelect } from '@/components/ui';
import { useConfirm, useDebounce, usePagination } from '@/lib/hooks';
import { toast } from '@/lib/stores/toast';
import { downloadFile } from '@/lib/utils/download';
import {
  waCallService,
  type AdminWaCall,
  type WaBulkFilter,
  type WaBulkInput,
} from '@/lib/api/services/waCall.service';
import { PLAYBACK_SPEEDS } from '@/components/recordings/AudioPlayer';
import { BulkActionsBar, WaCallRecordingsTable } from './WaCallRecordingsTable';

type DirectionFilter = '' | 'inbound' | 'outbound';
type RecordingFilter = '' | 'true' | 'false';

const PLAYBACK_SPEED_KEY = 'wa-call-recording-playback-speed';

export function WaCallRecordingsView() {
  // ----------------------------------------------------------------
  // Filters
  // ----------------------------------------------------------------
  const pagination = usePagination({ initialPageSize: 20 });
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [direction, setDirection] = useState<DirectionFilter>('');
  const [hasRecording, setHasRecording] = useState<RecordingFilter>('true');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // ----------------------------------------------------------------
  // Selection / bulk state
  // ----------------------------------------------------------------
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  // Virtual selection — "every row matching the current filter, across
  // pages." selectedIds stays empty in this mode; the count comes from
  // `total` instead. Same UX as Gmail's "Select all 524 conversations".
  const [isSelectAllMatchingFilter, setIsSelectAllMatchingFilter] = useState(false);
  const [isDownloadingBulk, setIsDownloadingBulk] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const { confirm } = useConfirm();

  // ----------------------------------------------------------------
  // Audio state (mirrors the SIP recordings player pattern)
  // ----------------------------------------------------------------
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [pausedId, setPausedId] = useState<string | null>(null);
  const [audioLoading, setAudioLoading] = useState<string | null>(null);
  const [audioProgress, setAudioProgress] = useState<Record<string, number>>({});
  const [currentTime, setCurrentTime] = useState<Record<string, number>>({});
  const [audioDurations, setAudioDurations] = useState<Record<string, number>>({});
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(PLAYBACK_SPEED_KEY);
      const parsed = saved ? parseFloat(saved) : 1;
      return PLAYBACK_SPEEDS.includes(parsed) ? parsed : 1;
    }
    return 1;
  });

  const audioRefs = useRef<Record<string, HTMLAudioElement>>({});
  const audioUrlsRef = useRef<Record<string, string>>({});
  // Stable refs for callbacks that should NOT re-fire on each render — we
  // need the current playing id / speed at click time, not at hook-init time.
  const playingIdRef = useRef(playingId);
  playingIdRef.current = playingId;
  const playbackSpeedRef = useRef(playbackSpeed);
  playbackSpeedRef.current = playbackSpeed;

  // ----------------------------------------------------------------
  // Data fetch
  // ----------------------------------------------------------------
  const queryClient = useQueryClient();
  const queryParams = useMemo(
    () => ({
      page: pagination.page,
      limit: pagination.pageSize,
      search: debouncedSearch || undefined,
      direction: direction || undefined,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      hasRecording: hasRecording === 'true' ? true : hasRecording === 'false' ? false : undefined,
    }),
    [
      pagination.page,
      pagination.pageSize,
      debouncedSearch,
      direction,
      startDate,
      endDate,
      hasRecording,
    ]
  );

  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ['admin', 'whatsapp', 'calls', queryParams],
    queryFn: () => waCallService.adminGetCalls(queryParams),
    staleTime: 30_000,
  });

  useEffect(() => {
    if (data?.total !== undefined) {
      pagination.setTotalItems(data.total);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.total]);

  // Reset selection whenever the result set changes — selected IDs from a
  // previous page would otherwise persist invisibly and bite on bulk ops.
  // Same applies to the virtual "all matching filter" selection — the
  // filter just changed, so the selection it referred to is meaningless.
  useEffect(() => {
    setSelectedIds(new Set());
    setIsSelectAllMatchingFilter(false);
  }, [
    pagination.page,
    pagination.pageSize,
    debouncedSearch,
    direction,
    startDate,
    endDate,
    hasRecording,
  ]);

  // Stop audio when leaving the page or when filters change. Without this
  // the manager hears playback from a row that's no longer rendered.
  useEffect(() => {
    Object.values(audioRefs.current).forEach((audio) => {
      audio.pause();
    });
    setPlayingId(null);
    setPausedId(null);
  }, [pagination.page, debouncedSearch, direction, startDate, endDate, hasRecording]);

  // Final cleanup — revoke object URLs so we don't leak blob storage.
  useEffect(() => {
    return () => {
      Object.values(audioRefs.current).forEach((audio) => {
        audio.pause();
        audio.src = '';
      });
      Object.values(audioUrlsRef.current).forEach((url) => {
        if (url.startsWith('blob:')) URL.revokeObjectURL(url);
      });
    };
  }, []);

  const calls = useMemo(() => data?.calls ?? [], [data?.calls]);
  const total = data?.total ?? 0;
  const hasActiveFilters = !!(direction || startDate || endDate || hasRecording !== 'true');

  // Eligible-for-bulk = rows that actually have a recording. Bulk
  // download/delete can't operate on calls without one.
  const eligibleIds = useMemo(
    () => calls.filter((c) => !!c.recordingUrl).map((c) => c.callId),
    [calls]
  );
  const allSelected = eligibleIds.length > 0 && eligibleIds.every((id) => selectedIds.has(id));

  // The filter as the server understands it. Sent to bulk endpoints when
  // the user is in "select all matching" mode so server-side enumeration
  // matches the table contents exactly. Pinning hasRecording=true here:
  // bulk download/delete only operate on recorded calls, and the table
  // already defaults to that filter, so this avoids any surprise where a
  // future UI tweak loosens the filter without us noticing.
  const currentFilter = useMemo<WaBulkFilter>(
    () => ({
      direction: direction || undefined,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      search: debouncedSearch || undefined,
      hasRecording: true,
    }),
    [direction, startDate, endDate, debouncedSearch]
  );

  // ----------------------------------------------------------------
  // Filter handlers
  // ----------------------------------------------------------------
  const clearFilters = useCallback(() => {
    setDirection('');
    setStartDate('');
    setEndDate('');
    setHasRecording('true');
  }, []);

  // ----------------------------------------------------------------
  // Selection handlers
  // ----------------------------------------------------------------
  const toggleSelection = useCallback((callId: string) => {
    // Clicking a single-row checkbox exits virtual select-all mode (the
    // user is making a per-row decision now, not operating on the whole
    // matching set).
    setIsSelectAllMatchingFilter(false);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(callId)) {
        next.delete(callId);
      } else {
        next.add(callId);
      }
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    setIsSelectAllMatchingFilter(false);
    setSelectedIds((prev) => {
      const allChecked = eligibleIds.length > 0 && eligibleIds.every((id) => prev.has(id));
      if (allChecked) return new Set();
      return new Set(eligibleIds);
    });
  }, [eligibleIds]);

  const handleSelectAllMatchingFilter = useCallback(() => {
    // Virtual selection — selectedIds stays empty, the UI sources the
    // count from `total` via isSelectAllMatchingFilter.
    setIsSelectAllMatchingFilter(true);
  }, []);

  const handleClearSelection = useCallback(() => {
    setSelectedIds(new Set());
    setIsSelectAllMatchingFilter(false);
  }, []);

  // Download via XHR → blob → `<a download>`. Chrome saves natively
  // from the local blob; no server roundtrip during save, no download-
  // manager interception.
  //
  // Why XHR instead of fetch:
  //   Some download-manager browser extensions (IDM in particular) hook
  //   `window.fetch` at the page level and consume the response body
  //   for their own queue — the JS-side `response.blob()` then returns
  //   a 0-byte Blob and Chrome saves a "Failed - No file" entry. XHR
  //   with `responseType='blob'` predates the fetch hook surface, so
  //   IDM's extension typically leaves it alone. Same final outcome
  //   either way (blob → `<a download>` → browser saves locally) — the
  //   choice of transport is purely to dodge the fetch-hook.
  //
  // EXPLICIT filename: `a.download` is set to a date-stamped string so
  // the OS file association is `.zip` regardless of what the server's
  // Content-Disposition header says. Without this, Chrome occasionally
  // falls back to URL basename + MIME-guessed extension (saved files
  // as `<token>.txt`).
  //
  // X-Requested-With header doubles as a hint to any intermediate
  // proxy/extension that this is an in-app XHR, not a user-initiated
  // download click — many download managers respect that flag.
  const triggerDirectDownload = useCallback((url: string): Promise<void> => {
    const filename = `wa-recordings-${new Date().toISOString().slice(0, 10)}.zip`;
    return new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('GET', url, true);
      xhr.responseType = 'blob';
      xhr.withCredentials = true;
      xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
      xhr.onload = () => {
        if (xhr.status < 200 || xhr.status >= 300) {
          reject(new Error(`Download failed: HTTP ${xhr.status}`));
          return;
        }
        const blob = xhr.response as Blob;
        if (!blob || blob.size === 0) {
          reject(
            new Error(
              'Server returned an empty file. If you have a download-manager extension (IDM, JDownloader, etc.), add this site to its exclusion list and retry.'
            )
          );
          return;
        }
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        // Defer revoke so Chrome can copy the blob to disk before the
        // reference is dropped.
        setTimeout(() => URL.revokeObjectURL(blobUrl), 30_000);
        resolve();
      };
      xhr.onerror = () => reject(new Error('Network error during download'));
      xhr.ontimeout = () => reject(new Error('Download timed out'));
      xhr.send();
    });
  }, []);

  // ----------------------------------------------------------------
  // Per-row download
  // ----------------------------------------------------------------
  const handleDownloadSingle = useCallback(async (call: AdminWaCall) => {
    if (!call.recordingUrl) return;
    setDownloadingId(call.callId);
    try {
      const blob = await waCallService.downloadRecording(call.callId);
      // Build a descriptive filename: date_customer_agentExt.webm so the
      // manager can scan their Downloads folder and know which file is
      // which. Sanitize to safe characters.
      const safe = (s: string) => s.replace(/[^a-zA-Z0-9_.-]/g, '_');
      const date = call.startedAt
        ? new Date(call.startedAt).toISOString().slice(0, 10)
        : new Date().toISOString().slice(0, 10);
      const agentLabel = call.agent
        ? safe(call.agent.extension || call.agent.name || `user${call.agent.id}`)
        : 'unassigned';
      const filename = `wa-call_${date}_${safe(call.customerNumber)}_${agentLabel}.webm`;
      downloadFile({ blobOrUrl: blob, filename });
    } catch (err) {
      console.error('WA call download failed', err);
      toast.error('Failed to download recording');
    } finally {
      setDownloadingId(null);
    }
  }, []);

  // ----------------------------------------------------------------
  // Per-row delete
  // ----------------------------------------------------------------
  const handleDeleteSingle = useCallback(
    async (call: AdminWaCall) => {
      if (!call.recordingUrl) return;
      const confirmed = await confirm({
        title: 'Delete Recording',
        message:
          'Are you sure you want to delete this WhatsApp call recording? This action cannot be undone.',
        confirmText: 'Delete',
        variant: 'danger',
      });
      if (!confirmed) return;

      setDeletingId(call.callId);
      try {
        await waCallService.deleteRecording(call.callId);
        toast.success('Recording deleted');
        // Invalidate the admin calls query family so any open instance
        // refetches with the recording removed.
        queryClient.invalidateQueries({ queryKey: ['admin', 'whatsapp', 'calls'] });
      } catch (err) {
        console.error('WA call delete failed', err);
        toast.error('Failed to delete recording');
      } finally {
        setDeletingId(null);
      }
    },
    [confirm, queryClient]
  );

  // ----------------------------------------------------------------
  // Build the bulk request body — same shape used by download + delete.
  // Returns null when there's nothing to act on (caller should bail).
  // ----------------------------------------------------------------
  const buildBulkInput = useCallback((): WaBulkInput | null => {
    if (isSelectAllMatchingFilter) {
      return { mode: 'filter', filter: currentFilter };
    }
    if (selectedIds.size === 0) return null;
    return { mode: 'ids', callIds: Array.from(selectedIds) };
  }, [isSelectAllMatchingFilter, selectedIds, currentFilter]);

  // Effective count of recordings the bulk action will operate on. In
  // virtual mode that's the server's `total`; otherwise it's the explicit
  // selection size.
  const effectiveSelectionCount = isSelectAllMatchingFilter ? total : selectedIds.size;

  // ----------------------------------------------------------------
  // Bulk download
  // ----------------------------------------------------------------
  const handleBulkDownload = useCallback(async () => {
    const input = buildBulkInput();
    if (!input) return;
    setIsDownloadingBulk(true);
    try {
      // POST mints the token; the GET URL it returns is what we fetch.
      // Server enforces org-scope + role on the mint endpoint, so by
      // the time we get a URL the selection is already validated.
      const url = await waCallService.getBulkDownloadUrl(input);
      await triggerDirectDownload(url);
      toast.success(
        `Downloaded ${effectiveSelectionCount} recording${effectiveSelectionCount === 1 ? '' : 's'}`
      );
    } catch (err) {
      console.error('WA bulk download failed', err);
      const message = err instanceof Error ? err.message : 'Failed to download recordings';
      toast.error(message);
    } finally {
      setIsDownloadingBulk(false);
    }
  }, [buildBulkInput, effectiveSelectionCount, triggerDirectDownload]);

  // ----------------------------------------------------------------
  // Bulk delete
  // ----------------------------------------------------------------
  const handleBulkDelete = useCallback(async () => {
    const input = buildBulkInput();
    if (!input) return;
    // Title + button label pluralize off the effective count (matching-
    // filter mode could be 1 or 1000 — either should read correctly).
    const isSingle = effectiveSelectionCount === 1;
    const confirmed = await confirm({
      title: isSingle ? 'Delete Recording' : 'Delete Selected Recordings',
      message: `Are you sure you want to delete ${effectiveSelectionCount} recording${
        isSingle ? '' : 's'
      }? This action cannot be undone.`,
      confirmText: isSingle ? 'Delete' : 'Delete All',
      variant: 'danger',
    });
    if (!confirmed) return;

    setIsBulkDeleting(true);
    try {
      const result = await waCallService.bulkDeleteRecordings(input);
      handleClearSelection();
      queryClient.invalidateQueries({ queryKey: ['admin', 'whatsapp', 'calls'] });
      if (result.failCount === 0) {
        toast.success(result.message);
      } else {
        toast.error(`Deleted ${result.successCount}, failed ${result.failCount}`);
      }
    } catch (err) {
      console.error('WA bulk delete failed', err);
      const message = err instanceof Error ? err.message : 'Failed to delete recordings';
      toast.error(message);
    } finally {
      setIsBulkDeleting(false);
    }
  }, [buildBulkInput, effectiveSelectionCount, confirm, queryClient, handleClearSelection]);

  // ----------------------------------------------------------------
  // Playback
  // ----------------------------------------------------------------
  const togglePlay = useCallback(async (call: AdminWaCall) => {
    if (!call.recordingUrl) return;
    const key = call.callId;

    // Currently playing this one → pause.
    if (playingIdRef.current === key) {
      audioRefs.current[key]?.pause();
      setPlayingId(null);
      setPausedId(key);
      return;
    }

    // Currently playing a different recording → pause it first so only one
    // plays at a time.
    if (playingIdRef.current && audioRefs.current[playingIdRef.current]) {
      audioRefs.current[playingIdRef.current].pause();
    }

    setPlayingId(key);
    setPausedId(null);

    // Spinner only after 250ms to avoid flicker on instant plays.
    let spinnerTimeout: ReturnType<typeof setTimeout> | null = null;

    try {
      if (!audioRefs.current[key]) {
        spinnerTimeout = setTimeout(() => setAudioLoading(key), 250);

        // Fetch the audio bytes through the proxy. The server returns
        // audio/webm; we wrap in a blob URL so HTMLAudioElement can seek.
        let blobUrl = audioUrlsRef.current[key];
        if (!blobUrl) {
          const blob = await waCallService.downloadRecording(key);
          blobUrl = URL.createObjectURL(blob);
          audioUrlsRef.current[key] = blobUrl;
        }

        const audio = new Audio(blobUrl);

        await new Promise<void>((resolve, reject) => {
          const onLoaded = () => {
            audio.removeEventListener('loadedmetadata', onLoaded);
            audio.removeEventListener('error', onError);
            resolve();
          };
          const onError = (e: Event) => {
            audio.removeEventListener('loadedmetadata', onLoaded);
            audio.removeEventListener('error', onError);
            reject(e);
          };
          audio.addEventListener('loadedmetadata', onLoaded);
          audio.addEventListener('error', onError);
        });

        // Seed audioDurations with whichever value is more likely to be
        // accurate: a finite live duration takes precedence, otherwise the
        // backend's `durationSecs`. This way handleSeek always has SOMETHING
        // to compute a ratio from on WebM/Opus files where audio.duration
        // remains Infinity for the lifetime of the element.
        const seedDuration =
          isFinite(audio.duration) && audio.duration > 0
            ? audio.duration
            : call.durationSecs > 0
              ? call.durationSecs
              : 0;
        if (seedDuration > 0) {
          setAudioDurations((prev) => ({ ...prev, [key]: seedDuration }));
        }

        // WebM/Opus from MediaRecorder (which is what these recordings are)
        // doesn't set a container-level duration, so `audio.duration` reports
        // `Infinity` until the file plays through. Previously this branch
        // bailed entirely when duration was bad, so currentTime never ticked.
        //
        // Split the update: currentTime is ALWAYS authoritative from the
        // audio element. Progress % needs a denominator — prefer the live
        // duration when it's finite, otherwise fall back to the backend's
        // recorded `durationSecs` (captured in closure here so it's stable
        // even after the timeupdate listener outlives this render).
        const fallbackDuration = call.durationSecs;
        audio.addEventListener('timeupdate', () => {
          setCurrentTime((prev) => ({ ...prev, [key]: audio.currentTime }));
          const dur =
            isFinite(audio.duration) && audio.duration > 0 ? audio.duration : fallbackDuration;
          if (dur > 0) {
            setAudioProgress((prev) => ({
              ...prev,
              [key]: Math.min(100, (audio.currentTime / dur) * 100),
            }));
          }
        });

        audio.addEventListener('ended', () => {
          setPlayingId(null);
          setPausedId(null);
          setAudioProgress((prev) => ({ ...prev, [key]: 0 }));
          setCurrentTime((prev) => ({ ...prev, [key]: 0 }));
        });

        audioRefs.current[key] = audio;
        if (spinnerTimeout) clearTimeout(spinnerTimeout);
        setAudioLoading(null);
      }

      audioRefs.current[key].playbackRate = playbackSpeedRef.current;
      await audioRefs.current[key].play();
      setPlayingId(key);
    } catch (err) {
      console.error('WA call playback failed', err);
      if (spinnerTimeout) clearTimeout(spinnerTimeout);
      setAudioLoading(null);
      setPlayingId(null);
      toast.error('Unable to play recording. The file may be unavailable.');
    }
  }, []);

  const handleSeek = useCallback(
    (key: string, e: React.MouseEvent<HTMLDivElement>) => {
      const audio = audioRefs.current[key];
      if (!audio) return;
      // Same Infinity-duration story as timeupdate — prefer the live
      // duration, fall back to the backend value so seek works on
      // WebM/Opus files that don't expose container duration.
      const liveDuration = isFinite(audio.duration) && audio.duration > 0 ? audio.duration : 0;
      const fallback = audioDurations[key] || 0;
      const duration = liveDuration || fallback;
      if (duration <= 0) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const ratio = Math.max(0, Math.min(1, clickX / rect.width));
      audio.currentTime = ratio * duration;
    },
    [audioDurations]
  );

  const handleSpeedChange = useCallback(() => {
    setPlaybackSpeed((prev) => {
      const idx = PLAYBACK_SPEEDS.indexOf(prev);
      const next = PLAYBACK_SPEEDS[(idx + 1) % PLAYBACK_SPEEDS.length];
      try {
        localStorage.setItem(PLAYBACK_SPEED_KEY, String(next));
      } catch {
        // localStorage can throw in private mode — playback still works.
      }
      Object.values(audioRefs.current).forEach((audio) => {
        if (audio) audio.playbackRate = next;
      });
      return next;
    });
  }, []);

  // ----------------------------------------------------------------
  // Render
  // ----------------------------------------------------------------
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-[var(--foreground)]">
            WhatsApp Call Recordings
          </h2>
          <p className="text-sm text-[var(--muted-foreground)] mt-0.5">
            {total.toLocaleString()} total call{total === 1 ? '' : 's'} in your organization
          </p>
        </div>
        <Button
          variant="secondary"
          size="icon"
          onClick={() => refetch()}
          disabled={isFetching}
          aria-label="Refresh"
        >
          <FiRefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* Search + filter toggle */}
      <div className="flex items-center gap-2">
        <div className="w-full max-w-md">
          <Input
            placeholder="Search customer number / name or agent name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            leftIcon={<FiSearch className="w-4 h-4" aria-hidden="true" />}
            aria-label="Search calls"
          />
        </div>
        <Button
          variant={showFilters ? 'primary' : 'outline'}
          size="sm"
          onClick={() => setShowFilters((v) => !v)}
        >
          <FiFilter className="w-4 h-4" />
          {hasActiveFilters && (
            <span className="ml-1 px-1.5 py-0.5 text-xs rounded-full bg-[var(--primary-600)] text-white">
              {
                [direction, startDate, endDate, hasRecording !== 'true' ? hasRecording : ''].filter(
                  Boolean
                ).length
              }
            </span>
          )}
        </Button>
      </div>

      {/* Filters panel */}
      {showFilters && (
        <div className="flex flex-wrap gap-4 p-4 rounded-lg border border-[var(--border)] bg-[var(--card)]">
          <div>
            <label className="text-xs font-medium text-[var(--muted-foreground)] mb-1 block">
              From
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-sm text-[var(--foreground)] [color-scheme:light_dark]"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-[var(--muted-foreground)] mb-1 block">
              To
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-sm text-[var(--foreground)] [color-scheme:light_dark]"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-[var(--muted-foreground)] mb-1 block">
              Direction
            </label>
            <StyledSelect
              value={direction}
              onChange={(v) => setDirection(v as DirectionFilter)}
              className="w-44 bg-[var(--background)]"
            >
              <option value="">All</option>
              <option value="inbound">Inbound</option>
              <option value="outbound">Outbound</option>
            </StyledSelect>
          </div>
          <div>
            <label className="text-xs font-medium text-[var(--muted-foreground)] mb-1 block">
              Recording
            </label>
            <StyledSelect
              value={hasRecording}
              onChange={(v) => setHasRecording(v as RecordingFilter)}
              className="w-44 bg-[var(--background)]"
            >
              <option value="true">With recording</option>
              <option value="false">Without recording</option>
              <option value="">All calls</option>
            </StyledSelect>
          </div>
          {hasActiveFilters && (
            <div className="flex items-end">
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <FiX className="w-4 h-4 mr-1" />
                Clear filters
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Bulk actions — mirrors the SIP recordings UserBulkActionsBar */}
      <BulkActionsBar
        eligibleIds={eligibleIds}
        selectedIds={selectedIds}
        totalMatchingFilter={total}
        isSelectAllMatchingFilter={isSelectAllMatchingFilter}
        hasActiveScope={hasActiveFilters || !!debouncedSearch}
        isDownloading={isDownloadingBulk}
        isBulkDeleting={isBulkDeleting}
        onToggleSelectAll={toggleSelectAll}
        onSelectAllMatchingFilter={handleSelectAllMatchingFilter}
        onClearSelection={handleClearSelection}
        onBulkDownload={handleBulkDownload}
        onBulkDelete={handleBulkDelete}
      />

      {/* States */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <FiLoader className="w-8 h-8 animate-spin text-[var(--primary)]" />
        </div>
      )}

      {error && !isLoading && (
        <Card>
          <CardContent className="p-6 text-center text-[var(--danger)]">
            Failed to load call recordings.{' '}
            <button className="underline" onClick={() => refetch()}>
              Retry
            </button>
          </CardContent>
        </Card>
      )}

      {!isLoading && !error && calls.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center text-[var(--muted-foreground)]">
            {hasActiveFilters || debouncedSearch
              ? 'No calls match your filters'
              : 'No WhatsApp calls in your organization yet'}
          </CardContent>
        </Card>
      )}

      {/* Table */}
      {!isLoading && !error && calls.length > 0 && (
        <>
          <WaCallRecordingsTable
            calls={calls}
            selectedIds={selectedIds}
            isSelectAllMatchingFilter={isSelectAllMatchingFilter}
            allSelected={allSelected}
            hasEligibleRows={eligibleIds.length > 0}
            playingId={playingId}
            pausedId={pausedId}
            audioLoading={audioLoading}
            audioProgress={audioProgress}
            currentTime={currentTime}
            audioDurations={audioDurations}
            playbackSpeed={playbackSpeed}
            downloadingId={downloadingId}
            deletingId={deletingId}
            onToggleSelection={toggleSelection}
            onToggleSelectAll={toggleSelectAll}
            onTogglePlay={togglePlay}
            onSeek={handleSeek}
            onSpeedChange={handleSpeedChange}
            onDownload={handleDownloadSingle}
            onDelete={handleDeleteSingle}
          />

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
            disabled={isFetching}
            showPageSizeSelector
            showTotalItems
          />
        </>
      )}
    </div>
  );
}
