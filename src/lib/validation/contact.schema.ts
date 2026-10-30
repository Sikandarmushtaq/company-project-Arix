/**
 * Contact Validation Schemas
 *
 * Zod schemas for contact form validation.
 * Mirrors backend validation in server/src/modules/contacts/contact.schema.ts
 *
 * Phone numbers are normalized to SSOT format: 11 digits (e.g., 12164281997)
 *
 * @module lib/validation/contact.schema
 */

import { z } from 'zod';
import { normalizePhone } from '@/lib/utils/phone';

// ============================================================
// Validation Constants - Keep in sync with backend
// ============================================================

export const CONTACT_VALIDATION = {
  name: {
    min: 2,
    max: 100,
    pattern: /^[a-zA-Z0-9\s\-'.]+$/,
    patternMessage:
      'Name can only contain letters, numbers, spaces, hyphens, apostrophes, and periods',
  },
  phone: {
    minDigits: 7,
    maxDigits: 15,
  },
  type: {
    options: ['personal', 'business', 'other'] as const,
    default: 'personal' as const,
  },
  notes: {
    max: 500,
  },
} as const;

// ============================================================
// Field Schemas
// ============================================================

/**
 * Contact name schema
 * - Required, minimum 2 characters
 * - Maximum 100 characters
 * - Only letters, numbers, spaces, hyphens, apostrophes, and periods
 */
export const contactNameSchema = z
  .string()
  .min(1, 'Name is required')
  .min(
    CONTACT_VALIDATION.name.min,
    `Name must be at least ${CONTACT_VALIDATION.name.min} characters`
  )
  .max(
    CONTACT_VALIDATION.name.max,
    `Name must be less than ${CONTACT_VALIDATION.name.max} characters`
  )
  .regex(CONTACT_VALIDATION.name.pattern, CONTACT_VALIDATION.name.patternMessage)
  .transform((val) => val.trim());

/**
 * Phone number schema for contacts
 * - Accepts any common format: (216) 428-1997, +1-216-428-1997, 2164281997, etc.
 * - Normalizes to SSOT format: 11 digits (e.g., 12164281997)
 * - Minimum 10 digits (US numbers) or 7 digits (short codes)
 * - Maximum 15 digits (E.164 standard)
 */
export const contactPhoneSchema = z
  .string()
  .min(1, 'Phone number is required')
  .transform((val) => {
    // Strip all non-digit characters for validation
    const digits = val.replace(/\D/g, '');
    return digits;
  })
  .refine((digits) => /^\d+$/.test(digits) && digits.length > 0, 'Phone number must contain digits')
  .refine(
    (digits) => digits.length >= CONTACT_VALIDATION.phone.minDigits,
    `Phone number must have at least ${CONTACT_VALIDATION.phone.minDigits} digits`
  )
  .refine(
    (digits) => digits.length <= CONTACT_VALIDATION.phone.maxDigits,
    `Phone number must have at most ${CONTACT_VALIDATION.phone.maxDigits} digits`
  )
  .transform((digits) => {
    // Normalize to SSOT 11-digit format for US numbers
    return normalizePhone(digits);
  });

/**
 * Contact type schema (without default for form inputs)
 */
export const contactTypeSchema = z.enum(CONTACT_VALIDATION.type.options);

/**
 * Contact notes schema
 * - Optional field for additional information
 * - Maximum 500 characters
 */
export const contactNotesSchema = z
  .string()
  .max(
    CONTACT_VALIDATION.notes.max,
    `Notes must be less than ${CONTACT_VALIDATION.notes.max} characters`
  )
  .transform((val) => val?.trim() || null)
  .nullable()
  .optional();

// ============================================================
// Form Schemas
// ============================================================

/**
 * Create contact form schema
 */
export const createContactSchema = z.object({
  name: contactNameSchema,
  contact: contactPhoneSchema,
  type: contactTypeSchema,
  notes: contactNotesSchema,
});

/**
 * Update contact form schema (all fields optional except one must be present)
 */
export const updateContactSchema = z
  .object({
    name: contactNameSchema.optional(),
    contact: contactPhoneSchema.optional(),
    type: contactTypeSchema.optional(),
    notes: contactNotesSchema,
  })
  .refine(
    (data) => Object.values(data).some((val) => val !== undefined),
    'At least one field must be provided for update'
  );

// ============================================================
// Type Exports
// ============================================================

export type CreateContactInput = z.infer<typeof createContactSchema>;
export type UpdateContactInput = z.infer<typeof updateContactSchema>;
export type ContactType = z.infer<typeof contactTypeSchema>;
