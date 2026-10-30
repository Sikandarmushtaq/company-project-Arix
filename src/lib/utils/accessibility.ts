/**
 * Accessibility Utilities
 * WCAG 2.1 AA compliance helpers
 */

/**
 * Generate a unique ID for accessibility attributes
 * Uses a counter to ensure uniqueness across the app lifecycle
 */
let idCounter = 0;
export function generateId(prefix: string = 'a11y'): string {
  return `${prefix}-${++idCounter}`;
}

/**
 * Check if an element is focusable
 */
export function isFocusable(element: Element): boolean {
  if (!(element instanceof HTMLElement)) return false;

  const tabIndex = element.getAttribute('tabindex');
  const hasNegativeTabIndex = tabIndex !== null && parseInt(tabIndex, 10) < 0;

  if (hasNegativeTabIndex) return false;
  if (element.getAttribute('disabled') !== null) return false;
  if (element.getAttribute('aria-disabled') === 'true') return false;

  const tagName = element.tagName.toLowerCase();
  const focusableTags = ['a', 'button', 'input', 'select', 'textarea'];

  if (focusableTags.includes(tagName)) {
    if (tagName === 'a') {
      return element.hasAttribute('href');
    }
    return true;
  }

  return tabIndex !== null && parseInt(tabIndex, 10) >= 0;
}

/**
 * Get all focusable elements within a container
 */
export function getFocusableElements(container: HTMLElement): HTMLElement[] {
  const elements = container.querySelectorAll(
    'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );

  return Array.from(elements).filter(
    (el): el is HTMLElement => el instanceof HTMLElement && isFocusable(el)
  );
}

/**
 * Trap focus within a container (useful for modals)
 */
export function trapFocus(container: HTMLElement): () => void {
  const focusableElements = getFocusableElements(container);
  const firstFocusable = focusableElements[0];
  const lastFocusable = focusableElements[focusableElements.length - 1];

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key !== 'Tab') return;

    if (e.shiftKey) {
      if (document.activeElement === firstFocusable) {
        e.preventDefault();
        lastFocusable?.focus();
      }
    } else {
      if (document.activeElement === lastFocusable) {
        e.preventDefault();
        firstFocusable?.focus();
      }
    }
  };

  container.addEventListener('keydown', handleKeyDown);
  firstFocusable?.focus();

  return () => {
    container.removeEventListener('keydown', handleKeyDown);
  };
}

/**
 * Announce message to screen readers
 * Uses a live region to announce messages
 */
let announceElement: HTMLElement | null = null;

export function announce(message: string, priority: 'polite' | 'assertive' = 'polite'): void {
  if (typeof window === 'undefined') return;

  if (!announceElement) {
    announceElement = document.createElement('div');
    announceElement.setAttribute('aria-live', priority);
    announceElement.setAttribute('aria-atomic', 'true');
    announceElement.setAttribute('role', 'status');
    announceElement.className = 'sr-only';
    announceElement.style.cssText = `
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border: 0;
    `;
    document.body.appendChild(announceElement);
  }

  // Update priority if needed
  announceElement.setAttribute('aria-live', priority);

  // Clear and set message (necessary for re-announcement of same message)
  announceElement.textContent = '';
  requestAnimationFrame(() => {
    if (announceElement) {
      announceElement.textContent = message;
    }
  });
}

/**
 * Check if user prefers reduced motion
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Check if user prefers high contrast
 */
export function prefersHighContrast(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-contrast: more)').matches;
}

/**
 * Generate aria description IDs for form fields
 */
export function getAriaDescribedBy(options: {
  error?: string;
  hint?: string;
  baseId: string;
}): string | undefined {
  const { error, hint, baseId } = options;
  const ids: string[] = [];

  if (error) ids.push(`${baseId}-error`);
  if (hint && !error) ids.push(`${baseId}-hint`);

  return ids.length > 0 ? ids.join(' ') : undefined;
}

/**
 * Key codes for common keyboard interactions
 */
export const KEYS = {
  ENTER: 'Enter',
  SPACE: ' ',
  ESCAPE: 'Escape',
  TAB: 'Tab',
  ARROW_UP: 'ArrowUp',
  ARROW_DOWN: 'ArrowDown',
  ARROW_LEFT: 'ArrowLeft',
  ARROW_RIGHT: 'ArrowRight',
  HOME: 'Home',
  END: 'End',
} as const;

/**
 * Check if a key event matches a specific key
 */
export function isKey(event: KeyboardEvent, key: keyof typeof KEYS): boolean {
  return event.key === KEYS[key];
}

/**
 * Create keyboard navigation handler for lists/menus
 */
export function createListKeyboardHandler(options: {
  items: HTMLElement[];
  onSelect?: (item: HTMLElement, index: number) => void;
  orientation?: 'horizontal' | 'vertical';
  loop?: boolean;
}) {
  const { items, onSelect, orientation = 'vertical', loop = true } = options;

  return (event: KeyboardEvent) => {
    const currentIndex = items.findIndex((item) => item === document.activeElement);
    if (currentIndex === -1) return;

    const nextKey = orientation === 'vertical' ? 'ArrowDown' : 'ArrowRight';
    const prevKey = orientation === 'vertical' ? 'ArrowUp' : 'ArrowLeft';

    let nextIndex = currentIndex;

    switch (event.key) {
      case nextKey:
        event.preventDefault();
        nextIndex = currentIndex + 1;
        if (nextIndex >= items.length) {
          nextIndex = loop ? 0 : items.length - 1;
        }
        break;
      case prevKey:
        event.preventDefault();
        nextIndex = currentIndex - 1;
        if (nextIndex < 0) {
          nextIndex = loop ? items.length - 1 : 0;
        }
        break;
      case 'Home':
        event.preventDefault();
        nextIndex = 0;
        break;
      case 'End':
        event.preventDefault();
        nextIndex = items.length - 1;
        break;
      case 'Enter':
      case ' ':
        event.preventDefault();
        onSelect?.(items[currentIndex], currentIndex);
        return;
      default:
        return;
    }

    items[nextIndex]?.focus();
  };
}

/**
 * Screen reader only CSS class
 * Add this class to elements that should only be visible to screen readers
 */
export const SR_ONLY_CLASS = 'sr-only';

/**
 * CSS for screen reader only elements
 * Add this to your global CSS
 */
export const SR_ONLY_STYLES = `
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.sr-only-focusable:focus,
.sr-only-focusable:active {
  position: static;
  width: auto;
  height: auto;
  padding: inherit;
  margin: inherit;
  overflow: visible;
  clip: auto;
  white-space: normal;
}
`;
