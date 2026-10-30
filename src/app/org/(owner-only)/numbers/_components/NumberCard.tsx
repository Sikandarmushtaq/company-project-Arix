import React, { useState, useRef, useEffect } from 'react';
import {
  FiMoreVertical,
  FiPhone,
  FiUserCheck,
  FiUserX,
  FiSliders,
} from 'react-icons/fi';
import { OrgNumberItem } from './types';
import { NumberTypeBadge } from './NumberTypeBadge';
import { NumberStatusBadge } from './NumberStatusBadge';
import { formatPhoneUS } from '@/lib/utils/phone';

interface NumberCardProps {
  number: OrgNumberItem;
  onSelectNumber: (number: OrgNumberItem) => void;
  onAssignMember: (number: OrgNumberItem) => void;
  onUnassignMember: (number: OrgNumberItem) => void;
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

export function NumberCard({
  number,
  onSelectNumber,
  onAssignMember,
  onUnassignMember,
}: NumberCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    if (menuOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [menuOpen]);

  const formatted = formatPhoneUS(number.phoneNumber);
  const regionText = [number.locality, number.region].filter(Boolean).join(', ') || number.countryCode;

  return (
    <div
      onClick={() => onSelectNumber(number)}
      className="p-4 rounded-2xl border border-[var(--border)] bg-[var(--card)] space-y-3 shadow-sm hover:border-[var(--primary)]/40 transition-all cursor-pointer relative"
    >
      {/* Top row: Phone icon + Number & Locality + 3-dot Action */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-full bg-[var(--muted)] text-[var(--muted-foreground)] grid place-items-center text-xs shrink-0">
            <FiPhone className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h4 className="font-semibold text-sm font-mono text-[var(--foreground)] truncate">
              {formatted}
            </h4>
            <p className="text-xs text-[var(--muted-foreground)] truncate">{regionText}</p>
          </div>
        </div>

        {/* 3-Dot Action Menu */}
        <div className="relative shrink-0" ref={menuRef} onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={() => setMenuOpen(!menuOpen)}
            className="p-1.5 rounded-lg text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)] transition-colors"
            aria-label={`Actions for ${formatted}`}
          >
            <FiMoreVertical className="w-4 h-4" />
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-full mt-1 w-48 rounded-xl bg-[var(--card)] border border-[var(--border)] shadow-xl py-1 z-30 text-left text-xs animate-in fade-in zoom-in-95 duration-100">
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  onSelectNumber(number);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-[var(--foreground)] hover:bg-[var(--muted)]"
              >
                <FiSliders className="w-3.5 h-3.5 text-[var(--muted-foreground)]" />
                <span>Manage number</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  onAssignMember(number);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-[var(--foreground)] hover:bg-[var(--muted)]"
              >
                <FiUserCheck className="w-3.5 h-3.5 text-blue-500" />
                <span>{number.assignedUserId ? 'Reassign member' : 'Assign member'}</span>
              </button>

              {number.assignedUserId && (
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onUnassignMember(number);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/20"
                >
                  <FiUserX className="w-3.5 h-3.5" />
                  <span>Unassign</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Middle row: Caller ID & Assigned To */}
      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[var(--border)]/60 text-xs">
        <div>
          <span className="text-[11px] font-medium text-[var(--muted-foreground)] block">
            Caller ID
          </span>
          <span className="font-medium text-[var(--foreground)] truncate block mt-0.5">
            {number.callerIdName || <span className="italic text-[var(--muted-foreground)] font-normal">Not set</span>}
          </span>
        </div>
        <div>
          <span className="text-[11px] font-medium text-[var(--muted-foreground)] block">
            Assigned To
          </span>
          {number.assignedUserName ? (
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="w-5 h-5 rounded-full bg-[var(--primary-600)] text-white text-[10px] font-bold grid place-items-center shrink-0">
                {getInitials(number.assignedUserName)}
              </span>
              <span className="font-medium text-[var(--foreground)] truncate">
                {number.assignedUserName}
              </span>
            </div>
          ) : (
            <span className="italic text-[var(--muted-foreground)] font-normal block mt-0.5">
              Unassigned
            </span>
          )}
        </div>
      </div>

      {/* Bottom row: Badges */}
      <div className="pt-2 border-t border-[var(--border)]/60 flex items-center justify-between text-xs">
        <NumberTypeBadge type={number.numberType} />
        <NumberStatusBadge status={number.isActive} />
      </div>
    </div>
  );
}
