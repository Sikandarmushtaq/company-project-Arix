'use client';

/**
 * useDocumentVisible
 *
 * Returns true when the page is *both* visible (not in a background tab,
 * not minimised) and focused (this window is the foreground OS window).
 *
 * Why both checks: `document.visibilityState === 'visible'` flips on
 * tab activation but stays `'visible'` when the user clicks into another
 * app — for "is the user actually looking at us right now," focus is the
 * stricter signal. WhatsApp/Slack auto-mark-read uses this combined gate.
 *
 * SSR-safe: returns `true` on the server (no `document`), since any
 * useEffect that consumes this won't fire until the client hydrates.
 *
 * @module lib/hooks/useDocumentVisible
 */

import { useEffect, useState } from 'react';

function computeVisible(): boolean {
  if (typeof document === 'undefined') return true;
  return document.visibilityState === 'visible' && document.hasFocus();
}

export function useDocumentVisible(): boolean {
  const [visible, setVisible] = useState<boolean>(computeVisible);

  useEffect(() => {
    const update = () => setVisible(computeVisible());
    // Re-evaluate on every relevant transition. `visibilitychange` covers
    // tab switches and OS-level minimise/restore. `focus`/`blur` cover
    // alt-tab to another OS window while this tab stays "visible" but
    // loses focus.
    document.addEventListener('visibilitychange', update);
    window.addEventListener('focus', update);
    window.addEventListener('blur', update);
    return () => {
      document.removeEventListener('visibilitychange', update);
      window.removeEventListener('focus', update);
      window.removeEventListener('blur', update);
    };
  }, []);

  return visible;
}
