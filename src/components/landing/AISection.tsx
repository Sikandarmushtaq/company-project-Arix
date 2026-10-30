'use client';

import { useEffect, useState } from 'react';

const WRAP = 'mx-auto w-full max-w-[1240px] px-7';
const HEAD = 'font-display font-black leading-[0.88] tracking-[0.005em]';

const CAPS = [
  'Dials in seconds, qualifies in real time',
  'Warm transfer to a human on intent',
  'Voicemail detection and custom drop messages',
  'Natural voice AI, multi-language, low latency',
];

/* ---- waveform deck data (design: 84 bars, deterministic heights) ---- */

type TrackKey = 'n' | 'p' | 'j';

const TRACKS: { key: TrackKey; name: string }[] = [
  { key: 'n', name: 'Nova' },
  { key: 'p', name: 'Sarah' },
  { key: 'j', name: 'Jordan' },
];

const SEGMENTS: Record<TrackKey, Array<[number, number]>> = {
  n: [
    [0, 20],
    [32, 52],
    [68, 86],
  ],
  p: [
    [22, 30],
    [54, 66],
  ],
  j: [[88, 100]],
};

const BAR_COUNT = 84;

const BARS = Array.from({ length: BAR_COUNT }, (_, i) => {
  const pos = (i / BAR_COUNT) * 100;
  return {
    pos,
    height: 18 + Math.abs(Math.sin(i * 1.7) * Math.cos(i * 0.6)) * 82,
    inSeg: {
      n: SEGMENTS.n.some(([a, b]) => pos >= a && pos < b),
      p: SEGMENTS.p.some(([a, b]) => pos >= a && pos < b),
      j: SEGMENTS.j.some(([a, b]) => pos >= a && pos < b),
    } as Record<TrackKey, boolean>,
  };
});

const MARKS = [
  { left: '3%', top: '0', text: 'Not a voicemail' },
  { left: '54%', top: '0', text: 'Interest heard' },
  { left: '68%', top: '24px', text: 'Warm transfer' },
  { left: '88%', top: '0', text: 'Rep joins' },
];

/* ---- subtitles + interest stairs ---- */

const SUBS = [
  { at: 0, name: 'Nova', text: 'Hi Sarah, this is Nova from ArixCall. Got a quick minute to talk about your outbound calling setup?' },
  { at: 22, name: 'Sarah', text: 'Sure, I have about two minutes.' },
  { at: 32, name: 'Nova', text: 'Perfect. Are your reps dialing lists manually today, or do you have an auto-dialer?' },
  { at: 54, name: 'Sarah', text: 'All manual, it eats up half their day.' },
  { at: 68, name: 'Nova', text: 'Got it. Let me hand you to a specialist who can show you the auto-dialer flow.' },
  { at: 88, name: 'Jordan', text: 'Hi Sarah, Jordan here. Let\u2019s take a look at your setup.' },
];

const STAIR_HEIGHTS = [20, 36, 52, 68, 84];
const GATES = [22, 32, 54, 68, 88];

/* playback: 0 -> 100% over 24s, hold 3.2s, restart (design timing) */
function usePlayback() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setProgress(100);
      return;
    }
    const DURATION = 24000;
    const HOLD = 3200;
    let raf = 0;
    let holdTimer: ReturnType<typeof setTimeout> | undefined;
    let start: number | null = null;

    const frame = (now: number) => {
      if (start === null) start = now;
      const p = Math.min(((now - start) / DURATION) * 100, 100);
      setProgress(p);
      if (p >= 100) {
        holdTimer = setTimeout(() => {
          start = null;
          raf = requestAnimationFrame(frame);
        }, HOLD);
        return;
      }
      raf = requestAnimationFrame(frame);
    };

    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      if (holdTimer) clearTimeout(holdTimer);
    };
  }, []);

  return progress;
}

export default function AISection() {
  const progress = usePlayback();

  const si = SUBS.reduce((acc, s, i) => (progress >= s.at ? i : acc), 0);
  const prevText = si > 0 ? SUBS[si - 1].text : '';

  return (
    <section
      id="ai"
      className="relative overflow-hidden bg-[#080808] pt-1 pb-[110px] font-body text-[17px] leading-[1.55] text-bone"
    >
      {/* tunnel background, faded to the right */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[url('/images/nova-tunnel.webp')] bg-cover bg-no-repeat bg-[position:right_40%] opacity-[0.36] grayscale [mask-image:linear-gradient(90deg,transparent_25%,#000_95%)]"
      />

      <div className={`${WRAP} relative`}>
        <div className="grid grid-cols-1 items-end gap-12 min-[880px]:grid-cols-[1.1fr_0.9fr]">
          <h2 className={`${HEAD} text-[clamp(54px,8.4vw,126px)]`}>
            An agent that calls, qualifies, and warm-transfers.
          </h2>
          <p className="max-w-[44ch] text-dim min-[880px]:justify-self-end">
            Spin up an AI agent that dials your list, holds a real conversation, qualifies the lead
            in real time, and warm-transfers to a rep the moment intent shows up. Voicemail-aware
            and DNC-aware out of the box.
          </p>
        </div>

        <div className="mt-14 mb-[70px] grid grid-cols-2 gap-7 border-t border-line pt-[22px] min-[880px]:grid-cols-4">
          {CAPS.map((c) => (
            <p key={c} className="max-w-[22ch] text-[#cfcfcf]">
              {c}
            </p>
          ))}
        </div>

        {/* waveform deck */}
        <div className="border-y border-line pt-[22px] pb-[14px]">
          {TRACKS.map((track, ti) => (
            <div
              key={track.key}
              className="grid h-[60px] grid-cols-[54px_1fr] items-center min-[880px]:grid-cols-[78px_1fr]"
            >
              <span className="text-sm text-fog">{track.name}</span>
              <div className="relative flex h-full items-center gap-0.5">
                {BARS.map((bar, i) => (
                  <span
                    key={i}
                    className={`flex-1 rounded-[1px] bg-[#262626] ${
                      bar.inSeg[track.key] && bar.pos <= progress ? 'bg-bone' : ''
                    }`}
                    style={{ height: bar.inSeg[track.key] ? `${bar.height}%` : '6%' }}
                  />
                ))}
                {ti === 0 && (
                  <span
                    className="absolute top-0 bottom-0 z-10 w-[2px] bg-ember shadow-[0_0_14px_#ff6542]"
                    style={{ left: `${progress}%` }}
                  />
                )}
              </div>
            </div>
          ))}

          <div className="relative mt-1.5 h-[50px] ml-[54px] min-[880px]:ml-[78px]">
            {MARKS.map((m) => (
              <span
                key={m.text}
                className="absolute border-l border-[#555] pl-2 text-[12.5px] whitespace-nowrap text-fog"
                style={{ left: m.left, top: m.top }}
              >
                {m.text}
              </span>
            ))}
          </div>
        </div>

        {/* subtitle + interest stairs */}
        <div className="mt-11 flex min-h-[190px] flex-col items-start justify-between gap-10 min-[880px]:flex-row min-[880px]:items-end">
          <div>
            <p className="mb-3.5 min-h-[30px] max-w-[46ch] font-serif text-[21px] italic text-[#5f5f5f] max-[880px]:hidden">
              {prevText}
            </p>
            <q className="block max-w-[26ch] font-serif text-[clamp(30px,3.6vw,52px)] italic leading-[1.04] [quotes:none]">
              <small className="mb-2.5 block font-body text-sm font-normal not-italic text-fog">
                {SUBS[si].name}
              </small>
              {SUBS[si].text}
            </q>
          </div>

          <div>
            <div className="flex h-[112px] items-end gap-[3px]">
              {STAIR_HEIGHTS.map((h, i) => (
                <span
                  key={h}
                  className={`w-[26px] transition-colors duration-300 ${
                    progress >= GATES[i] ? 'bg-bone' : 'bg-[#262626]'
                  }`}
                  style={{ height: `${h}%` }}
                />
              ))}
              <span
                className={`ml-1.5 block h-full w-[30px] transition-all duration-[600ms] ${
                  progress >= 88
                    ? 'bg-[linear-gradient(#fff,#ffb48e)] shadow-[0_0_60px_14px_rgba(255,120,70,0.55)]'
                    : 'bg-[#1a1a1a]'
                }`}
              />
            </div>
            <p className="mt-2 text-right text-[13px] text-fog">Interest, step by step</p>
          </div>
        </div>
      </div>
    </section>
  );
}
