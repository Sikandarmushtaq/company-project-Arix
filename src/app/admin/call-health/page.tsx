'use client';

/**
 * Admin → Call Health
 *
 * Industrial-grade observability for WebRTC call setup.
 *
 * Layout:
 *  ┌────────────────────────────────────────────────────────────────┐
 *  │  24h summary cards: total / success rate / avg time-to-connected / retries │
 *  ├────────────────────────────────────┬────────────────────────────┤
 *  │  Per-user failure table            │  TURN URL distribution     │
 *  │  (click row → call detail drawer)  │  (pie of relay vs srflx)   │
 *  └────────────────────────────────────┴────────────────────────────┘
 *
 * Live-updated via WebSocket (admin:call_health:recorded). No polling.
 *
 * @module app/admin/call-health/page
 */

import React, { useState } from 'react';
import Link from 'next/link';
import {
  FiActivity,
  FiAlertTriangle,
  FiCheckCircle,
  FiRefreshCw,
  FiRotateCcw,
  FiX,
  FiPhone,
} from 'react-icons/fi';
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { StyledSelect } from '@/components/ui';
import {
  useCallHealthCalls,
  useCallHealthDetail,
  useCallHealthRealtimeSync,
  useCallHealthSummary,
  useCallHealthUserStats,
} from '@/lib/hooks/useCallHealth';
import type {
  CallDetail,
  IceFinalState,
  UserFailureStat,
} from '@/lib/api/services/callHealth.service';

const TIME_RANGES = [
  { label: 'Today', value: 24 },
  { label: 'Last 7 days', value: 168 },
];

const STATE_FILTERS: Array<{ label: string; value: IceFinalState | 'all' }> = [
  { label: 'All', value: 'all' },
  { label: 'Connected', value: 'connected' },
  { label: 'Failed', value: 'failed' },
  { label: 'Disconnected', value: 'disconnected' },
];

const CHART_COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export default function CallHealthPage() {
  const [hours, setHours] = useState(24);
  const [stateFilter, setStateFilter] = useState<IceFinalState | 'all'>('all');
  const [drawerId, setDrawerId] = useState<number | null>(null);

  // Subscribe to real-time updates — no polling.
  useCallHealthRealtimeSync();

  const summaryQuery = useCallHealthSummary(hours);
  const userStatsQuery = useCallHealthUserStats(hours, 50);
  const callsQuery = useCallHealthCalls({
    hours,
    state: stateFilter === 'all' ? undefined : stateFilter,
    limit: 50,
    offset: 0,
  });

  const summary = summaryQuery.data;
  const userStats = userStatsQuery.data ?? [];
  const callsList = callsQuery.data?.calls ?? [];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <FiActivity className="w-6 h-6" /> Call Health
          </h1>
          <p className="text-sm text-[var(--muted-foreground)]">
            WebRTC NAT traversal diagnostics — per-call ICE telemetry from every dialer client.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/admin/call-health/hardphones"
            className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-[var(--foreground)] hover:bg-[var(--muted)]"
          >
            <FiPhone className="w-4 h-4" /> Hardphones
          </Link>
          <StyledSelect
            className="w-auto bg-[var(--card)]"
            value={String(hours)}
            onChange={(v) => setHours(Number(v))}
            aria-label="Time range"
          >
            {TIME_RANGES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </StyledSelect>
          <button
            type="button"
            onClick={() => {
              summaryQuery.refetch();
              userStatsQuery.refetch();
              callsQuery.refetch();
            }}
            className="flex items-center gap-1 px-3 py-1.5 text-sm border rounded-md hover:bg-[var(--muted)]"
            aria-label="Refresh"
          >
            <FiRefreshCw className="w-4 h-4" /> Refresh
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <SummaryCards summary={summary} loading={summaryQuery.isLoading} />

      {/* Two-column: per-user table + TURN URL distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <h2 className="text-lg font-medium mb-3">Users by failure rate</h2>
          <UserStatsTable
            users={userStats}
            loading={userStatsQuery.isLoading}
            onRowClick={(_userId) => {
              // Selecting a user currently just resets state filters.
              // (Further drill-in — filtering the calls table by userId —
              // is a follow-up enhancement.)
              setStateFilter('all');
            }}
          />
        </div>
        <div>
          <h2 className="text-lg font-medium mb-3">TURN URL distribution</h2>
          <TurnUrlChart summary={summary} loading={summaryQuery.isLoading} />
        </div>
      </div>

      {/* Recent calls list */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-medium">Recent calls</h2>
          <StyledSelect
            className="w-auto bg-[var(--card)]"
            value={stateFilter}
            onChange={(v) => setStateFilter(v as IceFinalState | 'all')}
            aria-label="Filter by state"
          >
            {STATE_FILTERS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </StyledSelect>
        </div>
        <CallsTable calls={callsList} loading={callsQuery.isLoading} onRowClick={setDrawerId} />
      </div>

      {/* Call detail drawer */}
      {drawerId !== null && <CallDetailDrawer id={drawerId} onClose={() => setDrawerId(null)} />}
    </div>
  );
}

// ===========================================================================
// Components
// ===========================================================================

function SummaryCards({
  summary,
  loading,
}: {
  summary: ReturnType<typeof useCallHealthSummary>['data'];
  loading: boolean;
}) {
  const totalCalls = summary?.totalCalls ?? 0;
  const successRate = summary?.successRatePct ?? 0;
  const failedCalls = summary?.failedCalls ?? 0;
  const unmeasured = summary?.unmeasuredCalls ?? 0;
  const avgMs = summary?.avgTimeToConnectedMs;
  const retried = summary?.retriedAsRelayCount ?? 0;
  const iceRestarted = summary?.iceRestartedCount ?? 0;

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      <Card
        label="Total calls"
        value={loading ? '—' : totalCalls.toLocaleString()}
        subtitle={unmeasured > 0 ? `${unmeasured} too brief to measure` : undefined}
        icon={<FiActivity className="w-5 h-5" />}
      />
      <Card
        label="Success rate"
        value={loading ? '—' : `${successRate.toFixed(1)}%`}
        subtitle={loading ? undefined : `${failedCalls} failed`}
        icon={<FiCheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />}
        valueClassName={
          successRate >= 95
            ? 'text-green-600 dark:text-green-400'
            : successRate >= 85
              ? 'text-yellow-600 dark:text-yellow-400'
              : 'text-red-600 dark:text-red-400'
        }
      />
      <Card
        label="Avg time-to-connected"
        value={loading ? '—' : avgMs !== null && avgMs !== undefined ? `${avgMs} ms` : '—'}
      />
      <Card
        label="Saved by TURN retry"
        value={loading ? '—' : retried.toLocaleString()}
        icon={<FiRotateCcw className="w-5 h-5 text-blue-600 dark:text-blue-400" />}
      />
      <Card
        label="Mid-call ICE restarts"
        value={loading ? '—' : iceRestarted.toLocaleString()}
        icon={<FiAlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />}
      />
      <Card
        label="Calls recovered"
        value={loading ? '—' : (retried + iceRestarted).toLocaleString()}
        subtitle="Would have failed without fixes"
        icon={<FiCheckCircle className="w-5 h-5 text-blue-600 dark:text-blue-400" />}
      />
    </div>
  );
}

function Card({
  label,
  value,
  subtitle,
  icon,
  valueClassName,
}: {
  label: string;
  value: string;
  subtitle?: string;
  icon?: React.ReactNode;
  valueClassName?: string;
}) {
  return (
    <div className="bg-[var(--card)] border rounded-lg p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wide text-[var(--muted-foreground)]">
          {label}
        </span>
        {icon}
      </div>
      <div className={`text-2xl font-semibold mt-1 ${valueClassName ?? ''}`}>{value}</div>
      {subtitle && <div className="text-xs text-[var(--muted-foreground)] mt-0.5">{subtitle}</div>}
    </div>
  );
}

function UserStatsTable({
  users,
  loading,
  onRowClick: _onRowClick,
}: {
  users: UserFailureStat[];
  loading: boolean;
  onRowClick: (userId: number) => void;
}) {
  if (loading) {
    return <div className="text-sm text-[var(--muted-foreground)]">Loading user stats…</div>;
  }
  if (users.length === 0) {
    return (
      <div className="text-sm text-[var(--muted-foreground)]">
        No calls recorded in the selected range.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto border rounded-lg">
      <table className="w-full text-sm">
        <thead className="bg-[var(--muted)] text-xs uppercase tracking-wide">
          <tr>
            <th className="px-3 py-2 text-left">User</th>
            <th className="px-3 py-2 text-left">Extension</th>
            <th className="px-3 py-2 text-right">Total</th>
            <th className="px-3 py-2 text-right">Failed</th>
            <th className="px-3 py-2 text-right">Rate</th>
            <th className="px-3 py-2 text-left">Last failure</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.userId} className="border-t hover:bg-[var(--muted)]">
              <td className="px-3 py-2">
                <div className="font-medium">{u.userName ?? `#${u.userId}`}</div>
                {u.userEmail && (
                  <div className="text-xs text-[var(--muted-foreground)]">{u.userEmail}</div>
                )}
              </td>
              <td className="px-3 py-2 font-mono text-xs">{u.extension ?? '—'}</td>
              <td className="px-3 py-2 text-right">{u.totalCalls}</td>
              <td className="px-3 py-2 text-right">{u.failedCalls}</td>
              <td
                className={`px-3 py-2 text-right font-medium ${
                  u.failureRatePct >= 20
                    ? 'text-red-600 dark:text-red-400'
                    : u.failureRatePct >= 5
                      ? 'text-yellow-600 dark:text-yellow-400'
                      : 'text-green-600 dark:text-green-400'
                }`}
              >
                {u.failureRatePct.toFixed(1)}%
              </td>
              <td className="px-3 py-2 text-xs text-[var(--muted-foreground)]">
                {u.lastFailureAt ? new Date(u.lastFailureAt).toLocaleString() : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TurnUrlChart({
  summary,
  loading,
}: {
  summary: ReturnType<typeof useCallHealthSummary>['data'];
  loading: boolean;
}) {
  if (loading) {
    return <div className="text-sm text-[var(--muted-foreground)]">Loading…</div>;
  }
  const dist = summary?.turnUrlDistribution ?? [];
  if (dist.length === 0) {
    return (
      <div className="text-sm text-[var(--muted-foreground)]">
        No telemetry yet — place a call to populate.
      </div>
    );
  }

  // Shorten URLs and MERGE duplicates (e.g., two different STUN URLs that
  // both shorten to "STUN 3478" get combined into one pie slice).
  const merged = new Map<string, number>();
  for (const d of dist) {
    const name = shortenTurnUrl(d.turnUrl);
    merged.set(name, (merged.get(name) ?? 0) + d.count);
  }
  const data = Array.from(merged.entries()).map(([name, value]) => ({ name, value }));

  return (
    <div className="bg-[var(--card)] border rounded-lg p-4 h-full">
      <ResponsiveContainer width="100%" height={280}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            outerRadius={80}
            label={(entry) => `${entry.name}: ${entry.value}`}
          >
            {data.map((_, index) => (
              <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip />
          <Legend verticalAlign="bottom" height={36} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

/**
 * Compress full TURN URLs (which are long and repetitive) to their most
 * distinguishing segments for chart legends.
 */
function shortenTurnUrl(url: string): string {
  if (!url || url === '(none / direct)') return 'Direct';
  // e.g., turn:global.turn.twilio.com:443?transport=tcp → "TURN 443/TCP"
  const portMatch = /:(\d+)/.exec(url);
  const protoMatch = /transport=(\w+)/.exec(url);
  const scheme = url.startsWith('turns:') ? 'TURNS' : url.startsWith('turn:') ? 'TURN' : 'STUN';
  const port = portMatch?.[1];
  const proto = protoMatch?.[1]?.toUpperCase();
  return [scheme, port, proto].filter(Boolean).join(' ');
}

function CallsTable({
  calls,
  loading,
  onRowClick,
}: {
  calls: CallDetail[];
  loading: boolean;
  onRowClick: (id: number) => void;
}) {
  if (loading) {
    return <div className="text-sm text-[var(--muted-foreground)]">Loading calls…</div>;
  }
  if (calls.length === 0) {
    return (
      <div className="text-sm text-[var(--muted-foreground)]">No calls match your filter.</div>
    );
  }

  return (
    <div className="overflow-x-auto border rounded-lg">
      <table className="w-full text-sm">
        <thead className="bg-[var(--muted)] text-xs uppercase tracking-wide">
          <tr>
            <th className="px-3 py-2 text-left">When</th>
            <th className="px-3 py-2 text-left">User</th>
            <th className="px-3 py-2 text-left">Direction</th>
            <th className="px-3 py-2 text-left">State</th>
            <th className="px-3 py-2 text-left">Audio</th>
            <th className="px-3 py-2 text-left">TURN</th>
            <th className="px-3 py-2 text-right">Connect ms</th>
            <th className="px-3 py-2 text-left">Flags</th>
          </tr>
        </thead>
        <tbody>
          {calls.map((c) => (
            <tr
              key={c.id}
              className="border-t hover:bg-[var(--muted)] cursor-pointer"
              onClick={() => onRowClick(c.id)}
            >
              <td className="px-3 py-2 text-xs">{new Date(c.occurredAt).toLocaleTimeString()}</td>
              <td className="px-3 py-2">
                <div>{c.userName ?? `#${c.userId}`}</div>
                {c.extension && (
                  <div className="text-xs text-[var(--muted-foreground)] font-mono">
                    {c.extension}
                  </div>
                )}
              </td>
              <td className="px-3 py-2 capitalize">{c.direction}</td>
              <td className="px-3 py-2">
                <StateBadge state={c.finalIceState} />
              </td>
              <td className="px-3 py-2">
                <AudioBadge received={c.packetsReceived} sent={c.packetsSent} />
              </td>
              <td className="px-3 py-2 text-xs font-mono">
                {c.selectedTurnUrl ? shortenTurnUrl(c.selectedTurnUrl) : '—'}
              </td>
              <td className="px-3 py-2 text-right font-mono">{c.timeToConnectedMs ?? '—'}</td>
              <td className="px-3 py-2 text-xs space-x-1">
                {c.retriedAsRelay && (
                  <span className="inline-block px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded">
                    relay-retry
                  </span>
                )}
                {c.iceRestarted && (
                  <span className="inline-block px-1.5 py-0.5 bg-yellow-100 text-yellow-700 rounded">
                    ice-restart
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AudioBadge({ received, sent }: { received: number; sent: number }) {
  const hasAudio = received > 0 && sent > 0;
  const oneWay = (received > 0 && sent === 0) || (received === 0 && sent > 0);
  const noData = received === 0 && sent === 0;

  if (noData) {
    return (
      <span
        className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600"
        title="No RTP packets recorded (call may not have connected or too short)"
      >
        —
      </span>
    );
  }
  if (oneWay) {
    return (
      <span
        className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-700"
        title={`One-way audio: ${received} received, ${sent} sent`}
      >
        One-way
      </span>
    );
  }
  return (
    <span
      className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700"
      title={`Audio OK: ${received} received, ${sent} sent`}
    >
      OK
    </span>
  );
}

function StateBadge({ state }: { state: IceFinalState }) {
  const color: Record<IceFinalState, string> = {
    connected: 'bg-green-100 text-green-700',
    failed: 'bg-red-100 text-red-700',
    disconnected: 'bg-orange-100 text-orange-700',
    closed: 'bg-gray-100 text-gray-700',
    new: 'bg-gray-100 text-gray-700',
  };
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${color[state]}`}>
      {state}
    </span>
  );
}

function CallDetailDrawer({ id, onClose }: { id: number; onClose: () => void }) {
  const { data, isLoading } = useCallHealthDetail(id);

  return (
    <div className="fixed inset-0 z-40 flex">
      <div className="flex-1 bg-black/40" onClick={onClose} aria-label="Close drawer" />
      <aside className="w-full max-w-md bg-[var(--card)] border-l shadow-xl overflow-y-auto p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Call diagnostic</h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1 hover:bg-[var(--muted)] rounded"
            aria-label="Close"
          >
            <FiX className="w-5 h-5" />
          </button>
        </div>

        {isLoading || !data ? (
          <div className="text-sm text-[var(--muted-foreground)]">Loading…</div>
        ) : (
          <div className="space-y-3 text-sm">
            <Field label="Call UUID" value={<code className="text-xs">{data.callUuid}</code>} />
            <Field
              label="User"
              value={`${data.userName ?? data.userId} (${data.extension ?? '—'})`}
            />
            <Field label="Direction" value={data.direction} />
            <Field label="Occurred at" value={new Date(data.occurredAt).toLocaleString()} />
            <Field label="Final ICE state" value={<StateBadge state={data.finalIceState} />} />
            <Field
              label="Audio flow"
              value={<AudioBadge received={data.packetsReceived} sent={data.packetsSent} />}
            />
            <Field label="Packets received" value={data.packetsReceived.toLocaleString()} />
            <Field label="Packets sent" value={data.packetsSent.toLocaleString()} />
            <Field
              label="Time to connected"
              value={data.timeToConnectedMs !== null ? `${data.timeToConnectedMs} ms` : '—'}
            />
            <Field
              label="Time to first candidate"
              value={
                data.timeToFirstCandidateMs !== null ? `${data.timeToFirstCandidateMs} ms` : '—'
              }
            />
            <Field
              label="Candidate gathering"
              value={
                <div className="space-y-0.5">
                  {data.hadHostCandidate && <div>✓ host (LAN)</div>}
                  {data.hadSrflxCandidate && <div>✓ srflx (STUN)</div>}
                  {data.hadRelayCandidate && <div>✓ relay (TURN)</div>}
                  {!data.hadHostCandidate && !data.hadSrflxCandidate && !data.hadRelayCandidate && (
                    <div className="text-red-600">No candidates gathered</div>
                  )}
                </div>
              }
            />
            <Field label="Selected local" value={data.selectedLocalType ?? '—'} />
            <Field label="Selected remote" value={data.selectedRemoteType ?? '—'} />
            <Field label="Selected TURN URL" value={data.selectedTurnUrl ?? '—'} />
            <Field label="Transport" value={data.selectedProtocol ?? '—'} />
            <Field
              label="Retried as relay"
              value={data.retriedAsRelay ? 'Yes — ICE failed on first attempt' : 'No'}
            />
            <Field
              label="ICE restart"
              value={data.iceRestarted ? 'Yes — media stalled mid-call' : 'No'}
            />
            <Field label="Hangup reason" value={data.hangupReason ?? '—'} />
            <Field label="Client IP" value={data.clientIp ?? '—'} />
            <Field
              label="User agent"
              value={<code className="text-xs break-all">{data.userAgent ?? '—'}</code>}
            />
          </div>
        )}
      </aside>
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      <div className="text-xs uppercase text-[var(--muted-foreground)]">{label}</div>
      <div className="col-span-2">{value}</div>
    </div>
  );
}
