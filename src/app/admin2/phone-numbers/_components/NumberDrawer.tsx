'use client';

/**
 * Number drawer (slide-over) for the Phone Numbers page.
 *  • Identity — org, assignee/extension, type, state, caller-ID, created.
 *  • Reassign — move the number to another user in its org (or unassign), via
 *    the proven assignNumber engine.
 *  • Health — runs the REAL per-number diagnostic on demand (reuses the backend
 *    diagnostic, no duplicate logic) and shows the verdict + any failing/warn
 *    checks; "Open full diagnostic" deep-links to the Diagnostics page.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { useOrganizationUsers } from '@/lib/hooks/useAdmin';
import { adminAccountApi, type AdminNumber, type NumberDiagnostic } from '@/lib/api/services/admin-account.api';
import { Btn, StatusDot, type Health } from '../../_components/ui';

const VERDICT: Record<NumberDiagnostic['verdict'], { label: string; dot: string }> = {
  healthy: { label: 'Healthy', dot: 'bg-emerald-500' },
  attention: { label: 'Needs attention', dot: 'bg-amber-500' },
  blocked: { label: 'Blocked', dot: 'bg-red-500' },
};
function toHealth(s: string): Health {
  return s === 'ok' ? 'ok' : s === 'warn' ? 'warn' : s === 'bad' ? 'bad' : 'off';
}

export function NumberDrawer({ number, onClose, onChanged }: { number: AdminNumber; onClose: () => void; onChanged: () => void }) {
  const router = useRouter();
  const [assignUserId, setAssignUserId] = useState<string>(number.assignedUserId ? String(number.assignedUserId) : '');
  // Track the last SAVED assignee locally — the `number` prop is immutable, so
  // comparing against it would keep `dirty` true after a successful save and the
  // control would look permanently unsaved.
  const [savedUserId, setSavedUserId] = useState<number | null>(number.assignedUserId);
  const orgUsers = useOrganizationUsers(number.organizationId, { page: 1, limit: 200 });

  const reassign = useMutation({
    mutationFn: () => adminAccountApi.reassignNumber(number.phoneNumber, assignUserId ? Number(assignUserId) : null),
    onSuccess: () => { setSavedUserId(assignUserId ? Number(assignUserId) : null); onChanged(); },
  });
  const health = useMutation({ mutationFn: () => adminAccountApi.diagnoseNumber(number.phoneNumber) });

  // Caller-ID name (CNAM) — editable (owner had this, admins didn't). Telnyx CNAM
  // is ≤15 chars; empty clears it. Track the saved value locally so the control
  // settles after a successful save (the `number` prop is immutable).
  const [cnam, setCnam] = useState<string>(number.callerIdName ?? '');
  const [savedCnam, setSavedCnam] = useState<string>(number.callerIdName ?? '');
  const saveCnam = useMutation({
    mutationFn: () =>
      adminAccountApi.setNumberCallerId(number.organizationId, number.id, cnam.trim() || null),
    onSuccess: (r) => {
      setSavedCnam(r.callerIdName ?? '');
      setCnam(r.callerIdName ?? '');
      onChanged();
    },
  });
  const cnamDirty = cnam.trim() !== savedCnam;

  // Release — irreversible (gives the number back to Telnyx + stops billing).
  const [confirmRelease, setConfirmRelease] = useState(false);
  const release = useMutation({
    mutationFn: () => adminAccountApi.releaseNumber(number.organizationId, number.id),
    onSuccess: () => { onChanged(); onClose(); },
  });

  const dirty = (assignUserId ? Number(assignUserId) : null) !== savedUserId;
  const diag = health.data;

  return (
    <div className="fixed inset-0 z-[60] bg-slate-950/40" onClick={onClose}>
      <aside
        className="absolute right-0 top-0 h-full w-full max-w-md overflow-auto border-l border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-800 dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between">
          <div>
            <div className="font-mono text-xl font-black">{number.phoneNumber}</div>
            <div className="text-xs text-slate-500 dark:text-slate-400">{number.orgName ?? `Org ${number.organizationId}`}</div>
          </div>
          <button type="button" onClick={onClose} className="grid h-8 w-8 place-items-center rounded-lg bg-slate-100 text-lg text-slate-500 hover:bg-slate-200 dark:bg-slate-800">×</button>
        </div>

        {/* Identity */}
        <dl className="space-y-2 rounded-xl border border-slate-200 p-4 text-sm dark:border-slate-800">
          <Row k="Assignee">{number.assignedUserName ? `${number.assignedUserName}${number.assignedExtension ? ` · ext ${number.assignedExtension}` : ''}` : <span className="text-slate-400">Unassigned</span>}</Row>
          <Row k="Type">{number.numberType}</Row>
          <Row k="State"><span className={number.isActive ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500'}>{number.isActive ? 'Active' : 'Inactive'}</span></Row>
          <Row k="Created">{number.createdAt ? new Date(number.createdAt).toLocaleDateString() : '—'}</Row>
        </dl>

        {/* Reassign */}
        <div className="mt-4">
          <div className="text-xs font-bold text-slate-500 dark:text-slate-400">Assign to user</div>
          <div className="mt-1 flex gap-2">
            <select
              value={assignUserId}
              onChange={(e) => setAssignUserId(e.target.value)}
              className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#FF6542] dark:border-slate-800 dark:bg-slate-950"
            >
              <option value="">Unassigned</option>
              {(orgUsers.data?.users ?? []).map((u) => (
                <option key={u.id} value={u.id}>{u.fullName || u.email} {u.extension ? `(ext ${u.extension})` : ''}</option>
              ))}
            </select>
            <Btn variant="primary" size="sm" disabled={!dirty || reassign.isPending} onClick={() => reassign.mutate()}>
              {reassign.isPending ? 'Saving…' : 'Save'}
            </Btn>
          </div>
          {reassign.isError && <p className="mt-1 text-xs font-semibold text-red-600">{(reassign.error as Error)?.message || 'Reassign failed.'}</p>}
          {reassign.isSuccess && !dirty && <p className="mt-1 text-xs font-semibold text-emerald-600">Saved — routing rewired.</p>}
        </div>

        {/* Caller ID name (CNAM) */}
        <div className="mt-4">
          <div className="text-xs font-bold text-slate-500 dark:text-slate-400">Caller ID name (CNAM)</div>
          <div className="mt-1 flex gap-2">
            <input
              type="text"
              maxLength={15}
              value={cnam}
              onChange={(e) => setCnam(e.target.value)}
              placeholder="e.g. ACME DISPATCH"
              className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#FF6542] dark:border-slate-800 dark:bg-slate-950"
            />
            <Btn variant="primary" size="sm" disabled={!cnamDirty || saveCnam.isPending} onClick={() => saveCnam.mutate()}>
              {saveCnam.isPending ? 'Saving…' : 'Save'}
            </Btn>
          </div>
          <p className="mt-1 text-[11px] text-slate-400">Up to 15 characters, pushed to the carrier. Leave blank to clear.</p>
          {saveCnam.isError && <p className="mt-1 text-xs font-semibold text-red-600">{(saveCnam.error as Error)?.message || 'Could not update caller ID.'}</p>}
          {saveCnam.isSuccess && !cnamDirty && <p className="mt-1 text-xs font-semibold text-emerald-600">Caller ID updated.</p>}
        </div>

        {/* Health */}
        <div className="mt-5 border-t border-slate-200 pt-4 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <div className="text-xs font-bold text-slate-500 dark:text-slate-400">Communication health</div>
            <Btn size="sm" disabled={health.isPending} onClick={() => health.mutate()}>{health.isPending ? 'Checking…' : diag ? 'Re-check' : 'Check health'}</Btn>
          </div>
          {health.isError && <p className="mt-2 text-xs font-semibold text-red-600">Diagnostic failed — try the full page.</p>}
          {diag && (
            <div className="mt-3">
              <div className="flex items-center gap-2">
                <span className={`h-2.5 w-2.5 rounded-full ${VERDICT[diag.verdict].dot}`} />
                <span className="text-sm font-black">{VERDICT[diag.verdict].label}</span>
                <span className="text-xs text-slate-400">· {diag.tier}</span>
              </div>
              <div className="mt-2 space-y-1.5">
                {diag.checks.filter((c) => c.status === 'bad' || c.status === 'warn').map((c) => (
                  <div key={c.key} className="flex items-start gap-2 text-xs">
                    <span className="mt-0.5 shrink-0"><StatusDot health={toHealth(c.status)} label="" /></span>
                    <span><b>{c.label}</b> — {c.detail}</span>
                  </div>
                ))}
                {diag.checks.every((c) => c.status !== 'bad' && c.status !== 'warn') && (
                  <div className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">All checks pass.</div>
                )}
              </div>
              <button type="button" onClick={() => router.push(`/admin2/diagnostics?number=${diag.normalized}`)} className="mt-3 text-xs font-bold text-[#FF6542] hover:underline">
                Open full diagnostic →
              </button>
            </div>
          )}
          {!diag && !health.isPending && (
            <button type="button" onClick={() => router.push(`/admin2/diagnostics?number=${number.phoneNumber.replace(/\D/g, '')}`)} className="mt-2 text-xs font-bold text-[#FF6542] hover:underline">
              Open full diagnostic →
            </button>
          )}
        </div>

        {/* Danger zone — release */}
        <div className="mt-5 border-t border-red-200 pt-4 dark:border-red-900/50">
          <div className="text-xs font-bold text-red-600 dark:text-red-400">Danger zone</div>
          {!confirmRelease ? (
            <div className="mt-2">
              <Btn size="sm" variant="danger" onClick={() => setConfirmRelease(true)}>
                Release number
              </Btn>
            </div>
          ) : (
            <div className="mt-2 rounded-xl border border-red-300 bg-red-50 p-3 text-xs dark:border-red-500/40 dark:bg-red-500/10">
              <p className="font-bold text-red-700 dark:text-red-300">Release {number.phoneNumber}?</p>
              <p className="mt-1 text-red-600/90 dark:text-red-300/80">
                The number is <b>given back to Telnyx (irreversible)</b>, its $5/mo billing line is removed,
                and it&apos;s detached from the org + inbound routing. You can&apos;t get this exact number back.
              </p>
              {release.isError && (
                <p className="mt-1 font-semibold text-red-700 dark:text-red-300">{(release.error as Error)?.message || 'Release failed.'}</p>
              )}
              <div className="mt-2 flex justify-end gap-2">
                <Btn size="sm" onClick={() => setConfirmRelease(false)} disabled={release.isPending}>Cancel</Btn>
                <Btn size="sm" variant="danger" onClick={() => release.mutate()} disabled={release.isPending}>
                  {release.isPending ? 'Releasing…' : 'Release permanently'}
                </Btn>
              </div>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}

function Row({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-slate-500 dark:text-slate-400">{k}</dt>
      <dd className="text-right font-semibold">{children}</dd>
    </div>
  );
}
