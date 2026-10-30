/**
 * Calls Service
 * API service for call-related operations
 */

import { apiClient } from '../client';
import type { ApiResponse } from '@/lib/types';

/**
 * Call record - matches backend CallRecord (camelCase)
 * @see server/src/modules/calls/call.repository.ts
 */
export interface Call {
  id: number;
  caller: string;
  callee: string;
  direction: 'inbound' | 'outbound';
  startTime: string;
  answerTime: string | null;
  endTime: string | null;
  duration: number;
  ringTime: number;
  terminatedBy: string | null;
  reasonCode: string | null;
  reasonText: string | null;
  sessionId: string | null;
  withVideo: boolean;
  status: string;
  sipCallId: string | null;
  createdAt: string;
  read: boolean;
  contactName?: string;
}

export interface CallStats {
  total: number;
  inbound: number;
  outbound: number;
  missed: number;
  avgDuration: number;
}

export interface CallHistoryParams {
  page?: number;
  limit?: number;
  offset?: number;
  direction?: 'inbound' | 'outbound';
  status?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
}

export interface PaginatedCallsResponse {
  calls: Call[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface CreateCallParams {
  callee: string;
  direction: 'inbound' | 'outbound';
  startTime?: string;
  endTime?: string;
  status?: string;
  sessionId?: string;
  sipCallId?: string;
}

export interface UpdateCallParams {
  answerTime?: string;
  endTime?: string;
  duration?: number;
  ringTime?: number;
  status?: string;
  terminatedBy?: string;
  reasonCode?: string;
  reasonText?: string;
}

/**
 * Monitoring session info
 */
export interface MonitoringSession {
  sessionId: string;
  mode: 'monitor' | 'whisper' | 'barge';
  modeDisplayName: string;
  adminName: string;
  startedAt: string;
}

export interface MonitoringStatusResponse {
  isBeingMonitored: boolean;
  sessions: MonitoringSession[];
}

export interface CallPreflight {
  allowed: boolean;
  capped: boolean;
  minutesUsedThisMonth: number;
  minutesPerMonth: number;
  reason?: string;
}

class CallsService {
  /**
   * Outbound-call gate. Uncapped orgs always return allowed=true; unverified
   * reskin orgs return allowed=false once the monthly outbound-minutes cap is hit.
   */
  async getPreflight(): Promise<CallPreflight> {
    // Tight timeout — this gates every metered dial, so on a poor connection it
    // must fail fast (makeCall fails-open on a preflight error) rather than make
    // the caller wait. Well under the client default so a bad link never stalls a call.
    const response = await apiClient.get<ApiResponse<CallPreflight>>('/calls/preflight', {
      timeout: 8000,
    });
    return response.data;
  }

  /**
   * Get call history (simple array for backwards compatibility)
   * Backend returns: { success: true, data: { calls: [...], total, page, limit, totalPages } }
   */
  async getHistory(params?: CallHistoryParams): Promise<Call[]> {
    const response = await apiClient.get<ApiResponse<PaginatedCallsResponse>>('/calls', {
      params: params as Record<string, string | number | boolean | undefined>,
    });
    return response.data.calls;
  }

  /**
   * Get call history with pagination info
   */
  async getHistoryPaginated(params?: CallHistoryParams): Promise<PaginatedCallsResponse> {
    const response = await apiClient.get<ApiResponse<PaginatedCallsResponse>>('/calls', {
      params: params as Record<string, string | number | boolean | undefined>,
    });
    return response.data;
  }

  /**
   * Get call statistics
   */
  async getStats(): Promise<CallStats> {
    const response = await apiClient.get<ApiResponse<CallStats>>('/calls/stats');
    return response.data;
  }

  /**
   * Get unread call count
   * Backend returns: { success: true, data: { unreadCount: number } }
   */
  async getUnreadCount(): Promise<number> {
    const response =
      await apiClient.get<ApiResponse<{ unreadCount: number }>>('/calls/unread-count');
    return response.data.unreadCount;
  }

  /**
   * Get recent unread/missed calls for notifications dropdown
   * Backend returns: { success: true, data: { calls: [...] } }
   */
  async getUnreadCalls(limit: number = 5): Promise<Call[]> {
    const response = await apiClient.get<ApiResponse<{ calls: Call[] }>>('/calls/unread', {
      params: { limit },
    });
    return response.data.calls;
  }

  /**
   * Mark calls as read
   */
  async markAsRead(callIds?: number[]): Promise<void> {
    await apiClient.post('/calls/mark-read', { callIds });
  }

  /**
   * Get single call by ID
   */
  async getCall(id: number): Promise<Call> {
    const response = await apiClient.get<ApiResponse<Call>>(`/calls/${id}`);
    return response.data;
  }

  /**
   * Delete calls
   */
  async deleteCalls(callIds: number[]): Promise<void> {
    await apiClient.delete('/calls', { params: { ids: callIds.join(',') } });
  }

  /**
   * Create a call record (for logging calls from WebRTC client)
   */
  async createCall(params: CreateCallParams): Promise<Call> {
    const response = await apiClient.post<ApiResponse<Call>>('/calls', params);
    return response.data;
  }

  /**
   * Update a call record
   */
  async updateCall(id: number, params: UpdateCallParams): Promise<void> {
    await apiClient.patch(`/calls/${id}`, params);
  }

  /**
   * Get current monitoring status for the authenticated user
   * Used to check if user is being monitored on connect/reconnect
   */
  async getMonitoringStatus(): Promise<MonitoringStatusResponse> {
    const response = await apiClient.get<ApiResponse<MonitoringStatusResponse>>(
      '/calls/monitoring-status'
    );
    return response.data;
  }
}

export const callsService = new CallsService();
