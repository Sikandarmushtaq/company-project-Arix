'use client';

import React from 'react';
import { cn } from '@/lib/utils/cn';

interface SkeletonProps {
  className?: string;
  /**
   * Animation variant
   * @default 'pulse'
   */
  animation?: 'pulse' | 'shimmer' | 'none';
  /**
   * Inline styles (useful for dynamic dimensions)
   */
  style?: React.CSSProperties;
}

/**
 * Skeleton loading placeholder component
 *
 * @example
 * ```tsx
 * <Skeleton className="h-4 w-[250px]" />
 * <Skeleton className="h-12 w-12 rounded-full" />
 * ```
 */
export function Skeleton({ className, animation = 'pulse', style }: SkeletonProps) {
  return (
    <div
      className={cn(
        'bg-[var(--muted)] rounded-md',
        animation === 'pulse' && 'animate-pulse',
        animation === 'shimmer' &&
          'relative overflow-hidden before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_2s_infinite] before:bg-gradient-to-r before:from-transparent before:via-white/10 before:to-transparent',
        className
      )}
      style={style}
      aria-hidden="true"
    />
  );
}

/**
 * Text skeleton for paragraphs
 */
export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn('space-y-2', className)} aria-hidden="true">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={cn(
            'h-4',
            i === lines - 1 ? 'w-4/5' : 'w-full' // Last line shorter
          )}
        />
      ))}
    </div>
  );
}

/**
 * Avatar skeleton
 */
export function SkeletonAvatar({
  size = 'md',
  className,
}: {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const sizeClasses = {
    sm: 'h-8 w-8',
    md: 'h-10 w-10',
    lg: 'h-12 w-12',
  };

  return (
    <Skeleton className={cn('rounded-full', sizeClasses[size], className)} aria-hidden="true" />
  );
}

/**
 * Card skeleton
 */
export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div
      className={cn('rounded-xl border border-[var(--border)] bg-[var(--card)] p-6', className)}
      aria-hidden="true"
    >
      <div className="flex items-center space-x-4">
        <SkeletonAvatar />
        <div className="space-y-2 flex-1">
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-3 w-1/4" />
        </div>
      </div>
      <div className="mt-4 space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </div>
    </div>
  );
}

/**
 * Table row skeleton
 */
export function SkeletonTableRow({
  columns = 4,
  className,
}: {
  columns?: number;
  className?: string;
}) {
  return (
    <tr className={cn('border-b border-[var(--border)]', className)} aria-hidden="true">
      {Array.from({ length: columns }).map((_, i) => (
        <td key={i} className="py-4 px-4">
          <Skeleton className="h-4 w-full" />
        </td>
      ))}
    </tr>
  );
}

/**
 * Table skeleton
 */
export function SkeletonTable({
  rows = 5,
  columns = 4,
  className,
}: {
  rows?: number;
  columns?: number;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'rounded-xl border border-[var(--border)] bg-[var(--card)] overflow-hidden',
        className
      )}
      aria-hidden="true"
      role="status"
      aria-label="Loading table data"
    >
      {/* Header */}
      <div className="border-b border-[var(--border)] bg-[var(--muted)]/50 px-4 py-3">
        <div className="flex gap-4">
          {Array.from({ length: columns }).map((_, i) => (
            <Skeleton key={i} className="h-4 flex-1" />
          ))}
        </div>
      </div>

      {/* Body */}
      <table className="w-full">
        <tbody>
          {Array.from({ length: rows }).map((_, i) => (
            <SkeletonTableRow key={i} columns={columns} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Stats card skeleton
 */
export function SkeletonStats({ className }: { className?: string }) {
  return (
    <div
      className={cn('rounded-xl border border-[var(--border)] bg-[var(--card)] p-5', className)}
      aria-hidden="true"
    >
      <div className="flex items-start justify-between">
        <Skeleton className="h-9 w-9 rounded-lg" />
        <Skeleton className="h-4 w-12" />
      </div>
      <div className="mt-4 space-y-2">
        <Skeleton className="h-8 w-24" />
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3 w-24" />
      </div>
    </div>
  );
}

/**
 * Chart skeleton
 */
export function SkeletonChart({
  height = 300,
  className,
}: {
  height?: number;
  className?: string;
}) {
  return (
    <div
      className={cn('rounded-xl border border-[var(--border)] bg-[var(--card)] p-6', className)}
      aria-hidden="true"
      role="status"
      aria-label="Loading chart"
    >
      <div className="flex items-center justify-between mb-6">
        <div className="space-y-2">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-3 w-48" />
        </div>
        <Skeleton className="h-5 w-5" />
      </div>
      <Skeleton className={cn('w-full rounded-lg')} style={{ height }} />
    </div>
  );
}

/**
 * List item skeleton
 */
export function SkeletonListItem({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'flex items-center gap-4 p-4 border-b border-[var(--border)] last:border-0',
        className
      )}
      aria-hidden="true"
    >
      <SkeletonAvatar />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-3 w-1/2" />
      </div>
      <Skeleton className="h-8 w-20" />
    </div>
  );
}

/**
 * Message skeleton for chat-like interfaces
 */
export function SkeletonMessage({
  isOwn = false,
  className,
}: {
  isOwn?: boolean;
  className?: string;
}) {
  return (
    <div className={cn('flex gap-3', isOwn && 'flex-row-reverse', className)} aria-hidden="true">
      {!isOwn && <SkeletonAvatar size="sm" />}
      <div className={cn('space-y-1', isOwn && 'items-end')}>
        <Skeleton className={cn('h-16 w-48 rounded-2xl', isOwn && 'ml-auto')} />
        <Skeleton className={cn('h-3 w-16', isOwn && 'ml-auto')} />
      </div>
    </div>
  );
}

export default Skeleton;
