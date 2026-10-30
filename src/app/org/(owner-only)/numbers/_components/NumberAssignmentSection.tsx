import React, { useState } from 'react';
import { FiSearch, FiCheck } from 'react-icons/fi';
import { OrgNumberItem, OrgMemberOption } from './types';
import { RecycledNumberHistoryChoice } from './RecycledNumberHistoryChoice';
import { Button } from '@/components/ui';

interface NumberAssignmentSectionProps {
  number: OrgNumberItem;
  members: OrgMemberOption[];
  onAssignMember: (userId: number, importHistory?: boolean) => void;
  onUnassignMember: () => void;
  isProcessing?: boolean;
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

export function NumberAssignmentSection({
  number,
  members,
  onAssignMember,
  onUnassignMember,
  isProcessing = false,
}: NumberAssignmentSectionProps) {
  const [isSelectingMember, setIsSelectingMember] = useState(false);
  const [searchMemberQuery, setSearchMemberQuery] = useState('');
  const [pendingMemberChoice, setPendingMemberChoice] = useState<OrgMemberOption | null>(null);

  const currentAssignee = members.find((m) => m.id === number.assignedUserId);

  // Filter members in selector
  const filteredMembers = members.filter((m) => {
    if (!searchMemberQuery.trim()) return true;
    const q = searchMemberQuery.toLowerCase();
    return (
      m.fullName.toLowerCase().includes(q) ||
      m.email.toLowerCase().includes(q) ||
      m.role.toLowerCase().includes(q)
    );
  });

  // Handle member selection
  const handleSelectMember = (member: OrgMemberOption) => {
    // If the number carries recycled history, prompt user for decision first!
    if (number.history.hasHistory) {
      setPendingMemberChoice(member);
      return;
    }

    onAssignMember(member.id);
    setIsSelectingMember(false);
    setSearchMemberQuery('');
  };

  // Resolve recycled history decision
  const handleHistoryChoice = (importHistory: boolean) => {
    if (!pendingMemberChoice) return;
    onAssignMember(pendingMemberChoice.id, importHistory);
    setPendingMemberChoice(null);
    setIsSelectingMember(false);
    setSearchMemberQuery('');
  };

  return (
    <div className="space-y-3">
      <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--foreground)] border-b border-[var(--border)] pb-1.5">
        Assignment
      </h3>

      {/* Recycled History Decision Step */}
      {pendingMemberChoice && (
        <RecycledNumberHistoryChoice
          assigneeName={pendingMemberChoice.fullName}
          history={number.history}
          onChoice={handleHistoryChoice}
          onCancel={() => setPendingMemberChoice(null)}
          isProcessing={isProcessing}
        />
      )}

      {/* Normal Assignment Display / Selector */}
      {!pendingMemberChoice && (
        <>
          {!isSelectingMember ? (
            /* Current assignment card */
            <div className="p-3.5 rounded-xl border border-[var(--border)] bg-[var(--card)] space-y-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-semibold text-[var(--muted-foreground)]">
                  Assigned To
                </span>
                {number.assignedUserId && (
                  <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/40">
                    Active Assignee
                  </span>
                )}
              </div>

              {number.assignedUserId && (currentAssignee || number.assignedUserName) ? (
                /* Assigned view */
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-[var(--primary-600)] text-white text-xs font-bold grid place-items-center shrink-0">
                      {getInitials(currentAssignee?.fullName || number.assignedUserName || '')}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-[var(--foreground)] truncate">
                        {currentAssignee?.fullName || number.assignedUserName}
                      </p>
                      <p className="text-[11px] text-[var(--muted-foreground)] truncate capitalize">
                        {currentAssignee?.role || number.assignedUserRole || 'Agent'}
                        {currentAssignee?.email && ` · ${currentAssignee.email}`}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setIsSelectingMember(true)}
                      disabled={isProcessing}
                      className="text-xs font-semibold"
                    >
                      Change
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={onUnassignMember}
                      disabled={isProcessing}
                      className="text-xs font-semibold text-amber-600 dark:text-amber-400 border-amber-300 dark:border-amber-800/80 bg-amber-50/40 dark:bg-amber-950/20 hover:bg-amber-100/60 dark:hover:bg-amber-900/30 hover:border-amber-400 transition-colors"
                    >
                      Unassign
                    </Button>
                  </div>
                </div>
              ) : (
                /* Unassigned view */
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <span className="text-xs font-semibold text-[var(--muted-foreground)] italic">
                      Currently unassigned
                    </span>
                    <p className="text-[11px] text-[var(--muted-foreground)] mt-0.5">
                      Calls to this number will not route to any individual team member.
                    </p>
                  </div>

                  <Button
                    type="button"
                    size="sm"
                    onClick={() => setIsSelectingMember(true)}
                    disabled={isProcessing}
                    className="shrink-0 text-xs font-semibold"
                  >
                    Assign to team member
                  </Button>
                </div>
              )}
            </div>
          ) : (
            /* Member Selector Panel */
            <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-3 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[var(--foreground)]">
                  Select Team Member
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setIsSelectingMember(false);
                    setSearchMemberQuery('');
                  }}
                  className="text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                >
                  Cancel
                </button>
              </div>

              {/* Search Member input */}
              <div className="relative">
                <FiSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--muted-foreground)]" />
                <input
                  type="text"
                  value={searchMemberQuery}
                  onChange={(e) => setSearchMemberQuery(e.target.value)}
                  placeholder="Search team members by name or email..."
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-[var(--background)] border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)] text-[var(--foreground)]"
                />
              </div>

              {/* Members List */}
              <div className="max-h-[200px] overflow-y-auto space-y-1 divide-y divide-[var(--border)]/40 pr-1">
                {filteredMembers.length === 0 ? (
                  <div className="p-4 text-center text-xs text-[var(--muted-foreground)]">
                    No team members found.
                  </div>
                ) : (
                  filteredMembers.map((member) => {
                    const isCurrentAssignee = member.id === number.assignedUserId;
                    const alreadyHasNumber =
                      member.hasNumber && !isCurrentAssignee;

                    return (
                      <button
                        key={member.id}
                        type="button"
                        onClick={() => handleSelectMember(member)}
                        className={`w-full flex items-center justify-between p-2 rounded-lg text-left transition-colors hover:bg-[var(--muted)]/50 ${
                          isCurrentAssignee ? 'bg-[var(--primary)]/5 font-semibold' : ''
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-7 h-7 rounded-full bg-[var(--muted)] text-[var(--muted-foreground)] text-xs font-bold grid place-items-center shrink-0">
                            {getInitials(member.fullName)}
                          </div>
                          <div className="min-w-0">
                            <span className="text-xs font-semibold text-[var(--foreground)] block truncate">
                              {member.fullName}
                            </span>
                            <span className="text-[10px] text-[var(--muted-foreground)] capitalize block truncate">
                              {member.role} · {member.email}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {alreadyHasNumber && (
                            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                              Already has a number
                            </span>
                          )}
                          {isCurrentAssignee && (
                            <span className="inline-flex items-center gap-1 text-[11px] text-[var(--primary)] font-semibold">
                              <FiCheck className="w-3.5 h-3.5" />
                              <span>Current</span>
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
