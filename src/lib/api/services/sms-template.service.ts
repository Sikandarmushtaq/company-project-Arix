/**
 * Saved SMS Templates Service
 *
 * API client for the per-org reusable SMS message library (canned templates),
 * shared by the Auto-SMS composer, drip steps, and auto-replies.
 *
 * @see server/src/modules/sms-templates/sms-templates.repository.ts
 */

import { apiClient } from '../client';
import type { ApiResponse } from '@/lib/types';

/** A saved SMS template (dates are ISO strings over the wire). */
export interface SmsTemplate {
  id: number;
  organizationId: number | null;
  name: string;
  body: string;
  createdBy: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSmsTemplateRequest {
  name: string;
  body: string;
}

export interface UpdateSmsTemplateRequest {
  name?: string;
  body?: string;
}

class SmsTemplateService {
  async list(): Promise<SmsTemplate[]> {
    const res = await apiClient.get<ApiResponse<SmsTemplate[]>>('/sms-templates');
    return res.data;
  }

  async create(data: CreateSmsTemplateRequest): Promise<SmsTemplate> {
    const res = await apiClient.post<ApiResponse<SmsTemplate>>('/sms-templates', data);
    return res.data;
  }

  async update(id: number, data: UpdateSmsTemplateRequest): Promise<SmsTemplate> {
    const res = await apiClient.put<ApiResponse<SmsTemplate>>(`/sms-templates/${id}`, data);
    return res.data;
  }

  async remove(id: number): Promise<void> {
    await apiClient.delete(`/sms-templates/${id}`);
  }
}

export const smsTemplateService = new SmsTemplateService();
