import React from 'react';
import { FiAlertCircle, FiRotateCcw, FiTrash2 } from 'react-icons/fi';
import { NumberHistoryInfo } from './types';

interface RecycledNumberHistoryChoiceProps {
  assigneeName: string;
  history: NumberHistoryInfo;
  onChoice: (importHistory: boolean) => void;
  onCancel: () => void;
  isProcessing?: boolean;
}

export function RecycledNumberHistoryChoice({
  assigneeName,
  history,
  onChoice,
  onCancel,
  isProcessing = false,
}: RecycledNumberHistoryChoiceProps) {
  return (
    <div className="rounded-xl border border-amber-300 dark:border-amber-800/60 bg-amber-50/70 dark:bg-amber-950/20 p-4 space-y-3.5">
      {/* Header & Stats */}
      <div className="flex items-start gap-2.5">
        <FiAlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <h4 className="text-sm font-bold text-[var(--foreground)]">
            This number has previous history
          </h4>
          <p className="text-xs text-[var(--muted-foreground)] leading-relaxed">
            Assigning to <strong>{assigneeName}</strong>. This number has{' '}
            <strong className="text-[var(--foreground)]">{history.sms} messages</strong> and{' '}
            <strong className="text-[var(--foreground)]">{history.calls} calls</strong> from a
            previous user
            {history.pendingRetirement ? ' (scheduled for deletion)' : ''}. What should they see?
          </p>
        </div>
      </div>

      {/* Choice Buttons */}
      <div className="grid grid-cols-1 gap-2.5 pt-1">
        {/* Choice 1: Start clean (Recommended) */}
        <button
          type="button"
          disabled={isProcessing}
          onClick={() => onChoice(false)}
          className="flex flex-col text-left p-3 rounded-xl border border-[var(--primary)] bg-[var(--card)] shadow-xs ring-1 ring-[var(--primary)] hover:bg-[var(--primary)]/5 transition-all disabled:opacity-60"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[var(--foreground)] flex items-center gap-1.5">
              <FiTrash2 className="w-3.5 h-3.5 text-[var(--primary)]" />
              <span>Start clean</span>
            </span>
            <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">
              Recommended
            </span>
          </div>
          <p className="text-[11px] text-[var(--muted-foreground)] mt-1.5 leading-relaxed">
            Hide the previous user&apos;s messages and calls and schedule prior data for deletion
            after the existing grace period.
          </p>
        </button>

        {/* Choice 2: Bring history over */}
        <button
          type="button"
          disabled={isProcessing}
          onClick={() => onChoice(true)}
          className="flex flex-col text-left p-3 rounded-xl border border-[var(--border)] bg-[var(--card)] hover:border-[var(--foreground)]/30 hover:bg-[var(--muted)]/20 transition-all disabled:opacity-60"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[var(--foreground)] flex items-center gap-1.5">
              <FiRotateCcw className="w-3.5 h-3.5 text-blue-500" />
              <span>Bring history over</span>
            </span>
          </div>
          <p className="text-[11px] text-[var(--muted-foreground)] mt-1.5 leading-relaxed">
            The new assignee will see the previous call and message history attached to this number.
          </p>
        </button>
      </div>

      {/* Cancel button */}
      <div className="pt-1 flex justify-end">
        <button
          type="button"
          onClick={onCancel}
          disabled={isProcessing}
          className="text-xs font-medium text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
