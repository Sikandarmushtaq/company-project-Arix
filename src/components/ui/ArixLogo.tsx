import React from 'react';

/**
 * ArixMark — the official ArixCall logomark: the coral→amber gradient "A" with
 * the phone-handset negative space and signal waves. Transparent PNG, so it reads
 * on both light and dark surfaces (theme-agnostic). `size` is the rendered height
 * in px; width scales to the mark's natural aspect.
 */
export function ArixMark({ size = 36, className }: { size?: number; className?: string }) {
  return (
    <img
      src="/arix-mark.png?v=1"
      alt="ArixCall"
      style={{ height: size, width: 'auto' }}
      className={className}
    />
  );
}

/**
 * ArixWordmark — "Arix" (foreground) + "Call" (coral), per the brand lockup.
 * "Arix" uses --foreground so it flips to white on dark surfaces automatically.
 */
export function ArixWordmark({
  className,
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <span className={`font-black tracking-tight leading-none ${className ?? ''}`} style={style}>
      <span className="text-[var(--foreground)]">Arix</span>
      <span className="text-[var(--coral)]">Call</span>
    </span>
  );
}

/**
 * ArixLogo — the full horizontal lockup (mark + wordmark). `markSize` is the
 * mark height in px; the wordmark scales to match.
 */
export function ArixLogo({
  markSize = 34,
  className,
}: {
  markSize?: number;
  className?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className ?? ''}`}>
      <ArixMark size={markSize} />
      <ArixWordmark style={{ fontSize: markSize * 0.62 }} />
    </span>
  );
}

export default ArixMark;
