import React from 'react';
import { TeamMember } from './types';

interface AccessSummaryProps {
  member: TeamMember;
}

export function AccessSummary({ member }: AccessSummaryProps) {
  if (member.role === 'owner') {
    return (
      <span className="text-xs font-medium text-purple-700 dark:text-purple-300">
        Full organization access
      </span>
    );
  }

  if (member.role === 'manager') {
    return (
      <span className="text-xs text-[var(--muted-foreground)] font-normal">
        Manager role
      </span>
    );
  }

  return <span className="text-xs text-[var(--muted-foreground)]">Standard member access</span>;
}
