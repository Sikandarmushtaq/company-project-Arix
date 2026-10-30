'use client';

import { motion, useInView } from 'framer-motion';
import { useRef } from 'react';

// Thin gradient line that draws across the viewport when scrolled into view.
// Place between major sections to give the long page a sense of composition.
export default function SectionDivider() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-50px' });

  return (
    <div
      ref={ref}
      aria-hidden="true"
      className="relative mx-auto flex max-w-7xl items-center justify-center px-6 py-2 lg:px-10"
    >
      <svg
        width="100%"
        height="2"
        viewBox="0 0 1000 2"
        preserveAspectRatio="none"
        className="overflow-visible"
      >
        <motion.line
          x1="0"
          y1="1"
          x2="1000"
          y2="1"
          stroke="url(#section-divider-gradient)"
          strokeWidth="1.5"
          strokeLinecap="round"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={inView ? { pathLength: 1, opacity: 1 } : {}}
          transition={{ duration: 1.4, ease: [0.22, 1, 0.36, 1] }}
        />
        <defs>
          <linearGradient id="section-divider-gradient" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="rgb(59,130,246)" stopOpacity="0" />
            <stop offset="35%" stopColor="rgb(37,211,102)" stopOpacity="0.45" />
            <stop offset="65%" stopColor="rgb(139,92,246)" stopOpacity="0.45" />
            <stop offset="100%" stopColor="rgb(245,158,11)" stopOpacity="0" />
          </linearGradient>
        </defs>
      </svg>
      <motion.span
        initial={{ scale: 0, opacity: 0 }}
        animate={inView ? { scale: 1, opacity: 1 } : {}}
        transition={{ duration: 0.6, delay: 1.0 }}
        className="absolute inset-x-0 mx-auto h-1.5 w-1.5 rounded-full bg-gradient-to-br from-[var(--primary-600)] to-[var(--accent-500)] shadow-[0_0_12px_2px_rgba(255,101,66,0.5)]"
      />
    </div>
  );
}
