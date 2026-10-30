/**
 * Bulk SMS Campaign Service
 *
 * API client for bulk-SMS campaign history.
 *
 * @see server/src/modules/bulk-sms/bulk-sms.repository.ts
 */

import { apiClient } from '../client';
import type { ApiResponse } from '@/lib/types';

export type BulkSmsCampaignStatus = 'running' | 'paused' | 'completed' | 'cancelled';

/** A bulk-SMS campaign record (dates are ISO strings over the wire). */
export interface BulkSmsCampaign {
  id: number;
  userId: string;
  organizationId: number | null;
  name: string;
  fromNumber: string;
  messageTemplate: string;
  intervalSeconds: number;
  totalCount: number;
  sentCount: number;
  failedCount: number;
  status: BulkSmsCampaignStatus;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateBulkSmsCampaignRequest {
  name: string;
  fromNumber: string;
  messageTemplate: string;
  intervalSeconds?: number;
  totalCount?: number;
}

export interface UpdateBulkSmsCampaignRequest {
  name?: string;
  status?: BulkSmsCampaignStatus;
  sentCount?: number;
  failedCount?: number;
}

export interface BulkSmsCampaignQueryParams {
  page?: number;
  limit?: number;
  status?: BulkSmsCampaignStatus;
}

export interface PaginatedBulkSmsCampaigns {
  campaigns: BulkSmsCampaign[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface BulkSmsRecipient {
  phoneNumber: string;
  status: string;
  sentAt: string | null;
  error: string | null;
  replied: boolean;
}

export interface PaginatedBulkSmsRecipients {
  recipients: BulkSmsRecipient[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

class BulkSmsCampaignService {
  /**
   * List campaigns (paginated, filterable by status).
   * Backend returns { success, data: BulkSmsCampaign[], meta }.
   */
  async list(params: BulkSmsCampaignQueryParams = {}): Promise<PaginatedBulkSmsCampaigns> {
    const response = await apiClient.get<
      ApiResponse<BulkSmsCampaign[]> & {
        meta: { total: number; page: number; limit: number; totalPages: number };
      }
    >('/bulk-sms/campaigns', {
      params: {
        page: params.page || 1,
        limit: params.limit || 20,
        ...(params.status ? { status: params.status } : {}),
      },
    });
    const limit = response.meta?.limit || params.limit || 20;
    const total = response.meta?.total ?? response.data.length;
    return {
      campaigns: response.data,
      total,
      page: response.meta?.page || params.page || 1,
      limit,
      totalPages: response.meta?.totalPages || Math.ceil(total / limit),
    };
  }

  async get(id: number): Promise<BulkSmsCampaign> {
    const response = await apiClient.get<ApiResponse<BulkSmsCampaign>>(
      `/bulk-sms/campaigns/${id}`
    );
    return response.data;
  }

  async create(data: CreateBulkSmsCampaignRequest): Promise<BulkSmsCampaign> {
    const response = await apiClient.post<ApiResponse<BulkSmsCampaign>>(
      '/bulk-sms/campaigns',
      data
    );
    return response.data;
  }

  async update(id: number, data: UpdateBulkSmsCampaignRequest): Promise<BulkSmsCampaign> {
    const response = await apiClient.put<ApiResponse<BulkSmsCampaign>>(
      `/bulk-sms/campaigns/${id}`,
      data
    );
    return response.data;
  }

  async remove(id: number): Promise<void> {
    await apiClient.delete(`/bulk-sms/campaigns/${id}`);
  }

  async getRecipients(
    id: number,
    params: { page?: number; limit?: number } = {}
  ): Promise<PaginatedBulkSmsRecipients> {
    const response = await apiClient.get<
      ApiResponse<BulkSmsRecipient[]> & {
        meta: { total: number; page: number; limit: number; totalPages: number };
      }
    >(`/bulk-sms/campaigns/${id}/recipients`, {
      params: { page: params.page || 1, limit: params.limit || 50 },
    });
    const limit = response.meta?.limit || params.limit || 50;
    const total = response.meta?.total ?? response.data.length;
    return {
      recipients: response.data,
      total,
      page: response.meta?.page || params.page || 1,
      limit,
      totalPages: response.meta?.totalPages || Math.ceil(total / limit),
    };
  }
}

export const bulkSmsCampaignService = new BulkSmsCampaignService();
