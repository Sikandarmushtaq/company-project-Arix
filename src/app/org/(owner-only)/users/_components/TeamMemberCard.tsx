import React, { useState, useRef, useEffect } from 'react';
import {
  FiMoreVertical,
  FiEdit2,
  FiShield,
  FiLock,
  FiSlash,
  FiCheckCircle,
  FiTrash2,
  FiInfo,
} from 'react-icons/fi';
import { TeamMember } from './types';
import { RoleBadge } from './RoleBadge';
import { StatusBadge } from './StatusBadge';
import { AccessSummary } from './AccessSummary';

interface TeamMemberCardProps {
  member: TeamMember;
  onSelectMember: (member: TeamMember) => void;
  onEditMember: (member: TeamMember) => void;
  onManageAccess: (member: TeamMember) => void;
  onResetPassword: (member: TeamMember) => void;
  onDeactivateMember: (member: TeamMember) => void;
  onReactivateMember: (member: TeamMember) => void;
  onDeleteMember: (member: TeamMember) => void;
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

export function TeamMemberCard({
  member,
  onSelectMember,
  onEditMember,
  onManageAccess,
  onResetPassword,
  onDeactivateMember,
  onReactivateMember,
  onDeleteMember,
}: TeamMemberCardProps) {
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

  const isOwner = member.role === 'owner';
  const isManager = member.role === 'manager';
  const isInactive = member.status === 'inactive';
  const isBanned = member.status === 'banned';

  return (
    <div
      onClick={() => onSelectMember(member)}
      className="p-4 rounded-2xl border border-[var(--border)] bg-[var(--card)] space-y-3 shadow-sm hover:border-[var(--primary)]/40 transition-all cursor-pointer relative"
    >
      {/* Top row: Avatar, Name/Email, and Role / Action */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={`w-10 h-10 rounded-full grid place-items-center text-xs font-bold shrink-0 ${
              isOwner
                ? 'bg-purple-600 text-white shadow-sm'
                : isManager
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200'
            }`}
          >
            {getInitials(member.fullName)}
          </div>
          <div className="min-w-0">
            <h4 className="font-semibold text-sm text-[var(--foreground)] truncate">
              {member.fullName}
            </h4>
            <p className="text-xs text-[var(--muted-foreground)] truncate">{member.email}</p>
          </div>
        </div>

        {/* 3-Dot Action Menu */}
        {!isOwner && (
          <div className="relative shrink-0" ref={menuRef} onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setMenuOpen(!menuOpen)}
              className="p-1.5 rounded-lg text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)]"
              aria-label={`Actions for ${member.fullName}`}
            >
              <FiMoreVertical className="w-4 h-4" />
            </button>

            {menuOpen && (
              <div className="absolute right-0 top-full mt-1 w-44 rounded-xl bg-[var(--card)] border border-[var(--border)] shadow-xl py-1 z-30 text-left text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onEditMember(member);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-[var(--foreground)] hover:bg-[var(--muted)]"
                >
                  <FiEdit2 className="w-3.5 h-3.5" />
                  <span>Edit member</span>
                </button>

                {isManager && (
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      onManageAccess(member);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-[var(--foreground)] hover:bg-[var(--muted)]"
                  >
                    <FiShield className="w-3.5 h-3.5 text-blue-500" />
                    <span>Manage access</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onResetPassword(member);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-[var(--foreground)] hover:bg-[var(--muted)]"
                >
                  <FiLock className="w-3.5 h-3.5" />
                  <span>Reset password</span>
                </button>

                {!isBanned && (
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      if (isInactive) {
                        onReactivateMember(member);
                      } else {
                        onDeactivateMember(member);
                      }
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-[var(--foreground)] hover:bg-[var(--muted)]"
                  >
                    {isInactive ? (
                      <>
                        <FiCheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                        <span>Reactivate member</span>
                      </>
                    ) : (
                      <>
                        <FiSlash className="w-3.5 h-3.5 text-amber-500" />
                        <span>Deactivate member</span>
                      </>
                    )}
                  </button>
                )}

                <div className="border-t border-[var(--border)] my-1" />

                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onDeleteMember(member);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20"
                >
                  <FiTrash2 className="w-3.5 h-3.5" />
                  <span>Remove member</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Middle row: Badges & Phone */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[var(--border)]/60 text-xs">
        <div className="flex items-center gap-2">
          <RoleBadge role={member.role} />
          <StatusBadge status={member.status} />
        </div>
        <div className="font-mono text-xs text-[var(--muted-foreground)]">
          {member.senderPhone || <span className="italic font-sans text-xs">No phone</span>}
        </div>
      </div>

      {/* Bottom row: Access Summary */}
      <div className="pt-2 border-t border-[var(--border)]/60 flex items-center justify-between text-xs">
        <span className="text-[var(--muted-foreground)] text-[11px] font-medium">Access:</span>
        <AccessSummary member={member} />
      </div>

      {member.createdAt && (
        <div className="pt-1.5 border-t border-[var(--border)]/40 flex items-center justify-between text-[11px] text-[var(--muted-foreground)]">
          <span>Created:</span>
          <span className="font-medium text-[var(--foreground)]">
            {new Date(member.createdAt).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}
          </span>
        </div>
      )}

      {isOwner && (
        <p className="text-[10px] text-purple-700 dark:text-purple-300 italic pt-1">
          The Organization Owner role is managed at the organization level.
        </p>
      )}
    </div>
  );
}
