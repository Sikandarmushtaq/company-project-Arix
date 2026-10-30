'use client';

import React from 'react';
import { FiCheck, FiX } from 'react-icons/fi';

export function StatusIndicator({ status }: { status: string }) {
  switch (status) {
    case 'sent':
      return <FiCheck className="w-3 h-3 text-[var(--muted-foreground)]" />;
    case 'delivered':
      return (
        <span className="inline-flex -space-x-1.5">
          <FiCheck className="w-3 h-3 text-[var(--muted-foreground)]" />
          <FiCheck className="w-3 h-3 text-[var(--muted-foreground)]" />
        </span>
      );
    case 'read':
      return (
        <span className="inline-flex -space-x-1.5">
          <FiCheck className="w-3 h-3 text-blue-400" />
          <FiCheck className="w-3 h-3 text-blue-400" />
        </span>
      );
    case 'failed':
      return <FiX className="w-3 h-3 text-red-400" />;
    default:
      return (
        <span className="w-2.5 h-2.5 rounded-full border border-[var(--muted-foreground)] animate-pulse" />
      );
  }
}
