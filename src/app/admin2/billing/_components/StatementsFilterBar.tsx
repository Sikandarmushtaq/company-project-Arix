'use client';

import React from 'react';
import { FiCalendar, FiFilter } from 'react-icons/fi';
import type { StatementSummary } from '@/lib/api/services/admin-billing.api';

const fmtUsd = (cents: number): string =>
  `$${((cents ?? 0) / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export type RangeFilterOption = '3m' | '6m' | 'all' | 'custom';

export function StatementsFilterBar({
  range,
  onRangeChange,
  customFrom,
  onCustomFromChange,
  customTo,
  onCustomToChange,
  status,
  onStatusChange,
  summary,
}: {
  range: RangeFilterOption;
  onRangeChange: (r: RangeFilterOption) => void;
  customFrom: string;
  onCustomFromChange: (v: string) => void;
  customTo: string;
  onCustomToChange: (v: string) => void;
  status: string;
  onStatusChange: (s: string) => void;
  summary?: StatementSummary;
}) {
  return (
    <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      {/* Top Filter Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        {/* Quick Range Chips */}
        <div className="flex flex-wrap items-center gap-1.5 rounded-xl bg-slate-100 p-1 dark:bg-slate-950">
          <button
            type="button"
            onClick={() => onRangeChange('3m')}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
              range === '3m'
                ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-white'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            Last 3 Months
          </button>

          <button
            type="button"
            onClick={() => onRangeChange('6m')}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
              range === '6m'
                ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-white'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            Last 6 Months
          </button>

          <button
            type="button"
            onClick={() => onRangeChange('all')}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
              range === 'all'
                ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-white'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            All Time
          </button>

          <button
            type="button"
            onClick={() => onRangeChange('custom')}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
              range === 'custom'
                ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-white'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            Custom Range
          </button>
        </div>

        {/* Status Dropdown */}
        <div className="flex items-center gap-2">
          <FiFilter className="h-3.5 w-3.5 text-slate-400" />
          <span className="text-xs font-bold text-slate-500">Status:</span>
          <select
            value={status}
            onChange={(e) => onStatusChange(e.target.value)}
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-800 outline-none transition focus:border-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          >
            <option value="all">All Statuses</option>
            <option value="paid">Paid in Full</option>
            <option value="partially_paid">Partially Paid</option>
            <option value="unpaid">Balance Due</option>
          </select>
        </div>
      </div>

      {/* Custom Date Pickers (Shown when range === 'custom') */}
      {range === 'custom' && (
        <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 pt-3 text-xs dark:border-slate-800">
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-slate-500">From:</span>
            <input
              type="date"
              value={customFrom}
              onChange={(e) => onCustomFromChange(e.target.value)}
              className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-bold text-slate-800 outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <span className="font-bold text-slate-500">To:</span>
            <input
              type="date"
              value={customTo}
              onChange={(e) => onCustomToChange(e.target.value)}
              className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-bold text-slate-800 outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            />
          </div>
        </div>
      )}

      {/* Summary Financial Metric Strip */}
      {summary && (
        <div className="grid grid-cols-2 gap-3 border-t border-slate-100 pt-3 sm:grid-cols-4 dark:border-slate-800">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Statements</div>
            <div className="mt-0.5 text-base font-black text-slate-900 dark:text-white">
              {summary.count}
            </div>
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Invoiced</div>
            <div className="mt-0.5 font-mono text-base font-black text-slate-900 dark:text-white">
              {fmtUsd(summary.totalInvoicedCents)}
            </div>
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Collected</div>
            <div className="mt-0.5 font-mono text-base font-black text-emerald-600 dark:text-emerald-400">
              {fmtUsd(summary.totalPaidCents)}
            </div>
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Outstanding</div>
            <div
              className={`mt-0.5 font-mono text-base font-black ${
                summary.totalOutstandingCents > 0
                  ? 'text-rose-600 dark:text-rose-400'
                  : 'text-slate-400 dark:text-slate-500'
              }`}
            >
              {fmtUsd(summary.totalOutstandingCents)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
