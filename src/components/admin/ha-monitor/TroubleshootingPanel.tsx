'use client';

import React, { useState } from 'react';
import {
  FiAlertTriangle,
  FiCheckCircle,
  FiChevronDown,
  FiChevronRight,
  FiCopy,
  FiCheck,
  FiPlay,
  FiLoader,
} from 'react-icons/fi';
import { Card, CardContent, CardHeader, CardTitle, Button } from '@/components/ui';
import { useServerAction } from '@/lib/hooks';
import type { HAClusterState } from '@/lib/api/services/ha.service';

interface QuickFix {
  serverId: string;
  actionId: string;
  label: string;
}

interface TroubleshootingItem {
  id: string;
  severity: 'critical' | 'warning';
  title: string;
  impact: string;
  steps: { description: string; command?: string }[];
  quickFix?: QuickFix;
}

function detectIssues(status: HAClusterState): TroubleshootingItem[] {
  const issues: TroubleshootingItem[] = [];

  // Both Kamailio down
  if (status.kamailio.primary.status === 'down' && status.kamailio.secondary.status === 'down') {
    issues.push({
      id: 'both-kamailio-down',
      severity: 'critical',
      title: 'Complete SIP Outage',
      impact: 'All SIP and WebRTC traffic is down. No calls possible.',
      steps: [
        {
          description: 'Start one Kamailio node first',
          command: 'ssh root@164.90.149.98 "systemctl start kamailio"',
        },
        {
          description: 'Verify floating IP assignment',
          command:
            'curl -s -H "Authorization: Bearer $DO_API_TOKEN" https://api.digitalocean.com/v2/reserved_ips/134.199.186.228 | jq .reserved_ip.droplet.id',
        },
        {
          description: 'Start second Kamailio node',
          command: 'ssh root@147.182.197.159 "systemctl start kamailio"',
        },
      ],
    });
  } else {
    // Individual Kamailio down
    for (const [role, node] of [
      ['PRIMARY', status.kamailio.primary],
      ['SECONDARY', status.kamailio.secondary],
    ] as const) {
      if (node.status === 'down') {
        const ip = node.ip;
        issues.push({
          id: `kamailio-${role.toLowerCase()}-down`,
          severity: 'critical',
          title: `Kamailio ${role} Down`,
          impact: `${role} node is unreachable. Floating IP should auto-failover via keepalived.`,
          steps: [
            {
              description: 'Check Kamailio service status',
              command: `ssh root@${ip} "systemctl status kamailio"`,
            },
            {
              description: 'Check recent logs',
              command: `ssh root@${ip} "journalctl -u kamailio --since '5 min ago' | tail -30"`,
            },
            {
              description: 'Restart Kamailio',
              command: `ssh root@${ip} "systemctl restart kamailio"`,
            },
          ],
          quickFix: {
            serverId: `kamailio-${role.toLowerCase()}`,
            actionId: 'restart-kamailio',
            label: 'Restart Kamailio',
          },
        });
      }
    }
  }

  // rtpengine down
  for (const [role, node] of [
    ['PRIMARY', status.kamailio.primary],
    ['SECONDARY', status.kamailio.secondary],
  ] as const) {
    if (node.rtpengineStatus === 'down' && node.status !== 'down') {
      const ip = node.ip;
      issues.push({
        id: `rtpengine-${role.toLowerCase()}-down`,
        severity: 'warning',
        title: `rtpengine Down on ${role}`,
        impact: 'Inbound calls on this node will have no audio. systemd should auto-restart in 2s.',
        steps: [
          {
            description: 'Check rtpengine status',
            command: `ssh root@${ip} "systemctl status rtpengine-daemon"`,
          },
          {
            description: 'Restart rtpengine',
            command: `ssh root@${ip} "systemctl restart rtpengine-daemon"`,
          },
          {
            description: 'Verify rtpengine is listening',
            command: `ssh root@${ip} "ss -ulnp | grep rtpengine"`,
          },
        ],
        quickFix: {
          serverId: `kamailio-${role.toLowerCase()}`,
          actionId: 'restart-rtpengine',
          label: 'Restart rtpengine',
        },
      });
    }
  }

  // Redis unreachable from Kamailio
  for (const [role, node] of [
    ['PRIMARY', status.kamailio.primary],
    ['SECONDARY', status.kamailio.secondary],
  ] as const) {
    if (node.redisStatus === 'down' && node.status !== 'down') {
      const ip = node.ip;
      issues.push({
        id: `redis-kamailio-${role.toLowerCase()}`,
        severity: 'warning',
        title: `Redis Unreachable from Kamailio ${role}`,
        impact: 'WebSocket registrations may not be shared across nodes.',
        steps: [
          {
            description: 'Check local HAProxy',
            command: `ssh root@${ip} "systemctl status haproxy"`,
          },
          {
            description: 'Check Redis master directly',
            command: 'redis-cli -h 10.124.0.12 -p 6380 -a KamUsrloc2026! --no-auth-warning ping',
          },
          {
            description: 'Check Sentinel status',
            command: 'redis-cli -h 10.124.0.12 -p 26380 sentinel master kamusrloc',
          },
        ],
        quickFix: {
          serverId: `kamailio-${role.toLowerCase()}`,
          actionId: 'restart-haproxy',
          label: 'Restart HAProxy',
        },
      });
    }
  }

  // Keepalived FAULT
  for (const [role, node] of [
    ['PRIMARY', status.kamailio.primary],
    ['SECONDARY', status.kamailio.secondary],
  ] as const) {
    if (node.keepalivedRole === 'FAULT') {
      const ip = node.ip;
      issues.push({
        id: `keepalived-fault-${role.toLowerCase()}`,
        severity: 'critical',
        title: `Keepalived FAULT on ${role}`,
        impact: 'This node cannot participate in floating IP failover.',
        steps: [
          {
            description: 'Check keepalived status',
            command: `ssh root@${ip} "systemctl status keepalived"`,
          },
          {
            description: 'Run health check script',
            command: `ssh root@${ip} "/etc/keepalived/check_kamailio.sh && echo OK || echo FAIL"`,
          },
          {
            description: 'Check notify log',
            command: `ssh root@${ip} "tail -20 /var/log/keepalived-notify.log"`,
          },
        ],
      });
    }
  }

  // Floating IP unknown
  if (status.floatingIP.assignedTo === 'unknown') {
    issues.push({
      id: 'floating-ip-unknown',
      severity: 'critical',
      title: 'Floating IP Unassigned',
      impact: 'SIP trunk traffic cannot reach any Kamailio node.',
      steps: [
        {
          description: 'Check floating IP via DO API',
          command:
            'curl -s -H "Authorization: Bearer $DO_API_TOKEN" https://api.digitalocean.com/v2/reserved_ips/134.199.186.228 | jq .',
        },
        {
          description: 'Assign to PRIMARY',
          command:
            'curl -X POST -H "Authorization: Bearer $DO_API_TOKEN" -H "Content-Type: application/json" -d \'{"type":"assign","droplet_id":544528542}\' https://api.digitalocean.com/v2/reserved_ips/134.199.186.228/actions',
        },
      ],
    });
  }

  // FreeSWITCH down
  for (const [role, node] of [
    ['PRIMARY', status.fusionpbx.primary],
    ['SECONDARY', status.fusionpbx.secondary],
  ] as const) {
    if (node.freeswitchStatus === 'down') {
      const ip = node.ip;
      issues.push({
        id: `freeswitch-${role.toLowerCase()}-down`,
        severity: 'critical',
        title: `FreeSWITCH ${role} Down`,
        impact: 'Call processing unavailable on this node. Dispatcher will route to other node.',
        steps: [
          {
            description: 'Check FreeSWITCH status',
            command: `ssh root@${ip} "systemctl status freeswitch"`,
          },
          { description: 'Check FS CLI', command: `ssh root@${ip} "fs_cli -x 'status'"` },
          {
            description: 'Restart FreeSWITCH',
            command: `ssh root@${ip} "systemctl restart freeswitch"`,
          },
        ],
        quickFix: {
          serverId: `fusionpbx-${role.toLowerCase()}`,
          actionId: 'restart-freeswitch',
          label: 'Restart FreeSWITCH',
        },
      });
    }
  }

  // HAProxy down on FusionPBX
  for (const [role, node] of [
    ['PRIMARY', status.fusionpbx.primary],
    ['SECONDARY', status.fusionpbx.secondary],
  ] as const) {
    if (node.haproxyStatus === 'down') {
      const ip = node.ip;
      issues.push({
        id: `haproxy-fpbx-${role.toLowerCase()}`,
        severity: 'critical',
        title: `Database Unreachable on FusionPBX ${role}`,
        impact: 'FreeSWITCH cannot read dialplans or write CDRs.',
        steps: [
          { description: 'Check HAProxy', command: `ssh root@${ip} "systemctl status haproxy"` },
          {
            description: 'Check Patroni cluster',
            command:
              'ssh -J root@137.184.33.190 root@10.124.0.2 "patronictl -c /etc/patroni/config.yml list"',
          },
        ],
        quickFix: {
          serverId: `fusionpbx-${role.toLowerCase()}`,
          actionId: 'restart-haproxy',
          label: 'Restart HAProxy',
        },
      });
    }
  }

  // PostgreSQL down
  for (const [role, node] of [
    ['PRIMARY', status.postgresql.primary],
    ['SECONDARY', status.postgresql.secondary],
  ] as const) {
    if (node.status === 'down') {
      issues.push({
        id: `postgresql-${role.toLowerCase()}-down`,
        severity: 'critical',
        title: `PostgreSQL ${role} Down`,
        impact:
          role === 'PRIMARY'
            ? 'Database writes will fail. Patroni may auto-promote replica.'
            : 'No replication standby available.',
        steps: [
          { description: 'Check Patroni status', command: `curl -s http://${node.ip}:8008/` },
          {
            description: 'Check Patroni cluster',
            command:
              'ssh -J root@137.184.33.190 root@10.124.0.2 "patronictl -c /etc/patroni/config.yml list"',
          },
          {
            description: 'Restart Patroni (emergency)',
            command: `ssh -J root@137.184.33.190 root@${node.ip} "systemctl restart patroni"`,
          },
        ],
      });
    }
  }

  // No registrations
  if (
    status.fusionpbx.primary.registrations === 0 &&
    status.fusionpbx.secondary.registrations === 0 &&
    status.fusionpbx.primary.status === 'healthy' &&
    status.fusionpbx.secondary.status === 'healthy'
  ) {
    issues.push({
      id: 'no-registrations',
      severity: 'warning',
      title: 'No SIP Registrations',
      impact: 'No WebRTC clients are registered. Inbound calls will fail.',
      steps: [
        {
          description: 'Check Kamailio WSS port',
          command: 'ssh root@164.90.149.98 "ss -tln | grep 7443"',
        },
        {
          description: 'Check iptables whitelist on FusionPBX',
          command:
            'ssh root@137.184.35.20 "iptables -L sip-auth-ip -n | grep -E \'164.90|147.182|134.199\'"',
        },
        { description: 'Check browser WebSocket connection to sip.bitnexdial.com:7443' },
      ],
    });
  }

  // Monitor down
  if (status.monitor.status === 'down') {
    issues.push({
      id: 'monitor-down',
      severity: 'warning',
      title: 'Monitor Server Down',
      impact:
        'Grafana, NFS recordings, Redis master unavailable. Sentinel will promote replica. Recording uploads paused.',
      steps: [
        { description: 'Check Monitor server', command: 'ssh root@137.184.33.190 "uptime"' },
        {
          description: 'Check Redis on bkpserver (should be promoted to master)',
          command:
            'ssh root@137.184.32.127 "redis-cli -h 127.0.0.1 -p 6380 -a KamUsrloc2026! --no-auth-warning info replication | grep role"',
        },
      ],
    });
  }

  // Redis usrloc master down
  if (status.monitor.redisUsrlocStatus === 'down' && status.monitor.status !== 'down') {
    issues.push({
      id: 'redis-usrloc-down',
      severity: 'critical',
      title: 'Redis usrloc Master Down',
      impact: 'WebSocket registrations not being stored. Sentinel should auto-failover.',
      steps: [
        {
          description: 'Check Redis service',
          command: 'ssh root@137.184.33.190 "systemctl status redis-usrloc"',
        },
        {
          description: 'Check Sentinel for failover',
          command:
            'ssh root@137.184.33.190 "redis-cli -h 127.0.0.1 -p 26380 sentinel master kamusrloc"',
        },
        {
          description: 'Restart Redis',
          command: 'ssh root@137.184.33.190 "systemctl restart redis-usrloc"',
        },
      ],
      quickFix: {
        serverId: 'monitor',
        actionId: 'restart-redis-usrloc',
        label: 'Restart Redis Master',
      },
    });
  }

  return issues;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className="p-1 rounded hover:bg-[var(--accent)] transition-colors"
      title="Copy command"
    >
      {copied ? (
        <FiCheck className="w-3 h-3 text-green-500" />
      ) : (
        <FiCopy className="w-3 h-3 text-[var(--muted-foreground)]" />
      )}
    </button>
  );
}

function TroubleshootingItemView({ item }: { item: TroubleshootingItem }) {
  const [expanded, setExpanded] = useState(true);
  const [confirmFix, setConfirmFix] = useState(false);
  const serverAction = useServerAction();

  const handleQuickFix = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!item.quickFix) return;
    if (!confirmFix) {
      setConfirmFix(true);
      setTimeout(() => setConfirmFix(false), 5000);
      return;
    }
    setConfirmFix(false);
    serverAction.mutate({
      serverId: item.quickFix.serverId,
      actionId: item.quickFix.actionId,
    });
  };

  return (
    <div
      className={`border rounded-lg ${
        item.severity === 'critical'
          ? 'border-red-300 dark:border-red-800 bg-red-50/50 dark:bg-red-900/10'
          : 'border-yellow-300 dark:border-yellow-800 bg-yellow-50/50 dark:bg-yellow-900/10'
      }`}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 p-3 text-left"
      >
        <FiAlertTriangle
          className={`w-4 h-4 flex-shrink-0 ${
            item.severity === 'critical' ? 'text-red-500' : 'text-yellow-500'
          }`}
        />
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm text-[var(--foreground)]">{item.title}</div>
          <div className="text-xs text-[var(--muted-foreground)] mt-0.5">{item.impact}</div>
        </div>
        <div className="flex items-center gap-2">
          {item.quickFix && (
            <Button
              variant={confirmFix ? 'danger' : 'outline'}
              size="sm"
              onClick={handleQuickFix}
              disabled={serverAction.isPending}
              className="text-xs h-7 px-2"
            >
              {serverAction.isPending ? (
                <FiLoader className="w-3 h-3 animate-spin" />
              ) : (
                <FiPlay className="w-3 h-3 mr-1" />
              )}
              {confirmFix ? 'Confirm?' : item.quickFix.label}
            </Button>
          )}
          {expanded ? (
            <FiChevronDown className="w-4 h-4 text-[var(--muted-foreground)]" />
          ) : (
            <FiChevronRight className="w-4 h-4 text-[var(--muted-foreground)]" />
          )}
        </div>
      </button>

      {expanded && (
        <div className="px-3 pb-3 space-y-2">
          {item.steps.map((step, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className="text-xs font-medium text-[var(--muted-foreground)] mt-0.5 w-4 flex-shrink-0">
                {i + 1}.
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-xs text-[var(--foreground)]">{step.description}</div>
                {step.command && (
                  <div className="mt-1 flex items-center gap-1 bg-[var(--card)] border border-[var(--border)] rounded px-2 py-1">
                    <code className="text-[11px] font-mono text-[var(--foreground)] flex-1 break-all">
                      {step.command}
                    </code>
                    <CopyButton text={step.command} />
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface TroubleshootingPanelProps {
  status: HAClusterState;
}

export function TroubleshootingPanel({ status }: TroubleshootingPanelProps) {
  const issues = detectIssues(status);

  const criticalCount = issues.filter((i) => i.severity === 'critical').length;
  const warningCount = issues.filter((i) => i.severity === 'warning').length;

  if (issues.length === 0) {
    return (
      <Card className="border-green-200 dark:border-green-900">
        <CardContent className="p-4 flex items-center gap-3">
          <FiCheckCircle className="w-5 h-5 text-green-500" />
          <div>
            <span className="font-medium text-[var(--foreground)]">All Systems Operational</span>
            <span className="text-sm text-[var(--muted-foreground)] ml-2">No issues detected</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-red-200 dark:border-red-900">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <FiAlertTriangle className="w-5 h-5 text-red-500" />
          Troubleshooting
          <span className="text-sm font-normal text-[var(--muted-foreground)]">
            {criticalCount > 0 && `${criticalCount} critical`}
            {criticalCount > 0 && warningCount > 0 && ', '}
            {warningCount > 0 && `${warningCount} warning${warningCount > 1 ? 's' : ''}`}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {issues.map((issue) => (
          <TroubleshootingItemView key={issue.id} item={issue} />
        ))}
      </CardContent>
    </Card>
  );
}
