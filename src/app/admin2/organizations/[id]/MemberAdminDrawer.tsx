'use client';

/**
 * Member admin drawer — admin2 Org Detail → Users. Full super-admin CRUD on one
 * org member, wired to the existing (already-deployed) admin user endpoints via
 * adminService: role, active/inactive, ban, SMS on/off, call recording, autodialer,
 * and the danger zone (remove from org / delete). Fetches fresh detail on open so
 * every control reflects the user's true current state. The monthly SMS limit is
 * ORG-WIDE (shown read-only from the same soft-cap SSOT as the Usage tab, where it's
 * edited) — NOT a per-user number, which the reskin does not enforce.
 *
 * The organization OWNER is protected: role / status / ban / remove / delete are
 * disabled (the backend guards these too) — you can still adjust the owner's
 * feature toggles.
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminService, type PhoneNumber } from '@/lib/api/services/admin.service';
import {
  getOrgSmsSoftCap,
  getUserCallCap,
  updateUserCallCap,
} from '@/lib/api/services/admin-analytics.api';
import { toast } from '@/lib/stores/toast';
import { Btn, StatusDot, SectionTitle, ToggleRow } from '../../_components/ui';

export interface ManageMember {
  id: number;
  fullName: string;
  email: string;
  role: string;
}

const selectCls =
  'rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 ' +
  'focus:outline-none focus:ring-2 focus:ring-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100';

// Mirrors the Usage tab's SMS-cap source labels so the two never read differently.
const SMS_SOURCE_LABEL: Record<'manual' | 'package' | 'base' | 'default', string> = {
  manual: 'manual override',
  package: 'active SMS package',
  base: 'base cap',
  default: 'deployment default',
};

export function MemberAdminDrawer({
  member,
  orgId,
  onClose,
  onChanged,
}: {
  member: ManageMember;
  orgId: number;
  onClose: () => void;
  onChanged: () => void;
}) {
  const qc = useQueryClient();
  const userId = member.id;
  const [confirmDelete, setConfirmDelete] = useState(false);
  // When deleting, keep the user's number in the org by default (freed for
  // reassignment); only release it back to the carrier if the admin ticks this.
  const [releaseNumber, setReleaseNumber] = useState(false);

  const q = useQuery({
    queryKey: ['admin2', 'member', userId],
    queryFn: () => adminService.getUser(userId),
    refetchOnMount: 'always',
  });
  const u = q.data;

  // SMS limit is ORG-WIDE (shared by all users) — the enforced value is the org SMS
  // soft cap (manual override → package → base → default), NOT a per-user number.
  // Read the SAME source the Usage tab uses so the drawer can never disagree (SSOT).
  const capQ = useQuery({
    queryKey: ['admin2', 'sms-soft-cap', orgId],
    queryFn: () => getOrgSmsSoftCap(orgId),
    staleTime: 30_000,
  });

  // Per-user call-minute cap (TRUE per-user — each user metered/blocked on their own
  // usage). Shows the effective cap + an editable override for THIS user.
  const callCapQ = useQuery({
    queryKey: ['admin2', 'user-call-cap', userId],
    queryFn: () => getUserCallCap(userId),
    refetchOnMount: 'always',
  });
  const [callCapDraft, setCallCapDraft] = useState<string | null>(null);
  const callCapInput =
    callCapDraft ?? (callCapQ.data?.rawMinutes == null ? '' : String(callCapQ.data.rawMinutes));
  const saveCallCap = useMutation({
    mutationFn: (minutes: number | null) => updateUserCallCap(userId, minutes),
    onSuccess: () => {
      toast.success('Call-minute cap updated');
      setCallCapDraft(null);
      qc.invalidateQueries({ queryKey: ['admin2', 'user-call-cap', userId] });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : 'Could not update cap'),
  });
  const isOwner = (u?.role ?? member.role) === 'owner';

  // Refresh this drawer's detail + the parent list after any change.
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['admin2', 'member', userId] });
    onChanged();
  };

  function useAction<T>(fn: (v: T) => Promise<unknown>, ok: string) {
    return useMutation({
      mutationFn: fn,
      onSuccess: () => {
        toast.success(ok);
        refresh();
      },
      onError: (e: unknown) => toast.error(e instanceof Error ? e.message : 'Action failed'),
    });
  }

  const role = useAction(
    (r: 'user' | 'manager') => adminService.updateUser(userId, { role: r }),
    'Role updated'
  );
  const active = useAction(
    (v: boolean) => adminService.updateUser(userId, { isActive: v }),
    'Status updated'
  );
  // Edit the user's LOGIN email. Backend normalizes (lowercase) + enforces
  // uniqueness; surfaces a ConflictError toast if the address is taken.
  const email = useAction(
    (e: string) => adminService.updateUser(userId, { email: e }),
    'Email updated'
  );
  const [emailDraft, setEmailDraft] = useState(member.email);
  const ban = useAction((b: boolean) => adminService.setBanStatus(userId, b), 'Ban status updated');
  const sms = useAction((v: boolean) => adminService.toggleSms(userId, v), 'SMS updated');
  const recording = useAction(
    (v: boolean) => adminService.toggleRecording(userId, v),
    'Recording updated'
  );
  const autodialer = useAction(
    (v: boolean) => adminService.toggleAutoDialer(userId, v),
    'Autodialer updated'
  );

  // Per-number settings (default / auto-SMS / AI-dialer).
  const numbersQ = useQuery({
    queryKey: ['admin2', 'member-numbers', userId],
    queryFn: () => adminService.getUserPhoneNumbers(userId),
    refetchOnMount: 'always',
  });
  const refreshNumbers = () => qc.invalidateQueries({ queryKey: ['admin2', 'member-numbers', userId] });
  const hasNumber = (numbersQ.data ?? []).length > 0;
  const numErr = (e: unknown) => toast.error(e instanceof Error ? e.message : 'Action failed');
  const setDefault = useMutation({
    mutationFn: (numberId: number) => adminService.setDefaultPhoneNumber(userId, numberId),
    onSuccess: () => { toast.success('Default number set'); refreshNumbers(); },
    onError: numErr,
  });
  const autoSms = useMutation({
    mutationFn: (v: { numberId: number; enabled: boolean }) => adminService.toggleAutoSms(userId, v.numberId, v.enabled),
    onSuccess: () => { toast.success('Auto-SMS updated'); refreshNumbers(); },
    onError: numErr,
  });
  const aiDialer = useMutation({
    mutationFn: (v: { numberId: number; enabled: boolean }) => adminService.toggleAiDialer(userId, v.numberId, v.enabled),
    onSuccess: () => { toast.success('AI-dialer updated'); refreshNumbers(); },
    onError: numErr,
  });
  const numBusy = setDefault.isPending || autoSms.isPending || aiDialer.isPending;

  const deleteUser = useMutation({
    mutationFn: () => adminService.deleteUser(userId, releaseNumber),
    onSuccess: () => {
      toast.success(
        !hasNumber
          ? 'User deleted'
          : releaseNumber
            ? 'User deleted · number released'
            : 'User deleted · number kept in org'
      );
      onChanged();
      onClose();
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : 'Could not delete'),
  });

  const busy =
    role.isPending ||
    active.isPending ||
    email.isPending ||
    ban.isPending ||
    sms.isPending ||
    recording.isPending ||
    autodialer.isPending ||
    deleteUser.isPending;

  return (
    <div className="fixed inset-0 z-[60] bg-slate-950/40" onClick={onClose}>
      <aside
        className="absolute right-0 top-0 h-full w-full max-w-md overflow-auto border-l border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-800 dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <div className="text-lg font-black">{member.fullName || '—'}</div>
            <div className="text-xs text-slate-500">{member.email}</div>
            {u && (
              <div className="mt-1.5">
                <StatusDot
                  health={u.banned ? 'bad' : u.isActive ? 'ok' : 'off'}
                  label={u.banned ? 'Banned' : u.isActive ? 'Active' : 'Inactive'}
                />
                {isOwner && <span className="ml-2 text-xs font-bold text-[#FF6542]">Owner</span>}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-lg bg-slate-100 text-lg text-slate-500 hover:bg-slate-200 dark:bg-slate-800"
          >
            ×
          </button>
        </div>

        {q.isLoading ? (
          <div className="h-40 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
        ) : q.isError || !u ? (
          <p className="text-sm text-red-500">Could not load this member.</p>
        ) : (
          <>
            {/* Identity / access */}
            <SectionTitle>Access</SectionTitle>
            <div className="mb-4 flex flex-wrap items-end gap-3">
              <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Role
                <select
                  className={selectCls}
                  value={isOwner ? 'owner' : u.role}
                  disabled={isOwner || busy}
                  onChange={(e) => role.mutate(e.target.value as 'user' | 'manager')}
                >
                  {isOwner ? (
                    <option value="owner">Owner</option>
                  ) : (
                    <>
                      <option value="user">User</option>
                      <option value="manager">Manager</option>
                    </>
                  )}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Status
                <select
                  className={selectCls}
                  value={u.isActive ? 'active' : 'inactive'}
                  disabled={isOwner || u.banned || busy}
                  onChange={(e) => active.mutate(e.target.value === 'active')}
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </label>
            </div>

            {/* Login email — super-admin editable (unique; stored lowercase). */}
            <div className="mb-4">
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Email (login)
              </label>
              <div className="flex gap-2">
                <input
                  type="email"
                  value={emailDraft}
                  onChange={(e) => setEmailDraft(e.target.value)}
                  disabled={busy}
                  className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#FF6542] disabled:opacity-60 dark:border-slate-800 dark:bg-slate-950"
                />
                <button
                  type="button"
                  disabled={
                    busy ||
                    !emailDraft.trim() ||
                    emailDraft.trim().toLowerCase() === (member.email || '').toLowerCase()
                  }
                  onClick={() => email.mutate(emailDraft.trim())}
                  className="shrink-0 rounded-xl bg-[#FF6542] px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
                >
                  {email.isPending ? 'Saving…' : 'Save'}
                </button>
              </div>
              <p className="mt-1 text-[11px] text-slate-400">
                Changes the user&apos;s login email. Must be unique across all accounts; stored
                lowercase (login is case-insensitive).
              </p>
            </div>

            <ToggleRow
              title="Banned"
              description="Signs the user out and blocks login immediately."
              checked={u.banned}
              disabled={isOwner || busy}
              onChange={(v) => ban.mutate(v)}
            />

            {/* Features */}
            <SectionTitle>Features</SectionTitle>
            <ToggleRow
              title="SMS"
              description="Allow this user to send text messages."
              checked={u.smsEnabled}
              disabled={busy}
              onChange={(v) => sms.mutate(v)}
            />
            {/* SMS limit is org-wide, not per-user. Show the enforced org value
                (SSOT = same soft-cap source as the Usage tab); edit it there. */}
            <div className="mb-2.5 rounded-xl border border-slate-200 p-3.5 dark:border-slate-800">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Monthly SMS limit
                </span>
                <span className="text-sm font-black tabular-nums text-slate-900 dark:text-slate-100">
                  {capQ.isLoading
                    ? '…'
                    : capQ.data?.effectiveCap == null
                      ? 'Unlimited'
                      : `${capQ.data.effectiveCap.toLocaleString()} / mo`}
                </span>
              </div>
              <p className="mt-1 text-[11px] text-slate-400">
                Org-wide — shared by all users{capQ.data ? ` (from ${SMS_SOURCE_LABEL[capQ.data.source]})` : ''}.
                Set it in the <b>Usage</b> tab.
              </p>
            </div>

            {/* Per-USER monthly call-minute cap — this user is metered + blocked on
                their OWN usage; blank inherits the org default, 0 = unlimited. */}
            <div className="mb-2.5 rounded-xl border border-slate-200 p-3.5 dark:border-slate-800">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Monthly call-minute cap
                </span>
                <span className="text-sm font-black tabular-nums text-slate-900 dark:text-slate-100">
                  {callCapQ.isLoading
                    ? '…'
                    : callCapQ.data?.effectiveMinutes == null
                      ? 'Unlimited'
                      : `${callCapQ.data.effectiveMinutes.toLocaleString()} / mo`}
                </span>
              </div>
              <div className="mt-2 flex items-end gap-2">
                <input
                  type="number"
                  min={0}
                  className={selectCls + ' flex-1'}
                  placeholder={
                    callCapQ.data?.orgDefaultMinutes != null
                      ? `Inherit org default (${callCapQ.data.orgDefaultMinutes.toLocaleString()})`
                      : 'Inherit default'
                  }
                  value={callCapInput}
                  disabled={busy || saveCallCap.isPending}
                  onChange={(e) => setCallCapDraft(e.target.value)}
                />
                <Btn
                  size="sm"
                  variant="primary"
                  disabled={busy || saveCallCap.isPending}
                  onClick={() => {
                    const t = callCapInput.trim();
                    saveCallCap.mutate(t === '' ? null : Math.max(0, parseInt(t, 10) || 0));
                  }}
                >
                  Set
                </Btn>
              </div>
              <p className="mt-1 text-[11px] text-slate-400">
                This user only. Blank = inherit org default · <b>0</b> = unlimited · N = cap this user at
                N min/mo. When they hit it, only <b>their</b> calling stops.
              </p>
            </div>

            <ToggleRow
              title="Call recording"
              description="Record this user's calls (Telnyx)."
              checked={u.recordingEnabled ?? false}
              disabled={busy}
              onChange={(v) => recording.mutate(v)}
            />
            <ToggleRow
              title="Auto-dialer"
              description="Grant access to the AI auto-dialer."
              checked={u.autoDialerEnabled}
              disabled={busy}
              onChange={(v) => autodialer.mutate(v)}
            />

            {/* Per-number settings */}
            <SectionTitle>Numbers</SectionTitle>
            {numbersQ.isLoading ? (
              <div className="mb-2.5 h-14 animate-pulse rounded-xl bg-slate-200 dark:bg-slate-800" />
            ) : (numbersQ.data ?? []).length === 0 ? (
              <p className="mb-2.5 text-xs text-slate-500 dark:text-slate-400">No numbers assigned to this user.</p>
            ) : (
              (numbersQ.data ?? []).map((n: PhoneNumber) => (
                <div key={n.id} className="mb-2.5 rounded-xl border border-slate-200 p-3.5 dark:border-slate-800">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-mono text-sm font-bold">{n.phoneNumber}</span>
                    {n.isPrimary ? (
                      <span className="rounded-full bg-[#FF6542]/10 px-2 py-0.5 text-[11px] font-bold text-[#FF6542]">Default</span>
                    ) : (
                      <button
                        type="button"
                        disabled={numBusy}
                        onClick={() => setDefault.mutate(n.id)}
                        className="rounded-lg border border-slate-200 px-2 py-1 text-[11px] font-bold hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:hover:bg-slate-800"
                      >
                        Make default
                      </button>
                    )}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <ToggleChip label="Auto-SMS" on={n.autoSmsEnabled} disabled={numBusy} onClick={() => autoSms.mutate({ numberId: n.id, enabled: !n.autoSmsEnabled })} />
                    <ToggleChip label="AI-dialer" on={n.aiDialerEnabled ?? false} disabled={numBusy} onClick={() => aiDialer.mutate({ numberId: n.id, enabled: !(n.aiDialerEnabled ?? false) })} />
                  </div>
                </div>
              ))
            )}

            {/* Danger zone */}
            <SectionTitle>Danger zone</SectionTitle>
            {isOwner ? (
              <p className="text-xs text-slate-500">
                The organization owner can&apos;t be removed or deleted here. Transfer ownership or
                close the organization instead.
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                <Btn
                  variant="danger"
                  disabled={busy}
                  onClick={() => {
                    setReleaseNumber(false); // default: keep the number in the org
                    setConfirmDelete(true);
                  }}
                >
                  Delete user
                </Btn>
              </div>
            )}
          </>
        )}
      </aside>

      {/* Delete confirmation — a CENTERED overlay (z above the drawer) rather than an
          inline box. The drawer is tall + scrollable, so an inline confirm rendered
          at the bottom of the danger zone fell below the fold and was never seen. A
          fixed, centered dialog is always visible regardless of scroll position. */}
      {confirmDelete && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/50 p-4"
          onClick={(e) => {
            e.stopPropagation();
            if (!busy) setConfirmDelete(false);
          }}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-800 dark:bg-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-black text-red-700 dark:text-red-300">
              Delete this user permanently?
            </h3>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
              <span className="font-semibold">{member.fullName || member.email}</span>&apos;s account
              and extension are deleted. This cannot be undone.
            </p>
            {hasNumber && (
              <label className="mt-3 flex cursor-pointer items-start gap-2.5 rounded-xl border border-slate-200 p-3 text-sm dark:border-slate-800">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 accent-[#FF6542]"
                  checked={releaseNumber}
                  onChange={(e) => setReleaseNumber(e.target.checked)}
                  disabled={busy}
                />
                <span className="text-slate-600 dark:text-slate-400">
                  Also release their number back to the carrier <span className="font-semibold">(stops billing)</span>.
                  <br />
                  {releaseNumber ? (
                    <span className="text-xs text-red-600 dark:text-red-400">
                      The number will be given up — the org must re-buy it later.
                    </span>
                  ) : (
                    <span className="text-xs text-slate-500">
                      Leave unticked to <span className="font-semibold">keep the number in this organization</span> (freed for the next member — no re-buy).
                    </span>
                  )}
                </span>
              </label>
            )}
            <div className="mt-4 flex justify-end gap-2">
              <Btn size="sm" onClick={() => setConfirmDelete(false)} disabled={busy}>
                Cancel
              </Btn>
              <Btn size="sm" variant="danger" disabled={busy} onClick={() => deleteUser.mutate()}>
                {busy ? 'Deleting…' : 'Delete user'}
              </Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** Compact on/off pill for a per-number setting. */
function ToggleChip({
  label,
  on,
  disabled,
  onClick,
}: {
  label: string;
  on: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-pressed={on}
      className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition disabled:opacity-40 ${
        on
          ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
          : 'border border-slate-200 text-slate-500 dark:border-slate-700'
      }`}
    >
      {label} {on ? '✓' : '✗'}
    </button>
  );
}
