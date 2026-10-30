import React from 'react';
import { FiShield, FiUserCheck, FiUser } from 'react-icons/fi';
import { UserRole } from './types';

interface RoleBadgeProps {
  role: UserRole;
  className?: string;
}

export function RoleBadge({ role, className = '' }: RoleBadgeProps) {
  if (role === 'owner') {
    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300 border border-purple-200 dark:border-purple-800/40 ${className}`}
      >
        <FiShield className="w-3 h-3 text-purple-600 dark:text-purple-400" />
        Owner
      </span>
    );
  }

  if (role === 'manager') {
    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 border border-blue-200 dark:border-blue-800/40 ${className}`}
      >
        <FiUserCheck className="w-3 h-3 text-blue-600 dark:text-blue-400" />
        Manager
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 dark:bg-slate-800/60 dark:text-slate-300 border border-slate-200 dark:border-slate-700/50 ${className}`}
    >
      <FiUser className="w-3 h-3 text-slate-500" />
      Agent
    </span>
  );
}
