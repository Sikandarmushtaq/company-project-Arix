'use client';

import React from 'react';
import Link from 'next/link';
import { FiTag, FiCalendar, FiHeadphones } from 'react-icons/fi';
import { ArixMark, ArixWordmark } from '@/components/ui';

const TRUST = [
  { icon: FiTag, title: 'No setup fees', desc: 'Get started in minutes' },
  { icon: FiCalendar, title: 'Cancel anytime', desc: 'No long-term contracts' },
  { icon: FiHeadphones, title: '24/7 Support', desc: "We're here to help" },
];
import SignupBackground from '@/components/signup/SignupBackground';

export default function SignupLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="signup-shell relative min-h-screen flex flex-col">
      <SignupBackground />

      <header className="sticky top-0 z-20 border-b border-[var(--border)]/60 bg-[var(--card)]/90 backdrop-blur-xl">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <Link href="/" className="flex items-center gap-2.5" aria-label="ArixCall home">
              <ArixMark size={32} />
              <ArixWordmark className="text-xl" />
            </Link>
            <div className="text-sm text-[var(--muted-foreground)]">
              <span className="hidden sm:inline">Already have an account? </span>
              <Link
                href="/login"
                className="font-semibold text-[var(--foreground)] hover:text-[var(--coral)] transition-colors"
              >
                Sign in
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
        {children}
      </main>

      <footer className="relative z-10 border-t border-[var(--border)]/60 py-6">
        <div className="mx-auto flex max-w-3xl flex-col items-center justify-center gap-6 px-4 sm:flex-row sm:gap-10 lg:px-8">
          {TRUST.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="flex items-center gap-2.5">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-[var(--coral)] ring-1 ring-[var(--coral)]/25">
                <Icon className="h-4 w-4" />
              </span>
              <div className="leading-tight">
                <p className="text-sm font-semibold text-[var(--foreground)]">{title}</p>
                <p className="text-xs text-[var(--muted-foreground)]">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </footer>
    </div>
  );
}
