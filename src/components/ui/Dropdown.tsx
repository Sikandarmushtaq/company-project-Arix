'use client';

import React, {
  createContext,
  useContext,
  useState,
  useRef,
  useCallback,
  useEffect,
  useId,
} from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils/cn';
import { FiCheck, FiChevronRight } from 'react-icons/fi';

// Context
interface DropdownContextValue {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  triggerId: string;
  menuId: string;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
}

const DropdownContext = createContext<DropdownContextValue | null>(null);

function useDropdownContext() {
  const context = useContext(DropdownContext);
  if (!context) {
    throw new Error('Dropdown components must be used within a Dropdown provider');
  }
  return context;
}

// Root
interface DropdownProps {
  children: React.ReactNode;
  /**
   * Controlled open state
   */
  open?: boolean;
  /**
   * Callback when open state changes
   */
  onOpenChange?: (open: boolean) => void;
}

export function Dropdown({ children, open: controlledOpen, onOpenChange }: DropdownProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const baseId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);

  const isOpen = controlledOpen !== undefined ? controlledOpen : uncontrolledOpen;
  const setIsOpen = useCallback(
    (open: boolean) => {
      if (controlledOpen === undefined) {
        setUncontrolledOpen(open);
      }
      onOpenChange?.(open);
    },
    [controlledOpen, onOpenChange]
  );

  return (
    <DropdownContext.Provider
      value={{
        isOpen,
        setIsOpen,
        triggerId: `${baseId}-trigger`,
        menuId: `${baseId}-menu`,
        triggerRef,
      }}
    >
      <div className="relative inline-block">{children}</div>
    </DropdownContext.Provider>
  );
}

// Trigger
interface DropdownTriggerProps {
  children: React.ReactNode;
  className?: string;
  /**
   * Element type
   * @default 'button'
   */
  asChild?: boolean;
}

export function DropdownTrigger({ children, className, asChild }: DropdownTriggerProps) {
  const { isOpen, setIsOpen, triggerId, menuId, triggerRef } = useDropdownContext();

  const handleClick = () => setIsOpen(!isOpen);
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown' && !isOpen) {
      e.preventDefault();
      setIsOpen(true);
    }
  };

  if (asChild && React.isValidElement(children)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return React.cloneElement(children as React.ReactElement<any>, {
      ref: triggerRef,
      id: triggerId,
      'aria-haspopup': 'menu',
      'aria-expanded': isOpen,
      'aria-controls': isOpen ? menuId : undefined,
      onClick: handleClick,
      onKeyDown: handleKeyDown,
    });
  }

  return (
    <button
      ref={triggerRef}
      id={triggerId}
      type="button"
      aria-haspopup="menu"
      aria-expanded={isOpen}
      aria-controls={isOpen ? menuId : undefined}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className={cn('inline-flex items-center justify-center', className)}
    >
      {children}
    </button>
  );
}

// Menu
interface DropdownMenuProps {
  children: React.ReactNode;
  className?: string;
  /**
   * Alignment of the menu
   * @default 'start'
   */
  align?: 'start' | 'center' | 'end';
  /**
   * Side of the trigger to show menu
   * @default 'bottom'
   */
  side?: 'top' | 'bottom';
}

export function DropdownMenu({
  children,
  className,
  align = 'start',
  side = 'bottom',
}: DropdownMenuProps) {
  const { isOpen, setIsOpen, menuId, triggerId, triggerRef } = useDropdownContext();
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ top: 0, left: 0 });

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        menuRef.current &&
        !menuRef.current.contains(target) &&
        triggerRef.current &&
        !triggerRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, setIsOpen, triggerRef]);

  // Calculate position
  useEffect(() => {
    if (!isOpen || !triggerRef.current || !menuRef.current) return;

    const triggerRect = triggerRef.current.getBoundingClientRect();
    const menuRect = menuRef.current.getBoundingClientRect();
    const scrollY = window.scrollY;
    const scrollX = window.scrollX;

    let top: number;
    let left: number;

    // Vertical position
    if (side === 'bottom') {
      top = triggerRect.bottom + scrollY + 4;
    } else {
      top = triggerRect.top + scrollY - menuRect.height - 4;
    }

    // Horizontal position
    switch (align) {
      case 'center':
        left = triggerRect.left + scrollX + (triggerRect.width - menuRect.width) / 2;
        break;
      case 'end':
        left = triggerRect.right + scrollX - menuRect.width;
        break;
      default:
        left = triggerRect.left + scrollX;
    }

    // Clamp to viewport
    const viewportWidth = window.innerWidth;
    left = Math.max(8, Math.min(left, viewportWidth - menuRect.width - 8));

    setPosition({ top, left });
  }, [isOpen, align, side, triggerRef]);

  // Focus management
  useEffect(() => {
    if (isOpen && menuRef.current) {
      const firstItem = menuRef.current.querySelector('[role="menuitem"]:not([disabled])');
      if (firstItem instanceof HTMLElement) {
        firstItem.focus();
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  if (typeof window === 'undefined') return null;

  return createPortal(
    <div
      ref={menuRef}
      id={menuId}
      role="menu"
      aria-labelledby={triggerId}
      className={cn(
        'fixed z-50 min-w-[8rem] overflow-hidden rounded-lg',
        'bg-[var(--card)] border border-[var(--border)] shadow-lg',
        'py-1 animate-fade-in',
        className
      )}
      style={{ top: position.top, left: position.left }}
    >
      {children}
    </div>,
    document.body
  );
}

// Item
interface DropdownItemProps {
  children: React.ReactNode;
  className?: string;
  /**
   * Icon to show before the label
   */
  icon?: React.ReactNode;
  /**
   * Keyboard shortcut hint
   */
  shortcut?: string;
  /**
   * Disable the item
   */
  disabled?: boolean;
  /**
   * Show as destructive/danger action
   */
  destructive?: boolean;
  /**
   * Click handler
   */
  onSelect?: () => void;
}

export function DropdownItem({
  children,
  className,
  icon,
  shortcut,
  disabled,
  destructive,
  onSelect,
}: DropdownItemProps) {
  const { setIsOpen } = useDropdownContext();

  const handleClick = () => {
    if (disabled) return;
    onSelect?.();
    setIsOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick();
    }
  };

  return (
    <div
      role="menuitem"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className={cn(
        'relative flex items-center gap-2 px-3 py-2 text-sm cursor-pointer',
        'outline-none transition-colors',
        'focus:bg-[var(--muted)] hover:bg-[var(--muted)]',
        disabled && 'opacity-50 cursor-not-allowed',
        destructive && 'text-red-600 dark:text-red-400 focus:text-red-600 dark:focus:text-red-400',
        !destructive && 'text-[var(--foreground)]',
        className
      )}
    >
      {icon && <span className="w-4 h-4 flex-shrink-0">{icon}</span>}
      <span className="flex-1">{children}</span>
      {shortcut && (
        <span className="text-xs text-[var(--muted-foreground)] ml-auto">{shortcut}</span>
      )}
    </div>
  );
}

// Checkbox Item
interface DropdownCheckboxItemProps extends Omit<DropdownItemProps, 'onSelect'> {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
}

export function DropdownCheckboxItem({
  children,
  checked,
  onCheckedChange,
  className,
  ...props
}: DropdownCheckboxItemProps) {
  return (
    <DropdownItem
      {...props}
      className={cn('pl-8', className)}
      onSelect={() => onCheckedChange?.(!checked)}
    >
      {checked && <FiCheck className="absolute left-3 w-4 h-4" aria-hidden="true" />}
      {children}
    </DropdownItem>
  );
}

// Separator
export function DropdownSeparator({ className }: { className?: string }) {
  return <div role="separator" className={cn('h-px my-1 bg-[var(--border)]', className)} />;
}

// Label
export function DropdownLabel({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn('px-3 py-1.5 text-xs font-semibold text-[var(--muted-foreground)]', className)}
    >
      {children}
    </div>
  );
}

// Sub-menu (simplified - just provides visual indicator)
export function DropdownSubTrigger({
  children,
  icon,
  className,
}: {
  children: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      role="menuitem"
      tabIndex={0}
      className={cn(
        'relative flex items-center gap-2 px-3 py-2 text-sm cursor-pointer',
        'outline-none transition-colors text-[var(--foreground)]',
        'focus:bg-[var(--muted)] hover:bg-[var(--muted)]',
        className
      )}
    >
      {icon && <span className="w-4 h-4 flex-shrink-0">{icon}</span>}
      <span className="flex-1">{children}</span>
      <FiChevronRight className="w-4 h-4 text-[var(--muted-foreground)]" />
    </div>
  );
}

export default Dropdown;
