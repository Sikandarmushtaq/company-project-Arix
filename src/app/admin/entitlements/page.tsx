'use client';

/**
 * Admin — Tenant Access (super-admin only)
 *
 * Toggle which feature MODULES each tenant (organization) may use. A toggle
 * cascades to everyone under that tenant: e.g. turning Calling off removes the
 * dialer/call pages for that tenant's whole hierarchy. Which role actually sees
 * a page is still decided by role/function — this only gates the module.
 *
 * @module app/admin/entitlements/page
 */

import { useCallback, useEffect, useState } from 'react';
import { FiSliders, FiRefreshCw } from 'react-icons/fi';
import { toast } from '@/lib/stores/toast';
import { usePermissions } from '@/lib/hooks/usePermissions';
import {
  entitlementApi,
  type EntitlementsData,
  type TenantEntitlement,
} from '@/lib/api/services/entitlement.api';

function Toggle({
  on,
  disabled,
  onClick,
}: {
  on: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      role="switch"
      aria-checked={on}
      className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${
        on ? 'bg-[var(--primary-600)]' : 'bg-[var(--muted)] border border-[var(--border)]'
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
          on ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  );
}

export default function TenantAccessPage() {
  const { isSuperAdmin } = usePermissions();
  const [data, setData] = useState<EntitlementsData>({ modules: [], tenants: [] });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null); // `${orgId}:${module}`

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await entitlementApi.list());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load tenant access');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const toggle = async (tenant: TenantEntitlement, moduleCode: string) => {
    const key = `${tenant.organizationId}:${moduleCode}`;
    const next = !tenant.modules[moduleCode];
    setSaving(key);
    // optimistic
    setData((d) => ({
      ...d,
      tenants: d.tenants.map((t) =>
        t.organizationId === tenant.organizationId
          ? { ...t, modules: { ...t.modules, [moduleCode]: next } }
          : t
      ),
    }));
    try {
      await entitlementApi.setModule(tenant.organizationId, moduleCode, next);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update');
      // revert
      setData((d) => ({
        ...d,
        tenants: d.tenants.map((t) =>
          t.organizationId === tenant.organizationId
            ? { ...t, modules: { ...t.modules, [moduleCode]: !next } }
            : t
        ),
      }));
    } finally {
      setSaving(null);
    }
  };

  if (!isSuperAdmin) {
    return (
      <div className="p-6 text-[var(--muted-foreground)]">
        This page is available to the platform super admin only.
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-full">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-[var(--primary-50)] text-[var(--foreground)] dark:bg-[var(--primary-900)]/40">
            <FiSliders className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-xl font-semibold text-[var(--foreground)]">
              Tenant Access
            </h1>
            <p className="text-sm text-[var(--muted-foreground)]">
              Grant feature modules per tenant — they cascade to the tenant&apos;s whole team
            </p>
          </div>
        </div>
        <button
          onClick={() => void load()}
          className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-[var(--foreground)] hover:bg-[var(--muted)]"
        >
          <FiRefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline">Refresh</span>
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--card)]">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-[var(--border)] text-[var(--muted-foreground)]">
            <tr>
              <th className="sticky left-0 z-10 bg-[var(--card)] px-4 py-3 font-medium">Tenant</th>
              {data.modules.map((m) => (
                <th key={m.code} className="px-4 py-3 text-center font-medium whitespace-nowrap">
                  {m.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td
                  colSpan={data.modules.length + 1}
                  className="px-4 py-10 text-center text-[var(--muted-foreground)]"
                >
                  Loading…
                </td>
              </tr>
            ) : data.tenants.length === 0 ? (
              <tr>
                <td colSpan={data.modules.length + 1} className="px-4 py-12 text-center">
                  <FiSliders className="mx-auto mb-3 h-8 w-8 text-[var(--muted-foreground)]" />
                  <p className="text-[var(--foreground)]">No tenants yet</p>
                  <p className="text-sm text-[var(--muted-foreground)]">
                    Organizations you create will appear here to manage their module access.
                  </p>
                </td>
              </tr>
            ) : (
              data.tenants.map((t) => (
                <tr
                  key={t.organizationId}
                  className="border-b border-[var(--border)] last:border-0"
                >
                  <td className="sticky left-0 z-10 bg-[var(--card)] px-4 py-3 font-medium text-[var(--foreground)]">
                    {t.name || `Org #${t.organizationId}`}
                  </td>
                  {data.modules.map((m) => {
                    const key = `${t.organizationId}:${m.code}`;
                    return (
                      <td key={m.code} className="px-4 py-3 text-center">
                        <div className="flex justify-center">
                          <Toggle
                            on={!!t.modules[m.code]}
                            disabled={saving === key}
                            onClick={() => void toggle(t, m.code)}
                          />
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-xs text-[var(--muted-foreground)]">
        Turning a module off hides its pages for that tenant&apos;s whole hierarchy. Which role sees
        which page (e.g. the dialer shows to agents, not admins) is unchanged.
      </p>
    </div>
  );
}
