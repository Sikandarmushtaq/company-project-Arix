import React, { useState, useRef, useEffect } from 'react';
import {
  FiMoreVertical,
  FiPhone,
  FiUserCheck,
  FiUserX,
  FiSliders,
  FiX,
  FiPlus,
} from 'react-icons/fi';
import { OrgNumberItem } from './types';
import { NumberTypeBadge } from './NumberTypeBadge';
import { NumberStatusBadge } from './NumberStatusBadge';
import { formatPhoneUS } from '@/lib/utils/phone';
import { Button } from '@/components/ui';

interface NumbersTableProps {
  numbers: OrgNumberItem[];
  onSelectNumber: (number: OrgNumberItem) => void;
  onAssignMember: (number: OrgNumberItem) => void;
  onUnassignMember: (number: OrgNumberItem) => void;
  onOpenAddNumber: () => void;
  onResetFilters: () => void;
  isFiltered: boolean;
  atCap: boolean;
}

function getInitials(name: string): string {
  return (
    name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase())
      .join('') || 'U'
  );
}

export function NumbersTable({
  numbers,
  onSelectNumber,
  onAssignMember,
  onUnassignMember,
  onOpenAddNumber,
  onResetFilters,
  isFiltered,
  atCap,
}: NumbersTableProps) {
  const [activeMenuId, setActiveMenuId] = useState<number | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close kebab menu when clicking outside
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setActiveMenuId(null);
      }
    };
    if (activeMenuId !== null) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [activeMenuId]);

  // Empty state when search or filters return 0 results
  if (numbers.length === 0 && isFiltered) {
    return (
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-12 text-center space-y-3">
        <div className="w-12 h-12 rounded-full bg-[var(--muted)] text-[var(--muted-foreground)] grid place-items-center mx-auto">
          <FiX className="w-6 h-6" />
        </div>
        <h3 className="text-base font-bold text-[var(--foreground)]">No numbers match your filters</h3>
        <p className="text-xs text-[var(--muted-foreground)] max-w-sm mx-auto">
          Try adjusting your search query, assignment filter, or status filter to see other numbers.
        </p>
        <div className="pt-2">
          <Button variant="outline" size="sm" onClick={onResetFilters}>
            Reset Filters
          </Button>
        </div>
      </div>
    );
  }

  // Empty state when org has 0 numbers at all
  if (numbers.length === 0 && !isFiltered) {
    return (
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-12 text-center space-y-4">
        <div className="w-12 h-12 rounded-full bg-blue-50 dark:bg-blue-950/40 text-[var(--primary)] grid place-items-center mx-auto">
          <FiPhone className="w-6 h-6" />
        </div>
        <div>
          <h3 className="text-base font-bold text-[var(--foreground)]">No phone numbers yet</h3>
          <p className="text-xs text-[var(--muted-foreground)] max-w-sm mx-auto mt-1">
            Add your organization&apos;s first phone number to start making calls, receiving inbound
            traffic, and sending SMS.
          </p>
        </div>
        <div className="pt-2">
          <Button onClick={onOpenAddNumber} disabled={atCap} className="inline-flex items-center gap-2">
            <FiPlus className="w-4 h-4" />
            <span>Add Number</span>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-sm">
      <div className="overflow-x-auto min-h-[280px] pb-12">
        <table className="w-full text-left text-sm border-collapse min-w-[760px]">
          <thead className="bg-[var(--muted)]/40 border-b border-[var(--border)] text-[11px] uppercase tracking-wider text-[var(--muted-foreground)] font-semibold">
            <tr>
              <th className="px-5 py-2.5">Phone Number</th>
              <th className="px-4 py-2.5">Caller ID (CNAM)</th>
              <th className="px-4 py-2.5">Assigned To</th>
              <th className="px-4 py-2.5">Type</th>
              <th className="px-4 py-2.5">Status</th>
              <th className="px-5 py-2.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {numbers.map((num, index) => {
              const formatted = formatPhoneUS(num.phoneNumber);
              const regionText = [num.locality, num.region].filter(Boolean).join(', ') || num.countryCode;

              // Top rows (index 0 & 1) ALWAYS open downward to prevent header clipping; bottom rows (index >= 2) open upward
              const openUpward = index >= 2 && index >= numbers.length - 2;
              const menuPosClass = openUpward ? 'bottom-full mb-1' : 'top-full mt-1';

              return (
                <tr
                  key={num.id}
                  onClick={() => onSelectNumber(num)}
                  className="transition-colors cursor-pointer group hover:bg-[var(--muted)]/40"
                >
                  {/* PHONE NUMBER */}
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-lg bg-[var(--muted)]/60 text-[var(--muted-foreground)] group-hover:text-[var(--primary)] group-hover:bg-[var(--primary)]/10 grid place-items-center text-xs shrink-0 transition-colors">
                        <FiPhone className="w-3.5 h-3.5" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-sm font-mono text-[var(--foreground)] truncate group-hover:text-[var(--primary)] transition-colors">
                          {formatted}
                        </div>
                        <div className="text-xs text-[var(--muted-foreground)] truncate">
                          {regionText}
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* CALLER ID NAME */}
                  <td className="px-4 py-3 whitespace-nowrap">
                    {num.callerIdName ? (
                      <span className="text-sm font-medium text-[var(--foreground)]">
                        {num.callerIdName}
                      </span>
                    ) : (
                      <span className="text-xs italic text-[var(--muted-foreground)]">
                        Not set
                      </span>
                    )}
                  </td>

                  {/* ASSIGNED TO */}
                  <td className="px-4 py-3 whitespace-nowrap">
                    {num.assignedUserName ? (
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-[var(--primary-600)] text-white text-[11px] font-bold grid place-items-center shrink-0">
                          {getInitials(num.assignedUserName)}
                        </div>
                        <div className="min-w-0">
                          <span className="text-xs font-semibold text-[var(--foreground)] block truncate max-w-[130px]">
                            {num.assignedUserName}
                          </span>
                          {num.assignedUserRole && (
                            <span className="text-[10px] text-[var(--muted-foreground)] capitalize block">
                              {num.assignedUserRole}
                            </span>
                          )}
                        </div>
                      </div>
                    ) : (
                      <span className="text-xs text-[var(--muted-foreground)] italic">
                        Unassigned
                      </span>
                    )}
                  </td>

                  {/* TYPE */}
                  <td className="px-4 py-3 whitespace-nowrap">
                    <NumberTypeBadge type={num.numberType} />
                  </td>

                  {/* STATUS */}
                  <td className="px-4 py-3 whitespace-nowrap">
                    <NumberStatusBadge status={num.isActive} />
                  </td>

                  {/* ACTIONS */}
                  <td
                    className="px-5 py-3 text-right whitespace-nowrap"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div
                      className="relative inline-block text-left"
                      ref={activeMenuId === num.id ? menuRef : null}
                    >
                      <button
                        type="button"
                        onClick={() => setActiveMenuId(activeMenuId === num.id ? null : num.id)}
                        className="p-1.5 rounded-lg text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)] transition-colors"
                        aria-label={`Actions for ${formatted}`}
                      >
                        <FiMoreVertical className="w-4 h-4" />
                      </button>

                      {/* 3-Dot Dropdown Menu */}
                      {activeMenuId === num.id && (
                        <div className={`absolute right-0 ${menuPosClass} w-44 rounded-xl bg-[var(--card)] border border-[var(--border)] shadow-xl py-1 z-50 text-left text-xs animate-in fade-in zoom-in-95 duration-100`}>
                          <button
                            type="button"
                            onClick={() => {
                              setActiveMenuId(null);
                              onSelectNumber(num);
                            }}
                            className="w-full flex items-center gap-2.5 px-3.5 py-2 text-[var(--foreground)] hover:bg-[var(--muted)] transition-colors"
                          >
                            <FiSliders className="w-3.5 h-3.5 text-[var(--muted-foreground)]" />
                            <span>Manage number</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setActiveMenuId(null);
                              onAssignMember(num);
                            }}
                            className="w-full flex items-center gap-2.5 px-3.5 py-2 text-[var(--foreground)] hover:bg-[var(--muted)] transition-colors"
                          >
                            <FiUserCheck className="w-3.5 h-3.5 text-blue-500" />
                            <span>{num.assignedUserId ? 'Reassign member' : 'Assign member'}</span>
                          </button>

                          {num.assignedUserId && (
                            <button
                              type="button"
                              onClick={() => {
                                setActiveMenuId(null);
                                onUnassignMember(num);
                              }}
                              className="w-full flex items-center gap-2.5 px-3.5 py-2 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/20 transition-colors"
                            >
                              <FiUserX className="w-3.5 h-3.5" />
                              <span>Unassign</span>
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
