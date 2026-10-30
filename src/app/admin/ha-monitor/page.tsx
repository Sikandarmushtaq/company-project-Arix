'use client';

import React, { useState } from 'react';
import {
  FiRefreshCw,
  FiAlertCircle,
  FiLoader,
  FiWifi,
  FiWifiOff,
  FiServer,
  FiActivity,
} from 'react-icons/fi';
import { Card, CardContent, CardHeader, CardTitle, Button } from '@/components/ui';
import { StatCard } from '@/components/admin/dashboard';
import { useHAMonitoring, useTestConnectivity } from '@/lib/hooks';
import {
  HATopologyMap,
  FailoverControlPanel,
  ServerHealthCard,
  HAEventLog,
  TroubleshootingPanel,
} from '@/components/admin/ha-monitor';
import type { HAClusterState } from '@/lib/api/services/ha.service';

// ---------------------------------------------------------------------------
// Server Management grid — unified health + controls per server
// ---------------------------------------------------------------------------

function ServerManagement({ status }: { status: HAClusterState }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {/* Kamailio */}
      <ServerHealthCard
        server={{ ...status.kamailio.primary, type: 'kamailio' }}
        serverId="kamailio-primary"
      />
      <ServerHealthCard
        server={{ ...status.kamailio.secondary, type: 'kamailio' }}
        serverId="kamailio-secondary"
      />

      {/* FusionPBX */}
      <ServerHealthCard
        server={{ ...status.fusionpbx.primary, type: 'fusionpbx' }}
        serverId="fusionpbx-primary"
      />
      <ServerHealthCard
        server={{ ...status.fusionpbx.secondary, type: 'fusionpbx' }}
        serverId="fusionpbx-secondary"
      />

      {/* PostgreSQL (no inline controls — managed via Patroni switchover in Cluster Controls) */}
      <ServerHealthCard server={{ ...status.postgresql.primary, type: 'postgresql' }} />
      <ServerHealthCard server={{ ...status.postgresql.secondary, type: 'postgresql' }} />

      {/* Monitor */}
      <ServerHealthCard server={{ ...status.monitor, type: 'monitor' }} serverId="monitor" />

      {/* Backup Monitor */}
      <ServerHealthCard server={{ ...status.bkpserver, type: 'bkpserver' }} serverId="bkpserver" />

      {/* API Gateway */}
      <ServerHealthCard
        server={{ ...status.apigateway, type: 'apigateway' }}
        serverId="apigateway"
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function HAMonitorPage() {
  const { status, events, isLoading, isError, error, isRealtime, refetch } = useHAMonitoring();
  const testConnectivity = useTestConnectivity();
  const [isAnimatingTest, setIsAnimatingTest] = useState(false);

  const handleTestConnectivity = () => {
    setIsAnimatingTest(true);
    testConnectivity.mutate();
  };

  const handleTestAnimationComplete = () => {
    setTimeout(() => setIsAnimatingTest(false), 2000);
  };

  const handleRefresh = async () => {
    await refetch();
  };

  const handleServerClick = (serverId: string) => {
    console.log('Selected server:', serverId);
  };

  if (isError) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <FiAlertCircle className="w-12 h-12 text-[var(--danger)] mx-auto mb-4" />
          <p className="text-[var(--danger)]">Failed to load HA status</p>
          <p className="text-sm text-[var(--muted-foreground)] mt-2">
            {error instanceof Error ? error.message : 'Unknown error'}
          </p>
          <Button variant="outline" onClick={handleRefresh} className="mt-4">
            <FiRefreshCw className="w-4 h-4" />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">HA Network Monitor</h1>
          <p className="text-[var(--muted-foreground)] mt-1">
            Real-time infrastructure monitoring and failover controls
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Real-time indicator */}
          <div
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm ${
              isRealtime
                ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
                : 'bg-gray-100 dark:bg-gray-900/30 text-gray-600 dark:text-gray-400'
            }`}
          >
            {isRealtime ? (
              <>
                <FiWifi className="w-4 h-4" />
                Live
              </>
            ) : (
              <>
                <FiWifiOff className="w-4 h-4" />
                Polling
              </>
            )}
          </div>

          <Button variant="outline" onClick={handleRefresh} disabled={isLoading}>
            <FiRefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>

          <Button
            variant="outline"
            onClick={handleTestConnectivity}
            disabled={testConnectivity.isPending || isAnimatingTest}
          >
            <FiActivity
              className={`w-4 h-4 ${testConnectivity.isPending || isAnimatingTest ? 'animate-pulse' : ''}`}
            />
            {isAnimatingTest ? 'Testing...' : 'Test Connectivity'}
          </Button>
        </div>
      </div>

      {isLoading && !status ? (
        <div className="flex items-center justify-center py-20">
          <FiLoader className="w-10 h-10 animate-spin text-[var(--primary)]" />
        </div>
      ) : !status ? (
        <div className="text-center py-20 text-[var(--muted-foreground)]">
          <FiServer className="w-16 h-16 mx-auto mb-4 opacity-50" />
          <p>Unable to load HA status</p>
        </div>
      ) : (
        <>
          {/* Quick Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              title="Overall Status"
              value={status.overallStatus.toUpperCase()}
              iconComponent={FiActivity}
              status={status.overallStatus}
              variant="compact"
            />
            <StatCard
              title="Floating IP"
              value={status.floatingIP.assignedTo.toUpperCase()}
              iconComponent={FiWifi}
              status={status.floatingIP.assignedTo === 'unknown' ? 'down' : 'healthy'}
              variant="compact"
            />
            <StatCard
              title="WebRTC Connections"
              value={status.activeConnections.webrtc}
              iconComponent={FiServer}
              variant="compact"
            />
            <StatCard
              title="Last Updated"
              value={new Date(status.timestamp).toLocaleTimeString()}
              iconComponent={FiRefreshCw}
              variant="compact"
            />
          </div>

          {/* Main Content Grid — Topology + Sidebar */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            {/* Topology Map — 2 columns */}
            <Card className="xl:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2">
                  <FiServer className="w-5 h-5" />
                  Network Topology
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <HATopologyMap
                  status={status}
                  onServerClick={handleServerClick}
                  isTestingConnectivity={isAnimatingTest}
                  connectivityResults={testConnectivity.data}
                  onTestComplete={handleTestAnimationComplete}
                />
              </CardContent>
            </Card>

            {/* Sidebar — Cluster Controls + Event Log */}
            <div className="space-y-6">
              <FailoverControlPanel status={status} events={events} />
              <HAEventLog events={events} maxItems={5} />
            </div>
          </div>

          {/* Server Management — unified health cards with inline controls */}
          <div>
            <h2 className="text-lg font-semibold text-[var(--foreground)] mb-4">
              Server Management
            </h2>
            <ServerManagement status={status} />
          </div>

          {/* Active Issues — contextual troubleshooting */}
          <TroubleshootingPanel status={status} />
        </>
      )}
    </div>
  );
}
