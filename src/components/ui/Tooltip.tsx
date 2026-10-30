'use client';

import React, { useState, useRef, useCallback, useEffect, useId } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils/cn';

type TooltipPosition = 'top' | 'bottom' | 'left' | 'right';

interface TooltipProps {
  /**
   * Tooltip content
   */
  content: React.ReactNode;

  /**
   * The element that triggers the tooltip
   */
  children: React.ReactElement;

  /**
   * Preferred position (will flip if not enough space)
   * @default 'top'
   */
  position?: TooltipPosition;

  /**
   * Delay before showing (ms)
   * @default 200
   */
  delay?: number;

  /**
   * Whether the tooltip is disabled
   */
  disabled?: boolean;

  /**
   * Additional CSS classes for the tooltip
   */
  className?: string;

  /**
   * Max width of the tooltip
   * @default 250
   */
  maxWidth?: number;
}

interface Position {
  top: number;
  left: number;
  actualPosition: TooltipPosition;
}

/**
 * Tooltip Component
 *
 * Displays additional information on hover/focus.
 *
 * @example
 * ```tsx
 * <Tooltip content="This is a tooltip">
 *   <button>Hover me</button>
 * </Tooltip>
 *
 * <Tooltip content="Right tooltip" position="right">
 *   <span>Info</span>
 * </Tooltip>
 * ```
 */
export function Tooltip({
  content,
  children,
  position = 'top',
  delay = 200,
  disabled,
  className,
  maxWidth = 250,
}: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState<Position | null>(null);
  const triggerRef = useRef<HTMLElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const tooltipId = useId();

  // Calculate tooltip position
  const calculatePosition = useCallback(() => {
    if (!triggerRef.current || !tooltipRef.current) return;

    const triggerRect = triggerRef.current.getBoundingClientRect();
    const tooltipRect = tooltipRef.current.getBoundingClientRect();
    const scrollY = window.scrollY;
    const scrollX = window.scrollX;

    const spacing = 8; // Gap between trigger and tooltip

    const positions: Record<TooltipPosition, { top: number; left: number }> = {
      top: {
        top: triggerRect.top + scrollY - tooltipRect.height - spacing,
        left: triggerRect.left + scrollX + (triggerRect.width - tooltipRect.width) / 2,
      },
      bottom: {
        top: triggerRect.bottom + scrollY + spacing,
        left: triggerRect.left + scrollX + (triggerRect.width - tooltipRect.width) / 2,
      },
      left: {
        top: triggerRect.top + scrollY + (triggerRect.height - tooltipRect.height) / 2,
        left: triggerRect.left + scrollX - tooltipRect.width - spacing,
      },
      right: {
        top: triggerRect.top + scrollY + (triggerRect.height - tooltipRect.height) / 2,
        left: triggerRect.right + scrollX + spacing,
      },
    };

    // Check if preferred position fits
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let actualPosition = position;
    let pos = positions[position];

    // Flip if necessary
    if (position === 'top' && pos.top - scrollY < 0) {
      actualPosition = 'bottom';
      pos = positions.bottom;
    } else if (position === 'bottom' && pos.top - scrollY + tooltipRect.height > viewportHeight) {
      actualPosition = 'top';
      pos = positions.top;
    } else if (position === 'left' && pos.left - scrollX < 0) {
      actualPosition = 'right';
      pos = positions.right;
    } else if (position === 'right' && pos.left - scrollX + tooltipRect.width > viewportWidth) {
      actualPosition = 'left';
      pos = positions.left;
    }

    // Clamp horizontal position
    pos.left = Math.max(
      scrollX + spacing,
      Math.min(pos.left, scrollX + viewportWidth - tooltipRect.width - spacing)
    );

    setTooltipPosition({ ...pos, actualPosition });
  }, [position]);

  const showTooltip = useCallback(() => {
    if (disabled) return;

    timeoutRef.current = setTimeout(() => {
      setIsVisible(true);
    }, delay);
  }, [delay, disabled]);

  const hideTooltip = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setIsVisible(false);
    setTooltipPosition(null);
  }, []);

  // Calculate position when tooltip becomes visible
  useEffect(() => {
    if (isVisible) {
      // Use requestAnimationFrame to ensure the tooltip is rendered
      requestAnimationFrame(() => {
        calculatePosition();
      });
    }
  }, [isVisible, calculatePosition]);

  // Clean up timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  // Clone child and add event handlers
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const childProps = children.props as any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const trigger = React.cloneElement(children as React.ReactElement<any>, {
    ref: triggerRef,
    onMouseEnter: (e: React.MouseEvent) => {
      showTooltip();
      childProps.onMouseEnter?.(e);
    },
    onMouseLeave: (e: React.MouseEvent) => {
      hideTooltip();
      childProps.onMouseLeave?.(e);
    },
    onFocus: (e: React.FocusEvent) => {
      showTooltip();
      childProps.onFocus?.(e);
    },
    onBlur: (e: React.FocusEvent) => {
      hideTooltip();
      childProps.onBlur?.(e);
    },
    'aria-describedby': isVisible ? tooltipId : undefined,
  });

  const arrowClasses: Record<TooltipPosition, string> = {
    top: 'bottom-[-4px] left-1/2 -translate-x-1/2 border-t-[var(--gray-900)] dark:border-t-[var(--gray-100)] border-x-transparent border-b-transparent',
    bottom:
      'top-[-4px] left-1/2 -translate-x-1/2 border-b-[var(--gray-900)] dark:border-b-[var(--gray-100)] border-x-transparent border-t-transparent',
    left: 'right-[-4px] top-1/2 -translate-y-1/2 border-l-[var(--gray-900)] dark:border-l-[var(--gray-100)] border-y-transparent border-r-transparent',
    right:
      'left-[-4px] top-1/2 -translate-y-1/2 border-r-[var(--gray-900)] dark:border-r-[var(--gray-100)] border-y-transparent border-l-transparent',
  };

  const tooltip =
    isVisible &&
    typeof window !== 'undefined' &&
    createPortal(
      <div
        ref={tooltipRef}
        id={tooltipId}
        role="tooltip"
        className={cn(
          'fixed z-50 px-3 py-2 text-sm rounded-lg shadow-lg',
          'bg-[var(--gray-900)] text-white dark:bg-[var(--gray-100)] dark:text-[var(--gray-900)]',
          'animate-fade-in',
          className
        )}
        style={{
          top: tooltipPosition?.top ?? 0,
          left: tooltipPosition?.left ?? 0,
          maxWidth,
          visibility: tooltipPosition ? 'visible' : 'hidden',
        }}
      >
        {content}
        {/* Arrow */}
        <span
          className={cn(
            'absolute border-4',
            tooltipPosition ? arrowClasses[tooltipPosition.actualPosition] : arrowClasses.top
          )}
          aria-hidden="true"
        />
      </div>,
      document.body
    );

  return (
    <>
      {trigger}
      {tooltip}
    </>
  );
}

export default Tooltip;
