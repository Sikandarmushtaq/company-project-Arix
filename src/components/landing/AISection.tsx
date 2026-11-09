
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

// Renders the AI Receptionist section and manages its GSAP animations.
export default function AISection() {
  const sectionRef = useRef<HTMLElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        return;
      }

      const section = sectionRef.current;
      const grid = gridRef.current;

      if (!section || !grid) return;

      const headingTop = section.querySelector('[data-ai-heading-top]');

      const headingDescription = section.querySelector(
        '[data-ai-description]',
      );

      const cards = gsap.utils.toArray<HTMLElement>(
        '[data-ai-card]',
        grid,
      );

      const actions = gsap.utils.toArray<HTMLElement>(
        '[data-ai-action]',
        section,
      );

      const pricingNote = section.querySelector('[data-ai-pricing]');

      // ANIMATION 1: Heading enters from the left.
      if (headingTop) {
        gsap.fromTo(
          headingTop,
          {
            opacity: 0,
            x: -40,
          },
          {
            opacity: 1,
            x: 0,
            duration: 0.8,
            ease: 'power3.out',
          },
        );
      }

      // ANIMATION 2: Description enters from the right.
      if (headingDescription) {
        gsap.fromTo(
          headingDescription,
          {
            x: 65,
            autoAlpha: 0,
          },
          {
            x: 0,
            autoAlpha: 1,
            duration: 1,
            delay: 0.12,
            ease: 'power3.out',
            scrollTrigger: {
              trigger: headingDescription,
              start: 'top 88%',
              once: true,
            },
          },
        );
      }

      // ANIMATION 3: Cards enter alternately from left and right.
      const cardsTimeline = gsap.timeline({
        scrollTrigger: {
          trigger: grid,
          start: 'top 82%',
          once: true,
        },
      });

      cards.forEach((card, index) => {
        const fromLeft = index % 2 === 0;

        cardsTimeline.fromTo(
          card,
          {
            x: fromLeft ? -65 : 65,
            y: 20,
            autoAlpha: 0,
          },
          {
            x: 0,
            y: 0,
            autoAlpha: 1,
            duration: 0.85,
            ease: 'power3.out',
          },
          index * 0.11,
        );
      });

      // ANIMATION 4: Action buttons enter from the bottom.
      gsap.fromTo(
        actions,
        {
          y: 30,
          autoAlpha: 0,
        },
        {
          y: 0,
          autoAlpha: 1,
          duration: 0.75,
          stagger: 0.15,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: '[data-ai-actions]',
            start: 'top 90%',
            once: true,
          },
        },
      );

      // ANIMATION 5: Pricing note enters from the right.
      if (pricingNote) {
        gsap.fromTo(
          pricingNote,
          {
            x: 35,
            autoAlpha: 0,
          },
          {
            x: 0,
            autoAlpha: 1,
            duration: 0.8,
            ease: 'power3.out',
            scrollTrigger: {
              trigger: pricingNote,
              start: 'top 95%',
              once: true,
            },
          },
        );
      }
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
            {/* AI RECEPTIONIST LABEL AND MAIN HEADING */}
            <div data-ai-heading>
              <div data-ai-heading-top>
                <p className="font-mono text-xs font-bold uppercase tracking-[0.14em] text-[#ff6a00]">
                  AI Receptionist · Paid add-on
                </p>

                <h2 className="mt-4 max-w-[850px] text-[clamp(34px,5vw,54px)] font-black leading-[1.05] tracking-[-0.045em] text-white">
                  Your front desk, awake at 2 a.m.
                </h2>
              </div>

              <p
                data-ai-description
                className="mt-4 max-w-[850px] text-[15px] leading-7 text-[#c9c9ce] sm:text-base"
              >
                When your team is busy, in a meeting, or asleep, the Arixcall
                AI Receptionist answers every call professionally — and turns
                missed calls into booked appointments and captured leads.
                Available as a paid add-on to any plan.
              </p>
            </div>

            {/* CAPABILITY CARDS */}
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

            {/* ACTION BUTTONS */}
            <div
              data-ai-actions
              className="relative mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap"
            >
              <Link
                data-ai-action
                href="/pricing"
                className="inline-flex min-h-12 items-center justify-center rounded-full bg-gradient-to-r from-[#ff7800] to-[#ed202d] px-6 py-3 text-sm font-extrabold text-white shadow-[0_8px_22px_rgba(255,77,0,0.2)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_10px_28px_rgba(255,77,0,0.3)]"
              >
                Add AI Receptionist
              </Link>

              <Link
                data-ai-action
                href="/faq"
                className="inline-flex min-h-12 items-center justify-center rounded-full border border-white/20 bg-white/[0.04] px-6 py-3 text-sm font-extrabold text-white transition-all duration-300 hover:border-white/40 hover:bg-white/10"
              >
                Ask us how it works
              </Link>
            </div>

            {/* PRICING NOTE */}
            <p
              data-ai-pricing
              className="relative mt-4 text-[12px] leading-6 text-[#a1a1aa] sm:text-[13px]"
            >
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
