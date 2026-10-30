/**
 * Auth API Service
 * API service for authentication operations
 */

import { apiClient } from '../client';
import type {
  ApiResponse,
  OtpCheckResponse,
  OtpSendResponse,
  OtpVerifyRequest,
  OtpVerifyResponse,
} from '@/lib/types';

/**
 * SIP credentials for WebRTC phone
 *
 * Server configuration comes from System Settings (SSOT).
 * User credentials (username/password) come from user profile.
 *
 * @see server/src/shared/types/user.types.ts - SipCredentials
 */
export interface SipCredentials {
  // User credentials
  username: string;
  password: string;
  displayName: string;

  // Primary server (from System Settings)
  domain: string;
  webSocketUri: string;
  wssServer: string;
  webSocketPort: string;
  webSocketPath: string;

  // Backup server for failover (from System Settings)
  backupWebSocketUri: string | null;
  backupWssServer: string | null;
  backupWebSocketPort: string | null;
  backupWebSocketPath: string | null;
}

/**
 * Audio settings for call audio preferences
 * @see server/src/shared/types/user.types.ts - AudioSettings
 */
export interface AudioSettings {
  enabled: boolean;
  volume: number; // 0-1
  ringtoneEnabled: boolean;
  ringbackEnabled: boolean;
  selectedRingtone: string; // ringtone id
}

class AuthApiService {
  /**
   * Get SIP credentials for WebRTC phone
   */
  async getSipCredentials(): Promise<SipCredentials> {
    const response = await apiClient.get<ApiResponse<SipCredentials>>('/auth/sip-credentials');
    return response.data;
  }

  /**
   * Check if user requires OTP (admin users)
   * Backend returns { success, requiresOtp, message } directly
   */
  async checkOtpRequired(email: string): Promise<OtpCheckResponse> {
    // OTP endpoints return data directly, not wrapped in ApiResponse
    return apiClient.post<OtpCheckResponse>('/auth/otp/check', { email });
  }

  /**
   * Send OTP to admin user's email
   * Backend returns { success, message, remainingAttempts, expiresIn, cooldownRemaining } directly
   */
  async sendOtp(email: string): Promise<OtpSendResponse> {
    return apiClient.post<OtpSendResponse>('/auth/otp/send', { email });
  }

  /**
   * Verify OTP and login admin user
   * Backend returns { success, message, sessionId, user, mustChangePassword } directly
   */
  async verifyOtp(data: OtpVerifyRequest): Promise<OtpVerifyResponse> {
    return apiClient.post<OtpVerifyResponse>('/auth/otp/verify', data);
  }

  /**
   * Get current user's audio settings
   */
  async getAudioSettings(): Promise<AudioSettings> {
    const response = await apiClient.get<ApiResponse<AudioSettings>>('/auth/audio-settings');
    return response.data;
  }

  /**
   * Update current user's audio settings
   */
  async updateAudioSettings(settings: Partial<AudioSettings>): Promise<AudioSettings> {
    const response = await apiClient.put<ApiResponse<AudioSettings>>(
      '/auth/audio-settings',
      settings
    );
    return response.data;
  }

  /**
   * Request password reset email
   * Always returns success to prevent email enumeration
   */
  async forgotPassword(email: string): Promise<{ message: string }> {
    const response = await apiClient.post<ApiResponse<{ message: string }>>(
      '/auth/forgot-password',
      { email }
    );
    return response.data;
  }

  /**
   * Validate password reset token
   */
  async validateResetToken(token: string): Promise<{ valid: boolean; email?: string }> {
    const response = await apiClient.get<ApiResponse<{ valid: boolean; email?: string }>>(
      `/auth/reset-password/validate?token=${encodeURIComponent(token)}`
    );
    return response.data;
  }

  /**
   * Reset password with token
   */
  async resetPassword(token: string, newPassword: string): Promise<{ message: string }> {
    const response = await apiClient.post<ApiResponse<{ message: string }>>(
      '/auth/reset-password',
      { token, newPassword }
    );
    return response.data;
  }

  /**
   * Change the signed-in user's password (requires the current password).
   */
  async changePassword(
    currentPassword: string,
    newPassword: string
  ): Promise<{ message: string }> {
    const response = await apiClient.post<ApiResponse<{ message: string }>>(
      '/auth/change-password',
      { currentPassword, newPassword }
    );
    return response.data;
  }
}

export const authApiService = new AuthApiService();
