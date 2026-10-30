'use client';

import React from 'react';
import { FiSun, FiMoon, FiMonitor, FiCheck } from 'react-icons/fi';
import { useTheme } from '@/lib/hooks/useTheme';
import type { ThemeChoice } from '@/lib/theme';

const OPTIONS: Array<{ id: ThemeChoice; label: string; icon: React.ReactNode }> = [
  { id: 'light', label: 'Light', icon: <FiSun className="w-6 h-6" /> },
  { id: 'dark', label: 'Dark', icon: <FiMoon className="w-6 h-6" /> },
  { id: 'system', label: 'System', icon: <FiMonitor className="w-6 h-6" /> },
];

/**
 * Light / Dark / System segmented control. SSOT theme UI — used by the phone
 * Settings panel and the org Profile page. Logic lives in useTheme / lib/theme.
 */
export function ThemeSelector({ className = '' }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  return (
    <div className={`grid grid-cols-3 gap-3 ${className}`}>
      {OPTIONS.map((opt) => {
        const on = theme === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => setTheme(opt.id)}
            aria-pressed={on}
            className={`flex flex-col items-center gap-2 rounded-2xl border-2 py-6 transition-colors ${
              on
                ? 'border-[var(--border)] bg-[var(--primary-50)] dark:bg-[var(--primary-900)]/20 text-[var(--foreground)]'
                : 'border-[var(--border)] text-[var(--muted-foreground)] hover:border-[var(--primary-300)]'
            }`}
          >
            {opt.icon}
            <span className="text-sm font-bold">{opt.label}</span>
            {on && <FiCheck className="w-4 h-4" />}
          </button>
        );
      })}
    </div>
  );
}
