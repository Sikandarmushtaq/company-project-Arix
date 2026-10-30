/**
 * Phone Number Normalization - SINGLE SOURCE OF TRUTH
 *
 * STANDARD (internal) FORMAT: E.164 digits WITHOUT the '+' prefix.
 *   US: 12164281997   UK: 447911123456
 *
 * This is exactly "E.164 minus the +", so existing US values stay byte-identical
 * while international numbers become correct. Used EVERYWHERE:
 * - API requests/responses
 * - Socket room names
 * - Cache keys
 * - Comparisons
 * - Display (internally)
 *
 * INTERNATIONAL SUPPORT (2026): normalization/parsing is powered by
 * libphonenumber-js. The DEFAULT REGION controls how a bare national number is
 * interpreted (e.g. '07911 123456' → GB). It defaults to 'US' so existing US
 * behavior is preserved; set NEXT_PUBLIC_DEFAULT_PHONE_REGION per deployment
 * (this client uses 'GB'). Anything the library can't validate falls back to the
 * exact legacy US heuristic, so US output is guaranteed identical.
 *
 * IMPORTANT: This MUST match backend logic in:
 * server/src/shared/utils/phone.normalize.ts
 *
 * @module lib/utils/phone
 */

import { parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js';

/**
 * Deployment default region for parsing bare national numbers.
 * 'US' preserves legacy behavior; override with NEXT_PUBLIC_DEFAULT_PHONE_REGION.
 */
export const DEFAULT_PHONE_REGION: CountryCode = ((
  process.env.NEXT_PUBLIC_DEFAULT_PHONE_REGION || 'US'
).toUpperCase() as CountryCode);

/**
 * Normalize a phone number to the STANDARD FORMAT: E.164 digits, no '+'.
 *
 * Rules (in order):
 *  1. Input with a leading '+' → strict E.164 parse (region-independent).
 *  2. Bare number → parse as a national number in `defaultRegion`.
 *  3. Fallback → exact legacy US heuristic (10 → prepend 1; 11-starting-1 as-is;
 *     else raw digits). Guarantees US parity + idempotency for anything the
 *     library can't validate (short codes, partials, placeholders).
 *
 * The optional `defaultRegion` param keeps every existing single-arg call site
 * behaving identically.
 *
 * @example
 * normalizePhone('+12164281997')          // '12164281997'
 * normalizePhone('2164281997')            // '12164281997' (US default)
 * normalizePhone('(216) 428-1997')        // '12164281997'
 * normalizePhone('07911 123456', 'GB')    // '447911123456'
 * normalizePhone('+447911123456')         // '447911123456'
 */
export function normalizePhone(
  phone: string | null | undefined,
  defaultRegion: CountryCode = DEFAULT_PHONE_REGION
): string {
  if (!phone) return '';
  const input = String(phone).trim();
  if (!input) return '';

  // Defensive: if invoked as an array callback (e.g. arr.map(normalizePhone)),
  // the 2nd arg is a numeric index — ignore anything that isn't a 2-letter region.
  const region: CountryCode =
    typeof defaultRegion === 'string' && defaultRegion.length === 2
      ? (defaultRegion.toUpperCase() as CountryCode)
      : DEFAULT_PHONE_REGION;

  // 1) Explicit '+' → unambiguous E.164 (never guess a region for these).
  if (input.startsWith('+')) {
    const parsed = parsePhoneNumberFromString(input);
    if (parsed && parsed.isPossible()) return parsed.number.slice(1);
  } else {
    // 2) Bare number → national parse in the default region.
    const parsed = parsePhoneNumberFromString(input, region);
    if (parsed && parsed.isPossible()) return parsed.number.slice(1);
  }

  // 3) Legacy fallback — exact historical behavior (US-centric).
  const digits = input.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length === 10) return `1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return digits;
  return digits;
}

/**
 * Compare two phone numbers for equality (region-aware via normalizePhone).
 *
 * @example
 * phonesMatch('+12164281997', '12164281997')   // true
 * phonesMatch('2164281997', '+1-216-428-1997')  // true
 */
export function phonesMatch(
  phone1: string | null | undefined,
  phone2: string | null | undefined,
  defaultRegion: CountryCode = DEFAULT_PHONE_REGION
): boolean {
  return normalizePhone(phone1, defaultRegion) === normalizePhone(phone2, defaultRegion);
}

/**
 * Check if a phone number belongs to the user (any of their numbers).
 * Used across phone, history, and contacts pages to prevent self-calls.
 */
export function isOwnNumber(
  numberToCheck: string,
  senderPhone: string | null | undefined,
  allPhones?: Array<{ phoneNumber: string }>
): boolean {
  if (!senderPhone) return false;
  const normalized = normalizePhone(numberToCheck);
  if (normalized === normalizePhone(senderPhone)) return true;
  if (allPhones) {
    return allPhones.some((p) => normalizePhone(p.phoneNumber) === normalized);
  }
  return false;
}

/**
 * Convert to E.164 (with '+') — use at EXTERNAL boundaries (Twilio, tel: links,
 * carriers) that require a leading '+'. Internal storage stays without the '+'.
 *
 * @example toE164('12164281997') // '+12164281997'
 */
export function toE164(
  phone: string | null | undefined,
  defaultRegion: CountryCode = DEFAULT_PHONE_REGION
): string {
  const normalized = normalizePhone(phone, defaultRegion);
  return normalized ? `+${normalized}` : '';
}

/**
 * Country-aware display formatting. Renders a number in its OWN country's national
 * style (US → (216) 428-1997, GB → 07911 123456). Falls back to the legacy US
 * formatter for anything unparseable, so existing US display is preserved.
 *
 * This is the SSOT display formatter — prefer it over formatPhoneUS going forward.
 */
export function formatPhone(
  phone: string | null | undefined,
  defaultRegion: CountryCode = DEFAULT_PHONE_REGION
): string {
  if (!phone) return '';
  const e164 = toE164(phone, defaultRegion);
  if (e164) {
    const parsed = parsePhoneNumberFromString(e164);
    if (parsed && parsed.isPossible()) return parsed.formatNational();
  }
  return formatPhoneUS(phone);
}

/**
 * Format phone for US display: (XXX) XXX-XXXX
 *
 * @deprecated for international UIs — use formatPhone() (country-aware). Retained
 * for backward compatibility; unchanged behavior for US numbers.
 */
export function formatPhoneUS(phone: string | null | undefined): string {
  const normalized = normalizePhone(phone);
  // Get last 10 digits for display formatting
  const digits = normalized.slice(-10);
  if (digits.length !== 10) {
    return phone || '';
  }
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

/**
 * Format phone for display with + prefix (E.164)
 */
export function formatPhoneDisplay(phone: string | null | undefined): string {
  if (!phone) return '';
  const normalized = normalizePhone(phone);
  if (!normalized) return '';
  return `+${normalized}`;
}

// ============================================================
// DEPRECATED - Keep for backward compatibility during migration
// Remove these after all usages are updated
// ============================================================

/**
 * @deprecated Use normalizePhone() instead - now returns 11 digits
 */
export function normalizeForComparison(phone: string | null | undefined): string {
  return normalizePhone(phone);
}

/**
 * @deprecated Use normalizePhone() instead
 */
export function getLast10Digits(phone: string): string {
  return normalizePhone(phone);
}

/**
 * @deprecated Use normalizePhone() instead
 */
export function normalizeForApi(phone: string | null | undefined): string {
  return normalizePhone(phone);
}

/**
 * @deprecated Use formatPhoneDisplay() instead
 */
export function normalizeForDisplay(phone: string | null | undefined): string {
  return formatPhoneDisplay(phone);
}

/**
 * @deprecated Use formatPhoneUS() instead
 */
export function formatPhoneForDisplay(phone: string): string {
  return formatPhoneUS(phone);
}

/**
 * Formats a phone number for display. Now country-aware (delegates to
 * formatPhone) so UK/international numbers render correctly; US output is
 * unchanged. Kept as a named export so existing importers need no change.
 */
export const formatPhoneNumber = formatPhone;
