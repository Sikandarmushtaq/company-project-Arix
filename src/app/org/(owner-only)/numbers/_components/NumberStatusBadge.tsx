import React from 'react';
import { NumberStatus } from './types';

interface NumberStatusBadgeProps {
  status: NumberStatus | boolean;
  className?: string;
}

export function NumberStatusBadge({ status, className = '' }: NumberStatusBadgeProps) {
  const isActive = status === 'active' || status === true;

  if (isActive) {
    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/40 ${className}`}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
        Active
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-zinc-100 text-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 ${className}`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-zinc-400" />
      Inactive
    </span>
  );
}
