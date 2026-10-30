'use client';

import { useState, useCallback, useMemo } from 'react';

/**
 * Pagination configuration defaults
 */
export const PAGINATION_DEFAULTS = {
  PAGE_SIZE: 20,
  PAGE_SIZE_OPTIONS: [10, 20, 50, 100] as const,
  INITIAL_PAGE: 1,
} as const;

/**
 * Pagination state interface
 */
export interface PaginationState {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

/**
 * Pagination info returned from API
 */
export interface PaginationInfo {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

/**
 * Pagination controls interface
 */
export interface PaginationControls {
  // Current state
  page: number;
  pageSize: number;
  offset: number;

  // Navigation
  goToPage: (page: number) => void;
  nextPage: () => void;
  previousPage: () => void;
  firstPage: () => void;
  lastPage: () => void;

  // Page size
  setPageSize: (size: number) => void;

  // Reset
  reset: () => void;

  // Computed values for API
  getQueryParams: () => { page: number; limit: number; offset: number };
}

/**
 * Hook options
 */
export interface UsePaginationOptions {
  initialPage?: number;
  initialPageSize?: number;
  totalItems?: number;
}

/**
 * Professional pagination hook
 * Manages pagination state with full control over navigation
 *
 * @example
 * ```tsx
 * const pagination = usePagination({ initialPageSize: 20 });
 *
 * const { data } = useQuery({
 *   queryKey: ['items', pagination.page, pagination.pageSize],
 *   queryFn: () => fetchItems(pagination.getQueryParams()),
 * });
 *
 * // Update total when data changes
 * useEffect(() => {
 *   if (data?.meta?.total) {
 *     pagination.setTotalItems(data.meta.total);
 *   }
 * }, [data?.meta?.total]);
 * ```
 */
export function usePagination(options: UsePaginationOptions = {}): PaginationControls & {
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  setTotalItems: (total: number) => void;
  pageRange: number[];
} {
  const {
    initialPage = PAGINATION_DEFAULTS.INITIAL_PAGE,
    initialPageSize = PAGINATION_DEFAULTS.PAGE_SIZE,
    totalItems: initialTotalItems = 0,
  } = options;

  const [page, setPage] = useState(initialPage);
  const [pageSize, setPageSizeState] = useState(initialPageSize);
  const [totalItems, setTotalItems] = useState(initialTotalItems);

  // Calculate derived values
  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(totalItems / pageSize)),
    [totalItems, pageSize]
  );

  const hasNextPage = useMemo(() => page < totalPages, [page, totalPages]);
  const hasPreviousPage = useMemo(() => page > 1, [page]);

  const offset = useMemo(() => (page - 1) * pageSize, [page, pageSize]);

  // Calculate page range for pagination UI (shows 5 pages around current)
  const pageRange = useMemo(() => {
    const range: number[] = [];
    const maxVisible = 5;
    let start = Math.max(1, page - Math.floor(maxVisible / 2));
    const end = Math.min(totalPages, start + maxVisible - 1);

    // Adjust start if we're near the end
    if (end - start + 1 < maxVisible) {
      start = Math.max(1, end - maxVisible + 1);
    }

    for (let i = start; i <= end; i++) {
      range.push(i);
    }

    return range;
  }, [page, totalPages]);

  // Navigation functions
  const goToPage = useCallback(
    (newPage: number) => {
      setPage(Math.max(1, Math.min(newPage, totalPages || 1)));
    },
    [totalPages]
  );

  const nextPage = useCallback(() => {
    if (hasNextPage) {
      setPage((p) => p + 1);
    }
  }, [hasNextPage]);

  const previousPage = useCallback(() => {
    if (hasPreviousPage) {
      setPage((p) => p - 1);
    }
  }, [hasPreviousPage]);

  const firstPage = useCallback(() => {
    setPage(1);
  }, []);

  const lastPage = useCallback(() => {
    setPage(totalPages);
  }, [totalPages]);

  const setPageSize = useCallback((newSize: number) => {
    setPageSizeState(newSize);
    // Reset to first page when changing page size
    setPage(1);
  }, []);

  const reset = useCallback(() => {
    setPage(initialPage);
    setPageSizeState(initialPageSize);
  }, [initialPage, initialPageSize]);

  const getQueryParams = useCallback(
    () => ({
      page,
      limit: pageSize,
      offset,
    }),
    [page, pageSize, offset]
  );

  return {
    // Current state
    page,
    pageSize,
    offset,
    totalItems,
    totalPages,
    hasNextPage,
    hasPreviousPage,
    pageRange,

    // Navigation
    goToPage,
    nextPage,
    previousPage,
    firstPage,
    lastPage,

    // Page size
    setPageSize,

    // Total items
    setTotalItems,

    // Reset
    reset,

    // Query params
    getQueryParams,
  };
}

/**
 * Helper to create pagination info from API response
 */
export function createPaginationInfo(
  page: number,
  pageSize: number,
  totalItems: number
): PaginationInfo {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  return {
    page,
    pageSize,
    totalItems,
    totalPages,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1,
  };
}

/**
 * Type for paginated API response
 */
export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
}
