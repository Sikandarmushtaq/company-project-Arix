'use client';

/**
 * Admin — Call Groups (ring groups)
 *
 * Create groups that ring a team together (or in sequence). Point a virtual
 * number at a group and the whole team's phones ring. The ring logic runs in
 * FusionPBX's ring-group engine; this page just manages the group + members.
 *
 * @module app/admin/call-groups/page
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FiUsers,
  FiPlus,
  FiEdit2,
  FiTrash2,
  FiRefreshCw,
  FiX,
  FiArrowUp,
  FiArrowDown,
} from 'react-icons/fi';
import { toast } from '@/lib/stores/toast';
import { usePermissions, PERMISSIONS } from '@/lib/hooks/usePermissions';
import { StyledSelect } from '@/components/ui/StyledSelect';
import {
  callGroupApi,
  type CallGroup,
  type CallGroupInput,
  type RingStrategy,
  type FallbackType,
  type AvailableGroupMember,
} from '@/lib/api/services/call-group.api';

/** Plain-language strategy options (values map 1:1 to FusionPBX). */
const STRATEGY_OPTIONS: { value: RingStrategy; label: string; hint: string }[] = [
  { value: 'simultaneous', label: 'Ring everyone at once', hint: 'All phones ring together' },
  { value: 'sequence', label: 'One at a time, in order', hint: 'Ring member 1, then 2, then 3…' },
  {
    value: 'rollover',
    label: 'One at a time, keep previous ringing',
    hint: 'Add each member while the earlier ones keep ringing',
  },
  { value: 'enterprise', label: 'Ring everyone (enterprise)', hint: 'All at once, enterprise mode' },
  { value: 'random', label: 'Ring in random order', hint: 'Members ring one at a time, shuffled' },
];

const STRATEGY_LABEL: Record<RingStrategy, string> = Object.fromEntries(
  STRATEGY_OPTIONS.map((s) => [s.value, s.label])
) as Record<RingStrategy, string>;

/** Order matters only for these strategies. */
const isOrdered = (s: RingStrategy) => s === 'sequence' || s === 'rollover';

const FALLBACK_OPTIONS: { value: FallbackType; label: string }[] = [
  { value: 'voicemail', label: 'Send to voicemail' },
  { value: 'external', label: 'Forward to another number' },
  { value: 'hangup', label: 'Hang up' },
];

type MemberDraft = { userId: number; extension: string; fullName: string | null; order: number };

interface FormState {
  name: string;
  strategy: RingStrategy;
  ringTimeout: number;
  fallbackType: FallbackType;
  fallbackValue: string;
  members: MemberDraft[];
  enabled: boolean;
  /** Inbound DID that routes external callers to this group ('' = none). */
  assignedNumber: string;
}

const EMPTY_FORM: FormState = {
  name: '',
  strategy: 'simultaneous',
  ringTimeout: 30,
  fallbackType: 'voicemail',
  fallbackValue: '',
  members: [],
  enabled: true,
  assignedNumber: '',
};

export default function CallGroupsPage() {
  const { hasPermission } = usePermissions();
  const canManage = hasPermission(PERMISSIONS.MANAGE_PHONE_NUMBERS);

  const [groups, setGroups] = useState<CallGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<CallGroup | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [available, setAvailable] = useState<AvailableGroupMember[]>([]);
  const [pickUser, setPickUser] = useState('');

  const loadAvailable = useCallback(async () => {
    try {
      setAvailable(await callGroupApi.availableMembers());
    } catch {
      setAvailable([]);
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setGroups(await callGroupApi.list());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load call groups');
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
    setPickUser('');
    void loadAvailable();
    setModalOpen(true);
  };

  const openEdit = (g: CallGroup) => {
    setEditing(g);
    setForm({
      name: g.name,
      strategy: g.strategy,
      ringTimeout: g.ringTimeout,
      fallbackType: g.fallbackType,
      fallbackValue: g.fallbackValue ?? '',
      members: [...g.members]
        .sort((a, b) => a.order - b.order)
        .map((m) => ({
          userId: m.userId,
          extension: m.extension,
          fullName: m.fullName,
          order: m.order,
        })),
      enabled: g.enabled,
      assignedNumber: g.assignedNumber ?? '',
    });
    setPickUser('');
    void loadAvailable();
    setModalOpen(true);
  };

  // Members not yet in the group, for the "add member" picker.
  const addableUsers = useMemo(
    () => available.filter((u) => !form.members.some((m) => m.userId === u.userId)),
    [available, form.members]
  );

  const addMember = (userId: number) => {
    const u = available.find((x) => x.userId === userId);
    if (!u) return;
    setForm((f) => ({
      ...f,
      members: [
        ...f.members,
        { userId: u.userId, extension: u.extension, fullName: u.fullName, order: f.members.length },
      ],
    }));
    setPickUser('');
  };

  const removeMember = (userId: number) => {
    setForm((f) => ({
      ...f,
      members: f.members
        .filter((m) => m.userId !== userId)
        .map((m, i) => ({ ...m, order: i })),
    }));
  };

  const moveMember = (index: number, dir: -1 | 1) => {
    setForm((f) => {
      const next = [...f.members];
      const j = index + dir;
      if (j < 0 || j >= next.length) return f;
      [next[index], next[j]] = [next[j], next[index]];
      return { ...f, members: next.map((m, i) => ({ ...m, order: i })) };
    });
  };

  const save = async () => {
    if (!form.name.trim()) {
      toast.error('Group name is required');
      return;
    }
    if (form.members.length === 0) {
      toast.error('Add at least one member to the group');
      return;
    }
    if (form.fallbackType === 'external' && !form.fallbackValue.trim()) {
      toast.error('Enter the number to forward to');
      return;
    }
    // Inbound DID is optional; if given, keep digits only (phone SSOT) and
    // sanity-check the length.
    const didDigits = form.assignedNumber.replace(/\D/g, '');
    if (form.assignedNumber.trim() && (didDigits.length < 7 || didDigits.length > 15)) {
      toast.error('Enter a valid inbound number, or leave it blank');
      return;
    }
    const payload: CallGroupInput = {
      name: form.name.trim(),
      strategy: form.strategy,
      ringTimeout: form.ringTimeout,
      fallbackType: form.fallbackType,
      fallbackValue: form.fallbackType === 'external' ? form.fallbackValue.trim() : null,
      members: form.members.map((m, i) => ({ userId: m.userId, order: i })),
      enabled: form.enabled,
      assignedNumber: didDigits || null,
    };
    setSaving(true);
    try {
      if (editing) {
        await callGroupApi.update(editing.id, payload);
        toast.success('Call group updated');
      } else {
        await callGroupApi.create(payload);
        toast.success('Call group created');
      }
      setModalOpen(false);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save call group');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (g: CallGroup) => {
    if (!confirm(`Delete call group "${g.name}"? This cannot be undone.`)) return;
    try {
      await callGroupApi.remove(g.id);
      toast.success('Call group deleted');
      setGroups((prev) => prev.filter((x) => x.id !== g.id));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete call group');
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-full">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-[var(--primary-50)] text-[var(--foreground)] dark:bg-[var(--primary-900)]/40">
            <FiUsers className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-xl font-semibold text-[var(--foreground)]">Call Groups</h1>
            <p className="text-sm text-[var(--muted-foreground)]">
              Ring a team together — point a number at a group so everyone&rsquo;s phone rings
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
              New Call Group
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--card)]">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="border-b border-[var(--border)] text-[var(--muted-foreground)]">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Group ext.</th>
              <th className="px-4 py-3 font-medium">Rings</th>
              <th className="px-4 py-3 font-medium">Members</th>
              <th className="px-4 py-3 font-medium">Number</th>
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
            ) : groups.length === 0 ? (
              <tr>
                <td colSpan={canManage ? 7 : 6} className="px-4 py-12 text-center">
                  <FiUsers className="mx-auto mb-3 h-8 w-8 text-[var(--muted-foreground)]" />
                  <p className="text-[var(--foreground)]">No call groups yet</p>
                  <p className="text-sm text-[var(--muted-foreground)]">
                    Create a group (e.g. &ldquo;Bookings&rdquo;) so a call rings the whole team.
                  </p>
                </td>
              </tr>
            ) : (
              groups.map((g) => (
                <tr
                  key={g.id}
                  className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--muted)]/50 transition-colors"
                >
                  <td className="px-4 py-3 font-medium text-[var(--foreground)]">{g.name}</td>
                  <td className="px-4 py-3 font-mono text-xs text-[var(--muted-foreground)]">
                    {g.groupExtension}
                  </td>
                  <td className="px-4 py-3 text-[var(--foreground)]">
                    {STRATEGY_LABEL[g.strategy] ?? g.strategy}
                  </td>
                  <td className="px-4 py-3 text-[var(--foreground)]">
                    <span
                      title={g.members.map((m) => `${m.fullName || 'User'} (${m.extension})`).join(', ')}
                    >
                      {g.members.length} member{g.members.length === 1 ? '' : 's'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[var(--foreground)]">
                    {g.assignedNumber || <span className="text-[var(--muted-foreground)]">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block h-2.5 w-2.5 rounded-full ${
                        g.enabled ? 'bg-green-500' : 'bg-gray-400'
                      }`}
                      title={g.enabled ? 'Enabled' : 'Disabled'}
                    />
                  </td>
                  {canManage && (
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openEdit(g)}
                          className="rounded-lg p-2 text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)]"
                          title="Edit"
                        >
                          <FiEdit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => void remove(g)}
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
        Assign a virtual number to a group from the Numbers page — calls to that number ring the
        whole group. Members ring on both their web dialer and Android app.
      </p>

      {/* Add/Edit modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => !saving && setModalOpen(false)}
        >
          <div
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-[var(--foreground)]">
                {editing ? 'Edit Call Group' : 'New Call Group'}
              </h2>
              <button
                onClick={() => !saving && setModalOpen(false)}
                className="rounded-lg p-1.5 text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
              >
                <FiX className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <Field label="Group name">
                <input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Bookings, Sales, Support"
                  className={inputCls}
                />
              </Field>

              <Field label="Inbound number (DID)">
                <input
                  value={form.assignedNumber}
                  onChange={(e) => setForm((f) => ({ ...f, assignedNumber: e.target.value }))}
                  placeholder="e.g. 442045205000 — optional"
                  className={inputCls}
                  inputMode="tel"
                />
                <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                  External callers dialing this number reach the group. Leave blank for
                  internal-only (dial the group extension).
                </p>
              </Field>

              {editing && (
                <Field label="Group extension">
                  <input
                    value={editing.groupExtension}
                    disabled
                    className={`${inputCls} font-mono opacity-70`}
                  />
                  <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                    Auto-assigned. Dial this internally to reach the group.
                  </p>
                </Field>
              )}

              <Field label="How it rings">
                <StyledSelect
                  value={form.strategy}
                  onChange={(v) => setForm((f) => ({ ...f, strategy: v as RingStrategy }))}
                  aria-label="Ring strategy"
                >
                  {STRATEGY_OPTIONS.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </StyledSelect>
                <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                  {STRATEGY_OPTIONS.find((s) => s.value === form.strategy)?.hint}
                </p>
              </Field>

              {/* Members */}
              <Field label={`Members${form.members.length ? ` (${form.members.length})` : ''}`}>
                <StyledSelect
                  value={pickUser}
                  onChange={(v) => {
                    setPickUser(v);
                    if (v) addMember(Number(v));
                  }}
                  placeholder="Add a member…"
                  aria-label="Add member"
                >
                  <option value="">
                    {addableUsers.length ? 'Add a member…' : 'No more users to add'}
                  </option>
                  {addableUsers.map((u) => (
                    <option key={u.userId} value={String(u.userId)}>
                      {(u.fullName || 'Unnamed user') + ` (ext ${u.extension})`}
                    </option>
                  ))}
                </StyledSelect>

                {form.members.length > 0 ? (
                  <ul className="mt-2 space-y-1.5">
                    {form.members.map((m, i) => (
                      <li
                        key={m.userId}
                        className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--muted)]/30 px-3 py-2"
                      >
                        {isOrdered(form.strategy) && (
                          <span className="w-5 flex-shrink-0 text-center text-xs font-medium text-[var(--muted-foreground)]">
                            {i + 1}
                          </span>
                        )}
                        <div className="min-w-0 flex-1">
                          <span className="text-sm text-[var(--foreground)]">
                            {m.fullName || 'Unnamed user'}
                          </span>
                          <span className="ml-1 text-xs text-[var(--muted-foreground)]">
                            ext {m.extension}
                          </span>
                        </div>
                        {isOrdered(form.strategy) && (
                          <>
                            <button
                              type="button"
                              onClick={() => moveMember(i, -1)}
                              disabled={i === 0}
                              className="rounded p-1 text-[var(--muted-foreground)] hover:bg-[var(--muted)] disabled:opacity-30"
                              title="Move up"
                            >
                              <FiArrowUp className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => moveMember(i, 1)}
                              disabled={i === form.members.length - 1}
                              className="rounded p-1 text-[var(--muted-foreground)] hover:bg-[var(--muted)] disabled:opacity-30"
                              title="Move down"
                            >
                              <FiArrowDown className="h-3.5 w-3.5" />
                            </button>
                          </>
                        )}
                        <button
                          type="button"
                          onClick={() => removeMember(m.userId)}
                          className="rounded p-1 text-[var(--muted-foreground)] hover:bg-red-500/10 hover:text-red-500"
                          title="Remove"
                        >
                          <FiX className="h-3.5 w-3.5" />
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                    Add the team members who should ring for this group.
                  </p>
                )}
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Ring for (seconds)">
                  <input
                    type="number"
                    min={5}
                    max={120}
                    value={form.ringTimeout}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, ringTimeout: Number(e.target.value) || 30 }))
                    }
                    className={inputCls}
                  />
                </Field>
                <Field label="If nobody answers">
                  <StyledSelect
                    value={form.fallbackType}
                    onChange={(v) => setForm((f) => ({ ...f, fallbackType: v as FallbackType }))}
                    aria-label="Fallback"
                  >
                    {FALLBACK_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </StyledSelect>
                </Field>
              </div>

              {form.fallbackType === 'external' && (
                <Field label="Forward to number">
                  <input
                    value={form.fallbackValue}
                    onChange={(e) => setForm((f) => ({ ...f, fallbackValue: e.target.value }))}
                    placeholder="e.g. 441156612393"
                    className={`${inputCls} font-mono`}
                  />
                </Field>
              )}

              <label className="flex items-center gap-2 text-sm text-[var(--foreground)]">
                <input
                  type="checkbox"
                  checked={form.enabled}
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
                {saving ? 'Saving…' : editing ? 'Save changes' : 'Create group'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const inputCls =
  'w-full rounded-lg border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-[var(--foreground)]">{label}</label>
      {children}
    </div>
  );
}
