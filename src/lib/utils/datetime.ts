/**
 * DateTime Utilities - SINGLE SOURCE OF TRUTH
 *
 * Handles datetime parsing and formatting for the application.
 * All datetime formatting across the app MUST use these utilities.
 *
 * ARCHITECTURE:
 * - Server returns all datetimes in ISO 8601 UTC format (e.g., "2026-01-09T03:15:00.000Z")
 * - Frontend parses UTC and converts to user's browser timezone for display
 * - All formatting is locale-aware
 *
 * SSOT: This is the ONLY place datetime parsing and formatting logic should exist.
 *
 * @module lib/utils/datetime
 */

/**
 * Parse a datetime value from the server and convert to user's local Date
 *
 * The server returns datetimes in ISO 8601 UTC format with 'Z' suffix.
 * This function handles:
 * - ISO 8601 string: "2026-01-09T03:15:00.000Z" (UTC)
 * - Unix timestamp (seconds): 1704208563
 * - Unix timestamp (milliseconds): 1704208563000
 * - Date object: passed through
 *
 * @param dateValue - ISO 8601 string, timestamp, or Date from server
 * @returns Date object in user's local timezone
 */
export function parseServerDateTime(
  dateValue: string | number | Date | null | undefined
): Date | null {
  if (!dateValue && dateValue !== 0) return null;

  // Handle Date objects
  if (dateValue instanceof Date) {
    return isNaN(dateValue.getTime()) ? null : dateValue;
  }

  // Handle Unix timestamps (number)
  if (typeof dateValue === 'number') {
    // Distinguish between seconds and milliseconds
    // If the number is less than 10 billion, it's seconds; otherwise milliseconds
    const timestamp = dateValue < 10000000000 ? dateValue * 1000 : dateValue;
    const date = new Date(timestamp);
    return isNaN(date.getTime()) ? null : date;
  }

  // Handle strings
  if (typeof dateValue === 'string') {
    // Check if it's a numeric string (Unix timestamp)
    const numericValue = Number(dateValue);
    if (!isNaN(numericValue) && dateValue.trim() === numericValue.toString()) {
      const timestamp = numericValue < 10000000000 ? numericValue * 1000 : numericValue;
      const date = new Date(timestamp);
      return isNaN(date.getTime()) ? null : date;
    }

    // Parse ISO 8601 string (server returns UTC with Z suffix)
    // JavaScript's Date constructor handles ISO 8601 natively
    const date = new Date(dateValue);
    return isNaN(date.getTime()) ? null : date;
  }

  return null;
}

/**
 * Format a server datetime to localized time string (e.g., "2:30 PM")
 * Automatically converts from server timezone to user's local timezone
 *
 * @param dateValue - Datetime string, timestamp, or Date from server
 * @returns Formatted time string in user's local timezone
 */
export function formatLocalTime(dateValue: string | number | Date | null | undefined): string {
  const date = parseServerDateTime(dateValue);
  if (!date) return '';

  return date.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * Format a server datetime to localized date string (e.g., "Jan 15, 2024")
 * Automatically converts from server timezone to user's local timezone
 *
 * @param dateValue - Datetime string, timestamp, or Date from server
 * @returns Formatted date string in user's local timezone
 */
export function formatLocalDate(dateValue: string | number | Date | null | undefined): string {
  const date = parseServerDateTime(dateValue);
  if (!date) return '';

  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Format a server datetime to full localized datetime string
 * (e.g., "Jan 15, 2024, 2:30 PM")
 *
 * @param dateValue - Datetime string, timestamp, or Date from server
 * @returns Formatted datetime string in user's local timezone
 */
export function formatLocalDateTime(dateValue: string | number | Date | null | undefined): string {
  const date = parseServerDateTime(dateValue);
  if (!date) return '';

  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * Format a server datetime to relative time (e.g., "2 hours ago", "Yesterday")
 * Automatically converts from server timezone to user's local timezone
 *
 * @param dateValue - Datetime string, timestamp, or Date from server
 * @returns Relative time string
 */
export function formatRelativeTime(dateValue: string | number | Date | null | undefined): string {
  const date = parseServerDateTime(dateValue);
  if (!date) return '';

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  // Future dates (shouldn't happen but handle gracefully)
  if (diffMs < 0) {
    return formatLocalTime(date);
  }

  if (diffSecs < 60) {
    return 'Just now';
  }

  if (diffMins < 60) {
    return `${diffMins}m ago`;
  }

  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }

  if (diffDays === 1) {
    return 'Yesterday';
  }

  if (diffDays < 7) {
    return `${diffDays}d ago`;
  }

  // For older dates, show the actual date
  return formatLocalDate(date);
}

/**
 * Format a server datetime for message timestamps (e.g., "2:30 PM")
 * Shows time for today, "Yesterday" for yesterday, date for older
 *
 * @param dateValue - Datetime string, timestamp, or Date from server
 * @returns Formatted message time
 */
export function formatMessageTime(dateValue: string | number | Date | null | undefined): string {
  const date = parseServerDateTime(dateValue);
  if (!date) return '';

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const messageDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  if (messageDay.getTime() === today.getTime()) {
    return formatLocalTime(date);
  }

  if (messageDay.getTime() === yesterday.getTime()) {
    return `Yesterday ${formatLocalTime(date)}`;
  }

  // Different day - show date and time
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * Format a server datetime for conversation list (compact format)
 * Shows time for today, day name for this week, date for older
 *
 * @param dateValue - Datetime string, timestamp, or Date from server
 * @returns Formatted conversation time
 */
export function formatConversationTime(
  dateValue: string | number | Date | null | undefined
): string {
  const date = parseServerDateTime(dateValue);
  if (!date) return '';

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const weekAgo = new Date(today.getTime() - 6 * 86400000);
  const messageDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  if (messageDay.getTime() === today.getTime()) {
    return formatLocalTime(date);
  }

  if (messageDay.getTime() === yesterday.getTime()) {
    return 'Yesterday';
  }

  if (messageDay.getTime() >= weekAgo.getTime()) {
    return date.toLocaleDateString(undefined, { weekday: 'short' });
  }

  // Older than a week - show date
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Format a server datetime for call history
 *
 * @param dateValue - Datetime string, timestamp, or Date from server
 * @returns Formatted call time
 */
export function formatCallTime(dateValue: string | number | Date | null | undefined): string {
  return formatConversationTime(dateValue);
}

/**
 * Get user's current timezone name
 *
 * @returns Timezone name (e.g., "America/New_York")
 */
export function getUserTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/**
 * Get user's timezone offset as string (e.g., "UTC-5")
 *
 * @returns Timezone offset string
 */
export function getUserTimezoneOffset(): string {
  const offset = new Date().getTimezoneOffset();
  const hours = Math.floor(Math.abs(offset) / 60);
  const sign = offset <= 0 ? '+' : '-';
  return `UTC${sign}${hours}`;
}

/**
 * Format a server datetime for admin panel (professional format)
 * Shows relative context with 24-hour time:
 * - Today: "Today, 14:30"
 * - Yesterday: "Yesterday, 09:15"
 * - This week: "Mon, 14:30"
 * - Older (this year): "5 Jan, 18:45"
 * - Older (other year): "5 Jan 2025, 18:45"
 *
 * @param dateValue - Datetime string, timestamp, or Date from server
 * @returns Formatted admin datetime
 */
export function formatAdminDateTime(dateValue: string | number | Date | null | undefined): string {
  const date = parseServerDateTime(dateValue);
  if (!date) return '';

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const weekAgo = new Date(today.getTime() - 6 * 86400000);
  const dateDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  // Format time in 24-hour format
  const timeStr = date.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  // Today
  if (dateDay.getTime() === today.getTime()) {
    return `Today, ${timeStr}`;
  }

  // Yesterday
  if (dateDay.getTime() === yesterday.getTime()) {
    return `Yesterday, ${timeStr}`;
  }

  // Within last 7 days - show day name
  if (dateDay.getTime() >= weekAgo.getTime()) {
    const dayName = date.toLocaleDateString(undefined, { weekday: 'short' });
    return `${dayName}, ${timeStr}`;
  }

  // Same year - omit year
  if (date.getFullYear() === now.getFullYear()) {
    const dateStr = date.toLocaleDateString(undefined, {
      day: 'numeric',
      month: 'short',
    });
    return `${dateStr}, ${timeStr}`;
  }

  // Different year - include year
  const dateStr = date.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  return `${dateStr}, ${timeStr}`;
}

/**
 * Check if a date is today in user's local timezone
 *
 * @param dateValue - Datetime string, timestamp, or Date from server
 * @returns True if the date is today
 */
export function isToday(dateValue: string | number | Date | null | undefined): boolean {
  const date = parseServerDateTime(dateValue);
  if (!date) return false;

  const now = new Date();
  return (
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear()
  );
}

/**
 * Check if a date is yesterday in user's local timezone
 *
 * @param dateValue - Datetime string, timestamp, or Date from server
 * @returns True if the date is yesterday
 */
export function isYesterday(dateValue: string | number | Date | null | undefined): boolean {
  const date = parseServerDateTime(dateValue);
  if (!date) return false;

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  return (
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear()
  );
}
