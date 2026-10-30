'use client';

import React from 'react';
import { FiPause, FiPhone } from 'react-icons/fi';
import type { CallLine } from '@/lib/sip/types';
import { formatPhoneUS } from '@/lib/utils/phone';

interface ActiveLinesIndicatorProps {
  lines: CallLine[];
  activeLineId: number | null;
  onSwitchToLine?: (lineId: number) => void;
}

/**
 * Active Lines Indicator
 * Shows all active call lines when multiple calls are in progress.
 * Click a non-active line to switch to it (holds current, unholds target).
 */
export function ActiveLinesIndicator({
  lines,
  activeLineId,
  onSwitchToLine,
}: ActiveLinesIndicatorProps) {
  if (lines.length <= 1) return null;

  return (
    <div className="mt-4 pt-4 border-t border-[var(--border)]">
      <p className="text-xs text-[var(--muted-foreground)] mb-2">Active Lines</p>
      <div className="flex gap-2 flex-wrap">
        {lines.map((line) => {
          const isActive = line.id === activeLineId;
          const isHeld = line.isHeld || line.state === 'holding' || line.state === 'held';
          const canSwitch = !isActive && onSwitchToLine && (line.state === 'established' || isHeld);

          return (
            <button
              key={line.id}
              onClick={() => canSwitch && onSwitchToLine(line.id)}
              disabled={!canSwitch}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 ${
                isActive
                  ? 'bg-[var(--primary-600)] text-white'
                  : isHeld
                    ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 ring-1 ring-amber-500/30 hover:bg-amber-500/25 cursor-pointer'
                    : 'bg-[var(--muted)] text-[var(--foreground)] hover:bg-[var(--primary-100)] dark:hover:bg-[var(--primary-900)] cursor-pointer'
              } ${!canSwitch && !isActive ? 'opacity-50 cursor-default' : ''}`}
            >
              {isHeld ? <FiPause className="w-3 h-3" /> : <FiPhone className="w-3 h-3" />}
              <span>{line.remoteName || formatPhoneUS(line.remoteNumber)}</span>
              {isHeld && <span className="text-[10px] opacity-75">(held)</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
