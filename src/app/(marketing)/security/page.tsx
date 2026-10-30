import type { Metadata } from 'next';
import Link from 'next/link';
import { FiActivity, FiCheck, FiKey, FiLayers, FiLock, FiServer, FiShield } from 'react-icons/fi';
import { BreadcrumbListSchema } from '@/lib/seo/schemas';

export const metadata: Metadata = {
  title: 'Security & Compliance at ArixCall | SOC 2, GDPR',
  description:
    'How ArixCall protects your call recordings, WhatsApp data and customer PII: encryption, access controls, SOC 2 roadmap, GDPR and data residency.',
  alternates: { canonical: '/security' },
  openGraph: {
    title: 'Security & Compliance at ArixCall | SOC 2, GDPR',
    description:
      'TLS / SRTP encryption, multi-tenant isolation, encrypted recordings, SOC 2 Type II readiness in progress, GDPR-aligned data handling.',
    url: '/security',
  },
};

const pillars = [
  {
    icon: FiLock,
    title: 'TLS / SRTP everywhere',
    body: 'All signalling rides TLS 1.3. Media rides SRTP for calls and WhatsApp. No plaintext on the wire, ever — including between our own services.',
    accent: 'from-[var(--accent-500)] to-[var(--accent-600)]',
  },
  {
    icon: FiServer,
    title: 'High-availability infrastructure',
    body: 'High-availability calling infrastructure with automatic carrier failover. Multi-region egress. Active health checks. RTO measured in seconds, not minutes.',
    accent: 'from-[var(--primary-600)] to-[var(--primary-700)]',
  },
  {
    icon: FiLayers,
    title: 'Multi-tenant isolation',
    body: 'Schema-level org tenancy. Every query scoped by organization_id. No cross-tenant reads, no shared queues, no shared cache namespaces.',
    accent: 'from-[#8b5cf6] to-[#6d28d9]',
  },
  {
    icon: FiKey,
    title: 'Recordings encrypted at rest',
    body: 'Calls and WhatsApp call recordings stored AES-encrypted in object storage. Per-organization retention rules. Signed-URL access only.',
    accent: 'from-[#25D366] to-[#128c7e]',
  },
  {
    icon: FiShield,
    title: 'Authentication',
    body: 'Bcrypt-hashed passwords, JWT + Redis sessions, MFA support, optional Google OAuth, force-logout flag honoured on every request.',
    accent: 'from-[var(--coral)] to-[var(--accent-600)]',
  },
  {
    icon: FiActivity,
    title: 'Observability',
    body: 'Structured Winston logs, Sentry for errors, Grafana for metrics. Audit log for sensitive actions. PII scrubbed before it leaves the app.',
    accent: 'from-[var(--accent-500)] to-emerald-700',
  },
];

const compliance = [
  'TLS 1.3 / SRTP for signalling and media',
  'Encryption at rest for recordings and database',
  'Per-organization data isolation',
  'PII redaction in logs (phone, email scrubbed)',
  'Bcrypt password hashing, force-logout on revoke',
  'Soft deletes + per-org retention windows',
  'SOC 2 Type II readiness in progress',
];

export default function SecurityPage() {
  return (
    <main id="main-content">
      <BreadcrumbListSchema
        items={[
          { name: 'Home', url: '/' },
          { name: 'Security', url: '/security' },
        ]}
      />
      <section className="relative py-20 sm:py-28">
        <div className="mx-auto max-w-4xl px-6 lg:px-10">
          <div className="text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[var(--foreground)]">
              Security
            </p>
            <h1 className="mt-3 text-4xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-5xl lg:text-6xl">
              Enterprise-grade security for every{' '}
              <span className="bg-gradient-to-r from-[var(--coral)] to-[var(--accent-600)] bg-clip-text text-transparent">
                call, message &amp; recording
              </span>
              .
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-slate-600 dark:text-slate-300">
              Voice carries the most sensitive data your customers will ever share. Here&rsquo;s how
              we keep it locked down across calls, WhatsApp, AI, and recording.
            </p>
          </div>
        </div>
      </section>

      <section className="relative pb-12">
        <div className="mx-auto max-w-7xl px-6 lg:px-10">
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {pillars.map((p) => {
              const Icon = p.icon;
              return (
                <div
                  key={p.title}
                  className="group relative flex flex-col overflow-hidden rounded-3xl border border-slate-200/80 bg-white/70 p-6 shadow-sm backdrop-blur transition hover:shadow-2xl hover:shadow-black/15 dark:border-white/10 dark:bg-[#1e1e1e]/60"
                >
                  <span
                    className={`flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br ${p.accent} text-white shadow-lg`}
                  >
                    <Icon size={18} />
                  </span>
                  <h3 className="mt-4 text-lg font-bold text-slate-900 dark:text-white">
                    {p.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                    {p.body}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="relative py-16 sm:py-20">
        <div className="mx-auto max-w-4xl px-6 lg:px-10">
          <div className="rounded-3xl border border-slate-200/80 bg-white/70 p-8 shadow-xl backdrop-blur dark:border-white/10 dark:bg-[#1e1e1e]/60 sm:p-12">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white sm:text-3xl">
              Compliance posture
            </h2>
            <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
              Where we are today. Independent audits in flight; status will change as artefacts
              land.
            </p>
            <ul className="mt-6 space-y-3">
              {compliance.map((c) => (
                <li
                  key={c}
                  className="flex items-start gap-3 rounded-xl border border-slate-200/80 bg-white/60 p-3 dark:border-white/10 dark:bg-white/5"
                >
                  <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 ring-1 ring-emerald-500/30">
                    <FiCheck size={12} strokeWidth={3} />
                  </span>
                  <span className="text-sm text-slate-700 dark:text-slate-200">{c}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="relative py-16 sm:py-20">
        <div className="mx-auto max-w-3xl px-6 text-center lg:px-10">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[var(--foreground)]">
            Disclosure
          </p>
          <h2 className="mt-3 text-2xl font-bold text-slate-900 dark:text-white sm:text-3xl">
            Found something?
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            We take vulnerability reports seriously. Email{' '}
            <a
              href="mailto:security@arixcall.com"
              className="font-semibold text-[var(--foreground)] hover:underline"
            >
              security@arixcall.com
            </a>{' '}
            with a description, reproduction steps, and any PoC. We&rsquo;ll acknowledge within 48
            hours and keep you in the loop until it&rsquo;s fixed. Please don&rsquo;t open a public
            issue or test against production accounts that aren&rsquo;t yours.
          </p>
          <div className="mt-7">
            <Link
              href="/contact"
              className="inline-flex items-center justify-center rounded-full bg-[var(--primary-600)] px-7 py-3 text-sm font-bold text-white shadow-lg shadow-black/30 transition hover:scale-[1.02] hover:bg-[var(--primary-700)]"
            >
              Other questions? Contact us
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
