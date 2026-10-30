'use client';

/**
 * ContactName Component - SSOT display component for contact names
 *
 * Displays a contact's name if saved, otherwise shows the formatted phone number.
 * Automatically updates when contacts are added/updated/deleted.
 *
 * @example
 * // Basic usage
 * <ContactName phone="+12164281997" />
 *
 * @example
 * // With API-enriched fallback
 * <ContactName phone={call.caller} fallbackName={call.contactName} />
 *
 * @example
 * // With custom styling for contacts
 * <ContactName phone={phone} contactClassName="font-semibold text-blue-600" />
 *
 * @module components/ui/ContactName
 */

import React from 'react';
import { useResolvedContact } from '@/lib/hooks/useContactName';

export interface ContactNameProps {
  /** Phone number to look up */
  phone: string | null | undefined;
  /** Optional fallback name from API (e.g., call.contactName) */
  fallbackName?: string | null;
  /** Additional class names */
  className?: string;
  /** Class name applied only when displaying a saved contact name */
  contactClassName?: string;
  /** Class name applied only when displaying a phone number */
  phoneClassName?: string;
  /** Whether to show a badge/indicator for saved contacts */
  showContactIndicator?: boolean;
  /** Custom indicator element for saved contacts */
  contactIndicator?: React.ReactNode;
}

/**
 * ContactName - Displays contact name or formatted phone number
 */
export const ContactName: React.FC<ContactNameProps> = React.memo(
  ({
    phone,
    fallbackName,
    className = '',
    contactClassName = '',
    phoneClassName = '',
    showContactIndicator = false,
    contactIndicator,
  }) => {
    const { displayName, isContact, source } = useResolvedContact(phone, fallbackName);

    const appliedClassName = [
      className,
      isContact ? contactClassName : '',
      source === 'phone' ? phoneClassName : '',
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <span className={appliedClassName || undefined}>
        {displayName}
        {showContactIndicator &&
          isContact &&
          (contactIndicator || (
            <span className="ml-1 text-xs text-green-500" title="Saved contact">
              *
            </span>
          ))}
      </span>
    );
  }
);

ContactName.displayName = 'ContactName';

/**
 * ContactNameWithBadge - ContactName with a visual badge for saved contacts
 */
export const ContactNameWithBadge: React.FC<
  Omit<ContactNameProps, 'showContactIndicator' | 'contactIndicator'>
> = React.memo((props) => {
  const { isContact } = useResolvedContact(props.phone, props.fallbackName);

  return (
    <span className="inline-flex items-center gap-1.5">
      <ContactName {...props} />
      {isContact && (
        <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded">
          Contact
        </span>
      )}
    </span>
  );
});

ContactNameWithBadge.displayName = 'ContactNameWithBadge';

export default ContactName;
