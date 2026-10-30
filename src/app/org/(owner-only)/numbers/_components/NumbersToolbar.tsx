import React from 'react';
import { FiSearch, FiX } from 'react-icons/fi';
import { NumberFilters } from './types';
import { StyledSelect } from '@/components/ui';

interface NumbersToolbarProps {
  filters: NumberFilters;
  onFilterChange: (filters: NumberFilters) => void;
  onResetFilters: () => void;
  hasActiveFilters: boolean;
}

export function NumbersToolbar({
  filters,
  onFilterChange,
  onResetFilters,
  hasActiveFilters,
}: NumbersToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2.5">
      {/* Search Input */}
      <div className="relative w-full sm:w-64 md:w-72">
        <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted-foreground)] pointer-events-none" />
        <input
          type="text"
          value={filters.search}
          onChange={(e) => onFilterChange({ ...filters, search: e.target.value })}
          placeholder="Search numbers..."
          className="w-full pl-9 pr-8 py-1.5 text-xs bg-[var(--card)] border border-[var(--border)] rounded-xl placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent transition-all h-9 text-[var(--foreground)]"
        />
        {filters.search && (
          <button
            type="button"
            onClick={() => onFilterChange({ ...filters, search: '' })}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)] hover:text-[var(--foreground)] p-0.5 rounded-md"
            title="Clear search"
          >
            <FiX className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Filter Selects & Reset */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Assignment Filter */}
        <div className="w-44">
          <StyledSelect
            value={filters.assignment}
            onChange={(val) =>
              onFilterChange({ ...filters, assignment: val as NumberFilters['assignment'] })
            }
            aria-label="Filter by assignment"
          >
            <option value="all">All Assignments</option>
            <option value="assigned">Assigned</option>
            <option value="unassigned">Unassigned</option>
          </StyledSelect>
        </div>

        {/* Type Filter */}
        <div className="w-32">
          <StyledSelect
            value={filters.type}
            onChange={(val) =>
              onFilterChange({ ...filters, type: val as NumberFilters['type'] })
            }
            aria-label="Filter by type"
          >
            <option value="all">All Types</option>
            <option value="local">Local</option>
            <option value="toll_free">Toll-Free</option>
            <option value="national">National</option>
          </StyledSelect>
        </div>

        {/* Status Filter */}
        <div className="w-32">
          <StyledSelect
            value={filters.status}
            onChange={(val) =>
              onFilterChange({ ...filters, status: val as NumberFilters['status'] })
            }
            aria-label="Filter by status"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </StyledSelect>
        </div>

        {/* Reset filters button */}
        {hasActiveFilters && (
          <button
            type="button"
            onClick={onResetFilters}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)] border border-[var(--border)] rounded-xl transition-colors h-9"
            title="Reset filters"
          >
            <FiX className="w-3.5 h-3.5" />
            <span>Reset filters</span>
          </button>
        )}
      </div>
    </div>
  );
}
