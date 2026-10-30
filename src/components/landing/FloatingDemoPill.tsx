'use client';

import { motion, useScroll, useTransform } from 'framer-motion';
import Link from 'next/link';
import { FiArrowRight, FiCalendar } from 'react-icons/fi';
import MagneticButton from './MagneticButton';

// Magnetic floating "Book a demo" pill. Hidden until the user has scrolled
// past the hero (~600px), then fades in at bottom-left. Pairs with the
// existing BackToTop button at bottom-right without colliding.
export default function FloatingDemoPill() {
  const { scrollY } = useScroll();
  const opacity = useTransform(scrollY, [400, 720], [0, 1]);
  const y = useTransform(scrollY, [400, 720], [40, 0]);
  const pointerEvents = useTransform(scrollY, (v) => (v > 500 ? 'auto' : 'none'));

  return (
    <motion.div
      style={{ opacity, y, pointerEvents }}
      className="fixed bottom-6 left-6 z-50 hidden md:block"
    >
      <MagneticButton strength={10}>
        <Link
          href="/contact"
          className="group inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-white/95 px-5 py-3 text-sm font-bold text-[#191919] shadow-2xl shadow-black/25 backdrop-blur-xl transition hover:scale-[1.04] hover:bg-[#f7f5f3] dark:border-white/10 dark:bg-[#1e1e1e]/90 dark:text-white dark:hover:bg-slate-800/95"
        >
          <FiCalendar size={14} className="text-[var(--foreground)]" />
          Book a demo
          <FiArrowRight size={12} className="transition-transform group-hover:translate-x-0.5" />
        </Link>
      </MagneticButton>
    </motion.div>
  );
}
