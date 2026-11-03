
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
    accent: 'from-[#ff7a00] to-[#ff4d00]',
  },
  {
    icon: FiServer,
    title: 'High-availability infrastructure',
    body: 'High-availability calling infrastructure with automatic carrier failover. Multi-region egress. Active health checks. RTO measured in seconds, not minutes.',
    accent: 'from-[#ff4d00] to-[#e81e2b]',
  },
  {
    icon: FiLayers,
    title: 'Multi-tenant isolation',
    body: 'Schema-level org tenancy. Every query scoped by organization_id. No cross-tenant reads, no shared queues, no shared cache namespaces.',
    accent: 'from-[#ff7a00] to-[#e81e2b]',
  },
  {
    icon: FiKey,
    title: 'Recordings encrypted at rest',
    body: 'Calls and WhatsApp call recordings stored AES-encrypted in object storage. Per-organization retention rules. Signed-URL access only.',
    accent: 'from-[#e81e2b] to-[#ff7a00]',
  },
  {
    icon: FiShield,
    title: 'Authentication',
    body: 'Bcrypt-hashed passwords, JWT + Redis sessions, MFA support, optional Google OAuth, force-logout flag honoured on every request.',
    accent: 'from-[#ff7a00] to-[#ff4d00]',
  },
  {
    icon: FiActivity,
    title: 'Observability',
    body: 'Structured Winston logs, Sentry for errors, Grafana for metrics. Audit log for sensitive actions. PII scrubbed before it leaves the app.',
    accent: 'from-[#ff4d00] to-[#e81e2b]',
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
    <main id="main-content" className="min-h-screen bg-[#101011] text-white">
      <BreadcrumbListSchema
        items={[
          { name: 'Home', url: '/' },
          { name: 'Security', url: '/security' },
        ]}
      />

      <section className="relative overflow-hidden bg-[#101011] py-20 sm:py-28">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-32 top-0 h-96 w-96 rounded-full bg-[#ff4d00]/10 blur-[140px]"
        />

        <div className="relative mx-auto max-w-4xl px-6 lg:px-10">
          <div className="text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[#ff7838]">
              Security
            </p>

            <h1 className="mt-3 text-4xl font-bold tracking-tight text-white sm:text-5xl lg:text-6xl">
              Enterprise-grade security for every{' '}
              <span className="bg-gradient-to-r from-[#ff7a00] via-[#ff4d00] to-[#e81e2b] bg-clip-text text-transparent">
                call, message &amp; recording
              </span>
              .
            </h1>

            <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-[#a1a1aa]">
              Voice carries the most sensitive data your customers will ever share. Here&rsquo;s how
              we keep it locked down across calls, WhatsApp, AI, and recording.
            </p>
          </div>
        </div>
      </section>

      <section className="relative bg-[#101011] pb-12">
        <div className="mx-auto max-w-7xl px-6 lg:px-10">
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {pillars.map((p) => {
              const Icon = p.icon;

              return (
                <div
                  key={p.title}
                  className="group relative flex flex-col overflow-hidden rounded-3xl border border-[#2d2d31] bg-[#171719] p-6 transition-all duration-300 hover:-translate-y-1 hover:border-[#71331e] hover:bg-[#1c1c1f]"
                >
                  <span
                    className={`flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br ${p.accent} text-white shadow-lg shadow-orange-950/30`}
                  >
                    <Icon size={18} />
                  </span>

                  <h3 className="mt-4 text-lg font-bold text-white">
                    {p.title}
                  </h3>

                  <p className="mt-2 text-sm leading-relaxed text-[#a1a1aa]">
                    {p.body}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="relative bg-[#101011] py-16 sm:py-20">
        <div className="mx-auto max-w-4xl px-6 lg:px-10">
          <div className="rounded-3xl border border-[#2d2d31] bg-[#171719] p-8 shadow-xl shadow-black/20 sm:p-12">
            <h2 className="text-2xl font-bold text-white sm:text-3xl">
              Compliance posture
            </h2>

            <p className="mt-3 text-sm text-[#a1a1aa]">
              Where we are today. Independent audits in flight; status will change as artefacts
              land.
            </p>

            <ul className="mt-6 space-y-3">
              {compliance.map((c) => (
                <li
                  key={c}
                  className="flex items-start gap-3 rounded-xl border border-[#2d2d31] bg-[#101011] p-3"
                >
                  <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-[#ff6a00]/15 text-[#ff7838] ring-1 ring-[#ff6a00]/30">
                    <FiCheck size={12} strokeWidth={3} />
                  </span>

                  <span className="text-sm text-[#d4d4d8]">
                    {c}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="relative bg-[#101011] py-16 sm:py-20">
        <div className="mx-auto max-w-3xl px-6 text-center lg:px-10">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[#ff7838]">
            Disclosure
          </p>

          <h2 className="mt-3 text-2xl font-bold text-white sm:text-3xl">
            Found something?
          </h2>

          <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-[#a1a1aa]">
            We take vulnerability reports seriously. Email{' '}
            <a
              href="mailto:security@arixcall.com"
              className="font-semibold text-[#ff7838] transition-colors hover:text-[#ff9b65] hover:underline"
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
              className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-[#ff7a00] via-[#ff4d00] to-[#e81e2b] px-7 py-3 text-sm font-bold text-white shadow-lg shadow-orange-950/30 transition hover:scale-[1.02]"
            >
              Other questions? Contact us
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
