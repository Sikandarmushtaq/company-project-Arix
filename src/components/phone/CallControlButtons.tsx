'use client';

/**
 * CallControlButtons Component
 *
 * Primary and secondary action buttons for in-call controls:
 * mute, hold, keypad, record, add call, transfer, merge, split.
 *
 * @module components/phone/CallControlButtons
 */

import React, { useState } from 'react';
import {
  FiMic,
  FiMicOff,
  FiPause,
  FiPlay,
  FiPhoneForwarded,
  FiDisc,
  FiUsers,
  FiArrowRight,
  FiGrid,
  FiChevronDown,
  FiUserPlus,
  FiPhone,
} from 'react-icons/fi';
import { Button, Input } from '@/components/ui';
import { toast } from '@/lib/stores/toast';
import { formatPhoneUS } from '@/lib/utils/phone';
import type { CallLine } from '@/lib/sip/types';
import { dtmfKeys } from './KeypadOverlay';

// Strips everything except digits, *, #, + (used for phone number inputs)
const PHONE_INPUT_SANITIZE = /[^\d*#+]/g;

interface CallControlButtonsProps {
  activeLine: CallLine;
  lines: CallLine[];
  showKeypad: boolean;
  showTransferInput: boolean;
  showAddCallInput: boolean;
  userPhoneNumber?: string;
  onMuteToggle: () => void;
  onHoldToggle: () => void;
  onKeypadToggle: () => void;
  onRecordToggle: () => Promise<void>;
  onTransferToggle: () => void;
  onAddCallToggle: () => void;
  onMergeLines: () => Promise<void>;
  onSplitConference: () => void;
  onAddCall: (number: string) => Promise<void>;
}

export function CallControlButtons({
  activeLine,
  lines,
  showKeypad,
  showTransferInput,
  showAddCallInput,
  userPhoneNumber,
  onMuteToggle,
  onHoldToggle,
  onKeypadToggle,
  onRecordToggle,
  onTransferToggle,
  onAddCallToggle,
  onMergeLines,
  onSplitConference,
  onAddCall,
}: CallControlButtonsProps) {
  const [addCallNumber, setAddCallNumber] = useState('');

  // Check if we can merge (2+ calls active -- include 'holding' for race condition safety)
  const canMerge =
    lines.filter((l) => l.state === 'established' || l.state === 'held' || l.state === 'holding')
      .length >= 2;

  const handleAddCall = async () => {
    if (!addCallNumber) return;
    try {
      await onAddCall(addCallNumber);
      onAddCallToggle(); // close panel
      setAddCallNumber('');
    } catch (error) {
      console.error('Add call failed:', error);
      toast.error('Failed to place second call. Please try again.');
    }
  };

  const handleAddCallKeyPress = (key: string) => {
    setAddCallNumber((prev) => prev + key);
  };

  return (
    <>
      {/* Primary Actions Bar */}
      <div className="flex items-center justify-center gap-2 p-3 bg-gradient-to-r from-[var(--muted)]/80 to-[var(--muted)]/40 backdrop-blur-sm rounded-xl border border-[var(--border)]/50">
        {/* Mute */}
        <button
          onClick={onMuteToggle}
          aria-label={activeLine.isMuted ? 'Unmute microphone' : 'Mute microphone'}
          aria-pressed={activeLine.isMuted}
          className={`group relative flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm transition-all duration-200 ${
            activeLine.isMuted
              ? 'bg-red-500/15 text-red-600 dark:text-red-400 hover:bg-red-500/25 ring-1 ring-red-500/30'
              : 'bg-[var(--background)] text-[var(--foreground)] hover:bg-[var(--primary-100)] dark:hover:bg-[var(--primary-900)] shadow-sm'
          }`}
        >
          {activeLine.isMuted ? (
            <FiMicOff className="w-4 h-4" aria-hidden="true" />
          ) : (
            <FiMic className="w-4 h-4" aria-hidden="true" />
          )}
          <span className="hidden sm:inline" aria-hidden="true">
            {activeLine.isMuted ? 'Unmute' : 'Mute'}
          </span>
        </button>

        {/* Hold */}
        <button
          onClick={onHoldToggle}
          aria-label={activeLine.isHeld ? 'Resume call' : 'Put call on hold'}
          aria-pressed={activeLine.isHeld}
          className={`group relative flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm transition-all duration-200 ${
            activeLine.isHeld
              ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 hover:bg-amber-500/25 ring-1 ring-amber-500/30'
              : 'bg-[var(--background)] text-[var(--foreground)] hover:bg-[var(--primary-100)] dark:hover:bg-[var(--primary-900)] shadow-sm'
          }`}
        >
          {activeLine.isHeld ? (
            <FiPlay className="w-4 h-4" aria-hidden="true" />
          ) : (
            <FiPause className="w-4 h-4" aria-hidden="true" />
          )}
          <span className="hidden sm:inline" aria-hidden="true">
            {activeLine.isHeld ? 'Resume' : 'Hold'}
          </span>
        </button>

        {/* Divider */}
        <div className="w-px h-8 bg-[var(--border)]" />

        {/* Keypad */}
        <button
          onClick={onKeypadToggle}
          aria-label={showKeypad ? 'Hide dialpad' : 'Show dialpad'}
          aria-expanded={showKeypad}
          className={`group relative flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm transition-all duration-200 ${
            showKeypad
              ? 'bg-[var(--primary-600)] text-white hover:bg-[var(--primary-700)] shadow-md'
              : 'bg-[var(--background)] text-[var(--foreground)] hover:bg-[var(--primary-100)] dark:hover:bg-[var(--primary-900)] shadow-sm'
          }`}
        >
          <FiGrid className="w-4 h-4" aria-hidden="true" />
          <span className="hidden sm:inline" aria-hidden="true">
            Keypad
          </span>
          <FiChevronDown
            className={`w-3 h-3 transition-transform duration-200 ${showKeypad ? 'rotate-180' : ''}`}
            aria-hidden="true"
          />
        </button>

        {/* Record */}
        <button
          onClick={onRecordToggle}
          aria-label={activeLine.isRecording ? 'Stop recording' : 'Start recording'}
          aria-pressed={activeLine.isRecording}
          className={`group relative flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm transition-all duration-200 ${
            activeLine.isRecording
              ? 'bg-red-500 text-white hover:bg-red-600 shadow-md shadow-red-500/25'
              : 'bg-[var(--background)] text-[var(--foreground)] hover:bg-[var(--primary-100)] dark:hover:bg-[var(--primary-900)] shadow-sm'
          }`}
        >
          <FiDisc
            className={`w-4 h-4 ${activeLine.isRecording ? 'animate-pulse' : ''}`}
            aria-hidden="true"
          />
          <span className="hidden sm:inline" aria-hidden="true">
            {activeLine.isRecording ? 'Stop' : 'Record'}
          </span>
          {activeLine.isRecording && (
            <span className="flex h-2 w-2" aria-hidden="true">
              <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-white opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
            </span>
          )}
        </button>
      </div>

      {/* Secondary Actions Bar */}
      <div className="flex items-center justify-center gap-2 flex-wrap">
        {/* Add Call */}
        <button
          onClick={onAddCallToggle}
          aria-label={showAddCallInput ? 'Cancel adding call' : 'Add another call'}
          aria-expanded={showAddCallInput}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all duration-200 ${
            showAddCallInput
              ? 'bg-[var(--primary-600)] text-white hover:bg-[var(--primary-700)]'
              : 'bg-[var(--muted)] text-[var(--foreground)] hover:bg-[var(--primary-100)] dark:hover:bg-[var(--primary-900)]'
          }`}
        >
          <FiUserPlus className="w-4 h-4" aria-hidden="true" />
          <span aria-hidden="true">Add Call</span>
        </button>

        {/* Transfer */}
        <button
          onClick={onTransferToggle}
          aria-label={showTransferInput ? 'Cancel transfer' : 'Transfer call'}
          aria-expanded={showTransferInput}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all duration-200 ${
            showTransferInput
              ? 'bg-[var(--primary-600)] text-white hover:bg-[var(--primary-700)]'
              : 'bg-[var(--muted)] text-[var(--foreground)] hover:bg-[var(--primary-100)] dark:hover:bg-[var(--primary-900)]'
          }`}
        >
          <FiPhoneForwarded className="w-4 h-4" aria-hidden="true" />
          <span aria-hidden="true">Transfer</span>
        </button>

        {/* Merge */}
        <button
          onClick={onMergeLines}
          disabled={!canMerge}
          aria-label={
            canMerge
              ? 'Merge calls into conference'
              : 'Merge calls (requires 2 or more active calls)'
          }
          aria-disabled={!canMerge}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all duration-200 ${
            canMerge
              ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/25 ring-1 ring-emerald-500/30'
              : 'bg-[var(--muted)]/50 text-[var(--muted-foreground)] cursor-not-allowed opacity-50'
          }`}
        >
          <FiUsers className="w-4 h-4" aria-hidden="true" />
          <span aria-hidden="true">{canMerge ? 'Merge Calls' : 'Merge'}</span>
        </button>

        {/* Split Conference */}
        {activeLine.isInConference && (
          <button
            onClick={onSplitConference}
            aria-label="Split conference into separate calls"
            className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm bg-[var(--muted)] text-[var(--foreground)] hover:bg-[var(--primary-100)] dark:hover:bg-[var(--primary-900)] transition-all duration-200"
          >
            <FiArrowRight className="w-4 h-4" aria-hidden="true" />
            <span aria-hidden="true">Split</span>
          </button>
        )}
      </div>

      {/* Conference Participants */}
      {activeLine.isInConference && (
        <div className="overflow-hidden rounded-xl border border-emerald-200 dark:border-emerald-700 bg-gradient-to-r from-emerald-50 to-emerald-100/50 dark:from-emerald-900/30 dark:to-emerald-800/20 shadow-lg">
          <div className="p-3">
            <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 mb-2 flex items-center gap-1.5">
              <FiUsers className="w-3.5 h-3.5" />
              Conference Participants
            </p>
            <div className="space-y-1.5">
              {lines
                .filter((l) => l.isInConference)
                .map((l) => (
                  <div
                    key={l.id}
                    className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-[var(--background)]/80 text-sm"
                  >
                    <FiPhone className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span className="font-medium text-[var(--foreground)]">
                      {l.remoteName || formatPhoneUS(l.remoteNumber)}
                    </span>
                    {l.remoteName && (
                      <span className="text-xs text-[var(--muted-foreground)]">
                        {formatPhoneUS(l.remoteNumber)}
                      </span>
                    )}
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* Add Call Panel */}
      {showAddCallInput && (
        <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-gradient-to-b from-[var(--background)] to-[var(--muted)]/30 shadow-lg">
          <div className="p-4 space-y-3">
            <div className="text-center">
              <p className="text-sm font-medium text-[var(--foreground)]">Add Second Call</p>
              <p className="text-xs text-[var(--muted-foreground)]">
                Current call will be placed on hold
              </p>
              {userPhoneNumber && (
                <p className="text-xs text-[var(--muted-foreground)] mt-1">
                  Calling from {formatPhoneUS(userPhoneNumber)}
                </p>
              )}
            </div>

            {/* Number Input */}
            <div className="flex gap-2">
              <Input
                type="text"
                placeholder="Enter number to call..."
                value={addCallNumber}
                onChange={(e) => setAddCallNumber(e.target.value.replace(PHONE_INPUT_SANITIZE, ''))}
                className="flex-1 text-center text-lg font-semibold"
              />
              <Button
                variant="success"
                onClick={handleAddCall}
                disabled={!addCallNumber}
                className="px-4"
              >
                <FiPhone className="w-4 h-4" />
              </Button>
            </div>

            {/* Mini Dialpad */}
            <div className="grid grid-cols-3 gap-1.5 max-w-[220px] mx-auto">
              {dtmfKeys.flat().map((key) => (
                <button
                  key={key}
                  onClick={() => handleAddCallKeyPress(key)}
                  className="h-10 rounded-lg bg-[var(--background)] border border-[var(--border)] hover:border-[var(--primary-400)] hover:bg-[var(--primary-50)] dark:hover:bg-[var(--primary-900)]/50 transition-all duration-150 active:scale-[0.97]"
                >
                  <span className="text-base font-semibold text-[var(--foreground)]">{key}</span>
                </button>
              ))}
            </div>

            {/* Backspace */}
            <div className="flex justify-center">
              <button
                onClick={() => setAddCallNumber((prev) => prev.slice(0, -1))}
                disabled={!addCallNumber}
                className="px-6 py-1.5 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] disabled:opacity-50"
              >
                ← Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
