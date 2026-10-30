'use client';

import React, { useMemo, useCallback } from 'react';
import {
  FiCheck,
  FiCheckCircle,
  FiClock,
  FiSquare,
  FiCheckSquare,
  FiUser,
  FiAlertCircle,
  FiCopy,
} from 'react-icons/fi';
import { toast } from '@/lib/stores/toast';
import { formatMessageTime } from '@/lib/utils/datetime';
import { formatPhoneNumber } from '@/lib/utils/formatting';
import { translateTwilioError } from '@/lib/utils/twilioErrorMessages';
import { extractImages, getMessageText, downloadImage, getImageGridClass } from './utils';
import { MessageImage } from './MessageImage';
import type { Message } from './types';

/**
 * Deterministic color for a sender based on their phone number.
 * Returns a Tailwind-compatible hsl color string.
 */
const SENDER_COLORS = [
  'rgb(59, 130, 246)', // blue
  'rgb(16, 185, 129)', // emerald
  'rgb(245, 158, 11)', // amber
  'rgb(239, 68, 68)', // red
  'rgb(139, 92, 246)', // violet
  'rgb(236, 72, 153)', // pink
  'rgb(14, 165, 233)', // sky
  'rgb(249, 115, 22)', // orange
];

function getSenderColor(phone: string): string {
  let hash = 0;
  for (let i = 0; i < phone.length; i++) {
    hash = (hash * 31 + phone.charCodeAt(i)) | 0;
  }
  return SENDER_COLORS[Math.abs(hash) % SENDER_COLORS.length];
}

interface MessageBubbleProps {
  message: Message;
  isSelectionMode: boolean;
  isSelected: boolean;
  isHighlighted?: boolean;
  onImageClick?: (url: string) => void;
  onToggleSelect: () => void;
  /** Group chat mode — shows sender name + color on inbound messages */
  isGroupChat?: boolean;
  /** Display name for the sender (from group members list) */
  senderName?: string;
  /** Whether this message's sender is the same as the previous message's sender */
  showSenderLabel?: boolean;
  /** Which user phone this message was sent from/received on (for multi-number users) */
  viaPhone?: string;
  /** Logged-in user's display name — shown above outbound bubbles (RingCentral). */
  selfName?: string;
  /** Hover-toolbar: enter selection mode with this message selected. */
  onStartSelect?: () => void;
}

/**
 * Message bubble - memoized for performance
 * Supports selection mode for bulk delete and highlighting from search
 */
export const MessageBubble = React.memo(function MessageBubble({
  message,
  isSelectionMode,
  isSelected,
  isHighlighted,
  onImageClick,
  onToggleSelect,
  isGroupChat,
  senderName,
  showSenderLabel = true,
  viaPhone,
  selfName,
  onStartSelect,
}: MessageBubbleProps) {
  const isOutbound = message.direction === 'outbound';

  const images = useMemo(() => extractImages(message.body), [message.body]);
  const textContent = useMemo(() => getMessageText(message.body), [message.body]);

  const mediaUrls = useMemo(() => {
    const urls: string[] = [...images];
    if (message.mediaUrl) {
      const additionalUrls = message.mediaUrl
        .split(',')
        .map((u) => u.trim())
        .filter(Boolean);
      urls.push(...additionalUrls);
    }
    return urls;
  }, [images, message.mediaUrl]);

  const hasImages = mediaUrls.length > 0;
  const hasText = textContent.length > 0;
  const imageCount = mediaUrls.length;

  const senderColor = useMemo(
    () => (isGroupChat && !isOutbound ? getSenderColor(message.sender) : undefined),
    [isGroupChat, isOutbound, message.sender]
  );

  // Check if sender has a real contact name (contains letters) vs just a phone number
  const senderHasName = useMemo(() => {
    if (!isGroupChat || isOutbound) return false;
    const name = senderName || '';
    return /[a-zA-Z]/.test(name);
  }, [isGroupChat, isOutbound, senderName]);

  const avatarInitial = useMemo(() => {
    if (!isGroupChat || isOutbound) return '';
    if (!senderHasName) return ''; // Will show icon instead
    const name = senderName || message.sender;
    const match = name.match(/[a-zA-Z]/);
    return match ? match[0].toUpperCase() : '';
  }, [isGroupChat, isOutbound, senderName, message.sender, senderHasName]);

  const handleDownload = useCallback((e: React.MouseEvent, url: string) => {
    e.preventDefault();
    e.stopPropagation();
    downloadImage(url);
  }, []);

  const handleClick = useCallback(() => {
    if (isSelectionMode) {
      onToggleSelect();
    }
  }, [isSelectionMode, onToggleSelect]);

  const handleCopy = useCallback(() => {
    navigator.clipboard?.writeText(textContent);
    toast.success('Message copied');
  }, [textContent]);

  return (
    <div
      id={`message-${message.id}`}
      className={`flex ${isOutbound ? 'justify-end' : 'justify-start'} px-4 ${isSelectionMode ? 'cursor-pointer' : ''} ${isHighlighted ? 'animate-pulse' : ''}`}
      onClick={handleClick}
      role={isSelectionMode ? 'checkbox' : undefined}
      aria-checked={isSelectionMode ? isSelected : undefined}
      aria-label={isSelectionMode ? `${isSelected ? 'Deselect' : 'Select'} message` : undefined}
    >
      {isSelectionMode && !isOutbound && (
        <div className="flex-shrink-0 mr-2 self-center">
          {isSelected ? (
            <FiCheckSquare className="w-5 h-5 text-[var(--foreground)]" />
          ) : (
            <FiSquare className="w-5 h-5 text-[var(--muted-foreground)]" />
          )}
        </div>
      )}

      {/* Group chat: sender avatar — letter initial for contacts, user icon for phone numbers */}
      {isGroupChat && !isOutbound && showSenderLabel && (
        <div
          className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center mr-2 mt-1 text-xs font-semibold text-white"
          style={{ backgroundColor: senderColor }}
          title={senderName || message.sender}
        >
          {senderHasName ? avatarInitial : <FiUser className="w-3.5 h-3.5" />}
        </div>
      )}
      {/* Spacer when avatar is hidden (consecutive messages from same sender) */}
      {isGroupChat && !isOutbound && !showSenderLabel && <div className="flex-shrink-0 w-7 mr-2" />}

      <div className={`group relative flex flex-col max-w-[78%] ${isOutbound ? 'items-end' : 'items-start'}`}>
        {/* Hover toolbar — copy / select / delete (RingCentral; forward + translate dropped) */}
        {!isSelectionMode && (hasText || hasImages) && (
          <div
            className={`absolute -top-3.5 z-10 hidden group-hover:flex items-center gap-0.5 rounded-full border border-[var(--border)] bg-[var(--card)] shadow-md px-1 py-0.5 ${isOutbound ? 'right-1' : 'left-1'}`}
          >
            {hasText && (
              <button type="button" onClick={handleCopy} title="Copy" aria-label="Copy" className="w-7 h-7 grid place-items-center rounded-full text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)]">
                <FiCopy className="w-3.5 h-3.5" />
              </button>
            )}
            {onStartSelect && (
              <button type="button" onClick={onStartSelect} title="Select" aria-label="Select" className="w-7 h-7 grid place-items-center rounded-full text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)]">
                <FiCheckSquare className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}
        {/* Outbound sender label above the bubble (RingCentral): "Name · from #" */}
        {isOutbound && showSenderLabel && selfName && (
          <p className="text-xs mb-1 px-1 text-[var(--muted-foreground)]">
            <span className="font-semibold text-[var(--foreground)]">{selfName}</span>
            {message.sender && <> &middot; {formatPhoneNumber(message.sender)}</>}
          </p>
        )}

        {/* bubble + timestamp OUTSIDE it, on the opposite side */}
        <div className="flex items-end gap-2 max-w-full">
          {isOutbound && (
            <div className="flex items-center gap-1 pb-1 text-xs text-[var(--muted-foreground)] whitespace-nowrap shrink-0">
              <span>{formatMessageTime(message.txRxDatetime)}</span>
              {message.status === 'failed' ? (
                <FiAlertCircle className="w-3 h-3 text-red-500" aria-label="Failed" />
              ) : message.status === 'pending' ? (
                <FiClock className="w-3 h-3 animate-pulse" aria-label="Sending" />
              ) : message.delivered ? (
                <FiCheckCircle className="w-3 h-3" aria-label="Delivered" />
              ) : (
                <FiCheck className="w-3 h-3" aria-label="Sent" />
              )}
            </div>
          )}

          <div
            className={`min-w-0 rounded-2xl overflow-hidden ${
              isOutbound
                ? 'bg-[var(--primary-600)] text-white rounded-br-sm'
                : 'bg-[var(--muted)] text-[var(--foreground)] rounded-bl-sm'
            } ${isSelected ? 'ring-2 ring-[var(--primary-600)]' : ''} ${isHighlighted ? 'ring-2 ring-yellow-400 dark:ring-yellow-500' : ''}`}
          >
            {/* Group chat: inbound sender name label (inside bubble) */}
            {isGroupChat && !isOutbound && showSenderLabel && senderName && (
              <p className="px-3 pt-2 pb-0 text-xs font-semibold" style={{ color: senderColor }}>
                {senderName}
              </p>
            )}

            {hasImages && (
              <div className={`grid ${getImageGridClass(imageCount)} gap-0.5`}>
                {mediaUrls.map((url, index) => (
                  <div
                    key={`${message.id}-img-${index}`}
                    className={imageCount === 3 && index === 2 ? 'col-span-2' : ''}
                  >
                    <MessageImage
                      url={url}
                      index={index}
                      onImageClick={isSelectionMode ? undefined : onImageClick}
                      onDownload={handleDownload}
                    />
                  </div>
                ))}
              </div>
            )}

            {hasText && (
              <p className="p-3 whitespace-pre-wrap break-words" style={{ wordBreak: 'break-word' }}>
                {textContent}
              </p>
            )}

            {!hasImages && !hasText && (
              <p className="p-3 italic text-sm opacity-70">[Empty message]</p>
            )}
          </div>

          {!isOutbound && (
            <div className="flex items-center gap-1 pb-1 text-xs text-[var(--muted-foreground)] whitespace-nowrap shrink-0">
              {viaPhone && <span className="opacity-70">via {formatPhoneNumber(viaPhone)}</span>}
              <span>{formatMessageTime(message.txRxDatetime)}</span>
            </div>
          )}
        </div>

        {/* Failed message reason */}
        {message.status === 'failed' && message.failureReason && (
          <p className={`text-xs mt-1 px-1 ${isOutbound ? 'text-red-500' : 'text-red-500'}`}>
            {translateTwilioError(message.failureReason)}
          </p>
        )}
      </div>
      {isSelectionMode && isOutbound && (
        <div className="flex-shrink-0 ml-2 self-center">
          {isSelected ? (
            <FiCheckSquare className="w-5 h-5 text-[var(--foreground)]" />
          ) : (
            <FiSquare className="w-5 h-5 text-[var(--muted-foreground)]" />
          )}
        </div>
      )}
    </div>
  );
});

export default MessageBubble;
