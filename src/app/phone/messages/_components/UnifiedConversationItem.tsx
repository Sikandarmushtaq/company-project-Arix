'use client';

import React, { useCallback } from 'react';
import { FiCheck, FiUsers, FiMessageCircle, FiSend } from 'react-icons/fi';
import { useContactDisplayName } from '@/lib/hooks';
import { formatConversationTime } from '@/lib/utils/datetime';
import { getConversationPreview } from './utils';
import { GenericAvatar } from '@/components/phone/chrome/avatarUtils';
import type { UnifiedConversation } from '@/lib/api';

/**
 * Group membership info for a direct conversation
 * Shown as a subtle badge — both 1-1 and group chat work simultaneously
 */
export interface GroupMembershipInfo {
  groupId: number;
  groupName: string;
  groupUuid: string;
}

interface UnifiedConversationItemProps {
  conversation: UnifiedConversation;
  isSelected: boolean;
  isSelectionMode: boolean;
  isChecked: boolean;
  onClick: () => void;
  onToggleSelect: () => void;
  /** If this contact is also in a group (shown as subtle badge) */
  groupMembership?: GroupMembershipInfo;
}

/**
 * Unified conversation list item - supports both direct and group conversations
 * Memoized for performance
 */
export const UnifiedConversationItem = React.memo(function UnifiedConversationItem({
  conversation,
  isSelected,
  isSelectionMode,
  isChecked,
  onClick,
  onToggleSelect,
  groupMembership,
}: UnifiedConversationItemProps) {
  // For direct conversations, use contact lookup
  // For groups, use the group name directly
  const contactDisplayName = useContactDisplayName(
    conversation.phoneNumber || '',
    conversation.contactName
  );

  const displayName = conversation.isGroup ? conversation.displayName : contactDisplayName;

  const handleClick = useCallback(() => {
    if (isSelectionMode) {
      onToggleSelect();
    } else {
      onClick();
    }
  }, [isSelectionMode, onClick, onToggleSelect]);

  const unread = conversation.unreadCount > 0;

  return (
    <button
      onClick={handleClick}
      role="option"
      aria-selected={isSelected}
      aria-label={`${conversation.isGroup ? 'Group' : 'Conversation with'} ${displayName}${groupMembership ? ` (also in group ${groupMembership.groupName})` : ''}${unread ? `, ${conversation.unreadCount} unread` : ''}`}
      className={`group w-full flex items-center gap-3 px-4 py-[5px] text-left border-b border-[var(--border)]/60 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--primary-500)] ${
        (isSelected && !isSelectionMode) || isChecked
          ? 'bg-[var(--primary-50)] dark:bg-[var(--primary-900)]/20'
          : 'hover:bg-[var(--muted)]/60'
      }`}
    >
      {/* selection checkbox — only in selection mode; otherwise the avatar sits
          flush-left against the row's 16px padding to match RingCentral. */}
      {isSelectionMode && (
        <span className={`w-5 h-5 rounded border-2 grid place-items-center shrink-0 ${isChecked ? 'bg-[var(--primary-600)] border-[var(--border)]' : 'border-[var(--border)]'}`}>
          {isChecked && <FiCheck className="w-3 h-3 text-white" />}
        </span>
      )}

      {/* avatar — colored initials for direct, group glyph for groups; unread
          shows as a small corner dot so the avatar can stay flush-left. */}
      <span className="relative shrink-0">
        {conversation.isGroup ? (
          <div className="w-9 h-9 rounded-full grid place-items-center bg-[var(--primary-100)] dark:bg-[var(--primary-900)] text-[var(--foreground)]">
            <FiUsers className="w-[18px] h-[18px]" />
          </div>
        ) : (
          <GenericAvatar name={displayName} number={conversation.phoneNumber || ''} size={36} />
        )}
        {!isSelectionMode && unread && (
          <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-[#f0912a] ring-2 ring-[var(--card)]" />
        )}
      </span>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className={`text-[14.5px] truncate text-[var(--foreground)] ${unread ? 'font-black' : 'font-bold'}`}>
            {displayName}
          </span>
          {conversation.isGroup && conversation.memberCount !== undefined && (
            <span className="text-xs whitespace-nowrap text-[var(--muted-foreground)]">
              ({conversation.memberCount})
            </span>
          )}
        </div>
        {!conversation.isGroup && groupMembership && (
          <p className="text-xs flex items-center gap-1 mt-0.5 text-[var(--muted-foreground)]">
            <FiUsers className="w-3 h-3" />
            {groupMembership.groupName}
          </p>
        )}
        {!conversation.isGroup && conversation.attributedCampaignId && (
          <p className="text-[11px] flex items-center gap-1 mt-0.5 text-[var(--foreground)]">
            <FiSend className="w-3 h-3 shrink-0" />
            <span className="truncate">
              {conversation.campaignIsOrigin ? 'From campaign' : 'Included in'}
              {conversation.attributedCampaignName ? `: ${conversation.attributedCampaignName}` : ''}
            </span>
          </p>
        )}
        <div className={`flex items-center gap-1 mt-0.5 min-w-0 ${unread ? 'text-[var(--foreground)]' : 'text-[var(--muted-foreground)]'}`}>
          <FiMessageCircle className="w-3 h-3 shrink-0 opacity-80" />
          <span className="text-[12.5px] truncate">
            {getConversationPreview(conversation.lastMessage, conversation.lastMessageMediaUrl)}
          </span>
        </div>
      </div>

      <div className="flex flex-col items-end gap-1 shrink-0">
        <span className="text-[12px] whitespace-nowrap text-[var(--muted-foreground)]">
          {conversation.lastMessageAt ? formatConversationTime(conversation.lastMessageAt) : ''}
        </span>
        {!isSelectionMode && unread && (
          <span className="min-w-[18px] h-[18px] px-1.5 grid place-items-center text-[11px] font-black rounded-full bg-[#4b5563] text-white">
            {conversation.unreadCount}
          </span>
        )}
      </div>
    </button>
  );
});

export default UnifiedConversationItem;
