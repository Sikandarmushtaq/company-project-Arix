'use client';

import { useState } from 'react';
import { useReducedMotionPref } from './useReducedMotionPref';
import { FaWhatsapp } from 'react-icons/fa';
import {
  FiActivity,
  FiGlobe,
  FiLock,
  FiMessageSquare,
  FiMic,
  FiPhoneCall,
  FiShield,
  FiZap,
} from 'react-icons/fi';
import { HiSparkles } from 'react-icons/hi2';

interface Item {
  icon: React.ComponentType<{ size?: number }>;
  text: string;
  color: string;
}

const items: Item[] = [
  { icon: FiPhoneCall, text: 'Voice calls', color: 'text-[var(--foreground)]' },
  { icon: FaWhatsapp, text: 'WhatsApp Business', color: 'text-[#128c7e] dark:text-[#25D366]' },
  { icon: HiSparkles, text: 'AI auto-dialer', color: 'text-[#7c3aed] dark:text-[#a78bfa]' },
  { icon: FiMic, text: 'Compliance recording', color: 'text-[var(--accent-600)]' },
  { icon: FiMessageSquare, text: 'Bulk SIM SMS', color: 'text-amber-600 dark:text-amber-400' },
  { icon: FiZap, text: '<200ms call setup', color: 'text-[var(--foreground)]' },
  { icon: FiActivity, text: '99.9% uptime SLA', color: 'text-emerald-600' },
  { icon: FiGlobe, text: '1.5B+ WhatsApp users', color: 'text-[#128c7e] dark:text-[#25D366]' },
  { icon: FiShield, text: 'Multi-tenant isolation', color: 'text-[var(--foreground)]' },
  { icon: FiLock, text: 'TLS / SRTP encrypted', color: 'text-[var(--accent-600)]' },
  { icon: HiSparkles, text: 'Natural voice AI', color: 'text-[#7c3aed] dark:text-[#a78bfa]' },
];

const valueProps: Item[] = [
  { icon: FiZap, text: 'Spin up in days, not months', color: 'text-[var(--foreground)]' },
  { icon: FiShield, text: 'Built for revenue teams', color: 'text-[#7c3aed] dark:text-[#a78bfa]' },
  { icon: FiActivity, text: 'Live monitoring across channels', color: 'text-emerald-600' },
  { icon: FiGlobe, text: '180+ countries reachable', color: 'text-[#128c7e] dark:text-[#25D366]' },
  { icon: FiMic, text: 'Searchable transcripts', color: 'text-[var(--accent-600)]' },
  { icon: FiLock, text: 'Per-org tenancy isolation', color: 'text-[var(--foreground)]' },
  {
    icon: HiSparkles,
    text: 'Warm AI-to-human transfer',
    color: 'text-[#7c3aed] dark:text-[#a78bfa]',
  },
  {
    icon: FiMessageSquare,
    text: 'Real SIM-rate SMS sending',
    color: 'text-amber-600 dark:text-amber-400',
  },
];

function Track({
  list,
  duration,
  paused,
  reverse,
}: {
  list: Item[];
  duration: number;
  paused: boolean;
  reverse?: boolean;
}) {
  const stream = [...list, ...list];
  return (
    <div
      className="flex w-max gap-10 whitespace-nowrap"
      style={{
        animation: `${reverse ? 'nx-marquee-reverse' : 'nx-marquee'} ${duration}s linear infinite`,
        animationPlayState: paused ? 'paused' : 'running',
      }}
    >
      {stream.map((item, i) => {
        const Icon = item.icon;
        return (
          <span
            key={i}
            className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300"
          >
            <Icon size={14} />
            <span className={item.color}>{item.text}</span>
            <span className="text-slate-400 dark:text-slate-600">·</span>
          </span>
        );
      })}
    </div>
  );
}

export default function Marquee() {
  const [paused, setPaused] = useState(false);
  const reduced = useReducedMotionPref();
  // Stop the ticker entirely for motion-sensitive users; show a static row.
  const stopped = paused || reduced;

  return (
    <section
      aria-label="Capabilities ticker"
      onPointerEnter={() => setPaused(true)}
      onPointerLeave={() => setPaused(false)}
      className="relative overflow-hidden border-y border-slate-200/60 bg-white/40 py-5 backdrop-blur dark:border-white/5 dark:bg-[#121212]/30"
    >
      <style>
        {`@keyframes nx-marquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }
          @keyframes nx-marquee-reverse { from { transform: translateX(-50%); } to { transform: translateX(0); } }`}
      </style>

      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-24 bg-gradient-to-r from-white via-white/60 to-transparent dark:from-[#121212] dark:via-[#121212]/60" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-24 bg-gradient-to-l from-white via-white/60 to-transparent dark:from-[#121212] dark:via-[#121212]/60" />

      <Track list={items} duration={38} paused={stopped} />
      <div className="mt-4 opacity-70">
        <Track list={valueProps} duration={48} paused={stopped} reverse />
      </div>
    </section>
  );
}
