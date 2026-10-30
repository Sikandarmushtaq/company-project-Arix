'use client';

import { useEffect, useState } from 'react';

// Subscribes to (prefers-reduced-motion: reduce) and returns the current
// boolean. Useful for non-framer animations (setInterval-driven, raw CSS,
// canvas) that don't get covered by framer-motion's <MotionConfig
// reducedMotion="user">.
export function useReducedMotionPref(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  return reduced;
}
