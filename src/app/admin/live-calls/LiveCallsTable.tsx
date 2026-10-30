'use client';

/**
 * Live Calls Table
 *
 * Displays active calls grouped by status (stale, ringing, in progress, on hold)
 * with loading and empty states.
 *
 * @module app/admin/live-calls/LiveCallsTable
 */

import React from 'react';
import { FiPhone, FiLoader, FiAlertTriangle } from 'react-icons/fi';
import { Card, CardContent } from '@/components/ui';
import { CallCard } from './LiveCallActions';
import type { ActiveCall } from '@/lib/api';

export interface LiveCallsTableProps {
  isLoading: boolean;
  displayableCalls: ActiveCall[];
  staleCalls: ActiveCall[];
  ringingCalls: ActiveCall[];
  activeCalls: ActiveCall[];
  onHoldCalls: ActiveCall[];
  currentTime: number;
  isMonitoring: boolean;
  onMonitor: (callId: string, extension: string) => void;
  onWhisper: (callId: string, extension: string) => void;
  onBarge: (callId: string, extension: string) => void;
  onClearStale: (callId: string) => void;
}

export function LiveCallsTable({
  isLoading,
  displayableCalls,
  staleCalls,
  ringingCalls,
  activeCalls,
  onHoldCalls,
  currentTime,
  isMonitoring,
  onMonitor,
  onWhisper,
  onBarge,
  onClearStale,
}: LiveCallsTableProps) {
  return (
    <>
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
                onMonitor={onMonitor}
                onWhisper={onWhisper}
                onBarge={onBarge}
                onClearStale={onClearStale}
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
                onMonitor={onMonitor}
                onWhisper={onWhisper}
                onBarge={onBarge}
                onClearStale={onClearStale}
                isMonitoring={isMonitoring}
              />
            ))}
          </div>
        </div>
      )}

      {/* Active Calls */}
      {activeCalls.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-[var(--foreground)] mb-4 flex items-center gap-2">
            <span className="w-3 h-3 bg-green-500 rounded-full" />
            In Progress ({activeCalls.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeCalls.map((call) => (
              <CallCard
                key={call.id}
                call={call}
                currentTime={currentTime}
                onMonitor={onMonitor}
                onWhisper={onWhisper}
                onBarge={onBarge}
                onClearStale={onClearStale}
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
                onMonitor={onMonitor}
                onWhisper={onWhisper}
                onBarge={onBarge}
                onClearStale={onClearStale}
                isMonitoring={isMonitoring}
              />
            ))}
          </div>
        </div>
      )}
    </>
  );
}
