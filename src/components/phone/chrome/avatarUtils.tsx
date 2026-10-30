import React from 'react';
import { FiUser } from 'react-icons/fi';

/** Deterministic avatar palette + initials — shared by the media panels. */
export const AV_COLORS = [
  '#7a52c9', '#0d9488', '#d97706', '#2563eb', '#dc2626', '#1f7a53', '#8a5a2b', '#0891b2',
];

export function colorFor(key: string): string {
  let h = 0;
  for (const ch of key) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return AV_COLORS[h % AV_COLORS.length];
}

export function initialsOf(name: string): string {
  return (
    name.split(' ').map((w) => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || '#'
  );
}

/**
 * Avatar keyed on the resolved display name. When there's no real name — the
 * name is missing, equals the number, or is ONLY phone-number characters
 * (a formatted number like "(425) 631-8784", where initials would be garbage
 * like "(4") — it shows a neutral person silhouette (RingCentral / iOS
 * convention). Names in any script (incl. non-Latin) still get real initials.
 */
const NUMBER_ONLY = /^[\d\s()+.-]+$/;

export function GenericAvatar({
  name,
  number,
  size,
}: {
  name: string;
  number: string;
  size: number;
}) {
  const isNum = !name || name === number || NUMBER_ONLY.test(name);
  const style: React.CSSProperties = { width: size, height: size };
  if (isNum) {
    return (
      <div
        style={style}
        className="rounded-full bg-[var(--muted)] grid place-items-center shrink-0 text-[var(--muted-foreground)]"
      >
        <FiUser style={{ width: size * 0.5, height: size * 0.5 }} />
      </div>
    );
  }
  return (
    <div
      style={{ ...style, background: colorFor(name) }}
      className="rounded-full grid place-items-center shrink-0 text-white font-black"
    >
      <span style={{ fontSize: size * 0.34 }}>{initialsOf(name)}</span>
    </div>
  );
}

/** m:ss clock for player/durations. */
export function fmtClock(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) seconds = 0;
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}
