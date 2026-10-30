'use client';

/**
 * Recording Export Panel (Phase 4).
 *
 * Presentational card for the async server-side export: shows live build
 * progress, then a single resumable "Download" button when ready. Replaces the
 * fragile 262-part in-browser panel. State is owned by `useRecordingExport`.
 *
 * @module app/admin/recordings/RecordingExportPanel
 */

import React from 'react';
import { FiDownload, FiLoader, FiX, FiAlertCircle, FiCheckCircle } from 'react-icons/fi';
import { Button } from '@/components/ui';
import type { RecordingExportJob } from '@/lib/api';
import type { ExportProgress } from './useRecordingExport';

interface RecordingExportPanelProps {
  job: RecordingExportJob;
  progress: ExportProgress | null;
  onDownload: () => void;
  onCancel: () => void;
  onDismiss: () => void;
}

function formatBytes(bytes: number | null): string {
  if (!bytes || bytes <= 0) return '';
  const mb = bytes / (1024 * 1024);
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  return `${(mb / 1024).toFixed(2)} GB`;
}

export function RecordingExportPanel({
  job,
  progress,
  onDownload,
  onCancel,
  onDismiss,
}: RecordingExportPanelProps) {
  const pct = progress ? Math.min(100, Math.max(0, progress.pct)) : 0;
  const isActive = job.status === 'pending' || job.status === 'building';
  const size = formatBytes(job.artifactBytes);

  return (
    <div className="mx-4 mb-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          {/* ---- Preparing ---- */}
          {isActive && (
            <>
              <div className="flex items-center gap-2 text-sm font-medium text-[var(--foreground)]">
                <FiLoader className="w-4 h-4 animate-spin text-[var(--primary)]" />
                Preparing your export…
                <span className="tabular-nums text-[var(--muted-foreground)]">
                  {pct}%
                  {progress && progress.total > 0 ? ` (${progress.processed}/${progress.total})` : ''}
                </span>
              </div>
              <div
                className="mt-2 h-2 w-full overflow-hidden rounded-full bg-[var(--muted)]"
                role="progressbar"
                aria-valuenow={pct}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Export progress"
              >
                <div
                  className="h-full rounded-full bg-[var(--primary)] transition-all duration-300"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-[var(--muted-foreground)]">
                You can leave this page — we&apos;ll keep building it, and it&apos;ll be here when
                you come back.
              </p>
            </>
          )}

          {/* ---- Ready ---- */}
          {job.status === 'ready' && (
            <>
              <div className="flex items-center gap-2 text-sm font-medium text-[var(--foreground)]">
                <FiCheckCircle className="w-4 h-4 text-[var(--success,#16a34a)]" />
                Export ready — {job.manifestCount} recording{job.manifestCount === 1 ? '' : 's'}
                {job.partCount > 1 ? ` · ${job.partCount} parts` : ''}
                {size ? ` · ${size}` : ''}
              </div>
              {job.partCount > 1 && (
                <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                  Delivered as {job.partCount} ZIP files that download separately — each resumes on
                  its own if the connection drops.
                </p>
              )}
            </>
          )}

          {/* ---- Failed ---- */}
          {job.status === 'failed' && (
            <div className="flex items-center gap-2 text-sm font-medium text-[var(--danger)]">
              <FiAlertCircle className="w-4 h-4" />
              Export failed — please start it again.
            </div>
          )}

          {/* ---- Cancelled / expired ---- */}
          {(job.status === 'cancelled' || job.status === 'expired') && (
            <div className="text-sm text-[var(--muted-foreground)]">
              {job.status === 'cancelled' ? 'Export cancelled.' : 'This export link has expired.'}
            </div>
          )}
        </div>

        {/* ---- Actions ---- */}
        <div className="flex shrink-0 items-center gap-2">
          {job.status === 'ready' && (
            <Button size="sm" onClick={onDownload}>
              <FiDownload className="w-4 h-4 mr-1.5" />
              {job.partCount > 1 ? `Download ${job.partCount} parts` : 'Download'}
            </Button>
          )}
          {isActive && (
            <Button size="sm" variant="secondary" onClick={onCancel}>
              Cancel
            </Button>
          )}
          {!isActive && (
            <button
              type="button"
              onClick={onDismiss}
              aria-label="Dismiss"
              className="p-1 text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            >
              <FiX className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
