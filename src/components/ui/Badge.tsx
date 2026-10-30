'use client';

import React from 'react';
import { cn } from '@/lib/utils/cn';

type BadgeVariant = 'default' | 'secondary' | 'success' | 'warning' | 'danger' | 'info' | 'outline';
type BadgeSize = 'sm' | 'md' | 'lg';

interface BadgeProps {
  /**
   * Badge content
   */
  children: React.ReactNode;

  /**
   * Visual variant
   * @default 'default'
   */
  variant?: BadgeVariant;

  /**
   * Size variant
   * @default 'md'
   */
  size?: BadgeSize;

  /**
   * Show a dot indicator
   */
  dot?: boolean;

  /**
   * Dot color (CSS color value)
   */
  dotColor?: string;

  /**
   * Additional CSS classes
   */
  className?: string;

  /**
   * Click handler
   */
  onClick?: () => void;

  /**
   * Accessible label for screen readers
   */
  'aria-label'?: string;
}

const variantClasses: Record<BadgeVariant, string> = {
  default:
    'bg-[var(--primary-100)] text-[var(--foreground)] dark:bg-[var(--primary-900)] dark:text-[var(--primary-300)]',
  secondary: 'bg-[var(--muted)] text-[var(--muted-foreground)]',
  success: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  warning: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  danger: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  info: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  outline: 'bg-transparent border border-[var(--border)] text-[var(--foreground)]',
};

const sizeClasses: Record<BadgeSize, string> = {
  sm: 'px-1.5 py-0.5 text-xs',
  md: 'px-2 py-0.5 text-xs',
  lg: 'px-2.5 py-1 text-sm',
};

const dotSizeClasses: Record<BadgeSize, string> = {
  sm: 'w-1.5 h-1.5',
  md: 'w-2 h-2',
  lg: 'w-2.5 h-2.5',
};

/**
 * Badge Component
 *
 * Small label for status, counts, or categories.
 *
 * @example
 * ```tsx
 * <Badge>Default</Badge>
 * <Badge variant="success">Active</Badge>
 * <Badge variant="danger" dot>Error</Badge>
 * <Badge variant="outline" size="lg">Large</Badge>
 * ```
 */
export function Badge({
  children,
  variant = 'default',
  size = 'md',
  dot,
  dotColor,
  className,
  onClick,
  'aria-label': ariaLabel,
}: BadgeProps) {
  const Component = onClick ? 'button' : 'span';

  return (
    <Component
      onClick={onClick}
      aria-label={ariaLabel}
      className={cn(
        'inline-flex items-center gap-1.5 font-medium rounded-full whitespace-nowrap',
        variantClasses[variant],
        sizeClasses[size],
        onClick && 'cursor-pointer hover:opacity-80 transition-opacity',
        className
      )}
    >
      {dot && (
        <span
          className={cn('rounded-full', dotSizeClasses[size])}
          style={{ backgroundColor: dotColor || 'currentColor' }}
          aria-hidden="true"
        />
      )}
      {children}
    </Component>
  );
}

/**
 * Status Badge with predefined colors
 */
interface StatusBadgeProps {
  status: 'online' | 'offline' | 'busy' | 'away' | 'pending' | 'active' | 'inactive';
  showDot?: boolean;
  className?: string;
}

const statusConfig: Record<
  StatusBadgeProps['status'],
  { label: string; variant: BadgeVariant; dotColor?: string; description: string }
> = {
  online: {
    label: 'Online',
    variant: 'success',
    dotColor: '#10b981',
    description: 'Currently online and available',
  },
  offline: {
    label: 'Offline',
    variant: 'secondary',
    dotColor: '#6b7280',
    description: 'Currently offline',
  },
  busy: {
    label: 'Busy',
    variant: 'danger',
    dotColor: '#ef4444',
    description: 'Currently busy or on a call',
  },
  away: { label: 'Away', variant: 'warning', dotColor: '#f59e0b', description: 'Currently away' },
  pending: {
    label: 'Pending',
    variant: 'warning',
    dotColor: '#f59e0b',
    description: 'Awaiting action',
  },
  active: {
    label: 'Active',
    variant: 'success',
    dotColor: '#10b981',
    description: 'Currently active',
  },
  inactive: {
    label: 'Inactive',
    variant: 'secondary',
    dotColor: '#6b7280',
    description: 'Currently inactive',
  },
};

export function StatusBadge({ status, showDot = true, className }: StatusBadgeProps) {
  const config = statusConfig[status];

  return (
    <Badge
      variant={config.variant}
      dot={showDot}
      dotColor={config.dotColor}
      className={className}
      aria-label={config.description}
    >
      {config.label}
    </Badge>
  );
}

/**
 * Count Badge for notifications, messages, etc.
 */
interface CountBadgeProps {
  count: number;
  max?: number;
  variant?: BadgeVariant;
  size?: BadgeSize;
  className?: string;
}

export function CountBadge({
  count,
  max = 99,
  variant = 'danger',
  size = 'sm',
  className,
}: CountBadgeProps) {
  if (count <= 0) return null;

  const displayCount = count > max ? `${max}+` : count;

  return (
    <Badge
      variant={variant}
      size={size}
      className={cn('min-w-[1.25rem] justify-center', className)}
    >
      {displayCount}
    </Badge>
  );
}

export default Badge;
