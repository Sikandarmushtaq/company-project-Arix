'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { FiChevronDown, FiSearch } from 'react-icons/fi';
import {
  getCountryOptions,
  countryFlag,
  type CountryCode,
  type CountryOption,
} from '@/lib/utils/phone-format';

interface CountrySelectProps {
  value: CountryCode;
  onChange: (code: CountryCode) => void;
  disabled?: boolean;
  /** Compact = flag + calling code only (for the dialpad). */
  compact?: boolean;
  /** Restrict the list to these countries (in this order). Defaults to all. */
  countries?: CountryCode[];
}

/**
 * Country-flag selector with search. Powers the country-aware phone input.
 * Uses libphonenumber-js country data via phone-format helpers.
 */
export function CountrySelect({
  value,
  onChange,
  disabled,
  compact = true,
  countries,
}: CountrySelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const options = useMemo(() => {
    const all = getCountryOptions();
    if (countries && countries.length) {
      return countries
        .map((c) => all.find((o) => o.code === c))
        .filter((o): o is CountryOption => Boolean(o));
    }
    return all;
  }, [countries]);

  // Search only makes sense for a long list.
  const showSearch = options.length > 6;
  const current = useMemo(
    () => options.find((o) => o.code === value) || { code: value, name: value, callingCode: '', flag: countryFlag(value) },
    [options, value]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) =>
        o.name.toLowerCase().includes(q) ||
        o.code.toLowerCase().includes(q) ||
        o.callingCode.includes(q.replace(/\D/g, ''))
    );
  }, [options, query]);

  // Close on outside click / Escape
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    setTimeout(() => searchRef.current?.focus(), 0);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative inline-block">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 h-9 px-2.5 rounded-xl bg-[var(--muted)]/80 hover:bg-[var(--muted)] border border-transparent text-sm font-medium text-[var(--foreground)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        aria-label={`Country: ${current.name}`}
        aria-expanded={open}
      >
        <span className="text-lg leading-none">{current.flag}</span>
        {compact && current.callingCode && (
          <span className="text-[var(--muted-foreground)]">+{current.callingCode}</span>
        )}
        <FiChevronDown className="w-3.5 h-3.5 text-[var(--muted-foreground)]" />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 left-0 w-64 max-h-72 rounded-xl bg-[var(--background)] border border-[var(--border)] shadow-xl overflow-hidden flex flex-col">
          {showSearch && (
            <div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--border)]">
              <FiSearch className="w-4 h-4 text-[var(--muted-foreground)]" />
              <input
                ref={searchRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search country or code"
                className="nx-search-input flex-1 bg-transparent text-sm outline-none text-[var(--foreground)] placeholder:text-[var(--muted-foreground)]"
              />
            </div>
          )}
          <div className="overflow-y-auto">
            {filtered.length === 0 && (
              <div className="px-3 py-4 text-sm text-[var(--muted-foreground)] text-center">No match</div>
            )}
            {filtered.map((o) => (
              <button
                key={o.code}
                type="button"
                onClick={() => {
                  onChange(o.code);
                  setOpen(false);
                  setQuery('');
                }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left hover:bg-[var(--muted)] transition-colors ${
                  o.code === value ? 'bg-[var(--primary-50)] dark:bg-[var(--primary-900)]/30' : ''
                }`}
              >
                <span className="text-lg leading-none">{o.flag}</span>
                <span className="flex-1 truncate text-[var(--foreground)]">{o.name}</span>
                <span className="text-[var(--muted-foreground)]">+{o.callingCode}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
