'use client';

/**
 * Live Call Actions
 *
 * MonitoringStatusPanel and CallCard components for live call monitoring,
 * whisper, and barge actions.
 *
 * @module app/admin/live-calls/LiveCallActions
 */

import React from 'react';
import { formatLocalTime } from '@/lib/utils/datetime';
import {
  FiPhone,
  FiPhoneIncoming,
  FiPhoneOutgoing,
  FiClock,
  FiUser,
  FiVolumeX,
  FiMicOff,
  FiEye,
  FiMessageCircle,
  FiUsers,
  FiPhoneOff,
  FiTrash2,
  FiAlertTriangle,
} from 'react-icons/fi';
import { Card, CardContent, Button } from '@/components/ui';
import { formatPhoneNumber } from '@/lib/utils/phone';
import type { ActiveCall } from '@/lib/api';

// ─── Monitor Mode Types ────────────────────────────────────────
export type MonitorMode = 'monitor' | 'whisper' | 'barge';

const MONITOR_MODE_CONFIG: Record<
  MonitorMode,
  {
    label: string;
    description: string;
    colors: { bg: string; border: string; cardBg: string };
  }
> = {
  monitor: {
    label: 'Silent Monitoring Active',
    description: 'Answer your phone to listen to the call',
    colors: {
      bg: 'bg-blue-500',
      border: 'border-blue-500',
      cardBg: 'bg-blue-50 dark:bg-blue-950',
    },
  },
  whisper: {
    label: 'Whisper Mode Active',
    description: 'Answer your phone to speak to the agent',
    colors: {
      bg: 'bg-yellow-500',
      border: 'border-yellow-500',
      cardBg: 'bg-yellow-50 dark:bg-yellow-950',
    },
  },
  barge: {
    label: 'Barge Mode Active',
    description: 'Answer your phone to join the call',
    colors: {
      bg: 'bg-orange-500',
      border: 'border-orange-500',
      cardBg: 'bg-orange-50 dark:bg-orange-950',
    },
  },
};

function getMonitorModeIcon(mode: MonitorMode) {
  switch (mode) {
    case 'monitor':
      return <FiEye className="w-6 h-6 text-white" aria-hidden="true" />;
    case 'whisper':
      return <FiMessageCircle className="w-6 h-6 text-white" aria-hidden="true" />;
    case 'barge':
      return <FiUsers className="w-6 h-6 text-white" aria-hidden="true" />;
  }
}

// ─── Utility Functions ─────────────────────────────────────────
function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'ringing':
      return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300';
    case 'active':
      return 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300';
    case 'on-hold':
      return 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300';
    default:
      return 'bg-gray-100 text-gray-700 dark:bg-gray-900 dark:text-gray-300';
  }
}

function getDirectionIcon(direction: string) {
  switch (direction) {
    case 'inbound':
      return <FiPhoneIncoming className="w-4 h-4 text-green-500" aria-hidden="true" />;
    case 'outbound':
      return <FiPhoneOutgoing className="w-4 h-4 text-blue-500" aria-hidden="true" />;
    default:
      return <FiPhone className="w-4 h-4 text-gray-500" aria-hidden="true" />;
  }
}

// ─── MonitoringStatusPanel ─────────────────────────────────────
export interface MonitoringStatusPanelProps {
  mode: MonitorMode;
  extension: string;
  sessionId: string | null;
  onStop: () => void;
}

export const MonitoringStatusPanel = React.memo(function MonitoringStatusPanel({
  mode,
  extension,
  sessionId,
  onStop,
}: MonitoringStatusPanelProps) {
  const config = MONITOR_MODE_CONFIG[mode];

  return (
    <Card className={`border-2 ${config.colors.border} ${config.colors.cardBg}`}>
      <CardContent className="py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex-shrink-0">
              <div className="relative">
                <div
                  className={`w-12 h-12 rounded-full ${config.colors.bg} flex items-center justify-center`}
                >
                  {getMonitorModeIcon(mode)}
                </div>
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full animate-pulse" />
              </div>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-[var(--foreground)]">{config.label}</h3>
              <p className="text-sm text-[var(--muted-foreground)]">
                Extension: <span className="font-mono font-semibold">{extension}</span>
                {sessionId && (
                  <span className="ml-2 text-xs opacity-75">
                    Session: {sessionId.slice(0, 12)}...
                  </span>
                )}
              </p>
              <p className="text-xs text-[var(--muted-foreground)] mt-1">{config.description}</p>
            </div>
          </div>
          <Button variant="danger" size="sm" onClick={onStop} className="flex items-center gap-2">
            <FiPhoneOff className="w-4 h-4" aria-hidden="true" />
            Stop
          </Button>
        </div>
      </CardContent>
    </Card>
  );
});

// ─── CallCard ──────────────────────────────────────────────────
export interface CallCardProps {
  call: ActiveCall;
  currentTime: number;
  onMonitor: (callId: string, extension: string) => void;
  onWhisper: (callId: string, extension: string) => void;
  onBarge: (callId: string, extension: string) => void;
  onClearStale: (callId: string) => void;
  isMonitoring: boolean;
}

export const CallCard = React.memo(function CallCard({
  call,
  currentTime,
  onMonitor,
  onWhisper,
  onBarge,
  onClearStale,
  isMonitoring,
}: CallCardProps) {
  // Calculate live duration
  const startTime = new Date(call.startTime).getTime();
  const duration =
    call.status === 'active' ? Math.floor((currentTime - startTime) / 1000) : call.duration;

  const isActive = call.status === 'active';
  const isStale = call.isStale === true;

  return (
    <Card
      className={`transition-all duration-300 overflow-hidden ${
        isStale
          ? 'ring-2 ring-red-500 bg-red-50 dark:bg-red-950/30'
          : call.status === 'ringing'
            ? 'ring-2 ring-yellow-500 animate-pulse'
            : ''
      }`}
    >
      <CardContent className="pt-4">
        {/* Stale Call Warning Banner */}
        {isStale && (
          <div className="mb-3 -mt-1 -mx-4 px-4 py-2 bg-red-100 dark:bg-red-900/50 border-b border-red-200 dark:border-red-800 flex items-center justify-between">
            <div className="flex items-center gap-2 text-red-700 dark:text-red-300">
              <FiAlertTriangle className="w-4 h-4" />
              <span className="text-sm font-medium">Stale Call Record</span>
            </div>
            <Button
              variant="danger"
              size="sm"
              onClick={() => onClearStale(call.id)}
              className="text-xs h-7"
            >
              <FiTrash2 className="w-3.5 h-3.5 mr-1" />
              Clear
            </Button>
          </div>
        )}

        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="flex-shrink-0">{getDirectionIcon(call.direction)}</div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-[var(--foreground)] truncate">
                  Ext: {call.extension}
                </span>
                <span
                  className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full capitalize flex-shrink-0 ${
                    isStale
                      ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
                      : getStatusColor(call.status)
                  }`}
                >
                  {isStale ? 'stale' : call.status}
                </span>
              </div>
              <div className="text-sm text-[var(--muted-foreground)] mt-1 truncate">
                {call.direction === 'inbound' ? 'From:' : 'To:'}{' '}
                <span className="font-mono">{formatPhoneNumber(call.remotePhone)}</span>
              </div>
            </div>
          </div>

          <div className="text-right flex-shrink-0 min-w-[80px]">
            <div
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg ${
                isStale ? 'bg-red-100 dark:bg-red-900/50' : 'bg-[var(--muted)]'
              }`}
            >
              <FiClock
                className={`w-4 h-4 flex-shrink-0 ${isStale ? 'text-red-500' : 'text-[var(--muted-foreground)]'}`}
                aria-hidden="true"
              />
              <span
                className={`font-mono font-semibold text-base tabular-nums ${
                  isStale ? 'text-red-600 dark:text-red-400' : 'text-[var(--foreground)]'
                }`}
              >
                {formatDuration(duration)}
              </span>
            </div>
            <div className="flex items-center justify-end gap-2 mt-2">
              {call.isMuted && (
                <span className="text-red-500" title="Muted">
                  <FiMicOff className="w-4 h-4" aria-hidden="true" />
                </span>
              )}
              {call.isOnHold && (
                <span className="text-orange-500" title="On Hold">
                  <FiVolumeX className="w-4 h-4" aria-hidden="true" />
                </span>
              )}
              {call.isRecording && (
                <span className="text-red-500 animate-pulse" title="Recording">
                  <span className="w-2 h-2 bg-red-500 rounded-full inline-block" />
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Monitoring Actions - Only show for active non-stale calls */}
        {isActive && !isStale && (
          <div className="mt-3 pt-3 border-t border-[var(--border)]">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onMonitor(call.id, call.extension)}
                disabled={isMonitoring}
                className="flex-1 text-xs"
                title="Silent Monitor - Listen to the call without being heard"
              >
                <FiEye className="w-3.5 h-3.5 mr-1" />
                Monitor
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onWhisper(call.id, call.extension)}
                disabled={isMonitoring}
                className="flex-1 text-xs"
                title="Whisper - Speak to agent only, caller cannot hear"
              >
                <FiMessageCircle className="w-3.5 h-3.5 mr-1" />
                Whisper
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onBarge(call.id, call.extension)}
                disabled={isMonitoring}
                className="flex-1 text-xs"
                title="Barge - Join as 3rd party, both can hear you"
              >
                <FiUsers className="w-3.5 h-3.5 mr-1" />
                Barge
              </Button>
            </div>
          </div>
        )}

        <div className="mt-3 pt-3 border-t border-[var(--border)] flex items-center justify-between gap-2 text-sm">
          <div className="flex items-center gap-2 text-[var(--muted-foreground)] min-w-0 flex-1">
            <FiUser className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
            <span className="truncate">{call.callerName || 'Unknown'}</span>
          </div>
          <span className="text-[var(--muted-foreground)] text-xs flex-shrink-0 whitespace-nowrap">
            {formatLocalTime(call.startTime)}
          </span>
        </div>
      </CardContent>
    </Card>
  );
});
