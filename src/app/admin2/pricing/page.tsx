'use client';

/**
 * Pricing plans — admin2. Super-admin CRUD over the platform pricing_plans rate
 * cards (per-country number / SMS / platform-fee / setup-fee pricing). Wired to
 * superadminApiService.getPricingPlans / createPricingPlan / updatePricingPlan /
 * deletePricingPlan. (Self-serve ArixCall plans live in PLAN_CATALOG; this is the
 * legacy rate-card config.)
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  superadminApiService,
  type PricingPlan,
  type CreatePricingPlanData,
} from '@/lib/api/services/superadmin.service';
import { toast } from '@/lib/stores/toast';
import { PageHead, Card, Btn, StatusDot, Modal } from '../_components/ui';

const PLAN_TYPES: CreatePricingPlanData['planType'][] = ['platform_fee', 'sms_service', 'number', 'setup_fee'];
const TYPE_LABEL: Record<string, string> = {
  platform_fee: 'Dialer License Rate',
  sms_service: 'SMS Pricing / Service',
  number: 'Additional Phone Number',
  setup_fee: 'Setup Fee',
};
const fieldCls =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100';
const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;

const EMPTY: CreatePricingPlanData = {
  planType: 'number',
  name: '',
  description: '',
  countryCode: 'US',
  numberType: 'local',
  monthlyPriceCents: 0,
  upfrontPriceCents: 0,
  currency: 'usd',
};

export default function PricingPlansPage() {
  const qc = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<CreatePricingPlanData>(EMPTY);
  const [confirmDelete, setConfirmDelete] = useState<PricingPlan | null>(null);

  const q = useQuery({ queryKey: ['admin2', 'pricing-plans'], queryFn: () => superadminApiService.getPricingPlans(), staleTime: 30_000 });
  const plans = q.data?.data ?? [];
  const invalidate = () => qc.invalidateQueries({ queryKey: ['admin2', 'pricing-plans'] });

  const openCreate = () => { setEditingId(null); setForm(EMPTY); setModalOpen(true); };
  const openEdit = (p: PricingPlan) => {
    setEditingId(p.id);
    setForm({
      planType: p.planType,
      name: p.name,
      description: p.description ?? '',
      countryCode: p.countryCode ?? '',
      numberType: (p.numberType ?? 'local') as NonNullable<CreatePricingPlanData['numberType']>,
      monthlyPriceCents: p.monthlyPriceCents,
      upfrontPriceCents: p.upfrontPriceCents,
      currency: p.currency,
    });
    setModalOpen(true);
  };

  // Create or update (edit = the "U" in CRUD) — same form, branch on editingId.
  const save = useMutation({
    mutationFn: async () => {
      if (editingId != null) await superadminApiService.updatePricingPlan(editingId, form);
      else await superadminApiService.createPricingPlan(form);
    },
    onSuccess: () => {
      toast.success(editingId != null ? 'Plan updated' : 'Plan created');
      setModalOpen(false);
      setEditingId(null);
      setForm(EMPTY);
      invalidate();
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : 'Could not save plan'),
  });
  const toggleActive = useMutation({
    mutationFn: (p: PricingPlan) => superadminApiService.updatePricingPlan(p.id, { isActive: !p.isActive }),
    onSuccess: () => { toast.success('Plan updated'); invalidate(); },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : 'Could not update plan'),
  });
  const remove = useMutation({
    mutationFn: (id: number) => superadminApiService.deletePricingPlan(id),
    onSuccess: () => { toast.success('Plan deleted'); setConfirmDelete(null); invalidate(); },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : 'Could not delete plan'),
  });

  const up = (patch: Partial<CreatePricingPlanData>) => setForm((f) => ({ ...f, ...patch }));

  const openCreateWith = (type: CreatePricingPlanData['planType']) => {
    setEditingId(null);
    setForm({
      ...EMPTY,
      planType: type,
      name:
        type === 'platform_fee'
          ? 'Standard Dialer License'
          : type === 'sms_service'
            ? 'SMS Overage Rate'
            : type === 'number'
              ? 'US Local Number'
              : '',
      monthlyPriceCents:
        type === 'platform_fee' ? 8000 : type === 'sms_service' ? 350 : 0,
      currency: type === 'sms_service' ? 'pkr' : 'usd',
    });
    setModalOpen(true);
  };

  return (
    <section>
      <PageHead
        title="Pricing plans"
        subtitle="Platform product rate cards — manage Standard Dialer License, SMS Overage, and Phone Number product rates."
        actions={
          <div className="flex items-center gap-2">
            <Btn variant="default" onClick={() => openCreateWith('sms_service')}>
              + SMS Rate
            </Btn>
            <Btn variant="default" onClick={() => openCreateWith('platform_fee')}>
              + License Rate
            </Btn>
            <Btn variant="primary" onClick={openCreate}>
              + New plan
            </Btn>
          </div>
        }
      />

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-950/70 dark:text-slate-400">
              <tr>
                <th className="px-4 py-3">Product / Name</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Scope / Country</th>
                <th className="px-4 py-3 text-right">Rate / Monthly</th>
                <th className="px-4 py-3 text-right">Upfront</th>
                <th className="px-4 py-3">Active</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {q.isLoading ? (
                [0, 1, 2].map((i) => (
                  <tr key={i} className="animate-pulse">
                    {[0, 1, 2, 3, 4, 5, 6].map((j) => (
                      <td key={j} className="px-4 py-4">
                        <div className="h-4 rounded bg-slate-200 dark:bg-slate-800" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : plans.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-sm text-slate-400">
                    No pricing plans configured.
                  </td>
                </tr>
              ) : (
                plans.map((p) => (
                  <tr key={p.id}>
                    <td className="px-4 py-4">
                      <div className="font-extrabold">{p.name}</div>
                      {p.description && (
                        <div className="mt-0.5 text-xs text-slate-500">{p.description}</div>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <span
                        className={`inline-block rounded-md px-2 py-0.5 text-xs font-semibold ${p.planType === 'platform_fee'
                            ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300'
                            : p.planType === 'sms_service'
                              ? 'bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300'
                              : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                          }`}
                      >
                        {TYPE_LABEL[p.planType] ?? p.planType}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-slate-600 dark:text-slate-300">
                      {p.planType === 'platform_fee' || p.planType === 'sms_service'
                        ? 'Global'
                        : p.countryCode ?? '—'}
                      {p.numberType ? ` · ${p.numberType}` : ''}
                    </td>
                    <td className="px-4 py-4 text-right tabular-nums font-bold text-slate-900 dark:text-slate-100">
                      {p.planType === 'platform_fee'
                        ? `${money(p.monthlyPriceCents)} / seat`
                        : p.planType === 'sms_service'
                          ? p.currency?.toUpperCase() === 'PKR'
                            ? `Rs ${(p.monthlyPriceCents / 100).toFixed(2)} / SMS`
                            : `${money(p.monthlyPriceCents)} / SMS`
                          : p.currency?.toUpperCase() === 'PKR'
                            ? `Rs ${(p.monthlyPriceCents / 100).toFixed(2)}`
                            : money(p.monthlyPriceCents)}
                    </td>
                    <td className="px-4 py-4 text-right tabular-nums text-slate-500">
                      {p.upfrontPriceCents > 0 ? money(p.upfrontPriceCents) : '—'}
                    </td>
                    <td className="px-4 py-4">
                      <button
                        type="button"
                        disabled={toggleActive.isPending}
                        onClick={() => toggleActive.mutate(p)}
                        className="disabled:opacity-40"
                      >
                        <StatusDot
                          health={p.isActive ? 'ok' : 'off'}
                          label={p.isActive ? 'Active' : 'Inactive'}
                        />
                      </button>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => openEdit(p)}
                          className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDelete(p)}
                          className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950/40"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {modalOpen && (
        <Modal
          title={
            editingId != null
              ? `Edit ${TYPE_LABEL[form.planType] ?? 'pricing plan'}`
              : `New ${TYPE_LABEL[form.planType] ?? 'pricing plan'}`
          }
          subtitle={
            form.planType === 'platform_fee'
              ? 'Defines the system-wide baseline price for 1 user seat licence.'
              : form.planType === 'sms_service'
                ? 'Defines the per-extra SMS charge for usage beyond the included pool.'
                : undefined
          }
          onClose={() => (save.isPending ? undefined : setModalOpen(false))}
          footer={
            <>
              <Btn onClick={() => setModalOpen(false)} disabled={save.isPending}>
                Cancel
              </Btn>
              <Btn
                variant="primary"
                onClick={() => save.mutate()}
                disabled={save.isPending || form.name.trim().length < 2}
              >
                {save.isPending ? 'Saving…' : editingId != null ? 'Save changes' : 'Create plan'}
              </Btn>
            </>
          }
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Product Type
                </span>
                <select
                  className={`mt-1 ${fieldCls}`}
                  value={form.planType}
                  onChange={(e) => {
                    const nextType = e.target.value as CreatePricingPlanData['planType'];
                    up({
                      planType: nextType,
                      countryCode: nextType === 'number' ? form.countryCode || 'US' : '',
                    });
                  }}
                >
                  {PLAN_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {TYPE_LABEL[t]}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Plan Name
                </span>
                <input
                  className={`mt-1 ${fieldCls}`}
                  placeholder={
                    form.planType === 'platform_fee'
                      ? 'e.g. Standard Dialer License'
                      : form.planType === 'sms_service'
                        ? 'e.g. SMS Overage Rate'
                        : 'e.g. US Local Number'
                  }
                  value={form.name}
                  onChange={(e) => up({ name: e.target.value })}
                />
              </label>
            </div>

            {/* Platform Fee: Standard Licence Per-Seat Pricing */}
            {form.planType === 'platform_fee' && (
              <div className="space-y-3">
                <div>
                  <label className="block">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Standard Monthly License Price / Seat ($) *
                    </span>
                    <div className="relative mt-1">
                      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-400">
                        $
                      </span>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        className={`${fieldCls} pl-7 font-bold text-slate-900 dark:text-slate-100`}
                        value={(form.monthlyPriceCents / 100).toString()}
                        onChange={(e) =>
                          up({
                            monthlyPriceCents: Math.round(
                              (parseFloat(e.target.value) || 0) * 100
                            ),
                          })
                        }
                      />
                    </div>
                  </label>
                </div>

                {/* <div className="rounded-lg border border-blue-100 bg-blue-50/70 p-3 text-xs text-blue-900 dark:border-blue-900/40 dark:bg-blue-950/20 dark:text-blue-200 space-y-1.5">
                  <div className="font-bold flex items-center gap-1.5">
                    <span>ℹ️</span> 1 Dialer License includes:
                  </div>
                  <ul className="list-disc list-inside space-y-0.5 text-blue-800/90 dark:text-blue-300">
                    <li>1 User seat</li>
                    <li>1 Phone number</li>
                    <li>100 SMS pooled allowance</li>
                    <li>Unlimited minutes (4,000 DB cap)</li>
                  </ul>
                  <p className="mt-1 text-[11px] text-blue-700 dark:text-blue-400">
                    Sales can negotiate a price that deviates from this standard during onboarding
                    (e.g. $70 or $90); the deviation will be tracked automatically per organization.
                  </p>
                </div> */}
              </div>
            )}

            {/* SMS Service: Per Extra SMS Rate */}
            {form.planType === 'sms_service' && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <label className="block">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Currency
                    </span>
                    <select
                      className={`mt-1 ${fieldCls}`}
                      value={(form.currency || 'PKR').toUpperCase()}
                      onChange={(e) => up({ currency: e.target.value.toLowerCase() })}
                    >
                      <option value="PKR">PKR (Rs - Pakistani Rupee)</option>
                      <option value="USD">USD ($ - US Dollar)</option>
                    </select>
                  </label>

                  <label className="block">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Per Extra SMS Rate *
                    </span>
                    <div className="relative mt-1">
                      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-400">
                        {(form.currency || 'PKR').toUpperCase() === 'PKR' ? 'Rs' : '$'}
                      </span>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        className={`${fieldCls} pl-9 font-bold text-slate-900 dark:text-slate-100`}
                        value={(form.monthlyPriceCents / 100).toString()}
                        onChange={(e) =>
                          up({
                            monthlyPriceCents: Math.round((parseFloat(e.target.value) || 0) * 100),
                          })
                        }
                        placeholder={
                          (form.currency || 'PKR').toUpperCase() === 'PKR' ? '3.50' : '0.035'
                        }
                      />
                    </div>
                  </label>
                </div>

                {(form.currency || 'PKR').toUpperCase() === 'PKR' ? (
                  <div className="rounded-lg border border-purple-100 bg-purple-50/70 p-3 text-xs text-purple-900 dark:border-purple-900/40 dark:bg-purple-950/20 dark:text-purple-200">
                    <span className="font-semibold">Conversion preview:</span> Rs{' '}
                    {(form.monthlyPriceCents / 100).toFixed(2)} PKR ≈ ${' '}
                    {((form.monthlyPriceCents / 100) / 280).toFixed(4)} USD (at 280 PKR/USD ledger exchange rate).
                  </div>
                ) : (
                  <span className="mt-1 block text-xs text-slate-500">
                    Applied when an organization exceeds its total included 100 SMS pool.
                  </span>
                )}
              </div>
            )}

            {/* Additional Number: Country, Number Type, Monthly, Upfront */}
            {form.planType === 'number' && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <label className="block">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Country Code
                    </span>
                    <input
                      className={`mt-1 ${fieldCls}`}
                      placeholder="US"
                      value={form.countryCode ?? ''}
                      onChange={(e) => up({ countryCode: e.target.value.toUpperCase() })}
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Number Type
                    </span>
                    <select
                      className={`mt-1 ${fieldCls}`}
                      value={form.numberType ?? 'local'}
                      onChange={(e) =>
                        up({
                          numberType: e.target.value as CreatePricingPlanData['numberType'],
                        })
                      }
                    >
                      <option value="local">Local</option>
                      <option value="toll_free">Toll-Free</option>
                      <option value="national">National</option>
                    </select>
                  </label>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <label className="block">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Monthly ($)
                    </span>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      className={`mt-1 ${fieldCls}`}
                      value={(form.monthlyPriceCents / 100).toString()}
                      onChange={(e) =>
                        up({
                          monthlyPriceCents: Math.round(
                            (parseFloat(e.target.value) || 0) * 100
                          ),
                        })
                      }
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Upfront ($)
                    </span>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      className={`mt-1 ${fieldCls}`}
                      value={(form.upfrontPriceCents / 100).toString()}
                      onChange={(e) =>
                        up({
                          upfrontPriceCents: Math.round(
                            (parseFloat(e.target.value) || 0) * 100
                          ),
                        })
                      }
                    />
                  </label>
                </div>
              </>
            )}

            {/* Setup Fee */}
            {form.planType === 'setup_fee' && (
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  One-time Setup Fee ($)
                </span>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  className={`mt-1 ${fieldCls}`}
                  value={(form.upfrontPriceCents / 100).toString()}
                  onChange={(e) =>
                    up({
                      upfrontPriceCents: Math.round(
                        (parseFloat(e.target.value) || 0) * 100
                      ),
                    })
                  }
                />
              </label>
            )}

            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Description (Optional)
              </span>
              <input
                className={`mt-1 ${fieldCls}`}
                placeholder="Optional notes or terms"
                value={form.description ?? ''}
                onChange={(e) => up({ description: e.target.value })}
              />
            </label>
          </div>
        </Modal>
      )}

      {confirmDelete && (
        <Modal
          title={`Delete "${confirmDelete.name}"?`}
          onClose={() => (remove.isPending ? undefined : setConfirmDelete(null))}
          footer={
            <>
              <Btn onClick={() => setConfirmDelete(null)} disabled={remove.isPending}>Cancel</Btn>
              <Btn variant="danger" onClick={() => remove.mutate(confirmDelete.id)} disabled={remove.isPending}>
                {remove.isPending ? 'Deleting…' : 'Delete plan'}
              </Btn>
            </>
          }
        >
          <p className="text-sm text-slate-600 dark:text-slate-300">This removes the rate card. Existing subscriptions are unaffected (they bill on their own Stripe prices).</p>
        </Modal>
      )}
    </section>
  );
}
