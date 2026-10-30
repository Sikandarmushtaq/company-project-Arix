import type { Metadata } from 'next';
import { BreadcrumbListSchema } from '@/lib/seo/schemas';

export const metadata: Metadata = {
  title: 'Privacy Policy | ArixCall Cloud Dialer',
  description:
    "ArixCall's privacy policy: what data we collect from calls, WhatsApp messages and SMS, how we process Meta WhatsApp Business Platform data as a Tech Provider, how we store recordings, data deletion, and your rights under GDPR and CCPA.",
  alternates: { canonical: '/privacy' },
  openGraph: {
    title: 'Privacy Policy | ArixCall Cloud Dialer',
    description:
      'ArixCall privacy policy: data collection, WhatsApp Business Platform (Meta) data, processing, retention, sub-processors, data deletion, GDPR / CCPA rights and contact for data requests.',
    url: '/privacy',
  },
};

const LAST_UPDATED = '2026-06-11';

const sections = [
  {
    id: 'who',
    title: '1. Who we are',
    body: [
      'ArixCall is a cloud communications platform that provides browser and mobile calling, SMS, and WhatsApp business messaging and calling to organizations.',
      'ArixCall is operated by BitNex Technologies (SMC-Private) Limited, 277-K Shan Bhatti Road, Johar Town, Lahore, Pakistan ("ArixCall", "we", "us", or "our").',
      'We also act as a Meta Tech Provider: we enable our business customers to connect and operate their own WhatsApp Business Accounts through the WhatsApp Business Platform. This policy explains what data we process for both our own service and that Tech Provider role.',
    ],
  },
  {
    id: 'collect',
    title: '2. Information we collect',
    body: [
      'Account information: name, work email, organization, role, password hash, and any data you provide during signup or in your profile.',
      'Telephony data: phone numbers you call or message, call duration, call status, SMS campaign rosters and delivery state, and metadata about each conversation. WhatsApp messages and call audio are processed to deliver the service.',
      'WhatsApp Business Platform data: when you connect a WhatsApp Business Account through our onboarding (Meta Embedded Signup), we process WhatsApp Business Account (WABA) identifiers, phone number identifiers and display names, message templates, quality and messaging-limit metadata, and the content and metadata (sender, recipient, timestamps, delivery and read status) of WhatsApp messages and calls sent or received through your connected number.',
      'Recordings: where enabled by your organization, audio of calls and WhatsApp calls is stored along with auto-generated transcripts and analysis.',
      'Usage data: log events, request URLs, IP address, browser/device info, error reports. We use Sentry for error capture and Winston for structured logs.',
      'Payment data: handled by our PCI-compliant payment processor. We never store card numbers on our infrastructure.',
    ],
  },
  {
    id: 'use',
    title: '3. How we use information',
    body: [
      'To deliver, maintain, and improve the dialer service across calls, WhatsApp, AI, and recording channels.',
      'To onboard your WhatsApp Business Account and to manage your WABA, phone numbers, and message templates on your behalf through the WhatsApp Business Platform.',
      'To route calls and messages, transcribe recordings, qualify leads via AI, and surface analytics inside your organization.',
      'To bill your organization, prevent fraud, and enforce our Terms of Service.',
      'To send service-critical announcements (outages, security advisories). Marketing email is opt-in.',
      'To comply with legal obligations and respond to lawful requests.',
    ],
  },
  {
    id: 'whatsapp',
    title: '4. WhatsApp Business Platform & Meta data',
    body: [
      'We are a Meta Tech Provider. When you connect a WhatsApp Business Account through Embedded Signup, you authorize ArixCall to access and manage that account, its phone numbers, and its message templates solely to provide the messaging and calling service you have requested.',
      'You (or your business) remain the owner of your WhatsApp Business Account and its data. We process WhatsApp messages, calls, and account information on your behalf as a service provider / data processor.',
      'We handle data obtained through Meta APIs in accordance with the Meta Platform Terms, the Meta Developer Policies, and the WhatsApp Business Messaging Policy.',
      'We do not use WhatsApp Business Platform data for advertising or profiling, we do not sell it, and we do not share it except with the sub-processors needed to deliver the service (see below) or where legally required.',
      'You can revoke our access at any time by disconnecting your WhatsApp Business Account from ArixCall or by contacting privacy@arixcall.com.',
    ],
  },
  {
    id: 'sharing',
    title: '5. Sharing and sub-processors',
    body: [
      'We share data only with sub-processors required to deliver the service: Meta Platforms (WhatsApp Business Cloud API), our carrier and TURN provider, our AI voice provider, our push-notification provider, our cloud infrastructure host, our edge / CDN, and our error-tracking service.',
      'Each sub-processor handles only the minimum data required for their function. We never sell personal data.',
      'A current list of named sub-processors is available on request from privacy@arixcall.com.',
      'We may disclose data when legally compelled (subpoena, court order). When permitted by law, we will notify the affected organization first.',
    ],
  },
  {
    id: 'cookies',
    title: '6. Cookies and tracking',
    body: [
      'Essential cookies: session token, organization context, MFA state. These are required for the app to function.',
      'Analytics: Tawk.to live chat (consent-gated; the script does not load until you grant analytics consent in the cookie banner).',
      'No third-party advertising trackers. No cross-site tracking.',
    ],
  },
  {
    id: 'retention',
    title: '7. Data retention',
    body: [
      'Account data is retained while your organization is active and for 90 days after cancellation.',
      "Call logs and recordings are retained according to your organization's retention rules. The default is 90 days, configurable from 7 days to 7 years per organization.",
      'WhatsApp message records are retained while your account is connected and active, and are deleted (or returned) on request or when you disconnect your WhatsApp Business Account, subject to legal retention requirements.',
      'Logs and error reports are retained for 30 days, then aggregated or deleted.',
      'You can request earlier deletion at any time by emailing privacy@arixcall.com.',
    ],
  },
  {
    id: 'deletion',
    title: '8. Data deletion',
    body: [
      'You can request deletion of your personal data or your organization’s data at any time by emailing privacy@arixcall.com from the address associated with your account, with the subject line "Data Deletion Request".',
      'For WhatsApp data, you may also disconnect your WhatsApp Business Account from ArixCall at any time; doing so revokes our access and we will delete the associated data we hold, subject to any legal retention obligations.',
      'We process verified deletion requests within 30 days and confirm once complete.',
    ],
  },
  {
    id: 'rights',
    title: '9. Your rights',
    body: [
      'You may request access to, correction of, export of, or deletion of your personal data. Contact privacy@arixcall.com from the email associated with your account.',
      'EU/UK users: you have the rights provided under GDPR and the UK Data Protection Act, including the right to lodge a complaint with your local supervisory authority.',
      'California users: you have rights under the CCPA, including the right to know what data we hold about you and to request its deletion.',
    ],
  },
  {
    id: 'security',
    title: '10. Security',
    body: [
      'TLS 1.3 in transit, AES at rest. Per-organization tenancy isolation. PII scrubbing in logs.',
      'Access to WhatsApp and customer data is restricted to the minimum personnel required to operate and support the service.',
      'See the security page for the full overview.',
    ],
  },
  {
    id: 'children',
    title: '11. Children',
    body: [
      'ArixCall is a B2B platform and is not directed at children under 16. We do not knowingly collect data from children.',
    ],
  },
  {
    id: 'transfers',
    title: '12. International transfers',
    body: [
      'Your data may be processed in jurisdictions other than your own (primarily the United States and the EU). Where required, we use Standard Contractual Clauses or equivalent safeguards.',
    ],
  },
  {
    id: 'changes',
    title: '13. Changes to this policy',
    body: [
      'We may update this policy as the service evolves. Material changes will be communicated via in-app notice and email at least 30 days before they take effect.',
      'The version date at the top reflects the most recent update.',
    ],
  },
  {
    id: 'contact',
    title: '14. Contact',
    body: [
      'Questions about privacy, or to make a data request? Email privacy@arixcall.com or visit the contact page.',
      'BitNex Technologies (SMC-Private) Limited — operator of ArixCall — 277-K Shan Bhatti Road, Johar Town, Lahore, Pakistan.',
    ],
  },
];

export default function PrivacyPage() {
  return (
    <main id="main-content">
      <BreadcrumbListSchema
        items={[
          { name: 'Home', url: '/' },
          { name: 'Privacy', url: '/privacy' },
        ]}
      />
      <section className="relative py-20 sm:py-24">
        <div className="mx-auto max-w-4xl px-6 lg:px-10">
          <div className="text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[var(--foreground)]">
              Legal
            </p>
            <h1 className="mt-3 text-4xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-5xl">
              Privacy Policy
            </h1>
            <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
              Last updated: {LAST_UPDATED}
            </p>
          </div>
        </div>
      </section>

      <section className="relative pb-24">
        <div className="mx-auto grid max-w-6xl gap-10 px-6 lg:grid-cols-[220px_1fr] lg:px-10">
          {/* Sticky table of contents */}
          <aside className="hidden lg:block">
            <nav aria-label="On this page" className="sticky top-24">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                On this page
              </p>
              <ul className="mt-4 space-y-1.5">
                {sections.map((s) => (
                  <li key={s.id}>
                    <a
                      href={`#${s.id}`}
                      className="block text-sm text-slate-600 transition hover:text-[var(--foreground)] dark:text-slate-400"
                    >
                      {s.title}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          </aside>

          <article className="rounded-3xl border border-slate-200/80 bg-white/70 p-8 shadow-xl backdrop-blur dark:border-white/10 dark:bg-[#1e1e1e]/60 sm:p-12">
            {sections.map((s) => (
              <section key={s.id} id={s.id} className="mb-10 scroll-mt-24 last:mb-0">
                <h2 className="text-xl font-bold text-slate-900 dark:text-white sm:text-2xl">
                  {s.title}
                </h2>
                <div className="mt-3 space-y-3 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                  {s.body.map((p, i) => (
                    <p key={i}>{p}</p>
                  ))}
                </div>
              </section>
            ))}

            <p className="mt-12 border-t border-slate-200/80 pt-6 text-xs text-slate-500 dark:border-white/10 dark:text-slate-400">
              This policy is provided for transparency. It is not a substitute for legal advice; if
              you operate in a regulated industry, please consult counsel before relying on it to
              evaluate your compliance posture.
            </p>
          </article>
        </div>
      </section>
    </main>
  );
}
