
import React from 'react';
import Link from 'next/link';
import { FiTag, FiCalendar, FiHeadphones } from 'react-icons/fi';
import { ArixMark } from '@/components/ui';
import SignupBackground from '@/components/signup/SignupBackground';

const TRUST = [
  { icon: FiTag, title: 'No setup fees', desc: 'Get started in minutes' },
  { icon: FiCalendar, title: 'Cancel anytime', desc: 'No long-term contracts' },
  { icon: FiHeadphones, title: '24/7 Support', desc: "We're here to help" },
];

export default function SignupLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="signup-shell isolate relative flex min-h-screen flex-col bg-[#101011]">
      <SignupBackground />

      <header className="sticky top-0 z-20 border-b border-white/10 bg-[#121214]/95 backdrop-blur-xl">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <Link href="/" className="flex items-center gap-2.5" aria-label="ArixCall home">
              <ArixMark size={32} />
              <span className="text-xl font-extrabold tracking-tight">
                <span className="text-[#ff6a00]">Arix</span>
                <span className="text-white">Call</span>
              </span>
            </Link>

            <div className="text-sm text-[#a1a1aa]">
              <span className="hidden sm:inline">Already have an account? </span>
              <Link
                href="/login"
                className="font-semibold text-white transition-colors hover:text-[#ff7838]"
              >
                Sign in
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto w-full max-w-7xl flex-1 px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
        {children}
      </main>

      <footer className="relative z-10 border-t border-white/10 py-6">
        <div className="mx-auto flex max-w-3xl flex-col items-center justify-center gap-6 px-4 sm:flex-row sm:gap-10 lg:px-8">
          {TRUST.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="flex items-center gap-2.5">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#ff7838]/10 text-[#ff7838] ring-1 ring-[#ff7838]/25">
                <Icon className="h-4 w-4" />
              </span>
              <div className="leading-tight">
                <p className="text-sm font-semibold text-white">{title}</p>
                <p className="text-xs text-[#a1a1aa]">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </footer>
    </div>
  );
}
