
'use client';

import React, { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

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
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-gradient-to-br from-[#101011] via-[#141416] to-[#101011]"
    >
      <motion.div
        className="absolute -top-40 -left-40 h-[34rem] w-[34rem] rounded-full bg-[radial-gradient(circle,_rgba(255,101,0,0.20),_rgba(255,101,0,0)_70%)] blur-2xl"
        {...drift({ x: [0, 80, -40, 0], y: [0, -60, 40, 0], scale: [1, 1.1, 0.95, 1] }, 26)}
      />

      <motion.div
        className="absolute top-1/3 -right-40 h-[30rem] w-[30rem] rounded-full bg-[radial-gradient(circle,_rgba(255,77,0,0.17),_rgba(255,77,0,0)_70%)] blur-2xl"
        {...drift({ x: [0, -100, 50, 0], y: [0, 80, -50, 0], scale: [1, 1.15, 0.92, 1] }, 30)}
      />

      <motion.div
        className="absolute -bottom-40 left-1/4 h-[32rem] w-[32rem] rounded-full bg-[radial-gradient(circle,_rgba(232,30,43,0.15),_rgba(232,30,43,0)_70%)] blur-2xl"
        {...drift({ x: [0, 60, -80, 0], y: [0, -40, 60, 0], scale: [1, 1.08, 1.05, 1] }, 34)}
      />
    </div>
  );
}
