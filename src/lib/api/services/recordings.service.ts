/**
 * Recordings Service
 * API service for call recording operations
 */

import { apiClient, getAuthToken } from '../client';
import type { ApiResponse } from '@/lib/types';

/**
 * Recording metadata - matches backend RecordingMeta (camelCase)
 * @see server/src/modules/recordings/recording.repository.ts
 */
export interface Recording {
  id: string;
  filename: string;
  caller: string;
  callee: string;
  direction: 'inbound' | 'outbound';
  startTime: string;
  duration: number;
  extension: string;
  /** Internal agent's caller-ID name (outbound only; absent on inbound). */
  agentName?: string;
  otherParty: string;
  audioUrl: string;
  filePath: string;
  fileSize: number | null;
}

export interface RecordingParams {
  page?: number;
  limit?: number;
  startDate?: string;
  endDate?: string;
  direction?: 'inbound' | 'outbound';
  search?: string;
  /** Min/max call duration in seconds (inclusive). */
  minDuration?: number;
  maxDuration?: number;
  /** Filter to a single agent (admin_users.id). Org-wide viewers only. */
  agentUserId?: number;
  sortBy?: 'startTime' | 'duration' | 'extension' | 'direction';
  sortOrder?: 'asc' | 'desc';
  /** Super-admin-only organization scope. The backend ignores overrides for other roles. */
  organizationId?: number;
}

/** Async recording-export job lifecycle status (mirrors the backend enum). */
export type RecordingExportStatus =
  | 'pending'
  | 'building'
  | 'ready'
  | 'failed'
  | 'expired'
  | 'cancelled';

/** An async recording-export job (mirror of the backend DTO). */
export interface RecordingExportJob {
  id: string;
  status: RecordingExportStatus;
  manifestCount: number;
  processedCount: number;
  partCount: number;
  artifactBytes: number | null;
  errorCode: string | null;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
}

/** Response from creating an export (may return an existing in-flight job). */
export interface CreateRecordingExportResult {
  jobId: string;
  status: RecordingExportStatus;
  manifestCount: number;
  partCount: number;
  /** True when an in-flight job was returned instead of creating a new one. */
  deduped?: boolean;
}

export interface BulkDeleteResponse {
  message: string;
  successCount: number;
  failCount: number;
  /**
   * True when filter-mode hit FILTER_DELETE_HARD_CAP and there are still
   * matching recordings the request didn't reach. Frontend should warn the
   * user (and can re-issue the request if they confirm).
   */
  truncated?: boolean;
  errors?: Array<{ id: string; error: string }>;
}

/**
 * Filter parameters that can be used to scope a bulk operation across all
 * pages — same shape as `RecordingParams` minus pagination + sort fields.
 *
 * The user's currently-applied filter on the recordings page is sent
 * verbatim. Server re-runs the same query path as the list endpoint, so
 * the set the bulk operation acts on is exactly what the user is seeing
 * (org-scoped via auth middleware).
 */
export interface BulkOperationFilter {
  startDate?: string;
  endDate?: string;
  direction?: 'inbound' | 'outbound';
  search?: string;
  minDuration?: number;
  maxDuration?: number;
}

export type BulkDeleteInput =
  | { mode: 'ids'; ids: string[] }
  | { mode: 'filter'; filter: BulkOperationFilter };

export type BulkDownloadInput =
  | { mode: 'ids'; ids: string[] }
  | { mode: 'filter'; filter: BulkOperationFilter; batch: number };

export type BulkDownloadPlanInput = BulkDeleteInput;

export interface BulkDownloadPlan {
  totalCount: number;
  batchSize: number;
  batchCount: number;
  dateRange: {
    min?: string;
    max?: string;
  };
}

/**
 * Paginated response from recordings API
 * Includes extensionConfigured flag (SSOT) for frontend to display
 * appropriate UI when user has no phone extension assigned.
 */
export interface PaginatedRecordingsResponse {
  recordings: Recording[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  /** True if user has a SIP extension configured, false otherwise (SSOT) */
  extensionConfigured: boolean;
}

export interface RecordingStats {
  total: number;
  inbound: number;
  outbound: number;
  totalDuration: number;
}

/**
 * Recording quota status (per-user)
 */
export interface RecordingQuota {
  userId: number;
  sipUsername: string;
  usedSeconds: number;
  limitSeconds: number;
  usedHours: number;
  limitHours: number;
  usedGB: number;
  limitGB: number;
  percentUsed: number;
  remainingSeconds: number;
  remainingHours: number;
  remainingGB: number;
  canRecord: boolean;
  status: 'ok' | 'warning' | 'exceeded' | 'no_organization';
  extensionConfigured: boolean;
  hasOrganization?: boolean;
}

/**
 * Organization recording quota status
 */
export interface OrganizationQuota {
  organizationId: number;
  organizationName: string;
  userCount: number;
  usedSeconds: number;
  limitSeconds: number;
  usedHours: number;
  limitHours: number;
  usedGB: number;
  limitGB: number;
  remainingSeconds: number;
  remainingHours: number;
  remainingGB: number;
  percentUsed: number;
  status: 'ok' | 'warning' | 'exceeded';
}

/**
 * Response from organizations with quotas endpoint
 */
export interface OrganizationsWithQuotasResponse {
  organizations: OrganizationQuota[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * Helper to build optional organization_id query parameter object for API calls.
 */
function orgParam(organizationId?: number): { org_id: number } | undefined {
  return organizationId ? { org_id: organizationId } : undefined;
}

/**
 * Helper to build optional organization_id URL query string suffix.
 */
function orgQueryString(organizationId?: number): string {
  return organizationId ? `?org_id=${encodeURIComponent(organizationId)}` : '';
}

class RecordingsService {
  /**
   * Get recording stats (total counts and duration)
   */
  async getStats(): Promise<RecordingStats> {
    const response = await apiClient.get<ApiResponse<RecordingStats>>('/recordings/stats');
    return response.data;
  }

  /**
   * Get recording quota status for current user
   * Returns usage, limit, and status (ok/warning/exceeded)
   */
  async getQuota(): Promise<RecordingQuota> {
    const response = await apiClient.get<ApiResponse<RecordingQuota>>('/recordings/quota');
    return response.data;
  }

  /**
   * Get recordings with pagination and sorting
   * Backend returns: { success: true, data: { recordings: [...], total, page, limit, totalPages } }
   */
  async getRecordingsPaginated(params: RecordingParams = {}): Promise<PaginatedRecordingsResponse> {
    const response = await apiClient.get<ApiResponse<PaginatedRecordingsResponse>>('/recordings', {
      params: {
        page: params.page || 1,
        limit: params.limit || 20,
        ...(params.search ? { search: params.search } : {}),
        ...(params.direction ? { direction: params.direction } : {}),
        ...(params.startDate ? { startDate: params.startDate } : {}),
        ...(params.endDate ? { endDate: params.endDate } : {}),
        ...(params.minDuration != null ? { minDuration: params.minDuration } : {}),
        ...(params.maxDuration != null ? { maxDuration: params.maxDuration } : {}),
        ...(params.agentUserId != null ? { agentUserId: params.agentUserId } : {}),
        ...(params.sortBy ? { sortBy: params.sortBy } : {}),
        ...(params.sortOrder ? { sortOrder: params.sortOrder } : {}),
        ...orgParam(params.organizationId),
      },
    });
    return response.data;
  }

  /**
   * Get all recordings (legacy - returns only array)
   * @deprecated Use getRecordingsPaginated instead
   */
  async getRecordings(params?: RecordingParams): Promise<Recording[]> {
    const response = await this.getRecordingsPaginated({ ...params, limit: 1000 });
    return response.recordings;
  }

  /**
   * Get single recording
   */
  async getRecording(id: string, organizationId?: number): Promise<Recording> {
    const response = await apiClient.get<ApiResponse<Recording>>(
      `/recordings/${encodeURIComponent(id)}`,
      { params: orgParam(organizationId) }
    );
    return response.data;
  }

  /**
   * Get recording stream URL (for reference only - use getAudioBlob for playback)
   */
  getStreamUrl(id: string, organizationId?: number): string {
    const suffix = orgQueryString(organizationId);
    return `/recordings/${encodeURIComponent(id)}/stream${suffix}`;
  }

  /**
   * Same-origin URL for PROGRESSIVE `<audio>` playback. Points at the Next proxy
   * — which streams the body and forwards Range — so the browser starts playing
   * after the first buffer instead of downloading the whole file first (the
   * getAudio blob path). Auth uses Bearer-token injection: the token rides as a
   * `?token=` param because `<audio>` can't set an Authorization header; the
   * proxy converts it to a header and strips it before forwarding upstream.
   */
  getPlaybackStreamUrl(id: string, organizationId?: number): string {
    const base = `/api/proxy/recordings/${encodeURIComponent(id)}/stream`;
    const token = getAuthToken();
    const query = new URLSearchParams();
    if (token) query.set('token', token);
    if (organizationId) query.set('org_id', String(organizationId));
    const suffix = query.toString();
    return suffix ? `${base}?${suffix}` : base;
  }

  /**
   * Get recording download URL (for reference only)
   */
  getDownloadUrl(id: string, organizationId?: number): string {
    const suffix = orgQueryString(organizationId);
    return `/recordings/${encodeURIComponent(id)}/download${suffix}`;
  }

  /**
   * Fetch recording audio as blob with authentication
   * Returns an object URL that can be used with Audio element
   */
  async getAudioBlob(id: string, organizationId?: number): Promise<string> {
    const blob = await apiClient.get<Blob>(`/recordings/${encodeURIComponent(id)}/stream`, {
      responseType: 'blob',
      params: orgParam(organizationId),
    });
    return URL.createObjectURL(blob);
  }

  /**
   * Fetch raw audio blob (for manual URL creation)
   */
  async getAudio(id: string, organizationId?: number): Promise<Blob> {
    return await apiClient.get<Blob>(`/recordings/${encodeURIComponent(id)}/stream`, {
      responseType: 'blob',
      params: orgParam(organizationId),
    });
  }

  /**
   * Check if recording file exists
   */
  async checkExists(id: string, organizationId?: number): Promise<boolean> {
    const response = await apiClient.get<ApiResponse<{ exists: boolean }>>(
      `/recordings/${encodeURIComponent(id)}/exists`,
      { params: orgParam(organizationId) }
    );
    return response.data.exists;
  }

  /**
   * Delete a recording
   */
  async deleteRecording(id: string, organizationId?: number): Promise<void> {
    await apiClient.delete(`/recordings/${encodeURIComponent(id)}`, {
      params: orgParam(organizationId),
    });
  }

  /**
   * Bulk download — returns a single ZIP for either an explicit list of
   * recording IDs or one batch of recordings matching a filter.
   *
   * NOTE for browser callers: prefer `getBulkDownloadUrl` below — that
   * issues a one-shot URL the browser can navigate to via `<a href>`,
   * which IDM and other download managers handle natively. This
   * fetch+blob version stays for non-browser callers (curl, tests, the
   * Manager view) where direct response handling is needed.
   *
   * For large filtered sets, callers should first hit `bulkDownloadPlan`
   * to compute the batch count, then call this once per batch
   * (batch=0..batchCount-1) with a small delay between calls so the
   * browser doesn't pop-block sequential downloads.
   */
  async bulkDownload(
    input: BulkDownloadInput,
    organizationId?: number
  ): Promise<{ blob: Blob; filename: string }> {
    const suffix = orgQueryString(organizationId);
    return apiClient.downloadBlob(`/recordings/bulk-download${suffix}`, input);
  }

  /**
   * Mint a short-lived download token and return the relative URL that the
   * browser can navigate to via `<a href>`. The URL routes through the
   * Next.js proxy (which streams the response and forwards
   * Content-Disposition) to GET /bulk-download/dl/:token.
   *
   * Why URL-navigation instead of fetch+blob: download managers like IDM
   * and JDownloader hook into the browser's download flow. With a fetch+
   * blob path, IDM consumes the response body and leaves the JS with
   * size: 0 (false-failure toast). Navigation via `<a href>` lets IDM
   * intercept naturally and the JS doesn't see the body at all.
   *
   * The token expires after 120s. It remains replayable during that short
   * window because download managers may cancel the browser request and issue
   * their own request (or Range retry) for the same URL.
   */
  async getBulkDownloadUrl(
    input: BulkDownloadInput,
    organizationId?: number
  ): Promise<string> {
    const response = await apiClient.post<ApiResponse<{ token: string; expiresInSeconds: number }>>(
      '/recordings/bulk-download/token',
      input,
      { params: orgParam(organizationId) }
    );
    // Relative path via Next.js proxy — same origin as the page so IDM
    // and other download managers see it as a normal in-app download.
    return `/api/proxy/recordings/bulk-download/dl/${response.data.token}`;
  }

  /**
   * Compute the batch plan for a "download all matching filter" operation
   * (Vonage-style). Frontend uses this to confirm with the user — "X
   * recordings → Y ZIPs of Z each" — before triggering the actual
   * sequential downloads.
   */
  async bulkDownloadPlan(
    input: BulkDownloadPlanInput,
    organizationId?: number
  ): Promise<BulkDownloadPlan> {
    const response = await apiClient.post<ApiResponse<BulkDownloadPlan>>(
      '/recordings/bulk-download/plan',
      input,
      { params: orgParam(organizationId) }
    );
    return response.data;
  }

  // ===========================================================================
  // Async server-side export (RECORDING-EXPORT-SCOPE.md) — the resumable,
  // session-proof replacement for the 262-part in-browser bulk download.
  // ===========================================================================

  /** Create an async export job for the "all matching" filter set. */
  async createExport(filter: BulkOperationFilter): Promise<CreateRecordingExportResult> {
    const response = await apiClient.post<ApiResponse<CreateRecordingExportResult>>(
      '/recordings/exports',
      { mode: 'filter', filter }
    );
    return response.data;
  }

  /** Fetch one export job's status/progress. */
  async getExport(id: string): Promise<RecordingExportJob> {
    const response = await apiClient.get<ApiResponse<RecordingExportJob>>(
      `/recordings/exports/${encodeURIComponent(id)}`
    );
    return response.data;
  }

  /** List the current user's recent export jobs. */
  async listExports(): Promise<RecordingExportJob[]> {
    const response = await apiClient.get<ApiResponse<RecordingExportJob[]>>('/recordings/exports');
    return response.data;
  }

  /** Cancel a pending/building export. */
  async cancelExport(id: string): Promise<void> {
    await apiClient.post(`/recordings/exports/${encodeURIComponent(id)}/cancel`, {});
  }

  /**
   * Mint a one-shot token for a given ZIP PART (1-based; defaults to part 1) and
   * return the relative URL the browser navigates to. Same proxy pattern as
   * `getBulkDownloadUrl` — a plain <a href>/navigation the browser + download
   * managers handle natively, and the download resumes (HTTP Range) if the
   * connection drops. A multi-part export calls this once per part.
   */
  async getExportDownloadUrl(id: string, part = 1): Promise<string> {
    const response = await apiClient.post<ApiResponse<{ token: string; expiresInSeconds: number }>>(
      `/recordings/exports/${encodeURIComponent(id)}/download-token?part=${encodeURIComponent(part)}`,
      {}
    );
    return `/api/proxy/recordings/exports/dl/${response.data.token}`;
  }

  /**
   * Bulk delete — explicit ids OR every recording matching a filter.
   *
   * Filter-mode response includes `truncated: true` when more recordings
   * matched than a single request can safely process; frontend can warn
   * the user and re-issue if they confirm.
   */
  async bulkDelete(input: BulkDeleteInput, organizationId?: number): Promise<BulkDeleteResponse> {
    const response = await apiClient.post<ApiResponse<BulkDeleteResponse>>(
      '/recordings/bulk-delete',
      input,
      {
        timeout: 0,
        params: orgParam(organizationId),
      } // large batch delete — never abort mid-flight
    );
    return response.data;
  }

  /**
   * Download a single recording file
   * Returns the blob with the recording audio
   */
  async downloadRecording(id: string, organizationId?: number): Promise<Blob> {
    return await apiClient.get<Blob>(`/recordings/${encodeURIComponent(id)}/download`, {
      responseType: 'blob',
      params: orgParam(organizationId),
    });
  }

  // ============================================================
  // Organization Quota Methods
  // ============================================================

  /**
   * Get organization recording quota (for managers)
   * Returns the quota status for the current user's organization
   */
  async getOrganizationQuota(organizationId?: number): Promise<OrganizationQuota> {
    const response = await apiClient.get<ApiResponse<OrganizationQuota>>('/recordings/org-quota', {
      params: orgParam(organizationId),
    });
    return response.data;
  }

  /**
   * Get all organizations with their quota status (admin only)
   */
  async getOrganizationsWithQuotas(params?: {
    page?: number;
    limit?: number;
    search?: string;
  }): Promise<OrganizationsWithQuotasResponse> {
    const response = await apiClient.get<ApiResponse<OrganizationsWithQuotasResponse>>(
      '/recordings/admin/org-quotas',
      { params }
    );
    return response.data;
  }

  /**
   * Update organization recording quota limit (admin only)
   */
  async updateOrganizationQuota(organizationId: number, limitGB: number): Promise<void> {
    await apiClient.put(`/recordings/admin/org-quotas/${organizationId}`, { limitGB });
  }
}

export const recordingsService = new RecordingsService();
