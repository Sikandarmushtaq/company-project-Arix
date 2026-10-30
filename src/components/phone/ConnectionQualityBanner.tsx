'use client';

import React, { useState, useEffect, useRef } from 'react';
import { FiAlertTriangle, FiX } from 'react-icons/fi';
// Engine router (SIP.js or LiveKit, whichever is active) — see lib/call/call-engine.
import { callEngine as sipManager } from '@/lib/call/call-engine';
import type { SipEvent } from '@/lib/sip/types';

/**
 * Connection Quality Banner
 *
 * Shows a dismissible warning during active calls when MOS < 3.0 or
 * packet loss > 3%. Helps users understand that degraded audio is their
 * network, not the dialer.
 *
 * Event-driven — single subscription to sipManager events, no polling.
 * Shows immediately on first bad reading — no debounce delay.
 * Auto-clears when quality recovers for 4+ seconds or when call ends.
 *
 * Defense-in-depth: warnings are gated on the call having been ANSWERED
 * ('established'). Before answer (ringing / connecting) there is no media by
 * design, so a "poor connection" reading is meaningless — this stops the false
 * "check your internet" banner from ever surfacing during a long ring, even if
 * an upstream stat blips. The source-level fix (SipQualityManager.mediaStarted)
 * already prevents such readings; this is a belt-and-suspenders UI guard.
 */
export function ConnectionQualityBanner() {
  const [warning, setWarning] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const lastBadReadingRef = useRef<number>(0);
  const answeredRef = useRef<boolean>(false);
  const heldRef = useRef<boolean>(false);

  useEffect(() => {
    const unsubscribe = sipManager.on((event: SipEvent) => {
      // Clear on call end
      if (event.type === 'callEnded') {
        setWarning(null);
        setDismissed(false);
        lastBadReadingRef.current = 0;
        answeredRef.current = false;
        heldRef.current = false;
        return;
      }

      // Track answered + held state — the call only has expected media once it
      // reaches 'established' and is not on hold. Until then, suppress warnings.
      if (event.type === 'callStateChanged') {
        if (event.state === 'established') {
          answeredRef.current = true;
          heldRef.current = false;
        } else if (event.state === 'held' || event.state === 'holding') {
          // On hold there is deliberately no media (caller hears music-on-hold),
          // so any quality reading is meaningless. Clear the banner and suppress
          // new ones until resume — this also clears a pre-hold "poor" reading
          // that would otherwise freeze on screen for the whole hold.
          heldRef.current = true;
          setWarning(null);
          lastBadReadingRef.current = 0;
        }
        return;
      }

      if (event.type !== 'callStatsUpdate') return;

      // Not answered yet (ringing / connecting) or on hold → no media expected.
      if (!answeredRef.current || heldRef.current) return;

      const { stats } = event;
      const now = Date.now();
      const isBad = stats.mosScore < 3.0 || stats.packetLoss > 3;

      if (isBad) {
        // Show immediately — no debounce delay
        const reasons: string[] = [];
        if (stats.mosScore < 2.5) reasons.push('very poor audio quality');
        else if (stats.mosScore < 3.0) reasons.push('degraded audio quality');
        if (stats.packetLoss > 10) reasons.push(`${stats.packetLoss.toFixed(0)}% packet loss`);
        else if (stats.packetLoss > 3) reasons.push(`${stats.packetLoss.toFixed(1)}% packet loss`);
        if (stats.roundTripTime > 500) reasons.push(`${Math.round(stats.roundTripTime)}ms latency`);

        setWarning(`Poor connection: ${reasons.join(', ')}. Check your internet.`);
        setDismissed(false);
        lastBadReadingRef.current = now;
      } else {
        // Quality is good — clear after 4 seconds of sustained recovery
        if (lastBadReadingRef.current === 0) {
          lastBadReadingRef.current = now;
        }
        if (now - lastBadReadingRef.current > 4000) {
          setWarning(null);
          lastBadReadingRef.current = 0;
        }
      }
    });

    return unsubscribe;
  }, []);

  if (!warning || dismissed) return null;

  return (
    <div className="mx-4 mb-2 px-4 py-2.5 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 flex items-start gap-3">
      <FiAlertTriangle className="w-4 h-4 text-yellow-600 dark:text-yellow-400 mt-0.5 shrink-0" />
      <p className="text-sm text-yellow-800 dark:text-yellow-200 flex-1">{warning}</p>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        className="p-0.5 text-yellow-600 dark:text-yellow-400 hover:opacity-70"
        aria-label="Dismiss warning"
      >
        <FiX className="w-4 h-4" />
      </button>
    </div>
  );
}
