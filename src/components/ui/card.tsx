'use client';

import React from 'react';
import { cn } from '@/lib/utils/cn';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'bordered' | 'elevated';
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant = 'default', children, ...props }, ref) => {
    const variants = {
      default: 'bg-[var(--card)] border border-[var(--border)]',
      bordered: 'bg-transparent border-2 border-[var(--border)]',
      elevated: 'bg-[var(--card)] shadow-lg shadow-black/5 dark:shadow-black/20',
    };

    return (
      <div
        ref={ref}
        className={cn('rounded-xl transition-all duration-200', variants[variant], className)}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = 'Card';

export const CardHeader: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className,
  children,
  ...props
}) => (
  <div className={cn('p-6 pb-0', className)} {...props}>
    {children}
  </div>
);

CardHeader.displayName = 'CardHeader';

export const CardTitle: React.FC<React.HTMLAttributes<HTMLHeadingElement>> = ({
  className,
  children,
  ...props
}) => (
  <h3 className={cn('text-lg font-semibold text-[var(--card-foreground)]', className)} {...props}>
    {children}
  </h3>
);

CardTitle.displayName = 'CardTitle';

export const CardDescription: React.FC<React.HTMLAttributes<HTMLParagraphElement>> = ({
  className,
  children,
  ...props
}) => (
  <p className={cn('text-sm text-[var(--muted-foreground)] mt-1', className)} {...props}>
    {children}
  </p>
);

CardDescription.displayName = 'CardDescription';

export const CardContent: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className,
  children,
  ...props
}) => (
  <div className={cn('p-6', className)} {...props}>
    {children}
  </div>
);

CardContent.displayName = 'CardContent';

export const CardFooter: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className,
  children,
  ...props
}) => (
  <div className={cn('p-6 pt-0 flex items-center gap-3', className)} {...props}>
    {children}
  </div>
);

CardFooter.displayName = 'CardFooter';
