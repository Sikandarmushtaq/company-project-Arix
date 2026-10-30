'use client';

import React, { useMemo } from 'react';
import {
  FiSearch,
  FiTrash2,
  FiLoader,
  FiAlertCircle,
  FiCheckCircle,
  FiFilter,
  FiX,
  FiRefreshCw,
  FiVoicemail,
  FiMail,
  FiInbox,
  FiClock,
} from 'react-icons/fi';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Button,
  Input,
  Pagination,
  StatsCard,
  StyledSelect,
} from '@/components/ui';
import type { Voicemail } from '@/lib/api';
import { formatLocalDate } from '@/lib/utils/datetime';
import { VoicemailPlayer, type VoicemailPlayerProps } from './VoicemailPlayer';

// ============================================================================
// Utility
// ============================================================================

const formatShortDuration = (seconds: number): string => {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (secs === 0) return `${mins}m`;
  return `${mins}m ${secs}s`;
};

const getDateGroup = (timestamp: number): string => {
  const date = new Date(timestamp);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const msgDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  if (msgDate.getTime() === today.getTime()) return 'Today';
  if (msgDate.getTime() === yesterday.getTime()) return 'Yesterday';

  return formatLocalDate(date);
};

type FolderFilter = '' | 'INBOX' | 'Old';

// ============================================================================
// Types
// ============================================================================

export interface VoicemailListProps {
  // Data
  voicemails: Voicemail[];
  isLoading: boolean;
  isFetching: boolean;
  error: Error | null;

  // Counts
  counts: { total: number; unread: number } | undefined;
  totalFromApi: number | undefined;
  extensionConfigured: boolean | undefined;

  // Search
  searchQuery: string;
  onSearchChange: (e: React.ChangeEvent<HTMLInputElement>) => void;

  // Filters
  startDate: string;
  endDate: string;
  folder: FolderFilter;
  showFilters: boolean;
  hasActiveFilters: boolean;
  onStartDateChange: (value: string) => void;
  onEndDateChange: (value: string) => void;
  onFolderChange: (value: FolderFilter) => void;
  onToggleFilters: () => void;
  onClearFilters: () => void;

  // Selection
  selectionMode: boolean;
  selectedIds: Set<string>;
  onSetSelectionMode: (value: boolean) => void;
  onCancelSelection: () => void;
  onBatchDelete: () => void;
  onToggleSelectAll: () => void;
  deleteVoicemailsPending: boolean;

  // Actions
  onRefresh: () => void;
  onMarkAllAsRead: () => void;
  markAllAsReadPending: boolean;

  // Pagination
  pagination: {
    page: number;
    totalPages: number;
    pageSize: number;
    totalItems: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
    pageRange: number[];
    goToPage: (page: number) => void;
    setPageSize: (size: number) => void;
  };
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;

  // Player props for each voicemail
  getPlayerProps: (voicemail: Voicemail) => Omit<VoicemailPlayerProps, 'voicemail'>;
}

// ============================================================================
// Component
// ============================================================================

export function VoicemailList({
  voicemails,
  isLoading,
  isFetching,
  error,
  counts,
  totalFromApi,
  extensionConfigured,
  searchQuery,
  onSearchChange,
  startDate,
  endDate,
  folder,
  showFilters,
  hasActiveFilters,
  onStartDateChange,
  onEndDateChange,
  onFolderChange,
  onToggleFilters,
  onClearFilters,
  selectionMode,
  selectedIds,
  onSetSelectionMode,
  onCancelSelection,
  onBatchDelete,
  onToggleSelectAll,
  deleteVoicemailsPending,
  onRefresh,
  onMarkAllAsRead,
  markAllAsReadPending,
  pagination,
  onPageChange,
  onPageSizeChange,
  getPlayerProps,
}: VoicemailListProps) {
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

  const showLoading = isLoading && voicemails.length === 0;
  const showContent = !showLoading && voicemails.length > 0;
  const showEmpty =
    !showLoading && !error && voicemails.length === 0 && extensionConfigured !== false;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">Voicemail</h1>
          <p className="text-[var(--muted-foreground)] mt-1">
            {counts && counts.unread > 0
              ? `${counts.unread} new message${counts.unread > 1 ? 's' : ''}`
              : 'No new messages'}
            {totalFromApi !== undefined && (
              <span className="ml-2">({totalFromApi.toLocaleString()} total)</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {selectionMode ? (
            <>
              <Button variant="secondary" size="sm" onClick={onCancelSelection}>
                Cancel
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={onBatchDelete}
                disabled={selectedIds.size === 0 || deleteVoicemailsPending}
              >
                {deleteVoicemailsPending ? (
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
                  onClick={onMarkAllAsRead}
                  disabled={markAllAsReadPending}
                >
                  {markAllAsReadPending ? (
                    <FiLoader className="w-4 h-4 mr-1 animate-spin" aria-hidden="true" />
                  ) : (
                    <FiCheckCircle className="w-4 h-4 mr-1" aria-hidden="true" />
                  )}
                  Mark all read
                </Button>
              )}
              <Button variant="secondary" size="sm" onClick={() => onSetSelectionMode(true)}>
                Select
              </Button>
              <Button
                variant="secondary"
                size="icon"
                onClick={onRefresh}
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

      {/* Extension Not Configured Banner */}
      {extensionConfigured === false && (
        <Card className="border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20">
          <CardContent className="p-6">
            <div className="flex items-start gap-3">
              <FiAlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
              <div>
                <h3 className="font-semibold text-amber-800 dark:text-amber-200">
                  Phone Extension Not Configured
                </h3>
                <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                  Your account doesn&apos;t have a phone extension assigned yet. Contact your
                  administrator to set up your extension for voicemail access.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatsCard
          icon={FiVoicemail}
          iconBgClass="bg-blue-100 dark:bg-blue-900"
          iconColorClass="text-blue-600 dark:text-blue-400"
          value={totalCount !== undefined ? totalCount.toLocaleString() : '\u2014'}
          label="Total Messages"
        />
        <StatsCard
          icon={FiMail}
          iconBgClass="bg-orange-100 dark:bg-orange-900"
          iconColorClass="text-orange-600 dark:text-orange-400"
          value={unreadCount !== undefined ? unreadCount.toLocaleString() : '\u2014'}
          label="Unread"
        />
        <StatsCard
          icon={FiInbox}
          iconBgClass="bg-green-100 dark:bg-green-900"
          iconColorClass="text-green-600 dark:text-green-400"
          value={readCount !== undefined ? readCount.toLocaleString() : '\u2014'}
          label="Read"
        />
        <StatsCard
          icon={FiClock}
          iconBgClass="bg-purple-100 dark:bg-purple-900"
          iconColorClass="text-purple-600 dark:text-purple-400"
          value={voicemails.length > 0 ? formatShortDuration(avgDuration) : '\u2014'}
          label="Avg Duration"
        />
      </div>

      {/* Search + Filter Toggle */}
      <div className="flex items-center gap-2">
        <div className="w-full max-w-md">
          <Input
            placeholder="Search voicemails..."
            value={searchQuery}
            onChange={onSearchChange}
            leftIcon={<FiSearch className="w-4 h-4" aria-hidden="true" />}
            aria-label="Search voicemails by caller"
          />
        </div>
        <Button
          variant={showFilters ? 'primary' : 'outline'}
          size="sm"
          onClick={onToggleFilters}
          aria-label="Toggle filters"
        >
          <FiFilter className="w-4 h-4" />
          {hasActiveFilters && (
            <span className="ml-1 px-1.5 py-0.5 text-xs rounded-full bg-[var(--coral)] text-white">
              {[startDate, endDate, folder].filter(Boolean).length}
            </span>
          )}
        </Button>
      </div>

      {/* Filters (togglable) */}
      {showFilters && (
        <div className="flex flex-wrap gap-4 p-4 rounded-lg border border-[var(--border)] bg-[var(--card)]">
          <div>
            <label className="text-xs font-medium text-[var(--muted-foreground)] mb-1 block">
              From
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => onStartDateChange(e.target.value)}
              className="px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-sm text-[var(--foreground)]"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-[var(--muted-foreground)] mb-1 block">
              To
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => onEndDateChange(e.target.value)}
              className="px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-sm text-[var(--foreground)]"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-[var(--muted-foreground)] mb-1 block">
              Folder
            </label>
            <StyledSelect
              value={folder}
              onChange={(v) => onFolderChange(v as FolderFilter)}
              className="w-auto bg-[var(--background)]"
            >
              <option value="">All Folders</option>
              <option value="INBOX">Inbox</option>
              <option value="Old">Old</option>
            </StyledSelect>
          </div>
          {hasActiveFilters && (
            <div className="flex items-end">
              <Button variant="ghost" size="sm" onClick={onClearFilters}>
                <FiX className="w-4 h-4 mr-1" />
                Clear Filters
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Error State */}
      {error && voicemails.length === 0 && (
        <div className="text-center py-4 text-[var(--danger)]" role="alert">
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
        <Card>
          <CardContent className="p-8 text-center text-[var(--muted-foreground)]">
            {searchQuery || hasActiveFilters
              ? 'No voicemails match your filters'
              : 'No voicemail messages'}
          </CardContent>
        </Card>
      )}

      {/* Voicemail List */}
      {showContent && (
        <>
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Messages</CardTitle>
                {selectionMode && voicemails.length > 0 && (
                  <label className="flex items-center gap-2 text-sm text-[var(--muted-foreground)] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedIds.size === voicemails.length}
                      onChange={onToggleSelectAll}
                      className="rounded border-[var(--border)]"
                    />
                    Select All
                  </label>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {groupedVoicemails.map((group) => (
                  <div key={group.label}>
                    <div className="sticky top-0 bg-[var(--card)] py-2 z-10">
                      <span className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">
                        {group.label}
                      </span>
                    </div>
                    <div className="space-y-3">
                      {group.items.map((voicemail) => {
                        const playerProps = getPlayerProps(voicemail);
                        return (
                          <VoicemailPlayer
                            key={voicemail.id}
                            voicemail={voicemail}
                            {...playerProps}
                          />
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Pagination */}
          <div className="mt-6 pt-4 border-t border-[var(--border)]">
            <Pagination
              page={pagination.page}
              totalPages={pagination.totalPages}
              totalItems={pagination.totalItems}
              pageSize={pagination.pageSize}
              hasNextPage={pagination.hasNextPage}
              hasPreviousPage={pagination.hasPreviousPage}
              pageRange={pagination.pageRange}
              onPageChange={onPageChange}
              onPageSizeChange={onPageSizeChange}
              disabled={isFetching}
              showPageSizeSelector={true}
              showTotalItems={true}
            />
          </div>
        </>
      )}
    </div>
  );
}
