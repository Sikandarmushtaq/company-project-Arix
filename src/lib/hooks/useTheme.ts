'use client';

import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { applyTheme, readStoredTheme, type ThemeChoice } from '@/lib/theme';

// Notify same-tab subscribers — the native `storage` event only fires in OTHER
// tabs, so setTheme dispatches this so the current tab's selector re-renders.
const THEME_EVENT = 'nuxcall:theme-change';

function subscribe(cb: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const onChange = (e: Event) => {
    // Ignore unrelated storage keys; react to our own synthetic event always.
    if (e instanceof StorageEvent && e.key && e.key !== 'theme' && e.key !== 'nuxcall:theme') return;
    cb();
  };
  window.addEventListener('storage', onChange);
  window.addEventListener(THEME_EVENT, onChange);
  return () => {
    window.removeEventListener('storage', onChange);
    window.removeEventListener(THEME_EVENT, onChange);
  };
}

/**
 * Shared theme hook (SSOT). Reads the current choice from storage via
 * useSyncExternalStore (hydration-safe: the server snapshot is 'system', the
 * boot script has already applied the right class before hydration) and returns
 * a setter that persists + applies it.
 */
export function useTheme() {
  const theme = useSyncExternalStore(subscribe, readStoredTheme, () => 'light' as ThemeChoice);

  // While on `system`, live-follow the OS preference (DOM update only).
  useEffect(() => {
    if (theme !== 'system' || typeof window === 'undefined') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => document.documentElement.classList.toggle('dark', mq.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [theme]);

  const setTheme = useCallback((t: ThemeChoice) => {
    applyTheme(t);
    window.dispatchEvent(new Event(THEME_EVENT));
  }, []);

  return { theme, setTheme };
}
