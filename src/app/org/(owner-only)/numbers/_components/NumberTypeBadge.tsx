import React from 'react';
import { NumberType } from './types';

interface NumberTypeBadgeProps {
  type: NumberType;
  className?: string;
}

export function NumberTypeBadge({ type, className = '' }: NumberTypeBadgeProps) {
  if (type === 'toll_free') {
    return (
      <span
        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-cyan-50 text-cyan-700 dark:bg-cyan-950/40 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800/40 ${className}`}
      >
        Toll-Free
      </span>
    );
  }

  if (type === 'national') {
    return (
      <span
        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 border border-purple-200 dark:border-purple-800/40 ${className}`}
      >
        National
      </span>
    );
  }

  // 'local'
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 dark:bg-slate-800/60 dark:text-slate-300 border border-slate-200 dark:border-slate-700/50 ${className}`}
    >
      Local
    </span>
  );
}
