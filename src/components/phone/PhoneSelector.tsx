'use client';

import React, { useState, useRef, useEffect } from 'react';
import { FiChevronDown, FiPhone, FiCheck, FiCopy } from 'react-icons/fi';
import { FaWhatsapp } from 'react-icons/fa';
import { useAuthStore } from '@/lib/stores';
import { useSocket } from '@/lib/providers/SocketProvider';
import { useWaStatus } from '@/lib/hooks';
import { formatPhoneDisplay } from '@/lib/utils/phone';
import type { PhoneNumber } from '@/lib/types/auth';

/**
 * PhoneSelector — global "active number" dropdown shown in the Header.
 *
 * SIP rows are clickable (click switches the active SIP/SMS number, which
 * triggers re-registration and changes the default SMS sender).
 *
 * The WhatsApp row is INFO-ONLY by design: WA is a separate channel — users
 * can't dial out from a WhatsApp Business number, so making it selectable
 * would be misleading and would also break SIP if clicked.
 *
 * Display rule (inline / keypad variant):
 *   • 2+ numbers, or SIP + WhatsApp → interactive dropdown (switch active number)
 *   • exactly 1 number             → static "My caller ID: <number>"
 *   • no number                    → static "My caller ID: No number assigned"
 * The topbar variant stays hidden unless there's something to switch between.
 */
export const PhoneSelector: React.FC<{ variant?: 'topbar' | 'inline' }> = ({
  variant = 'topbar',
}) => {
  const isInline = variant === 'inline';
  const { user, switchActivePhone } = useAuthStore();
  const { socket } = useSocket();
  const { data: waStatus } = useWaStatus();
  const [isOpen, setIsOpen] = useState(false);
  const [isSwitching, setIsSwitching] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const phoneNumbers: PhoneNumber[] = user?.phoneNumbers || [];
  const waAssigned = waStatus?.assignedNumber ?? null;

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // A real, switchable dropdown is only worth showing when there's more than
  // one thing to pick: multiple SIP numbers, or a SIP number plus WhatsApp.
  const hasMultipleSip = phoneNumbers.length > 1;
  const hasSipPlusWa = phoneNumbers.length >= 1 && !!waAssigned;
  const isSelectable = hasMultipleSip || hasSipPlusWa;

  // Active caller ID: the chosen sender, else the only number on file.
  const activePhone = user?.senderPhone || phoneNumbers[0]?.phoneNumber || '';

  // Copy the active caller ID to the clipboard, with brief "Copied" feedback.
  // Shared by the static (single-number) line and the dropdown trigger.
  const copyCallerId = async () => {
    if (!activePhone) return;
    try {
      await navigator.clipboard.writeText(activePhone);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard blocked (permissions / insecure context) — ignore.
    }
  };

  // Not selectable = 0 or 1 number (and no WA). Rather than hide, show a static
  // caller-ID line so the agent always knows what they'll dial from:
  //   • one number → show it
  //   • no number  → "No number assigned"
  // The topbar variant stays quiet (the inline keypad row is the SSOT).
  if (!isSelectable) {
    if (!isInline) return null;
    if (!activePhone) {
      return (
        <div
          className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[13px]"
          aria-label="My caller ID"
        >
          <span className="text-[var(--muted-foreground)]">My caller ID:</span>
          <span className="font-medium italic text-[var(--muted-foreground)]">
            No number assigned
          </span>
        </div>
      );
    }
    return (
      <button
        type="button"
        onClick={copyCallerId}
        title="Click to copy your caller ID"
        aria-label={`Copy my caller ID, ${formatPhoneDisplay(activePhone)}`}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[13px] rounded-lg hover:bg-[var(--muted)] transition-colors"
      >
        <span className="text-[var(--muted-foreground)]">My caller ID:</span>
        <span className="font-semibold text-[var(--foreground)] tabular-nums">
          {formatPhoneDisplay(activePhone)}
        </span>
        {copied ? (
          <span className="inline-flex items-center gap-1 text-green-600 dark:text-green-400">
            <FiCheck className="w-3.5 h-3.5" />
            <span className="text-[11px] font-semibold">Copied</span>
          </span>
        ) : (
          <FiCopy className="w-3.5 h-3.5 text-[var(--muted-foreground)]" />
        )}
      </button>
    );
  }

  const handleSelect = async (phone: PhoneNumber) => {
    if (phone.phoneNumber.replace(/\D/g, '') === activePhone.replace(/\D/g, '') || isSwitching)
      return;

    setIsSwitching(true);
    setError('');
    try {
      await switchActivePhone(phone.phoneNumber);
      socket?.emit('switch_phone', { newPhone: phone.phoneNumber });
      setIsOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to switch number');
      setTimeout(() => setError(''), 4000);
    } finally {
      setIsSwitching(false);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {isInline ? (
        <div className="inline-flex items-center rounded-lg text-[13px]">
          {/* Number → click to copy */}
          <button
            type="button"
            onClick={copyCallerId}
            title="Click to copy your caller ID"
            aria-label={`Copy my caller ID, ${formatPhoneDisplay(activePhone)}`}
            className="inline-flex items-center gap-1.5 rounded-l-lg py-1 pl-2.5 pr-1.5 hover:bg-[var(--muted)] transition-colors"
          >
            <span className="text-[var(--muted-foreground)]">My caller ID:</span>
            <span className="font-semibold text-[var(--foreground)] tabular-nums">
              {formatPhoneDisplay(activePhone)}
            </span>
            {copied ? (
              <FiCheck className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />
            ) : (
              <FiCopy className="w-3.5 h-3.5 text-[var(--muted-foreground)]" />
            )}
          </button>
          {/* Chevron → open the number switcher */}
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            disabled={isSwitching}
            title="Switch number"
            aria-label="Change caller ID"
            aria-expanded={isOpen}
            className="inline-flex items-center rounded-r-lg py-1 pl-0.5 pr-1.5 hover:bg-[var(--muted)] transition-colors"
          >
            <FiChevronDown
              className={`w-4 h-4 text-[var(--muted-foreground)] transition-transform ${isOpen ? 'rotate-180' : ''}`}
            />
          </button>
        </div>
      ) : (
        <button
          onClick={() => setIsOpen(!isOpen)}
          disabled={isSwitching}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--background)] border border-[var(--border)] hover:border-[var(--primary-400)] transition-colors text-sm"
          aria-label="Switch active phone number"
          aria-expanded={isOpen}
        >
          <FiPhone className="w-3.5 h-3.5 text-[var(--foreground)]" />
          <span className="text-[var(--foreground)] font-medium">
            {formatPhoneDisplay(activePhone)}
          </span>
          <FiChevronDown
            className={`w-3.5 h-3.5 text-[var(--muted-foreground)] transition-transform ${isOpen ? 'rotate-180' : ''}`}
          />
        </button>
      )}

      {isOpen && (
        <div className={`absolute ${isInline ? 'left-1/2 -translate-x-1/2' : 'right-0'} top-full mt-1 w-64 bg-[var(--card)] border border-[var(--border)] rounded-lg shadow-lg z-50 py-1 overflow-hidden`}>
          {/* SIP / Voice & SMS section — clickable, switches active number */}
          {phoneNumbers.length > 0 && (
            <>
              <div className="px-3 py-2 border-b border-[var(--border)]">
                <p className="text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wider">
                  Voice &amp; SMS
                </p>
              </div>
              {error && (
                <div className="px-3 py-1.5 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20">
                  {error}
                </div>
              )}
              {phoneNumbers.map((phone) => {
                const isActive =
                  phone.phoneNumber.replace(/\D/g, '') === activePhone.replace(/\D/g, '');
                return (
                  <button
                    key={phone.id}
                    onClick={() => handleSelect(phone)}
                    disabled={isSwitching}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-[var(--background)] transition-colors ${
                      isActive ? 'bg-[var(--primary-50)] dark:bg-[var(--primary-900)]/20' : ''
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <p
                        className={`text-sm font-medium ${
                          isActive ? 'text-[var(--foreground)]' : 'text-[var(--foreground)]'
                        }`}
                      >
                        {formatPhoneDisplay(phone.phoneNumber)}
                      </p>
                      {phone.label && (
                        <p className="text-xs text-[var(--muted-foreground)] truncate">
                          {phone.label}
                        </p>
                      )}
                    </div>
                    {isActive && (
                      <FiCheck className="w-4 h-4 text-[var(--foreground)] flex-shrink-0" />
                    )}
                  </button>
                );
              })}
            </>
          )}

          {/* WhatsApp section — info-only, not clickable. Shown only when assigned. */}
          {waAssigned && (
            <>
              <div className="px-3 py-2 border-b border-t border-[var(--border)] bg-[var(--background)]/50">
                <p className="text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wider">
                  WhatsApp
                </p>
              </div>
              <div
                className="w-full flex items-center gap-3 px-3 py-2.5 text-left cursor-default"
                aria-label={`WhatsApp number ${waAssigned.displayPhone}`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-[var(--foreground)] truncate">
                      {formatPhoneDisplay(waAssigned.displayPhone)}
                    </p>
                    <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 font-semibold">
                      <FaWhatsapp className="w-3 h-3" />
                      WA
                    </span>
                  </div>
                  {waAssigned.verifiedName && (
                    <p className="text-xs text-[var(--muted-foreground)] truncate">
                      {waAssigned.verifiedName}
                    </p>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};
