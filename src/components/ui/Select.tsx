'use client';

import React, { useId } from 'react';
import { cn } from '@/lib/utils/cn';
import { FiChevronDown } from 'react-icons/fi';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends Omit<
  React.SelectHTMLAttributes<HTMLSelectElement>,
  'children'
> {
  label?: string;
  error?: string;
  hint?: string;
  options: SelectOption[];
  placeholder?: string;
  /**
   * Hide the label visually but keep it accessible for screen readers
   */
  hideLabel?: boolean;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, error, hint, options, placeholder, id, hideLabel, ...props }, ref) => {
    // Generate unique IDs for accessibility
    const generatedId = useId();
    const selectId = id || generatedId;
    const errorId = `${selectId}-error`;
    const hintId = `${selectId}-hint`;

    // Build aria-describedby value
    const ariaDescribedBy =
      [error ? errorId : null, hint && !error ? hintId : null].filter(Boolean).join(' ') ||
      undefined;

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={selectId}
            className={cn(
              'block text-sm font-medium text-[var(--foreground)] mb-1.5',
              hideLabel && 'sr-only'
            )}
          >
            {label}
            {props.required && (
              <span className="text-[var(--danger)] ml-1" aria-hidden="true">
                *
              </span>
            )}
          </label>
        )}
        <div className="relative">
          <select
            id={selectId}
            aria-invalid={error ? 'true' : undefined}
            aria-describedby={ariaDescribedBy}
            className={cn(
              'flex h-10 w-full appearance-none rounded-lg border border-[var(--border)] bg-[var(--input)] px-3 py-2 pr-10 text-sm text-[var(--foreground)] transition-colors',
              'focus:outline-none focus:ring-2 focus:ring-[var(--ring)] focus:border-transparent',
              'disabled:cursor-not-allowed disabled:opacity-50',
              error && 'border-[var(--danger)] focus:ring-[var(--danger)]',
              className
            )}
            ref={ref}
            {...props}
          >
            {placeholder && (
              <option value="" disabled>
                {placeholder}
              </option>
            )}
            {options.map((option) => (
              <option key={option.value} value={option.value} disabled={option.disabled}>
                {option.label}
              </option>
            ))}
          </select>
          <div
            className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--muted-foreground)]"
            aria-hidden="true"
          >
            <FiChevronDown className="w-4 h-4" />
          </div>
        </div>
        {error && (
          <p
            id={errorId}
            className="mt-1.5 text-sm text-[var(--danger)]"
            role="alert"
            aria-live="polite"
          >
            {error}
          </p>
        )}
        {hint && !error && (
          <p id={hintId} className="mt-1.5 text-sm text-[var(--muted-foreground)]">
            {hint}
          </p>
        )}
      </div>
    );
  }
);

Select.displayName = 'Select';
