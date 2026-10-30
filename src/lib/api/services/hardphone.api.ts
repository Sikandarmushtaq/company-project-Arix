/**
 * Hardphone API service — admin CRUD for provisioned Polycom/Yealink desk phones.
 *
 * @module lib/api/services/hardphone.api
 */

import { apiClient } from '../client';
import type { ApiResponse } from '@/lib/types';

export type HardphoneVendor = 'polycom' | 'yealink';
export type HardphoneStatus = 'online' | 'offline' | 'unknown';

export interface Hardphone {
  id: number;
  organizationId: number | null;
  label: string | null;
  vendor: HardphoneVendor;
  model: string | null;
  macAddress: string;
  extension: string;
  assignedUserId: number | null;
  enabled: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  status: HardphoneStatus;
}

export interface HardphoneInput {
  label?: string | null;
  vendor: HardphoneVendor;
  model?: string | null;
  macAddress: string;
  extension: string;
  assignedUserId?: number | null;
  enabled?: boolean;
  notes?: string | null;
}

/** A user that owns a SIP extension, for the "assign to extension" picker. */
export interface AvailableExtension {
  userId: number;
  fullName: string | null;
  senderPhone: string | null;
  extension: string;
  /** true if this extension already has a hardphone (can't be reused). */
  assigned: boolean;
}

export const hardphoneApi = {
  async list(): Promise<Hardphone[]> {
    const res = await apiClient.get<ApiResponse<Hardphone[]>>('/admin/hardphones');
    return res.data ?? [];
  },
  async create(input: HardphoneInput): Promise<Hardphone> {
    const res = await apiClient.post<ApiResponse<Hardphone>>('/admin/hardphones', input);
    return res.data as Hardphone;
  },
  async update(id: number, input: Partial<HardphoneInput>): Promise<Hardphone> {
    const res = await apiClient.put<ApiResponse<Hardphone>>(`/admin/hardphones/${id}`, input);
    return res.data as Hardphone;
  },
  async remove(id: number): Promise<void> {
    await apiClient.delete<ApiResponse<{ message: string }>>(`/admin/hardphones/${id}`);
  },
  async availableExtensions(): Promise<AvailableExtension[]> {
    const res = await apiClient.get<ApiResponse<AvailableExtension[]>>(
      '/admin/hardphones/available-extensions'
    );
    return res.data ?? [];
  },
};
