'use client';

import React from 'react';
import {
  FiSearch,
  FiRefreshCw,
} from 'react-icons/fi';
import {
  CardHeader,
  CardTitle,
  Button,
  Input,
} from '@/components/ui';
import { UserActions, type UserActionsProps } from './UserActions';

// ============================================================================
// Types
// ============================================================================

export interface UsersFiltersProps {
  // Search
  searchQuery: string;
  onSearchChange: (value: string) => void;

  // Refresh
  isFetching: boolean;
  onRefresh: () => void;

  // Total
  totalCount?: number;

  // Bulk actions (passed through to UserActions)
  bulkActionsProps: UserActionsProps;
}

// ============================================================================
// Component
// ============================================================================

export function UsersFilters({
  searchQuery,
  onSearchChange,
  isFetching,
  onRefresh,
  totalCount,
  bulkActionsProps,
}: UsersFiltersProps) {
  return (
    <CardHeader>
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <CardTitle>
            All Users
            {totalCount !== undefined && (
              <span className="text-sm font-normal text-[var(--muted-foreground)] ml-2">
                ({totalCount})
              </span>
            )}
          </CardTitle>
          <UserActions {...bulkActionsProps} />
        </div>
        <div className="flex items-center gap-2">
          <div className="w-72">
            <Input
              placeholder="Search users..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              leftIcon={<FiSearch className="w-4 h-4" aria-hidden="true" />}
              aria-label="Search users"
            />
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={onRefresh}
            disabled={isFetching}
            aria-label="Refresh users"
          >
            <FiRefreshCw
              className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`}
              aria-hidden="true"
            />
          </Button>
        </div>
      </div>
    </CardHeader>
  );
}
