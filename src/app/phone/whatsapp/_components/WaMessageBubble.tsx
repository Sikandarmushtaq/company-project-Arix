'use client';

import React, { useMemo, useCallback } from 'react';
import {
  FiFile,
  FiMapPin,
  FiPlay,
  FiMic,
  FiFileText,
  FiSquare,
  FiCheckSquare,
  FiDownload,
} from 'react-icons/fi';
import { formatMessageTime } from '@/lib/utils/datetime';
import { StatusIndicator } from './StatusIndicator';
import { ReactionPicker } from './ReactionPicker';
import type { WaMessage } from '@/lib/api/services/whatsapp-types';

// ============================================================================
// Types
// ============================================================================

interface WaMessageBubbleProps {
  message: WaMessage;
  isSelectionMode: boolean;
  isSelected: boolean;
  onToggleSelect: () => void;
  /** Callback when an image is clicked for full preview */
  onImageClick?: (url: string) => void;
  /** Callback when user reacts to this message */
  onReact?: (waMessageId: string, emoji: string) => void;
  /** Callback when user removes reaction from this message */
  onRemoveReaction?: (waMessageId: string) => void;
}

// ============================================================================
// Component
// ============================================================================

/**
 * WhatsApp-styled message bubble.
 * Supports: text, image, video, audio, document, location, sticker,
 * reaction, template, and unknown message types.
 * Includes status indicators and selection mode.
 * Memoized for performance.
 */
export const WaMessageBubble = React.memo(function WaMessageBubble({
  message,
  isSelectionMode,
  isSelected,
  onToggleSelect,
  onImageClick,
  onReact,
  onRemoveReaction,
}: WaMessageBubbleProps) {
  const isOutbound = message.direction === 'outbound';
  const isSticker = message.messageType === 'sticker';

  // Call log entries (synthetic messages inserted by the calling service when
  // a call ends) render as a centered pill with the call icon and outcome
  // text — matches WhatsApp's native UX. Body text is already preformatted by
  // the backend (e.g. "📞 You called · 2 min", "📞 Missed voice call").
  // We deliberately skip selection mode + reactions + the standard bubble
  // chrome — these aren't real messages.
  if (message.messageType === 'call_log') {
    const outcome =
      (message.interactiveData?.outcome as string | undefined) || (isOutbound ? 'ended' : 'missed');
    // Tint missed/declined a touch warmer so they stand out at a glance —
    // matches WhatsApp's red "Missed call" treatment.
    const isMissed = outcome === 'missed' || outcome === 'rejected' || outcome === 'failed';
    const tint = isMissed
      ? 'text-red-500 bg-red-500/10 border-red-500/20'
      : 'text-[var(--muted-foreground)] bg-[var(--muted)]/40 border-[var(--border)]';
    return (
      <div
        id={`wa-message-${message.id}`}
        className="flex justify-center px-4 my-1"
        role="note"
        aria-label={message.body || 'Call log'}
      >
        <span
          className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs ${tint}`}
        >
          <span className="whitespace-nowrap">{message.body}</span>
          <span className="opacity-60">·</span>
          <span className="opacity-60">{formatMessageTime(message.createdAt)}</span>
        </span>
      </div>
    );
  }

  // Derive a user-facing download/save filename. Falls back to a sensible
  // default keyed off the MIME so downloads never end up as a raw media_id.
  const documentDownloadName = useMemo(() => {
    if (message.mediaFilename) return message.mediaFilename;
    const extByMime: Record<string, string> = {
      'application/pdf': 'pdf',
      'application/msword': 'doc',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
      'application/vnd.ms-excel': 'xls',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
      'application/vnd.ms-powerpoint': 'ppt',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
      'text/plain': 'txt',
    };
    const ext = message.mediaMimeType ? extByMime[message.mediaMimeType] : null;
    return `document${ext ? `.${ext}` : ''}`;
  }, [message.mediaFilename, message.mediaMimeType]);

  // Resolve media URL: prefer stored mediaUrl, fall back to proxy via
  // mediaId. For documents, append ?filename= so Content-Disposition on
  // the response makes the browser save with the real name instead of the
  // raw media_id digits.
  const resolvedMediaUrl = useMemo(() => {
    const base = message.mediaUrl
      ? message.mediaUrl
      : message.mediaId
        ? `/api/proxy/whatsapp/media/${message.mediaId}`
        : null;
    if (!base) return null;
    if (message.messageType === 'document') {
      const sep = base.includes('?') ? '&' : '?';
      return `${base}${sep}filename=${encodeURIComponent(documentDownloadName)}`;
    }
    return base;
  }, [message.mediaUrl, message.mediaId, message.messageType, documentDownloadName]);

  // Friendly file-type label for the document card subtitle.
  const documentTypeLabel = useMemo(() => {
    const name = documentDownloadName;
    const ext = name.includes('.') ? name.split('.').pop()!.toUpperCase() : '';
    if (ext) return `${ext} document`;
    const byMime: Record<string, string> = {
      'application/pdf': 'PDF document',
      'application/msword': 'Word document',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'Word document',
      'application/vnd.ms-excel': 'Excel spreadsheet',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'Excel spreadsheet',
      'application/vnd.ms-powerpoint': 'PowerPoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'PowerPoint',
      'text/plain': 'Text file',
    };
    return (message.mediaMimeType && byMime[message.mediaMimeType]) || 'Document';
  }, [documentDownloadName, message.mediaMimeType]);

  const handleClick = useCallback(() => {
    if (isSelectionMode) {
      onToggleSelect();
    }
  }, [isSelectionMode, onToggleSelect]);

  const handleImageClick = useCallback(
    (url: string) => {
      if (!isSelectionMode && onImageClick) {
        onImageClick(url);
      }
    },
    [isSelectionMode, onImageClick]
  );

  // Determine if we should show a bubble background
  // Stickers get no background for a clean look
  const bubbleClasses = useMemo(() => {
    if (isSticker) {
      return 'max-w-[200px]';
    }
    return `rounded-2xl overflow-hidden ${
      isOutbound
        ? 'bg-green-600 text-white rounded-br-sm'
        : 'bg-[var(--muted)] text-[var(--foreground)] rounded-bl-sm'
    } ${isSelected ? 'ring-2 ring-green-500' : ''}`;
  }, [isOutbound, isSticker, isSelected]);

  return (
    <div
      id={`wa-message-${message.id}`}
      className={`group flex ${isOutbound ? 'justify-end' : 'justify-start'} px-4 ${isSelectionMode ? 'cursor-pointer' : ''} ${message.reactionEmoji ? 'mb-3' : ''}`}
      onClick={handleClick}
      role={isSelectionMode ? 'checkbox' : undefined}
      aria-checked={isSelectionMode ? isSelected : undefined}
    >
      {/* Selection checkbox (left side for inbound) */}
      {isSelectionMode && !isOutbound && (
        <div className="flex-shrink-0 mr-2 self-center">
          {isSelected ? (
            <FiCheckSquare className="w-5 h-5 text-green-500" />
          ) : (
            <FiSquare className="w-5 h-5 text-[var(--muted-foreground)]" />
          )}
        </div>
      )}

      <div className="flex items-end gap-1" style={{ width: 'fit-content', maxWidth: '75%' }}>
        {/* Reaction picker (left of outbound bubble) */}
        {!isSelectionMode && isOutbound && message.waMessageId && onReact && (
          <div className="flex-shrink-0 mb-1">
            <ReactionPicker
              currentReaction={message.reactionEmoji || null}
              isOutbound={isOutbound}
              onReact={(emoji) => onReact(message.waMessageId!, emoji)}
              onRemoveReaction={() => onRemoveReaction?.(message.waMessageId!)}
            />
          </div>
        )}

        <div className="relative" style={{ width: 'fit-content' }}>
          <div className={bubbleClasses}>
            {/* Template indicator */}
            {message.messageType === 'template' && message.templateName && !message.body && (
              <p className="p-3 pb-1 text-sm italic flex items-center gap-1">
                <FiFileText className="w-3 h-3" />
                Template: {message.templateName}
              </p>
            )}

            {/* Call-permission reply (allow/disable) with no stored body —
                older rows had a blank body and rendered as an empty bubble.
                Show a clear label instead. New rows arrive with a populated
                body ("📞 Allowed/Turned off WhatsApp calls"). */}
            {message.interactiveType === 'call_permission_reply' && !message.body && (
              <p className="p-3 pb-1 text-sm italic flex items-center gap-1">
                <FiFileText className="w-3 h-3" />
                Call permission updated
              </p>
            )}

            {/* Image */}
            {message.messageType === 'image' && resolvedMediaUrl && (
              <button
                type="button"
                onClick={() => handleImageClick(resolvedMediaUrl!)}
                className="block w-full"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={resolvedMediaUrl!}
                  alt=""
                  className="max-w-full max-h-64 object-cover"
                  loading="lazy"
                />
              </button>
            )}

            {/* Video */}
            {message.messageType === 'video' && resolvedMediaUrl && (
              <div className="relative">
                <div className="bg-black/20 flex items-center justify-center min-h-[120px] p-4">
                  <a
                    href={resolvedMediaUrl!}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm hover:underline"
                  >
                    <div className="w-12 h-12 rounded-full bg-white/30 flex items-center justify-center">
                      <FiPlay className="w-6 h-6" />
                    </div>
                  </a>
                </div>
              </div>
            )}

            {/* Audio */}
            {message.messageType === 'audio' && resolvedMediaUrl && (
              <div className="flex items-center gap-3 p-3 pb-1">
                <a
                  href={resolvedMediaUrl!}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm hover:underline"
                >
                  <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
                    <FiMic className="w-4 h-4 text-green-500" />
                  </div>
                  <span>Audio message</span>
                </a>
              </div>
            )}

            {/* Document — WhatsApp-style attachment card */}
            {message.messageType === 'document' && (
              <div className="p-2 pb-1">
                {resolvedMediaUrl ? (
                  <a
                    href={resolvedMediaUrl}
                    download={documentDownloadName}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 p-2.5 rounded-lg bg-black/5 hover:bg-black/10 dark:bg-white/5 dark:hover:bg-white/10 transition-colors group min-w-[14rem]"
                    title={`Download ${documentDownloadName}`}
                  >
                    <div className="flex-shrink-0 w-10 h-10 rounded-md bg-red-500/15 flex items-center justify-center">
                      <FiFileText className="w-5 h-5 text-red-500" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate" title={documentDownloadName}>
                        {documentDownloadName}
                      </p>
                      <p className="text-xs opacity-70 truncate">{documentTypeLabel}</p>
                    </div>
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-black/5 dark:bg-white/10 flex items-center justify-center group-hover:bg-black/10 dark:group-hover:bg-white/20 transition-colors">
                      <FiDownload className="w-4 h-4" />
                    </div>
                  </a>
                ) : (
                  <div className="flex items-center gap-3 p-2.5 rounded-lg bg-black/5 dark:bg-white/5 min-w-[14rem]">
                    <div className="flex-shrink-0 w-10 h-10 rounded-md bg-[var(--muted)] flex items-center justify-center">
                      <FiFile className="w-5 h-5 opacity-60" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{documentDownloadName}</p>
                      <p className="text-xs opacity-70">Unavailable</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Location */}
            {message.messageType === 'location' && message.latitude != null && (
              <div className="p-3 pb-1">
                <div className="flex items-center gap-2">
                  <FiMapPin className="w-4 h-4 flex-shrink-0 text-red-400" />
                  <div className="min-w-0">
                    {message.locationName && (
                      <p className="text-xs font-medium truncate">{message.locationName}</p>
                    )}
                    {message.locationAddress && (
                      <p className="text-xs opacity-70 truncate">{message.locationAddress}</p>
                    )}
                    <p className="text-xs opacity-60">
                      {message.latitude}, {message.longitude}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Sticker */}
            {message.messageType === 'sticker' && resolvedMediaUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={resolvedMediaUrl!}
                alt="Sticker"
                className="w-32 h-32 object-contain"
                loading="lazy"
              />
            )}

            {/* Body text */}
            {message.body && (
              <p className="p-3 pb-1 whitespace-pre-wrap break-words text-sm">{message.body}</p>
            )}

            {/* Timestamp + status */}
            {!isSticker && (
              <div
                className={`flex items-center gap-1 px-3 pb-2 pt-1 ${
                  isOutbound ? 'justify-end' : 'justify-start'
                }`}
              >
                <span
                  className={`text-xs ${
                    isOutbound ? 'text-white/60' : 'text-[var(--muted-foreground)]'
                  }`}
                >
                  {formatMessageTime(message.createdAt)}
                </span>
                {isOutbound && <StatusIndicator status={message.status} />}
              </div>
            )}

            {/* Sticker timestamp (no bubble bg, so different style) */}
            {isSticker && (
              <div className="flex items-center gap-1 mt-1">
                <span className="text-xs text-[var(--muted-foreground)]">
                  {formatMessageTime(message.createdAt)}
                </span>
                {isOutbound && <StatusIndicator status={message.status} />}
              </div>
            )}
          </div>

          {/* Reaction pill (WhatsApp-style, below the bubble, not overlapping content) */}
          {message.reactionEmoji && (
            <div className={`flex ${isOutbound ? 'justify-end' : 'justify-start'} -mt-1`}>
              <span className="inline-flex items-center px-1.5 py-0.5 bg-[var(--card)] border border-[var(--border)] rounded-full text-sm shadow-sm">
                {message.reactionEmoji}
              </span>
            </div>
          )}
        </div>

        {/* Reaction picker (right of inbound bubble) */}
        {!isSelectionMode && !isOutbound && message.waMessageId && onReact && (
          <div className="flex-shrink-0 mb-1">
            <ReactionPicker
              currentReaction={message.reactionEmoji || null}
              isOutbound={isOutbound}
              onReact={(emoji) => onReact(message.waMessageId!, emoji)}
              onRemoveReaction={() => onRemoveReaction?.(message.waMessageId!)}
            />
          </div>
        )}
      </div>

      {/* Selection checkbox (right side for outbound) */}
      {isSelectionMode && isOutbound && (
        <div className="flex-shrink-0 ml-2 self-center">
          {isSelected ? (
            <FiCheckSquare className="w-5 h-5 text-green-500" />
          ) : (
            <FiSquare className="w-5 h-5 text-[var(--muted-foreground)]" />
          )}
        </div>
      )}
    </div>
  );
});
