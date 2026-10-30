'use client';

/**
 * Page 3 — Create Organization wizard, wired to the real admin provisioning API.
 *
 * Maps 1:1 to CreateAccountInput (adminAccountApi.createAccount), which runs the
 * same battle-tested onboardingService.provisionOrder as self-serve signup.
 * Steps: Company → Owner → Plan → Services → Telephony → Number & options → Review.
 *
 * Reads (number search, sub-account list, sub free-numbers, entitlement catalog)
 * are wired. The final "Create" POST provisions a REAL org + owner + number, then
 * applies the chosen SERVICE entitlements to the new org (entitlementApi.setModule)
 * — so the Services step is real, not cosmetic. Fires only on the explicit Create.
 *
 * NOTE on prototype parity: the GPT prototype's Company step shows country/timezone
 * and Owner shows contact-phone + "send invite" — the real createAccount endpoint
 * accepts none of those, so they're intentionally omitted rather than added as
 * no-op fields (professional > faithful-but-fake).
 */

import { useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/lib/stores/auth';
import { superadminApiService } from '@/lib/api/services/superadmin.service';
import {
  adminAccountApi,
  type AvailableNumber,
  type AdminSmsSubaccount,
  type SubaccountNumber,
  type CreateAccountInput,
  type CreateAccountResult,
  type CustomPlanInput,
  type NumberDiagnostic,
  type DiagnosticCheckStatus,
} from '@/lib/api/services/admin-account.api';
import { entitlementApi, type TenantModule } from '@/lib/api/services/entitlement.api';
import { StatusDot, type Health } from '../_components/ui';
import { PlanTemplatePicker } from '../_components/PlanTemplatePicker';

function diagToHealth(s: DiagnosticCheckStatus): Health {
  return s === 'ok' ? 'ok' : s === 'warn' ? 'warn' : s === 'bad' ? 'bad' : 'off';
}

type AccountType = 'subaccount' | 'mother' | 'sms-sub';
const STEPS = ['Company', 'Owner', 'Plan', 'Services', 'Telephony', 'Number', 'Review'];

export default function OnboardingWizard() {
  const router = useRouter();
  const { user } = useAuthStore();
  const isSuperAdmin = user?.role === 'super_admin' || user?.role === 'superadmin';
  const queryClient = useQueryClient();

  const [step, setStep] = useState(0);
  // Two ways to create an org: the guided WIZARD (one step at a time) or the
  // FORM (everything on one page). Same fields, same submit — just layout.
  // Preference is remembered per-admin.
  const [mode, setMode] = useState<'wizard' | 'form'>('wizard');
  useEffect(() => {
    try {
      const saved = localStorage.getItem('admin2:onboarding:mode');
      if (saved === 'form' || saved === 'wizard') setMode(saved);
    } catch { /* storage unavailable — keep default */ }
  }, []);
  const chooseMode = (m: 'wizard' | 'form') => {
    setMode(m);
    try { localStorage.setItem('admin2:onboarding:mode', m); } catch { /* ignore */ }
  };

  // Company / Owner
  const [businessName, setBusinessName] = useState('');
  const [businessNature, setBusinessNature] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [password, setPassword] = useState('');

  // Custom plan — the super-admin builds the plan per customer (replaces the two
  // fixed tiers). planSlug is always 'custom' from this flow.
  const planSlug = 'custom' as const;

  const pricingQ = useQuery({
    queryKey: ['admin2', 'pricing-plans'],
    queryFn: () => superadminApiService.getPricingPlans(),
    staleTime: 30_000,
  });
  const licensePlan = pricingQ.data?.data?.find(
    (p) => p.planType === 'platform_fee' && p.isActive
  );
  const standardSeatPrice = licensePlan ? licensePlan.monthlyPriceCents / 100 : 80;

  const smsPlan = pricingQ.data?.data?.find(
    (p) => p.planType === 'sms_service' && p.isActive
  );
  const smsRateDisplay = smsPlan
    ? smsPlan.currency?.toUpperCase() === 'PKR'
      ? `Rs ${(smsPlan.monthlyPriceCents / 100).toFixed(2)} / SMS`
      : `$${(smsPlan.monthlyPriceCents / 100).toFixed(3)} / SMS`
    : 'Rs 3.50 / SMS';

  const [cpLabel, setCpLabel] = useState('Custom');
  const [cpSeats, setCpSeats] = useState('1'); // Default 1 seat per license
  const [cpUnitPrice, setCpUnitPrice] = useState('80');
  const [cpPrice, setCpPrice] = useState('80');
  const [priceManuallyEdited, setPriceManuallyEdited] = useState(false);

  // Sync with real standard pricing once fetched if admin hasn't typed a custom override
  useEffect(() => {
    if (licensePlan && !priceManuallyEdited) {
      const s = Math.max(1, parseInt(cpSeats, 10) || 1);
      const unit = licensePlan.monthlyPriceCents / 100;
      setCpUnitPrice(unit.toString());
      setCpPrice((s * unit).toFixed(0));
    }
  }, [licensePlan, priceManuallyEdited, cpSeats]);

  const [cpDevices, setCpDevices] = useState('3');
  const [cpIncludedNumbers, setCpIncludedNumbers] = useState('1'); // 1 included number per seat
  const [cpMaxNumbers, setCpMaxNumbers] = useState('5'); // hard cap on total numbers
  // SMS allowance: 100 SMS per seat purchased. Written to sms_soft_cap.
  const [smsAllowance, setSmsAllowance] = useState('100');

  // Telephony
  const [accountType, setAccountType] = useState<AccountType>('subaccount');
  const [subs, setSubs] = useState<AdminSmsSubaccount[]>([]);
  const [assignManagedAccountId, setAssignManagedAccountId] = useState('');
  const [assignExistingNumber, setAssignExistingNumber] = useState(false);

  // Number
  const [areaCode, setAreaCode] = useState('');
  const [searchResults, setSearchResults] = useState<AvailableNumber[]>([]);
  const [subNumbers, setSubNumbers] = useState<SubaccountNumber[]>([]);
  const [motherNumbers, setMotherNumbers] = useState<SubaccountNumber[]>([]);
  const [selectedNumbers, setSelectedNumbers] = useState<string[]>([]);
  const [searching, setSearching] = useState(false);

  // Options
  const [trialMode, setTrialMode] = useState(false);
  const [trialMinutes, setTrialMinutes] = useState('100');
  const [trialSms, setTrialSms] = useState('100');

  // Services (tenant entitlement modules) — real catalog, applied after create.
  const [modules, setModules] = useState<TenantModule[]>([]);
  const [services, setServices] = useState<Record<string, boolean>>({});

  // Submit
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<CreateAccountResult | null>(null);
  const [entitlementNote, setEntitlementNote] = useState('');

  // Post-create verification: run the REAL per-number diagnostic on the new
  // number so the result screen shows the granular, true provisioning state
  // (extension, inbound gateway, routing, messaging) — not a faked checklist.
  const [verify, setVerify] = useState<NumberDiagnostic | 'loading' | 'error' | null>(null);
  useEffect(() => {
    const num = result?.phoneNumber;
    if (!num) return;
    let cancelled = false;
    setVerify('loading');
    adminAccountApi
      .diagnoseNumber(num)
      .then((d) => { if (!cancelled) setVerify(d); })
      .catch(() => { if (!cancelled) setVerify('error'); });
    return () => { cancelled = true; };
  }, [result?.phoneNumber]);

  // Load the entitlement module catalog once (for the Services step).
  useEffect(() => {
    let cancelled = false;
    entitlementApi
      .list()
      .then((d) => {
        if (cancelled) return;
        setModules(d.modules);
        // Seed each toggle from its module default — EXCEPT dispositions, which we
        // force OFF for new orgs (super-admin can switch it on per-tenant later).
        // Seeding it false against its true module-default also makes the submit
        // diff emit an explicit setModule(org,'dispositions',false) on create.
        setServices(
          Object.fromEntries(
            d.modules.map((m) => [m.code, m.code === 'dispositions' ? false : m.defaultEnabled])
          )
        );
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const loadSubs = async () => {
    try {
      const list = await adminAccountApi.listSmsSubaccounts();
      // Only subs that are assignable to a NEW account: registered (we hold its key),
      // left OFFERED for signup by an admin, and not disabled at Telnyx. A sub kept
      // running for its existing orgs but withheld/disabled must not appear here.
      setSubs(
        list.filter(
          (s) =>
            s.registered &&
            s.signupEnabled !== false &&
            (s.status || '').toLowerCase() !== 'disabled'
        )
      );
    } catch { setSubs([]); }
  };

  const searchNumbers = async () => {
    setSearching(true);
    setSearchResults([]);
    try {
      const res = await adminAccountApi.searchNumbers({ areaCode: areaCode || undefined, limit: 10 });
      setSearchResults(res);
    } catch { setSearchResults([]); }
    setSearching(false);
  };

  const loadSubNumbers = async (managedId: string) => {
    setSubNumbers([]);
    try {
      const res = await adminAccountApi.listSmsSubaccountNumbers(managedId);
      setSubNumbers(res.filter((n) => n.free));
    } catch { setSubNumbers([]); }
  };

  const loadMotherNumbers = async () => {
    setMotherNumbers([]);
    try {
      const res = await adminAccountApi.listMotherNumbers();
      setMotherNumbers(res.filter((n) => n.free));
    } catch { setMotherNumbers([]); }
  };

  // Custom plan: a valid monthly price (>= $0) and at least 1 seat are required;
  // devices / SMS / included-numbers fall back to sane values in buildCustomPlan.
  const cpPriceNum = parseFloat(cpPrice);
  const cpIncludedNum = Math.max(0, parseInt(cpIncludedNumbers, 10) || 0);
  const cpMaxNum = Math.max(1, parseInt(cpMaxNumbers, 10) || 1);
  // How many numbers the plan INCLUDES is how many the admin must select on the
  // Number step. A custom plan can include several (e.g. 3); always ≥ 1 since an
  // org needs at least one number to function.
  const requiredNumbers = Math.max(1, cpIncludedNum);
  const toggleNumber = (phone: string) =>
    setSelectedNumbers((prev) => {
      if (prev.includes(phone)) return prev.filter((p) => p !== phone); // deselect
      if (prev.length < requiredNumbers) return [...prev, phone]; // add (under cap)
      if (requiredNumbers === 1) return [phone]; // single-select → replace
      return prev; // at the multi-select cap — deselect one to change
    });
  const customPlanValid = (): boolean =>
    cpPrice.trim() !== '' && !Number.isNaN(cpPriceNum) && cpPriceNum >= 0 &&
    (parseInt(cpSeats, 10) || 0) >= 1 &&
    cpMaxNum >= cpIncludedNum; // max numbers can't be below the free count

  const handleSeatsChange = (val: string) => {
    const clean = val.replace(/[^\d]/g, '');
    setCpSeats(clean);
    const s = Math.max(1, parseInt(clean, 10) || 1);
    const u = parseFloat(cpUnitPrice) || standardSeatPrice;
    setCpPrice((s * u).toFixed(0));
    setCpIncludedNumbers(String(s));
    setCpMaxNumbers(String(Math.max(5, s * 2)));
    setSmsAllowance(String(s * 100));
  };

  const handleUnitPriceChange = (val: string) => {
    setPriceManuallyEdited(true);
    const clean = val.replace(/[^\d.]/g, '');
    setCpUnitPrice(clean);
    const s = Math.max(1, parseInt(cpSeats, 10) || 1);
    const u = parseFloat(clean) || 0;
    setCpPrice((s * u).toFixed(0));
  };

  const handleTotalPriceChange = (val: string) => {
    setPriceManuallyEdited(true);
    const clean = val.replace(/[^\d.]/g, '');
    setCpPrice(clean);
    const s = Math.max(1, parseInt(cpSeats, 10) || 1);
    const t = parseFloat(clean) || 0;
    setCpUnitPrice(s > 0 ? (t / s).toFixed(2) : String(standardSeatPrice));
  };

  const buildCustomPlan = (): CustomPlanInput => {
    const included = cpIncludedNum;
    const s = Math.max(1, parseInt(cpSeats, 10) || 1);
    const uCents = Math.round((parseFloat(cpUnitPrice) || standardSeatPrice) * 100);
    return {
      priceCents: Math.max(0, Math.round((parseFloat(cpPrice) || 0) * 100)),
      label: cpLabel.trim() || 'Custom',
      seats: s,
      standardSeatPriceCents: Math.round(standardSeatPrice * 100),
      agreedSeatPriceCents: uCents,
      devicesPerUser: Math.max(0, parseInt(cpDevices, 10) || 0),
      includedNumbers: included,
      maxNumbers: Math.max(1, included, parseInt(cpMaxNumbers, 10) || 1),
    };
  };

  const canContinue = (): boolean => {
    switch (step) {
      case 0: return businessName.trim().length > 1;
      case 1: return contactName.trim().length > 0 && /.+@.+\..+/.test(contactEmail) && password.length >= 6;
      case 2: return customPlanValid();
      case 3: return true; // Services — any selection is valid
      case 4: return accountType !== 'sms-sub' || !!assignManagedAccountId; // Telephony
      case 5: return selectedNumbers.length === requiredNumbers; // Number(s)
      default: return true;
    }
  };

  /** All-at-once validity (Form mode) — the union of every step's required fields. */
  const ownerOk = contactName.trim().length > 0 && /.+@.+\..+/.test(contactEmail) && password.length >= 6;
  const canSubmitAll = (): boolean =>
    businessName.trim().length > 1 &&
    ownerOk &&
    customPlanValid() &&
    (accountType !== 'sms-sub' || !!assignManagedAccountId) &&
    selectedNumbers.length === requiredNumbers;

  /** What's still missing (Form mode hint) so a disabled Create button isn't a mystery. */
  const missingForForm = (): string[] => {
    const m: string[] = [];
    if (businessName.trim().length <= 1) m.push('business name');
    if (!ownerOk) m.push('owner name, email & password (min 6)');
    if (!customPlanValid()) m.push('a plan price and seats');
    if (accountType === 'sms-sub' && !assignManagedAccountId) m.push('a sub-account');
    if (selectedNumbers.length !== requiredNumbers)
      m.push(`${requiredNumbers} phone number${requiredNumbers === 1 ? '' : 's'}`);
    return m;
  };

  const submit = async () => {
    setSubmitting(true);
    setError('');
    try {
      const input: CreateAccountInput = {
        businessName: businessName.trim(),
        businessNature: businessNature.trim() || undefined,
        contactName: contactName.trim(),
        contactEmail: contactEmail.trim(),
        password,
        planSlug,
        customPlan: buildCustomPlan(),
        numbers: selectedNumbers.map((phoneNumber) => ({ phoneNumber })),
        trialMode,
        bypassKyc: !trialMode,
        ...(trialMode ? { trialCallMinutes: Math.max(1, Number(trialMinutes) || 100), trialSms: Math.max(1, Number(trialSms) || 100) } : {}),
        ...(accountType === 'sms-sub'
          ? { assignManagedAccountId, assignExistingNumber }
          : accountType === 'mother'
            ? // Mother path: carry assignExistingNumber so an owned free number is
              // ASSIGNED (not re-bought). false for a fresh search+buy.
              { accountType, assignExistingNumber }
            : // Dedicated sub (auto-provision) always buys — never assign-existing.
              { accountType }),
        // SMS allowance is agent-set (its own field), written to sms_soft_cap — the
        // same SSOT agents manage later; a purchased package stacks on top.
        initialSmsAllowance: Math.max(0, parseInt(smsAllowance, 10) || 0),
      };
      const res = await adminAccountApi.createAccount(input);

      // Apply the chosen SERVICE entitlements to the brand-new org. Only push
      // modules whose desired state differs from the module default (minimises
      // calls). Best-effort + reported — a failure here doesn't undo the created
      // account, so surface it rather than silently dropping it.
      const changes = modules.filter((m) => !!services[m.code] !== m.defaultEnabled);
      if (changes.length > 0) {
        const failed: string[] = [];
        for (const m of changes) {
          try {
            await entitlementApi.setModule(res.organizationId, m.code, !!services[m.code]);
          } catch {
            failed.push(m.label);
          }
        }
        if (failed.length > 0) {
          setEntitlementNote(`Account created, but these services couldn't be set: ${failed.join(', ')}. Set them on the org's Services tab.`);
        }
      }

      setResult(res);
      queryClient.invalidateQueries({ queryKey: ['admin2', 'billing'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'organizations'] });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create the account.');
    }
    setSubmitting(false);
  };

  if (!isSuperAdmin) {
    return <section><h1 className="text-3xl font-black tracking-tight">Onboarding</h1><div className="mt-6 rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900">Account creation is available to platform super-admins.</div></section>;
  }

  if (result) {
    // Provisioning stages, DERIVED FROM THE REAL RESULT (createAccount runs
    // provisionOrder server-side synchronously — there's no step stream, so this
    // reflects what the result actually confirms rather than a faked timed list).
    const fully = result.provisioningComplete;
    const stages: Array<{ label: string; done: boolean }> = [
      { label: 'Organization created', done: true },
      { label: 'Owner account created', done: !!result.ownerUserId },
      { label: 'Phone number provisioned', done: !!result.phoneNumber },
      { label: 'Extension + voice routing configured', done: !!result.extension },
      { label: 'Inbound routing + messaging wired', done: fully },
    ];
    return (
      <section className="mx-auto max-w-2xl">
        <div className={`rounded-2xl border p-8 ${fully ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30' : 'border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30'}`}>
          <h1 className={`text-2xl font-black ${fully ? 'text-emerald-700 dark:text-emerald-300' : 'text-amber-800 dark:text-amber-300'}`}>
            {fully ? 'Organization created' : 'Organization created — needs finishing'}
          </h1>
          <p className={`mt-2 text-sm ${fully ? 'text-emerald-700/80 dark:text-emerald-300/80' : 'text-amber-800/80 dark:text-amber-300/80'}`}>
            {fully ? 'Fully provisioned and live.' : 'Created, but provisioning didn’t fully complete — finish it from Signups / the org page.'}
          </p>

          <div className="mt-6 space-y-2">
            {stages.map((s) => (
              <div key={s.label} className="flex items-center gap-3 rounded-xl bg-white/70 px-3 py-2.5 text-sm dark:bg-slate-900/60">
                <span className={`grid h-5 w-5 place-items-center rounded-full text-xs ${s.done ? 'bg-emerald-500 text-white' : 'bg-slate-300 text-slate-600 dark:bg-slate-700'}`}>{s.done ? '✓' : '•'}</span>
                <span className={s.done ? '' : 'text-slate-500'}>{s.label}</span>
              </div>
            ))}
          </div>

          <div className="mt-5 grid gap-3 text-left sm:grid-cols-2">
            {[['Organization #', result.organizationId], ['Owner user #', result.ownerUserId], ['Number', result.phoneNumber], ['Extension', result.extension ?? '—']].map(([k, v]) => (
              <div key={String(k)} className="rounded-xl bg-white p-3 dark:bg-slate-900"><div className="text-xs font-bold uppercase text-slate-400">{k}</div><div className="mt-1 font-mono font-bold">{String(v)}</div></div>
            ))}
          </div>

          {entitlementNote && (
            <p className="mt-4 rounded-xl bg-amber-100 px-3 py-2 text-sm font-semibold text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">{entitlementNote}</p>
          )}

          {/* Live provisioning verification — the REAL diagnostic on the new number */}
          {result.phoneNumber && (
            <div className="mt-6 rounded-xl border border-slate-200 bg-white p-4 text-left dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-wide text-slate-400">Provisioning verification (live)</span>
                {verify === 'loading' && <span className="text-xs font-semibold text-slate-400">Checking…</span>}
                {verify && verify !== 'loading' && verify !== 'error' && (
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-bold ${verify.verdict === 'healthy' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : verify.verdict === 'blocked' ? 'bg-red-500/10 text-red-600 dark:text-red-400' : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'}`}>
                    {verify.verdict === 'healthy' ? 'Verified healthy' : verify.verdict === 'blocked' ? 'Blocked' : 'Needs attention'}
                  </span>
                )}
              </div>
              {verify === 'loading' && <div className="mt-3 h-16 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />}
              {verify === 'error' && <p className="mt-2 text-xs text-slate-500">Couldn’t auto-verify — run it from Diagnostics.</p>}
              {verify && verify !== 'loading' && verify !== 'error' && (
                <>
                  <div className="mt-3 space-y-1.5">
                    {verify.checks
                      // Show the real provisioning dimensions (identity, Telnyx,
                      // FusionPBX routing, live gateway). Hide only the noise for a
                      // brand-new account: the owner isn't logged in yet (SIP
                      // registration) and there are no calls in the CDR.
                      .filter((c) => c.group !== 'Calls' && c.key !== 'sip_registration')
                      .map((c) => (
                        <div key={c.key} className="flex items-start gap-2 text-xs">
                          <span className="mt-0.5 shrink-0"><StatusDot health={diagToHealth(c.status)} label="" /></span>
                          <span><b>{c.label}</b> <span className="text-slate-500 dark:text-slate-400">— {c.detail}</span></span>
                        </div>
                      ))}
                  </div>
                  <button type="button" onClick={() => router.push(`/admin2/diagnostics?number=${verify.normalized}`)} className="mt-3 text-xs font-bold text-[#FF6542] hover:underline">
                    Open full diagnostic →
                  </button>
                </>
              )}
            </div>
          )}

          <div className="mt-6 flex justify-center gap-2">
            <button type="button" onClick={() => router.push(`/admin2/organizations/${result.organizationId}`)} className="rounded-xl bg-[#FF6542] px-4 py-2.5 text-sm font-bold text-white">Open organization</button>
            <button type="button" onClick={() => router.push('/admin2/organizations')} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold dark:border-slate-700">Back to list</button>
          </div>
        </div>
      </section>
    );
  }

  const inputCls = 'mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#FF6542] dark:border-slate-800 dark:bg-slate-950';

  // ── Shared section blocks — rendered one-at-a-time by the WIZARD and all-at-once
  //    by the FORM. Single source of truth for the fields so the two modes can
  //    never drift apart.
  const sectionCompany = (
    <div className="grid gap-4 md:grid-cols-2">
      <label className="text-sm font-bold">Business name<input value={businessName} onChange={(e) => setBusinessName(e.target.value)} className={inputCls} placeholder="Acme Support" /></label>
      <label className="text-sm font-bold">Industry (optional)<input value={businessNature} onChange={(e) => setBusinessNature(e.target.value)} className={inputCls} placeholder="Healthcare, BPO…" /></label>
    </div>
  );

  const sectionOwner = (
    <div className="grid gap-4 md:grid-cols-2">
      <label className="text-sm font-bold">Owner full name<input value={contactName} onChange={(e) => setContactName(e.target.value)} className={inputCls} /></label>
      <label className="text-sm font-bold">Owner email<input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} className={inputCls} /></label>
      <label className="text-sm font-bold md:col-span-2">Temporary password<input type="text" value={password} onChange={(e) => setPassword(e.target.value)} className={inputCls} placeholder="min 6 chars" />
        <span className="mt-1 block text-xs font-normal text-slate-500">The owner signs in with this; they can change it later.</span>
      </label>
    </div>
  );

  const sectionPlan = (
    <div className="space-y-5">
      <p className="text-xs text-slate-500 dark:text-slate-400">
        Build this customer’s plan. The monthly price is all-inclusive (the SMS allowance is part of it);
        the call fair-use cap (4,000 min/mo) applies automatically. Everything here is editable later on the org page.
      </p>

      <PlanTemplatePicker
        onApply={(t) => {
          setCpLabel(t.name);
          setCpSeats(String(t.seats));
          const unit = t.seats > 0 ? (t.monthlyCents / 100 / t.seats).toFixed(2) : (t.monthlyCents / 100).toString();
          setCpUnitPrice(unit);
          setCpPrice((t.monthlyCents / 100).toString());
          setCpDevices(String(t.devicesPerUser));
          setCpIncludedNumbers(String(t.includedNumbers));
          setCpMaxNumbers(String(t.maxNumbers));
          setSmsAllowance(String(t.smsAllowance || t.seats * 100));
        }}
      />

      <div className="grid gap-4 md:grid-cols-2">
        <label className="text-sm font-bold">Plan name
          <input value={cpLabel} onChange={(e) => setCpLabel(e.target.value)} className={inputCls} placeholder="Custom" />
        </label>
        <div>
          <label className="text-sm font-bold">Total Monthly Billed (USD)
            <div className="relative mt-2">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-400">$</span>
              <input
                inputMode="decimal"
                value={cpPrice}
                onChange={(e) => handleTotalPriceChange(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-7 pr-3 text-sm outline-none focus:border-[#FF6542] dark:border-slate-800 dark:bg-slate-950 font-bold"
                placeholder="80"
              />
            </div>
            <span className="mt-1 block text-xs font-normal text-slate-500">
              {Math.max(1, parseInt(cpSeats, 10) || 1)} seat(s) × ${parseFloat(cpUnitPrice) || 80}/seat = ${parseFloat(cpPrice) || 0}/mo
            </span>
          </label>
        </div>
      </div>

      {/* Per-License Seat Pricing & Deviation Controls */}
      <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-900/50 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
              License Seats &amp; Rate Configuration
            </h4>
            <p className="text-[11px] text-slate-500">
              1 license includes 1 direct phone number, 100 SMS, and unlimited minutes (4,000 min fair-use cap).
            </p>
          </div>
          {(() => {
            const u = parseFloat(cpUnitPrice) || 0;
            const diff = u - standardSeatPrice;
            if (Math.abs(diff) < 0.01) {
              return (
                <span className="inline-flex items-center rounded-lg bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
                  Standard Rate (${standardSeatPrice.toFixed(2)} / seat)
                </span>
              );
            } else if (diff < 0) {
              const pct = ((Math.abs(diff) / standardSeatPrice) * 100).toFixed(1);
              return (
                <span className="inline-flex items-center rounded-lg bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                  Negotiated Discount: -${Math.abs(diff).toFixed(2)}/seat ({pct}%)
                </span>
              );
            } else {
              const pct = ((diff / standardSeatPrice) * 100).toFixed(1);
              return (
                <span className="inline-flex items-center rounded-lg bg-blue-100 px-2.5 py-1 text-xs font-bold text-blue-800 dark:bg-blue-950/40 dark:text-blue-300">
                  Negotiated Premium: +${diff.toFixed(2)}/seat (+{pct}%)
                </span>
              );
            }
          })()}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="text-sm font-bold">Number of Seats (Licenses)
            <input
              inputMode="numeric"
              value={cpSeats}
              onChange={(e) => handleSeatsChange(e.target.value)}
              className={inputCls}
              placeholder="1"
            />
            <span className="mt-1 block text-xs font-normal text-slate-500">
              Default 1 seat (add extra seats anytime at agreed rate)
            </span>
          </label>
          <label className="text-sm font-bold">Agreed Price per Seat ($/mo)
            <div className="relative mt-2">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-400">$</span>
              <input
                inputMode="decimal"
                value={cpUnitPrice}
                onChange={(e) => handleUnitPriceChange(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-7 pr-3 text-sm outline-none focus:border-[#FF6542] dark:border-slate-800 dark:bg-slate-950"
                placeholder={standardSeatPrice.toString()}
              />
            </div>
            <span className="mt-1 block text-xs font-normal text-slate-500">
              Standard base: ${standardSeatPrice.toFixed(2)}/seat · Any deviation is locked as customer agreed rate
            </span>
          </label>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <label className="text-sm font-bold">Devices / user
          <input inputMode="numeric" value={cpDevices} onChange={(e) => setCpDevices(e.target.value.replace(/[^\d]/g, ''))} className={inputCls} placeholder="3" />
          <span className="mt-1 block text-xs font-normal text-slate-500">concurrent logins · 0 = unlimited</span>
        </label>
        <label className="text-sm font-bold">Included numbers
          <input inputMode="numeric" value={cpIncludedNumbers} onChange={(e) => setCpIncludedNumbers(e.target.value.replace(/[^\d]/g, ''))} className={inputCls} placeholder="1" />
          <span className="mt-1 block text-xs font-normal text-slate-500">1 free number per seat license</span>
        </label>
        <label className="text-sm font-bold">Max numbers cap
          <input inputMode="numeric" value={cpMaxNumbers} onChange={(e) => setCpMaxNumbers(e.target.value.replace(/[^\d]/g, ''))} className={inputCls} placeholder="5" />
          <span className={`mt-1 block text-xs font-normal ${cpMaxNum < cpIncludedNum ? 'text-red-500' : 'text-slate-500'}`}>
            {cpMaxNum < cpIncludedNum ? 'must be ≥ included' : 'hard cap on total numbers'}
          </span>
        </label>
      </div>

      <div className="mt-6 border-t border-slate-200/80 pt-5 dark:border-slate-800">
        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <label className="block text-sm font-semibold text-slate-900 dark:text-slate-100">
              Included Monthly SMS
              <input
                inputMode="numeric"
                value={smsAllowance}
                onChange={(e) => setSmsAllowance(e.target.value.replace(/[^\d]/g, ''))}
                className={inputCls}
                placeholder={String(Math.max(1, parseInt(cpSeats, 10) || 1) * 100)}
              />
            </label>
            <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
              {Math.max(1, parseInt(cpSeats, 10) || 1) * 100} segments included ({Math.max(1, parseInt(cpSeats, 10) || 1)} seat{parseInt(cpSeats, 10) > 1 ? 's' : ''} × 100). Custom amounts can be entered for negotiated packages.
            </p>
          </div>

          <div>
            <span className="block text-sm font-semibold text-slate-900 dark:text-slate-100">
              Overage Rate
            </span>
            <div className="mt-2 flex h-[42px] items-center rounded-xl border border-slate-200/80 bg-slate-50/50 px-3.5 text-sm font-medium text-slate-700 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-200">
              {smsRateDisplay}
            </div>
            <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
              Applies to usage exceeding the included pool, billed on the organization billing date.
            </p>
          </div>
        </div>
      </div>

    </div>
  );

  const sectionServices = (
    <div>
      <p className="mb-4 text-xs text-slate-500 dark:text-slate-400">
        Which feature modules this organization may use. Applied after the account is created; editable later on the org’s Services tab.
      </p>
      {modules.length === 0 ? (
        <div className="rounded-xl border border-slate-200 p-4 text-sm text-slate-500 dark:border-slate-800">Loading services…</div>
      ) : (
        modules.map((m) => (
          <div key={m.code} className="mb-2.5 flex items-center justify-between gap-4 rounded-xl border border-slate-200 p-3.5 dark:border-slate-800">
            <div>
              <div className="text-sm font-bold">{m.label}</div>
              <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Module <span className="font-mono">{m.code}</span></div>
            </div>
            <button
              type="button"
              onClick={() => setServices((s) => ({ ...s, [m.code]: !s[m.code] }))}
              className={`relative h-6 w-11 shrink-0 rounded-full transition ${services[m.code] ? 'bg-[#FF6542]' : 'bg-slate-300 dark:bg-slate-600'}`}
              aria-pressed={!!services[m.code]}
            >
              <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${services[m.code] ? 'left-[22px]' : 'left-0.5'}`} />
            </button>
          </div>
        ))
      )}
    </div>
  );

  const sectionTelephony = (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3">
        {([
          ['subaccount', 'Dedicated sub', 'Isolated Telnyx sub-account (own billing). Calls-first.'],
          ['mother', 'Shared (mother)', 'On the mother account. Calls + instant SMS.'],
          ['sms-sub', 'Existing sub-account', 'Assign into a registered SMS sub-account.'],
        ] as const).map(([val, title, desc]) => (
          <button key={val} type="button" onClick={() => { setAccountType(val); setAssignExistingNumber(false); setSelectedNumbers([]); if (val === 'sms-sub') loadSubs(); }} className={`rounded-2xl border p-4 text-left ${accountType === val ? 'border-[#FF6542] ring-1 ring-[#FF6542]' : 'border-slate-200 dark:border-slate-800'}`}>
            <div className="font-extrabold">{title}</div>
            <div className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">{desc}</div>
          </button>
        ))}
      </div>
      {accountType === 'sms-sub' && (
        <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
          <label className="text-sm font-bold">Sub-account
            <select value={assignManagedAccountId} onChange={(e) => { setAssignManagedAccountId(e.target.value); setAssignExistingNumber(false); setSelectedNumbers([]); }} className={inputCls}>
              <option value="">Select a registered sub-account…</option>
              {subs.map((s) => <option key={s.managedAccountId} value={s.managedAccountId}>{s.organizationName || s.managedAccountId}{s.hasVoiceKeycard ? '' : ' (no voice keycard)'}{s.smsActive ? ' · SMS' : ''}</option>)}
            </select>
          </label>
          <label className="mt-3 flex items-center gap-2 text-sm font-semibold">
            <input type="checkbox" checked={assignExistingNumber} onChange={(e) => { setAssignExistingNumber(e.target.checked); setSelectedNumbers([]); if (e.target.checked && assignManagedAccountId) loadSubNumbers(assignManagedAccountId); }} />
            Assign a number the sub already owns (no purchase)
          </label>
        </div>
      )}
      {accountType === 'mother' && (
        <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
          <label className="flex items-center gap-2 text-sm font-semibold">
            <input type="checkbox" checked={assignExistingNumber} onChange={(e) => { setAssignExistingNumber(e.target.checked); setSelectedNumbers([]); if (e.target.checked) loadMotherNumbers(); }} />
            Assign a number we already own (no purchase)
          </label>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Pick from the mother account&apos;s free, unassigned numbers instead of buying a new one.</p>
        </div>
      )}
    </div>
  );

  const sectionNumber = (
    <div className="space-y-5">
      {requiredNumbers > 1 && (
        <div className="rounded-xl bg-[#FF6542]/10 px-3 py-2 text-sm font-semibold text-[#FF6542]">
          This plan includes {requiredNumbers} numbers — select {requiredNumbers} ({selectedNumbers.length} of {requiredNumbers} selected).
        </div>
      )}
      {assignExistingNumber && (accountType === 'sms-sub' || accountType === 'mother') ? (
        <div>
          <div className="text-sm font-bold">{accountType === 'mother' ? 'Free numbers on the mother account' : 'Free numbers in this sub-account'}</div>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {(accountType === 'mother' ? motherNumbers : subNumbers).length === 0
              ? <div className="text-sm text-slate-500">No free numbers found.</div>
              : (accountType === 'mother' ? motherNumbers : subNumbers).map((n) => (
                <button key={n.phoneNumber} type="button" onClick={() => toggleNumber(n.phoneNumber)} className={`rounded-xl border px-3 py-2.5 text-left font-mono text-sm ${selectedNumbers.includes(n.phoneNumber) ? 'border-[#FF6542] ring-1 ring-[#FF6542]' : 'border-slate-200 dark:border-slate-800'}`}>{n.phoneNumber}</button>
              ))}
          </div>
        </div>
      ) : (
        <div>
          <div className="flex items-end gap-2">
            <label className="text-sm font-bold">Area code<input value={areaCode} onChange={(e) => setAreaCode(e.target.value)} className={inputCls} placeholder="e.g. 210" /></label>
            <button type="button" onClick={searchNumbers} disabled={searching} className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900">{searching ? 'Searching…' : 'Search'}</button>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {searchResults.map((n) => (
              <button key={n.phoneNumber} type="button" onClick={() => toggleNumber(n.phoneNumber)} className={`rounded-xl border px-3 py-2.5 text-left text-sm ${selectedNumbers.includes(n.phoneNumber) ? 'border-[#FF6542] ring-1 ring-[#FF6542]' : 'border-slate-200 dark:border-slate-800'}`}>
                <span className="font-mono font-bold">{n.phoneNumber}</span>
                <span className="ml-2 text-xs text-slate-500">{n.locality || n.region}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Options */}
      <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
        <label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" checked={trialMode} onChange={(e) => setTrialMode(e.target.checked)} /> Trial mode (capped)</label>
        {trialMode ? (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-bold">Trial call minutes<input value={trialMinutes} onChange={(e) => setTrialMinutes(e.target.value)} className={inputCls} /></label>
            <label className="text-xs font-bold">Trial SMS<input value={trialSms} onChange={(e) => setTrialSms(e.target.value)} className={inputCls} /></label>
          </div>
        ) : (
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            The org’s SMS allowance is set on the Plan step (agent-set; a purchased package stacks on
            top). Numbers beyond the included count bill at $5/mo each.
          </p>
        )}
      </div>
    </div>
  );

  const sectionReview = (
    <div className="space-y-3">
      {([
        ['Company', `${businessName}${businessNature ? ` · ${businessNature}` : ''}`],
        ['Owner', `${contactName} · ${contactEmail}`],
        ['Plan', `${cpLabel.trim() || 'Custom'} · $${((Math.round((parseFloat(cpPrice) || 0) * 100)) / 100).toFixed(2)}/mo`],
        ['Licenses & Rate', `${Math.max(1, parseInt(cpSeats, 10) || 1)} seat(s) @ $${(parseFloat(cpUnitPrice) || standardSeatPrice).toFixed(2)}/seat · ${(() => {
          const u = parseFloat(cpUnitPrice) || 0;
          const diff = u - standardSeatPrice;
          if (Math.abs(diff) < 0.01) return `Standard baseline rate ($${standardSeatPrice.toFixed(2)}/seat)`;
          return diff < 0 ? `-$${Math.abs(diff).toFixed(2)} discount deviation recorded` : `+$${diff.toFixed(2)} premium deviation recorded`;
        })()}`],
        ['Limits', `${Math.max(1, parseInt(cpSeats, 10) || 1)} seats · ${(parseInt(cpDevices, 10) || 0) === 0 ? 'unlimited' : parseInt(cpDevices, 10)} devices/user · ${cpIncludedNum} included number(s) (cap ${cpMaxNum})`],
        ['SMS allowance', trialMode
          ? `${Math.max(1, Number(trialSms) || 100).toLocaleString()} / month (trial cap)`
          : (parseInt(smsAllowance, 10) || 0) === 0 ? 'Unlimited' : `${(parseInt(smsAllowance, 10) || 0).toLocaleString()} / month (agent-set · package stacks on top)`],
        ['Services', modules.filter((m) => services[m.code]).map((m) => m.label).join(', ') || 'None'],
        ['Telephony', accountType === 'sms-sub' ? `Existing sub${assignExistingNumber ? ' · existing number' : ''}` : accountType],
        [requiredNumbers === 1 ? 'Number' : 'Numbers', selectedNumbers.join(', ')],
        // Non-trial orgs are "unlimited" but carry a fair-use monthly call soft
        // cap (backend CALL_SOFT_CAP_DEFAULT_MINUTES, live = 4,000 min/mo,
        // editable per-org). Show it so the Review isn't misleading.
        ['Usage', trialMode ? `Trial · ${trialMinutes} min / ${trialSms} SMS` : 'Unlimited calling · fair-use soft cap 4,000 min/mo'],
      ] as const).map(([k, v]) => (
        <div key={k} className="flex justify-between gap-4 rounded-xl border border-slate-200 px-4 py-3 text-sm dark:border-slate-800"><span className="font-bold">{k}</span><span className="text-right text-slate-500 dark:text-slate-400">{v}</span></div>
      ))}
    </div>
  );

  const WIZARD_VIEWS = [sectionCompany, sectionOwner, sectionPlan, sectionServices, sectionTelephony, sectionNumber, sectionReview];

  // Error banner (shown in both modes on the final action surface).
  const errorBanner = error ? (
    <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700 dark:border-red-950 dark:bg-red-950/30 dark:text-red-300">{error}</div>
  ) : null;

  // ── Mode toggle shared by both layouts.
  const modeToggle = (
    <div className="inline-flex rounded-xl border border-slate-200 bg-slate-100 p-0.5 text-xs font-bold dark:border-slate-800 dark:bg-slate-900">
      {(['wizard', 'form'] as const).map((m) => (
        <button
          key={m}
          type="button"
          onClick={() => chooseMode(m)}
          className={`rounded-lg px-3 py-1.5 transition ${mode === m ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
          aria-pressed={mode === m}
        >
          {m === 'wizard' ? 'Wizard' : 'Single form'}
        </button>
      ))}
    </div>
  );

  if (mode === 'form') {
    const FORM_SECTIONS: Array<{ title: string; hint?: string; body: ReactNode }> = [
      { title: 'Company', body: sectionCompany },
      { title: 'Owner', body: sectionOwner },
      { title: 'Plan', body: sectionPlan },
      { title: 'Services', body: sectionServices },
      { title: 'Telephony', body: sectionTelephony },
      {
        title: 'Number & options',
        // Parity with the wizard's Review, which notes the fair-use ceiling.
        hint: 'Non-trial accounts are unlimited calling with a fair-use soft cap of 4,000 min/mo (editable per-org).',
        body: sectionNumber,
      },
    ];
    const missing = missingForForm();
    return (
      <section className="mx-auto max-w-3xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black tracking-tight">Create Organization</h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">All fields on one page. Fill what you need, then create.</p>
          </div>
          {modeToggle}
        </div>

        <div className="mt-6 space-y-5">
          {FORM_SECTIONS.map((s) => (
            <div key={s.title} className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">{s.title}</h3>
              {s.hint && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{s.hint}</p>}
              <div className="mt-4">{s.body}</div>
            </div>
          ))}
        </div>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {missing.length > 0 ? <>Still needed: <span className="font-semibold text-slate-600 dark:text-slate-300">{missing.join(', ')}</span></> : 'Ready to create.'}
          </div>
          <button type="button" disabled={submitting || !canSubmitAll()} onClick={submit} className="rounded-xl bg-[#FF6542] px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50">{submitting ? 'Creating…' : 'Create Organization'}</button>
        </div>
        {errorBanner && <div className="mt-3">{errorBanner}</div>}
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-3xl">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight">Create Organization</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{STEPS[step]} · Step {step + 1} of {STEPS.length}</p>
        </div>
        {modeToggle}
      </div>

      <div className="mt-5 grid grid-cols-7 gap-2">
        {STEPS.map((s, i) => <div key={s} className={`h-1.5 rounded-full ${i <= step ? 'bg-[#FF6542]' : 'bg-slate-200 dark:bg-slate-800'}`} />)}
      </div>

      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        {step === 3 && <h3 className="mb-1 text-sm font-black">Services</h3>}
        {WIZARD_VIEWS[step]}
        {step === STEPS.length - 1 && errorBanner && <div className="mt-3">{errorBanner}</div>}
      </div>

      <div className="mt-4 flex items-center justify-between">
        <button type="button" disabled={step === 0 || submitting} onClick={() => setStep((s) => Math.max(0, s - 1))} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold disabled:opacity-40 dark:border-slate-700">← Back</button>
        {step < STEPS.length - 1 ? (
          <button type="button" disabled={!canContinue()} onClick={() => setStep((s) => s + 1)} className="rounded-xl bg-[#FF6542] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-40">Continue →</button>
        ) : (
          <button type="button" disabled={submitting || selectedNumbers.length !== requiredNumbers} onClick={submit} className="rounded-xl bg-[#FF6542] px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50">{submitting ? 'Creating…' : 'Create Organization'}</button>
        )}
      </div>
    </section>
  );
}
