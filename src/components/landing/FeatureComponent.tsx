'use client';

import { motion } from 'framer-motion';
import {
  FiBarChart2,
  FiHeadphones,
  FiLayers,
  FiPhoneCall,
  FiRadio,
  FiShare2,
  FiSmartphone,
  FiUsers,
} from 'react-icons/fi';

const features = [
  {
    title: 'HD Voice Quality',
    description: 'Crystal-clear audio with intelligent noise suppression.',
    icon: FiPhoneCall,
  },
  {
    title: 'Real-time Analytics',
    description: 'Live dashboards for call volume, outcomes, and KPIs.',
    icon: FiBarChart2,
  },
  {
    title: 'Call Recording',
    description: 'Secure recordings with searchable transcripts.',
    icon: FiRadio,
  },
  {
    title: 'Multi-line Support',
    description: 'Scale across teams with shared and direct lines.',
    icon: FiLayers,
  },
  {
    title: 'CRM Integration',
    description: 'Sync every call and disposition with your CRM.',
    icon: FiShare2,
  },
  {
    title: 'Team Collaboration',
    description: 'Live monitoring, coaching, and shared inboxes.',
    icon: FiUsers,
  },
  {
    title: 'Advanced Call Routing',
    description: 'Smart queues and skills-based distribution.',
    icon: FiHeadphones,
  },
  {
    title: 'Mobile & Desktop Apps',
    description: 'Stay connected anywhere with native apps.',
    icon: FiSmartphone,
  },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.12 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

export default function Features() {
  return (
    <section
      id="features"
      className="relative overflow-hidden bg-gradient-to-b from-white via-[#f7f5f3]/70 to-white py-20 dark:from-[#121212] dark:via-[#121212]/60 dark:to-[#121212] sm:py-24"
    >
      <div
        className="pointer-events-none absolute -top-24 left-[-12%] h-72 w-72 rounded-full bg-[radial-gradient(circle,_rgba(255,101,66,0.22),_rgba(255,101,66,0)_70%)] blur-3xl"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -top-16 right-[-10%] h-64 w-64 rounded-full bg-[radial-gradient(circle,_rgba(14,165,233,0.18),_rgba(14,165,233,0)_70%)] blur-3xl"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute bottom-[-18%] right-[12%] h-80 w-80 rounded-full bg-[radial-gradient(circle,_rgba(16,185,129,0.18),_rgba(16,185,129,0)_70%)] blur-3xl"
        aria-hidden="true"
      />
      <div className="mx-auto max-w-7xl px-6 lg:px-10">
        <div className="relative mx-auto max-w-3xl text-center">
          <div className="pointer-events-none absolute inset-0 -z-10 rounded-3xl bg-gradient-to-b from-[var(--primary-600)]/10 via-transparent to-transparent blur-2xl" />
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[var(--accent-600)]">
            Features
          </p>
          <h2 className="mt-3 text-3xl font-semibold text-slate-900 dark:text-white sm:text-4xl">
            Everything You Need for{' '}
            <span className="bg-gradient-to-r from-[var(--primary-600)] via-[var(--accent-500)] to-[var(--primary-700)] bg-clip-text text-transparent">
              Professional Calling
            </span>
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-base text-slate-600 dark:text-slate-300">
            Empower every agent with the tools they need to connect, coach, and close. ArixCall
            combines advanced telephony with insights that scale.
          </p>
        </div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-80px' }}
          className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4"
        >
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <motion.div
                key={feature.title}
                variants={itemVariants}
                whileHover={{ y: -8, scale: 1.02 }}
                className="group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white/70 p-6 shadow-sm shadow-black/5 backdrop-blur transition duration-300 hover:-translate-y-1 hover:border-transparent hover:shadow-xl hover:shadow-black/20 dark:border-white/10 dark:bg-[#1e1e1e]/60"
              >
                <div
                  className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/60 via-white/10 to-transparent opacity-0 transition duration-300 group-hover:opacity-100 dark:from-white/10"
                  aria-hidden="true"
                />
                <div
                  className="pointer-events-none absolute -right-10 -top-10 h-24 w-24 rounded-full bg-[radial-gradient(circle,_rgba(255,101,66,0.28),_rgba(255,101,66,0)_70%)] opacity-0 blur-2xl transition duration-300 group-hover:opacity-100"
                  aria-hidden="true"
                />
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--primary-600)]/10 text-[var(--foreground)] transition group-hover:bg-[var(--primary-600)] group-hover:text-white">
                  <Icon size={22} />
                </div>
                <h3 className="mt-5 text-lg font-semibold text-slate-900 dark:text-white">
                  {feature.title}
                </h3>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                  {feature.description}
                </p>
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
}
