"use client"

const WRAP = 'mx-auto w-full max-w-[1240px] px-7';
const HEAD = 'font-display font-black leading-[0.88] tracking-[0.005em]';

/* ---- chart geometry (design: viewBox 640x330, baseline y=310) ---- */

const DATA = [18, 24, 22, 31, 36, 33, 44, 52, 58, 71];
const W = 640;
const H = 300;
const MIN = Math.min(...DATA);
const MAX = Math.max(...DATA);

const POINTS = DATA.map((v, i) => {
  const x = (i / (DATA.length - 1)) * W;
  const y = H - (0.08 + ((v - MIN) / (MAX - MIN)) * 0.8) * H;
  return [x, y] as const;
});
const LAST = POINTS[POINTS.length - 1];
const POLYLINE = POINTS.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');

const FACTS = [
  { value: '$1.2M', label: 'pipeline created, up 64% quarter on quarter' },
  { value: '1,284', label: 'calls a week' },
  { value: '61', label: 'meetings booked' },
  { value: '18h', label: 'talk time' },
  { value: '< 1 day', label: 'from sign-up to first live call' },
];

export default function ByTheNumbers() {
  return (
    <section
      id="results"
      className="relative overflow-hidden pt-1 pb-[130px] font-body text-[17px] leading-[1.55] text-bone"
    >
      {/* concrete texture + dark veil */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[url('/images/texture-concrete.webp')] bg-repeat bg-[length:720px_auto]"
      />
      <div aria-hidden="true" className="absolute inset-0 bg-[rgba(6,6,6,0.82)]" />

      <div className={`${WRAP} relative`}>
        <h2 className={`${HEAD} max-w-[12ch] text-[clamp(54px,8.4vw,126px)]`}>
          Fewer dials. More conversations.
        </h2>
        <p className="mt-[22px] max-w-[54ch] text-dim">
          When the AI does the dialing and every call is measured, reps spend their time talking to
          buyers, and the pipeline shows it.
        </p>

        <div className="mt-[70px] grid grid-cols-1 items-center gap-[60px] min-[880px]:grid-cols-[0.8fr_1.2fr]">
          <div>
            <div className={`${HEAD} text-[clamp(120px,17vw,250px)]`}>3.2&times;</div>
            <p className="mt-3 max-w-[24ch] text-dim">more live conversations per rep</p>
          </div>

          <svg
            viewBox="0 0 640 330"
            role="img"
            aria-label="Pipeline created over the last 8 weeks, reaching 1.2 million dollars"
            className="h-auto w-full overflow-visible"
          >
            <line x1="0" y1="310" x2="640" y2="310" stroke="#333" />
            <polyline
              fill="none"
              stroke="#efede8"
              strokeWidth="2.5"
              strokeLinejoin="round"
              points={POLYLINE}
            />
            <circle cx={LAST[0]} cy={LAST[1]} r="9" fill="#ff6542" />
            <text x={LAST[0] - 16} y={LAST[1] + 4} textAnchor="end" fontSize="15" fill="#d8d8d8">
              $1.2M pipeline created
            </text>
            <text x="0" y="328" fontSize="15" fill="#8f8f8f">
              8 weeks ago
            </text>
            <text x="640" y="328" textAnchor="end" fontSize="15" fill="#8f8f8f">
              This week
            </text>
          </svg>
        </div>

        <div className="mt-20 grid grid-cols-2 gap-6 border-t border-line pt-[26px] min-[880px]:grid-cols-5">
          {FACTS.map((f) => (
            <div key={f.label}>
              <b className="block font-display text-[54px] leading-none font-black">{f.value}</b>
              <span className="text-sm text-fog">{f.label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
