'use client';

/**
 * Customers — React Query hooks.
 *
 * Manager hooks read/write the org's customer pool; agent hooks read the
 * agent's "My Customers" worklist and start chats by ID (no phone needed
 * client-side for masked agents).
 *
 * @module lib/hooks/useCustomers
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  listCustomers,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  assignCustomer,
  getAssignmentHistory,
  getCustomerLockouts,
  removeCustomerLockout,
  listMyCustomers,
  startChatWithCustomer,
  bulkAssignCustomers,
  bulkDeleteCustomers,
  bulkImportCustomers,
  type ListCustomersParams,
} from '@/lib/api/services/customers.api';
import { REALTIME_QUERY_CONFIG } from '@/lib/constants/query';

export const customersKeys = {
  all: ['customers'] as const,
  list: (params: ListCustomersParams) => ['customers', 'list', params] as const,
  history: (id: number) => ['customers', 'history', id] as const,
  lockouts: (id: number) => ['customers', 'lockouts', id] as const,
  my: ['customers', 'my'] as const,
};

// ============================================================
// Manager hooks
// ============================================================

export function useCustomersList(params: ListCustomersParams = {}) {
  return useQuery({
    queryKey: customersKeys.list(params),
    queryFn: () => listCustomers(params),
    ...REALTIME_QUERY_CONFIG,
  });
}

export function useCreateCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createCustomer,
    onSuccess: () => qc.invalidateQueries({ queryKey: customersKeys.all }),
  });
}

export function useUpdateCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Parameters<typeof updateCustomer>[1] }) =>
      updateCustomer(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: customersKeys.all }),
  });
}

export function useDeleteCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteCustomer,
    onSuccess: () => qc.invalidateQueries({ queryKey: customersKeys.all }),
  });
}

export function useAssignCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Parameters<typeof assignCustomer>[1] }) =>
      assignCustomer(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: customersKeys.all }),
  });
}

export function useAssignmentHistory(id: number | null) {
  return useQuery({
    queryKey: id ? customersKeys.history(id) : ['customers', 'history', 'none'],
    queryFn: () => (id ? getAssignmentHistory(id) : Promise.resolve([])),
    enabled: !!id,
  });
}

/**
 * Locked-out agents for a customer. Manager surface — used by the edit
 * modal to show who's been locked out via chat-transfer and offer a
 * "Restore access" button.
 */
export function useCustomerLockouts(id: number | null) {
  return useQuery({
    queryKey: id ? customersKeys.lockouts(id) : ['customers', 'lockouts', 'none'],
    queryFn: () => (id ? getCustomerLockouts(id) : Promise.resolve([])),
    enabled: !!id,
    ...REALTIME_QUERY_CONFIG,
  });
}

export function useRemoveCustomerLockout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ customerId, userId }: { customerId: number; userId: number }) =>
      removeCustomerLockout(customerId, userId),
    onSuccess: () => qc.invalidateQueries({ queryKey: customersKeys.all }),
  });
}

// ============================================================
// Bulk hooks (manager)
// ============================================================

export function useBulkAssignCustomers() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      customerIds,
      userId,
      handoffNotes,
      transferChat,
    }: {
      customerIds: number[];
      userId: number | null;
      handoffNotes?: string | null;
      transferChat?: boolean;
    }) => bulkAssignCustomers(customerIds, userId, handoffNotes, { transferChat }),
    onSuccess: () => qc.invalidateQueries({ queryKey: customersKeys.all }),
  });
}

export function useBulkDeleteCustomers() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (customerIds: number[]) => bulkDeleteCustomers(customerIds),
    onSuccess: () => qc.invalidateQueries({ queryKey: customersKeys.all }),
  });
}

export function useBulkImportCustomers() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      rows,
      options,
    }: {
      rows: Parameters<typeof bulkImportCustomers>[0];
      options?: Parameters<typeof bulkImportCustomers>[1];
    }) => bulkImportCustomers(rows, options),
    onSuccess: () => qc.invalidateQueries({ queryKey: customersKeys.all }),
  });
}

// ============================================================
// Agent hooks
// ============================================================

export function useMyCustomers() {
  return useQuery({
    queryKey: customersKeys.my,
    queryFn: () => listMyCustomers(),
    ...REALTIME_QUERY_CONFIG,
  });
}

export function useStartChatWithCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: number;
      payload: Parameters<typeof startChatWithCustomer>[1];
    }) => startChatWithCustomer(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: customersKeys.my });
    },
  });
}
