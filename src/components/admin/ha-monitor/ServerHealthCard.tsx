'use client';

import React, { useState } from 'react';
import {
  FiServer,
  FiCpu,
  FiClock,
  FiWifi,
  FiDatabase,
  FiHardDrive,
  FiChevronDown,
  FiChevronUp,
  FiRefreshCw,
  FiSearch,
  FiFileText,
  FiLoader,
  FiX,
  FiTerminal,
  FiTrash2,
  FiSettings,
} from 'react-icons/fi';
import { Card, CardContent, Button } from '@/components/ui';
import { useServerAction, useServiceLogs } from '@/lib/hooks';
import type {
  ServerHealth,
  ServerStatus,
  KamailioHealth,
  FusionPBXHealth,
  PostgreSQLHealth,
  MonitorHealth,
  BkpserverHealth,
  ApiGatewayHealth,
} from '@/lib/api/services/ha.service';

// ---------------------------------------------------------------------------
// Action Definitions — SSOT for all per-server actions
// ---------------------------------------------------------------------------

interface ActionDef {
  id: string;
  label: string;
  icon: React.ElementType;
  variant: 'restart' | 'diagnostic' | 'maintenance';
  confirm?: boolean;
}

const SERVER_ACTIONS: Record<string, ActionDef[]> = {
  kamailio: [
    {
      id: 'restart-kamailio',
      label: 'Restart Kamailio',
      icon: FiRefreshCw,
      variant: 'restart',
      confirm: true,
    },
    {
      id: 'restart-rtpengine',
      label: 'Restart rtpengine',
      icon: FiRefreshCw,
      variant: 'restart',
      confirm: true,
    },
    {
      id: 'restart-keepalived',
      label: 'Restart Keepalived',
      icon: FiRefreshCw,
      variant: 'restart',
      confirm: true,
    },
    {
      id: 'restart-haproxy',
      label: 'Restart HAProxy',
      icon: FiRefreshCw,
      variant: 'restart',
      confirm: true,
    },
    { id: 'check-keepalived', label: 'Keepalived', icon: FiSearch, variant: 'diagnostic' },
    { id: 'check-notify-log', label: 'Notify Log', icon: FiFileText, variant: 'diagnostic' },
    { id: 'check-redis', label: 'Redis', icon: FiSearch, variant: 'diagnostic' },
    { id: 'check-dispatcher', label: 'Dispatcher', icon: FiSearch, variant: 'diagnostic' },
  ],
  fusionpbx: [
    {
      id: 'restart-freeswitch',
      label: 'Restart FreeSWITCH',
      icon: FiRefreshCw,
      variant: 'restart',
      confirm: true,
    },
    {
      id: 'restart-haproxy',
      label: 'Restart HAProxy',
      icon: FiRefreshCw,
      variant: 'restart',
      confirm: true,
    },
    {
      id: 'clear-cache',
      label: 'Clear Cache + Reload',
      icon: FiTrash2,
      variant: 'maintenance',
      confirm: true,
    },
    { id: 'check-freeswitch', label: 'FS Status', icon: FiSearch, variant: 'diagnostic' },
    { id: 'check-registrations', label: 'Registrations', icon: FiSearch, variant: 'diagnostic' },
    { id: 'check-calls', label: 'Calls', icon: FiSearch, variant: 'diagnostic' },
    { id: 'check-iptables', label: 'IP Whitelist', icon: FiSearch, variant: 'diagnostic' },
    { id: 'check-sofia-profiles', label: 'Sofia Profiles', icon: FiSearch, variant: 'diagnostic' },
  ],
  monitor: [
    {
      id: 'restart-redis-usrloc',
      label: 'Restart Redis',
      icon: FiRefreshCw,
      variant: 'restart',
      confirm: true,
    },
    {
      id: 'restart-sentinel',
      label: 'Restart Sentinel',
      icon: FiRefreshCw,
      variant: 'restart',
      confirm: true,
    },
    {
      id: 'restart-nfs',
      label: 'Restart NFS',
      icon: FiRefreshCw,
      variant: 'restart',
      confirm: true,
    },
    {
      id: 'check-sentinel-master',
      label: 'Sentinel Master',
      icon: FiSearch,
      variant: 'diagnostic',
    },
    { id: 'check-redis-replication', label: 'Replication', icon: FiSearch, variant: 'diagnostic' },
    { id: 'check-patroni', label: 'Patroni Cluster', icon: FiSearch, variant: 'diagnostic' },
  ],
  bkpserver: [
    {
      id: 'restart-redis-replica',
      label: 'Restart Redis Replica',
      icon: FiRefreshCw,
      variant: 'restart',
      confirm: true,
    },
    {
      id: 'restart-sentinel-bkp',
      label: 'Restart Sentinel',
      icon: FiRefreshCw,
      variant: 'restart',
      confirm: true,
    },
    { id: 'check-redis-replica', label: 'Redis Replica', icon: FiSearch, variant: 'diagnostic' },
    { id: 'check-sentinel-bkp', label: 'Sentinel', icon: FiSearch, variant: 'diagnostic' },
  ],
  apigateway: [
    {
      id: 'restart-nginx',
      label: 'Restart nginx',
      icon: FiRefreshCw,
      variant: 'restart',
      confirm: true,
    },
    {
      id: 'restart-api',
      label: 'Restart API',
      icon: FiRefreshCw,
      variant: 'restart',
      confirm: true,
    },
    {
      id: 'restart-mysql',
      label: 'Restart MySQL',
      icon: FiRefreshCw,
      variant: 'restart',
      confirm: true,
    },
    { id: 'check-api-health', label: 'API Health', icon: FiSearch, variant: 'diagnostic' },
    { id: 'check-pm2', label: 'PM2 Status', icon: FiSearch, variant: 'diagnostic' },
    { id: 'check-nginx-config', label: 'Nginx Config', icon: FiSearch, variant: 'diagnostic' },
  ],
};

const LOG_SERVICES: Record<string, string[]> = {
  kamailio: ['kamailio', 'rtpengine', 'keepalived', 'haproxy'],
  fusionpbx: ['freeswitch', 'haproxy'],
  monitor: ['redis-usrloc', 'sentinel', 'patroni'],
  bkpserver: ['redis-replica', 'sentinel-bkp'],
  apigateway: ['nginx', 'bitnex-api', 'mysql'],
};

function getServerType(serverId: string): string {
  if (serverId.startsWith('kamailio')) return 'kamailio';
  if (serverId.startsWith('fusionpbx')) return 'fusionpbx';
  if (serverId === 'bkpserver') return 'bkpserver';
  if (serverId === 'apigateway') return 'apigateway';
  return 'monitor';
}

// ---------------------------------------------------------------------------
// Shared sub-components
// ---------------------------------------------------------------------------

interface ServerHealthCardProps {
  server: ServerHealth & { type?: string; [key: string]: unknown };
  serverId?: string;
  onClick?: () => void;
}

const statusConfig: Record<ServerStatus, { color: string; bg: string; label: string }> = {
  healthy: {
    color: 'text-green-600 dark:text-green-400',
    bg: 'bg-green-100 dark:bg-green-900/30',
    label: 'Healthy',
  },
  degraded: {
    color: 'text-yellow-600 dark:text-yellow-400',
    bg: 'bg-yellow-100 dark:bg-yellow-900/30',
    label: 'Degraded',
  },
  down: {
    color: 'text-red-600 dark:text-red-400',
    bg: 'bg-red-100 dark:bg-red-900/30',
    label: 'Down',
  },
  unknown: {
    color: 'text-gray-600 dark:text-gray-400',
    bg: 'bg-gray-100 dark:bg-gray-900/30',
    label: 'Unknown',
  },
};

const typeIcons: Record<string, React.ElementType> = {
  kamailio: FiWifi,
  fusionpbx: FiServer,
  postgresql: FiDatabase,
  monitor: FiHardDrive,
  bkpserver: FiHardDrive,
  apigateway: FiServer,
};

function StatusDot({ status }: { status: ServerStatus | boolean | undefined }) {
  const isHealthy = status === 'healthy' || status === true;
  const isDown = status === 'down' || status === false;
  const isUnknown = status === undefined || status === 'unknown';
  const color = isHealthy
    ? 'bg-green-500'
    : isDown
      ? 'bg-red-500'
      : isUnknown
        ? 'bg-gray-400'
        : 'bg-yellow-500';
  return <span className={`inline-block w-2 h-2 rounded-full ${color}`} />;
}

// ---------------------------------------------------------------------------
// Type-specific service breakdown
// ---------------------------------------------------------------------------

function ServiceBreakdown({
  server,
}: {
  server: ServerHealth & { type?: string; [key: string]: unknown };
}) {
  if (server.type === 'kamailio') {
    const s = server as unknown as KamailioHealth;
    return (
      <div className="mt-3 border-t border-[var(--border)] pt-3 space-y-1.5">
        <div className="text-[10px] font-medium uppercase text-[var(--muted-foreground)] mb-1">
          Services
        </div>
        <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
          <div className="flex items-center gap-1.5">
            <StatusDot status={s.status !== 'down'} /> Kamailio
          </div>
          <div className="flex items-center gap-1.5">
            <StatusDot status={s.rtpengineStatus} /> rtpengine
          </div>
          <div className="flex items-center gap-1.5">
            <StatusDot status={s.redisStatus} /> Redis {s.redisRole ? `(${s.redisRole})` : ''}
          </div>
          <div className="flex items-center gap-1.5">
            <span
              className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${s.keepalivedRole === 'MASTER' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'}`}
            >
              {s.keepalivedRole}
            </span>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-1 text-xs mt-1">
          <div className="flex items-center gap-1">
            <StatusDot status={s.sipPort5060} /> :5060
          </div>
          <div className="flex items-center gap-1">
            <StatusDot status={s.sipTls5061} /> :5061
          </div>
          <div className="flex items-center gap-1">
            <StatusDot status={s.wssPort7443} /> :7443
          </div>
        </div>
        <div className="flex items-center gap-1 text-[10px] text-[var(--muted-foreground)] mt-1">
          Failover: <span className="font-medium">Auto (DO API)</span>
        </div>
      </div>
    );
  }

  if (server.type === 'fusionpbx') {
    const s = server as unknown as FusionPBXHealth;
    return (
      <div className="mt-3 border-t border-[var(--border)] pt-3 space-y-1.5">
        <div className="text-[10px] font-medium uppercase text-[var(--muted-foreground)] mb-1">
          Services
        </div>
        <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
          <div className="flex items-center gap-1.5">
            <StatusDot status={s.freeswitchStatus} /> FreeSWITCH
          </div>
          <div className="flex items-center gap-1.5">
            <StatusDot status={s.haproxyStatus} /> HAProxy (DB)
          </div>
          <div className="flex items-center gap-1.5">
            <StatusDot status={s.recordingApiStatus} /> Recording API
          </div>
        </div>
        <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs mt-1">
          <div className="flex items-center gap-1">
            <StatusDot status={s.internalProfile5060} /> :5060
          </div>
          <div className="flex items-center gap-1">
            <StatusDot status={s.externalProfile5080} /> :5080
          </div>
        </div>
        <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs mt-1 text-[var(--muted-foreground)]">
          <div>
            Calls: <span className="font-medium text-[var(--foreground)]">{s.activeCalls}</span>
          </div>
          <div>
            Regs: <span className="font-medium text-[var(--foreground)]">{s.registrations}</span>
          </div>
        </div>
      </div>
    );
  }

  if (server.type === 'postgresql') {
    const s = server as unknown as PostgreSQLHealth;
    return (
      <div className="mt-3 border-t border-[var(--border)] pt-3 space-y-1.5">
        <div className="text-[10px] font-medium uppercase text-[var(--muted-foreground)] mb-1">
          Database
        </div>
        <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
          <div>
            Patroni: <span className="font-medium uppercase">{s.patroniRole}</span>
          </div>
          <div>
            In Sync: <span className="font-medium">{s.inSync ? 'Yes' : 'No'}</span>
          </div>
          <div>
            Connections:{' '}
            <span className="font-medium">
              {s.connectionCount}/{s.maxConnections}
            </span>
          </div>
          {s.replicationLag !== undefined && (
            <div>
              Lag: <span className="font-medium">{s.replicationLag}ms</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (server.type === 'monitor') {
    const s = server as unknown as MonitorHealth;
    return (
      <div className="mt-3 border-t border-[var(--border)] pt-3 space-y-1.5">
        <div className="text-[10px] font-medium uppercase text-[var(--muted-foreground)] mb-1">
          Services
        </div>
        <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
          <div className="flex items-center gap-1.5">
            <StatusDot status={s.redisUsrlocStatus} /> Redis Master
          </div>
          <div className="flex items-center gap-1.5">
            <StatusDot status={s.sentinelStatus} /> Sentinel
          </div>
          <div className="flex items-center gap-1.5">
            <StatusDot status={s.nfsStatus} /> NFS
          </div>
          <div className="flex items-center gap-1.5">
            <StatusDot status={s.grafanaStatus} /> Grafana
          </div>
          <div className="flex items-center gap-1.5">
            <StatusDot status={s.prometheusStatus} /> Prometheus
          </div>
          <div className="flex items-center gap-1.5">
            <StatusDot status={s.watcherStatus} /> Watcher
          </div>
        </div>
      </div>
    );
  }

  if (server.type === 'bkpserver') {
    const s = server as unknown as BkpserverHealth;
    return (
      <div className="mt-3 border-t border-[var(--border)] pt-3 space-y-1.5">
        <div className="text-[10px] font-medium uppercase text-[var(--muted-foreground)] mb-1">
          Services
        </div>
        <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
          <div className="flex items-center gap-1.5">
            <StatusDot status={s.redisReplicaStatus} /> Redis Replica{' '}
            {s.redisRole ? `(${s.redisRole})` : ''}
          </div>
          <div className="flex items-center gap-1.5">
            <StatusDot status={s.sentinelStatus} /> Sentinel
          </div>
        </div>
      </div>
    );
  }

  if (server.type === 'apigateway') {
    const s = server as unknown as ApiGatewayHealth;
    return (
      <div className="mt-3 border-t border-[var(--border)] pt-3 space-y-1.5">
        <div className="text-[10px] font-medium uppercase text-[var(--muted-foreground)] mb-1">
          Services
        </div>
        <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
          <div className="flex items-center gap-1.5">
            <StatusDot status={s.nginxStatus} /> nginx
          </div>
          <div className="flex items-center gap-1.5">
            <StatusDot status={s.apiStatus} /> API (PM2)
          </div>
          <div className="flex items-center gap-1.5">
            <StatusDot status={s.mysqlStatus} /> MySQL
          </div>
          <div className="flex items-center gap-1.5">
            <StatusDot status={s.redisStatus} /> Redis
          </div>
        </div>
      </div>
    );
  }

  return null;
}

// ---------------------------------------------------------------------------
// Output viewer for command results
// ---------------------------------------------------------------------------

function OutputViewer({
  output,
  onClose,
  title,
}: {
  output: string;
  onClose: () => void;
  title: string;
}) {
  return (
    <div className="mt-2 border border-[var(--border)] rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-3 py-1.5 bg-[var(--muted)]/50 border-b border-[var(--border)]">
        <span className="text-xs font-medium text-[var(--foreground)] flex items-center gap-1.5">
          <FiTerminal className="w-3 h-3" /> {title}
        </span>
        <button onClick={onClose} className="p-0.5 rounded hover:bg-[var(--accent)]">
          <FiX className="w-3.5 h-3.5 text-[var(--muted-foreground)]" />
        </button>
      </div>
      <pre className="p-3 text-[11px] font-mono text-[var(--foreground)] bg-[var(--card)] overflow-x-auto max-h-[300px] overflow-y-auto whitespace-pre-wrap break-all">
        {output}
      </pre>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inline server controls (restarts, diagnostics, logs)
// ---------------------------------------------------------------------------

function ServerControls({ serverId }: { serverId: string }) {
  const [output, setOutput] = useState<{ title: string; text: string } | null>(null);
  const [confirmingAction, setConfirmingAction] = useState<string | null>(null);
  const serverAction = useServerAction();
  const serviceLogs = useServiceLogs();

  const serverType = getServerType(serverId);
  const actions = SERVER_ACTIONS[serverType] || [];
  const logServices = LOG_SERVICES[serverType] || [];
  const isRunning = serverAction.isPending || serviceLogs.isPending;

  const restartActions = actions.filter(
    (a) => a.variant === 'restart' || a.variant === 'maintenance'
  );
  const diagnosticActions = actions.filter((a) => a.variant === 'diagnostic');

  const handleAction = (action: ActionDef) => {
    if (action.confirm && confirmingAction !== action.id) {
      setConfirmingAction(action.id);
      setTimeout(() => setConfirmingAction(null), 5000);
      return;
    }
    setConfirmingAction(null);
    serverAction.mutate(
      { serverId, actionId: action.id },
      { onSuccess: (data) => setOutput({ title: action.label, text: data.output }) }
    );
  };

  const handleLogs = (service: string) => {
    serviceLogs.mutate(
      { serverId, service, lines: 50 },
      { onSuccess: (data) => setOutput({ title: `Logs: ${service}`, text: data.output }) }
    );
  };

  return (
    <div className="mt-3 border-t border-[var(--border)] pt-3 space-y-3">
      {/* Service Controls */}
      {restartActions.length > 0 && (
        <div>
          <div className="text-[10px] font-medium uppercase text-[var(--muted-foreground)] mb-1.5">
            Service Controls
          </div>
          <div className="flex flex-wrap gap-1.5">
            {restartActions.map((action) => (
              <Button
                key={action.id}
                variant={confirmingAction === action.id ? 'danger' : 'outline'}
                size="sm"
                onClick={() => handleAction(action)}
                disabled={isRunning}
                className="text-xs h-7 px-2"
              >
                {isRunning && serverAction.variables?.actionId === action.id ? (
                  <FiLoader className="w-3 h-3 mr-1 animate-spin" />
                ) : (
                  <action.icon className="w-3 h-3 mr-1" />
                )}
                {confirmingAction === action.id ? 'Confirm?' : action.label}
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Diagnostics */}
      {diagnosticActions.length > 0 && (
        <div>
          <div className="text-[10px] font-medium uppercase text-[var(--muted-foreground)] mb-1.5">
            Diagnostics
          </div>
          <div className="flex flex-wrap gap-1.5">
            {diagnosticActions.map((action) => (
              <Button
                key={action.id}
                variant="outline"
                size="sm"
                onClick={() => handleAction(action)}
                disabled={isRunning}
                className="text-xs h-7 px-2"
              >
                {isRunning && serverAction.variables?.actionId === action.id ? (
                  <FiLoader className="w-3 h-3 mr-1 animate-spin" />
                ) : (
                  <action.icon className="w-3 h-3 mr-1" />
                )}
                {action.label}
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Logs */}
      {logServices.length > 0 && (
        <div>
          <div className="text-[10px] font-medium uppercase text-[var(--muted-foreground)] mb-1.5">
            View Logs
          </div>
          <div className="flex flex-wrap gap-1.5">
            {logServices.map((service) => (
              <Button
                key={service}
                variant="outline"
                size="sm"
                onClick={() => handleLogs(service)}
                disabled={isRunning}
                className="text-xs h-7 px-2"
              >
                <FiFileText className="w-3 h-3 mr-1" />
                {service}
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Output viewer */}
      {output && (
        <OutputViewer title={output.title} output={output.text} onClose={() => setOutput(null)} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main ServerHealthCard component
// ---------------------------------------------------------------------------

export function ServerHealthCard({ server, serverId, onClick }: ServerHealthCardProps) {
  const [showControls, setShowControls] = useState(false);
  const config = statusConfig[server.status] || statusConfig.unknown;
  const Icon = typeIcons[server.type || ''] || FiServer;

  const serverType = serverId ? getServerType(serverId) : '';
  const hasControls = serverId && SERVER_ACTIONS[serverType];

  const handleToggleControls = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowControls(!showControls);
  };

  return (
    <Card
      className={`transition-all duration-200 ${
        server.status === 'down' ? 'border-red-500 dark:border-red-700' : ''
      } ${showControls ? 'ring-1 ring-[var(--primary)]/30' : 'hover:shadow-md'}`}
    >
      <CardContent className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${config.bg}`}>
              <Icon className={`w-5 h-5 ${config.color}`} />
            </div>
            <div>
              <h3 className="font-medium text-[var(--foreground)] leading-tight">{server.name}</h3>
              <p className="text-xs font-mono text-[var(--muted-foreground)]">{server.ip}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <div
              className={`px-2 py-1 rounded-full text-xs font-medium ${config.bg} ${config.color}`}
            >
              {config.label}
            </div>
          </div>
        </div>

        {/* Metrics */}
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="flex items-center gap-2">
            <FiClock className="w-3.5 h-3.5 text-[var(--muted-foreground)]" />
            <span className="text-sm text-[var(--foreground)]">
              {server.latency >= 0 ? `${server.latency}ms` : 'N/A'}
            </span>
          </div>
          {server.cpu !== undefined && (
            <div className="flex items-center gap-2">
              <FiCpu className="w-3.5 h-3.5 text-[var(--muted-foreground)]" />
              <span className="text-sm text-[var(--foreground)]">{server.cpu}%</span>
            </div>
          )}
          {server.role && (
            <div className="col-span-2 flex items-center gap-2">
              <span className="text-xs text-[var(--muted-foreground)]">Role:</span>
              <span className="text-xs font-medium uppercase text-[var(--foreground)]">
                {server.role}
              </span>
            </div>
          )}
        </div>

        {/* Service breakdown */}
        <ServiceBreakdown server={server} />

        {/* Error message */}
        {server.error && (
          <div className="mt-3 p-2 rounded bg-red-50 dark:bg-red-900/20 text-xs text-red-600 dark:text-red-400">
            {server.error}
          </div>
        )}

        {/* Controls toggle */}
        {hasControls && (
          <>
            <button
              onClick={handleToggleControls}
              className="mt-3 w-full flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium text-[var(--muted-foreground)] hover:text-[var(--foreground)] border-t border-[var(--border)] transition-colors"
            >
              <FiSettings className="w-3 h-3" />
              {showControls ? 'Hide Controls' : 'Manage Server'}
              {showControls ? (
                <FiChevronUp className="w-3 h-3" />
              ) : (
                <FiChevronDown className="w-3 h-3" />
              )}
            </button>
            {showControls && <ServerControls serverId={serverId!} />}
          </>
        )}
      </CardContent>
    </Card>
  );
}
