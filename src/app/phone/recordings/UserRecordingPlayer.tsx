'use client';

/**
 * UserRecordingPlayer (RecordingCard) Component
 *
 * A recording as a sleek list row: avatar + name + direction/duration, the
 * shared SSOT <AudioPlayer> (streamed lazily from getPlaybackStreamUrl — its
 * seek/speed/download all work at rest), a timestamp, and a permission-gated
 * delete. Mirrors the voicemail list rows.
 *
 * @module app/phone/recordings/UserRecordingPlayer
 */

import React, { memo, useCallback } from 'react';
import { FiTrash2, FiLoader, FiCheck, FiPhoneIncoming, FiPhoneOutgoing } from 'react-icons/fi';
import { AudioPlayer } from '@/components/phone/AudioPlayer';
import { GenericAvatar } from '@/components/phone/chrome/avatarUtils';
import { useContactDisplayName } from '@/lib/hooks';
import { recordingsService, type Recording } from '@/lib/api';
import { formatConversationTime } from '@/lib/utils/datetime';
import { useAuthStore } from '@/lib/stores';
import { formatPhoneUS } from '@/lib/utils/phone';

const formatShortDuration = (seconds: number): string => {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  if (secs === 0) return `${mins}m`;
  return `${mins}m ${secs}s`;
};

/**
 * Check if a CDR extension value is a valid phone number (not a voicemail pattern or SIP extension).
 * Voicemail patterns like *99114, short SIP extensions like 1122 are filtered out.
 * Only returns true for 10-11 digit phone numbers.
 */
function isValidPhoneExtension(ext: string | undefined): boolean {
  if (!ext) return false;
  const digits = ext.replace(/\D/g, '');
  return digits.length >= 10 && digits.length <= 11 && !ext.startsWith('*');
}

export interface RecordingCardProps {
  recording: Recording;
  selectionMode: boolean;
  isSelected: boolean;
  canDelete: boolean;
  isDeleting: boolean;
  onToggleSelect: () => void;
  onDelete: (recording: Recording) => void;
}

export const RecordingCard = memo(function RecordingCard({
  recording,
  selectionMode,
  isSelected,
  canDelete,
  isDeleting,
  onToggleSelect,
  onDelete,
}: RecordingCardProps) {
  const isInbound = recording.direction === 'inbound';
  const otherParty = recording.otherParty;
  const callerDisplay = useContactDisplayName(otherParty);
  const handleDelete = useCallback(() => onDelete(recording), [onDelete, recording]);

  // Multi-number users see which line the call was on (skip voicemail / SIP patterns).
  const user = useAuthStore((s) => s.user);
  const hasMultiplePhones = (user?.phoneNumbers?.length ?? 0) > 1;
  const showPhoneBadge = hasMultiplePhones && isValidPhoneExtension(recording.extension);
  const formattedExtension = showPhoneBadge ? formatPhoneUS(recording.extension) : null;

  const DirIcon = isInbound ? FiPhoneIncoming : FiPhoneOutgoing;

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
          : 'hover:bg-[var(--muted)]/50'
      }`}
    >
      <div className="flex items-center gap-3 px-4 py-2.5">
        {selectionMode && (
          <span
            className={`grid h-5 w-5 shrink-0 place-items-center rounded border-2 transition-colors ${
              isSelected
                ? 'border-[var(--border)] bg-[var(--primary-600)]'
                : 'border-[var(--border)]'
            }`}
          >
            {isSelected && <FiCheck className="h-3 w-3 text-white" aria-hidden="true" />}
          </span>
        )}
        <GenericAvatar name={callerDisplay} number={otherParty} size={40} />
        <div className="w-40 shrink-0 sm:w-56">
          <h4 className="truncate text-[14.5px] font-bold text-[var(--foreground)]">
            {callerDisplay}
          </h4>
          <div className="mt-0.5 flex items-center gap-1.5 text-[12.5px] text-[var(--muted-foreground)]">
            <DirIcon
              className={`h-3.5 w-3.5 shrink-0 ${isInbound ? 'text-green-600' : 'text-blue-600'}`}
              aria-hidden="true"
            />
            <span className="tabular-nums">{formatShortDuration(recording.duration)}</span>
            {formattedExtension && (
              <>
                <span aria-hidden="true">·</span>
                <span className="rounded bg-violet-50 px-1 py-0.5 text-[10px] font-bold text-violet-600 dark:bg-violet-900/20 dark:text-violet-400">
                  {formattedExtension}
                </span>
              </>
            )}
          </div>
        </div>

        {/* SSOT player — streamed lazily; seek/speed/download work at rest. */}
        <div className="flex min-w-0 flex-1 items-center">
          {!selectionMode && (
            <AudioPlayer
              className="w-full"
              id={`rec-${recording.id}`}
              url={recordingsService.getPlaybackStreamUrl(recording.id)}
              durationSeconds={recording.duration}
              filename={recording.filename || `recording-${otherParty}.wav`}
            />
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <span className="whitespace-nowrap text-[12px] tabular-nums text-[var(--muted-foreground)]">
            {formatConversationTime(new Date(recording.startTime).getTime())}
          </span>
          {canDelete && !selectionMode && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleDelete();
              }}
              disabled={isDeleting}
              aria-label={`Delete recording with ${callerDisplay}`}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-[var(--muted-foreground)] opacity-0 transition-all hover:bg-[var(--danger)]/10 hover:text-[var(--danger)] focus-visible:opacity-100 group-hover:opacity-100 disabled:opacity-40"
            >
              {isDeleting ? (
                <FiLoader className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <FiTrash2 className="h-4 w-4" aria-hidden="true" />
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
});
