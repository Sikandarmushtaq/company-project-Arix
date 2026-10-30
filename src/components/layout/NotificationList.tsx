'use client';

/**
 * NotificationList Component
 *
 * Scrollable notification list that renders content for each tab
 * (missed calls, unread SMS, voicemail).
 *
 * @module components/layout/NotificationList
 */

import React from 'react';
import {
  FiPhone,
  FiMessageSquare,
  FiVoicemail,
} from 'react-icons/fi';
import type { Call } from '@/lib/api/services/calls.service';
import type { UnifiedConversation, Voicemail } from '@/lib/api';
import {
  MissedCallItem,
  UnreadConversationItem,
  VoicemailNotificationItem,
  NotificationSkeleton,
  ErrorState,
  EmptyState,
} from './NotificationItem';

export type TabType = 'calls' | 'sms' | 'voicemail';

interface NotificationListProps {
  activeTab: TabType;
  dropdownId: string;
  // Calls
  missedCalls: Call[];
  isLoadingCalls: boolean;
  isErrorCalls: boolean;
  refetchCalls: () => void;
  onCallClick: (callId: number, caller: string) => void;
  // SMS
  unreadConversations: UnifiedConversation[];
  isLoadingMessages: boolean;
  isErrorMessages: boolean;
  refetchMessages: () => void;
  onSmsClick: (phoneNumber: string) => void;
  onGroupClick: (groupId: number) => void;
  // Voicemail
  unreadVoicemails: Voicemail[];
  isLoadingVoicemails: boolean;
  isErrorVoicemails: boolean;
  refetchVoicemails: () => void;
  onVoicemailClick: () => void;
}

export function NotificationList({
  activeTab,
  dropdownId,
  missedCalls,
  isLoadingCalls,
  isErrorCalls,
  refetchCalls,
  onCallClick,
  unreadConversations,
  isLoadingMessages,
  isErrorMessages,
  refetchMessages,
  onSmsClick,
  onGroupClick,
  unreadVoicemails,
  isLoadingVoicemails,
  isErrorVoicemails,
  refetchVoicemails,
  onVoicemailClick,
}: NotificationListProps) {
  const callsPanelId = `${dropdownId}-calls-panel`;
  const smsPanelId = `${dropdownId}-sms-panel`;
  const voicemailPanelId = `${dropdownId}-voicemail-panel`;

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
      return <ErrorState message="Failed to load missed calls" onRetry={refetchCalls} />;
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
          <MissedCallItem key={call.id} call={call} onClick={onCallClick} />
        ))}
      </div>
    );
  };

  // Render SMS content
  const renderSmsContent = () => {
    if (isLoadingMessages) return renderLoading();

    if (isErrorMessages) {
      return <ErrorState message="Failed to load messages" onRetry={refetchMessages} />;
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
            onDirectClick={onSmsClick}
            onGroupClick={onGroupClick}
          />
        ))}
      </div>
    );
  };

  // Render voicemail content
  const renderVoicemailContent = () => {
    if (isLoadingVoicemails) return renderLoading();

    if (isErrorVoicemails) {
      return <ErrorState message="Failed to load voicemails" onRetry={refetchVoicemails} />;
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
          <VoicemailNotificationItem key={vm.id} voicemail={vm} onClick={onVoicemailClick} />
        ))}
      </div>
    );
  };

  return (
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
  );
}
