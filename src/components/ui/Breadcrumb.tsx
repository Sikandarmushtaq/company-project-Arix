'use client';

import React from 'react';
import Link from 'next/link';
import { FiChevronRight, FiHome } from 'react-icons/fi';
import { cn } from '@/lib/utils/cn';

interface BreadcrumbItem {
  /**
   * Display label
   */
  label: string;

  /**
   * Navigation href (optional for last item)
   */
  href?: string;

  /**
   * Optional icon
   */
  icon?: React.ReactNode;
}

interface BreadcrumbProps {
  /**
   * Array of breadcrumb items
   */
  items: BreadcrumbItem[];

  /**
   * Show home icon for first item
   * @default true
   */
  showHome?: boolean;

  /**
   * Custom separator between items
   */
  separator?: React.ReactNode;

  /**
   * Additional CSS classes
   */
  className?: string;

  /**
   * Truncate long labels
   * @default true
   */
  truncate?: boolean;

  /**
   * Max width for truncated labels
   * @default 150
   */
  maxLabelWidth?: number;
}

/**
 * Breadcrumb Component
 *
 * Displays navigation path for hierarchical content.
 *
 * @example
 * ```tsx
 * <Breadcrumb
 *   items={[
 *     { label: 'Admin', href: '/admin' },
 *     { label: 'Users', href: '/admin/users' },
 *     { label: 'John Doe' },
 *   ]}
 * />
 * ```
 */
export function Breadcrumb({
  items,
  showHome = true,
  separator,
  className,
  truncate = true,
  maxLabelWidth = 150,
}: BreadcrumbProps) {
  if (items.length === 0) return null;

  const renderSeparator = () => {
    if (separator) return separator;
    return (
      <FiChevronRight
        className="w-4 h-4 text-[var(--muted-foreground)] flex-shrink-0"
        aria-hidden="true"
      />
    );
  };

  const renderItem = (item: BreadcrumbItem, index: number) => {
    const isLast = index === items.length - 1;
    const isFirst = index === 0;

    const content = (
      <>
        {isFirst && showHome && !item.icon && (
          <FiHome className="w-4 h-4 mr-1.5" aria-hidden="true" />
        )}
        {item.icon && (
          <span className="mr-1.5" aria-hidden="true">
            {item.icon}
          </span>
        )}
        <span
          className={cn(truncate && 'truncate', truncate && `max-w-[${maxLabelWidth}px]`)}
          style={truncate ? { maxWidth: maxLabelWidth } : undefined}
        >
          {item.label}
        </span>
      </>
    );

    const baseClasses = cn(
      'inline-flex items-center text-sm font-medium transition-colors',
      isLast
        ? 'text-[var(--foreground)]'
        : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
    );

    if (isLast || !item.href) {
      return (
        <span className={baseClasses} aria-current={isLast ? 'page' : undefined}>
          {content}
        </span>
      );
    }

    return (
      <Link href={item.href} className={baseClasses}>
        {content}
      </Link>
    );
  };

  return (
    <nav aria-label="Breadcrumb" className={className}>
      <ol className="flex items-center gap-2 flex-wrap">
        {items.map((item, index) => (
          <li key={index} className="inline-flex items-center gap-2">
            {index > 0 && renderSeparator()}
            {renderItem(item, index)}
          </li>
        ))}
      </ol>
    </nav>
  );
}

/**
 * Generate breadcrumb items from a pathname
 *
 * @example
 * ```tsx
 * const items = generateBreadcrumbsFromPath('/admin/users/123', {
 *   admin: 'Admin Panel',
 *   users: 'Users',
 * });
 * // Returns: [
 * //   { label: 'Admin Panel', href: '/admin' },
 * //   { label: 'Users', href: '/admin/users' },
 * //   { label: '123' },
 * // ]
 * ```
 */
export function generateBreadcrumbsFromPath(
  pathname: string,
  labels?: Record<string, string>
): BreadcrumbItem[] {
  const segments = pathname.split('/').filter(Boolean);

  return segments.map((segment, index) => {
    const href = '/' + segments.slice(0, index + 1).join('/');
    const isLast = index === segments.length - 1;

    // Try to get a custom label, otherwise capitalize the segment
    const label =
      labels?.[segment] || segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, ' ');

    return {
      label,
      href: isLast ? undefined : href,
    };
  });
}

export default Breadcrumb;
