'use client';

import React from 'react';
import { FiUsers, FiPhone, FiMonitor, FiActivity, FiClock } from 'react-icons/fi';
import { Card, CardContent, CardHeader, CardTitle, ErrorState } from '@/components/ui';
import { StatCard } from '@/components/admin/dashboard';
import { useAdminStats, useAdminConnections, useAdminSessions } from '@/lib/hooks';
import { useAdminRealtimeSync } from '@/lib/hooks/useAdminRealtimeSync';

/**
 * Service status color mapping
 */
const SERVICE_STATUS_COLORS: Record<string, string> = {
  Operational: 'bg-[var(--success)]',
  Degraded: 'bg-[var(--warning)]',
  Down: 'bg-[var(--danger)]',
} as const;

/**
 * Get the appropriate color class for a service status
 */
function getStatusColor(status: string): string {
  return SERVICE_STATUS_COLORS[status] || 'bg-[var(--muted-foreground)]';
}

/**
 * Get accessible status label
 */
function getStatusLabel(status: string): string {
  switch (status) {
    case 'Operational':
      return 'Service is operational';
    case 'Degraded':
      return 'Service is experiencing issues';
    case 'Down':
      return 'Service is down';
    default:
      return 'Service status unknown';
  }
}

export default function AdminDashboard() {
  const { data: stats, isLoading, error } = useAdminStats();
  const { data: connections } = useAdminConnections();
  const { data: sessions } = useAdminSessions();

  // Enable real-time updates
  useAdminRealtimeSync();

  // Use actual data counts for accuracy (real-time updated)
  const liveConnectionsCount = connections?.length ?? stats?.activeDevices ?? 0;
  const activeSessionsCount = sessions?.total ?? stats?.activeSessions ?? 0;

  const statCards = [
    {
      title: 'Total Users',
      value: stats?.totalUsers ?? 0,
      change: stats?.activeUsers ? `${stats.activeUsers} active` : undefined,
      changeType: 'neutral' as const,
      icon: <FiUsers className="w-6 h-6 text-[var(--foreground)]" />,
    },
    {
      title: 'Active Calls',
      value: stats?.activeCalls ?? 0,
      icon: <FiPhone className="w-6 h-6 text-[var(--foreground)]" />,
    },
    {
      title: 'Live Connections',
      value: liveConnectionsCount,
      icon: <FiMonitor className="w-6 h-6 text-[var(--foreground)]" />,
    },
    {
      title: 'Active Sessions',
      value: activeSessionsCount,
      icon: <FiActivity className="w-6 h-6 text-[var(--foreground)]" />,
    },
  ];

  if (error) {
    return (
      <ErrorState
        title="Failed to load dashboard data"
        message={error instanceof Error ? error.message : 'Unknown error'}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--foreground)]">Dashboard</h1>
        <p className="text-[var(--muted-foreground)] mt-1">
          Welcome back! Here&apos;s what&apos;s happening.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat) => (
          <StatCard key={stat.title} {...stat} isLoading={isLoading} />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="flex items-center gap-4 p-3">
                    <div className="w-10 h-10 rounded-full bg-[var(--muted)] animate-pulse" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 w-24 bg-[var(--muted)] animate-pulse rounded" />
                      <div className="h-3 w-32 bg-[var(--muted)] animate-pulse rounded" />
                    </div>
                  </div>
                ))}
              </div>
            ) : stats?.recentActivity && stats.recentActivity.length > 0 ? (
              <div className="space-y-4">
                {stats.recentActivity.map((activity, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-4 p-3 rounded-lg hover:bg-[var(--muted)] transition-colors"
                  >
                    <div className="w-10 h-10 rounded-full bg-[var(--primary-100)] dark:bg-[var(--primary-900)] flex items-center justify-center">
                      <FiUsers className="w-5 h-5 text-[var(--foreground)]" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-[var(--foreground)]">
                        {activity.user}
                      </p>
                      <p className="text-sm text-[var(--muted-foreground)]">{activity.action}</p>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-[var(--muted-foreground)]">
                      <FiClock className="w-3 h-3" />
                      {activity.time}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-[var(--muted-foreground)] py-8">No recent activity</p>
            )}
          </CardContent>
        </Card>

        {/* System Status */}
        <Card>
          <CardHeader>
            <CardTitle>System Status</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between p-3 rounded-lg bg-[var(--muted)]"
                  >
                    <div className="h-4 w-24 bg-[var(--border)] animate-pulse rounded" />
                    <div className="h-4 w-16 bg-[var(--border)] animate-pulse rounded" />
                  </div>
                ))}
              </div>
            ) : stats?.systemStatus && stats.systemStatus.length > 0 ? (
              <div className="space-y-4" role="list" aria-label="System services status">
                {stats.systemStatus.map((service) => (
                  <div
                    key={service.name}
                    className="flex items-center justify-between p-3 rounded-lg bg-[var(--muted)]"
                    role="listitem"
                  >
                    <span className="font-medium text-[var(--foreground)]">{service.name}</span>
                    <div className="flex items-center gap-2">
                      <span
                        className={`w-2 h-2 rounded-full ${getStatusColor(service.status)}`}
                        aria-hidden="true"
                      />
                      <span className="text-sm text-[var(--muted-foreground)]">
                        {service.status}
                      </span>
                      <span className="sr-only">{getStatusLabel(service.status)}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-[var(--muted-foreground)] py-8">
                No system status data
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
