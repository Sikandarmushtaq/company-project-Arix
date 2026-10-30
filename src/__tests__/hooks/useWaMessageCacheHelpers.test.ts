/**
 * Tests for the WhatsApp thread-cache helpers + payload coercion.
 *
 * What's covered:
 *   - `coerceWaMessage`         — backfills missing fields from a WS payload
 *   - `prependWaMessage`        — head-page insert, dedupe by id
 *   - `replaceWaMessage`        — find-and-replace across pages
 *   - `replaceOrPrependWaMessage` — composite, all three branches
 *   - `removeWaMessages`        — id-set filter across pages
 *   - `mapWaMessages`           — per-message transform with reference identity
 *
 * Each helper is exercised against BOTH cache shapes:
 *   - regular  `{ messages, total }` (legacy non-infinite callers)
 *   - infinite `{ pages: [{ messages, total }], pageParams }`
 *
 * @module __tests__/hooks/useWaMessageCacheHelpers
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import {
  prependWaMessage,
  replaceWaMessage,
  replaceOrPrependWaMessage,
  removeWaMessages,
  mapWaMessages,
  coerceWaMessage,
} from '@/lib/hooks/useWaMessageMutations';
import type { WaMessage, PaginatedWaMessagesResponse, WaMessageWsPayload } from '@/lib/api';

// ============================================================
// Fixtures
// ============================================================

const PHONE = '12164281997';
const THREAD_KEY = ['wa-messages', 'thread', PHONE] as const;

function makeMessage(id: number, overrides: Partial<WaMessage> = {}): WaMessage {
  return {
    id,
    waMessageId: `wa-${id}`,
    sender: 'agent',
    receiver: PHONE,
    direction: 'outbound',
    messageType: 'text',
    body: `msg ${id}`,
    mediaId: null,
    mediaUrl: null,
    mediaMimeType: null,
    mediaFilename: null,
    latitude: null,
    longitude: null,
    locationName: null,
    locationAddress: null,
    templateName: null,
    templateLanguage: null,
    reactionEmoji: null,
    reactionMessageId: null,
    contextMessageId: null,
    interactiveType: null,
    interactiveData: null,
    status: 'sent',
    failureReason: null,
    errorCode: null,
    readByUser: true,
    organizationId: 1,
    userPhone: 'agent',
    conversationCategory: null,
    costCents: 0,
    sentAt: '2026-05-11T00:00:00Z',
    deliveredAt: null,
    readAt: null,
    failedAt: null,
    createdAt: '2026-05-11T00:00:00Z',
    updatedAt: '2026-05-11T00:00:00Z',
    ...overrides,
  };
}

function makeRegularCache(messages: WaMessage[]): PaginatedWaMessagesResponse {
  return { messages, total: messages.length };
}

function makeInfiniteCache(pages: WaMessage[][]) {
  return {
    pages: pages.map(
      (msgs): PaginatedWaMessagesResponse => ({ messages: msgs, total: msgs.length })
    ),
    pageParams: pages.map((_, i) => (i === 0 ? undefined : `cursor-${i}`)),
  };
}

let client: QueryClient;
beforeEach(() => {
  client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
});

// ============================================================
// coerceWaMessage
// ============================================================

describe('coerceWaMessage', () => {
  it('returns the payload verbatim when every field is present', () => {
    const full = makeMessage(1) as WaMessageWsPayload;
    const out = coerceWaMessage(full);
    expect(out).toEqual(full);
  });

  it('backfills nullable fields when the WS payload omits them', () => {
    // Simulate a thinned payload — server might drop optional fields
    // to keep the WS event small. Cast through Partial to express
    // "fewer fields than the type", then back to the precise type
    // for the function call boundary.
    const thin = { id: 42 } as unknown as WaMessageWsPayload;
    const out = coerceWaMessage(thin);
    expect(out.id).toBe(42);
    expect(out.waMessageId).toBeNull();
    expect(out.sender).toBe('');
    expect(out.receiver).toBe('');
    expect(out.direction).toBe('inbound');
    expect(out.messageType).toBe('text');
    expect(out.body).toBeNull();
    expect(out.status).toBe('pending');
    expect(out.readByUser).toBe(false);
    expect(out.costCents).toBe(0);
    expect(out.organizationId).toBeNull();
    expect(out.userPhone).toBeNull();
  });

  it('defaults createdAt/updatedAt to "now" when missing', () => {
    const before = Date.now();
    const out = coerceWaMessage({ id: 1 } as unknown as WaMessageWsPayload);
    const after = Date.now();
    const createdAt = new Date(out.createdAt).getTime();
    expect(createdAt).toBeGreaterThanOrEqual(before);
    expect(createdAt).toBeLessThanOrEqual(after);
    expect(out.updatedAt).toBe(out.createdAt);
  });

  it('does not promote a `null` field to a default', () => {
    // `?? null` collapses undefined to null, but null stays null
    // (and stays equal to the existing semantic of "explicitly empty").
    const payload = { id: 1, sentAt: null } as WaMessageWsPayload;
    const out = coerceWaMessage(payload);
    expect(out.sentAt).toBeNull();
  });
});

// ============================================================
// prependWaMessage
// ============================================================

describe('prependWaMessage', () => {
  it('inserts at the head of the regular (non-infinite) cache', () => {
    client.setQueryData(THREAD_KEY, makeRegularCache([makeMessage(2), makeMessage(1)]));

    const newMsg = makeMessage(3);
    const touched = prependWaMessage(client, PHONE, newMsg);

    expect(touched).toBe(true);
    const data = client.getQueryData<PaginatedWaMessagesResponse>(THREAD_KEY);
    expect(data?.messages.map((m) => m.id)).toEqual([3, 2, 1]);
    expect(data?.total).toBe(3);
  });

  it('inserts at the head of page[0] of the infinite cache (not other pages)', () => {
    const cache = makeInfiniteCache([
      [makeMessage(10), makeMessage(9)],
      [makeMessage(8), makeMessage(7)],
    ]);
    client.setQueryData(THREAD_KEY, cache);

    const touched = prependWaMessage(client, PHONE, makeMessage(11));

    expect(touched).toBe(true);
    const data = client.getQueryData<typeof cache>(THREAD_KEY);
    expect(data?.pages[0].messages.map((m) => m.id)).toEqual([11, 10, 9]);
    expect(data?.pages[0].total).toBe(3);
    // Older page untouched
    expect(data?.pages[1].messages.map((m) => m.id)).toEqual([8, 7]);
    expect(data?.pages[1].total).toBe(2);
  });

  it('is a no-op when the message id already exists in head', () => {
    const original = makeRegularCache([makeMessage(2), makeMessage(1)]);
    client.setQueryData(THREAD_KEY, original);

    const touched = prependWaMessage(client, PHONE, makeMessage(2, { body: 'duplicate' }));

    expect(touched).toBe(true); // cache existed, just no-op
    const data = client.getQueryData<PaginatedWaMessagesResponse>(THREAD_KEY);
    // Same identity preserved — no extra render churn
    expect(data).toBe(original);
  });

  it('returns false when no cache exists for the phone', () => {
    const touched = prependWaMessage(client, '19999999999', makeMessage(1));
    expect(touched).toBe(false);
  });
});

// ============================================================
// replaceWaMessage
// ============================================================

describe('replaceWaMessage', () => {
  it('finds and replaces a message on any page', () => {
    client.setQueryData(
      THREAD_KEY,
      makeInfiniteCache([
        [makeMessage(10), makeMessage(9)],
        [makeMessage(8), makeMessage(7)],
      ])
    );

    const patched = makeMessage(8, { status: 'delivered' });
    const { touched, replaced } = replaceWaMessage(client, PHONE, (m) => m.id === 8, patched);

    expect(touched).toBe(true);
    expect(replaced).toBe(true);
    const data = client.getQueryData<ReturnType<typeof makeInfiniteCache>>(THREAD_KEY);
    expect(data?.pages[1].messages[0].status).toBe('delivered');
    // Head page untouched
    expect(data?.pages[0].messages.map((m) => m.id)).toEqual([10, 9]);
  });

  it('reports replaced: false when no message matches', () => {
    client.setQueryData(THREAD_KEY, makeRegularCache([makeMessage(2), makeMessage(1)]));

    const { touched, replaced } = replaceWaMessage(
      client,
      PHONE,
      (m) => m.id === 99,
      makeMessage(99)
    );

    expect(touched).toBe(true); // cache existed
    expect(replaced).toBe(false);
  });

  it('returns touched: false when the thread cache is absent', () => {
    const { touched, replaced } = replaceWaMessage(
      client,
      '19999999999',
      (m) => m.id === 1,
      makeMessage(1)
    );
    expect(touched).toBe(false);
    expect(replaced).toBe(false);
  });
});

// ============================================================
// replaceOrPrependWaMessage
// ============================================================

describe('replaceOrPrependWaMessage', () => {
  it('replaces an optimistic placeholder when matcher hits', () => {
    const optimistic = makeMessage(-1234, { status: 'pending', body: 'hello' });
    client.setQueryData(THREAD_KEY, makeRegularCache([optimistic]));

    const real = makeMessage(500, { body: 'hello', status: 'sent' });
    const touched = replaceOrPrependWaMessage(
      client,
      PHONE,
      (m) => m.id < 0 && m.status === 'pending' && m.body === real.body,
      real
    );

    expect(touched).toBe(true);
    const data = client.getQueryData<PaginatedWaMessagesResponse>(THREAD_KEY);
    expect(data?.messages.map((m) => m.id)).toEqual([500]);
    expect(data?.total).toBe(1);
  });

  it('prepends when no matcher hits', () => {
    client.setQueryData(THREAD_KEY, makeRegularCache([makeMessage(1)]));

    const fresh = makeMessage(2);
    const touched = replaceOrPrependWaMessage(client, PHONE, () => false, fresh);

    expect(touched).toBe(true);
    const data = client.getQueryData<PaginatedWaMessagesResponse>(THREAD_KEY);
    expect(data?.messages.map((m) => m.id)).toEqual([2, 1]);
  });

  it('does not double-insert when matcher fails but id is already present', () => {
    client.setQueryData(THREAD_KEY, makeRegularCache([makeMessage(7)]));

    // Matcher returns false, so it falls through to prepend; the
    // prepend then sees id=7 already exists and no-ops.
    replaceOrPrependWaMessage(
      client,
      PHONE,
      () => false,
      makeMessage(7, { body: 'should not duplicate' })
    );

    const data = client.getQueryData<PaginatedWaMessagesResponse>(THREAD_KEY);
    expect(data?.messages).toHaveLength(1);
    expect(data?.messages[0].id).toBe(7);
  });

  it('returns false when no cache is present', () => {
    const touched = replaceOrPrependWaMessage(client, '19999999999', () => true, makeMessage(1));
    expect(touched).toBe(false);
  });
});

// ============================================================
// removeWaMessages
// ============================================================

describe('removeWaMessages', () => {
  it('removes matching ids across every page', () => {
    client.setQueryData(
      THREAD_KEY,
      makeInfiniteCache([
        [makeMessage(10), makeMessage(9)],
        [makeMessage(8), makeMessage(7)],
        [makeMessage(6), makeMessage(5)],
      ])
    );

    removeWaMessages(client, PHONE, new Set([10, 7]));

    const data = client.getQueryData<ReturnType<typeof makeInfiniteCache>>(THREAD_KEY);
    expect(data?.pages[0].messages.map((m) => m.id)).toEqual([9]);
    expect(data?.pages[0].total).toBe(1);
    expect(data?.pages[1].messages.map((m) => m.id)).toEqual([8]);
    expect(data?.pages[1].total).toBe(1);
    expect(data?.pages[2].messages.map((m) => m.id)).toEqual([6, 5]);
    expect(data?.pages[2].total).toBe(2);
  });

  it('fans out across every thread when phone is null', () => {
    const otherPhone = '19998887777';
    client.setQueryData(['wa-messages', 'thread', PHONE], makeRegularCache([makeMessage(1)]));
    client.setQueryData(['wa-messages', 'thread', otherPhone], makeRegularCache([makeMessage(2)]));

    removeWaMessages(client, null, new Set([1, 2]));

    expect(
      client.getQueryData<PaginatedWaMessagesResponse>(['wa-messages', 'thread', PHONE])?.messages
    ).toEqual([]);
    expect(
      client.getQueryData<PaginatedWaMessagesResponse>(['wa-messages', 'thread', otherPhone])
        ?.messages
    ).toEqual([]);
  });

  it('is a no-op when the id set is empty', () => {
    const original = makeRegularCache([makeMessage(1)]);
    client.setQueryData(THREAD_KEY, original);

    const touched = removeWaMessages(client, PHONE, new Set());

    expect(touched).toBe(false);
    expect(client.getQueryData(THREAD_KEY)).toBe(original);
  });

  it('preserves array identity on pages with no matching ids', () => {
    // Ensures the per-page short-circuit works — avoids unnecessary
    // re-renders for pages that don't contain any of the ids.
    const cache = makeInfiniteCache([
      [makeMessage(10), makeMessage(9)],
      [makeMessage(8), makeMessage(7)],
    ]);
    client.setQueryData(THREAD_KEY, cache);

    removeWaMessages(client, PHONE, new Set([10])); // only on page 0

    const data = client.getQueryData<typeof cache>(THREAD_KEY);
    // Page 1 untouched at the messages-array level
    expect(data?.pages[1]).toBe(cache.pages[1]);
  });
});

// ============================================================
// mapWaMessages
// ============================================================

describe('mapWaMessages', () => {
  it('transforms matching messages across all pages', () => {
    client.setQueryData(
      THREAD_KEY,
      makeInfiniteCache([
        [makeMessage(10, { direction: 'inbound', readByUser: false })],
        [makeMessage(9, { direction: 'inbound', readByUser: false })],
      ])
    );

    mapWaMessages(client, PHONE, (m) =>
      m.direction === 'inbound' && !m.readByUser ? { ...m, readByUser: true } : m
    );

    const data = client.getQueryData<ReturnType<typeof makeInfiniteCache>>(THREAD_KEY);
    expect(data?.pages[0].messages[0].readByUser).toBe(true);
    expect(data?.pages[1].messages[0].readByUser).toBe(true);
  });

  it('preserves identity when no message changes', () => {
    const cache = makeRegularCache([makeMessage(1, { readByUser: true })]);
    client.setQueryData(THREAD_KEY, cache);

    mapWaMessages(client, PHONE, (m) => (m.readByUser ? m : { ...m, readByUser: true }));

    // The setQueryData write should have been a no-op — same cache object.
    expect(client.getQueryData(THREAD_KEY)).toBe(cache);
  });
});
