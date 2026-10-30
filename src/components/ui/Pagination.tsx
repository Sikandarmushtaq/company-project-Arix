'use client';

import React, { memo } from 'react';
import { FiChevronLeft, FiChevronRight, FiChevronsLeft, FiChevronsRight } from 'react-icons/fi';
import { PAGINATION_DEFAULTS } from '@/lib/hooks/usePagination';
import { StyledSelect } from './StyledSelect';

/**
 * Pagination component props
 */
export interface PaginationProps {
  /** Current page number (1-indexed) */
  page: number;
  /** Total number of pages */
  totalPages: number;
  /** Total number of items */
  totalItems: number;
  /** Current page size */
  pageSize: number;
  /** Whether there's a next page */
  hasNextPage: boolean;
  /** Whether there's a previous page */
  hasPreviousPage: boolean;
  /** Array of page numbers to display */
  pageRange: number[];
  /** Callback to go to a specific page */
  onPageChange: (page: number) => void;
  /** Callback to change page size */
  onPageSizeChange?: (size: number) => void;
  /** Whether pagination is disabled (e.g., during loading) */
  disabled?: boolean;
  /** Whether to show page size selector */
  showPageSizeSelector?: boolean;
  /** Whether to show total items count */
  showTotalItems?: boolean;
  /** Custom page size options */
  pageSizeOptions?: readonly number[];
  /** Additional CSS classes */
  className?: string;
}

/**
 * Professional Pagination Component
 *
 * Features:
 * - First/Last page navigation
 * - Previous/Next page navigation
 * - Page number buttons with ellipsis
 * - Page size selector
 * - Total items display
 * - Keyboard accessible
 * - Responsive design
 *
 * @example
 * ```tsx
 * const pagination = usePagination();
 *
 * <Pagination
 *   page={pagination.page}
 *   totalPages={pagination.totalPages}
 *   totalItems={pagination.totalItems}
 *   pageSize={pagination.pageSize}
 *   hasNextPage={pagination.hasNextPage}
 *   hasPreviousPage={pagination.hasPreviousPage}
 *   pageRange={pagination.pageRange}
 *   onPageChange={pagination.goToPage}
 *   onPageSizeChange={pagination.setPageSize}
 * />
 * ```
 */
export const Pagination = memo(function Pagination({
  page,
  totalPages,
  totalItems,
  pageSize,
  hasNextPage,
  hasPreviousPage,
  pageRange,
  onPageChange,
  onPageSizeChange,
  disabled = false,
  showPageSizeSelector = true,
  showTotalItems = true,
  pageSizeOptions = PAGINATION_DEFAULTS.PAGE_SIZE_OPTIONS,
  className = '',
}: PaginationProps) {
  // Don't render if no pages
  if (totalPages <= 0 || totalItems === 0) {
    return null;
  }

  const buttonBaseClass = `
    inline-flex items-center justify-center
    w-8 h-8 rounded-md text-sm font-medium
    transition-colors duration-150
    focus:outline-none focus:ring-2 focus:ring-[var(--primary-500)] focus:ring-offset-1
    disabled:opacity-50 disabled:cursor-not-allowed
  `;

  const buttonClass = `
    ${buttonBaseClass}
    text-[var(--muted-foreground)] hover:text-[var(--foreground)]
    hover:bg-[var(--muted)] border border-[var(--border)]
  `;

  const activeButtonClass = `
    ${buttonBaseClass}
    bg-[var(--primary-600)] text-white
    hover:bg-[var(--primary-700)]
  `;

  // Calculate item range being displayed
  const startItem = Math.min((page - 1) * pageSize + 1, totalItems);
  const endItem = Math.min(page * pageSize, totalItems);

  return (
    <nav
      className={`flex flex-col sm:flex-row items-center justify-between gap-4 ${className}`}
      aria-label="Pagination"
      role="navigation"
    >
      {/* Left side: Page size selector and item count */}
      <div className="flex items-center gap-4 text-sm text-[var(--muted-foreground)]">
        {showPageSizeSelector && onPageSizeChange && (
          <div className="flex items-center gap-2">
            <label htmlFor="page-size" className="whitespace-nowrap">
              Show
            </label>
            <StyledSelect
              id="page-size"
              value={String(pageSize)}
              onChange={(v) => onPageSizeChange(Number(v))}
              disabled={disabled}
              className="w-auto bg-[var(--background)]"
            >
              {pageSizeOptions.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </StyledSelect>
            <span className="whitespace-nowrap">per page</span>
          </div>
        )}

        {showTotalItems && (
          <span className="whitespace-nowrap">
            Showing {startItem.toLocaleString()}-{endItem.toLocaleString()} of{' '}
            {totalItems.toLocaleString()} items
          </span>
        )}
      </div>

      {/* Right side: Page navigation */}
      <div className="flex items-center gap-1">
        {/* First page */}
        <button
          type="button"
          onClick={() => onPageChange(1)}
          disabled={disabled || !hasPreviousPage}
          className={buttonClass}
          aria-label="Go to first page"
          title="First page"
        >
          <FiChevronsLeft className="w-4 h-4" />
        </button>

        {/* Previous page */}
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={disabled || !hasPreviousPage}
          className={buttonClass}
          aria-label="Go to previous page"
          title="Previous page"
        >
          <FiChevronLeft className="w-4 h-4" />
        </button>

        {/* Page numbers */}
        <div className="flex items-center gap-1 mx-1">
          {/* Show ellipsis if not starting from page 1 */}
          {pageRange[0] > 1 && (
            <>
              <button
                type="button"
                onClick={() => onPageChange(1)}
                disabled={disabled}
                className={buttonClass}
                aria-label="Go to page 1"
              >
                1
              </button>
              {pageRange[0] > 2 && <span className="px-1 text-[var(--muted-foreground)]">...</span>}
            </>
          )}

          {/* Page range */}
          {pageRange.map((pageNum) => (
            <button
              key={pageNum}
              type="button"
              onClick={() => onPageChange(pageNum)}
              disabled={disabled}
              className={pageNum === page ? activeButtonClass : buttonClass}
              aria-label={`Go to page ${pageNum}`}
              aria-current={pageNum === page ? 'page' : undefined}
            >
              {pageNum}
            </button>
          ))}

          {/* Show ellipsis if not ending at last page */}
          {pageRange[pageRange.length - 1] < totalPages && (
            <>
              {pageRange[pageRange.length - 1] < totalPages - 1 && (
                <span className="px-1 text-[var(--muted-foreground)]">...</span>
              )}
              <button
                type="button"
                onClick={() => onPageChange(totalPages)}
                disabled={disabled}
                className={buttonClass}
                aria-label={`Go to page ${totalPages}`}
              >
                {totalPages}
              </button>
            </>
          )}
        </div>

        {/* Next page */}
        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={disabled || !hasNextPage}
          className={buttonClass}
          aria-label="Go to next page"
          title="Next page"
        >
          <FiChevronRight className="w-4 h-4" />
        </button>

        {/* Last page */}
        <button
          type="button"
          onClick={() => onPageChange(totalPages)}
          disabled={disabled || !hasNextPage}
          className={buttonClass}
          aria-label="Go to last page"
          title="Last page"
        >
          <FiChevronsRight className="w-4 h-4" />
        </button>
      </div>
    </nav>
  );
});

/**
 * Compact pagination for smaller spaces
 */
export const PaginationCompact = memo(function PaginationCompact({
  page,
  totalPages,
  hasNextPage,
  hasPreviousPage,
  onPageChange,
  disabled = false,
  className = '',
}: Pick<
  PaginationProps,
  | 'page'
  | 'totalPages'
  | 'hasNextPage'
  | 'hasPreviousPage'
  | 'onPageChange'
  | 'disabled'
  | 'className'
>) {
  if (totalPages <= 1) return null;

  return (
    <div
      className={`flex items-center gap-2 ${className}`}
      role="navigation"
      aria-label="Pagination"
    >
      <button
        type="button"
        onClick={() => onPageChange(page - 1)}
        disabled={disabled || !hasPreviousPage}
        className="
          p-1 rounded-md
          text-[var(--muted-foreground)] hover:text-[var(--foreground)]
          hover:bg-[var(--muted)]
          disabled:opacity-50 disabled:cursor-not-allowed
          transition-colors
        "
        aria-label="Previous page"
      >
        <FiChevronLeft className="w-5 h-5" />
      </button>

      <span className="text-sm text-[var(--muted-foreground)] min-w-[80px] text-center">
        Page {page} of {totalPages}
      </span>

      <button
        type="button"
        onClick={() => onPageChange(page + 1)}
        disabled={disabled || !hasNextPage}
        className="
          p-1 rounded-md
          text-[var(--muted-foreground)] hover:text-[var(--foreground)]
          hover:bg-[var(--muted)]
          disabled:opacity-50 disabled:cursor-not-allowed
          transition-colors
        "
        aria-label="Next page"
      >
        <FiChevronRight className="w-5 h-5" />
      </button>
    </div>
  );
});

/**
 * Simple "Load More" pagination
 */
export interface LoadMoreProps {
  /** Whether there are more items to load */
  hasMore: boolean;
  /** Whether currently loading */
  isLoading?: boolean;
  /** Callback to load more items */
  onLoadMore: () => void;
  /** Custom button text */
  loadMoreText?: string;
  /** Additional CSS classes */
  className?: string;
}

export const LoadMore = memo(function LoadMore({
  hasMore,
  isLoading = false,
  onLoadMore,
  loadMoreText = 'Load more',
  className = '',
}: LoadMoreProps) {
  if (!hasMore) return null;

  return (
    <div className={`flex justify-center ${className}`}>
      <button
        type="button"
        onClick={onLoadMore}
        disabled={isLoading}
        className="
          px-6 py-2 rounded-lg
          bg-[var(--muted)] hover:bg-[var(--muted)]/80
          text-[var(--foreground)] font-medium
          disabled:opacity-50 disabled:cursor-not-allowed
          transition-colors
        "
      >
        {isLoading ? (
          <span className="flex items-center gap-2">
            <span className="animate-spin w-4 h-4 border-2 border-current border-t-transparent rounded-full" />
            Loading...
          </span>
        ) : (
          loadMoreText
        )}
      </button>
    </div>
  );
});
