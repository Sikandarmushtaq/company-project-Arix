'use client';

import React, { useId, useState } from 'react';
import { FiEye, FiEyeOff } from 'react-icons/fi';
import { cn } from '@/lib/utils/cn';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  /**
   * Hide the label visually but keep it accessible for screen readers
   */
  hideLabel?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    { className, label, error, hint, leftIcon, rightIcon, type = 'text', id, hideLabel, ...props },
    ref
  ) => {
    // Generate unique IDs for accessibility
    const generatedId = useId();
    const inputId = id || generatedId;
    const errorId = `${inputId}-error`;
    const hintId = `${inputId}-hint`;

    // Password fields get a built-in show/hide "eye" toggle. When on, the input
    // type flips to 'text' so the value is visible. Applies to every password
    // Input across the app (signup, login, reset).
    const [showPassword, setShowPassword] = useState(false);
    const isPassword = type === 'password';
    const effectiveType = isPassword && showPassword ? 'text' : type;

    // Build aria-describedby value
    const ariaDescribedBy =
      [error ? errorId : null, hint && !error ? hintId : null].filter(Boolean).join(' ') ||
      undefined;

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={inputId}
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
          {leftIcon && (
            <div
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)] pointer-events-none"
              aria-hidden="true"
            >
              {leftIcon}
            </div>
          )}
          <input
            type={effectiveType}
            id={inputId}
            aria-invalid={error ? 'true' : undefined}
            aria-describedby={ariaDescribedBy}
            className={cn(
              'flex h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] transition-colors',
              'focus:outline-none focus:ring-2 focus:ring-[var(--ring)] focus:border-transparent',
              'disabled:cursor-not-allowed disabled:opacity-50',
              leftIcon && 'pl-10',
              (rightIcon || isPassword) && 'pr-10',
              error && 'border-[var(--danger)] focus:ring-[var(--danger)]',
              className
            )}
            ref={ref}
            {...props}
          />
          {isPassword ? (
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              aria-pressed={showPassword}
            >
              {showPassword ? <FiEyeOff className="h-4 w-4" /> : <FiEye className="h-4 w-4" />}
            </button>
          ) : (
            rightIcon && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]">
                {rightIcon}
              </div>
            )
          )}
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

Input.displayName = 'Input';
