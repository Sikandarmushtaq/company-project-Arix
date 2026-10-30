'use client';

/**
 * KeypadOverlay Component
 *
 * DTMF keypad overlay for in-call digit entry.
 *
 * @module components/phone/KeypadOverlay
 */

import React from 'react';

// DTMF keypad keys
const dtmfKeys = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['*', '0', '#'],
];

// Sub-labels for DTMF keys
const keySubLabels: Record<string, string> = {
  '2': 'ABC',
  '3': 'DEF',
  '4': 'GHI',
  '5': 'JKL',
  '6': 'MNO',
  '7': 'PQRS',
  '8': 'TUV',
  '9': 'WXYZ',
};

interface KeypadOverlayProps {
  onDTMF: (key: string) => void;
}

export function KeypadOverlay({ onDTMF }: KeypadOverlayProps) {
  return (
    <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-gradient-to-b from-[var(--background)] to-[var(--muted)]/30 shadow-lg">
      <div className="p-4">
        <div className="grid grid-cols-3 gap-2 max-w-[280px] mx-auto">
          {dtmfKeys.flat().map((key) => (
            <button
              key={key}
              onClick={() => onDTMF(key)}
              className="group relative h-14 rounded-xl bg-[var(--background)] border border-[var(--border)] hover:border-[var(--primary-400)] hover:bg-[var(--primary-50)] dark:hover:bg-[var(--primary-900)]/50 transition-all duration-150 active:scale-[0.97] shadow-sm hover:shadow-md"
            >
              <span className="text-xl font-semibold text-[var(--foreground)] group-hover:text-[var(--foreground)]">
                {key}
              </span>
              {keySubLabels[key] && (
                <span className="absolute bottom-1.5 left-1/2 -translate-x-1/2 text-[9px] font-medium text-[var(--muted-foreground)] tracking-widest">
                  {keySubLabels[key]}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// Re-export for add call panel mini dialpad
export { dtmfKeys, keySubLabels };
