'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';

type Theme = 'light' | 'dark';

interface ThemeContextValue {
  theme: Theme;
  setTheme: (t: Theme) => void;
  toggle: () => void;
}

const STORAGE_KEY = 'nuxcall:theme';
const ThemeContext = createContext<ThemeContextValue>({
  theme: 'light',
  setTheme: () => {},
  toggle: () => {},
});

export function useTheme() {
  return useContext(ThemeContext);
}

// Marketing-scoped theme provider. Default is LIGHT — we do NOT follow the OS
// preference (a dark-OS visitor still gets the intended white landing). Dark is
// applied only if it was explicitly chosen, or the saved value is 'system' and
// the OS is dark. This mirrors NoFlashTheme exactly (and reads both storage
// keys — app 'theme' + marketing 'nuxcall:theme') so there is no flip after
// hydration and a choice made anywhere in the product is honored site-wide.
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('light');

  useEffect(() => {
    try {
      const stored =
        window.localStorage.getItem('theme') || window.localStorage.getItem(STORAGE_KEY);
      let next: Theme = 'light';
      if (stored === 'dark') next = 'dark';
      else if (stored === 'system')
        next = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      // 'light' or nothing stored → stay light (default, no OS fallback).
      setThemeState(next);
    } catch {
      // ignore (private mode, sandboxed iframe, etc.)
    }
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    try {
      window.localStorage.setItem(STORAGE_KEY, t);
    } catch {
      // ignore
    }
  }, []);

  const toggle = useCallback(() => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  }, [theme, setTheme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggle }}>{children}</ThemeContext.Provider>
  );
}
