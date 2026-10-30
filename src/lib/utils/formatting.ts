/**
 * Formatting Utilities - SINGLE SOURCE OF TRUTH
 *
 * All date, time, and duration formatting must use these utilities.
 * Prevents code duplication across components.
 *
 * @module lib/utils/formatting
 */

import { formatPhone } from './phone';

/**
 * Format duration in seconds to HH:MM:SS or MM:SS
 *
 * @param seconds - Duration in seconds
 * @returns Formatted duration string
 */
export function formatDuration(seconds: number): string {
  if (seconds < 0 || !Number.isFinite(seconds)) {
    return '0:00';
  }

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Format a Date to localized time string (e.g., "2:30 PM")
 *
 * @param date - Date to format
 * @returns Formatted time string
 */
export function formatTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;

  if (isNaN(d.getTime())) {
    return '';
  }

  return d.toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * Format a Date to localized date string (e.g., "Jan 15, 2024")
 *
 * @param date - Date to format
 * @returns Formatted date string
 */
export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;

  if (isNaN(d.getTime())) {
    return '';
  }

  return d.toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Format a Date to relative time (e.g., "2 hours ago", "Yesterday")
 *
 * @param date - Date to format
 * @returns Relative time string
 */
export function formatRelativeTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;

  if (isNaN(d.getTime())) {
    return '';
  }

  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) {
    return 'Just now';
  }

  if (diffMins < 60) {
    return `${diffMins} minute${diffMins === 1 ? '' : 's'} ago`;
  }

  if (diffHours < 24) {
    return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
  }

  if (diffDays === 1) {
    return 'Yesterday';
  }

  if (diffDays < 7) {
    return `${diffDays} days ago`;
  }

  return formatDate(d);
}

/**
 * Format a phone number to display format
 * E.g., +12025551234 -> (202) 555-1234
 *
 * @param phone - Phone number to format
 * @returns Formatted phone number
 */
export function formatPhoneNumber(phone: string): string {
  // Unified with the SSOT country-aware formatter (was a duplicate US-only impl).
  // US output is unchanged; UK/international numbers now render correctly.
  return formatPhone(phone);
}

/**
 * Format bytes to human readable size
 *
 * @param bytes - Number of bytes
 * @returns Formatted size string (e.g., "1.5 MB")
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';

  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const size = bytes / Math.pow(1024, i);

  return `${size.toFixed(i > 0 ? 1 : 0)} ${sizes[i]}`;
}

/**
 * Truncate text with ellipsis
 *
 * @param text - Text to truncate
 * @param maxLength - Maximum length
 * @returns Truncated text
 */
export function truncate(text: string, maxLength: number): string {
  if (!text || text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 3)}...`;
}

/**
 * Format cents to dollar string (e.g., 1250 -> "$12.50")
 *
 * @param cents - Amount in cents
 * @returns Formatted dollar string
 */
export function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

/**
 * Format tenth-cents to dollar string (e.g., 12500 -> "$12.50")
 * SMS pricing uses tenth-cent units (1/10 of a cent).
 *
 * @param tenthCents - Amount in tenth-cents
 * @returns Formatted dollar string
 */
export function formatTenthCents(tenthCents: number): string {
  return `$${(tenthCents / 1000).toFixed(4)}`;
}
