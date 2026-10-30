'use client';

/**
 * Monitoring Alert Component
 *
 * Shows a persistent, non-dismissable notification when the user's call
 * is being monitored, whispered, or barged in by an admin.
 *
 * Security notification - cannot be dismissed by user.
 *
 * Reliability strategy (no polling):
 * 1. Immediate fetch on mount - API call works independently of WebSocket
 * 2. Fetch on WebSocket connect/reconnect - catches the connection gap
 * 3. Real-time WebSocket events - instant updates once connected
 * 4. Fetch on visibility change - when user returns to tab
 *
 * @module components/phone/MonitoringAlert
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { FiEye, FiMessageCircle, FiUsers } from 'react-icons/fi';
import { useSocket, useSocketEvent } from '@/lib/providers/SocketProvider';
import { callsService, type MonitoringSession } from '@/lib/api/services/calls.service';

/** Grace period before considering a session stale (ms) */
const STALE_SESSION_GRACE_PERIOD_MS = 5000;

/** Debounce time for API fetches (ms) */
const FETCH_DEBOUNCE_MS = 2000;

/**
 * Get icon for monitoring mode
 */
function getModeIcon(mode: MonitoringSession['mode']) {
  switch (mode) {
    case 'monitor':
      return <FiEye className="w-5 h-5" />;
    case 'whisper':
      return <FiMessageCircle className="w-5 h-5" />;
    case 'barge':
      return <FiUsers className="w-5 h-5" />;
    default:
      return <FiEye className="w-5 h-5" />;
  }
}

/**
 * Get colors for monitoring mode
 */
function getModeColors(mode: MonitoringSession['mode']): {
  bg: string;
  border: string;
  pulse: string;
} {
  switch (mode) {
    case 'monitor':
      return {
        bg: 'bg-blue-500',
        border: 'border-blue-500',
        pulse: 'bg-blue-400',
      };
    case 'whisper':
      return {
        bg: 'bg-yellow-500',
        border: 'border-yellow-500',
        pulse: 'bg-yellow-400',
      };
    case 'barge':
      return {
        bg: 'bg-orange-500',
        border: 'border-orange-500',
        pulse: 'bg-orange-400',
      };
    default:
      return {
        bg: 'bg-blue-500',
        border: 'border-blue-500',
        pulse: 'bg-blue-400',
      };
  }
}

/**
 * Get description for monitoring mode
 */
function getModeDescription(mode: MonitoringSession['mode']): string {
  switch (mode) {
    case 'monitor':
      return 'A supervisor is listening to your call';
    case 'whisper':
      return 'A supervisor can speak to you privately';
    case 'barge':
      return 'A supervisor has joined your call';
    default:
      return 'Your call is being monitored';
  }
}

export function MonitoringAlert() {
  const { isConnected } = useSocket();
  const [activeSessions, setActiveSessions] = useState<Map<string, MonitoringSession>>(new Map());
  // Refs for tracking state without causing re-renders
  const isMountedRef = useRef(true);
  const lastFetchRef = useRef<number>(0);
  const wasConnectedRef = useRef(false);

  // Track when each session was added (for grace period logic)
  const sessionAddedAtRef = useRef<Map<string, number>>(new Map());

  /**
   * Fetch current monitoring status from API
   * Debounced to prevent rapid duplicate calls
   */
  /**
   * Fetch current monitoring status from API
   *
   * This function:
   * 1. Merges new sessions from API into state
   * 2. Removes stale sessions (not in API response + past grace period)
   * 3. Preserves recently-added sessions (within grace period)
   */
  const fetchMonitoringStatus = useCallback(async () => {
    // Debounce: skip if fetched recently
    const now = Date.now();
    if (now - lastFetchRef.current < FETCH_DEBOUNCE_MS) {
      return;
    }
    lastFetchRef.current = now;

    try {
      const response = await callsService.getMonitoringStatus();

      if (!isMountedRef.current) return;

      const apiSessionIds = new Set(response.sessions.map((s) => s.sessionId));

      setActiveSessions((prev) => {
        const next = new Map<string, MonitoringSession>();

        // Add all sessions from API response
        response.sessions.forEach((session) => {
          next.set(session.sessionId, session);
          // Update timestamp if this is a new session from API
          if (!sessionAddedAtRef.current.has(session.sessionId)) {
            sessionAddedAtRef.current.set(session.sessionId, now);
          }
        });

        // Check existing sessions not in API response
        prev.forEach((session, sessionId) => {
          if (!apiSessionIds.has(sessionId)) {
            const addedAt = sessionAddedAtRef.current.get(sessionId);
            const age = addedAt ? now - addedAt : Infinity;

            if (age < STALE_SESSION_GRACE_PERIOD_MS) {
              // Within grace period - keep it (WebSocket may have just added it)
              next.set(sessionId, session);
            } else {
              // Past grace period and not in API - stale, remove it
              sessionAddedAtRef.current.delete(sessionId);
            }
          }
        });

        return next;
      });
    } catch {
      // Silently fail - user may not be authenticated yet
    }
  }, []);

  // 1. Fetch immediately on mount
  useEffect(() => {
    isMountedRef.current = true;
    fetchMonitoringStatus();

    return () => {
      isMountedRef.current = false;
    };
  }, [fetchMonitoringStatus]);

  // Handle WebSocket connection changes
  useEffect(() => {
    if (isConnected) {
      // Just reconnected - fetch to sync state
      fetchMonitoringStatus();
      wasConnectedRef.current = true;
    } else if (wasConnectedRef.current) {
      // Was connected, now disconnected - clear sessions
      // They will be re-synced when we reconnect
      setActiveSessions(new Map());
      sessionAddedAtRef.current.clear();
      wasConnectedRef.current = false;
    }
  }, [isConnected, fetchMonitoringStatus]);

  // 3. Fetch on page visibility change (user returns to tab)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchMonitoringStatus();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [fetchMonitoringStatus]);

  // WebSocket event: Monitoring started
  useSocketEvent<MonitoringSession>(
    'user:being:monitored',
    (data) => {
      const now = Date.now();
      sessionAddedAtRef.current.set(data.sessionId, now);

      setActiveSessions((prev) => {
        const next = new Map(prev);
        next.set(data.sessionId, data);
        return next;
      });
    },
    []
  );

  // WebSocket event: Monitoring stopped
  useSocketEvent<{ sessionId: string }>(
    'user:monitoring:stopped',
    (data) => {
      sessionAddedAtRef.current.delete(data.sessionId);

      setActiveSessions((prev) => {
        const next = new Map(prev);
        next.delete(data.sessionId);
        return next;
      });
    },
    []
  );

  // Don't render if no active sessions
  if (activeSessions.size === 0) {
    return null;
  }

  // Get sessions sorted by priority: barge > whisper > monitor
  const sessions = Array.from(activeSessions.values());
  const priorityOrder: MonitoringSession['mode'][] = ['barge', 'whisper', 'monitor'];
  const sortedSessions = sessions.sort((a, b) => {
    return priorityOrder.indexOf(a.mode) - priorityOrder.indexOf(b.mode);
  });

  const primarySession = sortedSessions[0];
  const additionalCount = sortedSessions.length - 1;
  const colors = getModeColors(primarySession.mode);

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-top-4 duration-300">
      <div
        className={`
          bg-[var(--card)] border-2 ${colors.border}
          rounded-xl shadow-2xl min-w-80 max-w-md overflow-hidden
          relative
        `}
      >
        {/* Pulsing indicator for urgency */}
        <div className="absolute -top-1 -right-1">
          <span
            className={`absolute inline-flex h-4 w-4 rounded-full ${colors.pulse} opacity-75 animate-ping`}
          />
          <span className={`relative inline-flex rounded-full h-4 w-4 ${colors.bg}`} />
        </div>

        {/* Header */}
        <div className={`${colors.bg} px-4 py-3`}>
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 text-white animate-pulse">
              {getModeIcon(primarySession.mode)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-white">{primarySession.modeDisplayName} Active</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="px-4 py-3">
          <p className="text-sm text-[var(--foreground)] font-medium">
            {getModeDescription(primarySession.mode)}
          </p>
          <p className="text-xs text-[var(--muted-foreground)] mt-1">
            Supervisor: <span className="font-medium">{primarySession.adminName}</span>
          </p>
          {additionalCount > 0 && (
            <p className="text-xs text-[var(--muted-foreground)] mt-2 pt-2 border-t border-[var(--border)]">
              +{additionalCount} additional supervisor{additionalCount > 1 ? 's' : ''}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
