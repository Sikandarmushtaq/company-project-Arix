'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  FiPhone,
  FiPhoneIncoming,
  FiPhoneOutgoing,
  FiClock,
  FiUser,
  FiRefreshCw,
  FiLoader,
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
import { useAdminRealtimeSync } from '@/lib/hooks/useAdminRealtimeSync';
import { useSocket } from '@/lib/providers/SocketProvider';
import { REALTIME_EVENTS } from '@/lib/constants/events';
import { formatPhoneNumber } from '@/lib/utils/phone';
import { apiClient } from '@/lib/api/client';
import { adminService, type ActiveCall } from '@/lib/api';
import { toast } from 'sonner';
import { isMonitoringCall } from '@/lib/utils/call-status';

interface MonitoringResponse {
  success: boolean;
  data: {
    sessionId: string;
  };
}

/**
 * Call stats interface
 */
interface CallStats {
  totalActiveCalls: number;
  inboundCalls: number;
  outboundCalls: number;
  callsOnHold: number;
  avgDuration: number;
  peakCalls: number;
  peakTime: string;
}

/**
 * Format duration as mm:ss or hh:mm:ss
 */
function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Get status color
 */
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

/**
 * Get direction icon
 */
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

/**
 * Monitor mode type
 */
type MonitorMode = 'monitor' | 'whisper' | 'barge';

/**
 * Monitor mode configuration
 */
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

/**
 * Get icon for monitoring mode
 */
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

/**
 * Monitoring status panel component
 */
const MonitoringStatusPanel = React.memo(function MonitoringStatusPanel({
  mode,
  extension,
  sessionId,
  onStop,
}: {
  mode: MonitorMode;
  extension: string;
  sessionId: string | null;
  onStop: () => void;
}) {
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

/**
 * Memoized call card component with monitoring actions
 */
const CallCard = React.memo(function CallCard({
  call,
  currentTime,
  onMonitor,
  onWhisper,
  onBarge,
  onClearStale,
  isMonitoring,
}: {
  call: ActiveCall;
  currentTime: number;
  onMonitor: (callId: string, extension: string) => void;
  onWhisper: (callId: string, extension: string) => void;
  onBarge: (callId: string, extension: string) => void;
  onClearStale: (callId: string) => void;
  isMonitoring: boolean;
}) {
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
            {new Date(call.startTime).toLocaleTimeString()}
          </span>
        </div>
      </CardContent>
    </Card>
  );
});

export default function LiveCallsPage() {
  const { socket, isConnected } = useSocket();
  const { onlineUsers } = useAdminRealtimeSync();

  // Active calls state
  const [activeCalls, setActiveCalls] = useState<ActiveCall[]>([]);
  const [stats, setStats] = useState<CallStats>({
    totalActiveCalls: 0,
    inboundCalls: 0,
    outboundCalls: 0,
    callsOnHold: 0,
    avgDuration: 0,
    peakCalls: 0,
    peakTime: '-',
  });
  const [isLoading, setIsLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  // Track which call is being monitored and the mode
  const [monitoringInfo, setMonitoringInfo] = useState<{
    callId: string;
    extension: string;
    mode: MonitorMode;
  } | null>(null);

  // Ref for accessing monitoring info in socket handlers without causing re-subscriptions
  const monitoringInfoRef = useRef(monitoringInfo);
  useEffect(() => {
    monitoringInfoRef.current = monitoringInfo;
  }, [monitoringInfo]);

  // Call monitoring handlers
  const handleMonitor = useCallback(async (callId: string, targetExtension: string) => {
    try {
      setIsMonitoring(true);
      setMonitoringInfo({ callId, extension: targetExtension, mode: 'monitor' });
      const response = await apiClient.post<MonitoringResponse>(`/admin/calls/${callId}/monitor`, {
        targetExtension,
      });
      if (response.success) {
        setActiveSessionId(response.data.sessionId);
        toast.success('Silent monitoring started', {
          description: 'Answer your phone to listen to the call',
        });
      } else {
        setIsMonitoring(false);
        setMonitoringInfo(null);
        toast.error('Monitoring failed', { description: 'Server returned an error' });
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to start monitoring';
      toast.error('Monitoring failed', { description: message });
      setIsMonitoring(false);
      setMonitoringInfo(null);
    }
  }, []);

  const handleWhisper = useCallback(async (callId: string, targetExtension: string) => {
    try {
      setIsMonitoring(true);
      setMonitoringInfo({ callId, extension: targetExtension, mode: 'whisper' });
      const response = await apiClient.post<MonitoringResponse>(`/admin/calls/${callId}/whisper`, {
        targetExtension,
      });
      if (response.success) {
        setActiveSessionId(response.data.sessionId);
        toast.success('Whisper mode started', {
          description: 'Answer your phone to speak to the agent',
        });
      } else {
        setIsMonitoring(false);
        setMonitoringInfo(null);
        toast.error('Whisper failed', { description: 'Server returned an error' });
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to start whisper';
      toast.error('Whisper failed', { description: message });
      setIsMonitoring(false);
      setMonitoringInfo(null);
    }
  }, []);

  const handleBarge = useCallback(async (callId: string, targetExtension: string) => {
    try {
      setIsMonitoring(true);
      setMonitoringInfo({ callId, extension: targetExtension, mode: 'barge' });
      const response = await apiClient.post<MonitoringResponse>(`/admin/calls/${callId}/barge`, {
        targetExtension,
      });
      if (response.success) {
        setActiveSessionId(response.data.sessionId);
        toast.success('Barge mode started', {
          description: 'Answer your phone to join the call',
        });
      } else {
        setIsMonitoring(false);
        setMonitoringInfo(null);
        toast.error('Barge failed', { description: 'Server returned an error' });
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to start barge';
      toast.error('Barge failed', { description: message });
      setIsMonitoring(false);
      setMonitoringInfo(null);
    }
  }, []);

  const handleStopMonitor = useCallback(async () => {
    if (!activeSessionId) return;
    try {
      await apiClient.post(`/admin/calls/monitor/${activeSessionId}/stop`);
      toast.success('Monitoring stopped');
    } catch {
      // Ignore errors on stop
    } finally {
      setIsMonitoring(false);
      setActiveSessionId(null);
      setMonitoringInfo(null);
    }
  }, [activeSessionId]);

  // Clear a single stale call
  const handleClearStaleCall = useCallback(async (callId: string) => {
    try {
      await adminService.clearStaleCall(callId);
      setActiveCalls((prev) => prev.filter((c) => c.id !== callId));
      toast.success('Stale call cleared');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to clear stale call';
      toast.error('Failed to clear stale call', { description: message });
    }
  }, []);

  // Clear all stale calls
  const handleClearAllStaleCalls = useCallback(async () => {
    try {
      const result = await adminService.clearAllStaleCalls();
      setActiveCalls((prev) => prev.filter((c) => !c.isStale));
      toast.success(`${result.clearedCount} stale call(s) cleared`);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to clear stale calls';
      toast.error('Failed to clear stale calls', { description: message });
    }
  }, []);

  // Update current time every second for live duration
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch active calls on mount
  const fetchActiveCalls = useCallback(async () => {
    try {
      setIsLoading(true);
      const calls = await adminService.getLiveCalls();
      setActiveCalls(calls);
    } catch {
      toast.error('Failed to load active calls');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch calls on mount
  useEffect(() => {
    fetchActiveCalls();
  }, [fetchActiveCalls]);

  // Handle call events
  useEffect(() => {
    if (!socket) return;

    // Handle new active call or call status update (ringing -> active)
    const handleCallActive = (call: ActiveCall) => {
      setActiveCalls((prev) => {
        const exists = prev.some((c) => c.id === call.id);
        if (exists) {
          // Update existing call (e.g., ringing -> active)
          return prev.map((c) => (c.id === call.id ? { ...c, ...call } : c));
        }
        // Add new call
        return [...prev, call];
      });
    };

    // Handle call ended
    const handleCallEnded = (data: { callId: string }) => {
      setActiveCalls((prev) => prev.filter((c) => c.id !== data.callId));
      // Clear monitoring state if the monitored call ended
      if (monitoringInfoRef.current?.callId === data.callId) {
        setIsMonitoring(false);
        setActiveSessionId(null);
        setMonitoringInfo(null);
      }
    };

    // Handle call updated (hold, mute, etc.)
    const handleCallUpdated = (call: Partial<ActiveCall> & { id: string }) => {
      setActiveCalls((prev) => prev.map((c) => (c.id === call.id ? { ...c, ...call } : c)));
    };

    // Handle monitoring stopped (admin hangs up ChanSpy call or stop is called)
    const handleMonitorStopped = (data: { sessionId: string; callId: string }) => {
      // Clear monitoring state if this was our session
      if (monitoringInfoRef.current?.callId === data.callId) {
        setIsMonitoring(false);
        setActiveSessionId(null);
        setMonitoringInfo(null);
      }
    };

    // Subscribe to admin call events
    socket.on(REALTIME_EVENTS.ADMIN_CALL_ACTIVE, handleCallActive);
    socket.on(REALTIME_EVENTS.ADMIN_CALL_ENDED, handleCallEnded);
    socket.on(REALTIME_EVENTS.CALL_UPDATED, handleCallUpdated);
    socket.on(REALTIME_EVENTS.CALL_HOLD, handleCallUpdated);
    socket.on(REALTIME_EVENTS.CALL_MUTE, handleCallUpdated);
    socket.on('admin:monitor:stopped', handleMonitorStopped);

    return () => {
      socket.off(REALTIME_EVENTS.ADMIN_CALL_ACTIVE, handleCallActive);
      socket.off(REALTIME_EVENTS.ADMIN_CALL_ENDED, handleCallEnded);
      socket.off(REALTIME_EVENTS.CALL_UPDATED, handleCallUpdated);
      socket.off(REALTIME_EVENTS.CALL_HOLD, handleCallUpdated);
      socket.off(REALTIME_EVENTS.CALL_MUTE, handleCallUpdated);
      socket.off('admin:monitor:stopped', handleMonitorStopped);
    };
  }, [socket]);

  const handleRefresh = useCallback(() => {
    fetchActiveCalls();
  }, [fetchActiveCalls]);

  // Filter out monitoring calls (ChanSpy callbacks) - they appear with callerName like "Monitor 1001"
  // Memoized to avoid recalculating on every render
  const displayableCalls = useMemo(
    () =>
      activeCalls.filter((c) => !isMonitoringCall(c.callerName) && !isMonitoringCall(c.calleeName)),
    [activeCalls]
  );

  // Group calls by status (memoized)
  const staleCalls = useMemo(
    () => displayableCalls.filter((c) => c.isStale === true),
    [displayableCalls]
  );
  const nonStaleCalls = useMemo(
    () => displayableCalls.filter((c) => c.isStale !== true),
    [displayableCalls]
  );
  const ringingCalls = useMemo(
    () => nonStaleCalls.filter((c) => c.status === 'ringing'),
    [nonStaleCalls]
  );
  const activeCurrent = useMemo(
    () => nonStaleCalls.filter((c) => c.status === 'active'),
    [nonStaleCalls]
  );
  const onHoldCalls = useMemo(
    () => nonStaleCalls.filter((c) => c.status === 'on-hold'),
    [nonStaleCalls]
  );

  // Update stats when displayable calls change (excludes monitoring calls)
  useEffect(() => {
    const inbound = displayableCalls.filter((c) => c.direction === 'inbound').length;
    const outbound = displayableCalls.filter((c) => c.direction === 'outbound').length;
    const onHold = displayableCalls.filter((c) => c.isOnHold).length;
    const totalDuration = displayableCalls.reduce((sum, c) => sum + c.duration, 0);
    const avgDuration =
      displayableCalls.length > 0 ? Math.floor(totalDuration / displayableCalls.length) : 0;

    setStats((prev) => ({
      ...prev,
      totalActiveCalls: displayableCalls.length,
      inboundCalls: inbound,
      outboundCalls: outbound,
      callsOnHold: onHold,
      avgDuration,
      peakCalls: Math.max(prev.peakCalls, displayableCalls.length),
      peakTime:
        displayableCalls.length > prev.peakCalls ? new Date().toLocaleTimeString() : prev.peakTime,
    }));
  }, [displayableCalls]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">Live Call Monitor</h1>
          <p className="text-[var(--muted-foreground)] mt-1">
            Real-time view of all active calls
            {isConnected ? (
              <span className="ml-2 inline-flex items-center gap-1 text-green-600 dark:text-green-400">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                Live
              </span>
            ) : (
              <span className="ml-2 inline-flex items-center gap-1 text-red-600 dark:text-red-400">
                <span className="w-2 h-2 bg-red-500 rounded-full" />
                Disconnected
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {staleCalls.length > 0 && (
            <Button
              variant="danger"
              size="sm"
              onClick={handleClearAllStaleCalls}
              className="flex items-center gap-2"
            >
              <FiTrash2 className="w-4 h-4" />
              Clear All Stale ({staleCalls.length})
            </Button>
          )}
          <Button
            variant="outline"
            size="icon"
            onClick={handleRefresh}
            disabled={isLoading}
            aria-label="Refresh"
          >
            <FiRefreshCw
              className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`}
              aria-hidden="true"
            />
          </Button>
        </div>
      </div>

      {/* Active Monitoring Status Panel */}
      {isMonitoring && monitoringInfo && (
        <MonitoringStatusPanel
          mode={monitoringInfo.mode}
          extension={monitoringInfo.extension}
          sessionId={activeSessionId}
          onStop={handleStopMonitor}
        />
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="text-3xl font-bold text-[var(--foreground)]">
              {stats.totalActiveCalls}
            </div>
            <div className="text-sm text-[var(--muted-foreground)]">Active Calls</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="text-3xl font-bold text-green-600">{stats.inboundCalls}</div>
            <div className="text-sm text-[var(--muted-foreground)]">Inbound</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="text-3xl font-bold text-blue-600">{stats.outboundCalls}</div>
            <div className="text-sm text-[var(--muted-foreground)]">Outbound</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="text-3xl font-bold text-orange-600">{stats.callsOnHold}</div>
            <div className="text-sm text-[var(--muted-foreground)]">On Hold</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="text-3xl font-bold text-[var(--foreground)]">{stats.peakCalls}</div>
            <div className="text-sm text-[var(--muted-foreground)]">Peak Calls</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="text-3xl font-bold text-[var(--foreground)]">{onlineUsers.size}</div>
            <div className="text-sm text-[var(--muted-foreground)]">Online Users</div>
          </CardContent>
        </Card>
      </div>

      {/* Loading State */}
      {isLoading && displayableCalls.length === 0 && (
        <div className="flex items-center justify-center py-12">
          <FiLoader className="w-8 h-8 animate-spin text-[var(--primary)]" aria-hidden="true" />
        </div>
      )}

      {/* No Calls State */}
      {!isLoading && displayableCalls.length === 0 && (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <FiPhone
                className="w-12 h-12 text-[var(--muted-foreground)] mx-auto mb-4"
                aria-hidden="true"
              />
              <h3 className="text-lg font-semibold text-[var(--foreground)]">No Active Calls</h3>
              <p className="text-[var(--muted-foreground)] mt-2">
                All lines are currently idle. New calls will appear here in real-time.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stale Calls - Show first with warning */}
      {staleCalls.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-red-600 dark:text-red-400 mb-4 flex items-center gap-2">
            <FiAlertTriangle className="w-5 h-5" />
            Stale Calls ({staleCalls.length})
            <span className="text-sm font-normal text-[var(--muted-foreground)] ml-2">
              Orphaned records that need cleanup
            </span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {staleCalls.map((call) => (
              <CallCard
                key={call.id}
                call={call}
                currentTime={currentTime}
                onMonitor={handleMonitor}
                onWhisper={handleWhisper}
                onBarge={handleBarge}
                onClearStale={handleClearStaleCall}
                isMonitoring={isMonitoring}
              />
            ))}
          </div>
        </div>
      )}

      {/* Ringing Calls */}
      {ringingCalls.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-[var(--foreground)] mb-4 flex items-center gap-2">
            <span className="w-3 h-3 bg-yellow-500 rounded-full animate-pulse" />
            Ringing ({ringingCalls.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {ringingCalls.map((call) => (
              <CallCard
                key={call.id}
                call={call}
                currentTime={currentTime}
                onMonitor={handleMonitor}
                onWhisper={handleWhisper}
                onBarge={handleBarge}
                onClearStale={handleClearStaleCall}
                isMonitoring={isMonitoring}
              />
            ))}
          </div>
        </div>
      )}

      {/* Active Calls */}
      {activeCurrent.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-[var(--foreground)] mb-4 flex items-center gap-2">
            <span className="w-3 h-3 bg-green-500 rounded-full" />
            In Progress ({activeCurrent.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeCurrent.map((call) => (
              <CallCard
                key={call.id}
                call={call}
                currentTime={currentTime}
                onMonitor={handleMonitor}
                onWhisper={handleWhisper}
                onBarge={handleBarge}
                onClearStale={handleClearStaleCall}
                isMonitoring={isMonitoring}
              />
            ))}
          </div>
        </div>
      )}

      {/* On Hold Calls */}
      {onHoldCalls.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-[var(--foreground)] mb-4 flex items-center gap-2">
            <span className="w-3 h-3 bg-orange-500 rounded-full" />
            On Hold ({onHoldCalls.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {onHoldCalls.map((call) => (
              <CallCard
                key={call.id}
                call={call}
                currentTime={currentTime}
                onMonitor={handleMonitor}
                onWhisper={handleWhisper}
                onBarge={handleBarge}
                onClearStale={handleClearStaleCall}
                isMonitoring={isMonitoring}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
