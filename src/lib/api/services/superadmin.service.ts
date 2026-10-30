/**
 * Superadmin API Service
 * Typed service for superadmin billing, orders, and SMS review endpoints.
 */

import { apiClient } from '../client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PlanSlug = 'starter' | 'professional';
export type PlanBillingPeriod = 'monthly' | 'yearly';

/** Current + pending plan state for an org (admin plan-change surface). */
export interface OrgPlanState {
  slug: PlanSlug | null;
  period: PlanBillingPeriod;
  pending: { slug: PlanSlug; period: PlanBillingPeriod } | null;
  subscriptionId: string | null;
  customerId: string | null;
}

/** Result of a plan change: what happened + the fresh state. */
export interface OrgPlanChangeResult {
  outcome: 'upgraded' | 'downgraded' | 'unchanged';
  effectiveAt: 'now' | 'period_end' | null;
  state: OrgPlanState;
}

/** Billing-cycle anchor view: manual pin, Stripe day, and the resolved effective. */
export interface OrgBillingAnchor {
  override: string | null;
  stripeAnchor: string | null;
  activatedAt?: string | null;
  effectiveAnchorIso: string | null;
}

/** Post-signup trial caps (null each = deployment default). */
export interface OrgTrialCaps {
  callMinutes: number | null;
  sms: number | null;
}

/** One Stripe invoice (admin read-only view). */
export interface OrgInvoice {
  id: string;
  number: string | null;
  amountCents: number;
  currency: string;
  status: string;
  created: number;
  hostedUrl: string | null;
  pdfUrl: string | null;
}

/** Org subscription summary (admin cancel/reactivate surface). */
export interface OrgSubscription {
  subscriptionId: string | null;
  summary: {
    id: string;
    status: string;
    currentPeriodEnd: number | null;
    cancelAtPeriodEnd: boolean;
    amountCents: number | null;
    currency: string;
    interval: string | null;
  } | null;
}

/** Org Telnyx sub-account status (kill-switch + 10DLC). */
export interface OrgTelnyxSubaccount {
  provisioned: boolean;
  status: 'active' | 'disabled' | 'provisioning' | 'failed' | null;
  managedAccountId: string | null;
  hasKeycard: boolean;
  tenDlc: { brandId: string | null; campaignId: string | null; campaignStatus: string | null };
}

export interface PricingPlan {
  id: number;
  planType: 'number' | 'sms_service' | 'platform_fee' | 'setup_fee';
  countryCode: string | null;
  numberType: 'local' | 'toll_free' | 'national' | null;
  name: string;
  description: string | null;
  monthlyPriceCents: number;
  upfrontPriceCents: number;
  currency: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePricingPlanData {
  planType: PricingPlan['planType'];
  countryCode?: string;
  numberType?: 'local' | 'toll_free' | 'national';
  name: string;
  description?: string;
  monthlyPriceCents: number;
  upfrontPriceCents: number;
  currency?: string;
}

export interface UpdatePricingPlanData extends Partial<CreatePricingPlanData> {
  isActive?: boolean;
}

export interface SignupOrder {
  id: number;
  businessName: string;
  businessNature: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  businessAddress: string | null;
  businessWebsite: string | null;
  // Lead-capture fields (simplified signup) — null on full-account orders.
  whatsappNumber: string | null;
  campaign: string | null;
  quantityOfDialers: number | null;
  interestedFeatures?: string[];
  // Admin "seen" tracking — null seenAt = not reviewed yet (shows as NEW).
  seenAt: string | null;
  seenBy: number | null;
  seenByName: string | null;
  status: string;
  stripeCustomerId: string | null;
  stripeCheckoutSessionId: string | null;
  stripePaymentIntentId: string | null;
  paymentAmountCents: number;
  paymentCurrency: string;
  paidAt: string | null;
  /** How the order was paid: 'stripe' (card) or 'bank_transfer' (manual). */
  paymentMethod?: string;
  /** Signed URL to the uploaded bank-transfer proof screenshot (null if paid by card). */
  bankTransferProofUrl?: string | null;
  smsCampaignRequested: boolean;
  /**
   * SMS campaign review id for this order, when one exists. The admin
   * order-detail page renders this as a "View SMS Campaign Review" link
   * so the reviewer doesn't have to navigate via /admin/signups/reviews
   * and search by company name to find the linked record.
   */
  smsReviewId: number | null;
  /**
   * True once the customer has clicked the verify link in their inbox.
   * Surfaced on the order detail page so admins can tell at a glance
   * whether a pre-payment order is stuck because the verify email
   * bounced/landed in spam, vs the customer simply abandoning.
   */
  emailVerified: boolean;
  emailVerifiedAt: string | null;
  organizationId: number | null;
  adminUserId: number | null;
  ipAddress: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

export interface OrdersResponse {
  success: boolean;
  data: SignupOrder[];
  meta: { total: number; totalPages: number };
}

export interface RevenueStats {
  totalOrders: number;
  activeOrders: number;
  pendingOrders: number;
  failedOrders: number;
  totalRevenueCents: number;
}

export interface SmsReview {
  id: number;
  orderId: number;
  /** Discriminates the two registration kinds in the shared queue. */
  reviewType: 'sms_campaign' | 'call_verification';
  legalCompanyName: string;
  businessName: string;
  contactName: string;
  contactEmail: string;
  companyRegistrationNumber: string | null;
  companyAddress: string | null;
  companyCountry: string | null;
  documents: Array<{ name: string; key: string; type: string; size: number }>;
  /** Full call-verification KYC (business fields). Null for SMS-campaign reviews. */
  payload: {
    registrationType?: string;
    brand?: Record<string, string>;
  } | null;
  status: 'pending' | 'in_review' | 'approved' | 'rejected' | 'more_info_needed';
  /** Lifecycle of the underlying signup order (active / pending / failed …). */
  orderStatus?: string | null;
  reviewedBy: number | null;
  reviewedAt: string | null;
  reviewerNotes: string | null;
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SmsReviewStats {
  pending: number;
  inReview: number;
  approved: number;
  rejected: number;
  moreInfoNeeded: number;
}

/** Per-org verification state for the admin override card. */
export interface OrgVerificationState {
  status: 'not_required' | 'pending' | 'approved' | 'rejected';
  submitted: boolean;
  reviewStatus: string | null;
  tenDlcApproved: boolean;
  hasOrder: boolean;
}

/** One org's SMS-package purchase, for the admin "SMS Packages" insight view. */
export interface BundlePurchase {
  orgId: number;
  orgName: string;
  ownerName: string | null;
  ownerEmail: string | null;
  ownerPhone: string | null;
  kycStatus: string;
  tenDlcApproved: boolean;
  slug: string;
  label: string;
  smsIncluded: number;
  smsUsed: number;
  priceCents: number;
  status: string;
  periodStart: string;
  periodEnd: string;
  purchasedAt: string | null;
}

/** One calendar month of org-wide SMS usage (derived from messages). */
export interface OrgSmsUsageMonth {
  periodStart: string;
  periodEnd: string;
  totalSent: number;
  totalReceived: number;
  totalSegmentsSent: number;
  totalSegmentsReceived: number;
}

/** One selectable SMS package in the admin org-detail card. */
export interface AdminBundleDef {
  slug: string;
  label: string;
  monthlyCents: number;
  minutes: number;
  sms: number;
}

/** An org's SMS-package state for the admin org-detail card (subset of getState). */
export interface AdminOrgBundleState {
  /** 'not_required' = unmetered org (per-user limit governs; packages don't apply). */
  kycStatus: string;
  tenDlcApproved: boolean;
  basePlan: { minutes: number; sms: number };
  catalog: AdminBundleDef[];
  active: {
    slug: string;
    label: string;
    smsIncluded: number;
    smsUsed: number;
    periodStart: string;
    periodEnd: string;
    canceling: boolean;
    /** Admin comp with monthly auto-renewal (else it expires at periodEnd). */
    autoRenew: boolean;
    /** Backed by a Stripe subscription (a paid package, not an admin comp). */
    isPaid: boolean;
  } | null;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

class SuperadminApiService {
  // Pricing
  async getPricingPlans(): Promise<{ success: boolean; data: PricingPlan[] }> {
    return apiClient.get('/admin/billing/pricing');
  }

  async createPricingPlan(
    data: CreatePricingPlanData
  ): Promise<{ success: boolean; data: PricingPlan }> {
    return apiClient.post('/admin/billing/pricing', data);
  }

  async updatePricingPlan(
    id: number,
    data: UpdatePricingPlanData
  ): Promise<{ success: boolean; message: string }> {
    return apiClient.put(`/admin/billing/pricing/${id}`, data);
  }

  async deletePricingPlan(id: number): Promise<{ success: boolean; message: string }> {
    return apiClient.delete(`/admin/billing/pricing/${id}`);
  }

  // Orders
  async getOrders(params?: {
    page?: number;
    limit?: number;
    status?: string;
    search?: string;
    paymentMethod?: string;
  }): Promise<OrdersResponse> {
    return apiClient.get('/admin/billing/orders', {
      params: params as Record<string, string | number | boolean | undefined>,
    });
  }

  async getOrder(id: number): Promise<{ success: boolean; data: SignupOrder }> {
    return apiClient.get(`/admin/billing/orders/${id}`);
  }

  /** Mark a signup request seen (reviewed) or clear it. */
  async markOrderSeen(id: number, seen: boolean): Promise<{ success: boolean; data: SignupOrder }> {
    return apiClient.put(`/admin/billing/orders/${id}/seen`, { seen });
  }

  async getRevenueStats(): Promise<{ success: boolean; data: RevenueStats }> {
    return apiClient.get('/admin/billing/orders/stats');
  }

  // SMS Reviews
  async getSmsReviews(params?: {
    status?: string;
    page?: number;
    limit?: number;
  }): Promise<{ success: boolean; data: SmsReview[]; meta?: { total: number } }> {
    return apiClient.get('/admin/signup-reviews', {
      params: params as Record<string, string | number | boolean | undefined>,
    });
  }

  async getSmsReview(id: number): Promise<{ success: boolean; data: SmsReview }> {
    return apiClient.get(`/admin/signup-reviews/${id}`);
  }

  async getSmsReviewStats(): Promise<{ success: boolean; data: SmsReviewStats }> {
    return apiClient.get('/admin/signup-reviews/stats');
  }

  async approveSmsReview(
    id: number,
    notes?: string
  ): Promise<{ success: boolean; message: string }> {
    return apiClient.put(`/admin/signup-reviews/${id}/approve`, { notes });
  }

  async rejectSmsReview(
    id: number,
    rejectionReason: string
  ): Promise<{ success: boolean; message: string }> {
    return apiClient.put(`/admin/signup-reviews/${id}/reject`, { rejectionReason });
  }

  async requestMoreInfo(id: number, notes: string): Promise<{ success: boolean; message: string }> {
    return apiClient.put(`/admin/signup-reviews/${id}/request-info`, { notes });
  }

  /** Every org's SMS-package purchase (super-admin insight). */
  async listBundlePurchases(): Promise<{ success: boolean; data: BundlePurchase[] }> {
    return apiClient.get('/bundles/admin/all');
  }

  /** Read one org's SMS-package state (for the admin org-detail card). */
  async getOrgBundle(orgId: number): Promise<{ success: boolean; data: AdminOrgBundleState }> {
    return apiClient.get(`/bundles/admin/org/${orgId}`);
  }

  /** Assign an SMS package to an org (admin override — bypasses the 10DLC gate). */
  async grantOrgBundle(
    orgId: number,
    slug: string,
    autoRenew: boolean
  ): Promise<{ success: boolean; data: AdminOrgBundleState; message: string }> {
    return apiClient.post(`/bundles/admin/org/${orgId}/grant`, { slug, autoRenew });
  }

  /** Remove an org's SMS package — reverts it to the base 100/mo. */
  async clearOrgBundle(
    orgId: number
  ): Promise<{ success: boolean; data: AdminOrgBundleState; message: string }> {
    return apiClient.delete(`/bundles/admin/org/${orgId}`);
  }

  /** Org-wide monthly SMS usage history (derived from messages — never lost). */
  async getOrgSmsUsageHistory(
    orgId: number
  ): Promise<{ success: boolean; data: OrgSmsUsageMonth[] }> {
    return apiClient.get(`/sms/admin/orgs/${orgId}/history`);
  }

  /** Per-org verification state for the admin override card. */
  async getOrgVerification(
    orgId: number
  ): Promise<{ success: boolean; data: OrgVerificationState }> {
    return apiClient.get(`/call-verification/admin/${orgId}`);
  }

  /** Override the org's KYC (Call Verification) gate — even with no submission. */
  async setOrgKyc(
    orgId: number,
    status: 'not_required' | 'pending' | 'approved' | 'rejected'
  ): Promise<{ success: boolean; data: OrgVerificationState; message: string }> {
    return apiClient.put(`/call-verification/admin/${orgId}/status`, { status });
  }

  /** Override the org's 10DLC gate — approve/revoke SMS-package eligibility. */
  async setOrg10dlc(
    orgId: number,
    approved: boolean
  ): Promise<{ success: boolean; data: OrgVerificationState; message: string }> {
    return apiClient.put(`/call-verification/admin/${orgId}/tendlc`, { approved });
  }

  // Order Authorization
  async authorizeOrder(
    orderId: number,
    enableSms?: boolean
  ): Promise<{ success: boolean; message: string }> {
    return apiClient.put(`/admin/signup-reviews/orders/${orderId}/authorize`, {
      enableSms: enableSms ?? false,
    });
  }

  /**
   * Reject a pending signup order. The server releases purchased Telnyx
   * numbers, refunds any Stripe payment, marks the order rejected, and
   * emails the customer. `reason` shows up verbatim in the rejection email,
   * so write it as customer-facing copy.
   */
  async rejectOrder(
    orderId: number,
    reason: string
  ): Promise<{ success: boolean; message: string }> {
    return apiClient.put(`/admin/signup-reviews/orders/${orderId}/reject`, { reason });
  }

  /**
   * Retry a Telnyx purchase for one failed number on an order. Used when
   * the auto-retry chain (0/5/30s) on signup gave up. Server returns 400
   * if the number is already purchased / released — the UI button only
   * shows for `pending`/`failed` rows.
   */
  async retryNumberPurchase(
    orderId: number,
    numberId: number
  ): Promise<{ success: boolean; message: string }> {
    return apiClient.post(
      `/admin/signup-reviews/orders/${orderId}/numbers/${numberId}/retry-purchase`,
      {}
    );
  }

  // ----- Plan change (upgrade / downgrade) -----

  /** Current + pending plan for an org. */
  async getOrgPlan(orgId: number): Promise<{ success: boolean; data: OrgPlanState }> {
    return apiClient.get(`/admin/organizations/${orgId}/plan`);
  }

  /**
   * Change an org's plan. Upgrade applies immediately (prorated); downgrade is
   * scheduled for the next billing cycle. The server decides the direction.
   */
  async changeOrgPlan(
    orgId: number,
    slug: PlanSlug,
    period: PlanBillingPeriod
  ): Promise<{ success: boolean; data: OrgPlanChangeResult }> {
    return apiClient.post(`/admin/organizations/${orgId}/plan`, { slug, period });
  }

  /** Cancel a pending (scheduled) plan downgrade. */
  async cancelOrgPendingDowngrade(
    orgId: number
  ): Promise<{ success: boolean; data: OrgPlanState }> {
    return apiClient.delete(`/admin/organizations/${orgId}/pending-downgrade`);
  }

  // ----- Billing anchor + trial caps -----

  /** The org's billing-cycle anchor: manual override, Stripe day, and effective. */
  async getOrgBillingAnchor(orgId: number): Promise<{ success: boolean; data: OrgBillingAnchor }> {
    return apiClient.get(`/admin/organizations/${orgId}/billing-anchor`);
  }

  /** Set (ISO) or clear (null → revert to Stripe day / created_at) the manual anchor. */
  async setOrgBillingAnchor(
    orgId: number,
    anchor: string | null
  ): Promise<{ success: boolean; data: OrgBillingAnchor }> {
    return apiClient.patch(`/admin/organizations/${orgId}/billing-anchor`, { anchor });
  }

  /** The org's post-signup trial caps (null = deployment default). */
  async getOrgTrialCaps(orgId: number): Promise<{ success: boolean; data: OrgTrialCaps }> {
    return apiClient.get(`/admin/organizations/${orgId}/trial-caps`);
  }

  /** Set the org's trial caps (null each = fall back to the global default). */
  async setOrgTrialCaps(
    orgId: number,
    caps: OrgTrialCaps
  ): Promise<{ success: boolean; data: OrgTrialCaps }> {
    return apiClient.patch(`/admin/organizations/${orgId}/trial-caps`, caps);
  }

  // ----- Telnyx sub-account kill-switch + 10DLC (fraud isolation) -----

  /** The org's Telnyx sub-account status (kill-switch + 10DLC). */
  async getOrgTelnyxSubaccount(
    orgId: number
  ): Promise<{ success: boolean; data: OrgTelnyxSubaccount }> {
    return apiClient.get(`/admin/signup-reviews/orgs/${orgId}/telnyx-subaccount`);
  }

  /** Kill-switch: disable the org's sub-account (blocks its telephony). */
  async disableOrgTelnyxSubaccount(orgId: number): Promise<{ success: boolean; message: string }> {
    return apiClient.put(`/admin/signup-reviews/orgs/${orgId}/telnyx-subaccount/disable`, {});
  }

  /** Re-enable a disabled sub-account. */
  async enableOrgTelnyxSubaccount(orgId: number): Promise<{ success: boolean; message: string }> {
    return apiClient.put(`/admin/signup-reviews/orgs/${orgId}/telnyx-subaccount/enable`, {});
  }

  /** Poll Telnyx for the org's 10DLC campaign status and (if approved) assign its numbers. */
  async refreshOrgTelnyx10dlc(
    orgId: number
  ): Promise<{ success: boolean; data: { campaignStatus: string | null; numbersAssigned: number } }> {
    return apiClient.post(`/admin/signup-reviews/orgs/${orgId}/telnyx-subaccount/10dlc/refresh`, {});
  }

  /** The org's recent Stripe invoices (read-only). */
  async getOrgInvoices(orgId: number): Promise<{ success: boolean; data: OrgInvoice[] }> {
    return apiClient.get(`/admin/organizations/${orgId}/invoices`);
  }

  // ----- Subscription (cancel / reactivate) -----

  async getOrgSubscription(orgId: number): Promise<{ success: boolean; data: OrgSubscription }> {
    return apiClient.get(`/admin/organizations/${orgId}/subscription`);
  }
  /** Schedule cancellation at period end (reversible). */
  async cancelOrgSubscription(orgId: number): Promise<{ success: boolean; data: OrgSubscription }> {
    return apiClient.post(`/admin/organizations/${orgId}/subscription/cancel`, {});
  }
  /** Undo a scheduled cancellation. */
  async reactivateOrgSubscription(
    orgId: number
  ): Promise<{ success: boolean; data: OrgSubscription }> {
    return apiClient.post(`/admin/organizations/${orgId}/subscription/reactivate`, {});
  }
}

export const superadminApiService = new SuperadminApiService();
