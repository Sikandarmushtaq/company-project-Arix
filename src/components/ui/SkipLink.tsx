'use client';

import React from 'react';
import { cn } from '@/lib/utils/cn';

interface SkipLinkProps {
  /**
   * The target element ID to skip to (without #)
   */
  targetId: string;

  /**
   * The text to display in the skip link
   * @default "Skip to main content"
   */
  children?: React.ReactNode;

  /**
   * Additional CSS classes
   */
  className?: string;

  /**
   * Inline styles (useful for positioning multiple skip links)
   */
  style?: React.CSSProperties;
}

/**
 * Skip Link Component
 *
 * Provides keyboard users with a way to skip repetitive navigation
 * and jump directly to the main content area.
 *
 * WCAG 2.1 AA - Success Criterion 2.4.1 (Bypass Blocks)
 *
 * @example
 * ```tsx
 * // In your layout:
 * <SkipLink targetId="main-content" />
 * <nav>...</nav>
 * <main id="main-content">...</main>
 * ```
 */
export function SkipLink({
  targetId,
  children = 'Skip to main content',
  className,
  style,
}: SkipLinkProps) {
  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();

    const target = document.getElementById(targetId);
    if (target) {
      // Make the target focusable if it isn't already
      if (!target.hasAttribute('tabindex')) {
        target.setAttribute('tabindex', '-1');
      }

      target.focus();

      // Scroll to the target
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <a
      href={`#${targetId}`}
      onClick={handleClick}
      className={cn(
        // Hidden by default
        'absolute left-0 top-0 z-[9999]',
        'transform -translate-y-full',
        // Styling
        'px-4 py-3 m-3 rounded-lg',
        'bg-[var(--primary-600)] text-white',
        'font-medium text-sm',
        'shadow-lg',
        // Focus state - becomes visible
        'focus:translate-y-0',
        'focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-[var(--primary-600)]',
        // Transition
        'transition-transform duration-200',
        className
      )}
      style={style}
    >
      {children}
    </a>
  );
}

/**
 * Multiple skip links for complex layouts
 *
 * @example
 * ```tsx
 * <SkipLinks
 *   links={[
 *     { targetId: 'main-content', label: 'Skip to main content' },
 *     { targetId: 'navigation', label: 'Skip to navigation' },
 *     { targetId: 'search', label: 'Skip to search' },
 *   ]}
 * />
 * ```
 */
interface SkipLinksProps {
  links: Array<{
    targetId: string;
    label: string;
  }>;
  className?: string;
}

export function SkipLinks({ links, className }: SkipLinksProps) {
  return (
    <div className={cn('skip-links', className)}>
      {links.map((link, index) => (
        <SkipLink
          key={link.targetId}
          targetId={link.targetId}
          className={index > 0 ? 'left-auto' : undefined}
          style={
            {
              left: index > 0 ? `${index * 200 + 12}px` : undefined,
            } as React.CSSProperties
          }
        >
          {link.label}
        </SkipLink>
      ))}
    </div>
  );
}

export default SkipLink;
