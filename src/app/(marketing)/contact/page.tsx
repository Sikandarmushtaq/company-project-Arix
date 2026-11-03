
import type { Metadata } from 'next';
import Link from 'next/link';
import { FiMail, FiMessageCircle, FiShield } from 'react-icons/fi';
import { BreadcrumbListSchema, ContactPageSchema } from '@/lib/seo/schemas';

export const metadata: Metadata = {
  title: 'Contact Sales & Support | ArixCall',
  description:
    'Talk to ArixCall sales about pricing, AI dialer demos, WhatsApp Business calling, or migrating from Twilio, Aircall, or JustCall. Reply within 24h.',
  alternates: { canonical: '/contact' },
  openGraph: {
    title: 'Contact Sales & Support | ArixCall',
    description:
      'Reach ArixCall sales, support, or security. Demos for AI dialer, WhatsApp Business calling and bulk SMS — reply within one business day.',
    url: '/contact',
  },
};

const channels = [
  {
    icon: FiMessageCircle,
    title: 'Sales',
    body: 'New accounts, demos, custom pricing, multi-tenant setups.',
    email: 'sales@arixcall.com',
    accent: 'from-[#ff7a00] to-[#ff4d00]',
    sla: 'Reply within one business day',
  },
  {
    icon: FiMail,
    title: 'Support',
    body: 'Existing customers — issues, questions, account help.',
    email: 'support@arixcall.com',
    accent: 'from-[#ff4d00] to-[#e81e2b]',
    sla: '24 / 7 across timezones',
  },
  {
    icon: FiShield,
    title: 'Security',
    body: 'Vulnerability reports and responsible disclosure.',
    email: 'security@arixcall.com',
    accent: 'from-[#e81e2b] to-[#ff7a00]',
    sla: 'Acknowledged within 48 hours',
  },
];

export default function ContactPage() {
  return (
    <main
      id="main-content"
      className="min-h-screen overflow-hidden bg-[#101011] text-white"
    >
      <BreadcrumbListSchema
        items={[
          { name: 'Home', url: '/' },
          { name: 'Contact', url: '/contact' },
        ]}
      />

      <ContactPageSchema />

      <section className="relative overflow-hidden bg-[#101011] py-20 sm:py-28">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-32 top-0 h-96 w-96 rounded-full bg-[#ff4d00]/10 blur-[140px]"
        />

        <div className="relative mx-auto max-w-4xl px-6 lg:px-10">
          <div className="text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[#ff7838]">
              Contact
            </p>

            <h1 className="mt-3 text-4xl font-bold tracking-tight text-white sm:text-5xl lg:text-6xl">
              Talk to a{' '}
              <span className="bg-gradient-to-r from-[#ff7a00] via-[#ff4d00] to-[#e81e2b] bg-clip-text text-transparent">
                ArixCall product specialist
              </span>
              .
            </h1>

            <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-[#a1a1aa]">
              Three direct channels, no contact-form roulette. Pick the one
              that matches what you need.
            </p>
          </div>
        </div>
      </section>

      <section className="relative bg-[#101011] pb-12 sm:pb-16">
        <div className="mx-auto max-w-6xl px-6 lg:px-10">
          <div className="grid gap-5 lg:grid-cols-3">
            {channels.map((c) => {
              const Icon = c.icon;

              return (
                <div
                  key={c.title}
                  className="group relative flex flex-col overflow-hidden rounded-3xl border border-[#2d2d31] bg-[#171719] p-7 transition-all duration-300 hover:-translate-y-1 hover:border-[#71331e] hover:bg-[#1c1c1f]"
                >
                  <span
                    className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${c.accent} text-white shadow-lg shadow-orange-950/30 transition-transform duration-300 group-hover:scale-105`}
                  >
                    <Icon size={20} />
                  </span>

                  <h3 className="mt-5 text-xl font-bold text-white">
                    {c.title}
                  </h3>

                  <p className="mt-2 text-sm leading-relaxed text-[#a1a1aa]">
                    {c.body}
                  </p>

                  <a
                    href={`mailto:${c.email}`}
                    className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-[#ff7838] transition-colors hover:text-[#ff9b65] hover:underline"
                  >
                    {c.email}
                  </a>

                  <p className="mt-3 text-xs text-[#77777f]">
                    {c.sla}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="relative bg-[#101011] py-16 sm:py-20">
        <div className="mx-auto max-w-4xl px-6 lg:px-10">
          <div className="grid gap-8 rounded-3xl border border-[#2d2d31] bg-[#171719] p-8 shadow-xl lg:grid-cols-2 lg:gap-12 lg:p-12">
            <div>
              <h2 className="text-2xl font-bold text-white sm:text-3xl">
                Or send us a request.
              </h2>

              <p className="mt-3 text-sm leading-relaxed text-[#a1a1aa]">
                Tell us what you&rsquo;re trying to do. We&rsquo;ll route it to
                the right person and reply within one business day.
              </p>

              <ul className="mt-6 space-y-2 text-sm text-[#a1a1aa]">
                <li>• Bringing your own carrier?</li>
                <li>• Need WhatsApp in a specific country?</li>
                <li>• Custom AI agent script?</li>
                <li>• Multi-tenant white-label?</li>
              </ul>

              <p className="mt-6 text-xs text-[#77777f]">
                Form posts straight to{' '}
                <span className="font-mono text-[#ff7838]">
                  sales@arixcall.com
                </span>{' '}
                via your mail client.
              </p>
            </div>

            <form
              action="mailto:sales@arixcall.com"
              method="post"
              encType="text/plain"
              className="space-y-4"
            >
              <div>
                <label
                  htmlFor="name"
                  className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[#c4c4ca]"
                >
                  Name
                </label>

                <input
                  id="name"
                  name="name"
                  type="text"
                  required
                  className="w-full rounded-xl border border-[#343438] bg-[#101011] px-4 py-3 text-sm text-white outline-none transition placeholder:text-[#77777f] focus:border-[#ff6a00] focus:ring-2 focus:ring-[#ff6a00]/15"
                />
              </div>

              <div>
                <label
                  htmlFor="email"
                  className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[#c4c4ca]"
                >
                  Work email
                </label>

                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  className="w-full rounded-xl border border-[#343438] bg-[#101011] px-4 py-3 text-sm text-white outline-none transition placeholder:text-[#77777f] focus:border-[#ff6a00] focus:ring-2 focus:ring-[#ff6a00]/15"
                />
              </div>

              <div>
                <label
                  htmlFor="message"
                  className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[#c4c4ca]"
                >
                  What do you need?
                </label>

                <textarea
                  id="message"
                  name="message"
                  rows={4}
                  required
                  className="w-full resize-none rounded-xl border border-[#343438] bg-[#101011] px-4 py-3 text-sm text-white outline-none transition placeholder:text-[#77777f] focus:border-[#ff6a00] focus:ring-2 focus:ring-[#ff6a00]/15"
                />
              </div>

              <button
                type="submit"
                className="inline-flex w-full items-center justify-center rounded-full bg-gradient-to-r from-[#ff7a00] via-[#ff4d00] to-[#e81e2b] px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-orange-950/30 transition hover:scale-[1.02]"
              >
                Send
              </button>
            </form>
          </div>
        </div>
      </section>

      <section className="relative bg-[#101011] pb-20">
        <div className="mx-auto max-w-3xl px-6 text-center lg:px-10">
          <p className="text-sm text-[#888890]">
            Want to read about our security model first?{' '}
            <Link
              href="/security"
              className="font-semibold text-[#ff7838] transition-colors hover:text-[#ff9b65] hover:underline"
            >
              See the security page
            </Link>
            .
          </p>
        </div>
      </section>
    </main>
  );
}
