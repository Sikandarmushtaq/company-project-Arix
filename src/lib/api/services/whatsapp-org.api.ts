/**
 * WhatsApp Org Owner API
 *
 * Owner-scoped endpoints — backend enforces that the requesting user's
 * organization_id matches every resource read/written. Owners cannot
 * touch other organizations' data even with a forged numberId/userId.
 *
 * Mirrors the function-based pattern of whatsapp-admin.api.ts.
 */

import { apiClient } from '../client';
import type { ApiResponse } from '@/lib/types';
import type {
  WaConfig,
  WaNumber,
  WaTemplate,
  WaAgentGroup,
  CreateWaAgentGroupRequest,
  UpdateWaAgentGroupRequest,
} from './whatsapp-types';

// ============================================================
// Request / response types specific to org-owner flow
// ============================================================

export interface SaveWaOrgConfigRequest {
  accessToken: string;
  wabaId: string;
  appSecret?: string;
  apiVersion?: string;
}

/**
 * Returned by saveConfig. The verifyToken is plaintext on first save
 * and on every subsequent save — owner needs it to set up Meta's
 * webhook subscription. Do NOT store it client-side beyond the
 * post-save success screen.
 *
 * webhookCallbackUrl is the URL Meta should POST events to, computed
 * server-side from API_BASE_URL — never hardcode a domain client-side.
 */
export interface SaveWaOrgConfigResponse {
  config: WaConfig;
  verifyToken: string;
  numbersSynced: number;
  webhookCallbackUrl: string;
}

// ============================================================
// Config
// ============================================================

export async function getMyConfig(): Promise<WaConfig | null> {
  const response = await apiClient.get<ApiResponse<WaConfig | null>>('/whatsapp/org/config');
  return response.data;
}

export async function saveMyConfig(data: SaveWaOrgConfigRequest): Promise<SaveWaOrgConfigResponse> {
  const response = await apiClient.put<ApiResponse<SaveWaOrgConfigResponse>>(
    '/whatsapp/org/config',
    data
  );
  return response.data;
}

// ============================================================
// Embedded Signup (Meta Tech Provider click-to-connect)
// ============================================================

/**
 * Public (non-secret) client config for launching the Embedded Signup popup.
 * `enabled` is false when the server hasn't wired up App ID / Config ID /
 * App Secret — the UI then hides the "Connect WhatsApp" button and falls back
 * to the manual token form.
 */
export interface EmbeddedSignupConfig {
  appId: string | null;
  configId: string | null;
  graphVersion: string;
  enabled: boolean;
}

export async function getEmbeddedSignupConfig(): Promise<EmbeddedSignupConfig> {
  const response = await apiClient.get<ApiResponse<EmbeddedSignupConfig>>(
    '/whatsapp/org/embedded-signup/config'
  );
  return response.data;
}

/**
 * Complete Embedded Signup: send the OAuth `code` (from FB.login) and `wabaId`
 * (from the embedded-signup message event). The server exchanges the code for
 * a token, subscribes the app to the WABA, and saves the config. Returns the
 * same shape as a manual save (incl. verifyToken + webhookCallbackUrl).
 */
export async function exchangeEmbeddedSignup(data: {
  code: string;
  wabaId: string;
}): Promise<SaveWaOrgConfigResponse> {
  const response = await apiClient.post<ApiResponse<SaveWaOrgConfigResponse>>(
    '/whatsapp/org/embedded-signup/exchange',
    data
  );
  return response.data;
}

// ============================================================
// Managed connect (BSP-backed, one-click — vendor is never surfaced)
// ============================================================

/**
 * Managed connect availability + popup launch values. `enabled` means the
 * server can reach the BSP (partner key set). When `appId`/`configId`/
 * `solutionId` are all present the UI offers the one-click popup; otherwise it
 * falls back to the manual WhatsApp Business Account ID field.
 */
export interface ManagedConnectConfig {
  enabled: boolean;
  appId: string | null;
  configId: string | null;
  solutionId: string | null;
  graphVersion: string;
}

export async function getManagedConnectConfig(): Promise<ManagedConnectConfig> {
  const response = await apiClient.get<ApiResponse<ManagedConnectConfig>>(
    '/whatsapp/org/managed/config'
  );
  return response.data;
}

/**
 * Result of a managed connect. `paymentMethodAttached` is false while our
 * billing account for this number is still finalizing — the UI shows a
 * "finishing setup" hint in that case rather than a hard success.
 */
export interface ManagedConnectResponse {
  config: WaConfig;
  numbersSynced: number;
  paymentMethodAttached: boolean;
  webhookCallbackUrl: string;
}

/**
 * Connect a WhatsApp Business Account through our managed backend: we bind it,
 * register its numbers, and sync them — no access token required from the
 * customer. Takes just the WhatsApp Business Account ID.
 */
export async function connectManagedWhatsApp(data: {
  wabaId: string;
}): Promise<ManagedConnectResponse> {
  const response = await apiClient.post<ApiResponse<ManagedConnectResponse>>(
    '/whatsapp/org/managed/connect',
    data
  );
  return response.data;
}

// ============================================================
// Templates (per-org, provider-aware: YCloud or Meta)
// ============================================================

/** List this org's cached WhatsApp templates. */
export async function getMyTemplates(): Promise<WaTemplate[]> {
  const response = await apiClient.get<ApiResponse<WaTemplate[]>>('/whatsapp/org/templates');
  return response.data;
}

/**
 * Re-sync templates from this org's provider (YCloud BSP or Meta) and return
 * the fresh list. Owner/manager only.
 */
export async function refreshMyTemplates(): Promise<WaTemplate[]> {
  const response = await apiClient.post<ApiResponse<WaTemplate[]>>(
    '/whatsapp/org/templates/refresh'
  );
  return response.data;
}

export interface CreateWaTemplateRequest {
  name: string;
  language: string;
  category: string;
  bodyText: string;
  /**
   * One sample value per {{n}} variable in the body, in order ({{1}} first).
   * WhatsApp requires these for any template that uses variables — without
   * them the template is auto-rejected with INVALID_FORMAT.
   */
  examples?: string[];
}

/**
 * Author a new template on this org's provider (YCloud or Meta — resolved
 * server-side). It's submitted for review and returns PENDING until approved.
 * Owner/manager only.
 */
export async function createMyTemplate(
  data: CreateWaTemplateRequest
): Promise<Record<string, unknown>> {
  const response = await apiClient.post<ApiResponse<Record<string, unknown>>>(
    '/whatsapp/org/templates',
    data
  );
  return response.data;
}

/**
 * Delete one of this org's templates by name + language (e.g. to clear a
 * rejected one and free the name). Owner/manager only.
 */
export async function deleteMyTemplate(name: string, language: string): Promise<void> {
  await apiClient.delete<ApiResponse<unknown>>(
    `/whatsapp/org/templates/${encodeURIComponent(name)}?language=${encodeURIComponent(language)}`
  );
}

// ============================================================
// Billing (per-org, monthly): accurate message cost + call durations
// ============================================================

export interface WaBillingSummary {
  month: string;
  currency: string;
  messages: {
    totalCount: number;
    totalCost: number;
    byCategory: Array<{ category: string; count: number; cost: number }>;
  };
  calls: {
    outbound: { count: number; durationSecs: number };
    inbound: { count: number; durationSecs: number };
  };
}

/** Monthly billing summary for the caller's org. `month` is 'YYYY-MM'. */
export async function getMyBilling(month: string): Promise<WaBillingSummary> {
  const response = await apiClient.get<ApiResponse<WaBillingSummary>>('/whatsapp/org/billing', {
    params: { month },
  });
  return response.data;
}

export interface WaBillingAccount {
  mode: 'prepaid' | 'postpaid';
  balance: number;
  balanceMicros: number;
  currency: string;
}

/** Prepaid mode + balance for the caller's org. */
export async function getMyBillingAccount(): Promise<WaBillingAccount> {
  const response = await apiClient.get<ApiResponse<WaBillingAccount>>(
    '/whatsapp/org/billing/account'
  );
  return response.data;
}

/** Download the month's billing ledger as CSV. */
export async function downloadMyBillingCsv(month: string): Promise<void> {
  const blob = await apiClient.get<Blob>('/whatsapp/org/billing/export', {
    params: { month },
    responseType: 'blob',
  });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `whatsapp-billing-${month}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}

// ============================================================
// Numbers
// ============================================================

export async function getMyNumbers(): Promise<WaNumber[]> {
  const response = await apiClient.get<ApiResponse<WaNumber[]>>('/whatsapp/org/numbers');
  return response.data;
}

export async function syncMyNumbers(): Promise<{ numbers: WaNumber[]; count: number }> {
  const response = await apiClient.post<ApiResponse<{ numbers: WaNumber[]; count: number }>>(
    '/whatsapp/org/numbers/sync'
  );
  return response.data;
}

export async function assignMyNumber(numberId: number, userId: number | null): Promise<WaNumber> {
  const response = await apiClient.put<ApiResponse<WaNumber>>(
    `/whatsapp/org/numbers/${numberId}/assign`,
    { userId }
  );
  return response.data;
}

/**
 * Group-based assignment for a WA number. Replaces the previous chip-list
 * multi-agent flow: a number now belongs to one group, and the group's
 * members are the effective agents. Pass null to detach.
 */
export async function assignMyNumberGroup(
  numberId: number,
  groupId: number | null
): Promise<WaNumber> {
  const response = await apiClient.put<ApiResponse<WaNumber>>(
    `/whatsapp/org/numbers/${numberId}/assign`,
    { groupId }
  );
  return response.data;
}

// ============================================================
// Agent groups
// ============================================================

export async function listMyWaGroups(): Promise<WaAgentGroup[]> {
  const response = await apiClient.get<ApiResponse<WaAgentGroup[]>>('/whatsapp/org/groups');
  return response.data;
}

export async function getMyWaGroup(groupId: number): Promise<WaAgentGroup> {
  const response = await apiClient.get<ApiResponse<WaAgentGroup>>(
    `/whatsapp/org/groups/${groupId}`
  );
  return response.data;
}

export async function createMyWaGroup(data: CreateWaAgentGroupRequest): Promise<WaAgentGroup> {
  const response = await apiClient.post<ApiResponse<WaAgentGroup>>('/whatsapp/org/groups', data);
  return response.data;
}

export async function updateMyWaGroup(
  groupId: number,
  data: UpdateWaAgentGroupRequest
): Promise<WaAgentGroup> {
  const response = await apiClient.put<ApiResponse<WaAgentGroup>>(
    `/whatsapp/org/groups/${groupId}`,
    data
  );
  return response.data;
}

export async function deleteMyWaGroup(groupId: number): Promise<void> {
  await apiClient.delete<ApiResponse<unknown>>(`/whatsapp/org/groups/${groupId}`);
}

export async function setMyWaGroupMembers(
  groupId: number,
  userIds: number[]
): Promise<WaAgentGroup> {
  const response = await apiClient.put<ApiResponse<WaAgentGroup>>(
    `/whatsapp/org/groups/${groupId}/members`,
    { userIds }
  );
  return response.data;
}

// ============================================================
// User WA toggle (per-user within owner's org)
// ============================================================

export async function setMyUserWaEnabled(
  userId: number,
  enabled: boolean
): Promise<{ userId: number; enabled: boolean }> {
  const response = await apiClient.put<ApiResponse<{ userId: number; enabled: boolean }>>(
    `/whatsapp/org/users/${userId}/wa-enabled`,
    { enabled }
  );
  return response.data;
}

/**
 * Toggle WhatsApp/contacts privacy mode for an agent in this org.
 * Allowed for owner + manager (server-side `requireOwnerOrManager`).
 * Backend enforces target must be role=user — non-agent targets return 400.
 */
export async function setMyUserWaPhoneMask(
  userId: number,
  enabled: boolean
): Promise<{ userId: number; waPhoneMaskEnabled: boolean }> {
  const response = await apiClient.put<
    ApiResponse<{ userId: number; waPhoneMaskEnabled: boolean }>
  >(`/whatsapp/org/users/${userId}/wa-phone-mask`, { enabled });
  return response.data;
}
