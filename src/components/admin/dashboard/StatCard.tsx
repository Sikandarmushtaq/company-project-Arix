'use client';

/**
 * StatCard Component
 *
 * A versatile card component for displaying statistics with optional
 * trend indicators, status colors, and loading states.
 *
 * @module components/admin/dashboard/StatCard
 */

import React from 'react';
import { FiTrendingUp, FiTrendingDown } from 'react-icons/fi';
import { Card, CardContent } from '@/components/ui';

export type StatCardStatus = 'healthy' | 'degraded' | 'down' | 'unknown' | 'neutral';
export type TrendType = 'positive' | 'negative' | 'neutral';

export interface StatCardProps {
  /** Card title/label */
  title: string;
  /** Primary value to display */
  value: string | number;
  /** Optional icon component */
  icon?: React.ReactNode;
  /** Icon component type (alternative to icon prop) */
  iconComponent?: React.ElementType;
  /** Change/trend text (e.g., "+12% from last week") */
  change?: string;
  /** Type of change for styling */
  changeType?: TrendType;
  /** Status for icon background color */
  status?: StatCardStatus;
  /** Show loading skeleton */
  isLoading?: boolean;
  /** Custom class name */
  className?: string;
  /** Layout variant */
  variant?: 'default' | 'compact';
}

/**
 * Status color mappings for icon backgrounds
 */
const statusColors: Record<StatCardStatus, string> = {
  healthy: 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400',
  degraded: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400',
  down: 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400',
  unknown: 'bg-gray-100 dark:bg-gray-900/30 text-gray-600 dark:text-gray-400',
  neutral: 'bg-[var(--primary-100)] dark:bg-[var(--primary-900)]',
};

/**
 * Change type color mappings
 */
const changeTypeColors: Record<TrendType, string> = {
  positive: 'text-[var(--success)]',
  negative: 'text-[var(--danger)]',
  neutral: 'text-[var(--muted-foreground)]',
};

/**
 * StatCard displays a statistic with optional icon, trend, and status indicator.
 *
 * @example
 * // Basic usage
 * <StatCard
 *   title="Total Users"
 *   value={1234}
 *   icon={<FiUsers className="w-6 h-6 text-[var(--foreground)]" />}
 * />
 *
 * @example
 * // With trend indicator
 * <StatCard
 *   title="Active Calls"
 *   value={42}
 *   change="+12% from last week"
 *   changeType="positive"
 *   icon={<FiPhone className="w-6 h-6 text-[var(--foreground)]" />}
 * />
 *
 * @example
 * // With status coloring (HA Monitor style)
 * <StatCard
 *   title="Overall Status"
 *   value="HEALTHY"
 *   iconComponent={FiActivity}
 *   status="healthy"
 *   variant="compact"
 * />
 */
export const StatCard = React.memo(function StatCard({
  title,
  value,
  icon,
  iconComponent: IconComponent,
  change,
  changeType = 'neutral',
  status,
  isLoading = false,
  className = '',
  variant = 'default',
}: StatCardProps) {
  const iconBgColor = status ? statusColors[status] : statusColors.neutral;

  // Render the icon element
  const renderIcon = () => {
    if (icon) return icon;
    if (IconComponent) {
      return (
        <IconComponent
          className={`w-5 h-5 ${status ? '' : 'text-[var(--foreground)]'}`}
          aria-hidden="true"
        />
      );
    }
    return null;
  };

  // Compact variant (HA Monitor style)
  if (variant === 'compact') {
    return (
      <Card className={className}>
        <CardContent className="p-4 flex items-center gap-4">
          {(icon || IconComponent) && (
            <div className={`p-3 rounded-lg ${iconBgColor}`} aria-hidden="true">
              {renderIcon()}
            </div>
          )}
          <div>
            <p className="text-2xl font-bold text-[var(--foreground)]">
              {isLoading ? (
                <span
                  className="inline-block h-8 w-16 bg-[var(--muted)] animate-pulse rounded"
                  role="status"
                  aria-label="Loading value"
                />
              ) : (
                value
              )}
            </p>
            <p className="text-sm text-[var(--muted-foreground)]">{title}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Default variant (Dashboard style)
  return (
    <Card className={className}>
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-[var(--muted-foreground)]">{title}</p>
            {isLoading ? (
              <div
                className="h-9 w-16 bg-[var(--muted)] animate-pulse rounded mt-2"
                role="status"
                aria-label="Loading value"
              />
            ) : (
              <p className="text-3xl font-bold text-[var(--foreground)] mt-2">{value}</p>
            )}
            {change && !isLoading && (
              <p className={`text-sm mt-2 flex items-center gap-1 ${changeTypeColors[changeType]}`}>
                {changeType === 'negative' ? (
                  <FiTrendingDown className="w-4 h-4" aria-hidden="true" />
                ) : (
                  <FiTrendingUp
                    className={`w-4 h-4 ${changeType === 'neutral' ? 'opacity-50' : ''}`}
                    aria-hidden="true"
                  />
                )}
                <span>
                  <span className="sr-only">
                    {changeType === 'positive'
                      ? 'Increased: '
                      : changeType === 'negative'
                        ? 'Decreased: '
                        : ''}
                  </span>
                  {change}
                </span>
              </p>
            )}
          </div>
          {(icon || IconComponent) && (
            <div className={`p-3 rounded-xl ${iconBgColor}`} aria-hidden="true">
              {renderIcon()}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
});

export default StatCard;
