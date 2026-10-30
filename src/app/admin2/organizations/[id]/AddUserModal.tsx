'use client';

/**
 * Flow 2 — Add Team Member modal (matches the GPT prototype), wired to real data.
 *
 * The Phone number field has three modes:
 *   • No number      — create the member now, assign a number later.
 *   • Existing        — pick one of this org's already-bought UNASSIGNED numbers
 *                       (adminAccountApi.listOrgNumbers).
 *   • Buy new         — search available DIDs ON THIS ORG'S Telnyx account (its
 *                       managed sub-account if it has one, else the mother) and buy
 *                       one into the org right here, without leaving the flow.
 *
 * Create posts to the owner-engine endpoint (POST /admin/organizations/:id/users →
 * createUser) which provisions extension + keycard + inbound route and wires the
 * given number to the member. In "Buy new" mode we buy the DID into the org FIRST
 * (unassigned) and then create the member with it as senderPhone — the riskier
 * external Telnyx step runs before any user row exists, so a failed buy can never
 * strand a half-created member. A buy that succeeds but whose member-create then
 * fails leaves the number in the org (recoverable from the Numbers tab), and a
 * retry reuses it instead of buying a second one (boughtFor guard).
 */

import { useEffect, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminAccountApi, type AvailableNumber } from '@/lib/api/services/admin-account.api';
import { Btn, Field, fieldInput, Modal } from '../../_components/ui';

type NumberMode = 'none' | 'existing' | 'buy';

function genPassword(): string {
  // Readable temp password with guaranteed letter+digit+symbol.
  const base = Math.random().toString(36).slice(2, 10);
  return `Arix-${base}${Math.floor(10 + Math.random() * 89)}`;
}

const money = (c: number) => (c ? `$${(c / 100).toFixed(2)}` : 'std');

export function AddUserModal({
  orgId,
  onClose,
  onCreated,
}: {
  orgId: number;
  onClose: () => void;
  onCreated: () => void;
}) {
  const qc = useQueryClient();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'user' | 'manager'>('user');
  const [numberMode, setNumberMode] = useState<NumberMode>('none');
  const [senderPhone, setSenderPhone] = useState(''); // '' = no number (existing mode)
  const [areaCode, setAreaCode] = useState(''); // buy mode
  const [picked, setPicked] = useState<AvailableNumber | null>(null); // buy mode
  const [password, setPassword] = useState(genPassword());
  const [error, setError] = useState('');

  // Remembers a DID we already bought into the org this session, so a retry after a
  // failed member-create reuses it instead of purchasing a second number. Keyed by
  // the picked phone number — picking a DIFFERENT number buys that one.
  const boughtForRef = useRef<string | null>(null);

  // Real-time: this org's numbers (offer the UNASSIGNED ones to the new member).
  const numbersQ = useQuery({
    queryKey: ['admin2', 'org-numbers', orgId],
    queryFn: () => adminAccountApi.listOrgNumbers(orgId),
    staleTime: 10_000,
  });
  const freeNumbers = (numbersQ.data ?? []).filter((n) => n.isActive && !n.assignedUserId);

  // Search available numbers on THIS org's Telnyx account (sub or mother). Passing
  // organizationId makes the backend search on the same account the buy provisions
  // to — otherwise a sub-account org would search the mother and fail to order.
  const search = useMutation({
    mutationFn: () =>
      adminAccountApi.searchNumbers({
        countryCode: 'US',
        areaCode: areaCode.trim() || undefined,
        numberType: 'local',
        limit: 15,
        organizationId: orgId,
      }),
  });

  // Switching away from a mode clears that mode's selection so a stale pick can't be
  // submitted (e.g. switch to "No number" then Add → really creates with no number).
  useEffect(() => {
    if (numberMode !== 'existing') setSenderPhone('');
    if (numberMode !== 'buy') {
      setPicked(null);
      search.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [numberMode]);

  const submit = useMutation({
    mutationFn: async () => {
      let phone: string | undefined;

      if (numberMode === 'existing') {
        phone = senderPhone || undefined;
      } else if (numberMode === 'buy') {
        if (!picked) throw new Error('Pick a number to buy, or choose a different option.');
        // Buy into the org FIRST (unassigned). Skip if this exact number was already
        // bought on a prior (failed) attempt — don't double-purchase on retry.
        if (boughtForRef.current !== picked.phoneNumber) {
          const bought = await adminAccountApi.buyOrgNumber(orgId, {
            phoneNumber: picked.phoneNumber,
            countryCode: picked.countryCode || 'US',
            numberType: 'local',
            assignUserId: null,
          });
          boughtForRef.current = bought.phoneNumber;
          // The number now exists on the org — reflect it in any open numbers list.
          qc.invalidateQueries({ queryKey: ['admin2', 'org-numbers', orgId] });
        }
        phone = picked.phoneNumber;
      }

      return adminAccountApi.createOrgMember(orgId, {
        fullName: fullName.trim(),
        email: email.trim(),
        password,
        role,
        ...(phone ? { senderPhone: phone } : {}),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'organizations'] });
      qc.invalidateQueries({ queryKey: ['admin2', 'org-numbers', orgId] });
      onCreated();
      onClose();
    },
    onError: (e) => {
      // If the DID was bought but the member-create failed, say so plainly — the
      // number is safely on the org and the retry won't buy another.
      const bought = boughtForRef.current;
      const base = e instanceof Error ? e.message : 'Failed to add the user.';
      setError(
        bought
          ? `${base} — the number ${bought} was already added to this organization; fix the details above and click Add again to assign it (it won't be purchased twice).`
          : base
      );
    },
  });

  const needsPick = numberMode === 'buy' && !picked;
  const valid =
    fullName.trim().length > 0 && /.+@.+\..+/.test(email) && password.length >= 6 && !needsPick;

  const modeBtn = (m: NumberMode, label: string) => (
    <button
      type="button"
      onClick={() => setNumberMode(m)}
      className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
        numberMode === m
          ? 'bg-[#FF6542] text-white shadow-sm'
          : 'text-slate-600 hover:bg-slate-200/60 dark:text-slate-300 dark:hover:bg-slate-700/60'
      }`}
    >
      {label}
    </button>
  );

  return (
    <Modal
      title="Add Team Member"
      subtitle="Creates the user, extension, and wires outbound/inbound on this org's telephony."
      onClose={onClose}
      footer={
        <>
          <Btn onClick={onClose}>Cancel</Btn>
          <Btn variant="primary" disabled={!valid || submit.isPending} onClick={() => { setError(''); submit.mutate(); }}>
            {submit.isPending ? (numberMode === 'buy' ? 'Buying & adding…' : 'Adding…') : 'Add Team Member'}
          </Btn>
        </>
      }
    >
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Full name"><input value={fullName} onChange={(e) => setFullName(e.target.value)} className={fieldInput} /></Field>
        <Field label="Email"><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={fieldInput} /></Field>

        <Field label="Role">
          <select value={role} onChange={(e) => setRole(e.target.value as 'user' | 'manager')} className={fieldInput}>
            <option value="user">Agent</option>
            <option value="manager">Manager</option>
          </select>
        </Field>

        <Field label="Temporary password" hint="The user signs in with this; they can change it later.">
          <div className="flex gap-2">
            <input value={password} onChange={(e) => setPassword(e.target.value)} className={fieldInput} />
            <button type="button" onClick={() => setPassword(genPassword())} className="mt-2 shrink-0 rounded-xl border border-slate-200 px-3 text-xs font-bold dark:border-slate-700">↻</button>
          </div>
        </Field>
      </div>

      {/* Phone number — No number / Existing / Buy new */}
      <div className="mt-4">
        <label className="text-xs font-bold text-slate-500 dark:text-slate-400">Phone number</label>
        <div className="mt-1 flex gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800/60">
          {modeBtn('none', 'No number')}
          {modeBtn('existing', 'Existing')}
          {modeBtn('buy', 'Buy new')}
        </div>

        {numberMode === 'none' && (
          <p className="mt-2 text-xs text-slate-400">The member is created without a number — assign one later from the Numbers tab.</p>
        )}

        {numberMode === 'existing' && (
          <div className="mt-2">
            <select value={senderPhone} onChange={(e) => setSenderPhone(e.target.value)} className={fieldInput}>
              <option value="">Select an unassigned number…</option>
              {freeNumbers.map((n) => (
                <option key={n.id} value={n.phoneNumber}>{n.phoneNumber}</option>
              ))}
            </select>
            <p className="mt-2 text-xs text-slate-400">
              {numbersQ.isLoading
                ? 'Loading this org’s numbers…'
                : freeNumbers.length === 0
                ? 'No unassigned numbers in this org — switch to “Buy new” to purchase one now.'
                : 'Unassigned numbers on this organization.'}
            </p>
          </div>
        )}

        {numberMode === 'buy' && (
          <div className="mt-2 space-y-2">
            <div className="flex gap-2">
              <input
                value={areaCode}
                onChange={(e) => { setAreaCode(e.target.value.replace(/\D/g, '').slice(0, 3)); setPicked(null); }}
                placeholder="Area code (optional), e.g. 754"
                className="w-56 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#FF6542] dark:border-slate-800 dark:bg-slate-950"
              />
              <Btn disabled={search.isPending} onClick={() => { setPicked(null); search.mutate(); }}>
                {search.isPending ? 'Searching…' : 'Search'}
              </Btn>
            </div>
            <p className="text-xs text-slate-400">Searches on this organization’s Telnyx account; the number is bought into the org when you click Add.</p>
            {search.isError && <p className="text-xs font-semibold text-red-600">Search failed — try again.</p>}

            {search.data && (
              <div className="max-h-48 overflow-auto rounded-xl border border-slate-200 dark:border-slate-800">
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
            {picked && <p className="text-xs text-slate-500 dark:text-slate-400">Will buy <span className="font-mono font-bold">{picked.phoneNumber}</span> into this org and assign it to the new member.</p>}
          </div>
        )}
      </div>

      {error && <p className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700 dark:border-red-950 dark:bg-red-950/30 dark:text-red-300">{error}</p>}
    </Modal>
  );
}
