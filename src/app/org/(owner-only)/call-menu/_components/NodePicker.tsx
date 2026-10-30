'use client';

/**
 * Searchable step picker — the primary way to add a step. Opens at the click
 * point (a "+" on an output, a "+" on a wire, or dropping a wire on empty
 * canvas) and inserts the chosen step already connected. Beats hunting the
 * palette and dragging handle-to-handle for non-technical users.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { FiSearch, FiX } from 'react-icons/fi';
import type { IvrNodeType } from '@/lib/api/services/ivr.api';
import { NODE_META, PALETTE } from './ivrNodes';

export function NodePicker({
  x,
  y,
  onPick,
  onClose,
}: {
  x: number;
  y: number;
  onPick: (type: IvrNodeType) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState('');

  // Esc closes. Outside clicks are handled by the backdrop below, because React
  // Flow stops mousedown propagation on its canvas — a document listener would
  // never fire when clicking the canvas or a node.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const items = useMemo(
    () =>
      PALETTE.filter((t) => {
        const m = NODE_META[t];
        return `${m.label} ${m.blurb}`.toLowerCase().includes(q.trim().toLowerCase());
      }),
    [q]
  );

  const vw = typeof window !== 'undefined' ? window.innerWidth : 1280;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
  const left = Math.max(8, Math.min(x, vw - 272));
  const top = Math.max(8, Math.min(y, vh - 360));

  return (
    <>
      {/* Full-screen backdrop: reliably catches outside clicks to dismiss. */}
      <div
        onMouseDown={onClose}
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, zIndex: 55 }}
        className="nodrag nopan"
      />
      <div
        style={{ position: 'fixed', left, top, zIndex: 60 }}
        className="nodrag nopan w-64 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-2xl"
      >
        <div className="flex items-center gap-2 border-b border-[var(--border)] px-3 py-2">
          <FiSearch className="h-4 w-4 shrink-0 text-[var(--muted-foreground)]" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && items[0]) onPick(items[0]);
            }}
            placeholder="Add a step…"
            className="w-full bg-transparent text-sm text-[var(--foreground)] outline-none placeholder:text-[var(--muted-foreground)]"
          />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close step picker"
            title="Close"
            className="shrink-0 rounded-md p-1 text-[var(--muted-foreground)] hover:bg-[var(--muted)]/60 hover:text-[var(--foreground)]"
          >
            <FiX className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="max-h-72 overflow-y-auto p-1">
          {items.length === 0 && (
            <p className="px-3 py-4 text-center text-xs text-[var(--muted-foreground)]">No steps match.</p>
          )}
          {items.map((t) => {
            const m = NODE_META[t];
            return (
              <button
                key={t}
                type="button"
                onClick={() => onPick(t)}
                className="flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-[var(--muted)]/50"
              >
                <span
                  className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md"
                  style={{ background: `${m.accent}1a`, color: m.accent }}
                >
                  <m.Icon className="h-4 w-4" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-[var(--foreground)]">{m.label}</span>
                  <span className="block text-[11px] leading-snug text-[var(--muted-foreground)]">{m.blurb}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}
