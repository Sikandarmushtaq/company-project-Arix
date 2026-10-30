'use client';

/**
 * Live Call Stats
 *
 * Summary stats cards showing active calls, inbound, outbound, on hold, peak, and online users.
 *
 * @module app/admin/live-calls/LiveCallStats
 */

import React from 'react';
import { Card, CardContent } from '@/components/ui';

export interface CallStats {
  totalActiveCalls: number;
  inboundCalls: number;
  outboundCalls: number;
  callsOnHold: number;
  avgDuration: number;
  peakCalls: number;
  peakTime: string;
}

export interface LiveCallStatsProps {
  stats: CallStats;
  onlineUsersCount: number;
}

export const LiveCallStats = React.memo(function LiveCallStats({
  stats,
  onlineUsersCount,
}: LiveCallStatsProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
      <Card>
        <CardContent className="pt-6 text-center">
          <div className="text-3xl font-bold text-[var(--foreground)]">
            {stats.totalActiveCalls}
          </div>
          <div className="text-sm text-[var(--muted-foreground)]">Active Calls</div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-6 text-center">
          <div className="text-3xl font-bold text-green-600">{stats.inboundCalls}</div>
          <div className="text-sm text-[var(--muted-foreground)]">Inbound</div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-6 text-center">
          <div className="text-3xl font-bold text-blue-600">{stats.outboundCalls}</div>
          <div className="text-sm text-[var(--muted-foreground)]">Outbound</div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-6 text-center">
          <div className="text-3xl font-bold text-orange-600">{stats.callsOnHold}</div>
          <div className="text-sm text-[var(--muted-foreground)]">On Hold</div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-6 text-center">
          <div className="text-3xl font-bold text-[var(--foreground)]">{stats.peakCalls}</div>
          <div className="text-sm text-[var(--muted-foreground)]">Peak Calls</div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-6 text-center">
          <div className="text-3xl font-bold text-[var(--foreground)]">{onlineUsersCount}</div>
          <div className="text-sm text-[var(--muted-foreground)]">Online Users</div>
        </CardContent>
      </Card>
    </div>
  );
});
