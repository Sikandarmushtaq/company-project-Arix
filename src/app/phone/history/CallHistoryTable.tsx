'use client';

/**
 * Call History Table
 *
 * Renders the call records list with selection, call-back, block/unblock actions,
 * unread indicators, and pagination.
 *
 * @module app/phone/history/CallHistoryTable
 */

import React, { useRef, useEffect, useCallback } from 'react';
import {
  FiPhone,
  FiMessageSquare,
  FiPhoneMissed,
  FiPhoneIncoming,
  FiPhoneOutgoing,
  FiCheckSquare,
  FiSquare,
  FiShield,
  FiShieldOff,
  FiUserPlus,
} from 'react-icons/fi';
import { Button, Pagination } from '@/components/ui';
import { GenericAvatar } from '@/components/phone/chrome/avatarUtils';
import { formatPhoneUS, normalizePhone } from '@/lib/utils/phone';
import { formatDuration } from '@/lib/utils/formatting';
import { formatRelativeTime } from '@/lib/utils/datetime';
import { useContactDisplayName, useHasContact } from '@/lib/hooks';
import { useAuthStore } from '@/lib/stores';
import type { Call } from '@/lib/api';
import { isMissedCall } from '@/lib/utils/call-status';

// --- CallRowObserver ---
interface CallRowObserverProps {
  callId: number;
  isUnread: boolean;
  isFading: boolean;
  onVisible: (callId: number) => void;
  children: React.ReactNode;
}

function CallRowObserver({
  callId,
  isUnread,
  isFading,
  onVisible,
  children,
}: CallRowObserverProps) {
  const rowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isUnread || isFading || !rowRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            onVisible(callId);
            observer.disconnect();
          }
        });
      },
      { threshold: 0.5, rootMargin: '0px' }
    );

    observer.observe(rowRef.current);

    return () => observer.disconnect();
  }, [callId, isUnread, isFading, onVisible]);

  return <div ref={rowRef}>{children}</div>;
}

// --- CallAvatar (SSOT: colored initials / person silhouette, matches the
// dialer Calls tab + WhatsApp Calls rows) ---
function CallAvatar({ number, contactName }: { number: string; contactName?: string | null }) {
  const name = useContactDisplayName(number, contactName ?? undefined);
  return <GenericAvatar name={name} number={number} size={40} />;
}

// Missed = unanswered inbound with no talk time.
// Small directional glyph for the meta row (matches the dialer Calls tab).
function DirIcon({ call, isSelected }: { call: Call; isSelected: boolean }) {
  const base = 'w-3.5 h-3.5 shrink-0';
  if (isSelected) return <FiPhoneIncoming className={`${base} text-white/80`} />;
  if (isMissedCall(call)) return <FiPhoneMissed className={`${base} text-[var(--danger)]`} />;
  if (call.direction === 'inbound') return <FiPhoneIncoming className={`${base} text-green-600`} />;
  return <FiPhoneOutgoing className={`${base} text-[var(--foreground)]`} />;
}

// --- CallRowContent ---
interface CallRowContentProps {
  call: Call;
  displayNumber: string;
  isUnread: boolean;
  isFading: boolean;
  transitionDuration: string;
  isSelected: boolean;
}

function CallRowContent({
  call,
  displayNumber,
  isUnread,
  isFading,
  transitionDuration,
  isSelected,
}: CallRowContentProps) {
  // SSOT: Use contact lookup store as primary source, fall back to API-enriched name
  const contactDisplayName = useContactDisplayName(displayNumber, call.contactName);

  // Show the line badge only when the call was on a DIFFERENT line than the active
  // phone (multi-number accounts) — avoids cluttering every row with your own number.
  const user = useAuthStore((s) => s.user);
  const hasMultiplePhones = (user?.phoneNumbers?.length ?? 0) > 1;
  const myPhone = call.direction === 'inbound' ? call.callee : call.caller;
  const isOnDifferentLine =
    hasMultiplePhones &&
    myPhone.replace(/\D/g, '') !== (user?.senderPhone || '').replace(/\D/g, '');
  const formattedMyPhone = isOnDifferentLine ? formatPhoneUS(myPhone) : null;

  const missed = isMissedCall(call);
  const showNewBadge = isUnread && missed;
  const meta = missed
    ? 'Missed call'
    : call.duration > 0
      ? formatDuration(call.duration)
      : 'No answer';

  return (
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-1.5">
        <p
          className={`text-[14.5px] truncate ${
            isSelected ? 'text-white' : missed ? 'text-[var(--danger)]' : 'text-[var(--foreground)]'
          } ${showNewBadge && !isFading ? 'font-black' : 'font-bold'}`}
        >
          {contactDisplayName}
        </p>
        {showNewBadge && (
          <span
            className={`inline-flex items-center px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${isSelected ? 'bg-white/20' : 'bg-gradient-to-r from-blue-500 to-blue-600'} text-white rounded-full shadow-sm transition-all ${transitionDuration} ${
              isFading ? 'opacity-0 scale-75' : 'opacity-100 scale-100'
            }`}
          >
            New
          </span>
        )}
      </div>
      <div
        className={`flex items-center gap-1.5 mt-0.5 text-[12.5px] min-w-0 ${isSelected ? 'text-white/80' : 'text-[var(--muted-foreground)]'}`}
      >
        <DirIcon call={call} isSelected={isSelected} />
        <span className="truncate">{meta}</span>
        {formattedMyPhone && (
          <span
            className={`shrink-0 px-1.5 py-0.5 text-[10px] font-bold rounded-full ${
              isSelected
                ? 'bg-white/20 text-white'
                : 'bg-violet-50 text-violet-600 dark:bg-violet-900/20 dark:text-violet-400'
            }`}
          >
            {formattedMyPhone}
          </span>
        )}
      </div>
    </div>
  );
}

// --- SaveContactButton (SSOT) ---
interface SaveContactButtonProps {
  phoneNumber: string;
  onSave: (phoneNumber: string) => void;
}

function SaveContactButton({ phoneNumber, onSave }: SaveContactButtonProps) {
  const isContact = useHasContact(phoneNumber);
  if (isContact) return null;

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      onClick={(e) => {
        e.stopPropagation();
        onSave(phoneNumber);
      }}
      title="Save to contacts"
    >
      <FiUserPlus className="w-4 h-4" />
    </Button>
  );
}

// --- CallHistoryTable ---
export interface CallHistoryTableProps {
  calls: Call[];
  isLoading: boolean;
  error: unknown;
  isFetching: boolean;
  debouncedSearch: string;
  directionFilter: string;
  statusFilter: string;
  // Selection
  isSelectionMode: boolean;
  selectedCalls: Set<number>;
  onToggleCallSelection: (callId: number) => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
  // Unread / fade
  fadingCallIds: Set<number>;
  prefersReducedMotion: boolean;
  onCallVisible: (callId: number) => void;
  onMarkAsRead: (call: Call) => void;
  // Actions
  isRegistered: boolean;
  onCallFromHistory: (call: Call) => void;
  onMessage: (phoneNumber: string) => void;
  blockedNumberSet: Set<string>;
  blockedNumberMap: Map<string, number>;
  onBlockNumber: (number: string) => void;
  onUnblockNumber: (blockedId: number) => void;
  onSaveContact: (phoneNumber: string) => void;
  // Pagination
  callsData:
    | {
        total?: number;
        totalPages: number;
      }
    | undefined;
  pagination: {
    page: number;
    totalPages: number;
    totalItems: number;
    pageSize: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
    pageRange: number[];
    goToPage: (page: number) => void;
  };
  // Refetch
  onRefetch: () => void;
}

export function CallHistoryTable({
  calls,
  isLoading,
  error,
  debouncedSearch,
  directionFilter,
  statusFilter,
  isSelectionMode,
  selectedCalls,
  onToggleCallSelection,
  onSelectAll,
  onClearSelection,
  fadingCallIds,
  prefersReducedMotion,
  onCallVisible,
  onMarkAsRead,
  isRegistered,
  onCallFromHistory,
  onMessage,
  blockedNumberSet,
  blockedNumberMap,
  onBlockNumber,
  onUnblockNumber,
  onSaveContact,
  callsData,
  pagination,
  onRefetch,
}: CallHistoryTableProps) {
  const handleUnblock = useCallback(
    (normalizedNumber: string) => {
      const blockedId = blockedNumberMap.get(normalizedNumber);
      if (blockedId) {
        onUnblockNumber(blockedId);
      }
    },
    [blockedNumberMap, onUnblockNumber]
  );

  return (
    <>
      {/* Select All */}
      {isSelectionMode && calls.length > 0 && (
        <div className="flex items-center gap-4 px-5 py-2.5 border-b border-[var(--border)]">
          <Button variant="ghost" size="sm" onClick={onSelectAll}>
            Select All
          </Button>
          <Button variant="ghost" size="sm" onClick={onClearSelection}>
            Clear Selection
          </Button>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-[var(--border)] border-t-transparent" />
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="text-center py-12 text-[var(--danger)]">
          <p>Failed to load call history</p>
          <Button variant="outline" size="sm" className="mt-2" onClick={onRefetch}>
            Try Again
          </Button>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && calls.length === 0 && (
        <div className="text-center py-12">
          <FiPhone className="w-12 h-12 mx-auto text-[var(--muted-foreground)] mb-4" />
          <p className="text-[var(--muted-foreground)]">
            {debouncedSearch || directionFilter !== 'all' || statusFilter !== 'all'
              ? 'No calls match your filters'
              : 'No call history yet'}
          </p>
        </div>
      )}

      {/* Call List */}
      {!isLoading && calls.length > 0 && (
        <div>
          {calls.map((call) => {
            const displayNumber = call.direction === 'inbound' ? call.caller : call.callee;
            const normalizedNumber = normalizePhone(displayNumber);
            const isSelected = selectedCalls.has(call.id);
            const isUnread = !call.read;
            const isFading = fadingCallIds.has(call.id);
            const isBlocked = blockedNumberSet.has(normalizedNumber);

            // CSS transition duration class based on reduced motion preference
            const transitionDuration = prefersReducedMotion ? 'duration-0' : 'duration-400';

            return (
              <CallRowObserver
                key={call.id}
                callId={call.id}
                isUnread={isUnread}
                isFading={isFading}
                onVisible={onCallVisible}
              >
                <div
                  onClick={() => onMarkAsRead(call)}
                  className={`group relative flex items-center gap-3 py-2.5 px-5 border-b border-[var(--border)]/60 transition-all ${transitionDuration} cursor-pointer ${
                    isSelected
                      ? 'bg-[var(--primary-600)] text-white'
                      : isUnread && !isFading
                        ? 'bg-gradient-to-r from-blue-500/15 via-blue-500/5 to-transparent dark:from-blue-400/20 dark:via-blue-400/10 dark:to-transparent'
                        : 'hover:bg-[var(--muted)]/60'
                  }`}
                >
                  {/* Unread indicator bar */}
                  {isUnread && (
                    <div
                      className={`absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-gradient-to-b from-blue-500 to-blue-600 rounded-r-full transition-opacity ${transitionDuration} ${
                        isFading ? 'opacity-0' : 'opacity-100'
                      }`}
                    />
                  )}

                  {/* Selection Checkbox */}
                  {isSelectionMode && (
                    <button
                      onClick={() => onToggleCallSelection(call.id)}
                      className={`p-1 rounded ${isSelected ? 'hover:bg-white/20' : 'hover:bg-[var(--muted)]'}`}
                    >
                      {isSelected ? (
                        <FiCheckSquare className="w-5 h-5 text-white" />
                      ) : (
                        <FiSquare className="w-5 h-5 text-[var(--muted-foreground)]" />
                      )}
                    </button>
                  )}

                  {/* Contact avatar (SSOT) — direction/status shown in the meta row */}
                  <CallAvatar number={displayNumber} contactName={call.contactName} />

                  {/* Call Details - SSOT contact resolution */}
                  <CallRowContent
                    call={call}
                    displayNumber={displayNumber}
                    isUnread={isUnread}
                    isFading={isFading}
                    transitionDuration={transitionDuration}
                    isSelected={isSelected}
                  />

                  {/* Time (default) — hidden on desktop hover to reveal actions.
                      On mobile (no hover) both stay visible so actions are reachable. */}
                  {!isSelectionMode && (
                    <span
                      className={`text-[12px] shrink-0 whitespace-nowrap md:group-hover:hidden ${isSelected ? 'text-white/70' : 'text-[var(--muted-foreground)]'}`}
                    >
                      {formatRelativeTime(call.startTime)}
                    </span>
                  )}

                  {/* Actions — always on mobile, hover-revealed on md+ */}
                  {!isSelectionMode && (
                    <div className="flex md:hidden md:group-hover:flex items-center gap-1 shrink-0">
                      <SaveContactButton phoneNumber={displayNumber} onSave={onSaveContact} />
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          onCallFromHistory(call);
                        }}
                        disabled={!isRegistered}
                        title={isRegistered ? 'Call back' : 'Not registered'}
                      >
                        <FiPhone className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          onMessage(displayNumber);
                        }}
                        title="Message"
                      >
                        <FiMessageSquare className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (isBlocked) {
                            handleUnblock(normalizedNumber);
                          } else {
                            onBlockNumber(normalizedNumber);
                          }
                        }}
                        title={isBlocked ? 'Unblock number' : 'Block number'}
                      >
                        {isBlocked ? (
                          <FiShield className="w-4 h-4 text-red-500" />
                        ) : (
                          <FiShieldOff className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                  )}
                </div>
              </CallRowObserver>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {callsData && callsData.totalPages > 1 && (
        <div className="px-5 py-3 border-t border-[var(--border)]">
          <Pagination
            page={pagination.page}
            totalPages={pagination.totalPages}
            totalItems={pagination.totalItems}
            pageSize={pagination.pageSize}
            hasNextPage={pagination.hasNextPage}
            hasPreviousPage={pagination.hasPreviousPage}
            pageRange={pagination.pageRange}
            onPageChange={pagination.goToPage}
            showTotalItems
          />
        </div>
      )}
    </>
  );
}
