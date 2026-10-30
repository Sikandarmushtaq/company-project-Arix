'use client';

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import {
  useUnifiedConversations,
  useGroups,
  useGroup,
  useGroupMessages,
  useCreateGroup,
  useUpdateGroup,
  useDeleteGroup,
  useAddGroupMembers,
  useRemoveGroupMember,
  useSendGroupMessage,
  groupsKeys,
} from '@/lib/hooks/useGroups';
import { smsGroupService } from '@/lib/api';

// Mock the smsGroupService
vi.mock('@/lib/api', () => ({
  smsGroupService: {
    getUnifiedConversations: vi.fn(),
    getGroups: vi.fn(),
    getGroup: vi.fn(),
    getGroupMessages: vi.fn(),
    createGroup: vi.fn(),
    updateGroup: vi.fn(),
    deleteGroup: vi.fn(),
    addMembers: vi.fn(),
    removeMember: vi.fn(),
    sendGroupMessage: vi.fn(),
    markGroupAsRead: vi.fn(),
  },
}));

// Create wrapper with QueryClient
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('groupsKeys', () => {
  it('should generate correct query keys', () => {
    expect(groupsKeys.all).toEqual(['groups']);
    expect(groupsKeys.list()).toEqual(['groups', 'list']);
    expect(groupsKeys.listPaginated({ page: 1, limit: 20 })).toEqual([
      'groups',
      'list',
      { page: 1, limit: 20 },
    ]);
    expect(groupsKeys.detail(123)).toEqual(['groups', 'detail', 123]);
    expect(groupsKeys.messages(123, { page: 1 })).toEqual(['groups', 'messages', 123, { page: 1 }]);
    expect(groupsKeys.unified({ search: 'test' })).toEqual([
      'groups',
      'unified',
      { search: 'test' },
    ]);
  });
});

describe('useUnifiedConversations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch unified conversations', async () => {
    const mockData = {
      conversations: [
        { id: '1', isGroup: false, phoneNumber: '+1234567890', displayName: 'John' },
        { id: 'g1', isGroup: true, groupId: 1, displayName: 'My Group' },
      ],
      total: 2,
      page: 1,
      limit: 20,
      totalPages: 1,
    };

    vi.mocked(smsGroupService.getUnifiedConversations).mockResolvedValue(mockData);

    const { result } = renderHook(() => useUnifiedConversations(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(mockData);
    expect(smsGroupService.getUnifiedConversations).toHaveBeenCalledWith({});
  });

  it('should pass search params', async () => {
    vi.mocked(smsGroupService.getUnifiedConversations).mockResolvedValue({
      conversations: [],
      total: 0,
      page: 1,
      limit: 20,
      totalPages: 0,
    });

    renderHook(() => useUnifiedConversations({ page: 2, limit: 10, search: 'test' }), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(smsGroupService.getUnifiedConversations).toHaveBeenCalledWith({
        page: 2,
        limit: 10,
        search: 'test',
      });
    });
  });
});

describe('useGroups', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch groups list', async () => {
    const mockData = {
      groups: [{ id: 1, name: 'Test Group', memberCount: 3 }],
      total: 1,
      page: 1,
      limit: 20,
      totalPages: 1,
    };

    vi.mocked(smsGroupService.getGroups).mockResolvedValue(mockData);

    const { result } = renderHook(() => useGroups(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(mockData);
  });
});

describe('useGroup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch single group with members', async () => {
    const mockGroup = {
      id: 1,
      name: 'Test Group',
      members: [{ id: 1, phoneNumber: '+1234567890', name: 'John' }],
    };

    vi.mocked(smsGroupService.getGroup).mockResolvedValue(mockGroup);

    const { result } = renderHook(() => useGroup(1), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(mockGroup);
    expect(smsGroupService.getGroup).toHaveBeenCalledWith(1);
  });

  it('should not fetch when groupId is null', () => {
    const { result } = renderHook(() => useGroup(null), {
      wrapper: createWrapper(),
    });

    expect(result.current.fetchStatus).toBe('idle');
    expect(smsGroupService.getGroup).not.toHaveBeenCalled();
  });
});

describe('useGroupMessages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch group messages', async () => {
    const mockData = {
      messages: [{ id: 1, body: 'Hello', direction: 'outbound' }],
      total: 1,
      page: 1,
      limit: 50,
      totalPages: 1,
    };

    vi.mocked(smsGroupService.getGroupMessages).mockResolvedValue(mockData);

    const { result } = renderHook(() => useGroupMessages(1), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(mockData);
    expect(smsGroupService.getGroupMessages).toHaveBeenCalledWith(1, {});
  });

  it('should not fetch when groupId is null', () => {
    const { result } = renderHook(() => useGroupMessages(null), {
      wrapper: createWrapper(),
    });

    expect(result.current.fetchStatus).toBe('idle');
    expect(smsGroupService.getGroupMessages).not.toHaveBeenCalled();
  });
});

describe('useCreateGroup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create a group', async () => {
    const newGroup = { id: 1, name: 'New Group', memberCount: 2 };
    vi.mocked(smsGroupService.createGroup).mockResolvedValue(newGroup);

    const { result } = renderHook(() => useCreateGroup(), {
      wrapper: createWrapper(),
    });

    await result.current.mutateAsync({
      name: 'New Group',
      members: ['+1234567890', '+0987654321'],
    });

    expect(smsGroupService.createGroup).toHaveBeenCalledWith({
      name: 'New Group',
      members: ['+1234567890', '+0987654321'],
    });
  });
});

describe('useUpdateGroup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should update group name', async () => {
    const updatedGroup = { id: 1, name: 'Updated Name' };
    vi.mocked(smsGroupService.updateGroup).mockResolvedValue(updatedGroup);

    const { result } = renderHook(() => useUpdateGroup(), {
      wrapper: createWrapper(),
    });

    await result.current.mutateAsync({
      groupId: 1,
      data: { name: 'Updated Name' },
    });

    expect(smsGroupService.updateGroup).toHaveBeenCalledWith(1, { name: 'Updated Name' });
  });
});

describe('useDeleteGroup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should delete a group', async () => {
    vi.mocked(smsGroupService.deleteGroup).mockResolvedValue(undefined);

    const { result } = renderHook(() => useDeleteGroup(), {
      wrapper: createWrapper(),
    });

    await result.current.mutateAsync(1);

    expect(smsGroupService.deleteGroup).toHaveBeenCalledWith(1);
  });
});

describe('useAddGroupMembers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should add members to group', async () => {
    const response = { added: [{ id: 2, phoneNumber: '+1111111111' }] };
    vi.mocked(smsGroupService.addMembers).mockResolvedValue(response);

    const { result } = renderHook(() => useAddGroupMembers(), {
      wrapper: createWrapper(),
    });

    await result.current.mutateAsync({
      groupId: 1,
      data: { members: [{ phoneNumber: '+1111111111', name: 'Jane' }] },
    });

    expect(smsGroupService.addMembers).toHaveBeenCalledWith(1, {
      members: [{ phoneNumber: '+1111111111', name: 'Jane' }],
    });
  });
});

describe('useRemoveGroupMember', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should remove a member from group', async () => {
    vi.mocked(smsGroupService.removeMember).mockResolvedValue(undefined);

    const { result } = renderHook(() => useRemoveGroupMember(), {
      wrapper: createWrapper(),
    });

    await result.current.mutateAsync({
      groupId: 1,
      phoneNumber: '+1234567890',
    });

    expect(smsGroupService.removeMember).toHaveBeenCalledWith(1, '+1234567890');
  });
});

describe('useSendGroupMessage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should send a message to group', async () => {
    const response = {
      results: [{ phoneNumber: '+1234567890', success: true, messageSid: 'SM123' }],
      successCount: 1,
      failureCount: 0,
    };
    vi.mocked(smsGroupService.sendGroupMessage).mockResolvedValue(response);

    const { result } = renderHook(() => useSendGroupMessage(), {
      wrapper: createWrapper(),
    });

    const result2 = await result.current.mutateAsync({
      groupId: 1,
      data: { body: 'Hello group!' },
    });

    expect(result2).toEqual(response);
    expect(smsGroupService.sendGroupMessage).toHaveBeenCalledWith(1, { body: 'Hello group!' });
  });
});
