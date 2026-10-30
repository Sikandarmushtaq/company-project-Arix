'use client';

import React, { useState } from 'react';
import {
  FiTerminal,
  FiRefreshCw,
  FiPlay,
  FiFileText,
  FiX,
  FiLoader,
  FiChevronDown,
  FiChevronRight,
  FiTrash2,
  FiSearch,
} from 'react-icons/fi';
import { Card, CardContent, CardHeader, CardTitle, Button } from '@/components/ui';
import { useServerAction, useServiceLogs } from '@/lib/hooks';
import type { HAClusterState } from '@/lib/api/services/ha.service';

/**
 * Action definitions for the frontend — mirrors SERVER_ACTIONS whitelist in backend
 */
interface ActionDef {
  id: string;
  label: string;
  icon: React.ElementType;
  variant: 'restart' | 'diagnostic' | 'maintenance';
  confirm?: boolean;
}

const KAMAILIO_ACTIONS: ActionDef[] = [
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
  { id: 'check-keepalived', label: 'Check Keepalived', icon: FiSearch, variant: 'diagnostic' },
  { id: 'check-notify-log', label: 'View Notify Log', icon: FiFileText, variant: 'diagnostic' },
  { id: 'check-redis', label: 'Check Redis', icon: FiSearch, variant: 'diagnostic' },
  { id: 'check-dispatcher', label: 'Dispatcher List', icon: FiSearch, variant: 'diagnostic' },
];

const FUSIONPBX_ACTIONS: ActionDef[] = [
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
  { id: 'check-freeswitch', label: 'FreeSWITCH Status', icon: FiSearch, variant: 'diagnostic' },
  { id: 'check-registrations', label: 'Show Registrations', icon: FiSearch, variant: 'diagnostic' },
  { id: 'check-calls', label: 'Show Calls', icon: FiSearch, variant: 'diagnostic' },
  { id: 'check-iptables', label: 'Check IP Whitelist', icon: FiSearch, variant: 'diagnostic' },
  { id: 'check-sofia-profiles', label: 'Sofia Profiles', icon: FiSearch, variant: 'diagnostic' },
];

const MONITOR_ACTIONS: ActionDef[] = [
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
  { id: 'restart-nfs', label: 'Restart NFS', icon: FiRefreshCw, variant: 'restart', confirm: true },
  { id: 'check-sentinel-master', label: 'Sentinel Master', icon: FiSearch, variant: 'diagnostic' },
  {
    id: 'check-redis-replication',
    label: 'Redis Replication',
    icon: FiSearch,
    variant: 'diagnostic',
  },
  { id: 'check-patroni', label: 'Patroni Cluster', icon: FiSearch, variant: 'diagnostic' },
];

const LOG_SERVICES: Record<string, string[]> = {
  kamailio: ['kamailio', 'rtpengine', 'keepalived', 'haproxy'],
  fusionpbx: ['freeswitch', 'haproxy'],
  monitor: ['redis-usrloc', 'sentinel', 'patroni'],
};

function getServerActions(serverType: string): ActionDef[] {
  if (serverType.startsWith('kamailio')) return KAMAILIO_ACTIONS;
  if (serverType.startsWith('fusionpbx')) return FUSIONPBX_ACTIONS;
  if (serverType === 'monitor') return MONITOR_ACTIONS;
  return [];
}

function getServerType(serverId: string): string {
  if (serverId.startsWith('kamailio')) return 'kamailio';
  if (serverId.startsWith('fusionpbx')) return 'fusionpbx';
  return 'monitor';
}

interface OutputViewerProps {
  output: string;
  onClose: () => void;
  title: string;
}

function OutputViewer({ output, onClose, title }: OutputViewerProps) {
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

interface ServerSectionProps {
  serverId: string;
  serverName: string;
  serverStatus: string;
}

function ServerSection({ serverId, serverName, serverStatus }: ServerSectionProps) {
  const [expanded, setExpanded] = useState(false);
  const [output, setOutput] = useState<{ title: string; text: string } | null>(null);
  const [confirmingAction, setConfirmingAction] = useState<string | null>(null);
  const serverAction = useServerAction();
  const serviceLogs = useServiceLogs();

  const serverType = getServerType(serverId);
  const actions = getServerActions(serverId);
  const logServices = LOG_SERVICES[serverType] || [];

  const handleAction = (action: ActionDef) => {
    if (action.confirm && confirmingAction !== action.id) {
      setConfirmingAction(action.id);
      setTimeout(() => setConfirmingAction(null), 5000);
      return;
    }
    setConfirmingAction(null);
    serverAction.mutate(
      { serverId, actionId: action.id },
      {
        onSuccess: (data) => {
          setOutput({ title: action.label, text: data.output });
        },
      }
    );
  };

  const handleLogs = (service: string) => {
    serviceLogs.mutate(
      { serverId, service, lines: 50 },
      {
        onSuccess: (data) => {
          setOutput({ title: `Logs: ${service}`, text: data.output });
        },
      }
    );
  };

  const isRunning = serverAction.isPending || serviceLogs.isPending;

  return (
    <div className="border border-[var(--border)] rounded-lg">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-3 text-left hover:bg-[var(--muted)]/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span
            className={`w-2.5 h-2.5 rounded-full ${
              serverStatus === 'healthy'
                ? 'bg-green-500'
                : serverStatus === 'degraded'
                  ? 'bg-yellow-500'
                  : serverStatus === 'down'
                    ? 'bg-red-500'
                    : 'bg-gray-400'
            }`}
          />
          <span className="font-medium text-sm text-[var(--foreground)]">{serverName}</span>
          <span className="text-xs text-[var(--muted-foreground)] uppercase">{serverStatus}</span>
        </div>
        <div className="flex items-center gap-2">
          {isRunning && <FiLoader className="w-3.5 h-3.5 animate-spin text-[var(--primary)]" />}
          {expanded ? (
            <FiChevronDown className="w-4 h-4 text-[var(--muted-foreground)]" />
          ) : (
            <FiChevronRight className="w-4 h-4 text-[var(--muted-foreground)]" />
          )}
        </div>
      </button>

      {expanded && (
        <div className="px-3 pb-3 space-y-3">
          {/* Service Restarts */}
          <div>
            <div className="text-[10px] font-medium uppercase text-[var(--muted-foreground)] mb-2">
              Service Controls
            </div>
            <div className="flex flex-wrap gap-1.5">
              {actions
                .filter((a) => a.variant === 'restart' || a.variant === 'maintenance')
                .map((action) => (
                  <Button
                    key={action.id}
                    variant={confirmingAction === action.id ? 'danger' : 'outline'}
                    size="sm"
                    onClick={() => handleAction(action)}
                    disabled={isRunning}
                    className="text-xs h-7 px-2"
                  >
                    <action.icon className="w-3 h-3 mr-1" />
                    {confirmingAction === action.id ? 'Confirm?' : action.label}
                  </Button>
                ))}
            </div>
          </div>

          {/* Diagnostics */}
          <div>
            <div className="text-[10px] font-medium uppercase text-[var(--muted-foreground)] mb-2">
              Diagnostics
            </div>
            <div className="flex flex-wrap gap-1.5">
              {actions
                .filter((a) => a.variant === 'diagnostic')
                .map((action) => (
                  <Button
                    key={action.id}
                    variant="outline"
                    size="sm"
                    onClick={() => handleAction(action)}
                    disabled={isRunning}
                    className="text-xs h-7 px-2"
                  >
                    <action.icon className="w-3 h-3 mr-1" />
                    {action.label}
                  </Button>
                ))}
            </div>
          </div>

          {/* Logs */}
          {logServices.length > 0 && (
            <div>
              <div className="text-[10px] font-medium uppercase text-[var(--muted-foreground)] mb-2">
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
            <OutputViewer
              title={output.title}
              output={output.text}
              onClose={() => setOutput(null)}
            />
          )}
        </div>
      )}
    </div>
  );
}

interface ServerControlPanelProps {
  status: HAClusterState;
}

export function ServerControlPanel({ status }: ServerControlPanelProps) {
  const servers = [
    {
      id: 'kamailio-primary',
      name: status.kamailio.primary.name,
      status: status.kamailio.primary.status,
    },
    {
      id: 'kamailio-secondary',
      name: status.kamailio.secondary.name,
      status: status.kamailio.secondary.status,
    },
    {
      id: 'fusionpbx-primary',
      name: status.fusionpbx.primary.name,
      status: status.fusionpbx.primary.status,
    },
    {
      id: 'fusionpbx-secondary',
      name: status.fusionpbx.secondary.name,
      status: status.fusionpbx.secondary.status,
    },
    { id: 'monitor', name: status.monitor.name, status: status.monitor.status },
  ];

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <FiTerminal className="w-5 h-5" />
          Server Controls
          <span className="text-sm font-normal text-[var(--muted-foreground)]">
            Restart services, run diagnostics, view logs
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {servers.map((server) => (
          <ServerSection
            key={server.id}
            serverId={server.id}
            serverName={server.name}
            serverStatus={server.status}
          />
        ))}
      </CardContent>
    </Card>
  );
}
