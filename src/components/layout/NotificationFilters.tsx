'use client';

/**
 * NotificationFilters Component
 *
 * Tab buttons for switching between notification types
 * (missed calls, SMS, voicemail) with unread badges.
 *
 * @module components/layout/NotificationFilters
 */

import React, { useCallback } from 'react';
import {
  FiPhone,
  FiMessageSquare,
  FiVoicemail,
} from 'react-icons/fi';
import type { TabType } from './NotificationList';

const TABS: TabType[] = ['calls', 'sms', 'voicemail'];

interface NotificationFiltersProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  dropdownId: string;
  unreadCallCount: number;
  totalUnreadMessages: number;
  unreadVoicemailCount: number;
  firstFocusableRef: React.RefObject<HTMLButtonElement | null>;
}

export function NotificationFilters({
  activeTab,
  onTabChange,
  dropdownId,
  unreadCallCount,
  totalUnreadMessages,
  unreadVoicemailCount,
  firstFocusableRef,
}: NotificationFiltersProps) {
  const callsPanelId = `${dropdownId}-calls-panel`;
  const smsPanelId = `${dropdownId}-sms-panel`;
  const voicemailPanelId = `${dropdownId}-voicemail-panel`;

  // Keyboard navigation for tabs (3 tabs: left/right cycling)
  const handleTabKeyDown = useCallback((event: React.KeyboardEvent, currentTab: TabType) => {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      const currentIndex = TABS.indexOf(currentTab);
      const nextIndex =
        event.key === 'ArrowRight'
          ? (currentIndex + 1) % TABS.length
          : (currentIndex - 1 + TABS.length) % TABS.length;
      onTabChange(TABS[nextIndex]);
    }
  }, [onTabChange]);

  return (
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
        onClick={() => onTabChange('calls')}
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
        onClick={() => onTabChange('sms')}
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

      {/* Voicemail Tab */}
      <button
        role="tab"
        id={`${dropdownId}-voicemail-tab`}
        aria-selected={activeTab === 'voicemail'}
        aria-controls={voicemailPanelId}
        tabIndex={activeTab === 'voicemail' ? 0 : -1}
        onClick={() => onTabChange('voicemail')}
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
  );
}
