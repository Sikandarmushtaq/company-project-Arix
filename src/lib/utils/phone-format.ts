/**
 * Phone Formatting + Country helpers (presentation layer)
 *
 * Built on libphonenumber-js. Powers the country-aware phone input UX:
 * live "as you type" formatting, dial-time validity, and the country list.
 * Normalization SSOT stays in ./phone (normalizePhone / toE164).
 *
 * @module lib/utils/phone-format
 */

import {
  AsYouType,
  getCountries,
  getCountryCallingCode,
  parsePhoneNumberFromString,
  type CountryCode,
} from 'libphonenumber-js';
import { DEFAULT_PHONE_REGION } from './phone';

export type { CountryCode };
export { DEFAULT_PHONE_REGION };

/** ISO-3166 alpha-2 → flag emoji (regional indicator symbols). */
export function countryFlag(code: string): string {
  const cc = code.toUpperCase();
  if (!/^[A-Z]{2}$/.test(cc)) return '🏳️';
  return String.fromCodePoint(...[...cc].map((c) => 127397 + c.charCodeAt(0)));
}

export interface CountryOption {
  code: CountryCode;
  name: string;
  callingCode: string; // e.g. '44'
  flag: string;
}

let _countryOptions: CountryOption[] | null = null;

/** All dialable countries, sorted by name (memoized). */
export function getCountryOptions(): CountryOption[] {
  if (_countryOptions) return _countryOptions;
  let names: Intl.DisplayNames | null = null;
  try {
    names = new Intl.DisplayNames(['en'], { type: 'region' });
  } catch {
    names = null;
  }
  _countryOptions = getCountries()
    .map((code) => ({
      code,
      name: names?.of(code) || code,
      callingCode: getCountryCallingCode(code),
      flag: countryFlag(code),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
  return _countryOptions;
}

/** Live "as you type" national formatting for the given region. */
export function formatAsYouType(input: string, region: CountryCode = DEFAULT_PHONE_REGION): string {
  if (!input) return '';
  return new AsYouType(region).input(input);
}

/**
 * Is this input dialable (correct length/format for the region)?
 * Uses isPossible (not isValid) to match the normalizer's dialer-appropriate policy.
 */
export function isPossibleNumber(
  input: string | null | undefined,
  region: CountryCode = DEFAULT_PHONE_REGION
): boolean {
  if (!input) return false;
  const raw = String(input).trim();
  if (!raw) return false;
  const parsed = raw.startsWith('+')
    ? parsePhoneNumberFromString(raw)
    : parsePhoneNumberFromString(raw, region);
  return !!parsed && parsed.isPossible();
}

/**
 * Pretty E.164-with-spacing for display, e.g. '+44 7911 123456'.
 * Falls back to a bare '+digits' if it can't parse.
 */
export function formatInternational(
  input: string | null | undefined,
  region: CountryCode = DEFAULT_PHONE_REGION
): string {
  if (!input) return '';
  const raw = String(input).trim();
  const parsed = raw.startsWith('+')
    ? parsePhoneNumberFromString(raw)
    : parsePhoneNumberFromString(raw, region);
  if (parsed) return parsed.formatInternational();
  const digits = raw.replace(/\D/g, '');
  return digits ? `+${digits}` : '';
}

/** Best-guess country for a number (for pre-selecting the flag on an existing value). */
export function detectCountry(
  input: string | null | undefined,
  fallback: CountryCode = DEFAULT_PHONE_REGION
): CountryCode {
  if (!input) return fallback;
  const raw = String(input).trim();
  const parsed = raw.startsWith('+')
    ? parsePhoneNumberFromString(raw)
    : parsePhoneNumberFromString(raw, fallback);
  return (parsed?.country as CountryCode) || fallback;
}
