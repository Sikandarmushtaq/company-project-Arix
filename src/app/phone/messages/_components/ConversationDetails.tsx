'use client';

import React from 'react';
import Link from 'next/link';
import { FiChevronsRight, FiChevronRight, FiSend } from 'react-icons/fi';
import { useContactDisplayName } from '@/lib/hooks';
import { formatPhoneNumber } from '@/lib/utils/formatting';
import { GenericAvatar } from '@/components/phone/chrome/avatarUtils';

export interface DetailsMember {
  number: string;
  contactName?: string | null;
  isMe?: boolean;
}

function MemberRow({ member }: { member: DetailsMember }) {
  const resolved = useContactDisplayName(member.number, member.contactName);
  const name = member.isMe ? member.contactName || resolved || 'Me' : resolved;
  const numberFmt = member.number ? formatPhoneNumber(member.number) : '';
  const isNum = !name || name === member.number || name === numberFmt;

  return (
    <div className="flex items-center gap-3 py-2">
      <GenericAvatar name={isNum ? '' : name} number={member.number} size={36} />
      <div className="min-w-0">
        <div className="text-sm font-bold text-[var(--foreground)] truncate">
          {isNum ? numberFmt : name}
          {member.isMe && <span className="font-normal text-[var(--muted-foreground)]"> (me)</span>}
        </div>
        {!isNum && (
          <div className="text-xs text-[var(--muted-foreground)] truncate">{numberFmt}</div>
        )}
      </div>
    </div>
  );
}

/**
 * Conversation Details right column (RingCentral, screenshot 13).
 * CONTACT INFO tab + members list. Works for direct (me + other) and group.
 */
export function ConversationDetails({
  members,
  onClose,
  campaignId,
  campaignName,
  campaignIsOrigin,
}: {
  members: DetailsMember[];
  onClose: () => void;
  /** Bulk-SMS lead attribution for this thread (if it came from a campaign). */
  campaignId?: number | null;
  campaignName?: string | null;
  campaignIsOrigin?: boolean;
}) {
  return (
    <div className="hidden lg:flex lg:w-[320px] lg:shrink-0 flex-col h-full min-h-0 bg-[var(--card)] overflow-hidden">
      {/* header — close button matches the thread header's button size (w-9) and
          sits at the same far-right x, so the show/hide-details control holds one
          position across open/closed states (RingCentral parity). */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3">
        <h2 className="text-[17px] font-black text-[var(--foreground)]">Conversation Details</h2>
        <button
          type="button"
          onClick={onClose}
          title="Hide details"
          aria-label="Hide details"
          className="grid place-items-center w-9 h-9 rounded-full text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
        >
          <FiChevronsRight className="w-[18px] h-[18px]" />
        </button>
      </div>

      {/* tab */}
      <div className="flex items-center gap-5 px-4 border-b border-[var(--border)]">
        <span className="relative py-2.5 text-[13px] font-black tracking-wide text-[var(--foreground)]">
          CONTACT INFO
          <span className="absolute left-0 right-0 -bottom-px h-[2.5px] rounded bg-[var(--primary-600)]" />
        </span>
      </div>

      {/* body */}
      <div className="flex-1 overflow-auto px-4 py-3">
        <p className="text-[13px] font-bold text-[var(--foreground)] mb-1">Members ({members.length})</p>
        <div>
          {members.map((m, i) => (
            <MemberRow key={`${m.number}-${i}`} member={m} />
          ))}
        </div>

        {/* Bulk-SMS lead provenance — where this contact came from. */}
        {campaignName && (
          <div className="mt-4 pt-4 border-t border-[var(--border)]">
            <p className="text-[13px] font-bold text-[var(--foreground)] mb-1.5">Campaign</p>
            <Link
              href={campaignId ? `/phone/bulk-sms?campaign=${campaignId}` : '/phone/bulk-sms'}
              className="group flex items-start gap-2.5 rounded-lg border border-[var(--border)] px-3 py-2.5 transition-colors hover:border-[var(--primary-400)] hover:bg-[var(--muted)]/40"
            >
              <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[var(--primary-50)] text-[var(--foreground)] dark:bg-[var(--primary-900)]/30">
                <FiSend className="h-3.5 w-3.5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-medium text-[var(--muted-foreground)]">
                  {campaignIsOrigin ? 'From campaign' : 'Included in campaign'}
                </p>
                <p className="text-sm font-semibold leading-snug text-[var(--foreground)] break-words">
                  {campaignName}
                </p>
              </div>
              <FiChevronRight className="mt-1.5 h-4 w-4 shrink-0 text-[var(--muted-foreground)] transition-colors group-hover:text-[var(--foreground)]" />
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

export default ConversationDetails;
