'use client';
const WRAP = 'mx-auto w-full max-w-[1240px] px-7';
const HEAD = 'font-display font-black leading-[0.88] tracking-[0.005em]';

const BTN = 'inline-block rounded-full border-[1.5px] border-bone/50 bg-black/35 px-[30px] py-4 font-semibold text-bone transition-colors hover:border-ember hover:bg-ember hover:text-[#140703]';
const BTN_PRIMARY = 'inline-block rounded-full border-[1.5px] border-bone bg-bone px-[30px] py-4 font-semibold text-[#111] transition-colors hover:border-ember hover:bg-ember hover:text-[#140703]';

export default function CTA() {
  return (
    <section
      id="contact"
      className="relative flex min-h-[640px] items-center overflow-hidden bg-black pt-1 pb-1 font-body text-[17px] leading-[1.55] text-bone"
    >
      {/* door photo right + dark gradient left */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[url('/images/cta-door.webp')] bg-cover bg-[position:82%_center] min-[880px]:bg-[position:78%_center]"
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[linear-gradient(90deg,rgba(0,0,0,0.92)_0%,rgba(0,0,0,0.35)_55%,transparent_100%)]"
      />

      <div className={`${WRAP} relative`}>
        <h2 className={`${HEAD} max-w-[8ch] text-[clamp(64px,10vw,150px)]`}>
          Every channel. One dialer.
        </h2>
        <p className="mt-[26px] max-w-[34ch] text-[19px] text-[#cfcfcf]">
          Spin up calls, an AI auto-dialer, bulk SMS and compliance recording in days, not months.
          Built for revenue teams that can&rsquo;t afford to miss a conversation.
        </p>
        <div className="mt-[38px] flex flex-wrap gap-3">
          <a href="/signup" className={BTN_PRIMARY}>
            Start free trial
          </a>
          <a href="/contact" className={BTN}>
            Schedule a demo
          </a>
        </div>
      </div>
    </section>
  );
}
