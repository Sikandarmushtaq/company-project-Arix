'use client';

/**
 * Real-time Sync Hook (Orchestrator)
 *
 * Composes sub-hooks that each handle a category of Socket.IO events:
 * - useRealtimeCallSync: Call events (incoming, started, ended, missed, etc.)
 * - useRealtimeSmsSync: SMS and group message events
 * - useRealtimeCacheSync: Contacts, campaigns, voicemail, recordings, user settings, reconnect
 *
 * IMPORTANT: For SMS messages, we use DIRECT cache updates only.
 * We do NOT invalidate the entire messages cache because that would
 * clear pagination state and cause older messages to disappear.
 *
 * @module lib/hooks/useRealtimeSync
 */

import { useSocket } from '@/lib/providers/SocketProvider';
import { useRealtimeCallSync } from './useRealtimeCallSync';
import { useRealtimeSmsSync } from './useRealtimeSmsSync';
import { useRealtimeWaSync } from './useRealtimeWaSync';
import { useRealtimeCacheSync } from './useRealtimeCacheSync';
import { useLiveKitInboundSync } from './useLiveKitInboundSync';

/**
 * Hook to sync React Query cache with Socket.IO events
 */
export function useRealtimeSync() {
  const { isConnected } = useSocket();

  // Call event handlers (incoming, started, updated, ended, missed, answered elsewhere)
  useRealtimeCallSync();

  // SMS and group message event handlers (received, sent, status, usage, group lifecycle)
  useRealtimeSmsSync();

  // WhatsApp message event handlers (received, sent, status, read, deleted, config)
  useRealtimeWaSync();

  // Other cache invalidation handlers (contacts, campaigns, voicemail, recordings, admin, user settings, reconnect)
  useRealtimeCacheSync();

  // LiveKit overlay inbound (Phase 3d): socket-driven ring for the LiveKit engine
  useLiveKitInboundSync();

  return { isConnected };
}

/**
 * Provider component that wraps children with real-time sync
 */
export function RealtimeSyncProvider({ children }: { children: React.ReactNode }) {
  useRealtimeSync();
  return children;
}
