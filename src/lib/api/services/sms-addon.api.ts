import { apiClient } from '../client';
import type { ApiResponse } from '@/lib/types';

export interface OrgSmsAddon {
  id: number;
  organizationId: number;
  name: string;
  smsCount: number;
  priceCents: number;
  isRecurring: boolean;
  status: 'active' | 'expired' | 'canceled';
  periodStart: string;
  periodEnd: string;
  notes: string | null;
  createdBy: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface SmsAddonSummary {
  addons: OrgSmsAddon[];
  activeSmsTotal: number;
  activeRecurringMonthlyCents: number;
}

export interface GrantSmsAddonInput {
  smsCount: number;
  priceCents: number;
  isRecurring: boolean;
  name?: string;
  notes?: string;
}

export const smsAddonApi = {
  async list(orgId: number): Promise<SmsAddonSummary> {
    const res = await apiClient.get<ApiResponse<SmsAddonSummary>>(
      `/admin/organizations/${orgId}/sms-addons`
    );
    return res.data;
  },

  async grant(orgId: number, input: GrantSmsAddonInput): Promise<OrgSmsAddon> {
    const res = await apiClient.post<ApiResponse<OrgSmsAddon>>(
      `/admin/organizations/${orgId}/sms-addons`,
      input
    );
    return res.data;
  },

  async cancel(orgId: number, addonId: number): Promise<void> {
    await apiClient.delete<ApiResponse<null>>(
      `/admin/organizations/${orgId}/sms-addons/${addonId}`
    );
  },
};
