'use client';

import React from 'react';
import { ROLE_BADGE_STYLES } from '@/lib/constants/status-styles';
import {
  FiSearch,
  FiEdit2,
  FiAlertCircle,
  FiLoader,
  FiRefreshCw,
  FiEye,
  FiUsers,
  FiSettings,
  FiShield,
  FiFileText,
} from 'react-icons/fi';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Button,
  Input,
  Pagination,
  StyledSelect,
} from '@/components/ui';
import type { Permission, UserWithPermissions } from '@/lib/api/services';

// ============================================================================
// Constants
// ============================================================================

const categoryIcons: Record<string, React.ReactNode> = {
  viewing: <FiEye className="w-4 h-4" />,
  managing: <FiUsers className="w-4 h-4" />,
  system: <FiSettings className="w-4 h-4" />,
  security: <FiShield className="w-4 h-4" />,
  reporting: <FiFileText className="w-4 h-4" />,
};

const categoryColors: Record<string, string> = {
  viewing: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  managing: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  system: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300',
  security: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
  reporting: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300',
};

// Re-export for use by parent
export { categoryIcons, categoryColors };

// ============================================================================
// UserRow (memoized)
// ============================================================================

const UserRow = React.memo(function UserRow({
  user,
  onEdit,
}: {
  user: UserWithPermissions;
  onEdit: (user: UserWithPermissions) => void;
}) {
  return (
    <tr className="border-b border-[var(--border)] hover:bg-[var(--muted)] transition-colors">
      <td className="py-3 px-4 font-medium text-[var(--foreground)]">
        {user.fullName || user.email}
      </td>
      <td className="py-3 px-4 text-[var(--muted-foreground)]">{user.email}</td>
      <td className="py-3 px-4">
        <span
          className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${ROLE_BADGE_STYLES[user.role] || ROLE_BADGE_STYLES.user}`}
        >
          {user.role}
        </span>
      </td>
      <td className="py-3 px-4 text-center">
        <span className="text-[var(--muted-foreground)]">
          {Object.values(user.effectivePermissions).filter(Boolean).length}
        </span>
      </td>
      <td className="py-3 px-4 text-center">
        {user.overrideCount > 0 ? (
          <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300">
            {user.overrideCount} override{user.overrideCount > 1 ? 's' : ''}
          </span>
        ) : (
          <span className="text-[var(--muted-foreground)]">-</span>
        )}
      </td>
      <td className="py-3 px-4 text-right">
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Edit permissions for ${user.fullName || user.email}`}
          onClick={() => onEdit(user)}
          // Only the platform super_admin is uneditable (they hold everything).
          // Tenant admins ARE editable — that's how you tune their pages.
          disabled={user.role === 'super_admin'}
        >
          <FiEdit2 className="w-4 h-4" aria-hidden="true" />
        </Button>
      </td>
    </tr>
  );
});

// ============================================================================
// Types
// ============================================================================

export interface PermissionsUserListProps {
  // Data
  users: UserWithPermissions[];
  allPermissions: Permission[];
  isLoading: boolean;
  isFetching: boolean;
  error: Error | null;

  // Search
  searchQuery: string;
  onSearchChange: (value: string) => void;

  // Role filter
  roleFilter: string;
  onRoleFilterChange: (value: string) => void;

  // Actions
  onEdit: (user: UserWithPermissions) => void;
  onRefresh: () => void;

  // Real-time
  isConnected: boolean;

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
  dataMeta: { total: number; totalPages: number } | null;
}

// ============================================================================
// Component
// ============================================================================

export function PermissionsUserList({
  users,
  allPermissions,
  isLoading,
  isFetching,
  error,
  searchQuery,
  onSearchChange,
  roleFilter,
  onRoleFilterChange,
  onEdit,
  onRefresh,
  isConnected,
  pagination,
  dataMeta,
}: PermissionsUserListProps) {
  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <FiAlertCircle
            className="w-12 h-12 text-[var(--danger)] mx-auto mb-4"
            aria-hidden="true"
          />
          <p className="text-[var(--danger)]">Failed to load permissions</p>
          <p className="text-sm text-[var(--muted-foreground)] mt-2">
            {error instanceof Error ? error.message : 'Unknown error'}
          </p>
          <Button onClick={onRefresh} className="mt-4">
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-[var(--foreground)]">Permissions</h1>
            {/* Real-time connection indicator */}
            <div className="flex items-center gap-1.5">
              <span
                className={`w-2 h-2 rounded-full ${
                  isConnected ? 'bg-green-500 animate-pulse' : 'bg-gray-400'
                }`}
                title={isConnected ? 'Real-time updates active' : 'Real-time updates disconnected'}
              />
              <span className="text-xs text-[var(--muted-foreground)]">
                {isConnected ? 'Live' : 'Offline'}
              </span>
            </div>
          </div>
          <p className="text-[var(--muted-foreground)] mt-1">
            Manage individual user permissions and access controls
          </p>
        </div>
      </div>

      {/* Permission categories overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {Object.entries(categoryColors).map(([category, colorClass]) => {
          const count = allPermissions.filter((p) => p.category === category).length;
          return (
            <Card key={category} className="p-4">
              <div className="flex items-center gap-3">
                <span className={`p-2 rounded-lg ${colorClass}`}>{categoryIcons[category]}</span>
                <div>
                  <p className="text-sm font-medium text-[var(--foreground)] capitalize">
                    {category}
                  </p>
                  <p className="text-xs text-[var(--muted-foreground)]">{count} permissions</p>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-4">
              <CardTitle>
                User Permissions
                {dataMeta && (
                  <span className="text-sm font-normal text-[var(--muted-foreground)] ml-2">
                    ({dataMeta.total} users)
                  </span>
                )}
              </CardTitle>
            </div>
            <div className="flex items-center gap-2">
              <StyledSelect
                value={roleFilter}
                onChange={(v) => onRoleFilterChange(v)}
                className="w-40 bg-[var(--background)]"
              >
                <option value="">All Roles</option>
                <option value="admin">Admin</option>
                <option value="manager">Manager</option>
                <option value="user">User</option>
              </StyledSelect>
              <div className="w-72">
                <Input
                  placeholder="Search users..."
                  value={searchQuery}
                  onChange={(e) => onSearchChange(e.target.value)}
                  leftIcon={<FiSearch className="w-4 h-4" aria-hidden="true" />}
                  aria-label="Search users"
                />
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={onRefresh}
                disabled={isFetching}
                aria-label="Refresh"
              >
                <FiRefreshCw
                  className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`}
                  aria-hidden="true"
                />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading && users.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <FiLoader className="w-8 h-8 animate-spin text-[var(--primary)]" aria-hidden="true" />
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-12 text-[var(--muted-foreground)]">
              {searchQuery ? 'No users found matching your search' : 'No users found'}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[var(--border)]">
                      <th className="text-left py-3 px-4 font-medium text-[var(--muted-foreground)]">
                        Username
                      </th>
                      <th className="text-left py-3 px-4 font-medium text-[var(--muted-foreground)]">
                        Email
                      </th>
                      <th className="text-left py-3 px-4 font-medium text-[var(--muted-foreground)]">
                        Role
                      </th>
                      <th className="text-center py-3 px-4 font-medium text-[var(--muted-foreground)]">
                        Permissions
                      </th>
                      <th className="text-center py-3 px-4 font-medium text-[var(--muted-foreground)]">
                        Overrides
                      </th>
                      <th className="text-right py-3 px-4 font-medium text-[var(--muted-foreground)]">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((user) => (
                      <UserRow key={user.id} user={user} onEdit={onEdit} />
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
          )}
        </CardContent>
      </Card>
    </div>
  );
}
