'use client';

/**
 * Analytics Dashboard — Professional Admin View
 *
 * Displays communication metrics: calls, SMS, user activity, campaigns.
 * Data source: backend analytics API querying call_records + sms_messages.
 * Org-scoped: admins see all, managers see their org only.
 *
 * @module app/admin/analytics/page
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
  FiPhone,
  FiMessageSquare,
  FiUsers,
  FiActivity,
  FiRefreshCw,
  FiCalendar,
  FiTrendingUp,
  FiPhoneIncoming,
  FiPhoneOutgoing,
  FiPhoneMissed,
} from 'react-icons/fi';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import {
  useAnalyticsOverview,
  useTimeSeriesData,
  useCallAnalytics,
  useSmsAnalytics,
  useUserAnalytics,
  useWhatsAppCallAnalytics,
} from '@/lib/hooks';
import { FaWhatsapp } from 'react-icons/fa';
import { formatPhoneNumber } from '@/lib/utils/phone';
import { CallPerformance } from './CallPerformance';
import { AgentLeaderboard } from './AgentLeaderboard';

// ============================================================================
// Constants
// ============================================================================

const CHART_COLORS = {
  primary: '#3b82f6',
  secondary: '#10b981',
  warning: '#f59e0b',
  danger: '#ef4444',
  purple: '#8b5cf6',
  pink: '#ec4899',
  slate: '#64748b',
};

const PIE_COLORS = [
  CHART_COLORS.secondary,
  CHART_COLORS.danger,
  CHART_COLORS.warning,
  CHART_COLORS.slate,
];
const SMS_COLORS = [CHART_COLORS.primary, CHART_COLORS.secondary, CHART_COLORS.danger];

const TIME_RANGES = [
  { label: '7 Days', value: 7 },
  { label: '14 Days', value: 14 },
  { label: '30 Days', value: 30 },
  { label: '90 Days', value: 90 },
];

// ============================================================================
// Page
// ============================================================================

export default function AnalyticsPage() {
  const [timeRange, setTimeRange] = useState(30);

  // All data sources use the same timeRange — stat cards, charts, and tables
  // all reflect the selected period. No separate overview endpoint.
  const {
    data: callAnalytics,
    isLoading: callLoading,
    refetch: refetchCalls,
  } = useCallAnalytics(timeRange);
  const { data: smsAnalytics, isLoading: smsLoading } = useSmsAnalytics(timeRange);
  const { data: timeSeries, isLoading: timeSeriesLoading } = useTimeSeriesData(timeRange);
  const { data: userAnalytics, isLoading: userLoading } = useUserAnalytics(timeRange);
  // Overview is always 30-day (for campaigns which don't support timeRange yet)
  const { data: overview, isLoading: overviewLoading } = useAnalyticsOverview();
  const { data: waCallAnalytics, isLoading: waCallLoading } = useWhatsAppCallAnalytics(timeRange);

  const isLoading = callLoading || smsLoading || timeSeriesLoading || userLoading;

  // ---- Data transformations (force numbers, handle edge cases) ----

  const combinedTimeSeries = useMemo(() => {
    if (!timeSeries) return [];
    return timeSeries.calls.map((point, index) => ({
      date: new Date(point.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      Calls: Number(point.value) || 0,
      SMS: Number(timeSeries.sms[index]?.value) || 0,
      Signups: Number(timeSeries.signups[index]?.value) || 0,
    }));
  }, [timeSeries]);

  const callDispositionData = useMemo(() => {
    if (!callAnalytics?.stats) return [];
    const items = [
      { name: 'Answered', value: Number(callAnalytics.stats.answered) || 0 },
      { name: 'Missed', value: Number(callAnalytics.stats.missed) || 0 },
      { name: 'Other', value: Number(callAnalytics.stats.voicemail) || 0 },
    ];
    return items.filter((d) => d.value > 0);
  }, [callAnalytics]);

  const callTotal = useMemo(
    () => callDispositionData.reduce((sum, d) => sum + d.value, 0),
    [callDispositionData]
  );

  const smsBreakdownData = useMemo(() => {
    if (!smsAnalytics?.stats) return [];
    return [
      { name: 'Sent', value: Number(smsAnalytics.stats.sent) || 0 },
      { name: 'Received', value: Number(smsAnalytics.stats.received) || 0 },
      { name: 'Failed', value: Number(smsAnalytics.stats.failed) || 0 },
    ].filter((d) => d.value > 0);
  }, [smsAnalytics]);

  const smsTotal = useMemo(
    () => smsBreakdownData.reduce((sum, d) => sum + d.value, 0),
    [smsBreakdownData]
  );

  const hourlyData = useMemo(() => {
    if (!callAnalytics?.hourly) return [];
    return callAnalytics.hourly.map((h) => ({
      hour: `${h.hour.toString().padStart(2, '0')}:00`,
      Calls: Number(h.value) || 0,
    }));
  }, [callAnalytics]);

  const handleRefresh = useCallback(() => refetchCalls(), [refetchCalls]);

  // ---- Render ----

  return (
    <div className="space-y-6 p-1">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold">Analytics</h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">
            Communication metrics across your organization
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center bg-[var(--card)] border rounded-lg p-1">
            <FiCalendar className="w-4 h-4 text-[var(--muted-foreground)] ml-2 mr-1" />
            {TIME_RANGES.map((r) => (
              <button
                key={r.value}
                onClick={() => setTimeRange(r.value)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  timeRange === r.value
                    ? 'bg-blue-600 text-white'
                    : 'text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)]'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
          <button
            onClick={handleRefresh}
            disabled={isLoading}
            className="p-2 bg-[var(--card)] border rounded-lg hover:bg-[var(--muted)] transition-colors disabled:opacity-50"
            aria-label="Refresh"
          >
            <FiRefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Stat Cards — derived from time-range-aware call/SMS analytics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<FiPhone className="w-5 h-5" />}
          label={`Calls (${timeRange}d)`}
          value={Number(callAnalytics?.stats.total) || 0}
          detail={`${Number(callAnalytics?.stats.answered) || 0} answered`}
          color="blue"
          loading={callLoading}
        />
        <StatCard
          icon={<FiMessageSquare className="w-5 h-5" />}
          label={`SMS (${timeRange}d)`}
          value={Number(smsAnalytics?.stats.total) || 0}
          detail={`${Number(smsAnalytics?.stats.sent) || 0} sent · ${Number(smsAnalytics?.stats.received) || 0} received`}
          color="green"
          loading={smsLoading}
        />
        <StatCard
          icon={<FiUsers className="w-5 h-5" />}
          label="Active Users"
          value={Number(userAnalytics?.stats.activeToday) || 0}
          detail={`${Number(userAnalytics?.stats.total) || 0} total`}
          color="purple"
          loading={userLoading}
        />
        <StatCard
          icon={<FiActivity className="w-5 h-5" />}
          label="Campaigns"
          value={Number(overview?.campaigns.active) || 0}
          detail={`${Number(overview?.campaigns.totalCalls) || 0} AI calls · ${Number(overview?.campaigns.successRate) || 0}% success`}
          color="amber"
          loading={overviewLoading}
        />
      </div>

      {/* CDR-backed call performance — accurate volume + MOS, per-agent, day/week/month */}
      <CallPerformance />

      {/* Per-agent leaderboard (Phase 3) */}
      <AgentLeaderboard />

      {/* Activity Trend + Call Disposition */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Activity Trend (2/3 width) */}
        <ChartCard
          title="Activity Trend"
          subtitle={`Last ${timeRange} days`}
          className="lg:col-span-2"
        >
          {timeSeriesLoading ? (
            <ChartSkeleton />
          ) : combinedTimeSeries.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={combinedTimeSeries}>
                <defs>
                  <linearGradient id="gradCalls" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={CHART_COLORS.primary} stopOpacity={0.2} />
                    <stop offset="95%" stopColor={CHART_COLORS.primary} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradSms" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={CHART_COLORS.secondary} stopOpacity={0.2} />
                    <stop offset="95%" stopColor={CHART_COLORS.secondary} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis
                  dataKey="date"
                  stroke="var(--muted-foreground)"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke="var(--muted-foreground)"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  width={40}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--card)',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Area
                  type="monotone"
                  dataKey="Calls"
                  stroke={CHART_COLORS.primary}
                  strokeWidth={2}
                  fill="url(#gradCalls)"
                />
                <Area
                  type="monotone"
                  dataKey="SMS"
                  stroke={CHART_COLORS.secondary}
                  strokeWidth={2}
                  fill="url(#gradSms)"
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState message="No activity data for this period" />
          )}
        </ChartCard>

        {/* Call Disposition (1/3 width) */}
        <ChartCard title="Call Breakdown" subtitle={`Last ${timeRange} days`}>
          {callLoading ? (
            <ChartSkeleton height={280} />
          ) : callDispositionData.length > 0 ? (
            <div>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie
                    data={callDispositionData}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={75}
                    paddingAngle={3}
                    dataKey="value"
                    strokeWidth={0}
                  >
                    {callDispositionData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--card)',
                      border: '1px solid var(--border)',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                    formatter={(value) => [Number(value).toLocaleString(), '']}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2 mt-2">
                {callDispositionData.map((item, i) => {
                  const pct = callTotal > 0 ? Math.round((item.value / callTotal) * 100) : 0;
                  return (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }}
                        />
                        <span className="text-[var(--muted-foreground)]">{item.name}</span>
                      </div>
                      <span className="font-medium">
                        {item.value.toLocaleString()}{' '}
                        <span className="text-[var(--muted-foreground)] font-normal">({pct}%)</span>
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <EmptyState message="No call data" />
          )}
        </ChartCard>
      </div>

      {/* Hourly Distribution + SMS Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Hourly Distribution */}
        <ChartCard
          title="Peak Hours"
          subtitle={`Call volume by hour (last ${timeRange} days)`}
          className="lg:col-span-2"
        >
          {callLoading ? (
            <ChartSkeleton height={220} />
          ) : hourlyData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={hourlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis
                  dataKey="hour"
                  stroke="var(--muted-foreground)"
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                  interval={2}
                />
                <YAxis
                  stroke="var(--muted-foreground)"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  width={35}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--card)',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                />
                <Bar
                  dataKey="Calls"
                  fill={CHART_COLORS.primary}
                  radius={[4, 4, 0, 0]}
                  maxBarSize={20}
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState message="No hourly data" />
          )}
        </ChartCard>

        {/* SMS Breakdown */}
        <ChartCard title="SMS Breakdown" subtitle="Message distribution">
          {smsLoading ? (
            <ChartSkeleton height={220} />
          ) : smsBreakdownData.length > 0 ? (
            <div className="space-y-4 pt-2">
              {smsBreakdownData.map((item, i) => {
                const pct = smsTotal > 0 ? Math.round((item.value / smsTotal) * 100) : 0;
                return (
                  <div key={i}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm text-[var(--foreground)]">{item.name}</span>
                      <span className="text-sm font-medium">
                        {item.value.toLocaleString()}{' '}
                        <span className="text-[var(--muted-foreground)] font-normal">({pct}%)</span>
                      </span>
                    </div>
                    <div className="h-2.5 bg-[var(--muted)] rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{
                          width: `${pct}%`,
                          backgroundColor: SMS_COLORS[i % SMS_COLORS.length],
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState message="No SMS data" />
          )}
        </ChartCard>
      </div>

      {/* User Growth + Top Callers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* User Growth */}
        <ChartCard title="Users" subtitle="Growth and activity">
          {userLoading ? (
            <ChartSkeleton height={150} />
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <MiniStat
                label="Total"
                value={Number(userAnalytics?.stats.total) || 0}
                color="bg-[var(--muted)]"
              />
              <MiniStat
                label="Active Today"
                value={Number(userAnalytics?.stats.activeToday) || 0}
                color="bg-[var(--muted)]"
              />
              <MiniStat
                label="New This Week"
                value={Number(userAnalytics?.stats.newThisWeek) || 0}
                color="bg-green-500/10"
                prefix="+"
                valueColor="text-green-600 dark:text-green-400"
              />
              <MiniStat
                label="New This Month"
                value={Number(userAnalytics?.stats.newThisMonth) || 0}
                color="bg-blue-500/10"
                prefix="+"
                valueColor="text-blue-600 dark:text-blue-400"
              />
            </div>
          )}
        </ChartCard>

        {/* Top Callers */}
        <ChartCard title="Top Callers" subtitle={`Most active by call volume (${timeRange} days)`}>
          {userLoading ? (
            <ChartSkeleton height={150} />
          ) : userAnalytics?.topCallers && userAnalytics.topCallers.length > 0 ? (
            <div className="space-y-2">
              {userAnalytics.topCallers.slice(0, 5).map((caller, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-[var(--muted)] transition-colors"
                >
                  <span className="w-6 h-6 flex items-center justify-center bg-[var(--primary)] text-white text-[10px] font-bold rounded-full shrink-0">
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {caller.name || formatPhoneNumber(caller.phone)}
                    </p>
                    {caller.name && (
                      <p className="text-xs text-[var(--muted-foreground)]">
                        {formatPhoneNumber(caller.phone)}
                      </p>
                    )}
                  </div>
                  <span className="text-sm font-semibold shrink-0">
                    {Number(caller.count).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState message="No caller data" />
          )}
        </ChartCard>
      </div>

      {/* WhatsApp Call Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <ChartCard title="WhatsApp Calls" subtitle={`Call metrics (${timeRange}d)`}>
          {waCallLoading ? (
            <ChartSkeleton height={200} />
          ) : waCallAnalytics?.stats ? (
            <>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-4">
                <MiniStat
                  label="Total"
                  value={Number(waCallAnalytics.stats.total)}
                  color="bg-green-500/10"
                  valueColor="text-green-600 dark:text-green-400"
                />
                <MiniStat
                  label="Inbound"
                  value={Number(waCallAnalytics.stats.inbound)}
                  color="bg-blue-500/10"
                  valueColor="text-blue-600 dark:text-blue-400"
                />
                <MiniStat
                  label="Outbound"
                  value={Number(waCallAnalytics.stats.outbound)}
                  color="bg-purple-500/10"
                  valueColor="text-purple-600 dark:text-purple-400"
                />
                <MiniStat
                  label="Answered"
                  value={Number(waCallAnalytics.stats.answered)}
                  color="bg-emerald-500/10"
                  valueColor="text-emerald-600 dark:text-emerald-400"
                />
                <MiniStat
                  label="Missed"
                  value={Number(waCallAnalytics.stats.missed)}
                  color="bg-red-500/10"
                  valueColor="text-red-600 dark:text-red-400"
                />
                <MiniStat
                  label="Avg Duration"
                  value={Number(waCallAnalytics.stats.avgDuration)}
                  suffix="s"
                  color="bg-amber-500/10"
                  valueColor="text-amber-600 dark:text-amber-400"
                />
              </div>
              {waCallAnalytics.timeSeries?.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart
                    data={waCallAnalytics.timeSeries.map((p) => ({
                      date: new Date(p.date).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                      }),
                      Calls: Number(p.value) || 0,
                    }))}
                  >
                    <defs>
                      <linearGradient id="waCallGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 11 }}
                      stroke="var(--muted-foreground)"
                    />
                    <YAxis
                      tick={{ fontSize: 11 }}
                      stroke="var(--muted-foreground)"
                      allowDecimals={false}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'var(--card)',
                        border: '1px solid var(--border)',
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="Calls"
                      stroke="#22c55e"
                      fill="url(#waCallGradient)"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <EmptyState message="No WhatsApp call data" />
              )}
            </>
          ) : (
            <EmptyState message="No WhatsApp call data" />
          )}
        </ChartCard>

        <ChartCard title="WA Call Hours" subtitle={`Peak calling hours (${timeRange}d)`}>
          {waCallLoading ? (
            <ChartSkeleton height={250} />
          ) : waCallAnalytics?.hourly?.length ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart
                data={waCallAnalytics.hourly.map((h) => ({
                  hour: `${h.hour}:00`,
                  Calls: Number(h.value) || 0,
                }))}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis
                  dataKey="hour"
                  tick={{ fontSize: 10 }}
                  stroke="var(--muted-foreground)"
                  interval={2}
                />
                <YAxis
                  tick={{ fontSize: 11 }}
                  stroke="var(--muted-foreground)"
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--card)',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="Calls" fill="#22c55e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState message="No hourly data" />
          )}
        </ChartCard>
      </div>

      {/* Campaign Performance (conditional) */}
      {overview?.campaigns &&
        (Number(overview.campaigns.active) > 0 || Number(overview.campaigns.completed) > 0) && (
          <ChartCard title="Campaign Performance" subtitle="Auto-dialer metrics">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <MiniStat
                label="Active"
                value={Number(overview.campaigns.active)}
                color="bg-green-500/10"
                valueColor="text-green-600 dark:text-green-400"
              />
              <MiniStat
                label="Completed"
                value={Number(overview.campaigns.completed)}
                color="bg-blue-500/10"
                valueColor="text-blue-600 dark:text-blue-400"
              />
              <MiniStat
                label="Total Calls"
                value={Number(overview.campaigns.totalCalls)}
                color="bg-purple-500/10"
                valueColor="text-purple-600 dark:text-purple-400"
              />
              <MiniStat
                label="Success Rate"
                value={Number(overview.campaigns.successRate)}
                suffix="%"
                color="bg-amber-500/10"
                valueColor="text-amber-600 dark:text-amber-400"
              />
            </div>
          </ChartCard>
        )}
    </div>
  );
}

// ============================================================================
// Shared Components
// ============================================================================

function ChartCard({
  title,
  subtitle,
  children,
  className = '',
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`bg-[var(--card)] rounded-xl p-5 border border-[var(--border)] ${className}`}>
      <div className="mb-4">
        <h2 className="text-base font-semibold">{title}</h2>
        {subtitle && <p className="text-xs text-[var(--muted-foreground)] mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  detail,
  color,
  loading,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  detail: string;
  color: 'blue' | 'green' | 'purple' | 'amber';
  loading?: boolean;
}) {
  const bg: Record<string, string> = {
    blue: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
    green: 'bg-green-500/10 text-green-600 dark:text-green-400',
    purple: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
    amber: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  };

  return (
    <div className="bg-[var(--card)] rounded-xl p-4 border border-[var(--border)]">
      <div className={`inline-flex p-2 rounded-lg ${bg[color]}`}>{icon}</div>
      <div className="mt-3">
        {loading ? (
          <div className="h-7 w-20 bg-[var(--muted)] rounded animate-pulse" />
        ) : (
          <p className="text-2xl font-bold">{value.toLocaleString()}</p>
        )}
        <p className="text-xs text-[var(--muted-foreground)] mt-1">{label}</p>
        <p className="text-[10px] text-[var(--muted-foreground)] mt-0.5">{detail}</p>
      </div>
    </div>
  );
}

function MiniStat({
  label,
  value,
  color,
  prefix = '',
  suffix = '',
  valueColor = '',
}: {
  label: string;
  value: number;
  color: string;
  prefix?: string;
  suffix?: string;
  valueColor?: string;
}) {
  return (
    <div className={`p-3 rounded-lg ${color}`}>
      <p className="text-xs text-[var(--muted-foreground)]">{label}</p>
      <p className={`text-xl font-bold mt-0.5 ${valueColor}`}>
        {prefix}
        {value.toLocaleString()}
        {suffix}
      </p>
    </div>
  );
}

function ChartSkeleton({ height = 300 }: { height?: number }) {
  return (
    <div className="flex items-center justify-center" style={{ height }}>
      <div className="animate-spin rounded-full h-6 w-6 border-2 border-[var(--primary)] border-t-transparent" />
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="h-[200px] flex items-center justify-center text-sm text-[var(--muted-foreground)]">
      {message}
    </div>
  );
}
