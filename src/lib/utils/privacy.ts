/**
 * Privacy display utilities.
 *
 * Single source of truth for the "WhatsApp privacy mode" UX. When an agent
 * has `user.waPhoneMaskEnabled = true`, the WhatsApp pages and the
 * /phone/contacts page must hide raw customer numbers. This module decides
 * what to render in their place.
 *
 * Why client-side only? See CLAUDE.md project notes — the cheap-path
 * design ships phones to the client (cache/state need them as routing
 * keys) but never paints them. Stops casual copy-paste theft. Devtools
 * digging defeats it; that's the documented tradeoff.
 *
 * @module lib/utils/privacy
 */
import { formatPhone } from './phone';

/**
 * Last-4-digit fallback used when no contact name is available. Stable
 * enough that an agent can still reference the customer ("the one ending
 * in 1997"), but not actionable for copy/paste.
 */
function maskedTail(phone: string | null | undefined): string {
  if (!phone) return 'Unknown contact';
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 4) return 'Unknown contact';
  return `Customer ••••${digits.slice(-4)}`;
}

/**
 * Decide what to display for a contact across WhatsApp + /phone/contacts.
 *
 * - Not masked: returns the contact name when present, else the formatted
 *   phone number (existing behaviour, unchanged for the 99% of users).
 * - Masked: returns the contact name when present, else "Customer ••••1997".
 *   Phone is never returned to the caller.
 */
export function getContactDisplayName(
  phone: string | null | undefined,
  contactName: string | null | undefined,
  isMasked: boolean
): string {
  const name = contactName?.trim();
  if (name) return name;
  if (isMasked) return maskedTail(phone);
  return phone ? formatPhone(phone) : 'Unknown';
}

/**
 * For the rare case where the UI needs to render only the phone (e.g. a
 * "Phone" cell on the contacts page). Returns the masked tail when
 * privacy mode is on, else the formatted phone.
 */
export function getDisplayPhone(phone: string | null | undefined, isMasked: boolean): string {
  if (!phone) return '—';
  if (isMasked) {
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 4) return '••••';
    return `••••${digits.slice(-4)}`;
  }
  return formatPhone(phone);
}
