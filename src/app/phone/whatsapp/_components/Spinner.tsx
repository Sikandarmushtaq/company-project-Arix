'use client';

import React from 'react';

// ============================================================================
// Component
// ============================================================================

/**
 * WhatsApp-themed loading spinner.
 * Shared across WaConversationList, WaMessageThread, and other WA components.
 */
export const Spinner = React.memo(function Spinner({
  className = 'h-8 w-8',
}: {
  className?: string;
}) {
  return (
    <div
      className={`animate-spin rounded-full border-2 border-green-500 border-t-transparent ${className}`}
    />
  );
});
