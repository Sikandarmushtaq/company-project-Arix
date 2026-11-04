
'use client';

import React from 'react';
import Link from 'next/link';
import { FiPhone, FiZap, FiUsers, FiArrowRight } from 'react-icons/fi';
import { Button } from '@/components/ui';

const features = [
  {
    icon: <FiPhone className="h-5 w-5" />,
    title: 'Choose your numbers',
    desc: 'Pick local or toll-free numbers and get calling right away.',
  },
  {
    icon: <FiZap className="h-5 w-5" />,
    title: 'Quick setup',
    desc: 'Automated provisioning gets your line live in minutes.',
  },
  {
    icon: <FiUsers className="h-5 w-5" />,
    title: 'Team ready',
    desc: 'Add teammates and manage everything from one dashboard.',
  },
];

export default function SignupPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <div className="text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-[#333337] bg-[#171719] px-4 py-2 text-xs font-semibold text-[#b5b5bb]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#ff7838] shadow-[0_0_8px_#ff7838]" />
          Get started in minutes
        </span>

        <h1 className="mt-5 text-4xl font-bold tracking-tight text-white sm:text-5xl">
          Professional VoIP for
          <br className="hidden sm:block" />{' '}
          <span className="bg-gradient-to-r from-[#ff7a00] via-[#ff4d00] to-[#e81e2b] bg-clip-text text-transparent">
            your business
          </span>
        </h1>

        <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-[#a1a1aa]">
          Set up your business phone system, choose your numbers, and start making calls from
          anywhere.
        </p>

        <div className="mt-8 flex justify-center">
          <Link href="/signup/start">
            <Button
              size="xl"
              className="!border-0 !bg-gradient-to-r !from-[#ff7a00] !via-[#ff4d00] !to-[#e81e2b] !text-white !shadow-[0_5px_25px_rgba(255,77,0,0.2)] transition-all duration-300 hover:!brightness-110 hover:!shadow-[0_5px_35px_rgba(255,77,0,0.35)]"
            >
              Get started
              <FiArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
        </div>
      </div>

      <div className="mt-14 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {features.map((item) => (
          <div
            key={item.title}
            className="rounded-2xl border border-[#2d2d31] bg-[#171719] p-6 text-center transition-all duration-300 hover:-translate-y-1 hover:border-[#ff7838]/50 hover:bg-[#1c1b1b]"
          >
            <div className="mx-auto mb-4 grid h-11 w-11 place-items-center rounded-xl border border-[#ff7838]/20 bg-[#ff7838]/10 text-[#ff7838]">
              {item.icon}
            </div>

            <h3 className="font-bold text-white">
              {item.title}
            </h3>

            <p className="mt-2 text-sm leading-6 text-[#a1a1aa]">
              {item.desc}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
