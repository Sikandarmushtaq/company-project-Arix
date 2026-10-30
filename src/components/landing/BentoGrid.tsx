'use client';

import { motion } from 'framer-motion';
import { FaWhatsapp } from 'react-icons/fa';
import { FiActivity, FiGlobe, FiLayers, FiLock, FiPhoneCall, FiSearch } from 'react-icons/fi';
import { HiSparkles } from 'react-icons/hi2';
import TiltCard from './TiltCard';

function MiniBars() {
  const bars = [40, 65, 30, 80, 55, 90, 45, 70, 60, 85, 50, 75, 35, 95, 60];
  return (
    <div className="mt-5 flex h-24 items-end gap-1">
      {bars.map((h, i) => (
        <motion.span
          key={i}
          initial={{ scaleY: 0 }}
          whileInView={{ scaleY: 1 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.8, delay: i * 0.04, ease: 'easeOut' }}
          style={{ height: `${h}%`, transformOrigin: 'bottom' }}
          className="flex-1 rounded-t-sm bg-gradient-to-t from-[var(--primary-600)] via-[var(--primary-500)] to-[var(--primary-400)] opacity-80"
        />
      ))}
    </div>
  );
}

function OrgRows() {
  const orgs = [
    { name: 'Brightline', users: '147', color: 'bg-[var(--primary-600)]' },
    { name: 'Horizon Sales', users: '54', color: 'bg-[#25D366]' },
    { name: 'PulseWave', users: '212', color: 'bg-[#8b5cf6]' },
  ];
  return (
    <div className="mt-4 space-y-2">
      {orgs.map((o, i) => (
        <motion.div
          key={o.name}
          initial={{ opacity: 0, x: -10 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.4, delay: i * 0.08 }}
          className="flex items-center gap-3 rounded-lg bg-[#f7f5f3]/80 p-2.5 dark:bg-white/5"
        >
          <span className={`h-7 w-7 flex-shrink-0 rounded-md ${o.color}`} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-bold text-slate-900 dark:text-white">{o.name}</p>
            <p className="text-[10px] text-slate-500 dark:text-slate-400">{o.users} users</p>
          </div>
          <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-bold uppercase text-emerald-600">
            isolated
          </span>
        </motion.div>
      ))}
    </div>
  );
}

function GlobePulse() {
  return (
    <div className="mt-5 flex h-24 items-center justify-center">
      <div className="relative">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            initial={{ scale: 0, opacity: 0.6 }}
            animate={{ scale: 2.6, opacity: 0 }}
            transition={{ duration: 3, delay: i * 1, repeat: Infinity, ease: 'easeOut' }}
            className="absolute inset-0 rounded-full border-2 border-[#25D366]"
            style={{ width: 64, height: 64 }}
          />
        ))}
        <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-[#25D366] to-[#128c7e] text-white shadow-lg shadow-[#25D366]/40">
          <FiGlobe size={28} />
        </div>
      </div>
    </div>
  );
}

const smallCards = [
  {
    icon: FiSearch,
    title: 'Searchable transcripts',
    body: 'Every call. Every WhatsApp call. Full-text searchable across the org.',
    iconClass: 'bg-[#8b5cf6]/10 text-[#7c3aed] dark:text-[#a78bfa]',
    hoverShadow: 'hover:shadow-[#8b5cf6]/15',
  },
  {
    icon: FiLock,
    title: 'TLS / SRTP encrypted',
    body: 'End-to-end across signalling and media. PCI-friendly architecture.',
    iconClass: 'bg-[var(--accent-500)]/10 text-[var(--accent-600)]',
    hoverShadow: 'hover:shadow-emerald-500/15',
  },
  {
    icon: FiPhoneCall,
    title: 'Carrier-grade voice',
    body: 'Direct carrier trunking, HD codec, automatic failover under load.',
    iconClass: 'bg-[var(--primary-600)]/10 text-[var(--foreground)]',
    hoverShadow: 'hover:shadow-black/15',
  },
  {
    icon: HiSparkles,
    title: 'Natural voice AI',
    body: 'Best-in-class TTS, multi-language, sub-second response latency.',
    iconClass:
      'bg-gradient-to-br from-[#8b5cf6] to-[#6d28d9] text-white shadow-lg shadow-[#8b5cf6]/30',
    hoverShadow: 'hover:shadow-[#8b5cf6]/20',
  },
];

export default function BentoGrid() {
  return (
    <section className="relative py-24 sm:py-28">
      <div className="mx-auto max-w-7xl px-6 lg:px-10">
        <div className="mx-auto max-w-3xl text-center">
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.5 }}
            className="text-xs font-semibold uppercase tracking-[0.3em] text-[var(--foreground)]"
          >
            Platform infrastructure
          </motion.p>
          <motion.h2
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.6, delay: 0.05 }}
            className="mt-3 text-3xl font-semibold text-slate-900 dark:text-white sm:text-4xl lg:text-5xl"
          >
            Built like a{' '}
            <span className="bg-gradient-to-r from-[var(--coral)] to-[var(--accent-600)] bg-clip-text text-transparent">
              telco
            </span>
            , shipped like SaaS.
          </motion.h2>
        </div>

        {/* Top row — 3 featured cards in a 12-col asymmetric split */}
        <div className="mt-14 grid grid-cols-1 gap-5 lg:grid-cols-12">
          {/* Live monitoring (5/12 on lg) */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.55, ease: 'easeOut' }}
            className="lg:col-span-5"
          >
            <TiltCard
              max={6}
              className="group relative flex h-full min-h-[360px] flex-col overflow-hidden rounded-3xl border border-slate-200/80 bg-white/70 p-7 shadow-sm backdrop-blur transition hover:border-transparent hover:shadow-2xl hover:shadow-black/15 dark:border-white/10 dark:bg-[#1e1e1e]/60"
            >
              <div className="flex items-center justify-between">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--primary-600)]/10 text-[var(--foreground)]">
                  <FiActivity size={20} />
                </span>
                <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-600">
                  live
                </span>
              </div>
              <h3 className="mt-5 text-xl font-bold text-slate-900 dark:text-white">
                Live monitoring across every channel
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                Realtime call volume, agent presence, queue depth, recording status — across calls
                and WhatsApp from one dashboard.
              </p>
              <MiniBars />
            </TiltCard>
          </motion.div>

          {/* WhatsApp reach (3/12 on lg) */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.55, delay: 0.08, ease: 'easeOut' }}
            className="lg:col-span-3"
          >
            <TiltCard
              max={6}
              className="group relative flex h-full min-h-[360px] flex-col overflow-hidden rounded-3xl border border-slate-200/80 bg-white/70 p-7 shadow-sm backdrop-blur transition hover:border-transparent hover:shadow-2xl hover:shadow-[#25D366]/20 dark:border-white/10 dark:bg-[#1e1e1e]/60"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-[#25D366] to-[#128c7e] text-white shadow-lg shadow-[#25D366]/40">
                <FaWhatsapp size={20} />
              </span>
              <GlobePulse />
              <h3 className="mt-5 text-lg font-bold text-slate-900 dark:text-white">
                1.5B+ users in reach
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                Meet customers on the channel they actually answer. Inbound, outbound, recorded.
              </p>
            </TiltCard>
          </motion.div>

          {/* Multi-tenant (4/12 on lg) */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.55, delay: 0.16, ease: 'easeOut' }}
            className="lg:col-span-4"
          >
            <TiltCard
              max={6}
              className="group relative flex h-full min-h-[360px] flex-col overflow-hidden rounded-3xl border border-slate-200/80 bg-white/70 p-7 shadow-sm backdrop-blur transition hover:border-transparent hover:shadow-2xl hover:shadow-[#8b5cf6]/15 dark:border-white/10 dark:bg-[#1e1e1e]/60"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#8b5cf6]/10 text-[#7c3aed] dark:text-[#a78bfa]">
                  <FiLayers size={20} />
                </span>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  Multi-tenant from day one
                </h3>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                Org-scoped users, contacts, recordings, billing. Each tenant fully isolated.
              </p>
              <OrgRows />
            </TiltCard>
          </motion.div>
        </div>

        {/* Bottom row — 4 equal small cards */}
        <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {smallCards.map((c, i) => {
            const Icon = c.icon;
            return (
              <motion.div
                key={c.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-80px' }}
                transition={{ duration: 0.5, delay: i * 0.06, ease: 'easeOut' }}
              >
                <TiltCard
                  max={5}
                  className={`group relative flex h-full min-h-[180px] flex-col overflow-hidden rounded-3xl border border-slate-200/80 bg-white/70 p-6 shadow-sm backdrop-blur transition hover:border-transparent hover:shadow-xl ${c.hoverShadow} dark:border-white/10 dark:bg-[#1e1e1e]/60`}
                >
                  <span
                    className={`flex h-11 w-11 items-center justify-center rounded-xl ${c.iconClass}`}
                  >
                    <Icon size={20} />
                  </span>
                  <h3 className="mt-4 text-base font-bold text-slate-900 dark:text-white">
                    {c.title}
                  </h3>
                  <p className="mt-1.5 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                    {c.body}
                  </p>
                </TiltCard>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
