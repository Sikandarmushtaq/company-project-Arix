/**
 * Comprehensive useRealtimeSync Tests
 * Location: frontend/src/__tests__/realtime/useRealtimeSync.test.tsx
 *
 * Tests for the optimized real-time sync hook that directly updates
 * React Query cache using event payloads.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useRealtimeSync } from '@/lib/hooks/useRealtimeSync';
import { REALTIME_EVENTS } from '@/lib/constants/events';
import { callsKeys } from '@/lib/hooks/useCalls';
import { messagesKeys } from '@/lib/hooks/useMessages';
import { voicemailKeys } from '@/lib/hooks/useVoicemail';
import { recordingsKeys } from '@/lib/hooks/useRecordings';
import { contactsKeys } from '@/lib/hooks/useContacts';
import { campaignsKeys } from '@/lib/hooks/useCampaigns';

// Mock socket with event handler capture.
// Socket.IO v4: the `reconnect*` family is emitted by the Manager (`socket.io`),
// not the Socket — so the reconnect resync binds on `socket.io.on`, captured here.
const mockSocket = {
  on: vi.fn(),
  off: vi.fn(),
  connected: true,
  io: { on: vi.fn(), off: vi.fn() },
};

let isConnected = true;

vi.mock('@/lib/providers/SocketProvider', () => ({
  useSocket: vi.fn(() => ({
    socket: isConnected ? mockSocket : null,
    status: isConnected ? 'connected' : 'disconnected',
    isConnected,
  })),
}));

// Helper to get registered handler for a Socket event
function getHandler(eventName: string) {
  const call = mockSocket.on.mock.calls.find((c) => c[0] === eventName);
  return call?.[1];
}

// Helper to get a handler registered on the Manager (socket.io) — reconnect*
function getIoHandler(eventName: string) {
  const call = mockSocket.io.on.mock.calls.find((c) => c[0] === eventName);
  return call?.[1];
}

describe('useRealtimeSync', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    isConnected = true;
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  describe('Event listener registration', () => {
    it('should register Socket listeners + bind reconnect on the Manager (not the Socket)', () => {
      renderHook(() => useRealtimeSync(), { wrapper });

      // Representative Socket events are registered on the Socket...
      expect(mockSocket.on).toHaveBeenCalledWith(REALTIME_EVENTS.CALL_INCOMING, expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith(REALTIME_EVENTS.SMS_RECEIVED, expect.any(Function));
      // ...but reconnect binds on the Manager in v4 — NOT the Socket (locking the fix).
      // (Exact listener total intentionally not asserted — it drifts with the event list.)
      expect(mockSocket.io.on).toHaveBeenCalledWith('reconnect', expect.any(Function));
      expect(mockSocket.on).not.toHaveBeenCalledWith('reconnect', expect.any(Function));
    });

    it('should register all call event listeners', () => {
      renderHook(() => useRealtimeSync(), { wrapper });

      expect(mockSocket.on).toHaveBeenCalledWith(
        REALTIME_EVENTS.CALL_INCOMING,
        expect.any(Function)
      );
      expect(mockSocket.on).toHaveBeenCalledWith(
        REALTIME_EVENTS.CALL_STARTED,
        expect.any(Function)
      );
      expect(mockSocket.on).toHaveBeenCalledWith(
        REALTIME_EVENTS.CALL_UPDATED,
        expect.any(Function)
      );
      expect(mockSocket.on).toHaveBeenCalledWith(REALTIME_EVENTS.CALL_ENDED, expect.any(Function));
    });

    it('should register all SMS event listeners', () => {
      renderHook(() => useRealtimeSync(), { wrapper });

      expect(mockSocket.on).toHaveBeenCalledWith(
        REALTIME_EVENTS.SMS_RECEIVED,
        expect.any(Function)
      );
      expect(mockSocket.on).toHaveBeenCalledWith(REALTIME_EVENTS.SMS_SENT, expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith(REALTIME_EVENTS.SMS_STATUS, expect.any(Function));
    });

    it('should register voicemail event listener', () => {
      renderHook(() => useRealtimeSync(), { wrapper });

      expect(mockSocket.on).toHaveBeenCalledWith(
        REALTIME_EVENTS.VOICEMAIL_NEW,
        expect.any(Function)
      );
    });

    it('should register all recording event listeners', () => {
      renderHook(() => useRealtimeSync(), { wrapper });

      expect(mockSocket.on).toHaveBeenCalledWith(
        REALTIME_EVENTS.RECORDING_NEW,
        expect.any(Function)
      );
      expect(mockSocket.on).toHaveBeenCalledWith(
        REALTIME_EVENTS.RECORDING_DELETED,
        expect.any(Function)
      );
    });

    it('should register contact event listener', () => {
      renderHook(() => useRealtimeSync(), { wrapper });

      // Only CONTACT_CHANGED is registered - individual events are handled by CONTACT_CHANGED
      expect(mockSocket.on).toHaveBeenCalledWith(
        REALTIME_EVENTS.CONTACT_CHANGED,
        expect.any(Function)
      );
    });

    it('should register campaign event listener', () => {
      renderHook(() => useRealtimeSync(), { wrapper });

      // Only CAMPAIGN_UPDATED is registered
      expect(mockSocket.on).toHaveBeenCalledWith(
        REALTIME_EVENTS.CAMPAIGN_UPDATED,
        expect.any(Function)
      );
    });

    it('should not register listeners when disconnected', () => {
      isConnected = false;
      vi.clearAllMocks();

      renderHook(() => useRealtimeSync(), { wrapper });

      expect(mockSocket.on).not.toHaveBeenCalled();
    });
  });

  describe('Event listener cleanup', () => {
    it('should unregister Socket listeners on unmount + reconnect from the Manager', () => {
      const { unmount } = renderHook(() => useRealtimeSync(), { wrapper });
      unmount();

      expect(mockSocket.off).toHaveBeenCalledWith(REALTIME_EVENTS.CALL_INCOMING, expect.any(Function));
      // reconnect is cleaned up on the Manager, mirroring where it was bound.
      expect(mockSocket.io.off).toHaveBeenCalledWith('reconnect', expect.any(Function));
    });

    it('should unregister all call event listeners on unmount', () => {
      const { unmount } = renderHook(() => useRealtimeSync(), { wrapper });
      unmount();

      expect(mockSocket.off).toHaveBeenCalledWith(
        REALTIME_EVENTS.CALL_INCOMING,
        expect.any(Function)
      );
      expect(mockSocket.off).toHaveBeenCalledWith(
        REALTIME_EVENTS.CALL_STARTED,
        expect.any(Function)
      );
      expect(mockSocket.off).toHaveBeenCalledWith(
        REALTIME_EVENTS.CALL_UPDATED,
        expect.any(Function)
      );
      expect(mockSocket.off).toHaveBeenCalledWith(REALTIME_EVENTS.CALL_ENDED, expect.any(Function));
    });

    it('should unregister all SMS event listeners on unmount', () => {
      const { unmount } = renderHook(() => useRealtimeSync(), { wrapper });
      unmount();

      expect(mockSocket.off).toHaveBeenCalledWith(
        REALTIME_EVENTS.SMS_RECEIVED,
        expect.any(Function)
      );
      expect(mockSocket.off).toHaveBeenCalledWith(REALTIME_EVENTS.SMS_SENT, expect.any(Function));
      expect(mockSocket.off).toHaveBeenCalledWith(REALTIME_EVENTS.SMS_STATUS, expect.any(Function));
    });
  });

  describe('Call event handlers - Cache invalidation', () => {
    it('should invalidate calls cache on CALL_INCOMING', () => {
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
      renderHook(() => useRealtimeSync(), { wrapper });

      const handler = getHandler(REALTIME_EVENTS.CALL_INCOMING);
      const mockCall = {
        id: 1,
        caller: '+15551234567',
        callee: '+15559876543',
        direction: 'inbound',
      };
      handler?.(mockCall);

      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: callsKeys.all });
    });

    it('should show notification on CALL_INCOMING', () => {
      renderHook(() => useRealtimeSync(), { wrapper });

      const handler = getHandler(REALTIME_EVENTS.CALL_INCOMING);
      // Just verify handler exists and can be called without error
      expect(() => handler?.({ id: 1, caller: '+15551234567' })).not.toThrow();
    });

    it('should invalidate calls cache on CALL_STARTED', () => {
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
      renderHook(() => useRealtimeSync(), { wrapper });

      const handler = getHandler(REALTIME_EVENTS.CALL_STARTED);
      handler?.({ id: 2, direction: 'outbound' });

      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: callsKeys.all });
    });

    it('should invalidate calls cache on CALL_UPDATED', () => {
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
      renderHook(() => useRealtimeSync(), { wrapper });

      const handler = getHandler(REALTIME_EVENTS.CALL_UPDATED);
      handler?.({ id: 1, status: 'answered' });

      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: callsKeys.all });
    });

    it('should invalidate calls cache on CALL_ENDED', () => {
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
      renderHook(() => useRealtimeSync(), { wrapper });

      const handler = getHandler(REALTIME_EVENTS.CALL_ENDED);
      handler?.({ id: 1, endTime: '2024-01-15T12:00:00Z' });

      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: callsKeys.all });
    });

    it('should prevent duplicate calls in cache', () => {
      // Setup existing call in cache
      queryClient.setQueryData(callsKeys.list(50), [{ id: 1, caller: '+15551234567' }]);

      renderHook(() => useRealtimeSync(), { wrapper });

      const handler = getHandler(REALTIME_EVENTS.CALL_INCOMING);
      // Try to add same call again
      handler?.({ id: 1, caller: '+15551234567', status: 'updated' });

      const data = queryClient.getQueryData(callsKeys.list(50)) as any[];
      // Should update existing, not add duplicate
      expect(data.filter((c) => c.id === 1).length).toBe(1);
    });
  });

  describe('SMS event handlers - Direct cache updates', () => {
    it('should update thread cache on SMS_RECEIVED', () => {
      const setQueriesDataSpy = vi.spyOn(queryClient, 'setQueriesData');
      renderHook(() => useRealtimeSync(), { wrapper });

      const handler = getHandler(REALTIME_EVENTS.SMS_RECEIVED);
      const mockMessage = {
        id: 1,
        sender: '+15551234567',
        receiver: '+15559876543',
        body: 'Hello',
        txRxDatetime: '2024-01-15T12:00:00Z',
        direction: 'inbound',
      };
      handler?.(mockMessage);

      // Uses setQueriesData with thread query key pattern
      expect(setQueriesDataSpy).toHaveBeenCalledWith(
        { queryKey: ['messages', 'thread', '15551234567'], exact: false },
        expect.any(Function)
      );
    });

    it('should update conversation list on SMS_RECEIVED', () => {
      const setQueriesDataSpy = vi.spyOn(queryClient, 'setQueriesData');
      renderHook(() => useRealtimeSync(), { wrapper });

      const handler = getHandler(REALTIME_EVENTS.SMS_RECEIVED);
      handler?.({
        id: 1,
        sender: '+15551234567',
        body: 'Hello',
        txRxDatetime: '2024-01-15T12:00:00Z',
      });

      // Conversations are updated via setQueriesData
      expect(setQueriesDataSpy).toHaveBeenCalledWith(
        { queryKey: messagesKeys.conversations(), exact: false },
        expect.any(Function)
      );
    });

    it('should invalidate unread count on SMS_RECEIVED', () => {
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
      renderHook(() => useRealtimeSync(), { wrapper });

      const handler = getHandler(REALTIME_EVENTS.SMS_RECEIVED);
      handler?.({ id: 1, sender: '+15551234567' });

      // Unread count is invalidated (not set directly)
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: messagesKeys.unreadCount() });
    });

    it('should update thread cache on SMS_SENT', () => {
      const setQueriesDataSpy = vi.spyOn(queryClient, 'setQueriesData');
      renderHook(() => useRealtimeSync(), { wrapper });

      const handler = getHandler(REALTIME_EVENTS.SMS_SENT);
      handler?.({
        id: 2,
        receiver: '+15559876543',
        body: 'Hi',
        txRxDatetime: '2024-01-15T12:00:00Z',
      });

      // Uses setQueriesData with thread query key pattern
      expect(setQueriesDataSpy).toHaveBeenCalledWith(
        { queryKey: ['messages', 'thread', '15559876543'], exact: false },
        expect.any(Function)
      );
    });

    it('should update message status on SMS_STATUS', () => {
      const setQueriesDataSpy = vi.spyOn(queryClient, 'setQueriesData');
      renderHook(() => useRealtimeSync(), { wrapper });

      const handler = getHandler(REALTIME_EVENTS.SMS_STATUS);
      handler?.({
        id: 1,
        sender: '+15551234567',
        receiver: '+15559876543',
        direction: 'outbound',
        status: 'delivered',
      });

      // Status updates use setQueriesData with thread pattern
      expect(setQueriesDataSpy).toHaveBeenCalledWith(
        { queryKey: ['messages', 'thread'], exact: false },
        expect.any(Function)
      );
    });

    it('should prevent duplicate messages in thread', () => {
      // Setup existing message in cache
      queryClient.setQueryData(messagesKeys.messages('+15551234567'), [{ id: 1, body: 'Hello' }]);

      renderHook(() => useRealtimeSync(), { wrapper });

      const handler = getHandler(REALTIME_EVENTS.SMS_RECEIVED);
      // Try to add same message again
      handler?.({ id: 1, sender: '+15551234567', body: 'Hello' });

      const data = queryClient.getQueryData(messagesKeys.messages('+15551234567')) as any[];
      expect(data.filter((m) => m.id === 1).length).toBe(1);
    });

    it('should call setQueriesData for conversations on new message', () => {
      // Setup existing conversations with expected structure
      queryClient.setQueryData(messagesKeys.conversations(), {
        conversations: [
          {
            phoneNumber: '+15550000001',
            lastMessage: 'Old',
            unreadCount: 0,
            contactName: null,
            lastMessageTime: '2024-01-14T12:00:00Z',
          },
          {
            phoneNumber: '+15550000002',
            lastMessage: 'Older',
            unreadCount: 0,
            contactName: null,
            lastMessageTime: '2024-01-13T12:00:00Z',
          },
        ],
        total: 2,
      });

      const setQueriesDataSpy = vi.spyOn(queryClient, 'setQueriesData');
      renderHook(() => useRealtimeSync(), { wrapper });

      const handler = getHandler(REALTIME_EVENTS.SMS_RECEIVED);
      handler?.({
        id: 1,
        sender: '+15550000002',
        body: 'New message',
        txRxDatetime: '2024-01-15T12:00:00Z',
      });

      // Verify setQueriesData was called with conversations query key
      expect(setQueriesDataSpy).toHaveBeenCalledWith(
        { queryKey: messagesKeys.conversations(), exact: false },
        expect.any(Function)
      );
    });
  });

  describe('Contact event handlers', () => {
    it('should invalidate cache on CONTACT_CHANGED with created action', () => {
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
      renderHook(() => useRealtimeSync(), { wrapper });

      const handler = getHandler(REALTIME_EVENTS.CONTACT_CHANGED);
      handler?.({
        action: 'created',
        contact: { id: 1, name: 'John Doe', contact: '+15551234567' },
      });

      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: contactsKeys.all });
    });

    it('should invalidate cache on CONTACT_CHANGED with updated action', () => {
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
      renderHook(() => useRealtimeSync(), { wrapper });

      const handler = getHandler(REALTIME_EVENTS.CONTACT_CHANGED);
      handler?.({
        action: 'updated',
        contact: { id: 1, name: 'John Smith' },
      });

      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: contactsKeys.all });
    });

    it('should invalidate cache on CONTACT_CHANGED with deleted action', () => {
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
      renderHook(() => useRealtimeSync(), { wrapper });

      const handler = getHandler(REALTIME_EVENTS.CONTACT_CHANGED);
      handler?.({
        action: 'deleted',
        contactId: 1,
      });

      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: contactsKeys.all });
    });

    it('should not invalidate on malformed payload', () => {
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
      renderHook(() => useRealtimeSync(), { wrapper });

      const handler = getHandler(REALTIME_EVENTS.CONTACT_CHANGED);
      // Missing action
      handler?.({ contact: { id: 1 } });
      handler?.(null);
      handler?.({});

      expect(invalidateSpy).not.toHaveBeenCalled();
    });
  });

  describe('Voicemail event handlers', () => {
    it('should invalidate voicemail cache on VOICEMAIL_NEW', () => {
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
      renderHook(() => useRealtimeSync(), { wrapper });

      const handler = getHandler(REALTIME_EVENTS.VOICEMAIL_NEW);
      handler?.();

      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: voicemailKeys.all });
    });
  });

  describe('Recording event handlers', () => {
    it('should invalidate recordings cache on RECORDING_NEW', () => {
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
      renderHook(() => useRealtimeSync(), { wrapper });

      const handler = getHandler(REALTIME_EVENTS.RECORDING_NEW);
      handler?.();

      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: recordingsKeys.all });
    });

    it('should invalidate recordings cache on RECORDING_DELETED', () => {
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
      renderHook(() => useRealtimeSync(), { wrapper });

      const handler = getHandler(REALTIME_EVENTS.RECORDING_DELETED);
      handler?.();

      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: recordingsKeys.all });
    });
  });

  describe('Campaign event handlers', () => {
    it('should invalidate cache on CAMPAIGN_UPDATED', () => {
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
      renderHook(() => useRealtimeSync(), { wrapper });

      const handler = getHandler(REALTIME_EVENTS.CAMPAIGN_UPDATED);
      handler?.({ id: 1, status: 'active' });

      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: campaignsKeys.all });
    });

    it('should invalidate cache on CAMPAIGN_UPDATED with delete flag', () => {
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
      renderHook(() => useRealtimeSync(), { wrapper });

      const handler = getHandler(REALTIME_EVENTS.CAMPAIGN_UPDATED);
      handler?.({ id: 1, deleted: true });

      // Both cases just invalidate the cache
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: campaignsKeys.all });
    });

    it('should not crash on malformed CAMPAIGN_UPDATED payload', () => {
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
      renderHook(() => useRealtimeSync(), { wrapper });

      const handler = getHandler(REALTIME_EVENTS.CAMPAIGN_UPDATED);
      // Should not crash on missing id
      handler?.({});
      handler?.(null);

      // No invalidation when payload is malformed
      expect(invalidateSpy).not.toHaveBeenCalled();
    });
  });
});

describe('Query key structure', () => {
  it('should have correct structure for callsKeys', () => {
    expect(callsKeys.all).toEqual(['calls']);
    expect(callsKeys.list(50)).toEqual(['calls', 'list', '', 50]);
    expect(callsKeys.stats()).toEqual(['calls', 'stats', '']);
    expect(callsKeys.unreadCount()).toEqual(['calls', 'unread', '']);
  });

  it('should have correct structure for messagesKeys', () => {
    expect(messagesKeys.all).toEqual(['messages']);
    expect(messagesKeys.conversations()).toEqual(['messages', 'conversations']);
    // SSOT: messagesKeys.messages normalizes phone to 11 digits (no + prefix)
    expect(messagesKeys.messages('+15551234567')).toEqual(['messages', 'thread', '15551234567']);
    expect(messagesKeys.unreadCount()).toEqual(['messages', 'unread']);
  });

  it('should have correct structure for voicemailKeys', () => {
    expect(voicemailKeys.all).toEqual(['voicemail']);
    expect(voicemailKeys.list()).toEqual(['voicemail', 'list']);
    expect(voicemailKeys.counts()).toEqual(['voicemail', 'counts']);
  });

  it('should have correct structure for recordingsKeys', () => {
    expect(recordingsKeys.all).toEqual(['recordings']);
    // recordingsKeys.list() takes no params - pagination is via listPaginated
    expect(recordingsKeys.list()).toEqual(['recordings', 'list']);
  });

  it('should have correct structure for contactsKeys', () => {
    expect(contactsKeys.all).toEqual(['contacts']);
    expect(contactsKeys.list()).toEqual(['contacts', 'list']);
    expect(contactsKeys.blocked()).toEqual(['contacts', 'blocked']);
  });

  it('should have correct structure for campaignsKeys', () => {
    expect(campaignsKeys.all).toEqual(['campaigns']);
    expect(campaignsKeys.list()).toEqual(['campaigns', 'list']);
    expect(campaignsKeys.detail(1)).toEqual(['campaigns', 'detail', 1]);
  });
});

describe('Optimistic update edge cases', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    isConnected = true;
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  it('should handle empty cache gracefully for calls', () => {
    renderHook(() => useRealtimeSync(), { wrapper });

    const handler = getHandler(REALTIME_EVENTS.CALL_INCOMING);
    expect(() => handler?.({ id: 1 })).not.toThrow();
  });

  it('should handle empty cache gracefully for messages', () => {
    renderHook(() => useRealtimeSync(), { wrapper });

    const handler = getHandler(REALTIME_EVENTS.SMS_RECEIVED);
    expect(() => handler?.({ id: 1, sender: '+15551234567' })).not.toThrow();
  });

  it('should handle empty cache gracefully for contacts', () => {
    renderHook(() => useRealtimeSync(), { wrapper });

    const handler = getHandler(REALTIME_EVENTS.CONTACT_CHANGED);
    expect(() => handler?.({ action: 'created', contact: { id: 1 } })).not.toThrow();
  });

  it('should handle malformed payloads gracefully', () => {
    renderHook(() => useRealtimeSync(), { wrapper });

    const handler = getHandler(REALTIME_EVENTS.CALL_INCOMING);
    expect(() => handler?.(null)).not.toThrow();
    expect(() => handler?.(undefined)).not.toThrow();
    expect(() => handler?.({})).not.toThrow();
  });
});

describe('Reconnection handler', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    isConnected = true;
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  it('should register reconnect on the Manager (socket.io), NOT the Socket', () => {
    renderHook(() => useRealtimeSync(), { wrapper });

    // REGRESSION GUARD: in socket.io-client v4 the Socket never emits `reconnect`
    // (the Manager does). Binding it on `socket.on` silently never fires, so a
    // dropped-then-restored connection never backfills missed messages/calls.
    expect(mockSocket.io.on).toHaveBeenCalledWith('reconnect', expect.any(Function));
    expect(mockSocket.on).not.toHaveBeenCalledWith('reconnect', expect.any(Function));
  });

  it('should unregister reconnect from the Manager on unmount', () => {
    const { unmount } = renderHook(() => useRealtimeSync(), { wrapper });
    unmount();

    expect(mockSocket.io.off).toHaveBeenCalledWith('reconnect', expect.any(Function));
  });

  it('should invalidate all query caches on reconnect', () => {
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    renderHook(() => useRealtimeSync(), { wrapper });

    const handler = getIoHandler('reconnect');
    handler?.();

    // Should invalidate all 6 query key families
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: callsKeys.all });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: messagesKeys.all });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: contactsKeys.all });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: voicemailKeys.all });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: recordingsKeys.all });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: campaignsKeys.all });
  });

  it('should refetch all data when socket reconnects', () => {
    // Setup some cached data
    queryClient.setQueryData(callsKeys.list(50), [{ id: 1 }]);
    queryClient.setQueryData(messagesKeys.conversations(), [{ phoneNumber: '+1555' }]);

    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    renderHook(() => useRealtimeSync(), { wrapper });

    const handler = getIoHandler('reconnect');
    handler?.();

    // Verify the reconnect resync invalidates the message + call caches (which
    // triggers refetch for active queries — this is the backfill that fixes
    // "SMS only show after refresh"). Exact count not asserted — the handler's
    // key set drifts; the load-bearing ones are messages + calls.
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: messagesKeys.all });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: callsKeys.all });
  });
});
