'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { useInfiniteQuery, type QueryKey } from '@tanstack/react-query';

interface UseInfiniteScrollOptions {
  /**
   * Threshold in pixels before the bottom to trigger loading
   * @default 100
   */
  threshold?: number;

  /**
   * Root element (defaults to viewport)
   */
  root?: Element | null;

  /**
   * Whether infinite scroll is enabled
   * @default true
   */
  enabled?: boolean;

  /**
   * Callback when loading more
   */
  onLoadMore?: () => void;
}

interface UseInfiniteScrollReturn {
  /**
   * Ref to attach to the sentinel element at the bottom of the list
   */
  sentinelRef: React.RefObject<HTMLDivElement | null>;

  /**
   * Whether currently loading more items
   */
  isLoadingMore: boolean;

  /**
   * Manually trigger load more
   */
  loadMore: () => void;
}

/**
 * Hook for infinite scroll using Intersection Observer
 *
 * @example
 * ```tsx
 * function MessageList() {
 *   const { data, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery(...);
 *
 *   const { sentinelRef } = useInfiniteScroll({
 *     onLoadMore: () => hasNextPage && fetchNextPage(),
 *     enabled: hasNextPage && !isFetchingNextPage,
 *   });
 *
 *   return (
 *     <div>
 *       {data?.pages.flatMap(page => page.items).map(item => (
 *         <MessageItem key={item.id} message={item} />
 *       ))}
 *       <div ref={sentinelRef} className="h-1" />
 *       {isFetchingNextPage && <Spinner />}
 *     </div>
 *   );
 * }
 * ```
 */
export function useInfiniteScroll(options: UseInfiniteScrollOptions = {}): UseInfiniteScrollReturn {
  const { threshold = 100, root = null, enabled = true, onLoadMore } = options;

  const sentinelRef = useRef<HTMLDivElement>(null);

  // Store callback in ref so observer never goes stale
  const onLoadMoreRef = useRef(onLoadMore);
  onLoadMoreRef.current = onLoadMore;

  const loadMore = useCallback(() => {
    onLoadMoreRef.current?.();
  }, []);

  // Observer only rebuilds when enabled/threshold/root change — NOT on every render
  useEffect(() => {
    if (!enabled) return;

    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          onLoadMoreRef.current?.();
        }
      },
      {
        root,
        rootMargin: `0px 0px ${threshold}px 0px`,
        threshold: 0,
      }
    );

    observer.observe(sentinel);

    return () => {
      observer.disconnect();
    };
  }, [enabled, threshold, root]);

  return {
    sentinelRef,
    isLoadingMore: false,
    loadMore,
  };
}

/**
 * Wrapper hook that combines useInfiniteQuery with useInfiniteScroll
 */
interface UseInfiniteQueryWithScrollOptions<TData, TQueryKey extends QueryKey> {
  /**
   * Query key for caching
   */
  queryKey: TQueryKey;
  /**
   * Query function
   */
  queryFn: (context: { pageParam: number }) => Promise<TData>;
  /**
   * Whether the query is enabled
   * @default true
   */
  enabled?: boolean;
  /**
   * Stale time in milliseconds
   */
  staleTime?: number;
  /**
   * Threshold in pixels before the bottom to trigger loading
   * @default 100
   */
  scrollThreshold?: number;
}

interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/**
 * Combined hook for infinite query with automatic scroll loading
 *
 * @example
 * ```tsx
 * function MessageList() {
 *   const {
 *     data,
 *     isLoading,
 *     sentinelRef,
 *     isFetchingNextPage,
 *   } = useInfiniteQueryWithScroll({
 *     queryKey: ['messages'],
 *     queryFn: ({ pageParam }) => fetchMessages(pageParam),
 *   });
 *
 *   if (isLoading) return <Skeleton />;
 *
 *   return (
 *     <div>
 *       {data?.pages.flatMap(page => page.items).map(item => (
 *         <MessageItem key={item.id} message={item} />
 *       ))}
 *       <div ref={sentinelRef} />
 *       {isFetchingNextPage && <Spinner />}
 *     </div>
 *   );
 * }
 * ```
 */
export function useInfiniteQueryWithScroll<TItem, TQueryKey extends QueryKey = QueryKey>(
  options: UseInfiniteQueryWithScrollOptions<PaginatedResponse<TItem>, TQueryKey>
) {
  const { scrollThreshold = 100, ...queryOptions } = options;

  const query = useInfiniteQuery({
    ...queryOptions,
    initialPageParam: 1,
    getNextPageParam: (lastPage: PaginatedResponse<TItem>) => {
      if (lastPage.page < lastPage.totalPages) {
        return lastPage.page + 1;
      }
      return undefined;
    },
  });

  const { sentinelRef } = useInfiniteScroll({
    threshold: scrollThreshold,
    enabled: query.hasNextPage && !query.isFetchingNextPage,
    onLoadMore: () => query.fetchNextPage(),
  });

  // Flatten all pages into a single array of items
  const allItems = query.data?.pages.flatMap((page) => page.items) ?? [];

  return {
    ...query,
    items: allItems,
    sentinelRef,
  };
}

/**
 * Hook for scroll-based pagination with a load more button fallback
 */
interface UseLoadMoreOptions<T> {
  /**
   * Initial items
   */
  initialItems?: T[];

  /**
   * Function to fetch more items
   */
  fetchMore: (page: number) => Promise<{ items: T[]; hasMore: boolean }>;

  /**
   * Initial page number
   * @default 1
   */
  initialPage?: number;
}

interface UseLoadMoreReturn<T> {
  items: T[];
  isLoading: boolean;
  hasMore: boolean;
  loadMore: () => Promise<void>;
  reset: () => void;
  sentinelRef: React.RefObject<HTMLDivElement | null>;
}

export function useLoadMore<T>(options: UseLoadMoreOptions<T>): UseLoadMoreReturn<T> {
  const { initialItems = [], fetchMore, initialPage = 1 } = options;

  const [items, setItems] = useState<T[]>(initialItems);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const pageRef = useRef(initialPage);

  const loadMore = useCallback(async () => {
    if (isLoading || !hasMore) return;

    setIsLoading(true);
    try {
      const result = await fetchMore(pageRef.current);
      setItems((prev) => [...prev, ...result.items]);
      setHasMore(result.hasMore);
      pageRef.current += 1;
    } catch (error) {
      console.error('Failed to load more items:', error);
    } finally {
      setIsLoading(false);
    }
  }, [fetchMore, hasMore, isLoading]);

  const reset = useCallback(() => {
    setItems(initialItems);
    setHasMore(true);
    pageRef.current = initialPage;
  }, [initialItems, initialPage]);

  const { sentinelRef } = useInfiniteScroll({
    enabled: hasMore && !isLoading,
    onLoadMore: loadMore,
  });

  return {
    items,
    isLoading,
    hasMore,
    loadMore,
    reset,
    sentinelRef,
  };
}

export default useInfiniteScroll;
