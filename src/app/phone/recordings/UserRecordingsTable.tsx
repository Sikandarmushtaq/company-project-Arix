'use client';

/**
 * UserRecordingsTable Component
 *
 * Grouped recordings list with date headers, bulk selection,
 * and individual RecordingCard rendering.
 *
 * @module app/phone/recordings/UserRecordingsTable
 */

import React, { memo } from 'react';
import {
  FiAlertCircle,
  FiAlertTriangle,
  FiCheckSquare,
  FiSquare,
  FiDownload,
  FiTrash2,
  FiLoader,
} from 'react-icons/fi';
import { Button } from '@/components/ui';
import type { Recording } from '@/lib/api';
import { RecordingCard } from './UserRecordingPlayer';

const formatGB = (gb: number): string => {
  if (gb < 1) return `${Math.round(gb * 1000)}MB`;
  return `${gb.toFixed(1)}GB`;
};

// ============================================================
// Quota Progress Bar
// ============================================================

interface QuotaProgressProps {
  usedGB: number;
  limitGB: number;
  percentUsed: number;
  status: 'ok' | 'warning' | 'exceeded' | 'no_organization';
  canRecord: boolean;
  hasOrganization?: boolean;
}

export const QuotaProgress = memo(function QuotaProgress({
  usedGB,
  limitGB,
  percentUsed,
  status,
  hasOrganization = true,
}: QuotaProgressProps) {
  // Users not in an organization can't record — compact inline notice.
  if (status === 'no_organization' || !hasOrganization) {
    return (
      <div className="flex items-start gap-2">
        <FiAlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--muted-foreground)]" />
        <p className="text-[12.5px] text-[var(--muted-foreground)]">
          <span className="font-semibold text-[var(--foreground)]">Recording not available</span> —
          you are not assigned to an organization. Contact your administrator to enable call
          recording.
        </p>
      </div>
    );
  }

  const barColor =
    status === 'exceeded' ? 'bg-red-500' : status === 'warning' ? 'bg-amber-500' : 'bg-green-500';
  const pctColor =
    status === 'exceeded'
      ? 'text-red-600 dark:text-red-400'
      : status === 'warning'
        ? 'text-amber-600 dark:text-amber-400'
        : 'text-[var(--muted-foreground)]';

  return (
    <div>
      {/* Slim one-line usage bar */}
      <div className="flex items-center gap-2.5 text-[12px]">
        <span className="shrink-0 text-[var(--muted-foreground)]">Storage</span>
        <span className="shrink-0 font-bold tabular-nums text-[var(--foreground)]">
          {formatGB(usedGB)} / {formatGB(limitGB)}
        </span>
        <div className="h-1.5 min-w-[48px] flex-1 overflow-hidden rounded-full bg-[var(--muted)]">
          <div
            className={`h-full transition-all ${barColor}`}
            style={{ width: `${Math.min(percentUsed, 100)}%` }}
          />
        </div>
        <span className={`shrink-0 font-bold tabular-nums ${pctColor}`}>
          {percentUsed.toFixed(0)}%
        </span>
      </div>

      {status === 'exceeded' && (
        <p className="mt-1.5 flex items-center gap-1.5 text-[11.5px] font-medium text-red-600 dark:text-red-400">
          <FiAlertCircle className="h-3.5 w-3.5 shrink-0" />
          Storage full — download &amp; delete recordings to free space; new calls won&apos;t be
          recorded until space is available.
        </p>
      )}

      {status === 'warning' && (
        <p className="mt-1.5 flex items-center gap-1.5 text-[11.5px] font-medium text-amber-600 dark:text-amber-400">
          <FiAlertTriangle className="h-3.5 w-3.5 shrink-0" />
          Running low ({percentUsed.toFixed(0)}%) — consider downloading old recordings.
        </p>
      )}
    </div>
  );
});

// ============================================================
// Bulk Actions Bar
// ============================================================

interface BulkActionsBarProps {
  recordings: Recording[];
  selectedIds: Set<string>;
  /** Total recordings matching the current filter (across all pages). */
  totalMatchingFilter: number;
  /**
   * `true` when the user has clicked the "Select all N matching filter"
   * banner — actions then operate on the entire filtered set, not just
   * `selectedIds`.
   */
  isSelectAllMatchingFilter: boolean;
  /** True iff the user has any active filter (date range, direction, search). */
  hasActiveScope: boolean;
  isDownloading: boolean;
  isDeleting: boolean;
  /**
   * Optional progress text shown on the action button during a chunked
   * download — e.g. "Part 2 of 5".
   */
  downloadProgressLabel?: string | null;
  onToggleSelectAll: () => void;
  onSelectAllMatchingFilter: () => void;
  onClearSelection: () => void;
  onBulkDownload: () => void;
  onBulkDelete: () => void;
}

export function UserBulkActionsBar({
  recordings,
  selectedIds,
  totalMatchingFilter,
  isSelectAllMatchingFilter,
  hasActiveScope,
  isDownloading,
  isDeleting,
  downloadProgressLabel,
  onToggleSelectAll,
  onSelectAllMatchingFilter,
  onClearSelection,
  onBulkDownload,
  onBulkDelete,
}: BulkActionsBarProps) {
  const allOnPageSelected = recordings.length > 0 && recordings.every((r) => selectedIds.has(r.id));

  // Show the contextual "select all matching filter" banner when:
  //  (a) every visible row is selected, AND
  //  (b) there are more matching rows than the current page shows.
  // Pattern: Gmail / Linear / Slack — once a user opts into all-on-page,
  // surface the option to extend selection across pagination.
  const showSelectAllBanner =
    !isSelectAllMatchingFilter && allOnPageSelected && totalMatchingFilter > recordings.length;

  // Effective selection count for action labels — virtual when "all matching"
  // is active, real Set size otherwise.
  const effectiveCount = isSelectAllMatchingFilter ? totalMatchingFilter : selectedIds.size;

  return (
    <div className="space-y-2 mb-4">
      <div className="flex items-center justify-between p-3 bg-[var(--muted)] rounded-lg">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleSelectAll}
            className="flex items-center gap-2"
            disabled={isSelectAllMatchingFilter}
          >
            {allOnPageSelected || isSelectAllMatchingFilter ? (
              <FiCheckSquare className="w-4 h-4" />
            ) : (
              <FiSquare className="w-4 h-4" />
            )}
            {effectiveCount > 0 ? `${effectiveCount} selected` : 'Select all'}
          </Button>
          {isSelectAllMatchingFilter && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClearSelection}
              className="text-[var(--muted-foreground)]"
            >
              Clear
            </Button>
          )}
        </div>
        {effectiveCount > 0 && (
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onBulkDownload} disabled={isDownloading}>
              {isDownloading ? (
                <FiLoader className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <FiDownload className="w-4 h-4 mr-2" />
              )}
              {isDownloading
                ? // Two states share this label:
                  //   - "Part N of M" (filter-mode multi-batch progress)
                  //   - "Preparing..." or null (single-batch fetch in flight)
                  // The button stays disabled across both — re-enables only
                  // after the actual download is visible to the user.
                  downloadProgressLabel?.startsWith('Part')
                  ? `Downloading... ${downloadProgressLabel}`
                  : 'Downloading...'
                : isSelectAllMatchingFilter
                  ? `Download all ${totalMatchingFilter}`
                  : 'Download ZIP'}
            </Button>
            <Button variant="danger" size="sm" onClick={onBulkDelete} disabled={isDeleting}>
              <FiTrash2 className="w-4 h-4 mr-2" />
              {isSelectAllMatchingFilter ? `Delete all ${totalMatchingFilter}` : 'Delete Selected'}
            </Button>
          </div>
        )}
      </div>

      {/* Contextual "select all matching filter" banner — Gmail/Linear pattern */}
      {showSelectAllBanner && (
        <div
          className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg border border-[var(--primary-200)] bg-[var(--primary-50)] dark:bg-[var(--primary-900)]/20 dark:border-[var(--primary-800)] text-sm"
          role="region"
          aria-label="Selection scope"
        >
          <span>
            All {recordings.length} on this page are selected.{' '}
            <button
              type="button"
              onClick={onSelectAllMatchingFilter}
              className="font-semibold text-[var(--foreground)] dark:text-[var(--primary-300)] hover:underline"
            >
              {hasActiveScope
                ? `Select all ${totalMatchingFilter} recordings matching your filter`
                : `Select all ${totalMatchingFilter} recordings`}
            </button>
          </span>
        </div>
      )}

      {/* "All N selected" confirmation banner */}
      {isSelectAllMatchingFilter && (
        <div
          className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg border border-[var(--primary-200)] bg-[var(--primary-50)] dark:bg-[var(--primary-900)]/20 dark:border-[var(--primary-800)] text-sm"
          role="status"
        >
          <span>
            <strong>{totalMatchingFilter}</strong>{' '}
            {hasActiveScope ? 'recordings matching your filter are' : 'recordings are'} selected.
          </span>
          <button
            type="button"
            onClick={onClearSelection}
            className="font-semibold text-[var(--foreground)] dark:text-[var(--primary-300)] hover:underline"
          >
            Clear selection
          </button>
        </div>
      )}
    </div>
  );
}

// ============================================================
// Grouped Recordings List
// ============================================================

interface GroupedRecording {
  label: string;
  items: Recording[];
}

interface UserRecordingsListProps {
  groupedRecordings: GroupedRecording[];
  canDelete: boolean;
  selectionMode: boolean;
  selectedIds: Set<string>;
  deletingId: string | null;
  deletingVariables: string | undefined;
  onDelete: (recording: Recording) => void;
  onToggleSelection: (id: string) => void;
}

export function UserRecordingsList({
  groupedRecordings,
  canDelete,
  selectionMode,
  selectedIds,
  deletingId,
  deletingVariables,
  onDelete,
  onToggleSelection,
}: UserRecordingsListProps) {
  return (
    <div>
      {groupedRecordings.map((group) => (
        <div key={group.label}>
          <div className="sticky top-0 z-10 border-b border-[var(--border)]/60 bg-[var(--card)]/95 px-4 py-1.5 backdrop-blur-sm">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--muted-foreground)]">
              {group.label}
            </span>
          </div>
          {group.items.map((recording) => (
            <RecordingCard
              key={recording.id}
              recording={recording}
              selectionMode={selectionMode}
              isSelected={selectedIds.has(recording.id)}
              canDelete={canDelete}
              isDeleting={deletingId !== null && deletingVariables === recording.id}
              onToggleSelect={() => onToggleSelection(recording.id)}
              onDelete={onDelete}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
