/**
 * Media Service
 * API service for media upload operations
 */

import { apiClient } from '../client';
import type { ApiResponse } from '@/lib/types';

export interface UploadedMedia {
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  url: string;
}

export interface UploadResponse {
  files: UploadedMedia[];
  urls: string[];
}

export interface MediaConfig {
  allowedMimeTypes: string[];
  maxFileSize: number;
  maxFiles: number;
}

class MediaService {
  /**
   * Upload one or more media files
   * Uses the upload method which properly handles FormData (no JSON.stringify)
   */
  async upload(files: File[]): Promise<UploadResponse> {
    const formData = new FormData();
    files.forEach((file) => {
      formData.append('files', file);
    });

    // Use the dedicated upload method that handles FormData correctly
    const response = await apiClient.upload<ApiResponse<UploadResponse>>('/media/upload', formData);

    return response.data;
  }

  /**
   * Get upload configuration
   */
  async getConfig(): Promise<MediaConfig> {
    const response = await apiClient.get<ApiResponse<MediaConfig>>('/media/config');
    return response.data;
  }

  /**
   * Delete a media file
   */
  async delete(filename: string): Promise<void> {
    await apiClient.delete(`/media/${filename}`);
  }

  /**
   * Get the URL for a media file
   */
  getMediaUrl(filename: string): string {
    return `/api/v1/media/${filename}`;
  }

  /**
   * Validate files before upload
   */
  validateFiles(
    files: File[],
    config: MediaConfig = {
      allowedMimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
      maxFileSize: 5 * 1024 * 1024, // 5MB
      maxFiles: 10,
    }
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (files.length > config.maxFiles) {
      errors.push(`Maximum ${config.maxFiles} files allowed`);
    }

    for (const file of files) {
      if (!config.allowedMimeTypes.includes(file.type)) {
        errors.push(
          `${file.name}: Invalid file type. Allowed: ${config.allowedMimeTypes.join(', ')}`
        );
      }

      if (file.size > config.maxFileSize) {
        const maxMB = (config.maxFileSize / 1024 / 1024).toFixed(1);
        errors.push(`${file.name}: File too large. Maximum: ${maxMB}MB`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}

export const mediaService = new MediaService();
