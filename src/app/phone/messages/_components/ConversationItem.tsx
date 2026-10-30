'use client';

import React, { useCallback } from 'react';
import { FiSquare, FiCheckSquare } from 'react-icons/fi';
import { useContactDisplayName } from '@/lib/hooks';
import { formatConversationTime } from '@/lib/utils/datetime';
import { getConversationPreview } from './utils';
import type { Conversation } from './types';

interface ConversationItemProps {
  conversation: Conversation;
  isSelected: boolean;
  isSelectionMode: boolean;
  isChecked: boolean;
  onClick: () => void;
  onToggleSelect: () => void;
}

/**
 * Conversation list item - memoized for performance
 * Supports selection mode for bulk operations
 */
export const ConversationItem = React.memo(function ConversationItem({
  conversation,
  isSelected,
  isSelectionMode,
  isChecked,
  onClick,
  onToggleSelect,
}: ConversationItemProps) {
  // SSOT: Use contact lookup store for name resolution
  const displayName = useContactDisplayName(conversation.phoneNumber, conversation.contactName);

  const handleClick = useCallback(() => {
    if (isSelectionMode) {
      onToggleSelect();
    } else {
      onClick();
    }
  }, [isSelectionMode, onClick, onToggleSelect]);

  return (
    <button
      onClick={handleClick}
      role="option"
      aria-selected={isSelected}
      aria-label={`Conversation with ${displayName}${conversation.unreadCount > 0 ? `, ${conversation.unreadCount} unread` : ''}`}
      className={`w-full p-3 rounded-lg text-left outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary-600)] ${
        isSelected && !isSelectionMode
          ? 'bg-[var(--primary-600)] text-white'
          : isChecked
            ? 'bg-red-50 dark:bg-red-900/20'
            : 'hover:bg-[var(--muted)]'
      }`}
    >
      <div className="flex items-start gap-3">
        {isSelectionMode && (
          <div className="flex-shrink-0 pt-0.5">
            {isChecked ? (
              <FiCheckSquare className="w-5 h-5 text-red-600" />
            ) : (
              <FiSquare className="w-5 h-5 text-[var(--muted-foreground)]" />
            )}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <p
              className={`font-medium truncate ${isSelected && !isSelectionMode ? 'text-white' : 'text-[var(--foreground)]'}`}
            >
              {displayName}
            </p>
            <span
              className={`text-xs ml-2 whitespace-nowrap ${isSelected && !isSelectionMode ? 'text-white/80' : 'text-[var(--muted-foreground)]'}`}
            >
              {formatConversationTime(conversation.lastMessageTime)}
            </span>
          </div>
          <p
            className={`text-sm truncate mt-1 ${isSelected && !isSelectionMode ? 'text-white/70' : 'text-[var(--muted-foreground)]'}`}
          >
            {getConversationPreview(conversation.lastMessage)}
          </p>
        </div>
        {!isSelectionMode && conversation.unreadCount > 0 && (
          <span className="ml-2 px-2 py-0.5 text-xs font-semibold rounded-full bg-[var(--coral)] text-white">
            {conversation.unreadCount}
          </span>
        )}
      </div>
    </button>
  );
});

export default ConversationItem;
