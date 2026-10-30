'use client';

/**
 * CallPerformance — CDR-backed call performance panel for the Analytics page.
 *
 * Date range + Day/Week/Month granularity + per-agent + In/Out direction, all
 * driven by the accurate switch CDR (Europe/London bucketing, real MOS). This
 * is the Phase 2 analytics view; the per-agent leaderboard is Phase 3.
 *
 * @module app/admin/analytics/CallPerformance
 */

import React, { useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { Card, CardContent, Button } from '@/components/ui';
import { StyledSelect } from '@/components/ui/StyledSelect';
import { DateTimeField } from '@/components/ui/DateTimeField';
import {
  FiPhoneCall,
  FiCheckCircle,
  FiClock,
  FiActivity,
  FiAlertTriangle,
  FiDownload,
} from 'react-icons/fi';
import { useCallPerformance, useOrgAgents } from '@/lib/hooks/useAdminAnalytics';
import { presetRange, localInputToISO, toLocalInput, DATE_PRESETS, type DateRangePreset } from '@/lib/utils/date-range';
import { downloadCsvRows, safeFilename } from '@/lib/utils/csv';

type Granularity = 'day' | 'week' | 'month';
type Dir = '' | 'inbound' | 'outbound';

function fmtHms(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  return h > 0 ? `${h}h ${m}m` : m > 0 ? `${m}m ${s}s` : `${s}s`;
}
function pct(n: number, d: number): string {
  return d > 0 ? `${Math.round((n / d) * 100)}%` : '—';
}

const GRANS: { key: Granularity; label: string }[] = [
  { key: 'day', label: 'Day' },
  { key: 'week', label: 'Week' },
  { key: 'month', label: 'Month' },
];
const DIRS: { key: Dir; label: string }[] = [
  { key: 'outbound', label: 'Outbound' },
  { key: 'inbound', label: 'Inbound' },
  { key: '', label: 'All' },
];

function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { key: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="inline-flex rounded-lg border border-[var(--border)] overflow-hidden">
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          onClick={() => onChange(o.key)}
          className={`px-3 py-1.5 text-xs font-medium transition-colors ${
            value === o.key
              ? 'bg-[var(--primary-600)] text-white'
              : 'text-[var(--muted-foreground)] hover:bg-[var(--muted)]'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Kpi({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--background)] p-3">
      <div className="flex items-center gap-1.5 text-xs text-[var(--muted-foreground)]">
        {icon}
        {label}
      </div>
      <div className="mt-1 text-xl font-semibold text-[var(--foreground)]">{value}</div>
      {sub && <div className="text-xs text-[var(--muted-foreground)]">{sub}</div>}
    </div>
  );
}

export function CallPerformance() {
  const initial = useMemo(() => presetRange('thisMonth'), []);
  const [preset, setPreset] = useState<DateRangePreset | ''>('thisMonth');
  const [startDate, setStartDate] = useState(initial.start);
  const [endDate, setEndDate] = useState(initial.end);
  const [granularity, setGranularity] = useState<Granularity>('day');
  const [direction, setDirection] = useState<Dir>('outbound');
  const [agentUserId, setAgentUserId] = useState<number | undefined>(undefined);
  // Upper bound for the date pickers — there are no calls in the future.
  const now = useMemo(() => toLocalInput(new Date()), []);

  const { data: agentsData } = useOrgAgents();
  const agents = useMemo(
    () => (agentsData ?? []).map((a) => ({ id: a.id, label: a.name })),
    [agentsData]
  );

  // Apply a preset (tracks it so the dropdown reflects the selection).
  const applyPreset = (key: DateRangePreset) => {
    setPreset(key);
    const r = presetRange(key);
    setStartDate(r.start);
    setEndDate(r.end);
  };
  // Manual From/To edit → the range is now custom, so clear the preset label.
  const onStart = (v: string) => {
    setStartDate(v);
    setPreset('');
  };
  const onEnd = (v: string) => {
    setEndDate(v);
    setPreset('');
  };

  const { data, isLoading } = useCallPerformance({
    startDate: localInputToISO(startDate) || '',
    endDate: localInputToISO(endDate) || '',
    granularity,
    direction: direction || undefined,
    agentUserId,
  });

  const t = data?.totals;
  const chartData = (data?.buckets ?? []).map((b) => ({
    label: b.bucket.slice(0, 10),
    Calls: b.calls,
    Connected: b.connected,
  }));

  const handleExport = () => {
    if (!data) return;
    const agentLabel =
      agentUserId != null
        ? (agents.find((a) => a.id === agentUserId)?.label ?? `agent-${agentUserId}`)
        : 'all-agents';
    const pctOf = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 100) : 0);
    const headers = [
      'Bucket', 'Calls', 'Inbound', 'Outbound', 'Connected', 'Connected %',
      'Talk time (s)', 'Avg MOS', 'Below MOS 3', 'MOS scored',
    ];
    const rows: (string | number)[][] = (data.buckets ?? []).map((b) => [
      b.bucket.slice(0, 10), b.calls, b.inbound, b.outbound, b.connected,
      pctOf(b.connected, b.calls), b.talkSec,
      b.avgMos != null ? b.avgMos.toFixed(2) : '', b.belowMos3, b.mosScored,
    ]);
    const tt = data.totals;
    rows.push([
      'TOTAL', tt.calls, tt.inbound, tt.outbound, tt.connected, pctOf(tt.connected, tt.calls),
      tt.talkSec, tt.avgMos != null ? tt.avgMos.toFixed(2) : '', tt.belowMos3, tt.mosScored,
    ]);
    downloadCsvRows(
      safeFilename(
        `call-performance_${direction || 'all'}_${agentLabel}_${startDate.slice(0, 10)}_to_${endDate.slice(0, 10)}`
      ),
      headers,
      rows
    );
  };

  return (
    <Card>
      <CardContent className="p-4 sm:p-6">
        {/* Header + filters */}
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-[var(--foreground)]">Call Performance</h3>
            <p className="text-xs text-[var(--muted-foreground)]">
              From the switch CDR · Europe/London · {direction === '' ? 'all directions' : direction}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <StyledSelect
              className="w-auto min-w-[140px]"
              value={preset}
              placeholder="Custom range"
              onChange={(v) => v && applyPreset(v as DateRangePreset)}
              aria-label="Quick date range"
            >
              {DATE_PRESETS.map((p) => (
                <option key={p.key} value={p.key}>
                  {p.label}
                </option>
              ))}
            </StyledSelect>
            <StyledSelect
              className="w-auto min-w-[150px] max-w-[200px]"
              value={agentUserId != null ? String(agentUserId) : ''}
              onChange={(v) => setAgentUserId(v ? Number(v) : undefined)}
              aria-label="Filter by agent"
            >
              <option value="">All agents</option>
              {agents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label}
                </option>
              ))}
            </StyledSelect>
            <Segmented value={direction} options={DIRS} onChange={setDirection} />
            <Segmented value={granularity} options={GRANS} onChange={setGranularity} />
            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
              disabled={!data || (data.buckets?.length ?? 0) === 0}
            >
              <FiDownload className="w-4 h-4 mr-1.5" />
              Export
            </Button>
          </div>
        </div>

        {/* Custom datetime range */}
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-[var(--muted-foreground)]">
          <label className="flex items-center gap-1.5">
            From
            <DateTimeField
              className="w-[200px]"
              value={startDate}
              onChange={onStart}
              max={endDate || now}
              placeholder="Start…"
              aria-label="From date and time"
            />
          </label>
          <label className="flex items-center gap-1.5">
            To
            <DateTimeField
              className="w-[200px]"
              value={endDate}
              onChange={onEnd}
              min={startDate || undefined}
              max={now}
              placeholder="End…"
              aria-label="To date and time"
            />
          </label>
        </div>

        {/* KPIs */}
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <Kpi icon={<FiPhoneCall className="w-3.5 h-3.5" />} label="Calls" value={String(t?.calls ?? 0)} />
          <Kpi
            icon={<FiCheckCircle className="w-3.5 h-3.5" />}
            label="Connected"
            value={String(t?.connected ?? 0)}
            sub={t ? `${pct(t.connected, t.calls)} of calls` : undefined}
          />
          <Kpi
            icon={<FiClock className="w-3.5 h-3.5" />}
            label="Talk time"
            value={fmtHms(t?.talkSec ?? 0)}
          />
          <Kpi
            icon={<FiActivity className="w-3.5 h-3.5" />}
            label="Avg MOS"
            value={t?.avgMos != null ? t.avgMos.toFixed(2) : '—'}
            sub={t ? `on ${t.mosScored} scored` : undefined}
          />
          <Kpi
            icon={<FiAlertTriangle className="w-3.5 h-3.5" />}
            label="Below MOS 3"
            value={String(t?.belowMos3 ?? 0)}
            sub={t ? `${pct(t.belowMos3, t.mosScored)} of scored` : undefined}
          />
        </div>

        {/* Trend chart */}
        <div className="mt-4 h-72">
          {isLoading ? (
            <div className="flex h-full items-center justify-center text-sm text-[var(--muted-foreground)]">
              Loading…
            </div>
          ) : chartData.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-[var(--muted-foreground)]">
              No calls in this range.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="cpCalls" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--primary-500)" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="var(--primary-500)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
                <YAxis tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    background: 'var(--background)',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="Calls"
                  stroke="var(--primary-500)"
                  fill="url(#cpCalls)"
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="Connected"
                  stroke="#16a34a"
                  fill="transparent"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
