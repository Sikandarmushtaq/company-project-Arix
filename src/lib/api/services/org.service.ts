/**
 * Organization Portal API Service
 * Typed service for org dashboard, users, numbers, settings.
 */

import { apiClient } from '../client';
import type { AvailableNumber, SmsCampaignPayload } from './onboarding.service';
import type { CallVerificationPayload } from '@/components/org/CallVerificationForm';

/** KYC gate status + daily usage snapshot for the org (reskin only). */
export interface OrgCallVerification {
  status: 'not_required' | 'pending' | 'approved' | 'rejected';
  /** Subject to an allowance meter (any reskin self-serve org). Drives the pills. */
  metered: boolean;
  /** Pre-KYC (pending/rejected) — still needs verification; drives the "Verify" CTA. */
  capped: boolean;
  /**
   * The org's HIDDEN monthly call soft cap has been reached → outbound is blocked.
   * Drives a NEUTRAL "contact your administrator" banner — NEVER shows a limit or a
   * usage number to the user. Independent of `capped` (this is the unlimited tier).
   */
  callsBlocked?: boolean;
  /**
   * The org's monthly SMS limit has been reached → outbound SMS blocked. For a
   * METERED org it's the bundle/base allowance (numbers visible, can upgrade); for
   * the UNLIMITED tier it's the HIDDEN SMS soft cap (neutral banner, no numbers).
   * The SMS twin of callsBlocked.
   */
  smsBlocked?: boolean;
  /** Where the current allowance comes from: the base plan or an active bundle. */
  allowanceSource: 'base' | 'bundle';
  callMinutesPerMonth: number;
  callMinutesUsedThisMonth: number;
  callSecondsUsedThisMonth: number;
  smsPerMonth: number;
  smsUsedThisMonth: number;
  /** ISO end of the active bundle cycle (null on the base monthly allowance). */
  periodEndIso: string | null;
}

/** The org's KYC review state — drives the persistent status view on the registrations page. */
export interface OrgCallVerificationReview {
  submitted: boolean;
  reviewStatus: 'pending' | 'in_review' | 'more_info_needed' | 'rejected' | 'approved' | null;
  notes: string | null;
  /** The last-submitted KYC, so a resubmit prefills instead of showing a blank form. */
  submission: {
    registrationType?: 'standard' | 'sole_prop';
    brand?: {
      legalCompanyName?: string;
      entityType?: string;
      ein?: string;
      vertical?: string;
      email?: string;
      phone?: string;
      street?: string;
      city?: string;
      state?: string;
      postalCode?: string;
      country?: 'US' | 'CA';
      website?: string;
    };
  } | null;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface OrgDashboard {
  organizationName: string;
  organizationStatus: 'pending' | 'active' | 'suspended';
  totalUsers: number;
  maxUsers?: number;
  totalNumbers?: number;
  activeNumbers: number;
  smsCampaignStatus: string | null;
}

export interface OrgUser {
  id: number;
  fullName: string;
  email: string;
  role: 'owner' | 'manager' | 'user';
  status: 'active' | 'inactive' | 'pending' | 'suspended' | 'banned';
  sipUsername: string | null;
  senderPhone: string | null;
  smsEnabled: boolean;
  waEnabled: boolean;
  /**
   * WhatsApp/contacts privacy mode. Server only sets this for role=user.
   * Owner/manager are never masked even if the column is set.
   */
  waPhoneMaskEnabled?: boolean;
  createdAt: string;
}

export interface CreateOrgUserData {
  fullName: string;
  email: string;
  password: string;
  senderPhone?: string;
  role?: 'user' | 'manager';
  /**
   * When the chosen number carries a previous owner's history: true = bring it to
   * the new member, false = start clean (hide + schedule deletion). Omitted when
   * the number has no history.
   */
  importHistory?: boolean;
}

export interface UpdateOrgUserData {
  fullName?: string;
  email?: string;
  password?: string;
  status?: 'active' | 'inactive';
  /** Only user↔manager; the owner's role can't be changed. */
  role?: 'user' | 'manager';
}

export interface OrgNumber {
  id: number;
  phoneNumber: string;
  countryCode: string;
  numberType: 'local' | 'toll_free' | 'national';
  assignedUserId: number | null;
  assignedUserName: string | null;
  isActive: boolean;
  callerIdName: string | null;
  inboundCnamEnabled: boolean;
  monthlyCostCents: number;
  purchasedAt?: string | null;
  createdAt: string;
  updatedAt?: string;
}

// --- Billing ---------------------------------------------------------------

export interface OrgPaymentMethod {
  /** 'card' | 'link' | 'us_bank_account' | 'sepa_debit' | 'cashapp' | 'paypal' | … */
  type: string;
  /** Human-readable, always set (e.g. "Visa •••• 4242", "Link · a@b.com"). */
  label: string;
  brand?: string;
  last4?: string;
  expMonth?: number;
  expYear?: number;
  bankName?: string;
  email?: string;
}

export interface OrgInvoice {
  id: string;
  number: string | null;
  amountCents: number;
  currency: string;
  status: string;
  created: number; // unix seconds
  hostedUrl: string | null;
  pdfUrl: string | null;
}

export interface OrgSubscriptionSummary {
  id: string;
  status: string;
  currentPeriodEnd: number | null;
  cancelAtPeriodEnd: boolean;
  amountCents: number | null;
  currency: string;
  interval: string | null;
}

export interface OrgBilling {
  planSlug: string | null;
  planLabel: string;
  billingPeriod: string | null;
  monthlyCents: number | null;
  /** Per-number extras ($5 × numbers beyond the plan's included count). Added to
   *  the plan price for the non-Stripe monthly total (Stripe subs bill numbers
   *  as line items, so it's not applied on top of a live subscription amount). */
  numbersCents?: number;
  smsAddonCents?: number;
  smsAddons?: Array<{
    id: number;
    name: string;
    smsCount: number;
    priceCents: number;
    isRecurring: boolean;
    periodEnd: string;
  }>;
  billingStatus: string;
  hasSubscription: boolean;
  subscription: OrgSubscriptionSummary | null;
  paymentMethod: OrgPaymentMethod | null;
  invoices: OrgInvoice[];
  /** How the org paid: 'stripe' (card), 'bank_transfer' (manual), or 'none'. */
  paymentType: 'stripe' | 'bank_transfer' | 'none';
  /** Manual bank-transfer payment details (null unless paymentType is bank_transfer). */
  bankTransfer: { paidAt: number | null; amountCents: number | null; currency: string } | null;
  /** Super-admin disable reason, shown when billingStatus='suspended'; null otherwise. */
  suspendReason: string | null;
  /** Offline (bank/cash) payments recorded for this org — the owner's payment ledger. */
  manualPayments: Array<{
    id: number;
    period: string | null;
    amountCents: number;
    currency: string;
    method: string;
    bankName?: string | null;
    senderName?: string | null;
    accountNumber?: string | null;
    reference: string | null;
    note: string | null;
    paidAt: string | null;
  }>;
  /** True when the organization is on trial (unverified or trial limits active). No payment is due until made live. */
  isTrial?: boolean;
  seats?: number;
  agreedSeatPriceCents?: number;
  standardSeatPriceCents?: number;
}

export interface OrgSmsCampaignReview {
  id: number;
  status: 'pending' | 'in_review' | 'approved' | 'rejected' | 'more_info_needed';
  legalCompanyName: string;
  reviewedAt: string | null;
  reviewerNotes: string | null;
  rejectionReason: string | null;
  createdAt: string;
}

/** Full payload for the org SMS Campaign page — review status + eligibility + form seed. */
export interface OrgSmsCampaign {
  review: OrgSmsCampaignReview | null;
  /** True when the org's plan includes SMS (the `sms` module is entitled). */
  eligible: boolean;
  /**
   * SSOT for SMS-send capability, decoupled from calling KYC:
   *   'not_required' | 'unregistered' | 'pending' | 'rejected' | 'registered' | 'shared'.
   * `null` = legacy org (pre-migration, not backfilled) → the banner falls back
   * to its prior call-verification logic so existing orgs are unaffected.
   */
  registrationStatus: string | null;
  /** Monthly SMS-segment allowance for the org owner. */
  smsLimit: number;
  /** Whether SMS sending is switched on (flips once a campaign is approved). */
  smsEnabled: boolean;
  /** True when the owner may (re)submit a registration right now. */
  canSubmit: boolean;
  /**
   * The owner's FULL last submission (brand + campaign + numbers + documents),
   * staged from a prior submit. Present on a resubmit so the whole 10DLC form
   * re-hydrates (not just the `prefill` basics); null if never submitted.
   */
  submission: SmsCampaignPayload | null;
  prefill: {
    legalCompanyName: string;
    email: string;
    phone: string;
    street: string;
    website: string;
  };
  numbers: Array<{ phoneNumber: string; countryCode: string; numberType: string }>;
}

export interface OrgSettings {
  name: string;
  slug: string;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

class OrgApiService {
  async getDashboard(): Promise<{ success: boolean; data: OrgDashboard }> {
    return apiClient.get('/org/dashboard');
  }

  async getUsers(params?: {
    page?: number;
    limit?: number;
  }): Promise<{ success: boolean; data: OrgUser[]; meta: { total: number } }> {
    return apiClient.get('/org/users', {
      params: params as Record<string, string | number | boolean | undefined>,
    });
  }

  async createUser(data: CreateOrgUserData): Promise<{ success: boolean; data: OrgUser }> {
    return apiClient.post('/org/users', data);
  }

  async updateUser(
    id: number,
    data: UpdateOrgUserData
  ): Promise<{ success: boolean; message: string }> {
    return apiClient.put(`/org/users/${id}`, data);
  }

  /**
   * Delete an org user. By default their communications data (SMS/calls/
   * recordings/voicemail) is KEPT; pass `purgeData` to schedule it for deletion
   * (30-day grace, then permanent).
   */
  async deleteUser(
    id: number,
    purgeData?: boolean
  ): Promise<{ success: boolean; message: string }> {
    return apiClient.delete(`/org/users/${id}${purgeData ? '?purgeData=true' : ''}`);
  }

  /** Org lifecycle status ('active' | 'disabled' | 'closed') — gates the dialer. */
  async getLifecycleStatus(): Promise<{ success: boolean; data: { status: string } }> {
    return apiClient.get('/org/status');
  }

  async getNumbers(): Promise<{ success: boolean; data: OrgNumber[] }> {
    return apiClient.get('/org/numbers');
  }

  /** The org's phone-number cap (admin-set) + current usage. */
  async getNumberCap(): Promise<{ success: boolean; data: { cap: number; used: number } }> {
    return apiClient.get('/org/numbers/cap');
  }

  /** Prior-history summary for a number, for the assign "bring the data?" prompt. */
  async getNumberHistory(
    numberId: number
  ): Promise<{
    success: boolean;
    data: { sms: number; calls: number; hasHistory: boolean; pendingRetirement: boolean };
  }> {
    return apiClient.get(`/org/numbers/${numberId}/history`);
  }

  /**
   * Assign (or, with userId null, unassign) a number. On assign, `importHistory`
   * decides the number's prior history: true = carry it to the new owner;
   * false = clear it (hidden from the new owner + scheduled for deletion).
   */
  async assignNumber(
    numberId: number,
    userId: number | null,
    importHistory?: boolean
  ): Promise<{ success: boolean; message: string }> {
    return apiClient.put(`/org/numbers/${numberId}/assign`, { userId, importHistory });
  }

  /** Buy a single number (charged $5/mo to the card on file). */
  async buyNumber(input: {
    phoneNumber: string;
    countryCode: string;
    numberType: 'local' | 'toll_free' | 'national';
  }): Promise<{ success: boolean; data: { id: number; phoneNumber: string } }> {
    return apiClient.post('/org/numbers/buy', input);
  }

  /** Set a number's outbound caller-ID name (CNAM). Max 15 chars; empty clears it. */
  async updateCallerIdName(
    numberId: number,
    callerIdName: string
  ): Promise<{ success: boolean; message: string }> {
    return apiClient.put(`/org/numbers/${numberId}/caller-id-name`, { callerIdName });
  }

  /** Enable/disable INBOUND caller-name (CNAM) lookup on a number ($0.40/mo when on). */
  async setInboundCallerName(
    numberId: number,
    enabled: boolean
  ): Promise<{ success: boolean; message: string }> {
    return apiClient.put(`/org/numbers/${numberId}/inbound-caller-name`, { enabled });
  }

  async searchNumbers(params: {
    country_code: string;
    locality?: string;
    area_code?: string;
    number_type?: string;
    limit?: number;
  }): Promise<{ success: boolean; data: AvailableNumber[] }> {
    return apiClient.get('/org/numbers/search', {
      params: params as Record<string, string | number | boolean | undefined>,
    });
  }

  async getSmsCampaign(): Promise<{ success: boolean; data: OrgSmsCampaign }> {
    return apiClient.get('/org/sms-campaign');
  }

  /** Presign a 10DLC supporting-document upload for the org portal. */
  async getSmsCampaignUploadUrl(file: {
    name: string;
    contentType: string;
    size: number;
  }): Promise<{ success: boolean; data: { uploadUrl: string; key: string } }> {
    return apiClient.post('/org/sms-campaign/upload-url', file);
  }

  /** Submit (or re-submit) the org's 10DLC SMS registration. */
  async submitSmsCampaign(
    payload: SmsCampaignPayload
  ): Promise<{ success: boolean; message: string }> {
    return apiClient.post('/org/sms-campaign', payload);
  }

  // --- Call Verification (business KYC) ------------------------------------

  /** The org's KYC gate status + daily caps (reskin only). */
  async getCallVerification(): Promise<{ success: boolean; data: OrgCallVerification }> {
    return apiClient.get('/call-verification');
  }

  /** The org's KYC review state (submitted / reviewStatus / reviewer notes). */
  async getCallVerificationReview(): Promise<{ success: boolean; data: OrgCallVerificationReview }> {
    return apiClient.get('/call-verification/review');
  }

  /** Submit (or re-submit) the org's business-KYC to unlock uncapped calling. */
  async submitCallVerification(
    payload: CallVerificationPayload
  ): Promise<{ success: boolean; message: string }> {
    return apiClient.post('/call-verification', payload);
  }

  // --- Billing -------------------------------------------------------------

  async getBilling(): Promise<{ success: boolean; data: OrgBilling }> {
    return apiClient.get('/org/billing');
  }

  async cancelSubscription(): Promise<{ success: boolean; message: string }> {
    return apiClient.post('/org/billing/cancel');
  }

  async reactivateSubscription(): Promise<{ success: boolean; message: string }> {
    return apiClient.post('/org/billing/reactivate');
  }

  /** Stripe Billing Portal URL for editing the payment method. */
  async billingPortal(returnUrl: string): Promise<{ success: boolean; data: { url: string } }> {
    return apiClient.post('/org/billing/portal', { returnUrl });
  }

  /** Purchase additional dialer seat licenses. */
  async purchaseSeats(
    seats: number,
    notes?: string
  ): Promise<{
    success: boolean;
    data: {
      seatsAdded: number;
      newTotalSeats: number;
      unitPriceCents: number;
      proratedAmountCents: number;
    };
  }> {
    return apiClient.post('/org-portal/seats/purchase', { seats, notes });
  }

  async getSettings(): Promise<{ success: boolean; data: OrgSettings }> {
    return apiClient.get('/org/settings');
  }

  async updateSettings(data: { name?: string }): Promise<{ success: boolean; message: string }> {
    return apiClient.put('/org/settings', data);
  }

  /** Update the signed-in user's own display name. */
  async updateProfile(fullName: string): Promise<{ success: boolean; message: string }> {
    return apiClient.put('/org/profile', { fullName });
  }
}

export const orgApiService = new OrgApiService();
