'use client';
const WRAP = 'mx-auto w-full max-w-[1240px] px-7';
const HEAD = 'font-display font-black leading-[0.88] tracking-[0.005em]';

const COLS = ['Capability', 'ArixCall', 'Twilio Flex', 'RingCentral', 'Google Voice'];

const ROWS: string[][] = [
  ['Voice calls', 'Yes', 'Yes', 'Yes', 'Yes'],
  ['Bulk SIM SMS campaigns', 'Yes', 'Partial', 'Partial', 'No'],
  ['Built-in AI auto-dialer', 'Yes', 'No', 'No', 'No'],
  ['Warm transfer, AI to human', 'Yes', 'No', 'No', 'No'],
  ['Single softphone for all', 'Yes', 'No', 'Partial', 'No'],
  ['Multi-tenant org isolation', 'Yes', 'Partial', 'Yes', 'Partial'],
];

function valueClass(v: string) {
  if (v === 'Yes') return 'text-bone';
  if (v === 'Partial') return 'text-[#8a8a8a]';
  return 'text-[#555]';
}

export default function Comparison() {
  return (
    <section
      id="compare"
      className="bg-[#101010] pt-1 pb-[120px] font-body text-[17px] leading-[1.55] text-bone"
    >
      <div className={WRAP}>
        <h2 className={`${HEAD} max-w-[12ch] text-[clamp(54px,8.4vw,126px)]`}>
          Why teams switch from the rest.
        </h2>
        <p className="mt-[22px] max-w-[54ch] text-dim">
          Public capabilities as of 2026. Partial means the vendor offers a workaround, not a
          native feature. We update this when they ship.
        </p>

        <div className="mt-[60px] overflow-x-auto">
          <table className="w-full min-w-[680px] border-collapse">
            <thead>
              <tr>
                {COLS.map((c, i) => (
                  <th
                    key={c}
                    className={`border-b border-line px-4 pb-5 text-center font-display text-[28px] leading-none font-extrabold text-fog first:pl-0 first:text-left ${
                      i === 1 ? 'border-b-[3px] border-b-ember text-bone' : ''
                    }`}
                  >
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ROWS.map((row) => (
                <tr key={row[0]}>
                  {row.map((cell, ci) => (
                    <td
                      key={ci}
                      className={`border-b border-line px-4 py-[18px] text-center first:pl-0 first:text-left first:font-medium ${
                        ci === 1 ? 'bg-white/5 font-semibold text-bone' : valueClass(cell)
                      }`}
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
