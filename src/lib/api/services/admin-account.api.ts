/**
 * Admin Account Provisioning API
 *
 * Powers the admin "Create Account" wizard: search a number to buy, then create
 * a fully-provisioned account (org + owner + number + calling, optional SMS) in
 * one call.
 */
import { apiClient } from '../client';
import type { ApiResponse } from '@/lib/types';

export interface AvailableNumber {
  phoneNumber: string;
  countryCode: string;
  region: string;
  locality: string;
  numberType: 'local' | 'toll_free' | 'national';
  features: string[];
  monthlyCostCents: number;
  upfrontCostCents: number;
}

/** Per-customer custom plan the super-admin builds at onboarding (or edits later). */
export interface CustomPlanInput {
  /** Monthly price in CENTS. */
  priceCents: number;
  label?: string;
  /** Max user accounts (seats). >= 1. */
  seats: number;
  /** Baseline standard seat price in cents (default $80.00 = 8000). */
  standardSeatPriceCents?: number;
  /** Agreed per-seat price in cents. */
  agreedSeatPriceCents?: number;
  /** Concurrent device logins per user. 0 = unlimited. */
  devicesPerUser: number;
  /** @deprecated SMS is agent-assigned (sms_soft_cap) + stacked packages, not a plan
   *  field. Optional/ignored — kept only for back-compat with older callers. */
  smsAllowance?: number;
  /** Phone numbers included before the per-number fee. >= 0. */
  includedNumbers: number;
  /** Hard cap on how many numbers the org may hold total. >= 1 and >= includedNumbers. */
  maxNumbers: number;
}

export interface CreateAccountInput {
  businessName: string;
  businessNature?: string;
  contactName: string;
  contactEmail: string;
  password: string;
  planSlug: 'starter' | 'professional' | 'custom';
  /** Required when planSlug === 'custom'. */
  customPlan?: CustomPlanInput;
  /** @deprecated single number — prefer `numbers`. Kept for back-compat. */
  number?: {
    phoneNumber: string;
    countryCode?: string;
    region?: string;
    locality?: string;
    numberType?: 'local' | 'toll_free' | 'national';
  };
  /**
   * Numbers to provision. A custom plan can INCLUDE several (e.g. 3), so the
   * wizard sends all the admin selected. At least one is required (the server
   * accepts `number` OR `numbers`). Costs are comped for admin-created accounts.
   */
  numbers?: Array<{
    phoneNumber: string;
    countryCode?: string;
    region?: string;
    locality?: string;
    numberType?: 'local' | 'toll_free' | 'national';
  }>;
  /** 'subaccount' = calls only (isolated); 'mother' = calls + instant SMS. */
  accountType?: 'subaccount' | 'mother';
  /**
   * Assign into an existing SMS-active Telnyx managed sub-account (from
   * adminAccountApi.listSmsSubaccounts). Number is bought inside it, attached to
   * its messaging profile + ACTIVE 10DLC campaign — full calls + SMS immediately.
   * Takes precedence over accountType.
   */
  assignManagedAccountId?: string;
  brandOrigin?: string;
  bypassKyc?: boolean;
  /** Put the account on the trial cap instead of unlimited. */
  trialMode?: boolean;
  /** Editable trial caps (only when trialMode). Omitted → default 100 each. */
  trialCallMinutes?: number;
  trialSms?: number;
  smsPackageSlug?: string;
  smsAutoRenew?: boolean;
  /** Starting org-wide monthly SMS allowance (agent-set → sms_soft_cap). 0 = unlimited. */
  initialSmsAllowance?: number;
}

export interface CreateAccountResult {
  orderId: number;
  organizationId: number;
  ownerUserId: number;
  phoneNumber: string;
  extension: string | null;
  smsPackageGranted: string | null;
  /**
   * True only when the account is fully usable (number purchased + SIP extension
   * created). False when provisioning didn't finish — the wizard then shows a
   * "finish in Signups" retry state instead of "Account is live".
   */
  provisioningComplete: boolean;
}

/** A Telnyx managed sub-account as the admin sees it (identity + our registration). */
export interface AdminSmsSubaccount {
  managedAccountId: string;
  organizationName: string | null;
  email: string | null;
  status: string | null;
  registered: boolean;
  smsActive: boolean;
  /** Super-admin flag: is this sub offered to NEW signups? (registered subs only) */
  signupEnabled: boolean;
  campaignStatus: string | null;
  messagingProfileId: string | null;
  hasVoiceKeycard: boolean;
  lastVerifiedAt: string | null;
}

/** A number a sub owns, flagged free (assignable, no purchase) vs already taken. */
export interface SubaccountNumber {
  phoneNumber: string; // 11-digit, no '+'
  status: string | null;
  free: boolean;
  assignedTo: string | null;
}

/** One row of the super-admin Trunk Usage console (per org, TODAY). */
export interface TrunkUsageRow {
  organizationId: number;
  name: string;
  egressTrunk: 'telnyx' | 'tozcall';
  shortCalls: number;
  shortMinutes: number;
  longCalls: number;
  longMinutes: number;
  unansweredCalls: number;
  totalMinutes: number;
  /** Avg minutes/day over the last 7 days — the basis for the red-flag threshold. */
  avgDailyMinutes: number;
}
export interface TrunkUsageMeta {
  shortCutoffSec: number;
  from: string;
  to: string;
  days: number;
  generatedAt: string;
}
export interface SwitchTrunkResult {
  organizationId: number;
  trunk: 'telnyx' | 'tozcall';
  extensionsUpdated: number;
  extensionsFailed: number;
  warning?: string;
}

export interface TrunkTotalsBucket {
  /** Connected talk minutes over the range. */
  minutes: number;
  /** Connected outbound calls over the range. */
  calls: number;
}
export interface TrunkTotals {
  from: string;
  to: string;
  days: number;
  /** Telnyx mother account + ALL sub-accounts combined. */
  telnyx: TrunkTotalsBucket;
  tozcall: TrunkTotalsBucket;
  /** Other egress paths / calls placed before CDR trunk-tagging shipped. */
  untagged: TrunkTotalsBucket;
  generatedAt: string;
}

export const adminAccountApi = {
  async searchNumbers(params: {
    countryCode?: string;
    areaCode?: string;
    locality?: string;
    numberType?: 'local' | 'toll_free' | 'national';
    limit?: number;
    /** Search on this org's Telnyx account (its sub-account if any, else mother) so
     * the picked number is orderable on the account the buy provisions to. */
    organizationId?: number;
  }): Promise<AvailableNumber[]> {
    const res = await apiClient.post<ApiResponse<AvailableNumber[]>>(
      '/admin/accounts/search-numbers',
      { countryCode: 'US', ...params }
    );
    return res.data;
  },

  async createAccount(input: CreateAccountInput): Promise<CreateAccountResult> {
    const res = await apiClient.post<ApiResponse<CreateAccountResult>>('/admin/accounts', input);
    return res.data;
  },

  /** Super-admin Trunk Usage console — per-org usage over [from,to] + current trunk. */
  async getTrunkUsage(params: {
    from: string;
    to: string;
    shortCutoffSec?: number;
  }): Promise<{ data: TrunkUsageRow[]; meta: TrunkUsageMeta }> {
    const res = await apiClient.get<ApiResponse<TrunkUsageRow[]> & { meta: TrunkUsageMeta }>(
      '/admin/trunk-usage',
      { params: { from: params.from, to: params.to, shortCutoff: params.shortCutoffSec ?? 60 } }
    );
    return { data: res.data, meta: res.meta };
  },

  /** Flip one org's outbound trunk (telnyx <-> tozcall). Super-admin. */
  async switchOrgTrunk(
    organizationId: number,
    trunk: 'telnyx' | 'tozcall'
  ): Promise<SwitchTrunkResult> {
    const res = await apiClient.post<ApiResponse<SwitchTrunkResult>>(
      `/admin/trunk-usage/${organizationId}/switch`,
      { trunk }
    );
    return res.data;
  },

  /** Fleet per-trunk connected minutes (Telnyx mother+subs vs Tozcall) over [from,to]. */
  async getTrunkTotals(params: { from: string; to: string }): Promise<TrunkTotals> {
    const res = await apiClient.get<ApiResponse<TrunkTotals>>('/admin/trunk-totals', {
      params: { from: params.from, to: params.to },
    });
    return res.data;
  },

  /** Edit an org's CUSTOM plan after onboarding (price/seats/devices/SMS/included numbers). */
  async updateCustomPlan(
    orgId: number,
    input: CustomPlanInput
  ): Promise<CustomPlanInput & { organizationId: number }> {
    const res = await apiClient.patch<ApiResponse<CustomPlanInput & { organizationId: number }>>(
      `/admin/accounts/${orgId}/custom-plan`,
      input
    );
    return res.data;
  },

  /** List Telnyx managed sub-accounts merged with our SMS registration. */
  async listSmsSubaccounts(): Promise<AdminSmsSubaccount[]> {
    const res =
      await apiClient.get<ApiResponse<AdminSmsSubaccount[]>>('/admin/telnyx/sms-subaccounts');
    return res.data;
  },

  /** Per-org usage (calls/minutes/SMS), server-sorted + paginated. Org customers only. */
  async getOrgUsage(params?: {
    from?: string;
    to?: string;
    page?: number;
    limit?: number;
    sort?: OrgUsageSortKey;
  }): Promise<{ data: OrgUsage[]; meta: OrgUsageMeta }> {
    const res = await apiClient.get<ApiResponse<OrgUsage[]> & { meta: OrgUsageMeta }>(
      '/admin/org-usage',
      { params: params as Record<string, string | number | undefined> }
    );
    return { data: res.data, meta: res.meta };
  },

  /** Register a managed sub-account for SMS by pasting its V2 API key (verified). */
  async registerSmsSubaccount(input: {
    managedAccountId: string;
    apiKey: string;
    label?: string;
  }): Promise<AdminSmsSubaccount> {
    const res = await apiClient.post<ApiResponse<AdminSmsSubaccount>>(
      '/admin/telnyx/sms-subaccounts',
      input
    );
    return res.data;
  },

  /** List a registered sub's owned numbers, flagged free vs already-assigned. */
  async listSmsSubaccountNumbers(managedAccountId: string): Promise<SubaccountNumber[]> {
    const res = await apiClient.get<ApiResponse<SubaccountNumber[]>>(
      `/admin/telnyx/sms-subaccounts/${encodeURIComponent(managedAccountId)}/numbers`
    );
    return res.data;
  },

  /** Remove a registered sub-account from our registry (does not touch Telnyx). */
  async unregisterSmsSubaccount(managedAccountId: string): Promise<void> {
    await apiClient.delete(
      `/admin/telnyx/sms-subaccounts/${encodeURIComponent(managedAccountId)}`
    );
  },

  /** Mother-account owned numbers (free vs assigned) — for assigning an existing free number on the mother path. */
  async listMotherNumbers(): Promise<SubaccountNumber[]> {
    const res = await apiClient.get<ApiResponse<SubaccountNumber[]>>('/admin/telnyx/mother-numbers');
    return res.data;
  },

  /** List an organization's phone numbers (number, assignee, flags). */
  async listOrgNumbers(orgId: number): Promise<OrgNumber[]> {
    const res = await apiClient.get<ApiResponse<OrgNumber[]>>(`/admin/organizations/${orgId}/numbers`);
    return res.data;
  },

  /**
   * Assign/reassign an EXISTING org number to a member — or unassign (userId=null).
   * Reuses the proven server-side assignNumber engine (extension + sub keycard +
   * caller-ID-on-assign + inbound route + user_phone_numbers). Super-admin only.
   */
  async assignOrgNumber(
    orgId: number,
    numberId: number,
    userId: number | null,
    importHistory?: boolean
  ): Promise<void> {
    await apiClient.post<ApiResponse<unknown>>(
      `/admin/organizations/${orgId}/numbers/${numberId}/assign`,
      { userId, ...(importHistory !== undefined ? { importHistory } : {}) }
    );
  },

  /**
   * Create a team member inside an org via the proven owner engine (extension +
   * number assignment + sub keycard + inbound route). Returns the new user with
   * its allocated extension.
   */
  async createOrgMember(
    orgId: number,
    input: { fullName: string; email: string; password: string; role: 'user' | 'manager'; senderPhone?: string }
  ): Promise<{ id: number; fullName: string; email: string; extension: string }> {
    const res = await apiClient.post<ApiResponse<{ id: number; fullName: string; email: string; extension: string }>>(
      `/admin/organizations/${orgId}/users`,
      input
    );
    return res.data;
  },

  /** READ-ONLY end-to-end diagnostic for a single number (no writes on prod). */
  async diagnoseNumber(number: string): Promise<NumberDiagnostic> {
    const res = await apiClient.get<ApiResponse<NumberDiagnostic>>(
      `/admin/diagnostics/number/${encodeURIComponent(number)}`
    );
    return res.data;
  },

  /** READ-ONLY org sweep: run the per-number diagnostic across all the org's numbers. */
  async diagnoseOrg(orgId: number): Promise<OrgDiagnostic> {
    const res = await apiClient.get<ApiResponse<OrgDiagnostic>>(`/admin/diagnostics/org/${orgId}`);
    return res.data;
  },

  /** Auto-heal one diagnostic dimension; returns the fresh post-heal diagnostic. */
  async repairNumber(number: string, action: string): Promise<{ action: string; steps: RepairStep[]; diagnostic: NumberDiagnostic }> {
    const res = await apiClient.post<ApiResponse<{ action: string; steps: RepairStep[]; diagnostic: NumberDiagnostic }>>(
      `/admin/diagnostics/number/${encodeURIComponent(number)}/repair`,
      { action }
    );
    return res.data;
  },

  /** Cross-org phone-number stats: total split by mother trunk vs sub-accounts. */
  async getNumberStats(): Promise<NumberStats> {
    const res = await apiClient.get<ApiResponse<NumberStats>>('/admin/numbers/stats');
    return res.data;
  },

  /** Dashboard: Telnyx mother-account balance + SMS-active sub-account count. */
  async getPlatformStats(): Promise<PlatformStats> {
    const res = await apiClient.get<ApiResponse<PlatformStats>>('/admin/telnyx/platform-stats');
    return res.data;
  },

  /** Live Operations: current SIP registrations (who's online), user/org enriched. */
  async getLiveRegistrations(): Promise<{ total: number; registrations: LiveRegistration[] }> {
    const res = await apiClient.get<ApiResponse<{ total: number; registrations: LiveRegistration[] }>>('/admin/live/registrations');
    return res.data;
  },

  /** Cross-org phone-number inventory (search / filter / paginate). */
  async listAllNumbers(params: { search?: string; filter?: string; page?: number; limit?: number }): Promise<AdminNumbersResult> {
    const res = await apiClient.get<ApiResponse<AdminNumbersResult>>('/admin/numbers', {
      params: params as Record<string, string | number | undefined>,
    });
    return res.data;
  },

  /** Buy + provision a DID into an org (no Stripe billing), optionally assigning to a user. */
  async buyOrgNumber(
    orgId: number,
    input: { phoneNumber: string; countryCode?: string; numberType?: 'local' | 'toll_free' | 'national'; assignUserId?: number | null }
  ): Promise<{ id: number; phoneNumber: string; assignedUserId: number | null; assignWarning?: string }> {
    const res = await apiClient.post<ApiResponse<{ id: number; phoneNumber: string; assignedUserId: number | null; assignWarning?: string }>>(
      `/admin/organizations/${orgId}/numbers`,
      input
    );
    return res.data;
  },

  /** (Re)assign a number to a user within its org; userId null = unassign. */
  async reassignNumber(number: string, userId: number | null): Promise<{ organizationId: number; numberId: number; assignedUserId: number | null }> {
    const res = await apiClient.post<ApiResponse<{ organizationId: number; numberId: number; assignedUserId: number | null }>>(
      `/admin/numbers/${encodeURIComponent(number)}/reassign`,
      { userId }
    );
    return res.data;
  },

  /** Set/clear a number's outbound caller-ID name (CNAM). Empty string clears it. */
  async setNumberCallerId(
    orgId: number,
    numberId: number,
    callerIdName: string | null
  ): Promise<{ numberId: number; callerIdName: string | null }> {
    const res = await apiClient.patch<ApiResponse<{ numberId: number; callerIdName: string | null }>>(
      `/admin/organizations/${orgId}/numbers/${numberId}/caller-id-name`,
      { callerIdName: callerIdName ?? '' }
    );
    return res.data;
  },

  /**
   * Release a number from the org entirely — Telnyx release + billing stop +
   * FusionPBX/DB teardown. IRREVERSIBLE (the number is given back to the carrier).
   */
  async releaseNumber(
    orgId: number,
    numberId: number
  ): Promise<{ numberId: number; phoneNumber: string }> {
    const res = await apiClient.delete<ApiResponse<{ numberId: number; phoneNumber: string }>>(
      `/admin/organizations/${orgId}/numbers/${numberId}`
    );
    return res.data;
  },

  /** Org telephony account info (tier + Telnyx ids) for the Infrastructure tab. */
  async getOrgTelephony(orgId: number): Promise<OrgTelephony> {
    const res = await apiClient.get<ApiResponse<OrgTelephony>>(`/admin/organizations/${orgId}/telephony`);
    return res.data;
  },

  /** Org activity timeline (audit events touching the org), paginated. */
  async getOrgActivity(orgId: number, page = 1, limit = 30): Promise<{ items: OrgActivityItem[]; meta: { page: number; limit: number; total: number; totalPages: number } }> {
    const res = await apiClient.get<ApiResponse<OrgActivityItem[]> & { meta: { page: number; limit: number; total: number; totalPages: number } }>(
      `/admin/organizations/${orgId}/activity`,
      { params: { page, limit } }
    );
    return { items: res.data, meta: res.meta };
  },

  /** Deep LIVE health of one Telnyx sub-account (voice / inbound-gateway / SMS). */
  async getSubaccountHealth(managedAccountId: string): Promise<SubaccountHealth> {
    const res = await apiClient.get<ApiResponse<SubaccountHealth>>(
      `/admin/telnyx/sms-subaccounts/${encodeURIComponent(managedAccountId)}/health`
    );
    return res.data;
  },

  /** Repair a sub-account: ensure its gateway + re-sync every active org; returns fresh health. */
  async repairSubaccount(managedAccountId: string): Promise<SubaccountRepairResult> {
    const res = await apiClient.post<ApiResponse<SubaccountRepairResult>>(
      `/admin/telnyx/sms-subaccounts/${encodeURIComponent(managedAccountId)}/repair`,
      {}
    );
    return res.data;
  },

  /**
   * Enable/disable a sub-account AT TELNYX (the kill-switch). Returns the refreshed
   * admin view (or null if it momentarily drops out of the live list).
   */
  async setSubaccountTelnyxStatus(
    managedAccountId: string,
    enabled: boolean
  ): Promise<AdminSmsSubaccount | null> {
    const res = await apiClient.post<ApiResponse<AdminSmsSubaccount | null>>(
      `/admin/telnyx/sms-subaccounts/${encodeURIComponent(managedAccountId)}/telnyx-status`,
      { enabled }
    );
    return res.data;
  },

  /** Offer / withhold a sub for NEW signups (local flag). Returns the refreshed view. */
  async setSubaccountSignupVisibility(
    managedAccountId: string,
    enabled: boolean
  ): Promise<AdminSmsSubaccount | null> {
    const res = await apiClient.post<ApiResponse<AdminSmsSubaccount | null>>(
      `/admin/telnyx/sms-subaccounts/${encodeURIComponent(managedAccountId)}/signup-visibility`,
      { enabled }
    );
    return res.data;
  },
};

export interface OrgActivityItem {
  id: number;
  action: string;
  adminName: string;
  adminEmail: string;
  targetType: string | null;
  targetId: number | null;
  targetName: string | null;
  details: unknown;
  ipAddress: string | null;
  createdAt: string;
}

export interface OrgTelephony {
  tier: 'mother' | 'sub';
  accountStatus: string | null;
  managedAccountId: string | null;
  connectionId: string | null;
  messagingProfileId: string | null;
  campaignId: string | null;
  campaignStatus: string | null;
  hasKeycard: boolean;
  sipUsername: string | null;
}

export type HealthDim = { status: 'ok' | 'warn' | 'bad' | 'unknown'; detail: string };
export interface SubaccountHealth {
  managedAccountId: string;
  voice: HealthDim;
  inbound: HealthDim;
  sms: HealthDim;
  overall: HealthDim;
}
export interface SubaccountRepairResult {
  managedAccountId: string;
  gatewayEnsured: boolean | null;
  orgsResynced: number;
  orgs: Array<{ organizationId: number; ok: boolean; outboundExtensions?: number; error?: string }>;
  health: SubaccountHealth;
}

export interface AdminNumber {
  id: number;
  phoneNumber: string;
  organizationId: number;
  orgName: string | null;
  numberType: string;
  isActive: boolean;
  assignedUserId: number | null;
  assignedUserName: string | null;
  assignedExtension: string | null;
  callerIdName: string | null;
  createdAt: string;
  /** Which Telnyx account the number lives on: 'sub' (org managed sub-account) or 'mother'. */
  tier: 'mother' | 'sub';
  /** The managed sub-account id when tier='sub', else null. */
  managedAccountId: string | null;
  /** Human label for the sub (registry label, else the managed-account id); null on mother. */
  accountLabel: string | null;
}

export interface AdminNumbersResult {
  numbers: AdminNumber[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

export interface NumberStats {
  total: number;
  mother: number;
  sub: number;
  active: number;
  inactive: number;
}

export interface LiveRegistration {
  extension: string;
  userName: string | null;
  userEmail: string | null;
  orgId: number | null;
  orgName: string | null;
  device: string | null;
  from: string | null;
  expiresInSec: number | null;
}

export interface PlatformStats {
  balance: { balance: number | null; availableCredit: number | null; creditLimit: number | null; currency: string | null } | null;
  lowCreditWarn: number;
  subs: { total: number; smsActive: number };
}

export interface OrgUsage {
  organizationId: number;
  organizationName: string;
  slug: string | null;
  status: string | null;
  totalCalls: number;
  answeredCalls: number;
  inboundCalls: number;
  outboundCalls: number;
  callSeconds: number;
  callMinutes: number;
  /** Monthly fair-use cap in minutes; null = unlimited/exempt or not capped. */
  softCapMinutes: number | null;
  /** Minutes used THIS calendar month (vs the cap); null when not capped. */
  monthMinutesUsed: number | null;
  totalSms: number;
  smsSent: number;
  smsReceived: number;
}

export type OrgUsageSortKey = 'totalCalls' | 'callMinutes' | 'totalSms';
export interface OrgUsageMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  totals: { orgs: number; calls: number; minutes: number; sms: number };
}

export type DiagnosticCheckStatus = 'ok' | 'warn' | 'bad' | 'info' | 'unknown' | 'skip';

export interface DiagnosticCheck {
  key: string;
  label: string;
  group: 'Identity' | 'Telnyx' | 'FusionPBX' | 'Live' | 'Calls';
  status: DiagnosticCheckStatus;
  detail: string;
  fix?: string;
}

export interface NumberDiagnostic {
  number: string;
  normalized: string;
  generatedAt: string;
  tier: 'mother' | 'sub' | 'unknown';
  org: { id: number; name: string } | null;
  user: { id: number; name: string | null; email: string | null; extension: string | null } | null;
  verdict: 'healthy' | 'attention' | 'blocked';
  failing: string[];
  fixes: string[];
  checks: DiagnosticCheck[];
}

export interface OrgDiagnostic {
  orgId: number;
  orgName: string | null;
  generatedAt: string;
  summary: { total: number; healthy: number; attention: number; blocked: number };
  numbers: NumberDiagnostic[];
}

export interface RepairStep {
  step: string;
  ok: boolean;
  detail: string;
}

/** Human-friendly label + description + risk for each auto-heal action key. */
export const REPAIR_ACTIONS: Record<string, { label: string; description: string; risk: 'safe' | 'destructive' }> = {
  resync_sub_routing: {
    label: 'Re-sync sub-account routing',
    description: "Rebuild the sub's inbound registration gateway, push its outbound keycard to the org's extensions, and rewire the SMS profile + webhook. Idempotent — re-running makes no further change once correct.",
    risk: 'safe',
  },
  fix_sms_webhook: {
    label: 'Fix SMS webhook',
    description: 'Re-point inbound SMS for this org at this backend (part of the sub routing re-sync). Idempotent.',
    risk: 'safe',
  },
  recreate_inbound_route: {
    label: 'Rebuild inbound route',
    description: "Delete and rebuild the inbound DID dialplan so calls bridge to the user's extension (fixes a missing route or a dangling IVR bridge). Refused automatically if a Call Menu is published on this number.",
    risk: 'destructive',
  },
  normalize_number: {
    label: 'Fix number format',
    description: 'Store the number as 11-digit E.164 without a + prefix.',
    risk: 'safe',
  },
  realign_sub_credential: {
    label: 'Realign sub SIP credential',
    description:
      "The sub's registration gateway is failing to register (FAIL_WAIT) because its SIP password drifted. Resets the password to one fresh value across Telnyx, the sub registry, every org on the sub, and the FreeSWITCH gateway, then forces a fresh registration. Idempotent. Writes to live telephony.",
    risk: 'safe',
  },
  set_telnyx_route: {
    label: 'Enable Telnyx egress route',
    description:
      "Set the server-side telnyx_route=true flag on the extension so outbound calls egress via Telnyx instead of falling back to the default trunk (which rejects the Telnyx-owned number → 503). The durable fix for mother-trunk orgs whose browser tag was lost. Idempotent. Writes to live telephony.",
    risk: 'safe',
  },
};

/** An org's phone number as the admin numbers endpoint returns it. */
export interface OrgNumber {
  id: number;
  organizationId: number;
  phoneNumber: string;
  numberType: string;
  assignedUserId: number | null;
  assignedUserName: string | null;
  isActive: boolean;
  callerIdName: string | null;
}
