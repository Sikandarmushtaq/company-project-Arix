'use client';

/**
 * Real-time Cache Sync Hook
 *
 * Handles miscellaneous cache invalidation Socket.IO events:
 * - CONTACT_CHANGED
 * - CAMPAIGN_UPDATED
 * - VOICEMAIL_NEW, VOICEMAIL_DELETED, VOICEMAIL_READ, VOICEMAIL_ALL_READ
 * - RECORDING_NEW, RECORDING_DELETED
 * - ADMIN_CALL_ENDED
 * - USER_SETTINGS_UPDATED (force logout on ban/deactivation)
 * - reconnect (full cache invalidation)
 *
 * @module lib/hooks/useRealtimeCacheSync
 */

import { useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSocket } from '@/lib/providers/SocketProvider';
import { REALTIME_EVENTS } from '@/lib/constants/events';
import { callsKeys } from './useCalls';
import { messagesKeys } from './useMessages';
import { contactsKeys } from './useContacts';
import { voicemailKeys } from './useVoicemail';
import { recordingsKeys } from './useRecordings';
import type { Recording } from '@/lib/api/services/recordings.service';
import { campaignsKeys } from './useCampaigns';
import { waMessagesKeys } from './useWaMessages';
import { customersKeys } from './useCustomers';
import { notifyNewVoicemail } from '@/lib/utils/notifications';
import { toast } from '@/lib/stores/toast';
import { useAuthStore } from '@/lib/stores/auth';
import { useContactLookupStore } from '@/lib/stores/contactLookup';
import type {
  ContactEventPayload,
  CampaignEventPayload,
  UserSettingsUpdatePayload,
} from './useRealtimeSync.types';

/**
 * Hook to sync miscellaneous React Query caches with Socket.IO events
 */
export function useRealtimeCacheSync() {
  const { socket, isConnected } = useSocket();
  const queryClient = useQueryClient();

  // === CONTACT HANDLER ===
  const handleContactEvent = useCallback(
    (payload: ContactEventPayload) => {
      if (!payload?.action) return;

      const lookupStore = useContactLookupStore.getState();

      switch (payload.action) {
        case 'created':
          // Update Zustand store directly for instant name resolution
          if (payload.contact) {
            lookupStore.upsertContact(payload.contact);
          }
          // Need full refresh for sort position + total count
          queryClient.invalidateQueries({ queryKey: contactsKeys.all });
          break;

        case 'updated':
          // Update Zustand store directly
          if (payload.contact) {
            lookupStore.upsertContact(payload.contact);
          }
          // Invalidate paginated lists only
          queryClient.invalidateQueries({ queryKey: contactsKeys.list() });
          queryClient.invalidateQueries({ queryKey: contactsKeys.favorites() });
          break;

        case 'deleted':
          // Remove from Zustand store
          if (payload.contactId) {
            // Find and remove by ID — iterate the map
            const contacts = lookupStore.contacts;
            contacts.forEach((cached, phone) => {
              if (cached.id === payload.contactId) {
                lookupStore.removeContact(phone);
              }
            });
          }
          if (payload.contactIds) {
            const idSet = new Set(payload.contactIds);
            const contacts = lookupStore.contacts;
            contacts.forEach((cached, phone) => {
              if (idSet.has(cached.id)) {
                lookupStore.removeContact(phone);
              }
            });
          }
          // Need full refresh for total count
          queryClient.invalidateQueries({ queryKey: contactsKeys.all });
          break;
      }
    },
    [queryClient]
  );

  // === CAMPAIGN HANDLER ===
  const handleCampaignUpdated = useCallback(
    (payload: CampaignEventPayload) => {
      if (!payload?.id) return;
      queryClient.invalidateQueries({ queryKey: campaignsKeys.all });
    },
    [queryClient]
  );

  // === AI CALL HANDLERS (real-time from ElevenLabs webhook) ===
  const handleAiCallCompleted = useCallback(
    (payload: { id?: number; campaignId?: number }) => {
      if (!payload) return;
      // Invalidate AI calls list for the campaign
      if (payload.campaignId) {
        queryClient.invalidateQueries({ queryKey: ['ai-calls', 'campaign', payload.campaignId] });
        // Also refresh campaign stats
        queryClient.invalidateQueries({ queryKey: campaignsKeys.stats(payload.campaignId) });
      }
      // Invalidate specific call detail if we have it cached
      if (payload.id) {
        queryClient.invalidateQueries({ queryKey: ['ai-calls', 'detail', payload.id] });
      }
      // Refresh campaign list (status may have changed)
      queryClient.invalidateQueries({ queryKey: campaignsKeys.all });
    },
    [queryClient]
  );

  const handleAiCampaignProgress = useCallback(
    (payload: { campaignId?: number }) => {
      if (!payload?.campaignId) return;
      queryClient.invalidateQueries({ queryKey: campaignsKeys.stats(payload.campaignId) });
      queryClient.invalidateQueries({ queryKey: ['ai-calls', 'campaign', payload.campaignId] });
    },
    [queryClient]
  );

  // === VOICEMAIL HANDLERS ===
  const handleVoicemailNew = useCallback(
    (payload?: { callerIdNum?: string; duration?: number; callerIdName?: string }) => {
      if (payload?.callerIdNum) {
        notifyNewVoicemail(payload.callerIdNum, payload.duration || 0, payload.callerIdName);
      }
      queryClient.invalidateQueries({ queryKey: voicemailKeys.all });
    },
    [queryClient]
  );

  const handleVoicemailDeleted = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: voicemailKeys.all });
  }, [queryClient]);

  const handleVoicemailRead = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: voicemailKeys.counts() });
  }, [queryClient]);

  const handleVoicemailAllRead = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: voicemailKeys.all });
  }, [queryClient]);

  // === SMS DELETION HANDLERS ===
  const handleSmsDeleted = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: messagesKeys.all });
    queryClient.invalidateQueries({ queryKey: ['groups'] });
  }, [queryClient]);

  const handleSmsConversationDeleted = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: messagesKeys.all });
    queryClient.invalidateQueries({ queryKey: ['groups'] });
  }, [queryClient]);

  // === RECORDING HANDLERS ===
  //
  // The `recording:new` Socket.IO event payload is shaped exactly like the
  // recording list endpoint's response item (server-side: cdrToRecordingMeta).
  // That lets us optimistically insert the new entry into the React Query
  // cache and skip the invalidate-and-refetch round-trip entirely. Industry-
  // standard pattern (Slack, Discord, Linear, WhatsApp Web) — the realtime
  // payload is self-sufficient, so the UI updates at the SAME instant the
  // notification fires instead of after a network round-trip.
  //
  // Stats and quota are still invalidated (cheap, server-of-record for counts).
  // Lists are NOT invalidated — the optimistic insert is the source of truth
  // until the user navigates / takes an action that naturally refetches.
  const handleRecordingNew = useCallback(
    (data?: Partial<Recording>) => {
      const direction = data?.direction === 'inbound' ? 'Inbound' : 'Outbound';
      toast.info(`New ${direction.toLowerCase()} recording available`, { duration: 3000 });

      // Bail if payload is missing the minimum we need to insert. Old servers
      // (pre-2026-05-10) only sent {id, direction, callerNumber, destinationNumber}
      // — fall back to invalidate so the UI still updates eventually.
      if (!data || !data.id || !data.startTime || !data.audioUrl) {
        queryClient.invalidateQueries({ queryKey: recordingsKeys.all });
        return;
      }

      const recording = data as Recording;

      // Optimistic insert into every paginated list query that matches the
      // recordingsKeys.list() prefix. The exact filter combo (page/limit/
      // direction/dateRange) is per-query and we don't try to reproduce filter
      // logic here — we always insert at index 0; if the recording shouldn't
      // match the user's current filter, the next user-driven refetch will
      // reconcile. False positives are silent and self-healing; false negatives
      // would require a server round-trip we're explicitly avoiding.
      queryClient.setQueriesData<{
        recordings: Recording[];
        total?: number;
        page?: number;
        limit?: number;
        totalPages?: number;
        extensionConfigured?: boolean;
      }>({ queryKey: recordingsKeys.list(), exact: false }, (prev) => {
        if (!prev || !Array.isArray(prev.recordings)) return prev;
        // Idempotent: dedupe by id in case the same event arrives twice
        // (network retry, multiple subscriptions, etc.)
        if (prev.recordings.some((r) => r.id === recording.id)) return prev;
        return {
          ...prev,
          recordings: [recording, ...prev.recordings],
          total: typeof prev.total === 'number' ? prev.total + 1 : prev.total,
        };
      });

      // Stats / quota: server-of-record for aggregate counts. Cheap to refetch
      // and we want the dashboard numbers exact, so invalidate just those keys.
      // Use the 2-element prefix (no activePhone slot) so it matches the live
      // per-phone keys — `stats('')`/`quota('')` would NOT prefix-match
      // `stats(activePhone)`/`quota(activePhone)` and the widgets would stay
      // stale until the 60s poll.
      queryClient.invalidateQueries({ queryKey: [...recordingsKeys.all, 'stats'] });
      queryClient.invalidateQueries({ queryKey: [...recordingsKeys.all, 'quota'] });
    },
    [queryClient]
  );

  const handleRecordingDeleted = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: recordingsKeys.all });
  }, [queryClient]);

  /**
   * Handle admin call ended event (for managers viewing organization recordings)
   * When any call in the organization ends, refresh recordings to show new recording
   */
  const handleAdminCallEnded = useCallback(
    (data?: { callId?: string }) => {
      console.log('[RealtimeSync] ADMIN_CALL_ENDED received:', data);
      // Delay to allow FusionPBX CDR to be written to database
      // FusionPBX writes CDR asynchronously, 5 seconds gives enough time
      setTimeout(() => {
        console.log('[RealtimeSync] Invalidating recordings after ADMIN_CALL_ENDED');
        queryClient.invalidateQueries({ queryKey: recordingsKeys.all });
        // Also force refetch all recordings queries
        queryClient.refetchQueries({ queryKey: recordingsKeys.all, type: 'active' });
      }, 5000);
    },
    [queryClient]
  );

  // === USER SETTINGS HANDLER ===

  /**
   * Handle user settings update from admin
   * Updates local auth store when admin changes user permissions/settings
   * Handles both individual and bulk operations
   *
   * SSOT: User type uses `status` field, not separate `banned`/`isActive` fields
   * This handler converts backend payload to proper User type format
   */
  const handleUserSettingsUpdated = useCallback(
    (payload: UserSettingsUpdatePayload) => {
      if (!payload) return;

      console.log('[RealtimeSync] User settings updated by admin:', payload);

      // Get current user from auth store
      const currentUser = useAuthStore.getState().user;
      if (!currentUser) return;

      // Determine new status based on payload
      // SSOT: Convert banned/isActive to proper status enum
      let newStatus = currentUser.status;
      if (payload.banned === true) {
        newStatus = 'banned';
      } else if (payload.banned === false && currentUser.status === 'banned') {
        // Unbanning - restore to active
        newStatus = 'active';
      } else if (payload.isActive === false) {
        newStatus = 'inactive';
      } else if (payload.isActive === true && currentUser.status === 'inactive') {
        // Reactivating
        newStatus = 'active';
      }

      // Build updated user object with proper types
      const updatedUser = {
        ...currentUser,
        ...(payload.smsEnabled !== undefined && { smsEnabled: payload.smsEnabled }),
        ...(payload.autoDialerEnabled !== undefined && {
          autoDialerEnabled: payload.autoDialerEnabled,
        }),
        ...(payload.smsType !== undefined && { smsType: payload.smsType }),
        ...(payload.smsLimit !== undefined && { smsLimit: payload.smsLimit }),
        ...(payload.bulkSmsInterval !== undefined && { bulkSmsInterval: payload.bulkSmsInterval }),
        ...(payload.bulkSmsIntervalControl !== undefined && {
          bulkSmsIntervalControl: payload.bulkSmsIntervalControl,
        }),
        ...(payload.userBulkSmsInterval !== undefined && {
          userBulkSmsInterval: payload.userBulkSmsInterval,
        }),
        ...(payload.role !== undefined && { role: payload.role }),
        ...(payload.phoneNumbers !== undefined && { phoneNumbers: payload.phoneNumbers }),
        // Voice/phone capability changes — null means admin cleared the
        // capability. SipProvider gates on sipUsername; SMS/voice UI gates
        // on senderPhone. Empty string is treated the same as null
        // downstream (the SipProvider check uses `if (!user.sipUsername)`).
        ...(payload.sipUsername !== undefined && {
          sipUsername: payload.sipUsername ?? '',
        }),
        ...(payload.senderPhone !== undefined && {
          senderPhone: payload.senderPhone ?? '',
        }),
        // Privacy mode lives on the User object — admin/manager flipping
        // this propagates through the auth store, which the WA + contacts
        // display utility reads on every render.
        ...(payload.waPhoneMaskEnabled !== undefined && {
          waPhoneMaskEnabled: payload.waPhoneMaskEnabled,
        }),
        status: newStatus,
      };

      // Update auth store
      useAuthStore.getState().setUser(updatedUser);

      // WhatsApp toggle + number-assignment changes don't live on the auth
      // User object; the user-side WA gate uses the wa-status query (see
      // useWaStatus). Invalidating that query refreshes both the gate state
      // (waEnabled, configured) and the assignedNumber the dropdown +
      // /phone/settings render — no refresh needed.
      if (payload.waEnabled !== undefined || payload.waNumberAssigned !== undefined) {
        queryClient.invalidateQueries({ queryKey: waMessagesKeys.status() });
      }

      // If user was banned or deactivated, they should be logged out
      if (newStatus === 'banned' || newStatus === 'inactive') {
        const reason = newStatus === 'banned' ? 'banned' : 'deactivated';
        console.log(`[RealtimeSync] User has been ${reason}, logging out...`);
        // Clear auth and redirect to login
        useAuthStore.getState().logout();
        window.location.href = '/';
      }
    },
    [queryClient]
  );

  // === ORG CALL POLICY (anti-spam end-call lock) ===
  // The super-admin flipped the org's trunk, which carries the end-call-lock policy
  // (Telnyx → lock on, Tozcall → lock off). Patch the flag onto the auth user LIVE so
  // the dialer drops/restores the lock without a re-login. Org-scoped broadcast (sent
  // to every member), so there's no per-user guard; payload is data, not instructions.
  const handleCallPolicyUpdated = useCallback(
    (payload: { organizationId?: number; endCallLockEnabled?: number | boolean } | null) => {
      if (!payload || payload.endCallLockEnabled === undefined) return;
      const currentUser = useAuthStore.getState().user;
      if (!currentUser) return;
      useAuthStore
        .getState()
        .setUser({ ...currentUser, endCallLockEnabled: payload.endCallLockEnabled });
    },
    []
  );

  // === RECONNECT HANDLER ===

  // Reconnection: invalidate everything to ensure fresh data.
  //
  // This is the load-bearing safety net for the "event was missed during
  // a brief disconnect" failure mode — the user's tab loses the socket
  // for a few hundred milliseconds, the server emits a customer:* event
  // in that window, and the event is gone forever. Socket.IO recovers
  // the connection automatically and fires 'reconnect'; we use that as
  // the trigger to reconcile every cache that has live WS-driven data.
  //
  // Without this, missed events leave stale UI until manual refresh.
  const handleReconnect = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: callsKeys.all });
    queryClient.invalidateQueries({ queryKey: messagesKeys.all });
    queryClient.invalidateQueries({ queryKey: contactsKeys.all });
    queryClient.invalidateQueries({ queryKey: voicemailKeys.all });
    queryClient.invalidateQueries({ queryKey: recordingsKeys.all });
    queryClient.invalidateQueries({ queryKey: campaignsKeys.all });
    // SMS Groups - query key is ['groups', ...]
    queryClient.invalidateQueries({ queryKey: ['groups'] });
    // WhatsApp reconciliation — scoped to conversations only. The bell
    // scalar (waMessagesKeys.unreadCount()) is now reconciled per-event
    // by the WA_RECEIVED / WA_READ / WA_CONVERSATION_DELETED handlers
    // and by useWaMarkAsRead.onSettled, so a broad `waMessagesKeys.all`
    // here is redundant AND was contributing to the "bell briefly shows
    // 1 then vanishes" race (it kicked off a refetch that could land
    // mid-WS-event and clobber state). Same scope philosophy as
    // handleCustomerEvent further down.
    queryClient.invalidateQueries({ queryKey: waMessagesKeys.conversations() });
    queryClient.invalidateQueries({ queryKey: customersKeys.all });
    // WA-org caches (groups + numbers) reconcile inside
    // `useRealtimeWaOrgSync` on the manager routes — not here.
  }, [queryClient]);

  // === CUSTOMER ASSIGNMENT HANDLERS ===
  //
  // Manager-side: any change in the org's customer pool — created,
  // updated, deleted, assignment moved, or a triage entry arriving from a
  // new inbound number — invalidates the customer list query so
  // /admin/customers reflects it immediately.
  //
  // Agent-side: customer:assigned and customer:unassigned arrive only on
  // the user-specific room (server emitToUser), so getting them here means
  // it's THIS user. Refresh My Customers + the WA conversation list (the
  // server-side filter for masked agents depends on the assignment table,
  // and a new assignment opens up new conversations).
  //
  // Scope note — what we DO NOT invalidate:
  //   - waMessagesKeys.unreadCount(): a scalar maintained directly by the
  //     dedicated WA_RECEIVED / WA_READ / WA_CONVERSATION_DELETED handlers
  //     in useRealtimeWaSync. Bulk-invalidating it on every customer event
  //     used to produce a "bell briefly shows 1, then resets to 0" race:
  //     the customer event arrived right alongside WA_RECEIVED, scheduled
  //     a /unread-count refetch, the refetch landed AFTER the +1 from
  //     WA_RECEIVED and clobbered it with a stale 0. The server-side fix
  //     in routeInboundMessage (emit-after-commit) closes the race at the
  //     source, and scoping here is defense in depth.
  //   - waMessagesKeys.windows(): conversation windows are per-customer
  //     and don't change on assignment transfer.
  //   - per-thread message caches: messages stay tied to their original
  //     user_phone after a transfer; only the conversation LIST visibility
  //     can change for masked agents (handled by the conversations refetch).
  // Plain customer CRUD (CREATED / UPDATED / TRIAGE_ARRIVED) only ever
  // changes the customer list, never the user's set of visible WA
  // conversations. Bulk-invalidating `waMessagesKeys.conversations()`
  // here was the load-bearing cause of "manager sees a new inbound,
  // then it vanishes" — the customer event arrived right after
  // WA_RECEIVED, kicked off a `/conversations` refetch, and if the
  // refetch happened to race the message commit (or the manager
  // momentarily downgraded to a user-scoped filter), the optimistically
  // prepended conversation got clobbered by an empty server response.
  const handleCustomerListEvent = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: customersKeys.all });
  }, [queryClient]);

  // Assignment-changing events (ASSIGNED / UNASSIGNED / DELETED) can
  // genuinely move the set of visible conversations — a transferred
  // chat opens up for the new owner and (for masked agents) closes
  // for the old one. These still invalidate the conversations cache
  // so the visibility predicate gets re-evaluated server-side.
  const handleCustomerAssignmentEvent = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: customersKeys.all });
    queryClient.invalidateQueries({ queryKey: waMessagesKeys.conversations() });
  }, [queryClient]);

  // Triage-arrival toast + badge live in `useRealtimeTriageSync`, which
  // is mounted in the /admin and /org layouts. That hook only runs for
  // managers/owners (the people viewing those layouts), so agents on
  // /phone never see triage toasts irrelevant to their work. SSOT: one
  // hook, one place.

  // WA-org events (groups + number assignment) are NOT handled here.
  // They fire only on the manager-facing routes (/admin/whatsapp/*,
  // /org/whatsapp/*); see `useRealtimeWaOrgSync` which is mounted inside
  // those manager components. Putting them here too would be dead code
  // on /phone routes (agents don't render the WA-org caches) and
  // would split the SSOT for those events across two files.

  // Register event listeners
  useEffect(() => {
    if (!socket || !isConnected) return;

    socket.on(REALTIME_EVENTS.CONTACT_CHANGED, handleContactEvent);
    socket.on(REALTIME_EVENTS.CAMPAIGN_UPDATED, handleCampaignUpdated);
    socket.on(REALTIME_EVENTS.AI_CALL_COMPLETED, handleAiCallCompleted);
    socket.on(REALTIME_EVENTS.AI_CALL_FAILED, handleAiCallCompleted);
    socket.on(REALTIME_EVENTS.AI_CAMPAIGN_PROGRESS, handleAiCampaignProgress);
    socket.on(REALTIME_EVENTS.VOICEMAIL_NEW, handleVoicemailNew);
    socket.on(REALTIME_EVENTS.VOICEMAIL_DELETED, handleVoicemailDeleted);
    socket.on(REALTIME_EVENTS.VOICEMAIL_READ, handleVoicemailRead);
    socket.on(REALTIME_EVENTS.VOICEMAIL_ALL_READ, handleVoicemailAllRead);
    socket.on(REALTIME_EVENTS.RECORDING_NEW, handleRecordingNew);
    socket.on(REALTIME_EVENTS.RECORDING_DELETED, handleRecordingDeleted);
    socket.on(REALTIME_EVENTS.SMS_DELETED, handleSmsDeleted);
    socket.on(REALTIME_EVENTS.SMS_CONVERSATION_DELETED, handleSmsConversationDeleted);
    socket.on(REALTIME_EVENTS.ADMIN_CALL_ENDED, handleAdminCallEnded);
    socket.on(REALTIME_EVENTS.USER_SETTINGS_UPDATED, handleUserSettingsUpdated);
    socket.on(REALTIME_EVENTS.ORG_CALL_POLICY_UPDATED, handleCallPolicyUpdated);
    socket.on(REALTIME_EVENTS.CUSTOMER_CREATED, handleCustomerListEvent);
    socket.on(REALTIME_EVENTS.CUSTOMER_UPDATED, handleCustomerListEvent);
    socket.on(REALTIME_EVENTS.CUSTOMER_DELETED, handleCustomerAssignmentEvent);
    socket.on(REALTIME_EVENTS.CUSTOMER_ASSIGNED, handleCustomerAssignmentEvent);
    socket.on(REALTIME_EVENTS.CUSTOMER_UNASSIGNED, handleCustomerAssignmentEvent);
    socket.on(REALTIME_EVENTS.CUSTOMER_TRIAGE_ARRIVED, handleCustomerListEvent);
    // Socket.IO v4: the `reconnect` event fires on the MANAGER (socket.io), NOT
    // on the Socket. Binding it on `socket` never fires → missed messages/calls
    // never backfilled after a dropped-then-restored connection (they only came
    // back on window-focus refetch). Bind on the Manager so the resync actually runs.
    socket.io.on('reconnect', handleReconnect);

    return () => {
      socket.off(REALTIME_EVENTS.CONTACT_CHANGED, handleContactEvent);
      socket.off(REALTIME_EVENTS.CAMPAIGN_UPDATED, handleCampaignUpdated);
      socket.off(REALTIME_EVENTS.AI_CALL_COMPLETED, handleAiCallCompleted);
      socket.off(REALTIME_EVENTS.AI_CALL_FAILED, handleAiCallCompleted);
      socket.off(REALTIME_EVENTS.AI_CAMPAIGN_PROGRESS, handleAiCampaignProgress);
      socket.off(REALTIME_EVENTS.VOICEMAIL_NEW, handleVoicemailNew);
      socket.off(REALTIME_EVENTS.VOICEMAIL_DELETED, handleVoicemailDeleted);
      socket.off(REALTIME_EVENTS.VOICEMAIL_READ, handleVoicemailRead);
      socket.off(REALTIME_EVENTS.VOICEMAIL_ALL_READ, handleVoicemailAllRead);
      socket.off(REALTIME_EVENTS.RECORDING_NEW, handleRecordingNew);
      socket.off(REALTIME_EVENTS.RECORDING_DELETED, handleRecordingDeleted);
      socket.off(REALTIME_EVENTS.SMS_DELETED, handleSmsDeleted);
      socket.off(REALTIME_EVENTS.SMS_CONVERSATION_DELETED, handleSmsConversationDeleted);
      socket.off(REALTIME_EVENTS.ADMIN_CALL_ENDED, handleAdminCallEnded);
      socket.off(REALTIME_EVENTS.USER_SETTINGS_UPDATED, handleUserSettingsUpdated);
      socket.off(REALTIME_EVENTS.ORG_CALL_POLICY_UPDATED, handleCallPolicyUpdated);
      socket.off(REALTIME_EVENTS.CUSTOMER_CREATED, handleCustomerListEvent);
      socket.off(REALTIME_EVENTS.CUSTOMER_UPDATED, handleCustomerListEvent);
      socket.off(REALTIME_EVENTS.CUSTOMER_DELETED, handleCustomerAssignmentEvent);
      socket.off(REALTIME_EVENTS.CUSTOMER_ASSIGNED, handleCustomerAssignmentEvent);
      socket.off(REALTIME_EVENTS.CUSTOMER_UNASSIGNED, handleCustomerAssignmentEvent);
      socket.off(REALTIME_EVENTS.CUSTOMER_TRIAGE_ARRIVED, handleCustomerListEvent);
      socket.io.off('reconnect', handleReconnect);
    };
  }, [
    socket,
    isConnected,
    handleContactEvent,
    handleCampaignUpdated,
    handleAiCallCompleted,
    handleAiCampaignProgress,
    handleVoicemailNew,
    handleVoicemailDeleted,
    handleVoicemailRead,
    handleVoicemailAllRead,
    handleRecordingNew,
    handleRecordingDeleted,
    handleSmsDeleted,
    handleSmsConversationDeleted,
    handleAdminCallEnded,
    handleUserSettingsUpdated,
    handleCallPolicyUpdated,
    handleCustomerListEvent,
    handleCustomerAssignmentEvent,
    handleReconnect,
  ]);
}
