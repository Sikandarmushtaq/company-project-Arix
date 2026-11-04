
'use client';

import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { FiShield } from 'react-icons/fi';

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

  // Reveals the legal section when it enters the viewport.
  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);

    const context = gsap.context(() => {
      gsap.fromTo(
        '.legal-reveal',
        {
          opacity: 0,
          y: 28,
        },
        {
          opacity: 1,
          y: 0,
          duration: 0.8,
          stagger: 0.12,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: sectionRef.current,
            start: 'top 78%',
            once: true,
          },
        }
      );
    }, sectionRef);

    return () => context.revert();
  }, []);

  return (
    <section
      id="legal"
      ref={sectionRef}
      className="relative scroll-mt-24 overflow-hidden bg-[#101011] py-24 text-white sm:py-28"
    >
      <div className="pointer-events-none absolute -left-40 top-20 h-80 w-80 rounded-full bg-[#ff4d00]/10 blur-[120px]" />

      <div className="pointer-events-none absolute -right-40 bottom-0 h-96 w-96 rounded-full bg-[#e81e2b]/10 blur-[140px]" />

      <div className="relative mx-auto max-w-[1180px] px-5 sm:px-8">
        <div className="legal-reveal mb-10 max-w-3xl">
          <div className="mb-5 flex items-center gap-3">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#ff7838]">
              Legal Center
            </p>
          </div>

          <h2 className="text-4xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl">
            Acceptable Use{' '}
            <span className="bg-gradient-to-r from-[#ff7a00] via-[#ff4d00] to-[#e81e2b] bg-clip-text text-transparent">
              & KYC.
            </span>
          </h2>

          <p className="mt-6 max-w-2xl text-base leading-8 text-[#a1a1aa] sm:text-lg">
            Verification and communication rules that protect customers,
            recipients and carriers. Learn about our KYC requirements,
            consent rules and acceptable use policy.
          </p>
        </div>

        <div className="legal-reveal mb-6 flex w-fit max-w-full items-center gap-2 rounded-xl border border-[#2a2a2e] bg-[#171719] p-2">
          <div className="flex min-h-10 items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-[#ff7a00] via-[#ff4d00] to-[#e81e2b] px-4 py-2 text-xs font-bold text-white shadow-[0_6px_18px_rgba(255,77,0,0.18)] sm:text-sm">
            <FiShield className="text-sm" />
            Acceptable Use & KYC
          </div>
        </div>

        <div className="legal-reveal rounded-2xl border border-[#2d2d31] bg-[#171719] p-5 sm:p-8 lg:p-10">
          <div className="mb-8 border-b border-[#2d2d31] pb-6">
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-[#ff7838]">
              ArixCall Policies
            </p>

            <h3 className="text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
              Acceptable Use & KYC / Anti-Fraud
            </h3>

            <p className="mt-3 text-sm leading-7 text-[#a1a1aa]">
              Verification and communication rules that protect customers,
              recipients and carriers.
            </p>
          </div>

          <div className="divide-y divide-[#2d2d31]">
            {legalSections.map((item) => (
              <article
                key={item.heading}
                className="py-6 first:pt-0 last:pb-0"
              >
                <h4 className="text-base font-bold leading-7 text-white sm:text-lg">
                  {item.heading}
                </h4>

                <div className="mt-3 text-sm leading-8 text-[#b4b4bb] sm:text-[15px]">
                  {item.content}
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
