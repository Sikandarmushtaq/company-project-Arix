'use client';

import React, { useState, useEffect } from 'react';
import { FiClock } from 'react-icons/fi';

export function CountdownTimer({ windowEnd }: { windowEnd: string }) {
  const [remaining, setRemaining] = useState('');

  useEffect(() => {
    const update = () => {
      const end = new Date(windowEnd).getTime();
      const now = Date.now();
      const diff = end - now;

      if (diff <= 0) {
        setRemaining('Expired');
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setRemaining(
        `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
      );
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [windowEnd]);

  const isExpired = remaining === 'Expired';

  return (
    <span
      className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
        isExpired ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'
      }`}
    >
      <FiClock className="w-2.5 h-2.5" />
      {isExpired ? 'Closed' : remaining}
    </span>
  );
}
