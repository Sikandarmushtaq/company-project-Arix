'use client';

import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { FiX, FiPlus, FiSearch, FiPhone, FiUsers } from 'react-icons/fi';
import { Button } from '@/components/ui';
import { useContacts } from '@/lib/hooks';
import { normalizePhone, formatPhoneNumber } from '@/lib/utils/phone';
import { useDebounce } from '@/lib/hooks/useDebounce';
import { GenericAvatar } from '@/components/phone/chrome/avatarUtils';

/**
 * Validates phone number format
 * Accepts: 10-15 digits, optional + prefix, optional country code
 */
export function isValidPhoneNumber(input: string): boolean {
  const digits = input.replace(/\D/g, '');
  // Must be 10-15 digits (international standard)
  if (digits.length < 10 || digits.length > 15) return false;
  // Basic pattern: starts with valid digits (not 0 or 1 for US, or valid country codes)
  return /^[1-9]\d{9,14}$/.test(digits) || /^1[2-9]\d{9}$/.test(digits);
}

export interface SelectedMember {
  id: string;
  phoneNumber: string;
  name: string;
}

interface ContactPickerProps {
  isOpen: boolean;
  onClose: () => void;
  onAddMember: (member: Omit<SelectedMember, 'id'>) => void;
  existingMembers: SelectedMember[];
}

/**
 * ContactPicker - Smart contact search with phone number detection
 *
 * Features:
 * - Single search input with auto-detection
 * - Type phone number (10+ digits) to add directly
 * - Type name to search saved contacts
 * - Debounced search for performance
 * - Duplicate prevention
 */
export const ContactPicker = React.memo(function ContactPicker({
  isOpen,
  onClose,
  onAddMember,
  existingMembers,
}: ContactPickerProps) {
  const { data: contacts = [] } = useContacts();
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const debouncedQuery = useDebounce(searchQuery, 150);

  // Extract digits for phone detection
  const digitsOnly = searchQuery.replace(/\D/g, '');
  const isPhoneQuery = digitsOnly.length >= 3;
  const isValidPhone = isValidPhoneNumber(searchQuery);

  // Check if this number is already added
  const isNumberAlreadyAdded = useMemo(() => {
    if (!isValidPhone) return false;
    const normalized = normalizePhone(searchQuery);
    return existingMembers.some((m) => normalizePhone(m.phoneNumber) === normalized);
  }, [searchQuery, existingMembers, isValidPhone]);

  // Filter contacts based on debounced search
  const filteredContacts = useMemo(() => {
    const query = debouncedQuery.toLowerCase().trim();
    const queryDigits = debouncedQuery.replace(/\D/g, '');

    // Base filter: exclude already added members
    const availableContacts = contacts.filter(
      (c) =>
        !existingMembers.some((m) => normalizePhone(m.phoneNumber) === normalizePhone(c.contact))
    );

    if (!query) return availableContacts;

    return availableContacts.filter((contact) => {
      const nameMatch = contact.name.toLowerCase().includes(query);
      const phoneMatch = queryDigits && contact.contact.replace(/\D/g, '').includes(queryDigits);
      return nameMatch || phoneMatch;
    });
  }, [contacts, existingMembers, debouncedQuery]);

  // Reset and focus when opening
  useEffect(() => {
    if (isOpen) {
      setSearchQuery('');
      requestAnimationFrame(() => searchInputRef.current?.focus());
    }
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  const handleAddContact = useCallback(
    (contact: { name: string; contact: string }) => {
      onAddMember({
        phoneNumber: normalizePhone(contact.contact),
        name: contact.name,
      });
      setSearchQuery('');
    },
    [onAddMember]
  );

  const handleAddPhoneNumber = useCallback(() => {
    if (!isValidPhone || isNumberAlreadyAdded) return;

    onAddMember({
      phoneNumber: normalizePhone(searchQuery),
      name: '',
    });
    setSearchQuery('');
  }, [searchQuery, isValidPhone, isNumberAlreadyAdded, onAddMember]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && isValidPhone && !isNumberAlreadyAdded) {
        e.preventDefault();
        handleAddPhoneNumber();
      }
    },
    [isValidPhone, isNumberAlreadyAdded, handleAddPhoneNumber]
  );

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="bg-[var(--card)] rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
          <h3 className="text-lg font-black text-[var(--foreground)]">Add Members</h3>
          <button
            onClick={onClose}
            className="grid place-items-center w-9 h-9 rounded-full text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
            aria-label="Close"
          >
            <FiX className="w-[18px] h-[18px]" />
          </button>
        </div>

        {/* Smart Search Input */}
        <div className="p-3 border-b border-[var(--border)]">
          <div className="flex items-center gap-2 px-3 h-10 rounded-xl border border-[var(--border)] bg-[var(--muted)]/40 focus-within:border-[var(--primary-500)] transition-colors">
            <FiSearch className="w-4 h-4 shrink-0 text-[var(--muted-foreground)]" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search contacts or enter phone number"
              className="nx-search-input w-full bg-transparent outline-none text-[13.5px] text-[var(--foreground)]"
              autoComplete="off"
            />
            {searchQuery && (
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setSearchQuery('')}
                title="Clear search"
                aria-label="Clear search"
                className="grid place-items-center w-5 h-5 rounded-full shrink-0 text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
              >
                <FiX className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Results */}
        <div className="max-h-72 overflow-y-auto">
          {/* Add as phone number option */}
          {isValidPhone && !isNumberAlreadyAdded && (
            <button
              type="button"
              onClick={handleAddPhoneNumber}
              className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-[var(--primary-50)] dark:hover:bg-[var(--primary-900)]/30 transition-colors text-left border-b border-[var(--border)] bg-[var(--primary-50)]/50 dark:bg-[var(--primary-900)]/20"
            >
              <span className="grid place-items-center w-9 h-9 rounded-full bg-[var(--primary-600)] text-white shrink-0">
                <FiPhone className="w-[18px] h-[18px]" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-[var(--foreground)] truncate">
                  Add “{formatPhoneNumber(digitsOnly)}”
                </p>
                <p className="text-xs text-[var(--muted-foreground)]">Add as new number</p>
              </div>
              <FiPlus className="w-[18px] h-[18px] text-[var(--foreground)] shrink-0" />
            </button>
          )}

          {/* Already added indicator */}
          {isValidPhone && isNumberAlreadyAdded && (
            <div className="px-4 py-3 border-b border-[var(--border)] bg-[var(--muted)]/50">
              <p className="text-sm text-[var(--muted-foreground)]">This number is already added</p>
            </div>
          )}

          {/* Contact List */}
          {filteredContacts.length > 0 ? (
            filteredContacts.map((contact) => (
              <button
                key={contact.id}
                type="button"
                onClick={() => handleAddContact(contact)}
                className="group w-full flex items-center gap-3 px-4 py-2 hover:bg-[var(--muted)] transition-colors text-left border-b border-[var(--border)]/60 last:border-b-0"
              >
                <GenericAvatar name={contact.name} number={contact.contact} size={36} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-[var(--foreground)] truncate">{contact.name}</p>
                  <p className="text-xs text-[var(--muted-foreground)] truncate">
                    {formatPhoneNumber(contact.contact)}
                  </p>
                </div>
                <FiPlus className="w-[18px] h-[18px] text-[var(--muted-foreground)] shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            ))
          ) : !isValidPhone && searchQuery ? (
            <div className="text-center py-8 text-[var(--muted-foreground)]">
              <FiSearch className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm font-bold text-[var(--foreground)]">No matching contacts</p>
            </div>
          ) : !searchQuery && contacts.length === 0 ? (
            <div className="text-center py-8 text-[var(--muted-foreground)]">
              <FiUsers className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm font-bold text-[var(--foreground)]">No saved contacts</p>
              <p className="text-xs mt-1">Enter a phone number to add</p>
            </div>
          ) : null}
        </div>

        {/* Done button */}
        <div className="p-3 border-t border-[var(--border)]">
          <Button className="w-full" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    </div>
  );
});

export default ContactPicker;
