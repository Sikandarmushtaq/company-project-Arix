'use client';

import Link from 'next/link';
import { FiArrowRight } from 'react-icons/fi';

export default function Hero() {
  return (
    <section className="relative isolate flex min-h-[100svh] items-center justify-center overflow-hidden bg-[#0C0A09]">
      {/* Background image — public/hero-film.png */}
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: "url('/hero3.jpg')" }}
      />

      {/* Dark scrim for text readability */}
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-gradient-to-b from-black/70 via-black/40 to-black/80"
      />

      <div className="mx-auto w-full max-w-7xl px-5 py-24 sm:px-8 sm:py-28 lg:px-10">
        <div className="mx-auto max-w-4xl text-center">
          <div className="inline-flex items-center rounded-full border border-white/25 bg-white/10 px-3.5 py-1.5 text-xs font-semibold tracking-wide text-white/85 backdrop-blur-md">
            BUSINESS CALLING, REIMAGINED
          </div>

          <h1 className="mt-6 text-4xl font-bold leading-[1.08] tracking-[-0.045em] text-white sm:text-5xl md:text-6xl lg:text-7xl">
            Make every
            <br />
            <span className="text-[var(--coral)]">conversation count.</span>
          </h1>

          <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-white/75 sm:text-lg sm:leading-8">
            Bring AI-powered dialing, cloud calling and live performance
            insights into one command center built for teams that move fast.
          </p>

          <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
            {/* Orange layer slides in from the left on hover */}
            <Link
              href="/signup/start"
              className="group relative inline-flex min-h-12 w-full items-center justify-center overflow-hidden rounded-full border border-[var(--coral)] px-7 py-3 text-sm font-semibold text-white sm:w-auto"
            >
              <span
                aria-hidden="true"
                className="absolute inset-0 -translate-x-full bg-[var(--coral)] transition-transform duration-300 ease-out group-hover:translate-x-0"
              />
              <span className="relative z-10 flex items-center gap-2">
                Start free trial
                <FiArrowRight size={17} />
              </span>
            </Link>

            <Link
              href="/how-it-works"
              scroll={false}
              className="group relative inline-flex min-h-12 w-full items-center justify-center overflow-hidden rounded-full border border-white/35 px-7 py-3 text-sm font-semibold text-white backdrop-blur-md transition-colors duration-300 hover:border-[var(--coral)] sm:w-auto"
            >
              <span
                aria-hidden="true"
                className="absolute inset-0 -translate-x-full bg-[var(--coral)] transition-transform duration-300 ease-out group-hover:translate-x-0"
              />
              <span className="relative z-10">Explore the platform</span>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}