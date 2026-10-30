/**
 * Custom-plan templates API — super-admin reusable saved plans.
 * Served by /api/v1/admin/plan-templates. The dropdown source for the onboarding
 * builder and the change-plan card; also CRUD'd from the Customer Plans page.
 */

import { apiClient } from '../client';
import type { ApiResponse } from '@/lib/types';

export interface PlanTemplate {
  id: number;
  name: string;
  monthlyCents: number;
  seats: number;
  devicesPerUser: number;
  smsAllowance: number;
  includedNumbers: number;
  maxNumbers: number;
  standardSeatPriceCents?: number;
  standardSmsPrice?: string;
  isActive: boolean;
  createdBy: number | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface PlanTemplateInput {
  name: string;
  monthlyCents: number;
  seats: number;
  devicesPerUser: number;
  smsAllowance: number;
  includedNumbers: number;
  maxNumbers: number;
  standardSeatPriceCents?: number;
  standardSmsPrice?: string | number;
}

export const planTemplateApi = {
  async list(includeInactive = false): Promise<PlanTemplate[]> {
    const r = await apiClient.get<ApiResponse<PlanTemplate[]>>(
      `/admin/plan-templates${includeInactive ? '?all=1' : ''}`
    );
    return r.data;
  },
  async create(input: PlanTemplateInput): Promise<PlanTemplate> {
    const r = await apiClient.post<ApiResponse<PlanTemplate>>('/admin/plan-templates', input);
    return r.data;
  },
  async update(id: number, input: PlanTemplateInput): Promise<PlanTemplate> {
    const r = await apiClient.patch<ApiResponse<PlanTemplate>>(`/admin/plan-templates/${id}`, input);
    return r.data;
  },
  /** Archive (active=false) or restore (active=true) — non-destructive. */
  async setActive(id: number, active: boolean): Promise<PlanTemplate> {
    const r = await apiClient.patch<ApiResponse<PlanTemplate>>(
      `/admin/plan-templates/${id}/active`,
      { active }
    );
    return r.data;
  },
  async remove(id: number): Promise<void> {
    await apiClient.delete<ApiResponse<unknown>>(`/admin/plan-templates/${id}`);
  },
};
