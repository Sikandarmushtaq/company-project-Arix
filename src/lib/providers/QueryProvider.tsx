'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { type ReactNode } from 'react';

/**
 * Default query options for TanStack Query
 * These provide sensible defaults for all queries
 */
const defaultQueryOptions = {
  queries: {
    // Data is considered fresh for 2 minutes (no background refetch during this time)
    staleTime: 2 * 60 * 1000,
    // Keep data in cache for 30 minutes (prevents re-fetching on page navigation)
    gcTime: 30 * 60 * 1000,
    // Retry failed requests up to 2 times
    retry: 2,
    // Don't refetch on window focus (prevents unnecessary API calls)
    refetchOnWindowFocus: false,
    // Refetch when network reconnects
    refetchOnReconnect: true,
    // Don't refetch when component mounts if data exists
    refetchOnMount: false,
  },
  mutations: {
    // Retry mutations once on failure
    retry: 1,
  },
};

/**
 * Singleton QueryClient instance
 * IMPORTANT: This is exported so it can be used to clear cache on logout
 */
let queryClientInstance: QueryClient | null = null;

export function getQueryClient(): QueryClient {
  if (!queryClientInstance) {
    queryClientInstance = new QueryClient({
      defaultOptions: defaultQueryOptions,
    });
  }
  return queryClientInstance;
}

/**
 * Clear all query cache - CALL THIS ON LOGOUT
 * This prevents stale data from persisting across sessions
 */
export function clearQueryCache(): void {
  if (queryClientInstance) {
    queryClientInstance.clear();
    console.log('[QueryCache] Cache cleared on logout');
  }
}

/**
 * Invalidate all queries - forces refetch on next access
 * Use this on login to ensure fresh data
 */
export function invalidateAllQueries(): void {
  if (queryClientInstance) {
    queryClientInstance.invalidateQueries();
    console.log('[QueryCache] All queries invalidated');
  }
}

interface QueryProviderProps {
  children: ReactNode;
}

export function QueryProvider({ children }: QueryProviderProps) {
  // Use singleton QueryClient
  const queryClient = getQueryClient();

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
