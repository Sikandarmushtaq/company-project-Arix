'use client';

import React, { useEffect, useState, useCallback } from 'react';
import type { ConnectionTestResult } from '@/lib/api/services/ha.service';

interface ConnectivityTestOverlayProps {
  isRunning: boolean;
  results?: ConnectionTestResult[];
  onComplete?: () => void;
}

// Layout constants — MUST match HATopologyMap
const LAYOUT = {
  width: 900,
  height: 850,
  internetY: 50,
  floatingIPY: 100,
  kamailioY: 200,
  rtpengineY: 280,
  fusionpbxY: 370,
  postgresY: 510,
  monitorY: 630,
  bkpserverY: 630,
  apigatewayY: 770,
  centerX: 450,
  primaryX: 280,
  secondaryX: 620,
} as const;

interface TestStep {
  id: string;
  nodeName: string;
  x: number;
  y: number;
  delay: number;
}

const TEST_STEPS: TestStep[] = [
  { id: 'internet', nodeName: 'Internet', x: LAYOUT.centerX, y: LAYOUT.internetY, delay: 0 },
  {
    id: 'floating-ip',
    nodeName: 'Floating IP',
    x: LAYOUT.primaryX,
    y: LAYOUT.floatingIPY,
    delay: 600,
  },
  {
    id: 'kamailio-primary',
    nodeName: 'Kamailio PRIMARY',
    x: LAYOUT.primaryX,
    y: LAYOUT.kamailioY,
    delay: 1200,
  },
  {
    id: 'kamailio-secondary',
    nodeName: 'Kamailio SECONDARY',
    x: LAYOUT.secondaryX,
    y: LAYOUT.kamailioY,
    delay: 1800,
  },
  {
    id: 'fusionpbx-primary',
    nodeName: 'FusionPBX PRIMARY',
    x: LAYOUT.primaryX,
    y: LAYOUT.fusionpbxY,
    delay: 2400,
  },
  {
    id: 'fusionpbx-secondary',
    nodeName: 'FusionPBX SECONDARY',
    x: LAYOUT.secondaryX,
    y: LAYOUT.fusionpbxY,
    delay: 3000,
  },
  {
    id: 'postgresql-primary',
    nodeName: 'PostgreSQL PRIMARY',
    x: LAYOUT.primaryX,
    y: LAYOUT.postgresY,
    delay: 3600,
  },
  {
    id: 'postgresql-secondary',
    nodeName: 'PostgreSQL SECONDARY',
    x: LAYOUT.secondaryX,
    y: LAYOUT.postgresY,
    delay: 4200,
  },
  { id: 'monitor', nodeName: 'Monitor', x: LAYOUT.primaryX, y: LAYOUT.monitorY, delay: 4800 },
  {
    id: 'bkpserver',
    nodeName: 'Backup Monitor',
    x: LAYOUT.secondaryX,
    y: LAYOUT.bkpserverY,
    delay: 5400,
  },
  {
    id: 'apigateway',
    nodeName: 'API Gateway',
    x: LAYOUT.centerX,
    y: LAYOUT.apigatewayY,
    delay: 6000,
  },
];

interface PacketPath {
  from: string;
  to: string;
  path: string;
  delay: number;
  duration: number;
}

const PACKET_PATHS: PacketPath[] = [
  // Internet → Floating IP (SIP path)
  {
    from: 'internet',
    to: 'floating-ip',
    path: `M ${LAYOUT.primaryX} ${LAYOUT.internetY} L ${LAYOUT.primaryX} ${LAYOUT.floatingIPY}`,
    delay: 0,
    duration: 600,
  },
  // Floating IP → Kamailio PRIMARY
  {
    from: 'floating-ip',
    to: 'kamailio-primary',
    path: `M ${LAYOUT.primaryX} ${LAYOUT.floatingIPY + 20} L ${LAYOUT.primaryX} ${LAYOUT.kamailioY - 40}`,
    delay: 600,
    duration: 600,
  },
  // Kamailio cross-node
  {
    from: 'kamailio-primary',
    to: 'kamailio-secondary',
    path: `M ${LAYOUT.primaryX + 70} ${LAYOUT.kamailioY} L ${LAYOUT.secondaryX - 70} ${LAYOUT.kamailioY}`,
    delay: 1200,
    duration: 600,
  },
  // Kamailio → FusionPBX
  {
    from: 'kamailio-primary',
    to: 'fusionpbx-primary',
    path: `M ${LAYOUT.primaryX} ${LAYOUT.kamailioY + 40} L ${LAYOUT.primaryX} ${LAYOUT.fusionpbxY - 40}`,
    delay: 1800,
    duration: 600,
  },
  {
    from: 'kamailio-secondary',
    to: 'fusionpbx-secondary',
    path: `M ${LAYOUT.secondaryX} ${LAYOUT.kamailioY + 40} L ${LAYOUT.secondaryX} ${LAYOUT.fusionpbxY - 40}`,
    delay: 2400,
    duration: 600,
  },
  // FusionPBX → PostgreSQL
  {
    from: 'fusionpbx-primary',
    to: 'postgresql-primary',
    path: `M ${LAYOUT.primaryX} ${LAYOUT.fusionpbxY + 40} L ${LAYOUT.primaryX} ${LAYOUT.postgresY - 40}`,
    delay: 3000,
    duration: 600,
  },
  {
    from: 'fusionpbx-secondary',
    to: 'postgresql-secondary',
    path: `M ${LAYOUT.secondaryX} ${LAYOUT.fusionpbxY + 40} L ${LAYOUT.secondaryX} ${LAYOUT.postgresY - 40}`,
    delay: 3600,
    duration: 600,
  },
  // PostgreSQL → Monitor
  {
    from: 'postgresql-primary',
    to: 'monitor',
    path: `M ${LAYOUT.primaryX} ${LAYOUT.postgresY + 40} L ${LAYOUT.primaryX} ${LAYOUT.monitorY - 20}`,
    delay: 4200,
    duration: 600,
  },
  // Monitor → bkpserver (Redis replication)
  {
    from: 'monitor',
    to: 'bkpserver',
    path: `M ${LAYOUT.primaryX + 70} ${LAYOUT.monitorY} L ${LAYOUT.secondaryX - 70} ${LAYOUT.bkpserverY}`,
    delay: 4800,
    duration: 600,
  },
  // Down to API Gateway
  {
    from: 'bkpserver',
    to: 'apigateway',
    path: `M ${LAYOUT.secondaryX} ${LAYOUT.bkpserverY + 40} L ${LAYOUT.centerX} ${LAYOUT.apigatewayY - 20}`,
    delay: 5400,
    duration: 600,
  },
];

interface NodeStatus {
  verified: boolean;
  success: boolean;
}

export function ConnectivityTestOverlay({
  isRunning,
  results,
  onComplete,
}: ConnectivityTestOverlayProps) {
  const [nodeStatuses, setNodeStatuses] = useState<Map<string, NodeStatus>>(new Map());
  const [activePackets, setActivePackets] = useState<Set<string>>(new Set());
  const [currentStep, setCurrentStep] = useState(0);

  const getNodeTestResult = useCallback(
    (nodeId: string, testResults?: ConnectionTestResult[]): boolean => {
      if (!testResults || testResults.length === 0) return true;

      // Map node IDs to how we check results
      switch (nodeId) {
        case 'internet':
        case 'floating-ip':
          return true;
        case 'kamailio-primary':
          return testResults.filter((r) => r.from === 'Kamailio-PRIMARY').every((r) => r.success);
        case 'kamailio-secondary':
          return testResults.filter((r) => r.from === 'Kamailio-SECONDARY').every((r) => r.success);
        case 'fusionpbx-primary':
          return testResults
            .filter((r) => r.to.includes('FusionPBX-PRIMARY') || r.from === 'FusionPBX-PRIMARY')
            .every((r) => r.success);
        case 'fusionpbx-secondary':
          return testResults
            .filter((r) => r.to.includes('FusionPBX-SECONDARY') || r.from === 'FusionPBX-SECONDARY')
            .every((r) => r.success);
        case 'postgresql-primary':
          return testResults
            .filter((r) => r.to.includes('PostgreSQL-PRIMARY'))
            .every((r) => r.success);
        case 'postgresql-secondary':
          return testResults
            .filter((r) => r.to.includes('PostgreSQL-SECONDARY'))
            .every((r) => r.success);
        case 'monitor':
          return testResults.filter((r) => r.from === 'Monitor').every((r) => r.success);
        case 'bkpserver':
          return testResults.filter((r) => r.from === 'Bkpserver').every((r) => r.success);
        case 'apigateway':
          return testResults.filter((r) => r.from === 'API Gateway').every((r) => r.success);
        default:
          return true;
      }
    },
    []
  );

  // Reset state when test starts
  useEffect(() => {
    if (isRunning) {
      setNodeStatuses(new Map());
      setActivePackets(new Set());
      setCurrentStep(0);
    }
  }, [isRunning]);

  // Animate through test steps
  useEffect(() => {
    if (!isRunning) return;

    const timers: NodeJS.Timeout[] = [];

    TEST_STEPS.forEach((step, index) => {
      const timer = setTimeout(() => {
        setCurrentStep(index);
        setNodeStatuses((prev) => {
          const newMap = new Map(prev);
          newMap.set(step.id, { verified: true, success: getNodeTestResult(step.id, results) });
          return newMap;
        });
      }, step.delay);
      timers.push(timer);
    });

    PACKET_PATHS.forEach((packet) => {
      const startTimer = setTimeout(() => {
        setActivePackets((prev) => new Set(prev).add(`${packet.from}-${packet.to}`));
      }, packet.delay);

      const endTimer = setTimeout(() => {
        setActivePackets((prev) => {
          const s = new Set(prev);
          s.delete(`${packet.from}-${packet.to}`);
          return s;
        });
      }, packet.delay + packet.duration);

      timers.push(startTimer, endTimer);
    });

    // Complete after last step + buffer
    const completeTimer = setTimeout(() => {
      onComplete?.();
    }, 7000);
    timers.push(completeTimer);

    return () => {
      timers.forEach(clearTimeout);
    };
  }, [isRunning, onComplete, getNodeTestResult, results]);

  // Update badges when real results arrive
  useEffect(() => {
    if (results && results.length > 0 && nodeStatuses.size > 0) {
      setNodeStatuses((prev) => {
        const newMap = new Map(prev);
        TEST_STEPS.forEach((step) => {
          if (newMap.has(step.id)) {
            newMap.set(step.id, { verified: true, success: getNodeTestResult(step.id, results) });
          }
        });
        return newMap;
      });
    }
  }, [results, getNodeTestResult, nodeStatuses.size]);

  if (!isRunning && nodeStatuses.size === 0) return null;

  return (
    <g className="connectivity-test-overlay">
      <defs>
        <linearGradient id="testPacketGradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#06b6d4" />
          <stop offset="50%" stopColor="#a855f7" />
          <stop offset="100%" stopColor="#06b6d4" />
        </linearGradient>
        <filter id="testPacketGlow" x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur stdDeviation="6" result="blur" />
          <feFlood floodColor="#06b6d4" floodOpacity="0.6" result="color" />
          <feComposite in="color" in2="blur" operator="in" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="successGlow" x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="#22c55e" floodOpacity="0.8" />
        </filter>
        <filter id="failGlow" x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="#ef4444" floodOpacity="0.8" />
        </filter>
      </defs>

      {/* Animated test packets */}
      {PACKET_PATHS.map((packet) => {
        const isActive = activePackets.has(`${packet.from}-${packet.to}`);
        if (!isActive) return null;

        return (
          <g key={`${packet.from}-${packet.to}`}>
            <circle
              r="18"
              fill="url(#testPacketGradient)"
              opacity="0.2"
              filter="url(#testPacketGlow)"
            >
              <animateMotion dur={`${packet.duration}ms`} fill="freeze" path={packet.path} />
            </circle>
            <circle
              r="12"
              fill="url(#testPacketGradient)"
              opacity="0.5"
              filter="url(#testPacketGlow)"
            >
              <animateMotion dur={`${packet.duration}ms`} fill="freeze" path={packet.path} />
            </circle>
            <circle r="8" fill="url(#testPacketGradient)" filter="url(#testPacketGlow)">
              <animateMotion dur={`${packet.duration}ms`} fill="freeze" path={packet.path} />
            </circle>
            <circle r="4" fill="#ffffff">
              <animateMotion dur={`${packet.duration}ms`} fill="freeze" path={packet.path} />
            </circle>
          </g>
        );
      })}

      {/* Node verification badges */}
      {TEST_STEPS.map((step) => {
        const status = nodeStatuses.get(step.id);
        if (!status?.verified) return null;
        if (step.id === 'internet' || step.id === 'floating-ip') return null;

        return (
          <g
            key={`badge-${step.id}`}
            transform={`translate(${step.x + 50}, ${step.y - 35})`}
            className="verification-badge"
          >
            <circle
              r="14"
              fill={status.success ? '#22c55e' : '#ef4444'}
              filter={status.success ? 'url(#successGlow)' : 'url(#failGlow)'}
            >
              <animate attributeName="r" from="0" to="14" dur="0.3s" fill="freeze" />
            </circle>
            <g transform="translate(-7, -7)">
              {status.success ? (
                <path
                  d="M3 7l4 4 8-8"
                  fill="none"
                  stroke="white"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <animate
                    attributeName="stroke-dasharray"
                    from="0 20"
                    to="20 0"
                    dur="0.3s"
                    fill="freeze"
                  />
                </path>
              ) : (
                <>
                  <line
                    x1="3"
                    y1="3"
                    x2="11"
                    y2="11"
                    stroke="white"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  />
                  <line
                    x1="11"
                    y1="3"
                    x2="3"
                    y2="11"
                    stroke="white"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  />
                </>
              )}
            </g>
          </g>
        );
      })}

      {/* Progress indicator */}
      {isRunning && (
        <g transform={`translate(${LAYOUT.width / 2}, ${LAYOUT.height - 30})`}>
          <rect x="-100" y="-10" width="200" height="20" rx="10" fill="rgba(0, 0, 0, 0.3)" />
          <rect
            x="-95"
            y="-5"
            width={((currentStep + 1) / TEST_STEPS.length) * 190}
            height="10"
            rx="5"
            fill="url(#testPacketGradient)"
            className="transition-all duration-300"
          />
          <text x="0" y="25" fontSize="10" fill="currentColor" textAnchor="middle" opacity="0.7">
            Testing: {TEST_STEPS[currentStep]?.nodeName || 'Complete'}
          </text>
        </g>
      )}

      <style>{`
        .verification-badge {
          animation: badge-pop 0.3s ease-out;
        }
        @keyframes badge-pop {
          0% { transform: scale(0); opacity: 0; }
          50% { transform: scale(1.2); }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </g>
  );
}
