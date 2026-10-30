'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { FiChevronDown, FiCheck } from 'react-icons/fi';
import { formatPhoneDisplay } from '@/lib/utils/phone';
import type { PhoneNumber } from '@/lib/types/auth';

/**
 * CompactPhoneSelector - Isolated inline "From:" selector for message composer.
 *
 * Unlike the Header's PhoneSelector (which changes global active phone),
 * this component manages isolated local state — changing the number here
 * only affects which phone the message is sent FROM, without changing
 * the global caller ID or SIP registration.
 *
 * Dropdown renders via portal to escape parent overflow-hidden and
 * opens upward from the trigger button.
 *
 * Follows the same isolated pattern as bulk-sms page's phone selector.
 */

interface CompactPhoneSelectorProps {
  /** Currently selected phone number (controlled) */
  value: string;
  /** Called when user selects a different phone */
  onChange: (phoneNumber: string) => void;
  /** All phone numbers available to this user */
  phoneNumbers: PhoneNumber[];
}

export const CompactPhoneSelector: React.FC<CompactPhoneSelectorProps> = ({
  value,
  onChange,
  phoneNumbers,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Don't render if single phone
  if (phoneNumbers.length <= 1) return null;

  const activeDigits = value.replace(/\D/g, '');

  const handleSelect = useCallback(
    (phone: PhoneNumber) => {
      if (phone.phoneNumber.replace(/\D/g, '') === activeDigits) {
        setIsOpen(false);
        return;
      }
      onChange(phone.phoneNumber);
      setIsOpen(false);
    },
    [activeDigits, onChange]
  );

  // Close on outside click
  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        triggerRef.current?.contains(e.target as Node) ||
        dropdownRef.current?.contains(e.target as Node)
      ) {
        return;
      }
      setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Calculate dropdown position relative to the trigger (portal needs absolute coords)
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});

  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    if (!isOpen || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setDropdownStyle({
      position: 'fixed',
      left: rect.left,
      bottom: window.innerHeight - rect.top + 4,
      width: 224,
      zIndex: 9999,
    });
  }, [isOpen]);

  return (
    <div className="px-4 pt-2 pb-1">
      <button
        ref={triggerRef}
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center gap-1.5 text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors group"
        aria-label="Change sending number"
        aria-expanded={isOpen}
      >
        <span className="text-[var(--muted-foreground)]">From:</span>
        <span className="font-medium text-[var(--foreground)] group-hover:text-[var(--foreground)] transition-colors">
          {formatPhoneDisplay(value)}
        </span>
        <FiChevronDown className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen &&
        createPortal(
          <div
            ref={dropdownRef}
            style={dropdownStyle}
            className="bg-[var(--card)] border border-[var(--border)] rounded-lg shadow-lg py-1 overflow-hidden"
          >
            <div className="px-3 py-1.5 border-b border-[var(--border)]">
              <p className="text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wider">
                Send from
              </p>
            </div>
            {phoneNumbers.map((phone) => {
              const isActive = phone.phoneNumber.replace(/\D/g, '') === activeDigits;
              return (
                <button
                  key={phone.id}
                  onClick={() => handleSelect(phone)}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-[var(--background)] transition-colors ${
                    isActive ? 'bg-[var(--primary-50)] dark:bg-[var(--primary-900)]/20' : ''
                  }`}
                >
                  <span
                    className={`text-sm font-medium flex-1 ${
                      isActive ? 'text-[var(--foreground)]' : 'text-[var(--foreground)]'
                    }`}
                  >
                    {formatPhoneDisplay(phone.phoneNumber)}
                  </span>
                  {phone.label && (
                    <span className="text-xs text-[var(--muted-foreground)] truncate max-w-[80px]">
                      {phone.label}
                    </span>
                  )}
                  {isActive && (
                    <FiCheck className="w-3.5 h-3.5 text-[var(--foreground)] flex-shrink-0" />
                  )}
                </button>
              );
            })}
          </div>,
          document.body
        )}
    </div>
  );
};
