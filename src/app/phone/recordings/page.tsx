'use client';

/**
 * Recordings Page (User View)
 *
 * Display call recordings with play and download functionality.
 * Users can view their quota and download recordings but cannot delete them.
 * Managers, admins, and org owners can also delete recordings (owners so they
 * can free their org's storage cap).
 *
 * Sub-components extracted to:
 * - UserRecordingPlayer.tsx  (RecordingCard)
 * - UserRecordingsTable.tsx  (QuotaProgress, UserBulkActionsBar, UserRecordingsList)
 *
 * @module app/phone/recordings/page
 */

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  FiDisc,
  FiRefreshCw,
  FiSearch,
  FiAlertCircle,
  FiFilter,
  FiX,
  FiChevronDown,
  FiPhoneIncoming,
  FiPhoneOutgoing,
  FiDatabase,
  FiArrowRight,
} from 'react-icons/fi';
import { FaWhatsapp } from 'react-icons/fa';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { waCallService } from '@/lib/api/services/waCall.service';
import { formatLocalDate } from '@/lib/utils/datetime';
import { Button, Pagination, StyledSelect } from '@/components/ui';
import {
  useRecordingsPaginated,
  useRecordingQuota,
  useMyRecordingStats,
  useDeleteRecording,
  useBulkDeleteRecordings,
  useBulkDownloadPlan,
  usePagination,
  useConfirm,
} from '@/lib/hooks';
import { recordingsService, type Recording, type BulkOperationFilter } from '@/lib/api';
import { toast } from '@/lib/stores/toast';
import { PageTransition } from '@/components/phone';
import { usePermissions } from '@/lib/hooks/usePermissions';
import { QuotaProgress, UserBulkActionsBar, UserRecordingsList } from './UserRecordingsTable';

function StatItem({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode;
  value: React.ReactNode;
  label: string;
}) {
  return (
    <div className="flex items-center gap-1.5 shrink-0">
      {icon}
      <span className="text-[15px] font-black text-[var(--foreground)] tabular-nums leading-none">
        {value}
      </span>
      <span className="text-[12px] text-[var(--muted-foreground)] leading-none">{label}</span>
    </div>
  );
}

const formatGB = (gb: number): string => {
  if (gb < 1) return `${Math.round(gb * 1000)}MB`;
  return `${gb.toFixed(1)}GB`;
};

/**
 * Get date group label for a timestamp
 */
const getDateGroup = (timestamp: string): string => {
  const date = new Date(timestamp);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const msgDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  if (msgDate.getTime() === today.getTime()) return 'Today';
  if (msgDate.getTime() === yesterday.getTime()) return 'Yesterday';

  return formatLocalDate(date);
};

type DirectionFilter = '' | 'inbound' | 'outbound';

// ============================================================
// Main Component
// ============================================================

export default function RecordingsPage() {
  // Delete access: admin/manager, PLUS org owners (auto-signup account holders)
  // so they can free their org's 1 GB storage from the recordings page. Owners
  // hold DELETE_RECORDINGS via the role wildcard; deletes are org-scoped
  // server-side (an owner can only delete their own org's recordings).
  const { isAdmin, isManager, isOwner } = usePermissions();
  const canDelete = isAdmin || isManager || isOwner;

  // Bulk selection state (only for managers/admins)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  // True when the user has clicked "Select all N matching filter" — actions
  // then operate on the entire filtered set, server-side, instead of
  // `selectedIds`. Cleared whenever the filter or page changes.
  const [isSelectAllMatchingFilter, setIsSelectAllMatchingFilter] = useState(false);
  // Selection mode — when off, no per-row checkboxes render (keeps the list
  // uncluttered, esp. on mobile). Managers tap "Select" to opt in.
  const [selectionMode, setSelectionMode] = useState(false);
  const toggleSelectionMode = useCallback(() => {
    setSelectionMode((m) => {
      if (m) {
        // Exiting selection mode — clear any selection.
        setSelectedIds(new Set());
        setIsSelectAllMatchingFilter(false);
      }
      return !m;
    });
  }, []);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgressLabel, setDownloadProgressLabel] = useState<string | null>(null);

  // Pagination state
  const pagination = usePagination({ initialPageSize: 20 });

  // Search state with debounce
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Filter state
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [direction, setDirection] = useState<DirectionFilter>('');
  const [showFilters, setShowFilters] = useState(false);

  const router = useRouter();

  // WhatsApp recording stats
  const { data: waCallData } = useQuery({
    queryKey: ['wa-calls', 'recording-stats'],
    queryFn: async () => {
      const result = await waCallService.getHistory(200, 0);
      const withRecording = result.calls.filter((c) => c.recordingUrl);
      const totalDuration = withRecording.reduce((sum, c) => sum + (c.durationSecs || 0), 0);
      return { count: withRecording.length, totalDuration };
    },
    staleTime: 60_000,
  });

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      pagination.goToPage(1);
    }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- pagination.goToPage is stable from usePagination hook
  }, [searchQuery]);

  // Reset page on filter change
  useEffect(() => {
    pagination.goToPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate, direction]);

  // Fetch recordings with pagination
  const {
    data: recordingsData,
    isLoading,
    error,
    refetch,
    isFetching,
  } = useRecordingsPaginated({
    page: pagination.page,
    limit: pagination.pageSize,
    search: debouncedSearch || undefined,
    direction: direction || undefined,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
  });

  // Fetch quota status
  const { data: quota } = useRecordingQuota();

  // Fetch stats
  const { data: stats } = useMyRecordingStats();

  // Delete mutation (only for managers/admins)
  const deleteRecording = useDeleteRecording();
  const bulkDelete = useBulkDeleteRecordings();
  const bulkDownloadPlan = useBulkDownloadPlan();
  const { confirm } = useConfirm();

  // Update total items when data changes
  useEffect(() => {
    if (recordingsData?.total !== undefined) {
      pagination.setTotalItems(recordingsData.total);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- pagination.setTotalItems is stable from usePagination hook
  }, [recordingsData?.total]);

  // Recordings from response
  const recordings = recordingsData?.recordings || [];

  const hasActiveFilters = !!(startDate || endDate || direction);

  const clearFilters = useCallback(() => {
    setStartDate('');
    setEndDate('');
    setDirection('');
  }, []);

  // Group recordings by date
  const groupedRecordings = useMemo(() => {
    const groups: { label: string; items: Recording[] }[] = [];
    let currentGroup: string | null = null;

    for (const rec of recordings) {
      const group = getDateGroup(rec.startTime);
      if (group !== currentGroup) {
        groups.push({ label: group, items: [rec] });
        currentGroup = group;
      } else {
        groups[groups.length - 1].items.push(rec);
      }
    }

    return groups;
  }, [recordings]);

  const handleDelete = useCallback(
    async (recording: Recording) => {
      const confirmed = await confirm({
        title: 'Delete Recording',
        message: `Are you sure you want to delete this recording? This action cannot be undone.`,
        confirmText: 'Delete',
        variant: 'danger',
      });

      if (confirmed) {
        try {
          await deleteRecording.mutateAsync(recording.id);
          toast.success('Recording deleted');
        } catch {
          toast.error('Failed to delete recording');
        }
      }
    },
    [confirm, deleteRecording]
  );

  // ============================================================
  // Bulk Selection Handlers (Managers/Admins only)
  // ============================================================

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
    const allIds = recordings.map((r) => r.id);
    const allSelected = allIds.every((id) => selectedIds.has(id));
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(allIds));
    }
    // Page-scoped toggle always exits all-matching-filter mode.
    setIsSelectAllMatchingFilter(false);
  }, [recordings, selectedIds]);

  // The current filter as the server understands it. Sent to bulk endpoints
  // so server-side enumeration matches what the user is seeing on screen.
  const currentFilter = useMemo<BulkOperationFilter>(
    () => ({
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      direction: direction || undefined,
      search: debouncedSearch || undefined,
    }),
    [startDate, endDate, direction, debouncedSearch]
  );

  const handleSelectAllMatchingFilter = useCallback(() => {
    // Virtual selection — UI is sourced from `isSelectAllMatchingFilter`,
    // so individual `selectedIds` doesn't need to grow to match.
    setIsSelectAllMatchingFilter(true);
  }, []);

  const handleClearSelection = useCallback(() => {
    setSelectedIds(new Set());
    setIsSelectAllMatchingFilter(false);
  }, []);

  // Clear selection (both real and virtual) when page or filter changes —
  // otherwise the user could end up with a "selected" set that doesn't match
  // what they're looking at.
  useEffect(() => {
    setSelectedIds(new Set());
    setIsSelectAllMatchingFilter(false);
  }, [pagination.page, debouncedSearch, startDate, endDate, direction]);

  /**
   * Fetch the ZIP and trigger a Chrome-native download. The function
   * resolves only AFTER the browser has the full blob in memory and the
   * download bar has been shown — so awaiting it gives the caller a
   * real-time signal of "is the download visible to the user yet". No
   * artificial delays, no settling timers.
   *
   * Why fetch+blob (not iframe / `<a href>`):
   *  - Iframe is fire-and-forget; the JS can't observe whether Chrome
   *    actually surfaced the download. The button would re-enable while
   *    the user still sees nothing happening.
   *  - With fetch, the awaited promise tracks the entire transfer; the
   *    moment it resolves we know the download bar is visible.
   *
   * Trade-off: the ZIP is buffered in memory before being handed to the
   * browser. Each batch is bounded at ~100 recordings (~20-50MB typical),
   * which is fine for browsers; we never hold more than one batch's
   * worth at a time. Object URL is revoked after 30s so the blob can be
   * garbage-collected once Chrome has copied it to disk.
   *
   * (Download managers like IDM that hook the browser may or may not
   * intercept this flow — that's not the experience we optimize for.)
   */
  const triggerDirectDownload = useCallback(async (url: string): Promise<void> => {
    const response = await fetch(url, { credentials: 'include' });
    if (!response.ok) {
      throw new Error(`Download failed: HTTP ${response.status}`);
    }
    const blob = await response.blob();

    // Parse filename from Content-Disposition (server sets it; CORS
    // exposes it). Quoted-string form is what archiver/express produce;
    // the fallback covers any future server-side change.
    const cd = response.headers.get('content-disposition') || '';
    const match = cd.match(/filename="?([^";]+)"?/);
    const filename = match ? match[1] : 'recordings.zip';

    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = objectUrl;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    // Hold the object URL long enough for Chrome to copy the blob into
    // its downloads folder. 30s is generous for our batch sizes; revoking
    // earlier on slow disks could truncate the file.
    setTimeout(() => URL.revokeObjectURL(objectUrl), 30_000);
  }, []);

  const handleBulkDownload = useCallback(async () => {
    if (!isSelectAllMatchingFilter && selectedIds.size === 0) return;

    setIsDownloading(true);
    setDownloadProgressLabel(null);

    try {
      // ids-mode fast path: schema caps the array at 100, so the result
      // is ALWAYS a single batch. No /plan round trip needed — we go
      // straight to /token and fire the iframe. This is the click→
      // download path and it must be a single round trip (~200-300ms)
      // for the experience to feel instant.
      if (!isSelectAllMatchingFilter) {
        // Single-batch fast path: token mint + fetched-and-handed-off ZIP.
        // The await on triggerDirectDownload keeps the button locked
        // until Chrome has actually shown the download — no fake delay.
        setDownloadProgressLabel('Preparing...');
        const downloadUrl = await recordingsService.getBulkDownloadUrl({
          mode: 'ids',
          ids: Array.from(selectedIds),
        });
        await triggerDirectDownload(downloadUrl);
        toast.success('Download started');
        return;
      }

      // Filter-mode (select-all-matching-filter): we DO need the count
      // up front because we may have to confirm a multi-ZIP download
      // with the user before committing. The /plan response is what
      // populates the modal copy ("X recordings → Y ZIPs").
      const plan = await bulkDownloadPlan.mutateAsync({
        mode: 'filter',
        filter: currentFilter,
      });

      if (plan.totalCount === 0) {
        toast.info('No recordings to download');
        return;
      }

      if (plan.batchCount > 1) {
        const confirmed = await confirm({
          title: 'Download Recordings',
          message: `${plan.totalCount} recordings will be packaged into ${plan.batchCount} ZIP files of up to ${plan.batchSize} each. Your browser will start the downloads sequentially. Continue?`,
          confirmText: `Download ${plan.batchCount} ZIPs`,
        });
        if (!confirmed) return;
      }

      // Loop the batches. The 1.5s breather is ONLY between batches —
      // first batch fires immediately, no artificial wait.
      let succeeded = 0;
      let failed = 0;

      for (let batch = 0; batch < plan.batchCount; batch++) {
        setDownloadProgressLabel(`Part ${batch + 1} of ${plan.batchCount}`);
        try {
          const downloadUrl = await recordingsService.getBulkDownloadUrl({
            mode: 'filter',
            filter: currentFilter,
            batch,
          });
          await triggerDirectDownload(downloadUrl);
          succeeded++;
        } catch (err) {
          console.error(`Bulk download batch ${batch + 1} failed:`, err);
          failed++;
        }
        if (batch < plan.batchCount - 1) {
          // Browsers pop-block multiple downloads fired back-to-back;
          // 1.5s spacing lets each one settle into the downloads bar
          // before the next iframe spawns.
          await new Promise((resolve) => setTimeout(resolve, 1500));
        }
      }

      if (failed === 0) {
        toast.success(
          plan.batchCount === 1
            ? `Download started`
            : `Started ${succeeded} ZIP downloads (${plan.totalCount} recordings)`
        );
      } else {
        toast.error(`Started ${succeeded} downloads, ${failed} failed to start.`);
      }
    } catch (err) {
      console.error('Bulk download failed:', err);
      toast.error('Failed to download recordings');
    } finally {
      setIsDownloading(false);
      setDownloadProgressLabel(null);
    }
  }, [
    isSelectAllMatchingFilter,
    selectedIds,
    currentFilter,
    bulkDownloadPlan,
    confirm,
    triggerDirectDownload,
  ]);

  const handleBulkDelete = useCallback(async () => {
    const totalCount = isSelectAllMatchingFilter ? (recordingsData?.total ?? 0) : selectedIds.size;

    if (totalCount === 0) return;

    const confirmed = await confirm({
      title: 'Delete Selected Recordings',
      message: `Are you sure you want to delete ${totalCount} recording${totalCount > 1 ? 's' : ''}? This action cannot be undone.`,
      confirmText: totalCount > 1 ? `Delete ${totalCount}` : 'Delete',
      variant: 'danger',
    });
    if (!confirmed) return;

    const input = isSelectAllMatchingFilter
      ? ({ mode: 'filter', filter: currentFilter } as const)
      : ({ mode: 'ids', ids: Array.from(selectedIds) } as const);

    // Optimistic flow: clear selection NOW, fire mutation without
    // awaiting. The mutation's onMutate hook (in useBulkDeleteRecordings)
    // synchronously removes the rows from the cached list, so the user
    // sees the recordings gone instantly. Server processes in the
    // background; success/error toasts come through the callbacks.
    // On error, the mutation hook restores the cache snapshot it saved
    // before the optimistic update.
    handleClearSelection();
    toast.info(`Deleting ${totalCount} recording${totalCount > 1 ? 's' : ''}...`, {
      duration: 3000,
    });

    bulkDelete.mutate(input, {
      onSuccess: (result) => {
        if (result.truncated) {
          // filter mode hit the 5000-record safety cap. The list refetch
          // queued by `onSettled` in the hook will surface the remaining
          // matches; this toast tells the user what to do next.
          toast.error(
            `Deleted ${result.successCount}. More recordings still match — narrow your filter or run delete again.`,
            { duration: 8000 }
          );
        } else if (result.failCount === 0) {
          toast.success(
            `${result.successCount} recording${result.successCount !== 1 ? 's' : ''} deleted`
          );
        } else {
          toast.error(`Deleted ${result.successCount}, failed ${result.failCount}`, {
            duration: 8000,
          });
        }
      },
      onError: (err) => {
        console.error('Bulk delete failed:', err);
        toast.error('Failed to delete recordings — list restored', { duration: 6000 });
      },
    });
  }, [
    isSelectAllMatchingFilter,
    selectedIds,
    currentFilter,
    recordingsData?.total,
    bulkDelete,
    confirm,
    handleClearSelection,
  ]);

  // ============================================================
  // Render Logic
  // ============================================================

  const showLoading = isLoading && recordings.length === 0;
  const showContent = !showLoading && recordings.length > 0;
  const showEmpty =
    !showLoading &&
    !error &&
    recordings.length === 0 &&
    recordingsData?.extensionConfigured !== false;

  return (
    <PageTransition className="absolute inset-0 overflow-hidden">
      <div className="flex flex-col h-full min-h-0 bg-[var(--card)]">
        {/* Unified header region: title + metrics + search/filters */}
        <div className="border-b border-[var(--border)] shrink-0">
          {/* title + actions */}
          <div className="flex items-center justify-between gap-3 px-5 pt-3.5 pb-2.5">
            <div className="flex items-center gap-3 min-w-0">
              <span className="grid place-items-center w-11 h-11 rounded-xl bg-[var(--primary-50)] dark:bg-[var(--primary-900)]/30 text-[var(--foreground)] shrink-0">
                <FiDisc className="w-6 h-6" />
              </span>
              <div className="min-w-0">
                <h1 className="text-2xl font-black text-[var(--foreground)] truncate">Recordings</h1>
                <p className="text-sm text-[var(--muted-foreground)] mt-0.5">
                  {recordingsData?.total !== undefined
                    ? `${recordingsData.total.toLocaleString()} total recording${recordingsData.total === 1 ? '' : 's'}`
                    : 'Call recordings'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {canDelete && (
                <Button
                  variant={selectionMode ? 'primary' : 'secondary'}
                  size="sm"
                  onClick={toggleSelectionMode}
                  aria-pressed={selectionMode}
                >
                  {selectionMode ? 'Done' : 'Select'}
                </Button>
              )}
              <Button
                variant="secondary"
                size="icon"
                onClick={() => refetch()}
                disabled={isFetching}
                aria-label="Refresh recordings"
              >
                <FiRefreshCw
                  className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`}
                  aria-hidden="true"
                />
              </Button>
            </div>
          </div>

          {/* compact metrics */}
          <div className="flex items-center gap-5 md:gap-7 px-5 pb-2.5 overflow-x-auto">
            <StatItem
              icon={<FiDisc className="w-4 h-4 text-[var(--foreground)]" />}
              value={stats?.total !== undefined ? stats.total.toLocaleString() : '\u2014'}
              label="Total"
            />
            <span className="w-px h-4 bg-[var(--border)] shrink-0" />
            <StatItem
              icon={<FiPhoneIncoming className="w-4 h-4 text-green-600" />}
              value={stats?.inbound !== undefined ? stats.inbound.toLocaleString() : '\u2014'}
              label="Inbound"
            />
            <StatItem
              icon={<FiPhoneOutgoing className="w-4 h-4 text-blue-600" />}
              value={stats?.outbound !== undefined ? stats.outbound.toLocaleString() : '\u2014'}
              label="Outbound"
            />
            <StatItem
              icon={<FiDatabase className="w-4 h-4 text-purple-600" />}
              value={
                quota?.remainingGB !== undefined ? formatGB(Math.max(0, quota.remainingGB)) : '\u2014'
              }
              label="Storage left"
            />
          </div>

          {/* search + filter toggle */}
          <div className="border-t border-[var(--border)]">
            <div className="flex items-center gap-2 px-5 py-2.5">
              <div className="flex-1 flex items-center gap-2 px-3 h-10 rounded-lg border border-[var(--border)] bg-[var(--input)] focus-within:border-[var(--primary-500)] transition-colors text-[var(--muted-foreground)]">
                <FiSearch className="w-4 h-4 shrink-0" />
                <input
                  type="text"
                  placeholder="Search recordings\u2026"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  aria-label="Search recordings by caller"
                  className="nx-search-input w-full bg-transparent outline-none text-[13.5px] text-[var(--foreground)]"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => setSearchQuery('')}
                    title="Clear search"
                    aria-label="Clear search"
                    className="grid place-items-center w-5 h-5 rounded-full shrink-0 text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
                  >
                    <FiX className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={() => setShowFilters(!showFilters)}
                aria-expanded={showFilters}
                aria-label="Toggle filters"
                className={`flex items-center gap-1.5 h-10 px-3 rounded-lg border text-[13px] font-bold shrink-0 transition-colors ${
                  showFilters || hasActiveFilters
                    ? 'border-[var(--primary-500)] text-[var(--foreground)] bg-[var(--primary-50)] dark:bg-[var(--primary-900)]/20'
                    : 'border-[var(--border)] text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)]'
                }`}
              >
                <FiFilter className="w-4 h-4" />
                <span className="hidden sm:inline">Filters</span>
                {hasActiveFilters && (
                  <span className="grid place-items-center min-w-[18px] h-[18px] px-1 rounded-full bg-[var(--primary-600)] text-white text-[11px] font-black leading-none">
                    {[startDate, endDate, direction].filter(Boolean).length}
                  </span>
                )}
                <FiChevronDown
                  className={`w-4 h-4 transition-transform duration-200 ${showFilters ? 'rotate-180' : ''}`}
                />
              </button>
            </div>

            {/* collapsible filters */}
            <div
              aria-hidden={!showFilters}
              className={`grid transition-all duration-200 ease-out ${
                showFilters
                  ? 'grid-rows-[1fr] opacity-100'
                  : 'grid-rows-[0fr] opacity-0 pointer-events-none'
              }`}
            >
              <div className="overflow-hidden">
                <div className="flex flex-wrap items-end gap-4 px-5 pb-3 pt-3 border-t border-[var(--border)]">
                  <div>
                    <label className="text-xs font-bold text-[var(--muted-foreground)] mb-1.5 block">
                      From
                    </label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="px-3 h-10 rounded-lg border border-[var(--border)] bg-[var(--input)] text-sm text-[var(--foreground)]"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-[var(--muted-foreground)] mb-1.5 block">
                      To
                    </label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="px-3 h-10 rounded-lg border border-[var(--border)] bg-[var(--input)] text-sm text-[var(--foreground)]"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-[var(--muted-foreground)] mb-1.5 block">
                      Direction
                    </label>
                    <StyledSelect
                      value={direction}
                      onChange={(v) => setDirection(v as DirectionFilter)}
                    >
                      <option value="">All Directions</option>
                      <option value="inbound">Inbound</option>
                      <option value="outbound">Outbound</option>
                    </StyledSelect>
                  </div>
                  {hasActiveFilters && (
                    <Button variant="ghost" size="sm" className="h-10" onClick={clearFilters}>
                      <FiX className="w-4 h-4 mr-1" />
                      Clear
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-auto min-h-0">
          {/* Extension not configured */}
          {recordingsData?.extensionConfigured === false && (
            <div className="mx-5 mt-3 flex items-start gap-3 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-4">
              <FiAlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
              <div>
                <h3 className="font-semibold text-amber-800 dark:text-amber-200">
                  Phone Extension Not Configured
                </h3>
                <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                  Your account doesn&apos;t have a phone extension assigned yet. Contact your
                  administrator to set up your extension for recordings access.
                </p>
              </div>
            </div>
          )}

          {/* Quota — slim strip */}
          {quota && quota.extensionConfigured && (
            <div className="px-5 py-2.5 border-b border-[var(--border)]">
              <QuotaProgress
                usedGB={quota.usedGB}
                limitGB={quota.limitGB}
                percentUsed={quota.percentUsed}
                status={quota.status}
                canRecord={quota.canRecord}
                hasOrganization={quota.hasOrganization}
              />
            </div>
          )}

          {/* WhatsApp Recordings — quiet inline link */}
          {(waCallData?.count ?? 0) > 0 && (
            <button
              onClick={() => router.push('/phone/whatsapp-calls')}
              className="group flex max-w-full items-center gap-2 px-5 py-2 text-[12.5px] text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)]"
            >
              <FaWhatsapp className="w-4 h-4 shrink-0 text-green-500" />
              <span className="truncate">
                <span className="font-bold text-[var(--foreground)]">
                  {waCallData!.count} WhatsApp recording{waCallData!.count !== 1 ? 's' : ''}
                </span>{' '}
                · {Math.round((waCallData!.totalDuration / 60) * 10) / 10} min · counted in your quota
              </span>
              <FiArrowRight className="w-3.5 h-3.5 shrink-0 opacity-60 transition-transform group-hover:translate-x-0.5" />
            </button>
          )}

          {/* Error */}
          {error && recordings.length === 0 && (
            <div className="text-center py-4 text-[var(--danger)]" role="alert">
              {error.message}
            </div>
          )}

          {/* Loading */}
          {showLoading && (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-[var(--border)] border-t-transparent" />
            </div>
          )}

          {/* Empty */}
          {showEmpty && (
            <div className="p-8 text-center text-[var(--muted-foreground)]">
              {searchQuery || hasActiveFilters
                ? 'No recordings match your filters'
                : 'No recordings yet'}
            </div>
          )}

          {/* Bulk actions bar — only while in selection mode */}
          {canDelete && selectionMode && showContent && (
            <div className="px-5 pt-3">
              <UserBulkActionsBar
                recordings={recordings}
                selectedIds={selectedIds}
                totalMatchingFilter={recordingsData?.total ?? 0}
                isSelectAllMatchingFilter={isSelectAllMatchingFilter}
                hasActiveScope={hasActiveFilters || !!debouncedSearch}
                isDownloading={isDownloading}
                isDeleting={deleteRecording.isPending || bulkDelete.isPending}
                downloadProgressLabel={downloadProgressLabel}
                onToggleSelectAll={toggleSelectAll}
                onSelectAllMatchingFilter={handleSelectAllMatchingFilter}
                onClearSelection={handleClearSelection}
                onBulkDownload={handleBulkDownload}
                onBulkDelete={handleBulkDelete}
              />
            </div>
          )}

          {/* Recording list + pagination */}
          {showContent && (
            <>
              <div className="mt-1">
                <UserRecordingsList
                  groupedRecordings={groupedRecordings}
                  canDelete={canDelete}
                  selectionMode={selectionMode}
                  selectedIds={selectedIds}
                  deletingId={deleteRecording.isPending ? 'pending' : null}
                  deletingVariables={deleteRecording.variables}
                  onDelete={handleDelete}
                  onToggleSelection={toggleSelection}
                />
              </div>

              {/* Pagination — inside the scroll (identical placement to History) */}
              <div className="px-5 py-3 border-t border-[var(--border)]">
                <Pagination
                  page={pagination.page}
                  totalPages={pagination.totalPages}
                  totalItems={pagination.totalItems}
                  pageSize={pagination.pageSize}
                  hasNextPage={pagination.hasNextPage}
                  hasPreviousPage={pagination.hasPreviousPage}
                  pageRange={pagination.pageRange}
                  onPageChange={pagination.goToPage}
                  disabled={isFetching}
                  showTotalItems={true}
                />
              </div>
            </>
          )}
        </div>
      </div>
    </PageTransition>
  );
}
