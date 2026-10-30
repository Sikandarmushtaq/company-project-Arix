'use client';

import React, { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils/cn';

interface LiveRegionProps {
  /**
   * The message to announce
   */
  message: string;

  /**
   * The politeness level for screen readers
   * - 'polite': Wait for current speech to finish (default)
   * - 'assertive': Interrupt current speech immediately
   */
  politeness?: 'polite' | 'assertive';

  /**
   * Whether updates should be atomic (announce full region)
   * @default true
   */
  atomic?: boolean;

  /**
   * ARIA role for the region
   * @default 'status'
   */
  role?: 'status' | 'alert' | 'log' | 'timer' | 'marquee';

  /**
   * Whether to visually display the message
   * @default false (screen reader only)
   */
  visible?: boolean;

  /**
   * Additional CSS classes (only applies when visible)
   */
  className?: string;

  /**
   * Clear the message after this many milliseconds
   * Set to 0 to never auto-clear
   * @default 0
   */
  clearAfter?: number;
}

/**
 * Live Region Component
 *
 * Creates an ARIA live region that announces content changes to screen readers.
 * By default, the region is visually hidden but accessible to assistive technologies.
 *
 * WCAG 2.1 AA - Success Criterion 4.1.3 (Status Messages)
 *
 * @example
 * ```tsx
 * // Basic usage - screen reader only
 * <LiveRegion message={loadingMessage} />
 *
 * // Visible alert
 * <LiveRegion
 *   message="Form saved successfully"
 *   politeness="assertive"
 *   role="alert"
 *   visible
 * />
 *
 * // Auto-clearing status
 * <LiveRegion
 *   message={statusMessage}
 *   clearAfter={3000}
 * />
 * ```
 */
export function LiveRegion({
  message,
  politeness = 'polite',
  atomic = true,
  role = 'status',
  visible = false,
  className,
  clearAfter = 0,
}: LiveRegionProps) {
  const [currentMessage, setCurrentMessage] = useState(message);
  const previousMessageRef = useRef(message);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Only update if message actually changed
    if (message !== previousMessageRef.current) {
      // Clear first to ensure re-announcement of same message
      setCurrentMessage('');

      // Then set the new message
      requestAnimationFrame(() => {
        setCurrentMessage(message);
        previousMessageRef.current = message;
      });
    }

    // Handle auto-clear
    if (clearAfter > 0 && message) {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        setCurrentMessage('');
        previousMessageRef.current = '';
      }, clearAfter);
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [message, clearAfter]);

  if (visible) {
    return (
      <div
        role={role}
        aria-live={politeness}
        aria-atomic={atomic}
        className={cn(
          'px-4 py-2 rounded-lg',
          role === 'alert' && 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400',
          role === 'status' && 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400',
          className
        )}
      >
        {currentMessage}
      </div>
    );
  }

  // Screen reader only (visually hidden)
  return (
    <div
      role={role}
      aria-live={politeness}
      aria-atomic={atomic}
      className="sr-only"
      style={{
        position: 'absolute',
        width: '1px',
        height: '1px',
        padding: 0,
        margin: '-1px',
        overflow: 'hidden',
        clip: 'rect(0, 0, 0, 0)',
        whiteSpace: 'nowrap',
        border: 0,
      }}
    >
      {currentMessage}
    </div>
  );
}

/**
 * Loading announcement component
 * Automatically announces loading states to screen readers
 */
interface LoadingAnnouncerProps {
  isLoading: boolean;
  loadingMessage?: string;
  loadedMessage?: string;
}

export function LoadingAnnouncer({
  isLoading,
  loadingMessage = 'Loading...',
  loadedMessage = 'Content loaded',
}: LoadingAnnouncerProps) {
  const [message, setMessage] = useState('');
  const wasLoadingRef = useRef(false);

  useEffect(() => {
    if (isLoading && !wasLoadingRef.current) {
      setMessage(loadingMessage);
    } else if (!isLoading && wasLoadingRef.current) {
      setMessage(loadedMessage);
    }
    wasLoadingRef.current = isLoading;
  }, [isLoading, loadingMessage, loadedMessage]);

  return <LiveRegion message={message} politeness="polite" clearAfter={3000} />;
}

/**
 * Error announcement component
 * Immediately announces errors to screen readers
 */
interface ErrorAnnouncerProps {
  error: string | null;
}

export function ErrorAnnouncer({ error }: ErrorAnnouncerProps) {
  return error ? (
    <LiveRegion message={`Error: ${error}`} politeness="assertive" role="alert" />
  ) : null;
}

export default LiveRegion;
