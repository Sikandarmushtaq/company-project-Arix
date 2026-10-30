'use client';

/**
 * WhatsApp Call Recordings Table
 *
 * Table + BulkActionsBar for the manager-only WA call recordings view.
 * Pure presentational — all state (selection, audio refs, progress) lives
 * in `WaCallRecordingsView`. Mirrors the structure of
 * `app/admin/recordings/RecordingsTable.tsx` so the SIP and WA managers
 * feel consistent.
 *
 * @module app/admin/whatsapp/calls/WaCallRecordingsTable
 */

import React from 'react';
import {
  FiCheckSquare,
  FiSquare,
  FiDownload,
  FiLoader,
  FiPhoneIncoming,
  FiPhoneOutgoing,
  FiTrash2,
} from 'react-icons/fi';
import { Button } from '@/components/ui';
import { AudioPlayer } from '@/components/recordings/AudioPlayer';
import { formatLocalDateTime } from '@/lib/utils/datetime';
import type { AdminWaCall } from '@/lib/api/services/waCall.service';

// ============================================================
// Helpers
// ============================================================

const formatDuration = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const formatCustomerNumber = (phone: string): string => {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return phone;
};

// ============================================================
// Bulk Actions Bar
// ============================================================

interface BulkActionsBarProps {
  /** IDs that are eligible for bulk ops (rows that actually HAVE recordings). */
  eligibleIds: string[];
  selectedIds: Set<string>;
  /** Total rows matching the current filter across all pages. */
  totalMatchingFilter: number;
  /**
   * Virtual selection mode — user clicked "select all N matching filter".
   * `selectedIds` is intentionally empty in this mode; the count comes
   * from `totalMatchingFilter` instead.
   */
  isSelectAllMatchingFilter: boolean;
  /** True iff the user has any active filter (date range, direction, search). */
  hasActiveScope: boolean;
  isDownloading: boolean;
  isBulkDeleting: boolean;
  onToggleSelectAll: () => void;
  /** Promote page-scoped selection to "select everything matching". */
  onSelectAllMatchingFilter: () => void;
  /** Clear both real and virtual selections. */
  onClearSelection: () => void;
  onBulkDownload: () => void;
  onBulkDelete: () => void;
}

/**
 * Bulk actions bar — mirrors `UserBulkActionsBar` from the SIP recordings
 * page so managers see the same UX across both surfaces. Three layers:
 *   1. Bar with select-all toggle + clear + action buttons
 *   2. Contextual "Select all N matching filter" banner (Gmail pattern)
 *   3. Confirmation banner after promotion ("All N selected. Clear")
 */
export function BulkActionsBar({
  eligibleIds,
  selectedIds,
  totalMatchingFilter,
  isSelectAllMatchingFilter,
  hasActiveScope,
  isDownloading,
  isBulkDeleting,
  onToggleSelectAll,
  onSelectAllMatchingFilter,
  onClearSelection,
  onBulkDownload,
  onBulkDelete,
}: BulkActionsBarProps) {
  // Nothing to render when there's no row on the page that can be selected
  // AND no virtual selection in flight. Matches SIP behavior.
  if (eligibleIds.length === 0 && !isSelectAllMatchingFilter) return null;

  const allOnPageSelected =
    eligibleIds.length > 0 && eligibleIds.every((id) => selectedIds.has(id));

  // Promote-to-matching banner: only meaningful when the whole visible
  // page is selected AND the filter matches more rows beyond it.
  const showSelectAllBanner =
    !isSelectAllMatchingFilter && allOnPageSelected && totalMatchingFilter > eligibleIds.length;

  // Effective count for action labels — virtual when "all matching" is
  // active, real Set size otherwise.
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
                ? 'Downloading...'
                : isSelectAllMatchingFilter
                  ? `Download all ${totalMatchingFilter}`
                  : 'Download ZIP'}
            </Button>
            <Button variant="danger" size="sm" onClick={onBulkDelete} disabled={isBulkDeleting}>
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
            All {eligibleIds.length} on this page are selected.{' '}
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
// Main Table
// ============================================================

export interface WaCallRecordingsTableProps {
  calls: AdminWaCall[];
  selectedIds: Set<string>;
  /**
   * Virtual selection mode — when true, every eligible row should render
   * checked regardless of `selectedIds` contents (which is empty in this
   * mode). Lets the user see at a glance that bulk ops will hit every
   * matching call, not just what's on screen.
   */
  isSelectAllMatchingFilter: boolean;
  /** True when every eligible row on this page is already selected. */
  allSelected: boolean;
  /** True when there's at least one row on the page that has a recording. */
  hasEligibleRows: boolean;
  /** Audio playback state (driven by parent) */
  playingId: string | null;
  pausedId: string | null;
  audioLoading: string | null;
  audioProgress: Record<string, number>;
  currentTime: Record<string, number>;
  audioDurations: Record<string, number>;
  playbackSpeed: number;
  /** Per-row download spinner state */
  downloadingId: string | null;
  /** Per-row delete spinner state */
  deletingId: string | null;
  onToggleSelection: (callId: string) => void;
  /** Header-row checkbox click → flip all eligible rows on this page. */
  onToggleSelectAll: () => void;
  onTogglePlay: (call: AdminWaCall) => void;
  onSeek: (callId: string, e: React.MouseEvent<HTMLDivElement>) => void;
  onSpeedChange: () => void;
  onDownload: (call: AdminWaCall) => void;
  onDelete: (call: AdminWaCall) => void;
}

export function WaCallRecordingsTable({
  calls,
  selectedIds,
  isSelectAllMatchingFilter,
  allSelected,
  hasEligibleRows,
  playingId,
  pausedId,
  audioLoading,
  audioProgress,
  currentTime,
  audioDurations,
  playbackSpeed,
  downloadingId,
  deletingId,
  onToggleSelection,
  onToggleSelectAll,
  onTogglePlay,
  onSeek,
  onSpeedChange,
  onDownload,
  onDelete,
}: WaCallRecordingsTableProps) {
  return (
    <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
      <table className="w-full text-sm">
        <thead className="bg-[var(--muted)] text-[var(--muted-foreground)]">
          <tr>
            {/* Header checkbox doubles as a "select all eligible rows on
                this page" toggle — matches the SIP recordings UX and is the
                de-facto data-table convention. Disabled when no row on the
                page has a recording (selection would be a no-op). */}
            <th className="px-3 py-2 w-10">
              <button
                type="button"
                onClick={onToggleSelectAll}
                disabled={!hasEligibleRows}
                className={`p-1 ${
                  hasEligibleRows
                    ? 'text-[var(--foreground)] hover:text-[var(--primary)]'
                    : 'text-[var(--muted-foreground)]/30 cursor-not-allowed'
                }`}
                title={
                  hasEligibleRows
                    ? allSelected
                      ? 'Deselect all'
                      : 'Select all'
                    : 'No recordings on this page'
                }
                aria-label={allSelected ? 'Deselect all rows' : 'Select all rows'}
              >
                {allSelected ? (
                  <FiCheckSquare className="w-4 h-4" />
                ) : (
                  <FiSquare className="w-4 h-4" />
                )}
              </button>
            </th>
            <th className="text-left px-3 py-2 font-medium">Date</th>
            <th className="text-left px-3 py-2 font-medium">Agent</th>
            <th className="text-left px-3 py-2 font-medium">Customer</th>
            <th className="text-left px-3 py-2 font-medium">Direction</th>
            <th className="text-left px-3 py-2 font-medium">Player</th>
            <th className="text-left px-3 py-2 font-medium">Duration</th>
            <th className="text-right px-3 py-2 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {calls.map((call) => {
            const isOutbound = call.direction === 'outbound';
            const hasRecording = !!call.recordingUrl;
            // In virtual select-all-matching mode every eligible row is
            // conceptually selected even though selectedIds is empty —
            // reflect that in the row UI so the manager sees what the bulk
            // action will actually hit.
            const isSelected =
              selectedIds.has(call.callId) || (isSelectAllMatchingFilter && hasRecording);
            const isDownloadingThis = downloadingId === call.callId;
            const isDeletingThis = deletingId === call.callId;
            const isPlayingThis = playingId === call.callId;
            const isPausedThis = pausedId === call.callId;
            const isAudioLoadingThis = audioLoading === call.callId;

            return (
              <tr
                key={call.callId}
                className={`border-t border-[var(--border)] hover:bg-[var(--muted)]/50 ${
                  isSelected ? 'bg-[var(--primary)]/5' : ''
                }`}
              >
                {/* Selection — disabled for calls without recordings since
                    bulk ops only operate on recorded calls. */}
                <td className="px-3 py-3">
                  <button
                    type="button"
                    onClick={() => onToggleSelection(call.callId)}
                    disabled={!hasRecording}
                    className={`p-1 ${
                      hasRecording
                        ? 'text-[var(--foreground)] hover:text-[var(--primary)]'
                        : 'text-[var(--muted-foreground)]/30 cursor-not-allowed'
                    }`}
                    title={hasRecording ? 'Select' : 'No recording — cannot select'}
                    aria-label={isSelected ? 'Deselect row' : 'Select row'}
                  >
                    {isSelected ? (
                      <FiCheckSquare className="w-4 h-4" />
                    ) : (
                      <FiSquare className="w-4 h-4" />
                    )}
                  </button>
                </td>

                <td className="px-3 py-3 whitespace-nowrap text-[var(--foreground)]">
                  {call.startedAt ? formatLocalDateTime(call.startedAt) : '—'}
                </td>

                <td className="px-3 py-3">
                  {call.agent ? (
                    <div className="flex flex-col leading-tight">
                      <span className="font-medium text-[var(--foreground)]">
                        {call.agent.name || call.agent.email || `User #${call.agent.id}`}
                      </span>
                      <span className="text-xs text-[var(--muted-foreground)]">
                        {call.agent.extension
                          ? `ext ${call.agent.extension}`
                          : (call.agent.email ?? call.agent.phone ?? '')}
                      </span>
                    </div>
                  ) : (
                    <span className="text-[var(--muted-foreground)] italic">Unassigned</span>
                  )}
                </td>

                <td className="px-3 py-3">
                  <div className="flex flex-col leading-tight">
                    <span className="font-medium text-[var(--foreground)]">
                      {formatCustomerNumber(call.customerNumber)}
                    </span>
                    {call.customerName && (
                      <span className="text-xs text-[var(--muted-foreground)]">
                        {call.customerName}
                      </span>
                    )}
                  </div>
                </td>

                <td className="px-3 py-3 whitespace-nowrap">
                  <span className="inline-flex items-center gap-1.5 text-xs">
                    {isOutbound ? (
                      <FiPhoneOutgoing className="w-3.5 h-3.5 text-blue-500" />
                    ) : (
                      <FiPhoneIncoming className="w-3.5 h-3.5 text-green-500" />
                    )}
                    {isOutbound ? 'Outbound' : 'Inbound'}
                  </span>
                </td>

                {/* Inline audio player — only meaningful when there's a
                    recording. Empty cell otherwise so the table grid
                    stays aligned. */}
                <td className="px-3 py-3">
                  {hasRecording ? (
                    <AudioPlayer
                      isPlaying={isPlayingThis}
                      isPaused={isPausedThis}
                      isLoading={isAudioLoadingThis}
                      progress={audioProgress[call.callId] || 0}
                      currentTime={currentTime[call.callId] || 0}
                      duration={audioDurations[call.callId] || call.durationSecs || 0}
                      playbackSpeed={playbackSpeed}
                      onTogglePlay={() => onTogglePlay(call)}
                      onSeek={(e) => onSeek(call.callId, e)}
                      onSpeedChange={onSpeedChange}
                    />
                  ) : (
                    <span className="text-xs text-[var(--muted-foreground)]">No recording</span>
                  )}
                </td>

                <td className="px-3 py-3 whitespace-nowrap text-[var(--foreground)]">
                  {formatDuration(call.durationSecs)}
                </td>

                <td className="px-3 py-3 text-right whitespace-nowrap">
                  {hasRecording ? (
                    <div className="inline-flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onDownload(call)}
                        disabled={isDownloadingThis}
                        title="Download"
                        aria-label="Download recording"
                      >
                        {isDownloadingThis ? (
                          <FiLoader className="w-4 h-4 animate-spin" />
                        ) : (
                          <FiDownload className="w-4 h-4" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onDelete(call)}
                        disabled={isDeletingThis}
                        title="Delete recording"
                        aria-label="Delete recording"
                        className="text-[var(--danger)] hover:text-[var(--danger)]"
                      >
                        {isDeletingThis ? (
                          <FiLoader className="w-4 h-4 animate-spin" />
                        ) : (
                          <FiTrash2 className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                  ) : (
                    <span className="text-xs text-[var(--muted-foreground)]">—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
