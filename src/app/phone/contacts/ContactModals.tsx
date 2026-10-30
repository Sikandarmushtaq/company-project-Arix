'use client';

import React from 'react';
import { FiX, FiAlertTriangle } from 'react-icons/fi';
import { Button, ConfirmModal } from '@/components/ui';
import { ContactForm } from '@/components/forms';
import type { Contact } from '@/lib/api';
import type { CreateContactInput } from '@/lib/validation';
import type { CachedContact } from '@/lib/stores/contactLookup';

// ============================================================
// Contact Form Modal
// ============================================================

export interface ContactFormModalProps {
  isOpen: boolean;
  editingContact: Contact | null;
  onSubmit: (data: CreateContactInput) => Promise<void>;
  onClose: () => void;
  isSaving: boolean;
  apiError: string | null;
  existingContacts: Map<string, CachedContact>;
  /** Pre-fill phone number for new contacts (from call history, etc.) */
  defaultPhoneNumber?: string | null;
}

export function ContactFormModal({
  isOpen,
  editingContact,
  onSubmit,
  onClose,
  isSaving,
  apiError,
  existingContacts,
  defaultPhoneNumber,
}: ContactFormModalProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="contact-modal-title"
    >
      <div className="bg-[var(--card)] rounded-xl p-6 w-full max-w-md mx-4 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h2 id="contact-modal-title" className="text-xl font-bold text-[var(--foreground)]">
            {editingContact ? 'Edit Contact' : 'Add Contact'}
          </h2>
          <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close">
            <FiX className="w-5 h-5" />
          </Button>
        </div>

        <ContactForm
          defaultValues={
            editingContact
              ? {
                  name: editingContact.name,
                  contact: editingContact.contact,
                  type: (editingContact.type as 'personal' | 'business' | 'other') || 'personal',
                  notes: editingContact.notes || '',
                }
              : defaultPhoneNumber
                ? { contact: defaultPhoneNumber }
                : undefined
          }
          onSubmit={onSubmit}
          onCancel={onClose}
          isSubmitting={isSaving}
          apiError={apiError}
          submitLabel={editingContact ? 'Update' : 'Create'}
          existingContacts={existingContacts}
          editingContactId={editingContact?.id}
        />
      </div>
    </div>
  );
}

// ============================================================
// Delete Confirmation Modal
// ============================================================

export interface DeleteContactModalProps {
  contact: Contact | null;
  onConfirm: () => void;
  onCancel: () => void;
  isDeleting: boolean;
}

export function DeleteContactModal({
  contact,
  onConfirm,
  onCancel,
  isDeleting,
}: DeleteContactModalProps) {
  if (!contact) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-modal-title"
    >
      <div className="bg-[var(--card)] rounded-xl p-6 w-full max-w-sm mx-4 shadow-xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
            <FiAlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
          </div>
          <h2 id="delete-modal-title" className="text-lg font-semibold text-[var(--foreground)]">
            Delete Contact
          </h2>
        </div>
        <p className="text-[var(--muted-foreground)] mb-6">
          Are you sure you want to delete{' '}
          <span className="font-medium text-[var(--foreground)]">{contact.name}</span>? This action
          cannot be undone.
        </p>
        <div className="flex gap-3">
          <Button variant="secondary" className="flex-1" onClick={onCancel} disabled={isDeleting}>
            Cancel
          </Button>
          <Button variant="danger" className="flex-1" onClick={onConfirm} disabled={isDeleting}>
            {isDeleting ? 'Deleting...' : 'Delete'}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Block Confirmation Modal
// ============================================================

export interface BlockContactModalProps {
  contact: Contact | null;
  onConfirm: () => void;
  onClose: () => void;
  isBlocking: boolean;
}

export function BlockContactModal({
  contact,
  onConfirm,
  onClose,
  isBlocking,
}: BlockContactModalProps) {
  return (
    <ConfirmModal
      isOpen={!!contact}
      title="Block Number"
      message={`Block ${contact?.name || contact?.contact || ''}? Calls from this number will be rejected.`}
      confirmText="Block"
      variant="danger"
      loading={isBlocking}
      onConfirm={onConfirm}
      onClose={onClose}
    />
  );
}
