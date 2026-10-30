'use client';

/**
 * TransferPanel Component
 *
 * Transfer dialog with blind and attended transfer modes,
 * plus attended transfer in-progress indicator.
 *
 * @module components/phone/TransferPanel
 */

import React, { useState } from 'react';
import { FiCheck, FiX } from 'react-icons/fi';
import { Button, Input } from '@/components/ui';
import { toast } from '@/lib/stores/toast';
import { formatPhoneUS } from '@/lib/utils/phone';

// Strips everything except digits, *, #, + (used for phone number inputs)
const PHONE_INPUT_SANITIZE = /[^\d*#+]/g;

interface TransferPanelProps {
  showTransferInput: boolean;
  userPhoneNumber?: string;
  onTransfer: (number: string, mode: 'blind' | 'attended') => Promise<void>;
  onClose: () => void;
}

export function TransferPanel({
  showTransferInput,
  userPhoneNumber,
  onTransfer,
  onClose,
}: TransferPanelProps) {
  const [transferNumber, setTransferNumber] = useState('');
  const [transferMode, setTransferMode] = useState<'blind' | 'attended'>('blind');

  const handleTransfer = async () => {
    if (!transferNumber) return;
    try {
      await onTransfer(transferNumber, transferMode);
      onClose();
      setTransferNumber('');
    } catch (error) {
      console.error('Transfer failed:', error);
      toast.error('Call transfer failed. Please try again.');
    }
  };

  if (!showTransferInput) return null;

  return (
    <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-gradient-to-b from-[var(--background)] to-[var(--muted)]/30 shadow-lg">
      <div className="p-4 space-y-3">
        {/* Transfer Mode Tabs */}
        <div className="flex p-1 bg-[var(--muted)] rounded-lg">
          <button
            onClick={() => setTransferMode('blind')}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all duration-200 ${
              transferMode === 'blind'
                ? 'bg-[var(--background)] text-[var(--foreground)] shadow-sm'
                : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
            }`}
          >
            Blind Transfer
          </button>
          <button
            onClick={() => setTransferMode('attended')}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all duration-200 ${
              transferMode === 'attended'
                ? 'bg-[var(--background)] text-[var(--foreground)] shadow-sm'
                : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
            }`}
          >
            Attended Transfer
          </button>
        </div>

        {userPhoneNumber && (
          <p className="text-xs text-[var(--muted-foreground)] text-center">
            Transferring from {formatPhoneUS(userPhoneNumber)}
          </p>
        )}

        {/* Transfer Input */}
        <div className="flex gap-2">
          <Input
            type="text"
            placeholder="Enter destination number..."
            value={transferNumber}
            onChange={(e) =>
              setTransferNumber(e.target.value.replace(PHONE_INPUT_SANITIZE, ''))
            }
            className="flex-1"
          />
          <Button
            variant="primary"
            onClick={handleTransfer}
            disabled={!transferNumber}
            className="px-6"
          >
            {transferMode === 'blind' ? 'Transfer' : 'Consult'}
          </Button>
        </div>

        {/* Transfer Mode Description */}
        <p className="text-xs text-[var(--muted-foreground)] text-center px-2">
          {transferMode === 'blind'
            ? 'The call will be transferred immediately to the destination'
            : 'You will speak with the destination before completing the transfer'}
        </p>
      </div>
    </div>
  );
}

/**
 * AttendedTransferInProgress Component
 *
 * Shows when an attended transfer consultation call is active.
 */
interface AttendedTransferInProgressProps {
  isVisible: boolean;
  onComplete: () => Promise<void>;
  onCancel: () => Promise<void>;
}

export function AttendedTransferInProgress({
  isVisible,
  onComplete,
  onCancel,
}: AttendedTransferInProgressProps) {
  if (!isVisible) return null;

  return (
    <div className="overflow-hidden rounded-xl border border-amber-200 dark:border-amber-700 bg-gradient-to-r from-amber-50 to-amber-100/50 dark:from-amber-900/30 dark:to-amber-800/20 shadow-lg">
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
              onClick={onComplete}
              className="shadow-sm"
            >
              <FiCheck className="w-4 h-4 mr-1" />
              Complete
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={onCancel}
              className="shadow-sm"
            >
              <FiX className="w-4 h-4 mr-1" />
              Cancel
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
