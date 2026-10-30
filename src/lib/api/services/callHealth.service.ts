/**
 * Call Health Admin API Service
 *
 * Powers the /admin/call-health dashboard — summary cards, per-user failure
 * table, per-call detail drawer, TURN URL distribution.
 *
 * @module lib/api/services/callHealth
 */

import { apiClient } from '../client';
import type { ApiResponse } from '@/lib/types';

// ============================================================
// Types (mirror server/src/modules/call-telemetry/call-telemetry.types.ts)
// ============================================================

export type IceCandidateType = 'host' | 'srflx' | 'relay' | 'prflx';
export type IceTransportProtocol = 'udp' | 'tcp' | 'tls';
export type IceFinalState = 'connected' | 'failed' | 'disconnected' | 'closed' | 'new';

export interface TurnUrlDistribution {
  turnUrl: string;
  count: number;
  percentagePct: number;
}

export interface CallHealthSummary {
  rangeStart: string;
  rangeEnd: string;
  totalCalls: number;
  successfulCalls: number;
  failedCalls: number;
  unmeasuredCalls: number;
  successRatePct: number;
  avgTimeToConnectedMs: number | null;
  retriedAsRelayCount: number;
  iceRestartedCount: number;
  turnUrlDistribution: TurnUrlDistribution[];
}

export interface UserFailureStat {
  userId: number;
  extension: string | null;
  userName: string | null;
  userEmail: string | null;
  totalCalls: number;
  failedCalls: number;
  failureRatePct: number;
  lastFailureAt: string | null;
}

export interface CallDetail {
  id: number;
  userId: number;
  userName: string | null;
  userEmail: string | null;
  extension: string | null;
  callUuid: string;
  direction: 'inbound' | 'outbound';
  occurredAt: string;
  hadHostCandidate: boolean;
  hadSrflxCandidate: boolean;
  hadRelayCandidate: boolean;
  timeToFirstCandidateMs: number | null;
  selectedLocalType: IceCandidateType | null;
  selectedRemoteType: IceCandidateType | null;
  selectedTurnUrl: string | null;
  selectedProtocol: IceTransportProtocol | null;
  finalIceState: IceFinalState;
  timeToConnectedMs: number | null;
  retriedAsRelay: boolean;
  iceRestarted: boolean;
  hangupReason: string | null;
  packetsReceived: number;
  packetsSent: number;
  clientIp: string | null;
  userAgent: string | null;
  organizationId: number | null;
}

export interface ListCallsResponse {
  calls: CallDetail[];
  total: number;
  limit: number;
  offset: number;
}

// ============================================================
// API methods
// ============================================================

/** Desk-phone (Polycom/Yealink) registration/online status. */
export interface HardphoneStatus {
  extension: string;
  label: string | null;
  vendor: string;
  model: string | null;
  organizationId: number | null;
  online: boolean;
  lastSeenSecondsAgo: number | null;
  expiresInSeconds: number | null;
  ip: string | null;
  userAgent: string | null;
  keepalive: boolean;
}

/** A live desk-phone call (legs already collapsed to one, plumbing hidden). */
export interface HardphoneLiveCall {
  extension: string;
  peer: string;
  direction: 'inbound' | 'outbound';
  state: 'ringing' | 'active';
  durationSeconds: number;
}

export interface HardphoneMonitor {
  phones: HardphoneStatus[];
  liveCalls: HardphoneLiveCall[];
  generatedAt: string;
}

export const callHealthService = {
  async getSummary(hours = 24): Promise<CallHealthSummary> {
    const resp = await apiClient.get<ApiResponse<CallHealthSummary>>('/admin/call-health/summary', {
      params: { hours },
    });
    return resp.data;
  },

  async getUserStats(hours = 24, limit = 50): Promise<UserFailureStat[]> {
    const resp = await apiClient.get<ApiResponse<UserFailureStat[]>>('/admin/call-health/users', {
      params: { hours, limit },
    });
    return resp.data;
  },

  async listCalls(params: {
    userId?: number;
    state?: IceFinalState;
    hours?: number;
    limit?: number;
    offset?: number;
  }): Promise<ListCallsResponse> {
    const resp = await apiClient.get<ApiResponse<ListCallsResponse>>('/admin/call-health/calls', {
      params,
    });
    return resp.data;
  },

  async getCallById(id: number): Promise<CallDetail> {
    const resp = await apiClient.get<ApiResponse<CallDetail>>(`/admin/call-health/calls/${id}`);
    return resp.data;
  },

  async getHardphones(): Promise<HardphoneMonitor> {
    const resp = await apiClient.get<ApiResponse<HardphoneMonitor>>(
      '/admin/call-health/hardphones'
    );
    return resp.data;
  },
};
