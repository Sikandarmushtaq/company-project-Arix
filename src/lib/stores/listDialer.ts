/**
 * List Dialer Store
 *
 * Drives the sequential Excel-list calling mode on /phone. The user
 * uploads a list, the store walks through it row by row: each row
 * gets dialed via the existing SIP store, then a disposition is
 * recorded before the next row is dialed.
 *
 * State is persisted to localStorage via zustand's persist middleware
 * so a refresh mid-campaign doesn't lose the list. We deliberately do
 * NOT persist `currentLineId` or the transient call state — those
 * belong to the SIP store and don't survive reloads anyway.
 *
 * @module lib/stores/listDialer
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ListDialerRow, ListDialerOutcome } from '../utils/listDialerExcel';

/**
 * State of the campaign as a whole.
 *
 *   idle               → no list loaded; UI shows the upload card
 *   ready              → list loaded, not started yet
 *   calling            → makeCall has been fired; waiting for the SIP
 *                        line to come up + the call to end
 *   awaiting_disposition → call ended, picker is showing
 *   paused             → user clicked Pause; will resume on Resume
 *   completed          → walked off the end of the list
 */
export type ListDialerStatus =
  | 'idle'
  | 'ready'
  | 'calling'
  | 'awaiting_disposition'
  | 'paused'
  | 'completed';

export interface ListDialerEntry extends ListDialerRow {
  status: 'pending' | 'called' | 'skipped';
  outcome?: ListDialerOutcome;
}

interface ListDialerState {
  status: ListDialerStatus;
  fileName: string | null;
  phoneColumnHeader: string;
  extraHeaders: string[];
  entries: ListDialerEntry[];
  currentIndex: number;
  /** SIP line id for the current call — runtime only, NOT persisted. */
  currentLineId: number | null;
  /** When the current call started — used to compute duration when it ends. */
  currentCallStartedAt: number | null;

  loadList: (args: {
    fileName: string;
    phoneColumnHeader: string;
    extraHeaders: string[];
    rows: ListDialerRow[];
  }) => void;

  /** Cancel everything, clear the loaded list, return to idle. */
  resetCampaign: () => void;

  /** Move from `ready` (or `paused`) to `calling` for the current row. */
  startCalling: (lineId: number) => void;

  /** SIP line for the current row went away — transition to disposition picker. */
  recordCallEnded: () => void;

  /** Record the disposition + advance to the next row (or complete). */
  recordDisposition: (disposition: string, note: string) => void;

  /** Skip the current row WITHOUT calling it. */
  skipCurrent: () => void;

  /** Mid-campaign pause. Keeps state intact; UI hides the auto-dial behavior. */
  pause: () => void;

  /** Resume from paused state. Returns the next row to dial if any. */
  resume: () => void;
}

const STORAGE_KEY = 'nuxcall.list-dialer.session.v1';

export const useListDialerStore = create<ListDialerState>()(
  persist(
    (set, get) => ({
      status: 'idle',
      fileName: null,
      phoneColumnHeader: '',
      extraHeaders: [],
      entries: [],
      currentIndex: 0,
      currentLineId: null,
      currentCallStartedAt: null,

      loadList: ({ fileName, phoneColumnHeader, extraHeaders, rows }) => {
        const entries: ListDialerEntry[] = rows.map((r) => ({ ...r, status: 'pending' }));
        set({
          status: 'ready',
          fileName,
          phoneColumnHeader,
          extraHeaders,
          entries,
          currentIndex: 0,
          currentLineId: null,
          currentCallStartedAt: null,
        });
      },

      resetCampaign: () => {
        set({
          status: 'idle',
          fileName: null,
          phoneColumnHeader: '',
          extraHeaders: [],
          entries: [],
          currentIndex: 0,
          currentLineId: null,
          currentCallStartedAt: null,
        });
      },

      startCalling: (lineId) => {
        set({
          status: 'calling',
          currentLineId: lineId,
          currentCallStartedAt: Date.now(),
        });
      },

      recordCallEnded: () => {
        // The call dropped — either the remote ended it, the user hit
        // hang-up, or the network failed. Either way we want the user
        // to pick a disposition before we dial the next row. Don't
        // touch currentIndex yet — recordDisposition does that.
        if (get().status !== 'calling') return;
        set({
          status: 'awaiting_disposition',
          currentLineId: null,
        });
      },

      recordDisposition: (disposition, note) => {
        const { entries, currentIndex, currentCallStartedAt } = get();
        if (currentIndex >= entries.length) return;

        const durationSeconds = currentCallStartedAt
          ? Math.max(0, Math.round((Date.now() - currentCallStartedAt) / 1000))
          : 0;

        const outcome: ListDialerOutcome = {
          disposition,
          note: note.trim(),
          durationSeconds,
          attemptedAt: new Date().toISOString(),
        };

        const nextEntries = entries.map((e, i) =>
          i === currentIndex ? { ...e, status: 'called' as const, outcome } : e
        );

        const nextIndex = currentIndex + 1;
        const reachedEnd = nextIndex >= nextEntries.length;
        set({
          entries: nextEntries,
          currentIndex: nextIndex,
          currentCallStartedAt: null,
          status: reachedEnd ? 'completed' : 'ready',
        });
      },

      skipCurrent: () => {
        const { entries, currentIndex, status } = get();
        // Only allow skip from states that have an active row to skip.
        if (status !== 'ready' && status !== 'paused') return;
        if (currentIndex >= entries.length) return;

        const nextEntries = entries.map((e, i) =>
          i === currentIndex ? { ...e, status: 'skipped' as const } : e
        );
        const nextIndex = currentIndex + 1;
        const reachedEnd = nextIndex >= nextEntries.length;
        set({
          entries: nextEntries,
          currentIndex: nextIndex,
          status: reachedEnd ? 'completed' : 'ready',
        });
      },

      pause: () => {
        const s = get().status;
        if (s === 'ready' || s === 'awaiting_disposition') {
          set({ status: 'paused' });
        }
      },

      resume: () => {
        if (get().status !== 'paused') return;
        // Resume always lands on 'ready' regardless of where we paused
        // from. If the user paused mid-disposition (rare — they'd have
        // had to refresh the page or use a separate Pause button on
        // the disposition card), the implicit choice is to discard the
        // in-flight call duration and treat the row as still pending.
        // We simply move to ready and let the UI re-present the row.
        set({ status: 'ready' });
      },
    }),
    {
      name: STORAGE_KEY,
      // Persist the campaign + outcomes. Skip the transient call-level
      // fields — those can't survive a refresh anyway (SIP line ids
      // reset on reload).
      partialize: (state) => ({
        status: state.status,
        fileName: state.fileName,
        phoneColumnHeader: state.phoneColumnHeader,
        extraHeaders: state.extraHeaders,
        entries: state.entries,
        currentIndex: state.currentIndex,
      }),
      // After rehydrating from storage, normalise statuses that don't
      // make sense without a live SIP context. A page refresh during
      // 'calling' should land on 'ready' so the user can re-dial.
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        if (state.status === 'calling' || state.status === 'awaiting_disposition') {
          state.status = 'ready';
        }
        state.currentLineId = null;
        state.currentCallStartedAt = null;
      },
    }
  )
);

/**
 * Helper for callers that just need the current entry without
 * subscribing to the whole store.
 */
export function selectCurrentEntry(s: ListDialerState): ListDialerEntry | null {
  if (s.currentIndex >= s.entries.length) return null;
  return s.entries[s.currentIndex] ?? null;
}

/**
 * Stats for the progress bar / completion screen.
 */
export interface ListDialerStats {
  total: number;
  called: number;
  skipped: number;
  pending: number;
}

export function selectStats(s: ListDialerState): ListDialerStats {
  let called = 0;
  let skipped = 0;
  for (const e of s.entries) {
    if (e.status === 'called') called++;
    else if (e.status === 'skipped') skipped++;
  }
  return {
    total: s.entries.length,
    called,
    skipped,
    pending: s.entries.length - called - skipped,
  };
}
