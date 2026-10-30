'use client';

import React from 'react';
import { MessageInput, type SelectedFile } from './_components';
import { CompactPhoneSelector } from '@/components/phone';
import type { PhoneNumber } from '@/lib/types/auth';

// ============================================================================
// Types
// ============================================================================

export interface MessageComposerProps {
  // Group vs direct
  isGroupSelected: boolean;

  // Group messaging
  groupMessageText: string;
  setGroupMessageText: (value: string) => void;
  handleSendGroupMessage: () => void;
  groupSelectedFiles: SelectedFile[];
  setGroupSelectedFiles: (files: SelectedFile[]) => void;
  isSendingGroup: boolean;
  isGroupUploading: boolean;
  groupMemberCount: number;

  // Direct messaging
  newMessage: string;
  setNewMessage: (value: string) => void;
  handleSendDirect: () => void;
  selectedFiles: SelectedFile[];
  setSelectedFiles: (files: SelectedFile[]) => void;
  isSendingDirect: boolean;
  isUploading: boolean;

  // Isolated phone selector (multi-number)
  sendFromPhone: string;
  onSendFromChange: (phone: string) => void;
  phoneNumbers: PhoneNumber[];
}

// ============================================================================
// Component
// ============================================================================

export function MessageComposer({
  isGroupSelected,
  groupMessageText,
  setGroupMessageText,
  handleSendGroupMessage,
  groupSelectedFiles,
  setGroupSelectedFiles,
  isSendingGroup,
  isGroupUploading,
  groupMemberCount,
  newMessage,
  setNewMessage,
  handleSendDirect,
  selectedFiles,
  setSelectedFiles,
  isSendingDirect,
  isUploading,
  sendFromPhone,
  onSendFromChange,
  phoneNumbers,
}: MessageComposerProps) {
  if (isGroupSelected) {
    return (
      <div className="border-t border-[var(--border)]">
        <CompactPhoneSelector
          value={sendFromPhone}
          onChange={onSendFromChange}
          phoneNumbers={phoneNumbers}
        />
        <MessageInput
          value={groupMessageText}
          onChange={setGroupMessageText}
          onSend={handleSendGroupMessage}
          selectedFiles={groupSelectedFiles}
          onFilesChange={setGroupSelectedFiles}
          isSending={isSendingGroup}
          isUploading={isGroupUploading}
          placeholder="Type a message to the group..."
        />
        <p className="text-xs text-[var(--muted-foreground)] px-4 pb-2 -mt-2">
          Message will be sent to all {groupMemberCount} group members
        </p>
      </div>
    );
  }

  return (
    <div>
      <CompactPhoneSelector
        value={sendFromPhone}
        onChange={onSendFromChange}
        phoneNumbers={phoneNumbers}
      />
      <MessageInput
        value={newMessage}
        onChange={setNewMessage}
        onSend={handleSendDirect}
        selectedFiles={selectedFiles}
        onFilesChange={setSelectedFiles}
        isSending={isSendingDirect}
        isUploading={isUploading}
      />
    </div>
  );
}
