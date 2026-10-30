'use client';

import { AnimatePresence, motion } from 'framer-motion';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { FiX } from 'react-icons/fi';

const STORAGE_KEY = 'nuxcall:analytics-consent';
const EVENT_KEY = 'nuxcall:consent-changed';

// First-visit cookie consent banner. Writes the analytics-consent flag that
// TawkScript reads (granted | denied), then dispatches the change event so
// TawkScript can mount/unmount in response without a page reload.
export default function ConsentBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      const existing = window.localStorage.getItem(STORAGE_KEY);
      if (!existing) setShow(true);
    } catch {
      // sandbox / private mode — don't show banner if storage unavailable
    }
  }, []);

  const decide = (choice: 'granted' | 'denied') => {
    try {
      window.localStorage.setItem(STORAGE_KEY, choice);
      window.dispatchEvent(new Event(EVENT_KEY));
    } catch {
      // ignore
    }
    setShow(false);
  };

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="fixed bottom-4 left-4 right-4 z-[60] mx-auto max-w-md rounded-2xl border border-slate-200/80 bg-white/95 p-5 shadow-2xl shadow-black/15 backdrop-blur-xl dark:border-white/10 dark:bg-[#1e1e1e]/95 sm:bottom-6 sm:left-auto sm:right-6 sm:mx-0"
          role="dialog"
          aria-label="Cookie consent"
        >
          <button
            type="button"
            onClick={() => decide('denied')}
            aria-label="Decline and dismiss"
            className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full text-slate-400 transition hover:bg-[#f0ece8] hover:text-slate-700 dark:hover:bg-white/10 dark:hover:text-white"
          >
            <FiX size={14} />
          </button>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            Cookies &amp; chat support
          </h3>
          <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
            We use a single live-chat widget to talk to visitors. Accepting loads it and lets it
            store its own session cookies. Decline and the widget never loads — the rest of the
            site works the same.{' '}
            <Link href="/privacy" className="font-semibold text-[var(--foreground)] hover:underline">
              Read more
            </Link>
            .
          </p>
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={() => decide('granted')}
              className="flex-1 rounded-full bg-[var(--primary-600)] px-4 py-2 text-xs font-bold text-white shadow-md transition hover:scale-[1.02] hover:bg-[var(--primary-700)]"
            >
              Accept
            </button>
            <button
              type="button"
              onClick={() => decide('denied')}
              className="flex-1 rounded-full border border-slate-200/80 bg-white/60 px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-[#f0ece8] dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10"
            >
              Decline
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
