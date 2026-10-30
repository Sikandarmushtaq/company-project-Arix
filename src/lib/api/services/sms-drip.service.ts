/**
 * SMS Drip Sequences Service
 *
 * API client for server-side multi-step SMS drip sequences + enrollments.
 *
 * @see server/src/modules/sms-drip/sms-drip.repository.ts
 */

import { apiClient } from '../client';
import type { ApiResponse } from '@/lib/types';

export type DripEnrollmentStatus = 'active' | 'sending' | 'paused' | 'completed' | 'stopped';

export interface DripStep {
  id?: number;
  stepOrder?: number;
  delayMinutes: number;
  body: string;
}

export interface DripSequence {
  id: number;
  organizationId: number | null;
  name: string;
  fromPhone: string;
  enabled: boolean;
  createdBy: number | null;
  createdAt: string;
  updatedAt: string;
  steps?: DripStep[];
}

export interface DripEnrollment {
  id: number;
  sequenceId: number;
  organizationId: number | null;
  recipientPhone: string;
  contactName: string | null;
  currentStep: number;
  nextRunAt: string | null;
  status: DripEnrollmentStatus;
  enrolledFrom: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateDripSequenceRequest {
  name: string;
  fromPhone: string;
  enabled?: boolean;
  steps: { delayMinutes: number; body: string }[];
}

export type UpdateDripSequenceRequest = Partial<CreateDripSequenceRequest>;

export interface EnrollRequest {
  recipients: { phone: string; name?: string }[];
  enrolledFrom?: string;
}

class SmsDripService {
  async list(): Promise<DripSequence[]> {
    const res = await apiClient.get<ApiResponse<DripSequence[]>>('/sms-drip');
    return res.data;
  }

  async get(id: number): Promise<DripSequence> {
    const res = await apiClient.get<ApiResponse<DripSequence>>(`/sms-drip/${id}`);
    return res.data;
  }

  async create(data: CreateDripSequenceRequest): Promise<DripSequence> {
    const res = await apiClient.post<ApiResponse<DripSequence>>('/sms-drip', data);
    return res.data;
  }

  async update(id: number, data: UpdateDripSequenceRequest): Promise<DripSequence> {
    const res = await apiClient.put<ApiResponse<DripSequence>>(`/sms-drip/${id}`, data);
    return res.data;
  }

  async remove(id: number): Promise<void> {
    await apiClient.delete(`/sms-drip/${id}`);
  }

  async enroll(id: number, data: EnrollRequest): Promise<{ enrolled: number; skipped: number }> {
    const res = await apiClient.post<ApiResponse<{ enrolled: number; skipped: number }>>(
      `/sms-drip/${id}/enroll`,
      data
    );
    return res.data;
  }

  async enrollments(
    id: number,
    params: { status?: DripEnrollmentStatus; page?: number; limit?: number } = {}
  ): Promise<{ enrollments: DripEnrollment[]; total: number }> {
    const res = await apiClient.get<ApiResponse<DripEnrollment[]> & { meta?: { total: number } }>(
      `/sms-drip/${id}/enrollments`,
      {
        params: {
          page: params.page || 1,
          limit: params.limit || 50,
          ...(params.status ? { status: params.status } : {}),
        },
      }
    );
    return { enrollments: res.data, total: res.meta?.total ?? res.data.length };
  }

  async setEnrollmentStatus(enrollmentId: number, status: DripEnrollmentStatus): Promise<void> {
    await apiClient.patch(`/sms-drip/enrollments/${enrollmentId}`, { status });
  }
}

export const smsDripService = new SmsDripService();
