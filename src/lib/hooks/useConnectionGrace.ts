'use client';

/**
 * useConnectionGrace
 *
 * Debounces the SIP registration flag into a THREE-state UI signal so a brief
 * WebSocket blip doesn't instantly disable the dialer and flip the signal bar
 * to a red "Issue".
 *
 * WHY
 * ---
 * SIP signaling rides WebSocket (TCP). On a lossy network the socket can drop
 * (`1006`) and reconnect within a second or two — the reconnect path fires at
 * 250 ms. But the moment it drops, `isRegistered` goes false, which hard-
 * disables the dialpad and shows "Issue". For a 1–2 s self-healing blip that's
 * a jarring, misleading flap. This hook holds a "reconnecting" state for a
 * short grace window and only escalates to "disconnected" if it doesn't recover.
 *
 * STATES
 * ------
 *   - 'connected'    : registered — normal operation
 *   - 'reconnecting' : just dropped, no hard error — within the grace window;
 *                      keep the UI usable, show a calm "Reconnecting…"
 *   - 'disconnected' : grace elapsed without recovery, OR a hard registration
 *                      error (mic/auth/etc.) which is NOT transient — show "Issue"
 *
 * A hard `registrationError` (e.g. missing microphone, auth failure) skips the
 * grace entirely — those aren't transient and shouldn't be sugar-coated.
 *
 * @module lib/hooks/useConnectionGrace
 */

import { useEffect, useState } from 'react';
import { useSipStore } from '@/lib/stores/sip';

export type ConnectionUiState = 'connected' | 'reconnecting' | 'disconnected';

/** How long to hold "reconnecting" before escalating to "disconnected" (ms). */
export const DEFAULT_GRACE_MS = 4000;

export function useConnectionGrace(graceMs: number = DEFAULT_GRACE_MS): ConnectionUiState {
  const isRegistered = useSipStore((s) => s.isRegistered);
  const registrationError = useSipStore((s) => s.registrationError);

  // True once the grace window has elapsed without recovery → real disconnect.
  const [graceExpired, setGraceExpired] = useState(false);

  useEffect(() => {
    // Recovered → clear any pending escalation.
    if (isRegistered) {
      setGraceExpired(false);
      return;
    }
    // Hard error → not transient, escalate immediately (no grace).
    if (registrationError) {
      setGraceExpired(true);
      return;
    }
    // Transient drop (no error) → hold "reconnecting" for graceMs, then escalate.
    setGraceExpired(false);
    const timer = setTimeout(() => setGraceExpired(true), graceMs);
    return () => clearTimeout(timer);
  }, [isRegistered, registrationError, graceMs]);

  if (isRegistered) return 'connected';
  if (registrationError || graceExpired) return 'disconnected';
  return 'reconnecting';
}
