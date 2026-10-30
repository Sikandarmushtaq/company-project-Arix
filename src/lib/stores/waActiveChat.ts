'use client';

/**
 * Active WhatsApp chat store.
 *
 * Tracks which customer phone (normalized) the agent currently has open in
 * `/phone/whatsapp`. The realtime hook reads it (without subscribing — via
 * `.getState()`) inside the `WA_RECEIVED` handler to decide whether to
 * suppress the toast / OS notification for an inbound that belongs to the
 * currently-open thread. The user can already see the message land in the
 * thread; a popup on top of it is noise.
 *
 * Lifecycle:
 *   - `setPhone(normalizedPhone)` — fired by the WA messages state hook
 *     whenever the selected conversation changes, including on initial
 *     mount and on URL-hydration.
 *   - `setPhone(null)` — fired in the same effect's cleanup, so leaving
 *     the page (or deselecting the conversation) resets the store and the
 *     realtime hook goes back to "any inbound notifies."
 *
 * In-memory only — a tab/reload starts at `null`, which matches the
 * "live attention" semantic (no false-positive suppression after a
 * reload).
 *
 * @module lib/stores/waActiveChat
 */

import { create } from 'zustand';

interface WaActiveChatStore {
  /** Normalized customer phone for the currently-open thread, or null. */
  phone: string | null;
  setPhone(phone: string | null): void;
}

export const useWaActiveChatStore = create<WaActiveChatStore>((set) => ({
  phone: null,
  setPhone: (phone) => set({ phone }),
}));
