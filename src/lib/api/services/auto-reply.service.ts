/**
 * Per-number SMS Auto-Reply Service
 *
 * API client for inbound auto-reply, missed-call text-back, and after-hours/away
 * settings on a single owned number.
 *
 * @see server/src/modules/auto-reply/auto-reply.repository.ts
 */

import { apiClient } from '../client';
import type { ApiResponse } from '@/lib/types';

/** day: 1=Sun … 7=Sat; start/end "HH:MM" 24h in `timezone`. */
export interface BusinessHoursInterval {
  day: number;
  start: string;
  end: string;
}

export interface AutoReplySettings {
  id: number;
  organizationId: number | null;
  phoneNumber: string;
  inboundReplyEnabled: boolean;
  inboundReplyMessage: string | null;
  missedCallTextEnabled: boolean;
  missedCallMessage: string | null;
  awayEnabled: boolean;
  awayMessage: string | null;
  businessHours: BusinessHoursInterval[] | null;
  timezone: string | null;
  cooldownMinutes: number;
  updatedBy: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface UpsertAutoReplyRequest {
  inboundReplyEnabled?: boolean;
  inboundReplyMessage?: string | null;
  missedCallTextEnabled?: boolean;
  missedCallMessage?: string | null;
  awayEnabled?: boolean;
  awayMessage?: string | null;
  businessHours?: BusinessHoursInterval[] | null;
  timezone?: string | null;
  cooldownMinutes?: number;
}

class AutoReplyService {
  async get(phone: string): Promise<AutoReplySettings | null> {
    const res = await apiClient.get<ApiResponse<AutoReplySettings | null>>(
      `/auto-reply/${encodeURIComponent(phone)}`
    );
    return res.data;
  }

  async upsert(phone: string, data: UpsertAutoReplyRequest): Promise<AutoReplySettings> {
    const res = await apiClient.patch<ApiResponse<AutoReplySettings>>(
      `/auto-reply/${encodeURIComponent(phone)}`,
      data
    );
    return res.data;
  }
}

export const autoReplyService = new AutoReplyService();
