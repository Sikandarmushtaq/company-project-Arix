/**
 * Onboarding API Service
 * Public signup flow endpoints — typed, no `any`.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '/api/proxy';

/** Shape of the backend's JSON error envelope (validation + generic errors). */
interface ApiErrorBody {
  error?: {
    message?: string;
    details?: Array<{ field: string; message: string }>;
  };
}

export class ApiValidationError extends Error {
  fields: Array<{ field: string; message: string }>;
  constructor(message: string, fields: Array<{ field: string; message: string }>) {
    super(message);
    this.name = 'ApiValidationError';
    this.fields = fields;
  }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE}/onboarding${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  // The API always replies JSON. If we get something else (an HTML error page
  // from a proxy/gateway hiccup, an empty body, etc.), surface a clear message
  // instead of letting `res.json()` throw a cryptic "Unexpected token '<'".
  const contentType = res.headers.get('content-type') || '';
  let data: unknown = null;
  if (contentType.includes('application/json')) {
    try {
      data = await res.json();
    } catch {
      data = null;
    }
  } else {
    // Drain the body so the connection can be reused; we don't parse it.
    await res.text().catch(() => undefined);
  }

  if (!res.ok) {
    const err = (data as ApiErrorBody | null)?.error;
    if (Array.isArray(err?.details) && err.details.length > 0) {
      throw new ApiValidationError(err.message || 'Validation failed', err.details);
    }
    throw new Error(
      err?.message || `Request failed (${res.status}). Please try again in a moment.`
    );
  }

  if (data === null) {
    throw new Error('Unexpected response from the server. Please try again.');
  }

  return data as T;
}

// ---------------------------------------------------------------------------
// Payload & Response Types
// ---------------------------------------------------------------------------

export interface CreateOrderPayload {
  businessName: string;
  businessNature: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  businessAddress?: string;
  businessWebsite?: string;
  password: string;
  confirmPassword: string;
  /** Chosen plan → backend maps (planSlug, billingPeriod) to a Stripe recurring Price. */
  planSlug?: 'starter' | 'professional';
  billingPeriod?: 'monthly' | 'yearly';
  captchaToken: string;
  tosAccepted: boolean;
}

/** Simplified lead-capture signup payload (no account/numbers/payment). */
export interface CreateLeadPayload {
  contactName: string;
  contactEmail: string;
  whatsappNumber: string;
  campaign: string;
  quantityOfDialers: number;
  /** Feature keys the customer selected (e.g. 'voice_calls', 'whatsapp_calls'). */
  interestedFeatures: string[];
  captchaToken: string;
}

export interface OrderNumber {
  id: number;
  phoneNumber: string;
  countryCode: string;
  region: string | null;
  locality: string | null;
  numberType: string;
  monthlyCostCents: number;
  upfrontCostCents: number;
  provisioningStatus: string;
}

export interface OrderLineItem {
  id: number;
  itemType: string;
  description: string;
  quantity: number;
  unitPriceCents: number;
  totalCents: number;
  metadata: Record<string, unknown> | null;
}

export interface SignupOrderData {
  id: number;
  businessName: string;
  businessNature: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  businessAddress: string | null;
  businessWebsite: string | null;
  status: string;
  smsCampaignRequested: boolean;
  paymentAmountCents: number;
  paymentCurrency: string;
  /**
   * True after the user has clicked the verify link in their inbox.
   * The checkout step gates on this — server returns a 400 with
   * `details[0].code === 'EMAIL_NOT_VERIFIED'` if false. The wizard
   * uses it to swap the "Pay" button for a "Verify email" prompt.
   */
  emailVerified: boolean;
  interestedFeatures?: string[];
  /** Chosen plan (present once the backend stores it — see plans-backend-spec.md). */
  planSlug?: 'starter' | 'professional' | null;
  billingPeriod?: 'monthly' | 'yearly' | null;
  planMonthlyCents?: number | null;
  createdAt: string;
  numbers: OrderNumber[];
  lineItems: OrderLineItem[];
}

export interface AvailableNumber {
  phoneNumber: string;
  countryCode: string;
  region: string;
  locality: string;
  numberType: string;
  /**
   * Telnyx returns feature objects (`{ name: 'voice' }`), NOT bare strings —
   * the search endpoint passes them through as-is. Typed to match the wire
   * shape so the UI can render `f.name` without a cast.
   */
  features: Array<{ name: string }>;
  monthlyCostCents: number;
  upfrontCostCents: number;
}

export interface SelectedNumberPayload {
  phoneNumber: string;
  countryCode: string;
  region?: string;
  locality?: string;
  numberType: string;
  monthlyCostCents: number;
  upfrontCostCents: number;
}

export interface NumberSearchParams {
  country_code: string;
  locality?: string;
  area_code?: string;
  number_type?: string;
  limit?: number;
}

/**
 * 10DLC brand (business) details. Standard brands provide an EIN + entityType;
 * sole proprietors omit both (`registrationType: 'sole_prop'`, phone-OTP verified
 * on the backend). Field names mirror the Telnyx `/10dlc/brand` API.
 */
export interface TenDlcBrandPayload {
  legalCompanyName: string;
  displayName?: string; // DBA / brand name (defaults to legal name)
  entityType?: string; // PRIVATE_PROFIT | PUBLIC_PROFIT | NON_PROFIT | GOVERNMENT | SOLE_PROPRIETOR
  ein?: string; // standard only
  firstName?: string; // business contact
  lastName?: string;
  vertical: string;
  email: string; // support email
  businessContactEmail?: string; // required for PUBLIC_PROFIT
  phone: string;
  mobilePhone?: string; // sole-prop OTP
  street: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  website?: string;
  stockSymbol?: string; // required for PUBLIC_PROFIT
  stockExchange?: string; // required for PUBLIC_PROFIT
}

/** 10DLC campaign details. Field names mirror the Telnyx `/10dlc/campaignBuilder` API. */
export interface TenDlcCampaignPayload {
  usecase: string;
  subUsecases?: string[]; // MIXED only
  description: string;
  sample1: string;
  sample2: string;
  sample3?: string;
  sample4?: string;
  sample5?: string;
  messageFlow: string;
  helpMessage: string;
  optinKeywords: string;
  optinMessage?: string; // opt-in confirmation (required when subscriberOptin)
  optoutKeywords: string;
  optoutMessage?: string; // STOP confirmation (required when subscriberOptout)
  helpKeywords: string;
  termsUrl: string;
  privacyUrl: string;
  subscriberOptin: boolean;
  subscriberOptout: boolean;
  subscriberHelp: boolean;
  termsAndConditions: boolean; // CTA attestation
  embeddedLink: boolean;
  embeddedLinkSample?: string;
  embeddedPhone: boolean;
  ageGated: boolean;
  directLending: boolean;
  numberPool: boolean;
}

/**
 * SMS campaign submission = a per-user 10DLC registration request. The backend
 * STAGES this (admin approves before any Telnyx charge); see docs/10dlc-backend-spec.md.
 */
export interface SmsCampaignPayload {
  registrationType: 'standard' | 'sole_prop';
  brand: TenDlcBrandPayload;
  campaign: TenDlcCampaignPayload;
  /** E.164 numbers (from the order) to register for SMS on this campaign. */
  smsNumbers: string[];
  documents: Array<{ name: string; key: string; type: string; size: number }>;
}

export interface SignupStatusData {
  status: string;
  organizationId: number | null;
  contactEmail: string;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

class OnboardingApiService {
  async createOrder(
    data: CreateOrderPayload
  ): Promise<{ data: { order: SignupOrderData; token: string } }> {
    return request('/', { method: 'POST', body: JSON.stringify(data) });
  }

  async createLead(data: CreateLeadPayload): Promise<{ data: { order: SignupOrderData } }> {
    return request('/lead', { method: 'POST', body: JSON.stringify(data) });
  }

  async getOrder(token: string): Promise<{ data: SignupOrderData }> {
    return request(`/${token}`);
  }

  async updateBusiness(
    token: string,
    data: Partial<CreateOrderPayload>
  ): Promise<{ data: SignupOrderData }> {
    return request(`/${token}/business`, { method: 'PUT', body: JSON.stringify(data) });
  }

  async searchNumbers(params: NumberSearchParams): Promise<{ data: AvailableNumber[] }> {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined) query.set(k, String(v));
    });
    return request(`/numbers/search?${query.toString()}`);
  }

  async setNumbers(
    token: string,
    numbers: SelectedNumberPayload[]
  ): Promise<{ data: SignupOrderData }> {
    return request(`/${token}/numbers`, { method: 'PUT', body: JSON.stringify({ numbers }) });
  }

  async submitSmsCampaign(
    token: string,
    data: SmsCampaignPayload
  ): Promise<{ data: SignupOrderData }> {
    return request(`/${token}/sms-campaign`, { method: 'PUT', body: JSON.stringify(data) });
  }

  /**
   * Get a presigned PUT URL to upload a single SMS-campaign document
   * directly to object storage. The browser PUTs the raw file bytes to
   * `uploadUrl`; we then store `key` in the submitSmsCampaign payload.
   * 10-minute expiry on the URL covers a slow 10MB upload but no more.
   */
  async getSmsCampaignUploadUrl(
    token: string,
    file: { name: string; contentType: string; size: number }
  ): Promise<{ data: { uploadUrl: string; key: string } }> {
    return request(`/${token}/sms-campaign/upload-url`, {
      method: 'POST',
      body: JSON.stringify(file),
    });
  }

  async skipSmsCampaign(token: string): Promise<{ data: SignupOrderData }> {
    return request(`/${token}/sms-campaign/skip`, { method: 'POST' });
  }

  /** Presigned PUT URL for the bank-transfer payment screenshot. */
  async getBankTransferUploadUrl(
    token: string,
    file: { name: string; contentType: string; size: number }
  ): Promise<{ data: { uploadUrl: string; key: string } }> {
    return request(`/${token}/bank-transfer/upload-url`, {
      method: 'POST',
      body: JSON.stringify(file),
    });
  }

  /**
   * Submit the bank-transfer proof key → auto-activates the order. `returnUrl` is
   * the caller's origin (e.g. https://admin.arixcall.com) so provisioning brands
   * the org to the right funnel (arixcall → KYC gate + Telnyx), same as checkout.
   */
  async submitBankTransfer(
    token: string,
    proofKey: string,
    returnUrl?: string
  ): Promise<{ data: { status: string } }> {
    return request(`/${token}/bank-transfer`, {
      method: 'POST',
      body: JSON.stringify({ proofKey, returnUrl }),
    });
  }

  /**
   * Create a Stripe Checkout session and get its hosted URL. `returnUrl` is the
   * caller's origin (e.g. https://arixcall.com) so Stripe sends the customer back
   * to THIS app's success/cancel pages — without it the backend defaults to the
   * main site.
   */
  async createCheckout(
    token: string,
    returnUrl: string
  ): Promise<{ data: { checkoutUrl: string } }> {
    return request(`/${token}/checkout`, {
      method: 'POST',
      body: JSON.stringify({ returnUrl }),
    });
  }

  async getStatus(token: string): Promise<{ data: SignupStatusData }> {
    return request(`/${token}/status`);
  }

  /**
   * Consume the single-use verify token from the user's inbox.
   * Returns `{alreadyVerified}` so the verify page can render the right
   * copy. Throws ApiValidationError / generic Error on invalid / expired
   * link; the verify page surfaces both as a single "link expired" state
   * with a "Resend verification" CTA.
   */
  async verifyEmail(
    verifyToken: string
  ): Promise<{ data: { signupToken: string | null; alreadyVerified: boolean } }> {
    return request(`/verify-email/${verifyToken}`, { method: 'POST' });
  }

  /**
   * Issue a fresh verify token and re-email the user. Rate-limited at
   * the API layer (3/10min). Caller should debounce the button so a
   * frustrated user can't burn the quota in two seconds.
   */
  async resendVerification(token: string): Promise<{ success: boolean }> {
    return request(`/${token}/resend-verification`, { method: 'POST' });
  }

  /**
   * OTP verification — submit the 6-digit code from the email (scoped to the
   * signup access token). Throws ApiValidationError on a wrong/expired code.
   */
  async verifyEmailCode(
    token: string,
    code: string
  ): Promise<{ data: { alreadyVerified: boolean } }> {
    return request(`/${token}/verify-email-code`, {
      method: 'POST',
      body: JSON.stringify({ code }),
    });
  }
}

export const onboardingApiService = new OnboardingApiService();
