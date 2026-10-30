'use client';

import React, { useState } from 'react';
import { FiActivity } from 'react-icons/fi';
import type { CallStats, CallQuality } from '@/lib/sip/types';

/**
 * Get call quality level from MOS score
 */
export function getCallQuality(mosScore: number): CallQuality {
  if (mosScore >= 4.0) return 'excellent';
  if (mosScore >= 3.5) return 'good';
  if (mosScore >= 3.0) return 'fair';
  return 'poor';
}

/**
 * Get quality color classes
 */
export function getQualityColor(quality: CallQuality): string {
  switch (quality) {
    case 'excellent':
      return 'text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900';
    case 'good':
      return 'text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900';
    case 'fair':
      return 'text-yellow-600 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-900';
    case 'poor':
      return 'text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900';
  }
}

interface CallQualityIndicatorProps {
  stats: CallStats | undefined;
}

/**
 * Call Quality Indicator Component
 * Shows MOS score with color coding and detailed popover
 */
export function CallQualityIndicator({ stats }: CallQualityIndicatorProps) {
  const [showDetails, setShowDetails] = useState(false);

  if (!stats) {
    return (
      <div className="flex items-center gap-1 text-[var(--muted-foreground)] text-xs">
        <FiActivity className="w-3 h-3" />
        <span>--</span>
      </div>
    );
  }

  const quality = getCallQuality(stats.mosScore);
  const colorClasses = getQualityColor(quality);

  const qualityDescriptions: Record<CallQuality, string> = {
    excellent: 'Excellent call quality',
    good: 'Good call quality',
    fair: 'Fair call quality, may experience some issues',
    poor: 'Poor call quality, experiencing issues',
  };

  return (
    <div className="relative">
      <button
        onClick={() => setShowDetails(!showDetails)}
        className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${colorClasses} transition-colors hover:opacity-80`}
        aria-label={`${qualityDescriptions[quality]}. MOS score: ${stats.mosScore.toFixed(1)}. Click for details.`}
        aria-expanded={showDetails}
        aria-haspopup="dialog"
      >
        <FiActivity className="w-3 h-3" aria-hidden="true" />
        <span>MOS {stats.mosScore.toFixed(1)}</span>
        <span className="sr-only">({quality})</span>
      </button>

      {/* Details Popover */}
      {showDetails && (
        <div
          className="absolute top-full right-0 mt-2 w-56 p-3 rounded-lg bg-[var(--card)] border border-[var(--border)] shadow-lg z-50"
          role="dialog"
          aria-label="Call quality details"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="font-medium text-[var(--foreground)]">Call Quality</span>
            <span className={`px-2 py-0.5 rounded text-xs font-medium capitalize ${colorClasses}`}>
              {quality}
              <span className="sr-only"> - {qualityDescriptions[quality]}</span>
            </span>
          </div>
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between">
              <span className="text-[var(--muted-foreground)]">MOS Score</span>
              <span className="font-medium text-[var(--foreground)]">
                {stats.mosScore.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--muted-foreground)]">Jitter</span>
              <span className="font-medium text-[var(--foreground)]">
                {stats.jitter.toFixed(1)} ms
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--muted-foreground)]">Packet Loss</span>
              <span className="font-medium text-[var(--foreground)]">
                {stats.packetLoss.toFixed(2)}%
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--muted-foreground)]">Round Trip</span>
              <span className="font-medium text-[var(--foreground)]">
                {stats.roundTripTime.toFixed(0)} ms
              </span>
            </div>
            <div className="border-t border-[var(--border)] pt-1.5 mt-1.5">
              <div className="flex justify-between">
                <span className="text-[var(--muted-foreground)]">Packets Rx</span>
                <span className="font-medium text-[var(--foreground)]">
                  {stats.packetsReceived.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--muted-foreground)]">Packets Tx</span>
                <span className="font-medium text-[var(--foreground)]">
                  {stats.packetsSent.toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
