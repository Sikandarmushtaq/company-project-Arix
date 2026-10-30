'use client';

/**
 * Live Operations — who/what is live on the platform right now.
 *   • Metric tiles: active calls, live SIP registrations, active sessions, devices.
 *   • Live registrations table (from Kamailio usrloc, user/org enriched) — the
 *     real "who's online" view: extension · user · org · device · from · expiry.
 *   • Recent platform activity (audit stream, reused from admin stats).
 * On-demand Refresh (no polling), consistent with the Dashboard.
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/lib/stores/auth';
import { useAdminStats } from '@/lib/hooks/useAdmin';
import { useSocket } from '@/lib/providers/SocketProvider';
import { REALTIME_EVENTS } from '@/lib/constants/events';
import { adminService } from '@/lib/api/services/admin.service';
import { adminAccountApi, type LiveRegistration } from '@/lib/api/services/admin-account.api';
import { Btn, Card, Metric, PageHead, SectionTitle, HealthRow, StatusDot } from '../_components/ui';

function expiryLabel(sec: number | null): string {
  if (sec == null) return '—';
  if (sec <= 0) return 'expiring';
  if (sec < 60) return `${sec}s`;
  return `${Math.round(sec / 60)}m`;
}
function dur(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function LiveOperationsPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const isSuperAdmin = user?.role === 'super_admin' || user?.role === 'superadmin';

  const qc = useQueryClient();
  const { data: stats } = useAdminStats();
  // Registrations: Kamailio usrloc has no push stream. No polling — refreshed on
  // demand via the Refresh button (manual).
  const regsQ = useQuery({
    queryKey: ['admin2', 'live-registrations'],
    queryFn: () => adminAccountApi.getLiveRegistrations(),
    enabled: isSuperAdmin,
    staleTime: 10_000,
  });
  // Active calls from the Live Call Monitor (org-scoped), NOT stats.activeCalls
  // (which the dashboard stats payload doesn't populate → it would always read 0).
  // Kept live by the WebSocket effect below (event-driven, not polling).
  const callsQ = useQuery({
    queryKey: ['admin2', 'live-calls'],
    queryFn: () => adminService.getLiveCalls(false),
    enabled: isSuperAdmin,
    staleTime: 5_000,
  });

  // Push-live calls: refetch the active-call list the instant a call starts/
  // changes/ends. This is event-driven (WebSocket), NOT polling. NOTE: the plain
  // call:* events are emitted to the caller's phone room (emitToPhone), NOT to
  // admins — only the ADMIN_CALL_* events go to the admin dashboard room (which
  // super_admin joins), so those are the ones that actually fire here.
  const { socket, isConnected } = useSocket();
  useEffect(() => {
    if (!socket || !isSuperAdmin) return;
    const events = [
      REALTIME_EVENTS.ADMIN_CALL_ACTIVE,
      REALTIME_EVENTS.ADMIN_CALL_ENDED,
      REALTIME_EVENTS.ADMIN_CALLS_REFRESHED,
    ];
    const onCallEvent = () => qc.invalidateQueries({ queryKey: ['admin2', 'live-calls'] });
    events.forEach((e) => socket.on(e, onCallEvent));
    return () => events.forEach((e) => socket.off(e, onCallEvent));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, isSuperAdmin]);

  const [refreshing, setRefreshing] = useState(false);
  const [refreshedAt, setRefreshedAt] = useState<Date | null>(null);
  const refresh = async () => {
    setRefreshing(true);
    try { await qc.invalidateQueries(); setRefreshedAt(new Date()); } finally { setRefreshing(false); }
  };

  if (!isSuperAdmin) {
    return (
      <section>
        <h1 className="text-3xl font-black tracking-tight">Live Operations</h1>
        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900">
          Live operations are available to platform super-admins.
        </div>
      </section>
    );
  }

  const regs: LiveRegistration[] = regsQ.data?.registrations ?? [];
  const calls = callsQ.data ?? [];

  return (
    <section>
      <PageHead
        title="Live Operations"
        subtitle={`${isConnected ? '● Live' : '○ Offline'} · calls update instantly · use Refresh for registrations${refreshedAt ? ` · updated ${refreshedAt.toLocaleTimeString()}` : ''}`}
        actions={<Btn onClick={refresh} disabled={refreshing}>{refreshing ? 'Refreshing…' : '↻ Refresh'}</Btn>}
      />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Metric label="Active Calls" value={callsQ.isLoading ? '…' : calls.length.toLocaleString()} sub="in progress" />
        <Metric label="Live Registrations" value={regsQ.isLoading ? '…' : (regsQ.data?.total ?? 0).toLocaleString()} sub="softphones online" subTone="off" />
        <Metric label="Active Sessions" value={(stats?.activeSessions ?? 0).toLocaleString()} sub={`${stats?.activeDevices ?? 0} devices`} subTone="off" />
        <Metric label="Total Users" value={(stats?.totalUsers ?? 0).toLocaleString()} sub={`${stats?.activeUsers ?? 0} active`} subTone="off" />
      </div>

      {/* Live calls (real, from the Live Call Monitor) */}
      <div className="mt-4">
        <Card className="p-5">
          <SectionTitle action={<span className="text-xs font-bold text-slate-400">{calls.length} in progress</span>}>
            Calls in progress
          </SectionTitle>
          {callsQ.isLoading ? (
            <div className="space-y-2">{[0,1].map((i)=><div key={i} className="h-10 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />)}</div>
          ) : callsQ.isError ? (
            <div className="text-sm text-slate-400">Could not read active calls.</div>
          ) : calls.length === 0 ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300">No calls in progress right now.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm">
                <thead className="text-xs uppercase tracking-wide text-slate-400">
                  <tr><th className="py-2 pr-3">Direction</th><th className="py-2 pr-3">From</th><th className="py-2 pr-3">To</th><th className="py-2 pr-3">Ext</th><th className="py-2 pr-3">Status</th><th className="py-2">Duration</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {calls.map((c) => (
                    <tr key={c.id}>
                      <td className="py-2 pr-3"><span className={`rounded-full px-2 py-0.5 text-xs font-bold ${c.direction === 'inbound' ? 'bg-sky-500/10 text-sky-600 dark:text-sky-400' : 'bg-violet-500/10 text-violet-600 dark:text-violet-400'}`}>{c.direction}</span></td>
                      <td className="py-2 pr-3 font-mono text-xs">{c.callerName || c.userPhone || c.callerId}</td>
                      <td className="py-2 pr-3 font-mono text-xs">{c.calleeName || c.remotePhone || c.calleeId}</td>
                      <td className="py-2 pr-3 font-mono text-xs">{c.extension || '—'}</td>
                      <td className="py-2 pr-3"><StatusDot health={c.status === 'active' ? 'ok' : c.status === 'on-hold' ? 'warn' : 'off'} label={c.status} /></td>
                      <td className="py-2 font-mono text-xs tabular-nums">{dur(c.duration)}{c.isRecording ? ' ●' : ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        {/* Live registrations */}
        <Card className="p-5">
          <SectionTitle action={<span className="text-xs font-bold text-slate-400">{regs.length} online</span>}>
            Live SIP registrations
          </SectionTitle>
          {regsQ.isLoading ? (
            <div className="space-y-2">{[0,1,2,3].map((i)=><div key={i} className="h-10 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />)}</div>
          ) : regsQ.isError ? (
            <div className="text-sm text-slate-400">Could not read registrations.</div>
          ) : regs.length === 0 ? (
            <div className="py-8 text-center text-sm text-slate-400">No softphones are currently registered.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm">
                <thead className="text-xs uppercase tracking-wide text-slate-400">
                  <tr><th className="py-2 pr-3">Ext</th><th className="py-2 pr-3">User</th><th className="py-2 pr-3">Org</th><th className="py-2 pr-3">Device</th><th className="py-2 pr-3">From</th><th className="py-2">Expires</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {regs.map((r, i) => (
                    <tr key={`${r.extension}-${i}`} className={r.orgId ? 'cursor-pointer hover:bg-[#FF6542]/5' : ''} onClick={() => r.orgId && router.push(`/admin2/organizations/${r.orgId}`)}>
                      <td className="py-2 pr-3 font-mono font-bold">{r.extension}</td>
                      <td className="py-2 pr-3">{r.userName ?? <span className="text-slate-400">—</span>}</td>
                      <td className="py-2 pr-3 text-slate-500 dark:text-slate-400">{r.orgName ?? '—'}</td>
                      <td className="py-2 pr-3 text-xs text-slate-500 dark:text-slate-400 max-w-[180px] truncate" title={r.device ?? ''}>{r.device ?? '—'}</td>
                      <td className="py-2 pr-3 font-mono text-xs text-slate-500 dark:text-slate-400 max-w-[160px] truncate" title={r.from ?? ''}>{r.from ?? '—'}</td>
                      <td className="py-2 text-xs font-semibold">{expiryLabel(r.expiresInSec)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* Recent activity (reused from admin stats audit stream) */}
        <Card className="p-5">
          <SectionTitle>Recent activity</SectionTitle>
          {(stats?.recentActivity ?? []).length === 0 ? (
            <div className="py-6 text-center text-sm text-slate-400">No recent activity.</div>
          ) : (
            (stats?.recentActivity ?? []).slice(0, 10).map((a, i) => (
              <HealthRow key={i} label={<span><span className="font-semibold">{a.user}</span> {a.action}</span>}>
                <small className="text-xs text-slate-400">{a.time}</small>
              </HealthRow>
            ))
          )}
        </Card>
      </div>

      <p className="mt-3 text-xs text-slate-400">
        Calls update instantly via WebSocket (call start/change/end). Registrations come from Kamailio usrloc (which has no event stream) — use Refresh to re-pull them. No background polling.
      </p>
    </section>
  );
}
