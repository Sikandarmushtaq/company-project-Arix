/**
 * Bundle API service — SMS packages (reskin Plan & billing). Calling is unlimited
 * after business KYC; only SMS is sold here, and packages unlock after 10DLC.
 */

import { apiClient } from '../client';

export type BundleSlug = 'sms3k' | 'sms5k' | 'sms10k' | 'sms25k';

export interface BundleDef {
  slug: BundleSlug;
  label: string;
  monthlyCents: number;
  /** Always 0 for SMS packages (calling isn't sold) — kept for type compat. */
  minutes: number;
  sms: number;
}

export interface ActiveBundle {
  slug: BundleSlug;
  label: string;
  minutesIncluded: number;
  smsIncluded: number;
  minutesUsed: number;
  secondsUsed: number;
  smsUsed: number;
  priceCents: number;
  periodStart: string;
  periodEnd: string;
  /** Owner canceled — active until periodEnd, then it expires (won't renew). */
  canceling: boolean;
}

export interface BundleHistoryEntry {
  id: number;
  bundleSlug: BundleSlug;
  minutesIncluded: number;
  smsIncluded: number;
  minutesUsed: number;
  smsUsed: number;
  periodStart: string;
  periodEnd: string;
  endedReason: string;
  archivedAt: string;
}

export interface BundleState {
  kycStatus: 'not_required' | 'pending' | 'approved' | 'rejected';
  /** Business KYC (Call Verification) passed → calling is unlimited. */
  callVerified: boolean;
  /** 10DLC (A2P SMS) registration approved → may buy SMS packages. */
  tenDlcApproved: boolean;
  canPurchase: boolean;
  basePlan: { minutes: number; sms: number };
  catalog: BundleDef[];
  active: ActiveBundle | null;
  history: BundleHistoryEntry[];
}

class BundleApiService {
  /** Catalog + active bundle (live usage) + history + whether the org may buy. */
  async getState(): Promise<{ success: boolean; data: BundleState }> {
    return apiClient.get('/bundles');
  }

  /** Buy or switch to a bundle (owner only). Returns the fresh state. */
  async purchase(slug: BundleSlug): Promise<{ success: boolean; data: BundleState; message: string }> {
    return apiClient.post('/bundles/purchase', { slug });
  }

  /** Cancel the active bundle (owner only). Returns the fresh state. */
  async cancel(): Promise<{ success: boolean; data: BundleState; message: string }> {
    return apiClient.post('/bundles/cancel', {});
  }
}

export const bundleApiService = new BundleApiService();
