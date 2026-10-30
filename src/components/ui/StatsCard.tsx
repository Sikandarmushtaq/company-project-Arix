/**
 * Stats Card Component
 *
 * Reusable card for displaying statistics with icon and value.
 *
 * @module components/ui/StatsCard
 */

import React, { memo } from 'react';
import type { IconType } from 'react-icons';
import { Card, CardContent } from './card';

export interface StatsCardProps {
  /** The statistic value to display */
  value: number | string;
  /** Label describing the statistic */
  label: string;
  /** Icon component to display */
  icon: IconType;
  /** Background color class for the icon container */
  iconBgClass?: string;
  /** Color class for the icon */
  iconColorClass?: string;
  /** Additional class name for the card */
  className?: string;
}

/**
 * Stats Card Component
 *
 * Displays a statistic with an icon, value, and label in a card format.
 */
export const StatsCard = memo(function StatsCard({
  value,
  label,
  icon: Icon,
  iconBgClass = 'bg-[var(--primary-100)] dark:bg-[var(--primary-900)]',
  iconColorClass = 'text-[var(--foreground)]',
  className = '',
}: StatsCardProps) {
  return (
    <Card className={className}>
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${iconBgClass}`}>
            <Icon className={`w-5 h-5 ${iconColorClass}`} />
          </div>
          <div>
            <p className="text-2xl font-bold text-[var(--foreground)]">
              {typeof value === 'number' ? value.toLocaleString() : value}
            </p>
            <p className="text-xs text-[var(--muted-foreground)]">{label}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
});

export default StatsCard;
