'use client';

/**
 * System Health Page
 *
 * Real-time system monitoring dashboard displaying CPU, memory, disk,
 * database, Redis, and WebSocket metrics with health checks.
 *
 * @module app/admin/health/page
 */

import React, { useMemo } from 'react';
import {
  FiCpu,
  FiHardDrive,
  FiActivity,
  FiServer,
  FiDatabase,
  FiWifi,
  FiRefreshCw,
  FiAlertCircle,
  FiCheckCircle,
  FiZap,
  FiGlobe,
  FiRadio,
  FiClock,
  FiEye,
  FiEyeOff,
  FiRotateCcw,
  FiBell,
  FiBellOff,
} from 'react-icons/fi';
import { Card, CardContent, CardHeader, CardTitle, Button } from '@/components/ui';
import { MetricCard, HealthCheckCard, StatusIcon } from '@/components/admin/health';
import { useAdminRealtimeSync } from '@/lib/hooks/useAdminRealtimeSync';
import { useAdminStats, useFailoverStatus, useRecordingStats, useSessionStats } from '@/lib/hooks';
import { useSystemMonitoring, useApiPerformanceMetrics, useMetricsHistory } from '@/lib/hooks';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import { formatBytes, formatUptime, getStatusColor } from '@/lib/utils/health';
import {
  getCpuColor,
  getMemoryColor,
  getDiskColor,
  CHART_HISTORY_POINTS,
} from '@/lib/constants/health';

export default function SystemHealthPage() {
  const {
    alerts,
    dismissAlert,
    restoreAlert,
    clearAllDismissedAlerts,
    showDismissedAlerts,
    toggleShowDismissedAlerts,
    dismissedAlertsCount,
    isAlertDismissed,
  } = useAdminRealtimeSync();
  const { data: adminStats } = useAdminStats();
  const { data: failover } = useFailoverStatus();
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- reserved for future dashboard enhancements
  const { data: recordingStats } = useRecordingStats();
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- reserved for future dashboard enhancements
  const { data: sessionStats } = useSessionStats();

  // Real monitoring data
  const { metrics, healthSummary, isLoading, isRealtime, refetch, lastUpdated } =
    useSystemMonitoring();
  const { data: apiMetrics } = useApiPerformanceMetrics();
  const { data: metricsHistory } = useMetricsHistory(60);

  // Process history for charts
  const chartData = useMemo(() => {
    if (!metricsHistory) return [];
    return metricsHistory.slice(-CHART_HISTORY_POINTS).map((m) => ({
      time: new Date(m.timestamp).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
      }),
      cpu: m.cpu?.usage || 0,
      memory: m.memory?.usagePercent || 0,
    }));
  }, [metricsHistory]);

  // Determine colors based on thresholds
  const cpuColor = getCpuColor(metrics?.cpu?.usage || 0);
  const memColor = getMemoryColor(metrics?.memory?.usagePercent || 0);
  const diskColor = getDiskColor(metrics?.disk?.usagePercent || 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">System Health</h1>
          <p className="text-[var(--muted-foreground)] mt-1">
            Real-time system monitoring and performance metrics
            <span className="ml-2 text-xs">
              {isRealtime ? (
                <span className="text-green-500" role="status" aria-label="Live updates active">
                  <span aria-hidden="true">●</span> Live
                </span>
              ) : (
                <span className="text-yellow-500" role="status" aria-label="Polling for updates">
                  <span aria-hidden="true">●</span> Polling
                </span>
              )}
              {' • '}Last update: {lastUpdated.toLocaleTimeString()}
            </span>
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => refetch()}
          disabled={isLoading}
          aria-label="Refresh metrics"
        >
          <FiRefreshCw
            className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`}
            aria-hidden="true"
          />
          Refresh
        </Button>
      </div>

      {/* Active Alerts Section */}
      {(alerts.length > 0 || dismissedAlertsCount > 0) && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <FiBell className="w-5 h-5" aria-hidden="true" />
                System Alerts
                {alerts.length > 0 && (
                  <span
                    className="ml-2 px-2 py-0.5 text-xs font-medium rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                    role="status"
                    aria-label={`${alerts.length} active alerts`}
                  >
                    {alerts.length} active
                  </span>
                )}
              </CardTitle>
              <div className="flex items-center gap-2">
                {dismissedAlertsCount > 0 && (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={toggleShowDismissedAlerts}
                      className="text-sm"
                      aria-expanded={showDismissedAlerts}
                      aria-label={
                        showDismissedAlerts
                          ? `Hide ${dismissedAlertsCount} dismissed alerts`
                          : `Show ${dismissedAlertsCount} dismissed alerts`
                      }
                    >
                      {showDismissedAlerts ? (
                        <>
                          <FiEyeOff className="w-4 h-4 mr-1" aria-hidden="true" />
                          Hide dismissed ({dismissedAlertsCount})
                        </>
                      ) : (
                        <>
                          <FiEye className="w-4 h-4 mr-1" aria-hidden="true" />
                          Show dismissed ({dismissedAlertsCount})
                        </>
                      )}
                    </Button>
                    {showDismissedAlerts && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={clearAllDismissedAlerts}
                        className="text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                        aria-label="Restore all dismissed alerts"
                      >
                        <FiRotateCcw className="w-4 h-4 mr-1" aria-hidden="true" />
                        Restore all
                      </Button>
                    )}
                  </>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-2" role="log" aria-label="System alerts">
            {/* Active Alerts */}
            {alerts.slice(0, 5).map((alert) => {
              const isDismissed = isAlertDismissed(alert.id);
              return (
                <div
                  key={alert.id}
                  className={`p-4 rounded-lg flex items-start justify-between transition-opacity ${
                    isDismissed ? 'opacity-50' : ''
                  } ${
                    alert.type === 'error'
                      ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                      : alert.type === 'warning'
                        ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300'
                        : alert.type === 'success'
                          ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                          : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                  }`}
                  role="alert"
                >
                  <div className="flex items-start gap-3">
                    <FiAlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" aria-hidden="true" />
                    <div>
                      <div className="font-semibold flex items-center gap-2">
                        {alert.title}
                        {isDismissed && (
                          <span className="text-xs font-normal opacity-70">(dismissed)</span>
                        )}
                      </div>
                      <div className="text-sm opacity-80">{alert.message}</div>
                      {alert.timestamp && (
                        <div className="text-xs opacity-60 mt-1">
                          <time dateTime={new Date(alert.timestamp).toISOString()}>
                            {new Date(alert.timestamp).toLocaleString()}
                          </time>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {isDismissed ? (
                      <button
                        onClick={() => restoreAlert(alert.id)}
                        className="p-1.5 rounded hover:bg-[var(--muted)] transition-colors"
                        aria-label={`Restore alert: ${alert.title}`}
                      >
                        <FiRotateCcw className="w-4 h-4" aria-hidden="true" />
                      </button>
                    ) : (
                      <button
                        onClick={() => dismissAlert(alert.id)}
                        className="p-1.5 rounded hover:bg-[var(--muted)] transition-colors"
                        aria-label={`Dismiss alert for 24 hours: ${alert.title}`}
                      >
                        <FiBellOff className="w-4 h-4" aria-hidden="true" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}

            {/* No alerts message */}
            {alerts.length === 0 && dismissedAlertsCount === 0 && (
              <div className="text-center py-4 text-[var(--muted-foreground)]" role="status">
                <FiCheckCircle className="w-8 h-8 mx-auto mb-2 text-green-500" aria-hidden="true" />
                <p>No active alerts</p>
              </div>
            )}

            {/* All active dismissed message */}
            {alerts.length === 0 && dismissedAlertsCount > 0 && !showDismissedAlerts && (
              <div className="text-center py-4 text-[var(--muted-foreground)]" role="status">
                <FiBellOff className="w-8 h-8 mx-auto mb-2 opacity-50" aria-hidden="true" />
                <p className="text-sm">All alerts dismissed ({dismissedAlertsCount} hidden)</p>
                <button
                  onClick={toggleShowDismissedAlerts}
                  className="text-sm text-blue-500 hover:underline mt-1"
                >
                  Show dismissed alerts
                </button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Overall Health Status */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              {healthSummary && <StatusIcon status={healthSummary.status} />}
              <div>
                <div
                  className={`text-2xl font-bold capitalize ${getStatusColor(
                    healthSummary?.status || 'healthy'
                  )}`}
                  role="status"
                  aria-label={`System status: ${healthSummary?.status || 'Loading'}`}
                >
                  System {healthSummary?.status || 'Loading...'}
                </div>
                <div className="text-[var(--muted-foreground)]">
                  {healthSummary?.checks.filter((c) => c.status === 'healthy').length || 0}/
                  {healthSummary?.checks.length || 0} checks passing
                </div>
              </div>
            </div>
            <div
              className="flex items-center gap-8 text-center flex-wrap"
              role="group"
              aria-label="System statistics"
            >
              <div>
                <div className="text-2xl font-bold text-[var(--foreground)]">
                  {metrics?.uptime ? formatUptime(metrics.uptime) : '-'}
                </div>
                <div className="text-sm text-[var(--muted-foreground)]">System Uptime</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-[var(--foreground)]">
                  {metrics?.process?.uptime ? formatUptime(metrics.process.uptime) : '-'}
                </div>
                <div className="text-sm text-[var(--muted-foreground)]">Process Uptime</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-[var(--foreground)]">
                  {metrics?.websocket?.totalConnections || 0}
                </div>
                <div className="text-sm text-[var(--muted-foreground)]">WebSocket Clients</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-[var(--foreground)]">
                  {adminStats?.activeSessions || 0}
                </div>
                <div className="text-sm text-[var(--muted-foreground)]">Active Sessions</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Resource Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          icon={FiCpu}
          title="CPU Usage"
          value={`${(metrics?.cpu?.usage || 0).toFixed(1)}%`}
          progress={{ value: metrics?.cpu?.usage || 0, max: 100 }}
          progressColor={cpuColor}
          subtitle={`${metrics?.cpu?.cores || 0} cores • ${
            metrics?.cpu?.model?.substring(0, 30) || 'Unknown'
          }`}
        />
        <MetricCard
          icon={FiZap}
          title="Memory Usage"
          value={`${(metrics?.memory?.usagePercent || 0).toFixed(1)}%`}
          progress={{ value: metrics?.memory?.usagePercent || 0, max: 100 }}
          progressColor={memColor}
          subtitle={`${formatBytes(metrics?.memory?.used || 0)} / ${formatBytes(
            metrics?.memory?.total || 0
          )}`}
        />
        <MetricCard
          icon={FiHardDrive}
          title="Disk Usage"
          value={`${(metrics?.disk?.usagePercent || 0).toFixed(1)}%`}
          progress={{ value: metrics?.disk?.usagePercent || 0, max: 100 }}
          progressColor={diskColor}
          subtitle={`${formatBytes(metrics?.disk?.used || 0)} / ${formatBytes(
            metrics?.disk?.total || 0
          )}`}
        />
        <MetricCard
          icon={FiGlobe}
          title="API Performance"
          value={`${apiMetrics?.averageResponseTime || 0}ms`}
          subtitle={`${apiMetrics?.requestsPerMinute || 0} req/min • ${
            apiMetrics?.errorRate || 0
          }% errors`}
        />
      </div>

      {/* CPU & Memory Chart */}
      {chartData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FiActivity className="w-5 h-5" aria-hidden="true" />
              Resource Usage History (Last 30 minutes)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className="h-64"
              role="img"
              aria-label="CPU and memory usage chart over the last 30 minutes"
            >
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="time" stroke="var(--muted-foreground)" fontSize={12} />
                  <YAxis
                    stroke="var(--muted-foreground)"
                    fontSize={12}
                    domain={[0, 100]}
                    tickFormatter={(v) => `${v}%`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--card)',
                      border: '1px solid var(--border)',
                      borderRadius: '8px',
                    }}
                    formatter={(value) => [`${Number(value ?? 0).toFixed(1)}%`]}
                  />
                  <Area
                    type="monotone"
                    dataKey="cpu"
                    name="CPU"
                    stroke="#3b82f6"
                    fill="#3b82f6"
                    fillOpacity={0.2}
                  />
                  <Area
                    type="monotone"
                    dataKey="memory"
                    name="Memory"
                    stroke="#10b981"
                    fill="#10b981"
                    fillOpacity={0.2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Health Checks */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FiServer className="w-5 h-5" aria-hidden="true" />
            Service Health Checks
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {healthSummary?.checks.map((check) => (
              <HealthCheckCard key={check.name} check={check} />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Connection Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Database */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FiDatabase className="w-5 h-5" aria-hidden="true" />
              Database
            </CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-4">
              <div className="flex items-center justify-between">
                <dt className="text-[var(--muted-foreground)]">Status</dt>
                <dd
                  className={`font-semibold capitalize ${getStatusColor(
                    metrics?.database?.status || 'healthy'
                  )}`}
                >
                  <span className="sr-only">Database status: </span>
                  {metrics?.database?.status || '-'}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-[var(--muted-foreground)]">Latency</dt>
                <dd className="font-semibold text-[var(--foreground)]">
                  {metrics?.database?.latency || 0}ms
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-[var(--muted-foreground)]">Active Connections</dt>
                <dd className="font-semibold text-[var(--foreground)]">
                  {metrics?.database?.connectionPool?.active || 0}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-[var(--muted-foreground)]">Pool Size</dt>
                <dd className="font-semibold text-[var(--foreground)]">
                  {metrics?.database?.connectionPool?.total || 0}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        {/* Redis */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FiRadio className="w-5 h-5" aria-hidden="true" />
              Redis Cache
            </CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-4">
              <div className="flex items-center justify-between">
                <dt className="text-[var(--muted-foreground)]">Status</dt>
                <dd
                  className={`font-semibold capitalize ${getStatusColor(
                    metrics?.redis?.status || 'healthy'
                  )}`}
                >
                  <span className="sr-only">Redis status: </span>
                  {metrics?.redis?.status || '-'}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-[var(--muted-foreground)]">Latency</dt>
                <dd className="font-semibold text-[var(--foreground)]">
                  {metrics?.redis?.latency || 0}ms
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-[var(--muted-foreground)]">Memory Used</dt>
                <dd className="font-semibold text-[var(--foreground)]">
                  {metrics?.redis?.usedMemory || 'N/A'}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-[var(--muted-foreground)]">Connected Clients</dt>
                <dd className="font-semibold text-[var(--foreground)]">
                  {metrics?.redis?.connectedClients || 0}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        {/* WebSocket */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FiWifi className="w-5 h-5" aria-hidden="true" />
              WebSocket Server
            </CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-4">
              <div className="flex justify-between">
                <dt className="text-[var(--muted-foreground)]">Total Connections</dt>
                <dd className="font-semibold text-[var(--foreground)]">
                  {metrics?.websocket?.totalConnections || 0}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-[var(--muted-foreground)]">Admin Connections</dt>
                <dd className="font-semibold text-[var(--foreground)]">
                  {metrics?.websocket?.adminConnections || 0}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-[var(--muted-foreground)]">User Connections</dt>
                <dd className="font-semibold text-[var(--foreground)]">
                  {metrics?.websocket?.userConnections || 0}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      </div>

      {/* Process Metrics */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FiClock className="w-5 h-5" aria-hidden="true" />
            Process Metrics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            <div>
              <dt className="text-sm text-[var(--muted-foreground)]">PID</dt>
              <dd className="font-semibold text-[var(--foreground)]">
                {metrics?.process?.pid || '-'}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-[var(--muted-foreground)]">Heap Used</dt>
              <dd className="font-semibold text-[var(--foreground)]">
                {formatBytes(metrics?.process?.memoryUsage?.heapUsed || 0)}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-[var(--muted-foreground)]">Heap Total</dt>
              <dd className="font-semibold text-[var(--foreground)]">
                {formatBytes(metrics?.process?.memoryUsage?.heapTotal || 0)}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-[var(--muted-foreground)]">RSS</dt>
              <dd className="font-semibold text-[var(--foreground)]">
                {formatBytes(metrics?.process?.memoryUsage?.rss || 0)}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-[var(--muted-foreground)]">External</dt>
              <dd className="font-semibold text-[var(--foreground)]">
                {formatBytes(metrics?.process?.memoryUsage?.external || 0)}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-[var(--muted-foreground)]">CPU Time</dt>
              <dd className="font-semibold text-[var(--foreground)]">
                {(
                  (metrics?.process?.cpuUsage?.user || 0) +
                  (metrics?.process?.cpuUsage?.system || 0)
                ).toFixed(2)}
                s
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      {/* API Performance */}
      {apiMetrics && apiMetrics.endpointStats && apiMetrics.endpointStats.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FiGlobe className="w-5 h-5" aria-hidden="true" />
              Top API Endpoints (Last Minute)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full" role="table" aria-label="API endpoint statistics">
                <thead>
                  <tr className="border-b border-[var(--border)]">
                    <th
                      scope="col"
                      className="text-left py-2 px-4 text-sm font-medium text-[var(--muted-foreground)]"
                    >
                      Endpoint
                    </th>
                    <th
                      scope="col"
                      className="text-left py-2 px-4 text-sm font-medium text-[var(--muted-foreground)]"
                    >
                      Method
                    </th>
                    <th
                      scope="col"
                      className="text-right py-2 px-4 text-sm font-medium text-[var(--muted-foreground)]"
                    >
                      Requests
                    </th>
                    <th
                      scope="col"
                      className="text-right py-2 px-4 text-sm font-medium text-[var(--muted-foreground)]"
                    >
                      Avg Time
                    </th>
                    <th
                      scope="col"
                      className="text-right py-2 px-4 text-sm font-medium text-[var(--muted-foreground)]"
                    >
                      Errors
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {apiMetrics.endpointStats.map((stat, i) => (
                    <tr key={i} className="border-b border-[var(--border)] last:border-0">
                      <td className="py-2 px-4 font-mono text-sm">{stat.endpoint}</td>
                      <td className="py-2 px-4">
                        <span
                          className={`px-2 py-0.5 rounded text-xs font-medium ${
                            stat.method === 'GET'
                              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                              : stat.method === 'POST'
                                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                                : stat.method === 'PUT'
                                  ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                                  : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                          }`}
                        >
                          {stat.method}
                        </span>
                      </td>
                      <td className="py-2 px-4 text-right">{stat.requests}</td>
                      <td className="py-2 px-4 text-right">{stat.avgResponseTime.toFixed(0)}ms</td>
                      <td className="py-2 px-4 text-right">
                        <span className={stat.errorCount > 0 ? 'text-red-500' : 'text-green-500'}>
                          {stat.errorCount}
                          <span className="sr-only">
                            {stat.errorCount === 0 ? ' (no errors)' : ' errors'}
                          </span>
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Failover Status */}
      {failover && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FiRefreshCw className="w-5 h-5" aria-hidden="true" />
              Failover Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <dt className="text-sm text-[var(--muted-foreground)]">Active Server</dt>
                <dd className="font-semibold text-[var(--foreground)] capitalize">
                  {failover.activeServer}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-[var(--muted-foreground)]">Users on Primary</dt>
                <dd className="font-semibold text-[var(--foreground)]">
                  {failover.usersOnPrimary}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-[var(--muted-foreground)]">Users on Backup</dt>
                <dd className="font-semibold text-[var(--foreground)]">{failover.usersOnBackup}</dd>
              </div>
              <div>
                <dt className="text-sm text-[var(--muted-foreground)]">Last Failover</dt>
                <dd className="font-semibold text-[var(--foreground)]">
                  {failover.lastFailover ? (
                    <time dateTime={new Date(failover.lastFailover).toISOString()}>
                      {new Date(failover.lastFailover).toLocaleString()}
                    </time>
                  ) : (
                    'Never'
                  )}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
