'use client';

import { motion } from 'framer-motion';
import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useReducedMotionPref } from './useReducedMotionPref';

interface Particle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  rotation: number;
}

interface ConfettiContextValue {
  fire: (x: number, y: number, count?: number) => void;
}

const ConfettiContext = createContext<ConfettiContextValue>({ fire: () => {} });

export function useConfetti() {
  return useContext(ConfettiContext);
}

const colors = [
  'rgb(59,130,246)',  // blue (SIP)
  'rgb(37,211,102)',  // green (WhatsApp)
  'rgb(139,92,246)',  // violet (AI)
  'rgb(245,158,11)',  // amber (SMS)
  'rgb(20,184,166)',  // teal (Recording)
  'rgb(255,255,255)', // white
];

const LIFETIME_MS = 1100;

// Wraps the marketing layout. Renders a fixed-position particle layer and
// exposes a `fire(x, y)` function via context. Any descendant CTA can call
// useConfetti().fire(e.clientX, e.clientY) to burst particles at the click.
export function ConfettiProvider({ children }: { children: ReactNode }) {
  const [particles, setParticles] = useState<Particle[]>([]);
  const idRef = useRef(0);
  const reduced = useReducedMotionPref();

  const fire = useCallback((x: number, y: number, count = 22) => {
    if (reduced) return; // respect prefers-reduced-motion
    const fresh: Particle[] = [];
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.6;
      const speed = 110 + Math.random() * 130;
      fresh.push({
        id: ++idRef.current,
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 80, // upward bias
        size: 6 + Math.random() * 6,
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * 360,
      });
    }
    setParticles((prev) => [...prev, ...fresh]);
    const ids = new Set(fresh.map((p) => p.id));
    window.setTimeout(() => {
      setParticles((prev) => prev.filter((p) => !ids.has(p.id)));
    }, LIFETIME_MS);
  }, [reduced]);

  return (
    <ConfettiContext.Provider value={{ fire }}>
      {children}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-[70] overflow-hidden"
      >
        {particles.map((p) => (
          <motion.span
            key={p.id}
            initial={{ x: p.x, y: p.y, opacity: 1, scale: 1, rotate: p.rotation }}
            animate={{
              x: p.x + p.vx,
              y: p.y + p.vy + 280, // gravity pull
              opacity: 0,
              scale: 0.4,
              rotate: p.rotation + 240,
            }}
            transition={{ duration: LIFETIME_MS / 1000, ease: [0.22, 0.6, 0.36, 1] }}
            style={{
              position: 'fixed',
              left: 0,
              top: 0,
              width: p.size,
              height: p.size,
              backgroundColor: p.color,
              borderRadius: '2px',
              translateX: '-50%',
              translateY: '-50%',
            }}
          />
        ))}
      </div>
    </ConfettiContext.Provider>
  );
}
