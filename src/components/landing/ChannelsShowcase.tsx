'use client';

import { useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import {
  FiPhoneCall,
  FiCpu,
  FiMessageCircle,
  FiSend,
  FiShuffle,
  FiMic,
  FiBarChart2,
  FiUsers,
  FiCode,
} from 'react-icons/fi';

gsap.registerPlugin(useGSAP, ScrollTrigger);

const features = [
  {
    title: 'Cloud Calling',
    description:
      'Unlimited calling across the US & Canada for your whole team — clear, reliable business calling in the same app as your messages.',
    icon: FiPhoneCall,
  },
  {
    title: 'AI Receptionist',
    description:
      "Answers 24/7 when your team can't — greets, routes, books appointments, captures leads and hands off to a human when it matters.",
    icon: FiCpu,
    badge: 'Paid add-on',
    link: true,
  },
  {
    title: 'Business SMS',
    description:
      'Text customers from your business number — one-to-one conversations and SMS follow-ups, all in the same app as your calls.',
    icon: FiMessageCircle,
  },
  {
    title: 'Bulk SMS Campaigns',
    description:
      'Send promotions, reminders and alerts to opted-in lists at scale, with consent checks and automatic opt-out handling. KYC verification required before first send.',
    icon: FiSend,
  },
  {
    title: 'IVR & Auto Attendant',
    description:
      '“Press 1 for Sales, 2 for Support…” Build multi-level menus, route by time of day or team, and get callers to the right person without a receptionist bottleneck.',
    icon: FiShuffle,
  },
  {
    title: 'Call Recording',
    description:
      'Record calls for quality, training and dispute protection, with easy search and playback from any conversation thread.',
    icon: FiMic,
  },
  {
    title: 'Live Analytics',
    description:
      'See call volume, missed calls and campaign results in real time — so you can act today, not at month-end.',
    icon: FiBarChart2,
  },
  {
    title: 'Team Chat',
    description:
      'Message teammates right where your customer conversations live — internal and customer communication stay side by side.',
    icon: FiUsers,
  },
  {
    title: 'API & Webhooks',
    description:
      'Connect Arixcall to the tools you already run. Our API and webhooks let your developers sync calls, messages and contacts with your own systems.',
    icon: FiCode,
  },
];

export default function ChannelsShowcase() {
  const sectionRef = useRef<HTMLElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  // Reveals the heading and feature cards when the section enters the viewport.
  useGSAP(
    () => {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        return;
      }

      gsap.fromTo(
        '[data-features-heading]',
        { y: 25, autoAlpha: 0 },
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
        '[data-feature-card]',
        { y: 35, autoAlpha: 0 },
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
      id="channels"
      className="relative isolate overflow-hidden bg-[#101011] py-16 text-white sm:py-20 lg:py-24"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-40 -top-40 -z-10 h-[420px] w-[420px] rounded-full bg-[#ff4d00]/10 blur-[110px]"
      />

      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-40 -left-40 -z-10 h-[380px] w-[380px] rounded-full bg-[#e81e2b]/[0.07] blur-[110px]"
      />

      <div className="relative mx-auto max-w-[1180px] px-5 sm:px-8 lg:px-10">
        <div data-features-heading className="max-w-[760px]">
          <p className="font-mono text-xs font-bold uppercase tracking-[0.14em] text-[#ff6a00]">
            Features
          </p>

          <h2 className="mt-3 text-[clamp(30px,3.6vw,42px)] font-black leading-[1.08] tracking-[-0.04em] text-white">
            Everything your team needs to answer, route & follow up
          </h2>

          <p className="mt-4 max-w-[760px] text-[15px] leading-7 text-white/60 sm:text-[17px]">
            One login for voice, messaging and campaigns. No separate tools,
            no missed conversations — and nothing you don't actually get.
            Every feature below is live in Arixcall today.
          </p>
        </div>

        <div
          ref={gridRef}
          className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 min-[900px]:grid-cols-3"
        >
          {features.map((feature) => {
            const Icon = feature.icon;

            return (
              <article
                key={feature.title}
                data-feature-card
                className="group relative flex min-h-[220px] flex-col overflow-hidden rounded-[18px] border border-white/[0.09] bg-[#1c1c1f] p-5 transition-all duration-300 hover:-translate-y-1 hover:border-[#ff4d00]/50 hover:bg-[#202023] hover:shadow-[0_16px_40px_rgba(255,77,0,0.08)] sm:p-[22px]"
              >
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full bg-[#ff4d00]/10 opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-100"
                />

                <div className="relative flex items-center justify-between gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#ff4d00]/15 bg-[#ff4d00]/[0.08] text-[#ff6a00] transition-all duration-300 group-hover:border-[#ff4d00] group-hover:bg-[#ff4d00] group-hover:text-white">
                    <Icon size={21} strokeWidth={1.8} />
                  </div>

                  {feature.badge && (
                    <span className="rounded-full bg-gradient-to-r from-[#ff7100] to-[#e84200] px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide text-white">
                      {feature.badge}
                    </span>
                  )}
                </div>

                <h3 className="relative mt-5 text-[18px] font-extrabold tracking-tight text-white">
                  {feature.title}
                </h3>

                <p className="relative mt-2 text-[14px] leading-[1.75] text-white/55">
                  {feature.description}
                </p>

                {feature.link && (
                  <a
                    href="#ai"
                    className="relative mt-3 inline-flex items-center gap-1.5 text-[13px] font-extrabold text-[#ff6a00] transition-colors hover:text-[#ff9a66]"
                  >
                    See all it can do
                    <span aria-hidden="true">→</span>
                  </a>
                )}
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
