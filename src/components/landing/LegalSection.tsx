
'use client';

import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { FiFileText, FiLock, FiShield } from 'react-icons/fi';

type LegalTab = 'terms' | 'privacy' | 'kyc';

type LegalItem = {
  heading: string;
  content: ReactNode;
};

type LegalDocument = {
  title: string;
  description: string;
  sections: LegalItem[];
};

const tabs: {
  id: LegalTab;
  label: string;
  icon: ReactNode;
}[] = [
  {
    id: 'terms',
    label: 'Terms & Conditions',
    icon: <FiFileText />,
  },
  {
    id: 'privacy',
    label: 'Privacy Policy',
    icon: <FiLock />,
  },
  {
    id: 'kyc',
    label: 'Acceptable Use & KYC',
    icon: <FiShield />,
  },
];

const legalDocuments: Record<LegalTab, LegalDocument> = {
  terms: {
    title: 'Terms & Conditions',
    description: 'The terms that govern your use of ArixCall services.',
    sections: [
      {
        heading: '1. Who we are & acceptance',
        content: (
          <>
            These Terms govern use of the services provided by ArixCall
            [entity suffix], a company based in Texas, USA ("ArixCall", "we",
            "us"). By creating an account or using the services, you agree to
            these Terms and to our Privacy Policy and Acceptable Use & KYC
            Policy.
          </>
        ),
      },
      {
        heading: '2. The services',
        content: (
          <>
            ArixCall provides cloud communications services including voice
            calling, business SMS, bulk SMS campaigns, IVR/auto attendant, call
            recording, analytics, team chat, API access, and the optional AI
            Receptionist add-on. ArixCall does not provide emergency (911)
            calling as a replacement for a traditional phone line; you are
            responsible for maintaining an alternative means of contacting
            emergency services.
          </>
        ),
      },
      {
        heading: '3. Accounts & verification',
        content: (
          <>
            You must provide accurate account information and keep it current.
            Certain features — including bulk SMS and high-volume calling —
            require successful KYC verification under our Acceptable Use & KYC
            Policy before activation. We may decline, limit or suspend
            activation until verification is complete.
          </>
        ),
      },
      {
        heading: '4. Your responsibilities',
        content: (
          <>
            You are solely responsible for all activity, content, calls and
            messages sent through your account, for obtaining all required
            consents from message/call recipients, and for complying with all
            applicable laws (including telemarketing, anti-spam,
            recording-consent and privacy laws) in every jurisdiction where
            you operate. You — not ArixCall — are liable for any illegal use of
            the services through your account, including spam, robocalling,
            fraud, harassment, trafficking or any other unlawful traffic.
          </>
        ),
      },
      {
        heading: '5. Fees, billing & refunds',
        content: (
          <>
            Plans are billed per user per month (or per year where yearly
            billing is selected). SMS and other usage-based charges are billed
            separately. Add-ons, including AI Receptionist, are billed as
            agreed at activation. Fees already paid are refunded only on a
            case-by-case basis at ArixCall's reasonable discretion; contact
            support@arixcall.com. Unpaid balances may result in suspension.
          </>
        ),
      },
      {
        heading: '6. Suspension & termination',
        content: (
          <>
            We may suspend or terminate any account immediately, without prior
            notice, for breach of these Terms or the Acceptable Use & KYC
            Policy, suspected illegal use, non-payment, or risk to our network,
            carriers or other customers. You may cancel at any time from your
            account or via support; cancellation stops future renewals but
            does not remove liability for prior use.
          </>
        ),
      },
      {
        heading: '7. Acceptable use',
        content: (
          <>
            Your use is subject to the Acceptable Use & KYC Policy, which
            forms part of these Terms. Breach of that policy is a breach of
            these Terms.
          </>
        ),
      },
      {
        heading: '8. Availability & changes',
        content: (
          <>
            We aim for high availability but do not guarantee uninterrupted
            service. We may update features or these Terms; material changes
            will be posted on this page with a new effective date, and
            continued use means acceptance.
          </>
        ),
      },
      {
        heading: '9. Liability',
        content: (
          <>
            To the maximum extent permitted by law, ArixCall's total liability
            arising from the services is limited to the amounts you paid in
            the three months before the claim. Nothing in these Terms limits
            liability that cannot legally be limited. You agree to indemnify
            ArixCall against claims, fines, carrier penalties and losses
            arising from your use, your traffic, or your breach of law or
            these Terms.
          </>
        ),
      },
      {
        heading: '10. Governing law',
        content: (
          <>
            These Terms are governed by the laws of the State of Texas, USA.
            Contact: ArixCall, [full address], TX, USA —
            support@arixcall.com.
          </>
        ),
      },
    ],
  },

  privacy: {
    title: 'Privacy Policy',
    description: 'How account information and communication data are handled.',
    sections: [
      {
        heading: '1. What we collect',
        content: (
          <>
            <strong>Account data:</strong> name, business name, email, phone,
            billing details and KYC documents you submit.{' '}
            <strong>Usage data:</strong> call/message metadata (numbers, times,
            durations), recordings and messages you choose to store, and
            device/log data. <strong>Support data:</strong> conversations with
            our team, including chat and WhatsApp.
          </>
        ),
      },
      {
        heading: '2. How we use it',
        content: (
          <>
            To provide and bill the services, verify identity for regulated
            features (bulk SMS / high-volume calling), prevent fraud and abuse,
            comply with carrier and legal requirements, provide support, and
            improve reliability. We do not sell your personal information.
          </>
        ),
      },
      {
        heading: '3. Call recording & AI Receptionist',
        content: (
          <>
            If you enable recording or the AI Receptionist, calls may be
            recorded, transcribed and processed to deliver those features. You
            are responsible for notifying callers and obtaining any consent
            your jurisdiction requires.
          </>
        ),
      },
      {
        heading: '4. Sharing',
        content: (
          <>
            We share data only with carriers and service providers needed to
            deliver the services, payment processors, verification providers
            for KYC, and authorities where legally required (including
            investigation of illegal use). Providers receive only what they
            need.
          </>
        ),
      },
      {
        heading: '5. Retention & security',
        content: (
          <>
            We keep account and KYC records while your account is active and as
            required for legal, carrier and fraud-prevention purposes, then
            delete or anonymise them. We use access controls and encryption in
            transit; no system is completely secure.
          </>
        ),
      },
      {
        heading: '6. Your choices',
        content: (
          <>
            You may request access, correction or deletion of your personal
            data, and export your content, by contacting support@arixcall.com.
            Some records must be retained by law or for fraud prevention and
            cannot be deleted on request.
          </>
        ),
      },
      {
        heading: '7. Cookies',
        content: (
          <>
            Our website uses essential cookies to operate and, with consent
            where required, analytics cookies to understand usage. You can
            control cookies in your browser.
          </>
        ),
      },
      {
        heading: '8. Changes & contact',
        content: (
          <>
            We will post updates to this policy on this page. Privacy
            questions: ArixCall, TX, USA — support@arixcall.com.
          </>
        ),
      },
    ],
  },

  kyc: {
    title: 'Acceptable Use & KYC / Anti-Fraud',
    description:
      'Verification and communication rules that protect customers, recipients and carriers.',
    sections: [
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
    ],
  },
};

export default function LegalSection() {
  const [activeTab, setActiveTab] = useState<LegalTab>('terms');

  const sectionRef = useRef<HTMLElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const activeDocument = legalDocuments[activeTab];

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

  // Animates the content when a different legal tab is selected.
  useEffect(() => {
    if (!panelRef.current) return;

    gsap.fromTo(
      panelRef.current,
      {
        opacity: 0,
        y: 12,
      },
      {
        opacity: 1,
        y: 0,
        duration: 0.35,
        ease: 'power2.out',
      }
    );
  }, [activeTab]);

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
            <span className="h-px w-9 bg-gradient-to-r from-[#ff7a00] to-[#e81e2b]" />

            <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#ff7838]">
              Legal Center
            </p>
          </div>

          <h2 className="text-4xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl">
            Terms, Privacy{' '}
            <span className="bg-gradient-to-r from-[#ff7a00] via-[#ff4d00] to-[#e81e2b] bg-clip-text text-transparent">
              & KYC.
            </span>
          </h2>

          <p className="mt-6 max-w-2xl text-base leading-8 text-[#a1a1aa] sm:text-lg">
            Clear policies, responsible communication and secure account
            verification. Find the information you need about using ArixCall
            and its services.
          </p>
        </div>

        <div
          className="legal-reveal mb-6 flex w-fit max-w-full flex-nowrap gap-2 overflow-x-auto rounded-xl border border-[#2a2a2e] bg-[#171719] p-2"
          role="tablist"
          aria-label="Legal documents"
        >
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                id={`legal-tab-${tab.id}`}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-controls="legal-panel"
                onClick={() => setActiveTab(tab.id)}
                className={`flex min-h-10 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-xs font-bold transition-all duration-300 sm:px-4 sm:text-sm ${
                  isActive
                    ? 'bg-gradient-to-r from-[#ff7a00] via-[#ff4d00] to-[#e81e2b] text-white shadow-[0_6px_18px_rgba(255,77,0,0.18)]'
                    : 'text-[#a1a1aa] hover:bg-[#252528] hover:text-white'
                }`}
              >
                <span className="text-sm">{tab.icon}</span>
                {tab.label}
              </button>
            );
          })}
        </div>

        <div
          ref={panelRef}
          id="legal-panel"
          role="tabpanel"
          aria-labelledby={`legal-tab-${activeTab}`}
          tabIndex={0}
          className="legal-reveal rounded-2xl border border-[#2d2d31] bg-[#171719] p-5 outline-none sm:p-8 lg:p-10"
        >
          <div className="mb-8 border-b border-[#2d2d31] pb-6">
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-[#ff7838]">
              ArixCall Policies
            </p>

            <h3 className="text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
              {activeDocument.title}
            </h3>

            <p className="mt-3 text-sm leading-7 text-[#a1a1aa]">
              {activeDocument.description}
            </p>
          </div>

          {activeTab === 'terms' && (
            <div className="mb-8 rounded-xl border border-dashed border-[#9a4a25] bg-[#241711] p-4 sm:p-5">
              <p className="text-sm leading-7 text-[#e2c4b4]">
                <strong className="text-[#ff9a66]">
                  Placeholders to complete before publishing:
                </strong>{' '}
                [Entity suffix — LLC/Inc], [Full business address, TX],
                [Governing registration details]. Support contact throughout:{' '}
                <a
                  href="mailto:support@arixcall.com"
                  className="font-semibold text-[#ff9a66] underline underline-offset-4"
                >
                  support@arixcall.com
                </a>
                .
              </p>
            </div>
          )}

          <div className="divide-y divide-[#2d2d31]">
            {activeDocument.sections.map((item) => (
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
