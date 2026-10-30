/**
 * SMS Usage & Admin Pricing API Service
 * Usage/quota operations and admin pricing management
 */

import { apiClient } from '../client';
import type { ApiResponse } from '@/lib/types';
import type {
  SmsUsage,
  SmsPricingConfig,
  SmsUsageSummary,
  UserSmsUsage,
  SmsUsageHistoryEntry,
  UpdateSmsPricingRequest,
} from './sms-types';

// Re-export types that are specific to this module
export type {
  SmsPricingConfig,
  SmsUsageSummary,
  UserSmsUsage,
  SmsUsageHistoryEntry,
  UpdateSmsPricingRequest,
} from './sms-types';

// ============================================================
// User Usage API Methods
// ============================================================

/**
 * Get SMS usage
 */
export async function getUsage(): Promise<SmsUsage> {
  const response = await apiClient.get<ApiResponse<SmsUsage>>('/sms/usage');
  return response.data;
}

// ============================================================
// SMS Admin Service
// ============================================================

/**
 * Get SMS pricing configuration
 */
export async function getPricing(): Promise<SmsPricingConfig> {
  const response = await apiClient.get<ApiResponse<SmsPricingConfig>>('/sms/admin/pricing');
  return response.data;
}

/**
 * Update SMS pricing configuration
 */
export async function updatePricing(data: UpdateSmsPricingRequest): Promise<SmsPricingConfig> {
  const response = await apiClient.put<ApiResponse<SmsPricingConfig>>('/sms/admin/pricing', data);
  return response.data;
}

/**
 * Get SMS usage summary
 */
export async function getUsageSummary(): Promise<SmsUsageSummary> {
  const response = await apiClient.get<ApiResponse<SmsUsageSummary>>('/sms/admin/usage');
  return response.data;
}

/**
 * Get per-user SMS usage stats
 */
export async function getUserUsageStats(): Promise<UserSmsUsage[]> {
  const response = await apiClient.get<ApiResponse<UserSmsUsage[]>>('/sms/admin/usage/users');
  return response.data;
}

/**
 * Reset SMS counters for a user or all users
 * @param userPhone - Optional: specific user to reset. If not provided, resets all users.
 * @param reason - Optional: reason for the reset (stored in history)
 */
export async function resetCounters(
  userPhone?: string,
  reason?: string
): Promise<{ resetCount: number }> {
  const response = await apiClient.post<ApiResponse<{ resetCount: number }>>(
    '/sms/admin/reset-counters',
    { userPhone, reason }
  );
  return response.data;
}

/**
 * Get user's SMS usage history
 */
export async function getUserHistory(phone: string, limit = 12): Promise<SmsUsageHistoryEntry[]> {
  const response = await apiClient.get<ApiResponse<SmsUsageHistoryEntry[]>>(
    `/sms/admin/users/${encodeURIComponent(phone)}/history`,
    { params: { limit } }
  );
  return response.data;
}

/**
 * Get user's current SMS limit
 */
export async function getUserLimit(phone: string): Promise<number | null> {
  const response = await apiClient.get<ApiResponse<{ phone: string; limit: number | null }>>(
    `/sms/admin/users/${encodeURIComponent(phone)}/limit`
  );
  return response.data.limit;
}

/**
 * Update user's SMS limit
 * @param phone - User's phone number
 * @param limit - New limit (null for unlimited)
 */
export async function updateUserLimit(phone: string, limit: number | null): Promise<void> {
  await apiClient.put(`/sms/admin/users/${encodeURIComponent(phone)}/limit`, { limit });
}

// ============================================================
// Twilio Bill (authoritative per-number monthly billing)
// ============================================================

export interface TwilioBillMessage {
  sid: string;
  direction: 'outbound' | 'inbound';
  /** Recipient for outbound, sender for inbound. */
  counterparty: string;
  body: string | null;
  status: string;
  numSegments: number;
  /** 0 for SMS; >0 indicates MMS. */
  numMedia: number;
  price: number | null;
  priceUnit: string | null;
  dateSent: string | null;
  errorCode: number | null;
}

export interface TwilioBill {
  phone: string;
  periodStart: string;
  periodEnd: string;
  priceUnit: string;
  outboundCost: number;
  inboundCost: number;
  totalCost: number;
  totalSegments: number;
  totalMessages: number;
  totalMessagesShown: number;
  totalMessagesNotShown: number;
  pendingPriceCount: number;
  byStatus: Record<string, number>;
  byDirection: { outbound: number; inbound: number };
  /** SMS/MMS splits — SMS billed per segment, MMS per message. */
  outboundSmsSegments: number;
  inboundSmsSegments: number;
  outboundMmsCount: number;
  inboundMmsCount: number;
  messages: TwilioBillMessage[];
}

/** Twilio sub-account override for the bill lookup. Omit to auto-resolve. */
export type TwilioBillProvider = 'standard' | 'auto';

/**
 * Fetch an authoritative monthly Twilio bill for a phone number.
 * Reads from Twilio's Messages API directly — replaces the rough local
 * estimate with the actual billed amount.
 *
 * @param phone - 11-digit normalized phone (e.g. "12164281997")
 * @param month - YYYY-MM (e.g. "2026-05")
 * @param provider - optional Twilio sub-account override. When omitted, the
 *                   user's configured provider is auto-resolved server-side.
 */
export async function getTwilioBill(
  phone: string,
  month: string,
  provider?: TwilioBillProvider
): Promise<TwilioBill> {
  const params: Record<string, string> = { phone, month };
  if (provider) params.provider = provider;
  const response = await apiClient.get<ApiResponse<TwilioBill>>('/sms/admin/twilio-bill', {
    params,
  });
  return response.data;
}

/**
 * Trigger a browser download of the FULL message list for a phone+month
 * as a CSV file. Unlike `getTwilioBill`, this endpoint is NOT capped at
 * 200 rows — it returns every message Twilio has for the period. Suitable
 * for offline analysis; not for interactive use.
 */
export async function downloadTwilioBillCsv(
  phone: string,
  month: string,
  provider?: TwilioBillProvider
): Promise<void> {
  const params: Record<string, string> = { phone, month };
  if (provider) params.provider = provider;
  const response = await apiClient.get<Blob>('/sms/admin/twilio-bill/csv', {
    params,
    responseType: 'blob',
  });
  // apiClient may wrap blob responses depending on shape — handle both.
  const blob = response instanceof Blob ? response : new Blob([response as unknown as BlobPart]);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `twilio-bill-${phone}-${month}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
