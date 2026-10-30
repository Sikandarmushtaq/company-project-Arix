import type { Metadata } from 'next';
import Link from 'next/link';
import {
  FiArrowRight,
  FiCheck,
  FiMessageSquare,
  FiMic,
  FiMinus,
  FiPhoneCall,
  FiX,
} from 'react-icons/fi';
import { HiSparkles } from 'react-icons/hi2';
import { BreadcrumbListSchema, FAQPageSchema } from '@/lib/seo/schemas';

const title = 'ArixCall vs Aircall: Which Dialer Wins in 2026?';
const description =
  'Honest ArixCall vs Aircall comparison: AI auto-dialer, bulk SIM SMS, call recording and pricing. See where ArixCall outperforms Aircall.';

export const metadata: Metadata = {
  title,
  description,
  keywords: [
    'aircall alternative',
    'arixcall vs aircall',
    'aircall comparison',
    'aircall ai dialer',
    'best aircall competitor',
    'aircall bulk sms alternative',
  ],
  alternates: { canonical: '/vs/aircall' },
  openGraph: {
    title,
    description,
    url: '/vs/aircall',
    type: 'website',
  },
  twitter: { card: 'summary_large_image', title, description },
};

type Verdict = 'yes' | 'partial' | 'no';

const cellRender: Record<Verdict, React.ReactNode> = {
  yes: (
    <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 ring-2 ring-emerald-500/30">
      <FiCheck size={14} strokeWidth={3} />
    </span>
  ),
  no: (
    <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-rose-500/10 text-rose-500 ring-1 ring-rose-500/20">
      <FiX size={14} />
    </span>
  ),
  partial: (
    <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-amber-500/10 text-amber-500 ring-1 ring-amber-500/20">
      <FiMinus size={14} />
    </span>
  ),
};

const matrix: { feature: string; nuxcall: Verdict; aircall: Verdict; note?: string }[] = [
  { feature: 'Voice calls', nuxcall: 'yes', aircall: 'yes' },
  { feature: 'Bulk SIM-based SMS campaigns', nuxcall: 'yes', aircall: 'no' },
  {
    feature: 'Built-in AI auto-dialer',
    nuxcall: 'yes',
    aircall: 'partial',
    note: 'Aircall has AI assistants but no auto-dialer',
  },
  { feature: 'Warm AI → human transfer', nuxcall: 'yes', aircall: 'no' },
  { feature: 'Compliance-grade call recording', nuxcall: 'yes', aircall: 'yes' },
  { feature: 'Searchable transcripts', nuxcall: 'yes', aircall: 'partial' },
  { feature: 'Multi-tenant white-label', nuxcall: 'yes', aircall: 'no' },
  { feature: 'Bring your own carrier', nuxcall: 'yes', aircall: 'partial' },
];

const reasons = [
  {
    icon: HiSparkles,
    accent: 'from-[var(--coral)] to-[var(--coral-700)]',
    title: 'A real AI auto-dialer, not just an assistant',
    body: 'Aircall ships AI assistants that summarise calls and surface insights. Useful, but they do not pick up the phone. ArixCall includes a fully functional AI auto-dialer that runs your list, qualifies in real time, and warm-transfers ready buyers to a human agent.',
  },
  {
    icon: FiMessageSquare,
    accent: 'from-[var(--primary-600)] to-[var(--primary-700)]',
    title: 'Bulk SMS at SIM rates',
    body: 'Aircall does not offer bulk SMS campaigns. ArixCall ships native bulk SIM-based sending — no shortcode rentals, no A2P markup, with rate control, multi-SIM rotation and real-time delivery state.',
  },
  {
    icon: FiPhoneCall,
    accent: 'from-[var(--primary-600)] to-[var(--primary-700)]',
    title: 'Bring your own carrier',
    body: 'Aircall locks you to their telephony. ArixCall is carrier-agnostic — bring Twilio, Bandwidth, Telnyx or your own carrier for inbound, outbound or both. Useful when you have negotiated rates or geo-specific numbers.',
  },
  {
    icon: FiMic,
    accent: 'from-[var(--accent-500)] to-[var(--accent-600)]',
    title: 'Searchable transcripts, not just recordings',
    body: 'Aircall records calls; finding the moment that matters is manual. ArixCall transcribes every call and makes it searchable — jump to the objection, the pricing question, or the competitor mention in seconds.',
  },
];

const faqItems = [
  {
    q: 'Is ArixCall a drop-in Aircall replacement?',
    a: 'For voice-only teams, yes — ArixCall covers the same calling capabilities with parity on call recording, IVR, queues and CRM integrations. The bigger reason teams switch is the capabilities Aircall does not have: a real AI auto-dialer and bulk SMS campaigns.',
  },
  {
    q: 'How does ArixCall pricing compare to Aircall?',
    a: 'ArixCall starts at $60/user/month for the Starter plan covering voice calls and call recording. The Professional plan at $120 adds bulk SMS and the AI auto-dialer — features Aircall either lacks or sells as expensive add-ons. The Custom plan adds bespoke scale and integrations.',
  },
  {
    q: 'Can I migrate my existing Aircall numbers?',
    a: 'Yes. ArixCall supports number porting from Aircall (and Twilio, RingCentral, Dialpad). Migration takes 5-15 business days depending on your carrier of record. We handle the porting paperwork.',
  },
  {
    q: 'Does ArixCall integrate with my CRM the same way Aircall does?',
    a: 'ArixCall ships native integrations with HubSpot, Salesforce, Pipedrive and Zoho, plus an open webhook API. Call dispositions, recordings and AI transcripts sync automatically — same coverage as Aircall.',
  },
];

export default function ArixCallVsAircallPage() {
  return (
    <main id="main-content">
      <BreadcrumbListSchema
        items={[
          { name: 'Home', url: '/' },
          { name: 'Compare', url: '/compare' },
          { name: 'ArixCall vs Aircall', url: '/vs/aircall' },
        ]}
      />
      <FAQPageSchema items={faqItems} />

      {/* Hero */}
      <section className="relative py-20 sm:py-28">
        <div className="mx-auto max-w-4xl px-6 text-center lg:px-10">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[var(--foreground)]">
            Honest comparison · 2026
          </p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-5xl lg:text-6xl">
            ArixCall vs Aircall: which dialer{' '}
            <span className="bg-gradient-to-r from-[var(--coral)] to-[var(--accent-600)] bg-clip-text text-transparent">
              wins for sales teams
            </span>
            ?
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-slate-600 dark:text-slate-300">
            Both run modern voice calls. Only one runs a real AI auto-dialer, bulk SMS campaigns,
            and compliance recording in the same softphone. Here is the honest matrix.
          </p>
          <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/signup/start"
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[var(--primary-600)] px-7 py-3.5 text-sm font-bold text-white shadow-lg shadow-black/30 transition hover:scale-[1.03] hover:bg-[var(--primary-700)] sm:w-auto"
            >
              Start free trial
              <FiArrowRight size={14} />
            </Link>
            <Link
              href="/contact"
              className="inline-flex w-full items-center justify-center rounded-full border border-slate-200/80 bg-white/60 px-7 py-3.5 text-sm font-semibold text-slate-700 backdrop-blur transition hover:border-transparent hover:bg-[#f0ece8] dark:border-white/20 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10 sm:w-auto"
            >
              Migrate from Aircall
            </Link>
          </div>
        </div>
      </section>

      {/* TL;DR verdict */}
      <section className="relative py-12">
        <div className="mx-auto max-w-4xl px-6 lg:px-10">
          <div className="rounded-3xl border border-slate-200/80 bg-white/70 p-8 shadow-xl backdrop-blur dark:border-white/10 dark:bg-[#1e1e1e]/60 sm:p-10">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--foreground)]">
              TL;DR
            </p>
            <h2 className="mt-3 text-2xl font-bold text-slate-900 dark:text-white sm:text-3xl">
              If your team only does outbound voice, Aircall is fine. If you want AI to qualify your
              list, run bulk SMS campaigns, or need searchable call recordings — pick ArixCall.
            </h2>
            <p className="mt-4 text-base leading-relaxed text-slate-600 dark:text-slate-300">
              Aircall is a solid voice-only product with mature CRM integrations. ArixCall is a
              broader multi-channel platform — same voice call depth, plus an AI auto-dialer and bulk
              SMS Aircall does not natively offer.
            </p>
          </div>
        </div>
      </section>

      {/* Comparison matrix */}
      <section id="matrix" className="relative py-16 sm:py-20">
        <div className="mx-auto max-w-5xl px-6 lg:px-10">
          <div className="text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[var(--foreground)]">
              Side by side
            </p>
            <h2 className="mt-3 text-3xl font-bold text-slate-900 dark:text-white sm:text-4xl">
              Feature-by-feature
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-sm text-slate-600 dark:text-slate-300">
              Public capabilities as of 2026. Partial means a workaround exists, not a native
              feature. We update when Aircall ships.
            </p>
          </div>

          <div className="mt-10 overflow-hidden rounded-3xl border border-slate-200/80 bg-white/70 shadow-2xl shadow-black/10 backdrop-blur dark:border-white/10 dark:bg-[#1e1e1e]/60">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-200/80 dark:border-white/10">
                    <th className="px-5 py-5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Capability
                    </th>
                    <th className="px-3 py-5 text-center">
                      <span className="inline-block bg-gradient-to-r from-[var(--coral)] to-[var(--accent-600)] bg-clip-text text-base font-bold tracking-tight text-transparent">
                        ArixCall
                      </span>
                    </th>
                    <th className="px-3 py-5 text-center">
                      <span className="inline-block bg-gradient-to-r from-slate-400 to-slate-500 bg-clip-text text-base font-bold tracking-tight text-transparent">
                        Aircall
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {matrix.map((row, i) => (
                    <tr
                      key={row.feature}
                      className={`border-b border-slate-200/60 transition hover:bg-[var(--primary-600)]/[0.03] dark:border-white/5 ${
                        i % 2 === 1 ? 'bg-[#f7f5f3]/50 dark:bg-white/[0.02]' : ''
                      }`}
                    >
                      <td className="px-5 py-4 text-left">
                        <p className="font-medium text-slate-800 dark:text-slate-200">
                          {row.feature}
                        </p>
                        {row.note && (
                          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                            {row.note}
                          </p>
                        )}
                      </td>
                      <td className="bg-gradient-to-b from-[var(--primary-600)]/[0.04] to-[var(--coral)]/[0.06] px-3 py-4 text-center">
                        {cellRender[row.nuxcall]}
                      </td>
                      <td className="px-3 py-4 text-center">{cellRender[row.aircall]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {/* 5 reasons */}
      <section className="relative py-16 sm:py-20">
        <div className="mx-auto max-w-7xl px-6 lg:px-10">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[var(--foreground)]">
              Four reasons teams switch
            </p>
            <h2 className="mt-3 text-3xl font-bold text-slate-900 dark:text-white sm:text-4xl">
              Where ArixCall pulls ahead
            </h2>
          </div>
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {reasons.map((r) => {
              const Icon = r.icon;
              return (
                <div
                  key={r.title}
                  className="relative overflow-hidden rounded-3xl border border-slate-200/80 bg-white/70 p-7 shadow-sm backdrop-blur transition hover:border-transparent hover:shadow-2xl dark:border-white/10 dark:bg-[#1e1e1e]/60"
                >
                  <span
                    className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${r.accent} text-white shadow-lg`}
                  >
                    <Icon size={20} />
                  </span>
                  <h3 className="mt-5 text-lg font-bold text-slate-900 dark:text-white">
                    {r.title}
                  </h3>
                  <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                    {r.body}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="relative py-16 sm:py-20">
        <div className="mx-auto max-w-3xl px-6 lg:px-10">
          <div className="text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[var(--foreground)]">
              Switching FAQs
            </p>
            <h2 className="mt-3 text-3xl font-bold text-slate-900 dark:text-white sm:text-4xl">
              What teams ask before moving
            </h2>
          </div>
          <div className="mt-10 space-y-4">
            {faqItems.map((item) => (
              <div
                key={item.q}
                className="rounded-2xl border border-slate-200/80 bg-white/70 p-6 backdrop-blur dark:border-white/10 dark:bg-[#1e1e1e]/60"
              >
                <h3 className="text-base font-bold text-slate-900 dark:text-white sm:text-lg">
                  {item.q}
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                  {item.a}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative py-16 sm:py-20">
        <div className="mx-auto max-w-5xl px-6 lg:px-10">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[var(--primary-700)] via-[var(--primary-900)] to-[#121212] p-10 text-center text-white shadow-2xl shadow-black/30 sm:p-14">
            <h2 className="text-3xl font-bold sm:text-4xl">
              See ArixCall against Aircall in your own setup.
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-base text-white/85">
              Start a free trial in two minutes. Full AI dialer + bulk SMS + recording, no credit card.
            </p>
            <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href="/signup/start"
                className="inline-flex w-full items-center justify-center rounded-full bg-white px-7 py-3.5 text-sm font-bold text-[#191919] shadow-xl transition hover:scale-[1.04] sm:w-auto"
              >
                Start free trial
              </Link>
              <Link
                href="/contact"
                className="inline-flex w-full items-center justify-center rounded-full border border-white/30 px-7 py-3.5 text-sm font-semibold text-white transition hover:bg-white/10 sm:w-auto"
              >
                Talk to sales about migration
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
