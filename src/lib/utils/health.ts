/**
 * Health Monitoring Utility Functions
 *
 * Formatting and helper functions for system health display.
 *
 * @module lib/utils/health
 */

import { STATUS_CONFIG, type HealthStatus } from '@/lib/constants/health';

/**
 * Format bytes to human readable string
 *
 * @param bytes - Number of bytes
 * @returns Formatted string (e.g., "1.5 GB")
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * Format uptime seconds to human readable string
 *
 * @param seconds - Uptime in seconds
 * @returns Formatted string (e.g., "5d 3h 42m")
 */
export function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

/**
 * Get text color class for status
 *
 * @param status - Health status string
 * @returns Tailwind color class
 */
export function getStatusColor(status: string): string {
  const key = status as HealthStatus;
  return STATUS_CONFIG[key]?.colorClass || STATUS_CONFIG.unknown.colorClass;
}

/**
 * Get background color class for status
 *
 * @param status - Health status string
 * @returns Tailwind background class
 */
export function getStatusBg(status: string): string {
  const key = status as HealthStatus;
  return STATUS_CONFIG[key]?.bgClass || STATUS_CONFIG.unknown.bgClass;
}

/**
 * Get status label
 *
 * @param status - Health status string
 * @returns Human readable label
 */
export function getStatusLabel(status: string): string {
  const key = status as HealthStatus;
  return STATUS_CONFIG[key]?.label || 'Unknown';
}

/**
 * Format latency with appropriate unit
 *
 * @param ms - Latency in milliseconds
 * @returns Formatted string (e.g., "45ms" or "1.2s")
 */
export function formatLatency(ms: number): string {
  if (ms < 1000) {
    return `${ms.toFixed(0)}ms`;
  }
  return `${(ms / 1000).toFixed(2)}s`;
}

/**
 * Format percentage with optional decimal places
 *
 * @param value - Percentage value
 * @param decimals - Number of decimal places (default: 1)
 * @returns Formatted string (e.g., "85.5%")
 */
export function formatPercent(value: number, decimals = 1): string {
  return `${value.toFixed(decimals)}%`;
}

/**
 * Format large numbers with K/M/B suffix
 *
 * @param num - Number to format
 * @returns Formatted string (e.g., "1.5K", "2.3M")
 */
export function formatNumber(num: number): string {
  if (num < 1000) return num.toString();
  if (num < 1000000) return `${(num / 1000).toFixed(1)}K`;
  if (num < 1000000000) return `${(num / 1000000).toFixed(1)}M`;
  return `${(num / 1000000000).toFixed(1)}B`;
}

/**
 * Calculate percentage from value and max
 *
 * @param value - Current value
 * @param max - Maximum value
 * @returns Percentage (0-100)
 */
export function calculatePercent(value: number, max: number): number {
  if (max === 0) return 0;
  return Math.min((value / max) * 100, 100);
}
