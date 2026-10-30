'use client';

import { motion, useScroll, useSpring, useTransform } from 'framer-motion';
import { FiArrowUp } from 'react-icons/fi';

const RADIUS = 22;
const CIRC = 2 * Math.PI * RADIUS;

export default function BackToTop() {
  const { scrollYProgress } = useScroll();
  const dash = useTransform(scrollYProgress, (v) => CIRC * (1 - v));
  const dashSpring = useSpring(dash, { stiffness: 100, damping: 24, mass: 0.4 });
  const opacity = useTransform(scrollYProgress, [0, 0.05, 0.1], [0, 0.5, 1]);
  const scale = useTransform(scrollYProgress, [0, 0.05, 0.1], [0.6, 0.85, 1]);

  return (
    <motion.button
      type="button"
      aria-label="Back to top"
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      style={{ opacity, scale }}
      whileHover={{ scale: 1.08 }}
      whileTap={{ scale: 0.92 }}
      className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full border border-white/40 bg-white/80 shadow-2xl shadow-black/20 backdrop-blur-xl transition dark:border-white/10 dark:bg-[#1e1e1e]/80"
    >
      <svg
        viewBox="0 0 50 50"
        className="absolute inset-0 h-full w-full -rotate-90"
        aria-hidden="true"
      >
        <circle
          cx="25"
          cy="25"
          r={RADIUS}
          fill="none"
          stroke="currentColor"
          className="text-slate-200/60 dark:text-white/10"
          strokeWidth="2"
        />
        <motion.circle
          cx="25"
          cy="25"
          r={RADIUS}
          fill="none"
          stroke="url(#backToTopGrad)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray={CIRC}
          style={{ strokeDashoffset: dashSpring }}
        />
        <defs>
          <linearGradient id="backToTopGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="rgb(59,130,246)" />
            <stop offset="50%" stopColor="rgb(37,211,102)" />
            <stop offset="100%" stopColor="rgb(139,92,246)" />
          </linearGradient>
        </defs>
      </svg>
      <FiArrowUp className="relative text-slate-700 dark:text-white" size={18} />
    </motion.button>
  );
}
