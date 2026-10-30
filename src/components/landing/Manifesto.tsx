'use client';

import { motion } from 'framer-motion';

const lines = [
  { text: 'Every dialer in the market', emphasis: false },
  { text: 'is missing one of these.', emphasis: false },
];

const channels = [
  { label: 'Calls.', color: 'from-[var(--primary-600)] to-[var(--primary-700)]' },
  { label: 'WhatsApp.', color: 'from-[#25D366] to-[#128c7e]' },
  { label: 'SMS.', color: 'from-amber-500 to-amber-600' },
  { label: 'AI.', color: 'from-[#8b5cf6] to-[#6d28d9]' },
  { label: 'Recording.', color: 'from-[var(--accent-500)] to-[var(--accent-600)]' },
];

export default function Manifesto() {
  return (
    <section className="relative overflow-hidden py-28 sm:py-36">
      <div className="mx-auto max-w-6xl px-6 lg:px-10">
        <div className="text-center">
          {lines.map((line, i) => (
            <motion.p
              key={i}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-120px' }}
              transition={{ duration: 0.7, delay: i * 0.12, ease: 'easeOut' }}
              className="text-3xl font-bold tracking-tight text-slate-700 dark:text-slate-300 sm:text-5xl lg:text-6xl"
            >
              {line.text}
            </motion.p>
          ))}

          <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 sm:gap-x-10">
            {channels.map((c, i) => (
              <motion.span
                key={c.label}
                initial={{ opacity: 0, y: 30, scale: 0.9 }}
                whileInView={{ opacity: 1, y: 0, scale: 1 }}
                viewport={{ once: true, margin: '-120px' }}
                transition={{ duration: 0.6, delay: 0.3 + i * 0.12, ease: 'easeOut' }}
                className={`bg-gradient-to-r bg-clip-text text-5xl font-black tracking-tight text-transparent sm:text-7xl lg:text-8xl ${c.color}`}
              >
                {c.label}
              </motion.span>
            ))}
          </div>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-120px' }}
            transition={{ duration: 0.7, delay: 0.95 }}
            className="mt-12 text-3xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-5xl lg:text-6xl"
          >
            We put them in{' '}
            <span className="bg-gradient-to-r from-[var(--coral)] to-[var(--accent-600)] bg-clip-text text-transparent">
              one place.
            </span>
          </motion.p>
        </div>
      </div>
    </section>
  );
}
