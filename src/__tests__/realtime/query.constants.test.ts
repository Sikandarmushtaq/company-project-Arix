/**
 * Query Configuration Constants Tests
 * Location: frontend/src/__tests__/realtime/query.constants.test.ts
 *
 * Tests for the centralized query configuration used by React Query hooks.
 * Verifies SSOT compliance for real-time query behavior.
 */

import { describe, it, expect } from 'vitest';
import {
  REALTIME_QUERY_CONFIG,
  STATIC_QUERY_CONFIG,
  POLLING_QUERY_CONFIG,
} from '@/lib/constants/query';

describe('REALTIME_QUERY_CONFIG', () => {
  describe('staleTime configuration', () => {
    it('should have staleTime set to 30 seconds', () => {
      expect(REALTIME_QUERY_CONFIG.staleTime).toBe(30 * 1000);
    });

    it('should mark data as stale after 30 seconds for refresh on navigation', () => {
      // Short stale time ensures data is refetched when returning to page
      expect(REALTIME_QUERY_CONFIG.staleTime).toBe(30000);
    });
  });

  describe('gcTime configuration', () => {
    it('should keep cache for 30 minutes', () => {
      expect(REALTIME_QUERY_CONFIG.gcTime).toBe(30 * 60 * 1000);
    });

    it('should be 1800000ms (30 minutes)', () => {
      expect(REALTIME_QUERY_CONFIG.gcTime).toBe(1800000);
    });
  });

  describe('refetch behavior', () => {
    it('should NOT refetch on window focus', () => {
      expect(REALTIME_QUERY_CONFIG.refetchOnWindowFocus).toBe(false);
    });

    it('should ALWAYS refetch on mount to ensure fresh data', () => {
      expect(REALTIME_QUERY_CONFIG.refetchOnMount).toBe('always');
    });

    it('should refetch on network reconnect as safety net', () => {
      expect(REALTIME_QUERY_CONFIG.refetchOnReconnect).toBe(true);
    });
  });

  describe('retry configuration', () => {
    it('should retry failed requests 2 times', () => {
      expect(REALTIME_QUERY_CONFIG.retry).toBe(2);
    });
  });

  describe('complete configuration', () => {
    it('should have all required properties', () => {
      expect(REALTIME_QUERY_CONFIG).toHaveProperty('staleTime');
      expect(REALTIME_QUERY_CONFIG).toHaveProperty('gcTime');
      expect(REALTIME_QUERY_CONFIG).toHaveProperty('refetchOnWindowFocus');
      expect(REALTIME_QUERY_CONFIG).toHaveProperty('refetchOnMount');
      expect(REALTIME_QUERY_CONFIG).toHaveProperty('refetchOnReconnect');
      expect(REALTIME_QUERY_CONFIG).toHaveProperty('retry');
    });

    it('should match exact expected configuration', () => {
      expect(REALTIME_QUERY_CONFIG).toEqual({
        staleTime: 30 * 1000,
        gcTime: 30 * 60 * 1000,
        refetchOnWindowFocus: false,
        refetchOnMount: 'always',
        refetchOnReconnect: true,
        retry: 2,
      });
    });
  });
});

describe('STATIC_QUERY_CONFIG', () => {
  it('should have 5 minute staleTime for rarely changing data', () => {
    expect(STATIC_QUERY_CONFIG.staleTime).toBe(5 * 60 * 1000);
  });

  it('should keep cache for 30 minutes', () => {
    expect(STATIC_QUERY_CONFIG.gcTime).toBe(30 * 60 * 1000);
  });

  it('should NOT refetch on window focus', () => {
    expect(STATIC_QUERY_CONFIG.refetchOnWindowFocus).toBe(false);
  });

  it('should NOT refetch on mount', () => {
    expect(STATIC_QUERY_CONFIG.refetchOnMount).toBe(false);
  });

  it('should retry failed requests 3 times', () => {
    expect(STATIC_QUERY_CONFIG.retry).toBe(3);
  });
});

describe('POLLING_QUERY_CONFIG', () => {
  it('should have 30 second staleTime for frequently changing data', () => {
    expect(POLLING_QUERY_CONFIG.staleTime).toBe(30 * 1000);
  });

  it('should keep cache for 5 minutes', () => {
    expect(POLLING_QUERY_CONFIG.gcTime).toBe(5 * 60 * 1000);
  });

  it('should refetch on window focus', () => {
    expect(POLLING_QUERY_CONFIG.refetchOnWindowFocus).toBe(true);
  });

  it('should refetch on mount', () => {
    expect(POLLING_QUERY_CONFIG.refetchOnMount).toBe(true);
  });

  it('should retry failed requests 3 times', () => {
    expect(POLLING_QUERY_CONFIG.retry).toBe(3);
  });
});

describe('Configuration comparison', () => {
  it('STATIC_QUERY_CONFIG should have longest staleTime', () => {
    expect(STATIC_QUERY_CONFIG.staleTime).toBeGreaterThan(REALTIME_QUERY_CONFIG.staleTime);
    expect(STATIC_QUERY_CONFIG.staleTime).toBeGreaterThan(POLLING_QUERY_CONFIG.staleTime);
  });

  it('REALTIME and POLLING should have same staleTime', () => {
    expect(REALTIME_QUERY_CONFIG.staleTime).toBe(POLLING_QUERY_CONFIG.staleTime);
  });

  it('REALTIME and STATIC should disable window focus refetch', () => {
    expect(REALTIME_QUERY_CONFIG.refetchOnWindowFocus).toBe(false);
    expect(STATIC_QUERY_CONFIG.refetchOnWindowFocus).toBe(false);
    expect(STATIC_QUERY_CONFIG.refetchOnMount).toBe(false);
  });

  it('POLLING should enable auto-refetch behaviors', () => {
    expect(POLLING_QUERY_CONFIG.refetchOnWindowFocus).toBe(true);
    expect(POLLING_QUERY_CONFIG.refetchOnMount).toBe(true);
  });

  it('STATIC and POLLING should have same retry count', () => {
    expect(REALTIME_QUERY_CONFIG.retry).toBe(2);
    expect(STATIC_QUERY_CONFIG.retry).toBe(3);
    expect(POLLING_QUERY_CONFIG.retry).toBe(3);
  });
});

describe('SSOT compliance', () => {
  it('should use REALTIME_QUERY_CONFIG for WebSocket-updated data', () => {
    // This test documents the intended use case
    // All hooks for calls, messages, contacts, voicemail, recordings, campaigns
    // should spread ...REALTIME_QUERY_CONFIG
    expect(REALTIME_QUERY_CONFIG.staleTime).toBe(30 * 1000);
    expect(REALTIME_QUERY_CONFIG.refetchOnWindowFocus).toBe(false);
    expect(REALTIME_QUERY_CONFIG.refetchOnMount).toBe('always');
  });

  it('should rely on WebSocket reconnect for data sync', () => {
    // refetchOnReconnect: true ensures data is refreshed when network recovers
    // This works in conjunction with useRealtimeSync hook's reconnect handler
    expect(REALTIME_QUERY_CONFIG.refetchOnReconnect).toBe(true);
  });
});
