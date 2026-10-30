'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { FiMoon, FiSun } from 'react-icons/fi';
import { useTheme } from './ThemeProvider';

export default function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      className="relative flex h-9 w-9 items-center justify-center rounded-full border border-slate-200/80 bg-white/60 text-slate-700 shadow-sm transition hover:border-transparent hover:bg-[var(--primary-600)]/10 hover:text-[var(--foreground)] dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10"
    >
      <AnimatePresence mode="wait" initial={false}>
        {isDark ? (
          <motion.span
            key="sun"
            initial={{ y: -10, opacity: 0, rotate: -90 }}
            animate={{ y: 0, opacity: 1, rotate: 0 }}
            exit={{ y: 10, opacity: 0, rotate: 90 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="inline-flex"
          >
            <FiSun size={16} />
          </motion.span>
        ) : (
          <motion.span
            key="moon"
            initial={{ y: -10, opacity: 0, rotate: 90 }}
            animate={{ y: 0, opacity: 1, rotate: 0 }}
            exit={{ y: 10, opacity: 0, rotate: -90 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="inline-flex"
          >
            <FiMoon size={16} />
          </motion.span>
        )}
      </AnimatePresence>
    </button>
  );
}
