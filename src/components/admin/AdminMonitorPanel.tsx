'use client';

/**
 * Admin Monitor Panel
 *
 * Professional monitoring panel for the admin header.
 * Shows SIP connection status and handles monitoring calls.
 *
 * Features:
 * - Connection status indicator in header
 * - Dropdown panel for call controls
 * - Auto-answer for monitoring calls
 * - Clean, integrated design
 *
 * @module components/admin/AdminMonitorPanel
 */

import React, { useEffect, useState, useRef } from 'react';
import {
  FiHeadphones,
  FiPhoneOff,
  FiMic,
  FiMicOff,
  FiVolume2,
  FiChevronDown,
  FiRefreshCw,
  FiX,
  FiAlertCircle,
} from 'react-icons/fi';
import { useSipConnection } from '@/lib/providers';
import { useSipStore } from '@/lib/stores/sip';
import {
  isMonitoringCall,
  detectMonitorMode,
  extractMonitorExtension,
  type MonitorMode,
} from '@/lib/utils/call-status';

/**
 * Format seconds to MM:SS
 */
function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Auto-answer configuration
 */
const AUTO_ANSWER_CONFIG = {
  /** Delay before auto-answering monitoring calls (ms) - kept short for seamless UX */
  DELAY_MS: 100,
} as const;

/**
 * Mode-specific styling and configuration
 */
const MODE_CONFIG: Record<
  MonitorMode,
  {
    label: string;
    description: string;
    badgeClass: string;
    Icon: React.ComponentType<{ className?: string }>;
    hasMic: boolean;
  }
> = {
  monitor: {
    label: 'Silent Monitor',
    description: 'You are listening silently. The parties cannot hear you.',
    badgeClass: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
    Icon: FiVolume2,
    hasMic: false,
  },
  whisper: {
    label: 'Whisper Mode',
    description: 'Only the agent can hear you. The caller cannot.',
    badgeClass: 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400',
    Icon: FiMic,
    hasMic: true,
  },
  barge: {
    label: 'Barge Mode',
    description: 'Both parties can hear you. You are in a 3-way call.',
    badgeClass: 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400',
    Icon: FiHeadphones,
    hasMic: true,
  },
};

/**
 * Connection status badge colors
 */
const STATUS_STYLES = {
  connected: {
    dot: 'bg-green-500',
    text: 'text-green-600 dark:text-green-400',
    bg: 'bg-green-50 dark:bg-green-900/20',
    label: 'Ready',
  },
  connecting: {
    dot: 'bg-yellow-500 animate-pulse',
    text: 'text-yellow-600 dark:text-yellow-400',
    bg: 'bg-yellow-50 dark:bg-yellow-900/20',
    label: 'Connecting',
  },
  disconnected: {
    dot: 'bg-gray-400',
    text: 'text-gray-500',
    bg: 'bg-gray-50 dark:bg-gray-800',
    label: 'Offline',
  },
  error: {
    dot: 'bg-red-500',
    text: 'text-red-600 dark:text-red-400',
    bg: 'bg-red-50 dark:bg-red-900/20',
    label: 'Error',
  },
};

/**
 * Default mode config for unknown call types
 */
const DEFAULT_MODE_CONFIG = {
  label: 'Monitoring Active',
  description: 'You are listening to the call. Click the red button to stop.',
  badgeClass: 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400',
  Icon: FiHeadphones,
  hasMic: false,
};

/**
 * Connecting Panel - displays while auto-answering monitoring call
 */
const ConnectingPanel = React.memo(function ConnectingPanel({
  callerName,
}: {
  callerName?: string;
}) {
  const mode = detectMonitorMode(callerName);
  const modeConfig = mode ? MODE_CONFIG[mode] : null;
  const ModeIcon = modeConfig?.Icon || FiHeadphones;

  return (
    <div className="text-center py-6">
      <div
        className={`inline-flex items-center justify-center w-12 h-12 rounded-full mb-3 ${
          modeConfig?.badgeClass || 'bg-green-100 dark:bg-green-900/30'
        }`}
      >
        <ModeIcon className="w-6 h-6" />
      </div>
      <div className="inline-block animate-spin rounded-full h-6 w-6 border-2 border-[var(--border)] border-t-transparent mb-3 ml-2" />
      <div className="font-medium text-[var(--foreground)]">
        Connecting to {modeConfig?.label || 'Monitor'}...
      </div>
      <p className="text-sm text-[var(--muted-foreground)] mt-1">Auto-answering monitoring call</p>
    </div>
  );
});

/**
 * Active Call Panel - displays active monitoring call UI with mode-specific controls
 */
const ActiveCallPanel = React.memo(function ActiveCallPanel({
  remoteName,
  remoteNumber,
  isMuted,
  duration,
  onToggleMute,
  onEndCall,
}: {
  remoteName?: string;
  remoteNumber?: string;
  isMuted: boolean;
  duration: number;
  onToggleMute: () => void;
  onEndCall: () => void;
}) {
  const mode = detectMonitorMode(remoteName);
  const modeConfig = mode ? MODE_CONFIG[mode] : DEFAULT_MODE_CONFIG;
  const extension = extractMonitorExtension(remoteName, remoteNumber);
  const ModeIcon = modeConfig.Icon;

  return (
    <div className="space-y-4">
      <div className="text-center">
        {/* Mode Badge */}
        <div
          className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium mb-3 ${modeConfig.badgeClass}`}
        >
          <ModeIcon className="w-4 h-4" />
          {modeConfig.label}
        </div>

        {/* Duration */}
        <div className="text-3xl font-mono font-bold text-[var(--foreground)]">
          {formatDuration(duration)}
        </div>

        {/* Target info */}
        <div className="text-sm text-[var(--muted-foreground)] mt-1">
          {extension ? `Extension ${extension}` : 'Unknown'}
        </div>
      </div>

      {/* Call Controls */}
      <div className="flex justify-center gap-4">
        {/* Mic button - only show for Whisper and Barge modes */}
        {modeConfig.hasMic && (
          <button
            onClick={onToggleMute}
            className={`p-3 rounded-full transition-all ${
              isMuted
                ? 'bg-red-100 dark:bg-red-900/30 text-red-600'
                : 'bg-[var(--muted)] text-[var(--foreground)] hover:bg-[var(--muted)]/80'
            }`}
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? <FiMicOff className="w-5 h-5" /> : <FiMic className="w-5 h-5" />}
          </button>
        )}

        {/* End call button */}
        <button
          onClick={onEndCall}
          className="p-3 bg-red-600 hover:bg-red-700 text-white rounded-full transition-colors"
          title="End Monitoring"
        >
          <FiPhoneOff className="w-5 h-5" />
        </button>
      </div>

      {/* Mode description */}
      <p className="text-xs text-center text-[var(--muted-foreground)]">{modeConfig.description}</p>
    </div>
  );
});

export function AdminMonitorPanel() {
  const { status, isReady, isConnecting, error, reconnect } = useSipConnection();
  const { lines, activeLineId, incomingCall, answerCall, endCall, muteCall, unmuteCall } =
    useSipStore();

  const [isOpen, setIsOpen] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const panelRef = useRef<HTMLDivElement>(null);
  const durationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoAnsweredLineRef = useRef<number | null>(null);

  /**
   * Get the active call line.
   * Primary: Use activeLineId from store (set when call is made/answered)
   * Fallback: Find any line in an active state (handles race conditions where
   * activeLineId isn't set before the UI renders)
   */
  const activeLine = lines.find((l) => l.id === activeLineId);
  const activeStateLines = lines.filter((l) =>
    ['established', 'ringing', 'connecting'].includes(l.state)
  );
  const effectiveLine = activeLine ?? activeStateLines[0];

  const isInCall = effectiveLine !== undefined;
  const isRinging = effectiveLine?.state === 'ringing';
  const isEstablished = effectiveLine?.state === 'established';

  // Get status styles
  const statusStyle = STATUS_STYLES[status] || STATUS_STYLES.disconnected;

  // Derived values for incoming call handling
  const ringingCallerName = incomingCall?.callerName || effectiveLine?.remoteName;
  const ringingCallerNumber = incomingCall?.callerNumber || effectiveLine?.remoteNumber;
  const isRingingMonitorCall = isRinging && isMonitoringCall(ringingCallerName);

  // Close panel on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        // Don't close if in a call
        if (!isInCall) {
          setIsOpen(false);
        }
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isInCall]);

  // Auto-open panel ONLY for monitoring calls or when in a monitoring call
  // Normal incoming calls are handled by ActiveCallIndicator
  useEffect(() => {
    const isMonitorCall = incomingCall && isMonitoringCall(incomingCall.callerName);
    const isActiveMonitorCall =
      isInCall && effectiveLine && isMonitoringCall(effectiveLine.remoteName);

    if (isMonitorCall || isActiveMonitorCall) {
      setIsOpen(true);
    }
  }, [incomingCall, isInCall, effectiveLine]);

  // Auto-answer monitoring calls (with guard to prevent multiple attempts)
  useEffect(() => {
    if (!incomingCall || !isRinging) return;
    if (autoAnsweredLineRef.current === incomingCall.lineId) return;
    if (!isMonitoringCall(incomingCall.callerName)) return;

    autoAnsweredLineRef.current = incomingCall.lineId;

    const timeoutId = setTimeout(() => {
      answerCall(incomingCall.lineId);
    }, AUTO_ANSWER_CONFIG.DELAY_MS);

    return () => clearTimeout(timeoutId);
  }, [incomingCall, isRinging, answerCall]);

  // Reset auto-answer ref when call ends
  useEffect(() => {
    if (!isInCall && autoAnsweredLineRef.current !== null) {
      autoAnsweredLineRef.current = null;
    }
  }, [isInCall]);

  // Update call duration
  useEffect(() => {
    if (isEstablished && effectiveLine?.answerTime) {
      const updateDuration = () => {
        const elapsed = Math.floor(
          (Date.now() - new Date(effectiveLine.answerTime!).getTime()) / 1000
        );
        setCallDuration(elapsed);
      };
      updateDuration();
      durationIntervalRef.current = setInterval(updateDuration, 1000);
    } else {
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
        durationIntervalRef.current = null;
      }
      setCallDuration(0);
    }

    return () => {
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }
    };
  }, [isEstablished, effectiveLine?.answerTime]);

  // Call action handlers
  const handleToggleMute = () => {
    if (!effectiveLine) return;
    if (effectiveLine.isMuted) {
      unmuteCall(effectiveLine.id);
    } else {
      muteCall(effectiveLine.id);
    }
  };

  const handleEndCall = () => {
    if (!effectiveLine) return;
    endCall(effectiveLine.id);
    setIsOpen(false);
  };

  const handleReconnect = async () => {
    await reconnect();
  };

  return (
    <div className="relative" ref={panelRef}>
      {/* Header Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`
          flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all
          ${isInCall ? 'bg-green-100 dark:bg-green-900/30 ring-2 ring-green-500' : statusStyle.bg}
          hover:opacity-80
        `}
      >
        {/* Status indicator */}
        <div className="relative">
          <FiHeadphones className={`w-4 h-4 ${isInCall ? 'text-green-600' : statusStyle.text}`} />
          <div
            className={`absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full ${
              isInCall ? 'bg-green-500 animate-pulse' : statusStyle.dot
            }`}
          />
        </div>

        {/* Label */}
        <span
          className={`text-sm font-medium hidden sm:inline ${
            isInCall ? 'text-green-600 dark:text-green-400' : statusStyle.text
          }`}
        >
          {isInCall ? formatDuration(callDuration) : statusStyle.label}
        </span>

        {/* Dropdown arrow */}
        <FiChevronDown
          className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''} ${
            isInCall ? 'text-green-600' : statusStyle.text
          }`}
        />
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-[var(--card)] border border-[var(--border)] rounded-xl shadow-xl z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)] bg-[var(--muted)]/30">
            <div className="flex items-center gap-2">
              <FiHeadphones className={`w-5 h-5 ${statusStyle.text}`} />
              <span className="font-medium">Monitor Phone</span>
            </div>
            {!isInCall && (
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 hover:bg-[var(--muted)] rounded-lg transition-colors"
              >
                <FiX className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Content */}
          <div className="p-4">
            {/* Monitoring call ringing: Show connecting panel (auto-answer in progress) */}
            {isRingingMonitorCall && <ConnectingPanel callerName={ringingCallerName} />}

            {/* Note: Non-monitoring incoming calls are handled by ActiveCallIndicator */}

            {/* Active Monitoring Call */}
            {isEstablished && effectiveLine && isMonitoringCall(effectiveLine.remoteName) && (
              <ActiveCallPanel
                remoteName={effectiveLine.remoteName}
                remoteNumber={effectiveLine.remoteNumber}
                isMuted={effectiveLine.isMuted}
                duration={callDuration}
                onToggleMute={handleToggleMute}
                onEndCall={handleEndCall}
              />
            )}

            {/* Connecting */}
            {effectiveLine?.state === 'connecting' && (
              <div className="text-center py-6">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-2 border-[var(--border)] border-t-transparent mb-3" />
                <div className="text-sm text-[var(--muted-foreground)]">Connecting to call...</div>
              </div>
            )}

            {/* Idle State */}
            {!isInCall && !incomingCall && (
              <div className="text-center py-4">
                {isReady ? (
                  <>
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 mb-3">
                      <FiHeadphones className="w-6 h-6 text-green-600" />
                    </div>
                    <div className="font-medium text-[var(--foreground)] mb-1">
                      Ready to Monitor
                    </div>
                    <p className="text-sm text-[var(--muted-foreground)]">
                      Click Monitor on any active call to listen in.
                    </p>
                  </>
                ) : status === 'error' ? (
                  <>
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 mb-3">
                      <FiAlertCircle className="w-6 h-6 text-red-600" />
                    </div>
                    <div className="font-medium text-[var(--foreground)] mb-1">
                      Connection Error
                    </div>
                    <p className="text-sm text-[var(--muted-foreground)] mb-3">
                      {error || 'Failed to connect to phone server'}
                    </p>
                    <button
                      onClick={handleReconnect}
                      disabled={isConnecting}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--primary-600)] hover:bg-[var(--primary-700)] text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                    >
                      <FiRefreshCw className={`w-4 h-4 ${isConnecting ? 'animate-spin' : ''}`} />
                      {isConnecting ? 'Reconnecting...' : 'Reconnect'}
                    </button>
                  </>
                ) : (
                  <>
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-[var(--muted)] mb-3">
                      <FiHeadphones className="w-6 h-6 text-[var(--muted-foreground)]" />
                    </div>
                    <div className="font-medium text-[var(--foreground)] mb-1">
                      {isConnecting ? 'Connecting...' : 'Phone Offline'}
                    </div>
                    <p className="text-sm text-[var(--muted-foreground)] mb-3">
                      {isConnecting
                        ? 'Establishing connection to phone server...'
                        : 'Phone connection required for monitoring.'}
                    </p>
                    {!isConnecting && (
                      <button
                        onClick={handleReconnect}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--primary-600)] hover:bg-[var(--primary-700)] text-white rounded-lg text-sm font-medium transition-colors"
                      >
                        <FiRefreshCw className="w-4 h-4" />
                        Connect
                      </button>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
