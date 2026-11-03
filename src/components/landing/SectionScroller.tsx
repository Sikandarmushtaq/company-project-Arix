
'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';
import {
  consumeProgrammaticNav,
  pathnameToSectionId,
} from '@/lib/landing/sections';

// Scrolls to the section selected by the current route or URL hash.
export default function SectionScroller() {
  const pathname = usePathname();
  const firstRun = useRef(true);

  useEffect(() => {
    const wasProgrammatic = consumeProgrammaticNav();
    const wasFirstRun = firstRun.current;

    firstRun.current = false;

    if (wasProgrammatic) return;

    const hashId = window.location.hash
      ? decodeURIComponent(window.location.hash.slice(1))
      : null;

    const targetId = hashId || pathnameToSectionId(pathname);

    if (!targetId) {
      if (pathname === '/' && !wasFirstRun) {
        window.scrollTo({
          top: 0,
          behavior: 'smooth',
        });
      }

      return;
    }

    let attempts = 0;
    let timer: ReturnType<typeof setTimeout>;

    const scrollToSection = () => {
      const element = document.getElementById(targetId);

      if (!element) return false;

      const top =
        element.getBoundingClientRect().top + window.scrollY - 80;

      window.scrollTo({
        top,
        behavior: 'smooth',
      });

      return true;
    };

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
