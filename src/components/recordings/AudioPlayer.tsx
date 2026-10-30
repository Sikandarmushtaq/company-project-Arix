'use client';

/**
 * Shared Audio Player
 *
 * Pure presentational component used by both SIP recordings
 * (/admin/recordings, /phone/recordings) and WhatsApp call recordings
 * (/admin/whatsapp/calls). Owns no audio state of its own — the caller
 * holds the HTMLAudioElement refs and feeds progress/duration as props.
 *
 * Originally lived at app/admin/recordings/RecordingPlayer.tsx; moved
 * here when WA calls needed the same player. Old import path still works
 * via a re-export to avoid churning unrelated files.
 *
 * @module components/recordings/AudioPlayer
 */

import React from 'react';
import { FiPlay, FiPause, FiLoader } from 'react-icons/fi';

const formatDuration = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export const PLAYBACK_SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];

export interface AudioPlayerProps {
  isPlaying: boolean;
  isPaused: boolean;
  isLoading: boolean;
  /** Progress percentage 0-100 */
  progress: number;
  /** Current playback position in seconds */
  currentTime: number;
  /** Total duration in seconds */
  duration: number;
  /** Current playback rate (e.g. 1, 1.5, 2) */
  playbackSpeed: number;
  onTogglePlay: () => void;
  onSeek: (e: React.MouseEvent<HTMLDivElement>) => void;
  onSpeedChange: () => void;
}

export const AudioPlayer = React.memo(function AudioPlayer({
  isPlaying,
  isPaused,
  isLoading,
  progress,
  currentTime,
  duration,
  playbackSpeed,
  onTogglePlay,
  onSeek,
  onSpeedChange,
}: AudioPlayerProps) {
  const showSeekBar = isPlaying || isPaused;

  return (
    <div className="flex flex-col gap-1 min-w-[200px]">
      <div className="flex items-center gap-2">
        <button
          onClick={onTogglePlay}
          disabled={isLoading}
          className={`p-2 rounded-full transition-colors ${
            // While loading, keep the neutral background so the blue spinner is
            // visible (a blue spinner on the blue "playing" background is
            // invisible). Only go blue once it's actually playing.
            isPlaying && !isLoading
              ? 'bg-blue-500 text-white'
              : 'bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
          }`}
          title={isLoading ? 'Loading…' : isPlaying ? 'Pause' : 'Play'}
        >
          {isLoading ? (
            <FiLoader className="w-4 h-4 animate-spin text-blue-500" />
          ) : isPlaying ? (
            <FiPause className="w-4 h-4" />
          ) : (
            <FiPlay className="w-4 h-4" />
          )}
        </button>
        {!showSeekBar && (
          <span className="text-sm text-[var(--muted-foreground)]">
            {formatDuration(Math.floor(duration))}
          </span>
        )}
      </div>

      {/* Seek bar — visible when playing or paused (i.e. the recording has
          been "opened") to keep the row compact in the idle state. */}
      {showSeekBar && (
        <div className="mt-1">
          <div
            className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden cursor-pointer"
            onClick={onSeek}
            role="slider"
            aria-label="Seek position"
            aria-valuenow={Math.floor(currentTime)}
            aria-valuemin={0}
            aria-valuemax={Math.floor(duration)}
          >
            <div
              className="h-full bg-blue-500 rounded-full transition-all duration-100"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex justify-between items-center text-xs text-[var(--muted-foreground)] mt-1">
            <span>{formatDuration(Math.floor(currentTime))}</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onSpeedChange();
              }}
              className="px-2 py-0.5 rounded bg-[var(--muted)] hover:bg-[var(--accent)] text-[var(--muted-foreground)] font-medium transition-colors"
              aria-label={`Playback speed ${playbackSpeed}x`}
            >
              {playbackSpeed}x
            </button>
            <span>{formatDuration(Math.floor(duration))}</span>
          </div>
        </div>
      )}
    </div>
  );
});
