'use client';

import { useEffect, useCallback, useRef, useState } from 'react';

/**
 * Base shortcut key configuration (for display purposes)
 */
export interface ShortcutKeyConfig {
  /**
   * Key to trigger the shortcut (e.g., 'k', 'Escape', 'Enter')
   */
  key: string;

  /**
   * Require Ctrl/Cmd key
   */
  ctrl?: boolean;

  /**
   * Require Shift key
   */
  shift?: boolean;

  /**
   * Require Alt key
   */
  alt?: boolean;

  /**
   * Description for help modal
   */
  description?: string;

  /**
   * Category for grouping in help modal
   */
  category?: string;
}

/**
 * Full shortcut configuration with handler
 */
interface ShortcutConfig extends ShortcutKeyConfig {
  /**
   * Callback when shortcut is triggered
   */
  handler: (event: KeyboardEvent) => void;

  /**
   * Disable this shortcut
   */
  disabled?: boolean;

  /**
   * Prevent default browser behavior
   * @default true
   */
  preventDefault?: boolean;

  /**
   * Only trigger when no input is focused
   * @default true
   */
  ignoreInputs?: boolean;
}

interface UseKeyboardShortcutsOptions {
  /**
   * Enable/disable all shortcuts
   * @default true
   */
  enabled?: boolean;

  /**
   * Elements to ignore shortcuts on (in addition to inputs)
   */
  ignoreElements?: string[];
}

// Input-like elements that should ignore shortcuts by default
const INPUT_ELEMENTS = ['INPUT', 'TEXTAREA', 'SELECT'];
const EDITABLE_ROLES = ['textbox', 'searchbox', 'combobox'];

/**
 * Check if an element should ignore keyboard shortcuts
 */
function shouldIgnoreElement(element: Element | null, ignoreElements: string[] = []): boolean {
  if (!element) return false;

  const tagName = element.tagName;
  const role = element.getAttribute('role');
  const isContentEditable = element.getAttribute('contenteditable') === 'true';

  // Check tag names
  if (INPUT_ELEMENTS.includes(tagName)) return true;

  // Check roles
  if (role && EDITABLE_ROLES.includes(role)) return true;

  // Check contenteditable
  if (isContentEditable) return true;

  // Check custom ignore list
  if (ignoreElements.some((selector) => element.matches(selector))) return true;

  return false;
}

/**
 * Format a shortcut for display
 */
export function formatShortcut(config: ShortcutKeyConfig): string {
  const isMac =
    typeof navigator !== 'undefined' && navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  const parts: string[] = [];

  if (config.ctrl) parts.push(isMac ? '⌘' : 'Ctrl');
  if (config.alt) parts.push(isMac ? '⌥' : 'Alt');
  if (config.shift) parts.push('⇧');

  // Format the key
  let keyLabel = config.key;
  switch (config.key.toLowerCase()) {
    case 'escape':
      keyLabel = 'Esc';
      break;
    case 'enter':
      keyLabel = '↵';
      break;
    case 'arrowup':
      keyLabel = '↑';
      break;
    case 'arrowdown':
      keyLabel = '↓';
      break;
    case 'arrowleft':
      keyLabel = '←';
      break;
    case 'arrowright':
      keyLabel = '→';
      break;
    case ' ':
      keyLabel = 'Space';
      break;
    default:
      keyLabel = config.key.toUpperCase();
  }

  parts.push(keyLabel);

  return parts.join(isMac ? '' : '+');
}

/**
 * Hook for registering keyboard shortcuts
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   useKeyboardShortcuts([
 *     {
 *       key: 'k',
 *       ctrl: true,
 *       handler: () => openSearch(),
 *       description: 'Open search',
 *       category: 'Navigation',
 *     },
 *     {
 *       key: 'Escape',
 *       handler: () => closeModal(),
 *       description: 'Close modal',
 *     },
 *   ]);
 * }
 * ```
 */
export function useKeyboardShortcuts(
  shortcuts: ShortcutConfig[],
  options: UseKeyboardShortcutsOptions = {}
): void {
  const { enabled = true, ignoreElements = [] } = options;
  const shortcutsRef = useRef(shortcuts);

  // Update ref when shortcuts change
  useEffect(() => {
    shortcutsRef.current = shortcuts;
  }, [shortcuts]);

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      // Check if we should ignore this element
      if (shouldIgnoreElement(document.activeElement, ignoreElements)) {
        // Still allow Escape even in inputs
        if (event.key !== 'Escape') return;
      }

      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;

      for (const shortcut of shortcutsRef.current) {
        if (shortcut.disabled) continue;

        // Check modifiers
        const ctrlMatch = shortcut.ctrl ? (isMac ? event.metaKey : event.ctrlKey) : true;
        const shiftMatch = shortcut.shift ? event.shiftKey : !event.shiftKey;
        const altMatch = shortcut.alt ? event.altKey : !event.altKey;

        // Check key
        const keyMatch = event.key.toLowerCase() === shortcut.key.toLowerCase();

        if (ctrlMatch && shiftMatch && altMatch && keyMatch) {
          // Check if we should ignore inputs for this shortcut
          if (shortcut.ignoreInputs !== false) {
            if (
              shouldIgnoreElement(document.activeElement, ignoreElements) &&
              event.key !== 'Escape'
            ) {
              continue;
            }
          }

          if (shortcut.preventDefault !== false) {
            event.preventDefault();
          }

          shortcut.handler(event);
          return;
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [enabled, ignoreElements]);
}

/**
 * Hook for managing keyboard shortcuts modal visibility
 */
export function useShortcutsModal() {
  const [isOpen, setIsOpen] = useState(false);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen((prev) => !prev), []);

  // Register ? shortcut to open modal
  useKeyboardShortcuts([
    {
      key: '?',
      shift: true,
      handler: toggle,
      description: 'Show keyboard shortcuts',
      category: 'Help',
    },
  ]);

  return { isOpen, open, close, toggle };
}

/**
 * Predefined shortcuts for common actions
 */
export const COMMON_SHORTCUTS = {
  search: {
    key: 'k',
    ctrl: true,
    description: 'Open search',
    category: 'Navigation',
  },
  newItem: {
    key: 'n',
    ctrl: true,
    description: 'Create new item',
    category: 'Actions',
  },
  save: {
    key: 's',
    ctrl: true,
    description: 'Save changes',
    category: 'Actions',
  },
  close: {
    key: 'Escape',
    description: 'Close dialog or cancel',
    category: 'General',
  },
  confirm: {
    key: 'Enter',
    ctrl: true,
    description: 'Confirm action',
    category: 'Actions',
  },
  delete: {
    key: 'Delete',
    description: 'Delete selected item',
    category: 'Actions',
  },
  selectAll: {
    key: 'a',
    ctrl: true,
    description: 'Select all',
    category: 'Selection',
  },
  goBack: {
    key: 'ArrowLeft',
    alt: true,
    description: 'Go back',
    category: 'Navigation',
  },
  goForward: {
    key: 'ArrowRight',
    alt: true,
    description: 'Go forward',
    category: 'Navigation',
  },
} as const;

/**
 * Call control shortcuts
 */
export const CALL_SHORTCUTS = {
  mute: {
    key: 'm',
    description: 'Toggle mute',
    category: 'Call Controls',
  },
  hold: {
    key: 'h',
    description: 'Toggle hold',
    category: 'Call Controls',
  },
  hangUp: {
    key: 'Escape',
    description: 'End call',
    category: 'Call Controls',
  },
  transfer: {
    key: 't',
    description: 'Transfer call',
    category: 'Call Controls',
  },
  record: {
    key: 'r',
    description: 'Toggle recording',
    category: 'Call Controls',
  },
  keypad: {
    key: 'k',
    description: 'Toggle keypad',
    category: 'Call Controls',
  },
} as const;

export default useKeyboardShortcuts;
