'use client';

/**
 * Org Detail → Infrastructure tab. Shows WHERE the org's telephony lives (mother
 * trunk vs an active managed sub-account) + the Telnyx identifiers, and for
 * sub-tier orgs the LIVE health (voice keycard · inbound gateway REGED · SMS
 * webhook + 10DLC) with a Repair action — all reusing the deployed endpoints
 * (GET /organizations/:id/telephony + the sub-account health/repair). Real data;
 * no secrets. For mother-trunk orgs, per-number health is in Diagnostics.
 */

import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminAccountApi, type HealthDim } from '@/lib/api/services/admin-account.api';
import { superadminApiService } from '@/lib/api/services/superadmin.service';
import { toast } from '@/lib/stores/toast';
import { Card, SectionTitle, StatusDot, Btn, type Health } from '../../_components/ui';

function dimHealth(s: HealthDim['status']): Health {
  return s === 'ok' ? 'ok' : s === 'warn' ? 'warn' : s === 'bad' ? 'bad' : 'off';
}
function dimWord(s: HealthDim['status']): string {
  return s === 'ok' ? 'OK' : s === 'bad' ? 'Fail' : s === 'unknown' ? 'Unknown' : 'Warn';
}

function Row({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-slate-100 py-2.5 text-sm last:border-0 dark:border-slate-800/60">
      <dt className="text-slate-500 dark:text-slate-400">{k}</dt>
      <dd className="text-right font-semibold break-all">{children}</dd>
    </div>
  );
}

function HealthCard({ title, dim }: { title: string; dim: HealthDim }) {
  const tone = dim.status === 'ok' ? 'border-emerald-200 dark:border-emerald-900' : dim.status === 'bad' ? 'border-red-200 dark:border-red-900' : 'border-amber-200 dark:border-amber-900';
  return (
    <div className={`rounded-xl border bg-white p-3 dark:bg-slate-900 ${tone}`}>
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-black uppercase tracking-wide text-slate-400">{title}</span>
        <StatusDot health={dimHealth(dim.status)} label={dimWord(dim.status)} />
      </div>
      <p className="mt-1.5 text-xs text-slate-600 dark:text-slate-300">{dim.detail}</p>
    </div>
  );
}

export function InfrastructureTab({
  orgId,
  billingStatus,
  isActive,
}: {
  orgId: number;
  billingStatus: string;
  isActive: boolean;
}) {
  const router = useRouter();

  const tel = useQuery({
    queryKey: ['admin2', 'org-telephony', orgId],
    queryFn: () => adminAccountApi.getOrgTelephony(orgId),
    enabled: orgId > 0,
    staleTime: 30_000,
  });

  const managedId = tel.data?.tier === 'sub' ? tel.data.managedAccountId : null;
  const health = useQuery({
    queryKey: ['admin2', 'org-sub-health', managedId],
    queryFn: () => adminAccountApi.getSubaccountHealth(managedId!),
    enabled: !!managedId,
    staleTime: 20_000,
  });
  const repair = useMutation({
    mutationFn: () => adminAccountApi.repairSubaccount(managedId!),
    onSuccess: () => health.refetch(),
  });

  // Sub-account kill-switch + 10DLC (fraud isolation). Sub-tier only.
  const qc = useQueryClient();
  const subAcct = useQuery({
    queryKey: ['admin2', 'org-subacct', orgId],
    queryFn: () => superadminApiService.getOrgTelnyxSubaccount(orgId),
    enabled: orgId > 0,
    refetchOnMount: 'always',
  });
  const refreshOrgViews = () => {
    subAcct.refetch();
    qc.invalidateQueries({ queryKey: ['admin2', 'org-telephony', orgId] });
  };
  const refresh10dlc = useMutation({
    mutationFn: () => superadminApiService.refreshOrgTelnyx10dlc(orgId),
    onSuccess: (r) => {
      const s = r.data.campaignStatus ?? 'unknown';
      toast.success(
        `10DLC: ${s}${r.data.numbersAssigned ? ` · ${r.data.numbersAssigned} number(s) assigned` : ''}`
      );
      refreshOrgViews();
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : 'Could not refresh 10DLC'),
  });

  if (tel.isLoading) return <Card className="p-5"><div className="h-28 animate-pulse rounded bg-slate-200 dark:bg-slate-800" /></Card>;
  if (tel.isError || !tel.data) return <Card className="p-5 text-sm text-slate-400">Could not load telephony infrastructure.</Card>;

  const t = tel.data;
  const dash = <span className="text-slate-400">—</span>;

  return (
    <div className="space-y-4">
      {/* Account + identifiers */}
      <Card className="p-5">
        <SectionTitle
          action={<Btn size="sm" onClick={() => router.push('/admin2/diagnostics?org=' + orgId)}>Run diagnostics</Btn>}
        >
          Telephony infrastructure
        </SectionTitle>
        <dl className="mt-1">
          <Row k="Subscription"><span className="capitalize">{billingStatus}</span></Row>
          <Row k="State"><StatusDot health={isActive ? 'ok' : 'off'} label={isActive ? 'Active' : 'Inactive'} /></Row>
          <Row k="Telephony tier">
            <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${t.tier === 'sub' ? 'bg-[#FF6542]/10 text-[#b8462c] dark:text-[#ffb09a]' : 'bg-slate-500/10 text-slate-500'}`}>
              {t.tier === 'sub' ? 'Managed sub-account' : 'Mother trunk'}
            </span>
          </Row>
          {t.tier === 'sub' && (
            <>
              <Row k="Managed account"><span className="font-mono text-xs">{t.managedAccountId ?? dash}</span></Row>
              <Row k="Voice connection (keycard)"><span className="font-mono text-xs">{t.connectionId ?? dash}</span></Row>
              <Row k="Messaging profile"><span className="font-mono text-xs">{t.messagingProfileId ?? dash}</span></Row>
              <Row k="10DLC campaign">{t.campaignStatus ? <span>{t.campaignId} · {t.campaignStatus}</span> : dash}</Row>
            </>
          )}
        </dl>
        {t.tier === 'mother' && (
          <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
            This org egresses via the shared mother trunk. Per-number inbound/outbound health is in{' '}
            <button type="button" onClick={() => router.push('/admin2/diagnostics?org=' + orgId)} className="font-bold text-[#FF6542] hover:underline">Diagnostics</button>.
          </p>
        )}
      </Card>

      {/* Live health (sub-tier only) */}
      {t.tier === 'sub' && (
        <Card className="p-5">
          <SectionTitle
            action={
              <Btn size="sm" variant="primary" disabled={repair.isPending || !managedId} onClick={() => repair.mutate()}>
                {repair.isPending ? 'Repairing…' : 'Repair'}
              </Btn>
            }
          >
            Live health
          </SectionTitle>
          {health.isLoading ? (
            <div className="h-20 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
          ) : health.isError || !health.data ? (
            <div className="text-sm text-slate-400">Could not read live health.</div>
          ) : (
            <>
              <div className="mb-3 flex items-center gap-2">
                <StatusDot health={dimHealth(health.data.overall.status)} label={health.data.overall.status === 'ok' ? 'Healthy' : health.data.overall.status === 'bad' ? 'Needs attention' : 'Attention'} />
                <span className="text-xs text-slate-500 dark:text-slate-400">{health.data.overall.detail}</span>
              </div>
              <div className="grid gap-2 sm:grid-cols-3">
                <HealthCard title="Voice (outbound)" dim={health.data.voice} />
                <HealthCard title="Inbound (gateway)" dim={health.data.inbound} />
                <HealthCard title="SMS (webhook + 10DLC)" dim={health.data.sms} />
              </div>
              <p className="mt-2 text-[11px] text-slate-400">Repair re-syncs this org's sub-account routing (gateway + keycard + SMS), then re-checks. Writes to live telephony.</p>
            </>
          )}
        </Card>
      )}

      {/* Sub-account 10DLC (sub-tier only) */}
      {t.tier === 'sub' && subAcct.data?.data?.provisioned && (() => {
        const campaign = subAcct.data.data.tenDlc.campaignStatus;
        const campaignActive = campaign === 'active' || campaign === 'ACTIVE' || campaign === 'MNO_PROVISIONED';
        return (
          <Card className="p-5">
            <SectionTitle>Sub-account controls</SectionTitle>
            <Row k="10DLC campaign">
              <span className="inline-flex items-center gap-2">
                <StatusDot health={campaignActive ? 'ok' : campaign ? 'warn' : 'off'} label={campaign ?? 'none'} />
                <Btn size="sm" disabled={refresh10dlc.isPending} onClick={() => refresh10dlc.mutate()}>
                  {refresh10dlc.isPending ? 'Refreshing…' : 'Refresh'}
                </Btn>
              </span>
            </Row>
            <p className="mt-2 text-[11px] text-slate-400">
              Refresh re-polls Telnyx for the 10DLC campaign status and, once approved, assigns the org&apos;s numbers to it.
            </p>
          </Card>
        );
      })()}
    </div>
  );
}
