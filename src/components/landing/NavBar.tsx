
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import {
  isLandingPath,
  markProgrammaticPath,
  sectionIdToHref,
} from '@/lib/landing/sections';
import MobileMenu from './MobileMenu';
import { ACTIVE_SECTION_EVENT } from './ScrollSpy';
import SignInMenu from './SignInMenu';

gsap.registerPlugin(useGSAP);

const sections = [
  { id: 'channels', label: 'Features', href: '/features' },
  { id: 'ai', label: 'AI Receptionist', href: '/ai-dialer' },
  { id: 'compare', label: 'Industries', href: '/compare' },
  { id: 'pricing', label: 'Pricing', href: '/pricing' },
  { id: 'legal', label: 'Legal & KYC', href: '/legal' },
  { id: 'faq', label: 'Support', href: '/faq' },
];

const pages = [
  { href: '/about', label: 'About' },
  { href: '/contact', label: 'Contact' },
];

export default function NavBar() {
  const [active, setActive] = useState<string | null>(null);
  const [isScrolled, setIsScrolled] = useState(false);

  const headerRef = useRef<HTMLElement>(null);
  const pathname = usePathname();
  const isLanding = isLandingPath(pathname);

  // Animates navbar elements and updates the header shadow on scroll.
  useGSAP(
    () => {
      const elements = gsap.utils.toArray<HTMLElement>(
        '[data-nav-animate]',
      );

      gsap.fromTo(
        elements,
        { y: -15, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.8,
          stagger: 0.08,
          ease: 'power3.out',
          clearProps: 'transform',
        },
      );

      const handleScroll = () => {
        const scrolled = window.scrollY > 5;

        setIsScrolled(scrolled);

        gsap.to(headerRef.current, {
          boxShadow: scrolled
            ? '0 8px 30px rgba(0, 0, 0, 0.35)'
            : '0 0 0 rgba(0, 0, 0, 0)',
          duration: 0.3,
          ease: 'power2.out',
          overwrite: true,
        });
      };

      window.addEventListener('scroll', handleScroll, {
        passive: true,
      });

      handleScroll();

      return () => {
        window.removeEventListener('scroll', handleScroll);
      };
    },
    { scope: headerRef },
  );

  // Tracks the currently active homepage section.
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

  // Scrolls to a homepage section and updates its URL.
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

      const href =
        sectionIdToHref(id) ?? (id === 'legal' ? '/#legal' : '/');

      if (window.location.pathname + window.location.hash !== href) {
        markProgrammaticPath();
      }

      window.history.replaceState(null, '', href);
    },
    [isLanding],
  );

  // Returns the user to the top of the homepage.
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

  // Checks whether a navigation page is currently active.
  const isPageActive = (href: string) => pathname === href;

  // Provides consistent styling for navigation links.
  const linkClass = (isActive: boolean) =>
    `relative whitespace-nowrap rounded-full px-1.5 py-2 text-[11px] font-bold transition-all duration-200 ${
      isActive
        ? 'bg-white/10 text-[#ff6a00]'
        : 'text-white hover:bg-white/10 hover:text-[#ff6a00]'
    }`;

  return (
    <>
      {!isLanding && <div aria-hidden="true" className="h-[72px]" />}

      <header
        ref={headerRef}
        className={`fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-[#121214] transition-colors duration-300 ${
          isScrolled ? 'bg-[#121214]/95 backdrop-blur-xl' : ''
        }`}
      >
        <div className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8">
          <div className="flex h-[72px] items-center justify-between gap-2">
            <Link
              data-nav-animate
              href="/"
              onClick={onLogoClick}
              aria-label="ArixCall home"
              className="flex shrink-0 items-center gap-1"
            >
              <img
                src="/arix-mark.png"
                alt="ArixCall"
                className="h-9 w-auto"
              />

              <span className="text-[15px] font-extrabold leading-none tracking-tight text-white">
                Arix<span className="text-[#ff4d00]">Call</span>
              </span>
            </Link>

            <nav
              aria-label="Primary navigation"
              className="hidden min-w-0 flex-1 items-center justify-center gap-0 lg:flex"
            >
              {sections.map((section) => {
                const isActive = active === section.id;

                return (
                  <Link
                    data-nav-animate
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
                    data-nav-animate
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

            <div className="flex shrink-0 items-center gap-2">
              <a
                data-nav-animate
                href="mailto:support@arixcall.com"
                className="hidden text-[11px] font-medium text-white/75 transition-colors hover:text-[#ff6a00] 2xl:block"
              >
                support@arixcall.com
              </a>

              <div data-nav-animate className="hidden lg:block">
                <SignInMenu />
              </div>

              <Link
                data-nav-animate
                href="/signup/start"
                className="hidden items-center justify-center whitespace-nowrap rounded-full bg-gradient-to-r from-[#ff7a00] via-[#ff3d00] to-[#e81e2b] px-3 py-2.5 text-[11px] font-extrabold text-white shadow-[0_8px_22px_rgba(255,77,0,0.25)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_10px_28px_rgba(255,77,0,0.35)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ff4d00] lg:inline-flex"
              >
                Start free trial
              </Link>

              <div data-nav-animate className="lg:hidden">
                <MobileMenu />
              </div>
            </div>
          </div>
        </div>
      </header>
    </>
  );
}
