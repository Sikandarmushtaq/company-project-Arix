'use client';

/**
 * ProgressBar Component
 *
 * A reusable progress bar with color variants and percentage display.
 * Used for displaying resource utilization metrics.
 *
 * @module components/admin/health/ProgressBar
 */

import React from 'react';

export type ProgressBarColor = 'blue' | 'green' | 'yellow' | 'red';

export interface ProgressBarProps {
  /** Current value */
  value: number;
  /** Maximum value */
  max: number;
  /** Color variant */
  color?: ProgressBarColor;
  /** Whether to show percentage label */
  showPercent?: boolean;
  /** Custom class name for the container */
  className?: string;
  /** Accessible label for screen readers */
  ariaLabel?: string;
}

const colorClasses: Record<ProgressBarColor, string> = {
  blue: 'bg-blue-500',
  green: 'bg-green-500',
  yellow: 'bg-yellow-500',
  red: 'bg-red-500',
};

/**
 * ProgressBar displays a horizontal bar showing progress/usage.
 *
 * @example
 * <ProgressBar value={75} max={100} color="green" />
 */
export const ProgressBar = React.memo(function ProgressBar({
  value,
  max,
  color = 'blue',
  showPercent = true,
  className = '',
  ariaLabel,
}: ProgressBarProps) {
  const percent = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  const label = ariaLabel || `${percent.toFixed(0)}% used`;

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div
        className="flex-1 h-2 bg-[var(--muted)] rounded-full overflow-hidden"
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
      >
        <div
          className={`h-full ${colorClasses[color]} transition-all duration-300`}
          style={{ width: `${percent}%` }}
        />
      </div>
      {showPercent && (
        <span className="text-sm text-[var(--muted-foreground)] w-12 text-right" aria-hidden="true">
          {percent.toFixed(0)}%
        </span>
      )}
    </div>
  );
});

export default ProgressBar;
