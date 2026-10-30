'use client';

import React from 'react';
import { ServerNode } from './ServerNode';
import { ConnectionLine } from './ConnectionLine';
import { FloatingIPIndicator } from './FloatingIPIndicator';
import { ConnectivityTestOverlay } from './ConnectivityTestOverlay';
import type { HAClusterState, ConnectionTestResult } from '@/lib/api/services/ha.service';

interface HATopologyMapProps {
  status: HAClusterState;
  onServerClick?: (serverId: string) => void;
  isTestingConnectivity?: boolean;
  connectivityResults?: ConnectionTestResult[];
  onTestComplete?: () => void;
}

// Layout constants
const LAYOUT = {
  width: 900,
  height: 850,
  // Y positions for each layer
  internetY: 50,
  floatingIPY: 100,
  kamailioY: 200,
  rtpengineY: 280,
  fusionpbxY: 370,
  postgresY: 510,
  monitorY: 630,
  bkpserverY: 630,
  apigatewayY: 770,
  // X positions
  centerX: 450,
  primaryX: 280,
  secondaryX: 620,
  leftX: 150,
  rightX: 750,
} as const;

/**
 * Get badge colors — handles undefined/missing status gracefully
 * so new fields don't show red before backend is deployed
 */
function badgeColors(status: string | undefined) {
  if (status === 'healthy')
    return { fill: 'rgba(34, 197, 94, 0.15)', stroke: '#22c55e', dot: '#22c55e' };
  if (status === 'down')
    return { fill: 'rgba(239, 68, 68, 0.15)', stroke: '#ef4444', dot: '#ef4444' };
  // unknown / undefined / degraded → gray
  return { fill: 'rgba(107, 114, 128, 0.15)', stroke: '#6b7280', dot: '#6b7280' };
}

export function HATopologyMap({
  status,
  onServerClick,
  isTestingConnectivity = false,
  connectivityResults,
  onTestComplete,
}: HATopologyMapProps) {
  const isPrimaryKamailioActive = status.floatingIP.assignedTo === 'primary';

  return (
    <svg
      viewBox={`0 0 ${LAYOUT.width} ${LAYOUT.height}`}
      className="w-full h-auto max-h-[820px]"
      style={{ background: 'transparent' }}
    >
      {/* Gradient definitions */}
      <defs>
        <linearGradient id="internetGradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#60a5fa" stopOpacity="0.2" />
          <stop offset="50%" stopColor="#a855f7" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#60a5fa" stopOpacity="0.2" />
        </linearGradient>
        <linearGradient id="nlbGradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#06b6d4" />
          <stop offset="100%" stopColor="#8b5cf6" />
        </linearGradient>
        <filter id="glow">
          <feGaussianBlur stdDeviation="2" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Background layer separators */}
      <rect
        x="0"
        y="0"
        width={LAYOUT.width}
        height="140"
        fill="url(#internetGradient)"
        opacity="0.3"
      />

      {/* Internet entry: SIP trunks + Browser WSS */}
      <g transform={`translate(${LAYOUT.centerX}, ${LAYOUT.internetY})`}>
        <text
          x="0"
          y="0"
          fontSize="11"
          fontWeight="600"
          fill="currentColor"
          textAnchor="middle"
          className="select-none"
        >
          INTERNET
        </text>
        <text
          x="-120"
          y="16"
          fontSize="8"
          fill="#a855f7"
          textAnchor="middle"
          opacity="0.7"
          className="select-none"
        >
          SIP Trunks (134.199.186.228)
        </text>
        <text
          x="120"
          y="16"
          fontSize="8"
          fill="#06b6d4"
          textAnchor="middle"
          opacity="0.7"
          className="select-none"
        >
          Browser WSS (sip.bitnexdial.com)
        </text>
      </g>

      {/* Layer labels */}
      <text x="20" y="180" fontSize="10" fill="currentColor" opacity="0.5" className="select-none">
        SIP PROXY (KAMAILIO)
      </text>
      <text
        x="20"
        y={LAYOUT.rtpengineY - 10}
        fontSize="10"
        fill="currentColor"
        opacity="0.5"
        className="select-none"
      >
        MEDIA PROXY (RTPENGINE)
      </text>
      <text
        x="20"
        y={LAYOUT.fusionpbxY - 20}
        fontSize="10"
        fill="currentColor"
        opacity="0.5"
        className="select-none"
      >
        PBX (FUSIONPBX/FREESWITCH)
      </text>
      <text
        x="20"
        y={LAYOUT.postgresY - 20}
        fontSize="10"
        fill="currentColor"
        opacity="0.5"
        className="select-none"
      >
        DATABASE (POSTGRESQL/PATRONI)
      </text>
      <text
        x="20"
        y={LAYOUT.monitorY - 20}
        fontSize="10"
        fill="currentColor"
        opacity="0.5"
        className="select-none"
      >
        MONITORING + REDIS USRLOC
      </text>
      <text
        x="20"
        y={LAYOUT.apigatewayY - 20}
        fontSize="10"
        fill="currentColor"
        opacity="0.5"
        className="select-none"
      >
        API GATEWAY
      </text>

      {/* rtpengine status badges between Kamailio and FusionPBX */}
      {[
        { x: LAYOUT.primaryX, health: status.kamailio.primary },
        { x: LAYOUT.secondaryX, health: status.kamailio.secondary },
      ].map((node, i) => {
        const c = badgeColors(node.health.rtpengineStatus);
        return (
          <g
            key={`rtpengine-${i}`}
            transform={`translate(${node.x - 35}, ${LAYOUT.rtpengineY - 12})`}
          >
            <rect width="70" height="24" rx="12" fill={c.fill} stroke={c.stroke} strokeWidth="1" />
            <circle cx="14" cy="12" r="4" fill={c.dot} />
            <text x="24" y="16" fontSize="9" fill="currentColor" className="select-none">
              rtpengine
            </text>
          </g>
        );
      })}

      {/* Redis + Sentinel badges near Monitor node */}
      {(() => {
        const rc = badgeColors(status.monitor.redisUsrlocStatus);
        const sc = badgeColors(status.bkpserver?.redisReplicaStatus);
        return (
          <>
            <g transform={`translate(${LAYOUT.primaryX - 55}, ${LAYOUT.monitorY + 25})`}>
              <rect
                width="90"
                height="22"
                rx="11"
                fill={rc.fill}
                stroke={rc.stroke}
                strokeWidth="1"
              />
              <circle cx="13" cy="11" r="3.5" fill={rc.dot} />
              <text x="22" y="15" fontSize="8" fill="currentColor" className="select-none">
                Redis Master
              </text>
            </g>
            <g transform={`translate(${LAYOUT.secondaryX - 50}, ${LAYOUT.bkpserverY + 25})`}>
              <rect
                width="90"
                height="22"
                rx="11"
                fill={sc.fill}
                stroke={sc.stroke}
                strokeWidth="1"
              />
              <circle cx="13" cy="11" r="3.5" fill={sc.dot} />
              <text x="22" y="15" fontSize="8" fill="currentColor" className="select-none">
                Redis Replica
              </text>
            </g>
          </>
        );
      })()}

      {/* Connection lines (drawn first, behind nodes) */}
      {/* Floating IP to active Kamailio (SIP:5060 Active-Passive) */}
      <ConnectionLine
        x1={LAYOUT.primaryX}
        y1={LAYOUT.floatingIPY + 20}
        x2={isPrimaryKamailioActive ? LAYOUT.primaryX : LAYOUT.secondaryX}
        y2={LAYOUT.kamailioY - 40}
        active={true}
      />

      {/* Network LB to BOTH Kamailio (WSS:7443 Active-Active) */}
      <ConnectionLine
        x1={LAYOUT.secondaryX}
        y1={LAYOUT.floatingIPY + 20}
        x2={LAYOUT.primaryX}
        y2={LAYOUT.kamailioY - 40}
        active={status.kamailio.primary.status === 'healthy'}
      />
      <ConnectionLine
        x1={LAYOUT.secondaryX}
        y1={LAYOUT.floatingIPY + 20}
        x2={LAYOUT.secondaryX}
        y2={LAYOUT.kamailioY - 40}
        active={status.kamailio.secondary.status === 'healthy'}
      />

      {/* Kamailio VRRP heartbeat */}
      <ConnectionLine
        x1={LAYOUT.primaryX + 70}
        y1={LAYOUT.kamailioY}
        x2={LAYOUT.secondaryX - 70}
        y2={LAYOUT.kamailioY}
        active={
          status.kamailio.primary.status === 'healthy' &&
          status.kamailio.secondary.status === 'healthy'
        }
        bidirectional={true}
        label="VRRP"
        dashed
      />

      {/* Kamailio PRIMARY to FusionPBX */}
      <ConnectionLine
        x1={LAYOUT.primaryX}
        y1={LAYOUT.kamailioY + 40}
        x2={LAYOUT.primaryX}
        y2={LAYOUT.fusionpbxY - 40}
        active={
          status.kamailio.primary.status === 'healthy' &&
          status.fusionpbx.primary.status === 'healthy'
        }
      />
      <ConnectionLine
        x1={LAYOUT.primaryX}
        y1={LAYOUT.kamailioY + 40}
        x2={LAYOUT.secondaryX}
        y2={LAYOUT.fusionpbxY - 40}
        active={
          status.kamailio.primary.status === 'healthy' &&
          status.fusionpbx.secondary.status === 'healthy'
        }
        dashed
      />

      {/* Kamailio SECONDARY to FusionPBX */}
      <ConnectionLine
        x1={LAYOUT.secondaryX}
        y1={LAYOUT.kamailioY + 40}
        x2={LAYOUT.secondaryX}
        y2={LAYOUT.fusionpbxY - 40}
        active={
          status.kamailio.secondary.status === 'healthy' &&
          status.fusionpbx.secondary.status === 'healthy'
        }
      />
      <ConnectionLine
        x1={LAYOUT.secondaryX}
        y1={LAYOUT.kamailioY + 40}
        x2={LAYOUT.primaryX}
        y2={LAYOUT.fusionpbxY - 40}
        active={
          status.kamailio.secondary.status === 'healthy' &&
          status.fusionpbx.primary.status === 'healthy'
        }
        dashed
      />

      {/* FusionPBX to PostgreSQL (via HAProxy) */}
      <ConnectionLine
        x1={LAYOUT.primaryX}
        y1={LAYOUT.fusionpbxY + 40}
        x2={LAYOUT.primaryX}
        y2={LAYOUT.postgresY - 40}
        active={
          status.fusionpbx.primary.status === 'healthy' &&
          status.postgresql.primary.status === 'healthy'
        }
        label="HAProxy"
      />
      <ConnectionLine
        x1={LAYOUT.secondaryX}
        y1={LAYOUT.fusionpbxY + 40}
        x2={LAYOUT.secondaryX}
        y2={LAYOUT.postgresY - 40}
        active={
          status.fusionpbx.secondary.status === 'healthy' &&
          status.postgresql.secondary.status === 'healthy'
        }
        label="HAProxy"
      />

      {/* PostgreSQL replication */}
      <ConnectionLine
        x1={LAYOUT.primaryX + 70}
        y1={LAYOUT.postgresY}
        x2={LAYOUT.secondaryX - 70}
        y2={LAYOUT.postgresY}
        active={
          status.postgresql.primary.status === 'healthy' &&
          status.postgresql.secondary.status === 'healthy'
        }
        bidirectional
        label="Replication"
      />

      {/* Monitor connections (to PostgreSQL) */}
      <ConnectionLine
        x1={LAYOUT.primaryX}
        y1={LAYOUT.monitorY - 20}
        x2={LAYOUT.primaryX}
        y2={LAYOUT.postgresY + 40}
        active={status.monitor.status === 'healthy'}
        dashed
      />
      <ConnectionLine
        x1={LAYOUT.primaryX}
        y1={LAYOUT.monitorY - 20}
        x2={LAYOUT.secondaryX}
        y2={LAYOUT.postgresY + 40}
        active={status.monitor.status === 'healthy'}
        dashed
      />

      {/* Floating IP indicator (SIP:5060 — Active-Passive) */}
      <FloatingIPIndicator
        x={LAYOUT.primaryX}
        y={LAYOUT.floatingIPY}
        floatingIP={status.floatingIP}
        primaryX={LAYOUT.primaryX}
        secondaryX={LAYOUT.secondaryX}
        targetY={LAYOUT.kamailioY}
      />

      {/* Network Load Balancer (WSS:7443 — Active-Active) */}
      <g transform={`translate(${LAYOUT.secondaryX}, ${LAYOUT.floatingIPY})`}>
        <rect
          x="-60"
          y="-15"
          width="120"
          height="30"
          rx="15"
          fill="rgba(6, 182, 212, 0.15)"
          stroke="#06b6d4"
          strokeWidth="1.5"
        />
        <circle cx="-42" cy="0" r="4" fill="#06b6d4">
          <animate attributeName="opacity" values="1;0.4;1" dur="2s" repeatCount="indefinite" />
        </circle>
        <text
          x="4"
          y="4"
          fontSize="9"
          fontWeight="600"
          fill="currentColor"
          textAnchor="middle"
          className="select-none"
        >
          Network LB
        </text>
      </g>

      {/* Entry point labels */}
      <text
        x={LAYOUT.primaryX}
        y={LAYOUT.floatingIPY - 25}
        fontSize="8"
        fill="#a855f7"
        textAnchor="middle"
        opacity="0.8"
        className="select-none"
      >
        SIP:5060 (Active-Passive)
      </text>
      <text
        x={LAYOUT.secondaryX}
        y={LAYOUT.floatingIPY - 25}
        fontSize="8"
        fill="#06b6d4"
        textAnchor="middle"
        opacity="0.8"
        className="select-none"
      >
        WSS:7443 (Active-Active)
      </text>

      {/* Server nodes */}
      {/* Kamailio servers */}
      <ServerNode
        x={LAYOUT.primaryX}
        y={LAYOUT.kamailioY}
        name={status.kamailio.primary.name}
        ip={status.kamailio.primary.ip}
        status={status.kamailio.primary.status}
        role={status.kamailio.primary.keepalivedRole}
        latency={status.kamailio.primary.latency}
        isActive={isPrimaryKamailioActive}
        onClick={() => onServerClick?.('kamailio-primary')}
      />
      <ServerNode
        x={LAYOUT.secondaryX}
        y={LAYOUT.kamailioY}
        name={status.kamailio.secondary.name}
        ip={status.kamailio.secondary.ip}
        status={status.kamailio.secondary.status}
        role={status.kamailio.secondary.keepalivedRole}
        latency={status.kamailio.secondary.latency}
        isActive={!isPrimaryKamailioActive}
        onClick={() => onServerClick?.('kamailio-secondary')}
      />

      {/* FusionPBX servers */}
      <ServerNode
        x={LAYOUT.primaryX}
        y={LAYOUT.fusionpbxY}
        name={status.fusionpbx.primary.name}
        ip={status.fusionpbx.primary.ip}
        status={status.fusionpbx.primary.status}
        role="primary"
        latency={status.fusionpbx.primary.latency}
        onClick={() => onServerClick?.('fusionpbx-primary')}
      />
      <ServerNode
        x={LAYOUT.secondaryX}
        y={LAYOUT.fusionpbxY}
        name={status.fusionpbx.secondary.name}
        ip={status.fusionpbx.secondary.ip}
        status={status.fusionpbx.secondary.status}
        role="secondary"
        latency={status.fusionpbx.secondary.latency}
        onClick={() => onServerClick?.('fusionpbx-secondary')}
      />

      {/* PostgreSQL servers */}
      <ServerNode
        x={LAYOUT.primaryX}
        y={LAYOUT.postgresY}
        name={status.postgresql.primary.name}
        ip={status.postgresql.primary.ip}
        status={status.postgresql.primary.status}
        role={status.postgresql.primary.patroniRole}
        latency={status.postgresql.primary.latency}
        onClick={() => onServerClick?.('postgresql-primary')}
      />
      <ServerNode
        x={LAYOUT.secondaryX}
        y={LAYOUT.postgresY}
        name={status.postgresql.secondary.name}
        ip={status.postgresql.secondary.ip}
        status={status.postgresql.secondary.status}
        role={status.postgresql.secondary.patroniRole}
        latency={status.postgresql.secondary.latency}
        onClick={() => onServerClick?.('postgresql-secondary')}
      />

      {/* Monitor server */}
      <ServerNode
        x={LAYOUT.primaryX}
        y={LAYOUT.monitorY}
        name={status.monitor.name}
        ip={status.monitor.ip}
        status={status.monitor.status}
        role="monitor"
        latency={status.monitor.latency}
        onClick={() => onServerClick?.('monitor')}
      />

      {/* Backup Monitor (bkpserver) */}
      <ServerNode
        x={LAYOUT.secondaryX}
        y={LAYOUT.bkpserverY}
        name={status.bkpserver.name}
        ip={status.bkpserver.ip}
        status={status.bkpserver.status}
        role="backup"
        latency={status.bkpserver.latency}
        onClick={() => onServerClick?.('bkpserver')}
      />

      {/* Redis replication line: Monitor → bkpserver */}
      <ConnectionLine
        x1={LAYOUT.primaryX + 70}
        y1={LAYOUT.monitorY}
        x2={LAYOUT.secondaryX - 70}
        y2={LAYOUT.bkpserverY}
        active={status.monitor.status === 'healthy' && status.bkpserver.status === 'healthy'}
        label="Redis Repl"
        dashed
      />

      {/* API Gateway */}
      <ServerNode
        x={LAYOUT.centerX}
        y={LAYOUT.apigatewayY}
        name={status.apigateway.name}
        ip={status.apigateway.ip}
        status={status.apigateway.status}
        role="gateway"
        latency={status.apigateway.latency}
        onClick={() => onServerClick?.('apigateway')}
      />

      {/* Overall status indicator */}
      <g transform={`translate(${LAYOUT.width - 120}, 20)`}>
        <rect
          x="0"
          y="0"
          width="100"
          height="30"
          rx="15"
          fill={
            status.overallStatus === 'healthy'
              ? 'rgba(34, 197, 94, 0.2)'
              : status.overallStatus === 'degraded'
                ? 'rgba(234, 179, 8, 0.2)'
                : 'rgba(239, 68, 68, 0.2)'
          }
          stroke={
            status.overallStatus === 'healthy'
              ? '#22c55e'
              : status.overallStatus === 'degraded'
                ? '#eab308'
                : '#ef4444'
          }
          strokeWidth="2"
        />
        <circle
          cx="20"
          cy="15"
          r="5"
          fill={
            status.overallStatus === 'healthy'
              ? '#22c55e'
              : status.overallStatus === 'degraded'
                ? '#eab308'
                : '#ef4444'
          }
        >
          {status.overallStatus !== 'healthy' && (
            <animate attributeName="opacity" values="1;0.3;1" dur="1s" repeatCount="indefinite" />
          )}
        </circle>
        <text
          x="55"
          y="19"
          fontSize="10"
          fontWeight="600"
          fill="currentColor"
          textAnchor="middle"
          className="select-none uppercase"
        >
          {status.overallStatus}
        </text>
      </g>

      {/* Timestamp */}
      <text
        x={LAYOUT.width - 10}
        y={LAYOUT.height - 10}
        fontSize="9"
        fill="currentColor"
        opacity="0.4"
        textAnchor="end"
        className="select-none"
      >
        {new Date(status.timestamp).toLocaleTimeString()}
      </text>

      {/* Connectivity Test Overlay */}
      <ConnectivityTestOverlay
        isRunning={isTestingConnectivity}
        results={connectivityResults}
        onComplete={onTestComplete}
      />
    </svg>
  );
}
