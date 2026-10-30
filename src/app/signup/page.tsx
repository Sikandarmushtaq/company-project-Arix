'use client';

import React from 'react';
import Link from 'next/link';
import { FiPhone, FiZap, FiUsers, FiArrowRight } from 'react-icons/fi';
import { Button } from '@/components/ui';

const features = [
  {
    icon: <FiPhone className="w-5 h-5" />,
    title: 'Choose your numbers',
    desc: 'Pick local or toll-free numbers and get calling right away.',
  },
  {
    icon: <FiZap className="w-5 h-5" />,
    title: 'Quick setup',
    desc: 'Automated provisioning gets your line live in minutes.',
  },
  {
    icon: <FiUsers className="w-5 h-5" />,
    title: 'Team ready',
    desc: 'Add teammates and manage everything from one dashboard.',
  },
];

export default function SignupPage() {
  return (
    <div className="mx-auto max-w-3xl">
      {/* Hero */}
      <div className="text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--card)] px-3 py-1 text-xs font-semibold text-[var(--muted-foreground)]">
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--primary-600)]" />
          Get started in minutes
        </span>
        <h1 className="mt-5 text-4xl sm:text-5xl font-bold tracking-tight text-[var(--foreground)]">
          Professional VoIP for
          <br className="hidden sm:block" />{' '}
          <span className="bg-gradient-to-r from-[var(--primary-600)] to-[var(--primary-400)] bg-clip-text text-transparent">
            your business
          </span>
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-[var(--muted-foreground)]">
          Set up your business phone system, choose your numbers, and start making calls from
          anywhere.
        </p>
        <div className="mt-8 flex justify-center">
          <Link href="/signup/start">
            <Button size="xl">
              Get started
              <FiArrowRight className="ml-2 w-5 h-5" />
            </Button>
          </Link>
        </div>
      </div>

      {/* Feature cards */}
      <div className="mt-14 grid grid-cols-1 sm:grid-cols-3 gap-4">
        {features.map((item) => (
          <div
            key={item.title}
            className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 text-center transition-colors hover:border-[var(--primary-600)]/40"
          >
            <div className="mx-auto mb-4 grid h-11 w-11 place-items-center rounded-xl bg-[var(--primary-600)]/10 text-[var(--primary-600)]">
              {item.icon}
            </div>
            <h3 className="font-bold text-[var(--foreground)]">{item.title}</h3>
            <p className="mt-1.5 text-sm text-[var(--muted-foreground)]">{item.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
