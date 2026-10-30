'use client';

import React, { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

/**
 * Ambient mesh backdrop for the signup flow — three slowly drifting brand-tinted
 * blobs over a soft gradient canvas. Same visual language as /login's
 * MeshBackground so signup feels like part of the same premium product. Fixed,
 * behind everything, and non-interactive.
 *
 * Performance: large blurred elements are expensive to repaint continuously, so
 * the drift is throttled to keep typing smooth on modest devices —
 *  1) blobs are a touch smaller + `blur-2xl` (cheaper compositing) than before;
 *  2) users with `prefers-reduced-motion` get a fully static backdrop;
 *  3) the animation PAUSES (eases to rest) whenever a form field is focused, so
 *     it never competes with keystroke re-renders while someone is typing.
 */
export default function SignupBackground() {
  const reduceMotion = useReducedMotion();
  const [fieldFocused, setFieldFocused] = useState(false);

  useEffect(() => {
    const isField = (el: EventTarget | null) =>
      el instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName);
    const onIn = (e: FocusEvent) => {
      if (isField(e.target)) setFieldFocused(true);
    };
    const onOut = (e: FocusEvent) => {
      if (isField(e.target)) setFieldFocused(false);
    };
    document.addEventListener('focusin', onIn);
    document.addEventListener('focusout', onOut);
    return () => {
      document.removeEventListener('focusin', onIn);
      document.removeEventListener('focusout', onOut);
    };
  }, []);

  const animate = !reduceMotion && !fieldFocused;

  // While paused/reduced, ease each blob back to its rest position (no repeat) so
  // there's no repaint churn; otherwise run the slow infinite drift.
  const rest = { x: 0, y: 0, scale: 1 };
  const drift = (
    a: { x: number[]; y: number[]; scale: number[] },
    duration: number
  ) =>
    animate
      ? { animate: a, transition: { duration, repeat: Infinity, ease: 'easeInOut' as const } }
      : { animate: rest, transition: { duration: 0.6, ease: 'easeOut' as const } };

  return (
    <div
      aria-hidden="true"
      /* Always the light-mode gradient — the signup flow forces light mode
         (see .signup-shell in globals.css), so no dark: variant here. */
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-gradient-to-br from-[#f6f4f2] via-[#fffdfc] to-[#f0ece8]"
    >
      <motion.div
        className="absolute -top-40 -left-40 h-[34rem] w-[34rem] rounded-full bg-[radial-gradient(circle,_rgba(255,101,66,0.30),_rgba(255,101,66,0)_70%)] blur-2xl"
        {...drift({ x: [0, 80, -40, 0], y: [0, -60, 40, 0], scale: [1, 1.1, 0.95, 1] }, 26)}
      />
      <motion.div
        className="absolute top-1/3 -right-40 h-[30rem] w-[30rem] rounded-full bg-[radial-gradient(circle,_rgba(255,181,71,0.26),_rgba(255,181,71,0)_70%)] blur-2xl"
        {...drift({ x: [0, -100, 50, 0], y: [0, 80, -50, 0], scale: [1, 1.15, 0.92, 1] }, 30)}
      />
      <motion.div
        className="absolute -bottom-40 left-1/4 h-[32rem] w-[32rem] rounded-full bg-[radial-gradient(circle,_rgba(229,72,31,0.22),_rgba(229,72,31,0)_70%)] blur-2xl"
        {...drift({ x: [0, 60, -80, 0], y: [0, -40, 60, 0], scale: [1, 1.08, 1.05, 1] }, 34)}
      />
    </div>
  );
}
