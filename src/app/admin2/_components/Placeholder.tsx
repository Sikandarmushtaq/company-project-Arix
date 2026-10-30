/**
 * Shared stub for not-yet-built /admin2 pages. Each page in the roadmap replaces
 * its own stub when we reach it, so navigation works from Page 0 onward.
 */
export function Placeholder({ title, subtitle, phase }: { title: string; subtitle: string; phase: string }) {
  return (
    <section>
      <h1 className="text-3xl font-black tracking-tight">{title}</h1>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>
      <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center dark:border-slate-700 dark:bg-slate-900">
        <div className="inline-block rounded-full bg-[#FF6542]/10 px-3 py-1 text-xs font-bold text-[#FF6542]">
          {phase}
        </div>
        <h2 className="mt-4 text-xl font-extrabold">Not built yet</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-slate-500 dark:text-slate-400">
          This screen is part of the page-by-page rebuild. The shell and navigation are live; this
          page will be implemented and wired to real data when we reach it.
        </p>
      </div>
    </section>
  );
}
