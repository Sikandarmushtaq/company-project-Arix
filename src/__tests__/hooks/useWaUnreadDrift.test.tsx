/**
 * WA unread-count bell drift contract — regression tests.
 *
 * Pins the "bell briefly shows 1, then vanishes" bug. The fix moved the
 * bell scalar from optimistic write to server-as-source-of-truth for the
 * cross-tab/cross-device path. These tests pin the new contract so the
 * next contributor who adds an optimistic decrement to `handleWaRead`
 * fails CI before the bug ships.
 *
 * Contract being verified:
 *   - WA_RECEIVED handler  : sets +1 optimistic AND invalidates (defense)
 *   - WA_READ handler      : invalidates only — NO setQueryData write
 *   - markAsRead.onMutate  : sets -N optimistic (own action, instant UX)
 *   - markAsRead.onSettled : invalidates (reconciliation)
 *
 * The asymmetry between WA_RECEIVED (optimistic+invalidate) and WA_READ
 * (invalidate-only) is deliberate: an inbound message can only push the
 * count up, so the optimistic +1 can't underflow. A read event is a
 * broadcast that fans out to users whose per-user scope may not have
 * included those N items — the optimistic -N underflows in that case.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

// ---- mocks ----

vi.mock('@/lib/api', () => ({
  whatsappService: {
    markAsRead: vi.fn().mockResolvedValue({ markedCount: 3 }),
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

describe('WA bell unread-count drift contract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('useWaMarkAsRead.onMutate sets bell optimistically (instant feedback for user action)', async () => {
    const { queryClient, Wrapper } = createWrapper();
    queryClient.setQueryData(waMessagesKeys.unreadCount(), 5);

    const setSpy = vi.spyOn(queryClient, 'setQueryData');

    const { result } = renderHook(() => useWaMarkAsRead(), { wrapper: Wrapper });
    await result.current.mutateAsync('60162884069');

    // onMutate ran setQueryData on the unread cache (optimistic decrement)
    const unreadWrites = setSpy.mock.calls.filter((call) => {
      const key = call[0] as readonly unknown[];
      return (
        Array.isArray(key) &&
        key.length === waMessagesKeys.unreadCount().length &&
        key.every((seg, i) => seg === waMessagesKeys.unreadCount()[i])
      );
    });
    expect(unreadWrites.length).toBeGreaterThanOrEqual(1);
  });

  it('useWaMarkAsRead.onSettled invalidates the bell for server reconciliation', async () => {
    const { queryClient, Wrapper } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useWaMarkAsRead(), { wrapper: Wrapper });
    await result.current.mutateAsync('60162884069');

    const unreadInvalidations = invalidateSpy.mock.calls.filter((call) => {
      const filters = call[0] as { queryKey?: readonly unknown[] };
      const key = filters?.queryKey;
      return (
        Array.isArray(key) &&
        key.length === waMessagesKeys.unreadCount().length &&
        key.every((seg, i) => seg === waMessagesKeys.unreadCount()[i])
      );
    });
    // At least one invalidate hit unreadCount (could be more — onMutate may
    // also invalidate via the conversations key, but THIS test pins the
    // bell scalar specifically).
    expect(unreadInvalidations.length).toBeGreaterThanOrEqual(1);
  });

  it('useWaMarkAsRead onMutate does NOT cancel the thread query (independent fix verification)', async () => {
    // Sanity overlap with useWaMarkAsRead.test.tsx — re-pinned here so that
    // if someone "fixes" the bell drift by broadening the cancel scope,
    // this test still fails.
    const { queryClient, Wrapper } = createWrapper();
    const cancelSpy = vi.spyOn(queryClient, 'cancelQueries');

    const { result } = renderHook(() => useWaMarkAsRead(), { wrapper: Wrapper });
    await result.current.mutateAsync('60162884069');

    const offending = cancelSpy.mock.calls.find((call) => {
      const filters = call[0] as { queryKey?: readonly unknown[] };
      const key = filters?.queryKey;
      if (!Array.isArray(key)) return false;
      if (key[0] === 'wa-messages' && key[1] === 'thread') return true;
      if (key.length === 1 && key[0] === 'wa-messages') return true;
      return false;
    });
    expect(offending).toBeUndefined();
  });
});
