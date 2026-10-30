/**
 * Theme SSOT.
 *
 * Single source of truth for the app-side light/dark/system theme. Both the
 * phone Settings panel and the org portal Profile page use `useTheme()` /
 * `<ThemeSelector />` (see components/ui/ThemeSelector) so the logic lives in
 * exactly one place.
 *
 * Storage: we write BOTH `theme` and `nuxcall:theme`. The no-flash boot script
 * (components/landing/NoFlashTheme, wired in app/layout.tsx) reads `theme`
 * first, then `nuxcall:theme` — writing/clearing both keeps them from
 * disagreeing across reloads. Theme is applied via the `dark` class on <html>.
 */

export type ThemeChoice = 'light' | 'dark' | 'system';

export const THEME_KEYS = ['theme', 'nuxcall:theme'] as const;

export function systemPrefersDark(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
  );
}

/** Persist the choice (both keys) and toggle the `dark` class on <html>. */
export function applyTheme(t: ThemeChoice): void {
  if (typeof document === 'undefined') return;
  try {
    if (t === 'system') {
      // Store 'system' explicitly so an EMPTY store means "no choice → light"
      // (the app default), while 'system' still live-follows the OS.
      THEME_KEYS.forEach((k) => window.localStorage.setItem(k, 'system'));
      document.documentElement.classList.toggle('dark', systemPrefersDark());
    } else {
      THEME_KEYS.forEach((k) => window.localStorage.setItem(k, t));
      document.documentElement.classList.toggle('dark', t === 'dark');
    }
  } catch {
    /* localStorage/matchMedia unavailable — ignore */
  }
}

/** Read the stored choice, matching the boot script's key priority. */
export function readStoredTheme(): ThemeChoice {
  if (typeof window === 'undefined') return 'light';
  try {
    const stored =
      window.localStorage.getItem('theme') ?? window.localStorage.getItem('nuxcall:theme');
    // No stored choice → LIGHT is the default (was 'system'/OS before).
    return stored === 'dark' ? 'dark' : stored === 'system' ? 'system' : 'light';
  } catch {
    return 'light';
  }
}
