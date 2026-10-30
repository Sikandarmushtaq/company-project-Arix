import React from 'react';
import { FiAlertCircle, FiCheck, FiRotateCcw } from 'react-icons/fi';

interface RecycledNumberHistoryChoiceProps {
  value: boolean; // false = start clean, true = bring history over
  onChange: (importHistory: boolean) => void;
}

export function RecycledNumberHistoryChoice({
  value,
  onChange,
}: RecycledNumberHistoryChoiceProps) {
  return (
    <div className="rounded-xl border border-amber-300 dark:border-amber-800/60 bg-amber-50/70 dark:bg-amber-950/20 p-4 space-y-3">
      <div className="flex items-start gap-2.5">
        <FiAlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
        <div>
          <h4 className="text-sm font-semibold text-[var(--foreground)]">
            This number was previously assigned
          </h4>
          <p className="text-xs text-[var(--muted-foreground)] mt-0.5 leading-relaxed">
            This phone number contains previous call or message history from another user.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
        {/* Choice 1: Start clean (recommended) */}
        <button
          type="button"
          onClick={() => onChange(false)}
          className={`flex flex-col text-left p-3 rounded-xl border transition-all ${
            !value
              ? 'border-[var(--primary)] bg-[var(--card)] shadow-sm ring-1 ring-[var(--primary)]'
              : 'border-[var(--border)] bg-[var(--card)] hover:border-[var(--foreground)]/30'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[var(--foreground)]">Start clean</span>
            <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">
              Recommended
            </span>
          </div>
          <p className="text-[11px] text-[var(--muted-foreground)] mt-1 leading-relaxed">
            The new member starts without the previous user&apos;s visible history.
          </p>
        </button>

        {/* Choice 2: Bring history over */}
        <button
          type="button"
          onClick={() => onChange(true)}
          className={`flex flex-col text-left p-3 rounded-xl border transition-all ${
            value
              ? 'border-[var(--primary)] bg-[var(--card)] shadow-sm ring-1 ring-[var(--primary)]'
              : 'border-[var(--border)] bg-[var(--card)] hover:border-[var(--foreground)]/30'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[var(--foreground)]">Bring history over</span>
            <FiRotateCcw className="w-3.5 h-3.5 text-[var(--muted-foreground)]" />
          </div>
          <p className="text-[11px] text-[var(--muted-foreground)] mt-1 leading-relaxed">
            The new member inherits the prior conversation and call history attached to this number.
          </p>
        </button>
      </div>
    </div>
  );
}
