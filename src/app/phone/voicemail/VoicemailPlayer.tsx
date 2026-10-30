'use client';

import React, { memo, useCallback } from 'react';
import {
  FiPlay,
  FiPause,
  FiDownload,
  FiTrash2,
  FiPhone,
  FiLoader,
} from 'react-icons/fi';
import { Button } from '@/components/ui';
import { useContactDisplayName } from '@/lib/hooks';
import { formatConversationTime } from '@/lib/utils/datetime';
import type { Voicemail } from '@/lib/api';

// ============================================================================
// Utility
// ============================================================================

const formatDuration = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const formatShortDuration = (seconds: number): string => {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (secs === 0) return `${mins}m`;
  return `${mins}m ${secs}s`;
};

// ============================================================================
// Types
// ============================================================================

export interface VoicemailPlayerProps {
  voicemail: Voicemail;
  isPlaying: boolean;
  showSeekBar: boolean;
  isLoading: boolean;
  isDownloading: boolean;
  progress: number;
  currentTime: number;
  duration: number;
  playbackSpeed: number;
  selectionMode: boolean;
  isSelected: boolean;
  onToggleSelect: () => void;
  onSpeedChange: () => void;
  onTogglePlay: (voicemail: Voicemail) => void;
  onSeek: (e: React.MouseEvent<HTMLDivElement>) => void;
  onDownload: (voicemail: Voicemail) => void;
  onDelete: (voicemail: Voicemail) => void;
}

// ============================================================================
// Component
// ============================================================================

export const VoicemailPlayer = memo(function VoicemailPlayer({
  voicemail,
  isPlaying,
  showSeekBar,
  isLoading,
  isDownloading,
  progress,
  currentTime,
  duration,
  playbackSpeed,
  selectionMode,
  isSelected,
  onToggleSelect,
  onSpeedChange,
  onTogglePlay,
  onSeek,
  onDownload,
  onDelete,
}: VoicemailPlayerProps) {
  const handlePlay = useCallback(() => onTogglePlay(voicemail), [onTogglePlay, voicemail]);
  const handleDownload = useCallback(() => onDownload(voicemail), [onDownload, voicemail]);
  const handleDelete = useCallback(() => onDelete(voicemail), [onDelete, voicemail]);

  const isNew = !voicemail.read;

  // SSOT: Use contact lookup store for name resolution
  const apiName = voicemail.callerIdName !== 'Unknown' ? voicemail.callerIdName : undefined;
  const callerDisplay = useContactDisplayName(voicemail.callerIdNum, apiName);

  return (
    <div
      className={`p-4 rounded-xl border transition-all ${
        isSelected
          ? 'border-[var(--border)] bg-[var(--primary-600)] text-white'
          : isNew
            ? 'border-blue-500 bg-gradient-to-r from-blue-500/10 to-blue-600/5 dark:from-blue-500/20 dark:to-blue-600/10'
            : 'border-[var(--border)] hover:border-[var(--primary-300)]'
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {selectionMode && (
            <input
              type="checkbox"
              checked={isSelected}
              onChange={onToggleSelect}
              className="rounded border-[var(--border)]"
              aria-label={`Select voicemail from ${callerDisplay}`}
            />
          )}
          <Button
            variant={isPlaying ? 'primary' : 'secondary'}
            size="icon"
            onClick={handlePlay}
            disabled={isLoading}
            aria-label={
              isLoading
                ? `Loading voicemail from ${callerDisplay}`
                : isPlaying
                  ? `Pause voicemail from ${callerDisplay}`
                  : `Play voicemail from ${callerDisplay}`
            }
          >
            {isLoading ? (
              <FiLoader className="w-4 h-4 animate-spin" aria-hidden="true" />
            ) : isPlaying ? (
              <FiPause className="w-4 h-4" aria-hidden="true" />
            ) : (
              <FiPlay className="w-4 h-4" aria-hidden="true" />
            )}
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h4
                className={`font-semibold ${isSelected ? 'text-white' : 'text-[var(--foreground)]'}`}
              >
                {callerDisplay}
              </h4>
              {isNew && (
                <span
                  className={`px-2 py-0.5 text-xs font-medium rounded-full ${isSelected ? 'bg-white/20 text-white' : 'bg-[var(--primary-600)] text-white'}`}
                >
                  New
                </span>
              )}
            </div>
            <div
              className={`flex items-center gap-3 text-sm ${isSelected ? 'text-white/80' : 'text-[var(--muted-foreground)]'}`}
            >
              <span className="flex items-center gap-1">
                <FiPhone className="w-3 h-3" aria-hidden="true" />
                {voicemail.callerIdNum}
              </span>
              <span>{formatShortDuration(voicemail.duration)}</span>
              <span>{formatConversationTime(voicemail.origTime)}</span>
            </div>
          </div>
        </div>
        {!selectionMode && (
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={handleDownload}
              disabled={isDownloading}
              aria-label={
                isDownloading
                  ? `Downloading voicemail from ${callerDisplay}`
                  : `Download voicemail from ${callerDisplay}`
              }
            >
              {isDownloading ? (
                <FiLoader className="w-4 h-4 animate-spin" aria-hidden="true" />
              ) : (
                <FiDownload className="w-4 h-4" aria-hidden="true" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={handleDelete}
              aria-label={`Delete voicemail from ${callerDisplay}`}
            >
              <FiTrash2 className="w-4 h-4 text-[var(--danger)]" aria-hidden="true" />
            </Button>
          </div>
        )}
      </div>

      {/* Seek Bar - visible when playing or paused */}
      {showSeekBar && (
        <div className="mt-3">
          <div
            className="h-2 bg-[var(--muted)] rounded-full overflow-hidden cursor-pointer"
            onClick={onSeek}
            role="slider"
            aria-label="Seek position"
            aria-valuenow={Math.floor(currentTime)}
            aria-valuemin={0}
            aria-valuemax={Math.floor(duration)}
          >
            <div
              className="h-full bg-[var(--primary-600)] rounded-full transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex justify-between items-center text-xs text-[var(--muted-foreground)] mt-1">
            <span>{formatDuration(Math.floor(currentTime))}</span>
            <button
              onClick={onSpeedChange}
              className="px-2 py-0.5 rounded bg-[var(--muted)] hover:bg-[var(--accent)] text-[var(--muted-foreground)] font-medium transition-colors"
              aria-label={`Playback speed ${playbackSpeed}x`}
            >
              {playbackSpeed}x
            </button>
            <span>{formatDuration(Math.floor(duration))}</span>
          </div>
        </div>
      )}

      {/* Transcription */}
      {voicemail.transcription && (
        <div className="mt-3 p-3 bg-[var(--muted)]/50 rounded-lg">
          <p className="text-sm text-[var(--muted-foreground)] italic">{voicemail.transcription}</p>
        </div>
      )}
    </div>
  );
});
