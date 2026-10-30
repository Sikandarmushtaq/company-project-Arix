'use client';

import { motion } from 'framer-motion';

/**
 * Lightweight inline-SVG charts for the marketing landing. No charting library —
 * these are hand-rolled SVG/CSS so the page stays tiny. All animate on scroll
 * into view (once). Ink-first: coral is the accent, ink the default.
 */

const VIEWPORT = { once: true, margin: '-40px' } as const;

/* ── Area / line chart with gradient fill and self-drawing line. ───────────── */
export function AreaChart({
  data,
  stroke = 'var(--coral)',
  gridId = 'nxArea',
  showGrid = true,
}: {
  data: number[];
  stroke?: string;
  gridId?: string;
  showGrid?: boolean;
}) {
  const W = 320;
  const H = 96;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const y = (v: number) => H - (0.12 + ((v - min) / (max - min || 1)) * 0.76) * H;
  const x = (i: number) => (i / (data.length - 1)) * W;
  const line = data.map((v, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ');
  const area = `${line} L ${W} ${H} L 0 ${H} Z`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-full w-full" role="img" aria-label="Trend chart">
      <defs>
        <linearGradient id={gridId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.26" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      {showGrid &&
        [0.25, 0.5, 0.75].map((g) => (
          <line key={g} x1="0" x2={W} y1={H * g} y2={H * g} stroke="var(--border)" strokeWidth="1" />
        ))}
      <motion.path
        d={area}
        fill={`url(#${gridId})`}
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={VIEWPORT}
        transition={{ duration: 0.9, delay: 0.4 }}
      />
      <motion.path
        d={line}
        fill="none"
        stroke={stroke}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0 }}
        whileInView={{ pathLength: 1 }}
        viewport={VIEWPORT}
        transition={{ duration: 1.2, ease: 'easeOut', delay: 0.2 }}
      />
      <motion.circle
        cx={x(data.length - 1)}
        cy={y(data[data.length - 1])}
        r="3.5"
        fill={stroke}
        initial={{ scale: 0 }}
        whileInView={{ scale: 1 }}
        viewport={VIEWPORT}
        transition={{ duration: 0.3, delay: 1.4 }}
      />
    </svg>
  );
}

/* ── Donut with legend-ready stroke segments. ──────────────────────────────── */
export function Donut({ segments }: { segments: { label: string; value: number; color: string }[] }) {
  const R = 34;
  const C = 2 * Math.PI * R;
  const total = segments.reduce((s, x) => s + x.value, 0);
  let acc = 0;
  return (
    <div className="flex items-center gap-4">
      <svg viewBox="0 0 90 90" className="h-24 w-24 -rotate-90">
        <circle cx="45" cy="45" r={R} fill="none" stroke="var(--muted)" strokeWidth="11" />
        {segments.map((s, i) => {
          const len = (s.value / total) * C;
          const dash = `${len} ${C - len}`;
          const offset = -acc;
          acc += len;
          return (
            <motion.circle
              key={s.label}
              cx="45"
              cy="45"
              r={R}
              fill="none"
              stroke={s.color}
              strokeWidth="11"
              strokeDasharray={dash}
              strokeDashoffset={offset}
              initial={{ opacity: 0, strokeDasharray: `0 ${C}` }}
              whileInView={{ opacity: 1, strokeDasharray: dash }}
              viewport={VIEWPORT}
              transition={{ duration: 0.7, delay: 0.4 + i * 0.15, ease: 'easeOut' }}
            />
          );
        })}
      </svg>
      <ul className="space-y-1.5">
        {segments.map((s) => (
          <li key={s.label} className="flex items-center gap-2 text-xs">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />
            <span className="text-[var(--muted-foreground)]">{s.label}</span>
            <span className="font-bold text-[var(--foreground)]">
              {Math.round((s.value / total) * 100)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ── Vertical bar chart. ───────────────────────────────────────────────────── */
export function Bars({ data, className = 'h-20' }: { data: number[]; className?: string }) {
  const max = Math.max(...data);
  return (
    <div className={`flex items-end gap-1.5 ${className}`}>
      {data.map((v, i) => (
        <motion.div
          key={i}
          initial={{ height: 0 }}
          whileInView={{ height: `${(v / max) * 100}%` }}
          viewport={VIEWPORT}
          transition={{ duration: 0.6, delay: 0.2 + i * 0.05, ease: 'easeOut' }}
          className="flex-1 rounded-t bg-[var(--primary-600)]/85 dark:bg-white/25"
          style={{ minHeight: 3 }}
        />
      ))}
    </div>
  );
}

/* ── Tiny sparkline (no grid, no fill) for cards/stats. ────────────────────── */
export function Sparkline({
  data,
  stroke = 'var(--coral)',
  className = 'h-8 w-full',
}: {
  data: number[];
  stroke?: string;
  className?: string;
}) {
  const W = 100;
  const H = 32;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const y = (v: number) => H - (0.1 + ((v - min) / (max - min || 1)) * 0.8) * H;
  const x = (i: number) => (i / (data.length - 1)) * W;
  const line = data.map((v, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={className} preserveAspectRatio="none" aria-hidden="true">
      {/* Fade-in (not a draw animation) — pathLength renders as broken segments
          when the viewBox is stretched non-uniformly. */}
      <motion.path
        d={line}
        fill="none"
        stroke={stroke}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={VIEWPORT}
        transition={{ duration: 0.6, ease: 'easeOut' }}
      />
    </svg>
  );
}

/* ── Compact bar row for cards/stats. ──────────────────────────────────────── */
export function MiniBars({ data, className = 'h-8' }: { data: number[]; className?: string }) {
  const max = Math.max(...data);
  return (
    <div className={`flex items-end gap-1 ${className}`}>
      {data.map((v, i) => (
        <motion.div
          key={i}
          initial={{ height: 0 }}
          whileInView={{ height: `${(v / max) * 100}%` }}
          viewport={VIEWPORT}
          transition={{ duration: 0.5, delay: i * 0.05, ease: 'easeOut' }}
          className="flex-1 rounded-sm bg-[var(--coral)]/80"
          style={{ minHeight: 2 }}
        />
      ))}
    </div>
  );
}
