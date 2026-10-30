'use client';

/**
 * Admin — Hardphones
 *
 * Provision and manage Polycom / Yealink desk phones: add by MAC + extension,
 * edit, enable/disable, delete, and (later phase) see online/offline status.
 *
 * @module app/admin/hardphones/page
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { FiPhone, FiPlus, FiEdit2, FiTrash2, FiRefreshCw, FiX } from 'react-icons/fi';
import { toast } from '@/lib/stores/toast';
import { usePermissions, PERMISSIONS } from '@/lib/hooks/usePermissions';
import { StyledSelect } from '@/components/ui/StyledSelect';
import {
  hardphoneApi,
  type Hardphone,
  type HardphoneInput,
  type HardphoneVendor,
  type AvailableExtension,
} from '@/lib/api/services/hardphone.api';

const VENDOR_MODELS: Record<HardphoneVendor, string[]> = {
  polycom: ['VVX 150', 'VVX 250', 'VVX 350', 'VVX 450', 'Edge E350', 'Other'],
  yealink: ['T31G', 'T33G', 'T43U', 'T46U', 'T54W', 'Other'],
};

const EMPTY_FORM: HardphoneInput = {
  label: '',
  vendor: 'yealink',
  model: '',
  macAddress: '',
  extension: '',
  enabled: true,
  notes: '',
};

function StatusBadge({ status }: { status: Hardphone['status'] }) {
  const map = {
    online: { text: 'Online', cls: 'bg-green-500/15 text-green-600 dark:text-green-400' },
    offline: { text: 'Offline', cls: 'bg-red-500/15 text-red-600 dark:text-red-400' },
    unknown: { text: 'Unknown', cls: 'bg-gray-500/15 text-[var(--muted-foreground)]' },
  }[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${map.cls}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {map.text}
    </span>
  );
}

/** Format 12-hex MAC for display: aabbccddeeff → AA:BB:CC:DD:EE:FF */
function displayMac(mac: string): string {
  return (mac.match(/.{1,2}/g)?.join(':') ?? mac).toUpperCase();
}

export default function HardphonesPage() {
  const { hasPermission } = usePermissions();
  const canManage = hasPermission(PERMISSIONS.MANAGE_DEVICES);

  const [phones, setPhones] = useState<Hardphone[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Hardphone | null>(null);
  const [form, setForm] = useState<HardphoneInput>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [extensions, setExtensions] = useState<AvailableExtension[]>([]);

  const loadExtensions = useCallback(async () => {
    try {
      setExtensions(await hardphoneApi.availableExtensions());
    } catch {
      setExtensions([]);
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setPhones(await hardphoneApi.list());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load hardphones');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openAdd = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    void loadExtensions();
    setModalOpen(true);
  };

  const openEdit = (p: Hardphone) => {
    setEditing(p);
    setForm({
      label: p.label ?? '',
      vendor: p.vendor,
      model: p.model ?? '',
      macAddress: p.macAddress,
      extension: p.extension,
      assignedUserId: p.assignedUserId,
      enabled: p.enabled,
      notes: p.notes ?? '',
    });
    void loadExtensions();
    setModalOpen(true);
  };

  const modelOptions = useMemo(() => VENDOR_MODELS[form.vendor] ?? [], [form.vendor]);

  const save = async () => {
    // Lightweight client validation (server re-validates + normalizes).
    const macHex = form.macAddress.replace(/[^0-9a-fA-F]/g, '');
    if (macHex.length !== 12) {
      toast.error('MAC address must be 12 hex characters (e.g. 0004F2AB12CD)');
      return;
    }
    if (!form.extension.trim()) {
      toast.error('Extension is required');
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await hardphoneApi.update(editing.id, form);
        toast.success('Hardphone updated');
      } else {
        await hardphoneApi.create(form);
        toast.success('Hardphone added');
      }
      setModalOpen(false);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save hardphone');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (p: Hardphone) => {
    if (!confirm(`Delete hardphone ${p.label || displayMac(p.macAddress)}? This cannot be undone.`))
      return;
    try {
      await hardphoneApi.remove(p.id);
      toast.success('Hardphone deleted');
      setPhones((prev) => prev.filter((x) => x.id !== p.id));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete hardphone');
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-full">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-[var(--primary-50)] text-[var(--foreground)] dark:bg-[var(--primary-900)]/40">
            <FiPhone className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-xl font-semibold text-[var(--foreground)]">Hardphones</h1>
            <p className="text-sm text-[var(--muted-foreground)]">
              Provision and manage Polycom &amp; Yealink desk phones
            </p>
          </div>
        </div>
        <div className="flex flex-shrink-0 items-center gap-2">
          <button
            onClick={() => void load()}
            className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-[var(--foreground)] hover:bg-[var(--muted)]"
            title="Refresh"
          >
            <FiRefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
          {canManage && (
            <button
              onClick={openAdd}
              className="inline-flex items-center gap-2 rounded-lg bg-[var(--primary-600)] px-3 py-2 text-sm font-medium text-white hover:bg-[var(--primary-700)]"
            >
              <FiPlus className="h-4 w-4" />
              Add Hardphone
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--card)]">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-[var(--border)] text-[var(--muted-foreground)]">
            <tr>
              <th className="px-4 py-3 font-medium">Label</th>
              <th className="px-4 py-3 font-medium">Extension</th>
              <th className="px-4 py-3 font-medium">Vendor / Model</th>
              <th className="px-4 py-3 font-medium">MAC Address</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Enabled</th>
              {canManage && <th className="px-4 py-3 text-right font-medium">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td
                  colSpan={canManage ? 7 : 6}
                  className="px-4 py-10 text-center text-[var(--muted-foreground)]"
                >
                  Loading…
                </td>
              </tr>
            ) : phones.length === 0 ? (
              <tr>
                <td colSpan={canManage ? 7 : 6} className="px-4 py-12 text-center">
                  <FiPhone className="mx-auto mb-3 h-8 w-8 text-[var(--muted-foreground)]" />
                  <p className="text-[var(--foreground)]">No hardphones yet</p>
                  <p className="text-sm text-[var(--muted-foreground)]">
                    Add a Polycom or Yealink desk phone to get started.
                  </p>
                </td>
              </tr>
            ) : (
              phones.map((p) => (
                <tr
                  key={p.id}
                  className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--muted)]/50 transition-colors"
                >
                  <td className="px-4 py-3 font-medium text-[var(--foreground)]">
                    {p.label || <span className="text-[var(--muted-foreground)]">—</span>}
                  </td>
                  <td className="px-4 py-3 text-[var(--foreground)]">{p.extension}</td>
                  <td className="px-4 py-3 text-[var(--foreground)]">
                    <span className="capitalize">{p.vendor}</span>
                    {p.model ? (
                      <span className="text-[var(--muted-foreground)]"> · {p.model}</span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-[var(--muted-foreground)]">
                    {displayMac(p.macAddress)}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={p.status} />
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block h-2.5 w-2.5 rounded-full ${
                        p.enabled ? 'bg-green-500' : 'bg-gray-400'
                      }`}
                      title={p.enabled ? 'Enabled' : 'Disabled'}
                    />
                  </td>
                  {canManage && (
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openEdit(p)}
                          className="rounded-lg p-2 text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)]"
                          title="Edit"
                        >
                          <FiEdit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => void remove(p)}
                          className="rounded-lg p-2 text-[var(--muted-foreground)] hover:bg-red-500/10 hover:text-red-500"
                          title="Delete"
                        >
                          <FiTrash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-xs text-[var(--muted-foreground)]">
        Live online/offline status is wired to the SIP registrar in a later phase — new phones show
        &ldquo;Unknown&rdquo; until then.
      </p>

      {/* Add/Edit modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => !saving && setModalOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-[var(--foreground)]">
                {editing ? 'Edit Hardphone' : 'Add Hardphone'}
              </h2>
              <button
                onClick={() => !saving && setModalOpen(false)}
                className="rounded-lg p-1.5 text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
              >
                <FiX className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <Field label="Label (optional)">
                <input
                  value={form.label ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
                  placeholder="e.g. Reception desk"
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
                />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Vendor">
                  <StyledSelect
                    value={form.vendor}
                    onChange={(v) =>
                      setForm((f) => ({ ...f, vendor: v as HardphoneVendor, model: '' }))
                    }
                    aria-label="Vendor"
                  >
                    <option value="yealink">Yealink</option>
                    <option value="polycom">Polycom</option>
                  </StyledSelect>
                </Field>
                <Field label="Model (optional)">
                  <StyledSelect
                    value={form.model ?? ''}
                    onChange={(v) => setForm((f) => ({ ...f, model: v }))}
                    placeholder="Select model"
                    aria-label="Model"
                  >
                    <option value="">—</option>
                    {modelOptions.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </StyledSelect>
                </Field>
              </div>

              <Field label="MAC Address">
                <input
                  value={form.macAddress}
                  onChange={(e) => setForm((f) => ({ ...f, macAddress: e.target.value }))}
                  placeholder="0004F2AB12CD or 00:04:F2:AB:12:CD"
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--input)] px-3 py-2 font-mono text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
                />
              </Field>

              <Field label="Assign to user (extension)">
                <StyledSelect
                  value={form.extension}
                  onChange={(v) => {
                    const picked = extensions.find((e) => e.extension === v);
                    setForm((f) => ({
                      ...f,
                      extension: v,
                      assignedUserId: picked ? picked.userId : null,
                    }));
                  }}
                  placeholder="Select a user"
                  aria-label="Assign to user"
                >
                  <option value="">Select a user…</option>
                  {/* Hide extensions already bound to another hardphone; keep the
                      one being edited so it stays selectable. */}
                  {extensions
                    .filter((e) => !e.assigned || e.extension === editing?.extension)
                    .map((e) => (
                      <option key={e.extension} value={e.extension}>
                        {(e.fullName || 'Unnamed user') + ` (ext ${e.extension})`}
                      </option>
                    ))}
                  {/* Fallback: current extension not present in the list. */}
                  {form.extension && !extensions.some((e) => e.extension === form.extension) && (
                    <option value={form.extension}>{`ext ${form.extension}`}</option>
                  )}
                </StyledSelect>
                {extensions.length > 0 &&
                  extensions.filter((e) => !e.assigned || e.extension === editing?.extension)
                    .length === 0 && (
                    <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                      All extensions already have a hardphone assigned.
                    </p>
                  )}
              </Field>

              <Field label="Notes (optional)">
                <input
                  value={form.notes ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  placeholder="Anything worth noting"
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
                />
              </Field>

              <label className="flex items-center gap-2 text-sm text-[var(--foreground)]">
                <input
                  type="checkbox"
                  checked={form.enabled ?? true}
                  onChange={(e) => setForm((f) => ({ ...f, enabled: e.target.checked }))}
                  className="h-4 w-4 rounded border-[var(--border)]"
                />
                Enabled
              </label>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setModalOpen(false)}
                disabled={saving}
                className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm text-[var(--foreground)] hover:bg-[var(--muted)] disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={() => void save()}
                disabled={saving}
                className="rounded-lg bg-[var(--primary-600)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--primary-700)] disabled:opacity-50"
              >
                {saving ? 'Saving…' : editing ? 'Save changes' : 'Add hardphone'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-[var(--foreground)]">{label}</label>
      {children}
    </div>
  );
}
