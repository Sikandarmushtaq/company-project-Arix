
'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import { FiCheck } from 'react-icons/fi';

gsap.registerPlugin(useGSAP, ScrollTrigger);

const basicFeatures = [
  'Unlimited US & Canada calling',
  'Business SMS (usage billed separately)',
  'IVR & auto attendant',
  'Call recording',
  'Team chat',
  'Live analytics',
];

const proFeatures = [
  'Everything in Basic',
  'Bulk SMS campaigns (after KYC verification)',
  'API & webhooks',
  'AI Receptionist add-on available',
];

const enterpriseFeatures = [
  'Everything in Pro',
  'Your branding, your pricing to your customers',
  'AI Receptionist add-on available',
];

function Feature({ children }: { children: string }) {
  return (
    <li className="flex items-start gap-3 text-[13px] leading-6 text-white/70 sm:text-sm">
      <span className="mt-1 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#ff4d00]/15 text-[#ff6a00]">
        <FiCheck size={11} strokeWidth={3} />
      </span>
      <span>{children}</span>
    </li>
  );
}

export default function Pricing() {
  const [billing, setBilling] = useState<'monthly' | 'yearly'>('monthly');

  const sectionRef = useRef<HTMLElement>(null);
  const cardsRef = useRef<HTMLDivElement>(null);

  const basicPrice = billing === 'monthly' ? '59' : '47.20';

  // Animates the pricing heading and cards when the section enters the viewport.
  useGSAP(
    () => {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        return;
      }

      gsap.fromTo(
        '[data-pricing-heading]',
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
        '[data-pricing-card]',
        { y: 35, autoAlpha: 0 },
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
      id="pricing"
      className="relative isolate overflow-hidden bg-[#101011] py-16 text-white sm:py-20 lg:py-24"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-40 top-0 -z-10 h-[420px] w-[420px] rounded-full bg-[#ff4d00]/[0.08] blur-[120px]"
      />

      <div className="relative mx-auto max-w-[1180px] px-5 sm:px-8 lg:px-10">
        <div data-pricing-heading className="max-w-[760px]">
          <p className="font-mono text-xs font-bold uppercase tracking-[0.14em] text-[#ff6a00]">
            Pricing
          </p>

          <h2 className="mt-3 text-[clamp(34px,4.5vw,48px)] font-black leading-[1.05] tracking-[-0.045em] text-white">
            Simple pricing. No surprises.
          </h2>

          <p className="mt-4 max-w-[720px] text-[15px] leading-7 text-white/60 sm:text-[17px]">
            Every plan starts with a 14-day free trial — no credit card
            required. SMS usage is billed separately. Yearly billing saves up
            to 20%.
          </p>
        </div>

        <div
          className="mt-8 inline-flex items-center gap-1 rounded-full border border-white/10 bg-[#1c1c1f] p-1"
          role="group"
          aria-label="Billing period"
        >
          <button
            type="button"
            aria-pressed={billing === 'monthly'}
            onClick={() => setBilling('monthly')}
            className={`rounded-full px-4 py-2.5 text-xs font-extrabold transition-all duration-300 sm:px-5 ${
              billing === 'monthly'
                ? 'bg-gradient-to-r from-[#ff7100] to-[#ed2939] text-white shadow-md'
                : 'text-white/55 hover:text-white'
            }`}
          >
            Monthly
          </button>

          <button
            type="button"
            aria-pressed={billing === 'yearly'}
            onClick={() => setBilling('yearly')}
            className={`rounded-full px-4 py-2.5 text-xs font-extrabold transition-all duration-300 sm:px-5 ${
              billing === 'yearly'
                ? 'bg-gradient-to-r from-[#ff7100] to-[#ed2939] text-white shadow-md'
                : 'text-white/55 hover:text-white'
            }`}
          >
            Yearly — save up to 20%
          </button>
        </div>

        <div
          ref={cardsRef}
          className="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-3"
        >
          <article
            data-pricing-card
            className="relative flex flex-col overflow-hidden rounded-[20px] border border-[#ff4d00]/60 bg-[#1c1c1f] p-6 shadow-[0_15px_45px_rgba(255,77,0,0.07)] sm:p-7"
          >
            <span className="mb-5 w-fit rounded-full bg-gradient-to-r from-[#ff7100] to-[#ed2939] px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-wider text-white">
              Most popular
            </span>

            <h3 className="text-[25px] font-black tracking-tight text-white">
              Basic
            </h3>

            <p className="mt-2 min-h-12 text-sm leading-6 text-white/55">
              Essential calling and messaging for your team.
            </p>

            <div className="mt-5 flex items-baseline gap-2">
              <span className="text-[48px] font-black leading-none tracking-[-0.05em] text-white sm:text-[54px]">
                ${basicPrice}
              </span>

              <span className="text-xs font-medium text-white/45">
                / user / mo
              </span>
            </div>

            <p className="mt-2 text-xs text-white/45">
              {billing === 'monthly'
                ? 'Billed monthly'
                : 'Yearly billing · 20% savings'}
            </p>

            <div className="my-6 h-px bg-white/10" />

            <ul className="grid flex-1 content-start gap-3">
              {basicFeatures.map((feature) => (
                <Feature key={feature}>{feature}</Feature>
              ))}
            </ul>

            <Link
              href="/signup/start?plan=starter"
              className="mt-8 inline-flex min-h-12 items-center justify-center rounded-full bg-gradient-to-r from-[#ff7100] to-[#ed2939] px-5 py-3 text-sm font-extrabold text-white transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_10px_25px_rgba(255,77,0,0.25)]"
            >
              Start free trial
            </Link>
          </article>

          <article
            data-pricing-card
            className="flex flex-col rounded-[20px] border border-white/10 bg-[#1c1c1f] p-6 transition-all duration-300 hover:border-white/20 sm:p-7"
          >
            <h3 className="mt-2 text-[25px] font-black tracking-tight text-white">
              Pro
            </h3>

            <p className="mt-2 min-h-12 text-sm leading-6 text-white/55">
              For larger and high-volume teams.
            </p>

            <div className="mt-5 flex min-h-[54px] items-center">
              <span className="text-[40px] font-black leading-none tracking-[-0.04em] text-white">
                Custom
              </span>
            </div>

            <p className="mt-2 text-xs text-white/45">
              Contact sales for pricing
            </p>

            <div className="my-6 h-px bg-white/10" />

            <ul className="grid flex-1 content-start gap-3">
              {proFeatures.map((feature) => (
                <Feature key={feature}>{feature}</Feature>
              ))}
            </ul>

            <Link
              href="/signup/start?plan=custom"
              className="mt-8 inline-flex min-h-12 items-center justify-center rounded-full border border-white/25 bg-white/[0.04] px-5 py-3 text-sm font-extrabold text-white transition-all duration-300 hover:border-[#ff6a00] hover:bg-[#ff4d00]/10 hover:text-[#ff9868]"
            >
              Talk to sales
            </Link>
          </article>

          <article
            data-pricing-card
            className="flex flex-col rounded-[20px] border border-white/10 bg-[#1c1c1f] p-6 transition-all duration-300 hover:border-white/20 sm:p-7"
          >
            <h3 className="mt-2 text-[23px] font-black tracking-tight text-white">
              White-Label / Enterprise
            </h3>

            <p className="mt-2 min-h-12 text-sm leading-6 text-white/55">
              Sell Arixcall under your own brand.
            </p>

            <div className="mt-5 flex min-h-[54px] items-center">
              <span className="text-[40px] font-black leading-none tracking-[-0.04em] text-white">
                Custom
              </span>
            </div>

            <p className="mt-2 text-xs text-white/45">
              Contact sales for pricing
            </p>

            <div className="my-6 h-px bg-white/10" />

            <ul className="grid flex-1 content-start gap-3">
              {enterpriseFeatures.map((feature) => (
                <Feature key={feature}>{feature}</Feature>
              ))}
            </ul>

            <a
              href="mailto:support@arixcall.com?subject=White-label%20enquiry"
              className="mt-8 inline-flex min-h-12 items-center justify-center rounded-full border border-white/25 bg-white/[0.04] px-5 py-3 text-sm font-extrabold text-white transition-all duration-300 hover:border-[#ff6a00] hover:bg-[#ff4d00]/10 hover:text-[#ff9868]"
            >
              Talk to sales
            </a>
          </article>
        </div>

        <p className="mt-5 max-w-[850px] text-xs leading-6 text-white/45 sm:text-[13px]">
          AI Receptionist is a paid add-on on any plan — priced per account
          by call volume. Refunds are handled case-by-case (see Terms below).
        </p>
      </div>
    </section>
  );
}
