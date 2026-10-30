/**
 * Auto-Dialer Service
 * API service for auto-dialer campaign operations
 */

import { apiClient } from '../client';
import type { ApiResponse } from '@/lib/types';

/**
 * Campaign status - matches backend CampaignStatus
 * @see server/src/modules/autodialer/autodialer.repository.ts
 */
export type CampaignStatus =
  | 'draft'
  | 'scheduled'
  | 'running'
  | 'paused'
  | 'completed'
  | 'cancelled';

/**
 * Campaign - matches backend Campaign (camelCase)
 * @see server/src/modules/autodialer/autodialer.repository.ts
 */
export interface Campaign {
  id: number;
  userId: string;
  name: string;
  description: string | null;
  status: CampaignStatus;
  callerId: string;
  audioFile: string | null;
  agentId: number | null;
  elevenlabsBatchId: string | null;
  maxConcurrentCalls: number;
  callTimeout: number;
  retryAttempts: number;
  retryDelay: number;
  timezone: string;
  callingHoursStart: string | null;
  callingHoursEnd: string | null;
  scheduledAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// ─── AI Agent Types ──────────────────────────────────────────────────

export type AiAgentStatus = 'draft' | 'active' | 'archived';

export interface AiAgent {
  id: number;
  elevenlabsAgentId: string | null;
  organizationId: number | null;
  createdBy: string;
  name: string;
  voiceId: string;
  voiceName: string | null;
  prompt: string;
  firstMessage: string | null;
  language: string;
  llm: string;
  temperature: number;
  maxTokens: number;
  transferPhone: string | null;
  voicemailMessage: string | null;
  maxDurationSeconds: number;
  status: AiAgentStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAgentRequest {
  name: string;
  voiceId: string;
  voiceName?: string;
  prompt: string;
  firstMessage?: string;
  language?: string;
  llm?: string;
  temperature?: number;
  maxTokens?: number;
  transferPhone?: string;
  voicemailMessage?: string;
  maxDurationSeconds?: number;
}

export interface UpdateAgentRequest extends Partial<CreateAgentRequest> {
  status?: AiAgentStatus;
}

// ─── AI Call Types ───────────────────────────────────────────────────

export type AiCallStatus = 'pending' | 'in_progress' | 'processing' | 'completed' | 'failed';
export type AiCallOutcome =
  | 'answered'
  | 'no_answer'
  | 'busy'
  | 'voicemail'
  | 'transferred'
  | 'failed'
  | 'unknown';

export interface AiCall {
  id: number;
  campaignId: number | null;
  agentId: number;
  organizationId: number | null;
  userId: string;
  elevenlabsConversationId: string | null;
  elevenlabsBatchId: string | null;
  phoneNumber: string;
  status: AiCallStatus;
  outcome: AiCallOutcome | null;
  callSuccessful: boolean | null;
  durationSecs: number;
  costCents: number;
  transcriptSummary: string | null;
  terminationReason: string | null;
  startedAt: string | null;
  endedAt: string | null;
  createdAt: string;
}

export interface AiCallMessage {
  id: number;
  callId: number;
  role: 'agent' | 'user' | 'tool';
  message: string;
  toolCalls: unknown | null;
  toolResults: unknown | null;
  interrupted: boolean;
  timeInCallSecs: number | null;
  createdAt: string;
}

// ─── DNC Types ───────────────────────────────────────────────────────

export type DncSource = 'manual' | 'opt_out' | 'complaint' | 'system';

// ─── Voice Types ─────────────────────────────────────────────────────

export interface AiVoice {
  voiceId: string;
  name: string;
  category: string;
  previewUrl: string | null;
  description: string | null;
  labels: Record<string, string>;
}

export interface DncEntry {
  id: number;
  phoneNumber: string;
  organizationId: number | null;
  reason: string | null;
  source: DncSource;
  addedBy: string;
  createdAt: string;
}

/**
 * Campaign number status - matches backend
 */
export type CampaignNumberStatus =
  | 'pending'
  | 'dialing'
  | 'answered'
  | 'no_answer'
  | 'busy'
  | 'failed'
  | 'completed';

/**
 * Campaign number - matches backend CampaignNumber (camelCase)
 * @see server/src/modules/autodialer/autodialer.repository.ts
 */
export interface CampaignNumber {
  id: number;
  campaignId: number;
  phoneNumber: string;
  status: CampaignNumberStatus;
  attempts: number;
  lastAttemptAt: string | null;
  answeredAt: string | null;
  duration: number;
  createdAt: string;
}

/**
 * Campaign statistics - matches backend CampaignStats
 * @see server/src/modules/autodialer/autodialer.repository.ts
 */
export interface CampaignStats {
  totalNumbers: number;
  pending: number;
  dialing: number;
  answered: number;
  noAnswer: number;
  busy: number;
  failed: number;
  completed: number;
  averageDuration: number;
}

/**
 * Create campaign request - matches backend expectations
 */
export interface CreateCampaignRequest {
  name: string;
  description?: string;
  callerId: string;
  audioFile?: string;
  maxConcurrentCalls?: number;
  callTimeout?: number;
  retryAttempts?: number;
  retryDelay?: number;
  scheduledAt?: string;
  numbers: string[];
}

export interface UpdateCampaignRequest extends Partial<Omit<CreateCampaignRequest, 'numbers'>> {}

/**
 * Campaign query parameters
 */
export interface CampaignQueryParams {
  page?: number;
  limit?: number;
  status?: CampaignStatus;
  search?: string;
}

/**
 * Paginated campaign response
 */
export interface PaginatedCampaignResponse {
  campaigns: Campaign[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

class AutodialerService {
  /**
   * Get campaigns with pagination
   * Backend returns: { success: true, data: Campaign[], meta: { total, page, limit, totalPages } }
   */
  async getCampaignsPaginated(
    params: CampaignQueryParams = {}
  ): Promise<PaginatedCampaignResponse> {
    const response = await apiClient.get<
      ApiResponse<Campaign[]> & {
        meta: { total: number; page: number; limit: number; totalPages: number };
      }
    >('/autodialer/campaigns', {
      params: {
        page: params.page || 1,
        limit: params.limit || 20,
        ...(params.status ? { status: params.status } : {}),
        ...(params.search ? { search: params.search } : {}),
      },
    });
    return {
      campaigns: response.data,
      total: response.meta?.total || response.data.length,
      page: response.meta?.page || params.page || 1,
      limit: response.meta?.limit || params.limit || 20,
      totalPages:
        response.meta?.totalPages ||
        Math.ceil((response.meta?.total || response.data.length) / (params.limit || 20)),
    };
  }

  /**
   * Get all campaigns (legacy - returns only array)
   * @deprecated Use getCampaignsPaginated instead
   */
  async getCampaigns(options?: {
    page?: number;
    limit?: number;
    status?: CampaignStatus;
  }): Promise<{ campaigns: Campaign[]; total: number }> {
    const response = await this.getCampaignsPaginated(options);
    return {
      campaigns: response.campaigns,
      total: response.total,
    };
  }

  /**
   * Get single campaign
   */
  async getCampaign(id: number): Promise<Campaign> {
    const response = await apiClient.get<ApiResponse<Campaign>>(`/autodialer/campaigns/${id}`);
    return response.data;
  }

  /**
   * Create a new campaign
   */
  async createCampaign(data: CreateCampaignRequest): Promise<Campaign> {
    const response = await apiClient.post<ApiResponse<Campaign>>('/autodialer/campaigns', data);
    return response.data;
  }

  /**
   * Update a campaign
   */
  async updateCampaign(id: number, data: UpdateCampaignRequest): Promise<Campaign> {
    const response = await apiClient.put<ApiResponse<Campaign>>(
      `/autodialer/campaigns/${id}`,
      data
    );
    return response.data;
  }

  /**
   * Delete a campaign
   */
  async deleteCampaign(id: number): Promise<void> {
    await apiClient.delete(`/autodialer/campaigns/${id}`);
  }

  /**
   * Start a campaign
   * Backend returns: { success: true, data: Campaign }
   */
  async startCampaign(id: number): Promise<Campaign> {
    const response = await apiClient.post<ApiResponse<Campaign>>(
      `/autodialer/campaigns/${id}/start`
    );
    return response.data;
  }

  /**
   * Stop a campaign
   * Backend returns: { success: true, data: Campaign }
   */
  async stopCampaign(id: number): Promise<Campaign> {
    const response = await apiClient.post<ApiResponse<Campaign>>(
      `/autodialer/campaigns/${id}/stop`
    );
    return response.data;
  }

  /**
   * Pause a campaign
   * Backend returns: { success: true, data: Campaign }
   */
  async pauseCampaign(id: number): Promise<Campaign> {
    const response = await apiClient.post<ApiResponse<Campaign>>(
      `/autodialer/campaigns/${id}/pause`
    );
    return response.data;
  }

  /**
   * Resume a paused campaign
   * Backend returns: { success: true, data: Campaign }
   */
  async resumeCampaign(id: number): Promise<Campaign> {
    const response = await apiClient.post<ApiResponse<Campaign>>(
      `/autodialer/campaigns/${id}/resume`
    );
    return response.data;
  }

  /**
   * Get campaign statistics
   */
  async getCampaignStats(id: number): Promise<CampaignStats> {
    const response = await apiClient.get<ApiResponse<CampaignStats>>(
      `/autodialer/campaigns/${id}/stats`
    );
    return response.data;
  }

  /**
   * Get campaign numbers
   * Backend returns: { success: true, data: CampaignNumber[], meta: { total, page, limit, totalPages } }
   */
  async getCampaignNumbers(
    id: number,
    options?: { page?: number; limit?: number; status?: string }
  ): Promise<{ numbers: CampaignNumber[]; total: number }> {
    const response = await apiClient.get<
      ApiResponse<CampaignNumber[]> & {
        meta: { total: number; page: number; limit: number; totalPages: number };
      }
    >(`/autodialer/campaigns/${id}/numbers`, {
      params: {
        page: options?.page || 1,
        limit: options?.limit || 50,
        status: options?.status,
      },
    });
    return {
      numbers: response.data,
      total: response.meta?.total || response.data.length,
    };
  }

  /**
   * Add numbers to a campaign
   * Backend returns: { success: true, data: { added: number } }
   */
  async addNumbers(id: number, numbers: string[]): Promise<number> {
    const response = await apiClient.post<ApiResponse<{ added: number }>>(
      `/autodialer/campaigns/${id}/numbers`,
      { numbers }
    );
    return response.data.added;
  }

  /**
   * Remove numbers from a campaign
   * Backend expects: { numberIds: number[] } in body
   * Backend returns: { success: true, data: { removed: number } }
   */
  async removeNumbers(id: number, numberIds: number[]): Promise<number> {
    const response = await apiClient.delete<ApiResponse<{ removed: number }>>(
      `/autodialer/campaigns/${id}/numbers`,
      { data: { numberIds } }
    );
    return response.data.removed;
  }
  // ═══════════════════════════════════════════════════════════════════
  //  AI AGENTS
  // ═══════════════════════════════════════════════════════════════════

  async getAgents(params?: { page?: number; limit?: number; status?: AiAgentStatus }): Promise<{
    agents: AiAgent[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const response = await apiClient.get<
      ApiResponse<AiAgent[]> & {
        meta: { total: number; page: number; limit: number; totalPages: number };
      }
    >('/autodialer/agents', {
      params: {
        page: params?.page || 1,
        limit: params?.limit || 20,
        ...(params?.status ? { status: params.status } : {}),
      },
    });
    return {
      agents: response.data,
      total: response.meta?.total || response.data.length,
      page: response.meta?.page || params?.page || 1,
      limit: response.meta?.limit || params?.limit || 20,
      totalPages: response.meta?.totalPages || 1,
    };
  }

  async getAgent(agentId: number): Promise<AiAgent> {
    const response = await apiClient.get<ApiResponse<AiAgent>>(`/autodialer/agents/${agentId}`);
    return response.data;
  }

  async createAgent(data: CreateAgentRequest): Promise<AiAgent> {
    const response = await apiClient.post<ApiResponse<AiAgent>>('/autodialer/agents', data);
    return response.data;
  }

  async updateAgent(agentId: number, data: UpdateAgentRequest): Promise<AiAgent> {
    const response = await apiClient.put<ApiResponse<AiAgent>>(
      `/autodialer/agents/${agentId}`,
      data
    );
    return response.data;
  }

  async deleteAgent(agentId: number): Promise<void> {
    await apiClient.delete(`/autodialer/agents/${agentId}`);
  }

  // ═══════════════════════════════════════════════════════════════════
  //  AI CALLS
  // ═══════════════════════════════════════════════════════════════════

  async getAiCalls(
    campaignId: number,
    params?: { page?: number; limit?: number; status?: AiCallStatus }
  ): Promise<{
    calls: AiCall[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const response = await apiClient.get<
      ApiResponse<AiCall[]> & {
        meta: { total: number; page: number; limit: number; totalPages: number };
      }
    >(`/autodialer/campaigns/${campaignId}/calls`, {
      params: {
        page: params?.page || 1,
        limit: params?.limit || 20,
        ...(params?.status ? { status: params.status } : {}),
      },
    });
    return {
      calls: response.data,
      total: response.meta?.total || response.data.length,
      page: response.meta?.page || params?.page || 1,
      limit: response.meta?.limit || params?.limit || 20,
      totalPages: response.meta?.totalPages || 1,
    };
  }

  async getAiCall(callId: number): Promise<AiCall> {
    const response = await apiClient.get<ApiResponse<AiCall>>(`/autodialer/calls/${callId}`);
    return response.data;
  }

  async getAiCallTranscript(callId: number): Promise<AiCallMessage[]> {
    const response = await apiClient.get<ApiResponse<AiCallMessage[]>>(
      `/autodialer/calls/${callId}/transcript`
    );
    return response.data;
  }

  async syncCampaignResults(campaignId: number): Promise<{ synced: number }> {
    const response = await apiClient.post<ApiResponse<{ synced: number }>>(
      `/autodialer/campaigns/${campaignId}/sync`
    );
    return response.data;
  }

  // ═══════════════════════════════════════════════════════════════════
  //  DNC (Do Not Call)
  // ═══════════════════════════════════════════════════════════════════

  async getDncList(params?: { page?: number; limit?: number; search?: string }): Promise<{
    entries: DncEntry[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const response = await apiClient.get<
      ApiResponse<DncEntry[]> & {
        meta: { total: number; page: number; limit: number; totalPages: number };
      }
    >('/autodialer/dnc', {
      params: {
        page: params?.page || 1,
        limit: params?.limit || 50,
        ...(params?.search ? { search: params.search } : {}),
      },
    });
    return {
      entries: response.data,
      total: response.meta?.total || response.data.length,
      page: response.meta?.page || params?.page || 1,
      limit: response.meta?.limit || params?.limit || 50,
      totalPages: response.meta?.totalPages || 1,
    };
  }

  async addDncEntries(phoneNumbers: string[], reason?: string): Promise<number> {
    const response = await apiClient.post<ApiResponse<{ added: number }>>('/autodialer/dnc', {
      phoneNumbers,
      reason,
    });
    return response.data.added;
  }

  async removeDncEntries(ids: number[]): Promise<number> {
    const response = await apiClient.delete<ApiResponse<{ removed: number }>>('/autodialer/dnc', {
      data: { ids },
    });
    return response.data.removed;
  }

  // ═══════════════════════════════════════════════════════════════════
  //  VOICES
  // ═══════════════════════════════════════════════════════════════════

  async getVoices(): Promise<AiVoice[]> {
    const response = await apiClient.get<ApiResponse<AiVoice[]>>('/autodialer/voices');
    return response.data;
  }

  // ═══════════════════════════════════════════════════════════════════
  //  ADMIN
  // ═══════════════════════════════════════════════════════════════════

  async getElevenLabsPhoneNumbers(): Promise<unknown> {
    const response = await apiClient.get<ApiResponse<unknown>>('/autodialer/admin/phone-numbers');
    return response.data;
  }
}

export const autodialerService = new AutodialerService();
