'use client';

import React, { useMemo, useCallback } from 'react';
import { useContactDisplayName } from '@/lib/hooks';
import { formatPhoneNumber } from '@/lib/utils/formatting';
import { getMessageText } from './utils';
import type { Message } from './types';

interface GlobalSearchResultItemProps {
  phone: string;
  messages: Message[];
  searchQuery: string;
  onMessageClick: (messageId: number) => void;
}

/**
 * Global search result item - shows messages grouped by conversation
 * Each message preview is clickable to jump directly to that message
 */
export const GlobalSearchResultItem = React.memo(function GlobalSearchResultItem({
  phone,
  messages,
  searchQuery,
  onMessageClick,
}: GlobalSearchResultItemProps) {
  const displayPhone = useMemo(() => formatPhoneNumber(phone), [phone]);
  const displayName = useContactDisplayName(phone, null);

  // Highlight matching text in message
  const highlightMatch = useCallback(
    (text: string) => {
      if (!searchQuery || !text) return text;
      const regex = new RegExp(`(${searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
      const parts = text.split(regex);
      return parts.map((part, i) =>
        regex.test(part) ? (
          <mark key={i} className="bg-yellow-200 dark:bg-yellow-800 text-inherit rounded px-0.5">
            {part}
          </mark>
        ) : (
          part
        )
      );
    },
    [searchQuery]
  );

  return (
    <div className="p-3 rounded-lg hover:bg-[var(--muted)] transition-colors">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-[var(--primary-100)] dark:bg-[var(--primary-900)] flex items-center justify-center flex-shrink-0">
          <span className="text-sm font-medium text-[var(--foreground)]">
            {displayName.charAt(0).toUpperCase()}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <p className="font-medium text-[var(--foreground)] truncate">{displayName}</p>
            <span className="text-xs text-[var(--muted-foreground)] ml-2">
              {messages.length} match{messages.length !== 1 ? 'es' : ''}
            </span>
          </div>
          {displayName !== displayPhone && (
            <p className="text-xs text-[var(--muted-foreground)]">{displayPhone}</p>
          )}
          {/* Clickable message previews */}
          <div className="mt-2 space-y-1">
            {messages.slice(0, 3).map((msg) => (
              <button
                key={msg.id}
                onClick={() => onMessageClick(msg.id)}
                className="w-full text-left p-1.5 -mx-1.5 rounded text-sm text-[var(--muted-foreground)] hover:bg-[var(--primary-100)] dark:hover:bg-[var(--primary-900)] transition-colors"
              >
                <div className="flex items-start gap-1">
                  <span className="text-xs opacity-60 mt-0.5">
                    {msg.direction === 'outbound' ? '→' : '←'}
                  </span>
                  <span className="truncate flex-1">
                    {highlightMatch(getMessageText(msg.body).slice(0, 100))}
                  </span>
                </div>
              </button>
            ))}
            {messages.length > 3 && (
              <button
                onClick={() => onMessageClick(messages[0].id)}
                className="text-xs text-[var(--foreground)] hover:underline pl-1"
              >
                +{messages.length - 3} more matches
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

export default GlobalSearchResultItem;
