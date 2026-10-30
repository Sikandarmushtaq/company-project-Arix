'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { consumeProgrammaticNav, pathnameToSectionId } from '@/lib/landing/sections';

/**
 * Scrolls the landing page to the section that matches the current URL path.
 *
 * Covers both entry paths:
 *   - Direct load / refresh on `/pricing` (rewritten to the landing route).
 *   - Client-side navigation to a section path (NavBar cross-page, mobile menu,
 *     footer) — it re-runs whenever the Next.js pathname changes.
 *
 * ScrollSpy handles the reverse (scroll → URL) via `history.replaceState`, which
 * does NOT change the Next pathname — so these two never feed back into a loop.
 *
 * Retries a few times because framer-motion's `whileInView` observers attach
 * after first paint and section heights settle as fonts/images finish loading,
 * so a single early scroll can land short.
 *
 * @module components/landing/SectionScroller
 */
export default function SectionScroller() {
  const pathname = usePathname();
  const firstRun = useRef(true);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Consume the "our own write" flag on EVERY pathname change (before any
    // early return, so it can never go stale). ScrollSpy and NavBar's in-page
    // scroll set it; genuine navigations (direct load, cross-page, plain link)
    // do not — so only those actually scroll.
    const wasProgrammatic = consumeProgrammaticNav();
    const wasFirstRun = firstRun.current;
    firstRun.current = false;

    if (wasProgrammatic) return; // our own URL write — the page is already where it should be

    const targetId = pathnameToSectionId(pathname);
    if (!targetId) {
      // Genuine navigation to "/" (e.g. clicking the logo while on /pricing) →
      // return to the top. Skipped on the initial run so we don't override the
      // load / browser-restored scroll position.
      if (pathname === '/' && !wasFirstRun) {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
      return;
    }

    const scrollToSection = () => {
      const el = document.getElementById(targetId);
      if (!el) return false;
      const top = el.getBoundingClientRect().top + window.scrollY - 80;
      window.scrollTo({ top, behavior: 'smooth' });
      return true;
    };

    let attempts = 0;
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      if (scrollToSection() || attempts >= 5) return;
      attempts += 1;
      timer = setTimeout(tick, 200);
    };
    timer = setTimeout(tick, 100);

    return () => clearTimeout(timer);
  }, [pathname]);

  return null;
}
