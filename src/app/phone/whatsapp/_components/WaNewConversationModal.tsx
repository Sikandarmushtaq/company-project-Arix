'use client';

import React, { useCallback, useRef, useEffect } from 'react';
import { FaWhatsapp } from 'react-icons/fa';
import { FiX } from 'react-icons/fi';

// ============================================================================
// Types
// ============================================================================

interface WaNewConversationModalProps {
  isOpen: boolean;
  phoneValue: string;
  onPhoneChange: (value: string) => void;
  onSubmit: () => void;
  onClose: () => void;
}

// ============================================================================
// Component
// ============================================================================

/**
 * Modal to start a new WhatsApp conversation.
 * Phone number input with international format guidance.
 * Note: First message must be a template since there is no active 24h window.
 */
export const WaNewConversationModal = React.memo(function WaNewConversationModal({
  isOpen,
  phoneValue,
  onPhoneChange,
  onSubmit,
  onClose,
}: WaNewConversationModalProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus input when modal opens
  useEffect(() => {
    if (isOpen) {
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [isOpen]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        onSubmit();
      } else if (e.key === 'Escape') {
        onClose();
      }
    },
    [onSubmit, onClose]
  );

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="New WhatsApp conversation"
    >
      <div
        className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-5 max-w-sm w-full mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <FaWhatsapp className="text-green-500" /> New WhatsApp Chat
          </h3>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-[var(--muted)] transition-colors"
            aria-label="Close"
          >
            <FiX className="w-4 h-4" />
          </button>
        </div>

        <div className="mb-2">
          <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1">
            Phone Number (with country code)
          </label>
          <div className="flex items-center gap-1">
            <span className="text-sm text-[var(--muted-foreground)] px-2 py-2 bg-[var(--background)] border border-[var(--border)] rounded-lg">
              +
            </span>
            <input
              ref={inputRef}
              type="tel"
              value={phoneValue}
              onChange={(e) => onPhoneChange(e.target.value.replace(/[^0-9]/g, ''))}
              onKeyDown={handleKeyDown}
              placeholder="60123456789"
              className="flex-1 px-3 py-2 bg-[var(--background)] border border-[var(--border)] rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:outline-none"
              autoComplete="tel"
            />
          </div>
        </div>

        <div className="text-xs text-[var(--muted-foreground)] mb-3 space-y-1">
          <p>Enter full number with country code:</p>
          <div className="grid grid-cols-2 gap-x-3">
            <span>
              US: <span className="text-[var(--foreground)]">12164281997</span>
            </span>
            <span>
              MY: <span className="text-[var(--foreground)]">60123456789</span>
            </span>
            <span>
              UK: <span className="text-[var(--foreground)]">447911123456</span>
            </span>
            <span>
              PK: <span className="text-[var(--foreground)]">923001234567</span>
            </span>
          </div>
          <p className="text-amber-500/80 mt-1">
            You&#39;ll need to send a template message first to start the conversation.
          </p>
        </div>

        <div className="flex gap-2 justify-end">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-sm border border-[var(--border)] rounded-lg hover:bg-[var(--muted)] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onSubmit}
            disabled={!phoneValue.trim()}
            className="px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Start Chat
          </button>
        </div>
      </div>
    </div>
  );
});
