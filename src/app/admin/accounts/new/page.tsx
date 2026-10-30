'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  FiSearch,
  FiLoader,
  FiCheckCircle,
  FiPhone,
  FiUser,
  FiMessageSquare,
  FiArrowLeft,
  FiLayers,
  FiCheck,
  FiAlertTriangle,
  FiZap,
  FiUnlock,
} from 'react-icons/fi';
import { Card, CardContent, CardHeader, CardTitle, Button, StyledSelect } from '@/components/ui';
import { Input } from '@/components/ui/input';
import { toast } from '@/lib/stores/toast';
import {
  adminAccountApi,
  type AvailableNumber,
  type CreateAccountResult,
} from '@/lib/api/services/admin-account.api';

type AccountType = 'subaccount' | 'mother' | 'sms-sub';

const SMS_PACKAGES = [
  { slug: '', label: 'No package (pay per message)' },
  { slug: 'sms3k', label: 'SMS — 3,000 / mo' },
  { slug: 'sms5k', label: 'SMS — 5,000 / mo' },
  { slug: 'sms10k', label: 'SMS — 10,000 / mo' },
  { slug: 'sms25k', label: 'SMS — 25,000 / mo' },
];

/** Digits only, clamped to the backend's max (1,000,000); '' stays '' (→ default 100). */
function clampCap(v: string): string {
  const d = v.replace(/[^\d]/g, '');
  if (!d) return '';
  return String(Math.min(1_000_000, Number(d)));
}

function fmtPhone(p: string): string {
  const d = p.replace(/[^\d]/g, '').replace(/^1/, '');
  return d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : p;
}

export default function CreateAccountPage() {
  // Business + owner
  const [businessName, setBusinessName] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [password, setPassword] = useState('');
  const [planSlug, setPlanSlug] = useState<'starter' | 'professional'>('professional');

  // Number
  const [numberCountry, setNumberCountry] = useState<'US' | 'CA'>('US');
  const [areaCode, setAreaCode] = useState('');
  const [numbers, setNumbers] = useState<AvailableNumber[]>([]);
  const [selected, setSelected] = useState<AvailableNumber | null>(null);
  // True when `selected` is a number the sub ALREADY owns (assign, don't buy).
  const [assignExisting, setAssignExisting] = useState(false);

  // Account type — drives WHERE the number is bought and whether SMS is instant.
  const [accountType, setAccountType] = useState<AccountType>('subaccount');
  // When accountType==='sms-sub', which registered SMS-active managed account to assign into.
  const [assignManagedAccountId, setAssignManagedAccountId] = useState('');

  // SMS-active sub-accounts (registered under /admin/telnyx/sms-subaccounts).
  const smsSubsQuery = useQuery({
    queryKey: ['admin-sms-subaccounts'],
    queryFn: () => adminAccountApi.listSmsSubaccounts(),
    staleTime: 60_000,
  });
  // All REGISTERED subs are assignable — one without an active 10DLC is used for
  // CALLS only (SMS turns on once its campaign is active). SMS-active first.
  const registeredSubs = (smsSubsQuery.data ?? [])
    .filter((s) => s.registered)
    .sort((a, b) => Number(b.smsActive) - Number(a.smsActive));

  // Numbers the selected sub ALREADY owns — free ones can be assigned (no buy).
  const subNumbersQuery = useQuery({
    queryKey: ['admin-sub-numbers', assignManagedAccountId],
    queryFn: () => adminAccountApi.listSmsSubaccountNumbers(assignManagedAccountId),
    enabled: accountType === 'sms-sub' && !!assignManagedAccountId,
    staleTime: 30_000,
  });
  const freeSubNumbers = (subNumbersQuery.data ?? []).filter((n) => n.free);

  // Usage limits — trial vs unlimited. Default unlimited (existing behavior).
  // Trial caps are editable; default 100 min / 100 SMS (the standard trial).
  const [trialMode, setTrialMode] = useState(false);
  const [trialMinutes, setTrialMinutes] = useState('100');
  const [trialSms, setTrialSms] = useState('100');

  // SMS (only meaningful for the mother / instant-SMS account type)
  const [smsPackageSlug, setSmsPackageSlug] = useState('');
  const [smsAutoRenew, setSmsAutoRenew] = useState(false);

  const [result, setResult] = useState<CreateAccountResult | null>(null);

  const search = useMutation({
    mutationFn: () =>
      adminAccountApi.searchNumbers({
        countryCode: numberCountry,
        areaCode: areaCode || undefined,
        numberType: 'local',
        limit: 15,
      }),
    onSuccess: (data) => {
      setNumbers(data);
      setSelected(null);
      // Empty + error states are shown persistently in the results area (below),
      // not as a transient toast — so "no numbers here" is never missed.
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : 'Number search failed'),
  });

  const create = useMutation({
    mutationFn: () =>
      adminAccountApi.createAccount({
        businessName: businessName.trim(),
        contactName: contactName.trim(),
        contactEmail: contactEmail.trim(),
        password,
        planSlug,
        number: {
          phoneNumber: selected!.phoneNumber,
          countryCode: selected!.countryCode,
          region: selected!.region,
          locality: selected!.locality,
          numberType: selected!.numberType,
        },
        brandOrigin: typeof window !== 'undefined' ? window.location.origin : undefined,
        // Trial → cap the account (editable amounts, default 100); unlimited → lift caps.
        trialMode,
        bypassKyc: !trialMode,
        ...(trialMode
          ? {
              trialCallMinutes: Math.max(1, Number(trialMinutes) || 100),
              trialSms: Math.max(1, Number(trialSms) || 100),
            }
          : {}),
        // Assign into an existing SMS-active sub takes precedence; otherwise the
        // account-type choice (mother/own sub) drives where the number is bought.
        ...(accountType === 'sms-sub'
          ? { assignManagedAccountId, assignExistingNumber: assignExisting }
          : { accountType }),
        // SMS package only applies to an UNLIMITED mother account. A calls-only
        // sub-account never carries one (SMS via its own 10DLC later), and a Trial
        // account must not — a package would override the 100-SMS trial cap.
        smsPackageSlug:
          accountType === 'mother' && !trialMode ? smsPackageSlug || undefined : undefined,
        smsAutoRenew: accountType === 'mother' && !trialMode ? smsAutoRenew : false,
      }),
    onSuccess: (data) => {
      setResult(data);
      if (data.provisioningComplete) {
        toast.success('Account created and provisioned.');
      } else {
        toast.error('Account created, but provisioning didn’t finish — retry from Signups.');
      }
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : 'Account creation failed'),
  });

  const canCreate =
    businessName.trim() &&
    contactName.trim() &&
    /.+@.+\..+/.test(contactEmail) &&
    password.length >= 8 &&
    selected &&
    // Assigning into an SMS sub-account requires a chosen sub.
    (accountType !== 'sms-sub' || !!assignManagedAccountId) &&
    !create.isPending;

  const resetForm = () => {
    setResult(null);
    setBusinessName('');
    setContactName('');
    setContactEmail('');
    setPassword('');
    setNumbers([]);
    setSelected(null);
    setAccountType('subaccount');
    setTrialMode(false);
    setTrialMinutes('100');
    setTrialSms('100');
    setSmsPackageSlug('');
    setSmsAutoRenew(false);
  };

  // ---- Result screen --------------------------------------------------------
  if (result) {
    // Provisioning can fail partway (e.g. Telnyx unreachable → the number wasn't
    // purchased): the org + owner exist but the account can't call yet. Never show
    // a false "Account is live" — surface the truth and route the admin to the
    // one-click retry on the order's Signups page.
    if (!result.provisioningComplete) {
      return (
        <div className="mx-auto max-w-2xl">
          <Card>
            <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
              <FiAlertTriangle className="h-12 w-12 text-amber-500" />
              <div>
                <h2 className="text-xl font-semibold text-[var(--foreground)]">
                  Provisioning didn&apos;t finish
                </h2>
                <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                  {businessName}&apos;s org and owner login were created, but the number
                  {result.extension ? '' : ' and calling extension'} didn&apos;t finish provisioning
                  — often a temporary Telnyx or FusionPBX hiccup. Nothing was lost. Finish it with one
                  click from the order&apos;s page.
                </p>
              </div>
              <dl className="w-full max-w-sm space-y-2 rounded-xl border border-[var(--border)] p-4 text-left text-sm">
                <Row k="Login email" v={contactEmail} />
                <Row k="Phone number" v={result.phoneNumber ? fmtPhone(result.phoneNumber) : 'Not purchased'} />
                <Row k="Extension" v={result.extension ?? 'Not created'} />
                <Row
                  k="Usage limit"
                  v={trialMode ? `Trial · ${trialMinutes || '100'} min / ${trialSms || '100'} SMS/mo` : 'Unlimited'}
                />
                <Row k="Organization ID" v={String(result.organizationId)} />
                <Row k="Order ID" v={String(result.orderId)} />
              </dl>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={resetForm}>
                  Create another
                </Button>
                <Button onClick={() => (window.location.href = `/admin/signups/${result.orderId}`)}>
                  Finish in Signups
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return (
      <div className="mx-auto max-w-2xl">
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
            <FiCheckCircle className="h-12 w-12 text-emerald-500" />
            <div>
              <h2 className="text-xl font-semibold text-[var(--foreground)]">Account is live</h2>
              <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                {businessName} can log in and start calling now.
              </p>
            </div>
            <dl className="w-full max-w-sm space-y-2 rounded-xl border border-[var(--border)] p-4 text-left text-sm">
              <Row k="Login email" v={contactEmail} />
              <Row k="Phone number" v={fmtPhone(result.phoneNumber)} />
              <Row k="Extension" v={result.extension ?? '—'} />
              <Row k="Organization ID" v={String(result.organizationId)} />
              <Row
                k="Account type"
                v={accountType === 'mother' ? 'Mother · instant SMS' : 'Sub-account · calls only'}
              />
              <Row
                k="Usage limit"
                v={trialMode ? `Trial · ${trialMinutes || '100'} min / ${trialSms || '100'} SMS/mo` : 'Unlimited'}
              />
              <Row k="SMS package" v={result.smsPackageGranted ?? 'None'} />
            </dl>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={resetForm}>
                Create another
              </Button>
              <Button onClick={() => (window.location.href = `/admin/organizations/${result.organizationId}`)}>
                View organization
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ---- Form -----------------------------------------------------------------
  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div>
        <Link
          href="/admin/users"
          className="mb-3 inline-flex items-center gap-1.5 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
        >
          <FiArrowLeft className="h-4 w-4" /> Back to Users
        </Link>
        <h1 className="text-2xl font-semibold text-[var(--foreground)]">Create account</h1>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">
          Provision a customer in one step — org, owner, number and calling are set up automatically.
          No Telnyx portal.
        </p>
      </div>

      {/* Business + owner */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FiUser className="h-4 w-4" /> Business &amp; owner
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Business name">
            <Input value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder="Acme Logistics" />
          </Field>
          <Field label="Plan">
            <StyledSelect value={planSlug} onChange={(v) => setPlanSlug(v as 'starter' | 'professional')}>
              <option value="professional">Professional</option>
              <option value="starter">Starter</option>
            </StyledSelect>
          </Field>
          <Field label="Owner name">
            <Input value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="Jane Doe" />
          </Field>
          <Field label="Owner email (login)">
            <Input
              type="email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              placeholder="jane@acme.com"
            />
          </Field>
          <Field label="Temporary password">
            <Input
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="min 8 characters"
            />
          </Field>
        </CardContent>
      </Card>

      {/* Account type — drives where the number is bought + whether SMS is instant.
          Comes before the number step: the choice decides which Telnyx account the
          number is purchased in. */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FiLayers className="h-4 w-4" /> Account type
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <AccountTypeOption
              active={accountType === 'subaccount'}
              onClick={() => setAccountType('subaccount')}
              icon={<FiPhone className="h-4 w-4" />}
              title="Calls only"
              tag="Sub-account · isolated"
              desc="Number lives in the customer's own isolated Telnyx sub-account. Calling works now; SMS is added later once they register their own 10DLC."
            />
            <AccountTypeOption
              active={accountType === 'mother'}
              onClick={() => setAccountType('mother')}
              icon={<FiMessageSquare className="h-4 w-4" />}
              title="Calls + instant SMS"
              tag="Mother account · shared 10DLC"
              desc="Number lives in the mother account on the shared 10DLC. Calling and SMS both work immediately — no waiting on registration."
            />
            <AccountTypeOption
              active={accountType === 'sms-sub'}
              onClick={() => setAccountType('sms-sub')}
              icon={<FiLayers className="h-4 w-4" />}
              title="Existing sub-account"
              tag="Assign into a registered sub"
              desc="Buy the number inside a registered Telnyx sub-account. If the sub has an ACTIVE 10DLC campaign, calls + SMS both work now; if not, it's used for calls only (SMS turns on once its campaign is active)."
            />
          </div>

          {/* Pick which registered sub to assign into (SMS-active or calls-only). */}
          {accountType === 'sms-sub' && (
            <div className="rounded-lg border border-[var(--border)] bg-[var(--muted)]/30 p-3">
              <Field label="Sub-account">
                {smsSubsQuery.isLoading ? (
                  <p className="text-sm text-[var(--muted-foreground)]">Loading sub-accounts…</p>
                ) : registeredSubs.length === 0 ? (
                  <p className="text-sm text-[var(--muted-foreground)]">
                    No sub-accounts registered yet. Register one under{' '}
                    <span className="font-medium text-[var(--foreground)]">
                      Telnyx SMS Sub-accounts
                    </span>{' '}
                    (paste its API key) first.
                  </p>
                ) : (
                  <>
                    <StyledSelect
                      value={assignManagedAccountId}
                      onChange={(v) => {
                        setAssignManagedAccountId(v);
                        // Clear any number chosen for the previous sub.
                        setSelected(null);
                        setAssignExisting(false);
                      }}
                    >
                      <option value="">Select a sub-account…</option>
                      {registeredSubs.map((s) => (
                        <option key={s.managedAccountId} value={s.managedAccountId}>
                          {s.organizationName || s.email || s.managedAccountId}
                          {s.smsActive
                            ? ` · calls + SMS (10DLC ${s.campaignStatus || 'ACTIVE'})`
                            : ' · calls only (no active 10DLC)'}
                          {s.hasVoiceKeycard ? '' : ' · no voice keycard'}
                        </option>
                      ))}
                    </StyledSelect>
                    {assignManagedAccountId &&
                      !registeredSubs.find((s) => s.managedAccountId === assignManagedAccountId)
                        ?.smsActive && (
                        <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                          This sub has no active 10DLC campaign — the account will be{' '}
                          <span className="font-medium text-[var(--foreground)]">calls only</span>{' '}
                          until its campaign is registered.
                        </p>
                      )}
                  </>
                )}
              </Field>
            </div>
          )}

          {/* SMS package only applies to an UNLIMITED mother account — a package
              would override the trial's 100-SMS cap, so it's hidden under Trial. */}
          {accountType === 'mother' && !trialMode && (
            <div className="grid gap-4 rounded-lg border border-[var(--border)] bg-[var(--muted)]/30 p-3 sm:grid-cols-2">
              <Field label="SMS package (optional)">
                <StyledSelect value={smsPackageSlug} onChange={setSmsPackageSlug}>
                  {SMS_PACKAGES.map((p) => (
                    <option key={p.slug} value={p.slug}>
                      {p.label}
                    </option>
                  ))}
                </StyledSelect>
              </Field>
              {smsPackageSlug && (
                <label className="flex cursor-pointer items-center gap-2 self-end pb-2 text-sm text-[var(--foreground)]">
                  <input
                    type="checkbox"
                    checked={smsAutoRenew}
                    onChange={(e) => setSmsAutoRenew(e.target.checked)}
                    className="h-4 w-4"
                  />
                  Auto-renew monthly
                </label>
              )}
            </div>
          )}
          {accountType === 'mother' && trialMode && (
            <p className="rounded-lg border border-[var(--border)] bg-[var(--muted)]/30 p-3 text-xs text-[var(--muted-foreground)]">
              Trial caps SMS at {trialSms || '100'}/mo (set above). To grant a larger SMS package,
              switch Usage limits to<b className="text-[var(--foreground)]"> Unlimited</b>.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Usage limits — trial cap vs unlimited. Default unlimited (existing behavior). */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FiZap className="h-4 w-4" /> Usage limits
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2">
            <AccountTypeOption
              active={!trialMode}
              onClick={() => setTrialMode(false)}
              icon={<FiUnlock className="h-4 w-4" />}
              title="Unlimited"
              tag="No caps"
              desc="Full calling and SMS with no monthly cap. Best for paying customers you've vouched for."
            />
            <AccountTypeOption
              active={trialMode}
              onClick={() => setTrialMode(true)}
              icon={<FiZap className="h-4 w-4" />}
              title="Trial"
              tag="Capped · editable"
              desc="Caps the account's monthly calling and SMS. Defaults to 100 / 100 (the self-serve trial); set your own amounts below. Lift it later by verifying the account."
            />
          </div>

          {trialMode && (
            <div className="mt-3 grid gap-4 rounded-lg border border-[var(--border)] bg-[var(--muted)]/30 p-3 sm:grid-cols-2">
              <Field label="Call minutes / month">
                <Input
                  type="number"
                  min={1}
                  max={1000000}
                  value={trialMinutes}
                  onChange={(e) => setTrialMinutes(clampCap(e.target.value))}
                  placeholder="100"
                />
              </Field>
              <Field label="SMS / month">
                <Input
                  type="number"
                  min={1}
                  max={1000000}
                  value={trialSms}
                  onChange={(e) => setTrialSms(clampCap(e.target.value))}
                  placeholder="100"
                />
              </Field>
              <p className="text-[11px] text-[var(--muted-foreground)] sm:col-span-2">
                Leave at 100 for the standard trial, or set custom monthly limits. Blank counts as 100.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Number — bought in the account chosen above, on create. */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FiPhone className="h-4 w-4" /> Phone number
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Free numbers the chosen sub ALREADY owns — assign one with NO
              purchase. Only shown when assigning into a sub. */}
          {accountType === 'sms-sub' && assignManagedAccountId && (
            <div className="rounded-lg border border-[var(--border)] bg-[var(--muted)]/30 p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-medium text-[var(--foreground)]">
                  Free numbers in this sub-account
                </span>
                {subNumbersQuery.isFetching && (
                  <FiLoader className="h-4 w-4 animate-spin text-[var(--muted-foreground)]" />
                )}
              </div>
              {subNumbersQuery.isLoading ? (
                <p className="text-sm text-[var(--muted-foreground)]">Loading numbers…</p>
              ) : freeSubNumbers.length === 0 ? (
                <p className="text-sm text-[var(--muted-foreground)]">
                  No free numbers in this sub — search below to buy a new one.
                </p>
              ) : (
                <div className="grid max-h-40 gap-1.5 overflow-y-auto">
                  {freeSubNumbers.map((n) => (
                    <button
                      key={n.phoneNumber}
                      type="button"
                      onClick={() => {
                        setSelected({
                          phoneNumber: n.phoneNumber,
                          countryCode: 'US',
                          region: '',
                          locality: '',
                          numberType: 'local',
                          features: [],
                          monthlyCostCents: 0,
                          upfrontCostCents: 0,
                        });
                        setAssignExisting(true);
                      }}
                      className={
                        'flex items-center justify-between gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors ' +
                        (assignExisting && selected?.phoneNumber === n.phoneNumber
                          ? 'bg-[var(--primary-600)]/10 ring-1 ring-[var(--primary-600)]'
                          : 'hover:bg-[var(--muted)]/50')
                      }
                    >
                      <span className="font-medium text-[var(--foreground)]">
                        {fmtPhone(n.phoneNumber)}
                      </span>
                      <span className="shrink-0 rounded-full bg-green-500/10 px-2 py-0.5 text-xs font-medium text-green-600 dark:text-green-400">
                        Free · assign (no charge)
                      </span>
                    </button>
                  ))}
                </div>
              )}
              <p className="mt-2 text-xs text-[var(--muted-foreground)]">
                Or search below to buy a new number inside this sub-account instead.
              </p>
            </div>
          )}

          <div className="flex flex-wrap items-end gap-2">
            <Field label="Country" className="w-44">
              <StyledSelect
                value={numberCountry}
                onChange={(v) => {
                  const c = v as 'US' | 'CA';
                  if (c === numberCountry) return;
                  setNumberCountry(c);
                  setNumbers([]);
                  setSelected(null);
                }}
                aria-label="Number country"
              >
                <option value="US">United States</option>
                <option value="CA">Canada</option>
              </StyledSelect>
            </Field>
            <Field label="Area code (optional)" className="w-40">
              <Input
                value={areaCode}
                onChange={(e) => setAreaCode(e.target.value.replace(/\D/g, '').slice(0, 3))}
                placeholder="e.g. 415"
                inputMode="numeric"
              />
            </Field>
            <Button variant="secondary" onClick={() => search.mutate()} disabled={search.isPending}>
              {search.isPending ? <FiLoader className="h-4 w-4 animate-spin" /> : <FiSearch className="h-4 w-4" />}
              <span className="ml-1.5">Search</span>
            </Button>
          </div>

          {numbers.length > 0 && (
            <div className="grid max-h-56 gap-1.5 overflow-y-auto rounded-lg border border-[var(--border)] p-1.5">
              {numbers.map((n) => (
                <button
                  key={n.phoneNumber}
                  type="button"
                  onClick={() => {
                    setSelected(n);
                    setAssignExisting(false);
                  }}
                  className={
                    'flex items-center justify-between gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors ' +
                    (!assignExisting && selected?.phoneNumber === n.phoneNumber
                      ? 'bg-[var(--primary-600)]/10 ring-1 ring-[var(--primary-600)]'
                      : 'hover:bg-[var(--muted)]/50')
                  }
                >
                  <span className="font-medium text-[var(--foreground)]">{fmtPhone(n.phoneNumber)}</span>
                  <span className="flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
                    <span className="truncate">
                      {n.locality ? `${n.locality}, ` : ''}
                      {n.region}
                    </span>
                    {n.monthlyCostCents > 0 && (
                      <span className="shrink-0 font-mono">${(n.monthlyCostCents / 100).toFixed(2)}/mo</span>
                    )}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Persistent empty state — a search ran but nothing matched the filters. */}
          {search.isSuccess && numbers.length === 0 && (
            <div className="rounded-lg border border-dashed border-[var(--border)] px-3 py-4 text-center text-sm text-[var(--muted-foreground)]">
              No local numbers under $2/mo{areaCode ? <> in area code <b className="text-[var(--foreground)]">{areaCode}</b></> : ''}{' '}
              are available right now.{' '}
              {areaCode ? 'Try a different area code.' : 'Try entering a 3-digit area code.'}
            </div>
          )}

          {/* Persistent error state — the search request itself failed. */}
          {search.isError && (
            <div className="rounded-lg border border-red-300 bg-red-50 px-3 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
              Couldn&apos;t search numbers:{' '}
              {search.error instanceof Error ? search.error.message : 'please try again.'}
            </div>
          )}
          {selected && (
            <p className="text-xs text-[var(--muted-foreground)]">
              Selected <b className="text-[var(--foreground)]">{fmtPhone(selected.phoneNumber)}</b> — bought on
              create.
            </p>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center justify-end gap-3">
        {!selected && <span className="text-xs text-[var(--muted-foreground)]">Pick a number to continue</span>}
        <Link href="/admin/users">
          <Button variant="secondary" disabled={create.isPending}>
            Cancel
          </Button>
        </Link>
        <Button onClick={() => create.mutate()} disabled={!canCreate} loading={create.isPending}>
          Create account
        </Button>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="mb-1 block text-xs font-medium text-[var(--muted-foreground)]">{label}</label>
      {children}
    </div>
  );
}

function AccountTypeOption({
  active,
  onClick,
  icon,
  title,
  tag,
  desc,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  tag: string;
  desc: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={
        'relative flex flex-col gap-2 rounded-xl border p-4 text-left transition-all ' +
        (active
          ? 'border-[var(--primary-600)] bg-[var(--primary-600)]/5 ring-1 ring-[var(--primary-600)]'
          : 'border-[var(--border)] hover:border-[var(--muted-foreground)]/40 hover:bg-[var(--muted)]/40')
      }
    >
      {active && (
        <span className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-[var(--primary-600)] text-white">
          <FiCheck className="h-3 w-3" aria-hidden="true" />
        </span>
      )}
      <span className="flex items-center gap-2">
        <span
          className={
            'flex h-8 w-8 items-center justify-center rounded-lg ' +
            (active
              ? 'bg-[var(--primary-600)]/15 text-[var(--primary-600)]'
              : 'bg-[var(--muted)] text-[var(--muted-foreground)]')
          }
        >
          {icon}
        </span>
        <span className="font-semibold text-[var(--foreground)]">{title}</span>
      </span>
      <span className="text-[11px] font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
        {tag}
      </span>
      <span className="text-xs leading-relaxed text-[var(--muted-foreground)]">{desc}</span>
    </button>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-[var(--muted-foreground)]">{k}</dt>
      <dd className="font-medium text-[var(--foreground)]">{v}</dd>
    </div>
  );
}
