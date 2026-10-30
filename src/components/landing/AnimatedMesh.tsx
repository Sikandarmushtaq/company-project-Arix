'use client';

import { motion } from 'framer-motion';

// Slow, multi-color gradient mesh that lives behind the whole landing page.
// Pointer-events disabled so it never blocks interactions. Three blobs that
// drift on independent timelines so the composition never repeats.
export default function AnimatedMesh() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-gradient-to-br from-[#f6f4f2] via-[#fffdfc] to-[#f0ece8] dark:from-[#121212] dark:via-[#121212] dark:to-black"
    >
      <motion.div
        className="absolute -top-40 -left-40 h-[42rem] w-[42rem] rounded-full bg-[radial-gradient(circle,_rgba(255,101,66,0.42),_rgba(255,101,66,0)_70%)] blur-3xl"
        animate={{ x: [0, 80, -40, 0], y: [0, -60, 40, 0], scale: [1, 1.15, 0.95, 1] }}
        transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute top-1/3 -right-40 h-[36rem] w-[36rem] rounded-full bg-[radial-gradient(circle,_rgba(255,181,71,0.38),_rgba(255,181,71,0)_70%)] blur-3xl"
        animate={{ x: [0, -100, 50, 0], y: [0, 80, -50, 0], scale: [1, 1.2, 0.9, 1] }}
        transition={{ duration: 26, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute -bottom-40 left-1/4 h-[40rem] w-[40rem] rounded-full bg-[radial-gradient(circle,_rgba(229,72,31,0.34),_rgba(229,72,31,0)_70%)] blur-3xl"
        animate={{ x: [0, 60, -80, 0], y: [0, -40, 60, 0], scale: [1, 1.1, 1.05, 1] }}
        transition={{ duration: 30, repeat: Infinity, ease: 'easeInOut' }}
      />
    </div>
  );
}
