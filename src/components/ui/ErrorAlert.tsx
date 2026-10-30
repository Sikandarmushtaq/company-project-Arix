'use client';

import React from 'react';
import { FiAlertCircle, FiX } from 'react-icons/fi';
import { cn } from '@/lib/utils/cn';

export interface ErrorAlertProps {
  /** The error message to display */
  message: string;
  /** Optional title for the error */
  title?: string;
  /** Optional secondary details */
  details?: string;
  /** Callback when dismiss button is clicked (shows dismiss button if provided) */
  onDismiss?: () => void;
  /** Additional CSS classes */
  className?: string;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
}

const sizeClasses = {
  sm: {
    container: 'p-3',
    icon: 'w-4 h-4',
    title: 'text-sm font-medium',
    message: 'text-xs',
    details: 'text-xs',
  },
  md: {
    container: 'p-4',
    icon: 'w-5 h-5',
    title: 'text-base font-medium',
    message: 'text-sm',
    details: 'text-xs',
  },
  lg: {
    container: 'p-6',
    icon: 'w-6 h-6',
    title: 'text-lg font-semibold',
    message: 'text-base',
    details: 'text-sm',
  },
};

/**
 * Accessible error alert component with role="alert" for screen readers.
 *
 * @example
 * ```tsx
 * // Basic usage
 * <ErrorAlert message="Failed to save changes" />
 *
 * // With title and details
 * <ErrorAlert
 *   title="Connection Error"
 *   message="Unable to connect to the server"
 *   details="Please check your internet connection and try again."
 * />
 *
 * // Dismissible
 * <ErrorAlert
 *   message="Session expired"
 *   onDismiss={() => setError(null)}
 * />
 * ```
 */
export function ErrorAlert({
  message,
  title,
  details,
  onDismiss,
  className,
  size = 'md',
}: ErrorAlertProps) {
  const sizes = sizeClasses[size];

  return (
    <div
      role="alert"
      aria-live="assertive"
      className={cn(
        'rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800',
        'flex items-start gap-3',
        sizes.container,
        className
      )}
    >
      <FiAlertCircle
        className={cn('text-[var(--danger)] flex-shrink-0 mt-0.5', sizes.icon)}
        aria-hidden="true"
      />
      <div className="flex-1 min-w-0">
        {title && <p className={cn('text-[var(--danger)]', sizes.title)}>{title}</p>}
        <p className={cn('text-[var(--danger)]', !title && sizes.message, title && sizes.details)}>
          {message}
        </p>
        {details && (
          <p className={cn('text-[var(--muted-foreground)] mt-1', sizes.details)}>{details}</p>
        )}
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="flex-shrink-0 p-1 rounded hover:bg-red-100 dark:hover:bg-red-800/50 transition-colors"
          aria-label="Dismiss error"
        >
          <FiX className="w-4 h-4 text-[var(--danger)]" />
        </button>
      )}
    </div>
  );
}

/**
 * Inline error text with role="alert" for form validation.
 */
export function ErrorText({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <p role="alert" className={cn('text-sm text-[var(--danger)]', className)}>
      {children}
    </p>
  );
}

/**
 * Full page error state component.
 */
export function ErrorState({
  title = 'Something went wrong',
  message,
  details,
  onRetry,
  className,
}: {
  title?: string;
  message: string;
  details?: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div role="alert" className={cn('flex items-center justify-center h-64', className)}>
      <div className="text-center">
        <FiAlertCircle className="w-12 h-12 text-[var(--danger)] mx-auto mb-4" aria-hidden="true" />
        <p className="text-[var(--danger)] font-medium">{title}</p>
        <p className="text-sm text-[var(--muted-foreground)] mt-2">{message}</p>
        {details && <p className="text-xs text-[var(--muted-foreground)] mt-1">{details}</p>}
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="mt-4 px-4 py-2 text-sm font-medium rounded-lg bg-[var(--primary-600)] text-white hover:bg-[var(--primary-700)] transition-colors"
          >
            Try Again
          </button>
        )}
      </div>
    </div>
  );
}
