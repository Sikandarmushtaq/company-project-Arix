'use client';

/**
 * Page 4 — Telephony Accounts (Telnyx sub-account health), wired to real data.
 *
 * Live: listSmsSubaccounts (registry + Telnyx identity) → each sub's SMS/campaign
 * status, voice keycard, messaging profile, enabled/disabled. Register a sub by
 * pasting its V2 key. View a sub's numbers.
 *
 * HONEST GAP: the DEEP live-health signals I check by hand when a sub breaks —
 * credential-connection active?, registration gateway REGED?, messaging webhook
 * pointing at api.arixcall.com? — and a one-click Repair are NOT exposed by any
 * endpoint yet (Repair/resync is keyed by orgId, not sub). Flagged inline; I can
 * add a GET /admin/telnyx/sms-subaccounts/:id/health endpoint next.
 */

import { Fragment, useEffect, useState } from 'react';
import { useAuthStore } from '@/lib/stores/auth';
import {
  adminAccountApi,
  type AdminSmsSubaccount,
  type SubaccountNumber,
  type SubaccountHealth,
  type HealthDim,
} from '@/lib/api/services/admin-account.api';

function Badge({ ok, warn, label }: { ok?: boolean; warn?: boolean; label: string }) {
  const cls = ok
    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
    : warn
    ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
    : 'bg-red-500/10 text-red-600 dark:text-red-400';
  return <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-bold ${cls}`}><span className={`h-1.5 w-1.5 rounded-full ${ok ? 'bg-emerald-500' : warn ? 'bg-amber-500' : 'bg-red-500'}`} />{label}</span>;
}

function HealthCard({ title, dim }: { title: string; dim: HealthDim }) {
  const tone =
    dim.status === 'ok' ? 'border-emerald-200 dark:border-emerald-900' :
    dim.status === 'bad' ? 'border-red-200 dark:border-red-900' :
    'border-amber-200 dark:border-amber-900';
  const dot = dim.status === 'ok' ? 'bg-emerald-500' : dim.status === 'bad' ? 'bg-red-500' : 'bg-amber-500';
  const word = dim.status === 'ok' ? 'OK' : dim.status === 'bad' ? 'Fail' : dim.status === 'unknown' ? 'Unknown' : 'Warn';
  return (
    <div className={`rounded-xl border bg-white p-3 dark:bg-slate-900 ${tone}`}>
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-black uppercase tracking-wide text-slate-400">{title}</span>
        <span className="inline-flex items-center gap-1.5 text-xs font-bold"><span className={`h-1.5 w-1.5 rounded-full ${dot}`} />{word}</span>
      </div>
      <p className="mt-1.5 text-xs text-slate-600 dark:text-slate-300">{dim.detail}</p>
    </div>
  );
}

export default function TelephonyAccountsPage() {
  const { user } = useAuthStore();
  const isSuperAdmin = user?.role === 'super_admin' || user?.role === 'superadmin';

  const [subs, setSubs] = useState<AdminSmsSubaccount[] | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  // Register panel
  const [showRegister, setShowRegister] = useState(false);
  const [regId, setRegId] = useState('');
  const [regKey, setRegKey] = useState('');
  const [regLabel, setRegLabel] = useState('');
  const [registering, setRegistering] = useState(false);
  const [regError, setRegError] = useState('');

  // Numbers drawer
  const [openSub, setOpenSub] = useState<string | null>(null);
  const [numbers, setNumbers] = useState<SubaccountNumber[] | null>(null);

  // Deep live health (on-demand per sub) + repair
  const [openHealth, setOpenHealth] = useState<string | null>(null);
  const [healthById, setHealthById] = useState<Record<string, SubaccountHealth | 'loading' | 'error'>>({});
  const [repairing, setRepairing] = useState<string | null>(null);
  const [repairMsgById, setRepairMsgById] = useState<Record<string, string>>({});

  const checkHealth = async (id: string) => {
    if (openHealth === id) { setOpenHealth(null); return; }
    setOpenHealth(id);
    setOpenSub(null);
    setHealthById((m) => ({ ...m, [id]: 'loading' }));
    try {
      const h = await adminAccountApi.getSubaccountHealth(id);
      setHealthById((m) => ({ ...m, [id]: h }));
    } catch {
      setHealthById((m) => ({ ...m, [id]: 'error' }));
    }
  };

  const repair = async (id: string) => {
    setRepairing(id);
    try {
      const r = await adminAccountApi.repairSubaccount(id);
      setHealthById((m) => ({ ...m, [id]: r.health }));
      const gw = r.gatewayEnsured === null ? 'no SIP credential' : r.gatewayEnsured ? 'gateway ensured' : 'gateway ensure failed';
      const failed = r.orgs.filter((o) => !o.ok).length;
      setRepairMsgById((m) => ({
        ...m,
        [id]: `${gw} · ${r.orgsResynced} org(s) re-synced${failed ? ` · ${failed} failed` : ''}.`,
      }));
    } catch {
      setHealthById((m) => ({ ...m, [id]: 'error' }));
      setRepairMsgById((m) => ({ ...m, [id]: 'Repair failed — try again.' }));
    }
    setRepairing(null);
  };

  // Enable/disable (Telnyx kill-switch) + offer/withhold for signup. One in-flight
  // key at a time so a row's two toggles can't race each other.
  const [busyToggle, setBusyToggle] = useState<string | null>(null);
  const [toggleError, setToggleError] = useState('');

  const applyUpdatedView = (id: string, view: AdminSmsSubaccount | null) => {
    // The endpoint returns the refreshed view; patch it in place. On the rare null
    // (sub momentarily out of the live list) fall back to a full reload.
    if (!view) { void load(); return; }
    setSubs((prev) => (prev ? prev.map((s) => (s.managedAccountId === id ? view : s)) : prev));
  };

  const toggleTelnyx = async (s: AdminSmsSubaccount) => {
    const enable = (s.status || '').toLowerCase() === 'disabled'; // disabled now → enabling
    if (
      !enable &&
      !window.confirm(
        `Disable “${s.organizationName || s.managedAccountId}” at Telnyx?\n\nThis is the kill-switch — it blocks calls + SMS for EVERY organization hosted on this sub-account until you re-enable it. Other sub-accounts and the mother account are unaffected.`
      )
    ) {
      return;
    }
    setBusyToggle(`${s.managedAccountId}:telnyx`);
    setToggleError('');
    try {
      const v = await adminAccountApi.setSubaccountTelnyxStatus(s.managedAccountId, enable);
      applyUpdatedView(s.managedAccountId, v);
    } catch (e) {
      setToggleError(e instanceof Error ? e.message : 'Could not change the Telnyx account status.');
    }
    setBusyToggle(null);
  };

  const toggleSignup = async (s: AdminSmsSubaccount) => {
    setBusyToggle(`${s.managedAccountId}:signup`);
    setToggleError('');
    try {
      const v = await adminAccountApi.setSubaccountSignupVisibility(
        s.managedAccountId,
        !s.signupEnabled
      );
      applyUpdatedView(s.managedAccountId, v);
    } catch (e) {
      setToggleError(e instanceof Error ? e.message : 'Could not change signup availability.');
    }
    setBusyToggle(null);
  };

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      setSubs(await adminAccountApi.listSmsSubaccounts());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load telephony accounts.');
      setSubs([]);
    }
    setLoading(false);
  };

  useEffect(() => { if (isSuperAdmin) void load(); }, [isSuperAdmin]);

  const register = async () => {
    setRegistering(true);
    setRegError('');
    try {
      await adminAccountApi.registerSmsSubaccount({ managedAccountId: regId.trim(), apiKey: regKey.trim(), label: regLabel.trim() || undefined });
      setShowRegister(false);
      setRegId(''); setRegKey(''); setRegLabel('');
      await load();
    } catch (e) {
      setRegError(e instanceof Error ? e.message : 'Registration failed.');
    }
    setRegistering(false);
  };

  const viewNumbers = async (id: string) => {
    if (openSub === id) { setOpenSub(null); return; }
    setOpenSub(id);
    setOpenHealth(null);
    setNumbers(null);
    try { setNumbers(await adminAccountApi.listSmsSubaccountNumbers(id)); } catch { setNumbers([]); }
  };

  if (!isSuperAdmin) {
    return <section><h1 className="text-3xl font-black tracking-tight">Telephony Accounts</h1><div className="mt-6 rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900">Telephony accounts are managed by platform super-admins.</div></section>;
  }

  const registered = (subs ?? []).filter((s) => s.registered);

  return (
    <section>
      <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-start">
        <div>
          <h1 className="text-3xl font-black tracking-tight">Telephony Accounts</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Telnyx sub-accounts: SMS registration, voice keycard & messaging profile.</p>
        </div>
        <button type="button" onClick={() => setShowRegister((v) => !v)} className="rounded-xl bg-[#FF6542] px-4 py-2.5 text-sm font-bold text-white">{showRegister ? 'Cancel' : '+ Register sub-account'}</button>
      </div>

      {/* Deep-health note */}
      <div className="mb-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-300">
        The table shows registry signals instantly. Click <span className="font-bold">Health</span> on a sub to run the LIVE check — voice keycard, inbound gateway <span className="font-mono">REGED</span> on FreeSWITCH, and messaging webhook + 10DLC — then <span className="font-bold">Repair</span> to re-sync its orgs if anything’s off.
      </div>

      {showRegister && (
        <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="font-extrabold">Register a sub-account</h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Paste the sub’s V2 API key. We verify it, detect 10DLC/SMS, and ensure a voice keycard.</p>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            <label className="text-xs font-bold">Managed account ID<input value={regId} onChange={(e) => setRegId(e.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 font-mono text-sm dark:border-slate-800 dark:bg-slate-950" /></label>
            <label className="text-xs font-bold">Label (optional)<input value={regLabel} onChange={(e) => setRegLabel(e.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-950" /></label>
            <label className="text-xs font-bold">V2 API key<input value={regKey} onChange={(e) => setRegKey(e.target.value)} type="password" className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 font-mono text-sm dark:border-slate-800 dark:bg-slate-950" /></label>
          </div>
          {regError && <div className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 dark:bg-red-950/30 dark:text-red-300">{regError}</div>}
          <button type="button" disabled={registering || !regId.trim() || !regKey.trim()} onClick={register} className="mt-4 rounded-xl bg-[#FF6542] px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{registering ? 'Verifying…' : 'Register'}</button>
        </div>
      )}

      {toggleError && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-xs font-semibold text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">{toggleError}</div>
      )}

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm font-semibold text-red-800 dark:border-red-950 dark:bg-red-950/30 dark:text-red-200">{error}</div>
      ) : loading ? (
        <div className="space-y-3">{[0, 1, 2].map((i) => <div key={i} className="h-16 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800" />)}</div>
      ) : registered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center dark:border-slate-700 dark:bg-slate-900"><h2 className="text-xl font-extrabold">No registered sub-accounts</h2><p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Register one with its V2 API key to make it assignable.</p></div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-950/70 dark:text-slate-400">
                <tr><th className="px-4 py-3">Sub-account</th><th className="px-4 py-3">Account</th><th className="px-4 py-3">Signup</th><th className="px-4 py-3">SMS / 10DLC</th><th className="px-4 py-3">Voice keycard</th><th className="px-4 py-3">Messaging</th><th className="px-4 py-3">Verified</th><th className="px-4 py-3"></th></tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {registered.map((s) => {
                  const enabled = (s.status || '').toLowerCase() !== 'disabled';
                  const campaignActive = (s.campaignStatus || '').toUpperCase() === 'ACTIVE';
                  return (
                    <Fragment key={s.managedAccountId}>
                      <tr>
                        <td className="px-4 py-4"><div className="font-extrabold">{s.organizationName || '—'}</div><div className="mt-1 font-mono text-[11px] text-slate-500 dark:text-slate-400">{s.managedAccountId}</div></td>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-2">
                            <Badge ok={enabled} label={enabled ? 'Enabled' : 'Disabled'} />
                            <button
                              type="button"
                              disabled={busyToggle === `${s.managedAccountId}:telnyx`}
                              onClick={() => toggleTelnyx(s)}
                              className={`rounded-lg border px-2.5 py-1 text-[11px] font-bold disabled:opacity-50 ${enabled ? 'border-red-200 text-red-600 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950/40' : 'border-emerald-200 text-emerald-600 hover:bg-emerald-50 dark:border-emerald-900 dark:hover:bg-emerald-950/40'}`}
                            >
                              {busyToggle === `${s.managedAccountId}:telnyx` ? '…' : enabled ? 'Disable' : 'Enable'}
                            </button>
                          </div>
                          <div className="mt-1 text-xs text-slate-500">{s.email || ''}</div>
                        </td>
                        <td className="px-4 py-4">
                          <button
                            type="button"
                            disabled={busyToggle === `${s.managedAccountId}:signup`}
                            onClick={() => toggleSignup(s)}
                            title={s.signupEnabled ? 'Offered to new signups — click to withhold' : 'Withheld from new signups — click to offer'}
                            className="inline-flex items-center gap-2 disabled:opacity-50"
                          >
                            <span className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${s.signupEnabled ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'}`}>
                              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${s.signupEnabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
                            </span>
                            <span className={`text-xs font-bold ${s.signupEnabled ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500'}`}>{s.signupEnabled ? 'Offered' : 'Withheld'}</span>
                          </button>
                        </td>
                        <td className="px-4 py-4">{s.smsActive ? <Badge ok label={`SMS · ${s.campaignStatus || 'ACTIVE'}`} /> : <Badge warn label={campaignActive ? 'Campaign only' : 'Calls only'} />}</td>
                        <td className="px-4 py-4">{s.hasVoiceKeycard ? <Badge ok label="Present" /> : <Badge warn label="Missing" />}</td>
                        <td className="px-4 py-4">{s.messagingProfileId ? <Badge ok label="Profile set" /> : <Badge warn label="None" />}</td>
                        <td className="px-4 py-4 text-slate-500 dark:text-slate-400">{s.lastVerifiedAt ? new Date(s.lastVerifiedAt).toLocaleDateString() : '—'}</td>
                        <td className="px-4 py-4">
                          <div className="flex justify-end gap-2">
                            {(() => { const h = healthById[s.managedAccountId]; return h && h !== 'loading' && h !== 'error'
                              ? <Badge ok={h.overall.status === 'ok'} warn={h.overall.status === 'warn' || h.overall.status === 'unknown'} label={h.overall.status === 'ok' ? 'Healthy' : h.overall.status === 'bad' ? 'Issue' : 'Check'} />
                              : null; })()}
                            <button type="button" onClick={() => checkHealth(s.managedAccountId)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800">{openHealth === s.managedAccountId ? 'Hide' : 'Health'}</button>
                            <button type="button" onClick={() => viewNumbers(s.managedAccountId)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800">{openSub === s.managedAccountId ? 'Hide' : 'Numbers'}</button>
                          </div>
                        </td>
                      </tr>
                      {openHealth === s.managedAccountId && (
                        <tr><td colSpan={8} className="bg-slate-50 px-4 py-4 dark:bg-slate-950/50">
                          {(() => {
                            const h = healthById[s.managedAccountId];
                            if (h === 'loading' || h === undefined) return <div className="text-xs text-slate-500">Running live diagnostic…</div>;
                            if (h === 'error') return <div className="text-xs font-semibold text-red-600">Could not read live health — try again.</div>;
                            return (
                              <div>
                                <div className="grid gap-2 sm:grid-cols-3">
                                  <HealthCard title="Voice (outbound)" dim={h.voice} />
                                  <HealthCard title="Inbound (gateway)" dim={h.inbound} />
                                  <HealthCard title="SMS (webhook + 10DLC)" dim={h.sms} />
                                </div>
                                <div className="mt-3 flex items-center justify-between gap-3">
                                  <div className="flex items-center gap-2 text-xs">
                                    <span className={`h-2.5 w-2.5 rounded-full ${h.overall.status === 'ok' ? 'bg-emerald-500' : h.overall.status === 'bad' ? 'bg-red-500' : 'bg-amber-500'}`} />
                                    <span className="font-bold">{h.overall.detail}</span>
                                  </div>
                                  <button
                                    type="button"
                                    disabled={repairing === s.managedAccountId}
                                    onClick={() => repair(s.managedAccountId)}
                                    className="rounded-lg bg-[#FF6542] px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"
                                  >
                                    {repairing === s.managedAccountId ? 'Repairing…' : 'Repair (re-sync orgs)'}
                                  </button>
                                </div>
                                {repairMsgById[s.managedAccountId] && <p className="mt-2 text-xs font-semibold text-slate-600 dark:text-slate-300">{repairMsgById[s.managedAccountId]}</p>}
                                <p className="mt-2 text-[11px] text-slate-400">Repair ensures the sub’s registration gateway + re-syncs every active org (keycard + SMS wiring), then re-checks. Writes to live telephony.</p>
                              </div>
                            );
                          })()}
                        </td></tr>
                      )}
                      {openSub === s.managedAccountId && (
                        <tr><td colSpan={8} className="bg-slate-50 px-4 py-4 dark:bg-slate-950/50">
                          {numbers === null ? <div className="text-xs text-slate-500">Loading numbers…</div> : numbers.length === 0 ? <div className="text-xs text-slate-500">No numbers in this sub-account.</div> : (
                            <div className="grid gap-2 sm:grid-cols-3">
                              {numbers.map((n) => (
                                <div key={n.phoneNumber} className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-800 dark:bg-slate-900">
                                  <span className="font-mono font-bold">{n.phoneNumber}</span>
                                  <span className={n.free ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500'}>{n.free ? 'free' : n.assignedTo || 'assigned'}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </td></tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
