'use client';

import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';
import {
  contactsService,
  type Contact,
  type BlockedContact,
  type ContactsQueryParams,
  type PaginatedContactsResponse,
  type UpdateContactRequest,
} from '@/lib/api';
import { REALTIME_QUERY_CONFIG } from '@/lib/constants/query';

/**
 * Helper to check if error is a 404
 */
function is404Error(error: unknown): boolean {
  if (error instanceof Error && 'status' in error) {
    return (error as { status: number }).status === 404;
  }
  if (error && typeof error === 'object' && 'response' in error) {
    return (error as { response?: { status?: number } }).response?.status === 404;
  }
  return false;
}

// Query keys for cache management
export const contactsKeys = {
  all: ['contacts'] as const,
  list: () => [...contactsKeys.all, 'list'] as const,
  listPaginated: (params: ContactsQueryParams) => [...contactsKeys.all, 'list', params] as const,
  blocked: () => [...contactsKeys.all, 'blocked'] as const,
  favorites: () => [...contactsKeys.all, 'favorites'] as const,
  detail: (id: number) => [...contactsKeys.all, 'detail', id] as const,
};

/**
 * Predicate matching all paginated contact list queries.
 * Key shape: ['contacts', 'list', { page, limit, ... }]
 */
function isPaginatedListQuery(queryKey: readonly unknown[]): boolean {
  return queryKey.length >= 2 && queryKey[0] === 'contacts' && queryKey[1] === 'list';
}

/**
 * Snapshot all paginated list caches for rollback
 */
function snapshotPaginatedCaches(queryClient: QueryClient): Map<string, PaginatedContactsResponse> {
  const snapshot = new Map<string, PaginatedContactsResponse>();
  const queries = queryClient.getQueriesData<PaginatedContactsResponse>({
    predicate: (q) => isPaginatedListQuery(q.queryKey),
  });
  for (const [key, data] of queries) {
    if (data) {
      snapshot.set(JSON.stringify(key), data);
    }
  }
  return snapshot;
}

/**
 * Restore paginated caches from snapshot
 */
function restorePaginatedCaches(
  queryClient: QueryClient,
  snapshot: Map<string, PaginatedContactsResponse>
): void {
  for (const [keyStr, data] of snapshot) {
    queryClient.setQueryData(JSON.parse(keyStr), data);
  }
}

/**
 * Optimistically update a contact by ID across all paginated caches
 */
function optimisticUpdateInPaginated(
  queryClient: QueryClient,
  id: number,
  updater: (contact: Contact) => Contact
): void {
  queryClient.setQueriesData<PaginatedContactsResponse>(
    { predicate: (q) => isPaginatedListQuery(q.queryKey) },
    (old) => {
      if (!old?.contacts) return old;
      return {
        ...old,
        contacts: old.contacts.map((c) => (c.id === id ? updater(c) : c)),
      };
    }
  );
}

/**
 * Optimistically remove a contact by ID across all paginated caches
 */
function optimisticRemoveFromPaginated(queryClient: QueryClient, id: number): void {
  queryClient.setQueriesData<PaginatedContactsResponse>(
    { predicate: (q) => isPaginatedListQuery(q.queryKey) },
    (old) => {
      if (!old?.contacts) return old;
      const filtered = old.contacts.filter((c) => c.id !== id);
      if (filtered.length === old.contacts.length) return old;
      return {
        ...old,
        contacts: filtered,
        total: Math.max(0, old.total - 1),
        totalPages: Math.max(1, Math.ceil((old.total - 1) / old.limit)),
      };
    }
  );
}

/**
 * Hook to fetch contacts with pagination
 * Uses real-time config - data updated via WebSocket events
 */
export function useContactsPaginated(params: ContactsQueryParams = {}) {
  return useQuery({
    queryKey: contactsKeys.listPaginated(params),
    queryFn: () => contactsService.getContactsPaginated(params),
    ...REALTIME_QUERY_CONFIG,
  });
}

/**
 * Hook to fetch all contacts (legacy - no pagination)
 * Uses real-time config - data updated via WebSocket events
 * @deprecated Use useContactsPaginated for better performance
 */
export function useContacts() {
  return useQuery({
    queryKey: contactsKeys.list(),
    queryFn: () => contactsService.getContacts(),
    ...REALTIME_QUERY_CONFIG,
  });
}

/**
 * Hook to fetch blocked contacts
 * Uses real-time config - data updated via WebSocket events
 */
export function useBlockedContacts() {
  return useQuery({
    queryKey: contactsKeys.blocked(),
    queryFn: () => contactsService.getBlockedContacts(),
    ...REALTIME_QUERY_CONFIG,
  });
}

/**
 * Hook to create a contact
 */
export function useCreateContact() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { name: string; contact: string; type?: string; notes?: string }) =>
      contactsService.createContact(data),
    onSuccess: () => {
      // Invalidate all lists — new contact needs server-side sort position + total count
      queryClient.invalidateQueries({ queryKey: contactsKeys.list() });
      queryClient.invalidateQueries({ queryKey: contactsKeys.favorites() });
    },
  });
}

/**
 * Hook to update a contact
 */
export function useUpdateContact() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateContactRequest }) =>
      contactsService.updateContact(id, data),
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ predicate: (q) => isPaginatedListQuery(q.queryKey) });

      const snapshot = snapshotPaginatedCaches(queryClient);

      optimisticUpdateInPaginated(queryClient, id, (c) => ({ ...c, ...data }));

      return { snapshot };
    },
    onError: (_err, _variables, context) => {
      if (context?.snapshot) {
        restorePaginatedCaches(queryClient, context.snapshot);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: contactsKeys.list() });
    },
  });
}

/**
 * Hook to delete a contact
 */
export function useDeleteContact() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => contactsService.deleteContact(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ predicate: (q) => isPaginatedListQuery(q.queryKey) });

      const snapshot = snapshotPaginatedCaches(queryClient);

      optimisticRemoveFromPaginated(queryClient, id);

      return { snapshot };
    },
    onError: (_err, _id, context) => {
      if (context?.snapshot) {
        restorePaginatedCaches(queryClient, context.snapshot);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: contactsKeys.list() });
      queryClient.invalidateQueries({ queryKey: contactsKeys.favorites() });
    },
  });
}

/**
 * Hook to block a contact
 */
export function useBlockContact() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (phoneNumber: string) => contactsService.blockContact(phoneNumber),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: contactsKeys.blocked() });
    },
  });
}

/**
 * Hook to unblock a contact
 */
export function useUnblockContact() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => contactsService.unblockContact(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: contactsKeys.blocked() });

      const previousBlocked = queryClient.getQueryData<BlockedContact[]>(contactsKeys.blocked());

      queryClient.setQueryData<BlockedContact[]>(contactsKeys.blocked(), (old) =>
        old?.filter((c) => c.id !== id)
      );

      return { previousBlocked };
    },
    onError: (_err, _id, context) => {
      if (context?.previousBlocked) {
        queryClient.setQueryData(contactsKeys.blocked(), context.previousBlocked);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: contactsKeys.blocked() });
    },
  });
}

/**
 * Hook to fetch favorite contacts
 * Uses real-time config - data updated via WebSocket events
 * Falls back to empty array if endpoint not available
 */
export function useFavoriteContacts() {
  return useQuery({
    queryKey: contactsKeys.favorites(),
    queryFn: async () => {
      try {
        return await contactsService.getFavorites();
      } catch (error) {
        if (is404Error(error)) {
          console.warn('[useFavoriteContacts] Endpoint not available, returning empty array');
          return [] as Contact[];
        }
        throw error;
      }
    },
    ...REALTIME_QUERY_CONFIG,
  });
}

/**
 * Hook providing quick lookup structures for blocked numbers.
 * Returns a Set for O(1) membership checks and a Map for number -> blocked ID resolution.
 */
export function useBlockedNumberLookup() {
  const { data: blockedContacts } = useBlockedContacts();

  const blockedNumberSet = useMemo(
    () => new Set(blockedContacts?.map((b) => b.phoneNumber) || []),
    [blockedContacts]
  );

  const blockedNumberMap = useMemo(
    () => new Map(blockedContacts?.map((b) => [b.phoneNumber, b.id]) || []),
    [blockedContacts]
  );

  return { blockedNumberSet, blockedNumberMap, blockedContacts };
}

/**
 * Hook to toggle contact favorite status
 * Silently fails if endpoint not available (keeps optimistic update)
 */
export function useToggleFavorite() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, isFavorite }: { id: number; isFavorite: boolean }) => {
      try {
        return await contactsService.toggleFavorite(id, isFavorite);
      } catch (error) {
        if (is404Error(error)) {
          console.warn('[useToggleFavorite] Endpoint not available, feature disabled');
          return { id, isFavorite } as Contact;
        }
        throw error;
      }
    },
    onMutate: async ({ id, isFavorite }) => {
      // Cancel all paginated + favorites queries
      await queryClient.cancelQueries({ predicate: (q) => isPaginatedListQuery(q.queryKey) });
      await queryClient.cancelQueries({ queryKey: contactsKeys.favorites() });

      // Snapshot for rollback
      const paginatedSnapshot = snapshotPaginatedCaches(queryClient);
      const previousFavorites = queryClient.getQueryData<Contact[]>(contactsKeys.favorites());

      // Optimistically update all paginated caches
      optimisticUpdateInPaginated(queryClient, id, (c) => ({ ...c, isFavorite }));

      // Optimistically update favorites list
      if (isFavorite) {
        // Find the contact from any paginated cache to add to favorites
        let contact: Contact | undefined;
        const queries = queryClient.getQueriesData<PaginatedContactsResponse>({
          predicate: (q) => isPaginatedListQuery(q.queryKey),
        });
        for (const [, data] of queries) {
          contact = data?.contacts?.find((c) => c.id === id);
          if (contact) break;
        }
        if (contact) {
          queryClient.setQueryData<Contact[]>(contactsKeys.favorites(), (old) =>
            old ? [...old, { ...contact!, isFavorite: true }] : [{ ...contact!, isFavorite: true }]
          );
        }
      } else {
        queryClient.setQueryData<Contact[]>(contactsKeys.favorites(), (old) =>
          old?.filter((c) => c.id !== id)
        );
      }

      return { paginatedSnapshot, previousFavorites };
    },
    onError: (_err, _variables, context) => {
      if (context?.paginatedSnapshot) {
        restorePaginatedCaches(queryClient, context.paginatedSnapshot);
      }
      if (context?.previousFavorites) {
        queryClient.setQueryData(contactsKeys.favorites(), context.previousFavorites);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: contactsKeys.list() });
      queryClient.invalidateQueries({ queryKey: contactsKeys.favorites() });
    },
  });
}
