'use client';

import React from 'react';
import { cn } from '@/lib/utils/cn';
import { cva, type VariantProps } from 'class-variance-authority';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        primary:
          'bg-[var(--primary-600)] text-white hover:bg-[var(--primary-700)] focus-visible:ring-[var(--primary-500)]',
        coral:
          'bg-[var(--coral)] text-white hover:bg-[var(--coral-700)] focus-visible:ring-[var(--coral)] shadow-sm shadow-[var(--coral)]/30',
        secondary:
          'bg-[var(--gray-100)] text-[var(--gray-900)] hover:bg-[var(--gray-200)] dark:bg-[var(--gray-800)] dark:text-[var(--gray-100)] dark:hover:bg-[var(--gray-700)]',
        outline:
          'border-2 border-[var(--border)] bg-transparent hover:bg-[var(--muted)] text-[var(--foreground)]',
        ghost: 'hover:bg-[var(--muted)] text-[var(--foreground)]',
        danger: 'bg-[var(--danger)] text-white hover:bg-red-600 focus-visible:ring-red-500',
        success:
          'bg-[var(--success)] text-white hover:bg-emerald-600 focus-visible:ring-emerald-500',
        link: 'text-[var(--foreground)] underline-offset-4 hover:underline',
      },
      size: {
        sm: 'h-8 px-3 text-xs',
        md: 'h-10 px-4',
        lg: 'h-12 px-6 text-base',
        xl: 'h-14 px-8 text-lg',
        icon: 'h-10 w-10',
        'icon-sm': 'h-8 w-8',
        'icon-lg': 'h-12 w-12',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, loading, disabled, children, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={disabled || loading}
        {...props}
      >
        {loading && (
          <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        )}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
