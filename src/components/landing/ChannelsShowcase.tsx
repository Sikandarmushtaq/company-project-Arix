'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';

const WRAP = 'mx-auto w-full max-w-[1240px] px-7';
const HEAD = 'font-display font-black leading-[0.88] tracking-[0.005em]';

/* film-grain overlay used on every photo (design: .photo::after) */
const NOISE = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`;

function Grain() {
  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 opacity-20 mix-blend-overlay"
      style={{ backgroundImage: NOISE }}
    />
  );
}

function Photo({ src, position = '', className = '' }: { src: string; position?: string; className?: string }) {
  return (
    <div className={`relative overflow-hidden bg-[#0c0c0c] ${className}`}>
      <Image
        src={src}
        alt=""
        fill
        sizes="(max-width: 880px) 100vw, 50vw"
        className={`object-cover grayscale contrast-[1.08] ${position}`}
      />
      <Grain />
    </div>
  );
}

/* ---- live lead statuses (design: 1.5s ticker) ---- */

const LEADS = ['Sarah K.', 'Marcus T.', 'Priya N.', 'Daniel O.'];
const STATUSES = ['Dialing', 'Qualified', 'Voicemail', 'Transferred'];

function useLeadStatuses() {
  const [statuses, setStatuses] = useState<string[]>(() => LEADS.map(() => STATUSES[0]));

  useEffect(() => {
    let k = 0;
    const id = setInterval(() => {
      const next = STATUSES[(k * 3 + Math.floor(k / 4)) % STATUSES.length];
      setStatuses((prev) => prev.map((s, i) => (i === k % LEADS.length ? next : s)));
      k += 1;
    }, 1500);
    return () => clearInterval(id);
  }, []);

  return statuses;
}

export default function ChannelsShowcase() {
  const statuses = useLeadStatuses();

  return (
    <section id="channels" className="bg-ink pt-1 font-body text-[17px] leading-[1.55] text-bone">
      <div className={WRAP}>
        <h2 className={`${HEAD} max-w-[12ch] text-[clamp(54px,8.4vw,126px)]`}>
          Everything your team dials with, in one place.
        </h2>
        <p className="mt-[22px] max-w-[54ch] text-dim">
          Stop stitching tools together. Voice, an AI auto-dialer, bulk SMS and recording run from a
          single softphone: one login, one bill, one inbox.
        </p>
      </div>

      {/* AI auto-dialer band */}
      <div className="mt-[70px] grid grid-cols-1 min-[880px]:grid-cols-2 min-[880px]:min-h-[660px]">
        <Photo
          src="/images/dialer-agent.webp"
          position="object-[50%_30%]"
          className="min-h-[400px] min-[880px]:min-h-[520px]"
        />
        <div className="flex flex-col justify-center gap-6 bg-ink-2 px-7 py-[60px] min-[880px]:py-20 min-[880px]:pl-[6vw] min-[880px]:pr-[7vw]">
          <h3 className={`${HEAD} text-[clamp(46px,6vw,88px)]`}>AI-dialer</h3>
          <p className="max-w-[44ch] text-dim">
            An AI agent works your list, qualifies leads in real time, detects voicemail, and
            warm-transfers live, interested people straight to a rep. Your team only talks to buyers.
          </p>
          <div className="border-t border-line">
            {LEADS.map((name, i) => (
              <div key={name} className="flex items-center justify-between border-b border-line py-[13px]">
                <span>{name}</span>
                <b className={`font-medium ${statuses[i] === 'Transferred' ? 'text-ember' : 'text-fog'}`}>
                  {statuses[i]}
                </b>
              </div>
            ))}
          </div>
          <p className="text-[15px] text-dim">Qualified leads over the last 7 days: up 24%</p>
        </div>
      </div>

      {/* three panels */}
      <div className="mt-[2px] grid grid-cols-1 gap-[2px] min-[880px]:grid-cols-3">
        <div className="bg-ink-2">
          <Photo src="/images/calls-switch.webp" className="h-[290px]" />
          <div className="px-7 pt-[26px] pb-[34px]">
            <h3 className={`${HEAD} text-[clamp(34px,4.2vw,58px)]`}>Carrier-grade calls</h3>
            <p className="mt-2.5 max-w-[34ch] text-[#b0b0b0]">
              HD voice on your own SIP trunks, sub-200ms setup, failover built in. Bring your carrier
              or use ours.
            </p>
          </div>
        </div>

        <div className="bg-ink-2">
          <div className="relative grid h-[290px] place-items-center overflow-hidden bg-[radial-gradient(60%_70%_at_50%_55%,#4a4a4a,#101010_75%)]">
            <Grain />
            <div className="grid h-[250px] w-[150px] place-items-center rounded-[26px] border-[3px] border-[#333] bg-[radial-gradient(circle_at_50%_40%,#e8e5df,#7d7a75_70%)] text-center text-[#111] shadow-[0_0_80px_10px_rgba(255,255,255,0.18)]">
              <div>
                <b className="block font-display font-black text-[100px] leading-none">32</b>
                <small className="-mt-4 block text-[13px]">sends a second</small>
              </div>
            </div>
          </div>
          <div className="px-7 pt-[26px] pb-[34px]">
            <h3 className={`${HEAD} text-[clamp(34px,4.2vw,58px)]`}>Bulk SMS</h3>
            <p className="mt-2.5 max-w-[34ch] text-[#b0b0b0]">
              SIM-rate campaigns with scheduling, rotation, delivery tracking and opt-out handling.
              No shortcode markup.
            </p>
          </div>
        </div>

        <div className="bg-ink-2">
          <Photo src="/images/recording-mic.webp" position="object-[50%_40%]" className="h-[290px]" />
          <div className="px-7 pt-[26px] pb-[34px]">
            <h3 className={`${HEAD} text-[clamp(34px,4.2vw,58px)]`}>Call recording</h3>
            <p className="mt-2.5 max-w-[34ch] text-[#b0b0b0]">
              Every call captured, encrypted at rest, with searchable transcripts and per-org
              retention.
            </p>
          </div>
        </div>
      </div>

      {/* secure strip */}
      <div className="relative mt-[2px] overflow-hidden">
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[url('/images/texture-concrete.webp')] bg-repeat bg-[length:700px_auto]"
        />
        <div aria-hidden="true" className="absolute inset-0 bg-[rgba(6,6,6,0.7)]" />
        <div
          className={`${WRAP} relative flex flex-wrap items-center justify-between gap-[30px] py-11`}
        >
          <h3 className={`${HEAD} text-[clamp(34px,4.2vw,58px)]`}>Secure and compliant</h3>
          <p className="max-w-[56ch] text-[#c4c4c4]">
            TLS 1.3 and SRTP, multi-tenant isolation, and consent-aware recording. Enterprise-ready
            from day one.
          </p>
        </div>
      </div>
    </section>
  );
}