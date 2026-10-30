'use client';

/**
 * Page 18 — Diagnostics (org-first).
 *
 * Primary flow is ORG-BASED: pick an organization and the backend runs the REAL
 * per-number end-to-end health check across every number the org owns, so an
 * operator never types numbers one at a time. Each number gets a verdict row;
 * expand it for the full per-dimension detail + auto-heal. A single-number
 * lookup is kept as a secondary mode.
 *
 * All checks are real (MySQL + Telnyx + FusionPBX + live Kamailio + CDR). Heals
 * reuse existing idempotent operations, are confirm-gated, and the one
 * destructive action is refused server-side when a Call Menu is published.
 */

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { useOrganizations } from '@/lib/hooks/useAdmin';
import {
  adminAccountApi,
  REPAIR_ACTIONS,
  type NumberDiagnostic,
  type OrgDiagnostic,
  type DiagnosticCheck,
  type DiagnosticCheckStatus,
  type RepairStep,
} from '@/lib/api/services/admin-account.api';
import { PageHead, Card, Btn, StatusDot, Modal, type Health } from '../_components/ui';

const GROUP_ORDER: DiagnosticCheck['group'][] = ['Identity', 'Telnyx', 'FusionPBX', 'Live', 'Calls'];

function toHealth(s: DiagnosticCheckStatus): Health {
  return s === 'ok' ? 'ok' : s === 'warn' ? 'warn' : s === 'bad' ? 'bad' : 'off';
}
function statusWord(s: DiagnosticCheckStatus): string {
  return s === 'ok' ? 'OK' : s === 'warn' ? 'Warn' : s === 'bad' ? 'Fail' : s === 'unknown' ? 'Unknown' : s === 'skip' ? 'N/A' : 'Info';
}

const VERDICT = {
  healthy: { label: 'Healthy', chip: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300', dot: 'bg-emerald-500', banner: 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200' },
  attention: { label: 'Needs attention', chip: 'bg-amber-500/10 text-amber-700 dark:text-amber-300', dot: 'bg-amber-500', banner: 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200' },
  blocked: { label: 'Blocked', chip: 'bg-red-500/10 text-red-700 dark:text-red-300', dot: 'bg-red-500', banner: 'border-red-300 bg-red-50 text-red-800 dark:border-red-950 dark:bg-red-950/30 dark:text-red-200' },
} as const;

/* ---------- reusable per-number detail (checks + heal) ---------- */
function NumberDetail({
  d,
  onFix,
  repairResult,
  busy,
}: {
  d: NumberDiagnostic;
  onFix: (action: string) => void;
  repairResult?: { steps: RepairStep[]; action: string } | null;
  busy: boolean;
}) {
  return (
    <div>
      {/* Verdict + identity */}
      <div className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-4 ${VERDICT[d.verdict].banner}`}>
        <div className="flex items-center gap-3">
          <span className={`h-3 w-3 rounded-full ${VERDICT[d.verdict].dot}`} />
          <div>
            <div className="text-base font-black">{VERDICT[d.verdict].label}</div>
            <div className="text-xs font-semibold opacity-80">
              {d.normalized} · {d.tier === 'sub' ? 'managed sub-account' : d.tier === 'mother' ? 'mother trunk' : 'not provisioned'}
              {d.failing.length > 0 && ` · ${d.failing.length} failing`}
            </div>
          </div>
        </div>
        <div className="text-right text-xs font-semibold opacity-80">
          {d.user?.extension && <div>ext {d.user.extension}{d.user.name ? ` · ${d.user.name}` : ''}</div>}
          <div className="opacity-70">as of {new Date(d.generatedAt).toLocaleTimeString()}</div>
        </div>
      </div>

      {/* Auto-heal bar */}
      {d.fixes.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#FF6542]/30 bg-[#FF6542]/5 p-3">
          <div className="text-xs font-bold text-[#b8462c] dark:text-[#ffb09a]">Auto-heal available — review, then apply (writes to live telephony)</div>
          <div className="flex flex-wrap gap-2">
            {d.fixes.map((f) => (
              <Btn key={f} variant="primary" size="sm" disabled={busy} onClick={() => onFix(f)}>
                {REPAIR_ACTIONS[f]?.label ?? f}
              </Btn>
            ))}
          </div>
        </div>
      )}

      {/* Repair result */}
      {repairResult && (
        <div className="mt-3 rounded-xl border border-slate-200 p-3 dark:border-slate-800">
          <div className="text-sm font-black">Applied: {REPAIR_ACTIONS[repairResult.action]?.label ?? repairResult.action}</div>
          <ul className="mt-1.5 space-y-1">
            {repairResult.steps.map((s, i) => (
              <li key={i} className="flex items-center gap-2 text-sm">
                <StatusDot health={s.ok ? 'ok' : 'bad'} label="" />
                <span className="font-semibold">{s.step}</span>
                <span className="text-slate-500 dark:text-slate-400">— {s.detail}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Checks, grouped */}
      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        {GROUP_ORDER.filter((g) => d.checks.some((c) => c.group === g)).map((group) => (
          <Card key={group} className="p-4">
            <div className="mb-2 text-xs font-black uppercase tracking-wide text-slate-400">{group}</div>
            <div className="space-y-2.5">
              {d.checks.filter((c) => c.group === group).map((c) => (
                <div key={c.key} className="border-b border-slate-100 pb-2.5 last:border-0 last:pb-0 dark:border-slate-800/60">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-bold">{c.label}</div>
                      <div className="mt-0.5 text-xs leading-relaxed text-slate-500 dark:text-slate-400">{c.detail}</div>
                    </div>
                    <span className="shrink-0"><StatusDot health={toHealth(c.status)} label={statusWord(c.status)} /></span>
                  </div>
                  {c.fix && (
                    <button type="button" disabled={busy} onClick={() => onFix(c.fix!)} className="mt-1.5 text-xs font-bold text-[#FF6542] hover:underline disabled:opacity-50">
                      Fix: {REPAIR_ACTIONS[c.fix]?.label ?? c.fix} →
                    </button>
                  )}
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

/* ---------- summary chip ---------- */
function SummaryChip({ tone, n, label }: { tone: keyof typeof VERDICT | 'total'; n: number; label: string }) {
  const cls = tone === 'total' ? 'bg-slate-500/10 text-slate-600 dark:text-slate-300' : VERDICT[tone].chip;
  return <span className={`rounded-full px-3 py-1 text-xs font-bold ${cls}`}>{n} {label}</span>;
}

function DiagnosticsInner() {
  const params = useSearchParams();
  const [mode, setMode] = useState<'org' | 'number'>('org');

  // Org mode state
  const [orgSearch, setOrgSearch] = useState('');
  const [orgSearchDebounced, setOrgSearchDebounced] = useState('');
  const [selectedOrg, setSelectedOrg] = useState<{ id: number; name: string } | null>(null);
  const [orgResult, setOrgResult] = useState<OrgDiagnostic | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  // Number mode state
  const [numInput, setNumInput] = useState('');
  const [numResult, setNumResult] = useState<NumberDiagnostic | null>(null);

  // Heal state (keyed by normalized number)
  const [confirm, setConfirm] = useState<{ action: string; number: string } | null>(null);
  const [repairByNumber, setRepairByNumber] = useState<Record<string, { steps: RepairStep[]; action: string }>>({});

  useEffect(() => {
    const t = setTimeout(() => setOrgSearchDebounced(orgSearch.trim()), 300);
    return () => clearTimeout(t);
  }, [orgSearch]);

  const orgList = useOrganizations(
    { page: 1, limit: 8, search: orgSearchDebounced || undefined },
    { enabled: mode === 'org' && orgSearchDebounced.length >= 2 && !selectedOrg }
  );

  const sweepOrg = useMutation({
    mutationFn: (orgId: number) => adminAccountApi.diagnoseOrg(orgId),
    onSuccess: (r) => { setOrgResult(r); setExpanded(r.numbers.find((n) => n.verdict !== 'healthy')?.normalized ?? null); },
  });
  const diagnoseNum = useMutation({
    mutationFn: (num: string) => adminAccountApi.diagnoseNumber(num),
    onSuccess: (d) => setNumResult(d),
  });
  const repair = useMutation({
    mutationFn: ({ num, action }: { num: string; action: string }) => adminAccountApi.repairNumber(num, action),
    onSuccess: (r) => {
      setRepairByNumber((m) => ({ ...m, [r.diagnostic.normalized]: { steps: r.steps, action: r.action } }));
      // Splice the fresh result back into whichever view it belongs to.
      setNumResult((cur) => (cur && cur.normalized === r.diagnostic.normalized ? r.diagnostic : cur));
      setOrgResult((cur) => cur ? { ...cur, numbers: cur.numbers.map((n) => n.normalized === r.diagnostic.normalized ? r.diagnostic : n) } : cur);
      setConfirm(null);
    },
  });

  const runOrg = (o: { id: number; name: string }) => {
    setSelectedOrg(o);
    setOrgSearch(o.name);
    setOrgResult(null);
    setRepairByNumber({});
    sweepOrg.mutate(o.id);
  };
  const clearOrg = () => { setSelectedOrg(null); setOrgResult(null); setOrgSearch(''); };
  const runNum = () => {
    const n = numInput.trim();
    if (n.replace(/\D/g, '').length >= 10) diagnoseNum.mutate(n);
  };

  // Deep links: ?org=ID (sweep) or ?number=X (single).
  useEffect(() => {
    const o = params.get('org');
    const n = params.get('number');
    if (o && Number(o) > 0) { setMode('org'); runOrg({ id: Number(o), name: `Org ${o}` }); }
    else if (n) { setMode('number'); setNumInput(n); diagnoseNum.mutate(n); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const orgs = orgList.data?.organizations ?? [];
  const repairErr = repair.isError ? ((repair.error as Error)?.message || 'Repair failed.') : null;

  return (
    <section>
      <PageHead
        title="Diagnostics"
        subtitle="Pick an organization to health-check every number it owns — identity, Telnyx, FusionPBX routing, live registration — and auto-heal what's broken."
        actions={
          <div className="flex rounded-xl border border-slate-200 p-1 dark:border-slate-800">
            {(['org', 'number'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold ${mode === m ? 'bg-[#FF6542] text-white' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}
              >
                {m === 'org' ? 'By organization' : 'By number'}
              </button>
            ))}
          </div>
        }
      />

      {/* ---- ORG MODE ---- */}
      {mode === 'org' && (
        <>
          <Card className="p-5">
            <div className="relative">
              <div className="flex flex-wrap items-center gap-2">
                <input
                  value={orgSearch}
                  onChange={(e) => { setOrgSearch(e.target.value); if (selectedOrg) setSelectedOrg(null); }}
                  placeholder="Search organization by name…"
                  className="min-w-[280px] flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none placeholder:text-slate-400 focus:border-[#FF6542] dark:border-slate-800 dark:bg-slate-950"
                />
                {selectedOrg && (
                  <>
                    <Btn variant="primary" disabled={sweepOrg.isPending} onClick={() => runOrg(selectedOrg)}>
                      {sweepOrg.isPending ? 'Sweeping…' : 'Re-run sweep'}
                    </Btn>
                    <Btn disabled={sweepOrg.isPending} onClick={clearOrg}>Clear</Btn>
                  </>
                )}
              </div>
              {/* org dropdown */}
              {!selectedOrg && orgSearchDebounced.length >= 2 && (
                <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg dark:border-slate-800 dark:bg-slate-900">
                  {orgList.isLoading ? (
                    <div className="px-3 py-3 text-sm text-slate-400">Searching…</div>
                  ) : orgs.length === 0 ? (
                    <div className="px-3 py-3 text-sm text-slate-400">No organizations match.</div>
                  ) : (
                    orgs.map((o) => (
                      <button key={o.id} type="button" onClick={() => runOrg({ id: o.id, name: o.name })} className="flex w-full items-center justify-between px-3 py-2.5 text-left text-sm hover:bg-[#FF6542]/5">
                        <span className="font-semibold">{o.name}</span>
                        <span className="font-mono text-xs text-slate-400">{o.slug}</span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          </Card>

          {sweepOrg.isPending && (
            <Card className="mt-4 p-5"><div className="text-sm text-slate-400">Running the per-number diagnostic across the organization…</div><div className="mt-3 h-24 animate-pulse rounded bg-slate-200 dark:bg-slate-800" /></Card>
          )}
          {sweepOrg.isError && <Card className="mt-4 p-5"><p className="text-sm font-semibold text-red-600">{(sweepOrg.error as Error)?.message || 'Sweep failed.'}</p></Card>}

          {orgResult && (
            <>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <h2 className="mr-2 text-lg font-black">{orgResult.orgName ?? selectedOrg?.name} <span className="text-slate-400">— {orgResult.summary.total} number{orgResult.summary.total !== 1 ? 's' : ''}</span></h2>
                <SummaryChip tone="blocked" n={orgResult.summary.blocked} label="blocked" />
                <SummaryChip tone="attention" n={orgResult.summary.attention} label="attention" />
                <SummaryChip tone="healthy" n={orgResult.summary.healthy} label="healthy" />
                <span className="ml-auto text-xs text-slate-400">as of {new Date(orgResult.generatedAt).toLocaleTimeString()}</span>
              </div>

              {orgResult.numbers.length === 0 ? (
                <Card className="mt-3 p-8 text-center text-sm text-slate-400">This organization owns no numbers.</Card>
              ) : (
                <div className="mt-3 space-y-2">
                  {orgResult.numbers.map((d) => {
                    const open = expanded === d.normalized;
                    return (
                      <Card key={d.normalized} className="overflow-hidden">
                        <button type="button" onClick={() => setExpanded(open ? null : d.normalized)} className="flex w-full items-center gap-4 p-4 text-left hover:bg-slate-50 dark:hover:bg-slate-800/40">
                          <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${VERDICT[d.verdict].dot}`} />
                          <span className="w-36 shrink-0 font-mono text-sm font-bold">{d.normalized}</span>
                          <span className="min-w-0 flex-1 truncate text-sm text-slate-500 dark:text-slate-400">
                            {d.user?.extension ? `ext ${d.user.extension}${d.user.name ? ` · ${d.user.name}` : ''}` : 'unassigned'} · {d.tier}
                          </span>
                          <span className={`hidden shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold sm:inline ${VERDICT[d.verdict].chip}`}>
                            {VERDICT[d.verdict].label}{d.failing.length > 0 ? ` · ${d.failing.length}` : ''}
                          </span>
                          <span className="shrink-0 text-slate-300">{open ? '▾' : '▸'}</span>
                        </button>
                        {open && (
                          <div className="border-t border-slate-200 p-4 dark:border-slate-800">
                            <NumberDetail d={d} busy={repair.isPending} repairResult={repairByNumber[d.normalized]} onFix={(action) => setConfirm({ action, number: d.normalized })} />
                          </div>
                        )}
                      </Card>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* ---- NUMBER MODE ---- */}
      {mode === 'number' && (
        <>
          <Card className="p-5">
            <div className="flex flex-wrap items-center gap-2">
              <input
                value={numInput}
                onChange={(e) => setNumInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && runNum()}
                placeholder="Enter a phone number, e.g. 17542971234"
                className="min-w-[280px] flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none placeholder:text-slate-400 focus:border-[#FF6542] dark:border-slate-800 dark:bg-slate-950"
              />
              <Btn variant="primary" disabled={diagnoseNum.isPending || numInput.trim().replace(/\D/g, '').length < 10} onClick={runNum}>
                {diagnoseNum.isPending ? 'Running…' : 'Run diagnostic'}
              </Btn>
            </div>
            {diagnoseNum.isError && <p className="mt-3 text-sm font-semibold text-red-600">{(diagnoseNum.error as Error)?.message || 'Could not run the diagnostic.'}</p>}
          </Card>
          {diagnoseNum.isPending && <Card className="mt-4 p-5"><div className="h-40 animate-pulse rounded bg-slate-200 dark:bg-slate-800" /></Card>}
          {numResult && (
            <div className="mt-4">
              <NumberDetail d={numResult} busy={repair.isPending} repairResult={repairByNumber[numResult.normalized]} onFix={(action) => setConfirm({ action, number: numResult.normalized })} />
            </div>
          )}
        </>
      )}

      {/* Confirm heal */}
      {confirm && (
        <Modal onClose={() => !repair.isPending && setConfirm(null)} title="Apply auto-heal?">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold">{REPAIR_ACTIONS[confirm.action]?.label ?? confirm.action}</span>
              {REPAIR_ACTIONS[confirm.action]?.risk === 'destructive' ? (
                <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-xs font-bold text-red-600 dark:text-red-400">Destructive</span>
              ) : (
                <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">Safe · idempotent</span>
              )}
            </div>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{REPAIR_ACTIONS[confirm.action]?.description ?? 'Run this repair action.'}</p>
            <p className={`mt-3 rounded-lg p-3 text-xs font-semibold ${REPAIR_ACTIONS[confirm.action]?.risk === 'destructive' ? 'bg-red-50 text-red-800 dark:bg-red-950/30 dark:text-red-200' : 'bg-amber-50 text-amber-800 dark:bg-amber-950/30 dark:text-amber-200'}`}>
              This writes to live telephony for {confirm.number}.
              {REPAIR_ACTIONS[confirm.action]?.risk === 'destructive'
                ? ' It rebuilds the inbound dialplan (delete + recreate). The server refuses it if a Call Menu is published on this number.'
                : ' The operation is idempotent and safe to re-run.'}
            </p>
            {repairErr && <p className="mt-2 text-xs font-semibold text-red-600">{repairErr}</p>}
            <div className="mt-4 flex justify-end gap-2">
              <Btn disabled={repair.isPending} onClick={() => setConfirm(null)}>Cancel</Btn>
              <Btn variant="primary" disabled={repair.isPending} onClick={() => repair.mutate({ num: confirm.number, action: confirm.action })}>
                {repair.isPending ? 'Applying…' : 'Apply heal'}
              </Btn>
            </div>
          </div>
        </Modal>
      )}
    </section>
  );
}

export default function DiagnosticsPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-slate-400">Loading…</div>}>
      <DiagnosticsInner />
    </Suspense>
  );
}
