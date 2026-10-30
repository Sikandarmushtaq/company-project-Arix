'use client';

import Script from 'next/script';
import { useEffect, useState } from 'react';

// Consent-gated, env-driven Tawk.to loader.
//
// Renders nothing unless BOTH conditions hold:
//   1. NEXT_PUBLIC_TAWK_EMBED_ID is set (e.g. "699f28b46995d41c332976d7/1jiare12v").
//      Format: "<propertyId>/<widgetId>". If unset, the chat widget is disabled.
//   2. The user has granted analytics/marketing consent (Tawk drops tracking
//      cookies — GDPR/UK PECR require prior consent).
//
// Additional: injects CSS into Tawk's widget iframes to hide the "Recent" /
// "Previous Conversations" tab, since Tawk removed the dashboard toggle for
// this in a late-2025/early-2026 update. The injection works because Tawk's
// same-origin iframes allow contentDocument access (cross-origin iframes
// would not). Re-runs on Tawk lifecycle events to catch lazy-loaded content.

const STORAGE_KEY = 'nuxcall:analytics-consent';
const CONSENT_EVENT = 'nuxcall:consent-changed';

// CSS injected into Tawk iframes to hide the Recent/Previous Conversations
// tab. Tawk's widget DOM uses generated class names that shift between
// releases, so we cast a wide net.
const TAWK_TWEAKS_CSS = `
  /* Hide "Recent" / "Previous Conversations" tab + section */
  [class*="tawk-tab"][class*="recent" i],
  [class*="tawk-tab"][class*="history" i],
  [class*="tawk-tab"][class*="previous" i],
  [class*="tawk-recent"],
  [class*="tawk-history"],
  [class*="tawk-previous-conversations"],
  [class*="conversations-list"],
  [data-tab="recent"],
  [data-tab="previous"],
  [data-tab="history"],
  [aria-label="Recent" i],
  [aria-label="Previous Conversations" i] {
    display: none !important;
  }
`;

// Walks all iframes on the page, attempts to access their contentDocument,
// and injects the CSS above + falls back to a text-content scan that hides
// any tab/button labeled "Recent" or "Previous Conversations".
//
// Safe to call repeatedly: an idempotent marker on the injected <style>
// element prevents duplicates.
function injectTawkTweaks(): void {
  if (typeof document === 'undefined') return;
  const iframes = document.querySelectorAll<HTMLIFrameElement>('iframe');
  iframes.forEach((iframe) => {
    try {
      const doc = iframe.contentDocument;
      if (!doc || !doc.head) return;
      // Skip if we've already injected into this iframe
      if (doc.querySelector('style[data-nuxcall-tawk-tweaks]')) {
        // Still try the text-content scan in case new nodes appeared
        hideByText(doc);
        return;
      }
      const style = doc.createElement('style');
      style.setAttribute('data-nuxcall-tawk-tweaks', '');
      style.textContent = TAWK_TWEAKS_CSS;
      doc.head.appendChild(style);
      hideByText(doc);
    } catch {
      // Cross-origin iframe (e.g. third-party widgets that aren't Tawk) —
      // contentDocument throws SecurityError. Silently skip.
    }
  });
}

// Fallback: find text nodes saying "Recent" / "Previous Conversations" and
// hide the nearest tab/button container. Catches cases where Tawk's class
// names don't match our wildcard selectors.
function hideByText(doc: Document): void {
  if (!doc.body) return;
  const targets = ['Recent', 'Previous Conversations'];
  const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
  let node: Node | null;
  while ((node = walker.nextNode())) {
    const text = node.textContent?.trim();
    if (!text || !targets.includes(text)) continue;
    const parent = node.parentElement;
    if (!parent) continue;
    const container =
      parent.closest('[role="tab"], button, li, [class*="tab"], [class*="section"]') ||
      parent;
    (container as HTMLElement).style.setProperty('display', 'none', 'important');
  }
}

// Consent contract — to grant from a cookie-consent banner UI:
//   localStorage.setItem('nuxcall:analytics-consent', 'granted');
//   window.dispatchEvent(new Event('nuxcall:consent-changed'));
function useAnalyticsConsent(): boolean {
  const [granted, setGranted] = useState(false);

  useEffect(() => {
    const read = () => {
      try {
        setGranted(window.localStorage.getItem(STORAGE_KEY) === 'granted');
      } catch {
        setGranted(false);
      }
    };

    read();
    window.addEventListener(CONSENT_EVENT, read);
    window.addEventListener('storage', read);
    return () => {
      window.removeEventListener(CONSENT_EVENT, read);
      window.removeEventListener('storage', read);
    };
  }, []);

  return granted;
}

export default function TawkScript() {
  const embedId = process.env.NEXT_PUBLIC_TAWK_EMBED_ID;
  const consent = useAnalyticsConsent();

  // Wire up Tawk_API lifecycle callbacks BEFORE the Tawk script loads, so
  // Tawk sees them when it initializes. The Script tag below renders with
  // afterInteractive strategy, so this useEffect (which runs during the
  // commit phase) lands before the script executes.
  useEffect(() => {
    if (!consent || !embedId || typeof window === 'undefined') return;

    /* eslint-disable @typescript-eslint/no-explicit-any */
    const w = window as any;
    w.Tawk_API = w.Tawk_API || {};

    const prevOnLoad = w.Tawk_API.onLoad;
    w.Tawk_API.onLoad = function () {
      injectTawkTweaks();
      // Tawk lazy-loads chat-panel content; re-inject a few times
      setTimeout(injectTawkTweaks, 500);
      setTimeout(injectTawkTweaks, 1500);
      setTimeout(injectTawkTweaks, 3000);
      if (typeof prevOnLoad === 'function') prevOnLoad();
    };

    const prevOnChatMaximized = w.Tawk_API.onChatMaximized;
    w.Tawk_API.onChatMaximized = function () {
      injectTawkTweaks();
      setTimeout(injectTawkTweaks, 300);
      setTimeout(injectTawkTweaks, 800);
      if (typeof prevOnChatMaximized === 'function') prevOnChatMaximized();
    };
    /* eslint-enable @typescript-eslint/no-explicit-any */

    // Belt-and-suspenders: poll every 1.5s for the first 30s after consent,
    // in case Tawk inserts iframes outside the documented callbacks.
    const intervalId = window.setInterval(injectTawkTweaks, 1500);
    const stopId = window.setTimeout(() => window.clearInterval(intervalId), 30_000);

    return () => {
      window.clearInterval(intervalId);
      window.clearTimeout(stopId);
    };
  }, [consent, embedId]);

  if (!embedId || !consent) {
    return null;
  }

  return (
    <Script
      src={`https://embed.tawk.to/${embedId}`}
      strategy="afterInteractive"
      crossOrigin="anonymous"
    />
  );
}
