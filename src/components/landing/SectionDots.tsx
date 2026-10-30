'use client';

import { motion } from 'framer-motion';
import { useCallback, useEffect, useState } from 'react';

const dots = [
  { id: 'channels', label: 'Channels' },
  { id: 'whatsapp', label: 'WhatsApp' },
  { id: 'ai',       label: 'AI Dialer' },
  { id: 'compare',  label: 'Compare' },
  { id: 'pricing',  label: 'Pricing' },
  { id: 'faq',      label: 'FAQ' },
];

// Vertical dot-strip on the right edge of the viewport. Each dot maps to a
// landing section. The active dot brightens + scales when its section is in
// view; clicking jumps to that section. Hidden on tablet and below.
export default function SectionDots() {
  const [active, setActive] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Only mount the observer if at least one section exists on the page
    const els = dots
      .map((d) => document.getElementById(d.id))
      .filter((el): el is HTMLElement => el !== null);
    if (els.length === 0) return;

    setVisible(true);

    const observer = new IntersectionObserver(
      (entries) => {
        const inView = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (inView.length > 0) {
          setActive(inView[0].target.id);
        }
      },
      { rootMargin: '-40% 0px -50% 0px', threshold: [0, 0.25, 0.5, 0.75, 1] }
    );
    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  const onJump = useCallback((id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY - 80;
    window.scrollTo({ top, behavior: 'smooth' });
  }, []);

  if (!visible) return null;

  return (
    <nav
      aria-label="Section navigation"
      className="fixed right-4 top-1/2 z-40 hidden -translate-y-1/2 flex-col gap-3 lg:flex"
    >
      {dots.map((d) => {
        const isActive = active === d.id;
        return (
          <button
            key={d.id}
            type="button"
            onClick={() => onJump(d.id)}
            aria-label={`Jump to ${d.label}`}
            className="group flex items-center justify-end gap-2"
          >
            <span
              className={`whitespace-nowrap text-xs font-medium opacity-0 transition group-hover:opacity-100 ${
                isActive ? 'text-[var(--foreground)]' : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              {d.label}
            </span>
            <motion.span
              animate={{
                scale: isActive ? 1.4 : 1,
                backgroundColor: isActive ? 'rgb(59,130,246)' : 'rgb(148,163,184)',
              }}
              transition={{ type: 'spring', stiffness: 320, damping: 24 }}
              className="block h-2 w-2 rounded-full"
            />
          </button>
        );
      })}
    </nav>
  );
}
