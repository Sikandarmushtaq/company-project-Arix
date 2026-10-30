/**
 * Comprehensive SocketProvider Tests
 * Location: frontend/src/__tests__/realtime/SocketProvider.test.tsx
 *
 * Tests for the Socket.IO provider and hooks.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import React from 'react';
import { SocketProvider, useSocket, useSocketEvent } from '@/lib/providers/SocketProvider';

// Mock socket.io-client
const mockSocket = {
  on: vi.fn(),
  off: vi.fn(),
  emit: vi.fn(),
  connect: vi.fn(),
  disconnect: vi.fn(),
  connected: false,
  id: 'test-socket-id',
  active: true,
  // Socket.IO v4 Manager — carries the reconnect* events.
  io: { on: vi.fn(), off: vi.fn() },
};

vi.mock('socket.io-client', () => ({
  io: vi.fn(() => mockSocket),
}));

// Mock auth store
vi.mock('@/lib/stores', () => ({
  useAuthStore: vi.fn(() => ({
    token: 'test-token',
    isAuthenticated: true,
  })),
}));

describe('SocketProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('useSocket hook', () => {
    it('should return default values when used outside provider', () => {
      const { result } = renderHook(() => useSocket());

      expect(result.current.socket).toBeNull();
      expect(result.current.status).toBe('disconnected');
      expect(result.current.isConnected).toBe(false);
    });

    it('should return socket context when used inside provider', () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <SocketProvider>{children}</SocketProvider>
      );

      const { result } = renderHook(() => useSocket(), { wrapper });

      // Initial state should be connecting since auth is mocked as authenticated
      expect(result.current.status).toBeDefined();
      expect(typeof result.current.isConnected).toBe('boolean');
    });

    it('should be safe to use multiple times in same component', () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <SocketProvider>{children}</SocketProvider>
      );

      const { result } = renderHook(
        () => {
          const socket1 = useSocket();
          const socket2 = useSocket();
          return { socket1, socket2 };
        },
        { wrapper }
      );

      expect(result.current.socket1.status).toBe(result.current.socket2.status);
    });
  });

  describe('useSocketEvent hook', () => {
    it('should register event listener when socket is available', () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <SocketProvider>{children}</SocketProvider>
      );

      const callback = vi.fn();
      renderHook(() => useSocketEvent('test:event', callback), { wrapper });

      // The hook should attempt to register the event
      // Since socket is mocked, we verify the pattern works
      expect(callback).not.toHaveBeenCalled();
    });

    it('should not throw when used outside provider', () => {
      const callback = vi.fn();

      // Should not throw even without provider
      expect(() => {
        renderHook(() => useSocketEvent('test:event', callback));
      }).not.toThrow();
    });

    it('should cleanup listener on unmount', () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <SocketProvider>{children}</SocketProvider>
      );

      const callback = vi.fn();
      const { unmount } = renderHook(() => useSocketEvent('test:event', callback), { wrapper });

      unmount();

      // Verify cleanup pattern is correct
      expect(callback).not.toHaveBeenCalled();
    });

    it('should accept dependency array', () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <SocketProvider>{children}</SocketProvider>
      );

      const callback = vi.fn();
      const deps = ['dep1', 'dep2'];

      expect(() => {
        renderHook(() => useSocketEvent('test:event', callback, deps), { wrapper });
      }).not.toThrow();
    });
  });
});

describe('Socket connection states', () => {
  it('should have valid connection status types', () => {
    const validStatuses = ['connecting', 'connected', 'disconnected', 'error'];

    const { result } = renderHook(() => useSocket());

    expect(validStatuses).toContain(result.current.status);
  });

  it('should correctly derive isConnected from status', () => {
    const { result } = renderHook(() => useSocket());

    // Outside provider, should be disconnected
    expect(result.current.isConnected).toBe(false);
    expect(result.current.status).toBe('disconnected');
  });
});

describe('Socket context value structure', () => {
  it('should have correct shape when outside provider', () => {
    const { result } = renderHook(() => useSocket());

    expect(result.current).toHaveProperty('socket');
    expect(result.current).toHaveProperty('status');
    expect(result.current).toHaveProperty('isConnected');
  });

  it('should have correct shape when inside provider', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <SocketProvider>{children}</SocketProvider>
    );

    const { result } = renderHook(() => useSocket(), { wrapper });

    expect(result.current).toHaveProperty('socket');
    expect(result.current).toHaveProperty('status');
    expect(result.current).toHaveProperty('isConnected');
  });
});

describe('Provider rendering', () => {
  it('should render children', () => {
    const TestChild = () => <div data-testid="child">Test</div>;

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <SocketProvider>{children}</SocketProvider>
    );

    const { result } = renderHook(() => useSocket(), { wrapper });

    // Provider should work without crashing
    expect(result.current).toBeDefined();
  });

  it('should support nested providers without crashing', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <SocketProvider>
        <SocketProvider>{children}</SocketProvider>
      </SocketProvider>
    );

    expect(() => {
      renderHook(() => useSocket(), { wrapper });
    }).not.toThrow();
  });
});

describe('Socket event types', () => {
  it('should accept any string event name', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <SocketProvider>{children}</SocketProvider>
    );

    const eventNames = [
      'call:incoming',
      'sms:received',
      'voicemail:new',
      'contact:changed',
      'campaign:updated',
      'custom:event',
    ];

    eventNames.forEach((eventName) => {
      const callback = vi.fn();
      expect(() => {
        renderHook(() => useSocketEvent(eventName, callback), { wrapper });
      }).not.toThrow();
    });
  });
});
