'use client';

import React from 'react';
import type { FloatingIPStatus } from '@/lib/api/services/ha.service';

interface FloatingIPIndicatorProps {
  x: number;
  y: number;
  floatingIP: FloatingIPStatus;
  primaryX: number;
  secondaryX: number;
  targetY: number;
}

export function FloatingIPIndicator({
  x,
  y,
  floatingIP,
  primaryX,
  secondaryX,
  targetY,
}: FloatingIPIndicatorProps) {
  const targetX = floatingIP.assignedTo === 'primary' ? primaryX : secondaryX;
  const isUnknown = floatingIP.assignedTo === 'unknown';

  return (
    <g className="floating-ip-indicator">
      {/* Floating IP box */}
      <g transform={`translate(${x}, ${y})`}>
        {/* Glow */}
        <ellipse
          cx="0"
          cy="0"
          rx="75"
          ry="25"
          fill="none"
          stroke="#a855f7"
          strokeWidth="1"
          opacity="0.3"
          className="animate-pulse"
        />

        {/* Background */}
        <rect
          x="-70"
          y="-20"
          width="140"
          height="40"
          rx="20"
          fill="rgba(168, 85, 247, 0.1)"
          stroke="#a855f7"
          strokeWidth="2"
        />

        {/* Cloud/Internet icon */}
        <g transform="translate(-50, -8)">
          <path
            d="M16 8c0-2.2-1.8-4-4-4-1.5 0-2.9.9-3.5 2.1C7.8 5.4 6.9 5 6 5c-2.2 0-4 1.8-4 4 0 .3 0 .5.1.8C.8 10.2 0 11.5 0 13c0 2.2 1.8 4 4 4h12c2.2 0 4-1.8 4-4 0-1.6-1-3-2.4-3.6-.1-.4-.2-.9-.6-1.4z"
            fill="#a855f7"
            opacity="0.3"
          />
        </g>

        {/* IP address */}
        <text
          x="0"
          y="0"
          fontSize="11"
          fontWeight="600"
          fill="#a855f7"
          textAnchor="middle"
          dominantBaseline="middle"
          fontFamily="monospace"
          className="select-none"
        >
          {floatingIP.ip}
        </text>

        {/* Label */}
        <text
          x="0"
          y="-30"
          fontSize="9"
          fill="currentColor"
          textAnchor="middle"
          opacity="0.6"
          className="select-none"
        >
          Floating IP
        </text>
      </g>

      {/* Connection line to active server */}
      {!isUnknown && (
        <>
          {/* Glowing line */}
          <line
            x1={x}
            y1={y + 20}
            x2={targetX}
            y2={targetY - 45}
            stroke="#a855f7"
            strokeWidth="3"
            opacity="0.3"
            className="blur-sm"
          />

          {/* Main line */}
          <line
            x1={x}
            y1={y + 20}
            x2={targetX}
            y2={targetY - 45}
            stroke="#a855f7"
            strokeWidth="2"
            strokeDasharray="5,3"
          >
            <animate
              attributeName="stroke-dashoffset"
              from="0"
              to="-16"
              dur="0.5s"
              repeatCount="indefinite"
            />
          </line>

          {/* Arrow indicator */}
          <g transform={`translate(${targetX}, ${targetY - 45})`}>
            <polygon points="0,0 -6,-10 6,-10" fill="#a855f7" />
          </g>
        </>
      )}

      {/* Assignment status badge */}
      <g transform={`translate(${x + 80}, ${y - 5})`}>
        <rect
          x="0"
          y="0"
          width="80"
          height="20"
          rx="10"
          fill={isUnknown ? 'rgba(239, 68, 68, 0.2)' : 'rgba(34, 197, 94, 0.2)'}
          stroke={isUnknown ? '#ef4444' : '#22c55e'}
          strokeWidth="1"
        />
        <text
          x="40"
          y="14"
          fontSize="9"
          fontWeight="500"
          fill={isUnknown ? '#ef4444' : '#22c55e'}
          textAnchor="middle"
          className="select-none uppercase"
        >
          {floatingIP.assignedTo}
        </text>
      </g>
    </g>
  );
}
