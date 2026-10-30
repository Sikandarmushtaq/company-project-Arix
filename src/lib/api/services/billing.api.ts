/**
 * Billing Console API — super-admin reconciliation console (/admin2/billing).
 * Backs the Telnyx-cost ↔ ledger reconciliation surface. Read-only.
 */

import { apiClient } from '../client';
import type { ApiResponse } from '@/lib/types';

export interface DailyReconStatus {
  day: string; // YYYY-MM-DD (UTC)
  imported: number;
  matched: number;
  telnyxOnly: number;
  tiedOut: boolean;
}

export interface OrgConsoleRow {
  organizationId: number | null;
  organizationName: string | null;
  calls: number;
  minutes: number;
  telnyxCostCents: number;
  billedCents: number;
  collectedCents: number;
  marginCents: number;
  telnyxOnly: number;
}

export interface OrgCallRow {
  call_session_id: string;
  our_number: string | null;
  other_number: string | null;
  direction: 'inbound' | 'outbound' | null;
  billed_sec: number | null;
  cost: string | null;
  started_at: string | null;
  match_status: string;
  our_cdr_ref: string | null;
}

/** The day's import/match banner. `date` optional (defaults to today, UTC). */
export async function getDailyReconStatus(date?: string): Promise<DailyReconStatus> {
  const response = await apiClient.get<ApiResponse<DailyReconStatus>>('/admin/billing/recon/daily', {
    params: date ? { date } : undefined,
  });
  return response.data;
}

/** Per-org rollup for the range (defaults to the current month → now). */
export async function getOrgConsole(params?: { from?: string; to?: string }): Promise<OrgConsoleRow[]> {
  const response = await apiClient.get<ApiResponse<OrgConsoleRow[]>>('/admin/billing/recon/orgs', {
    params,
  });
  return response.data;
}

/** Call-level drill-down for one org over the range. */
export async function getOrgCalls(
  orgId: number,
  params?: { from?: string; to?: string }
): Promise<OrgCallRow[]> {
  const response = await apiClient.get<ApiResponse<OrgCallRow[]>>(
    `/admin/billing/recon/orgs/${orgId}/calls`,
    { params }
  );
  return response.data;
}

export const billingApi = { getDailyReconStatus, getOrgConsole, getOrgCalls };
