'use client';

/**
 * useContactName Hook - SSOT for contact name resolution in components
 *
 * This hook provides reactive contact name lookups that automatically
 * update when contacts are added, updated, or deleted.
 *
 * @example
 * // Basic usage - returns name or null
 * const name = useContactName(phoneNumber);
 *
 * @example
 * // With formatted fallback
 * const displayName = useContactDisplayName(phoneNumber);
 * // Returns "John Doe" if contact exists, or "(216) 428-1997" if not
 *
 * @example
 * // Full contact info
 * const contact = useContactInfo(phoneNumber);
 * // Returns { name, phone, id, type } or null
 *
 * @module lib/hooks/useContactName
 */

import { useMemo } from 'react';
import { useContactLookupStore, type CachedContact } from '@/lib/stores/contactLookup';
import { normalizePhone, formatPhone } from '@/lib/utils/phone';
import { useAuthStore } from '@/lib/stores';

/**
 * Hook to get contact name by phone number (reactive)
 *
 * @param phone - Phone number to look up
 * @returns Contact name or null if not found
 */
export function useContactName(phone: string | null | undefined): string | null {
  const normalizedPhone = useMemo(() => normalizePhone(phone || ''), [phone]);

  // Subscribe to the specific contact entry for this phone
  const contactName = useContactLookupStore((state) => {
    if (!normalizedPhone) return null;
    return state.contacts.get(normalizedPhone)?.name ?? null;
  });

  return contactName;
}

/**
 * Hook to get display name - contact name with phone number fallback.
 *
 * Privacy mode: when the current user has `waPhoneMaskEnabled` and no
 * contact/API name is available, the phone fallback is replaced with
 * a "Customer ••••1997" stub so agents can still distinguish customers
 * without seeing the raw number. Wiring it here means every WA + contacts
 * call site picks up masking automatically — single SSOT, zero per-page
 * branches.
 *
 * @param phone - Phone number to look up
 * @param apiEnrichedName - Optional name from API (e.g., call.contactName)
 * @returns Contact name, API-enriched name, or (formatted phone | masked stub)
 */
export function useContactDisplayName(
  phone: string | null | undefined,
  apiEnrichedName?: string | null
): string {
  const contactName = useContactName(phone);
  // Truthy check — TINYINT(1) comes back as number 1, not boolean true.
  const isMasked = useAuthStore((state) => !!state.user?.waPhoneMaskEnabled);

  return useMemo(() => {
    // Priority 1: Contact lookup store (SSOT)
    if (contactName) return contactName;

    // Priority 2: API-enriched name (from call/conversation)
    if (apiEnrichedName) return apiEnrichedName;

    // Priority 3 (privacy mode): mask the phone with a last-4 stub.
    if (phone && isMasked) {
      const digits = phone.replace(/\D/g, '');
      if (digits.length >= 4) return `Customer ••••${digits.slice(-4)}`;
      return 'Customer';
    }

    // Priority 3 (normal): Formatted phone number
    if (phone) return formatPhone(phone);

    // Fallback
    return 'Unknown';
  }, [contactName, apiEnrichedName, phone, isMasked]);
}

/**
 * Hook to get full contact info by phone number (reactive)
 *
 * @param phone - Phone number to look up
 * @returns Full contact info or null if not found
 */
export function useContactInfo(phone: string | null | undefined): CachedContact | null {
  const normalizedPhone = useMemo(() => normalizePhone(phone || ''), [phone]);

  const contact = useContactLookupStore((state) => {
    if (!normalizedPhone) return null;
    return state.contacts.get(normalizedPhone) ?? null;
  });

  return contact;
}

/**
 * Hook to check if a phone number has a saved contact (reactive)
 *
 * @param phone - Phone number to check
 * @returns true if contact exists
 */
export function useHasContact(phone: string | null | undefined): boolean {
  const contact = useContactInfo(phone);
  return contact !== null;
}

/**
 * Hook to resolve contact name with metadata
 * Useful when you need to know the source of the name
 *
 * @param phone - Phone number to look up
 * @param apiEnrichedName - Optional name from API
 * @returns Object with resolved name, source, and whether it's a saved contact
 */
export function useResolvedContact(
  phone: string | null | undefined,
  apiEnrichedName?: string | null
): {
  displayName: string;
  contactName: string | null;
  isContact: boolean;
  source: 'contact' | 'api' | 'phone' | 'unknown';
} {
  const contactName = useContactName(phone);

  return useMemo(() => {
    // Priority 1: Contact lookup store (SSOT)
    if (contactName) {
      return {
        displayName: contactName,
        contactName,
        isContact: true,
        source: 'contact' as const,
      };
    }

    // Priority 2: API-enriched name
    if (apiEnrichedName) {
      return {
        displayName: apiEnrichedName,
        contactName: null,
        isContact: false,
        source: 'api' as const,
      };
    }

    // Priority 3: Formatted phone number
    if (phone) {
      return {
        displayName: formatPhone(phone),
        contactName: null,
        isContact: false,
        source: 'phone' as const,
      };
    }

    // Fallback
    return {
      displayName: 'Unknown',
      contactName: null,
      isContact: false,
      source: 'unknown' as const,
    };
  }, [contactName, apiEnrichedName, phone]);
}

/**
 * Hook to get contact lookup store status
 * Use this to show loading indicators or error states
 *
 * @returns Object with isLoading, isInitialized, and error states
 */
export function useContactLookupStatus(): {
  isLoading: boolean;
  isInitialized: boolean;
  error: string | null;
} {
  const isLoading = useContactLookupStore((state) => state.isLoading);
  const isInitialized = useContactLookupStore((state) => state.isInitialized);
  const error = useContactLookupStore((state) => state.error);

  return { isLoading, isInitialized, error };
}
