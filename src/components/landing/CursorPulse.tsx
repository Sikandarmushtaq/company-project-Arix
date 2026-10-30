'use client';

import { AnimatePresence, motion, useMotionValue, useSpring } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { useReducedMotionPref } from './useReducedMotionPref';

// Cursor as broadcaster. A small bright nucleus at the cursor + expanding
// pulse rings emitted at a steady cadence. Each pulse drops at the cursor's
// position at spawn time, then expands and fades — so when you stop, the
// rings overlap concentrically (like sonar from a still source); when you
// move, they trail behind you in a wake (like signals dropped at each step).
//
// Colours cycle through the four channels (blue / green / violet / teal).

interface Pulse {
  id: number;
  x: number;
  y: number;
  color: string;
  glow: string;
  t: number;
}

const palette = [
  { color: 'rgba(255,101,66,0.85)',  glow: 'rgba(255,101,66,0.45)' },   // SIP blue
  { color: 'rgba(255,181,71,0.85)',  glow: 'rgba(255,181,71,0.45)' },   // WhatsApp green
  { color: 'rgba(229,72,31,0.85)',  glow: 'rgba(229,72,31,0.45)' },   // AI violet
  { color: 'rgba(245,158,11,0.85)',  glow: 'rgba(245,158,11,0.45)' },   // SMS amber
  { color: 'rgba(20,184,166,0.85)',  glow: 'rgba(20,184,166,0.45)' },   // Recording teal
];

const SPAWN_MS = 520;
const LIFETIME_MS = 2400;
const RING_SIZE = 110;

export default function CursorPulse() {
  const [pulses, setPulses] = useState<Pulse[]>([]);
  const reduced = useReducedMotionPref();

  // Cursor follower (smooth nucleus)
  const x = useMotionValue(-200);
  const y = useMotionValue(-200);
  const sx = useSpring(x, { stiffness: 420, damping: 32, mass: 0.4 });
  const sy = useSpring(y, { stiffness: 420, damping: 32, mass: 0.4 });

  // Live cursor position (raw, for spawning at current point)
  const cursorPos = useRef({ x: -200, y: -200 });
  const colorIdx = useRef(0);
  const idRef = useRef(0);

  useEffect(() => {
    const fine = window.matchMedia('(pointer: fine)').matches;
    if (!fine) return;
    const onMove = (e: PointerEvent) => {
      cursorPos.current = { x: e.clientX, y: e.clientY };
      x.set(e.clientX);
      y.set(e.clientY);
    };
    window.addEventListener('pointermove', onMove);
    return () => window.removeEventListener('pointermove', onMove);
  }, [x, y]);

  useEffect(() => {
    if (reduced) return;
    const fine = window.matchMedia('(pointer: fine)').matches;
    if (!fine) return;
    const interval = setInterval(() => {
      const now = Date.now();
      const palette_entry = palette[colorIdx.current % palette.length];
      colorIdx.current += 1;
      setPulses((prev) => {
        const next: Pulse = {
          id: ++idRef.current,
          x: cursorPos.current.x,
          y: cursorPos.current.y,
          color: palette_entry.color,
          glow: palette_entry.glow,
          t: now,
        };
        // Drop expired pulses
        const fresh = prev.filter((p) => now - p.t < LIFETIME_MS);
        return [...fresh, next];
      });
    }, SPAWN_MS);
    return () => clearInterval(interval);
  }, [reduced]);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-[55] hidden overflow-hidden md:block"
    >
      <AnimatePresence initial={false}>
        {pulses.map((p) => (
          <motion.div
            key={p.id}
            initial={{ scale: 0, opacity: 0.85 }}
            animate={{ scale: 1, opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: LIFETIME_MS / 1000, ease: [0.22, 1, 0.36, 1] }}
            style={{
              position: 'absolute',
              left: p.x,
              top: p.y,
              width: RING_SIZE,
              height: RING_SIZE,
              marginLeft: -RING_SIZE / 2,
              marginTop: -RING_SIZE / 2,
              borderRadius: '50%',
              border: `2px solid ${p.color}`,
              boxShadow: `0 0 24px ${p.glow}, inset 0 0 16px ${p.glow}`,
            }}
          />
        ))}
      </AnimatePresence>

      {/* Cursor nucleus — small bright dot tracking the cursor */}
      <motion.div style={{ x: sx, y: sy }} className="absolute left-0 top-0">
        <div className="h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#1e1e1e] shadow-[0_0_18px_5px_rgba(15,23,42,0.4)] dark:bg-white dark:shadow-[0_0_18px_5px_rgba(255,255,255,0.55)]" />
      </motion.div>
    </div>
  );
}
