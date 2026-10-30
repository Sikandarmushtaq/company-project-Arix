'use client';

/**
 * Contact Lookup Store - SINGLE SOURCE OF TRUTH for contact name resolution
 *
 * This store provides a centralized, phone-indexed cache for looking up
 * contact names anywhere in the application. It syncs with the contacts
 * React Query cache and provides reactive lookups.
 *
 * Usage:
 * - useContactName(phoneNumber) - Hook for reactive component lookups
 * - getContactName(phoneNumber) - Function for non-reactive contexts
 * - ContactName component - Display component with fallback formatting
 *
 * @module lib/stores/contactLookup
 */

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { normalizePhone, phonesMatch } from '@/lib/utils/phone';

/**
 * Contact entry in the lookup cache
 */
export interface CachedContact {
  id: number;
  name: string;
  phone: string; // Normalized phone number
  type?: string;
}

/**
 * Contact lookup store state
 */
interface ContactLookupStore {
  /** Map of normalized phone -> contact info */
  contacts: Map<string, CachedContact>;
  /** Whether the cache has been initialized */
  isInitialized: boolean;
  /** Whether contacts are currently being loaded */
  isLoading: boolean;
  /** Error message if loading failed */
  error: string | null;
  /** Last update timestamp */
  lastUpdated: number;

  /** Initialize/update the cache with contacts array */
  setContacts: (
    contacts: Array<{ id: number; contact: string; name: string; type?: string }>
  ) => void;
  /** Add or update a single contact */
  upsertContact: (contact: { id: number; contact: string; name: string; type?: string }) => void;
  /** Remove a contact by phone number */
  removeContact: (phone: string) => void;
  /** Clear the cache */
  clear: () => void;
  /** Set loading state */
  setLoading: (isLoading: boolean) => void;
  /** Set error state */
  setError: (error: string | null) => void;
  /** Look up a contact name by phone number */
  getContactName: (phone: string | null | undefined) => string | null;
  /** Look up full contact info by phone number */
  getContact: (phone: string | null | undefined) => CachedContact | null;
}

export const useContactLookupStore = create<ContactLookupStore>()(
  subscribeWithSelector((set, get) => ({
    contacts: new Map(),
    isInitialized: false,
    isLoading: false,
    error: null,
    lastUpdated: 0,

    setLoading: (isLoading) => set({ isLoading }),

    setError: (error) => set({ error, isLoading: false }),

    setContacts: (contacts) => {
      const contactMap = new Map<string, CachedContact>();

      contacts.forEach((contact) => {
        const normalizedPhone = normalizePhone(contact.contact);
        if (normalizedPhone) {
          contactMap.set(normalizedPhone, {
            id: contact.id,
            name: contact.name,
            phone: normalizedPhone,
            type: contact.type,
          });
        }
      });

      set({
        contacts: contactMap,
        isInitialized: true,
        isLoading: false,
        error: null,
        lastUpdated: Date.now(),
      });
    },

    upsertContact: (contact) => {
      const normalizedPhone = normalizePhone(contact.contact);
      if (!normalizedPhone) return;

      set((state) => {
        const newContacts = new Map(state.contacts);
        newContacts.set(normalizedPhone, {
          id: contact.id,
          name: contact.name,
          phone: normalizedPhone,
          type: contact.type,
        });
        return {
          contacts: newContacts,
          lastUpdated: Date.now(),
        };
      });
    },

    removeContact: (phone) => {
      const normalizedPhone = normalizePhone(phone);
      if (!normalizedPhone) return;

      set((state) => {
        const newContacts = new Map(state.contacts);
        newContacts.delete(normalizedPhone);
        return {
          contacts: newContacts,
          lastUpdated: Date.now(),
        };
      });
    },

    clear: () => {
      set({
        contacts: new Map(),
        isInitialized: false,
        lastUpdated: 0,
      });
    },

    getContactName: (phone) => {
      if (!phone) return null;
      const normalizedPhone = normalizePhone(phone);
      if (!normalizedPhone) return null;
      return get().contacts.get(normalizedPhone)?.name ?? null;
    },

    getContact: (phone) => {
      if (!phone) return null;
      const normalizedPhone = normalizePhone(phone);
      if (!normalizedPhone) return null;
      return get().contacts.get(normalizedPhone) ?? null;
    },
  }))
);

/**
 * Get contact name by phone number (non-reactive)
 * Use this in callbacks, event handlers, or non-component code.
 *
 * @param phone - Phone number to look up
 * @param fallback - Optional fallback if no contact found (defaults to null)
 * @returns Contact name or fallback
 */
export function getContactName(
  phone: string | null | undefined,
  fallback: string | null = null
): string | null {
  return useContactLookupStore.getState().getContactName(phone) ?? fallback;
}

/**
 * Get full contact info by phone number (non-reactive)
 *
 * @param phone - Phone number to look up
 * @returns CachedContact or null
 */
export function getContact(phone: string | null | undefined): CachedContact | null {
  return useContactLookupStore.getState().getContact(phone);
}

/**
 * Check if a phone number has a saved contact
 *
 * @param phone - Phone number to check
 * @returns true if contact exists
 */
export function hasContact(phone: string | null | undefined): boolean {
  return useContactLookupStore.getState().getContact(phone) !== null;
}
