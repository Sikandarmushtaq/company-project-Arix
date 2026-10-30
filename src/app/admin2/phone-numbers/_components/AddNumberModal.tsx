'use client';

/**
 * Add Number — Purchase New. Search available DIDs (local, area-code scoped),
 * pick one, optionally assign to a user, and buy+provision it into the org via
 * the proven engine (POST /admin/organizations/:id/numbers → provisionNumberForOrg
 * + assignNumber). No Stripe billing (admin-initiated).
 *
 * When `orgId` is fixed (opened from Org Detail) the org picker is hidden; from
 * the Phone Numbers page the admin searches + picks the target org first.
 *
 * ("Use Existing" / importing a free sub number is intentionally not here — it
 * overlaps the create-account sub-import path and is tracked separately.)
 */

import { useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useOrganizations, useOrganizationUsers } from '@/lib/hooks/useAdmin';
import { adminAccountApi, type AvailableNumber } from '@/lib/api/services/admin-account.api';
import { Modal, Btn, StatusDot } from '../../_components/ui';

type Props = {
  orgId?: number;
  orgName?: string;
  onClose: () => void;
  onDone: (phoneNumber: string) => void;
};

export function AddNumberModal({ orgId: fixedOrgId, orgName: fixedOrgName, onClose, onDone }: Props) {
  const [orgQuery, setOrgQuery] = useState('');
  const [orgQueryDebounced, setOrgQueryDebounced] = useState('');
  const [org, setOrg] = useState<{ id: number; name: string } | null>(
    fixedOrgId ? { id: fixedOrgId, name: fixedOrgName ?? `Org ${fixedOrgId}` } : null
  );
  const [areaCode, setAreaCode] = useState('');
  const [picked, setPicked] = useState<AvailableNumber | null>(null);
  const [assignUserId, setAssignUserId] = useState<string>('');
  const [warning, setWarning] = useState<string | null>(null);

  // Debounce the org search so we don't fire a request per keystroke.
  useEffect(() => {
    const t = setTimeout(() => setOrgQueryDebounced(orgQuery.trim()), 300);
    return () => clearTimeout(t);
  }, [orgQuery]);

  // If the target org changes, discard results/selection — they were searched on the
  // previous org's Telnyx account and must not be bought on a different one.
  useEffect(() => {
    setPicked(null);
    search.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [org?.id]);

  const orgList = useOrganizations(
    { page: 1, limit: 8, search: orgQueryDebounced || undefined },
    { enabled: !fixedOrgId && !org && orgQueryDebounced.length >= 2 }
  );
  const orgUsers = useOrganizationUsers(org?.id ?? 0, { page: 1, limit: 200 });

  const search = useMutation({
    mutationFn: () =>
      adminAccountApi.searchNumbers({
        countryCode: 'US',
        areaCode: areaCode.trim() || undefined,
        numberType: 'local',
        limit: 15,
        // Search on the selected org's Telnyx account (sub or mother) so the picked
        // number is orderable on the same account the buy will provision to.
        organizationId: org?.id,
      }),
  });
  const buy = useMutation({
    mutationFn: () =>
      adminAccountApi.buyOrgNumber(org!.id, {
        phoneNumber: picked!.phoneNumber,
        countryCode: picked!.countryCode || 'US',
        numberType: 'local',
        assignUserId: assignUserId ? Number(assignUserId) : null,
      }),
    onSuccess: (r) => {
      // Number bought+provisioned. If assignment failed it's a recoverable
      // warning (number is in the org, just unassigned) — show it rather than
      // silently closing as if fully done.
      if (r.assignWarning) setWarning(r.assignWarning);
      else onDone(r.phoneNumber);
    },
  });

  const money = (c: number) => (c ? `$${(c / 100).toFixed(2)}` : 'std');

  return (
    <Modal onClose={() => !buy.isPending && onClose()} title="Add number" subtitle="Purchase a new DID and provision it into an organization" size="lg">
      <div className="space-y-4">
        {/* Org picker */}
        {!fixedOrgId && (
          <div className="relative">
            <label className="text-xs font-bold text-slate-500 dark:text-slate-400">Organization</label>
            {org ? (
              <div className="mt-1 flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2.5 text-sm dark:border-slate-800">
                <span className="font-semibold">{org.name}</span>
                <button type="button" className="text-xs font-bold text-[#FF6542]" onClick={() => { setOrg(null); setPicked(null); }}>Change</button>
              </div>
            ) : (
              <>
                <input
                  value={orgQuery}
                  onChange={(e) => setOrgQuery(e.target.value)}
                  placeholder="Search organization…"
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#FF6542] dark:border-slate-800 dark:bg-slate-950"
                />
                {orgQueryDebounced.length >= 2 && (
                  <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg dark:border-slate-800 dark:bg-slate-900">
                    {(orgList.data?.organizations ?? []).map((o) => (
                      <button key={o.id} type="button" onClick={() => setOrg({ id: o.id, name: o.name })} className="flex w-full justify-between px-3 py-2 text-left text-sm hover:bg-[#FF6542]/5">
                        <span className="font-semibold">{o.name}</span><span className="font-mono text-xs text-slate-400">{o.slug}</span>
                      </button>
                    ))}
                    {orgList.data && orgList.data.organizations.length === 0 && <div className="px-3 py-2 text-sm text-slate-400">No match.</div>}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Search */}
        <div>
          <label className="text-xs font-bold text-slate-500 dark:text-slate-400">Find a local number</label>
          <div className="mt-1 flex gap-2">
            <input
              value={areaCode}
              onChange={(e) => setAreaCode(e.target.value.replace(/\D/g, '').slice(0, 3))}
              placeholder="Area code (optional), e.g. 754"
              className="w-56 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#FF6542] dark:border-slate-800 dark:bg-slate-950"
            />
            <Btn disabled={search.isPending || !org} onClick={() => { setPicked(null); search.mutate(); }}>
              {search.isPending ? 'Searching…' : 'Search'}
            </Btn>
          </div>
          {!org && (
            <p className="mt-2 text-xs text-slate-400">Select the organization first — numbers are searched on that org&apos;s Telnyx account.</p>
          )}
          {search.isError && <p className="mt-2 text-xs font-semibold text-red-600">Search failed — try again.</p>}
        </div>

        {/* Results */}
        {search.data && (
          <div className="max-h-56 overflow-auto rounded-xl border border-slate-200 dark:border-slate-800">
            {search.data.length === 0 ? (
              <div className="px-3 py-4 text-center text-sm text-slate-400">No local numbers found for that area code.</div>
            ) : (
              search.data.map((n) => (
                <button
                  key={n.phoneNumber}
                  type="button"
                  onClick={() => setPicked(n)}
                  className={`flex w-full items-center justify-between border-b border-slate-100 px-3 py-2.5 text-left text-sm last:border-0 dark:border-slate-800/60 ${picked?.phoneNumber === n.phoneNumber ? 'bg-[#FF6542]/10' : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'}`}
                >
                  <span className="font-mono font-bold">{n.phoneNumber}</span>
                  <span className="text-xs text-slate-400">{n.locality || n.region} · {money(n.monthlyCostCents)}/mo</span>
                </button>
              ))
            )}
          </div>
        )}

        {/* Optional assign */}
        {picked && org && (
          <div>
            <label className="text-xs font-bold text-slate-500 dark:text-slate-400">Assign to (optional)</label>
            <select
              value={assignUserId}
              onChange={(e) => setAssignUserId(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#FF6542] dark:border-slate-800 dark:bg-slate-950"
            >
              <option value="">Leave unassigned</option>
              {(orgUsers.data?.users ?? []).map((u) => (
                <option key={u.id} value={u.id}>{u.fullName || u.email} {u.extension ? `(ext ${u.extension})` : ''}</option>
              ))}
            </select>
          </div>
        )}

        {buy.isError && <p className="text-xs font-semibold text-red-600">{(buy.error as Error)?.message || 'Could not buy the number.'}</p>}
        {warning && (
          <div className="rounded-lg bg-amber-50 p-3 text-xs font-semibold text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
            {warning} <button type="button" className="ml-1 underline" onClick={() => onDone(picked!.phoneNumber)}>Done</button>
          </div>
        )}

        <div className="flex items-center justify-between border-t border-slate-200 pt-4 dark:border-slate-800">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {picked ? <>Buying <span className="font-mono font-bold">{picked.phoneNumber}</span>{org ? <> for <b>{org.name}</b></> : ''}</> : 'Pick a number to continue.'}
          </div>
          <div className="flex gap-2">
            <Btn disabled={buy.isPending} onClick={onClose}>Cancel</Btn>
            <Btn variant="primary" disabled={!org || !picked || buy.isPending} onClick={() => buy.mutate()}>
              {buy.isPending ? 'Provisioning…' : 'Buy & provision'}
            </Btn>
          </div>
        </div>
        <p className="text-[11px] text-slate-400 flex items-center gap-1">
          <StatusDot health="warn" label="" /> Buys a real DID and provisions it (Telnyx + routing). No customer card is charged — admin-initiated.
        </p>
      </div>
    </Modal>
  );
}
