/**
 * DateTime Utility Tests
 *
 * Unit tests for datetime parsing and formatting utilities.
 * These utilities handle server-side UTC dates and convert them to local time.
 *
 * @module __tests__/utils/datetime
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  parseServerDateTime,
  formatLocalTime,
  formatLocalDate,
  formatLocalDateTime,
  formatRelativeTime,
  getUserTimezone,
  getUserTimezoneOffset,
  isToday,
  isYesterday,
} from '@/lib/utils/datetime';

describe('parseServerDateTime', () => {
  describe('ISO 8601 strings', () => {
    it('should parse ISO 8601 UTC string', () => {
      const result = parseServerDateTime('2026-01-09T03:15:00.000Z');
      expect(result).toBeInstanceOf(Date);
      expect(result?.toISOString()).toBe('2026-01-09T03:15:00.000Z');
    });

    it('should parse ISO 8601 string without milliseconds', () => {
      const result = parseServerDateTime('2026-01-09T03:15:00Z');
      expect(result).toBeInstanceOf(Date);
    });

    it('should parse date-only string', () => {
      const result = parseServerDateTime('2026-01-09');
      expect(result).toBeInstanceOf(Date);
    });
  });

  describe('Unix timestamps', () => {
    it('should parse Unix timestamp in seconds', () => {
      const result = parseServerDateTime(1704208563); // seconds
      expect(result).toBeInstanceOf(Date);
    });

    it('should parse Unix timestamp in milliseconds', () => {
      const result = parseServerDateTime(1704208563000); // milliseconds
      expect(result).toBeInstanceOf(Date);
    });

    it('should parse numeric string timestamp', () => {
      const result = parseServerDateTime('1704208563');
      expect(result).toBeInstanceOf(Date);
    });
  });

  describe('Date objects', () => {
    it('should pass through valid Date object', () => {
      const date = new Date('2026-01-09T03:15:00.000Z');
      const result = parseServerDateTime(date);
      expect(result).toBe(date);
    });

    it('should return null for invalid Date object', () => {
      const invalidDate = new Date('invalid');
      const result = parseServerDateTime(invalidDate);
      expect(result).toBeNull();
    });
  });

  describe('edge cases', () => {
    it('should return null for null input', () => {
      expect(parseServerDateTime(null)).toBeNull();
    });

    it('should return null for undefined input', () => {
      expect(parseServerDateTime(undefined)).toBeNull();
    });

    it('should return null for empty string', () => {
      expect(parseServerDateTime('')).toBeNull();
    });

    it('should return null for invalid date string', () => {
      expect(parseServerDateTime('not a date')).toBeNull();
    });

    it('should handle timestamp 0', () => {
      const result = parseServerDateTime(0);
      expect(result).toBeInstanceOf(Date);
      expect(result?.getTime()).toBe(0);
    });
  });
});

describe('formatLocalTime', () => {
  it('should format time from ISO string', () => {
    const result = formatLocalTime('2026-01-09T15:30:00.000Z');
    // Format depends on locale, but should contain hour and minute
    expect(result).toBeTruthy();
    expect(typeof result).toBe('string');
  });

  it('should return empty string for null', () => {
    expect(formatLocalTime(null)).toBe('');
  });

  it('should return empty string for undefined', () => {
    expect(formatLocalTime(undefined)).toBe('');
  });

  it('should return empty string for invalid date', () => {
    expect(formatLocalTime('invalid')).toBe('');
  });
});

describe('formatLocalDate', () => {
  it('should format date from ISO string', () => {
    const result = formatLocalDate('2026-01-15T15:30:00.000Z');
    // Format depends on locale, but should contain month and day
    expect(result).toBeTruthy();
    expect(typeof result).toBe('string');
  });

  it('should return empty string for null', () => {
    expect(formatLocalDate(null)).toBe('');
  });

  it('should return empty string for invalid date', () => {
    expect(formatLocalDate('invalid')).toBe('');
  });
});

describe('formatLocalDateTime', () => {
  it('should format datetime from ISO string', () => {
    const result = formatLocalDateTime('2026-01-15T15:30:00.000Z');
    expect(result).toBeTruthy();
    expect(typeof result).toBe('string');
  });

  it('should return empty string for null', () => {
    expect(formatLocalDateTime(null)).toBe('');
  });
});

describe('formatRelativeTime', () => {
  beforeEach(() => {
    // Mock the current date
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-24T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('recent times', () => {
    it('should return "Just now" for times less than 60 seconds ago', () => {
      const thirtySecondsAgo = new Date('2026-01-24T11:59:30.000Z');
      expect(formatRelativeTime(thirtySecondsAgo)).toBe('Just now');
    });

    it('should return minutes ago for times less than 1 hour', () => {
      const fiveMinutesAgo = new Date('2026-01-24T11:55:00.000Z');
      expect(formatRelativeTime(fiveMinutesAgo)).toBe('5m ago');
    });

    it('should return hours ago for times less than 24 hours', () => {
      const twoHoursAgo = new Date('2026-01-24T10:00:00.000Z');
      expect(formatRelativeTime(twoHoursAgo)).toBe('2h ago');
    });
  });

  describe('day-based times', () => {
    it('should return "Yesterday" for yesterday', () => {
      const yesterday = new Date('2026-01-23T10:00:00.000Z');
      expect(formatRelativeTime(yesterday)).toBe('Yesterday');
    });

    it('should return days ago for times within a week', () => {
      const threeDaysAgo = new Date('2026-01-21T10:00:00.000Z');
      expect(formatRelativeTime(threeDaysAgo)).toBe('3d ago');
    });
  });

  describe('older times', () => {
    it('should return formatted date for times older than a week', () => {
      const twoWeeksAgo = new Date('2026-01-10T10:00:00.000Z');
      const result = formatRelativeTime(twoWeeksAgo);
      // Should return a formatted date, not relative time
      expect(result).toBeTruthy();
      expect(result).not.toContain('ago');
    });
  });

  describe('edge cases', () => {
    it('should return empty string for null', () => {
      expect(formatRelativeTime(null)).toBe('');
    });

    it('should handle future dates gracefully', () => {
      const futureDate = new Date('2026-01-25T12:00:00.000Z');
      // Should return the time for future dates
      const result = formatRelativeTime(futureDate);
      expect(result).toBeTruthy();
    });
  });
});

describe('getUserTimezone', () => {
  it('should return a timezone string', () => {
    const timezone = getUserTimezone();
    expect(typeof timezone).toBe('string');
    expect(timezone.length).toBeGreaterThan(0);
  });
});

describe('getUserTimezoneOffset', () => {
  it('should return UTC offset string', () => {
    const offset = getUserTimezoneOffset();
    expect(offset).toMatch(/^UTC[+-]\d+$/);
  });
});

describe('isToday', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-24T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should return true for today', () => {
    const today = new Date('2026-01-24T08:00:00.000Z');
    expect(isToday(today)).toBe(true);
  });

  it('should return false for yesterday', () => {
    const yesterday = new Date('2026-01-23T12:00:00.000Z');
    expect(isToday(yesterday)).toBe(false);
  });

  it('should return false for tomorrow', () => {
    const tomorrow = new Date('2026-01-25T12:00:00.000Z');
    expect(isToday(tomorrow)).toBe(false);
  });

  it('should return false for null', () => {
    expect(isToday(null)).toBe(false);
  });
});

describe('isYesterday', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-24T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should return true for yesterday', () => {
    const yesterday = new Date('2026-01-23T12:00:00.000Z');
    expect(isYesterday(yesterday)).toBe(true);
  });

  it('should return false for today', () => {
    const today = new Date('2026-01-24T12:00:00.000Z');
    expect(isYesterday(today)).toBe(false);
  });

  it('should return false for two days ago', () => {
    const twoDaysAgo = new Date('2026-01-22T12:00:00.000Z');
    expect(isYesterday(twoDaysAgo)).toBe(false);
  });

  it('should return false for null', () => {
    expect(isYesterday(null)).toBe(false);
  });
});
