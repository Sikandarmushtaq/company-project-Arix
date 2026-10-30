/**
 * WhatsApp Org Owner Hooks
 *
 * React Query bindings for /whatsapp/org/* endpoints.
 * Mirrors useOrg.ts conventions: per-resource query keys, broad
 * invalidation on mutation, no optimistic updates (server is the
 * source of truth for cred validation + Meta sync).
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getMyConfig,
  saveMyConfig,
  getMyNumbers,
  syncMyNumbers,
  assignMyNumber,
  assignMyNumberGroup,
  setMyUserWaEnabled,
  setMyUserWaPhoneMask,
  listMyWaGroups,
  getMyWaGroup,
  createMyWaGroup,
  updateMyWaGroup,
  deleteMyWaGroup,
  setMyWaGroupMembers,
  type SaveWaOrgConfigRequest,
} from '@/lib/api/services/whatsapp-org.api';
import type {
  WaConfig,
  WaNumber,
  WaAgentGroup,
  CreateWaAgentGroupRequest,
  UpdateWaAgentGroupRequest,
} from '@/lib/api/services/whatsapp-types';

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

export const waOrgKeys = {
  all: ['wa-org'] as const,
  config: ['wa-org', 'config'] as const,
  numbers: ['wa-org', 'numbers'] as const,
  groups: ['wa-org', 'groups'] as const,
  group: (id: number) => ['wa-org', 'groups', id] as const,
};

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

export function useMyWaConfig() {
  return useQuery<WaConfig | null>({
    queryKey: waOrgKeys.config,
    queryFn: () => getMyConfig(),
    staleTime: 30_000,
    // Fail fast on backend errors instead of waiting through 1s+2s retry
    // backoff. The user sees an actionable error immediately.
    retry: false,
  });
}

export function useSaveMyWaConfig() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: SaveWaOrgConfigRequest) => saveMyConfig(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: waOrgKeys.config });
      queryClient.invalidateQueries({ queryKey: waOrgKeys.numbers });
    },
  });
}

// ---------------------------------------------------------------------------
// Numbers
// ---------------------------------------------------------------------------

export function useMyWaNumbers() {
  return useQuery<WaNumber[]>({
    queryKey: waOrgKeys.numbers,
    queryFn: () => getMyNumbers(),
    staleTime: 30_000,
    retry: false,
  });
}

export function useSyncMyWaNumbers() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => syncMyNumbers(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: waOrgKeys.numbers });
    },
  });
}

export function useAssignMyWaNumber() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ numberId, userId }: { numberId: number; userId: number | null }) =>
      assignMyNumber(numberId, userId),
    // Optimistic update — flip assignedUserId in the cache immediately
    // so the dropdown reflects the chosen user without waiting for the
    // server round-trip. On error we roll back via the snapshot.
    onMutate: async ({ numberId, userId }) => {
      await queryClient.cancelQueries({ queryKey: waOrgKeys.numbers });
      const previous = queryClient.getQueryData<WaNumber[]>(waOrgKeys.numbers);
      if (previous) {
        queryClient.setQueryData<WaNumber[]>(
          waOrgKeys.numbers,
          previous.map((n) => (n.id === numberId ? { ...n, assignedUserId: userId } : n))
        );
      }
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(waOrgKeys.numbers, context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: waOrgKeys.numbers });
    },
  });
}

/**
 * Group-based assignment — set or clear the group attached to a WA number.
 * Optimistically updates the cached groupId; the server returns the
 * fully-hydrated number on settle.
 */
export function useAssignMyWaNumberGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ numberId, groupId }: { numberId: number; groupId: number | null }) =>
      assignMyNumberGroup(numberId, groupId),
    onMutate: async ({ numberId, groupId }) => {
      await queryClient.cancelQueries({ queryKey: waOrgKeys.numbers });
      const previous = queryClient.getQueryData<WaNumber[]>(waOrgKeys.numbers);
      if (previous) {
        queryClient.setQueryData<WaNumber[]>(
          waOrgKeys.numbers,
          previous.map((n) => (n.id === numberId ? { ...n, groupId } : n))
        );
      }
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(waOrgKeys.numbers, context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: waOrgKeys.numbers });
      queryClient.invalidateQueries({ queryKey: waOrgKeys.groups });
    },
  });
}

// ---------------------------------------------------------------------------
// Agent groups
// ---------------------------------------------------------------------------

export function useMyWaGroups() {
  return useQuery<WaAgentGroup[]>({
    queryKey: waOrgKeys.groups,
    queryFn: () => listMyWaGroups(),
    staleTime: 30_000,
    retry: false,
  });
}

export function useMyWaGroup(groupId: number | null) {
  return useQuery<WaAgentGroup>({
    queryKey: groupId !== null ? waOrgKeys.group(groupId) : ['wa-org', 'groups', 'noop'],
    queryFn: () => getMyWaGroup(groupId as number),
    enabled: groupId !== null,
    staleTime: 30_000,
    retry: false,
  });
}

export function useCreateMyWaGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateWaAgentGroupRequest) => createMyWaGroup(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: waOrgKeys.groups });
    },
  });
}

export function useUpdateMyWaGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ groupId, data }: { groupId: number; data: UpdateWaAgentGroupRequest }) =>
      updateMyWaGroup(groupId, data),
    onSuccess: (_data, { groupId }) => {
      queryClient.invalidateQueries({ queryKey: waOrgKeys.groups });
      queryClient.invalidateQueries({ queryKey: waOrgKeys.group(groupId) });
    },
  });
}

export function useDeleteMyWaGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (groupId: number) => deleteMyWaGroup(groupId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: waOrgKeys.groups });
      queryClient.invalidateQueries({ queryKey: waOrgKeys.numbers });
    },
  });
}

export function useSetMyWaGroupMembers() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ groupId, userIds }: { groupId: number; userIds: number[] }) =>
      setMyWaGroupMembers(groupId, userIds),
    onSuccess: (_data, { groupId }) => {
      queryClient.invalidateQueries({ queryKey: waOrgKeys.groups });
      queryClient.invalidateQueries({ queryKey: waOrgKeys.group(groupId) });
    },
  });
}

// ---------------------------------------------------------------------------
// Per-user WA toggle (within owner's org)
// ---------------------------------------------------------------------------

export function useSetMyUserWaEnabled() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, enabled }: { userId: number; enabled: boolean }) =>
      setMyUserWaEnabled(userId, enabled),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['org', 'users'] });
      queryClient.invalidateQueries({ queryKey: waOrgKeys.numbers });
    },
  });
}

/**
 * Owner/manager toggles privacy mode on an agent in their org. The agent
 * gets a USER_SETTINGS_UPDATED event server-side, so their open browser
 * tabs flip the mask without a refresh; the `org/users` cache is also
 * invalidated so the toggle reflects the new state on this admin's screen.
 */
export function useSetMyUserWaPhoneMask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, enabled }: { userId: number; enabled: boolean }) =>
      setMyUserWaPhoneMask(userId, enabled),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['org', 'users'] });
    },
  });
}
