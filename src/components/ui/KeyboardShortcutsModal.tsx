'use client';

import React, { useMemo } from 'react';
import { FiX, FiCommand } from 'react-icons/fi';
import { cn } from '@/lib/utils/cn';
import { formatShortcut, ShortcutKeyConfig } from '@/lib/hooks/useKeyboardShortcuts';

// Alias for clearer component props
type ShortcutDefinition = ShortcutKeyConfig & { description: string };

interface KeyboardShortcutsModalProps {
  /**
   * Whether the modal is open
   */
  isOpen: boolean;

  /**
   * Callback to close the modal
   */
  onClose: () => void;

  /**
   * Array of shortcut definitions
   */
  shortcuts: ShortcutDefinition[];

  /**
   * Title of the modal
   * @default "Keyboard Shortcuts"
   */
  title?: string;
}

/**
 * Modal displaying available keyboard shortcuts
 *
 * @example
 * ```tsx
 * const { isOpen, open, close } = useShortcutsModal();
 *
 * <KeyboardShortcutsModal
 *   isOpen={isOpen}
 *   onClose={close}
 *   shortcuts={[
 *     { key: 'k', ctrl: true, description: 'Open search', category: 'Navigation' },
 *     { key: 'n', ctrl: true, description: 'New item', category: 'Actions' },
 *   ]}
 * />
 * ```
 */
export function KeyboardShortcutsModal({
  isOpen,
  onClose,
  shortcuts,
  title = 'Keyboard Shortcuts',
}: KeyboardShortcutsModalProps) {
  // Group shortcuts by category
  const groupedShortcuts = useMemo(() => {
    const groups = new Map<string, ShortcutDefinition[]>();

    shortcuts.forEach((shortcut) => {
      const category = shortcut.category || 'General';
      const existing = groups.get(category) || [];
      groups.set(category, [...existing, shortcut]);
    });

    return Array.from(groups.entries()).sort(([a], [b]) => {
      // Sort "General" last
      if (a === 'General') return 1;
      if (b === 'General') return -1;
      return a.localeCompare(b);
    });
  }, [shortcuts]);

  // Close on Escape
  React.useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // Prevent body scroll when open
  React.useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="shortcuts-title"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div className="relative w-full max-w-2xl max-h-[80vh] m-4 bg-[var(--card)] rounded-xl shadow-2xl overflow-hidden animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-[var(--primary-100)] dark:bg-[var(--primary-900)]">
              <FiCommand className="w-5 h-5 text-[var(--foreground)]" />
            </div>
            <h2 id="shortcuts-title" className="text-lg font-semibold text-[var(--foreground)]">
              {title}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-[var(--muted)] transition-colors"
            aria-label="Close shortcuts modal"
          >
            <FiX className="w-5 h-5 text-[var(--muted-foreground)]" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(80vh-80px)]">
          <div className="space-y-6">
            {groupedShortcuts.map(([category, categoryShortcuts]) => (
              <div key={category}>
                <h3 className="text-sm font-semibold text-[var(--muted-foreground)] uppercase tracking-wide mb-3">
                  {category}
                </h3>
                <div className="space-y-2">
                  {categoryShortcuts.map((shortcut, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-[var(--muted)]/50 transition-colors"
                    >
                      <span className="text-sm text-[var(--foreground)]">
                        {shortcut.description}
                      </span>
                      <ShortcutKey shortcut={shortcut} />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Footer hint */}
          <div className="mt-6 pt-4 border-t border-[var(--border)]">
            <p className="text-xs text-[var(--muted-foreground)] text-center">
              Press <ShortcutKey shortcut={{ key: '?', shift: true, description: '' }} /> anytime to
              show this help
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Renders a keyboard shortcut key combination
 */
function ShortcutKey({ shortcut }: { shortcut: ShortcutDefinition }) {
  const formatted = formatShortcut(shortcut);
  const parts = formatted.split(/([+])/);
  const isMac =
    typeof navigator !== 'undefined' && navigator.platform.toUpperCase().indexOf('MAC') >= 0;

  // For Mac, we don't split by + since we use symbols
  if (isMac) {
    return (
      <kbd className="inline-flex items-center gap-0.5 px-2 py-1 text-xs font-mono font-semibold text-[var(--muted-foreground)] bg-[var(--muted)] border border-[var(--border)] rounded shadow-sm">
        {formatted}
      </kbd>
    );
  }

  // For non-Mac, show each key separately
  const keys = formatted.split('+');

  return (
    <span className="inline-flex items-center gap-1">
      {keys.map((key, i) => (
        <React.Fragment key={i}>
          <kbd
            className={cn(
              'inline-flex items-center justify-center min-w-[1.5rem] px-1.5 py-0.5',
              'text-xs font-mono font-semibold',
              'text-[var(--muted-foreground)] bg-[var(--muted)]',
              'border border-[var(--border)] rounded shadow-sm'
            )}
          >
            {key}
          </kbd>
          {i < keys.length - 1 && <span className="text-[var(--muted-foreground)]">+</span>}
        </React.Fragment>
      ))}
    </span>
  );
}

export default KeyboardShortcutsModal;
