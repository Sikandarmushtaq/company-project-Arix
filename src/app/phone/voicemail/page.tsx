'use client';

/**
 * Voicemail Page
 *
 * Display and manage voicemail messages with play, download, and delete functionality.
 * Features professional pagination with server-side data fetching.
 *
 * @module app/phone/voicemail/page
 */

import React, { useState, useCallback, useEffect, memo, useMemo } from 'react';
import {
  FiTrash2,
  FiCheck,
  FiClock,
  FiVoicemail,
  FiRefreshCw,
  FiSearch,
  FiLoader,
  FiAlertCircle,
  FiCheckCircle,
  FiFilter,
  FiX,
  FiMail,
  FiInbox,
  FiChevronDown,
} from 'react-icons/fi';
import { Button, Pagination, StyledSelect } from '@/components/ui';
import { AudioPlayer } from '@/components/phone/AudioPlayer';
import { useAudioStore } from '@/lib/stores/audioPlayer';
import { GenericAvatar } from '@/components/phone/chrome/avatarUtils';
import {
  useVoicemailsPaginated,
  useVoicemailCounts,
  useDeleteVoicemail,
  useDeleteVoicemails,
  useMarkVoicemailAsRead,
  useMarkAllVoicemailsAsRead,
  usePagination,
  useContactDisplayName,
  useConfirm,
} from '@/lib/hooks';
import { voicemailService, type Voicemail } from '@/lib/api';
import { formatConversationTime } from '@/lib/utils/datetime';
import { getVoicemailFilename } from '@/lib/utils/download';
import { PageTransition } from '@/components/phone';
import { toast } from '@/lib/stores/toast';

// ============================================================
// Utility Functions
// ============================================================

const formatShortDuration = (seconds: number): string => {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (secs === 0) return `${mins}m`;
  return `${mins}m ${secs}s`;
};

/**
 * Get date group label for a timestamp
 */
const getDateGroup = (timestamp: number): string => {
  const date = new Date(timestamp);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const msgDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  if (msgDate.getTime() === today.getTime()) return 'Today';
  if (msgDate.getTime() === yesterday.getTime()) return 'Yesterday';

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

type FolderFilter = '' | 'INBOX' | 'Old';

/** Compact inline metric — small glyph + bold value + muted label. */
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

// ============================================================
// Main Component
// ============================================================

export default function VoicemailPage() {
  // Pagination state
  const pagination = usePagination({ initialPageSize: 20 });

  // Search state with debounce
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Filter state
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [folder, setFolder] = useState<FolderFilter>('');
  const [showFilters, setShowFilters] = useState(false);

  // Selection state
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

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
  }, [startDate, endDate, folder]);

  // Fetch voicemails with pagination
  const {
    data: voicemailData,
    isLoading,
    error,
    refetch,
    isFetching,
  } = useVoicemailsPaginated({
    page: pagination.page,
    limit: pagination.pageSize,
    search: debouncedSearch || undefined,
    folder: folder || undefined,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
  });

  // Fetch counts for stats
  const { data: counts } = useVoicemailCounts();

  // Update total items when data changes
  useEffect(() => {
    if (voicemailData?.total !== undefined) {
      pagination.setTotalItems(voicemailData.total);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- pagination.setTotalItems is stable from usePagination hook
  }, [voicemailData?.total]);

  // Mutations
  const deleteVoicemail = useDeleteVoicemail();
  const deleteVoicemails = useDeleteVoicemails();
  const markAsRead = useMarkVoicemailAsRead();
  const markAllAsRead = useMarkAllVoicemailsAsRead();
  const { confirm } = useConfirm();

  // Mark a voicemail read when the user plays it (parity with the old player).
  const handlePlayed = useCallback(
    (voicemail: Voicemail) => {
      if (!voicemail.read) {
        markAsRead.mutate({ extension: voicemail.extension, msgId: voicemail.id });
      }
    },
    [markAsRead]
  );

  // Voicemails from response
  const voicemails = voicemailData?.voicemails || [];

  // Compute stats
  const totalCount = counts?.total ?? undefined;
  const unreadCount = counts?.unread ?? undefined;
  const readCount =
    totalCount !== undefined && unreadCount !== undefined ? totalCount - unreadCount : undefined;
  const avgDuration = useMemo(() => {
    if (voicemails.length === 0) return 0;
    const totalDur = voicemails.reduce((acc, v) => acc + (v.duration || 0), 0);
    return Math.round(totalDur / voicemails.length);
  }, [voicemails]);

  const hasActiveFilters = !!(startDate || endDate || folder);

  const clearFilters = useCallback(() => {
    setStartDate('');
    setEndDate('');
    setFolder('');
  }, []);

  // Group voicemails by date
  const groupedVoicemails = useMemo(() => {
    const groups: { label: string; items: Voicemail[] }[] = [];
    let currentGroup: string | null = null;

    for (const vm of voicemails) {
      const group = getDateGroup(vm.origTime);
      if (group !== currentGroup) {
        groups.push({ label: group, items: [vm] });
        currentGroup = group;
      } else {
        groups[groups.length - 1].items.push(vm);
      }
    }

    return groups;
  }, [voicemails]);

  // ============================================================
  // Selection Handlers
  // ============================================================

  const toggleSelection = useCallback((vmKey: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(vmKey)) {
        next.delete(vmKey);
      } else {
        next.add(vmKey);
      }
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    if (selectedIds.size === voicemails.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(voicemails.map((v) => v.id)));
    }
  }, [voicemails, selectedIds.size]);

  const cancelSelection = useCallback(() => {
    setSelectionMode(false);
    setSelectedIds(new Set());
  }, []);

  const handleBatchDelete = useCallback(async () => {
    if (selectedIds.size === 0) return;

    const confirmed = await confirm({
      title: 'Delete Voicemails',
      message: `Are you sure you want to delete ${selectedIds.size} voicemail${selectedIds.size > 1 ? 's' : ''}?`,
      confirmText: 'Delete',
      variant: 'danger',
    });
    if (!confirmed) return;

    // Stop the shared player if the clip playing belongs to a selected voicemail.
    const player = useAudioStore.getState();
    if (player.activeId?.startsWith('vm-') && selectedIds.has(player.activeId.slice(3))) {
      player.stop();
    }

    const ids = voicemails
      .filter((v) => selectedIds.has(v.id))
      .map((v) => ({ extension: v.extension, msgId: v.id }));

    try {
      await deleteVoicemails.mutateAsync(ids);
      toast.success(`${ids.length} voicemail${ids.length > 1 ? 's' : ''} deleted`);
      cancelSelection();
    } catch {
      toast.error('Failed to delete voicemails. Please try again.');
    }
  }, [selectedIds, voicemails, deleteVoicemails, confirm, cancelSelection]);

  const handleDelete = useCallback(
    async (voicemail: Voicemail) => {
      const confirmed = await confirm({
        title: 'Delete Voicemail',
        message: 'Are you sure you want to delete this voicemail?',
        confirmText: 'Delete',
        variant: 'danger',
      });
      if (!confirmed) return;

      try {
        // Stop the shared player if this voicemail is the one playing.
        const player = useAudioStore.getState();
        if (player.activeId === `vm-${voicemail.id}`) player.stop();

        await deleteVoicemail.mutateAsync({ extension: voicemail.extension, msgId: voicemail.id });
        toast.success('Voicemail deleted');
      } catch {
        toast.error('Failed to delete voicemail. Please try again.');
      }
    },
    [deleteVoicemail, confirm]
  );

  // ============================================================
  // UI Handlers
  // ============================================================

  const handleRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  }, []);

  const handlePageChange = useCallback(
    (page: number) => {
      pagination.goToPage(page);
    },
    [pagination]
  );

  // ============================================================
  // Render Logic
  // ============================================================

  const showLoading = isLoading && voicemails.length === 0;
  const showContent = !showLoading && voicemails.length > 0;
  const showEmpty =
    !showLoading &&
    !error &&
    voicemails.length === 0 &&
    voicemailData?.extensionConfigured !== false;

  return (
    <PageTransition className="absolute inset-0 overflow-hidden">
      <div className="flex flex-col h-full min-h-0 bg-[var(--card)]">
        {/* Unified header region: title + metrics + search/filters */}
        <div className="border-b border-[var(--border)] shrink-0">
          {/* title + actions */}
          <div className="flex items-center justify-between gap-3 px-5 pt-3.5 pb-2.5">
            <div className="flex items-center gap-3 min-w-0">
              <span className="grid place-items-center w-11 h-11 rounded-xl bg-[var(--primary-50)] dark:bg-[var(--primary-900)]/30 text-[var(--foreground)] shrink-0">
                <FiVoicemail className="w-6 h-6" />
              </span>
              <div className="min-w-0">
                <h1 className="text-2xl font-black text-[var(--foreground)] truncate">Voicemail</h1>
                <p className="text-sm text-[var(--muted-foreground)] mt-0.5">
                  {counts && counts.unread > 0
                    ? `${counts.unread} new message${counts.unread > 1 ? 's' : ''}`
                    : 'No new messages'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {selectionMode ? (
                <>
                  <Button variant="secondary" size="sm" onClick={cancelSelection}>
                    Cancel
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={handleBatchDelete}
                    disabled={selectedIds.size === 0 || deleteVoicemails.isPending}
                  >
                    {deleteVoicemails.isPending ? (
                      <FiLoader className="w-4 h-4 mr-1 animate-spin" aria-hidden="true" />
                    ) : (
                      <FiTrash2 className="w-4 h-4 mr-1" aria-hidden="true" />
                    )}
                    Delete Selected ({selectedIds.size})
                  </Button>
                </>
              ) : (
                <>
                  {counts && counts.unread > 0 && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => markAllAsRead.mutate()}
                      disabled={markAllAsRead.isPending}
                    >
                      {markAllAsRead.isPending ? (
                        <FiLoader className="w-4 h-4 mr-1 animate-spin" aria-hidden="true" />
                      ) : (
                        <FiCheckCircle className="w-4 h-4 mr-1" aria-hidden="true" />
                      )}
                      Mark all read
                    </Button>
                  )}
                  <Button variant="secondary" size="sm" onClick={() => setSelectionMode(true)}>
                    Select
                  </Button>
                  <Button
                    variant="secondary"
                    size="icon"
                    onClick={handleRefresh}
                    disabled={isFetching}
                    aria-label="Refresh voicemails"
                  >
                    <FiRefreshCw
                      className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`}
                      aria-hidden="true"
                    />
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* compact metrics */}
          <div className="flex items-center gap-5 md:gap-7 px-5 pb-2.5 overflow-x-auto">
            <StatItem
              icon={<FiVoicemail className="w-4 h-4 text-[var(--foreground)]" />}
              value={totalCount !== undefined ? totalCount.toLocaleString() : '\u2014'}
              label="Total"
            />
            <span className="w-px h-4 bg-[var(--border)] shrink-0" />
            <StatItem
              icon={<FiMail className="w-4 h-4 text-orange-500" />}
              value={unreadCount !== undefined ? unreadCount.toLocaleString() : '\u2014'}
              label="Unread"
            />
            <StatItem
              icon={<FiInbox className="w-4 h-4 text-green-600" />}
              value={readCount !== undefined ? readCount.toLocaleString() : '\u2014'}
              label="Read"
            />
            <StatItem
              icon={<FiClock className="w-4 h-4 text-blue-600" />}
              value={voicemails.length > 0 ? formatShortDuration(avgDuration) : '\u2014'}
              label="Avg"
            />
          </div>

          {/* search + filter toggle */}
          <div className="border-t border-[var(--border)]">
            <div className="flex items-center gap-2 px-5 py-2.5">
              <div className="flex-1 flex items-center gap-2 px-3 h-10 rounded-lg border border-[var(--border)] bg-[var(--input)] focus-within:border-[var(--primary-500)] transition-colors text-[var(--muted-foreground)]">
                <FiSearch className="w-4 h-4 shrink-0" />
                <input
                  type="text"
                  placeholder="Search voicemails\u2026"
                  value={searchQuery}
                  onChange={handleSearchChange}
                  aria-label="Search voicemails by caller"
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
                    {[startDate, endDate, folder].filter(Boolean).length}
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
                      className="h-10 px-3 rounded-lg border border-[var(--border)] bg-[var(--input)] text-sm text-[var(--foreground)]"
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
                      className="h-10 px-3 rounded-lg border border-[var(--border)] bg-[var(--input)] text-sm text-[var(--foreground)]"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-[var(--muted-foreground)] mb-1.5 block">
                      Folder
                    </label>
                    <StyledSelect value={folder} onChange={(v) => setFolder(v as FolderFilter)}>
                      <option value="">All Folders</option>
                      <option value="INBOX">Inbox</option>
                      <option value="Old">Old</option>
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

        {/* Extension Not Configured Banner (flush) */}
        {voicemailData?.extensionConfigured === false && (
          <div className="mx-5 mt-3 p-4 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 shrink-0">
            <div className="flex items-start gap-3">
              <FiAlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
              <div>
                <h3 className="font-bold text-amber-800 dark:text-amber-200">
                  Phone Extension Not Configured
                </h3>
                <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                  Your account doesn&apos;t have a phone extension assigned yet. Contact your
                  administrator to set up your extension for voicemail access.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Scrollable list */}
        <div className="flex-1 overflow-auto min-h-0">
          {/* Error State */}
          {error && voicemails.length === 0 && (
            <div className="text-center py-6 text-[var(--danger)]" role="alert">
              {error.message}
            </div>
          )}

          {/* Loading State */}
          {showLoading && (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-[var(--border)] border-t-transparent" />
            </div>
          )}

          {/* Empty State */}
          {showEmpty && (
            <div className="text-center py-16 text-sm text-[var(--muted-foreground)]">
              {searchQuery || hasActiveFilters
                ? 'No voicemails match your filters'
                : 'No voicemail messages'}
            </div>
          )}

          {/* Voicemail List */}
          {showContent && (
            <>
              {/* Select-all bar (selection mode only) */}
              {selectionMode && voicemails.length > 0 && (
                <div className="flex items-center justify-end px-5 py-2.5 border-b border-[var(--border)]">
                  <label className="flex items-center gap-2 text-sm text-[var(--muted-foreground)] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedIds.size === voicemails.length}
                      onChange={toggleSelectAll}
                      className="rounded border-[var(--border)]"
                    />
                    Select All
                  </label>
                </div>
              )}

              <div>
                {groupedVoicemails.map((group) => (
                  <div key={group.label}>
                    <div className="sticky top-0 bg-[var(--card)]/95 backdrop-blur-sm px-4 py-1.5 z-10 border-b border-[var(--border)]/60">
                      <span className="text-[11px] font-bold text-[var(--muted-foreground)] uppercase tracking-wider">
                        {group.label}
                      </span>
                    </div>
                    {group.items.map((voicemail) => (
                      <VoicemailCard
                        key={voicemail.id}
                        voicemail={voicemail}
                        selectionMode={selectionMode}
                        isSelected={selectedIds.has(voicemail.id)}
                        onToggleSelect={() => toggleSelection(voicemail.id)}
                        onPlay={handlePlayed}
                        onDelete={handleDelete}
                      />
                    ))}
                  </div>
                ))}
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
                  onPageChange={handlePageChange}
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

// ============================================================
// Sub-components (memoized for performance)
// ============================================================

interface VoicemailCardProps {
  voicemail: Voicemail;
  selectionMode: boolean;
  isSelected: boolean;
  onToggleSelect: () => void;
  onPlay: (voicemail: Voicemail) => void;
  onDelete: (voicemail: Voicemail) => void;
}

const VoicemailCard = memo(function VoicemailCard({
  voicemail,
  selectionMode,
  isSelected,
  onToggleSelect,
  onPlay,
  onDelete,
}: VoicemailCardProps) {
  const isNew = !voicemail.read;

  // SSOT: Use contact lookup store for name resolution
  const apiName = voicemail.callerIdName !== 'Unknown' ? voicemail.callerIdName : undefined;
  const callerDisplay = useContactDisplayName(voicemail.callerIdNum, apiName);
  const handleDelete = useCallback(() => onDelete(voicemail), [onDelete, voicemail]);

  // Lazy audio: fetch the blob only when the user first hits play, then hand the
  // object URL to the shared SSOT <AudioPlayer> — the same player the phone-page
  // VoicemailPanel uses. This keeps the list from fetching every clip up-front.
  const playerId = `vm-${voicemail.id}`;
  const [activated, setActivated] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioLoading, setAudioLoading] = useState(false);
  const [audioError, setAudioError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!activated) return;
    let cancelled = false;
    let objUrl: string | null = null;
    setAudioLoading(true);
    setAudioError(false);
    voicemailService
      .getAudioBlob(voicemail.extension, voicemail.id)
      .then((u) => {
        if (cancelled) {
          URL.revokeObjectURL(u);
          return;
        }
        objUrl = u;
        setAudioUrl(u);
        setAudioLoading(false);
        useAudioStore.getState().toggle(playerId, u); // auto-play once the blob is ready
      })
      .catch(() => {
        if (cancelled) return;
        setAudioError(true);
        setAudioLoading(false);
      });
    return () => {
      cancelled = true;
      const player = useAudioStore.getState();
      if (player.activeId === playerId) player.stop();
      if (objUrl) URL.revokeObjectURL(objUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- playerId derives from voicemail.id
  }, [activated, reloadKey, voicemail.extension, voicemail.id]);

  const handlePlayClick = useCallback(() => {
    setActivated(true);
    onPlay(voicemail); // mark-as-read on first play (parity with the old player)
  }, [onPlay, voicemail]);

  const retry = useCallback(() => {
    setAudioError(false);
    setReloadKey((k) => k + 1);
  }, []);

  return (
    <div
      role={selectionMode ? 'button' : undefined}
      tabIndex={selectionMode ? 0 : undefined}
      onClick={selectionMode ? onToggleSelect : undefined}
      onKeyDown={
        selectionMode
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onToggleSelect();
              }
            }
          : undefined
      }
      className={`group border-b border-[var(--border)]/60 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--primary-500)] ${
        selectionMode ? 'cursor-pointer' : ''
      } ${
        isSelected
          ? 'bg-[var(--primary-50)] dark:bg-[var(--primary-900)]/20'
          : isNew
            ? 'bg-[var(--primary-50)]/40 dark:bg-[var(--primary-900)]/10 hover:bg-[var(--primary-50)] dark:hover:bg-[var(--primary-900)]/25'
            : 'hover:bg-[var(--muted)]/50'
      }`}
    >
      {/* Compact list row */}
      <div className="flex items-center gap-3 px-4 py-2.5">
        {selectionMode ? (
          <span
            className={`grid h-5 w-5 shrink-0 place-items-center rounded border-2 transition-colors ${
              isSelected
                ? 'border-[var(--border)] bg-[var(--primary-600)]'
                : 'border-[var(--border)]'
            }`}
          >
            {isSelected && <FiCheck className="h-3 w-3 text-white" aria-hidden="true" />}
          </span>
        ) : (
          <span className="grid w-1.5 shrink-0 place-items-center">
            {isNew && (
              <span
                role="img"
                aria-label="Unread"
                className="h-1.5 w-1.5 rounded-full bg-[var(--primary-600)]"
              />
            )}
          </span>
        )}
        <GenericAvatar name={callerDisplay} number={voicemail.callerIdNum} size={40} />
        <div className="w-36 shrink-0 sm:w-52">
          <h4 className="truncate text-[14.5px] font-bold text-[var(--foreground)]">
            {callerDisplay}
          </h4>
          <div className="mt-0.5 flex items-center gap-1.5 text-[12.5px] text-[var(--muted-foreground)]">
            <FiVoicemail className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span className="tabular-nums">{formatShortDuration(voicemail.duration)}</span>
          </div>
        </div>

        {/* Player zone — the AudioPlayer bar is always shown (seek + duration
            visible at rest); its play button lazily fetches the blob on first
            click via onPlayRequest. Fixed name column ⇒ play buttons align. */}
        <div className="flex min-w-0 flex-1 items-center">
          {selectionMode ? null : audioError ? (
            <button
              type="button"
              onClick={retry}
              className="flex h-10 items-center gap-2 rounded-full px-3 text-[13px] font-bold text-[var(--danger)] transition-colors hover:bg-[var(--danger)]/10"
            >
              <FiRefreshCw className="h-4 w-4" aria-hidden="true" /> Retry
            </button>
          ) : (
            <AudioPlayer
              className="w-full"
              id={playerId}
              url={audioUrl || ''}
              loading={audioLoading}
              durationSeconds={voicemail.duration}
              filename={getVoicemailFilename(voicemail)}
              onPlayRequest={handlePlayClick}
              hideRate={!activated}
              hideDownload={!activated}
            />
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <span className="whitespace-nowrap text-[12px] tabular-nums text-[var(--muted-foreground)]">
            {formatConversationTime(voicemail.origTime)}
          </span>
          {!selectionMode && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleDelete();
              }}
              aria-label={`Delete voicemail from ${callerDisplay}`}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-[var(--muted-foreground)] opacity-0 transition-all hover:bg-[var(--danger)]/10 hover:text-[var(--danger)] focus-visible:opacity-100 group-hover:opacity-100"
            >
              <FiTrash2 className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      {/* Transcription */}
      {voicemail.transcription && (
        <div className="pb-2.5 pl-[68px] pr-4">
          <p className="line-clamp-2 text-[12.5px] italic text-[var(--muted-foreground)]">
            {voicemail.transcription}
          </p>
        </div>
      )}
    </div>
  );
});
