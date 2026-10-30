'use client';

import { Component, type ReactNode } from 'react';
import Link from 'next/link';

interface State {
  error: Error | null;
}

// Minimal error boundary scoped to the marketing tree. If any descendant
// throws during render, we show a graceful fallback instead of a blank
// screen. Production should also forward `error` to Sentry — left as a TODO.
export default class MarketingErrorBoundary extends Component<
  { children: ReactNode },
  State
> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    // Sentry / observability hook would go here.
    // eslint-disable-next-line no-console
    console.error('[Marketing] render error:', error);
  }

  render() {
    if (this.state.error) {
      return (
        <main id="main-content" className="relative">
          <section className="py-32 sm:py-40">
            <div className="mx-auto max-w-2xl px-6 text-center lg:px-10">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[var(--foreground)]">
                Something broke
              </p>
              <h1 className="mt-3 text-4xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-5xl">
                We&rsquo;re working on it.
              </h1>
              <p className="mx-auto mt-5 max-w-lg text-base text-slate-600 dark:text-slate-300">
                Please refresh the page. If it keeps happening, drop us a line and we&rsquo;ll dig
                in.
              </p>
              <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className="rounded-full bg-[var(--primary-600)] px-7 py-3 text-sm font-bold text-white shadow-lg shadow-black/30 transition hover:scale-[1.03] hover:bg-[var(--primary-700)]"
                >
                  Reload page
                </button>
                <Link
                  href="/contact"
                  className="rounded-full border border-slate-200/80 bg-white/60 px-7 py-3 text-sm font-semibold text-slate-700 backdrop-blur transition hover:border-transparent hover:bg-[#f0ece8] dark:border-white/20 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10"
                >
                  Contact us
                </Link>
              </div>
            </div>
          </section>
        </main>
      );
    }
    return this.props.children;
  }
}
