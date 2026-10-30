/**
 * WhatsApp Admin API Service
 * Admin configuration, pricing, usage, and template management
 */

import { apiClient } from '../client';
import type { ApiResponse } from '@/lib/types';
import type {
  WaConfig,
  UpdateWaConfigRequest,
  WaPricingConfig,
  UpdateWaPricingRequest,
  WaUsageSummary,
  UserWaUsage,
  WaUsageHistoryEntry,
  WaTemplate,
  CreateWaTemplateRequest,
  EditWaTemplateRequest,
  WaNumber,
} from './whatsapp-types';

// ============================================================
// Config
// ============================================================

export async function getConfig(): Promise<WaConfig | null> {
  const response = await apiClient.get<ApiResponse<WaConfig | null>>('/whatsapp/admin/config');
  return response.data;
}

export async function updateConfig(data: UpdateWaConfigRequest): Promise<WaConfig> {
  const response = await apiClient.put<ApiResponse<WaConfig>>('/whatsapp/admin/config', data);
  return response.data;
}

// ============================================================
// Pricing
// ============================================================

export async function getPricing(): Promise<WaPricingConfig> {
  const response = await apiClient.get<ApiResponse<WaPricingConfig>>('/whatsapp/admin/pricing');
  return response.data;
}

export async function updatePricing(data: UpdateWaPricingRequest): Promise<WaPricingConfig> {
  const response = await apiClient.put<ApiResponse<WaPricingConfig>>(
    '/whatsapp/admin/pricing',
    data
  );
  return response.data;
}

// ============================================================
// Usage
// ============================================================

export async function getUsageSummary(): Promise<WaUsageSummary> {
  const response = await apiClient.get<ApiResponse<WaUsageSummary>>('/whatsapp/admin/usage');
  return response.data;
}

export async function getUserUsageStats(): Promise<UserWaUsage[]> {
  const response = await apiClient.get<ApiResponse<UserWaUsage[]>>('/whatsapp/admin/usage/users');
  return response.data;
}

export async function resetCounters(
  userPhone?: string,
  reason?: string
): Promise<{ resetCount: number }> {
  const response = await apiClient.post<ApiResponse<{ resetCount: number }>>(
    '/whatsapp/admin/reset-counters',
    { userPhone, reason }
  );
  return response.data;
}

export async function getUserHistory(phone: string, limit = 12): Promise<WaUsageHistoryEntry[]> {
  const response = await apiClient.get<ApiResponse<WaUsageHistoryEntry[]>>(
    `/whatsapp/admin/users/${encodeURIComponent(phone)}/history`,
    { params: { limit } }
  );
  return response.data;
}

export async function getUserLimit(phone: string): Promise<number | null> {
  const response = await apiClient.get<ApiResponse<{ phone: string; limit: number | null }>>(
    `/whatsapp/admin/users/${encodeURIComponent(phone)}/limit`
  );
  return response.data.limit;
}

export async function updateUserLimit(phone: string, limit: number | null): Promise<void> {
  await apiClient.put(`/whatsapp/admin/users/${encodeURIComponent(phone)}/limit`, { limit });
}

// ============================================================
// Templates
// ============================================================

export async function getTemplates(): Promise<WaTemplate[]> {
  const response = await apiClient.get<ApiResponse<WaTemplate[]>>('/whatsapp/admin/templates');
  return response.data;
}

export async function refreshTemplates(): Promise<{ count: number; templates: WaTemplate[] }> {
  const response = await apiClient.post<ApiResponse<{ count: number; templates: WaTemplate[] }>>(
    '/whatsapp/admin/templates/refresh'
  );
  return response.data;
}

export async function createTemplate(
  data: CreateWaTemplateRequest
): Promise<Record<string, unknown>> {
  const response = await apiClient.post<ApiResponse<Record<string, unknown>>>(
    '/whatsapp/admin/templates/create',
    data
  );
  return response.data;
}

export async function editTemplate(
  templateId: string,
  data: EditWaTemplateRequest
): Promise<Record<string, unknown>> {
  const response = await apiClient.put<ApiResponse<Record<string, unknown>>>(
    `/whatsapp/admin/templates/${encodeURIComponent(templateId)}`,
    data
  );
  return response.data;
}

export async function deleteTemplate(templateName: string): Promise<Record<string, unknown>> {
  const response = await apiClient.delete<ApiResponse<Record<string, unknown>>>(
    `/whatsapp/admin/templates/${encodeURIComponent(templateName)}`
  );
  return response.data;
}

// ============================================================
// Numbers
// ============================================================

export async function getNumbers(): Promise<WaNumber[]> {
  const response = await apiClient.get<ApiResponse<WaNumber[]>>('/whatsapp/admin/numbers');
  return response.data;
}

export async function syncNumbers(): Promise<{ count: number; numbers: WaNumber[] }> {
  const response = await apiClient.post<ApiResponse<{ count: number; numbers: WaNumber[] }>>(
    '/whatsapp/admin/numbers/sync'
  );
  return response.data;
}

export async function assignNumber(numberId: number, userId: number | null): Promise<void> {
  await apiClient.put(`/whatsapp/admin/numbers/${numberId}/assign`, { userId });
}

// ============================================================
// User WA access
// ============================================================

export async function getUserWaEnabled(userId: number): Promise<boolean> {
  const response = await apiClient.get<ApiResponse<{ userId: number; waEnabled: boolean }>>(
    `/whatsapp/admin/users/${userId}/wa-enabled`
  );
  return response.data.waEnabled;
}

export async function setUserWaEnabled(userId: number, enabled: boolean): Promise<void> {
  await apiClient.put(`/whatsapp/admin/users/${userId}/wa-enabled`, { enabled });
}

// ============================================================
// Billing (per-org): postpaid (unlimited) ↔ prepaid (metered wallet)
// ============================================================

export interface AdminWaBillingAccount {
  mode: 'prepaid' | 'postpaid';
  balance: number;
  balanceMicros: number;
  currency: string;
}

export interface AdminWaLedgerEntry {
  id: number;
  entryType: 'debit' | 'credit' | 'topup' | 'adjustment';
  amountMicros: number;
  balanceAfterMicros: number;
  refType: string | null;
  refId: string | null;
  description: string | null;
  createdAt: string;
}

/** Read an org's WhatsApp billing mode + prepaid balance (admin oversight). */
export async function getOrgBillingAccount(organizationId: number): Promise<AdminWaBillingAccount> {
  const response = await apiClient.get<ApiResponse<AdminWaBillingAccount>>(
    '/whatsapp/admin/billing/account',
    { params: { organizationId } }
  );
  return response.data;
}

/** Switch an org between postpaid (unlimited) and prepaid (metered wallet). */
export async function setOrgBillingMode(
  organizationId: number,
  mode: 'prepaid' | 'postpaid'
): Promise<{ organizationId: number; mode: string }> {
  const response = await apiClient.put<ApiResponse<{ organizationId: number; mode: string }>>(
    '/whatsapp/admin/billing/mode',
    { organizationId, mode }
  );
  return response.data;
}

/** Add prepaid credit to an org's wallet. `amount` is in the wallet currency. */
export async function topUpOrgBalance(
  organizationId: number,
  amount: number,
  description?: string
): Promise<{ balance: number; balanceMicros: number; currency: string }> {
  const response = await apiClient.post<
    ApiResponse<{ balance: number; balanceMicros: number; currency: string }>
  >('/whatsapp/admin/billing/topup', { organizationId, amount, description });
  return response.data;
}

/** Recent wallet entries (top-ups + debits) for an org's audit view. */
export async function getOrgBillingLedger(organizationId: number): Promise<AdminWaLedgerEntry[]> {
  const response = await apiClient.get<ApiResponse<AdminWaLedgerEntry[]>>(
    '/whatsapp/admin/billing/ledger',
    { params: { organizationId } }
  );
  return response.data;
}
