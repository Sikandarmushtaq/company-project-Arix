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
    accent: 'from-[var(--primary-600)] to-[var(--primary-700)]',
    sla: 'Reply within one business day',
  },
  {
    icon: FiMail,
    title: 'Support',
    body: 'Existing customers — issues, questions, account help.',
    email: 'support@arixcall.com',
    accent: 'from-[#25D366] to-[#128c7e]',
    sla: '24 / 7 across timezones',
  },
  {
    icon: FiShield,
    title: 'Security',
    body: 'Vulnerability reports and responsible disclosure.',
    email: 'security@arixcall.com',
    accent: 'from-[#8b5cf6] to-[#6d28d9]',
    sla: 'Acknowledged within 48 hours',
  },
];

export default function ContactPage() {
  return (
    <main id="main-content">
      <BreadcrumbListSchema
        items={[
          { name: 'Home', url: '/' },
          { name: 'Contact', url: '/contact' },
        ]}
      />
      <ContactPageSchema />
      <section className="relative py-20 sm:py-28">
        <div className="mx-auto max-w-4xl px-6 lg:px-10">
          <div className="text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[var(--foreground)]">
              Contact
            </p>
            <h1 className="mt-3 text-4xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-5xl lg:text-6xl">
              Talk to a{' '}
              <span className="bg-gradient-to-r from-[var(--coral)] to-[var(--accent-600)] bg-clip-text text-transparent">
                ArixCall product specialist
              </span>
              .
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-slate-600 dark:text-slate-300">
              Three direct channels, no contact-form roulette. Pick the one that matches what you
              need.
            </p>
          </div>
        </div>
      </section>

      <section className="relative pb-12 sm:pb-16">
        <div className="mx-auto max-w-6xl px-6 lg:px-10">
          <div className="grid gap-5 lg:grid-cols-3">
            {channels.map((c) => {
              const Icon = c.icon;
              return (
                <div
                  key={c.title}
                  className="group relative flex flex-col overflow-hidden rounded-3xl border border-slate-200/80 bg-white/70 p-7 shadow-sm backdrop-blur transition hover:shadow-2xl hover:shadow-black/15 dark:border-white/10 dark:bg-[#1e1e1e]/60"
                >
                  <span
                    className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${c.accent} text-white shadow-lg`}
                  >
                    <Icon size={20} />
                  </span>
                  <h3 className="mt-5 text-xl font-bold text-slate-900 dark:text-white">
                    {c.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                    {c.body}
                  </p>
                  <a
                    href={`mailto:${c.email}`}
                    className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-[var(--foreground)] hover:underline"
                  >
                    {c.email}
                  </a>
                  <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">{c.sla}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="relative py-16 sm:py-20">
        <div className="mx-auto max-w-4xl px-6 lg:px-10">
          <div className="grid gap-8 rounded-3xl border border-slate-200/80 bg-white/70 p-8 shadow-xl backdrop-blur dark:border-white/10 dark:bg-[#1e1e1e]/60 lg:grid-cols-2 lg:gap-12 lg:p-12">
            <div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white sm:text-3xl">
                Or send us a request.
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                Tell us what you&rsquo;re trying to do. We&rsquo;ll route it to the right person and
                reply within one business day.
              </p>
              <ul className="mt-6 space-y-2 text-sm text-slate-600 dark:text-slate-400">
                <li>• Bringing your own carrier?</li>
                <li>• Need WhatsApp in a specific country?</li>
                <li>• Custom AI agent script?</li>
                <li>• Multi-tenant white-label?</li>
              </ul>
              <p className="mt-6 text-xs text-slate-500 dark:text-slate-400">
                Form posts straight to <span className="font-mono">sales@arixcall.com</span> via your
                mail client.
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
                  className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300"
                >
                  Name
                </label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  required
                  className="w-full rounded-xl border border-slate-200/80 bg-white/80 px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-[var(--border)] focus:ring-2 focus:ring-[var(--primary-600)]/20 dark:border-white/10 dark:bg-white/5 dark:text-white"
                />
              </div>
              <div>
                <label
                  htmlFor="email"
                  className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300"
                >
                  Work email
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  className="w-full rounded-xl border border-slate-200/80 bg-white/80 px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-[var(--border)] focus:ring-2 focus:ring-[var(--primary-600)]/20 dark:border-white/10 dark:bg-white/5 dark:text-white"
                />
              </div>
              <div>
                <label
                  htmlFor="message"
                  className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300"
                >
                  What do you need?
                </label>
                <textarea
                  id="message"
                  name="message"
                  rows={4}
                  required
                  className="w-full resize-none rounded-xl border border-slate-200/80 bg-white/80 px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-[var(--border)] focus:ring-2 focus:ring-[var(--primary-600)]/20 dark:border-white/10 dark:bg-white/5 dark:text-white"
                />
              </div>
              <button
                type="submit"
                className="inline-flex w-full items-center justify-center rounded-full bg-[var(--primary-600)] px-6 py-3 text-sm font-bold text-white shadow-lg shadow-black/30 transition hover:scale-[1.02] hover:bg-[var(--primary-700)]"
              >
                Send
              </button>
            </form>
          </div>
        </div>
      </section>

      <section className="relative pb-20">
        <div className="mx-auto max-w-3xl px-6 text-center lg:px-10">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Want to read about our security model first?{' '}
            <Link
              href="/security"
              className="font-semibold text-[var(--foreground)] hover:underline"
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
