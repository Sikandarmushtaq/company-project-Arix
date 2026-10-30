'use client';

/**
 * Customer Plans — admin2. Super-admin CRUD over reusable CUSTOM-PLAN templates
 * (custom_plan_templates). Saved plans appear as a dropdown wherever a plan is
 * set (onboarding, change-plan); the ad-hoc builder stays the fallback.
 * Wired to planTemplateApi (/admin/plan-templates).
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { planTemplateApi, type PlanTemplate, type PlanTemplateInput } from '@/lib/api/services/plan-template.api';
import { toast } from '@/lib/stores/toast';
import { PageHead, Card, Btn, Modal } from '../_components/ui';

const fieldCls =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100';
const money = (c: number) => `$${(c / 100).toFixed(2)}`;
const qty = (n: number, unlimitedAt0 = false) => (unlimitedAt0 && n === 0 ? 'Unlimited' : n.toLocaleString());

interface FormState {
  name: string;
  price: string; // dollars
  seats: string;
  devices: string;
  sms: string;
  included: string;
  maxNumbers: string;
}
const EMPTY: FormState = { name: '', price: '', seats: '5', devices: '3', sms: '1000', included: '1', maxNumbers: '5' };

function toForm(p: PlanTemplate): FormState {
  return {
    name: p.name,
    price: (p.monthlyCents / 100).toString(),
    seats: String(p.seats),
    devices: String(p.devicesPerUser),
    sms: String(p.smsAllowance),
    included: String(p.includedNumbers),
    maxNumbers: String(p.maxNumbers),
  };
}

export default function CustomerPlansPage() {
  const qc = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [confirmDelete, setConfirmDelete] = useState<PlanTemplate | null>(null);

  // Management view shows ALL (active + archived) so archived plans can be restored.
  const q = useQuery({ queryKey: ['admin2', 'plan-templates', 'all'], queryFn: () => planTemplateApi.list(true), staleTime: 30_000 });
  const plans = q.data ?? [];
  // Invalidate the whole plan-templates tree (management view + the pickers' active-only query).
  const invalidate = () => qc.invalidateQueries({ queryKey: ['admin2', 'plan-templates'] });

  const archive = useMutation({
    mutationFn: ({ id, active }: { id: number; active: boolean }) => planTemplateApi.setActive(id, active),
    onSuccess: (_d, v) => { toast.success(v.active ? 'Plan restored' : 'Plan archived'); invalidate(); },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : 'Could not update the plan'),
  });

  const includedNum = Math.max(0, parseInt(form.included, 10) || 0);
  const maxNum = Math.max(1, parseInt(form.maxNumbers, 10) || 1);
  const valid =
    form.name.trim().length > 0 &&
    form.price.trim() !== '' &&
    !Number.isNaN(parseFloat(form.price)) &&
    parseFloat(form.price) >= 0 &&
    (parseInt(form.seats, 10) || 0) >= 1 &&
    maxNum >= includedNum;

  const payload = (): PlanTemplateInput => ({
    name: form.name.trim(),
    monthlyCents: Math.max(0, Math.round((parseFloat(form.price) || 0) * 100)),
    seats: Math.max(1, parseInt(form.seats, 10) || 1),
    devicesPerUser: Math.max(0, parseInt(form.devices, 10) || 0),
    smsAllowance: Math.max(0, parseInt(form.sms, 10) || 0),
    includedNumbers: includedNum,
    maxNumbers: Math.max(1, includedNum, parseInt(form.maxNumbers, 10) || 1),
  });

  const save = useMutation({
    mutationFn: () => (editingId ? planTemplateApi.update(editingId, payload()) : planTemplateApi.create(payload())),
    onSuccess: () => {
      toast.success(editingId ? 'Plan updated' : 'Plan saved');
      setModalOpen(false);
      invalidate();
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : 'Could not save the plan'),
  });

  const del = useMutation({
    mutationFn: (id: number) => planTemplateApi.remove(id),
    onSuccess: () => {
      toast.success('Plan deleted');
      setConfirmDelete(null);
      invalidate();
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : 'Could not delete the plan'),
  });

  const openCreate = () => { setEditingId(null); setForm(EMPTY); setModalOpen(true); };
  const openEdit = (p: PlanTemplate) => { setEditingId(p.id); setForm(toForm(p)); setModalOpen(true); };
  const set = (k: keyof FormState, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const num = (v: string) => v.replace(/[^\d]/g, '');

  return (
    <section>
      <PageHead
        title="Customer Plans"
        subtitle="Saved custom plans the team can pick from a dropdown when creating or changing an organization’s plan."
        actions={<Btn variant="primary" onClick={openCreate}>New plan</Btn>}
      />

      <Card className="mt-4 overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs font-bold uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:bg-slate-900/40">
              <tr>
                <th className="px-4 py-3">Plan</th>
                <th className="px-4 py-3 text-right">Price / mo</th>
                <th className="px-4 py-3 text-right">Seats</th>
                <th className="px-4 py-3 text-right">Devices / user</th>
                <th className="px-4 py-3 text-right">SMS / mo</th>
                <th className="px-4 py-3 text-right">Numbers</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {q.isLoading ? (
                <tr><td colSpan={8} className="px-4 py-10 text-center text-slate-400">Loading…</td></tr>
              ) : plans.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-10 text-center text-slate-400">No saved plans yet. Create one, or build plans ad-hoc during onboarding.</td></tr>
              ) : (
                plans.map((p) => (
                  <tr key={p.id} className={`hover:bg-slate-50 dark:hover:bg-slate-900/40 ${p.isActive ? '' : 'opacity-60'}`}>
                    <td className="px-4 py-3 font-bold">{p.name}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{money(p.monthlyCents)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{p.seats}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{qty(p.devicesPerUser, true)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{qty(p.smsAllowance, true)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{p.includedNumbers} free / {p.maxNumbers} max</td>
                    <td className="px-4 py-3">
                      <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-bold ${p.isActive ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-slate-400/15 text-slate-500'}`}>
                        {p.isActive ? 'Active' : 'Archived'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <Btn size="sm" onClick={() => openEdit(p)}>Edit</Btn>
                        {p.isActive ? (
                          <Btn size="sm" onClick={() => archive.mutate({ id: p.id, active: false })} disabled={archive.isPending}>Archive</Btn>
                        ) : (
                          <Btn size="sm" variant="primary" onClick={() => archive.mutate({ id: p.id, active: true })} disabled={archive.isPending}>Restore</Btn>
                        )}
                        <Btn size="sm" variant="danger" onClick={() => setConfirmDelete(p)}>Delete</Btn>
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
          title={editingId ? 'Edit plan' : 'New plan'}
          subtitle="All-inclusive monthly price + the org’s limits. SMS is a shared org pool. 0 = unlimited for devices / SMS."
          onClose={() => (save.isPending ? undefined : setModalOpen(false))}
          footer={
            <>
              <Btn onClick={() => setModalOpen(false)} disabled={save.isPending}>Cancel</Btn>
              <Btn variant="primary" onClick={() => save.mutate()} disabled={!valid || save.isPending}>
                {save.isPending ? 'Saving…' : editingId ? 'Save' : 'Create'}
              </Btn>
            </>
          }
        >
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-bold">Plan name
                <input value={form.name} onChange={(e) => set('name', e.target.value)} className={`mt-1.5 ${fieldCls}`} placeholder="e.g. Growth, Fleet 10" />
              </label>
              <label className="text-sm font-bold">Monthly price (USD)
                <div className="relative mt-1.5">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-400">$</span>
                  <input inputMode="decimal" value={form.price} onChange={(e) => set('price', e.target.value.replace(/[^\d.]/g, ''))} className={`${fieldCls} pl-7`} placeholder="99" />
                </div>
              </label>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <label className="text-sm font-bold">Seats
                <input inputMode="numeric" value={form.seats} onChange={(e) => set('seats', num(e.target.value))} className={`mt-1.5 ${fieldCls}`} placeholder="5" />
              </label>
              <label className="text-sm font-bold">Devices / user
                <input inputMode="numeric" value={form.devices} onChange={(e) => set('devices', num(e.target.value))} className={`mt-1.5 ${fieldCls}`} placeholder="3" />
                <span className="mt-1 block text-xs font-normal text-slate-500">0 = unlimited</span>
              </label>
              <label className="text-sm font-bold">SMS / mo (pool)
                <input inputMode="numeric" value={form.sms} onChange={(e) => set('sms', num(e.target.value))} className={`mt-1.5 ${fieldCls}`} placeholder="1000" />
                <span className="mt-1 block text-xs font-normal text-slate-500">0 = unlimited</span>
              </label>
              <label className="text-sm font-bold">Included numbers
                <input inputMode="numeric" value={form.included} onChange={(e) => set('included', num(e.target.value))} className={`mt-1.5 ${fieldCls}`} placeholder="1" />
                <span className="mt-1 block text-xs font-normal text-slate-500">free; extras $5/mo</span>
              </label>
            </div>
            <label className="block text-sm font-bold sm:max-w-[12rem]">Max numbers
              <input inputMode="numeric" value={form.maxNumbers} onChange={(e) => set('maxNumbers', num(e.target.value))} className={`mt-1.5 ${fieldCls}`} placeholder="5" />
              <span className={`mt-1 block text-xs font-normal ${maxNum < includedNum ? 'text-red-500' : 'text-slate-500'}`}>
                {maxNum < includedNum ? 'must be ≥ included' : 'total cap on numbers'}
              </span>
            </label>
          </div>
        </Modal>
      )}

      {confirmDelete && (
        <Modal
          title="Delete this plan?"
          subtitle={confirmDelete.name}
          onClose={() => (del.isPending ? undefined : setConfirmDelete(null))}
          footer={
            <>
              <Btn onClick={() => setConfirmDelete(null)} disabled={del.isPending}>Cancel</Btn>
              <Btn variant="danger" onClick={() => del.mutate(confirmDelete.id)} disabled={del.isPending}>
                {del.isPending ? 'Deleting…' : 'Delete'}
              </Btn>
            </>
          }
        >
          <p className="text-sm text-slate-600 dark:text-slate-300">
            This only removes the saved template from the dropdown. Organizations already on this plan keep their
            current price &amp; limits — nothing changes for them.
          </p>
        </Modal>
      )}
    </section>
  );
}
