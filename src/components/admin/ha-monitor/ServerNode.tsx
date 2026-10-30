'use client';

import React from 'react';
import type { ServerStatus, KeepalivedRole, PatroniRole } from '@/lib/api/services/ha.service';

interface ServerNodeProps {
  x: number;
  y: number;
  name: string;
  ip: string;
  status: ServerStatus;
  role?: KeepalivedRole | PatroniRole | string;
  latency?: number;
  isActive?: boolean;
  onClick?: () => void;
}

const statusColors = {
  healthy: {
    stroke: '#22c55e',
    fill: 'rgba(34, 197, 94, 0.1)',
    glow: 'rgba(34, 197, 94, 0.3)',
  },
  degraded: {
    stroke: '#eab308',
    fill: 'rgba(234, 179, 8, 0.1)',
    glow: 'rgba(234, 179, 8, 0.3)',
  },
  down: {
    stroke: '#ef4444',
    fill: 'rgba(239, 68, 68, 0.1)',
    glow: 'rgba(239, 68, 68, 0.3)',
  },
  unknown: {
    stroke: '#6b7280',
    fill: 'rgba(107, 114, 128, 0.1)',
    glow: 'rgba(107, 114, 128, 0.3)',
  },
};

const roleColors: Record<string, string> = {
  MASTER: '#22c55e',
  BACKUP: '#6b7280',
  FAULT: '#ef4444',
  leader: '#22c55e',
  replica: '#3b82f6',
  primary: '#22c55e',
  secondary: '#3b82f6',
};

export function ServerNode({
  x,
  y,
  name,
  ip,
  status,
  role,
  latency,
  isActive = false,
  onClick,
}: ServerNodeProps) {
  const colors = statusColors[status] || statusColors.unknown;
  const roleColor = role ? roleColors[role] || '#6b7280' : undefined;

  return (
    <g
      transform={`translate(${x}, ${y})`}
      onClick={onClick}
      style={{ cursor: onClick ? 'pointer' : 'default' }}
      className="server-node"
    >
      {/* Glow effect for active/healthy servers */}
      {(isActive || status === 'healthy') && (
        <rect
          x="-75"
          y="-45"
          width="150"
          height="90"
          rx="12"
          fill="none"
          stroke={colors.stroke}
          strokeWidth="1"
          opacity="0.3"
          className="animate-pulse"
        />
      )}

      {/* Main background */}
      <rect
        x="-70"
        y="-40"
        width="140"
        height="80"
        rx="8"
        fill={colors.fill}
        stroke={colors.stroke}
        strokeWidth="2"
        className="transition-all duration-300"
      />

      {/* Server icon */}
      <g transform="translate(-55, -25)">
        <rect x="0" y="0" width="24" height="18" rx="2" fill={colors.stroke} opacity="0.3" />
        <line x1="0" y1="6" x2="24" y2="6" stroke={colors.stroke} strokeWidth="1" opacity="0.5" />
        <line x1="0" y1="12" x2="24" y2="12" stroke={colors.stroke} strokeWidth="1" opacity="0.5" />
        <circle cx="20" cy="3" r="1.5" fill={colors.stroke} />
        <circle cx="20" cy="9" r="1.5" fill={status === 'healthy' ? '#22c55e' : colors.stroke} />
        <circle cx="20" cy="15" r="1.5" fill={status === 'down' ? '#ef4444' : colors.stroke} />
      </g>

      {/* Server name */}
      <text
        x="-25"
        y="-18"
        fontSize="11"
        fontWeight="600"
        fill="currentColor"
        className="select-none"
      >
        {name}
      </text>

      {/* IP address */}
      <text
        x="-25"
        y="-3"
        fontSize="9"
        fill="currentColor"
        opacity="0.7"
        fontFamily="monospace"
        className="select-none"
      >
        {ip}
      </text>

      {/* Status indicator */}
      <circle cx="-55" cy="20" r="5" fill={colors.stroke}>
        {status === 'down' && (
          <animate attributeName="opacity" values="1;0.3;1" dur="1s" repeatCount="indefinite" />
        )}
      </circle>

      {/* Role badge */}
      {role && (
        <g transform="translate(15, 10)">
          <rect x="0" y="0" width="50" height="18" rx="9" fill={roleColor} opacity="0.2" />
          <text
            x="25"
            y="13"
            fontSize="9"
            fontWeight="500"
            fill={roleColor}
            textAnchor="middle"
            className="select-none uppercase"
          >
            {role}
          </text>
        </g>
      )}

      {/* Latency */}
      {latency !== undefined && latency >= 0 && (
        <text x="-40" y="25" fontSize="8" fill="currentColor" opacity="0.6" className="select-none">
          {latency}ms
        </text>
      )}
    </g>
  );
}
