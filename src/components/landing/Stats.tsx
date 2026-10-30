const WRAP = 'mx-auto w-full max-w-[1240px] px-7';

const STATS = [
  { value: '42%', label: 'Connect rate', sub: 'up 18%', hot: true },
  { value: '148', label: 'Dials an hour', sub: 'up 3 times', hot: false },
  { value: '+38%', label: 'Meetings a week', sub: 'up week on week', hot: false },
  { value: '99.9%', label: 'Uptime', sub: 'backed by the SLA', hot: false },
];

export default function Stats() {
  return (
    <section
      id="about"
      className="relative overflow-hidden bg-ink pt-1 pb-[120px] font-body text-[17px] leading-[1.55] text-bone"
    >
      {/* bokeh background + dark veil */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[url('/images/stats-bokeh.webp')] bg-cover bg-[position:center_60%]"
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[linear-gradient(180deg,rgba(6,6,6,0.92),rgba(6,6,6,0.6)_50%,rgba(6,6,6,0.94))]"
      />

      <div
        className={`${WRAP} relative z-10 grid grid-cols-2 gap-x-6 gap-y-[50px] min-[880px]:grid-cols-4 min-[880px]:gap-y-6`}
      >
        {STATS.map((s) => (
          <div key={s.label}>
            <div
              className={`font-display font-black leading-[0.88] tracking-[0.005em] text-[clamp(66px,10vw,152px)] ${
                s.hot ? 'text-ember' : ''
              }`}
            >
              {s.value}
            </div>
            <p className="mt-3 font-medium text-[#d0d0d0]">{s.label}</p>
            <p className="mt-11 flex min-h-[190px] items-end text-sm text-[#9a9a9a]">{s.sub}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
