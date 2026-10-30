/**
 * WhatsApp Calling API Service
 *
 * Client methods for WhatsApp calling endpoints.
 *
 * @module lib/api/services/waCall
 */

import { apiClient } from '../client';
import type { ApiResponse } from '@/lib/types';
import type { WaCallPermission, WaCallRecord } from '@/lib/whatsapp-call/types';

export const waCallService = {
  /** Agent answers incoming WhatsApp call with SDP answer */
  async answerCall(callId: string, sdpAnswer: string): Promise<void> {
    await apiClient.post(`/whatsapp/calls/${callId}/answer`, { sdpAnswer });
  },

  /** Agent rejects incoming WhatsApp call */
  async rejectCall(callId: string): Promise<void> {
    await apiClient.post(`/whatsapp/calls/${callId}/reject`);
  },

  /** Agent ends active WhatsApp call */
  async endCall(callId: string): Promise<void> {
    await apiClient.post(`/whatsapp/calls/${callId}/end`);
  },

  /**
   * Tell the backend that real audio just started flowing on an outbound call
   * — i.e. the customer actually picked up. Backend stamps `audio_started_at`
   * so the call_log duration is computed from real-pickup, not from Meta's
   * signaling-level `connect` (which fires while the customer's phone is
   * still ringing). Idempotent server-side; safe to swallow errors here.
   */
  async markAudioStarted(callId: string): Promise<void> {
    await apiClient.post(`/whatsapp/calls/${callId}/audio-started`);
  },

  /** Request outbound call permission from customer */
  async requestPermission(
    phoneNumberId: string | undefined,
    customerNumber: string
  ): Promise<WaCallPermission> {
    const body: Record<string, string> = { customerNumber };
    if (phoneNumberId) body.phoneNumberId = phoneNumberId;
    const resp = await apiClient.post<ApiResponse<WaCallPermission>>(
      '/whatsapp/calls/request-permission',
      body
    );
    return resp.data;
  },

  /**
   * Pre-call check — can this agent's org place a WhatsApp call right now?
   * Lets the UI refuse (with a reason) BEFORE prompting for the mic or
   * starting WebRTC. Currently gates on prepaid credit.
   */
  async preflight(): Promise<{ canCall: boolean; reason?: string }> {
    const resp = await apiClient.get<ApiResponse<{ canCall: boolean; reason?: string }>>(
      '/whatsapp/calls/preflight'
    );
    return resp.data;
  },

  /** Initiate outbound WhatsApp call */
  async initiateCall(
    phoneNumberId: string | undefined,
    customerNumber: string,
    sdpOffer: string
  ): Promise<{ callId: string }> {
    const body: Record<string, string> = { customerNumber, sdpOffer };
    if (phoneNumberId) body.phoneNumberId = phoneNumberId;
    const resp = await apiClient.post<ApiResponse<{ callId: string }>>(
      '/whatsapp/calls/initiate',
      body
    );
    return resp.data;
  },

  /** Get call stats (total, inbound, outbound, missed) across ALL calls */
  async getStats(): Promise<{ total: number; inbound: number; outbound: number; missed: number }> {
    const resp =
      await apiClient.get<
        ApiResponse<{ total: number; inbound: number; outbound: number; missed: number }>
      >('/whatsapp/calls/stats');
    return resp.data;
  },

  /** Get call history */
  async getHistory(limit = 50, offset = 0): Promise<{ calls: WaCallRecord[]; total: number }> {
    const resp = await apiClient.get<ApiResponse<{ calls: WaCallRecord[]; total: number }>>(
      '/whatsapp/calls/history',
      { params: { limit, offset } }
    );
    return resp.data;
  },

  /**
   * Upload call recording via presigned URL (direct browser → DO Spaces).
   *
   * Flow:
   * 1. POST /presign → get presigned PUT URL + object key (small JSON, goes through proxy)
   * 2. PUT blob directly to DO Spaces using presigned URL (no proxy, no size limit)
   * 3. POST /confirm → tell backend the upload is done (small JSON, goes through proxy)
   */
  async uploadRecording(callId: string, audioBlob: Blob): Promise<void> {
    // Step 1: Get presigned upload URL
    const presignResp = await apiClient.post<ApiResponse<{ uploadUrl: string; objectKey: string }>>(
      `/whatsapp/calls/${callId}/recording/presign`
    );
    const { uploadUrl, objectKey } = presignResp.data;

    // Step 2: Upload directly to DO Spaces (no proxy, no size limit)
    const uploadResp = await fetch(uploadUrl, {
      method: 'PUT',
      body: audioBlob,
      headers: { 'Content-Type': 'audio/webm' },
    });
    if (!uploadResp.ok) {
      throw new Error(`Direct upload failed: ${uploadResp.status}`);
    }

    // Step 3: Confirm upload with backend
    await apiClient.post(`/whatsapp/calls/${callId}/recording/confirm`, {
      objectKey,
      sizeBytes: audioBlob.size,
    });
  },

  /** Get signed URL for call recording */
  async getRecordingUrl(callId: string): Promise<string | null> {
    const resp = await apiClient.get<ApiResponse<{ url: string | null }>>('/whatsapp/calls/audio', {
      params: { callId },
    });
    return resp.data?.url ?? null;
  },

  /** Download recording as blob (proxied through backend to avoid CORS) */
  async downloadRecording(callId: string): Promise<Blob> {
    return apiClient.get<Blob>('/whatsapp/calls/audio', {
      params: { callId, download: '1' },
      responseType: 'blob',
    });
  },

  /** Delete a call recording */
  async deleteRecording(callId: string): Promise<void> {
    await apiClient.delete(`/whatsapp/calls/${callId}/recording`);
  },

  /**
   * Bulk-delete recordings (manager-only).
   *
   * Two modes:
   *   - 'ids'    → explicit set of selected callIds
   *   - 'filter' → every recording matching the current filter (server enumerates,
   *                org-scoped, hard cap of 500). Used by the "Select all N matching"
   *                Gmail-style affordance.
   *
   * Clears `recording_url` and removes the underlying DO Spaces objects.
   * Server is idempotent — re-deleting an already-cleared recording counts
   * as success.
   */
  async bulkDeleteRecordings(
    input: WaBulkInput
  ): Promise<{ successCount: number; failCount: number; message: string }> {
    const resp = await apiClient.post<
      ApiResponse<{ successCount: number; failCount: number; message: string }>
    >('/whatsapp/admin/calls/bulk-delete', input);
    return resp.data;
  },

  /**
   * Mint a single-use download URL for the selection.
   *
   * Server returns a token; we return the relative GET URL that wraps it
   * — same-origin via the Next.js proxy so download managers (IDM,
   * JDownloader) intercept it as a normal in-app download. The token is
   * Redis-backed with a 120s TTL.
   *
   * Why this two-step dance instead of POST → blob: the latter returns a
   * 0-byte file when routed through Next's proxy (streaming Node ZIPs
   * don't compose with edge-runtime buffering). The token GET sidesteps
   * that entirely — same fix SIP recordings ship with.
   */
  async getBulkDownloadUrl(input: WaBulkInput): Promise<string> {
    const resp = await apiClient.post<ApiResponse<{ token: string; expiresInSeconds: number }>>(
      '/whatsapp/admin/calls/bulk-download/token',
      input
    );
    return `/api/proxy/whatsapp/admin/calls/bulk-download/dl/${resp.data.token}`;
  },

  /** Mark all missed WA calls as read */
  async markMissedAsRead(): Promise<void> {
    await apiClient.post('/whatsapp/calls/mark-read');
  },

  /** Check if active call permission exists for a customer */
  async getPermission(customerNumber: string): Promise<WaCallPermission | null> {
    const resp = await apiClient.get<ApiResponse<WaCallPermission | null>>(
      `/whatsapp/calls/permissions/${customerNumber}`
    );
    return resp.data;
  },

  /**
   * Manager-only: list every WA call in the org with its handling agent.
   * Sticky-resolved at call time so agent identification matches who
   * actually picked up. Server-side enforces adminOrManager role + org
   * isolation; clients cannot scope outside their own org.
   */
  async adminGetCalls(params: {
    page?: number;
    limit?: number;
    search?: string;
    direction?: 'inbound' | 'outbound';
    startDate?: string;
    endDate?: string;
    agentId?: number;
    hasRecording?: boolean;
  }): Promise<{
    calls: AdminWaCall[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const qs: Record<string, string> = {};
    if (params.page) qs.page = String(params.page);
    if (params.limit) qs.limit = String(params.limit);
    if (params.search) qs.search = params.search;
    if (params.direction) qs.direction = params.direction;
    if (params.startDate) qs.startDate = params.startDate;
    if (params.endDate) qs.endDate = params.endDate;
    if (params.agentId) qs.agentId = String(params.agentId);
    if (params.hasRecording !== undefined) qs.hasRecording = String(params.hasRecording);
    const resp = await apiClient.get<
      ApiResponse<{
        calls: AdminWaCall[];
        total: number;
        page: number;
        limit: number;
        totalPages: number;
      }>
    >('/whatsapp/admin/calls', { params: qs });
    return resp.data;
  },
};

/**
 * Filter shape for bulk operations — mirrors the GET /admin/calls query
 * params so "select all matching filter" hits the same row set the user
 * is seeing in the table.
 */
export interface WaBulkFilter {
  direction?: 'inbound' | 'outbound';
  startDate?: string;
  endDate?: string;
  search?: string;
  hasRecording?: boolean;
}

/**
 * Tagged union for bulk-delete / bulk-download / bulk-download/token bodies.
 *   - 'ids' mode: explicit user selection
 *   - 'filter' mode: server enumerates everything matching the filter
 */
export type WaBulkInput =
  | { mode: 'ids'; callIds: string[] }
  | { mode: 'filter'; filter: WaBulkFilter };

/**
 * Admin-view of a WhatsApp call — the regular call record plus the
 * resolved agent identity that handled it. Used only by the manager-only
 * call recordings page (/admin/whatsapp/calls).
 */
export interface AdminWaCall {
  id: number;
  callId: string;
  direction: 'inbound' | 'outbound';
  customerNumber: string;
  customerName: string | null;
  status: string;
  startedAt: string | null;
  answeredAt: string | null;
  endedAt: string | null;
  durationSecs: number;
  recordingUrl: string | null;
  createdAt: string | null;
  /** null only if no agent was assigned at call time (rare). */
  agent: {
    id: number;
    name: string | null;
    email: string | null;
    phone: string | null;
    /** SIP extension — primary identifier for the manager view */
    extension: string | null;
  } | null;
}
