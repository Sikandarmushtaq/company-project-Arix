"use client"
const WRAP = 'mx-auto w-full max-w-[1240px] px-7';
const HEAD = 'font-display font-black leading-[0.88] tracking-[0.005em]';

const SLABS = [
  {
    title: 'Drop in your list',
    text: 'Upload a CSV or sync from your CRM. Phone numbers, names, dynamic context per row.',
    height: 'min-[880px]:h-[230px]',
  },
  {
    title: 'AI agent dials',
    text: 'Agents ring the list at your concurrency limit, in your calling hours, against your DNC.',
    height: 'min-[880px]:h-[310px]',
  },
  {
    title: 'Qualifies in real time',
    text: 'Holds a real conversation, scores intent, collects answers, detects voicemail.',
    height: 'min-[880px]:h-[390px]',
  },
  {
    title: 'Warm transfer',
    text: 'On intent, the call routes live to a human agent on their ArixCall softphone.',
    height: 'min-[880px]:h-[470px]',
  },
  {
    title: 'Recorded and searchable',
    text: 'Transcript, audio and analysis stored per org. Searchable inside the dashboard.',
    height: 'min-[880px]:h-[550px]',
  },
];

export default function HowItWorks() {
  return (
    <section
      id="how-it-works"
      className="relative overflow-hidden bg-[#0a0a0a] pt-1 font-body text-[17px] leading-[1.55] text-bone"
    >
      {/* stairs background over the top 75% */}
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-3/4 bg-[url('/images/how-stairs.jpg')] bg-cover bg-[position:center_35%] opacity-[0.34] grayscale contrast-[1.1] [mask-image:linear-gradient(180deg,#000_35%,transparent)]"
      />

      <div className={`${WRAP} relative`}>
        <div className="mb-[70px] flex flex-col items-start justify-between gap-[30px] min-[880px]:flex-row min-[880px]:items-end">
          <h2 className={`${HEAD} max-w-[11ch] text-[clamp(54px,8.4vw,126px)]`}>
            From cold list to warm handoff in five steps.
          </h2>
          <p className="max-w-[32ch] text-dim">
            Each step takes the list one level closer to a person who wants to talk.
          </p>
        </div>
      </div>

      {/* five rising slabs */}
      <div className="relative grid grid-cols-1 items-end gap-[2px] min-[880px]:grid-cols-5">
        {SLABS.map((slab, i) => (
          <div
            key={slab.title}
            className={`border-l-[3px] border-[#4a4a4a] bg-[linear-gradient(180deg,#303030,#171717_60%)] px-6 pt-[26px] pb-[30px] ${slab.height} min-[880px]:border-l-0 min-[880px]:border-t-2 ${
              i === SLABS.length - 1 ? 'min-[880px]:border-t-[#ffcfb8]' : ''
            }`}
          >
            <h3 className="mb-2.5 font-display text-[36px] leading-[0.95] font-extrabold">
              {slab.title}
            </h3>
            <p className="max-w-[24ch] text-[15px] text-[#a9a9a9]">{slab.text}</p>
          </div>
        ))}

        {/* light beam hitting the last slab (desktop only) */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute right-0 bottom-[550px] hidden h-[260px] w-1/5 bg-[linear-gradient(180deg,transparent,rgba(255,200,160,0.5)_70%,#fff)] [clip-path:polygon(30%_0,70%_0,100%_100%,0_100%)] min-[880px]:block"
        />
      </div>
    </section>
  );
}
