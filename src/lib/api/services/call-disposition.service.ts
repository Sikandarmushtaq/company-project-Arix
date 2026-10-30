/**
 * Call Disposition Service
 *
 * Frontend client for the voicemail-QA disposition endpoints
 * (/api/v1/call-dispositions). The agent's post-call outcome picker uses this.
 *
 * @module lib/api/services/call-disposition.service
 */

import { apiClient } from '../client';
import type { ApiResponse } from '@/lib/types';

/** A selectable call outcome (from the server-side catalog). */
export interface DispositionOutcome {
  code: string;
  label: string;
  isVoicemail: boolean;
  isActiveOutcome: boolean;
  sortOrder: number;
}

/** The active voicemail-QA thresholds for the caller's org. */
export interface QaSettings {
  voicemailQaEnabled: boolean;
  voicemailAuditThresholdSecs: number;
  voicemailLockoutThresholdSecs: number;
}

export interface DispositionCatalog {
  outcomes: DispositionOutcome[];
  settings: QaSettings;
}

export interface CallDisposition {
  id: number;
  callRecordId: number;
  organizationId: number | null;
  agentUserId: number;
  outcomeCode: string;
  reason: string | null;
  auditFlag: boolean;
  auditReason: string | null;
  callDurationSecs: number | null;
  source: 'agent' | 'voicemail_drop' | 'system';
  createdAt: string;
  updatedAt: string;
}

export interface SetDispositionRequest {
  outcomeCode: string;
  reason?: string;
  clientDurationSecs?: number;
}

export interface SetDispositionResult {
  disposition: CallDisposition;
  outcome: DispositionOutcome;
}

/** A flagged voicemail row in the audit queue. */
export interface AuditItem {
  id: number;
  callRecordId: number;
  agentUserId: number;
  agentName: string | null;
  agentPhone: string | null;
  outcomeCode: string;
  reason: string | null;
  auditReason: string | null;
  callDurationSecs: number | null;
  caller: string;
  callee: string;
  direction: 'inbound' | 'outbound';
  callStartTime: string | null;
  createdAt: string;
}

export interface AuditQueueResponse {
  items: AuditItem[];
  total: number;
  page: number;
  limit: number;
}

class CallDispositionService {
  /** Outcomes + active QA thresholds for the caller's org. */
  async getCatalog(): Promise<DispositionCatalog> {
    const res = await apiClient.get<ApiResponse<DispositionCatalog>>('/call-dispositions/catalog');
    return res.data;
  }

  /**
   * Record the agent's outcome for a call. The server applies features A + C —
   * a feature-C lockout surfaces as a 4xx (the client shows the message and
   * prompts for a reason / an active outcome).
   */
  async setDisposition(
    callId: number,
    body: SetDispositionRequest
  ): Promise<SetDispositionResult> {
    const res = await apiClient.post<ApiResponse<SetDispositionResult>>(
      `/call-dispositions/${callId}`,
      body
    );
    return res.data;
  }

  /**
   * Feature B — the "Leave Voicemail & Drop" action. Records the voicemail
   * outcome (skips the C lockout, keeps the A audit-flag). `clientDurationSecs`
   * is the live talk-time, used when the call record isn't finalized yet.
   */
  async dropVoicemail(
    callId: number,
    body: { clientDurationSecs?: number } = {}
  ): Promise<SetDispositionResult> {
    const res = await apiClient.post<ApiResponse<SetDispositionResult>>(
      `/call-dispositions/${callId}/voicemail-drop`,
      body
    );
    return res.data;
  }

  /** The effective QA settings for the caller's scope (owner/admin only). */
  async getSettings(): Promise<QaSettings> {
    const res = await apiClient.get<ApiResponse<QaSettings>>('/call-dispositions/settings');
    return res.data;
  }

  /** Save the QA thresholds (owner/admin only). Enable/disable is the tenant module. */
  async saveSettings(input: {
    voicemailAuditThresholdSecs: number;
    voicemailLockoutThresholdSecs: number;
  }): Promise<QaSettings> {
    const res = await apiClient.put<ApiResponse<QaSettings>>('/call-dispositions/settings', input);
    return res.data;
  }

  /** The audit queue — flagged voicemails (manager/owner/admin only). */
  async getAudit(params: { page?: number; limit?: number } = {}): Promise<AuditQueueResponse> {
    const res = await apiClient.get<ApiResponse<AuditQueueResponse>>('/call-dispositions/audit', {
      params: { page: params.page, limit: params.limit },
    });
    return res.data;
  }

  /**
   * All dispositions (superset of the audit queue) with optional outcome +
   * flagged filters (manager/owner/admin only). Rows share the {@link AuditItem}
   * shape — `auditReason` is non-null exactly when the row was flagged.
   */
  async listDispositions(
    params: {
      page?: number;
      limit?: number;
      outcome?: string;
      flagged?: boolean;
      /** ISO 8601 — inclusive lower/upper bound on when the outcome was logged. */
      from?: string;
      to?: string;
      agentUserId?: number;
    } = {}
  ): Promise<AuditQueueResponse> {
    const res = await apiClient.get<ApiResponse<AuditQueueResponse>>('/call-dispositions/list', {
      params: {
        page: params.page,
        limit: params.limit,
        outcome: params.outcome || undefined,
        flagged: params.flagged ? 'true' : undefined,
        from: params.from || undefined,
        to: params.to || undefined,
        agentUserId: params.agentUserId ?? undefined,
      },
    });
    return res.data;
  }
}

export const callDispositionService = new CallDispositionService();
