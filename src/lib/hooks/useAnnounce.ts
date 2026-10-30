'use client';

import { useCallback, useEffect, useRef } from 'react';

interface UseAnnounceOptions {
  /**
   * The politeness level for the announcement
   * - 'polite': Wait for current speech to finish (default)
   * - 'assertive': Interrupt current speech immediately
   */
  politeness?: 'polite' | 'assertive';

  /**
   * Delay in ms before making the announcement
   * Useful for waiting for UI to settle
   */
  delay?: number;

  /**
   * Clear announcement after this many ms
   * Set to 0 to never auto-clear
   */
  clearAfter?: number;
}

interface UseAnnounceReturn {
  /**
   * Announce a message to screen readers
   */
  announce: (message: string, options?: UseAnnounceOptions) => void;

  /**
   * Clear the current announcement
   */
  clear: () => void;
}

/**
 * Hook for making announcements to screen readers
 * Creates and manages a live region for accessibility announcements
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { announce } = useAnnounce();
 *
 *   const handleSave = async () => {
 *     await saveData();
 *     announce('Changes saved successfully');
 *   };
 *
 *   return <button onClick={handleSave}>Save</button>;
 * }
 * ```
 */
export function useAnnounce(): UseAnnounceReturn {
  const liveRegionRef = useRef<HTMLDivElement | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const delayTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Create live region on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Check for existing live region
    let existingRegion = document.getElementById('a11y-announcer');

    if (!existingRegion) {
      const region = document.createElement('div');
      region.id = 'a11y-announcer';
      region.setAttribute('aria-live', 'polite');
      region.setAttribute('aria-atomic', 'true');
      region.setAttribute('role', 'status');
      region.style.cssText = `
        position: absolute;
        width: 1px;
        height: 1px;
        padding: 0;
        margin: -1px;
        overflow: hidden;
        clip: rect(0, 0, 0, 0);
        white-space: nowrap;
        border: 0;
        pointer-events: none;
      `;
      document.body.appendChild(region);
      existingRegion = region;
    }

    liveRegionRef.current = existingRegion as HTMLDivElement;

    return () => {
      // Clean up timeouts on unmount
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (delayTimeoutRef.current) {
        clearTimeout(delayTimeoutRef.current);
      }
    };
  }, []);

  const clear = useCallback(() => {
    if (liveRegionRef.current) {
      liveRegionRef.current.textContent = '';
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const announce = useCallback(
    (message: string, options: UseAnnounceOptions = {}) => {
      const { politeness = 'polite', delay = 0, clearAfter = 5000 } = options;

      const makeAnnouncement = () => {
        if (!liveRegionRef.current) return;

        // Update politeness level
        liveRegionRef.current.setAttribute('aria-live', politeness);

        // Clear current content first (necessary for re-announcement)
        liveRegionRef.current.textContent = '';

        // Set new message after a brief delay to ensure screen readers pick it up
        requestAnimationFrame(() => {
          if (liveRegionRef.current) {
            liveRegionRef.current.textContent = message;
          }
        });

        // Auto-clear after specified time
        if (clearAfter > 0) {
          if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
          }
          timeoutRef.current = setTimeout(clear, clearAfter);
        }
      };

      // Clear any pending delayed announcement
      if (delayTimeoutRef.current) {
        clearTimeout(delayTimeoutRef.current);
      }

      if (delay > 0) {
        delayTimeoutRef.current = setTimeout(makeAnnouncement, delay);
      } else {
        makeAnnouncement();
      }
    },
    [clear]
  );

  return { announce, clear };
}

/**
 * Hook for announcing page navigation to screen readers
 * Automatically announces when the component mounts
 *
 * @example
 * ```tsx
 * function ContactsPage() {
 *   usePageAnnounce('Contacts page loaded. Showing 25 contacts.');
 *   return <div>...</div>;
 * }
 * ```
 */
export function usePageAnnounce(message: string, delay: number = 100): void {
  const { announce } = useAnnounce();

  useEffect(() => {
    announce(message, { delay, politeness: 'polite' });
  }, [announce, message, delay]);
}

/**
 * Hook for announcing form validation errors
 *
 * @example
 * ```tsx
 * function LoginForm() {
 *   const { announceErrors } = useFormAnnounce();
 *
 *   const handleSubmit = (e) => {
 *     const errors = validate(formData);
 *     if (errors.length > 0) {
 *       announceErrors(errors);
 *     }
 *   };
 * }
 * ```
 */
export function useFormAnnounce() {
  const { announce } = useAnnounce();

  const announceErrors = useCallback(
    (errors: string[]) => {
      if (errors.length === 0) return;

      const message =
        errors.length === 1
          ? `Error: ${errors[0]}`
          : `${errors.length} errors: ${errors.join('. ')}`;

      announce(message, { politeness: 'assertive' });
    },
    [announce]
  );

  const announceSuccess = useCallback(
    (message: string) => {
      announce(message, { politeness: 'polite' });
    },
    [announce]
  );

  return { announceErrors, announceSuccess };
}

export default useAnnounce;
