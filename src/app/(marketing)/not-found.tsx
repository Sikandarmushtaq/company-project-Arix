import type { Metadata } from 'next';
import Link from 'next/link';
import { FiArrowLeft, FiHome } from 'react-icons/fi';

export const metadata: Metadata = {
  title: 'Page not found — ArixCall',
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <main id="main-content" className="relative">
      <section className="relative py-32 sm:py-40">
        <div className="mx-auto max-w-3xl px-6 text-center lg:px-10">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[var(--foreground)]">
            404
          </p>
          <h1 className="mt-3 bg-gradient-to-r from-[var(--coral)] to-[var(--accent-600)] bg-clip-text text-7xl font-black tracking-tight text-transparent sm:text-8xl lg:text-[10rem]">
            Off the grid.
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-slate-600 dark:text-slate-300">
            The page you were looking for isn&rsquo;t here. Maybe it never was, maybe it moved. Either
            way, the dialer is still humming — pick a channel and head back.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/"
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[var(--primary-600)] px-7 py-3.5 text-sm font-bold text-white shadow-lg shadow-black/30 transition hover:scale-[1.03] hover:bg-[var(--primary-700)] sm:w-auto"
            >
              <FiHome size={14} />
              Back to home
            </Link>
            <Link
              href="/contact"
              className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-slate-200/80 bg-white/60 px-7 py-3.5 text-sm font-semibold text-slate-700 backdrop-blur transition hover:border-transparent hover:bg-[#f0ece8] dark:border-white/20 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10 sm:w-auto"
            >
              <FiArrowLeft size={14} />
              Tell us what you wanted
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
