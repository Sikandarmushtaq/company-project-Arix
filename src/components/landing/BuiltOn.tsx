'use client';

import { motion } from 'framer-motion';
import { FaWhatsapp } from 'react-icons/fa';
import { FiCloud, FiLock, FiPhone } from 'react-icons/fi';
import { HiSparkles } from 'react-icons/hi2';

const stack = [
  { icon: FaWhatsapp, label: 'Meta WhatsApp Business', sub: 'Cloud API partner' },
  { icon: HiSparkles, label: 'Natural voice AI', sub: 'Multi-language, low latency' },
  { icon: FiPhone, label: 'Carrier-grade calling', sub: 'Direct trunking' },
  { icon: FiCloud, label: 'Multi-region edge', sub: 'Low-latency delivery' },
  { icon: FiLock, label: 'Encrypted at rest', sub: 'TLS 1.3 / SRTP / AES' },
];

export default function BuiltOn() {
  return (
    <section className="relative py-16">
      <div className="mx-auto max-w-7xl px-6 lg:px-10">
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.5 }}
          className="text-center text-xs font-semibold uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400"
        >
          Built on the stack you already trust
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.6, delay: 0.05 }}
          className="mt-8 grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5"
        >
          {stack.map((item, i) => {
            const Icon = item.icon;
            return (
              <motion.div
                key={item.label}
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true, margin: '-80px' }}
                transition={{ duration: 0.4, delay: i * 0.05 }}
                whileHover={{ y: -4, scale: 1.03 }}
                className="group flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-white/60 px-4 py-3 backdrop-blur transition hover:border-transparent hover:bg-white/90 hover:shadow-lg hover:shadow-black/10 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
              >
                <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-[#f0ece8] text-slate-600 transition group-hover:bg-[var(--primary-600)]/10 group-hover:text-[var(--foreground)] dark:bg-white/10 dark:text-slate-300">
                  <Icon size={16} />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                    {item.label}
                  </p>
                  <p className="truncate text-xs text-slate-500 dark:text-slate-400">{item.sub}</p>
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
}
