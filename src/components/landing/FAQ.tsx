'use client';
const WRAP = 'mx-auto w-full max-w-[1240px] px-7';
const HEAD = 'font-display font-black leading-[0.88] tracking-[0.005em]';

const FAQS = [
  {
    q: 'Can I bring my own SIP trunk?',
    a: 'Yes. ArixCall is carrier-agnostic. We support direct SIP trunking from any major provider, bring Twilio, Bandwidth, Telnyx, or your own carrier, and route inbound, outbound, or both. Default outbound is via our trunk if you don\u2019t bring one.',
  },
  {
    q: 'How does the bulk SIM SMS campaign feature work?',
    a: 'Campaigns run at SIM rates with scheduling, rotation, delivery tracking and opt-out handling, and no shortcode markup.',
  },
  {
    q: 'How long does it take to spin up the AI auto-dialer?',
    a: 'Under a day from sign-up to your first live call. Upload a CSV or sync your CRM, set your concurrency and calling hours, and the agent starts working your list.',
  },
  {
    q: 'Is it secure and compliant?',
    a: 'TLS 1.3 and SRTP, multi-tenant isolation, and consent-aware recording. Recordings are encrypted at rest with per-org retention.',
  },
];

export default function FAQ() {
  return (
    <section
      id="faq"
      className="relative overflow-hidden pt-1 pb-[120px] font-body text-[17px] leading-[1.55] text-bone"
    >
      {/* concrete texture + dark veil */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[url('/images/texture-concrete.webp')] bg-repeat bg-[length:720px_auto]"
      />
      <div aria-hidden="true" className="absolute inset-0 bg-[rgba(6,6,6,0.85)]" />

      <div className={`${WRAP} relative grid grid-cols-1 gap-[70px] min-[880px]:grid-cols-[0.8fr_1.2fr]`}>
        <div className="self-start min-[880px]:sticky min-[880px]:top-[90px]">
          <h2 className={`${HEAD} text-[clamp(50px,6.4vw,96px)]`}>
            Everything you&rsquo;d ask before switching.
          </h2>
          <p className="mt-[22px] text-dim">
            Still curious? Email{' '}
            <a
              href="mailto:support@arixcall.com"
              className="text-bone underline decoration-transparent decoration-2 underline-offset-6 transition hover:decoration-ember"
            >
              support@arixcall.com
            </a>
            .
          </p>
        </div>

        {/* native accordion — name="f" keeps one item open at a time */}
        <div className="border-b border-line">
          {FAQS.map((item, i) => (
            <details key={item.q} name="f" open={i === 0} className="group border-t border-line">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-5 py-6 text-xl font-semibold [&::-webkit-details-marker]:hidden">
                {item.q}
                <span
                  aria-hidden="true"
                  className="text-[30px] leading-none font-normal text-fog transition-transform duration-250 group-open:rotate-45 group-open:text-ember"
                >
                  +
                </span>
              </summary>
              <p className="max-w-[60ch] pr-10 pb-[26px] text-dim">{item.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
