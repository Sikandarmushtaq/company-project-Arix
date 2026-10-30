/**
 * Query Configuration Constants - SINGLE SOURCE OF TRUTH
 *
 * Centralized configuration for TanStack Query behavior.
 * All query hooks should import these settings for consistency.
 *
 * @module lib/constants/query
 */

/**
 * Real-time query configuration
 *
 * Configuration for data that receives real-time WebSocket updates.
 * WebSocket events update cache directly, but we need initial fetch on mount.
 *
 * IMPORTANT: refetchOnMount must be 'always' to ensure:
 * 1. Fresh data on page load/refresh (WebSocket not connected yet)
 * 2. Data sync after hard refresh (memory cache cleared)
 */
export const REALTIME_QUERY_CONFIG = {
  /**
   * Data stays fresh for 30 seconds after fetch
   * Short stale time ensures data is refetched when returning to page
   */
  staleTime: 30 * 1000,

  /**
   * Keep data in cache for 30 minutes
   */
  gcTime: 30 * 60 * 1000,

  /**
   * Don't refetch on window focus - WebSocket handles updates
   */
  refetchOnWindowFocus: false,

  /**
   * CRITICAL: Always refetch on mount to ensure fresh data
   * This handles:
   * - Hard page refresh (cache cleared)
   * - Initial page load (WebSocket not connected yet)
   * - Navigation back to page (ensure sync with server)
   */
  refetchOnMount: 'always' as const,

  /**
   * Refetch on network reconnect
   */
  refetchOnReconnect: true,

  /**
   * Retry failed requests 2 times
   */
  retry: 2,
} as const;

/**
 * Static data query configuration
 *
 * For data that rarely changes (e.g., user settings, static lists)
 */
export const STATIC_QUERY_CONFIG = {
  staleTime: 5 * 60 * 1000, // 5 minutes
  gcTime: 30 * 60 * 1000,
  refetchOnWindowFocus: false,
  refetchOnMount: false,
  retry: 3,
} as const;

/**
 * Polling query configuration
 *
 * For data that needs periodic refresh but doesn't have WebSocket support
 */
export const POLLING_QUERY_CONFIG = {
  staleTime: 30 * 1000, // 30 seconds
  gcTime: 5 * 60 * 1000,
  refetchOnWindowFocus: true,
  refetchOnMount: true,
  retry: 3,
} as const;
