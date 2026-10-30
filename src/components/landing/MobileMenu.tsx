'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { FiMenu, FiX } from 'react-icons/fi';
import { ArixMark, ArixWordmark } from '@/components/ui';
import { pathnameToSectionId } from '@/lib/landing/sections';

const links = [
  { href: '/features', label: 'Features' },
  { href: '/ai-dialer', label: 'AI Dialer' },
  { href: '/compare', label: 'Compare' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/faq', label: 'FAQ' },
  { href: '/about', label: 'About' },
  { href: '/contact', label: 'Contact' },
];

export default function MobileMenu() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  const closeMenu = () => setOpen(false);

  return (
    <>
      {/* Menu icon — no hover effect, always white so it stays visible on the dark hero */}
      <button
        type="button"
        aria-label={open ? 'Close menu' : 'Open menu'}
        aria-expanded={open}
        aria-controls="mobile-menu-drawer"
        className="inline-flex h-10 w-10 items-center justify-center rounded-full text-white"
        onClick={() => setOpen(!open)}
      >
        {open ? <FiX className="h-6 w-6" /> : <FiMenu className="h-6 w-6" />}
      </button>

      <div
        aria-hidden="true"
        onClick={closeMenu}
        className={`fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm transition-[opacity,visibility] duration-300 ${
          open ? 'visible opacity-100' : 'invisible opacity-0'
        }`}
      />

      <div
        id="mobile-menu-drawer"
        className={`fixed inset-y-0 left-0 z-[101] flex w-full flex-col overflow-y-auto bg-[var(--card)] px-6 pb-8 pt-5 shadow-2xl transition-[transform,visibility] duration-500 ease-out sm:px-10 ${
          open ? 'visible translate-x-0' : 'invisible -translate-x-full'
        }`}
      >
        <div className="flex h-12 shrink-0 items-center justify-between">
          <Link
            href="/"
            aria-label="ArixCall home"
            onClick={closeMenu}
            className="flex items-center gap-2.5"
          >
            <ArixMark size={34} />
            <ArixWordmark className="text-xl" />
          </Link>

          <button
            type="button"
            aria-label="Close menu"
            onClick={closeMenu}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full text-[var(--foreground)] transition-colors hover:bg-[var(--muted)]"
          >
            <FiX className="h-6 w-6" />
          </button>
        </div>

        <div className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center py-8">
          <nav aria-label="Mobile navigation" className="flex flex-col">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                scroll={pathnameToSectionId(link.href) ? false : undefined}
                onClick={closeMenu}
                className="border-b border-[var(--border)] py-3.5 text-2xl font-medium tracking-tight text-[var(--foreground)] transition-colors hover:text-[var(--primary-600)] sm:py-4 sm:text-3xl"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="mt-8 flex flex-col gap-3">
            <Link
              href="/login"
              onClick={closeMenu}
              className="flex min-h-12 items-center justify-center rounded-full border border-[var(--border)] px-6 py-3 text-sm font-semibold text-[var(--foreground)] transition-colors hover:bg-[var(--muted)]"
            >
              Sign in
            </Link>

            <Link
              href="/signup/start"
              onClick={closeMenu}
              className="flex min-h-12 items-center justify-center rounded-full bg-[var(--primary-600)] px-6 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[var(--primary-700)]"
            >
              Get Started
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}