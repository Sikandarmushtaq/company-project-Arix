
'use client';

import { useRef } from 'react';
import Link from 'next/link';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';

gsap.registerPlugin(useGSAP, ScrollTrigger);

const capabilities = [
  {
    title: '24/7 answering',
    description:
      'Every call picked up, day or night, weekends and holidays.',
  },
  {
    title: 'Smart routing',
    description:
      'Understands why someone is calling and sends them to the right person or department.',
  },
  {
    title: 'Messages, taken properly',
    description:
      'Full message details delivered to your team instantly — no voicemail black hole.',
  },
  {
    title: 'Appointment booking',
    description:
      "Books callers straight into your schedule while they're still on the phone.",
  },
  {
    title: 'Lead capture',
    description:
      'Collects name, number and what they need — so follow-up starts with context.',
  },
  {
    title: 'Instant FAQs',
    description:
      'Answers your common questions — hours, location, pricing basics — without tying up staff.',
  },
  {
    title: 'Transfer to a human',
    description:
      'Urgent or complex? The call is handed to a real team member, with context.',
  },
  {
    title: 'SMS follow-up',
    description:
      'Sends a confirmation or follow-up text after the call, automatically.',
  },
];

export default function AISection() {
  const sectionRef = useRef<HTMLElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  // Reveals the AI Receptionist heading, capability cards and buttons on scroll.
  useGSAP(
    () => {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        return;
      }

      gsap.fromTo(
        '[data-ai-heading]',
        { y: 25, autoAlpha: 0 },
        {
          y: 0,
          autoAlpha: 1,
          duration: 0.8,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: sectionRef.current,
            start: 'top 78%',
            once: true,
          },
        },
      );

      gsap.fromTo(
        '[data-ai-card]',
        { y: 35, autoAlpha: 0 },
        {
          y: 0,
          autoAlpha: 1,
          duration: 0.65,
          stagger: 0.09,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: gridRef.current,
            start: 'top 82%',
            once: true,
          },
        },
      );

      gsap.fromTo(
        '[data-ai-actions]',
        { y: 20, autoAlpha: 0 },
        {
          y: 0,
          autoAlpha: 1,
          duration: 0.65,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: gridRef.current,
            start: 'bottom 90%',
            once: true,
          },
        },
      );
    },
    { scope: sectionRef },
  );

  return (
    <section
      ref={sectionRef}
      id="ai"
      className="relative overflow-hidden bg-[#101011] py-14 text-white sm:py-16 lg:py-20"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute right-[-180px] top-[-150px] h-[480px] w-[480px] rounded-full bg-[#ff4d00]/[0.09] blur-[120px]"
      />

      <div className="relative mx-auto max-w-[1180px] px-5 sm:px-8 lg:px-10">
        <div className="relative overflow-hidden rounded-[26px] border border-white/[0.07] bg-[#18181b] p-5 shadow-[0_25px_80px_rgba(0,0,0,0.25)] sm:p-8 lg:p-10">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-28 -top-28 h-[340px] w-[340px] rounded-full bg-[#ff4d00]/[0.09] blur-[100px]"
          />

          <div className="relative">
            <div data-ai-heading>
              <p className="font-mono text-xs font-bold uppercase tracking-[0.14em] text-[#ff6a00]">
                AI Receptionist · Paid add-on
              </p>

              <h2 className="mt-4 max-w-[850px] text-[clamp(34px,5vw,54px)] font-black leading-[1.05] tracking-[-0.045em] text-white">
                Your front desk, awake at 2 a.m.
              </h2>

              <p className="mt-4 max-w-[850px] text-[15px] leading-7 text-[#c9c9ce] sm:text-base">
                When your team is busy, in a meeting, or asleep, the Arixcall
                AI Receptionist answers every call professionally — and turns
                missed calls into booked appointments and captured leads.
                Available as a paid add-on to any plan.
              </p>
            </div>

            <div
              ref={gridRef}
              className="relative mt-9 grid grid-cols-1 gap-3 min-[560px]:grid-cols-2 min-[900px]:grid-cols-4"
            >
              {capabilities.map((capability) => (
                <article
                  key={capability.title}
                  data-ai-card
                  className="group min-h-[150px] rounded-[15px] border border-[#2e2e32] bg-[#202023] p-4 transition-all duration-300 hover:-translate-y-1 hover:border-[#ff6a00]/40 hover:bg-[#242427] sm:p-5"
                >
           

                  <h3 className="text-[16px] font-extrabold tracking-tight text-white">
                    {capability.title}
                  </h3>

                  <p className="mt-2 text-[13px] leading-[1.7] text-[#c9c9ce]">
                    {capability.description}
                  </p>
                </article>
              ))}
            </div>

            <div
              data-ai-actions
              className="relative mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap"
            >
              <Link
                href="/pricing"
                className="inline-flex min-h-12 items-center justify-center rounded-full bg-gradient-to-r from-[#ff7800] to-[#ed202d] px-6 py-3 text-sm font-extrabold text-white shadow-[0_8px_22px_rgba(255,77,0,0.2)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_10px_28px_rgba(255,77,0,0.3)]"
              >
                Add AI Receptionist
              </Link>

              <Link
                href="/faq"
                className="inline-flex min-h-12 items-center justify-center rounded-full border border-white/20 bg-white/[0.04] px-6 py-3 text-sm font-extrabold text-white transition-all duration-300 hover:border-white/40 hover:bg-white/10"
              >
                Ask us how it works
              </Link>
            </div>

            <p className="relative mt-4 text-[12px] leading-6 text-[#a1a1aa] sm:text-[13px]">
              Pricing for the AI Receptionist add-on is quoted per account
              based on call volume — contact sales for your rate. Language
              options are confirmed during setup.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
