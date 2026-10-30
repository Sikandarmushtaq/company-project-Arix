'use client';

import React, { memo, useCallback, useState } from 'react';
import { motion } from 'framer-motion';
import { FiClock, FiRefreshCw, FiX, FiPhoneIncoming, FiPhoneOutgoing, FiPhoneMissed } from 'react-icons/fi';
import { useContactDisplayName } from '@/lib/hooks';
import { formatRelativeTime } from '@/lib/utils/datetime';
import { isMissedCall } from '@/lib/utils/call-status';
import type { Call } from '@/lib/api';
import { GenericAvatar } from './chrome/avatarUtils';

interface RecentCallsProps {
  calls: Call[];
  isLoading: boolean;
  error: Error | null;
  isRegistered: boolean;
  onRefresh: () => void;
  onCallFromHistory: (call: Call) => void;
  /** Dismiss the panel (RingCentral right-pane close X). Optional. */
  onClose?: () => void;
}

interface RecentCallItemProps {
  call: Call;
  isRegistered: boolean;
  onCallFromHistory: (call: Call) => void;
}

const RecentCallItem = memo(function RecentCallItem({
  call,
  isRegistered,
  onCallFromHistory,
}: RecentCallItemProps) {
  const displayNumber = call.direction === 'inbound' ? call.caller : call.callee;
  const displayName = useContactDisplayName(displayNumber, call.contactName);

  const missed = isMissedCall(call);
  const blocked = call.status === 'blocked';
  const dnd = call.status === 'dnd';

  // Proper phone±arrow glyph (same convention as the Calls tab), no rotation hack.
  const Dir = missed ? FiPhoneMissed : call.direction === 'inbound' ? FiPhoneIncoming : FiPhoneOutgoing;
  const dirCls =
    missed || blocked
      ? 'text-[var(--danger)]'
      : dnd
        ? 'text-purple-500'
        : call.direction === 'inbound'
          ? 'text-green-600'
          : 'text-[var(--foreground)]';
  const label = blocked
    ? 'Blocked'
    : dnd
      ? 'DND'
      : missed
        ? 'Missed call'
        : call.direction === 'inbound'
          ? 'Incoming call'
          : 'Outgoing call';

  return (
    <button
      onClick={() => onCallFromHistory(call)}
      disabled={!isRegistered}
      className="w-full flex items-center gap-3 px-4 md:px-5 py-2 text-left rounded-lg hover:bg-[var(--muted)]/60 transition-colors disabled:opacity-50 disabled:cursor-not-allowed outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--primary-500)]"
    >
      <GenericAvatar name={displayName} number={displayNumber} size={38} />
      <div className="flex-1 min-w-0">
        <p className="text-[14px] font-bold truncate text-[var(--foreground)]">{displayName}</p>
        <div
          className={`flex items-center gap-1.5 text-[12.5px] mt-0.5 ${
            missed || blocked ? 'text-[var(--danger)]' : 'text-[var(--muted-foreground)]'
          }`}
        >
          <Dir className={`w-3.5 h-3.5 shrink-0 ${dirCls}`} />
          <span className="truncate">{label}</span>
        </div>
      </div>
      <span className="text-[12px] text-[var(--muted-foreground)] shrink-0 whitespace-nowrap">
        {formatRelativeTime(call.startTime)}
      </span>
    </button>
  );
});

/**
 * Recent Calls — flush right-pane panel (consistent with the Calls / Voicemail /
 * Recordings detail panes; no separate card box). Quick-redial the latest calls.
 */
export function RecentCalls({
  calls,
  isLoading,
  error,
  isRegistered,
  onRefresh,
  onCallFromHistory,
  onClose,
}: RecentCallsProps) {
  // Spin the refresh icon only on a MANUAL refresh (or initial load) — never on
  // the silent background refetch that fires when you dial a call, so a new call
  // slides in without the panel looking like it's "refreshing".
  const [refreshing, setRefreshing] = useState(false);
  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    onRefresh();
    window.setTimeout(() => setRefreshing(false), 600);
  }, [onRefresh]);
  const spinning = isLoading || refreshing;

  return (
    // Contained column — a list shouldn't stretch across the full wide right pane
    // (which strands the timestamp far right with a big middle gap).
    <div className="flex flex-col h-full w-full max-w-2xl">
      <div className="flex items-center justify-between px-5 md:px-6 pt-4 pb-2 shrink-0">
        <h3 className="text-[15px] font-black text-[var(--foreground)] flex items-center gap-2">
          <FiClock className="w-4 h-4 text-[var(--muted-foreground)]" />
          Recent Calls
        </h3>
        <div className="flex items-center gap-1">
          <button
            onClick={handleRefresh}
            disabled={spinning}
            title="Refresh"
            aria-label="Refresh recent calls"
            className="w-9 h-9 grid place-items-center rounded-full text-[var(--muted-foreground)] hover:bg-[var(--muted)] disabled:opacity-40 transition-colors"
          >
            <FiRefreshCw className={`w-[18px] h-[18px] ${spinning ? 'animate-spin' : ''}`} />
          </button>
          {onClose && (
            <button
              onClick={onClose}
              title="Close"
              aria-label="Close recent calls"
              className="w-9 h-9 grid place-items-center rounded-full text-[var(--muted-foreground)] hover:bg-[var(--muted)] transition-colors"
            >
              <FiX className="w-[18px] h-[18px]" />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-2 md:px-3">
        {error && calls.length === 0 && (
          <div className="text-center py-10 text-sm text-[var(--danger)]">{error.message}</div>
        )}

        {isLoading && calls.length === 0 && (
          <div className="grid place-items-center py-10">
            <div className="animate-spin rounded-full h-6 w-6 border-2 border-[var(--border)] border-t-transparent" />
          </div>
        )}

        {!isLoading && calls.length === 0 && !error && (
          <div className="flex flex-col items-center text-center px-6 py-12 text-[var(--muted-foreground)]">
            <div className="w-14 h-14 rounded-2xl bg-[var(--muted)] grid place-items-center mb-3">
              <FiClock className="w-6 h-6 opacity-60" />
            </div>
            <p className="text-sm font-bold text-[var(--foreground)]">No recent calls</p>
            <p className="text-xs mt-1">Your recent calls will appear here.</p>
          </div>
        )}

        {/* Per-item entrance only — NO wrapper key that changes with the data, so
            adding a freshly-dialed call does NOT remount the list (which would
            reset the scroll and replay every row's animation). `initial` runs
            once per row on mount: existing rows stay put, only the new row fades
            in. Vertical-only slide + overflow-y avoids any horizontal flicker. */}
        {calls.slice(0, 8).map((call) => (
          <motion.div
            key={call.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          >
            <RecentCallItem
              call={call}
              isRegistered={isRegistered}
              onCallFromHistory={onCallFromHistory}
            />
          </motion.div>
        ))}
      </div>
    </div>
  );
}
