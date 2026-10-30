/**
 * Tenant entitlement API (super-admin) — toggle which feature modules each
 * tenant may use. Those toggles cascade to everyone under that tenant.
 *
 * @module lib/api/services/entitlement.api
 */

import { apiClient } from '../client';
import type { ApiResponse } from '@/lib/types';

export interface TenantModule {
  code: string;
  label: string;
  defaultEnabled: boolean;
}

export interface TenantEntitlement {
  organizationId: number;
  name: string | null;
  modules: Record<string, boolean>;
}

export interface EntitlementsData {
  modules: TenantModule[];
  tenants: TenantEntitlement[];
}

export const entitlementApi = {
  async list(): Promise<EntitlementsData> {
    const res = await apiClient.get<ApiResponse<EntitlementsData>>('/admin/entitlements');
    return res.data ?? { modules: [], tenants: [] };
  },
  async setModule(organizationId: number, module: string, enabled: boolean): Promise<void> {
    await apiClient.put<ApiResponse<unknown>>(`/admin/entitlements/${organizationId}`, {
      module,
      enabled,
    });
  },
};
