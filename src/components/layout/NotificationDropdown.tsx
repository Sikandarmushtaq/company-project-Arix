'use client';

/**
 * NotificationDropdown Component
 *
 * Modern notification dropdown for the phone interface.
 * Shows missed calls, unread SMS conversations, and new voicemails
 * with smooth animations and polished UI.
 *
 * @module components/layout/NotificationDropdown
 */

import React, { useState, useRef, useEffect, useCallback, useMemo, useId } from 'react';
import { useRouter } from 'next/navigation';
import {
  FiBell,
  FiPhone,
  FiMessageSquare,
  FiVoicemail,
  FiClock,
  FiCheck,
  FiAlertCircle,
  FiLoader,
  FiChevronRight,
} from 'react-icons/fi';
import { FaWhatsapp } from 'react-icons/fa';
import { Button } from '@/components/ui';
import {
  useUnreadCallCount,
  useUnreadCalls,
  useUnifiedConversations,
  useMarkCallsAsRead,
  useMarkMessagesAsRead,
  useMarkGroupAsRead,
  useContactDisplayName,
  useVoicemailCounts,
  useUnreadVoicemails,
  useMarkAllVoicemailsAsRead,
  useWaUnreadCount,
  useWaConversationsPaginated,
} from '@/lib/hooks';
import { formatRelativeTime, formatDuration } from '@/lib/utils/formatting';
import { formatPhoneNumber } from '@/lib/utils/phone';
import type { Call } from '@/lib/api/services/calls.service';
import type { UnifiedConversation, Voicemail } from '@/lib/api';
import { useGlobalWaCall } from '@/lib/providers/WaCallProvider';
import { useQuery } from '@tanstack/react-query';
import { waCallService } from '@/lib/api/services/waCall.service';
import type { WaCallRecord } from '@/lib/whatsapp-call/types';

/**
 * Notification item for missed calls
 */
interface MissedCallItemProps {
  call: Call;
  onClick: (callId: number, caller: string) => void;
}

const MissedCallItem: React.FC<MissedCallItemProps> = React.memo(({ call, onClick }) => {
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
interface UnreadConversationItemProps {
  conversation: UnifiedConversation;
  onDirectClick: (phoneNumber: string) => void;
  onGroupClick: (groupId: number) => void;
}

const UnreadConversationItem: React.FC<UnreadConversationItemProps> = React.memo(
  ({ conversation, onDirectClick, onGroupClick }) => {
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
interface VoicemailNotificationItemProps {
  voicemail: Voicemail;
  onClick: () => void;
}

const VoicemailNotificationItem: React.FC<VoicemailNotificationItemProps> = React.memo(
  ({ voicemail, onClick }) => {
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
const NotificationSkeleton: React.FC = () => (
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

/**
 * Error state component
 */
interface ErrorStateProps {
  message: string;
  onRetry?: () => void;
}

const ErrorState: React.FC<ErrorStateProps> = ({ message, onRetry }) => (
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

/**
 * Empty state component
 */
interface EmptyStateProps {
  icon: React.ReactNode;
  message: string;
  color: 'red' | 'blue' | 'green';
}

const EmptyState: React.FC<EmptyStateProps> = ({ icon, message, color }) => {
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
};

/**
 * Tab types
 */
type TabType = 'calls' | 'sms' | 'whatsapp' | 'voicemail';

const TABS: TabType[] = ['calls', 'sms', 'whatsapp', 'voicemail'];

/**
 * NotificationDropdown Component
 */
export const NotificationDropdown: React.FC = () => {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('calls');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const firstFocusableRef = useRef<HTMLButtonElement>(null);

  // Generate unique IDs for accessibility
  const dropdownId = useId();
  const callsPanelId = `${dropdownId}-calls-panel`;
  const smsPanelId = `${dropdownId}-sms-panel`;
  const waPanelId = `${dropdownId}-whatsapp-panel`;
  const voicemailPanelId = `${dropdownId}-voicemail-panel`;

  // Fetch counts (always active for badge)
  const { data: unreadCallCount = 0 } = useUnreadCallCount();
  const { data: voicemailCounts } = useVoicemailCounts();
  const unreadVoicemailCount = voicemailCounts?.unread || 0;
  const { data: waUnreadCount = 0 } = useWaUnreadCount();
  const waUnread = typeof waUnreadCount === 'number' ? waUnreadCount : 0;

  // WA missed calls (unread only)
  const { data: waCallHistory } = useQuery({
    queryKey: ['wa-calls', 'unread-missed'],
    queryFn: async () => {
      const result = await waCallService.getHistory(20, 0);
      // Unread INBOUND missed calls only — an outbound call is never "missed"
      // (it's ended / no-answer), so guard on direction too (defense-in-depth).
      return result.calls.filter(
        (c: WaCallRecord & { read?: boolean | number }) =>
          c.status === 'missed' && c.direction === 'inbound' && !c.read
      );
    },
    staleTime: 30_000,
  });
  const waMissedCalls = waCallHistory ?? [];
  const waMissedCount = waMissedCalls.length;

  // Fetch unread voicemails
  const {
    data: unreadVoicemails = [],
    isLoading: isLoadingVoicemails,
    isError: isErrorVoicemails,
    refetch: refetchVoicemails,
  } = useUnreadVoicemails(5);

  // Fetch actual unread items
  const {
    data: missedCalls = [],
    isLoading: isLoadingCalls,
    isError: isErrorCalls,
    refetch: refetchCalls,
  } = useUnreadCalls(5);

  // Use unified conversations (direct + groups) and filter for unread only
  const {
    data: unifiedData,
    isLoading: isLoadingMessages,
    isError: isErrorMessages,
    refetch: refetchMessages,
  } = useUnifiedConversations({ limit: 50 }); // Fetch more to filter

  // Filter to only unread conversations and limit to 5
  const unreadConversations = useMemo(() => {
    if (!unifiedData?.conversations) return [];
    return unifiedData.conversations.filter((conv) => conv.unreadCount > 0).slice(0, 5);
  }, [unifiedData?.conversations]);

  // Total unread messages across all conversations (professional standard: WhatsApp, Slack, iMessage)
  const totalUnreadMessages = useMemo(() => {
    if (!unifiedData?.conversations) return 0;
    return unifiedData.conversations
      .filter((conv) => {
        const count =
          typeof conv.unreadCount === 'string'
            ? parseInt(conv.unreadCount, 10)
            : conv.unreadCount || 0;
        return count > 0;
      })
      .reduce((total, conv) => {
        const count =
          typeof conv.unreadCount === 'string'
            ? parseInt(conv.unreadCount, 10)
            : conv.unreadCount || 0;
        return total + count;
      }, 0);
  }, [unifiedData?.conversations]);

  // Mutations
  const markCallsAsReadMutation = useMarkCallsAsRead();
  const markMessagesAsReadMutation = useMarkMessagesAsRead();
  const markGroupAsReadMutation = useMarkGroupAsRead();
  const markAllVoicemailsAsReadMutation = useMarkAllVoicemailsAsRead();

  // Calculate total unread count (calls + unified messages + WhatsApp + voicemails)
  const totalCount = useMemo(() => {
    const calls =
      typeof unreadCallCount === 'number'
        ? unreadCallCount
        : parseInt(String(unreadCallCount || 0), 10) || 0;
    return calls + totalUnreadMessages + waUnread + waMissedCount + unreadVoicemailCount;
  }, [unreadCallCount, totalUnreadMessages, waUnread, waMissedCount, unreadVoicemailCount]);

  // Format badge text - just show the number, no leading zeros
  const badgeText = useMemo(() => {
    if (totalCount <= 0) return '';
    if (totalCount > 99) return '99+';
    return String(totalCount);
  }, [totalCount]);

  const hasItems = totalCount > 0;

  // Reset to calls tab when dropdown opens (calls tab is always default)
  useEffect(() => {
    if (isOpen) {
      setActiveTab('calls');
    }
  }, [isOpen]);

  // Focus management when dropdown opens
  useEffect(() => {
    if (isOpen && firstFocusableRef.current) {
      const timer = setTimeout(() => {
        firstFocusableRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Close on escape key
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  // Handlers
  const handleToggle = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  const handleCallClick = useCallback(
    (callId: number, caller: string) => {
      setIsOpen(false);
      // Mark the specific call as read
      markCallsAsReadMutation.mutate([callId]);
      router.push(`/phone/history?search=${encodeURIComponent(caller)}&status=missed`);
    },
    [router, markCallsAsReadMutation]
  );

  const handleSmsClick = useCallback(
    (phoneNumber: string) => {
      setIsOpen(false);
      markMessagesAsReadMutation.mutate(phoneNumber);
      router.push(`/phone/messages?phone=${encodeURIComponent(phoneNumber)}`);
    },
    [router, markMessagesAsReadMutation]
  );

  const handleGroupClick = useCallback(
    (groupId: number) => {
      setIsOpen(false);
      markGroupAsReadMutation.mutate(groupId);
      router.push(`/phone/messages?group=${groupId}`);
    },
    [router, markGroupAsReadMutation]
  );

  const handleVoicemailClick = useCallback(() => {
    setIsOpen(false);
    router.push('/phone/voicemail');
  }, [router]);

  const handleClearAllCalls = useCallback(() => {
    markCallsAsReadMutation.mutate(undefined);
  }, [markCallsAsReadMutation]);

  const handleClearAllVoicemails = useCallback(() => {
    markAllVoicemailsAsReadMutation.mutate();
  }, [markAllVoicemailsAsReadMutation]);

  const handleViewAllCalls = useCallback(() => {
    setIsOpen(false);
    router.push('/phone/history?status=missed');
  }, [router]);

  const handleViewAllMessages = useCallback(() => {
    setIsOpen(false);
    router.push('/phone/messages');
  }, [router]);

  const handleViewAllVoicemails = useCallback(() => {
    setIsOpen(false);
    router.push('/phone/voicemail');
  }, [router]);

  const handleTabChange = useCallback((tab: TabType) => {
    setActiveTab(tab);
  }, []);

  // Keyboard navigation for tabs (3 tabs: left/right cycling)
  const handleTabKeyDown = useCallback((event: React.KeyboardEvent, currentTab: TabType) => {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      const currentIndex = TABS.indexOf(currentTab);
      const nextIndex =
        event.key === 'ArrowRight'
          ? (currentIndex + 1) % TABS.length
          : (currentIndex - 1 + TABS.length) % TABS.length;
      setActiveTab(TABS[nextIndex]);
    }
  }, []);

  // View all handler based on active tab
  const handleViewAllWhatsApp = useCallback(() => {
    router.push('/phone/whatsapp');
    setIsOpen(false);
  }, [router]);

  const handleViewAll = useCallback(() => {
    if (activeTab === 'calls') handleViewAllCalls();
    else if (activeTab === 'sms') handleViewAllMessages();
    else if (activeTab === 'whatsapp') handleViewAllWhatsApp();
    else handleViewAllVoicemails();
  }, [
    activeTab,
    handleViewAllCalls,
    handleViewAllMessages,
    handleViewAllWhatsApp,
    handleViewAllVoicemails,
  ]);

  const viewAllLabel =
    activeTab === 'calls'
      ? 'missed calls'
      : activeTab === 'sms'
        ? 'messages'
        : activeTab === 'whatsapp'
          ? 'WhatsApp messages'
          : 'voicemails';

  // Render loading state
  const renderLoading = () => (
    <>
      <NotificationSkeleton />
      <NotificationSkeleton />
      <NotificationSkeleton />
    </>
  );

  // Render calls content
  const renderCallsContent = () => {
    if (isLoadingCalls) return renderLoading();

    if (isErrorCalls) {
      return <ErrorState message="Failed to load missed calls" onRetry={() => refetchCalls()} />;
    }

    if (missedCalls.length === 0) {
      return (
        <EmptyState
          icon={<FiPhone className="w-full h-full" />}
          message="No missed calls"
          color="red"
        />
      );
    }

    return (
      <div role="list">
        {missedCalls.map((call) => (
          <MissedCallItem key={call.id} call={call} onClick={handleCallClick} />
        ))}
      </div>
    );
  };

  // Render SMS content
  const renderSmsContent = () => {
    if (isLoadingMessages) return renderLoading();

    if (isErrorMessages) {
      return <ErrorState message="Failed to load messages" onRetry={() => refetchMessages()} />;
    }

    if (unreadConversations.length === 0) {
      return (
        <EmptyState
          icon={<FiMessageSquare className="w-full h-full" />}
          message="No unread messages"
          color="blue"
        />
      );
    }

    return (
      <div role="list">
        {unreadConversations.map((conversation) => (
          <UnreadConversationItem
            key={conversation.isGroup ? `group-${conversation.groupId}` : conversation.phoneNumber}
            conversation={conversation}
            onDirectClick={handleSmsClick}
            onGroupClick={handleGroupClick}
          />
        ))}
      </div>
    );
  };

  // Render voicemail content
  const renderVoicemailContent = () => {
    if (isLoadingVoicemails) return renderLoading();

    if (isErrorVoicemails) {
      return <ErrorState message="Failed to load voicemails" onRetry={() => refetchVoicemails()} />;
    }

    if (unreadVoicemails.length === 0) {
      return (
        <EmptyState
          icon={<FiVoicemail className="w-full h-full" />}
          message="No new voicemails"
          color="green"
        />
      );
    }

    return (
      <div role="list">
        {unreadVoicemails.map((vm) => (
          <VoicemailNotificationItem key={vm.id} voicemail={vm} onClick={handleVoicemailClick} />
        ))}
      </div>
    );
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button Trigger */}
      <Button
        ref={triggerRef}
        variant="ghost"
        size="icon"
        className="relative"
        aria-label={hasItems ? `${totalCount} unread notifications` : 'No unread notifications'}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        aria-controls={isOpen ? dropdownId : undefined}
        onClick={handleToggle}
      >
        <FiBell className="w-5 h-5" aria-hidden="true" />
        {hasItems && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-gradient-to-r from-red-500 to-pink-500 text-white text-xs font-bold rounded-full flex items-center justify-center shadow-lg shadow-red-500/30 animate-in fade-in zoom-in duration-200">
            {badgeText}
          </span>
        )}
      </Button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div
          id={dropdownId}
          className="fixed left-2 right-2 top-[4.5rem] sm:absolute sm:left-auto sm:right-0 sm:top-auto sm:mt-2 sm:w-[360px] bg-[var(--card)] border border-[var(--border)]/50 rounded-2xl shadow-2xl shadow-black/10 dark:shadow-black/30 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 backdrop-blur-xl"
          role="dialog"
          aria-label="Notifications"
          aria-modal="true"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3.5 border-b border-[var(--border)]/50 bg-gradient-to-r from-[var(--muted)]/80 to-[var(--muted)]/40">
            <h2 className="font-semibold text-[var(--foreground)]">Notifications</h2>
            {activeTab === 'calls' && unreadCallCount > 0 && (
              <button
                onClick={handleClearAllCalls}
                disabled={markCallsAsReadMutation.isPending}
                className="text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)] flex items-center gap-1.5 px-2.5 py-1 rounded-full hover:bg-[var(--muted)] disabled:opacity-50 transition-all"
                aria-label="Mark all calls as read"
              >
                {markCallsAsReadMutation.isPending ? (
                  <FiLoader className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                ) : (
                  <FiCheck className="w-3.5 h-3.5" aria-hidden="true" />
                )}
                <span>Mark all read</span>
              </button>
            )}
            {activeTab === 'voicemail' && unreadVoicemailCount > 0 && (
              <button
                onClick={handleClearAllVoicemails}
                disabled={markAllVoicemailsAsReadMutation.isPending}
                className="text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)] flex items-center gap-1.5 px-2.5 py-1 rounded-full hover:bg-[var(--muted)] disabled:opacity-50 transition-all"
                aria-label="Mark all voicemails as read"
              >
                {markAllVoicemailsAsReadMutation.isPending ? (
                  <FiLoader className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                ) : (
                  <FiCheck className="w-3.5 h-3.5" aria-hidden="true" />
                )}
                <span>Mark all read</span>
              </button>
            )}
          </div>

          {/* Tabs */}
          <div
            role="tablist"
            aria-label="Notification types"
            className="flex p-1.5 gap-1 bg-[var(--muted)]/30"
          >
            {/* Calls Tab */}
            <button
              ref={firstFocusableRef}
              role="tab"
              id={`${dropdownId}-calls-tab`}
              aria-selected={activeTab === 'calls'}
              aria-controls={callsPanelId}
              tabIndex={activeTab === 'calls' ? 0 : -1}
              onClick={() => handleTabChange('calls')}
              onKeyDown={(e) => handleTabKeyDown(e, 'calls')}
              className={`flex-1 px-2 py-2 text-sm font-medium rounded-xl flex items-center justify-center gap-1.5 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[var(--primary-500)] focus:ring-offset-1 ${
                activeTab === 'calls'
                  ? 'bg-[var(--card)] text-[var(--foreground)] shadow-sm'
                  : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--card)]/50'
              }`}
            >
              <FiPhone
                className={`w-3.5 h-3.5 ${activeTab === 'calls' ? 'text-red-500' : ''}`}
                aria-hidden="true"
              />
              <span>Missed</span>
              {unreadCallCount > 0 && (
                <span
                  className={`text-xs px-1.5 py-0.5 rounded-full ${
                    activeTab === 'calls'
                      ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
                      : 'bg-[var(--muted)] text-[var(--muted-foreground)]'
                  }`}
                >
                  {unreadCallCount}
                </span>
              )}
            </button>

            {/* SMS Tab */}
            <button
              role="tab"
              id={`${dropdownId}-sms-tab`}
              aria-selected={activeTab === 'sms'}
              aria-controls={smsPanelId}
              tabIndex={activeTab === 'sms' ? 0 : -1}
              onClick={() => handleTabChange('sms')}
              onKeyDown={(e) => handleTabKeyDown(e, 'sms')}
              className={`flex-1 px-2 py-2 text-sm font-medium rounded-xl flex items-center justify-center gap-1.5 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[var(--primary-500)] focus:ring-offset-1 ${
                activeTab === 'sms'
                  ? 'bg-[var(--card)] text-[var(--foreground)] shadow-sm'
                  : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--card)]/50'
              }`}
            >
              <FiMessageSquare
                className={`w-3.5 h-3.5 ${activeTab === 'sms' ? 'text-blue-500' : ''}`}
                aria-hidden="true"
              />
              <span>SMS</span>
              {totalUnreadMessages > 0 && (
                <span
                  className={`text-xs px-1.5 py-0.5 rounded-full ${
                    activeTab === 'sms'
                      ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                      : 'bg-[var(--muted)] text-[var(--muted-foreground)]'
                  }`}
                >
                  {totalUnreadMessages > 99 ? '99+' : totalUnreadMessages}
                </span>
              )}
            </button>

            {/* WhatsApp Tab */}
            <button
              role="tab"
              id={`${dropdownId}-whatsapp-tab`}
              aria-selected={activeTab === 'whatsapp'}
              aria-controls={waPanelId}
              tabIndex={activeTab === 'whatsapp' ? 0 : -1}
              onClick={() => handleTabChange('whatsapp')}
              onKeyDown={(e) => handleTabKeyDown(e, 'whatsapp')}
              className={`flex-1 px-2 py-2 text-sm font-medium rounded-xl flex items-center justify-center gap-1.5 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[var(--primary-500)] focus:ring-offset-1 ${
                activeTab === 'whatsapp'
                  ? 'bg-[var(--card)] text-[var(--foreground)] shadow-sm'
                  : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--card)]/50'
              }`}
            >
              <FaWhatsapp
                className={`w-3.5 h-3.5 ${activeTab === 'whatsapp' ? 'text-green-500' : ''}`}
                aria-hidden="true"
              />
              <span>WA</span>
              {waUnread + waMissedCount > 0 && (
                <span
                  className={`text-xs px-1.5 py-0.5 rounded-full ${
                    activeTab === 'whatsapp'
                      ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
                      : 'bg-[var(--muted)] text-[var(--muted-foreground)]'
                  }`}
                >
                  {waUnread + waMissedCount > 99 ? '99+' : waUnread + waMissedCount}
                </span>
              )}
            </button>

            {/* Voicemail Tab */}
            <button
              role="tab"
              id={`${dropdownId}-voicemail-tab`}
              aria-selected={activeTab === 'voicemail'}
              aria-controls={voicemailPanelId}
              tabIndex={activeTab === 'voicemail' ? 0 : -1}
              onClick={() => handleTabChange('voicemail')}
              onKeyDown={(e) => handleTabKeyDown(e, 'voicemail')}
              className={`flex-1 px-2 py-2 text-sm font-medium rounded-xl flex items-center justify-center gap-1.5 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[var(--primary-500)] focus:ring-offset-1 ${
                activeTab === 'voicemail'
                  ? 'bg-[var(--card)] text-[var(--foreground)] shadow-sm'
                  : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--card)]/50'
              }`}
            >
              <FiVoicemail
                className={`w-3.5 h-3.5 ${activeTab === 'voicemail' ? 'text-green-500' : ''}`}
                aria-hidden="true"
              />
              <span>VM</span>
              {unreadVoicemailCount > 0 && (
                <span
                  className={`text-xs px-1.5 py-0.5 rounded-full ${
                    activeTab === 'voicemail'
                      ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
                      : 'bg-[var(--muted)] text-[var(--muted-foreground)]'
                  }`}
                >
                  {unreadVoicemailCount > 99 ? '99+' : unreadVoicemailCount}
                </span>
              )}
            </button>
          </div>

          {/* Tab Panels */}
          <div className="max-h-[320px] overflow-y-auto">
            {/* Calls Panel */}
            <div
              role="tabpanel"
              id={callsPanelId}
              aria-labelledby={`${dropdownId}-calls-tab`}
              hidden={activeTab !== 'calls'}
              tabIndex={0}
            >
              {activeTab === 'calls' && renderCallsContent()}
            </div>

            {/* SMS Panel */}
            <div
              role="tabpanel"
              id={smsPanelId}
              aria-labelledby={`${dropdownId}-sms-tab`}
              hidden={activeTab !== 'sms'}
              tabIndex={0}
            >
              {activeTab === 'sms' && renderSmsContent()}
            </div>

            {/* WhatsApp Panel */}
            <div
              role="tabpanel"
              id={waPanelId}
              aria-labelledby={`${dropdownId}-whatsapp-tab`}
              hidden={activeTab !== 'whatsapp'}
              tabIndex={0}
            >
              {activeTab === 'whatsapp' && (
                <div className="p-3 space-y-2">
                  {/* WA Missed Calls */}
                  {waMissedCalls.length > 0 && (
                    <>
                      <p className="text-xs font-medium text-[var(--muted-foreground)] px-1 mb-1">
                        Missed Calls
                      </p>
                      {waMissedCalls.slice(0, 5).map((call: WaCallRecord) => (
                        <button
                          key={call.id}
                          onClick={() => {
                            router.push('/phone/whatsapp-calls');
                            setIsOpen(false);
                          }}
                          className="w-full p-2.5 rounded-xl hover:bg-red-500/5 transition-colors text-left flex items-center gap-3"
                        >
                          <div className="w-9 h-9 rounded-full bg-red-500/10 flex items-center justify-center flex-shrink-0">
                            <FiPhone className="w-4 h-4 text-red-500" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">
                              {call.customerName || formatPhoneNumber(call.customerNumber)}
                            </p>
                            <p className="text-xs text-red-500">
                              Missed call ·{' '}
                              {call.startedAt ? formatRelativeTime(call.startedAt) : 'Just now'}
                            </p>
                          </div>
                          <FaWhatsapp className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                        </button>
                      ))}
                    </>
                  )}

                  {/* WA Unread Messages */}
                  {waUnread > 0 && (
                    <>
                      {waMissedCalls.length > 0 && (
                        <p className="text-xs font-medium text-[var(--muted-foreground)] px-1 mt-2 mb-1">
                          Messages
                        </p>
                      )}
                      <button
                        onClick={handleViewAllWhatsApp}
                        className="w-full p-2.5 rounded-xl bg-green-500/10 hover:bg-green-500/20 transition-colors text-left"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
                            <FaWhatsapp className="w-5 h-5 text-green-500" />
                          </div>
                          <div>
                            <p className="text-sm font-medium">
                              {waUnread} unread message{waUnread !== 1 ? 's' : ''}
                            </p>
                            <p className="text-xs text-[var(--muted-foreground)]">
                              Tap to view conversations
                            </p>
                          </div>
                          <FiChevronRight className="w-4 h-4 text-[var(--muted-foreground)] ml-auto" />
                        </div>
                      </button>
                    </>
                  )}

                  {/* Empty state */}
                  {waMissedCalls.length === 0 && waUnread === 0 && (
                    <div className="p-6 text-center">
                      <FaWhatsapp className="w-8 h-8 text-green-500/30 mx-auto mb-2" />
                      <p className="text-sm text-[var(--muted-foreground)]">
                        No missed calls or unread messages
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Voicemail Panel */}
            <div
              role="tabpanel"
              id={voicemailPanelId}
              aria-labelledby={`${dropdownId}-voicemail-tab`}
              hidden={activeTab !== 'voicemail'}
              tabIndex={0}
            >
              {activeTab === 'voicemail' && renderVoicemailContent()}
            </div>
          </div>

          {/* Footer */}
          <div className="border-t border-[var(--border)]/50 p-2 bg-gradient-to-r from-[var(--muted)]/40 to-transparent">
            <button
              onClick={handleViewAll}
              className="w-full text-center text-sm font-medium text-[var(--foreground)] hover:text-[var(--foreground)] py-2.5 rounded-xl hover:bg-[var(--primary-50)] dark:hover:bg-[var(--primary-950)] transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[var(--primary-500)]"
            >
              View all {viewAllLabel}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationDropdown;
