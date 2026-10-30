'use client';

/**
 * Active Call Indicator
 *
 * Persistent floating component that shows when there's an active call.
 * Displayed across all pages in the phone layout.
 *
 * @module components/phone/ActiveCallIndicator
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import {
  FiPhone,
  FiPhoneOff,
  FiPhoneIncoming,
  FiMic,
  FiMicOff,
  FiPause,
  FiPlay,
  FiChevronUp,
  FiChevronDown,
  FiWifi,
  FiWifiOff,
  FiLoader,
} from 'react-icons/fi';
import { useSipStore } from '@/lib/stores/sip';
import { formatPhoneNumber } from '@/lib/utils/formatting';
import { useContactDisplayName, useContactName } from '@/lib/hooks';
import { useAuthStore } from '@/lib/stores';
import { getDisplayPhone } from '@/lib/utils/privacy';
import { isMonitoringCall } from '@/lib/utils/call-status';

/**
 * Format duration as MM:SS or HH:MM:SS
 */
function formatDuration(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Get call state display info
 */
function getCallStateInfo(state: string): { text: string; color: string } {
  switch (state) {
    case 'dialing':
      return { text: 'Dialing...', color: 'text-yellow-500' };
    case 'ringing':
      return { text: 'Ringing...', color: 'text-yellow-500' };
    case 'connecting':
      return { text: 'Connecting...', color: 'text-yellow-500' };
    case 'established':
      return { text: 'In Call', color: 'text-green-500' };
    case 'holding':
    case 'held':
      return { text: 'On Hold', color: 'text-orange-500' };
    default:
      return { text: state, color: 'text-gray-500' };
  }
}

export function ActiveCallIndicator() {
  const router = useRouter();
  const pathname = usePathname();
  const [isExpanded, setIsExpanded] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const durationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const {
    lines,
    activeLineId,
    incomingCall,
    isAnswering,
    isOnline,
    connectionState,
    muteCall,
    unmuteCall,
    holdCall,
    unholdCall,
    endCall,
    answerCall,
    rejectCall,
    isHoldBusy,
  } = useSipStore();

  // Get active line - must be before any conditional returns
  const activeLine = useMemo(() => {
    return lines.find((l) => l.id === activeLineId);
  }, [lines, activeLineId]);

  // Check if in an active call state
  const isInCall = useMemo(() => {
    return (
      activeLine &&
      ['dialing', 'ringing', 'connecting', 'established', 'holding', 'held'].includes(
        activeLine.state
      )
    );
  }, [activeLine]);

  // Check if on phone page
  const isOnPhonePage = pathname === '/phone';
  // The DialerTopBar renders on every /phone/* route and now owns the incoming-
  // call UI (a compact top-bar pill). Suppress this floating incoming card
  // anywhere the top bar is present so inbound isn't shown twice. Admin pages
  // (no DialerTopBar) still use this card.
  const isOnDialerPage = !!pathname && pathname.startsWith('/phone');

  // Check if this is a monitoring call (handled by AdminMonitorPanel, not here)
  const isIncomingMonitorCall = isMonitoringCall(incomingCall?.callerName);
  const isActiveMonitorCall = isMonitoringCall(activeLine?.remoteName);

  // Determine what to show (exclude monitoring calls - they use AdminMonitorPanel)
  const showActiveCall = isInCall && !isOnPhonePage && !isActiveMonitorCall;
  const showIncomingCall = incomingCall && !isOnDialerPage && !isIncomingMonitorCall;
  const shouldRender = showActiveCall || showIncomingCall;

  // SSOT: Get contact display names (hooks must be called unconditionally)
  const incomingCallerName = useContactDisplayName(
    incomingCall?.callerNumber || '',
    incomingCall?.callerName
  );
  const activeCallName = useContactDisplayName(
    activeLine?.remoteNumber || '',
    activeLine?.remoteName
  );

  // Privacy support — see useContactDisplayName + lib/utils/privacy.
  // Real-contact detection (used for the "show phone below name" line)
  // must check the contact lookup directly, not `displayName !== phone`,
  // because in privacy mode displayName is a masked stub that is never
  // equal to the raw phone — the comparison would falsely report a
  // contact and the secondary line would leak the raw number.
  const incomingSavedContact = useContactName(incomingCall?.callerNumber || '');
  const isMasked = useAuthStore((s) => !!s.user?.waPhoneMaskEnabled);

  // Update call duration - hook always runs, but logic is conditional
  useEffect(() => {
    if (activeLine?.state === 'established' && activeLine.startTime) {
      durationIntervalRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - new Date(activeLine.startTime!).getTime()) / 1000);
        setCallDuration(elapsed);
      }, 1000);
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
  }, [activeLine?.state, activeLine?.startTime]);

  // Handlers
  const handleMuteToggle = useCallback(() => {
    if (!activeLineId) return;
    if (activeLine?.isMuted) {
      unmuteCall(activeLineId);
    } else {
      muteCall(activeLineId);
    }
  }, [activeLineId, activeLine?.isMuted, muteCall, unmuteCall]);

  const handleHoldToggle = useCallback(async () => {
    if (!activeLineId) return;
    if (activeLine?.isHeld) {
      await unholdCall(activeLineId);
    } else {
      await holdCall(activeLineId);
    }
  }, [activeLineId, activeLine?.isHeld, holdCall, unholdCall]);

  const handleEndCall = useCallback(async () => {
    if (activeLineId) {
      await endCall(activeLineId);
    }
  }, [activeLineId, endCall]);

  const handleAnswerIncoming = useCallback(async () => {
    // Store handles double-click protection via isAnswering state
    if (incomingCall) {
      await answerCall(incomingCall.lineId);
    }
  }, [incomingCall, answerCall]);

  const handleRejectIncoming = useCallback(async () => {
    if (incomingCall) {
      await rejectCall(incomingCall.lineId);
    }
  }, [incomingCall, rejectCall]);

  const handleGoToPhone = useCallback(() => {
    router.push('/phone');
  }, [router]);

  // Don't render if nothing to show
  if (!shouldRender) {
    return null;
  }

  // Show incoming call UI
  if (showIncomingCall && incomingCall) {
    // SSOT: Use resolved contact name, show phone number below if we have a name
    const hasContactName = !!(incomingSavedContact || incomingCall.callerName);

    return (
      <div className="fixed bottom-4 right-4 z-50 animate-in slide-in-from-bottom-4 duration-300">
        <div className="bg-[var(--card)] border-2 border-green-500 rounded-xl shadow-2xl w-80 overflow-hidden">
          {/* Incoming call header */}
          <div className="bg-green-500/20 p-4">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-12 h-12 rounded-full bg-green-500 flex items-center justify-center animate-pulse">
                  <FiPhoneIncoming className="w-6 h-6 text-white" />
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-green-600 dark:text-green-400 font-medium">
                  Incoming Call
                </p>
                <p className="font-semibold text-[var(--foreground)] truncate">
                  {incomingCallerName}
                </p>
                {hasContactName && (
                  <p className="text-sm text-[var(--muted-foreground)]">
                    {getDisplayPhone(incomingCall.callerNumber, isMasked)}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="p-4 flex items-center gap-3">
            <button
              onClick={handleRejectIncoming}
              disabled={isAnswering}
              className="flex-1 py-3 px-4 rounded-lg bg-red-500 text-white hover:bg-red-600 transition-colors font-medium flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FiPhoneOff className="w-5 h-5" />
              Decline
            </button>
            <button
              onClick={handleAnswerIncoming}
              disabled={isAnswering}
              className="flex-1 py-3 px-4 rounded-lg bg-green-500 text-white hover:bg-green-600 transition-colors font-medium flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isAnswering ? (
                <FiLoader className="w-5 h-5 animate-spin" />
              ) : (
                <FiPhone className="w-5 h-5" />
              )}
              {isAnswering ? 'Connecting...' : 'Answer'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Show active call UI
  if (showActiveCall && activeLine) {
    // SSOT: Use resolved contact name
    const stateInfo = getCallStateInfo(activeLine.state);

    // Only show reconnecting if we're actually disconnected/connecting AND the call isn't established
    // If the call is established, the WebRTC connection is still active even if SIP registration is reconnecting
    const isReconnecting = connectionState === 'connecting' && activeLine.state !== 'established';

    return (
      <div className="fixed bottom-4 right-4 z-50 animate-in slide-in-from-bottom-4 duration-300">
        <div
          className={`
            bg-[var(--card)] border border-[var(--border)] rounded-xl shadow-2xl
            transition-all duration-300 overflow-hidden
            ${isExpanded ? 'w-80' : 'w-72'}
          `}
        >
          {/* Header */}
          <div
            className={`
              flex items-center gap-3 p-3 cursor-pointer
              ${activeLine.state === 'established' ? 'bg-green-500/10' : 'bg-yellow-500/10'}
            `}
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {/* Status indicator */}
            <div className="relative flex-shrink-0">
              <div
                className={`
                  w-10 h-10 rounded-full flex items-center justify-center
                  ${activeLine.state === 'established' ? 'bg-green-500' : 'bg-yellow-500'}
                `}
              >
                <FiPhone className="w-5 h-5 text-white" />
              </div>
              {activeLine.state === 'established' && (
                <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-green-400 rounded-full animate-ping" />
              )}
            </div>

            {/* Call info */}
            <div className="flex-1 min-w-0">
              <p className="font-medium text-[var(--foreground)] truncate">{activeCallName}</p>
              <div className="flex items-center gap-2 text-sm">
                <span className={stateInfo.color}>{stateInfo.text}</span>
                {activeLine.state === 'established' && (
                  <span className="text-[var(--muted-foreground)]">
                    {formatDuration(callDuration)}
                  </span>
                )}
              </div>
            </div>

            {/* Status icons */}
            <div className="flex items-center gap-1">
              {!isOnline && (
                <div className="text-red-500" title="Network offline - attempting to reconnect">
                  <FiWifiOff className="w-4 h-4" />
                </div>
              )}
              {isReconnecting && (
                <div className="text-yellow-500" title="Reconnecting...">
                  <FiLoader className="w-4 h-4 animate-spin" />
                </div>
              )}
              {activeLine.isMuted && (
                <div className="text-red-500" title="Muted">
                  <FiMicOff className="w-4 h-4" />
                </div>
              )}
            </div>

            {/* Expand button */}
            <button
              className="p-1 rounded-full hover:bg-[var(--muted)] transition-colors flex-shrink-0"
              aria-label={isExpanded ? 'Collapse' : 'Expand'}
            >
              {isExpanded ? (
                <FiChevronDown className="w-4 h-4 text-[var(--muted-foreground)]" />
              ) : (
                <FiChevronUp className="w-4 h-4 text-[var(--muted-foreground)]" />
              )}
            </button>
          </div>

          {/* Expanded controls */}
          {isExpanded && (
            <div className="p-3 border-t border-[var(--border)] space-y-3">
              {/* Network status warning */}
              {!isOnline && (
                <div className="flex items-center gap-2 p-2 rounded-lg bg-red-500/10 text-red-600 dark:text-red-400 text-sm">
                  <FiWifiOff className="w-4 h-4 flex-shrink-0" />
                  <span>Network offline - call may drop</span>
                </div>
              )}

              {/* Quick controls */}
              <div className="flex items-center justify-center gap-2">
                {/* Mute button */}
                <button
                  onClick={handleMuteToggle}
                  className={`
                    p-3 rounded-full transition-colors
                    ${
                      activeLine.isMuted
                        ? 'bg-red-500 text-white hover:bg-red-600'
                        : 'bg-[var(--muted)] text-[var(--foreground)] hover:bg-[var(--accent)]'
                    }
                  `}
                  title={activeLine.isMuted ? 'Unmute' : 'Mute'}
                >
                  {activeLine.isMuted ? (
                    <FiMicOff className="w-5 h-5" />
                  ) : (
                    <FiMic className="w-5 h-5" />
                  )}
                </button>

                {/* Hold button */}
                <button
                  onClick={handleHoldToggle}
                  disabled={isHoldBusy}
                  className={`
                    p-3 rounded-full transition-colors
                    ${
                      activeLine.isHeld
                        ? 'bg-yellow-500 text-white hover:bg-yellow-600'
                        : 'bg-[var(--muted)] text-[var(--foreground)] hover:bg-[var(--accent)]'
                    }
                    ${isHoldBusy ? 'opacity-60 cursor-not-allowed' : ''}
                  `}
                  title={activeLine.isHeld ? 'Resume' : 'Hold'}
                >
                  {activeLine.isHeld ? (
                    <FiPlay className="w-5 h-5" />
                  ) : (
                    <FiPause className="w-5 h-5" />
                  )}
                </button>

                {/* End call button */}
                <button
                  onClick={handleEndCall}
                  className="p-3 rounded-full bg-red-500 text-white hover:bg-red-600 transition-colors"
                  title="End Call"
                >
                  <FiPhoneOff className="w-5 h-5" />
                </button>
              </div>

              {/* Go to phone button */}
              <button
                onClick={handleGoToPhone}
                className="w-full py-2 px-4 rounded-lg bg-[var(--primary-600)] text-white hover:bg-[var(--primary-700)] transition-colors text-sm font-medium"
              >
                Open Phone
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return null;
}
