'use client';

import React, { useCallback, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils/cn';
import { FiX } from 'react-icons/fi';
import { ModalErrorBoundary } from './ModalErrorBoundary';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  closeOnBackdrop?: boolean;
  closeOnEscape?: boolean;
  showCloseButton?: boolean;
  className?: string;
  /** Wrap content in error boundary for graceful error handling */
  withErrorBoundary?: boolean;
}

const sizeClasses = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
};

// Get all focusable elements within a container
function getFocusableElements(container: HTMLElement): HTMLElement[] {
  const focusableSelectors = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled])',
    'textarea:not([disabled])',
    'select:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
  ].join(', ');

  return Array.from(container.querySelectorAll<HTMLElement>(focusableSelectors));
}

export function Modal({
  isOpen,
  onClose,
  title,
  children,
  footer,
  size = 'md',
  closeOnBackdrop = true,
  closeOnEscape = true,
  showCloseButton = true,
  className,
  withErrorBoundary = false,
}: ModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  // Handle keyboard events (escape and focus trap)
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Escape key closes modal
      if (e.key === 'Escape' && closeOnEscape) {
        onClose();
        return;
      }

      // Focus trap on Tab
      if (e.key === 'Tab' && modalRef.current) {
        const focusableElements = getFocusableElements(modalRef.current);
        if (focusableElements.length === 0) return;

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        // Shift+Tab on first element wraps to last
        if (e.shiftKey && document.activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        }
        // Tab on last element wraps to first
        else if (!e.shiftKey && document.activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    },
    [closeOnEscape, onClose]
  );

  // Handle backdrop click
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.target === e.currentTarget && closeOnBackdrop) {
        onClose();
      }
    },
    [closeOnBackdrop, onClose]
  );

  // Focus the first element + lock scroll — ONLY when the open state changes.
  // (Deliberately not keyed on handleKeyDown: if a parent passes an inline
  // onClose/handler, that callback is recreated every render, and re-running
  // this effect would steal focus back to the first element on every keystroke
  // — breaking typing in any input inside the modal.)
  useEffect(() => {
    if (!isOpen) return;
    previousActiveElement.current = document.activeElement as HTMLElement;

    if (modalRef.current) {
      const focusableElements = getFocusableElements(modalRef.current);
      if (focusableElements.length > 0) {
        // Delay a frame so the modal is fully rendered before focusing.
        requestAnimationFrame(() => {
          focusableElements[0].focus();
        });
      } else {
        modalRef.current.focus();
      }
    }

    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = '';
      previousActiveElement.current?.focus();
    };
  }, [isOpen]);

  // Keep the keydown listener (escape + Tab trap) current. Re-adding a listener
  // when handleKeyDown changes does NOT move focus, so it's safe to re-run.
  useEffect(() => {
    if (!isOpen) return;
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div
        ref={modalRef}
        tabIndex={-1}
        className={cn(
          'relative w-full bg-[var(--card)] rounded-xl shadow-xl animate-in zoom-in-95 duration-200',
          'flex flex-col max-h-[90vh]',
          sizeClasses[size],
          className
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
          <h2 id="modal-title" className="text-lg font-semibold text-[var(--foreground)]">
            {title}
          </h2>
          {showCloseButton && (
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)] transition-colors"
              aria-label="Close modal"
            >
              <FiX className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {withErrorBoundary ? (
            <ModalErrorBoundary onClose={onClose} modalTitle={title}>
              {children}
            </ModalErrorBoundary>
          ) : (
            children
          )}
        </div>

        {/* Footer */}
        {footer && (
          <div className="px-6 py-4 border-t border-[var(--border)] bg-[var(--muted)]/30">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

// Confirmation Modal variant for quick confirmations
export interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info';
  loading?: boolean;
  /** Disables the confirm button (e.g. a type-to-confirm guard not yet satisfied). */
  confirmDisabled?: boolean;
  /** Optional extra content rendered below the message (e.g. an opt-in checkbox). */
  children?: React.ReactNode;
}

export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'danger',
  loading = false,
  confirmDisabled = false,
  children,
}: ConfirmModalProps) {
  const variantClasses = {
    danger: 'bg-[var(--danger)] hover:bg-red-600',
    warning: 'bg-yellow-500 hover:bg-yellow-600',
    info: 'bg-[var(--primary-600)] hover:bg-[var(--primary-700)]',
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium rounded-lg border border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--muted)] transition-colors disabled:opacity-50"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading || confirmDisabled}
            className={cn(
              'px-4 py-2 text-sm font-medium rounded-lg text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
              variantClasses[variant]
            )}
          >
            {loading ? 'Processing...' : confirmText}
          </button>
        </div>
      }
    >
      <p className="text-[var(--muted-foreground)]">{message}</p>
      {children}
    </Modal>
  );
}
