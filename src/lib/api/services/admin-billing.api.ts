/**
 * Admin Billing API — super-admin customer billing (flat monthly subscription).
 * Fleet list, per-org bill itemization + payment ledger, and manual-payment
 * recording. Served by /api/v1/admin/billing/orgs*.
 */

import { apiClient } from '../client';
import type { ApiResponse } from '@/lib/types';

export type PaymentMethodTag = 'stripe' | 'manual' | 'none';

export interface OrgBillingRow {
  orgId: number;
  name: string;
  status: string;
  billingStatus: string;
  planSlug: string | null;
  planLabel: string;
  billingPeriod: string;
  method: PaymentMethodTag;
  planCents: number;
  numbersCents: number;
  numbersCount: number;
  includedNumbers?: number;
  bundleCents: number;
  bundleSlug: string | null;
  smsAddonCents?: number;
  /** Our component sum (plan + numbers + bundle). Authoritative only for manual orgs. */
  computedCents: number;
  /** The amount to bill: live Stripe subscription amount for Stripe orgs, else computedCents. */
  monthlyCents: number;
  /** True when monthlyCents came from a live Stripe subscription (penny-accurate). */
  stripeLive: boolean;
  /** Super-admin disable reason (set when billingStatus='suspended' from the billing page). */
  suspendReason?: string | null;
  // --- Cycle-aware / Period-specific fields ---
  billedCents: number;
  paidCents: number;
  pendingCents: number;
  periodBillingStatus: 'paid' | 'partially_paid' | 'past_due' | 'suspended' | 'canceled' | 'free' | 'trial';
  anchorDay?: number;
  cycleStartIso?: string;
  cycleEndIso?: string;
  isTrial?: boolean;
  /** Current-month collection state (by-hand orgs): due date, paid-so-far, balance, status. */
  createdAtIso?: string | null;
  dueDateIso?: string;
  amountDueCents?: number;
  paidThisCycleCents?: number;
  balanceCents?: number;
  collectionStatus?: CollectionStatus;
  partiallyPaid?: boolean;
}

/** By-hand collection status for the current cycle. 'auto' = Stripe; 'none' = $0 bill. */
export type CollectionStatus = 'auto' | 'none' | 'paid' | 'upcoming' | 'due_soon' | 'overdue';

export interface CurrentCycle {
  periodMonth: string; // YYYY-MM
  createdAtIso: string | null;
  dueDateIso: string; // YYYY-MM-DD
  amountDueCents: number;
  paidThisCycleCents: number;
  balanceCents: number;
  collectionStatus: CollectionStatus;
  partiallyPaid: boolean;
}

export interface ManualPayment {
  id: number;
  period: string | null;
  invoiceId?: number | null;
  actualPaymentDate?: string | null;
  systemEntryAt?: string | null;
  amountCents: number;
  currency: string;
  exchangeRate?: number | null;
  originalAmountCents?: number | null;
  method: string;
  bankName?: string | null;
  senderName?: string | null;
  accountNumber?: string | null;
  reference: string | null;
  note: string | null;
  paidAt: string | null;
  recordedBy: number | null;
  receiptKey?: string | null;
  receiptFilename?: string | null;
  receiptUrl?: string | null;
}

export interface StripeInvoice {
  id: string;
  number: string | null;
  amountCents: number;
  currency: string;
  status: string;
  created: number; // unix seconds
  hostedUrl: string | null;
  pdfUrl: string | null;
}

export interface OrgBillingDetail {
  organization?: {
    id: number;
    name: string;
    slug: string;
    contactName?: string | null;
    contactEmail?: string | null;
    contactPhone?: string | null;
    createdAt?: string | null;
  };
  planSlug: string | null;
  planLabel: string;
  billingPeriod: string | null;
  monthlyCents: number | null;
  billingStatus: string;
  hasSubscription: boolean;
  subscription: {
    id: string;
    status: string;
    currentPeriodEnd: number | null;
    cancelAtPeriodEnd: boolean;
    amountCents: number;
    currency: string;
    interval: string;
  } | null;
  paymentMethod: { brand?: string; last4?: string; type?: string } | null;
  invoices: StripeInvoice[];
  paymentType: 'stripe' | 'bank_transfer' | 'none';
  bankTransfer: { paidAt: number | null; amountCents: number | null; currency: string } | null;
  /** Super-admin disable reason (billingStatus='suspended'); null when not disabled. */
  suspendReason?: string | null;
  /** Active billing cycle window and anchor day */
  billingCycle?: {
    start: string;
    end: string;
    anchorDay: number;
    startDate?: string | null;
  };
  activeUsersCount?: number;
  /** Current-cycle collection state for this org (due date, paid-so-far, balance, status). */
  currentCycle?: CurrentCycle;
  /** Present only when the org is on a CUSTOM plan (super-admin-built). */
  customPlan: {
    priceCents: number;
    label: string;
    seats: number | null;
    activeUsers?: number | null;
    devicesPerUser: number | null;
    smsAllowance: number | null;
    includedNumbers: number;
    maxNumbers: number | null;
    standardSeatPriceCents?: number;
    agreedSeatPriceCents?: number;
    seatPriceDeviationCents?: number;
  } | null;
  itemization: {
    planCents: number;
    numbers: Array<{ number: string; type: string; monthlyCents: number; included?: boolean; assignedUserId: number | null }>;
    numbersCents: number;
    bundle: { slug: string; monthlyCents: number; minutes: number; sms: number } | null;
    bundleCents: number;
    smsAddonCents?: number;
    smsAddons?: Array<{
      id: number;
      name: string;
      smsCount: number;
      monthlyCents: number;
      priceCents: number;
      isRecurring: boolean;
      standardUnitRateCents?: number;
      standardTotalCents?: number;
      deviationCents?: number;
      deviationPercent?: number | null;
    }>;
    proratedSeatAddons?: Array<{
      id: number;
      seatsAdded: number;
      unitPriceCents: number;
      proratedAmountCents: number;
      cycleStart?: string;
      cycleEnd?: string;
      notes: string | null;
      createdAt: string | null;
    }>;
    proratedSeatCents?: number;
    monthlyCents: number;
  };
  manualPayments: ManualPayment[];
  /** True when the organization is on trial. */
  isTrial?: boolean;
  detailBillingStatus?: string;
  standardSeatPriceCents?: number;
  agreedSeatPriceCents?: number;
  seatPriceDeviationCents?: number;
}

export interface GetOrgsBillingParams {
  [key: string]: string | number | boolean | undefined;
  page?: number;
  limit?: number;
  search?: string;
  period?: string; // YYYY-MM e.g. "2026-10"
  from?: string;   // YYYY-MM-DD
  to?: string;     // YYYY-MM-DD
  method?: 'manual' | 'stripe'; // tab: by-hand vs Stripe (server-side, pre-pagination)
  status?: 'owing' | 'overdue' | 'paid'; // collection filter (server-side, fleet-wide)
}

export interface OrgBillingTotals {
  orgs: number;
  period?: string;
  totalBilledCents?: number;
  stripeBilledCents?: number;
  manualBilledCents?: number;
  totalPaidCents?: number;
  paidStripeCents?: number;
  paidManualCents?: number;
  totalPendingCents?: number;
  pendingStripeCents?: number;
  pendingManualCents?: number;
  paidCount?: number;
  partialCount?: number;
  pastDueCount?: number;
  owingCount?: number;
  stripeCount?: number;
  manualCount?: number;
  // By-hand-scoped collection counts (fleet-wide) — By-hand tab filter badges.
  manualOwingCount?: number;
  manualOverdueCount?: number;
  manualPaidCount?: number;
  // Stripe-scoped counts (fleet-wide) — Stripe tab tiles.
  stripeLiveCount?: number;
  stripeEstimatedCount?: number;
  // Compatibility
  monthly: number;
  stripe: number;
  manual: number;
  pastDue?: number;
}

export interface OrgsBillingResult {
  rows: OrgBillingRow[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext?: boolean;
    hasPrev?: boolean;
  };
  totals: OrgBillingTotals;
}

export async function getOrgsBilling(params?: GetOrgsBillingParams): Promise<OrgsBillingResult> {
  const r = await apiClient.get<ApiResponse<OrgBillingRow[]> & { totals?: OrgBillingTotals }>(
    '/admin/billing/orgs',
    { params }
  );
  const data = Array.isArray(r.data) ? r.data : [];
  return {
    rows: data,
    meta: {
      page: Number(r.meta?.page ?? params?.page ?? 1),
      limit: Number(r.meta?.limit ?? params?.limit ?? 10),
      total: Number(r.meta?.total ?? data.length),
      totalPages: Number(
        r.meta?.totalPages ??
          Math.max(1, Math.ceil(Number(r.meta?.total ?? data.length) / Number(r.meta?.limit ?? params?.limit ?? 10)))
      ),
      hasNext: Boolean(r.meta?.hasNext),
      hasPrev: Boolean(r.meta?.hasPrev),
    },
    totals: (r as { totals?: OrgBillingTotals }).totals ?? {
      orgs: data.length,
      monthly: data.reduce((s, row) => s + (row.monthlyCents || 0), 0),
      stripe: data.filter((row) => row.method === 'stripe').length,
      manual: data.filter((row) => row.method === 'manual').length,
    },
  };
}

export async function getOrgBillingDetail(orgId: number): Promise<OrgBillingDetail> {
  const r = await apiClient.get<ApiResponse<OrgBillingDetail>>(`/admin/billing/orgs/${orgId}`);
  return r.data;
}

export async function getOrgPayments(orgId: number): Promise<ManualPayment[]> {
  const r = await apiClient.get<ApiResponse<ManualPayment[]>>(`/admin/billing/orgs/${orgId}/payments`);
  return r.data;
}

export interface OrgInvoiceItem {
  id: number;
  invoiceId: number;
  productId: number;
  productCode?: string;
  productNameSnapshot: string;
  description: string;
  quantity: number;
  unitPriceCents: number;
  totalCents: number;
  itemAttributes: Record<string, unknown> | null;
  createdAt: string;
}

export interface OrgInvoice {
  id: number;
  invoiceNumber: string;
  organizationId: number;
  cycleStart: string;
  cycleEnd: string;
  dueDate: string;
  totalDueCents: number;
  paidCents: number;
  balanceCents: number;
  status: 'unpaid' | 'partially_paid' | 'paid' | 'void';
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
  items?: OrgInvoiceItem[];
  payments?: ManualPayment[];
}

export interface StatementSummary {
  totalInvoicedCents: number;
  totalPaidCents: number;
  totalOutstandingCents: number;
  count: number;
}

export interface StatementPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasPrev: boolean;
  hasNext: boolean;
}

export interface OrgStatementsResponse {
  organizationId: number;
  summary: StatementSummary;
  statements: OrgInvoice[];
  pagination?: StatementPagination;
}

export async function getOrgStatements(
  orgId: number,
  params?: { range?: string; from?: string; to?: string; status?: string; page?: number; limit?: number }
): Promise<OrgStatementsResponse> {
  const query = new URLSearchParams();
  if (params?.range) query.set('range', params.range);
  if (params?.from) query.set('from', params.from);
  if (params?.to) query.set('to', params.to);
  if (params?.status) query.set('status', params.status);
  if (params?.page) query.set('page', String(params.page));
  if (params?.limit) query.set('limit', String(params.limit));
  const qs = query.toString() ? `?${query.toString()}` : '';
  const r = await apiClient.get<ApiResponse<OrgStatementsResponse>>(`/admin/billing/orgs/${orgId}/statements${qs}`);
  return r.data;
}

export interface RecordPaymentInput {
  amountCents: number;
  currency?: string;
  exchangeRate?: number | null;
  originalAmountCents?: number | null;
  invoiceId?: number | null;
  actualPaymentDate?: string | null;
  period?: string | null; // YYYY-MM-DD (1st of month)
  method?: string;
  bankName: string;
  senderName: string;
  accountNumber?: string | null;
  reference?: string | null;
  note?: string | null;
  paidAt?: string | null;
  receiptFile?: File | null;
}

export async function recordOrgPayment(orgId: number, body: RecordPaymentInput): Promise<{ id: number }> {
  if (body.receiptFile) {
    const formData = new FormData();
    formData.append('amountCents', String(body.amountCents));
    if (body.currency) formData.append('currency', body.currency);
    if (body.exchangeRate != null) formData.append('exchangeRate', String(body.exchangeRate));
    if (body.originalAmountCents != null) formData.append('originalAmountCents', String(body.originalAmountCents));
    if (body.invoiceId != null) formData.append('invoiceId', String(body.invoiceId));
    if (body.actualPaymentDate) formData.append('actualPaymentDate', body.actualPaymentDate);
    if (body.period) formData.append('period', body.period);
    formData.append('method', 'bank_transfer');
    formData.append('bankName', body.bankName);
    formData.append('senderName', body.senderName);
    if (body.accountNumber) formData.append('accountNumber', body.accountNumber);
    if (body.reference) formData.append('reference', body.reference);
    if (body.note) formData.append('note', body.note);
    if (body.paidAt) formData.append('paidAt', body.paidAt);
    formData.append('receipt', body.receiptFile);

    const r = await apiClient.upload<ApiResponse<{ id: number }>>(
      `/admin/billing/orgs/${orgId}/payments`,
      formData
    );
    return r.data;
  }

  const { receiptFile: _ignored, ...jsonBody } = body;
  const r = await apiClient.post<ApiResponse<{ id: number }>>(
    `/admin/billing/orgs/${orgId}/payments`,
    { ...jsonBody, method: 'bank_transfer' }
  );
  return r.data;
}

/** Disable an org from the billing page with a reason the owner sees. */
export async function suspendOrg(orgId: number, reason: string): Promise<void> {
  await apiClient.post<ApiResponse<unknown>>(`/admin/billing/orgs/${orgId}/suspend`, { reason });
}
/** Re-enable a billing-suspended org. */
export async function reactivateOrg(orgId: number): Promise<void> {
  await apiClient.post<ApiResponse<unknown>>(`/admin/billing/orgs/${orgId}/reactivate`, {});
}

/** Delete / void an offline manual payment record. */
export async function deleteOrgPayment(orgId: number, paymentId: number): Promise<void> {
  await apiClient.delete<ApiResponse<unknown>>(`/admin/billing/orgs/${orgId}/payments/${paymentId}`);
}

/** Update an organization's billing lifecycle status. */
export async function updateOrgBillingStatus(
  orgId: number,
  status: 'active' | 'past_due' | 'canceling' | 'canceled' | 'suspended',
  reason?: string
): Promise<void> {
  await apiClient.patch<ApiResponse<unknown>>(`/admin/billing/orgs/${orgId}/status`, { status, reason });
}

export async function triggerAutoSuspend(graceDays: number = 2, dryRun: boolean = false): Promise<{
  scanned: number;
  suspended: number;
  suspendedOrgIds: number[];
  skipped: number;
  dryRun?: boolean;
}> {
  const r = await apiClient.post<
    ApiResponse<{
      scanned: number;
      suspended: number;
      suspendedOrgIds: number[];
      skipped: number;
      dryRun?: boolean;
    }>
  >('/admin/billing/auto-suspend', { graceDays, dryRun });
  return r.data;
}

export interface ExchangeRateDto {
  id: number;
  base_currency: string;
  quote_currency: string;
  rate: string;
  rate_type: 'operational' | 'closing';
  period: string | null;
  revision: number;
  effective_from: string;
  status: 'draft' | 'active' | 'locked' | 'superseded';
  source: string;
  notes: string | null;
}

export async function getCurrentExchangeRate(base = 'USD', quote = 'PKR'): Promise<{
  operational: ExchangeRateDto;
  closing: ExchangeRateDto | null;
  currentMonth: string;
}> {
  const r = await apiClient.get<
    ApiResponse<{
      operational: ExchangeRateDto;
      closing: ExchangeRateDto | null;
      currentMonth: string;
    }>
  >('/admin/billing/exchange-rates/current', { params: { base, quote } });
  return r.data;
}

export async function getExchangeRateHistory(params?: {
  rateType?: 'operational' | 'closing';
  status?: string;
  limit?: number;
}): Promise<ExchangeRateDto[]> {
  const r = await apiClient.get<ApiResponse<ExchangeRateDto[]>>(
    '/admin/billing/exchange-rates/history',
    { params }
  );
  return r.data;
}

export async function createExchangeRate(body: {
  rate: number | string;
  rateType?: 'operational' | 'closing';
  period?: string;
  baseCurrency?: string;
  quoteCurrency?: string;
  source?: string;
  notes?: string;
}): Promise<ExchangeRateDto> {
  const r = await apiClient.post<ApiResponse<ExchangeRateDto>>(
    '/admin/billing/exchange-rates',
    body
  );
  return r.data;
}

export async function activateExchangeRate(id: number): Promise<ExchangeRateDto> {
  const r = await apiClient.post<ApiResponse<ExchangeRateDto>>(
    `/admin/billing/exchange-rates/${id}/activate`
  );
  return r.data;
}

export async function lockClosingRate(id: number): Promise<ExchangeRateDto> {
  const r = await apiClient.post<ApiResponse<ExchangeRateDto>>(
    `/admin/billing/exchange-rates/${id}/lock`
  );
  return r.data;
}

export const adminBillingApi = {
  getCurrentExchangeRate,
  getExchangeRateHistory,
  createExchangeRate,
  activateExchangeRate,
  lockClosingRate,
  getOrgsBilling,
  getOrgBillingDetail,
  getOrgPayments,
  getOrgStatements,
  recordOrgPayment,
  deleteOrgPayment,
  updateOrgBillingStatus,
  suspendOrg,
  reactivateOrg,
  triggerAutoSuspend,
  addSeats: (orgId: number, seats: number, notes?: string) =>
    apiClient.post<{
      success: boolean;
      data: {
        seatsAdded: number;
        newTotalSeats: number;
        unitPriceCents: number;
        proratedAmountCents: number;
      };
    }>(`/admin/billing/orgs/${orgId}/seats`, { seats, notes }),
};
