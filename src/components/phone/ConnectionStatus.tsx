'use client';

import React, { useEffect, useState } from 'react';
import { FiWifiOff, FiMicOff } from 'react-icons/fi';
import { useConnectionHealth, type HealthState } from '@/lib/hooks/useConnectionHealth';
import { useConnectionGrace } from '@/lib/hooks/useConnectionGrace';
// Engine router (SIP.js or LiveKit, whichever is active) — see lib/call/call-engine.
import { callEngine as sipManager } from '@/lib/call/call-engine';
import type { SipEvent } from '@/lib/sip/types';

interface ConnectionStatusProps {
  isConnecting: boolean;
  isRegistered: boolean;
  registrationError: string | null;
}

/**
 * SIP Connection Status Indicator
 *
 * "Ready" / "Limited" / "Issue" text = registration + TURN health (existing)
 * Signal bars icon = LIVE network quality from MOS during active calls.
 *
 * When idle (no active call): shows static full bars if registered.
 * During a call: bars dynamically reflect real-time MOS score.
 */
export function ConnectionStatus({
  isConnecting,
  isRegistered: _isRegistered,
  registrationError: _registrationError,
}: ConnectionStatusProps) {
  const health = useConnectionHealth();
  // Grace-buffered registration: a brief WSS blip shows "Reconnecting…" instead
  // of instantly flipping the bar to a red "Issue" (only escalates if it doesn't
  // self-heal within the grace window). Hard errors skip the grace.
  const connUi = useConnectionGrace();
  const [signalLevel, setSignalLevel] = useState<number>(4); // 0-4 bars
  const [inCall, setInCall] = useState(false);

  // Subscribe to live call quality stats
  useEffect(() => {
    const unsubscribe = sipManager.on((event: SipEvent) => {
      if (event.type === 'callStateChanged') {
        if (event.state === 'established' || event.state === 'connecting') {
          setInCall(true);
        } else if (event.state === 'ended' || event.state === 'idle') {
          setInCall(false);
          setSignalLevel(4); // Reset to full when call ends
        }
      }

      if (event.type === 'callEnded') {
        setInCall(false);
        setSignalLevel(4);
      }

      if (event.type === 'callStatsUpdate') {
        setInCall(true);
        const mos = event.stats.mosScore;
        if (mos >= 4.0)
          setSignalLevel(4); // excellent
        else if (mos >= 3.5)
          setSignalLevel(3); // good
        else if (mos >= 3.0)
          setSignalLevel(2); // fair
        else setSignalLevel(1); // poor — always at least 1 bar
      }
    });
    return unsubscribe;
  }, []);

  if (isConnecting) {
    return (
      <div
        className="flex items-center gap-2 text-yellow-600 dark:text-yellow-400"
        role="status"
        aria-live="polite"
        aria-label="Phone connection status: connecting"
      >
        <div
          className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full"
          aria-hidden="true"
        />
        <span className="text-sm">Connecting...</span>
      </div>
    );
  }

  // Grace window: registration just dropped but may self-heal. Show a calm
  // "Reconnecting…" instead of the red "Issue" — the dialer stays usable.
  if (connUi === 'reconnecting') {
    return (
      <div
        className="flex items-center gap-2 text-yellow-600 dark:text-yellow-400"
        role="status"
        aria-live="polite"
        aria-label="Phone connection status: reconnecting"
        title="Connection dropped briefly — reconnecting…"
      >
        <div
          className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full"
          aria-hidden="true"
        />
        <span className="text-sm">Reconnecting…</span>
      </div>
    );
  }

  return (
    <HealthBadge
      state={health.state}
      message={health.message}
      isMicrophoneIssue={health.isMicrophoneIssue}
      signalLevel={signalLevel}
      inCall={inCall}
    />
  );
}

/**
 * Signal bars SVG — 4 bars that fill based on level (0-4).
 * Colored by current health state.
 */
function SignalBars({
  level,
  color,
}: {
  level: number; // 0-4
  color: string; // tailwind text color class
}) {
  const barHeights = [4, 7, 10, 13];
  const barWidth = 3;
  const gap = 1.5;
  const svgWidth = barHeights.length * (barWidth + gap) - gap;
  const svgHeight = 14;

  return (
    <svg
      width={svgWidth}
      height={svgHeight}
      viewBox={`0 0 ${svgWidth} ${svgHeight}`}
      className={`${color} shrink-0`}
      aria-hidden="true"
    >
      {barHeights.map((h, i) => (
        <rect
          key={i}
          x={i * (barWidth + gap)}
          y={svgHeight - h}
          width={barWidth}
          height={h}
          rx={0.5}
          className={i < level ? 'fill-current' : 'fill-current opacity-20'}
        />
      ))}
    </svg>
  );
}

interface HealthBadgeProps {
  state: HealthState;
  message: string;
  isMicrophoneIssue: boolean;
  signalLevel: number;
  inCall: boolean;
}

function HealthBadge({ state, message, isMicrophoneIssue, signalLevel, inCall }: HealthBadgeProps) {
  // During a call, signal bars reflect live MOS.
  // When idle, show full bars if ready, reduced if limited, empty if issue.
  const effectiveLevel = inCall ? signalLevel : state === 'ready' ? 4 : state === 'limited' ? 2 : 0;

  switch (state) {
    case 'ready':
      return (
        <div
          className="flex items-center gap-2 text-green-600 dark:text-green-400"
          role="status"
          aria-live="polite"
          aria-label="Phone connection status: ready"
          title={message}
        >
          <SignalBars level={effectiveLevel} color="text-green-600 dark:text-green-400" />
          <span className="text-sm">Ready</span>
          <span className="sr-only">{message}</span>
        </div>
      );
    case 'limited':
      return (
        <div
          className="flex items-center gap-2 text-yellow-600 dark:text-yellow-400"
          role="status"
          aria-live="polite"
          aria-label={`Phone connection status: limited. ${message}`}
          title={message}
        >
          <SignalBars level={effectiveLevel} color="text-yellow-600 dark:text-yellow-400" />
          <span className="text-sm">Limited</span>
          <span className="sr-only">{message}</span>
        </div>
      );
    case 'issue':
      // A missing/blocked microphone gets its own clear, actionable badge —
      // the user needs to plug in a mic, not check their network.
      if (isMicrophoneIssue) {
        return (
          <div
            className="flex items-center gap-2 text-red-600 dark:text-red-400"
            role="alert"
            aria-live="assertive"
            aria-label={`Microphone issue: ${message}`}
            title={message}
          >
            <FiMicOff className="w-4 h-4" aria-hidden="true" />
            <span className="text-sm font-medium">No microphone</span>
            <span className="sr-only">{message}</span>
          </div>
        );
      }
      return (
        <div
          className="flex items-center gap-2 text-red-600 dark:text-red-400"
          role="alert"
          aria-live="assertive"
          aria-label={`Phone connection issue: ${message}`}
          title={message}
        >
          <FiWifiOff className="w-4 h-4" aria-hidden="true" />
          <span className="text-sm">Issue</span>
          <span className="sr-only">{message}</span>
        </div>
      );
  }
}
