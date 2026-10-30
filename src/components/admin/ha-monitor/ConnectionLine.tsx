'use client';

import React from 'react';

interface ConnectionLineProps {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  active?: boolean;
  bidirectional?: boolean;
  label?: string;
  dashed?: boolean;
}

export function ConnectionLine({
  x1,
  y1,
  x2,
  y2,
  active = true,
  bidirectional = false,
  label,
  dashed = false,
}: ConnectionLineProps) {
  const pathId = `path-${x1}-${y1}-${x2}-${y2}`;
  const midX = (x1 + x2) / 2;
  const midY = (y1 + y2) / 2;

  // Calculate control points for a slight curve
  const dx = x2 - x1;
  const dy = y2 - y1;
  const perpX = -dy * 0.1;
  const perpY = dx * 0.1;
  const ctrlX = midX + perpX;
  const ctrlY = midY + perpY;

  const path = `M ${x1} ${y1} Q ${ctrlX} ${ctrlY} ${x2} ${y2}`;

  return (
    <g className="connection-line">
      {/* Shadow/glow for active connections */}
      {active && (
        <path
          d={path}
          fill="none"
          stroke="#3b82f6"
          strokeWidth="4"
          opacity="0.2"
          className="blur-sm"
        />
      )}

      {/* Main line */}
      <path
        id={pathId}
        d={path}
        fill="none"
        stroke={active ? '#3b82f6' : '#6b7280'}
        strokeWidth="2"
        strokeDasharray={dashed ? '5,5' : undefined}
        opacity={active ? 1 : 0.4}
        className="transition-all duration-300"
      />

      {/* Animated packet for active connections */}
      {active && (
        <>
          <circle r="4" fill="#3b82f6" className="packet-dot">
            <animateMotion dur="1.5s" repeatCount="indefinite" path={path} />
          </circle>
          <circle r="4" fill="#3b82f6" className="packet-dot">
            <animateMotion dur="1.5s" repeatCount="indefinite" path={path} begin="0.5s" />
          </circle>
          <circle r="4" fill="#3b82f6" className="packet-dot">
            <animateMotion dur="1.5s" repeatCount="indefinite" path={path} begin="1s" />
          </circle>
        </>
      )}

      {/* Reverse direction packets for bidirectional */}
      {active && bidirectional && (
        <>
          <circle r="3" fill="#22c55e" className="packet-dot">
            <animateMotion
              dur="1.5s"
              repeatCount="indefinite"
              path={`M ${x2} ${y2} Q ${ctrlX} ${ctrlY} ${x1} ${y1}`}
            />
          </circle>
          <circle r="3" fill="#22c55e" className="packet-dot">
            <animateMotion
              dur="1.5s"
              repeatCount="indefinite"
              path={`M ${x2} ${y2} Q ${ctrlX} ${ctrlY} ${x1} ${y1}`}
              begin="0.75s"
            />
          </circle>
        </>
      )}

      {/* Label */}
      {label && (
        <text
          x={midX}
          y={midY - 8}
          fontSize="9"
          fill="currentColor"
          textAnchor="middle"
          opacity="0.6"
          className="select-none"
        >
          {label}
        </text>
      )}

      <style jsx>{`
        .packet-dot {
          filter: drop-shadow(0 0 3px #3b82f6);
        }
      `}</style>
    </g>
  );
}
