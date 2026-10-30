/**
 * useWaMarkAsRead — scoped-cancel regression test.
 *
 * Pins the "click unread chat → thread doesn't load" bug. The mutation
 * MUST NOT call `cancelQueries` with `waMessagesKeys.all` (or any key
 * that covers thread queries). If it does, the chat-selection's
 * just-started messages fetch gets killed before any data arrives, and
 * the user sees the empty state until they click a different chat and
 * back.
 *
 * The scoped-cancel contract documented at the top of `onMutate` in
 * useWaMessageMutations.ts is what's being verified here.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

// ---- mocks ----

vi.mock('@/lib/api', () => ({
  whatsappService: {
    markAsRead: vi.fn().mockResolvedValue({ markedCount: 1 }),
  },
}));

vi.mock('@/lib/constants/query', () => ({
  REALTIME_QUERY_CONFIG: {
    staleTime: Infinity,
    gcTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
  },
}));

// ---- imports (after mocks) ----

import { useWaMarkAsRead } from '@/lib/hooks/useWaMessageMutations';
import { waMessagesKeys } from '@/lib/hooks/useWaMessages';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { queryClient, Wrapper };
}

describe('useWaMarkAsRead — scoped cancel contract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does NOT cancel the thread messages query when firing markAsRead', async () => {
    const { queryClient, Wrapper } = createWrapper();

    // Spy on cancelQueries so we can introspect every key it touches.
    const cancelSpy = vi.spyOn(queryClient, 'cancelQueries');

    const { result } = renderHook(() => useWaMarkAsRead(), {
      wrapper: Wrapper,
    });

    await result.current.mutateAsync('60162884069');

    // Every cancel call's key prefix must NOT match the thread cache.
    // Thread cache keys look like: ['wa-messages', 'thread', '<phone>', ...].
    // The mutation is allowed to cancel:
    //   - waMessagesKeys.conversations() → ['wa-messages', 'conversations']
    //   - waMessagesKeys.unreadCount()   → ['wa-messages', 'unread']
    // Anything starting with ['wa-messages', 'thread'] would kill the
    // just-started thread fetch and is a regression.
    const offendingCancel = cancelSpy.mock.calls.find((call) => {
      const filters = call[0] as { queryKey?: readonly unknown[] };
      const key = filters?.queryKey;
      if (!Array.isArray(key)) return false;
      // Match exact thread prefix OR the broad `waMessagesKeys.all`
      // (which COVERS the thread prefix).
      if (key[0] === 'wa-messages' && key[1] === 'thread') return true;
      if (key.length === 1 && key[0] === 'wa-messages') return true; // waMessagesKeys.all
      return false;
    });

    expect(offendingCancel).toBeUndefined();
  });

  it('does cancel the conversations + unreadCount caches (positive case)', async () => {
    const { queryClient, Wrapper } = createWrapper();
    const cancelSpy = vi.spyOn(queryClient, 'cancelQueries');

    const { result } = renderHook(() => useWaMarkAsRead(), {
      wrapper: Wrapper,
    });

    await result.current.mutateAsync('60162884069');

    const allCancelledKeys = cancelSpy.mock.calls
      .map((call) => (call[0] as { queryKey?: readonly unknown[] }).queryKey)
      .filter((k): k is readonly unknown[] => Array.isArray(k));

    // Conversations cancel
    expect(
      allCancelledKeys.some(
        (k) =>
          k.length === waMessagesKeys.conversations().length &&
          k.every((seg, i) => seg === waMessagesKeys.conversations()[i])
      )
    ).toBe(true);

    // Unread count cancel
    expect(
      allCancelledKeys.some(
        (k) =>
          k.length === waMessagesKeys.unreadCount().length &&
          k.every((seg, i) => seg === waMessagesKeys.unreadCount()[i])
      )
    ).toBe(true);
  });

  it('survives a concurrent in-flight thread query (the real-world repro)', async () => {
    // Reproduces the user-visible bug: a thread query for the same phone
    // is in flight when markAsRead fires. Before the fix, the mutation
    // cancelled the thread fetch via the broad waMessagesKeys.all key,
    // leaving the thread query stuck in `pending` with no data.
    const { queryClient, Wrapper } = createWrapper();

    const threadKey = ['wa-messages', 'thread', '60162884069', {}] as const;

    // Simulate an in-flight thread fetch that takes 50ms to resolve.
    const threadFetchPromise = queryClient.fetchQuery({
      queryKey: threadKey,
      queryFn: () =>
        new Promise((resolve) =>
          setTimeout(() => resolve({ messages: [{ id: 1, body: 'hi' }] }), 50)
        ),
    });

    // Fire markAsRead immediately (same render tick — the user-click path).
    const { result } = renderHook(() => useWaMarkAsRead(), {
      wrapper: Wrapper,
    });
    await result.current.mutateAsync('60162884069');

    // The thread fetch must still resolve with data. Before the fix it
    // would reject with a CancelledError because cancelQueries killed it.
    await expect(threadFetchPromise).resolves.toBeDefined();

    // And the cache must contain the data so the UI can render.
    await waitFor(() => {
      expect(queryClient.getQueryData(threadKey)).toEqual({
        messages: [{ id: 1, body: 'hi' }],
      });
    });
  });
});
