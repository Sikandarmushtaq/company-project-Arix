/**
 * Add-on purchases API — in-app number / SMS-package buys for card-less orgs,
 * plus the platform-admin approval queue.
 *
 * @module lib/api/services/addon.service
 */

import { apiClient } from '../client';

export type AddonType = 'number' | 'sms_package';
export type AddonRequestStatus = 'pending' | 'approved' | 'rejected' | 'failed';

export interface AddonInput {
  addonType: AddonType;
  phoneNumber?: string;
  countryCode?: string;
  numberType?: 'local' | 'toll_free' | 'national';
  bundleSlug?: string;
}

export interface AddonPurchaseRequest {
  id: number;
  organizationId: number;
  organizationName?: string | null;
  requestedBy: number | null;
  requestedByName?: string | null;
  addonType: AddonType;
  phoneNumber: string | null;
  countryCode: string | null;
  numberType: string | null;
  bundleSlug: string | null;
  amountCents: number;
  currency: string;
  status: AddonRequestStatus;
  reviewedBy: number | null;
  reviewedAt: string | null;
  reviewNotes: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
  proofUrl?: string | null;
}

export interface AddonRequestsResponse {
  success: boolean;
  data: AddonPurchaseRequest[];
  meta?: { total: number; page: number; totalPages: number };
}

class AddonApiService {
  // --- Owner ---------------------------------------------------------------
  async getUploadUrl(file: {
    name: string;
    contentType: string;
    size: number;
  }): Promise<{ success: boolean; data: { uploadUrl: string; key: string } }> {
    return apiClient.post('/org/addons/upload-url', file);
  }

  async submitBankTransfer(
    input: AddonInput,
    proofKey: string
  ): Promise<{ success: boolean; data: { id: number } }> {
    return apiClient.post('/org/addons/bank-transfer', { ...input, proofKey });
  }

  async cardCheckout(input: AddonInput): Promise<{ success: boolean; data: { checkoutUrl: string } }> {
    return apiClient.post('/org/addons/card-checkout', input);
  }

  async myRequests(): Promise<AddonRequestsResponse> {
    return apiClient.get('/org/addons/requests');
  }

  // --- Admin ---------------------------------------------------------------
  async adminList(params?: {
    status?: string;
    page?: number;
    limit?: number;
  }): Promise<AddonRequestsResponse> {
    return apiClient.get('/admin/addon-requests', {
      params: params as Record<string, string | number | boolean | undefined>,
    });
  }

  async adminPendingCount(): Promise<{ success: boolean; data: { count: number } }> {
    return apiClient.get('/admin/addon-requests/pending-count');
  }

  async adminApprove(id: number): Promise<{ success: boolean }> {
    return apiClient.post(`/admin/addon-requests/${id}/approve`, {});
  }

  async adminReject(id: number, notes?: string): Promise<{ success: boolean }> {
    return apiClient.post(`/admin/addon-requests/${id}/reject`, { notes });
  }
}

export const addonApiService = new AddonApiService();
