'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import {
  isLandingPath,
  markProgrammaticPath,
  sectionIdToHref,
} from '@/lib/landing/sections';
import MobileMenu from './MobileMenu';
import { ACTIVE_SECTION_EVENT } from './ScrollSpy';
import SignInMenu from './SignInMenu';

const sections = [
  { id: 'channels', label: 'Features', href: '/features' },
  { id: 'ai', label: 'AI Dialer', href: '/ai-dialer' },
  { id: 'compare', label: 'Compare', href: '/compare' },
  { id: 'pricing', label: 'Pricing', href: '/pricing' },
  { id: 'faq', label: 'FAQ', href: '/faq' },
];

const pages = [
  { href: '/about', label: 'About' },
  { href: '/contact', label: 'Contact' },
];

export default function NavBar() {
  const [active, setActive] = useState<string | null>(null);
  const [isScrolled, setIsScrolled] = useState(false);

  const pathname = usePathname();
  const isLanding = isLandingPath(pathname);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 5);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();

    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (!isLanding) {
      setActive(null);
      return;
    }

    const handleSection = (event: Event) => {
      const id = (event as CustomEvent<string>).detail;
      setActive(id || null);
    };

    window.addEventListener(ACTIVE_SECTION_EVENT, handleSection);

    return () => {
      window.removeEventListener(ACTIVE_SECTION_EVENT, handleSection);
    };
  }, [isLanding]);

  const onJump = useCallback(
    (event: React.MouseEvent<HTMLAnchorElement>, id: string) => {
      if (!isLanding) return;

      const element = document.getElementById(id);
      if (!element) return;

      event.preventDefault();

      const top =
        element.getBoundingClientRect().top + window.scrollY - 80;

      window.scrollTo({
        top,
        behavior: 'smooth',
      });

      const href = sectionIdToHref(id) ?? '/';

      if (window.location.pathname !== href) {
        markProgrammaticPath();
      }

      window.history.replaceState(null, '', href);
    },
    [isLanding],
  );

  const onLogoClick = useCallback(
    (event: React.MouseEvent<HTMLAnchorElement>) => {
      if (!isLanding) return;

      event.preventDefault();

      window.scrollTo({
        top: 0,
        behavior: 'smooth',
      });

      if (window.location.pathname !== '/') {
        markProgrammaticPath();
      }

      window.history.replaceState(null, '', '/');
    },
    [isLanding],
  );

  const isPageActive = (href: string) => pathname === href;

  const linkClass = (isActive: boolean) =>
    `relative whitespace-nowrap rounded-full px-2.5 py-2 text-sm font-medium transition-colors duration-200 ${
      isActive
        ? 'bg-[var(--muted)] text-[var(--foreground)]'
        : 'text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)]'
    }`;

  return (
    <>
      {/* Non-landing pages: spacer so content never hides under the fixed navbar */}
      {!isLanding && <div aria-hidden="true" className="h-[72px]" />}

      <header
        className={`fixed inset-x-0 top-0 z-50 transition-[background-color,box-shadow,backdrop-filter] duration-300 ${
          isScrolled
            ? 'bg-[var(--card)]/95 shadow-sm backdrop-blur-xl'
            : 'bg-transparent shadow-none backdrop-blur-none'
        }`}
      >
        <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
          <div className="flex h-[72px] items-center justify-between gap-3">
            {/* Logo and ArixCall name side by side, tight spacing */}
            <Link
              href="/"
              onClick={onLogoClick}
              aria-label="ArixCall home"
              className="flex shrink-0 items-center gap-[2px]"
            >
              <img
                src="/arix-mark.png"
                alt="ArixCall"
                className="h-10 w-auto"
              />
              {/* Not scrolled: "Arix" white + "Call" orange — scrolled: whole name orange */}
              <span
                className={`text-sm font-bold leading-none tracking-tight transition-colors duration-300 ${
                  isScrolled ? 'text-[var(--coral)]' : 'text-white'
                }`}
              >
                Arix<span className="text-[var(--coral)]">Call</span>
              </span>
            </Link>

            <nav
              aria-label="Primary navigation"
              className="hidden items-center gap-0.5 lg:flex"
            >
              {sections.map((section) => {
                const isActive = active === section.id;

                return (
                  <Link
                    key={section.id}
                    href={section.href}
                    scroll={false}
                    onClick={(event) => onJump(event, section.id)}
                    aria-current={isActive ? 'location' : undefined}
                    className={linkClass(isActive)}
                  >
                    {section.label}
                  </Link>
                );
              })}

              {pages.map((page) => {
                const isActive = isPageActive(page.href);

                return (
                  <Link
                    key={page.href}
                    href={page.href}
                    aria-current={isActive ? 'page' : undefined}
                    className={linkClass(isActive)}
                  >
                    {page.label}
                  </Link>
                );
              })}
            </nav>

            <div className="flex shrink-0 items-center gap-2 sm:gap-3">
              <div className="hidden lg:block">
                <SignInMenu />
              </div>

              <Link
                href="/signup/start"
                className="hidden items-center justify-center rounded-full bg-[#17120e] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors duration-200 hover:bg-[var(--coral)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)] lg:inline-flex"
              >
                Get Started
              </Link>

              <div className="lg:hidden">
                <MobileMenu />
              </div>
            </div>
          </div>
        </div>
      </header>
    </>
  );
}