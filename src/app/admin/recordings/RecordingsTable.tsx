'use client';

/**
 * RecordingsTable Component
 *
 * Table rendering for the Manager Recordings view with sortable columns,
 * selection, audio player, and actions.
 *
 * @module app/admin/recordings/RecordingsTable
 */

import React from 'react';
import {
  FiTrash2,
  FiDownload,
  FiLoader,
  FiPhoneIncoming,
  FiPhoneOutgoing,
  FiChevronUp,
  FiChevronDown,
  FiCheck,
  FiCheckSquare,
  FiSquare,
  FiFile,
  FiRefreshCw,
  FiAlertCircle,
  FiX,
} from 'react-icons/fi';
import { Card, CardContent, Button } from '@/components/ui';
import { formatLocalDateTime } from '@/lib/utils/datetime';
import type { Recording } from '@/lib/api';
import { AudioPlayer, type AudioPlayerProps } from './RecordingPlayer';

// ============================================================
// Types
// ============================================================

export type SortField = 'startTime' | 'duration' | 'extension' | 'direction';
export type SortDirection = 'asc' | 'desc';

export interface SortConfig {
  field: SortField;
  direction: SortDirection;
}

const formatDuration = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const formatBytes = (bytes: number | null): string => {
  if (bytes === null || bytes === undefined) return '—';
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
};

// ============================================================
// Bulk Actions Bar
// ============================================================

interface BulkActionsBarProps {
  recordingsCount: number;
  /** Total recordings matching the current filter (across all pages). */
  total: number;
  selectedIds: Set<string>;
  allSelected: boolean;
  /** True when the user chose "Select all N matching" — actions run server-side over the whole filter. */
  isSelectAllMatchingFilter: boolean;
  isDownloading: boolean;
  isBulkDeleting: boolean;
  /** e.g. "Part 2 of 5" while a chunked download is in progress. */
  downloadProgressLabel: string | null;
  /** Numeric batch progress { current, total } for the progress bar (null when idle). */
  downloadProgress: { current: number; total: number } | null;
  onToggleSelectAll: () => void;
  onSelectAllMatchingFilter: () => void;
  onClearSelection: () => void;
  onBulkDownload: () => void;
  onBulkDelete: () => void;
  /** When false, the "Delete Selected" button is hidden (no delete permission). */
  canDelete?: boolean;
}

export function BulkActionsBar({
  recordingsCount,
  total,
  selectedIds,
  allSelected,
  isSelectAllMatchingFilter,
  isDownloading,
  isBulkDeleting,
  downloadProgressLabel,
  downloadProgress,
  onToggleSelectAll,
  onSelectAllMatchingFilter,
  onClearSelection,
  onBulkDownload,
  onBulkDelete,
  canDelete = true,
}: BulkActionsBarProps) {
  if (recordingsCount === 0) return null;

  const effectiveCount = isSelectAllMatchingFilter ? total : selectedIds.size;
  const hasSelection = effectiveCount > 0;
  const busy = isDownloading || isBulkDeleting;
  // Offer "select all N matching" once the whole visible page is checked and
  // there are more matches beyond this page.
  const canSelectAllMatching =
    !isSelectAllMatchingFilter && allSelected && total > selectedIds.size;

  const label = isSelectAllMatchingFilter
    ? `All ${total} selected`
    : selectedIds.size > 0
      ? `${selectedIds.size} selected`
      : 'Select all';

  return (
    <div className="flex flex-col gap-2 p-3 bg-[var(--muted)] rounded-lg">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleSelectAll}
            className="flex items-center gap-2"
          >
            {allSelected || isSelectAllMatchingFilter ? (
              <FiCheckSquare className="w-4 h-4" />
            ) : (
              <FiSquare className="w-4 h-4" />
            )}
            {label}
          </Button>
          {canSelectAllMatching && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onSelectAllMatchingFilter}
              className="text-[var(--primary)]"
            >
              Select all {total} matching
            </Button>
          )}
          {isSelectAllMatchingFilter && (
            <Button variant="ghost" size="sm" onClick={onClearSelection}>
              Clear selection
            </Button>
          )}
        </div>
        {hasSelection && (
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onBulkDownload} disabled={busy}>
              {isDownloading ? (
                <FiLoader className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <FiDownload className="w-4 h-4 mr-2" />
              )}
              {isDownloading && downloadProgressLabel ? downloadProgressLabel : 'Download ZIP'}
            </Button>
            {canDelete && (
              <Button variant="danger" size="sm" onClick={onBulkDelete} disabled={busy}>
                {isBulkDeleting ? (
                  <FiLoader className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <FiTrash2 className="w-4 h-4 mr-2" />
                )}
                Delete Selected
              </Button>
            )}
          </div>
        )}
      </div>
      {isDownloading && downloadProgress && downloadProgress.total > 1 && (
        <div className="flex items-center gap-3">
          <div className="flex-1 h-2 bg-[var(--foreground)]/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-[var(--primary)] transition-all duration-300"
              style={{
                width: `${Math.round((downloadProgress.current / downloadProgress.total) * 100)}%`,
              }}
            />
          </div>
          <span className="text-xs text-[var(--muted-foreground)] whitespace-nowrap">
            {downloadProgressLabel ?? `${downloadProgress.current} / ${downloadProgress.total}`}
          </span>
        </div>
      )}
      {isSelectAllMatchingFilter && !isDownloading && (
        <p className="text-xs text-[var(--muted-foreground)]">
          All {total} recordings matching the current filter are selected. Downloads are delivered
          as ZIP files of up to 100 recordings each (Part 1, Part 2, …).
        </p>
      )}
    </div>
  );
}

// ============================================================
// Download Parts Panel
// ============================================================

export type DownloadPartStatus = 'pending' | 'downloading' | 'done' | 'failed';

interface DownloadPartsPanelProps {
  /** Per-part status; index = batch number (shown as Part index+1). */
  statuses: DownloadPartStatus[];
  /** Total recordings covered by the plan. */
  totalCount: number;
  /** Max recordings per ZIP part. */
  batchSize: number;
  /** True while a sequential run (all parts / retry-failed) is in progress. */
  isDownloading: boolean;
  onDownloadPart: (batch: number) => void;
  onRetryFailed: () => void;
  onClose: () => void;
}

const PART_CHIP_STYLES: Record<DownloadPartStatus, string> = {
  pending:
    'border-[var(--foreground)]/15 bg-[var(--background)] text-[var(--foreground)] hover:border-[var(--primary)]',
  downloading: 'border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)]',
  done: 'border-green-500/40 bg-green-500/10 text-green-600 hover:border-green-500',
  failed: 'border-red-500/50 bg-red-500/10 text-red-600 hover:border-red-500',
};

const PART_CHIP_ICONS: Record<DownloadPartStatus, React.ReactNode> = {
  pending: <FiDownload className="w-3 h-3" />,
  downloading: <FiLoader className="w-3 h-3 animate-spin" />,
  done: <FiCheck className="w-3 h-3" />,
  failed: <FiAlertCircle className="w-3 h-3" />,
};

/**
 * Shown during and after a chunked bulk download. Every ZIP part is a chip
 * with live status; clicking a chip (re-)downloads just that part, so a part
 * the browser dropped (multiple-download permission, transient error) can be
 * fetched again without re-running all N ZIPs.
 */
export function DownloadPartsPanel({
  statuses,
  totalCount,
  batchSize,
  isDownloading,
  onDownloadPart,
  onRetryFailed,
  onClose,
}: DownloadPartsPanelProps) {
  const doneCount = statuses.filter((s) => s === 'done').length;
  const failedCount = statuses.filter((s) => s === 'failed').length;
  const donePct = statuses.length > 0 ? Math.round((doneCount / statuses.length) * 100) : 0;
  // A long run produces many parts (e.g. 25/ZIP over thousands of recordings);
  // cap the chip grid height and let it scroll so the panel never dominates
  // the page.
  const scrollChips = statuses.length > 60;

  return (
    <div className="p-3 bg-[var(--muted)] rounded-lg space-y-2">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm font-medium text-[var(--foreground)]">
          Download parts — {statuses.length} ZIPs · {totalCount} recordings · {doneCount} downloaded
          {failedCount > 0 && <span className="text-red-600"> · {failedCount} failed</span>}
        </p>
        <div className="flex items-center gap-2">
          {failedCount > 0 && !isDownloading && (
            <Button variant="outline" size="sm" onClick={onRetryFailed}>
              <FiRefreshCw className="w-4 h-4 mr-2" />
              Retry {failedCount} failed
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            disabled={isDownloading}
            aria-label="Close download parts"
          >
            <FiX className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Overall progress across all parts */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-1.5 bg-[var(--foreground)]/10 rounded-full overflow-hidden">
          <div
            className="h-full bg-[var(--primary)] transition-all duration-300"
            style={{ width: `${donePct}%` }}
          />
        </div>
        <span className="text-xs text-[var(--muted-foreground)] whitespace-nowrap">
          {doneCount} / {statuses.length}
        </span>
      </div>

      <div
        className={`flex flex-wrap gap-1.5 ${
          scrollChips ? 'max-h-48 overflow-y-auto pr-1' : ''
        }`}
      >
        {statuses.map((status, i) => (
          <button
            key={i}
            type="button"
            onClick={() => onDownloadPart(i)}
            disabled={isDownloading || status === 'downloading'}
            title={
              status === 'done'
                ? `Part ${i + 1} downloaded — click to download again`
                : status === 'failed'
                  ? `Part ${i + 1} failed — click to retry`
                  : `Download Part ${i + 1}`
            }
            className={`inline-flex items-center gap-1 px-2 py-1 rounded border text-xs font-medium transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${PART_CHIP_STYLES[status]}`}
          >
            {PART_CHIP_ICONS[status]}
            {i + 1}
          </button>
        ))}
      </div>
      <p className="text-xs text-[var(--muted-foreground)]">
        Each part is a ZIP of up to {batchSize} recordings. If a part didn&apos;t reach your
        Downloads folder, click it to download it again. Parts stay accurate as long as the
        recordings set is unchanged — after adding or deleting recordings, start a fresh download.
      </p>
    </div>
  );
}

// ============================================================
// Sort Icon Helper
// ============================================================

function SortIcon({ field, sortConfig }: { field: SortField; sortConfig: SortConfig }) {
  if (sortConfig.field !== field) {
    return <FiChevronDown className="w-3 h-3 opacity-30" />;
  }
  return sortConfig.direction === 'asc' ? (
    <FiChevronUp className="w-3 h-3 text-[var(--primary)]" />
  ) : (
    <FiChevronDown className="w-3 h-3 text-[var(--primary)]" />
  );
}

// ============================================================
// Main Table Component
// ============================================================

interface RecordingsTableProps {
  recordings: Recording[];
  selectedIds: Set<string>;
  sortConfig: SortConfig;
  playingId: string | null;
  pausedId: string | null;
  audioLoading: string | null;
  audioProgress: Record<string, number>;
  currentTime: Record<string, number>;
  audioDurations: Record<string, number>;
  playbackSpeed: number;
  onSort: (field: SortField) => void;
  onToggleSelection: (id: string) => void;
  onTogglePlay: (recording: Recording) => void;
  onSeek: (recordingId: string, e: React.MouseEvent<HTMLDivElement>) => void;
  onSpeedChange: () => void;
  onDownload: (recording: Recording) => void;
  onDelete: (recording: Recording) => void;
  /** When false, the per-row Delete button is hidden (no delete permission). */
  canDelete?: boolean;
  /** Read-only admin viewer does not expose bulk-selection controls. */
  selectable?: boolean;
}

export function RecordingsTable({
  recordings,
  selectedIds,
  sortConfig,
  playingId,
  pausedId,
  audioLoading,
  audioProgress,
  currentTime,
  audioDurations,
  playbackSpeed,
  onSort,
  onToggleSelection,
  onTogglePlay,
  onSeek,
  onSpeedChange,
  onDownload,
  onDelete,
  canDelete = true,
  selectable = true,
}: RecordingsTableProps) {
  return (
    <Card>
      <CardContent className="p-0 overflow-x-auto">
        <table className="w-full min-w-[900px]">
          <thead className="bg-[var(--muted)]">
            <tr>
              <th className="px-3 py-3 text-left text-xs font-semibold text-[var(--muted-foreground)] uppercase w-12">
                {selectable && <FiCheckSquare className="w-4 h-4" />}
              </th>
              <th
                className="px-3 py-3 text-left text-xs font-semibold text-[var(--muted-foreground)] uppercase cursor-pointer hover:text-[var(--foreground)] transition-colors"
                onClick={() => onSort('direction')}
              >
                <div className="flex items-center gap-1">
                  Direction
                  <SortIcon field="direction" sortConfig={sortConfig} />
                </div>
              </th>
              <th
                className="px-3 py-3 text-left text-xs font-semibold text-[var(--muted-foreground)] uppercase cursor-pointer hover:text-[var(--foreground)] transition-colors"
                onClick={() => onSort('extension')}
              >
                <div className="flex items-center gap-1">
                  Extension
                  <SortIcon field="extension" sortConfig={sortConfig} />
                </div>
              </th>
              <th className="px-3 py-3 text-left text-xs font-semibold text-[var(--muted-foreground)] uppercase">
                To / From
              </th>
              <th className="px-3 py-3 text-left text-xs font-semibold text-[var(--muted-foreground)] uppercase">
                Player
              </th>
              <th
                className="px-3 py-3 text-left text-xs font-semibold text-[var(--muted-foreground)] uppercase cursor-pointer hover:text-[var(--foreground)] transition-colors"
                onClick={() => onSort('duration')}
              >
                <div className="flex items-center gap-1">
                  Duration
                  <SortIcon field="duration" sortConfig={sortConfig} />
                </div>
              </th>
              <th className="px-3 py-3 text-left text-xs font-semibold text-[var(--muted-foreground)] uppercase">
                Size
              </th>
              <th
                className="px-3 py-3 text-left text-xs font-semibold text-[var(--muted-foreground)] uppercase cursor-pointer hover:text-[var(--foreground)] transition-colors"
                onClick={() => onSort('startTime')}
              >
                <div className="flex items-center gap-1">
                  Date
                  <SortIcon field="startTime" sortConfig={sortConfig} />
                </div>
              </th>
              <th className="px-3 py-3 text-left text-xs font-semibold text-[var(--muted-foreground)] uppercase">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {recordings.map((recording) => (
              <tr
                key={recording.id}
                className={`border-b border-[var(--border)] hover:bg-[var(--muted)]/50 ${
                  playingId === recording.id ? 'bg-[var(--primary)]/5' : ''
                }`}
              >
                <td className="px-3 py-3">
                  {selectable && (
                    <button onClick={() => onToggleSelection(recording.id)}>
                      {selectedIds.has(recording.id) ? (
                        <FiCheckSquare className="w-5 h-5 text-[var(--primary)]" />
                      ) : (
                        <FiSquare className="w-5 h-5 text-[var(--muted-foreground)]" />
                      )}
                    </button>
                  )}
                </td>
                <td className="px-3 py-3">
                  {recording.direction === 'inbound' ? (
                    <div className="flex items-center gap-1.5 text-green-600 dark:text-green-400">
                      <FiPhoneIncoming className="w-4 h-4" />
                      <span className="text-sm">In</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400">
                      <FiPhoneOutgoing className="w-4 h-4" />
                      <span className="text-sm">Out</span>
                    </div>
                  )}
                </td>
                <td className="px-3 py-3 text-[var(--foreground)] text-sm">
                  <div className="flex flex-col">
                    <span className="font-medium">
                      {recording.agentName || recording.extension}
                    </span>
                    {recording.agentName && (
                      <span className="text-xs text-[var(--muted-foreground)]">
                        {recording.extension}
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-3 py-3">
                  <div className="flex flex-col">
                    <span className="text-xs text-[var(--muted-foreground)]">
                      {recording.direction === 'outbound' ? 'To' : 'From'}
                    </span>
                    <span className="text-sm text-[var(--foreground)]">{recording.otherParty}</span>
                  </div>
                </td>
                <td className="px-3 py-3">
                  <AudioPlayer
                    isPlaying={playingId === recording.id}
                    isPaused={pausedId === recording.id}
                    isLoading={audioLoading === recording.id}
                    progress={audioProgress[recording.id] || 0}
                    currentTime={currentTime[recording.id] || 0}
                    duration={audioDurations[recording.id] || recording.duration || 0}
                    playbackSpeed={playbackSpeed}
                    onTogglePlay={() => onTogglePlay(recording)}
                    onSeek={(e) => onSeek(recording.id, e)}
                    onSpeedChange={onSpeedChange}
                  />
                </td>
                <td className="px-3 py-3 text-sm text-[var(--muted-foreground)]">
                  {formatDuration(recording.duration)}
                </td>
                <td className="px-3 py-3 text-sm text-[var(--muted-foreground)]">
                  <div className="flex items-center gap-1">
                    <FiFile className="w-3 h-3" />
                    {formatBytes(recording.fileSize)}
                  </div>
                </td>
                <td className="px-3 py-3 text-sm text-[var(--muted-foreground)]">
                  {formatLocalDateTime(recording.startTime)}
                </td>
                <td className="px-3 py-3">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => onDownload(recording)}
                      className="p-1.5 rounded hover:bg-[var(--muted)] transition-colors"
                      title="Download"
                    >
                      <FiDownload className="w-4 h-4 text-[var(--primary)]" />
                    </button>
                    {canDelete && (
                      <button
                        onClick={() => onDelete(recording)}
                        className="p-1.5 rounded hover:bg-[var(--muted)] transition-colors"
                        title="Delete"
                      >
                        <FiTrash2 className="w-4 h-4 text-[var(--danger)]" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
