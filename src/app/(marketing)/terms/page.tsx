import type { Metadata } from 'next';
import { BreadcrumbListSchema } from '@/lib/seo/schemas';

export const metadata: Metadata = {
  title: 'Terms of Service | ArixCall',
  description:
    'Read the ArixCall Terms of Service covering cloud business communications, voice calling, business SMS, bulk SMS, IVR, team chat, call recording, analytics and the optional AI Receptionist add-on.',
  alternates: { canonical: '/terms' },
  openGraph: {
    title: 'Terms of Service | ArixCall',
    description:
      'Terms covering ArixCall business communications, accounts, verification, plans and billing, communication compliance, call recording, availability and termination.',
    url: '/terms',
  },
};

const LAST_UPDATED = '2026-11-10';

const sections = [
  {
    id: 'service',
    title: '1. The service',
    body: [
      'ArixCall provides a cloud business communications service: voice calling, business SMS, bulk SMS campaigns, IVR and auto attendant, team chat, call recording and analytics, and an optional AI Receptionist add-on (collectively, the &ldquo;Service&rdquo;). ArixCall does not provide an auto dialer. The Service is for business use.',
    ],
  },
  {
    id: 'accounts',
    title: '2. Accounts and eligibility',
    body: [
      'You must be at least 18, provide accurate information, keep your login secure, and be responsible for all activity under your account. You must not share credentials or let anyone use your account to break the law or these Terms.',
    ],
  },
  {
    id: 'verification',
    title: '3. Verification (KYC)',
    body: [
      'We may require identity and business verification before activating an account, and full verification is required before bulk SMS or high-volume calling. See the Acceptable Use and KYC Policy (Part 3), which forms part of these Terms. Providing false documents is grounds for immediate termination.',
    ],
  },
  {
    id: 'billing',
    title: '4. Plans, billing and refunds',
    body: [
      'Basic is $59 per user per month; Pro and White-Label / Enterprise are custom-priced. Yearly billing may save up to 20%. SMS, carrier and regulatory charges are billed separately where applicable. A 14-day free trial may be offered without a credit card.',
      'Refunds are considered and decided case by case at ArixCall&rsquo;s reasonable discretion. Contact <a href="mailto:support@arixcall.com">support@arixcall.com</a>. Unpaid balances may lead to suspension.',
    ],
  },
  {
    id: 'responsibilities',
    title: '5. Your responsibilities',
    body: [
      'You are solely responsible for: (a) your calls, messages, content, contact lists and consent records; (b) complying with all laws that apply to your business and your communications, including telemarketing, consent, privacy and recording laws; and (c) the conduct of your users, agents and customers on your account.',
      'You must obtain proper consent before calling or texting anyone, honor opt-outs immediately, and respect do-not-call lists.',
    ],
  },
  {
    id: 'prohibited-use',
    title: '6. Prohibited use',
    body: [
      'You must not use the Service for anything illegal, including fraud, spam, harassment, impersonation, unlawful surveillance, or human trafficking or any activity that facilitates it. The full prohibited list is in Part 3. Violation may result in immediate suspension or termination without notice and referral to carriers or law enforcement.',
    ],
  },
  {
    id: 'emergency-calls',
    title: '7. Emergency calls warning',
    body: [
      'Cloud phone services may not work during power or internet outages and may not connect to emergency services in the same way as a traditional phone line, and location information may not be automatic. You must maintain an alternative way to reach emergency services and tell all users of this limitation.',
    ],
  },
  {
    id: 'call-recording',
    title: '8. Call recording',
    body: [
      'If you record calls, you are responsible for notifying callers and obtaining any consent your jurisdiction requires (one-party or two-party consent), and for how recordings are stored and used.',
    ],
  },
  {
    id: 'ai-receptionist',
    title: '9. AI Receptionist add-on',
    body: [
      'The AI Receptionist is an optional paid add-on. It answers, routes and takes messages and may book appointments and send SMS follow-ups based on information you provide.',
      'Automated systems can make errors; you are responsible for reviewing messages, bookings and information the add-on collects, and for the accuracy of the business information, scripts and FAQs you give it.',
    ],
  },
  {
    id: 'availability',
    title: '10. Availability and changes',
    body: [
      'We work to keep the Service available but do not guarantee uninterrupted service. We may update features, pricing (with notice for existing customers where required) and these Terms. Continued use after an update takes effect means you accept the updated Terms.',
    ],
  },
  {
    id: 'suspension-termination',
    title: '11. Suspension and termination',
    body: [
      'We may suspend or terminate any account immediately for prohibited use, fraud risk, false verification, non-payment, carrier or regulatory requirements, or risk to our network or other customers.',
      'You may close your account at any time; charges already incurred remain payable.',
    ],
  },
  {
    id: 'liability-indemnity',
    title: '12. Liability and indemnity',
    body: [
      'To the maximum extent allowed by law, ArixCall is not liable for indirect, incidental or consequential damages, or for fines, penalties or claims that arise from your communications, lists, content or failure to obtain consent.',
      'You agree to indemnify and hold ArixCall harmless from claims, fines and costs arising from your use of the Service. Nothing in these Terms limits liability that cannot be limited by law.',
    ],
  },
  {
    id: 'governing-law',
    title: '13. Governing law',
    body: [
      'These Terms are governed by the laws of the State of Texas, USA. Disputes will be handled in Texas unless applicable law requires otherwise.',
    ],
  },
  {
    id: 'contact',
    title: '14. Contact',
    body: [
      'Questions about these Terms? Email <a href="mailto:support@arixcall.com">support@arixcall.com</a>.',
    ],
  },
];

export default function TermsPage() {
  return (
    <main
      id="main-content"
      className="min-h-screen bg-[#101011] text-white"
    >
      <BreadcrumbListSchema
        items={[
          { name: 'Home', url: '/' },
          { name: 'Terms', url: '/terms' },
        ]}
      />

      <section className="relative py-20 sm:py-24">
        <div className="mx-auto max-w-4xl px-6 lg:px-10">
          <div className="text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[#ff7838]">
              Legal
            </p>

            <h1 className="mt-3 text-4xl font-bold tracking-tight text-white sm:text-5xl">
              Terms of Service
            </h1>

            <p className="mt-4 text-sm text-[#888890]">
              Last updated: {LAST_UPDATED}
            </p>
          </div>
        </div>
      </section>

      <section className="relative pb-24">
        <div className="mx-auto grid max-w-6xl gap-10 px-6 lg:grid-cols-[220px_1fr] lg:px-10">
          <aside className="hidden lg:block">
            <nav aria-label="On this page" className="sticky top-24">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#888890]">
                On this page
              </p>

              <ul className="mt-4 space-y-1.5">
                {sections.map((s) => (
                  <li key={s.id}>
                    <a
                      href={`#${s.id}`}
                      className="block text-sm text-[#a1a1aa] transition hover:text-[#ff7838]"
                    >
                      {s.title}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          </aside>

          <article className="rounded-3xl border border-[#2d2d31] bg-[#171719] p-8 shadow-xl sm:p-12">
            {sections.map((s) => (
              <section
                key={s.id}
                id={s.id}
                className="mb-10 scroll-mt-24 last:mb-0"
              >
                <h2 className="text-xl font-bold text-white sm:text-2xl">
                  {s.title}
                </h2>

                <div className="mt-3 space-y-3 text-sm leading-relaxed text-[#b4b4bb]">
                  {s.body.map((p, i) => (
                    <p key={i} dangerouslySetInnerHTML={{ __html: p }} />
                  ))}
                </div>
              </section>
            ))}

            <p className="mt-12 border-t border-[#2d2d31] pt-6 text-xs text-[#85858d]">
              These Terms are provided for transparency and reference. They
              are not a substitute for legal advice; please consult counsel
              before relying on them as a binding contract for your specific
              use case.
            </p>
          </article>
        </div>
      </section>
    </main>
  );
}
