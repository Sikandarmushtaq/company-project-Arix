'use client';

/**
 * NotificationItem Components
 *
 * Individual notification rendering for missed calls, unread SMS/Group conversations,
 * and voicemail messages.
 *
 * @module components/layout/NotificationItem
 */

import React from 'react';
import {
  FiPhone,
  FiMessageSquare,
  FiVoicemail,
  FiClock,
  FiChevronRight,
  FiAlertCircle,
} from 'react-icons/fi';
import { useContactDisplayName } from '@/lib/hooks';
import { formatRelativeTime, formatDuration } from '@/lib/utils/formatting';
import type { Call } from '@/lib/api/services/calls.service';
import type { UnifiedConversation, Voicemail } from '@/lib/api';

/**
 * Notification item for missed calls
 */
export interface MissedCallItemProps {
  call: Call;
  onClick: (callId: number, caller: string) => void;
}

export const MissedCallItem = React.memo(function MissedCallItem({ call, onClick }: MissedCallItemProps) {
  // SSOT: Use contact lookup store for name resolution
  const displayName = useContactDisplayName(call.caller, call.contactName);

  return (
    <button
      onClick={() => onClick(call.id, call.caller)}
      className="group w-full p-3 hover:bg-gradient-to-r hover:from-red-50/80 hover:to-transparent dark:hover:from-red-950/30 dark:hover:to-transparent transition-all duration-200 text-left focus:outline-none focus:bg-red-50/50 dark:focus:bg-red-950/20"
      aria-label={`Missed call from ${displayName}, ${formatRelativeTime(call.startTime)}`}
    >
      <div className="flex items-center gap-3">
        {/* Avatar with gradient */}
        <div className="relative">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-red-400 to-red-600 flex items-center justify-center flex-shrink-0 shadow-lg shadow-red-500/20 group-hover:shadow-red-500/40 transition-shadow duration-200">
            <FiPhone className="w-5 h-5 text-white" aria-hidden="true" />
          </div>
          {/* Missed indicator dot */}
          <div className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-red-500 rounded-full border-2 border-[var(--card)]" />
        </div>

        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm text-[var(--foreground)] truncate group-hover:text-red-600 dark:group-hover:text-red-400 transition-colors">
            {displayName}
          </p>
          <div className="flex items-center gap-1.5 mt-1">
            <FiClock className="w-3 h-3 text-[var(--muted-foreground)]" aria-hidden="true" />
            <span className="text-xs text-[var(--muted-foreground)]">
              {formatRelativeTime(call.startTime)}
            </span>
          </div>
        </div>

        {/* Hover arrow */}
        <FiChevronRight
          className="w-4 h-4 text-[var(--muted-foreground)] opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all duration-200"
          aria-hidden="true"
        />
      </div>
    </button>
  );
});

MissedCallItem.displayName = 'MissedCallItem';

/**
 * Notification item for unread SMS/Group conversations
 */
export interface UnreadConversationItemProps {
  conversation: UnifiedConversation;
  onDirectClick: (phoneNumber: string) => void;
  onGroupClick: (groupId: number) => void;
}

export const UnreadConversationItem = React.memo(
  function UnreadConversationItem({ conversation, onDirectClick, onGroupClick }: UnreadConversationItemProps) {
    // SSOT: Use contact lookup store for name resolution (only for direct conversations)
    const contactDisplayName = useContactDisplayName(
      conversation.phoneNumber || '',
      conversation.contactName || undefined
    );

    // Use display name from unified conversation for groups, or contact lookup for direct
    const displayName = conversation.isGroup ? conversation.displayName : contactDisplayName;

    const handleClick = () => {
      if (conversation.isGroup && conversation.groupId) {
        onGroupClick(conversation.groupId);
      } else if (conversation.phoneNumber) {
        onDirectClick(conversation.phoneNumber);
      }
    };

    // Different colors for groups vs direct
    const isGroup = conversation.isGroup;
    const gradientFrom = isGroup ? 'from-purple-400' : 'from-blue-400';
    const gradientTo = isGroup ? 'to-purple-600' : 'to-blue-600';
    const shadowColor = isGroup ? 'shadow-purple-500/20' : 'shadow-black/20';
    const shadowHoverColor = isGroup
      ? 'group-hover:shadow-purple-500/40'
      : 'group-hover:shadow-black/40';
    const hoverBgFrom = isGroup ? 'hover:from-purple-50/80' : 'hover:from-blue-50/80';
    const darkHoverBgFrom = isGroup
      ? 'dark:hover:from-purple-950/30'
      : 'dark:hover:from-blue-950/30';
    const focusBg = isGroup ? 'focus:bg-purple-50/50' : 'focus:bg-blue-50/50';
    const darkFocusBg = isGroup ? 'dark:focus:bg-purple-950/20' : 'dark:focus:bg-blue-950/20';
    const textHoverColor = isGroup
      ? 'group-hover:text-purple-600 dark:group-hover:text-purple-400'
      : 'group-hover:text-blue-600 dark:group-hover:text-blue-400';
    const badgeBg = isGroup ? 'bg-purple-500' : 'bg-blue-500';

    return (
      <button
        onClick={handleClick}
        className={`group w-full p-3 hover:bg-gradient-to-r ${hoverBgFrom} hover:to-transparent ${darkHoverBgFrom} dark:hover:to-transparent transition-all duration-200 text-left focus:outline-none ${focusBg} ${darkFocusBg}`}
        aria-label={`${conversation.unreadCount} unread message${conversation.unreadCount > 1 ? 's' : ''} from ${displayName}${isGroup ? ' (group)' : ''}`}
      >
        <div className="flex items-center gap-3">
          {/* Avatar with gradient */}
          <div className="relative">
            <div
              className={`w-11 h-11 rounded-2xl bg-gradient-to-br ${gradientFrom} ${gradientTo} flex items-center justify-center flex-shrink-0 shadow-lg ${shadowColor} ${shadowHoverColor} transition-shadow duration-200`}
            >
              <FiMessageSquare className="w-5 h-5 text-white" aria-hidden="true" />
            </div>
            {/* Unread count badge */}
            {conversation.unreadCount > 0 && (
              <div
                className={`absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 ${badgeBg} text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-[var(--card)]`}
              >
                {conversation.unreadCount > 9 ? '9+' : conversation.unreadCount}
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <p
                className={`font-semibold text-sm text-[var(--foreground)] truncate ${textHoverColor} transition-colors`}
              >
                {displayName}
              </p>
              {isGroup && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 font-medium">
                  Group
                </span>
              )}
            </div>
            {conversation.lastMessageAt && (
              <div className="flex items-center gap-1.5 mt-1">
                <FiClock className="w-3 h-3 text-[var(--muted-foreground)]" aria-hidden="true" />
                <span className="text-xs text-[var(--muted-foreground)]">
                  {formatRelativeTime(conversation.lastMessageAt)}
                </span>
              </div>
            )}
          </div>

          {/* Hover arrow */}
          <FiChevronRight
            className="w-4 h-4 text-[var(--muted-foreground)] opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all duration-200"
            aria-hidden="true"
          />
        </div>
      </button>
    );
  }
);

UnreadConversationItem.displayName = 'UnreadConversationItem';

/**
 * Notification item for voicemail messages
 */
export interface VoicemailNotificationItemProps {
  voicemail: Voicemail;
  onClick: () => void;
}

export const VoicemailNotificationItem = React.memo(
  function VoicemailNotificationItem({ voicemail, onClick }: VoicemailNotificationItemProps) {
    const apiName = voicemail.callerIdName !== 'Unknown' ? voicemail.callerIdName : undefined;
    const displayName = useContactDisplayName(voicemail.callerIdNum, apiName);

    return (
      <button
        onClick={onClick}
        className="group w-full p-3 hover:bg-gradient-to-r hover:from-green-50/80 hover:to-transparent dark:hover:from-green-950/30 dark:hover:to-transparent transition-all duration-200 text-left focus:outline-none focus:bg-green-50/50 dark:focus:bg-green-950/20"
        aria-label={`Voicemail from ${displayName}, ${formatDuration(voicemail.duration)}, ${formatRelativeTime(new Date(voicemail.origTime))}`}
      >
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center flex-shrink-0 shadow-lg shadow-green-500/20 group-hover:shadow-green-500/40 transition-shadow duration-200">
              <FiVoicemail className="w-5 h-5 text-white" aria-hidden="true" />
            </div>
            <div className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-[var(--card)]" />
          </div>

          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm text-[var(--foreground)] truncate group-hover:text-green-600 dark:group-hover:text-green-400 transition-colors">
              {displayName}
            </p>
            <div className="flex items-center gap-1.5 mt-1">
              <FiClock className="w-3 h-3 text-[var(--muted-foreground)]" aria-hidden="true" />
              <span className="text-xs text-[var(--muted-foreground)]">
                {formatDuration(voicemail.duration)}
              </span>
              <span className="text-xs text-[var(--muted-foreground)]">
                {formatRelativeTime(new Date(voicemail.origTime))}
              </span>
            </div>
          </div>

          <FiChevronRight
            className="w-4 h-4 text-[var(--muted-foreground)] opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all duration-200"
            aria-hidden="true"
          />
        </div>
      </button>
    );
  }
);

VoicemailNotificationItem.displayName = 'VoicemailNotificationItem';

/**
 * Loading skeleton for notification items
 */
export function NotificationSkeleton() {
  return (
    <div className="p-3">
      <div className="flex items-center gap-3 animate-pulse">
        <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[var(--muted)] to-[var(--muted)]/60" />
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-[var(--muted)] rounded-full w-3/4" />
          <div className="h-3 bg-[var(--muted)]/60 rounded-full w-1/2" />
        </div>
      </div>
    </div>
  );
}

/**
 * Error state component
 */
export interface ErrorStateProps {
  message: string;
  onRetry?: () => void;
}

export function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <div className="p-8 text-center">
      <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-red-100 to-red-50 dark:from-red-900/30 dark:to-red-950/20 flex items-center justify-center mx-auto mb-3">
        <FiAlertCircle className="w-6 h-6 text-red-500" aria-hidden="true" />
      </div>
      <p className="text-sm text-[var(--muted-foreground)] mb-3">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="text-sm text-[var(--foreground)] hover:text-[var(--foreground)] font-medium px-4 py-1.5 rounded-full bg-[var(--primary-50)] dark:bg-[var(--primary-950)] hover:bg-[var(--primary-100)] dark:hover:bg-[var(--primary-900)] transition-colors"
        >
          Try again
        </button>
      )}
    </div>
  );
}

/**
 * Empty state component
 */
export interface EmptyStateProps {
  icon: React.ReactNode;
  message: string;
  color: 'red' | 'blue' | 'green';
}

export function EmptyState({ icon, message, color }: EmptyStateProps) {
  const colorMap = {
    red: {
      from: 'from-red-100 to-red-50 dark:from-red-900/20 dark:to-red-950/10',
      text: 'text-red-400',
    },
    blue: {
      from: 'from-blue-100 to-blue-50 dark:from-blue-900/20 dark:to-blue-950/10',
      text: 'text-blue-400',
    },
    green: {
      from: 'from-green-100 to-green-50 dark:from-green-900/20 dark:to-green-950/10',
      text: 'text-green-400',
    },
  };
  const c = colorMap[color];

  return (
    <div className="p-8 text-center">
      <div
        className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${c.from} flex items-center justify-center mx-auto mb-3 opacity-60`}
      >
        <div className={`w-7 h-7 ${c.text}`}>{icon}</div>
      </div>
      <p className="text-sm text-[var(--muted-foreground)]">{message}</p>
    </div>
  );
}
