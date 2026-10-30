'use client';

/**
 * Call History Page
 *
 * Professional call history management with search, filters, and pagination.
 * Features click-to-call, bulk operations, and detailed call information.
 *
 * @module app/phone/history/page
 */

import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  FiPhone,
  FiPhoneIncoming,
  FiPhoneOutgoing,
  FiPhoneMissed,
  FiTrash2,
  FiRefreshCw,
  FiCheckSquare,
  FiX,
  FiCheck,
  FiClock,
} from 'react-icons/fi';

import { Button, ConfirmModal } from '@/components/ui';
import { formatPhoneUS, isOwnNumber, normalizePhone } from '@/lib/utils/phone';
import {
  useCallsPaginated,
  useCallStats,
  useDeleteCalls,
  useMarkCallsAsRead,
  useUnreadCallCount,
  usePagination,
  useBlockedNumberLookup,
  useBlockContact,
  useUnblockContact,
  useCreateContact,
  useAnnounce,
} from '@/lib/hooks';
import { usePrefersReducedMotion, useOnlineStatus } from '@/lib/hooks/useMediaQueries';
import { useSipStore } from '@/lib/stores/sip';
import { useAuthStore } from '@/lib/stores/auth';
import { useNotificationSettings } from '@/lib/stores/notificationSettings';
import { toast } from '@/lib/stores/toast';
import type { Call } from '@/lib/api';
import type { CreateContactInput } from '@/lib/validation';
import { useContactLookupStore } from '@/lib/stores/contactLookup';

import { PageTransition } from '@/components/phone';
import { CallHistoryFilters, type DirectionFilter, type StatusFilter } from './CallHistoryFilters';
import { CallHistoryTable } from './CallHistoryTable';
import { ContactFormModal } from '../contacts/ContactModals';

/** Compact inline metric — small glyph + bold number + muted label. */
function StatItem({ icon, value, label }: { icon: React.ReactNode; value: number; label: string }) {
  return (
    <div className="flex items-center gap-1.5 shrink-0">
      {icon}
      <span className="text-[15px] font-black text-[var(--foreground)] tabular-nums leading-none">
        {value.toLocaleString()}
      </span>
      <span className="text-[12px] text-[var(--muted-foreground)] leading-none">{label}</span>
    </div>
  );
}

export default function CallHistoryPage() {
  const router = useRouter();
  const { isRegistered, makeCall } = useSipStore();
  const user = useAuthStore((s) => s.user);

  // Accessibility
  const prefersReducedMotion = usePrefersReducedMotion();
  const { announce } = useAnnounce();

  // Network status for offline handling
  const isOnline = useOnlineStatus();

  // Notification settings for auto-mark behavior
  const { autoMarkOnView, autoMarkOnScroll, autoMarkDelay } = useNotificationSettings();

  // Refs for tracking auto-mark state
  const hasAutoMarkedOnView = useRef(false);
  const markedCallIds = useRef<Set<number>>(new Set());

  // Batching: queue for scroll-triggered mark-as-read (batched API calls)
  const pendingScrollMarkIds = useRef<Set<number>>(new Set());
  const scrollBatchTimerRef = useRef<NodeJS.Timeout | null>(null);
  const SCROLL_BATCH_DELAY = 300; // ms - wait before batching scroll marks

  // Pagination state
  const pagination = usePagination({ initialPageSize: 20 });

  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [directionFilter, setDirectionFilter] = useState<DirectionFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [showFilters, setShowFilters] = useState(false);

  // Selection state
  const [selectedCalls, setSelectedCalls] = useState<Set<number>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);

  // Delete confirmation
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Block number state
  const { blockedNumberSet, blockedNumberMap } = useBlockedNumberLookup();
  const blockContact = useBlockContact();
  const unblockContact = useUnblockContact();
  const [numberToBlock, setNumberToBlock] = useState<string | null>(null);

  // Save contact state
  const createContact = useCreateContact();
  const existingContacts = useContactLookupStore((s) => s.contacts);
  const [saveContactNumber, setSaveContactNumber] = useState<string | null>(null);
  const [saveContactError, setSaveContactError] = useState<string | null>(null);

  // Fade-out animation state for calls being marked as read
  const [fadingCallIds, setFadingCallIds] = useState<Set<number>>(new Set());
  // Animation duration - 0 if user prefers reduced motion
  const FADE_DURATION = prefersReducedMotion ? 0 : 400;

  // Debounce search and reset to first page
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      pagination.firstPage();
    }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- pagination.firstPage is stable
  }, [searchQuery]);

  // Reset to first page when filters change
  useEffect(() => {
    pagination.firstPage();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- pagination.firstPage is stable
  }, [directionFilter, statusFilter]);

  // Build query params
  const queryParams = {
    page: pagination.page,
    limit: pagination.pageSize,
    search: debouncedSearch || undefined,
    direction: directionFilter !== 'all' ? directionFilter : undefined,
    status: statusFilter !== 'all' ? statusFilter : undefined,
  };

  // Fetch calls
  const { data: callsData, isLoading, error, refetch, isFetching } = useCallsPaginated(queryParams);

  // Fetch stats
  const { data: stats } = useCallStats();

  // Fetch unread count for "Mark all as read" button
  const { data: unreadCount = 0 } = useUnreadCallCount();

  // Mutations
  const deleteCalls = useDeleteCalls();
  const markCallsAsRead = useMarkCallsAsRead();

  // Memoize calls array for stable reference in callbacks
  const calls = useMemo(() => callsData?.calls || [], [callsData?.calls]);

  /**
   * Helper to trigger fade animation then mark as read
   */
  const triggerFadeAndMark = useCallback(
    async (callIds: number[]) => {
      if (callIds.length === 0) return;

      if (!isOnline) {
        toast.warning("You're offline. Changes will sync when you reconnect.");
        callIds.forEach((id) => markedCallIds.current.delete(id));
        return;
      }

      setFadingCallIds((prev) => {
        const next = new Set(prev);
        callIds.forEach((id) => next.add(id));
        return next;
      });

      if (FADE_DURATION > 0) {
        await new Promise((resolve) => setTimeout(resolve, FADE_DURATION));
      }

      try {
        await markCallsAsRead.mutateAsync(callIds);
        setFadingCallIds((prev) => {
          const next = new Set(prev);
          callIds.forEach((id) => next.delete(id));
          return next;
        });
      } catch (error) {
        console.error('Failed to mark calls as read:', error);
        setFadingCallIds((prev) => {
          const next = new Set(prev);
          callIds.forEach((id) => next.delete(id));
          return next;
        });
        callIds.forEach((id) => markedCallIds.current.delete(id));
        toast.error('Failed to mark as read. Please try again.');
      }
    },
    [markCallsAsRead, FADE_DURATION, isOnline]
  );

  /**
   * Helper to trigger fade for all unread calls
   */
  const triggerFadeAllAndMark = useCallback(
    async (unreadCallList: Call[]) => {
      const unreadIds = unreadCallList.filter((c) => !c.read).map((c) => c.id);
      if (unreadIds.length === 0) return;

      if (!isOnline) {
        toast.warning("You're offline. Changes will sync when you reconnect.");
        return;
      }

      setFadingCallIds(new Set(unreadIds));

      if (FADE_DURATION > 0) {
        await new Promise((resolve) => setTimeout(resolve, FADE_DURATION));
      }

      try {
        await markCallsAsRead.mutateAsync(undefined);
        setFadingCallIds(new Set());
      } catch (error) {
        console.error('Failed to mark all calls as read:', error);
        setFadingCallIds(new Set());
        toast.error('Failed to mark all as read. Please try again.');
      }
    },
    [markCallsAsRead, FADE_DURATION, isOnline]
  );

  /**
   * Flush the batched scroll marks
   */
  const flushScrollBatch = useCallback(async () => {
    const idsToMark = Array.from(pendingScrollMarkIds.current);
    if (idsToMark.length === 0) return;
    pendingScrollMarkIds.current.clear();
    await triggerFadeAndMark(idsToMark);
  }, [triggerFadeAndMark]);

  /**
   * Add a call ID to the scroll batch queue
   */
  const queueScrollMark = useCallback(
    (callId: number) => {
      pendingScrollMarkIds.current.add(callId);

      if (scrollBatchTimerRef.current) {
        clearTimeout(scrollBatchTimerRef.current);
      }

      scrollBatchTimerRef.current = setTimeout(() => {
        flushScrollBatch();
        scrollBatchTimerRef.current = null;
      }, SCROLL_BATCH_DELAY);
    },
    [flushScrollBatch, SCROLL_BATCH_DELAY]
  );

  // Mark a single call as read when clicked (with animation)
  const handleMarkAsRead = useCallback(
    (call: Call) => {
      if (!call.read && !fadingCallIds.has(call.id)) {
        triggerFadeAndMark([call.id]);
      }
    },
    [fadingCallIds, triggerFadeAndMark]
  );

  // Mark all calls as read (with animation)
  const handleMarkAllAsRead = useCallback(() => {
    triggerFadeAllAndMark(calls);
  }, [triggerFadeAllAndMark, calls]);

  // Update total items when data changes
  useEffect(() => {
    if (callsData?.total !== undefined) {
      pagination.setTotalItems(callsData.total);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- pagination.setTotalItems is stable
  }, [callsData?.total]);

  // Get unread calls from the current list
  const unreadCalls = calls.filter((call) => !call.read);

  // AUTO-MARK ON VIEW: Mark all as read after delay when page loads (with fade animation)
  useEffect(() => {
    if (!autoMarkOnView || hasAutoMarkedOnView.current || unreadCalls.length === 0 || isLoading) {
      return;
    }

    const timer = setTimeout(() => {
      if (unreadCalls.length > 0) {
        triggerFadeAllAndMark(unreadCalls);
        hasAutoMarkedOnView.current = true;
      }
    }, autoMarkDelay);

    return () => clearTimeout(timer);
  }, [autoMarkOnView, unreadCalls, isLoading, autoMarkDelay, triggerFadeAllAndMark]);

  // Reset auto-mark flag and cleanup timers when navigating away
  useEffect(() => {
    const markedIds = markedCallIds.current;
    const pendingIds = pendingScrollMarkIds.current;
    const timer = scrollBatchTimerRef.current;

    return () => {
      hasAutoMarkedOnView.current = false;
      markedIds.clear();
      pendingIds.clear();
      if (timer) {
        clearTimeout(timer);
        scrollBatchTimerRef.current = null;
      }
    };
  }, []);

  // AUTO-MARK ON SCROLL: Mark individual calls as read when they scroll into view
  const handleCallVisible = useCallback(
    (callId: number) => {
      if (!autoMarkOnScroll) return;
      if (markedCallIds.current.has(callId)) return;
      if (fadingCallIds.has(callId)) return;
      if (pendingScrollMarkIds.current.has(callId)) return;

      const call = calls.find((c) => c.id === callId);
      if (call && !call.read) {
        markedCallIds.current.add(callId);
        queueScrollMark(callId);
      }
    },
    [autoMarkOnScroll, calls, fadingCallIds, queueScrollMark]
  );

  // Selection handlers
  const toggleCallSelection = useCallback((callId: number) => {
    setSelectedCalls((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(callId)) {
        newSet.delete(callId);
      } else {
        newSet.add(callId);
      }
      return newSet;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedCalls(new Set(calls.map((c) => c.id)));
  }, [calls]);

  const clearSelection = useCallback(() => {
    setSelectedCalls(new Set());
    setIsSelectionMode(false);
  }, []);

  // Call a number from history
  const handleCallFromHistory = useCallback(
    async (call: Call) => {
      if (!isRegistered) return;
      const numberToCall = call.direction === 'inbound' ? call.caller : call.callee;
      if (isOwnNumber(numberToCall, user?.senderPhone, user?.phoneNumbers)) {
        toast.error('You cannot call your own number');
        return;
      }
      try {
        await makeCall(numberToCall);
        router.push('/phone');
      } catch (err) {
        console.error('Failed to initiate call:', err);
      }
    },
    [isRegistered, makeCall, router, user?.senderPhone]
  );

  // Open the SMS conversation for a number from history.
  const handleMessageFromHistory = useCallback(
    (phoneNumber: string) => {
      router.push(`/phone/messages?phone=${encodeURIComponent(normalizePhone(phoneNumber))}`);
    },
    [router]
  );

  // Delete selected calls
  const handleDelete = useCallback(() => {
    if (selectedCalls.size === 0) return;
    const ids = Array.from(selectedCalls);
    const count = ids.length;
    setShowDeleteConfirm(false);
    clearSelection();
    deleteCalls.mutate(ids, {
      onSuccess: () => {
        toast.success(`${count} call record${count === 1 ? '' : 's'} deleted`);
        announce(`${count} call record${count === 1 ? '' : 's'} deleted`);
      },
      onError: () => {
        toast.error('Failed to delete call records');
      },
    });
  }, [selectedCalls, deleteCalls, clearSelection, announce]);

  // Confirm block from modal
  const handleConfirmBlock = useCallback(() => {
    if (!numberToBlock) return;
    blockContact.mutate(numberToBlock, {
      onSuccess: () => {
        toast.success('Number blocked');
        announce('Number blocked');
        setNumberToBlock(null);
      },
      onError: () => toast.error('Failed to block number'),
    });
  }, [numberToBlock, blockContact, announce]);

  // Unblock handler for table
  const handleUnblockNumber = useCallback(
    (blockedId: number) => {
      unblockContact.mutate(blockedId, {
        onSuccess: () => {
          toast.success('Number unblocked');
          announce('Number unblocked');
        },
        onError: () => toast.error('Failed to unblock number'),
      });
    },
    [unblockContact, announce]
  );

  // Save contact handler
  const handleSaveContact = useCallback(
    async (data: CreateContactInput) => {
      setSaveContactError(null);
      try {
        await createContact.mutateAsync({
          name: data.name,
          contact: data.contact,
          type: data.type,
          notes: data.notes || undefined,
        });
        toast.success(`Contact "${data.name}" saved`);
        announce(`Contact ${data.name} saved`);
        setSaveContactNumber(null);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to save contact';
        setSaveContactError(msg);
        throw err;
      }
    },
    [createContact, announce]
  );

  return (
    <PageTransition className="absolute inset-0 overflow-hidden">
      <div className="flex flex-col h-full min-h-0 bg-[var(--card)]">
        {/* Header + compact metrics (one block) */}
        <div className="border-b border-[var(--border)] shrink-0">
          <div className="flex items-center justify-between gap-3 px-5 pt-3.5 pb-2.5">
            <div className="flex items-center gap-3 min-w-0">
              <span className="grid place-items-center w-11 h-11 rounded-xl bg-[var(--primary-50)] dark:bg-[var(--primary-900)]/30 text-[var(--foreground)] shrink-0">
                <FiClock className="w-6 h-6" />
              </span>
              <div className="min-w-0">
                <h1 className="text-2xl font-black text-[var(--foreground)] truncate">
                  Call History
                </h1>
                <p className="text-sm text-[var(--muted-foreground)] mt-0.5">
                  View and manage your call records
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {/* Mark all as read button - shows when there are unread calls */}
              {unreadCount > 0 && !isSelectionMode && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleMarkAllAsRead}
                  disabled={markCallsAsRead.isPending}
                  className="text-blue-600 border-blue-200 hover:bg-blue-50 dark:text-blue-400 dark:border-blue-800 dark:hover:bg-blue-950"
                >
                  {markCallsAsRead.isPending ? (
                    <FiRefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <FiCheck className="w-4 h-4 mr-2" />
                  )}
                  Mark all read ({unreadCount})
                </Button>
              )}
              {isSelectionMode && selectedCalls.size > 0 && (
                <>
                  <span className="text-sm text-[var(--muted-foreground)]">
                    {selectedCalls.size} selected
                  </span>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => setShowDeleteConfirm(true)}
                    disabled={deleteCalls.isPending}
                  >
                    <FiTrash2 className="w-4 h-4 mr-2" />
                    Delete
                  </Button>
                </>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (isSelectionMode) {
                    clearSelection();
                  } else {
                    setIsSelectionMode(true);
                  }
                }}
              >
                {isSelectionMode ? (
                  <>
                    <FiX className="w-4 h-4 mr-2" />
                    Cancel
                  </>
                ) : (
                  <>
                    <FiCheckSquare className="w-4 h-4 mr-2" />
                    Select
                  </>
                )}
              </Button>
              <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
                <FiRefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>

          {/* Compact metrics — thin line merged into the header block */}
          {stats && (
            <div className="flex items-center gap-5 md:gap-7 px-5 pb-2.5 overflow-x-auto">
              <StatItem
                icon={<FiPhone className="w-4 h-4 text-[var(--foreground)]" />}
                value={stats.total}
                label="Total"
              />
              <span className="w-px h-4 bg-[var(--border)] shrink-0" />
              <StatItem
                icon={<FiPhoneIncoming className="w-4 h-4 text-green-600" />}
                value={stats.inbound}
                label="Inbound"
              />
              <StatItem
                icon={<FiPhoneOutgoing className="w-4 h-4 text-blue-600" />}
                value={stats.outbound}
                label="Outbound"
              />
              <StatItem
                icon={<FiPhoneMissed className="w-4 h-4 text-red-500" />}
                value={stats.missed}
                label="Missed"
              />
            </div>
          )}
          {/* Search + filters — part of the same header region */}
          <CallHistoryFilters
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            directionFilter={directionFilter}
            onDirectionFilterChange={setDirectionFilter}
            statusFilter={statusFilter}
            onStatusFilterChange={setStatusFilter}
            showFilters={showFilters}
            onToggleFilters={() => setShowFilters(!showFilters)}
          />
        </div>

        {/* Scrollable call list */}
        <div className="flex-1 overflow-auto min-h-0">
          <CallHistoryTable
            calls={calls}
            isLoading={isLoading}
            error={error}
            isFetching={isFetching}
            debouncedSearch={debouncedSearch}
            directionFilter={directionFilter}
            statusFilter={statusFilter}
            isSelectionMode={isSelectionMode}
            selectedCalls={selectedCalls}
            onToggleCallSelection={toggleCallSelection}
            onSelectAll={selectAll}
            onClearSelection={clearSelection}
            fadingCallIds={fadingCallIds}
            prefersReducedMotion={prefersReducedMotion}
            onCallVisible={handleCallVisible}
            onMarkAsRead={handleMarkAsRead}
            isRegistered={isRegistered}
            onCallFromHistory={handleCallFromHistory}
            onMessage={handleMessageFromHistory}
            blockedNumberSet={blockedNumberSet}
            blockedNumberMap={blockedNumberMap}
            onBlockNumber={setNumberToBlock}
            onUnblockNumber={handleUnblockNumber}
            onSaveContact={setSaveContactNumber}
            callsData={callsData}
            pagination={pagination}
            onRefetch={() => refetch()}
          />
        </div>

        {/* Delete Confirmation Modal */}
        <ConfirmModal
          isOpen={showDeleteConfirm}
          title="Delete Call Records"
          message={`Are you sure you want to delete ${selectedCalls.size} call record${selectedCalls.size === 1 ? '' : 's'}? This action cannot be undone.`}
          confirmText="Delete"
          variant="danger"
          loading={deleteCalls.isPending}
          onConfirm={handleDelete}
          onClose={() => setShowDeleteConfirm(false)}
        />

        {/* Block Number Confirmation Modal */}
        <ConfirmModal
          isOpen={!!numberToBlock}
          title="Block Number"
          message={`Block ${numberToBlock ? formatPhoneUS(numberToBlock) : ''}? Calls from this number will be rejected.`}
          confirmText="Block"
          variant="danger"
          loading={blockContact.isPending}
          onConfirm={handleConfirmBlock}
          onClose={() => setNumberToBlock(null)}
        />

        {/* Save Contact Modal */}
        <ContactFormModal
          isOpen={!!saveContactNumber}
          editingContact={null}
          defaultPhoneNumber={saveContactNumber}
          onSubmit={handleSaveContact}
          onClose={() => {
            setSaveContactNumber(null);
            setSaveContactError(null);
          }}
          isSaving={createContact.isPending}
          apiError={saveContactError}
          existingContacts={existingContacts}
        />
      </div>
    </PageTransition>
  );
}
