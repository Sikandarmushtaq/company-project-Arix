
import type { Metadata } from 'next';
import Link from 'next/link';
import { FiCpu, FiMessageSquare, FiMic, FiPhoneCall } from 'react-icons/fi';
import { BreadcrumbListSchema } from '@/lib/seo/schemas';

export const metadata: Metadata = {
  title: 'About ArixCall — Multi-Channel Cloud Dialer',
  description:
    'ArixCall builds a unified cloud dialer for revenue teams worldwide. Learn about our mission, team, and why sales orgs pick ArixCall over Aircall.',
  alternates: { canonical: '/about' },
  openGraph: {
    title: 'About ArixCall — Multi-Channel Cloud Dialer',
    description:
      'Why ArixCall exists and the conviction behind a unified softphone for voice calls, an AI auto-dialer, bulk SMS and compliance recording.',
    url: '/about',
  },
};

const beliefs = [
  {
    icon: FiPhoneCall,
    title: 'Customers don’t think in channels.',
    body: 'Your dialer shouldn’t either. Calls, SMS, AI agents — they’re all just conversations. They belong in one place.',
  },
  {
    icon: FiMessageSquare,
    title: 'Follow-up is where deals are won.',
    body: 'Every call deserves a text. Bulk SMS at SIM rates — no shortcode tax, no A2P markup — so you reach the whole list and stay top of mind.',
  },
  {
    icon: FiCpu,
    title: 'AI is a tool, not a replacement.',
    body: 'Our AI auto-dialer qualifies leads in real time, then warm-transfers to a human the moment intent shows up. Humans close. AI saves their time.',
  },
  {
    icon: FiMic,
    title: 'Recording isn’t optional.',
    body: 'Coaching, compliance, dispute resolution. Every conversation — searchable, encrypted, retained on your terms.',
  },
];

export default function AboutPage() {
  return (
    <main id="main-content" className="min-h-screen overflow-hidden bg-[#101011] text-white">
      <BreadcrumbListSchema
        items={[
          { name: 'Home', url: '/' },
          { name: 'About', url: '/about' },
        ]}
      />

      <section className="relative bg-[#101011] py-20 sm:py-28">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-32 top-0 h-96 w-96 rounded-full bg-[#ff4d00]/10 blur-[140px]"
        />

        <div className="relative mx-auto max-w-4xl px-6 lg:px-10">
          <div className="text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[#ff7838]">
              About
            </p>

            <h1 className="mt-3 text-4xl font-bold tracking-tight text-white sm:text-5xl lg:text-6xl">
              Built for the way{' '}
              <span className="bg-gradient-to-r from-[#ff7a00] via-[#ff4d00] to-[#e81e2b] bg-clip-text text-transparent">
                modern sales teams
              </span>{' '}
              actually sell.
            </h1>

            <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-[#a1a1aa] sm:text-xl">
              Every dialer in the market was missing one of the channels modern revenue teams
              actually use. So we built one that has all of them.
            </p>
          </div>
        </div>
      </section>

      <section className="relative bg-[#101011] py-12 sm:py-16">
        <div className="mx-auto max-w-4xl px-6 lg:px-10">
          <div className="rounded-3xl border border-[#2d2d31] bg-[#171719] p-8 shadow-xl sm:p-12">
            <h2 className="text-2xl font-bold text-white sm:text-3xl">
              The story
            </h2>

            <div className="mt-5 space-y-4 text-base leading-relaxed text-[#b4b4bb]">
              <p>
                ArixCall started where every dialer story starts: with a sales team frustrated by the
                tools they were forced to use. Calls in one app, an AI dialer in another, a third
                tool for SMS, a fourth for recording. Three browser tabs open before the day even
                began.
              </p>

              <p>
                None of the &ldquo;all-in-one&rdquo; vendors actually were. Twilio Flex made you build
                it all yourself. RingCentral didn&rsquo;t do AI dialing. Aircall didn&rsquo;t do bulk
                SMS or AI. Google Voice barely did real calling. Every team ended up assembling their
                own stack, and every tab change was context lost.
              </p>

              <p>
                So we built ArixCall: carrier-grade voice, a fully functional AI auto-dialer with
                natural-sounding voice, bulk SIM-based SMS campaigns, and compliance-grade recording.
                One softphone. One inbox. Every channel, no more tabs.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="relative bg-[#101011] py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-6 lg:px-10">
          <div className="text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[#ff7838]">
              What we believe
            </p>

            <h2 className="mt-3 text-3xl font-bold text-white sm:text-4xl">
              Four convictions that shape every decision.
            </h2>
          </div>

          <div className="mt-12 grid gap-5 sm:grid-cols-2">
            {beliefs.map((b) => {
              const Icon = b.icon;

              return (
                <div
                  key={b.title}
                  className="group relative overflow-hidden rounded-3xl border border-[#2d2d31] bg-[#171719] p-7 transition-all duration-300 hover:-translate-y-1 hover:border-[#71331e] hover:bg-[#1c1c1f]"
                >
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#ff7a00] to-[#e81e2b] text-white shadow-lg shadow-orange-950/30 transition-transform duration-300 group-hover:scale-105">
                    <Icon size={20} />
                  </span>

                  <h3 className="mt-5 text-xl font-bold text-white">
                    {b.title}
                  </h3>

                  <p className="mt-2 text-sm leading-relaxed text-[#a1a1aa]">
                    {b.body}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="relative bg-[#101011] py-16 sm:py-20">
        <div className="mx-auto max-w-3xl px-6 text-center lg:px-10">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[#ff7838]">
            Built by
          </p>

          <h2 className="mt-3 text-3xl font-bold text-white sm:text-4xl">
            Bitnex Technologies.
          </h2>

          <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-[#a1a1aa]">
            We&rsquo;re a small team of engineers who&rsquo;ve been building telephony for years.
            ArixCall is what we wished we&rsquo;d had at every prior company. We&rsquo;re shipping it
            so you don&rsquo;t have to wait the way we did.
          </p>
        </div>
      </section>

      <section className="relative bg-[#101011] py-16 sm:py-20">
        <div className="mx-auto max-w-5xl px-6 lg:px-10">
          <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-[#171719] p-10 text-center shadow-2xl shadow-black/30 sm:p-14">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -left-32 -top-32 h-80 w-80 rounded-full bg-[#ff4d00]/15 blur-[120px]"
            />

            <div
              aria-hidden="true"
              className="pointer-events-none absolute -bottom-40 -right-20 h-80 w-80 rounded-full bg-[#e81e2b]/10 blur-[120px]"
            />

            <div className="relative">
              <h2 className="text-3xl font-bold text-white sm:text-4xl">
                Run every channel from one dialer.
              </h2>

              <p className="mx-auto mt-4 max-w-xl text-base text-[#a1a1aa]">
                Two minutes to start. No credit card required.
              </p>

              <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Link
                  href="/signup/start"
                  className="inline-flex w-full items-center justify-center rounded-full bg-gradient-to-r from-[#ff7a00] via-[#ff4d00] to-[#e81e2b] px-7 py-3.5 text-sm font-bold text-white shadow-lg shadow-orange-950/30 transition hover:scale-[1.04] sm:w-auto"
                >
                  Start Free Trial
                </Link>

                <Link
                  href="/contact"
                  className="inline-flex w-full items-center justify-center rounded-full border border-white/20 bg-white/5 px-7 py-3.5 text-sm font-semibold text-white transition hover:border-[#ff6a00] hover:bg-[#ff6a00] sm:w-auto"
                >
                  Talk to us
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
