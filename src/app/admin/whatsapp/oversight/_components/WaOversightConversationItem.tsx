'use client';

/**
 * One row of the manager oversight conversation list.
 *
 * Differs from the agent-facing `WaConversationItem` by:
 *   - rendering the assigned agent's name as a secondary line (the
 *     manager needs to see *who* is handling each customer at a glance)
 *   - no selection-mode plumbing (manager view is read-only in v1)
 *
 * The typing pulse rendering is identical to the agent view so the UX
 * vocabulary stays consistent across the two surfaces.
 */

import React, { useCallback } from 'react';
import { FaWhatsapp } from 'react-icons/fa';
import { FiUser } from 'react-icons/fi';
import { useContactDisplayName } from '@/lib/hooks';
import { formatConversationTime } from '@/lib/utils/datetime';
import { MessageTypeIcon } from '@/app/phone/whatsapp/_components';
import type { WaOversightConversation } from '@/lib/api/services/whatsapp.api';

interface Props {
  conversation: WaOversightConversation;
  isSelected: boolean;
  onClick: () => void;
  /** Live typing pulse — when non-null, replaces last-message preview. */
  typingAgentName?: string | null;
}

export const WaOversightConversationItem = React.memo(function WaOversightConversationItem({
  conversation,
  isSelected,
  onClick,
  typingAgentName,
}: Props) {
  const contactDisplayName = useContactDisplayName(
    conversation.customerPhone,
    conversation.contactName
  );

  const handleClick = useCallback(() => onClick(), [onClick]);

  const agentLabel = conversation.agentFullName || conversation.agentPhone || 'Unassigned';
  const unread = conversation.unreadCount;

  return (
    <button
      onClick={handleClick}
      role="option"
      aria-selected={isSelected}
      aria-label={`Oversight conversation with ${contactDisplayName}, handled by ${agentLabel}${unread > 0 ? `, ${unread} unread` : ''}`}
      className={`w-full p-3 rounded-lg text-left outline-none focus-visible:ring-2 focus-visible:ring-green-500 ${
        isSelected ? 'bg-green-600 text-white' : 'hover:bg-[var(--muted)]'
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
          <FaWhatsapp className="w-5 h-5 text-green-500" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            {/*
              Typing pulse + customer name as siblings of a NEW flex
              wrapper. Two fixes vs. the prior layout:
                1. The dot used to live INSIDE a `<p class="truncate">`,
                   which is `overflow: hidden`. The `animate-ping` ring
                   scales to 2× and the overflow rule clipped the left
                   half. Moving the dot OUT of the truncating element
                   lets the ring breathe.
                2. `pl-1` adds a tiny inset so the ring (which
                   pulses outward from the dot's center) has room
                   on its left side without being clipped by the
                   button's own padding edge.
              The customer name retains `truncate` for long contact
              names; the dot has `flex-shrink-0` so it never gets
              squashed when the name overflows.
            */}
            <div className="flex items-center gap-1.5 min-w-0 flex-1 pl-1">
              {typingAgentName && (
                <span
                  className="relative flex h-2 w-2 flex-shrink-0"
                  title={`${typingAgentName} is typing…`}
                  aria-label={`${typingAgentName} is typing`}
                >
                  {/*
                    Color: when the row is SELECTED the button has
                    `bg-green-600 text-white` — a green dot on green
                    background is barely visible. Use white-on-green
                    when selected so it stays high-contrast.
                  */}
                  <span
                    className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${
                      isSelected ? 'bg-white' : 'bg-green-400'
                    }`}
                  />
                  <span
                    className={`relative inline-flex h-2 w-2 rounded-full ${
                      isSelected ? 'bg-white' : 'bg-green-500'
                    }`}
                  />
                </span>
              )}
              <p
                className={`font-medium truncate ${isSelected ? 'text-white' : 'text-[var(--foreground)]'}`}
              >
                {contactDisplayName}
              </p>
            </div>
            <span
              className={`text-xs whitespace-nowrap flex-shrink-0 ${isSelected ? 'text-white/80' : 'text-[var(--muted-foreground)]'}`}
            >
              {conversation.lastMessageTime
                ? formatConversationTime(conversation.lastMessageTime)
                : ''}
            </span>
          </div>

          {/* Agent assignment line — the differentiator for oversight rows.
              When typing is active, the "Handled by X" line is enriched
              with "(typing…)" so the manager can see WHO is typing without
              losing the conversation context below. */}
          <p
            className={`text-xs mt-0.5 flex items-center gap-1 truncate ${
              isSelected ? 'text-white/80' : 'text-[var(--muted-foreground)]'
            }`}
          >
            <FiUser className="w-3 h-3 flex-shrink-0" />
            <span className="truncate">
              {agentLabel}
              {typingAgentName && (
                <span className={`ml-1 italic ${isSelected ? 'text-white' : 'text-green-500'}`}>
                  · typing…
                </span>
              )}
            </span>
          </p>

          <div className="flex items-center justify-between mt-1">
            <p
              className={`text-sm truncate flex items-center gap-1 ${isSelected ? 'text-white/70' : 'text-[var(--muted-foreground)]'}`}
            >
              {/* Last-message preview is ALWAYS shown — typing pulse no
                  longer replaces it; it lives next to the customer name
                  above. Keeps conversation context visible at all times. */}
              {conversation.lastMessage ? (
                <>
                  <MessageTypeIcon type={conversation.lastMessageType} />
                  {conversation.lastMessage}
                </>
              ) : conversation.lastMessageType !== 'text' ? (
                <>
                  <MessageTypeIcon type={conversation.lastMessageType} />
                  {`[${conversation.lastMessageType}]`}
                </>
              ) : (
                <span className="italic opacity-70">No messages yet</span>
              )}
            </p>
            {unread > 0 && (
              <span className="ml-2 px-2 py-0.5 text-xs font-semibold rounded-full bg-green-500 text-white">
                {unread}
              </span>
            )}
          </div>
        </div>
      </div>
    </button>
  );
});
