import React, { useState, useRef, useEffect } from 'react';
import {
  FiMoreVertical,
  FiEdit2,
  FiShield,
  FiLock,
  FiSlash,
  FiCheckCircle,
  FiTrash2,
  FiUserPlus,
  FiX,
  FiInfo,
} from 'react-icons/fi';
import { TeamMember } from './types';
import { RoleBadge } from './RoleBadge';
import { StatusBadge } from './StatusBadge';
import { AccessSummary } from './AccessSummary';
import { Button } from '@/components/ui';

interface TeamMembersTableProps {
  members: TeamMember[];
  onSelectMember: (member: TeamMember) => void;
  onEditMember: (member: TeamMember) => void;
  onManageAccess: (member: TeamMember) => void;
  onResetPassword: (member: TeamMember) => void;
  onDeactivateMember: (member: TeamMember) => void;
  onReactivateMember: (member: TeamMember) => void;
  onDeleteMember: (member: TeamMember) => void;
  onOpenAddDrawer: () => void;
  onResetFilters: () => void;
  isFiltered: boolean;
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

export function TeamMembersTable({
  members,
  onSelectMember,
  onEditMember,
  onManageAccess,
  onResetPassword,
  onDeactivateMember,
  onReactivateMember,
  onDeleteMember,
  onOpenAddDrawer,
  onResetFilters,
  isFiltered,
}: TeamMembersTableProps) {
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
  if (members.length === 0 && isFiltered) {
    return (
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-12 text-center space-y-3">
        <div className="w-12 h-12 rounded-full bg-[var(--muted)] text-[var(--muted-foreground)] grid place-items-center mx-auto">
          <FiX className="w-6 h-6" />
        </div>
        <h3 className="text-base font-bold text-[var(--foreground)]">No team members match your filters</h3>
        <p className="text-xs text-[var(--muted-foreground)] max-w-sm mx-auto">
          Try adjusting your search query, role filter, or status filter to see other team members.
        </p>
        <div className="pt-2">
          <Button variant="outline" size="sm" onClick={onResetFilters}>
            Reset Filters
          </Button>
        </div>
      </div>
    );
  }

  // Check if owner is the ONLY member in the list
  const isOwnerOnly = members.length === 1 && members[0]?.role === 'owner';

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-sm">
      <div className="overflow-x-auto min-h-[280px] pb-12">
        <table className="w-full text-left text-sm border-collapse min-w-[860px]">
          <thead className="bg-[var(--muted)]/40 border-b border-[var(--border)] text-[11px] uppercase tracking-wider text-[var(--muted-foreground)] font-semibold">
            <tr>
              <th className="px-5 py-2.5">Team Member</th>
              <th className="px-4 py-2.5">Role</th>
              <th className="px-4 py-2.5">Phone</th>
              <th className="px-4 py-2.5">Access</th>
              <th className="px-4 py-2.5">Created At</th>
              <th className="px-4 py-2.5">Status</th>
              <th className="px-5 py-2.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {members.map((member, index) => {
              const isOwner = member.role === 'owner';
              const isManager = member.role === 'manager';
              const isInactive = member.status === 'inactive';
              const isBanned = member.status === 'banned';

              // Top rows (index 0 & 1) ALWAYS open downward to prevent header clipping; bottom rows (index >= 2) open upward
              const openUpward = index >= 2 && index >= members.length - 2;
              const menuPosClass = openUpward ? 'bottom-full mb-1' : 'top-full mt-1';

              return (
                <tr
                  key={member.id}
                  onClick={() => onSelectMember(member)}
                  className={`transition-colors cursor-pointer group ${
                    isOwner
                      ? 'bg-purple-50/20 dark:bg-purple-950/10 hover:bg-purple-50/40 dark:hover:bg-purple-950/20'
                      : 'hover:bg-[var(--muted)]/40'
                  }`}
                >
                  {/* TEAM MEMBER CELL */}
                  <td className="px-5 py-2.5">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-8 h-8 rounded-full grid place-items-center text-xs font-bold shrink-0 ${
                          isOwner
                            ? 'bg-purple-600 text-white shadow-xs'
                            : isManager
                            ? 'bg-blue-600 text-white shadow-xs'
                            : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200'
                        }`}
                      >
                        {getInitials(member.fullName)}
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-sm text-[var(--foreground)] truncate group-hover:text-[var(--primary)] transition-colors">
                          {member.fullName}
                        </div>
                        <div className="text-xs text-[var(--muted-foreground)] truncate">
                          {member.email}
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* ROLE CELL */}
                  <td className="px-4 py-2.5 whitespace-nowrap">
                    <RoleBadge role={member.role} />
                  </td>

                  {/* PHONE CELL */}
                  <td className="px-4 py-2.5 whitespace-nowrap font-mono text-xs">
                    {member.senderPhone ? (
                      <span className="text-[var(--foreground)] font-medium">
                        {member.senderPhone}
                      </span>
                    ) : (
                      <span className="text-[var(--muted-foreground)] italic font-sans text-xs">
                        Not assigned
                      </span>
                    )}
                  </td>

                  {/* ACCESS SUMMARY CELL */}
                  <td className="px-4 py-2.5">
                    <AccessSummary member={member} />
                  </td>

                  {/* CREATED AT CELL */}
                  <td className="px-4 py-2.5 whitespace-nowrap text-xs tabular-nums text-[var(--muted-foreground)]">
                    {member.createdAt ? (
                      <div>
                        <div className="font-semibold text-[var(--foreground)]">
                          {new Date(member.createdAt).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </div>
                        <div className="text-[11px] text-[var(--muted-foreground)]">
                          {new Date(member.createdAt).toLocaleTimeString('en-US', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </div>
                      </div>
                    ) : (
                      <span className="text-[var(--muted-foreground)]">—</span>
                    )}
                  </td>

                  {/* STATUS CELL */}
                  <td className="px-4 py-2.5 whitespace-nowrap">
                    <StatusBadge status={member.status} />
                  </td>

                  {/* ACTIONS CELL */}
                  <td
                    className="px-5 py-2.5 text-right whitespace-nowrap"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {isOwner ? (
                      <div
                        className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/40 border border-purple-200/60 dark:border-purple-800/40"
                        title="Organization Owner — managed at the organization level."
                      >
                        <span>Protected</span>
                        <FiInfo className="w-3 h-3 text-purple-500" />
                      </div>
                    ) : isBanned ? (
                      <div className="inline-flex items-center gap-1.5 text-xs text-red-500" title="Account is banned at the platform level. Owner actions disabled.">
                        <span className="text-[11px] italic hidden lg:inline">Platform Banned</span>
                        <FiSlash className="w-3.5 h-3.5 text-red-500" />
                      </div>
                    ) : (
                      <div className="relative inline-block text-left" ref={activeMenuId === member.id ? menuRef : null}>
                        <button
                          type="button"
                          onClick={() => setActiveMenuId(activeMenuId === member.id ? null : member.id)}
                          className="p-1.5 rounded-lg text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)] transition-colors"
                          aria-label={`Actions for ${member.fullName}`}
                        >
                          <FiMoreVertical className="w-4 h-4" />
                        </button>

                        {/* 3-Dot Dropdown Menu */}
                        {activeMenuId === member.id && (
                          <div className={`absolute right-0 ${menuPosClass} w-48 rounded-xl bg-[var(--card)] border border-[var(--border)] shadow-xl py-1 z-50 text-left text-xs animate-in fade-in zoom-in-95 duration-100`}>
                            <button
                              type="button"
                              onClick={() => {
                                setActiveMenuId(null);
                                onEditMember(member);
                              }}
                              className="w-full flex items-center gap-2.5 px-3.5 py-2 text-[var(--foreground)] hover:bg-[var(--muted)] transition-colors"
                            >
                              <FiEdit2 className="w-3.5 h-3.5 text-[var(--muted-foreground)]" />
                              <span>Edit member</span>
                            </button>

                            {isManager && (
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveMenuId(null);
                                  onManageAccess(member);
                                }}
                                className="w-full flex items-center gap-2.5 px-3.5 py-2 text-[var(--foreground)] hover:bg-[var(--muted)] transition-colors"
                              >
                                <FiShield className="w-3.5 h-3.5 text-blue-500" />
                                <span>Manage access</span>
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => {
                                setActiveMenuId(null);
                                onResetPassword(member);
                              }}
                              className="w-full flex items-center gap-2.5 px-3.5 py-2 text-[var(--foreground)] hover:bg-[var(--muted)] transition-colors"
                            >
                              <FiLock className="w-3.5 h-3.5 text-[var(--muted-foreground)]" />
                              <span>Reset password</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setActiveMenuId(null);
                                if (isInactive) {
                                  onReactivateMember(member);
                                } else {
                                  onDeactivateMember(member);
                                }
                              }}
                              className="w-full flex items-center gap-2.5 px-3.5 py-2 text-[var(--foreground)] hover:bg-[var(--muted)] transition-colors"
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

                            <div className="border-t border-[var(--border)] my-1" />

                            <button
                              type="button"
                              onClick={() => {
                                setActiveMenuId(null);
                                onDeleteMember(member);
                              }}
                              className="w-full flex items-center gap-2.5 px-3.5 py-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
                            >
                              <FiTrash2 className="w-3.5 h-3.5" />
                              <span>Remove member</span>
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* OWNER-ONLY / BUILD YOUR TEAM EMPTY STATE */}
      {isOwnerOnly && (
        <div className="border-t border-[var(--border)] p-8 text-center bg-[var(--muted)]/10 space-y-3">
          <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-950/40 text-blue-600 grid place-items-center mx-auto">
            <FiUserPlus className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-[var(--foreground)]">Build your team</h4>
            <p className="text-xs text-[var(--muted-foreground)] max-w-sm mx-auto mt-0.5">
              Add Agents to handle calls or Managers to help monitor operations.
            </p>
          </div>
          <div className="pt-1">
            <Button size="sm" onClick={onOpenAddDrawer} className="inline-flex items-center gap-1.5">
              <FiUserPlus className="w-3.5 h-3.5" />
              <span>+ Add Team Member</span>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
