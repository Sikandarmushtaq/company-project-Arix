/**
 * CRM Webhook Service — admin config for the outbound CRM webhook.
 *
 * @module lib/api/services/crm-webhook.service
 */

import { apiClient } from '../client';
import type { ApiResponse } from '@/lib/types';

export interface CrmWebhookConfig {
  endpointUrl: string;
  enabled: boolean;
  flaggedOnly: boolean;
  /** Whether a signing secret is set (the raw secret is never returned). */
  hasSecret: boolean;
  updatedAt: string | null;
  /** Non-secret display prefix of the pull-API key (null if none). */
  apiKeyPrefix: string | null;
  hasApiKey: boolean;
}

export interface GeneratedApiKey {
  apiKey: string;
  apiKeyPrefix: string;
}

export interface SaveCrmWebhookInput {
  endpointUrl: string;
  /** Omit/blank to keep the existing secret. */
  signingSecret?: string;
  enabled: boolean;
  flaggedOnly: boolean;
}

class CrmWebhookService {
  /** The org's config (null if never set). Owner/admin only. */
  async getConfig(): Promise<CrmWebhookConfig | null> {
    const res = await apiClient.get<ApiResponse<CrmWebhookConfig | null>>('/crm-webhook/config');
    return res.data;
  }

  /** Create/update the org's config. Owner/admin only. */
  async saveConfig(input: SaveCrmWebhookInput): Promise<CrmWebhookConfig> {
    const res = await apiClient.put<ApiResponse<CrmWebhookConfig>>('/crm-webhook/config', input);
    return res.data;
  }

  /** Generate/rotate the pull-API key. The raw key is returned ONCE. */
  async generateApiKey(): Promise<GeneratedApiKey> {
    const res = await apiClient.post<ApiResponse<GeneratedApiKey>>('/crm-webhook/api-key', {});
    return res.data;
  }
}

export const crmWebhookService = new CrmWebhookService();
