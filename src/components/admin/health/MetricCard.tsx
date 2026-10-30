'use client';

/**
 * MetricCard Component
 *
 * A card component for displaying system metrics with optional
 * progress bar and trend indicator.
 *
 * @module components/admin/health/MetricCard
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui';
import { ProgressBar, type ProgressBarColor } from './ProgressBar';

export interface MetricCardProps {
  /** Icon component to display */
  icon: React.ElementType;
  /** Card title */
  title: string;
  /** Primary value to display */
  value: string | number;
  /** Subtitle/description text */
  subtitle?: string;
  /** Progress bar configuration */
  progress?: {
    value: number;
    max: number;
  };
  /** Progress bar color */
  progressColor?: ProgressBarColor;
  /** Trend indicator */
  trend?: {
    value: number;
    label: string;
  };
  /** Custom class name */
  className?: string;
}

/**
 * MetricCard displays a metric with icon, value, optional progress bar and trend.
 *
 * @example
 * <MetricCard
 *   icon={FiCpu}
 *   title="CPU Usage"
 *   value="45.2%"
 *   progress={{ value: 45.2, max: 100 }}
 *   progressColor="green"
 *   subtitle="4 cores • Intel Xeon"
 * />
 */
export const MetricCard = React.memo(function MetricCard({
  icon: Icon,
  title,
  value,
  subtitle,
  progress,
  progressColor,
  trend,
  className = '',
}: MetricCardProps) {
  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Icon className="w-4 h-4" aria-hidden="true" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold text-[var(--foreground)] mb-2">{value}</div>
        {progress && (
          <ProgressBar
            value={progress.value}
            max={progress.max}
            color={progressColor || 'blue'}
            ariaLabel={`${title}: ${progress.value} of ${progress.max}`}
          />
        )}
        {subtitle && <div className="text-xs text-[var(--muted-foreground)] mt-2">{subtitle}</div>}
        {trend && (
          <div
            className={`text-xs mt-2 flex items-center gap-1 ${
              trend.value >= 0 ? 'text-green-500' : 'text-red-500'
            }`}
            aria-label={`${trend.value >= 0 ? 'Increased' : 'Decreased'} by ${Math.abs(trend.value)}% ${trend.label}`}
          >
            <span aria-hidden="true">{trend.value >= 0 ? '↑' : '↓'}</span>
            <span>
              {Math.abs(trend.value)}% {trend.label}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
});

export default MetricCard;
