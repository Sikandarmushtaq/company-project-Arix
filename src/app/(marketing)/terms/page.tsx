
import type { Metadata } from 'next';
import { BreadcrumbListSchema } from '@/lib/seo/schemas';

export const metadata: Metadata = {
  title: 'Terms of Service | ArixCall Dialer',
  description:
    'Read the ArixCall Terms of Service covering use of our calling, AI dialer, WhatsApp Business Platform (Meta Tech Provider) calling and messaging, bulk SMS and call recording products. Updated 2026.',
  alternates: { canonical: '/terms' },
  openGraph: {
    title: 'Terms of Service | ArixCall Dialer',
    description:
      'Acceptable use, billing, WhatsApp Business Platform & Meta compliance, AI auto-dialer compliance, recording laws, white-label and termination rules for the ArixCall multi-channel dialer.',
    url: '/terms',
  },
};

const LAST_UPDATED = '2026-06-11';

const sections = [
  {
    id: 'acceptance',
    title: '1. Acceptance',
    body: [
      'By creating an account or using ArixCall (the &ldquo;Service&rdquo;), you agree to these Terms of Service. If you&rsquo;re using ArixCall on behalf of an organization, you confirm that you have authority to bind that organization.',
      'ArixCall is operated by BitNex Technologies (SMC-Private) Limited. If you do not agree to these terms, do not use the Service.',
    ],
  },
  {
    id: 'service',
    title: '2. Description of service',
    body: [
      'ArixCall provides a multi-channel dialer that includes voice calls, WhatsApp Business calls and messaging, bulk SIM-based SMS campaigns, an AI auto-dialer, and call recording. Specific features depend on your subscription plan.',
      'ArixCall is a Meta Tech Provider and enables you to connect and operate your own WhatsApp Business Account through the WhatsApp Business Platform (see Section 3).',
      'We may add, modify, or remove features over time. Material changes that reduce functionality will be communicated in advance.',
    ],
  },
  {
    id: 'whatsapp',
    title: '3. WhatsApp Business Platform & Meta compliance',
    body: [
      'ArixCall acts as a Meta Tech Provider. You may connect your own WhatsApp Business Account (&ldquo;WABA&rdquo;) to ArixCall through Meta&rsquo;s Embedded Signup. You remain the owner of your WABA, its phone numbers, and its message templates; we access and manage them on your behalf solely to provide the Service.',
      'When using WhatsApp through ArixCall, you agree to comply with the <a href="https://www.whatsapp.com/legal/business-terms" target="_blank" rel="noopener noreferrer">WhatsApp Business Terms of Service</a>, the WhatsApp Business Messaging Policy, the Meta Commerce Policy (where applicable), and all applicable laws.',
      'You are solely responsible for obtaining any opt-in or consent required from your message recipients, for the content of your messages and templates, and for maintaining your number&rsquo;s quality and messaging-limit ratings. You will not use WhatsApp to send spam or any content prohibited by Meta&rsquo;s policies.',
      'We process WhatsApp data on your behalf as described in our <a href="/privacy">Privacy Policy</a>. We may suspend or disable WhatsApp features for your account if you violate these policies, if your quality rating falls below acceptable thresholds, or if Meta requires it. We will delete WhatsApp data we hold on your behalf when you disconnect your WABA or terminate, subject to legal retention requirements.',
      'Meta is not a party to these Terms, but is a third-party beneficiary entitled to enforce its own terms against your use of the WhatsApp Business Platform.',
    ],
  },
  {
    id: 'account',
    title: '4. Account responsibilities',
    body: [
      'You are responsible for safeguarding your password and any actions taken under your account.',
      'You agree to provide accurate registration information and keep it current.',
      'You must notify us promptly at security@arixcall.com of any unauthorized use of your account.',
    ],
  },
  {
    id: 'use',
    title: '5. Acceptable use',
    body: [
      'You will not use the Service to: send unsolicited communications in violation of applicable law (TCPA, CAN-SPAM, CASL, equivalent local laws); record calls without the consent required by your jurisdiction; impersonate any person or entity; reverse engineer or attempt to extract source code; circumvent rate limits, billing controls, or security measures.',
      'WhatsApp messaging must comply with the WhatsApp Business Messaging Policy and the Meta Commerce Policy, including obtaining the recipient opt-in required by Meta and applicable law. You will not send spam, prohibited goods/services, or content that violates Meta&rsquo;s policies.',
      'AI auto-dialer use must comply with all applicable telemarketing, robocall, and AI-disclosure laws. Where required, you must disclose to the called party that they are speaking with an AI.',
      'We reserve the right to suspend or terminate accounts that violate this section.',
    ],
  },
  {
    id: 'billing',
    title: '6. Subscription and billing',
    body: [
      'Paid plans are billed in advance, monthly or annually depending on your selection. Yearly plans receive the discount stated at signup.',
      'Usage above plan limits is billed in arrears at the rates published in your dashboard.',
      'Failure to pay may result in suspension after a 14-day grace period.',
      'Refunds are not provided for partial months or unused capacity.',
    ],
  },
  {
    id: 'ip',
    title: '7. Intellectual property',
    body: [
      'ArixCall, the ArixCall name and logo, and all software, designs, and documentation are the property of BitNex Technologies. You receive a limited, non-exclusive, non-transferable license to use the Service for the duration of your subscription.',
      'You retain all rights to your content (contacts, call recordings, messages, AI prompts). You grant us a limited license to process that content solely to deliver the Service.',
    ],
  },
  {
    id: 'content',
    title: '8. User content',
    body: [
      'You are responsible for the legality of the content you upload, transmit, or generate via the Service, including AI-generated voice content, WhatsApp messages and templates, and call recordings.',
      'You represent that you have all necessary rights and consents to the content you process through ArixCall.',
    ],
  },
  {
    id: 'termination',
    title: '9. Termination',
    body: [
      'You may cancel your subscription at any time from your dashboard. Cancellation takes effect at the end of your current billing period.',
      'We may suspend or terminate your access for material breach of these terms, with notice where reasonable.',
      'On termination, you can export your data within 30 days. After that, data is deleted per our retention policy.',
    ],
  },
  {
    id: 'liability',
    title: '10. Limitation of liability',
    body: [
      'To the maximum extent permitted by law, BitNex Technologies will not be liable for any indirect, incidental, consequential, or punitive damages, or any loss of profits or revenue, whether incurred directly or indirectly.',
      'Our total liability for any claim arising out of or relating to the Service will not exceed the amount you paid us in the twelve months preceding the claim.',
      'The Service is provided &ldquo;as is&rdquo; without warranty of any kind, express or implied, except as required by law.',
    ],
  },
  {
    id: 'indemnification',
    title: '11. Indemnification',
    body: [
      'You agree to indemnify and hold harmless BitNex Technologies, its affiliates, officers, and employees from any claim or demand made by any third party due to your breach of these Terms or your violation of any law or third-party right.',
    ],
  },
  {
    id: 'law',
    title: '12. Governing law',
    body: [
      'These Terms are governed by the laws of the jurisdiction in which BitNex Technologies is incorporated, without regard to conflict-of-law principles.',
      'Any dispute arising out of these Terms will be resolved exclusively in the courts of that jurisdiction.',
    ],
  },
  {
    id: 'changes',
    title: '13. Changes',
    body: [
      'We may update these Terms from time to time. Material changes will be communicated via in-app notice and email at least 30 days before they take effect. Continued use of the Service after changes take effect constitutes acceptance of the revised Terms.',
    ],
  },
  {
    id: 'contact',
    title: '14. Contact',
    body: [
      'Questions about these Terms? Email legal@arixcall.com.',
      'BitNex Technologies (SMC-Private) Limited — operator of ArixCall — 277-K Shan Bhatti Road, Johar Town, Lahore, Pakistan.',
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
