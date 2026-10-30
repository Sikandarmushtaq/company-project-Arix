/**
 * Voicemail Service
 * API service for voicemail operations
 */

import { apiClient } from '../client';
import type { ApiResponse } from '@/lib/types';

/**
 * Voicemail - matches backend Voicemail (camelCase)
 * @see server/src/modules/voicemail/voicemail.repository.ts
 */
export interface Voicemail {
  id: string;
  extension: string;
  callerIdNum: string;
  callerIdName: string;
  origTime: number;
  duration: number;
  folder: string;
  read: boolean;
  audioUrl: string;
  transcription?: string;
}

/**
 * Voicemail counts - matches backend getCounts response
 * @see server/src/modules/voicemail/voicemail.repository.ts
 */
export interface VoicemailCounts {
  total: number;
  unread: number;
}

/**
 * Voicemail query parameters
 */
export interface VoicemailQueryParams {
  page?: number;
  limit?: number;
  folder?: string;
  search?: string;
  startDate?: string;
  endDate?: string;
  unreadOnly?: boolean;
}

/**
 * Paginated voicemail response
 */
export interface PaginatedVoicemailResponse {
  voicemails: Voicemail[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  extensionConfigured?: boolean;
}

class VoicemailService {
  /**
   * Get voicemails with pagination
   * Backend returns: { success: true, data: { voicemails: [...], total, page, limit, totalPages } }
   * Falls back to wrapping array response if backend doesn't support pagination
   */
  async getVoicemailsPaginated(
    params: VoicemailQueryParams = {}
  ): Promise<PaginatedVoicemailResponse> {
    const response = await apiClient.get<ApiResponse<Voicemail[] | PaginatedVoicemailResponse>>(
      '/voicemail',
      {
        params: {
          page: params.page || 1,
          limit: params.limit || 20,
          ...(params.folder ? { folder: params.folder } : {}),
          ...(params.search ? { search: params.search } : {}),
          ...(params.startDate ? { startDate: params.startDate } : {}),
          ...(params.endDate ? { endDate: params.endDate } : {}),
          ...(params.unreadOnly ? { unreadOnly: 'true' } : {}),
        },
      }
    );

    // Handle both paginated and array responses from backend
    if (Array.isArray(response.data)) {
      // Backend returns array - wrap in paginated format
      const voicemails = response.data;
      const page = params.page || 1;
      const limit = params.limit || 20;
      const start = (page - 1) * limit;
      const paginatedVoicemails = voicemails.slice(start, start + limit);
      return {
        voicemails: paginatedVoicemails,
        total: voicemails.length,
        page,
        limit,
        totalPages: Math.ceil(voicemails.length / limit),
      };
    }

    return response.data;
  }

  /**
   * Get all voicemails (legacy - no pagination)
   * Backend returns: { success: true, data: Voicemail[] }
   * @param folder - Optional folder filter ('INBOX' or 'Old')
   * @deprecated Use getVoicemailsPaginated instead
   */
  async getVoicemails(folder?: string): Promise<Voicemail[]> {
    const response = await apiClient.get<ApiResponse<Voicemail[]>>('/voicemail', {
      params: folder ? { folder } : undefined,
    });
    return response.data;
  }

  /**
   * Get voicemail counts
   * Backend returns: { success: true, data: { total, unread } }
   */
  async getCounts(): Promise<VoicemailCounts> {
    const response = await apiClient.get<ApiResponse<VoicemailCounts>>('/voicemail/counts');
    return response.data;
  }

  /**
   * Get unread voicemail count
   * Backend returns: { success: true, data: { unreadCount: number } }
   */
  async getUnreadCount(): Promise<number> {
    const response =
      await apiClient.get<ApiResponse<{ unreadCount: number }>>('/voicemail/unread-count');
    return response.data.unreadCount;
  }

  /**
   * Get single voicemail
   * Backend returns: { success: true, data: Voicemail }
   */
  async getVoicemail(extension: string, msgId: string): Promise<Voicemail> {
    const response = await apiClient.get<ApiResponse<Voicemail>>(
      `/voicemail/${extension}/${msgId}`
    );
    return response.data;
  }

  /**
   * Get voicemail audio URL (for reference only - use getAudioBlob for playback)
   * Backend endpoint: GET /api/v1/voicemail/:extension/:msgId/audio
   */
  getAudioUrl(extension: string, msgId: string): string {
    return `/voicemail/${extension}/${msgId}/audio`;
  }

  /**
   * Fetch voicemail audio as blob with authentication
   * Returns an object URL that can be used with Audio element
   */
  async getAudioBlob(extension: string, msgId: string): Promise<string> {
    const blob = await apiClient.get<Blob>(`/voicemail/${extension}/${msgId}/audio`, {
      responseType: 'blob',
    });
    return URL.createObjectURL(blob);
  }

  /**
   * Fetch raw audio blob (for manual URL creation)
   */
  async getAudio(extension: string, msgId: string): Promise<Blob> {
    return await apiClient.get<Blob>(`/voicemail/${extension}/${msgId}/audio?download=1`, {
      responseType: 'blob',
    });
  }

  /**
   * Mark voicemail as read
   */
  async markAsRead(extension: string, msgId: string): Promise<void> {
    await apiClient.post(`/voicemail/${extension}/${msgId}/read`);
  }

  /**
   * Mark all voicemails as read
   * Backend returns: { success: true, data: { markedCount: number } }
   */
  async markAllAsRead(): Promise<number> {
    const response = await apiClient.post<ApiResponse<{ markedCount: number }>>(
      '/voicemail/mark-all-read'
    );
    return response.data.markedCount;
  }

  /**
   * Delete a voicemail
   */
  async deleteVoicemail(extension: string, msgId: string): Promise<void> {
    await apiClient.delete(`/voicemail/${extension}/${msgId}`);
  }

  /**
   * Delete multiple voicemails
   * Backend expects: { ids: [{ extension, msgId }] } in body
   * Backend returns: { success: true, data: { deletedCount: number } }
   */
  async deleteVoicemails(ids: Array<{ extension: string; msgId: string }>): Promise<number> {
    const response = await apiClient.delete<ApiResponse<{ deletedCount: number }>>('/voicemail', {
      data: { ids },
    });
    return response.data.deletedCount;
  }
}

export const voicemailService = new VoicemailService();
