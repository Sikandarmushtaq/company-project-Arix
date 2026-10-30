/**
 * User Settings Service
 * API service for user settings (DND, Speed Dial)
 */

import { apiClient } from '../client';
import type { ApiResponse } from '@/lib/types';

/**
 * DND Status response
 */
export interface DndStatus {
  enabled: boolean;
  isCurrentlyActive: boolean;
}

/**
 * Speed Dial Entry
 */
export interface SpeedDialEntry {
  id: number;
  userId: number;
  position: number; // 1-9
  phoneNumber: string;
  name: string | null;
  contactId: number | null;
  createdAt: string;
}

/**
 * Set Speed Dial input
 */
export interface SetSpeedDialInput {
  position: number;
  phoneNumber: string;
  name?: string;
  contactId?: number;
}

class UserSettingsService {
  // ============ DND ============

  /**
   * Get DND status
   */
  async getDndStatus(): Promise<DndStatus> {
    const response = await apiClient.get<ApiResponse<DndStatus>>('/user-settings/dnd');
    return response.data;
  }

  /**
   * Toggle DND on/off
   */
  async toggleDnd(enabled: boolean): Promise<DndStatus> {
    const response = await apiClient.post<ApiResponse<DndStatus>>('/user-settings/dnd/toggle', {
      enabled,
    });
    return response.data;
  }

  // ============ Speed Dial ============

  /**
   * Get all speed dial entries
   */
  async getSpeedDial(): Promise<SpeedDialEntry[]> {
    const response = await apiClient.get<ApiResponse<SpeedDialEntry[]>>(
      '/user-settings/speed-dial'
    );
    return response.data;
  }

  /**
   * Get speed dial by position
   */
  async getSpeedDialByPosition(position: number): Promise<SpeedDialEntry | null> {
    const response = await apiClient.get<ApiResponse<SpeedDialEntry | null>>(
      `/user-settings/speed-dial/${position}`
    );
    return response.data;
  }

  /**
   * Set speed dial entry
   */
  async setSpeedDial(data: SetSpeedDialInput): Promise<SpeedDialEntry[]> {
    const response = await apiClient.post<ApiResponse<SpeedDialEntry[]>>(
      '/user-settings/speed-dial',
      data
    );
    return response.data;
  }

  /**
   * Remove speed dial entry
   */
  async removeSpeedDial(position: number): Promise<SpeedDialEntry[]> {
    const response = await apiClient.delete<ApiResponse<SpeedDialEntry[]>>(
      `/user-settings/speed-dial/${position}`
    );
    return response.data;
  }

  /**
   * Clear all speed dial entries
   */
  async clearSpeedDial(): Promise<void> {
    await apiClient.delete('/user-settings/speed-dial');
  }

  // ============ Bulk SMS Settings ============

  /**
   * Update user's bulk SMS interval (when admin allows control)
   */
  async updateBulkSmsInterval(interval: number): Promise<{ interval: number }> {
    const response = await apiClient.put<ApiResponse<{ interval: number }>>(
      '/user-settings/bulk-sms-interval',
      { interval }
    );
    return response.data;
  }
}

export const userSettingsService = new UserSettingsService();
