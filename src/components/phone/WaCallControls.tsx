'use client';

/**
 * WhatsApp Call Controls
 *
 * Shown during an active WhatsApp call. Provides mute, end call,
 * and recording controls. Duration timer updates live.
 *
 * @module components/phone/WaCallControls
 */

import React from 'react';
import { FiPhone, FiPhoneOff, FiMic, FiMicOff, FiDisc } from 'react-icons/fi';
import { FaWhatsapp } from 'react-icons/fa';
import { formatPhoneNumber } from '@/lib/utils/phone';
import { useContactDisplayName } from '@/lib/hooks/useContactName';
import type { WaCallState } from '@/lib/whatsapp-call/types';

interface WaCallControlsProps {
  state: WaCallState;
  onEndCall: () => void;
  onToggleMute: () => void;
  onStartRecording: () => void;
}

/**
 * Format seconds as MM:SS
 */
function formatDuration(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function WaCallControls({
  state,
  onEndCall,
  onToggleMute,
  onStartRecording,
}: WaCallControlsProps) {
  const displayName = useContactDisplayName(
    state.customerNumber ?? '',
    state.customerName ?? undefined
  );

  const isActive = state.status === 'active';
  const isConnecting = state.status === 'connecting';

  return (
    <div className="bg-[var(--card)] border rounded-xl p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center">
          <FaWhatsapp className="w-5 h-5 text-green-500" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium truncate">{displayName}</p>
          <p className="text-xs text-[var(--muted-foreground)]">
            {formatPhoneNumber(state.customerNumber ?? '')}
          </p>
        </div>
        <div className="text-right">
          {isConnecting && (
            <span className="text-sm text-yellow-600 dark:text-yellow-400">Connecting...</span>
          )}
          {isActive && (
            <span className="text-sm font-mono text-green-600 dark:text-green-400">
              {formatDuration(state.duration)}
            </span>
          )}
        </div>
      </div>

      {/* Status bar */}
      <div className="flex items-center gap-2">
        <div
          className={`w-2 h-2 rounded-full ${
            isActive ? 'bg-green-500 animate-pulse' : 'bg-yellow-500'
          }`}
        />
        <span className="text-xs text-[var(--muted-foreground)]">
          {isActive
            ? `WhatsApp call • ${state.direction === 'inbound' ? 'Inbound' : 'Outbound'}`
            : 'Connecting WhatsApp call...'}
        </span>
      </div>

      {/* Controls */}
      <div className="flex justify-center gap-4">
        {/* Mute */}
        <button
          type="button"
          onClick={onToggleMute}
          disabled={!isActive}
          className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
            state.isMuted
              ? 'bg-red-500/10 text-red-500'
              : 'bg-[var(--muted)] text-[var(--foreground)] hover:bg-[var(--muted)]/80'
          } disabled:opacity-50`}
          aria-label={state.isMuted ? 'Unmute' : 'Mute'}
          title={state.isMuted ? 'Unmute' : 'Mute'}
        >
          {state.isMuted ? <FiMicOff className="w-5 h-5" /> : <FiMic className="w-5 h-5" />}
        </button>

        {/* Record */}
        <button
          type="button"
          onClick={onStartRecording}
          disabled={!isActive || state.isRecording}
          className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
            state.isRecording
              ? 'bg-red-500 text-white animate-pulse'
              : 'bg-[var(--muted)] text-[var(--foreground)] hover:bg-[var(--muted)]/80'
          } disabled:opacity-50`}
          aria-label={state.isRecording ? 'Recording...' : 'Start recording'}
          title={state.isRecording ? 'Recording...' : 'Start recording'}
        >
          <FiDisc className="w-5 h-5" />
        </button>

        {/* End call */}
        <button
          type="button"
          onClick={onEndCall}
          className="w-12 h-12 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center transition-colors text-white"
          aria-label="End WhatsApp call"
          title="End call"
        >
          <FiPhoneOff className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
