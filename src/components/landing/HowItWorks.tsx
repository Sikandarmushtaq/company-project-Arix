
'use client';

import { useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';

gsap.registerPlugin(useGSAP, ScrollTrigger);

const steps = [
  {
    number: '01',
    title: 'Start your trial',
    description:
      '14 days free, no credit card. Create your account and add your team.',
  },
  {
    number: '02',
    title: 'Set up routing',
    description:
      'Build your IVR menu and call routing so callers reach the right person.',
  },
  {
    number: '03',
    title: 'Verify for campaigns',
    description:
      'Planning bulk SMS or high-volume calling? Complete quick KYC verification first (see Legal & KYC below).',
  },
  {
    number: '04',
    title: 'Call, text, grow',
    description:
      "Add the AI Receptionist add-on whenever you're ready to cover every hour.",
  },
];

export default function HowItWorks() {
  const sectionRef = useRef<HTMLElement>(null);
  const cardsRef = useRef<HTMLDivElement>(null);

  // Reveals the heading and four steps as the section enters the viewport.
  useGSAP(
    () => {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        return;
      }

      gsap.fromTo(
        '[data-how-heading]',
        {
          y: 25,
          autoAlpha: 0,
        },
        {
          y: 0,
          autoAlpha: 1,
          duration: 0.8,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: sectionRef.current,
            start: 'top 80%',
            once: true,
          },
        },
      );

      gsap.fromTo(
        '[data-how-card]',
        {
          y: 35,
          autoAlpha: 0,
        },
        {
          y: 0,
          autoAlpha: 1,
          duration: 0.7,
          stagger: 0.12,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: cardsRef.current,
            start: 'top 82%',
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
      id="how-it-works"
      className="relative isolate overflow-hidden bg-[#101011] py-16 text-white sm:py-20 lg:py-24"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-40 top-10 -z-10 h-[400px] w-[400px] rounded-full bg-[#ff4d00]/[0.08] blur-[120px]"
      />

      <div className="relative mx-auto max-w-[1180px] px-5 sm:px-8 lg:px-10">
        <div
          data-how-heading
          className="mb-9 max-w-[760px]"
        >
          <p className="font-mono text-xs font-bold uppercase tracking-[0.14em] text-[#ff6a00]">
            How it works
          </p>

          <h2 className="mt-3 text-[clamp(34px,4.5vw,48px)] font-black leading-[1.05] tracking-[-0.045em] text-white">
            Live in four steps
          </h2>

          <p className="mt-4 max-w-[680px] text-[15px] leading-7 text-white/60 sm:text-[17px]">
            From signup to your first call — most teams are up the same day.
          </p>
        </div>

        <div
          ref={cardsRef}
          className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4"
        >
          {steps.map((step, index) => (
            <article
              key={step.number}
              data-how-card
              className="group relative flex min-h-[235px] flex-col overflow-hidden rounded-[18px] border border-white/[0.09] bg-[#1c1c1f] p-5 transition-all duration-300 hover:-translate-y-1 hover:border-[#ff6a00]/40 hover:bg-[#202023] hover:shadow-[0_18px_40px_rgba(255,77,0,0.07)] sm:p-6"
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-[13px] font-bold tracking-wider text-[#ff6a00]">
                  {step.number}
                </span>

                {index === 0 && (
                  <span className="rounded-full border border-[#ff6a00]/25 bg-[#ff4d00]/10 px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider text-[#ff9868]">
                    Get started
                  </span>
                )}
              </div>

              <div className="my-5 h-px w-full bg-gradient-to-r from-[#ff6a00]/50 via-white/10 to-transparent transition-all duration-300 group-hover:from-[#ff6a00] group-hover:via-[#ff6a00]/30" />

              <h3 className="text-[19px] font-extrabold tracking-tight text-white">
                {step.title}
              </h3>

              <p className="mt-3 text-[14px] leading-[1.8] text-white/55">
                {step.description}
              </p>

              <span
                aria-hidden="true"
                className="pointer-events-none absolute -bottom-12 -right-5 select-none font-display text-[115px] font-black leading-none text-white/[0.025] transition-colors duration-300 group-hover:text-[#ff6a00]/[0.06]"
              >
                {step.number}
              </span>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
