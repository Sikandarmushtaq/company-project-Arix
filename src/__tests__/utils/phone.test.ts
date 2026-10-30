/**
 * Phone Utility Tests
 *
 * Unit tests for phone number normalization and formatting.
 *
 * The "US parity" block is the REGRESSION GUARD for the libphonenumber-js
 * migration: every existing US input must produce byte-identical output to the
 * legacy heuristic. International (GB) cases verify the new capability.
 *
 * @module __tests__/utils/phone
 */

import { describe, it, expect } from 'vitest';
import {
  normalizePhone,
  phonesMatch,
  formatPhoneUS,
  formatPhoneDisplay,
  formatPhone,
  toE164,
  DEFAULT_PHONE_REGION,
} from '@/lib/utils/phone';

describe('DEFAULT_PHONE_REGION', () => {
  it('defaults to US when env is unset (preserves legacy behavior)', () => {
    // In the test env NEXT_PUBLIC_DEFAULT_PHONE_REGION is unset → 'US'
    expect(DEFAULT_PHONE_REGION).toBe('US');
  });
});

describe('normalizePhone — US parity (regression guard)', () => {
  // [input, expected] — expected values are the EXACT legacy outputs.
  const cases: Array<[string, string]> = [
    ['+12164281997', '12164281997'],
    ['12164281997', '12164281997'],
    ['2164281997', '12164281997'],
    ['(216) 428-1997', '12164281997'],
    ['+1-216-428-1997', '12164281997'],
    ['216.428.1997', '12164281997'],
    ['+1 (216) 428-1997', '12164281997'],
    ['216 428 1997', '12164281997'],
    ['1-800-123-4567', '18001234567'],
    ['8001234567', '18001234567'],
  ];
  it.each(cases)('normalizePhone(%s) === %s', (input, expected) => {
    expect(normalizePhone(input)).toBe(expected);
  });

  const legacyFallback: Array<[string, string]> = [
    ['', ''],
    ['abc', ''],
    ['12345', '12345'],       // short code → as-is
    ['+442071234567', '442071234567'], // already-E.164 international → digits
  ];
  it.each(legacyFallback)('fallback normalizePhone(%s) === %s', (input, expected) => {
    expect(normalizePhone(input)).toBe(expected);
  });

  it('returns empty for null/undefined', () => {
    expect(normalizePhone(null)).toBe('');
    expect(normalizePhone(undefined)).toBe('');
  });
});

describe('normalizePhone — international (UK/GB via defaultRegion)', () => {
  it('parses a UK mobile in national format (leading 0)', () => {
    expect(normalizePhone('07911 123456', 'GB')).toBe('447911123456');
  });
  it('parses a UK mobile without the leading 0', () => {
    expect(normalizePhone('7911123456', 'GB')).toBe('447911123456');
  });
  it('parses a UK landline (020) in national format', () => {
    expect(normalizePhone('020 7123 4567', 'GB')).toBe('442071234567');
  });
  it('accepts +E.164 UK regardless of default region', () => {
    expect(normalizePhone('+447911123456')).toBe('447911123456');
    expect(normalizePhone('+44 7911 123456', 'US')).toBe('447911123456');
  });
  it('does NOT US-mangle a UK national number when region is GB', () => {
    // Legacy would have produced '17911123456' (wrong). Library → correct.
    expect(normalizePhone('7911123456', 'GB')).not.toBe('17911123456');
  });
});

describe('normalizePhone — dialer robustness (isPossible) + reserved/edge ranges', () => {
  it('normalizes reserved-for-test UK numbers (dialable-format, not strictly "valid")', () => {
    expect(normalizePhone('07700900123', 'GB')).toBe('447700900123');
    expect(normalizePhone('7700900123', 'GB')).toBe('447700900123');
    expect(normalizePhone('+447700900123')).toBe('447700900123');
  });
  it('still empty / raw for genuinely non-dialable input (parity preserved)', () => {
    expect(normalizePhone('abc')).toBe('');
    expect(normalizePhone('12345')).toBe('12345');
    expect(normalizePhone(null)).toBe('');
  });
});

describe('mixed US/UK list — a country code identifies the country unambiguously', () => {
  // Region default is US in tests, but a present country code overrides it.
  const list: Array<[string, string]> = [
    ['+12164281997', '12164281997'],    // US, +
    ['+447911123456', '447911123456'],  // UK, +
    ['12164281997', '12164281997'],     // US, stored (11-digit)
    ['447911123456', '447911123456'],   // UK, stored (12-digit)
  ];
  it.each(list)('%s → %s', (input, expected) => {
    expect(normalizePhone(input)).toBe(expected);
  });
});

describe('normalizePhone — idempotency (critical for keys/comparisons)', () => {
  const inputs: Array<[string, string]> = [
    ['2164281997', 'US'],
    ['(216) 428-1997', 'US'],
    ['12164281997', 'US'],
    ['07911 123456', 'GB'],
    ['+447911123456', 'GB'],
    ['020 7123 4567', 'GB'],
  ];
  it.each(inputs)('normalize(normalize(%s)) is stable', (input, region) => {
    const once = normalizePhone(input, region as any);
    const twice = normalizePhone(once, region as any);
    expect(twice).toBe(once);
  });
});

describe('phonesMatch', () => {
  it('matches different formats of the same US number', () => {
    const formats = [
      '+12164281997',
      '12164281997',
      '2164281997',
      '(216) 428-1997',
      '+1-216-428-1997',
      '216.428.1997',
    ];
    for (const a of formats) for (const b of formats) {
      expect(phonesMatch(a, b)).toBe(true);
    }
  });
  it('matches UK formats with GB region', () => {
    expect(phonesMatch('07911 123456', '+447911123456', 'GB')).toBe(true);
  });
  it('does not match different numbers', () => {
    expect(phonesMatch('12164281997', '12164281998')).toBe(false);
    expect(phonesMatch('2164281997', '2174281997')).toBe(false);
  });
  it('handles null/undefined', () => {
    expect(phonesMatch(null, '12164281997')).toBe(false);
    expect(phonesMatch(null, null)).toBe(true);
    expect(phonesMatch(undefined, '12164281997')).toBe(false);
  });
});

describe('toE164', () => {
  it('adds + to a normalized US number', () => {
    expect(toE164('12164281997')).toBe('+12164281997');
    expect(toE164('2164281997')).toBe('+12164281997');
  });
  it('adds + to a UK number with GB region', () => {
    expect(toE164('07911 123456', 'GB')).toBe('+447911123456');
  });
  it('returns empty for empty input', () => {
    expect(toE164('')).toBe('');
    expect(toE164(null)).toBe('');
  });
});

describe('formatPhone (country-aware)', () => {
  it('formats US numbers in national style', () => {
    expect(formatPhone('12164281997')).toBe('(216) 428-1997');
    expect(formatPhone('2164281997')).toBe('(216) 428-1997');
  });
  it('formats UK numbers in national style', () => {
    // GB national format (grouping may vary by libphonenumber version)
    expect(formatPhone('447911123456', 'GB')).toMatch(/07911/);
  });
  it('returns empty for empty input', () => {
    expect(formatPhone(null)).toBe('');
    expect(formatPhone('')).toBe('');
  });
});

describe('formatPhoneUS (legacy, unchanged for US)', () => {
  it('formats 11 / 10 / +prefixed US numbers', () => {
    expect(formatPhoneUS('12164281997')).toBe('(216) 428-1997');
    expect(formatPhoneUS('2164281997')).toBe('(216) 428-1997');
    expect(formatPhoneUS('+12164281997')).toBe('(216) 428-1997');
    expect(formatPhoneUS('(216) 428-1997')).toBe('(216) 428-1997');
  });
  it('edge cases', () => {
    expect(formatPhoneUS(null)).toBe('');
    expect(formatPhoneUS(undefined)).toBe('');
    expect(formatPhoneUS('12345')).toBe('12345');
  });
});

describe('formatPhoneDisplay', () => {
  it('adds + prefix', () => {
    expect(formatPhoneDisplay('12164281997')).toBe('+12164281997');
    expect(formatPhoneDisplay('2164281997')).toBe('+12164281997');
    expect(formatPhoneDisplay('+12164281997')).toBe('+12164281997');
  });
  it('edge cases', () => {
    expect(formatPhoneDisplay(null)).toBe('');
    expect(formatPhoneDisplay('')).toBe('');
  });
});
