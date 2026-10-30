import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiX,
  FiPhone,
  FiMessageSquare,
  FiAlertTriangle,
  FiChevronDown,
} from 'react-icons/fi';
import { OrgNumberItem, OrgMemberOption } from './types';
import { NumberTypeBadge } from './NumberTypeBadge';
import { NumberStatusBadge } from './NumberStatusBadge';
import { NumberAssignmentSection } from './NumberAssignmentSection';
import { CallerIdSection } from './CallerIdSection';
import { formatPhoneUS } from '@/lib/utils/phone';
import { toast } from '@/lib/stores/toast';
import { useNumberHistory } from '@/lib/hooks/useOrg';

interface NumberDetailDrawerProps {
  number: OrgNumberItem | null;
  isOpen: boolean;
  onClose: () => void;
  members: OrgMemberOption[];
  onUpdateNumber: (
    updated: OrgNumberItem,
    options?: { importHistory?: boolean }
  ) => void;
}

export function NumberDetailDrawer({
  number,
  isOpen,
  onClose,
  members,
  onUpdateNumber,
}: NumberDetailDrawerProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [showTechDetails, setShowTechDetails] = useState(false);

  const { data: liveHistory } = useNumberHistory(
    isOpen && number ? number.id : null
  );

  if (!number) return null;

  const history = liveHistory ?? number.history;
  const numberWithHistory: OrgNumberItem = { ...number, history };

  const formatted = formatPhoneUS(number.phoneNumber);
  const locationText =
    [number.locality, number.region].filter(Boolean).join(', ') ||
    (number.countryCode === 'CA' ? 'Canada' : 'United States');
  const formattedDate = new Date(number.createdAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  // Handler: Assign / Reassign
  const handleAssignMember = (userId: number, importHistory = false) => {
    setIsProcessing(true);
    const assignedMember = members.find((m) => m.id === userId);

    const updated: OrgNumberItem = {
      ...number,
      assignedUserId: userId,
      assignedUserName: assignedMember?.fullName || 'Assigned User',
      assignedUserRole: assignedMember?.role || 'user',
      history: importHistory
        ? history
        : {
            ...history,
            // Only data that actually exists gets scheduled for deletion. A clean
            // number with no prior history must not show a phantom "pending
            // deletion" notice (mirrors the backend, which no longer schedules a
            // retirement when there's nothing to purge).
            pendingRetirement: history.hasHistory,
          },
    };

    setTimeout(() => {
      onUpdateNumber(updated, { importHistory });
      setIsProcessing(false);
      toast.success(
        `Number assigned to ${assignedMember?.fullName || 'team member'}${
          !importHistory && history.hasHistory ? ' (started clean)' : ''
        }`
      );
    }, 300);
  };

  // Handler: Unassign
  const handleUnassignMember = () => {
    setIsProcessing(true);
    const updated: OrgNumberItem = {
      ...number,
      assignedUserId: null,
      assignedUserName: null,
      assignedUserRole: undefined,
    };

    setTimeout(() => {
      onUpdateNumber(updated);
      setIsProcessing(false);
      toast.success(`${formatted} unassigned`);
    }, 300);
  };

  // Handler: Save Caller ID Name
  const handleSaveCallerId = (newName: string | null) => {
    setIsProcessing(true);
    const updated: OrgNumberItem = {
      ...number,
      callerIdName: newName,
    };

    setTimeout(() => {
      onUpdateNumber(updated);
      setIsProcessing(false);
      toast.success(
        newName
          ? `Caller ID name set to "${newName}"`
          : 'Caller ID name cleared'
      );
    }, 300);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Drawer Body */}
          <motion.div
            className="fixed right-0 top-0 z-50 flex h-full w-full max-w-xl flex-col bg-[var(--card)] shadow-2xl border-l border-[var(--border)]"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 400, damping: 38 }}
          >
            {/* Header */}
            <div className="flex shrink-0 items-center justify-between border-b border-[var(--border)] px-6 py-4">
              <div className="min-w-0 pr-3">
                <div className="flex items-center gap-2.5">
                  <h2 className="text-lg font-bold font-mono text-[var(--foreground)] truncate">
                    {formatted}
                  </h2>
                  <NumberStatusBadge status={number.isActive} />
                </div>
                <p className="text-xs text-[var(--muted-foreground)] mt-0.5 truncate capitalize">
                  {number.numberType.replace(/_/g, ' ')} · {number.countryCode}
                  {locationText && ` · ${locationText}`}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg p-2 text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)] transition-colors shrink-0"
                aria-label="Close drawer"
              >
                <FiX className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Body */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
              {/* SECTION: OVERVIEW (Compressed 2-column layout) */}
              <div className="space-y-2.5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--foreground)] border-b border-[var(--border)] pb-1.5">
                  Overview
                </h3>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2.5 rounded-xl bg-[var(--muted)]/20 border border-[var(--border)]">
                    <span className="text-[11px] font-medium text-[var(--muted-foreground)] block">
                      Phone Number
                    </span>
                    <span className="font-bold font-mono text-xs text-[var(--foreground)] mt-0.5 block truncate">
                      {formatted}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-[var(--muted)]/20 border border-[var(--border)]">
                    <span className="text-[11px] font-medium text-[var(--muted-foreground)] block">
                      Type
                    </span>
                    <div className="mt-0.5">
                      <NumberTypeBadge type={number.numberType} />
                    </div>
                  </div>

                  <div className="p-2.5 rounded-xl bg-[var(--muted)]/20 border border-[var(--border)]">
                    <span className="text-[11px] font-medium text-[var(--muted-foreground)] block">
                      Status
                    </span>
                    <div className="mt-0.5">
                      <NumberStatusBadge status={number.isActive} />
                    </div>
                  </div>

                  <div className="p-2.5 rounded-xl bg-[var(--muted)]/20 border border-[var(--border)]">
                    <span className="text-[11px] font-medium text-[var(--muted-foreground)] block">
                      Added Date
                    </span>
                    <span className="font-medium text-xs text-[var(--foreground)] mt-0.5 block">
                      {formattedDate}
                    </span>
                  </div>
                </div>
              </div>

              {/* SECTION: ASSIGNMENT */}
              <NumberAssignmentSection
                number={numberWithHistory}
                members={members}
                onAssignMember={handleAssignMember}
                onUnassignMember={handleUnassignMember}
                isProcessing={isProcessing}
              />

              {/* SECTION: CALLER ID */}
              <CallerIdSection
                key={`${number.id}-${number.callerIdName || 'none'}`}
                currentCallerId={number.callerIdName}
                onSaveCallerId={handleSaveCallerId}
                isSaving={isProcessing}
              />

              {/* SECTION: HISTORY */}
              {(() => {
                return (
                  <div className="space-y-2.5">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--foreground)] border-b border-[var(--border)] pb-1.5">
                      History
                    </h3>

                    {history.sms === 0 && history.calls === 0 ? (
                      /* Compact Zero-History State */
                      <div className="p-3 rounded-xl border border-[var(--border)] bg-[var(--card)] flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-zinc-400" />
                          <span className="font-semibold text-[var(--foreground)]">
                            No previous activity
                          </span>
                        </div>
                        <span className="text-[11px] text-[var(--muted-foreground)]">
                          0 messages · 0 voice calls
                        </span>
                      </div>
                    ) : (
                      /* Rich History Summary */
                      <div className="p-3.5 rounded-xl border border-[var(--border)] bg-[var(--card)] space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 grid place-items-center shrink-0">
                              <FiMessageSquare className="w-4 h-4" />
                            </div>
                            <div>
                              <span className="text-sm font-bold text-[var(--foreground)] block">
                                {history.sms}
                              </span>
                              <span className="text-[11px] text-[var(--muted-foreground)] block">
                                Messages
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 grid place-items-center shrink-0">
                              <FiPhone className="w-4 h-4" />
                            </div>
                            <div>
                              <span className="text-sm font-bold text-[var(--foreground)] block">
                                {history.calls}
                              </span>
                              <span className="text-[11px] text-[var(--muted-foreground)] block">
                                Voice Calls
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Pending retirement notice */}
                        {history.pendingRetirement && (
                          <div className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 text-xs text-amber-800 dark:text-amber-200">
                            <FiAlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                            <span>
                              Prior history scheduled for permanent deletion (30-day grace period).
                            </span>
                          </div>
                        )}

                        <p className="text-[11px] text-[var(--muted-foreground)] border-t border-[var(--border)]/60 pt-2">
                          Detailed call and message conversations are browsed inside the Phone workspace.
                        </p>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* SECTION: TECHNICAL DETAILS (Collapsible & non-sensitive) */}
              <div className="space-y-2 pt-1 border-t border-[var(--border)]/60">
                <button
                  type="button"
                  onClick={() => setShowTechDetails(!showTechDetails)}
                  className="flex items-center gap-1.5 text-xs font-semibold text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors py-1"
                >
                  <FiChevronDown
                    className={`w-3.5 h-3.5 transition-transform duration-200 ${
                      showTechDetails ? 'rotate-180' : ''
                    }`}
                  />
                  <span>{showTechDetails ? 'Hide technical details' : 'Show technical details'}</span>
                </button>

                {showTechDetails && (
                  <div className="p-3 rounded-xl border border-[var(--border)] bg-[var(--muted)]/15 text-xs space-y-2 animate-in fade-in duration-150">
                    <div className="flex items-center justify-between">
                      <span className="text-[var(--muted-foreground)]">E.164 Format</span>
                      <span className="font-mono font-medium text-[var(--foreground)]">
                        {number.phoneNumber}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
