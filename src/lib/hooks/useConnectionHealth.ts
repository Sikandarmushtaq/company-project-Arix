'use client';

/**
 * useConnectionHealth
 *
 * Aggregates SIP registration state, TURN availability, and recent call
 * outcomes into a tri-state signal surfaced by the dialer header.
 *
 * States:
 *   - 'ready'   : registered + TURN loaded + no recent failures → green
 *   - 'limited' : registered but TURN missing OR recent calls failing → yellow
 *   - 'issue'   : not registered / WS dropped → red
 *
 * Entirely event-driven — does not poll. Registration is read from useSipStore
 * (updated by SipProvider on state change), TURN availability comes from a
 * one-shot fetch at mount (revalidated when `iceFailureDetected` fires), and
 * recent call outcomes are observed via sipManager.on(...).
 *
 * @module lib/hooks/useConnectionHealth
 */

import { useCallback, useEffect, useRef, useState } from 'react';
// Engine router (SIP.js or LiveKit, whichever is active) — see lib/call/call-engine.
import { callEngine as sipManager } from '@/lib/call/call-engine';
import { useSipStore } from '@/lib/stores/sip';
import { apiClient } from '@/lib/api/client';
import type { SipEvent } from '@/lib/sip/types';

export type HealthState = 'ready' | 'limited' | 'issue';

export interface ConnectionHealth {
  state: HealthState;
  /** Short human-readable message for the tooltip / screen reader. */
  message: string;
  /**
   * True when the registration failure is specifically a missing or blocked
   * microphone (vs a server/network issue). Lets the UI show a distinct
   * "No microphone" indicator with an actionable message.
   */
  isMicrophoneIssue: boolean;
  /** Structured reasons — useful for debug overlay / admin view. */
  details: {
    isRegistered: boolean;
    hasRegistrationError: boolean;
    turnAvailable: boolean | null; // null = not yet determined
    recentFailureRate: number; // 0-1, last 10 minutes
    recentFailureCount: number;
  };
}

/** Size of the rolling window we use to decide "recently failing". */
const ROLLING_WINDOW_MS = 10 * 60 * 1000;
/** Failure rate above this → Limited badge. */
const LIMITED_FAILURE_RATE = 0.5;
/** Need at least this many calls in-window before the ratio is meaningful. */
const MIN_CALLS_FOR_RATIO = 2;

interface CallOutcome {
  lineId: number;
  timestamp: number;
  failed: boolean;
}

/**
 * Ask the backend if TURN is currently working. Returns:
 *   - true  : endpoint returned iceServers with relay candidates
 *   - false : endpoint returned 503 / empty / error
 */
async function probeTurnAvailability(): Promise<boolean> {
  try {
    interface TurnResponse {
      data?: Array<{ urls?: string | string[] }>;
    }
    const resp = await apiClient.get<TurnResponse>('/auth/turn-credentials');
    const servers = resp.data ?? [];
    return servers.some((s) => {
      const u = Array.isArray(s.urls) ? s.urls.join(' ') : (s.urls ?? '');
      return u.startsWith('turn:') || u.startsWith('turns:');
    });
  } catch {
    return false;
  }
}

export function useConnectionHealth(): ConnectionHealth {
  // Registration state (live from SIP store — already event-driven)
  const isRegistered = useSipStore((s) => s.isRegistered);
  const registrationError = useSipStore((s) => s.registrationError);

  // TURN availability — one-shot at mount, re-probed on failure signal
  const [turnAvailable, setTurnAvailable] = useState<boolean | null>(null);

  // Rolling ring buffer of recent call outcomes (for failure-rate calc).
  // Kept in a ref + a state bump counter so the aggregator re-runs without
  // flooding React with re-renders for every single outcome.
  const outcomesRef = useRef<CallOutcome[]>([]);
  const [, bumpRender] = useState(0);
  const bump = useCallback(() => bumpRender((n) => n + 1), []);

  // Probe TURN on mount (and any time SIP gets back online after being down).
  useEffect(() => {
    let cancelled = false;
    probeTurnAvailability().then((ok) => {
      if (!cancelled) setTurnAvailable(ok);
    });
    return () => {
      cancelled = true;
    };
  }, [isRegistered]);

  // Subscribe to SIP events — track call outcomes + re-probe TURN on ICE failure.
  useEffect(() => {
    const unsubscribe = sipManager.on((event: SipEvent) => {
      switch (event.type) {
        case 'iceFailureDetected': {
          outcomesRef.current.push({
            lineId: event.lineId,
            timestamp: Date.now(),
            failed: true,
          });
          // Re-probe TURN — an ICE failure is our strongest hint that TURN
          // may be unreachable right now.
          probeTurnAvailability().then(setTurnAvailable);
          bump();
          break;
        }
        case 'callEnded': {
          // Any hangup is an opportunity to record a non-failure data point.
          // We deliberately DO NOT count callEnded as a failure unless it
          // was preceded by an iceFailureDetected on the same line (handled
          // above — that entry is already recorded).
          outcomesRef.current.push({
            lineId: event.lineId,
            timestamp: Date.now(),
            failed: false,
          });
          bump();
          break;
        }
        default:
          break;
      }
    });
    return unsubscribe;
  }, [bump]);

  // Compute failure rate over rolling window.
  const cutoff = Date.now() - ROLLING_WINDOW_MS;
  outcomesRef.current = outcomesRef.current.filter((o) => o.timestamp >= cutoff);
  const recent = outcomesRef.current;
  const recentFailureCount = recent.filter((o) => o.failed).length;
  const recentFailureRate =
    recent.length >= MIN_CALLS_FOR_RATIO ? recentFailureCount / recent.length : 0;

  // A missing/blocked microphone is reported through registrationError — flag
  // it so the UI can show a clear, actionable "No microphone" state rather than
  // a generic "Not reachable" issue (and so we don't keep retrying as if it
  // were a network problem).
  const isMicrophoneIssue = Boolean(
    registrationError && /microphone|no mic|headset/i.test(registrationError)
  );

  // Derive the tri-state.
  let state: HealthState;
  let message: string;
  if (!isRegistered || registrationError) {
    state = 'issue';
    message = isMicrophoneIssue
      ? registrationError! // already user-friendly: "No microphone detected. Connect…"
      : registrationError
        ? `Not reachable: ${registrationError}`
        : 'Not reachable — trying to reconnect';
  } else if (turnAvailable === false) {
    state = 'limited';
    message = 'Registered, but TURN server unavailable. Calls from strict networks may fail.';
  } else if (recent.length >= MIN_CALLS_FOR_RATIO && recentFailureRate >= LIMITED_FAILURE_RATE) {
    state = 'limited';
    message = `Recent calls have been failing (${recentFailureCount}/${recent.length} in last 10 min). Check your network.`;
  } else {
    state = 'ready';
    message = 'Ready — connected and able to place calls.';
  }

  return {
    state,
    message,
    isMicrophoneIssue,
    details: {
      isRegistered,
      hasRegistrationError: Boolean(registrationError),
      turnAvailable,
      recentFailureRate,
      recentFailureCount,
    },
  };
}
