/**
 * Formatting Utility Tests
 *
 * Unit tests for formatting utilities including duration, file size, and text truncation.
 *
 * @module __tests__/utils/formatting
 */

import { describe, it, expect } from 'vitest';
import {
  formatDuration,
  formatFileSize,
  truncate,
  formatPhoneNumber,
} from '@/lib/utils/formatting';

describe('formatDuration', () => {
  describe('seconds only (under 1 minute)', () => {
    it('should format 0 seconds as 0:00', () => {
      expect(formatDuration(0)).toBe('0:00');
    });

    it('should format single digit seconds', () => {
      expect(formatDuration(5)).toBe('0:05');
    });

    it('should format 30 seconds', () => {
      expect(formatDuration(30)).toBe('0:30');
    });

    it('should format 59 seconds', () => {
      expect(formatDuration(59)).toBe('0:59');
    });
  });

  describe('minutes and seconds (under 1 hour)', () => {
    it('should format exactly 1 minute', () => {
      expect(formatDuration(60)).toBe('1:00');
    });

    it('should format 1 minute 30 seconds', () => {
      expect(formatDuration(90)).toBe('1:30');
    });

    it('should format 5 minutes', () => {
      expect(formatDuration(300)).toBe('5:00');
    });

    it('should format 10 minutes 45 seconds', () => {
      expect(formatDuration(645)).toBe('10:45');
    });

    it('should format 59 minutes 59 seconds', () => {
      expect(formatDuration(3599)).toBe('59:59');
    });
  });

  describe('hours, minutes, and seconds', () => {
    it('should format exactly 1 hour', () => {
      expect(formatDuration(3600)).toBe('1:00:00');
    });

    it('should format 1 hour 30 minutes', () => {
      expect(formatDuration(5400)).toBe('1:30:00');
    });

    it('should format 2 hours 15 minutes 30 seconds', () => {
      expect(formatDuration(8130)).toBe('2:15:30');
    });

    it('should format 10 hours', () => {
      expect(formatDuration(36000)).toBe('10:00:00');
    });

    it('should format 24 hours', () => {
      expect(formatDuration(86400)).toBe('24:00:00');
    });
  });

  describe('edge cases', () => {
    it('should handle negative values as 0:00', () => {
      expect(formatDuration(-1)).toBe('0:00');
      expect(formatDuration(-100)).toBe('0:00');
    });

    it('should handle Infinity as 0:00', () => {
      expect(formatDuration(Infinity)).toBe('0:00');
    });

    it('should handle NaN as 0:00', () => {
      expect(formatDuration(NaN)).toBe('0:00');
    });

    it('should handle fractional seconds by flooring', () => {
      expect(formatDuration(90.7)).toBe('1:30');
      expect(formatDuration(90.2)).toBe('1:30');
    });
  });
});

describe('formatFileSize', () => {
  describe('bytes', () => {
    it('should format 0 bytes', () => {
      expect(formatFileSize(0)).toBe('0 B');
    });

    it('should format small byte values', () => {
      expect(formatFileSize(100)).toBe('100 B');
    });

    it('should format values just under 1 KB', () => {
      expect(formatFileSize(1023)).toBe('1023 B');
    });
  });

  describe('kilobytes', () => {
    it('should format exactly 1 KB', () => {
      expect(formatFileSize(1024)).toBe('1.0 KB');
    });

    it('should format 1.5 KB', () => {
      expect(formatFileSize(1536)).toBe('1.5 KB');
    });

    it('should format 100 KB', () => {
      expect(formatFileSize(102400)).toBe('100.0 KB');
    });
  });

  describe('megabytes', () => {
    it('should format exactly 1 MB', () => {
      expect(formatFileSize(1048576)).toBe('1.0 MB');
    });

    it('should format 5.5 MB', () => {
      expect(formatFileSize(5767168)).toBe('5.5 MB');
    });

    it('should format 100 MB', () => {
      expect(formatFileSize(104857600)).toBe('100.0 MB');
    });
  });

  describe('gigabytes', () => {
    it('should format exactly 1 GB', () => {
      expect(formatFileSize(1073741824)).toBe('1.0 GB');
    });

    it('should format 2.5 GB', () => {
      expect(formatFileSize(2684354560)).toBe('2.5 GB');
    });
  });

  describe('terabytes', () => {
    it('should format exactly 1 TB', () => {
      expect(formatFileSize(1099511627776)).toBe('1.0 TB');
    });
  });
});

describe('truncate', () => {
  describe('text shorter than max length', () => {
    it('should return text unchanged when shorter', () => {
      expect(truncate('Hello', 10)).toBe('Hello');
    });

    it('should return text unchanged when exactly max length', () => {
      expect(truncate('Hello', 5)).toBe('Hello');
    });

    it('should handle empty string', () => {
      expect(truncate('', 10)).toBe('');
    });
  });

  describe('text longer than max length', () => {
    it('should truncate and add ellipsis', () => {
      expect(truncate('Hello World', 8)).toBe('Hello...');
    });

    it('should truncate long text', () => {
      const longText = 'This is a very long piece of text that should be truncated';
      const result = truncate(longText, 20);
      expect(result).toBe('This is a very lo...');
      expect(result.length).toBe(20);
    });

    it('should handle minimal truncation', () => {
      expect(truncate('Hello World', 10)).toBe('Hello W...');
    });
  });

  describe('edge cases', () => {
    it('should handle null input', () => {
      expect(truncate(null as unknown as string, 10)).toBeFalsy();
    });

    it('should handle undefined input', () => {
      expect(truncate(undefined as unknown as string, 10)).toBeFalsy();
    });

    it('should handle max length less than 4', () => {
      // With maxLength 4, result would be "H..." but text is "Hello"
      // 4 - 3 (ellipsis) = 1 character + ellipsis
      expect(truncate('Hello', 4)).toBe('H...');
    });
  });
});

describe('formatPhoneNumber', () => {
  describe('US phone numbers', () => {
    it('should format +1 prefixed number', () => {
      expect(formatPhoneNumber('+12025551234')).toBe('(202) 555-1234');
    });

    it('should format 10 digit number', () => {
      expect(formatPhoneNumber('2025551234')).toBe('(202) 555-1234');
    });

    it('should format 11 digit number starting with 1', () => {
      expect(formatPhoneNumber('12025551234')).toBe('(202) 555-1234');
    });
  });

  describe('edge cases', () => {
    it('should return empty string for empty input', () => {
      expect(formatPhoneNumber('')).toBe('');
    });

    it('should return original for non-standard length', () => {
      expect(formatPhoneNumber('12345')).toBe('12345');
    });

    it('should handle already formatted number', () => {
      // This strips the formatting and reformats
      expect(formatPhoneNumber('(202) 555-1234')).toBe('(202) 555-1234');
    });
  });
});
