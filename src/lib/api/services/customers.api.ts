/**
 * Customers API client — org-level customer pool.
 *
 * Manager surface (full CRUD + assign + history) and agent surface
 * (my-customers + start-chat). Mounted under /api/v1/customers — see
 * server/src/modules/customers for the schema.
 *
 * @module lib/api/services/customers.api
 */

import { apiClient } from '../client';
import type { ApiResponse } from '@/lib/types';

export type CustomerStatus = 'new' | 'active' | 'closed' | 'dnc';

export interface OrgCustomer {
  id: number;
  organizationId: number;
  name: string;
  phone: string;
  notes: string | null;
  status: CustomerStatus;
  createdBy: number;
  createdAt: string;
  updatedAt: string;
}

export interface OrgCustomerWithAssignment extends OrgCustomer {
  assignedUserId: number | null;
  assignedUserName: string | null;
  assignedAt: string | null;
  lastMessageAt: string | null;
  unreadCount: number;
}

/**
 * Agent-side row. `phoneMasked=true` means the server replaced the raw
 * phone with a stub (e.g. "••••1997") because privacy mode is on for this
 * user. UI should treat `phone` as a display string, not a callable
 * number, when phoneMasked is true.
 */
export interface MyCustomer {
  id: number;
  name: string;
  phone: string;
  phoneMasked: boolean;
  status: CustomerStatus;
  notes: string | null;
  assignedAt: string;
  lastMessageAt: string | null;
  unreadCount: number;
}

export interface OrgCustomerAssignment {
  id: number;
  customerId: number;
  userId: number;
  organizationId: number;
  assignedBy: number;
  assignedAt: string;
  unassignedAt: string | null;
  handoffNotes: string | null;
}

export interface ListCustomersParams {
  search?: string;
  status?: CustomerStatus;
  /** "unassigned" → triage queue. number → specific agent. omit → all. */
  assignedUserId?: number | 'unassigned';
  page?: number;
  limit?: number;
}

// ============================================================
// Manager endpoints
// ============================================================

export async function listCustomers(
  params: ListCustomersParams = {}
): Promise<{ customers: OrgCustomerWithAssignment[]; total: number }> {
  const r = await apiClient.get<ApiResponse<OrgCustomerWithAssignment[]>>('/customers', {
    params: params as Record<string, string | number | boolean | undefined>,
  });
  return {
    customers: r.data,
    total: (r as { meta?: { total: number } }).meta?.total ?? r.data.length,
  };
}

export async function createCustomer(input: {
  name: string;
  phone: string;
  notes?: string;
  status?: CustomerStatus;
}): Promise<OrgCustomer> {
  const r = await apiClient.post<ApiResponse<OrgCustomer>>('/customers', input);
  return r.data;
}

export async function updateCustomer(
  id: number,
  input: { name?: string; notes?: string | null; status?: CustomerStatus }
): Promise<OrgCustomer> {
  const r = await apiClient.put<ApiResponse<OrgCustomer>>(`/customers/${id}`, input);
  return r.data;
}

export async function deleteCustomer(id: number): Promise<void> {
  await apiClient.delete(`/customers/${id}`);
}

export async function assignCustomer(
  id: number,
  data: {
    userId: number | null;
    handoffNotes?: string | null;
    /**
     * When true, the new assignee inherits the past chat AND the previous
     * agent is locked out from the conversation entirely. Default false
     * → reassign-only (previous agent keeps read access to their own work).
     */
    transferChat?: boolean;
  }
): Promise<OrgCustomerAssignment | null> {
  const r = await apiClient.put<ApiResponse<OrgCustomerAssignment | null>>(
    `/customers/${id}/assign`,
    data
  );
  return r.data;
}

export async function getAssignmentHistory(id: number): Promise<OrgCustomerAssignment[]> {
  const r = await apiClient.get<ApiResponse<OrgCustomerAssignment[]>>(`/customers/${id}/history`);
  return r.data;
}

export interface CustomerLockout {
  userId: number;
  userName: string;
  userEmail: string;
  lockedAt: string;
  lockedBy: number | null;
}

export async function getCustomerLockouts(id: number): Promise<CustomerLockout[]> {
  const r = await apiClient.get<ApiResponse<CustomerLockout[]>>(`/customers/${id}/lockouts`);
  return r.data;
}

export async function removeCustomerLockout(id: number, userId: number): Promise<void> {
  await apiClient.delete(`/customers/${id}/lockouts/${userId}`);
}

// ============================================================
// Bulk endpoints (manager)
// ============================================================

export interface BulkAssignResult {
  assigned: number;
  skipped: number;
}
export interface BulkDeleteResult {
  deleted: number;
  skipped: number;
}
export interface ImportRow {
  name?: string;
  phone?: string;
  notes?: string;
  status?: CustomerStatus;
  assignedUserEmail?: string;
}
export interface BulkImportResult {
  created: number;
  updated: number;
  duplicates: number;
  invalid: number;
  assigned: number;
  errors: Array<{ row: number; reason: string }>;
}

export async function bulkAssignCustomers(
  customerIds: number[],
  userId: number | null,
  handoffNotes?: string | null,
  options: { transferChat?: boolean } = {}
): Promise<BulkAssignResult> {
  const r = await apiClient.post<ApiResponse<BulkAssignResult>>(
    '/customers/bulk/assign',
    {
      customerIds,
      userId,
      handoffNotes: handoffNotes ?? null,
      transferChat: options.transferChat,
    },
    { timeout: 0 } // bulk mutation — never abort mid-flight (partial-apply risk)
  );
  return r.data;
}

export async function bulkDeleteCustomers(customerIds: number[]): Promise<BulkDeleteResult> {
  const r = await apiClient.post<ApiResponse<BulkDeleteResult>>(
    '/customers/bulk/delete',
    { customerIds },
    { timeout: 0 } // bulk mutation — never abort mid-flight
  );
  return r.data;
}

export async function bulkImportCustomers(
  rows: ImportRow[],
  options: {
    assignToUserId?: number | null;
    updateExisting?: boolean;
    transferChat?: boolean;
  } = {}
): Promise<BulkImportResult> {
  const r = await apiClient.post<ApiResponse<BulkImportResult>>(
    '/customers/bulk/import',
    {
      rows,
      assignToUserId: options.assignToUserId ?? null,
      updateExisting: options.updateExisting ?? false,
      transferChat: options.transferChat ?? false,
    },
    { timeout: 0 } // large CSV import can exceed the default; never abort mid-import
  );
  return r.data;
}

// ============================================================
// Agent endpoints
// ============================================================

export async function listMyCustomers(): Promise<MyCustomer[]> {
  const r = await apiClient.get<ApiResponse<MyCustomer[]>>('/customers/my/list');
  return r.data;
}

export async function startChatWithCustomer(
  id: number,
  payload: {
    body?: string;
    templateName?: string;
    templateLanguage?: string;
    templateParams?: string[];
  }
): Promise<unknown> {
  const r = await apiClient.post<ApiResponse<unknown>>(`/customers/my/${id}/start-chat`, payload);
  return r.data;
}
