
'use client';

import { useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';

gsap.registerPlugin(useGSAP, ScrollTrigger);

const industries = [
  {
    icon: '📞',
    title: 'Call Centers',
    description:
      'IVR routing, recording, live analytics and campaign tools to run high-volume teams without chaos.',
  },
  {
    icon: '🏠',
    title: 'Real Estate',
    description:
      'Never miss a buyer or seller inquiry — AI answering, instant SMS follow-up and lead capture after hours.',
  },
  {
    icon: '🩺',
    title: 'Healthcare',
    description:
      "Appointment booking, reminders and reliable routing for clinics and practices. Use Arixcall's consent, opt-out and access controls as part of your own compliance program.",
  },
  {
    icon: '🔧',
    title: 'Home Services',
    description:
      'Plumbers, HVAC, electricians: book jobs from the first call, even when the whole crew is on site.',
  },
  {
    icon: '🚚',
    title: 'Logistics',
    description:
      'Keep dispatch, drivers and customers in sync with calls, SMS alerts and team chat in one thread.',
  },
  {
    icon: '⚖️',
    title: 'Law Firms',
    description:
      'Professional intake around the clock — capture new-client details and route urgent matters to an attorney.',
  },
  {
    icon: '🏪',
    title: 'Small & Mid-Size Businesses',
    description:
      'Sound like a big company on a small-business budget: IVR, a real business number, and no missed calls.',
  },
];

export default function Comparison() {
  const sectionRef = useRef<HTMLElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  // Animates the industry heading and cards when they enter the viewport.
  useGSAP(
    () => {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        return;
      }

      gsap.fromTo(
        '[data-industry-heading]',
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
        '[data-industry-card]',
        {
          y: 30,
          autoAlpha: 0,
        },
        {
          y: 0,
          autoAlpha: 1,
          duration: 0.7,
          stagger: 0.1,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: gridRef.current,
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
      id="compare"
      className="relative isolate overflow-hidden bg-[#101011] py-16 text-white sm:py-20 lg:py-24"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-40 -top-40 -z-10 h-[420px] w-[420px] rounded-full bg-[#ff4d00]/[0.09] blur-[110px]"
      />

      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-40 -left-40 -z-10 h-[360px] w-[360px] rounded-full bg-[#e81e2b]/[0.06] blur-[110px]"
      />

      <div className="relative mx-auto max-w-[1180px] px-5 sm:px-8 lg:px-10">
        <div
          data-industry-heading
          className="max-w-[760px]"
        >
          <p className="font-mono text-xs font-bold uppercase tracking-[0.14em] text-[#ff6a00]">
            Industries
          </p>

          <h2 className="mt-3 text-[clamp(34px,4.5vw,48px)] font-black leading-[1.05] tracking-[-0.045em] text-white">
            Built for teams that live on the phone
          </h2>

          <p className="mt-4 max-w-[680px] text-[15px] leading-7 text-white/60 sm:text-[17px]">
            If missing a call means missing revenue, Arixcall was built for you.
          </p>
        </div>

        <div
          ref={gridRef}
          className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 min-[900px]:grid-cols-3"
        >
          {industries.map((industry) => (
            <article
              key={industry.title}
              data-industry-card
              className="group relative flex min-h-[205px] flex-col overflow-hidden rounded-[18px] border border-white/[0.09] bg-[#1c1c1f] p-5 transition-all duration-300 hover:-translate-y-1 hover:border-[#ff4d00]/45 hover:bg-[#202023] hover:shadow-[0_18px_40px_rgba(255,77,0,0.07)] sm:p-[22px]"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#ff4d00]/15 bg-[#ff4d00]/[0.08] text-xl transition-all duration-300 group-hover:border-[#ff4d00] group-hover:bg-[#ff4d00]">
                {industry.icon}
              </div>

              <h3 className="mt-5 text-[18px] font-extrabold tracking-tight text-white">
                {industry.title}
              </h3>

              <p className="mt-2 text-[14px] leading-[1.75] text-white/55">
                {industry.description}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
