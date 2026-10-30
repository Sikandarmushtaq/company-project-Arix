'use client';

/**
 * Admin → Call Health → Hardphones
 *
 * Live monitor for desk phones (Polycom/Yealink). Desk phones are pure SIP —
 * they don't emit browser WebRTC telemetry, so they're invisible to the main
 * Call Health page. This sub-page reads server-side truth (Kamailio usrloc for
 * registration + FreeSWITCH for live calls) and shows only clean, real activity:
 * one row per phone (online/offline) and one row per live call (legs collapsed,
 * no plumbing) — exactly like the web Live Call Monitor, nothing to alarm anyone.
 *
 * @module app/admin/call-health/hardphones/page
 */

import Link from 'next/link';
import {
  FiPhone,
  FiRefreshCw,
  FiArrowLeft,
  FiArrowDownLeft,
  FiArrowUpRight,
  FiWifi,
  FiWifiOff,
} from 'react-icons/fi';
import { usePermissions, PERMISSIONS } from '@/lib/hooks/usePermissions';
import { useHardphoneMonitor } from '@/lib/hooks/useCallHealth';
import type {
  HardphoneStatus,
  HardphoneLiveCall,
} from '@/lib/api/services/callHealth.service';

/** "12s ago" / "3m ago" / "1h ago" from a seconds value. */
function ago(sec: number | null): string {
  if (sec == null) return '—';
  if (sec < 60) return `${sec}s ago`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  return `${Math.floor(sec / 3600)}h ago`;
}

/** mm:ss from seconds. */
function dur(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** "17m left" / "45s left" — remaining time on the registration lease. */
function remain(sec: number | null): string {
  if (sec == null) return '';
  if (sec < 60) return `${sec}s left`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m left`;
  return `${Math.floor(sec / 3600)}h left`;
}

export default function HardphoneMonitorPage() {
  const { hasPermission } = usePermissions();
  const canView = hasPermission(PERMISSIONS.VIEW_CALL_HEALTH);

  const { data, isLoading, isError, refetch, isFetching, dataUpdatedAt } =
    useHardphoneMonitor(canView ? 5000 : 0);

  const phones = data?.phones ?? [];
  const liveCalls = data?.liveCalls ?? [];
  const onlineCount = phones.filter((p) => p.online).length;

  if (!canView) {
    return (
      <div className="p-6">
        <p className="text-[var(--muted-foreground)]">
          You don&rsquo;t have permission to view call health.
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-full">
      {/* Header */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-[var(--primary-50)] text-[var(--foreground)] dark:bg-[var(--primary-900)]/40">
            <FiPhone className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-xl font-semibold text-[var(--foreground)]">
              Hardphone Monitor
            </h1>
            <p className="text-sm text-[var(--muted-foreground)]">
              Desk phones — live registration status and calls in progress
            </p>
          </div>
        </div>
        <div className="flex flex-shrink-0 items-center gap-3">
          <Link
            href="/admin/call-health"
            className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-[var(--foreground)] hover:bg-[var(--muted)]"
          >
            <FiArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Call Health</span>
          </Link>
          <button
            onClick={() => void refetch()}
            className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-[var(--foreground)] hover:bg-[var(--muted)]"
            title="Refresh"
          >
            <FiRefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Summary strip */}
      <div className="mb-5 flex flex-wrap items-center gap-3 text-sm">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--card)] border border-[var(--border)] px-3 py-1">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
          </span>
          Live
        </span>
        <span className="text-[var(--muted-foreground)]">
          <span className="font-semibold text-[var(--foreground)]">{onlineCount}</span> /{' '}
          {phones.length} online
        </span>
        <span className="text-[var(--muted-foreground)]">
          <span className="font-semibold text-[var(--foreground)]">{liveCalls.length}</span> on a
          call
        </span>
        {dataUpdatedAt > 0 && (
          <span className="text-xs text-[var(--muted-foreground)]">
            updated {new Date(dataUpdatedAt).toLocaleTimeString()}
          </span>
        )}
      </div>

      {isError && (
        <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-500">
          Couldn&rsquo;t load hardphone status. Retrying…
        </div>
      )}

      {/* Live calls */}
      {liveCalls.length > 0 && (
        <div className="mb-6 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)]">
          <div className="border-b border-[var(--border)] px-4 py-2.5 text-sm font-medium text-[var(--foreground)]">
            On a call now
          </div>
          <ul className="divide-y divide-[var(--border)]">
            {liveCalls.map((c: HardphoneLiveCall, i) => (
              <li key={`${c.extension}-${i}`} className="flex items-center gap-3 px-4 py-3">
                {c.direction === 'inbound' ? (
                  <FiArrowDownLeft className="h-4 w-4 flex-shrink-0 text-green-500" title="Inbound" />
                ) : (
                  <FiArrowUpRight className="h-4 w-4 flex-shrink-0 text-blue-500" title="Outbound" />
                )}
                <span className="font-mono text-sm text-[var(--foreground)]">{c.extension}</span>
                <span className="text-[var(--muted-foreground)]">
                  {c.direction === 'inbound' ? '←' : '→'}
                </span>
                <span className="font-mono text-sm text-[var(--foreground)]">{c.peer}</span>
                <span
                  className={`ml-auto rounded-full px-2 py-0.5 text-xs ${
                    c.state === 'active'
                      ? 'bg-green-500/15 text-green-600 dark:text-green-400'
                      : 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                  }`}
                >
                  {c.state === 'active' ? 'In call' : 'Ringing'}
                </span>
                <span className="w-12 text-right font-mono text-xs text-[var(--muted-foreground)]">
                  {dur(c.durationSeconds)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Phones table */}
      <div className="overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--card)]">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-[var(--border)] text-[var(--muted-foreground)]">
            <tr>
              <th className="px-4 py-3 font-medium">Phone</th>
              <th className="px-4 py-3 font-medium">Ext.</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Last seen</th>
              <th className="px-4 py-3 font-medium">IP</th>
              <th className="px-4 py-3 font-medium">Registration</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-[var(--muted-foreground)]">
                  Loading…
                </td>
              </tr>
            ) : phones.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center">
                  <FiPhone className="mx-auto mb-3 h-8 w-8 text-[var(--muted-foreground)]" />
                  <p className="text-[var(--foreground)]">No desk phones provisioned</p>
                  <p className="text-sm text-[var(--muted-foreground)]">
                    Add one under Hardphones, then it appears here live.
                  </p>
                </td>
              </tr>
            ) : (
              phones.map((p: HardphoneStatus) => (
                <tr
                  key={p.extension}
                  className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--muted)]/50 transition-colors"
                >
                  <td className="px-4 py-3">
                    <div className="text-[var(--foreground)]">{p.label || 'Desk phone'}</div>
                    <div className="text-xs text-[var(--muted-foreground)]">
                      {p.vendor}
                      {p.model ? ` · ${p.model}` : ''}
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono text-[var(--foreground)]">{p.extension}</td>
                  <td className="px-4 py-3">
                    {p.online ? (
                      <span className="inline-flex items-center gap-1.5 text-green-600 dark:text-green-400">
                        <FiWifi className="h-4 w-4" /> Online
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-[var(--muted-foreground)]">
                        <FiWifiOff className="h-4 w-4" /> Offline
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-[var(--muted-foreground)]">
                    {p.online ? ago(p.lastSeenSecondsAgo) : '—'}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-[var(--muted-foreground)]">
                    {p.ip || '—'}
                  </td>
                  <td className="px-4 py-3">
                    {!p.online ? (
                      <span className="text-[var(--muted-foreground)]">—</span>
                    ) : (
                      <span
                        className="text-green-600 dark:text-green-400"
                        title="SIP registration is active"
                      >
                        Registered
                        {p.expiresInSeconds != null && (
                          <span className="ml-1.5 text-xs text-[var(--muted-foreground)]">
                            · {remain(p.expiresInSeconds)}
                          </span>
                        )}
                      </span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-xs text-[var(--muted-foreground)]">
        Live status refreshes every few seconds. Calls show only real desk-phone
        activity (both call legs collapsed into one) — no system or scanner traffic.
      </p>
    </div>
  );
}
