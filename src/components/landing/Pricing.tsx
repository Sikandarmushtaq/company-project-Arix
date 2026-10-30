"use client"

const WRAP = 'mx-auto w-full max-w-[1240px] px-7';
const HEAD = 'font-display font-black leading-[0.88] tracking-[0.005em]';

const BTN = 'inline-block rounded-full border-[1.5px] border-bone/50 bg-black/35 px-[30px] py-4 font-semibold text-bone transition-colors hover:border-ember hover:bg-ember hover:text-[#140703]';
const BTN_PRIMARY = 'inline-block rounded-full border-[1.5px] border-bone bg-bone px-[30px] py-4 font-semibold text-[#111] transition-colors hover:border-ember hover:bg-ember hover:text-[#140703]';

const BASIC_FEATURES = [
  'Multi Devices',
  'Unlimited domestic calls',
  'SMS enabled',
  'Call recording',
  'Email support',
];

const PRO_FEATURES = [
  'Everything in Basic',
  'Unlimited domestic calling + volume SMS packages',
  'Instant SMS activation',
  'Custom user and usage limits',
  'Advanced analytics',
  'Dedicated support + SLA',
];

function Feature({ children }: { children: string }) {
  return (
    <li className="relative pl-[22px] text-[#cfcfcf]">
      <span aria-hidden="true" className="absolute top-[0.62em] left-0 h-0.5 w-2.5 bg-bone" />
      {children}
    </li>
  );
}

export default function Pricing() {
  return (
    <section
      id="pricing"
      className="bg-ink pt-1 pb-[120px] font-body text-[17px] leading-[1.55] text-bone"
    >
      <div className={WRAP}>
        <h2 className={`${HEAD} max-w-[11ch] text-[clamp(54px,8.4vw,126px)]`}>
          Pick the channels you need.
        </h2>
        <p className="mt-[22px] max-w-[54ch] text-dim">
          Start with unlimited domestic calls and SMS on Basic. Move up to Pro for higher SMS
          limits and dedicated support the day you need it, with no surprise add-ons.
        </p>

        <div className="mt-16 grid max-w-[900px] grid-cols-1 gap-[2px] min-[880px]:grid-cols-2">
          {/* Basic — most popular */}
          <div className="border-t-4 border-ember bg-ink-3 px-9 pt-10 pb-11">
            <span className="mb-2.5 inline-block text-[13px] font-semibold text-ember">
              Most popular
            </span>
            <h3 className={`${HEAD} text-[clamp(34px,4.2vw,58px)]`}>Basic</h3>
            <p className="mt-2 text-dim">Calls + SMS to get your team started.</p>
            <div className="mt-[22px] mb-1 font-display text-[84px] leading-none font-black">
              $59
              <small className="ml-2 font-body text-base font-normal text-fog">/user/mo</small>
            </div>
            <ul className="my-[26px] grid gap-3">
              {BASIC_FEATURES.map((f) => (
                <Feature key={f}>{f}</Feature>
              ))}
            </ul>
            <a href="/signup" className={BTN_PRIMARY}>
              Get started
            </a>
          </div>

          {/* Pro */}
          <div className="bg-ink-2 px-9 pt-10 pb-11">
            <h3 className={`${HEAD} mt-[33px] text-[clamp(34px,4.2vw,58px)]`}>Pro</h3>
            <p className="mt-2 text-dim">Higher limits and dedicated support for growing teams.</p>
            <div className="mt-[22px] mb-1 font-display text-[84px] leading-none font-black">
              Custom
            </div>
            <ul className="my-[26px] grid gap-3">
              {PRO_FEATURES.map((f) => (
                <Feature key={f}>{f}</Feature>
              ))}
            </ul>
            <a href="/contact" className={BTN}>
              Contact sales
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
