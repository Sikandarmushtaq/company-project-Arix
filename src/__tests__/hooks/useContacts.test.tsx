/**
 * useContacts Hook Tests
 *
 * Unit tests for contacts React Query hooks.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import {
  useContacts,
  useBlockedContacts,
  useCreateContact,
  useUpdateContact,
  useDeleteContact,
  useBlockContact,
  useUnblockContact,
  contactsKeys,
} from '@/lib/hooks/useContacts';

// Mock the contacts service
vi.mock('@/lib/api', () => ({
  contactsService: {
    getContacts: vi.fn(),
    getBlockedContacts: vi.fn(),
    createContact: vi.fn(),
    updateContact: vi.fn(),
    deleteContact: vi.fn(),
    blockContact: vi.fn(),
    unblockContact: vi.fn(),
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

import { contactsService } from '@/lib/api';

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

describe('contactsKeys', () => {
  it('should have correct key structure', () => {
    expect(contactsKeys.all).toEqual(['contacts']);
    expect(contactsKeys.list()).toEqual(['contacts', 'list']);
    expect(contactsKeys.blocked()).toEqual(['contacts', 'blocked']);
    expect(contactsKeys.detail(1)).toEqual(['contacts', 'detail', 1]);
  });
});

describe('useContacts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch contacts successfully', async () => {
    const mockContacts = [
      { id: 1, name: 'John Doe', contact: '+15551234567', type: 'sms' },
      { id: 2, name: 'Jane Doe', contact: '+15559876543', type: 'sms' },
    ];

    vi.mocked(contactsService.getContacts).mockResolvedValue(mockContacts);

    const { result } = renderHook(() => useContacts(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(mockContacts);
    expect(contactsService.getContacts).toHaveBeenCalled();
  });

  it('should handle error state', async () => {
    vi.mocked(contactsService.getContacts).mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useContacts(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toBeDefined();
  });
});

describe('useBlockedContacts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch blocked contacts successfully', async () => {
    const mockBlocked = [{ id: 1, phoneNumber: '+15559999999', name: 'Spammer', reason: 'Spam' }];

    vi.mocked(contactsService.getBlockedContacts).mockResolvedValue(mockBlocked);

    const { result } = renderHook(() => useBlockedContacts(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(mockBlocked);
  });
});

describe('useCreateContact', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create contact successfully', async () => {
    const newContact = { id: 3, name: 'New Contact', contact: '+15551111111', type: 'sms' };

    vi.mocked(contactsService.createContact).mockResolvedValue(newContact);
    vi.mocked(contactsService.getContacts).mockResolvedValue([]);

    const { result } = renderHook(() => useCreateContact(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({ name: 'New Contact', contact: '+15551111111' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(contactsService.createContact).toHaveBeenCalledWith({
      name: 'New Contact',
      contact: '+15551111111',
    });
  });

  it('should handle creation error', async () => {
    vi.mocked(contactsService.createContact).mockRejectedValue(new Error('Duplicate'));

    const { result } = renderHook(() => useCreateContact(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({ name: 'Test', contact: '+15551234567' });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useUpdateContact', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should update contact with optimistic update', async () => {
    const existingContacts = [{ id: 1, name: 'John Doe', contact: '+15551234567', type: 'sms' }];
    const updatedContact = { id: 1, name: 'John Updated', contact: '+15551234567', type: 'sms' };

    vi.mocked(contactsService.getContacts).mockResolvedValue(existingContacts);
    vi.mocked(contactsService.updateContact).mockResolvedValue(updatedContact);

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    // Pre-populate cache
    queryClient.setQueryData(contactsKeys.list(), existingContacts);

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useUpdateContact(), { wrapper });

    result.current.mutate({ id: 1, data: { name: 'John Updated' } });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(contactsService.updateContact).toHaveBeenCalledWith(1, { name: 'John Updated' });
  });
});

describe('useDeleteContact', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should delete contact with optimistic update', async () => {
    const existingContacts = [
      { id: 1, name: 'John Doe', contact: '+15551234567', type: 'sms' },
      { id: 2, name: 'Jane Doe', contact: '+15559876543', type: 'sms' },
    ];

    vi.mocked(contactsService.deleteContact).mockResolvedValue(undefined);
    vi.mocked(contactsService.getContacts).mockResolvedValue([existingContacts[1]]);

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    queryClient.setQueryData(contactsKeys.list(), existingContacts);

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useDeleteContact(), { wrapper });

    result.current.mutate(1);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(contactsService.deleteContact).toHaveBeenCalledWith(1);
  });
});

describe('useBlockContact', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should block contact successfully', async () => {
    vi.mocked(contactsService.blockContact).mockResolvedValue(undefined);
    vi.mocked(contactsService.getBlockedContacts).mockResolvedValue([]);

    const { result } = renderHook(() => useBlockContact(), {
      wrapper: createWrapper(),
    });

    result.current.mutate('+15559999999');

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(contactsService.blockContact).toHaveBeenCalledWith('+15559999999');
  });
});

describe('useUnblockContact', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should unblock contact with optimistic update', async () => {
    const blockedContacts = [{ id: 1, phoneNumber: '+15559999999', name: 'Spammer' }];

    vi.mocked(contactsService.unblockContact).mockResolvedValue(undefined);
    vi.mocked(contactsService.getBlockedContacts).mockResolvedValue([]);

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    queryClient.setQueryData(contactsKeys.blocked(), blockedContacts);

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useUnblockContact(), { wrapper });

    result.current.mutate(1);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(contactsService.unblockContact).toHaveBeenCalledWith(1);
  });
});
