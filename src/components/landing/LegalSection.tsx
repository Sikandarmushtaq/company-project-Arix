
'use client';

import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { FiShield, FiChevronDown } from 'react-icons/fi';

type LegalItem = {
  heading: string;
  content: ReactNode;
};

const legalSections: LegalItem[] = [
  {
    heading: 'Why this policy exists',
    content: (
      <>
        ArixCall's network may only be used for lawful communications.
        This policy protects customers, recipients and carriers — and it
        is strict by design.
      </>
    ),
  },
  {
    heading: '1. Verification required before activation (KYC)',
    content: (
      <>
        Before bulk SMS campaigns or high-volume calling are enabled,
        every account must provide: (a) business registration / formation
        documents; (b) government-issued ID for the business owner or
        authorised representative; (c) proof of business address; and
        (d) a written use-case declaration describing who you will
        contact, why, and how consent was obtained. ArixCall may request
        additional documents at any time and may refuse activation if
        verification is incomplete or the use case is unclear.
      </>
    ),
  },
  {
    heading: '2. Consent & messaging rules',
    content: (
      <>
        You may only message or call people who have given valid consent
        where required. Every campaign must honour opt-outs immediately
        (including STOP), respect do-not-contact / DNC suppression, and
        identify your business clearly. ArixCall provides tools — consent
        checks, automatic opt-out handling and DNC suppression — but{' '}
        <strong>
          you remain fully responsible and liable for your traffic and
          your consent records
        </strong>
        . ArixCall does not certify your compliance with any law or
        standard.
      </>
    ),
  },
  {
    heading: '3. Strictly prohibited use',
    content: (
      <>
        No spam or unsolicited bulk messaging; no robocalls except where
        fully lawful and consented; no fraud, phishing, impersonation or
        deceptive content; no harassment or threats; no illegal goods or
        services; no trafficking of any kind; no traffic that violates
        carrier rules or the law of any jurisdiction involved. No
        exceptions.
      </>
    ),
  },
  {
    heading: '4. Monitoring, suspension & liability',
    content: (
      <>
        We may review traffic patterns and campaign content for abuse
        prevention.{' '}
        <strong>
          Any suspected illegal use or breach of this policy may result
          in instant suspension or termination without prior notice
        </strong>
        , reporting to carriers or authorities where required, and
        withholding of regulated features. The account holder is fully
        liable for all fines, carrier penalties, claims and losses arising
        from traffic sent through their account.
      </>
    ),
  },
  {
    heading: '5. Appeals',
    content: (
      <>
        If you believe a suspension was an error, contact
        support@arixcall.com with your verification documents and consent
        records. Reinstatement is at ArixCall's discretion.
      </>
    ),
  },
];

export default function LegalSection() {
  const sectionRef = useRef<HTMLElement>(null);

  // Reveals the heading, description and policy card with a smooth stagger.
  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);

    const context = gsap.context(() => {
      const mediaQuery = window.matchMedia(
        '(prefers-reduced-motion: reduce)'
      );

      if (mediaQuery.matches) return;

      const timeline = gsap.timeline({
        scrollTrigger: {
          trigger: sectionRef.current,
          start: 'top 82%',
          once: true,
        },
      });

      timeline
        .fromTo(
          '.legal-heading',
          { opacity: 0, x: -35 },
          {
            opacity: 1,
            x: 0,
            duration: 0.8,
            ease: 'power3.out',
          }
        )
        .fromTo(
          '.legal-description',
          { opacity: 0, x: 35 },
          {
            opacity: 1,
            x: 0,
            duration: 0.8,
            ease: 'power3.out',
          },
          '-=0.55'
        )
        .fromTo(
          '.legal-tab',
          { opacity: 0, y: 15 },
          {
            opacity: 1,
            y: 0,
            duration: 0.5,
            ease: 'power3.out',
          },
          '-=0.35'
        )
        .fromTo(
          '.legal-card',
          { opacity: 0, y: 35, scale: 0.98 },
          {
            opacity: 1,
            y: 0,
            scale: 1,
            duration: 0.8,
            ease: 'power3.out',
          },
          '-=0.2'
        )
        .fromTo(
          '.legal-item',
          { opacity: 0, x: (index) => (index % 2 === 0 ? -22 : 22) },
          {
            opacity: 1,
            x: 0,
            duration: 0.65,
            stagger: 0.09,
            ease: 'power3.out',
          },
          '-=0.35'
        );
    }, sectionRef);

    return () => context.revert();
  }, []);

  return (
    <section
      id="legal"
      ref={sectionRef}
      className="relative scroll-mt-24 overflow-hidden bg-[#101011] py-16 text-white sm:py-20"
    >
      <div className="pointer-events-none absolute -left-40 top-10 h-72 w-72 rounded-full bg-[#ff4d00]/10 blur-[120px]" />

      <div className="pointer-events-none absolute -right-40 bottom-0 h-72 w-72 rounded-full bg-[#e81e2b]/10 blur-[130px]" />

      <div className="relative mx-auto max-w-[1180px] px-5 sm:px-8">
        {/* Compact heading and description layout. */}
        <div className="mb-8 flex flex-col justify-between gap-5 md:flex-row md:items-end">
          <div className="legal-heading max-w-2xl">
            <div className="mb-3 flex items-center gap-2">
              <FiShield className="text-[#ff7838]" />
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#ff7838]">
                Legal Center
              </p>
            </div>

            <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl lg:text-5xl">
              Acceptable Use{' '}
              <span className="bg-gradient-to-r from-[#ff7a00] via-[#ff4d00] to-[#e81e2b] bg-clip-text text-transparent">
                & KYC.
              </span>
            </h2>
          </div>

          <p className="legal-description max-w-md text-sm leading-7 text-[#a1a1aa] sm:text-base md:pb-1">
            Learn how ArixCall protects customers, recipients and carriers
            through verification, consent and responsible communication
            policies.
          </p>
        </div>

        {/* Small policy label instead of a large banner. */}
        <div className="legal-tab mb-4 flex w-fit items-center gap-2 rounded-lg border border-[#2a2a2e] bg-[#171719] px-3 py-2">
          <FiShield className="text-[#ff7838]" />
          <span className="text-xs font-semibold text-[#d4d4d8]">
            Acceptable Use & KYC Policy
          </span>
        </div>

        {/* Full policy content stays available inside compact accordions. */}
        <div className="legal-card rounded-2xl border border-[#2d2d31] bg-[#171719] px-5 py-2 sm:px-7">
          {legalSections.map((item) => (
            <details
              key={item.heading}
              className="legal-item group border-b border-[#2d2d31] last:border-b-0"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 sm:py-5 [&::-webkit-details-marker]:hidden">
                <span className="text-sm font-semibold leading-6 text-white transition-colors duration-300 group-hover:text-[#ff7838] sm:text-base">
                  {item.heading}
                </span>

                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#36363a] text-[#a1a1aa] transition-all duration-300 group-open:rotate-180 group-open:border-[#ff6542]/50 group-open:text-[#ff7838]">
                  <FiChevronDown />
                </span>
              </summary>

              <div className="max-w-4xl pb-5 pr-2 text-sm leading-7 text-[#b4b4bb] sm:pb-6 sm:text-[15px]">
                {item.content}
              </div>
            </details>
          ))}
        </div>

        <p className="mt-4 text-xs leading-6 text-[#77777f]">
          Questions about verification or this policy? Contact{' '}
          <a
            href="mailto:support@arixcall.com"
            className="text-[#ff7838] transition-colors hover:text-white"
          >
            support@arixcall.com
          </a>
        </p>
      </div>
    </section>
  );
}
