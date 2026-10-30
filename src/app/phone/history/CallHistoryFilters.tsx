'use client';

/**
 * Call History Filters
 *
 * Search bar, direction filter, and status filter for the call history page.
 *
 * @module app/phone/history/CallHistoryFilters
 */

import React from 'react';
import { FiSearch, FiFilter, FiX, FiChevronDown } from 'react-icons/fi';
import { Button, StyledSelect } from '@/components/ui';

export type DirectionFilter = 'all' | 'inbound' | 'outbound';
export type StatusFilter = 'all' | 'completed' | 'missed' | 'no-answer' | 'blocked' | 'dnd';

export interface CallHistoryFiltersProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  directionFilter: DirectionFilter;
  onDirectionFilterChange: (value: DirectionFilter) => void;
  statusFilter: StatusFilter;
  onStatusFilterChange: (value: StatusFilter) => void;
  showFilters: boolean;
  onToggleFilters: () => void;
}

export function CallHistoryFilters({
  searchQuery,
  onSearchChange,
  directionFilter,
  onDirectionFilterChange,
  statusFilter,
  onStatusFilterChange,
  showFilters,
  onToggleFilters,
}: CallHistoryFiltersProps) {
  const activeCount = (directionFilter !== 'all' ? 1 : 0) + (statusFilter !== 'all' ? 1 : 0);

  return (
    <div className="border-t border-[var(--border)]">
      <div className="flex items-center gap-2 px-5 py-2.5">
        {/* Search */}
        <div className="flex-1 flex items-center gap-2 px-3 h-10 rounded-lg border border-[var(--border)] bg-[var(--input)] focus-within:border-[var(--primary-500)] transition-colors text-[var(--muted-foreground)]">
          <FiSearch className="w-4 h-4 shrink-0" />
          <input
            type="text"
            placeholder="Search by number…"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="nx-search-input w-full bg-transparent outline-none text-[13.5px] text-[var(--foreground)]"
          />
          {searchQuery && (
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onSearchChange('')}
              title="Clear search"
              aria-label="Clear search"
              className="grid place-items-center w-5 h-5 rounded-full shrink-0 text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
            >
              <FiX className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        {/* Filter Toggle */}
        <button
          type="button"
          onClick={onToggleFilters}
          aria-expanded={showFilters}
          aria-label="Toggle filters"
          className={`flex items-center gap-1.5 h-10 px-3 rounded-lg border text-[13px] font-bold shrink-0 transition-colors ${
            showFilters || activeCount > 0
              ? 'border-[var(--primary-500)] text-[var(--foreground)] bg-[var(--primary-50)] dark:bg-[var(--primary-900)]/20'
              : 'border-[var(--border)] text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)]'
          }`}
        >
          <FiFilter className="w-4 h-4" />
          <span className="hidden sm:inline">Filters</span>
          {activeCount > 0 && (
            <span className="grid place-items-center min-w-[18px] h-[18px] px-1 rounded-full bg-[var(--coral)] text-white text-[11px] font-black leading-none">
              {activeCount}
            </span>
          )}
          <FiChevronDown
            className={`w-4 h-4 transition-transform duration-200 ${showFilters ? 'rotate-180' : ''}`}
          />
        </button>
      </div>

      {/* Filters — smooth open/close (grid-rows 0fr→1fr, no fixed height) */}
      <div
        aria-hidden={!showFilters}
        className={`grid transition-all duration-200 ease-out ${
          showFilters
            ? 'grid-rows-[1fr] opacity-100'
            : 'grid-rows-[0fr] opacity-0 pointer-events-none'
        }`}
      >
        <div className="overflow-hidden">
          <div className="flex flex-wrap items-end gap-4 px-5 pb-3 pt-3 border-t border-[var(--border)]">
            <div>
              <label className="text-xs font-bold text-[var(--muted-foreground)] mb-1.5 block">
                Direction
              </label>
              <StyledSelect
                value={directionFilter}
                onChange={(v) => onDirectionFilterChange(v as DirectionFilter)}
              >
                <option value="all">All Directions</option>
                <option value="inbound">Inbound</option>
                <option value="outbound">Outbound</option>
              </StyledSelect>
            </div>
            <div>
              <label className="text-xs font-bold text-[var(--muted-foreground)] mb-1.5 block">
                Status
              </label>
              <StyledSelect
                value={statusFilter}
                onChange={(v) => onStatusFilterChange(v as StatusFilter)}
              >
                <option value="all">All Statuses</option>
                <option value="completed">Completed</option>
                <option value="missed">Missed</option>
                <option value="no-answer">No Answer</option>
                <option value="blocked">Blocked</option>
                <option value="dnd">Missed (DND)</option>
              </StyledSelect>
            </div>
            {activeCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-10"
                onClick={() => {
                  onDirectionFilterChange('all');
                  onStatusFilterChange('all');
                }}
              >
                <FiX className="w-4 h-4 mr-1" />
                Clear
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
