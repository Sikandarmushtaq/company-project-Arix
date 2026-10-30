import React from 'react';
import { FiPhone, FiUserCheck, FiUserX } from 'react-icons/fi';
import { OrgNumberItem, OrganizationNumberConfig } from './types';

interface NumbersSummaryProps {
  numbers: OrgNumberItem[];
  organization: OrganizationNumberConfig;
}

export function NumbersSummary({ numbers, organization }: NumbersSummaryProps) {
  const totalUsed = numbers.length;
  const maxAllowed = organization.maxPhoneNumbers;
  const isAtCapacity = totalUsed >= maxAllowed;
  const assignedCount = numbers.filter((n) => n.assignedUserId !== null).length;
  const unassignedCount = numbers.filter((n) => n.assignedUserId === null).length;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 py-2 px-4 rounded-xl bg-[var(--card)] border border-[var(--border)] shadow-xs">
      <div className="flex flex-wrap items-center gap-3 sm:gap-5">
        {/* Usage metric */}
        <div className="flex items-center gap-2">
          <FiPhone
            className={`w-4 h-4 shrink-0 ${
              isAtCapacity ? 'text-amber-500' : 'text-[var(--primary)]'
            }`}
          />
          <div className="flex items-baseline gap-1.5">
            <span
              className={`text-sm font-bold tracking-tight ${
                isAtCapacity
                  ? 'text-amber-600 dark:text-amber-400'
                  : 'text-[var(--foreground)]'
              }`}
            >
              {totalUsed}
              <span className="text-xs font-medium text-[var(--muted-foreground)]">
                /{maxAllowed}
              </span>
            </span>
            <span className="text-xs text-[var(--muted-foreground)]">Numbers Used</span>
            {isAtCapacity && (
              <span className="ml-1 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300">
                Limit reached
              </span>
            )}
          </div>
        </div>

        {/* Divider */}
        <div className="hidden sm:block h-3.5 w-px bg-[var(--border)]" />

        {/* Assigned metric */}
        <div className="flex items-center gap-2">
          <FiUserCheck className="w-4 h-4 shrink-0 text-emerald-500" />
          <div className="flex items-baseline gap-1.5">
            <span className="text-sm font-bold text-[var(--foreground)] tracking-tight">
              {assignedCount}
            </span>
            <span className="text-xs text-[var(--muted-foreground)]">
              Assigned
            </span>
          </div>
        </div>

        {/* Divider */}
        <div className="hidden sm:block h-3.5 w-px bg-[var(--border)]" />

        {/* Unassigned metric */}
        <div className="flex items-center gap-2">
          <FiUserX className="w-3.5 h-3.5 shrink-0 text-zinc-400" />
          <div className="flex items-baseline gap-1.5">
            <span className="text-sm font-bold text-[var(--foreground)] tracking-tight">
              {unassignedCount}
            </span>
            <span className="text-xs text-[var(--muted-foreground)]">
              Unassigned
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
