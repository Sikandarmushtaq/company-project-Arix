'use client';

import { motion, useScroll, useSpring } from 'framer-motion';

export default function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 120, damping: 24, mass: 0.4 });

  return (
    <motion.div
      style={{ scaleX, transformOrigin: 'left' }}
      className="fixed left-0 right-0 top-0 z-[60] h-0.5 bg-gradient-to-r from-[var(--coral)] to-[var(--accent-600)]"
      aria-hidden="true"
    />
  );
}
