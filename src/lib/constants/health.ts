/**
 * Health Monitoring Constants
 *
 * Centralized threshold values and configuration for system health monitoring.
 * These values determine when metrics are considered warning or critical.
 *
 * @module lib/constants/health
 */

/**
 * CPU usage thresholds (percentage)
 */
export const CPU_THRESHOLDS = {
  /** Normal usage - below this is healthy */
  NORMAL: 75,
  /** Warning level - above this shows yellow */
  WARNING: 75,
  /** Critical level - above this shows red */
  CRITICAL: 90,
} as const;

/**
 * Memory usage thresholds (percentage)
 */
export const MEMORY_THRESHOLDS = {
  /** Normal usage - below this is healthy */
  NORMAL: 80,
  /** Warning level - above this shows yellow */
  WARNING: 80,
  /** Critical level - above this shows red */
  CRITICAL: 90,
} as const;

/**
 * Disk usage thresholds (percentage)
 */
export const DISK_THRESHOLDS = {
  /** Normal usage - below this is healthy */
  NORMAL: 85,
  /** Warning level - above this shows yellow */
  WARNING: 85,
  /** Critical level - above this shows red */
  CRITICAL: 95,
} as const;

/**
 * API performance thresholds (milliseconds)
 */
export const API_THRESHOLDS = {
  /** Good response time (ms) */
  GOOD: 100,
  /** Acceptable response time (ms) */
  ACCEPTABLE: 500,
  /** Slow response time (ms) - above this is concerning */
  SLOW: 1000,
} as const;

/**
 * Database latency thresholds (milliseconds)
 */
export const DATABASE_THRESHOLDS = {
  /** Good latency (ms) */
  GOOD: 10,
  /** Acceptable latency (ms) */
  ACCEPTABLE: 50,
  /** High latency (ms) - above this is concerning */
  HIGH: 100,
} as const;

/**
 * Redis latency thresholds (milliseconds)
 */
export const REDIS_THRESHOLDS = {
  /** Good latency (ms) */
  GOOD: 5,
  /** Acceptable latency (ms) */
  ACCEPTABLE: 20,
  /** High latency (ms) */
  HIGH: 50,
} as const;

/**
 * Error rate thresholds (percentage)
 */
export const ERROR_RATE_THRESHOLDS = {
  /** Acceptable error rate */
  ACCEPTABLE: 1,
  /** Warning error rate */
  WARNING: 5,
  /** Critical error rate */
  CRITICAL: 10,
} as const;

/**
 * Get color based on value and thresholds
 */
export function getThresholdColor(
  value: number,
  warningThreshold: number,
  criticalThreshold: number
): 'green' | 'yellow' | 'red' {
  if (value >= criticalThreshold) return 'red';
  if (value >= warningThreshold) return 'yellow';
  return 'green';
}

/**
 * Get CPU status color based on usage percentage
 */
export function getCpuColor(usage: number): 'green' | 'yellow' | 'red' {
  return getThresholdColor(usage, CPU_THRESHOLDS.WARNING, CPU_THRESHOLDS.CRITICAL);
}

/**
 * Get memory status color based on usage percentage
 */
export function getMemoryColor(usage: number): 'green' | 'yellow' | 'red' {
  return getThresholdColor(usage, MEMORY_THRESHOLDS.WARNING, MEMORY_THRESHOLDS.CRITICAL);
}

/**
 * Get disk status color based on usage percentage
 */
export function getDiskColor(usage: number): 'green' | 'yellow' | 'red' {
  return getThresholdColor(usage, DISK_THRESHOLDS.WARNING, DISK_THRESHOLDS.CRITICAL);
}

/**
 * Health status type
 */
export type HealthStatus = 'healthy' | 'degraded' | 'down' | 'critical' | 'unknown';

/**
 * Status display configuration
 */
export const STATUS_CONFIG: Record<
  HealthStatus,
  {
    label: string;
    colorClass: string;
    bgClass: string;
  }
> = {
  healthy: {
    label: 'Healthy',
    colorClass: 'text-green-500',
    bgClass: 'bg-green-100 dark:bg-green-900/30',
  },
  degraded: {
    label: 'Degraded',
    colorClass: 'text-yellow-500',
    bgClass: 'bg-yellow-100 dark:bg-yellow-900/30',
  },
  down: {
    label: 'Down',
    colorClass: 'text-red-500',
    bgClass: 'bg-red-100 dark:bg-red-900/30',
  },
  critical: {
    label: 'Critical',
    colorClass: 'text-red-500',
    bgClass: 'bg-red-100 dark:bg-red-900/30',
  },
  unknown: {
    label: 'Unknown',
    colorClass: 'text-gray-500',
    bgClass: 'bg-gray-100 dark:bg-gray-900/30',
  },
};

/**
 * Alert dismiss duration (24 hours in milliseconds)
 */
export const ALERT_DISMISS_DURATION = 24 * 60 * 60 * 1000;

/**
 * Metrics refresh interval (milliseconds)
 */
export const METRICS_REFRESH_INTERVAL = 5000;

/**
 * Chart history points to display
 */
export const CHART_HISTORY_POINTS = 30;
