'use client';

import React, { useCallback } from 'react';
import { FaWhatsapp } from 'react-icons/fa';
import { FiCheck } from 'react-icons/fi';
import { useContactDisplayName } from '@/lib/hooks';
import { formatConversationTime } from '@/lib/utils/datetime';
import { GenericAvatar } from '@/components/phone/chrome/avatarUtils';
import { CountdownTimer } from './CountdownTimer';
import { MessageTypeIcon } from './MessageTypeIcon';
import type { WaConversation } from '@/lib/api/services/whatsapp-types';

interface WaConversationItemProps {
  conversation: WaConversation;
  isSelected: boolean;
  isSelectionMode: boolean;
  isChecked: boolean;
  onClick: () => void;
  onToggleSelect: () => void;
  /** Window end timestamp (if 24h window is active) */
  windowEnd?: string;
  /** Non-null → render the typing pulse instead of the preview (managers only). */
  typingAgentName?: string | null;
}

/**
 * WhatsApp conversation row — unified with the Messages row look
 * (GenericAvatar, unread dot + count badge, preview) plus a small green
 * WhatsApp channel badge and the WA-specific 24h countdown / message-type icon.
 */
export const WaConversationItem = React.memo(function WaConversationItem({
  conversation,
  isSelected,
  isSelectionMode,
  isChecked,
  onClick,
  onToggleSelect,
  windowEnd,
  typingAgentName,
}: WaConversationItemProps) {
  const name = useContactDisplayName(conversation.phoneNumber, conversation.contactName);
  const unread = conversation.unreadCount > 0;

  const handleClick = useCallback(() => {
    if (isSelectionMode) onToggleSelect();
    else onClick();
  }, [isSelectionMode, onClick, onToggleSelect]);

  return (
    <button
      onClick={handleClick}
      role="option"
      aria-selected={isSelected}
      aria-label={`WhatsApp conversation with ${name}${unread ? `, ${conversation.unreadCount} unread` : ''}`}
      className={`group w-full flex items-center gap-3 px-4 py-[5px] text-left border-b border-[var(--border)]/60 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-green-500 ${
        (isSelected && !isSelectionMode) || isChecked
          ? 'bg-green-50 dark:bg-green-900/20'
          : 'hover:bg-[var(--muted)]/60'
      }`}
    >
      {/* selection checkbox — only in selection mode; otherwise avatar is flush-left */}
      {isSelectionMode && (
        <span className={`w-5 h-5 rounded border-2 grid place-items-center shrink-0 ${isChecked ? 'bg-green-600 border-green-600' : 'border-[var(--border)]'}`}>
          {isChecked && <FiCheck className="w-3 h-3 text-white" />}
        </span>
      )}

      {/* avatar + WhatsApp channel badge (bottom-right) + unread dot (top-right) */}
      <span className="relative shrink-0">
        <GenericAvatar name={name} number={conversation.phoneNumber} size={36} />
        <span className="absolute -bottom-0.5 -right-0.5 w-[15px] h-[15px] rounded-full bg-white dark:bg-[var(--card)] grid place-items-center">
          <FaWhatsapp className="w-[11px] h-[11px] text-green-500" />
        </span>
        {!isSelectionMode && unread && (
          <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-green-500 ring-2 ring-[var(--card)]" />
        )}
      </span>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className={`text-[14.5px] truncate text-[var(--foreground)] ${unread ? 'font-black' : 'font-bold'}`}>{name}</span>
        </div>
        <div className={`flex items-center gap-1 mt-0.5 min-w-0 text-[12.5px] ${unread ? 'text-[var(--foreground)]' : 'text-[var(--muted-foreground)]'}`}>
          {typingAgentName ? (
            <span className="flex items-center gap-1.5 italic text-green-500">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
              </span>
              {typingAgentName} is typing…
            </span>
          ) : conversation.lastMessage ? (
            <>
              <MessageTypeIcon type={conversation.lastMessageType} />
              <span className="truncate">{conversation.lastMessage}</span>
            </>
          ) : conversation.lastMessageType !== 'text' ? (
            <>
              <MessageTypeIcon type={conversation.lastMessageType} />
              <span className="truncate">{`[${conversation.lastMessageType}]`}</span>
            </>
          ) : (
            <span className="truncate italic opacity-70">No messages yet</span>
          )}
        </div>
      </div>

      <div className="flex flex-col items-end gap-1 shrink-0">
        <span className="text-[12px] whitespace-nowrap text-[var(--muted-foreground)]">
          {conversation.lastMessageTime ? formatConversationTime(conversation.lastMessageTime) : ''}
        </span>
        <div className="flex items-center gap-1.5">
          {windowEnd && <CountdownTimer windowEnd={windowEnd} />}
          {!isSelectionMode && unread && (
            <span className="min-w-[18px] h-[18px] px-1.5 grid place-items-center text-[11px] font-black rounded-full bg-green-500 text-white">
              {conversation.unreadCount}
            </span>
          )}
        </div>
      </div>
    </button>
  );
});

export default WaConversationItem;
