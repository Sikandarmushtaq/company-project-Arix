'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiMic,
  FiMicOff,
  FiPause,
  FiPlay,
  FiPhoneForwarded,
  FiPhoneOff,
  FiDisc,
  FiUsers,
  FiArrowRight,
  FiX,
  FiCheck,
  FiDownload,
  FiGrid,
  FiUserPlus,
  FiPhone,
  FiVoicemail,
  FiArrowLeft,
  FiDelete,
} from 'react-icons/fi';
import { Button } from '@/components/ui';
import { toast } from '@/lib/stores/toast';
import { useSipStore } from '@/lib/stores/sip';
import { useVoicemailDrop } from '@/lib/hooks/useCallDisposition';
import { usePermissions } from '@/lib/hooks/usePermissions';
import { useContactDisplayName } from '@/lib/hooks';
import { formatDuration } from '@/lib/utils/formatting';
import { CallDisplay } from './CallDisplay';
import type { CallLine, CallStats } from '@/lib/sip/types';
import { formatPhoneUS } from '@/lib/utils/phone';

interface CallControlsProps {
  activeLine: CallLine;
  activeLineId: number;
  lines: CallLine[];
  lastRecording: Blob | null;
  showKeypad: boolean;
  userPhoneNumber?: string;
  onMuteToggle: () => void;
  onHoldToggle: () => void;
  holdBusy?: boolean;
  onHangUp: () => void;
  onRecordToggle: () => Promise<void>;
  onTransfer: (number: string, mode: 'blind' | 'attended') => Promise<void>;
  onCompleteAttendedTransfer: () => Promise<void>;
  onCancelAttendedTransfer: () => Promise<void>;
  onDownloadRecording: () => void;
  onKeypadToggle: () => void;
  onDTMF: (key: string) => void;
  onAddCall: (number: string) => Promise<void>;
  callDuration: number;
  /**
   * Seconds remaining before the agent may end this call (>0 = End is locked).
   * Anti-spam caller-ID guard: outbound, answered calls lock the End button for a
   * few seconds of talk time (ultra-short connected calls flag numbers as spam).
   * 0 for ringing/inbound/after the window — enforcement lives in handleHangUp.
   */
  endLockRemaining?: number;
  callStats?: CallStats;
  dtmfDigits?: string;
}

// Strips everything except digits, *, #, + (used for phone number inputs)
const PHONE_INPUT_SANITIZE = /[^\d*#+]/g;

// DTMF keypad keys
const dtmfKeys = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['*', '0', '#'],
];

// Sub-labels for DTMF keys
const keySubLabels: Record<string, string> = {
  '2': 'ABC',
  '3': 'DEF',
  '4': 'GHI',
  '5': 'JKL',
  '6': 'MNO',
  '7': 'PQRS',
  '8': 'TUV',
  '9': 'WXYZ',
};

// Panel animation props (reusable for slide-in panels)
const panelInitial = { opacity: 0, height: 0, scale: 0.95 };
const panelAnimate = {
  opacity: 1,
  height: 'auto' as string | number,
  scale: 1,
  transition: { duration: 0.3, ease: 'easeOut' as const },
};
const panelExit = {
  opacity: 0,
  height: 0,
  scale: 0.95,
  transition: { duration: 0.2, ease: 'easeIn' as const },
};

/** One control in the RingCentral-style grid — round icon button + label. */
type CtrlTone = 'red' | 'amber' | 'blue' | undefined;
function Ctrl({
  icon,
  label,
  onClick,
  tone,
  disabled,
  title,
  pressed,
  expanded,
  className,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  tone?: CtrlTone;
  disabled?: boolean;
  title?: string;
  pressed?: boolean;
  expanded?: boolean;
  className?: string;
}) {
  const toneCls =
    tone === 'red'
      ? 'bg-red-500/15 text-red-600 dark:text-red-400 ring-1 ring-red-500/30'
      : tone === 'amber'
        ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 ring-1 ring-amber-500/30'
        : tone === 'blue'
          ? 'bg-[var(--primary-600)] text-white'
          : 'bg-[var(--muted)] text-[var(--foreground)] hover:bg-[var(--primary-50)] dark:hover:bg-[var(--primary-900)]/40';
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-pressed={pressed}
      aria-expanded={expanded}
      className={`flex flex-col items-center gap-1.5 ${disabled ? 'opacity-40 cursor-not-allowed' : ''} ${className ?? ''}`}
    >
      <span
        className={`w-14 h-14 rounded-full grid place-items-center transition-colors [&_svg]:w-[22px] [&_svg]:h-[22px] ${toneCls}`}
      >
        {icon}
      </span>
      <span className="text-[11.5px] font-semibold text-[var(--muted-foreground)]">{label}</span>
    </button>
  );
}

/** Compact dialpad used by the Add-call and Transfer sub-panels. */
function MiniKeypad({ onKey }: { onKey: (k: string) => void }) {
  return (
    <div className="grid grid-cols-3 justify-items-center gap-x-5 gap-y-0 max-w-[264px] mx-auto">
      {dtmfKeys.flat().map((k) => {
        const sub = k === '0' ? '+' : keySubLabels[k] || '';
        return (
          <button
            key={k}
            type="button"
            onClick={() => onKey(k)}
            className="h-[48px] w-[48px] rounded-full flex flex-col items-center justify-center hover:bg-[var(--muted)] active:bg-[var(--border)] transition-colors"
          >
            <span className="text-[21px] font-normal leading-none text-[var(--foreground)]">{k}</span>
            <span className="h-[9px] text-[8.5px] font-medium tracking-[0.14em] text-[var(--muted-foreground)]">
              {sub}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** Transfer action (Ask first / Transfer / To voicemail). */
function TransferOpt({
  icon,
  label,
  onClick,
  disabled,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex flex-col items-center gap-1.5 ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
    >
      <span className="w-12 h-12 rounded-full bg-[var(--muted)] grid place-items-center text-[var(--foreground)] [&_svg]:w-5 [&_svg]:h-5">
        {icon}
      </span>
      <span className="text-[11px] font-semibold text-[var(--muted-foreground)] text-center leading-tight max-w-[64px]">
        {label}
      </span>
    </button>
  );
}

/**
 * In-Call Controls Component
 * Modern web softphone design with framer-motion animations
 */
export function CallControls({
  activeLine,
  activeLineId,
  lines,
  lastRecording,
  showKeypad,
  onMuteToggle,
  onHoldToggle,
  holdBusy = false,
  onHangUp,
  onRecordToggle,
  onTransfer,
  onCompleteAttendedTransfer,
  onCancelAttendedTransfer,
  onDownloadRecording,
  onKeypadToggle,
  onDTMF,
  onAddCall,
  callDuration,
  endLockRemaining = 0,
  callStats,
  dtmfDigits,
  userPhoneNumber,
}: CallControlsProps) {
  // Anti-spam guard (see prop docs): >0 → End is locked, show the countdown.
  const endLocked = endLockRemaining > 0;
  const attendedTransferLineId = useSipStore((s) => s.attendedTransferLineId);
  const suppressDispositionOnce = useSipStore((s) => s.suppressDispositionOnce);
  const clearDispositionSuppress = useSipStore((s) => s.clearDispositionSuppress);
  // Controls the active engine supports. LiveKit lacks hold/transfer/conference/
  // recording until 3e, so those controls disable when it's active (SIP.js = all
  // true → no change). The store actions also guard, so this is UX, not safety.
  const capabilities = useSipStore((s) => s.capabilities);
  const voicemailDrop = useVoicemailDrop();
  // Hide the whole disposition feature (incl. this button) when the tenant's
  // "Dispositions" module is off (the single master switch, entitlements grid).
  const { isModuleEnabled, isLoading: permsLoading } = usePermissions();
  const dispositionEnabled = !permsLoading && isModuleEnabled('dispositions');
  const [showTransferInput, setShowTransferInput] = useState(false);
  const [transferNumber, setTransferNumber] = useState('');
  const [showAddCallInput, setShowAddCallInput] = useState(false);
  const [addCallNumber, setAddCallNumber] = useState('');
  const displayName = useContactDisplayName(activeLine.remoteNumber, activeLine.remoteName);

  const doTransfer = async (mode: 'blind' | 'attended') => {
    if (!transferNumber) return;
    try {
      await onTransfer(transferNumber, mode);
      setShowTransferInput(false);
      setTransferNumber('');
    } catch (error) {
      console.error('Transfer failed:', error);
      toast.error('Call transfer failed. Please try again.');
    }
  };

  const handleAddCall = async () => {
    if (!addCallNumber) return;
    try {
      await onAddCall(addCallNumber);
      setShowAddCallInput(false);
      setAddCallNumber('');
    } catch (error) {
      console.error('Add call failed:', error);
      toast.error('Failed to place second call. Please try again.');
    }
  };

  const handleAddCallKeyPress = (key: string) => {
    setAddCallNumber((prev) => prev + key);
  };

  // Feature B — "Leave Voicemail & Drop": log the call as voicemail (server
  // records source='voicemail_drop', skips the C lockout, keeps the A flag),
  // suppress the post-call prompt for it, then hang up. On failure we still
  // hang up but let the normal disposition prompt appear.
  const handleVoicemailDrop = async () => {
    const callRecordId = activeLine.callRecordId;
    if (callRecordId != null) {
      // line.duration isn't finalized until hangup, so compute the live
      // talk-time from answerTime — otherwise a long voicemail-drop would log
      // 0s and never trip the audit flag.
      const liveDurationSecs = activeLine.answerTime
        ? Math.max(0, Math.floor((Date.now() - activeLine.answerTime.getTime()) / 1000))
        : activeLine.duration || 0;
      // Suppress the post-call prompt up-front, so a remote hangup landing during
      // the request doesn't pop a stray modal for a call we're already logging.
      suppressDispositionOnce(callRecordId);
      try {
        await voicemailDrop.mutateAsync({
          callId: callRecordId,
          clientDurationSecs: liveDurationSecs,
        });
      } catch {
        // Log failed (e.g. the call ran too long to drop as voicemail) — un-
        // suppress so the normal disposition prompt appears and the agent sets
        // the outcome properly.
        clearDispositionSuppress();
        toast.error('Could not log the voicemail. Please set the outcome after the call.');
      }
    }
    onHangUp();
  };

  const initials =
    displayName
      .trim()
      .split(/\s+/)
      .map((w) => w[0])
      .slice(0, 2)
      .join('')
      .toUpperCase() || '#';
  const isUnknownParty = displayName === activeLine.remoteNumber;
  // Compact active-call strip (dark navy bar) on top of the Add/Transfer takeovers.
  const callStrip = (
    <div className="flex items-center gap-3 mb-2 rounded-2xl bg-[#22304d] px-3 py-2 text-white">
      <div className="w-10 h-10 rounded-full bg-white/15 grid place-items-center shrink-0">
        {isUnknownParty ? (
          <FiPhone className="w-5 h-5 text-white" />
        ) : (
          <span className="text-[13px] font-bold">{initials}</span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-bold truncate">{isUnknownParty ? 'Unknown' : displayName}</div>
        <div className="text-xs text-white/70 tabular-nums">{formatDuration(callDuration)}</div>
      </div>
      <button
        type="button"
        onClick={onMuteToggle}
        aria-label={activeLine.isMuted ? 'Unmute' : 'Mute'}
        aria-pressed={activeLine.isMuted}
        className={`w-9 h-9 rounded-full grid place-items-center transition-colors ${
          activeLine.isMuted ? 'bg-red-500 text-white' : 'bg-white text-[#22304d] hover:bg-white/90'
        }`}
      >
        {activeLine.isMuted ? <FiMicOff className="w-4 h-4" /> : <FiMic className="w-4 h-4" />}
      </button>
      <button
        type="button"
        onClick={onHangUp}
        disabled={endLocked}
        aria-label={endLocked ? `You can end the call in ${endLockRemaining}s` : 'End call'}
        title={endLocked ? `You can end the call in ${endLockRemaining}s` : 'End call'}
        className={`w-9 h-9 rounded-full grid place-items-center ${endLocked ? 'bg-red-500/40 text-white/80 cursor-not-allowed' : 'bg-red-500 hover:bg-red-600 text-white'}`}
      >
        {endLocked ? (
          <span className="text-xs font-bold tabular-nums">{endLockRemaining}</span>
        ) : (
          <FiPhoneOff className="w-4 h-4" />
        )}
      </button>
    </div>
  );

  // Add-call takeover (matches 3.1): current call holds, place a second call.
  if (showAddCallInput) {
    return (
      <div className="flex flex-col h-full min-h-0">
        {callStrip}
        <div className="flex items-center justify-between mb-2">
          <b className="text-[15px] font-black text-[var(--foreground)]">New call</b>
          <button
            type="button"
            onClick={() => {
              setShowAddCallInput(false);
              setAddCallNumber('');
            }}
            aria-label="Cancel add call"
            className="w-8 h-8 grid place-items-center rounded-full text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
          >
            <FiX className="w-5 h-5" />
          </button>
        </div>
        {userPhoneNumber && (
          <div className="text-center text-[13px] text-[var(--muted-foreground)] mb-1">
            My caller ID:{' '}
            <b className="text-[var(--foreground)]">{formatPhoneUS(userPhoneNumber)}</b>
          </div>
        )}
        <input
          type="text"
          inputMode="tel"
          autoComplete="off"
          value={addCallNumber}
          onChange={(e) => setAddCallNumber(e.target.value.replace(PHONE_INPUT_SANITIZE, ''))}
          placeholder="Enter a name or number"
          aria-label="Number to add"
          className="phone-number-input w-full text-center text-[24px] bg-transparent border-0 border-b border-[var(--border)] focus:border-[var(--border)] outline-none py-1.5 mb-2 text-[var(--foreground)]"
        />
        <div className="flex-1 min-h-0 flex flex-col justify-center overflow-hidden">
          <MiniKeypad onKey={handleAddCallKeyPress} />
        </div>
        <div className="shrink-0 mt-1.5 flex items-center justify-between max-w-[300px] mx-auto">
          {/* left spacer — keeps the green Call button centered */}
          <div className="w-14 flex justify-start" aria-hidden />
          {/* Green call */}
          <button
            type="button"
            onClick={handleAddCall}
            disabled={!addCallNumber}
            aria-label="Place call"
            className="w-14 h-14 rounded-full bg-green-600 hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed text-white grid place-items-center shadow-lg shadow-green-600/30 transition-colors"
          >
            <FiPhone className="w-6 h-6" />
          </button>
          {/* Backspace */}
          <div className="w-14 flex justify-end">
            <button
              type="button"
              onClick={() => setAddCallNumber((prev) => prev.slice(0, -1))}
              aria-label="Delete last digit"
              className={`w-10 h-10 rounded-full grid place-items-center text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)] transition-colors ${
                addCallNumber.length === 0 ? 'invisible pointer-events-none' : ''
              }`}
            >
              <FiDelete className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Transfer takeover (matches 3.2): Ask first (attended) / Transfer (blind) / To voicemail.
  if (showTransferInput) {
    return (
      <div className="flex flex-col h-full min-h-0">
        <div className="flex items-center gap-2 mb-3">
          <button
            type="button"
            onClick={() => {
              setShowTransferInput(false);
              setTransferNumber('');
            }}
            aria-label="Back"
            className="w-8 h-8 grid place-items-center rounded-full text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
          >
            <FiArrowLeft className="w-5 h-5" />
          </button>
          <b className="text-[15px] font-black text-[var(--foreground)]">Transfer</b>
        </div>
        <input
          type="text"
          inputMode="tel"
          autoComplete="off"
          value={transferNumber}
          onChange={(e) => setTransferNumber(e.target.value.replace(PHONE_INPUT_SANITIZE, ''))}
          placeholder="Enter a name or number"
          aria-label="Transfer destination"
          className="phone-number-input w-full text-center text-[24px] bg-transparent border-0 border-b border-[var(--border)] focus:border-[var(--border)] outline-none py-1.5 mb-2 text-[var(--foreground)]"
        />
        <div className="flex-1 min-h-0 flex flex-col justify-center overflow-hidden">
          <MiniKeypad onKey={(k) => setTransferNumber((prev) => prev + k)} />
        </div>
        <div className="shrink-0 flex items-start justify-center gap-7 pt-3">
          {capabilities.attendedTransfer && (
            <TransferOpt
              icon={<FiUsers />}
              label="Ask first"
              onClick={() => doTransfer('attended')}
              disabled={!transferNumber}
            />
          )}
          <TransferOpt
            icon={<FiArrowRight />}
            label="Transfer"
            onClick={() => doTransfer('blind')}
            disabled={!transferNumber}
          />
          {dispositionEnabled && (
            <TransferOpt icon={<FiVoicemail />} label="To voicemail" onClick={handleVoicemailDrop} />
          )}
        </div>
      </div>
    );
  }

  // Keypad takeover (matches 4Keypad): DTMF keypad replaces the control grid.
  if (showKeypad) {
    return (
      <div className="space-y-2">
        <CallDisplay
          activeLine={activeLine}
          callDuration={callDuration}
          callStats={callStats}
          dtmfDigits={dtmfDigits}
          compact={lines.length >= 2 || !!activeLine.isInConference}
          userPhoneNumber={userPhoneNumber}
        />
        <MiniKeypad onKey={onDTMF} />
        <div className="mt-3 flex items-center justify-between max-w-[300px] mx-auto">
          <div className="w-16" />
          <button
            type="button"
            onClick={onHangUp}
            disabled={endLocked}
            aria-label={endLocked ? `You can end the call in ${endLockRemaining}s` : 'End current call'}
            title={endLocked ? `You can end the call in ${endLockRemaining}s` : 'End current call'}
            className={`w-16 h-16 rounded-full grid place-items-center shadow-lg shadow-red-500/30 transition-colors ${endLocked ? 'bg-red-500/40 text-white/80 cursor-not-allowed' : 'bg-red-500 hover:bg-red-600 text-white'}`}
          >
            {endLocked ? (
              <span className="text-xl font-bold tabular-nums">{endLockRemaining}</span>
            ) : (
              <FiPhoneOff className="w-7 h-7" />
            )}
          </button>
          <div className="w-16 flex justify-end">
            <button
              type="button"
              onClick={onKeypadToggle}
              title="Hide keypad"
              aria-label="Hide keypad"
              aria-expanded={true}
              className="w-11 h-11 rounded-full grid place-items-center text-[var(--foreground)] bg-[var(--primary-50)] dark:bg-[var(--primary-900)]/40 hover:bg-[var(--muted)] transition-colors"
            >
              <FiGrid className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <CallDisplay
        activeLine={activeLine}
        callDuration={callDuration}
        callStats={callStats}
        dtmfDigits={dtmfDigits}
        compact={lines.length >= 2 || !!activeLine.isInConference}
        userPhoneNumber={userPhoneNumber}
      />
      {/* Control grid — RingCentral-style round icon buttons */}
      <div className="grid grid-cols-3 gap-x-2 gap-y-2 max-w-[290px] mx-auto py-0.5">
        <Ctrl
          icon={activeLine.isMuted ? <FiMicOff /> : <FiMic />}
          label={activeLine.isMuted ? 'Unmute' : 'Mute'}
          onClick={onMuteToggle}
          tone={activeLine.isMuted ? 'red' : undefined}
          pressed={activeLine.isMuted}
        />
        <Ctrl
          icon={<FiGrid />}
          label="Keypad"
          onClick={onKeypadToggle}
          tone={showKeypad ? 'blue' : undefined}
          pressed={showKeypad}
          expanded={showKeypad}
        />
        <Ctrl
          icon={activeLine.isHeld ? <FiPlay /> : <FiPause />}
          label={activeLine.isHeld ? 'Resume' : 'Hold'}
          onClick={onHoldToggle}
          tone={activeLine.isHeld ? 'amber' : undefined}
          disabled={!capabilities.hold || holdBusy}
          title={!capabilities.hold ? 'Hold is not available on this call' : undefined}
          pressed={activeLine.isHeld}
        />
        <Ctrl
          icon={<FiUserPlus />}
          label="Add"
          onClick={() => {
            setShowAddCallInput(!showAddCallInput);
            setShowTransferInput(false);
          }}
          tone={showAddCallInput ? 'blue' : undefined}
          disabled={!capabilities.conference && !capabilities.attendedTransfer}
          expanded={showAddCallInput}
        />
        <Ctrl
          icon={<FiPhoneForwarded />}
          label="Transfer"
          onClick={() => {
            setShowTransferInput(!showTransferInput);
            setShowAddCallInput(false);
          }}
          tone={showTransferInput ? 'blue' : undefined}
          disabled={!capabilities.transfer}
          title={!capabilities.transfer ? 'Transfer is not available on this call' : undefined}
          expanded={showTransferInput}
        />
        <Ctrl
          icon={<FiDisc className={activeLine.isRecording ? 'animate-pulse' : ''} />}
          label={activeLine.isRecording ? 'Stop' : 'Record'}
          onClick={onRecordToggle}
          tone={activeLine.isRecording ? 'red' : undefined}
          disabled={!capabilities.recording}
          title={!capabilities.recording ? 'Recording is not available on this call' : undefined}
          pressed={activeLine.isRecording}
        />
      </div>

      {/* Merge / Split and the multi-call summary now live in the top MultiCallStrip. */}

      {/* Attended Transfer In Progress */}
      <AnimatePresence>
        {attendedTransferLineId && (
          <motion.div
            initial={panelInitial}
            animate={panelAnimate}
            exit={panelExit}
            className="overflow-hidden rounded-xl border border-amber-200 dark:border-amber-700 bg-gradient-to-r from-amber-50 to-amber-100/50 dark:from-amber-900/30 dark:to-amber-800/20 shadow-lg"
          >
            <div className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">
                    Attended Transfer in Progress
                  </p>
                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
                    Speaking with transfer target
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="success"
                    size="sm"
                    onClick={onCompleteAttendedTransfer}
                    className="shadow-sm"
                  >
                    <FiCheck className="w-4 h-4 mr-1" />
                    Complete
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={onCancelAttendedTransfer}
                    className="shadow-sm"
                  >
                    <FiX className="w-4 h-4 mr-1" />
                    Cancel
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Download Recording */}
      <AnimatePresence>
        {lastRecording && (
          <motion.button
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onDownloadRecording}
            aria-label="Download call recording"
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-medium text-sm hover:from-emerald-600 hover:to-emerald-700 transition-colors duration-200 shadow-md hover:shadow-lg"
          >
            <FiDownload className="w-5 h-5" aria-hidden="true" />
            <span>Download Recording</span>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Leave Voicemail & Drop (feature B) — hidden when QA is off for the tenant */}
      {dispositionEnabled && (
        <motion.button
          whileHover={{ scale: 1.02, y: -1 }}
          whileTap={{ scale: 0.96 }}
          onClick={handleVoicemailDrop}
          disabled={voicemailDrop.isPending}
          aria-label="Leave voicemail and drop the call"
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 text-white font-semibold hover:from-amber-600 hover:to-amber-700 transition-colors duration-200 shadow-lg shadow-amber-500/20 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <FiVoicemail className="w-5 h-5" aria-hidden="true" />
          <span>{voicemailDrop.isPending ? 'Logging…' : 'Leave Voicemail & Drop'}</span>
        </motion.button>
      )}

      {/* End Call — round red */}
      <div className="flex justify-center pt-2">
        <motion.button
          whileHover={endLocked ? undefined : { scale: 1.05 }}
          whileTap={endLocked ? undefined : { scale: 0.95 }}
          onClick={onHangUp}
          disabled={endLocked}
          aria-label={endLocked ? `You can end the call in ${endLockRemaining}s` : 'End current call'}
          title={endLocked ? `You can end the call in ${endLockRemaining}s` : 'End current call'}
          className={`w-16 h-16 rounded-full grid place-items-center shadow-lg shadow-red-500/30 transition-colors ${endLocked ? 'bg-red-500/40 text-white/80 cursor-not-allowed' : 'bg-red-500 hover:bg-red-600 text-white'}`}
        >
          {endLocked ? (
            <span className="text-xl font-bold tabular-nums" aria-hidden="true">{endLockRemaining}</span>
          ) : (
            <FiPhoneOff className="w-7 h-7" aria-hidden="true" />
          )}
        </motion.button>
      </div>
    </div>
  );
}
