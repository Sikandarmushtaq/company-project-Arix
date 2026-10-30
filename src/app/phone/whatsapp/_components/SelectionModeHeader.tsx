'use client';

import React from 'react';
import { FiTrash2, FiX, FiSquare, FiCheckSquare } from 'react-icons/fi';
import { Button } from '@/components/ui';

// ============================================================================
// Types
// ============================================================================

interface SelectionModeHeaderProps {
  selectedCount: number;
  totalCount: number;
  isDeleting: boolean;
  onSelectAll: () => void;
  onDelete: () => void;
  onCancel: () => void;
}

// ============================================================================
// Component
// ============================================================================

/**
 * Shared selection mode header bar.
 * Used by both WaConversationList and WaMessageThread.
 * Single source of truth for selection UI.
 */
export const SelectionModeHeader = React.memo(function SelectionModeHeader({
  selectedCount,
  totalCount,
  isDeleting,
  onSelectAll,
  onDelete,
  onCancel,
}: SelectionModeHeaderProps) {
  return (
    <div className="flex items-center gap-2 p-2 bg-[var(--muted)] rounded-lg">
      <Button size="sm" variant="ghost" onClick={onSelectAll} className="text-sm">
        {selectedCount === totalCount ? (
          <>
            <FiCheckSquare className="w-4 h-4 mr-1" /> Deselect All
          </>
        ) : (
          <>
            <FiSquare className="w-4 h-4 mr-1" /> Select All
          </>
        )}
      </Button>
      <span className="text-sm text-[var(--muted-foreground)] flex-1">
        {selectedCount} selected
      </span>
      <Button
        size="sm"
        variant="ghost"
        onClick={onDelete}
        disabled={selectedCount === 0 || isDeleting}
        className="text-red-600 hover:text-red-700 hover:bg-red-100 dark:hover:bg-red-900/30"
      >
        {isDeleting ? (
          <div className="w-4 h-4 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
        ) : (
          <FiTrash2 className="w-4 h-4" />
        )}
      </Button>
      <Button size="sm" variant="ghost" onClick={onCancel}>
        <FiX className="w-4 h-4" />
      </Button>
    </div>
  );
});
