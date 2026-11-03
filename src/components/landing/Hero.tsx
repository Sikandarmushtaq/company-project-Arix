
'use client';

import Link from 'next/link';
import { useRef } from 'react';
import { FiArrowRight } from 'react-icons/fi';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { AreaChart, Donut, MiniBars } from '@/components/landing/charts';

gsap.registerPlugin(useGSAP);

const heroStats = [
  {
    value: 'Unlimited',
    label: 'US & Canada calling on every plan',
  },
  {
    value: '24 / 7',
    label: 'AI Receptionist answering (add-on)',
  },
  {
    value: '1 app',
    label: 'Calls, SMS, campaigns & team chat',
  },
  {
    value: '14 days',
    label: 'Free trial, no credit card',
  },
];

const channelData = [
  { label: 'Voice', value: 58, color: '#ff6a00' },
  { label: 'SMS', value: 27, color: '#ed2939' },
  { label: 'Campaigns', value: 15, color: '#777782' },
];

const callActivity = [24, 32, 28, 42, 36, 54, 49, 62, 58, 74, 68, 86];

const weeklyActivity = [35, 52, 42, 68, 58, 82, 65, 92, 74];

export default function Hero() {
  const heroRef = useRef<HTMLElement>(null);

  // Animates the hero content and analytics dashboard on page load.
  useGSAP(
    () => {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        return;
      }

      const timeline = gsap.timeline({
        defaults: { ease: 'power3.out' },
      });

      timeline
        .fromTo(
          '[data-hero-badge]',
          { y: 18, autoAlpha: 0 },
          { y: 0, autoAlpha: 1, duration: 0.6 },
        )
        .fromTo(
          '[data-hero-heading]',
          { y: 25, autoAlpha: 0 },
          { y: 0, autoAlpha: 1, duration: 0.8 },
          '-=0.3',
        )
        .fromTo(
          '[data-hero-description]',
          { y: 20, autoAlpha: 0 },
          { y: 0, autoAlpha: 1, duration: 0.7 },
          '-=0.45',
        )
        .fromTo(
          '[data-hero-actions]',
          { y: 18, autoAlpha: 0 },
          { y: 0, autoAlpha: 1, duration: 0.6 },
          '-=0.4',
        )
        .fromTo(
          '[data-hero-micro]',
          { y: 12, autoAlpha: 0 },
          { y: 0, autoAlpha: 1, duration: 0.5 },
          '-=0.35',
        )
        .fromTo(
          '[data-hero-dashboard]',
          { x: 35, scale: 0.97, autoAlpha: 0 },
          {
            x: 0,
            scale: 1,
            autoAlpha: 1,
            duration: 0.9,
          },
          '-=0.6',
        )
        .fromTo(
          '[data-hero-stat]',
          { y: 15, autoAlpha: 0 },
          {
            y: 0,
            autoAlpha: 1,
            duration: 0.5,
            stagger: 0.1,
          },
          '-=0.35',
        );
    },
    { scope: heroRef },
  );

  return (
    <section
      ref={heroRef}
      className="relative isolate overflow-hidden bg-[#101011] text-white"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            'radial-gradient(700px 340px at 85% 0%, rgba(255,90,0,0.16), transparent 65%), radial-gradient(500px 300px at 5% 100%, rgba(232,30,43,0.07), transparent 70%)',
        }}
      />

      <div className="mx-auto w-full max-w-[1180px] px-5 pb-10 pt-28 sm:px-8 sm:pb-12 lg:px-10">
        <div className="grid items-center gap-12 lg:grid-cols-[1.02fr_0.98fr] lg:gap-9">
          <div className="min-w-0">
            <div
              data-hero-badge
              className="inline-flex items-center gap-2 rounded-full border border-[#ff6a00]/25 bg-[#ff4d00]/10 px-3 py-1.5 text-xs font-extrabold text-[#ff9668] sm:text-[13px]"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-[#ff6a00]" />
              Cloud phone system for growing teams
            </div>

            <h1
              data-hero-heading
              className="mt-5 max-w-[590px] text-[clamp(42px,5.2vw,62px)] font-black leading-[0.98] tracking-[-0.05em] text-white"
            >
              Every call, text & customer —{' '}
              <span className="bg-gradient-to-r from-[#ff8a00] via-[#ff4d00] to-[#ed2939] bg-clip-text text-transparent">
                in one place.
              </span>
            </h1>

            <p
              data-hero-description
              className="mt-5 max-w-[570px] text-[15px] leading-[1.85] text-white/80 sm:text-[17px]"
            >
              Arixcall is the business phone system that brings unlimited US
              & Canada calling, business SMS, smart IVR routing, bulk SMS
              campaigns, call recording and team chat together — with an AI
              Receptionist that never lets a call go unanswered.
            </p>

            <div
              data-hero-actions
              className="mt-6 flex flex-col flex-wrap gap-3 sm:flex-row sm:items-center"
            >
              <Link
                href="/signup/start"
                className="group inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#ff7800] to-[#ed202d] px-6 py-3 text-sm font-extrabold text-white shadow-[0_8px_22px_rgba(255,77,0,0.22)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_10px_28px_rgba(255,77,0,0.35)]"
              >
                Start free trial
                <FiArrowRight
                  size={17}
                  className="transition-transform duration-300 group-hover:translate-x-1"
                />
              </Link>

              <Link
                href="/ai-dialer"
                scroll={false}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-extrabold text-[#111113] transition-all duration-300 hover:-translate-y-0.5 hover:bg-[#f1efed]"
              >
                Explore the platform
                <FiArrowRight size={16} />
              </Link>
            </div>

            <p
              data-hero-micro
              className="mt-3.5 max-w-[570px] text-[11px] leading-6 text-white/55 sm:text-[13px]"
            >
              14-day free trial · No credit card required · Yearly billing
              saves up to 20% · SMS billed separately
            </p>

            <div className="mt-7 grid grid-cols-2 gap-x-4 gap-y-5 min-[560px]:grid-cols-4">
              {heroStats.map((stat) => (
                <div
                  key={stat.label}
                  data-hero-stat
                  className="border-t-[3px] border-[#ff5a00] pt-2.5"
                >
                  <p className="text-xl font-extrabold tracking-tight text-white sm:text-[21px]">
                    {stat.value}
                  </p>
                  <p className="mt-1 text-[11px] font-semibold leading-5 text-white/55 sm:text-xs">
                    {stat.label}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div
            data-hero-dashboard
            className="relative mx-auto w-full max-w-[560px] lg:ml-auto"
          >
            <div
              aria-hidden="true"
              className="absolute -inset-5 -z-10 rounded-[35px] bg-[#ff4d00]/10 blur-3xl"
            />

            <div className="dark overflow-hidden rounded-[22px] border border-[#303034] bg-[#121214] text-white shadow-[0_30px_70px_rgba(0,0,0,0.4)]">
              <div className="flex min-h-[48px] items-center justify-between gap-3 border-b border-white/10 px-4">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-[#ff5f57]" />
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-[#febc2e]" />
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-[#28c840]" />
                  <span className="ml-1 truncate text-[10px] text-white/55 sm:text-xs">
                    app.arixcall.com — analytics workspace
                  </span>
                </div>

                <span className="hidden shrink-0 rounded-full border border-[#ff6a00]/25 bg-[#ff4d00]/10 px-2.5 py-1 text-[9px] font-bold text-[#ff9868] min-[460px]:block">
                Live
                </span>
              </div>

              <div className="p-3 sm:p-4">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[13px] font-extrabold text-white sm:text-base">
                      Workspace overview
                    </p>
                    <p className="mt-1 text-[10px] text-white/45 sm:text-xs">
                      Your communication at a glance
                    </p>
                  </div>

                  <span className="rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-[9px] font-semibold text-white/65 sm:text-[10px]">
                    Last 7 days
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-xl border border-white/10 bg-[#1b1b1e] p-2.5 sm:p-3">
                    <p className="text-[9px] font-semibold text-white/45 sm:text-[10px]">
                      Calls
                    </p>
                    <p className="mt-1.5 text-lg font-extrabold tracking-tight text-white sm:text-2xl">
                      1,284
                    </p>
                    <p className="mt-1 text-[8px] text-[#ff9868] sm:text-[9px]">
                      Call activity
                    </p>
                  </div>

                  <div className="rounded-xl border border-white/10 bg-[#1b1b1e] p-2.5 sm:p-3">
                    <p className="text-[9px] font-semibold text-white/45 sm:text-[10px]">
                      Messages
                    </p>
                    <p className="mt-1.5 text-lg font-extrabold tracking-tight text-white sm:text-2xl">
                      842
                    </p>
                    <p className="mt-1 text-[8px] text-[#ff9868] sm:text-[9px]">
                      SMS activity
                    </p>
                  </div>

                  <div className="rounded-xl border border-white/10 bg-[#1b1b1e] p-2.5 sm:p-3">
                    <p className="text-[9px] font-semibold text-white/45 sm:text-[10px]">
                      Answer rate
                    </p>
                    <p className="mt-1.5 text-lg font-extrabold tracking-tight text-white sm:text-2xl">
                      96.8%
                    </p>
                    <p className="mt-1 text-[8px] text-[#ff9868] sm:text-[9px]">
                      Sample metric
                    </p>
                  </div>
                </div>

                <div className="mt-3 rounded-xl border border-white/10 bg-[#1b1b1e] p-3 sm:p-4">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-[11px] font-bold text-white sm:text-sm">
                        Call activity
                      </p>
                      <p className="mt-1 text-[9px] text-white/45 sm:text-[10px]">
                        Weekly activity trend
                      </p>
                    </div>

                    <span className="text-[9px] font-semibold text-[#ff9868] sm:text-[10px]">
                      Demo trend
                    </span>
                  </div>

                  <div className="mt-3 h-[112px] w-full sm:h-[125px]">
                    <AreaChart
                      data={callActivity}
                      stroke="#ff6a00"
                      gridId="heroAnalyticsArea"
                      showGrid
                    />
                  </div>

                  <div className="mt-1 flex justify-between text-[9px] font-medium text-white/40">
                    <span>Mon</span>
                    <span>Tue</span>
                    <span>Wed</span>
                    <span>Thu</span>
                    <span>Fri</span>
                    <span>Sat</span>
                    <span>Sun</span>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-1 gap-3 min-[460px]:grid-cols-2">
                  <div className="rounded-xl border border-white/10 bg-[#1b1b1e] p-3">
                    <p className="text-[11px] font-bold text-white">
                      Channel mix
                    </p>
                    <p className="mt-1 text-[9px] text-white/45">
                     
                    </p>

                    <div className="mt-3">
                      <Donut segments={channelData} />
                    </div>
                  </div>

                  <div className="rounded-xl border border-white/10 bg-[#1b1b1e] p-3">
                    <p className="text-[11px] font-bold text-white">
                      Activity peaks
                    </p>
                    <p className="mt-1 text-[9px] text-white/45">
                      Illustrative activity by period
                    </p>

                    <div className="mt-4">
                      <MiniBars
                        data={weeklyActivity}
                        className="h-[75px]"
                      />
                    </div>

                    <div className="mt-2 flex justify-between text-[8px] text-white/40">
                      <span>Morning</span>
                      <span>Afternoon</span>
                      <span>Evening</span>
                    </div>

                    <div className="mt-4 border-t border-white/10 pt-3">
                      <p className="text-[9px] font-semibold text-white/45">
                        Workspace tools
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <span className="rounded-md bg-white/[0.06] px-2 py-1 text-[9px] text-white/75">
                          Calling
                        </span>
                        <span className="rounded-md bg-white/[0.06] px-2 py-1 text-[9px] text-white/75">
                          SMS
                        </span>
                        <span className="rounded-md bg-white/[0.06] px-2 py-1 text-[9px] text-white/75">
                          IVR
                        </span>
                        <span className="rounded-md bg-white/[0.06] px-2 py-1 text-[9px] text-white/75">
                          Analytics
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <p className="mt-3 text-center text-[9px] text-white/35">
                
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
