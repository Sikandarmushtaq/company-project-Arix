/**
 * Guest (anonymous) support chat API — for the public floating widget.
 *
 * These endpoints require NO auth; the visitor is identified by a random
 * `guestToken` returned from `start` (stored in localStorage). apiClient returns
 * the raw `{ success, data }` envelope, so each call reads `.data`.
 *
 * @module lib/api/services/guest-support.api
 */

import type { SupportMessage, SupportTicket } from './support.api';

export interface GuestThread {
  ticket: SupportTicket;
  messages: SupportMessage[];
}
export interface GuestStartResult extends GuestThread {
  guestToken: string;
}
export interface GuestStartInput {
  name?: string;
  email: string;
  message: string;
  captchaToken?: string;
}

/**
 * Guest calls use PLAIN fetch — NOT the shared apiClient — on purpose:
 *   1. A guest is anonymous, so we must not attach the visitor's Bearer token.
 *   2. The apiClient turns any 401 SESSION_EXPIRED into a global /login redirect;
 *      an anonymous guest must never be bounced to login.
 *   3. `credentials: 'omit'` keeps the request session-free.
 * The thread poll uses `?gt=` (not `?token=`) because the proxy reserves `token`.
 */
const BASE = '/api/proxy';

async function guestFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
    credentials: 'omit',
  });
  const ct = res.headers.get('content-type') || '';
  const json = ct.includes('application/json')
    ? ((await res.json().catch(() => null)) as {
        data?: T;
        error?: { message?: string };
      } | null)
    : null;
  if (!res.ok) {
    throw new Error(json?.error?.message || `Request failed (${res.status}). Please try again.`);
  }
  if (!json) throw new Error('Unexpected response from the server. Please try again.');
  return json.data as T;
}

export const guestSupportApi = {
  start: (input: GuestStartInput) =>
    guestFetch<GuestStartResult>('/support/guest/start', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  send: (guestToken: string, body: string) =>
    guestFetch<SupportMessage>('/support/guest/message', {
      method: 'POST',
      body: JSON.stringify({ guestToken, body }),
    }),
  thread: (guestToken: string) =>
    guestFetch<GuestThread>(`/support/guest/thread?gt=${encodeURIComponent(guestToken)}`),
  close: (guestToken: string) =>
    guestFetch<SupportTicket>('/support/guest/close', {
      method: 'POST',
      body: JSON.stringify({ guestToken }),
    }),
  /** Live draft preview to the agent. Empty draft = stopped typing. Fire-and-forget. */
  typing: (guestToken: string, draft: string) =>
    guestFetch<{ ok: boolean }>('/support/guest/typing', {
      method: 'POST',
      body: JSON.stringify({ guestToken, draft }),
    }).catch(() => undefined),
};
