'use client';

/**
 * StyledSelect — a custom dropdown that replaces the native <select> so the
 * open list matches the app (rounded card menu) instead of the OS's boxy
 * picker, and never spills outside the UI.
 *
 * Designed as a near drop-in for a native <select>: it accepts the same
 * <option> / <optgroup> children, so converting a native select is just:
 *   <select value={v} onChange={(e) => fn(e.target.value)} className="…">…</select>
 *   →
 *   <StyledSelect value={v} onChange={fn} className="…">…</StyledSelect>
 *
 * The menu is portaled and positioned against the trigger (fixed, viewport-
 * clamped, flips up when there's no room below) so it works inside cards,
 * modals and scroll containers without clipping.
 *
 * @module components/ui/StyledSelect
 */

import React, { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { FiCheck, FiChevronDown } from 'react-icons/fi';
import { cn } from '@/lib/utils/cn';

interface ParsedOption {
  value: string;
  label: React.ReactNode;
  disabled?: boolean;
}

interface ParsedGroup {
  group: string;
}

type ParsedItem = ParsedOption | ParsedGroup;

function isGroup(item: ParsedItem): item is ParsedGroup {
  return 'group' in item;
}

/** Recursively pull <option>/<optgroup> out of arbitrary children. */
function parseChildren(children: React.ReactNode, out: ParsedItem[] = []): ParsedItem[] {
  React.Children.forEach(children, (child) => {
    if (!React.isValidElement(child)) return;
    const el = child as React.ReactElement<Record<string, unknown>>;
    if (el.type === 'option') {
      out.push({
        value: String(el.props.value ?? ''),
        label: (el.props.children as React.ReactNode) ?? '',
        disabled: Boolean(el.props.disabled),
      });
    } else if (el.type === 'optgroup') {
      out.push({ group: String(el.props.label ?? '') });
      parseChildren(el.props.children as React.ReactNode, out);
    } else if (el.props && el.props.children) {
      // Fragment or wrapper — recurse.
      parseChildren(el.props.children as React.ReactNode, out);
    }
  });
  return out;
}

export interface StyledSelectProps {
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
  /** Applied to the trigger button (kept compatible with native-select classes). */
  className?: string;
  placeholder?: string;
  disabled?: boolean;
  id?: string;
  name?: string;
  'aria-label'?: string;
  'aria-labelledby'?: string;
}

export function StyledSelect({
  value,
  onChange,
  children,
  className,
  placeholder,
  disabled,
  id,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledBy,
}: StyledSelectProps) {
  const items = parseChildren(children);
  const options = items.filter((i): i is ParsedOption => !isGroup(i));
  const selected = options.find((o) => o.value === value);

  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState<number>(-1);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number; width: number; flip: boolean }>({
    top: 0,
    left: 0,
    width: 0,
    flip: false,
  });
  const generatedId = useId();
  const listboxId = `${id || generatedId}-listbox`;

  const reposition = () => {
    const t = triggerRef.current;
    if (!t) return;
    const r = t.getBoundingClientRect();
    const menuH = menuRef.current?.offsetHeight ?? 0;
    const menuW = menuRef.current?.offsetWidth ?? 0;
    const spaceBelow = window.innerHeight - r.bottom;
    const flip = menuH > 0 && spaceBelow < menuH + 8 && r.top > spaceBelow;
    // The menu sizes to its content (so options never truncate on a narrow
    // trigger); keep it inside the viewport horizontally.
    const left = menuW > 0 ? Math.max(8, Math.min(r.left, window.innerWidth - menuW - 8)) : r.left;
    setPos({
      top: flip ? r.top - menuH - 4 : r.bottom + 4,
      left,
      width: r.width,
      flip,
    });
  };

  // Position before paint, then keep it pinned to the trigger on scroll/resize.
  useLayoutEffect(() => {
    if (!open) return;
    reposition();
    const onScroll = () => reposition();
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Click outside + Escape to close.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (!triggerRef.current?.contains(target) && !menuRef.current?.contains(target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const openMenu = () => {
    if (disabled) return;
    setActiveIndex(options.findIndex((o) => o.value === value));
    setOpen(true);
  };

  const commit = (v: string) => {
    onChange(v);
    setOpen(false);
    triggerRef.current?.focus();
  };

  const onTriggerKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    if (!open && (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      openMenu();
      return;
    }
    if (open) {
      if (e.key === 'Escape') {
        e.preventDefault();
        setOpen(false);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex((i) => Math.min(options.length - 1, i + 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex((i) => Math.max(0, i - 1));
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        const opt = options[activeIndex];
        if (opt && !opt.disabled) commit(opt.value);
      }
    }
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        id={id}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        onClick={() => (open ? setOpen(false) : openMenu())}
        onKeyDown={onTriggerKeyDown}
        className={cn(
          'flex h-10 w-full items-center justify-between gap-2 rounded-lg border border-[var(--border)] bg-[var(--input)] px-3 text-sm text-[var(--foreground)] transition-colors',
          'hover:border-[var(--primary-400)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-600)]',
          'disabled:cursor-not-allowed disabled:opacity-50',
          className
        )}
      >
        <span className={cn('truncate text-left', !selected && 'text-[var(--muted-foreground)]')}>
          {selected ? selected.label : (placeholder ?? '')}
        </span>
        <FiChevronDown
          className={cn(
            'h-4 w-4 flex-shrink-0 text-[var(--muted-foreground)] transition-transform',
            open && 'rotate-180'
          )}
          aria-hidden="true"
        />
      </button>

      {open &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={menuRef}
            role="listbox"
            id={listboxId}
            className="fixed z-[60] max-h-64 w-max max-w-[calc(100vw-1rem)] overflow-y-auto rounded-lg border border-[var(--border)] bg-[var(--card)] py-1 shadow-lg"
            style={{ top: pos.top, left: pos.left, minWidth: pos.width }}
          >
            {items.map((item, i) => {
              if (isGroup(item)) {
                return (
                  <div
                    key={`g-${i}`}
                    className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]"
                  >
                    {item.group}
                  </div>
                );
              }
              const optIndex = options.indexOf(item);
              const isSel = item.value === value;
              const isActive = optIndex === activeIndex;
              return (
                <button
                  key={`o-${item.value}-${i}`}
                  type="button"
                  role="option"
                  aria-selected={isSel}
                  disabled={item.disabled}
                  onMouseEnter={() => setActiveIndex(optIndex)}
                  onClick={() => !item.disabled && commit(item.value)}
                  className={cn(
                    'flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors',
                    item.disabled && 'cursor-not-allowed opacity-50',
                    isSel
                      ? 'bg-[var(--primary-50)] text-[var(--foreground)] dark:bg-[var(--primary-900)]/20 dark:text-[var(--primary-300)]'
                      : isActive
                        ? 'bg-[var(--muted)] text-[var(--foreground)]'
                        : 'text-[var(--foreground)] hover:bg-[var(--muted)]'
                  )}
                >
                  <FiCheck
                    className={cn(
                      'h-4 w-4 flex-shrink-0 text-[var(--foreground)]',
                      isSel ? 'opacity-100' : 'opacity-0'
                    )}
                    aria-hidden="true"
                  />
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </div>,
          document.body
        )}
    </>
  );
}

export default StyledSelect;
