'use client';

/**
 * WhatsApp Incoming Call Modal
 *
 * Full-screen overlay when a WhatsApp call arrives. Shows caller info
 * with answer/reject buttons. Plays ringtone via callAudioService.
 *
 * @module components/phone/WaIncomingCallModal
 */

import React, { useEffect } from 'react';
import { FiPhone, FiPhoneOff } from 'react-icons/fi';
import { FaWhatsapp } from 'react-icons/fa';
import { callAudioService } from '@/lib/sip';
import { formatPhoneNumber } from '@/lib/utils/phone';
import { useContactDisplayName } from '@/lib/hooks/useContactName';

interface WaIncomingCallModalProps {
  customerNumber: string;
  customerName: string | null;
  onAnswer: () => void;
  onReject: () => void;
}

export function WaIncomingCallModal({
  customerNumber,
  customerName,
  onAnswer,
  onReject,
}: WaIncomingCallModalProps) {
  const displayName = useContactDisplayName(customerNumber, customerName ?? undefined);

  // Play ringtone on mount, stop on unmount
  useEffect(() => {
    callAudioService.playRingtone();
    return () => {
      callAudioService.stopRingtone();
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[var(--card)] rounded-2xl shadow-2xl p-8 max-w-sm w-full mx-4 text-center space-y-6 animate-in zoom-in-95 duration-200">
        {/* WhatsApp badge */}
        <div className="flex justify-center">
          <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center">
            <FaWhatsapp className="w-8 h-8 text-green-500" />
          </div>
        </div>

        {/* Caller info */}
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-wide text-[var(--muted-foreground)]">
            Incoming WhatsApp Call
          </p>
          <h2 className="text-xl font-semibold">{displayName}</h2>
          <p className="text-sm text-[var(--muted-foreground)]">
            {formatPhoneNumber(customerNumber)}
          </p>
        </div>

        {/* Pulsing ring animation */}
        <div className="flex justify-center">
          <div className="relative">
            <div className="w-4 h-4 bg-green-500 rounded-full" />
            <div className="absolute inset-0 w-4 h-4 bg-green-500 rounded-full animate-ping" />
          </div>
        </div>

        {/* Answer / Reject buttons */}
        <div className="flex justify-center gap-8">
          <button
            type="button"
            onClick={onReject}
            className="w-14 h-14 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center transition-colors"
            aria-label="Reject WhatsApp call"
          >
            <FiPhoneOff className="w-6 h-6 text-white" />
          </button>

          <button
            type="button"
            onClick={onAnswer}
            className="w-14 h-14 rounded-full bg-green-500 hover:bg-green-600 flex items-center justify-center transition-colors animate-pulse"
            aria-label="Answer WhatsApp call"
          >
            <FiPhone className="w-6 h-6 text-white" />
          </button>
        </div>
      </div>
    </div>
  );
}
