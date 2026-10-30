'use client';

/**
 * ContactForm Component
 *
 * Reusable form for creating and editing contacts.
 * Uses react-hook-form with zod validation.
 *
 * @module components/forms/ContactForm
 */

import React, { useCallback, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { FiAlertCircle, FiRefreshCw } from 'react-icons/fi';
import { Button, Input } from '@/components/ui';
import { createContactSchema, CONTACT_VALIDATION, type CreateContactInput } from '@/lib/validation';
import { normalizePhone } from '@/lib/utils/phone';
import type { CachedContact } from '@/lib/stores/contactLookup';

interface ContactFormProps {
  /** Initial values for editing */
  defaultValues?: Partial<CreateContactInput>;
  /** Called on successful form submission */
  onSubmit: (data: CreateContactInput) => Promise<void>;
  /** Called when cancel button is clicked */
  onCancel: () => void;
  /** Whether the form is in a submitting state */
  isSubmitting?: boolean;
  /** API error message to display */
  apiError?: string | null;
  /** Submit button text */
  submitLabel?: string;
  /** Existing contacts map for duplicate detection (normalized phone -> CachedContact) */
  existingContacts?: Map<string, CachedContact>;
  /** ID of contact being edited (to exclude from duplicate check) */
  editingContactId?: number;
}

export function ContactForm({
  defaultValues,
  onSubmit,
  onCancel,
  isSubmitting = false,
  apiError,
  submitLabel = 'Save',
  existingContacts,
  editingContactId,
}: ContactFormProps) {
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  const lastSubmittedData = useRef<CreateContactInput | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isValid, touchedFields },
  } = useForm<CreateContactInput>({
    resolver: zodResolver(createContactSchema),
    defaultValues: {
      name: defaultValues?.name ?? '',
      contact: defaultValues?.contact ?? '',
      type: defaultValues?.type ?? CONTACT_VALIDATION.type.default,
      notes: defaultValues?.notes ?? '',
    },
    mode: 'onBlur', // Validate on blur
    reValidateMode: 'onChange', // Re-validate on change after first blur
  });

  const checkDuplicate = useCallback(
    (e: React.FocusEvent<HTMLInputElement>) => {
      if (!existingContacts) return;
      const normalized = normalizePhone(e.target.value);
      if (!normalized) {
        setDuplicateWarning(null);
        return;
      }
      const match = existingContacts.get(normalized);
      if (match && match.id !== editingContactId) {
        setDuplicateWarning(`A contact with this number already exists: ${match.name}`);
      } else {
        setDuplicateWarning(null);
      }
    },
    [existingContacts, editingContactId]
  );

  const onFormSubmit = handleSubmit(async (data) => {
    lastSubmittedData.current = data;
    await onSubmit(data);
  });

  const handleRetry = useCallback(() => {
    if (lastSubmittedData.current) {
      onSubmit(lastSubmittedData.current);
    }
  }, [onSubmit]);

  const phoneRegister = register('contact');

  return (
    <form onSubmit={onFormSubmit} className="space-y-4">
      {/* API Error Message */}
      {apiError && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
          <FiAlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
          <span className="text-sm text-red-600 dark:text-red-400 flex-1">{apiError}</span>
          <button
            type="button"
            onClick={handleRetry}
            className="flex items-center gap-1 text-sm text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 font-medium"
          >
            <FiRefreshCw className="w-3.5 h-3.5" />
            Retry
          </button>
        </div>
      )}

      {/* Name Field */}
      <Input
        label="Name *"
        placeholder="e.g., John Smith"
        error={touchedFields.name ? errors.name?.message : undefined}
        {...register('name')}
      />

      {/* Phone Field */}
      <Input
        label="Phone Number *"
        placeholder="e.g., (555) 123-4567"
        error={touchedFields.contact ? errors.contact?.message : undefined}
        hint={
          !errors.contact
            ? 'Any format accepted: (555) 123-4567, 555-123-4567, +15551234567'
            : undefined
        }
        {...phoneRegister}
        onBlur={(e) => {
          phoneRegister.onBlur(e);
          checkDuplicate(e);
        }}
      />

      {/* Duplicate Phone Warning */}
      {duplicateWarning && (
        <div className="flex items-center gap-2 p-2 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800">
          <FiAlertCircle className="w-4 h-4 text-yellow-600 dark:text-yellow-400 flex-shrink-0" />
          <span className="text-xs text-yellow-700 dark:text-yellow-300">{duplicateWarning}</span>
        </div>
      )}

      {/* Type Field */}
      <div>
        <label className="block text-sm font-medium text-[var(--foreground)] mb-1.5">Type</label>
        <select
          {...register('type')}
          className="w-full h-10 px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--input)] text-sm text-[var(--foreground)] transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--ring)] focus:border-transparent"
        >
          {CONTACT_VALIDATION.type.options.map((option) => (
            <option key={option} value={option}>
              {option.charAt(0).toUpperCase() + option.slice(1)}
            </option>
          ))}
        </select>
      </div>

      {/* Notes field removed — RingCentral doesn't put notes on a contact.
          The `notes` value stays in the form's defaultValues so editing a
          contact preserves any pre-existing note instead of wiping it. */}

      {/* Form Actions */}
      <div className="flex gap-3 pt-2">
        <Button
          type="button"
          variant="secondary"
          className="flex-1"
          onClick={onCancel}
          disabled={isSubmitting}
        >
          Cancel
        </Button>
        <Button type="submit" className="flex-1" disabled={isSubmitting}>
          {isSubmitting ? 'Saving...' : submitLabel}
        </Button>
      </div>
    </form>
  );
}
