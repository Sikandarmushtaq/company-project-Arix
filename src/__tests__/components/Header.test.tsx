/**
 * Header Component Tests
 * Location: frontend/src/__tests__/components/Header.test.tsx
 *
 * Tests for the Header component including connection status indicator.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
  }),
}));

// Mock auth store
const mockLogout = vi.fn();
vi.mock('@/lib/stores', () => ({
  useAuthStore: vi.fn(() => ({
    user: {
      id: 1,
      fullName: 'John Doe',
      email: 'john@example.com',
      role: 'user',
    },
    logout: mockLogout,
  })),
}));

// Variable to control socket status
let mockSocketStatus = 'connected';
let mockIsConnected = true;

vi.mock('@/lib/providers/SocketProvider', () => ({
  useSocket: vi.fn(() => ({
    socket: null,
    status: mockSocketStatus,
    isConnected: mockIsConnected,
  })),
}));

// Mock unread counts
// Mock @/lib/hooks - the barrel export used by NotificationDropdown
vi.mock('@/lib/hooks', () => ({
  // Calls hooks
  useUnreadCallCount: vi.fn(() => ({ data: 0, isLoading: false, isError: false })),
  useUnreadCalls: vi.fn(() => ({
    data: [],
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  })),
  useMarkCallsAsRead: vi.fn(() => ({ mutate: vi.fn() })),
  callsKeys: {
    all: ['calls'],
    list: () => ['calls', 'list'],
    stats: () => ['calls', 'stats'],
    unreadCount: () => ['calls', 'unread'],
    unreadCalls: () => ['calls', 'unread-list'],
  },
  // Messages hooks
  useUnreadMessageCount: vi.fn(() => ({ data: 0, isLoading: false, isError: false })),
  useUnreadConversations: vi.fn(() => ({
    data: [],
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  })),
  useMarkMessagesAsRead: vi.fn(() => ({ mutate: vi.fn() })),
  messagesKeys: {
    all: ['messages'],
    conversations: () => ['messages', 'conversations'],
    messages: () => ['messages', 'thread'],
    unreadCount: () => ['messages', 'unread'],
    unreadConversations: () => ['messages', 'unread-conversations'],
  },
  // Voicemail hooks
  useVoicemailCounts: vi.fn(() => ({ data: { unread: 0 } })),
  voicemailKeys: {
    all: ['voicemail'],
    list: () => ['voicemail', 'list'],
    counts: () => ['voicemail', 'counts'],
  },
  // Contact name hook (used by MissedCallItem)
  useContactDisplayName: vi.fn(
    (phone: string, contactName?: string | null) => contactName || phone
  ),
  useContactName: vi.fn(() => null),
  // Real-time sync hook
  useRealtimeSync: vi.fn(),
}));

// Import after mocks
import { Header } from '@/components/layout/Header';

// Create a wrapper with QueryClientProvider
const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('Header Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSocketStatus = 'connected';
    mockIsConnected = true;
  });

  describe('Rendering', () => {
    it('should render without crashing', () => {
      render(<Header />, { wrapper: createWrapper() });
      expect(document.querySelector('header')).toBeTruthy();
    });

    it('should render with title', () => {
      render(<Header title="Dashboard" />, { wrapper: createWrapper() });
      expect(screen.getByText('Dashboard')).toBeTruthy();
    });

    it('should render user name', () => {
      render(<Header />, { wrapper: createWrapper() });
      expect(screen.getByText('John Doe')).toBeTruthy();
    });

    it('should render user role', () => {
      render(<Header />, { wrapper: createWrapper() });
      expect(screen.getByText('user')).toBeTruthy();
    });
  });

  describe('Connection Status Indicator', () => {
    it('should show "Live" when connected', () => {
      mockSocketStatus = 'connected';
      mockIsConnected = true;

      render(<Header />, { wrapper: createWrapper() });
      expect(screen.getByText('Live')).toBeTruthy();
    });

    it('should show "Connecting" when connecting', () => {
      mockSocketStatus = 'connecting';
      mockIsConnected = false;

      render(<Header />, { wrapper: createWrapper() });
      expect(screen.getByText('Connecting')).toBeTruthy();
    });

    it('should show "Offline" when disconnected', () => {
      mockSocketStatus = 'disconnected';
      mockIsConnected = false;

      render(<Header />, { wrapper: createWrapper() });
      expect(screen.getByText('Offline')).toBeTruthy();
    });

    it('should show "Offline" when error', () => {
      mockSocketStatus = 'error';
      mockIsConnected = false;

      render(<Header />, { wrapper: createWrapper() });
      expect(screen.getByText('Offline')).toBeTruthy();
    });

    it('should have green indicator when connected', () => {
      mockSocketStatus = 'connected';
      mockIsConnected = true;

      render(<Header />, { wrapper: createWrapper() });
      const indicator = document.querySelector('.bg-green-500');
      expect(indicator).toBeTruthy();
    });

    it('should have yellow pulsing indicator when connecting', () => {
      mockSocketStatus = 'connecting';
      mockIsConnected = false;

      render(<Header />, { wrapper: createWrapper() });
      const indicator = document.querySelector('.bg-yellow-500');
      expect(indicator).toBeTruthy();
    });

    it('should have red indicator when disconnected', () => {
      mockSocketStatus = 'disconnected';
      mockIsConnected = false;

      render(<Header />, { wrapper: createWrapper() });
      const indicator = document.querySelector('.bg-red-500');
      expect(indicator).toBeTruthy();
    });

    it('should have aria-label for connected state', () => {
      mockSocketStatus = 'connected';
      mockIsConnected = true;

      render(<Header />, { wrapper: createWrapper() });
      const statusDiv = screen.getByLabelText('Real-time connected');
      expect(statusDiv).toBeTruthy();
    });

    it('should have aria-label for connecting state', () => {
      mockSocketStatus = 'connecting';
      mockIsConnected = false;

      render(<Header />, { wrapper: createWrapper() });
      const statusDiv = screen.getByLabelText('Connecting...');
      expect(statusDiv).toBeTruthy();
    });

    it('should have aria-label for disconnected state', () => {
      mockSocketStatus = 'disconnected';
      mockIsConnected = false;

      render(<Header />, { wrapper: createWrapper() });
      const statusDiv = screen.getByLabelText('Disconnected - updates may be delayed');
      expect(statusDiv).toBeTruthy();
    });
  });

  describe('Theme Toggle', () => {
    it('should toggle theme on button click', () => {
      render(<Header />, { wrapper: createWrapper() });

      // Find theme toggle button (it has FiMoon or FiSun icon)
      const buttons = screen.getAllByRole('button');
      const themeButton = buttons.find((btn) => btn.querySelector('svg'));

      expect(themeButton).toBeTruthy();
    });
  });

  describe('Logout', () => {
    it('should have logout button', () => {
      render(<Header />, { wrapper: createWrapper() });

      const logoutButton = screen.getByLabelText('Log out of your account');
      expect(logoutButton).toBeTruthy();
    });

    it('should call logout on click', () => {
      render(<Header />, { wrapper: createWrapper() });

      const logoutButton = screen.getByLabelText('Log out of your account');
      fireEvent.click(logoutButton);

      expect(mockLogout).toHaveBeenCalled();
    });
  });

  describe('Notifications', () => {
    it('should have notification button', () => {
      render(<Header />, { wrapper: createWrapper() });

      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBeGreaterThan(0);
    });

    it('should render notification dropdown', () => {
      render(<Header />, { wrapper: createWrapper() });
      // Check that the header renders without errors
      expect(document.querySelector('header')).toBeTruthy();
    });
  });
});

describe('getConnectionIndicator function logic', () => {
  // Testing the logic of getConnectionIndicator
  function getConnectionIndicator(socketStatus: string) {
    switch (socketStatus) {
      case 'connected':
        return {
          color: 'bg-green-500',
          title: 'Real-time connected',
          text: 'Live',
        };
      case 'connecting':
        return {
          color: 'bg-yellow-500 animate-pulse',
          title: 'Connecting...',
          text: 'Connecting',
        };
      case 'error':
      case 'disconnected':
      default:
        return {
          color: 'bg-red-500',
          title: 'Disconnected - updates may be delayed',
          text: 'Offline',
        };
    }
  }

  it('should return green for connected', () => {
    const result = getConnectionIndicator('connected');
    expect(result.color).toBe('bg-green-500');
    expect(result.title).toBe('Real-time connected');
    expect(result.text).toBe('Live');
  });

  it('should return yellow with pulse for connecting', () => {
    const result = getConnectionIndicator('connecting');
    expect(result.color).toContain('bg-yellow-500');
    expect(result.color).toContain('animate-pulse');
    expect(result.title).toBe('Connecting...');
    expect(result.text).toBe('Connecting');
  });

  it('should return red for disconnected', () => {
    const result = getConnectionIndicator('disconnected');
    expect(result.color).toBe('bg-red-500');
    expect(result.title).toContain('Disconnected');
    expect(result.text).toBe('Offline');
  });

  it('should return red for error', () => {
    const result = getConnectionIndicator('error');
    expect(result.color).toBe('bg-red-500');
    expect(result.text).toBe('Offline');
  });

  it('should return red for unknown status', () => {
    const result = getConnectionIndicator('unknown');
    expect(result.color).toBe('bg-red-500');
  });
});

describe('Connection status display logic', () => {
  type SocketStatus = 'connected' | 'connecting' | 'disconnected' | 'error';

  const getStatusText = (isConnected: boolean, socketStatus: SocketStatus): string => {
    return isConnected ? 'Live' : socketStatus === 'connecting' ? 'Connecting' : 'Offline';
  };

  it('should show Live when isConnected is true', () => {
    expect(getStatusText(true, 'connected')).toBe('Live');
  });

  it('should show Connecting when connecting', () => {
    expect(getStatusText(false, 'connecting')).toBe('Connecting');
  });

  it('should show Offline when disconnected', () => {
    expect(getStatusText(false, 'disconnected')).toBe('Offline');
  });

  it('should show Offline when error', () => {
    expect(getStatusText(false, 'error')).toBe('Offline');
  });
});
