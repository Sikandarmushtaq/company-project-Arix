'use client';

import React, { useCallback } from 'react';
import { FiX, FiTrash2, FiDownload, FiInfo } from 'react-icons/fi';
import { Button, Input } from '@/components/ui';
import { downloadImage } from './utils';

// ============================================================
// NEW CONVERSATION MODAL
// ============================================================
interface NewConversationModalProps {
  isOpen: boolean;
  phoneValue: string;
  onPhoneChange: (value: string) => void;
  onSubmit: () => void;
  onClose: () => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
  /** The "send from" number shown in the Text-from field. */
  fromPhone?: string;
}

/**
 * New conversation modal
 * Allows user to enter phone in any format - normalized internally to 11 digits (SSOT)
 */
export const NewConversationModal = React.memo(function NewConversationModal({
  isOpen,
  phoneValue,
  onPhoneChange,
  onSubmit,
  onClose,
  inputRef,
  fromPhone,
}: NewConversationModalProps) {
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
      aria-label="New conversation"
    >
      <div
        className="bg-[var(--card)] rounded-2xl shadow-2xl p-6 w-full max-w-lg mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-[22px] font-black text-[var(--foreground)]">New text</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-full text-[var(--muted-foreground)] hover:bg-[var(--muted)] transition-colors"
            aria-label="Close"
          >
            <FiX className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-5">
          {/* To */}
          <div>
            <label htmlFor="new-phone" className="block text-[13px] font-bold text-[var(--foreground)] mb-1">
              To
            </label>
            <Input
              id="new-phone"
              ref={inputRef}
              type="tel"
              placeholder="Enter names or phone numbers"
              value={phoneValue}
              onChange={(e) => onPhoneChange(e.target.value)}
              onKeyDown={handleKeyDown}
              autoComplete="tel"
            />
          </div>

          {/* Text from */}
          <div>
            <label className="block text-[13px] font-bold text-[var(--muted-foreground)] mb-1">Text from</label>
            <div className="text-[17px] font-bold text-[var(--foreground)] border-b border-[var(--border)] pb-2">
              {fromPhone || '—'}
            </div>
          </div>

          {/* Create group text — enabled with 2+ recipients (matches RC's disabled single-recipient state) */}
          <label className="flex items-center gap-2.5 text-[var(--muted-foreground)] cursor-not-allowed select-none">
            <input type="checkbox" checked disabled className="w-4 h-4 rounded accent-[var(--primary-600)] opacity-60" />
            <span className="text-sm">Create group text</span>
            <FiInfo className="w-4 h-4" aria-label="Add multiple recipients to create a group" />
          </label>

          <div className="flex gap-2 justify-end pt-1">
            <Button variant="ghost" onClick={onClose} className="text-[var(--foreground)]">
              Cancel
            </Button>
            <Button onClick={onSubmit} disabled={!phoneValue.trim()}>
              Next
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
});

// ============================================================
// DELETE CONFIRMATION MODAL
// ============================================================
interface DeleteConfirmationModalProps {
  isOpen: boolean;
  title: string;
  message: React.ReactNode;
  isDeleting: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

/**
 * Delete confirmation modal
 * Reusable modal for confirming delete operations
 */
export const DeleteConfirmationModal = React.memo(function DeleteConfirmationModal({
  isOpen,
  title,
  message,
  isDeleting,
  onConfirm,
  onClose,
}: DeleteConfirmationModalProps) {
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape' && !isDeleting) {
        onClose();
      }
    },
    [isDeleting, onClose]
  );

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={isDeleting ? undefined : onClose}
      onKeyDown={handleKeyDown}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className="bg-[var(--card)] rounded-xl shadow-xl p-6 w-full max-w-md mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-full bg-red-100 dark:bg-red-900/30">
            <FiTrash2 className="w-5 h-5 text-red-600 dark:text-red-400" />
          </div>
          <h2 className="text-lg font-semibold text-[var(--foreground)]">{title}</h2>
        </div>

        <p className="text-[var(--muted-foreground)] mb-6">{message}</p>

        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={onClose} disabled={isDeleting}>
            Cancel
          </Button>
          <Button variant="danger" onClick={onConfirm} disabled={isDeleting}>
            {isDeleting ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                Deleting...
              </>
            ) : (
              <>
                <FiTrash2 className="w-4 h-4 mr-2" />
                Delete
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
});

// ============================================================
// IMAGE PREVIEW MODAL
// ============================================================
interface ImagePreviewModalProps {
  imageUrl: string | null;
  onClose: () => void;
}

/**
 * Image preview modal
 */
export const ImagePreviewModal = React.memo(function ImagePreviewModal({
  imageUrl,
  onClose,
}: ImagePreviewModalProps) {
  const handleDownload = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (imageUrl) downloadImage(imageUrl);
    },
    [imageUrl]
  );

  if (!imageUrl) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Image preview"
    >
      <div className="relative max-w-[90vw] max-h-[90dvh] flex items-center justify-center">
        {/* eslint-disable-next-line @next/next/no-img-element -- Dynamic external URLs require native img */}
        <img
          src={imageUrl}
          alt="Preview"
          className="max-w-full max-h-[90dvh] object-contain rounded-lg"
          onClick={(e) => e.stopPropagation()}
        />
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors"
          aria-label="Close preview"
        >
          <FiX className="w-6 h-6" />
        </button>
        <button
          type="button"
          className="absolute bottom-4 right-4 p-2 rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors flex items-center gap-2"
          onClick={handleDownload}
          aria-label="Download image"
        >
          <FiDownload className="w-5 h-5" />
          <span className="text-sm">Download</span>
        </button>
      </div>
    </div>
  );
});
