/**
 * Messages Hooks Tests
 *
 * Unit tests for useConversationState, useMessagesState, and useSendMessageState hooks.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useSearchParams: vi.fn(() => ({
    get: vi.fn(() => null),
  })),
}));

// Mock toast store
const mockToast = {
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  warning: vi.fn(),
};

vi.mock('@/lib/stores/toast', () => ({
  useToast: () => mockToast,
}));

// Mock query hooks
vi.mock('@/lib/hooks', () => ({
  useConversationsPaginated: vi.fn(() => ({
    data: { conversations: [], total: 0, totalPages: 0 },
    isLoading: false,
    isFetching: false,
    refetch: vi.fn(),
  })),
  useSearchMessages: vi.fn(() => ({
    data: null,
    isLoading: false,
    isFetching: false,
  })),
  useDeleteConversation: vi.fn(() => ({
    mutateAsync: vi.fn(),
    isPending: false,
  })),
  useDeleteConversations: vi.fn(() => ({
    mutateAsync: vi.fn(),
    isPending: false,
  })),
  useMessagesPaginated: vi.fn(() => ({
    data: { messages: [], total: 0, totalPages: 0 },
    isLoading: false,
    isFetching: false,
    refetch: vi.fn(),
  })),
  useMarkMessagesAsRead: vi.fn(() => ({
    mutate: vi.fn(),
  })),
  useDeleteMessages: vi.fn(() => ({
    mutateAsync: vi.fn(),
    isPending: false,
  })),
  useSendMessage: vi.fn(() => ({
    mutateAsync: vi.fn(),
    isPending: false,
  })),
}));

// Mock media service
vi.mock('@/lib/api', () => ({
  mediaService: {
    uploadFile: vi.fn(),
  },
}));

// Mock phone utils
vi.mock('@/lib/utils/phone', () => ({
  normalizePhone: vi.fn((phone: string) => phone?.replace(/\D/g, '') || ''),
}));

// Import after mocks
import { useConversationState } from '@/app/phone/messages/_components/hooks/useConversationState';
import { useMessagesState } from '@/app/phone/messages/_components/hooks/useMessagesState';
import { useSendMessageState } from '@/app/phone/messages/_components/hooks/useSendMessageState';
import {
  useConversationsPaginated,
  useSearchMessages,
  useDeleteConversation,
  useDeleteConversations,
  useMessagesPaginated,
  useMarkMessagesAsRead,
  useDeleteMessages,
  useSendMessage,
} from '@/lib/hooks';
import { mediaService } from '@/lib/api';

// Query client wrapper
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

describe('useConversationState', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should initialize with default state', () => {
    const { result } = renderHook(() => useConversationState(), {
      wrapper: createWrapper(),
    });

    expect(result.current.conversationSearch).toBe('');
    expect(result.current.debouncedSearch).toBe('');
    expect(result.current.conversations).toEqual([]);
    expect(result.current.selectedPhone).toBeNull();
    expect(result.current.conversationSelectionMode).toBe(false);
    expect(result.current.selectedConversations.size).toBe(0);
    expect(result.current.showDeleteConfirmation).toBe(false);
    expect(result.current.showNewConversation).toBe(false);
  });

  it('should update search and debounce', async () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useConversationState(), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.setConversationSearch('test');
    });

    expect(result.current.conversationSearch).toBe('test');
    expect(result.current.debouncedSearch).toBe('');

    // Fast-forward debounce timer
    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(result.current.debouncedSearch).toBe('test');
  });

  it('should toggle selection mode', () => {
    const { result } = renderHook(() => useConversationState(), {
      wrapper: createWrapper(),
    });

    expect(result.current.conversationSelectionMode).toBe(false);

    act(() => {
      result.current.handleToggleConversationSelectionMode();
    });

    expect(result.current.conversationSelectionMode).toBe(true);

    act(() => {
      result.current.handleToggleConversationSelectionMode();
    });

    expect(result.current.conversationSelectionMode).toBe(false);
  });

  it('should set selected phone', () => {
    const { result } = renderHook(() => useConversationState(), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.setSelectedPhone('+1234567890');
    });

    expect(result.current.selectedPhone).toBe('+1234567890');
  });

  it('should handle new conversation flow', () => {
    const { result } = renderHook(() => useConversationState(), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.setShowNewConversation(true);
      result.current.setNewPhoneInput('5551234567');
    });

    expect(result.current.showNewConversation).toBe(true);
    expect(result.current.newPhoneInput).toBe('5551234567');
  });

  it('should show error for invalid phone number', () => {
    const { result } = renderHook(() => useConversationState(), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.setNewPhoneInput('123');
      result.current.handleStartNewConversation();
    });

    expect(mockToast.error).toHaveBeenCalledWith('Please enter a valid phone number');
  });

  it('should handle delete confirmation flow', () => {
    const { result } = renderHook(() => useConversationState(), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.setShowDeleteConfirmation(true);
    });

    expect(result.current.showDeleteConfirmation).toBe(true);

    act(() => {
      result.current.setShowDeleteConfirmation(false);
    });

    expect(result.current.showDeleteConfirmation).toBe(false);
  });
});

describe('useMessagesState', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const defaultProps = {
    normalizedSelectedPhone: '1234567890',
    effectivePhone: '+1234567890',
    selectedConversation: { unreadCount: 0 },
  };

  it('should initialize with default state', () => {
    const { result } = renderHook(() => useMessagesState(defaultProps), {
      wrapper: createWrapper(),
    });

    expect(result.current.messages).toEqual([]);
    expect(result.current.isLoadingMessages).toBe(false);
    expect(result.current.messageSearch).toBe('');
    expect(result.current.showMessageSearch).toBe(false);
    expect(result.current.messageSelectionMode).toBe(false);
    expect(result.current.selectedMessagesCount).toBe(0);
  });

  it('should update message search', async () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useMessagesState(defaultProps), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.setMessageSearch('hello');
    });

    expect(result.current.messageSearch).toBe('hello');

    // Fast-forward debounce timer
    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(result.current.debouncedMessageSearch).toBe('hello');
  });

  it('should toggle message selection mode', () => {
    const { result } = renderHook(() => useMessagesState(defaultProps), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.handleToggleMessageSelectionMode();
    });

    expect(result.current.messageSelectionMode).toBe(true);

    act(() => {
      result.current.handleToggleMessageSelectionMode();
    });

    expect(result.current.messageSelectionMode).toBe(false);
  });

  it('should toggle search visibility', () => {
    const { result } = renderHook(() => useMessagesState(defaultProps), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.setShowMessageSearch(true);
    });

    expect(result.current.showMessageSearch).toBe(true);
  });

  it('should handle scroll to message', () => {
    const { result } = renderHook(() => useMessagesState(defaultProps), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.setScrollToMessageId(123);
      result.current.setScrollToPhone('1234567890');
    });

    // These are stored in state for effect processing
    expect(result.current.highlightedMessageId).toBeNull(); // Not set until effect runs
  });

  it('should return correct isMessageSelected', () => {
    (useMessagesPaginated as ReturnType<typeof vi.fn>).mockReturnValue({
      data: {
        messages: [
          { id: 1, body: 'test', direction: 'outbound' },
          { id: 2, body: 'test2', direction: 'inbound' },
        ],
        total: 2,
        totalPages: 1,
      },
      isLoading: false,
      isFetching: false,
      refetch: vi.fn(),
    });

    const { result } = renderHook(() => useMessagesState(defaultProps), {
      wrapper: createWrapper(),
    });

    // Initially no messages selected
    expect(result.current.isMessageSelected(1)).toBe(false);

    // Toggle selection
    act(() => {
      result.current.handleToggleMessageSelectionMode();
      result.current.handleToggleMessageSelect(1);
    });

    expect(result.current.isMessageSelected(1)).toBe(true);
    expect(result.current.isMessageSelected(2)).toBe(false);
  });
});

describe('useSendMessageState', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const defaultProps = {
    effectivePhone: '+1234567890',
    onMessageSent: vi.fn(),
  };

  it('should initialize with default state', () => {
    const { result } = renderHook(() => useSendMessageState(defaultProps), {
      wrapper: createWrapper(),
    });

    expect(result.current.newMessage).toBe('');
    expect(result.current.selectedFiles).toEqual([]);
    expect(result.current.isSending).toBe(false);
    expect(result.current.isUploading).toBe(false);
    expect(result.current.isDragging).toBe(false);
  });

  it('should update new message', () => {
    const { result } = renderHook(() => useSendMessageState(defaultProps), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.setNewMessage('Hello world');
    });

    expect(result.current.newMessage).toBe('Hello world');
  });

  it('should not send when message is empty without files', async () => {
    const mockMutateAsync = vi.fn();
    (useSendMessage as ReturnType<typeof vi.fn>).mockReturnValue({
      mutateAsync: mockMutateAsync,
      isPending: false,
    });

    const { result } = renderHook(() => useSendMessageState(defaultProps), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.handleSend();
    });

    // Should not call mutateAsync when no content
    expect(mockMutateAsync).not.toHaveBeenCalled();
  });

  it('should not send when no phone selected', async () => {
    const mockMutateAsync = vi.fn();
    (useSendMessage as ReturnType<typeof vi.fn>).mockReturnValue({
      mutateAsync: mockMutateAsync,
      isPending: false,
    });

    const { result } = renderHook(
      () => useSendMessageState({ effectivePhone: null, onMessageSent: vi.fn() }),
      { wrapper: createWrapper() }
    );

    act(() => {
      result.current.setNewMessage('Hello');
    });

    await act(async () => {
      await result.current.handleSend();
    });

    // Should not call mutateAsync when no phone
    expect(mockMutateAsync).not.toHaveBeenCalled();
  });

  it('should send message successfully', async () => {
    const mockMutateAsync = vi.fn().mockResolvedValue({});
    (useSendMessage as ReturnType<typeof vi.fn>).mockReturnValue({
      mutateAsync: mockMutateAsync,
      isPending: false,
    });

    const onMessageSent = vi.fn();
    const { result } = renderHook(
      () => useSendMessageState({ effectivePhone: '+1234567890', onMessageSent }),
      { wrapper: createWrapper() }
    );

    act(() => {
      result.current.setNewMessage('Hello');
    });

    await act(async () => {
      await result.current.handleSend();
    });

    expect(mockMutateAsync).toHaveBeenCalledWith({
      to: '+1234567890',
      body: 'Hello',
      mediaUrls: undefined, // Empty mediaUrls is undefined, not []
    });
    expect(result.current.newMessage).toBe('');
    expect(onMessageSent).toHaveBeenCalled();
  });

  it('should handle drag events', () => {
    const { result } = renderHook(() => useSendMessageState(defaultProps), {
      wrapper: createWrapper(),
    });

    // Create a mock drag event
    const mockEvent = {
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
      dataTransfer: { types: ['Files'] },
    } as unknown as React.DragEvent;

    act(() => {
      result.current.handleDragEnter(mockEvent);
    });

    expect(result.current.isDragging).toBe(true);

    act(() => {
      result.current.handleDragLeave(mockEvent);
    });

    expect(result.current.isDragging).toBe(false);
  });

  it('should update selected files', () => {
    const { result } = renderHook(() => useSendMessageState(defaultProps), {
      wrapper: createWrapper(),
    });

    const mockFiles = [
      { file: new File(['test'], 'test.png', { type: 'image/png' }), preview: 'blob:test' },
    ];

    act(() => {
      result.current.setSelectedFiles(mockFiles);
    });

    expect(result.current.selectedFiles).toEqual(mockFiles);
  });
});
