/**
 * useCalls Hook Tests
 *
 * Unit tests for calls React Query hooks.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import {
  useCalls,
  useCallStats,
  useUnreadCallCount,
  useMarkCallsAsRead,
  callsKeys,
} from '@/lib/hooks/useCalls';

// Mock the calls service
vi.mock('@/lib/api', () => ({
  callsService: {
    getHistory: vi.fn(),
    getStats: vi.fn(),
    getUnreadCount: vi.fn(),
    markAsRead: vi.fn(),
  },
}));

// Mock the query config
vi.mock('@/lib/constants/query', () => ({
  REALTIME_QUERY_CONFIG: {
    staleTime: Infinity,
    gcTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
  },
}));

import { callsService } from '@/lib/api';

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
};

describe('callsKeys', () => {
  it('should have correct key structure', () => {
    expect(callsKeys.all).toEqual(['calls']);
    expect(callsKeys.list()).toEqual(['calls', 'list', '', undefined]);
    expect(callsKeys.list(50)).toEqual(['calls', 'list', '', 50]);
    expect(callsKeys.list(50, '12164281997')).toEqual(['calls', 'list', '12164281997', 50]);
    expect(callsKeys.stats()).toEqual(['calls', 'stats', '']);
    expect(callsKeys.unreadCount()).toEqual(['calls', 'unread', '']);
  });
});

describe('useCalls', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch calls successfully', async () => {
    const mockCalls = [
      {
        id: 1,
        caller: '+15551234567',
        callee: '+15559876543',
        direction: 'outbound',
        status: 'completed',
        duration: 120,
        read: false,
        createdAt: '2024-01-01T12:00:00Z',
      },
      {
        id: 2,
        caller: '+15559876543',
        callee: '+15551234567',
        direction: 'inbound',
        status: 'missed',
        duration: 0,
        read: false,
        createdAt: '2024-01-01T11:00:00Z',
      },
    ];

    vi.mocked(callsService.getHistory).mockResolvedValue(mockCalls);

    const { result } = renderHook(() => useCalls(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(mockCalls);
    expect(callsService.getHistory).toHaveBeenCalledWith({ limit: 50 });
  });

  it('should accept custom limit', async () => {
    vi.mocked(callsService.getHistory).mockResolvedValue([]);

    const { result } = renderHook(() => useCalls(100), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(callsService.getHistory).toHaveBeenCalledWith({ limit: 100 });
  });

  it('should handle error state', async () => {
    vi.mocked(callsService.getHistory).mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useCalls(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toBeDefined();
  });
});

describe('useCallStats', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch call stats successfully', async () => {
    const mockStats = {
      totalCalls: 100,
      inboundCalls: 40,
      outboundCalls: 60,
      missedCalls: 10,
      totalDuration: 7200,
      averageDuration: 72,
    };

    vi.mocked(callsService.getStats).mockResolvedValue(mockStats);

    const { result } = renderHook(() => useCallStats(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(mockStats);
  });
});

describe('useUnreadCallCount', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch unread count successfully', async () => {
    vi.mocked(callsService.getUnreadCount).mockResolvedValue(5);

    const { result } = renderHook(() => useUnreadCallCount(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toBe(5);
  });

  it('should return zero when no unread', async () => {
    vi.mocked(callsService.getUnreadCount).mockResolvedValue(0);

    const { result } = renderHook(() => useUnreadCallCount(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toBe(0);
  });
});

describe('useMarkCallsAsRead', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should mark specific calls as read', async () => {
    const existingCalls = [
      { id: 1, caller: '+15551234567', read: false },
      { id: 2, caller: '+15559876543', read: false },
      { id: 3, caller: '+15551111111', read: true },
    ];

    vi.mocked(callsService.markAsRead).mockResolvedValue(undefined);

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    queryClient.setQueryData(callsKeys.list(50), existingCalls);
    queryClient.setQueryData(callsKeys.unreadCount(), 2);

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useMarkCallsAsRead(), { wrapper });

    result.current.mutate([1, 2]);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(callsService.markAsRead).toHaveBeenCalledWith([1, 2]);
  });

  it('should mark all calls as read when no IDs provided', async () => {
    vi.mocked(callsService.markAsRead).mockResolvedValue(undefined);

    const { result } = renderHook(() => useMarkCallsAsRead(), {
      wrapper: createWrapper(),
    });

    result.current.mutate(undefined);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(callsService.markAsRead).toHaveBeenCalledWith(undefined);
  });

  it('should handle error', async () => {
    vi.mocked(callsService.markAsRead).mockRejectedValue(new Error('Failed'));

    const { result } = renderHook(() => useMarkCallsAsRead(), {
      wrapper: createWrapper(),
    });

    result.current.mutate([1]);

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
