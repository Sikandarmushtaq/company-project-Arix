'use client';

import React, { useState, useCallback, useRef } from 'react';
import { ROLE_BADGE_STYLES } from '@/lib/constants/status-styles';
import {
  FiEdit2,
  FiTrash2,
  FiMoreVertical,
  FiCheck,
  FiX,
  FiLoader,
  FiLock,
  FiShield,
  FiRepeat,
} from 'react-icons/fi';
import { Button, Pagination } from '@/components/ui';
import { formatLocalDate, formatAdminDateTime } from '@/lib/utils/datetime';
import type { AdminUser } from '@/lib/api/services';

// ============================================================================
// Types
// ============================================================================

export interface UsersTableProps {
  users: AdminUser[];
  isLoading: boolean;
  isFetching: boolean;
  searchQuery: string;

  // Selection
  selectedUserIds: Set<number>;
  isAllSelected: boolean;
  isSomeSelected: boolean;
  onSelectUser: (userId: number, selected: boolean) => void;
  onSelectAll: (selected: boolean) => void;

  // Actions
  onEdit: (user: AdminUser) => void;
  onToggleBan: (user: AdminUser) => void;
  onResetPassword: (user: AdminUser) => void;
  onTransfer: (user: AdminUser) => void;
  onDelete: (user: AdminUser) => void;
  isDeletePending: boolean;

  // Pagination
  pagination: {
    page: number;
    totalPages: number;
    pageSize: number;
    totalItems: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
    pageRange: number[];
    goToPage: (page: number) => void;
    setPageSize: (size: number) => void;
  };
  dataMeta: { totalPages: number } | null;
}

// ============================================================================
// UserRow (memoized)
// ============================================================================

const UserRow = React.memo(function UserRow({
  user,
  isSelected,
  onSelect,
  onEdit,
  onToggleBan,
  onResetPassword,
  onTransfer,
  onDelete,
  isDeletePending,
}: {
  user: AdminUser;
  isSelected: boolean;
  onSelect: (userId: number, selected: boolean) => void;
  onEdit: (user: AdminUser) => void;
  onToggleBan: (user: AdminUser) => void;
  onResetPassword: (user: AdminUser) => void;
  onTransfer: (user: AdminUser) => void;
  onDelete: (user: AdminUser) => void;
  isDeletePending: boolean;
}) {
  const [showMenu, setShowMenu] = useState(false);
  const [menuPosition, setMenuPosition] = useState<'above' | 'below'>('above');
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Decide whether to open the menu above or below based on viewport space.
  // Menu height is ~200px (4 items + separator + padding).
  const toggleMenu = useCallback(() => {
    if (!showMenu && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const spaceAbove = rect.top;
      const spaceBelow = window.innerHeight - rect.bottom;
      const menuHeight = 210;
      // Prefer above (matches original UX), but open below if there's not enough room
      setMenuPosition(spaceAbove >= menuHeight || spaceAbove > spaceBelow ? 'above' : 'below');
    }
    setShowMenu((prev) => !prev);
  }, [showMenu]);

  return (
    <tr className="border-b border-[var(--border)] hover:bg-[var(--muted)] transition-colors">
      <td className="py-3 px-4">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={(e) => onSelect(user.id, e.target.checked)}
          className="w-4 h-4 rounded border-[var(--border)] text-[var(--foreground)] focus:ring-[var(--primary-600)]"
          aria-label={`Select ${user.fullName || user.senderPhone}`}
        />
      </td>
      <td className="py-3 px-4 font-medium text-[var(--foreground)]">
        {user.fullName || user.senderPhone}
      </td>
      <td className="py-3 px-4 text-[var(--muted-foreground)]">{user.email}</td>
      <td className="py-3 px-4">
        <span
          className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${ROLE_BADGE_STYLES[user.role] || ROLE_BADGE_STYLES.user}`}
        >
          {user.role}
        </span>
      </td>
      <td className="py-3 px-4 text-[var(--muted-foreground)]">
        {user.organizationName || <span className="text-gray-400 italic">Unassigned</span>}
      </td>
      <td className="py-3 px-4 text-[var(--muted-foreground)] font-mono">{user.extension}</td>
      <td className="py-3 px-4">
        {user.banned ? (
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300">
            <FiX className="w-3 h-3" aria-hidden="true" />
            Banned
          </span>
        ) : (
          <span
            className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full ${
              user.isActive
                ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                : 'bg-gray-100 text-gray-700 dark:bg-gray-900 dark:text-gray-300'
            }`}
          >
            {user.isActive ? (
              <FiCheck className="w-3 h-3" aria-hidden="true" />
            ) : (
              <FiX className="w-3 h-3" aria-hidden="true" />
            )}
            {user.isActive ? 'Active' : 'Inactive'}
          </span>
        )}
      </td>
      <td className="py-3 px-4">
        <div className="flex items-center gap-2" role="group" aria-label="Feature status">
          <span
            className={`w-2 h-2 rounded-full ${user.smsEnabled ? 'bg-green-500' : 'bg-gray-400'}`}
            title={user.smsEnabled ? 'SMS Enabled' : 'SMS Disabled'}
            role="img"
            aria-label={user.smsEnabled ? 'SMS Enabled' : 'SMS Disabled'}
          />
          <span
            className={`w-2 h-2 rounded-full ${user.autoDialerEnabled ? 'bg-blue-500' : 'bg-gray-400'}`}
            title={user.autoDialerEnabled ? 'Auto-Dialer Enabled' : 'Auto-Dialer Disabled'}
            role="img"
            aria-label={user.autoDialerEnabled ? 'Auto-Dialer Enabled' : 'Auto-Dialer Disabled'}
          />
        </div>
      </td>
      <td className="py-3 px-4 text-[var(--muted-foreground)]">
        {formatLocalDate(user.createdAt)}
      </td>
      <td className="py-3 px-4 text-[var(--muted-foreground)]">
        {user.lastLogin ? (
          formatAdminDateTime(user.lastLogin)
        ) : (
          <span className="text-gray-400 italic">Never</span>
        )}
      </td>
      <td className="py-3 px-4 text-right">
        <div className="flex items-center justify-end gap-2">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Edit ${user.fullName || user.senderPhone}`}
            onClick={() => onEdit(user)}
          >
            <FiEdit2 className="w-4 h-4" aria-hidden="true" />
          </Button>
          <div className="relative">
            <Button
              ref={triggerRef}
              variant="ghost"
              size="icon-sm"
              aria-label="More options"
              onClick={toggleMenu}
            >
              <FiMoreVertical className="w-4 h-4" aria-hidden="true" />
            </Button>
            {showMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
                <div
                  className={`absolute right-0 w-48 rounded-lg border border-[var(--border)] bg-[var(--card)] shadow-lg z-50 ${
                    menuPosition === 'above' ? 'bottom-full mb-1' : 'top-full mt-1'
                  }`}
                >
                  <div className="py-1">
                    <button
                      className="w-full px-4 py-2 text-left text-sm text-[var(--foreground)] hover:bg-[var(--muted)] flex items-center gap-2"
                      onClick={() => {
                        setShowMenu(false);
                        onResetPassword(user);
                      }}
                    >
                      <FiLock className="w-4 h-4" />
                      Reset Password
                    </button>
                    <button
                      className="w-full px-4 py-2 text-left text-sm text-[var(--foreground)] hover:bg-[var(--muted)] flex items-center gap-2"
                      onClick={() => {
                        setShowMenu(false);
                        onToggleBan(user);
                      }}
                    >
                      <FiShield className="w-4 h-4" />
                      {user.banned ? 'Unban User' : 'Ban User'}
                    </button>
                    <button
                      className="w-full px-4 py-2 text-left text-sm text-[var(--foreground)] hover:bg-[var(--muted)] flex items-center gap-2"
                      onClick={() => {
                        setShowMenu(false);
                        onTransfer(user);
                      }}
                    >
                      <FiRepeat className="w-4 h-4" />
                      Transfer to New User
                    </button>
                    <div className="border-t border-[var(--border)] my-1" />
                    <button
                      className="w-full px-4 py-2 text-left text-sm text-[var(--danger)] hover:bg-[var(--muted)] flex items-center gap-2"
                      onClick={() => {
                        setShowMenu(false);
                        onDelete(user);
                      }}
                      disabled={isDeletePending}
                    >
                      <FiTrash2 className="w-4 h-4" />
                      Delete User
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </td>
    </tr>
  );
});

// ============================================================================
// Component
// ============================================================================

export function UsersTable({
  users,
  isLoading,
  isFetching,
  searchQuery,
  selectedUserIds,
  isAllSelected,
  isSomeSelected,
  onSelectUser,
  onSelectAll,
  onEdit,
  onToggleBan,
  onResetPassword,
  onTransfer,
  onDelete,
  isDeletePending,
  pagination,
  dataMeta,
}: UsersTableProps) {
  if (isLoading && users.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <FiLoader className="w-8 h-8 animate-spin text-[var(--primary)]" aria-hidden="true" />
      </div>
    );
  }

  if (users.length === 0) {
    return (
      <div className="text-center py-12 text-[var(--muted-foreground)]">
        {searchQuery ? 'No users found matching your search' : 'No users found'}
      </div>
    );
  }

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full">
          <caption className="sr-only">
            User management table. {users.length} users displayed
            {searchQuery ? ` matching "${searchQuery}"` : ''}.
          </caption>
          <thead>
            <tr className="border-b border-[var(--border)]">
              <th className="text-left py-3 px-4">
                <input
                  type="checkbox"
                  checked={isAllSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = isSomeSelected && !isAllSelected;
                  }}
                  onChange={(e) => onSelectAll(e.target.checked)}
                  className="w-4 h-4 rounded border-[var(--border)] text-[var(--foreground)] focus:ring-[var(--primary-600)]"
                  aria-label="Select all users"
                />
              </th>
              <th className="text-left py-3 px-4 font-medium text-[var(--muted-foreground)]">
                Full Name
              </th>
              <th className="text-left py-3 px-4 font-medium text-[var(--muted-foreground)]">
                Email
              </th>
              <th className="text-left py-3 px-4 font-medium text-[var(--muted-foreground)]">
                Role
              </th>
              <th className="text-left py-3 px-4 font-medium text-[var(--muted-foreground)]">
                Organization
              </th>
              <th className="text-left py-3 px-4 font-medium text-[var(--muted-foreground)]">
                Extension
              </th>
              <th className="text-left py-3 px-4 font-medium text-[var(--muted-foreground)]">
                Status
              </th>
              <th
                className="text-left py-3 px-4 font-medium text-[var(--muted-foreground)]"
                title="SMS / Auto-Dialer"
              >
                Features
              </th>
              <th className="text-left py-3 px-4 font-medium text-[var(--muted-foreground)]">
                Created
              </th>
              <th className="text-left py-3 px-4 font-medium text-[var(--muted-foreground)]">
                Last Login
              </th>
              <th className="text-right py-3 px-4 font-medium text-[var(--muted-foreground)]">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <UserRow
                key={user.id}
                user={user}
                isSelected={selectedUserIds.has(user.id)}
                onSelect={onSelectUser}
                onEdit={onEdit}
                onToggleBan={onToggleBan}
                onResetPassword={onResetPassword}
                onTransfer={onTransfer}
                onDelete={onDelete}
                isDeletePending={isDeletePending}
              />
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {dataMeta && dataMeta.totalPages > 1 && (
        <div className="mt-6 border-t border-[var(--border)] pt-4">
          <Pagination
            page={pagination.page}
            totalPages={pagination.totalPages}
            pageSize={pagination.pageSize}
            totalItems={pagination.totalItems}
            hasNextPage={pagination.hasNextPage}
            hasPreviousPage={pagination.hasPreviousPage}
            pageRange={pagination.pageRange}
            onPageChange={pagination.goToPage}
            onPageSizeChange={pagination.setPageSize}
            disabled={isFetching}
          />
        </div>
      )}
    </>
  );
}
