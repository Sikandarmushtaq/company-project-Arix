'use client';

import React from 'react';
import { useContactDisplayName } from '@/lib/hooks';
import { formatPhoneNumber } from '@/lib/utils/formatting';

interface ConversationHeaderContentProps {
  phone: string;
  contactName?: string | null;
  isNewConversation: boolean;
}

/**
 * Conversation header with SSOT contact resolution
 */
export const ConversationHeaderContent = React.memo(function ConversationHeaderContent({
  phone,
  contactName,
  isNewConversation,
}: ConversationHeaderContentProps) {
  // SSOT: Use contact lookup store for name resolution
  const displayName = useContactDisplayName(phone, contactName);
  const hasContactName = displayName !== formatPhoneNumber(phone);

  return (
    <div className="min-w-0">
      <h3 className="text-lg font-bold text-[var(--foreground)] truncate">{displayName}</h3>
      {hasContactName && (
        <p className="text-[13px] text-[var(--muted-foreground)] truncate">{formatPhoneNumber(phone)}</p>
      )}
      {isNewConversation && <p className="text-sm text-[var(--foreground)]">New conversation</p>}
    </div>
  );
});

export default ConversationHeaderContent;
