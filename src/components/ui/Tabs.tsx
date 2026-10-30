'use client';

import React, { createContext, useContext, useState, useCallback, useId } from 'react';
import { cn } from '@/lib/utils/cn';

// Context
interface TabsContextValue {
  value: string;
  onValueChange: (value: string) => void;
  baseId: string;
}

const TabsContext = createContext<TabsContextValue | null>(null);

function useTabsContext() {
  const context = useContext(TabsContext);
  if (!context) {
    throw new Error('Tabs components must be used within a Tabs provider');
  }
  return context;
}

// Root
interface TabsProps {
  /**
   * Controlled value
   */
  value?: string;

  /**
   * Default value for uncontrolled usage
   */
  defaultValue?: string;

  /**
   * Callback when value changes
   */
  onValueChange?: (value: string) => void;

  /**
   * Tab children
   */
  children: React.ReactNode;

  /**
   * Additional CSS classes
   */
  className?: string;
}

export function Tabs({
  value: controlledValue,
  defaultValue,
  onValueChange,
  children,
  className,
}: TabsProps) {
  const [uncontrolledValue, setUncontrolledValue] = useState(defaultValue || '');
  const baseId = useId();

  const isControlled = controlledValue !== undefined;
  const value = isControlled ? controlledValue : uncontrolledValue;

  const handleValueChange = useCallback(
    (newValue: string) => {
      if (!isControlled) {
        setUncontrolledValue(newValue);
      }
      onValueChange?.(newValue);
    },
    [isControlled, onValueChange]
  );

  return (
    <TabsContext.Provider value={{ value, onValueChange: handleValueChange, baseId }}>
      <div className={cn('w-full', className)}>{children}</div>
    </TabsContext.Provider>
  );
}

// List
interface TabsListProps {
  children: React.ReactNode;
  className?: string;
  /**
   * Visual variant
   */
  variant?: 'default' | 'pills' | 'underline';
}

export function TabsList({ children, className, variant = 'default' }: TabsListProps) {
  const variantClasses = {
    default: 'inline-flex items-center justify-center rounded-lg bg-[var(--muted)] p-1 gap-1',
    pills: 'inline-flex items-center gap-2',
    underline: 'inline-flex items-center gap-6 border-b border-[var(--border)]',
  };

  return (
    <div
      role="tablist"
      aria-orientation="horizontal"
      className={cn(variantClasses[variant], className)}
    >
      {children}
    </div>
  );
}

// Trigger
interface TabsTriggerProps {
  /**
   * Value that identifies this tab
   */
  value: string;

  /**
   * Tab label content
   */
  children: React.ReactNode;

  /**
   * Disable the tab
   */
  disabled?: boolean;

  /**
   * Additional CSS classes
   */
  className?: string;

  /**
   * Visual variant (should match TabsList variant)
   */
  variant?: 'default' | 'pills' | 'underline';
}

export function TabsTrigger({
  value,
  children,
  disabled,
  className,
  variant = 'default',
}: TabsTriggerProps) {
  const { value: selectedValue, onValueChange, baseId } = useTabsContext();
  const isSelected = selectedValue === value;

  const baseClasses =
    'inline-flex items-center justify-center whitespace-nowrap font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50';

  const variantClasses = {
    default: cn(
      'px-3 py-1.5 text-sm rounded-md',
      isSelected
        ? 'bg-[var(--background)] text-[var(--foreground)] shadow-sm'
        : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
    ),
    pills: cn(
      'px-4 py-2 text-sm rounded-full border',
      isSelected
        ? 'bg-[var(--primary-600)] text-white border-[var(--border)]'
        : 'bg-transparent text-[var(--muted-foreground)] border-[var(--border)] hover:text-[var(--foreground)] hover:border-[var(--foreground)]'
    ),
    underline: cn(
      'px-1 py-3 text-sm border-b-2 -mb-px',
      isSelected
        ? 'border-[var(--border)] text-[var(--foreground)]'
        : 'border-transparent text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:border-[var(--border)]'
    ),
  };

  return (
    <button
      role="tab"
      type="button"
      id={`${baseId}-trigger-${value}`}
      aria-controls={`${baseId}-content-${value}`}
      aria-selected={isSelected}
      tabIndex={isSelected ? 0 : -1}
      disabled={disabled}
      onClick={() => onValueChange(value)}
      className={cn(baseClasses, variantClasses[variant], className)}
    >
      {children}
    </button>
  );
}

// Content
interface TabsContentProps {
  /**
   * Value that identifies this content panel
   */
  value: string;

  /**
   * Content to display when tab is active
   */
  children: React.ReactNode;

  /**
   * Additional CSS classes
   */
  className?: string;

  /**
   * Force mount even when not selected (useful for animations)
   */
  forceMount?: boolean;
}

export function TabsContent({ value, children, className, forceMount }: TabsContentProps) {
  const { value: selectedValue, baseId } = useTabsContext();
  const isSelected = selectedValue === value;

  if (!forceMount && !isSelected) {
    return null;
  }

  return (
    <div
      role="tabpanel"
      id={`${baseId}-content-${value}`}
      aria-labelledby={`${baseId}-trigger-${value}`}
      hidden={!isSelected}
      tabIndex={0}
      className={cn(
        'mt-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2',
        isSelected ? 'animate-fade-in' : '',
        className
      )}
    >
      {children}
    </div>
  );
}

export default Tabs;
