import React from 'react';
import { FiUsers, FiUserCheck, FiSlash } from 'react-icons/fi';
import { TeamMember, OrganizationConfig } from './types';

interface TeamSummaryProps {
  members: TeamMember[];
  organization: OrganizationConfig;
}

export function TeamSummary({ members, organization }: TeamSummaryProps) {
  const totalUsed = members.length;
  const maxSeats = organization.maxUsers;
  const isAtCapacity = totalUsed >= maxSeats;
  const managersCount = members.filter((m) => m.role === 'manager').length;
  const deactivatedCount = members.filter((m) => m.status === 'inactive').length;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 py-2 px-4 rounded-xl bg-[var(--card)] border border-[var(--border)] shadow-xs">
      <div className="flex flex-wrap items-center gap-3 sm:gap-5">
        {/* Seats metric */}
        <div className="flex items-center gap-2">
          <FiUsers className={`w-4 h-4 shrink-0 ${isAtCapacity ? 'text-amber-500' : 'text-[var(--primary)]'}`} />
          <div className="flex items-baseline gap-1.5">
            <span className={`text-sm font-bold tracking-tight ${isAtCapacity ? 'text-amber-600 dark:text-amber-400' : 'text-[var(--foreground)]'}`}>
              {totalUsed}
              <span className="text-xs font-medium text-[var(--muted-foreground)]">/{maxSeats}</span>
            </span>
            <span className="text-xs text-[var(--muted-foreground)]">seats used</span>
            {isAtCapacity && (
              <span className="ml-1 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300">
                Limit reached
              </span>
            )}
          </div>
        </div>

        {/* Divider */}
        <div className="hidden sm:block h-3.5 w-px bg-[var(--border)]" />

        {/* Managers metric */}
        <div className="flex items-center gap-2">
          <FiUserCheck className="w-4 h-4 shrink-0 text-blue-500" />
          <div className="flex items-baseline gap-1.5">
            <span className="text-sm font-bold text-[var(--foreground)] tracking-tight">
              {managersCount}
            </span>
            <span className="text-xs text-[var(--muted-foreground)]">
              Manager{managersCount === 1 ? '' : 's'}
            </span>
          </div>
        </div>

        {/* Divider */}
        <div className="hidden sm:block h-3.5 w-px bg-[var(--border)]" />

        {/* Deactivated metric */}
        <div className="flex items-center gap-2">
          <FiSlash className="w-3.5 h-3.5 shrink-0 text-zinc-400" />
          <div className="flex items-baseline gap-1.5">
            <span className="text-sm font-bold text-[var(--foreground)] tracking-tight">
              {deactivatedCount}
            </span>
            <span className="text-xs text-[var(--muted-foreground)]">
              Deactivated
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
