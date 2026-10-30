'use client';

/**
 * Triage badge store — counts new triage arrivals managers haven't seen,
 * and tracks whether the manager is currently viewing the Triage tab so
 * the realtime hook can suppress toasts when they're already watching.
 *
 * Lifecycle:
 *   - increment() — fired by `useRealtimeTriageSync` on
 *     CUSTOMER_TRIAGE_ARRIVED. Bumps the badge regardless of which page
 *     the manager is on.
 *   - reset() — fired by the customers page when the Triage tab becomes
 *     active. Clears the badge.
 *   - setViewingTriageTab(true) — set by the customers page on mount
 *     and on tab change to 'triage'. Cleared on tab change away or page
 *     unmount. The realtime hook reads it to suppress redundant toasts.
 *
 * The viewing flag is in-memory only — a fresh tab/reload starts at
 * false, which matches the "live attention" semantic (no false-positive
 * suppression after a reload).
 *
 * @module lib/stores/triageBadge
 */

import { create } from 'zustand';

interface TriageBadgeStore {
  count: number;
  /** True when the manager is currently looking at the Triage tab. */
  viewingTriageTab: boolean;
  increment(): void;
  reset(): void;
  setViewingTriageTab(viewing: boolean): void;
}

export const useTriageBadgeStore = create<TriageBadgeStore>((set) => ({
  count: 0,
  viewingTriageTab: false,
  increment: () => set((s) => ({ count: s.count + 1 })),
  reset: () => set({ count: 0 }),
  setViewingTriageTab: (viewing) => set({ viewingTriageTab: viewing }),
}));
