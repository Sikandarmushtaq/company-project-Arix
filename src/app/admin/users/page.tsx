'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  FiPlus,
  FiEdit2,
  FiTrash2,
  FiMoreVertical,
  FiCheck,
  FiAlertCircle,
  FiLoader,
  FiRefreshCw,
  FiLock,
  FiShield,
  FiRepeat,
  FiMessageSquare,
  FiPhone,
  FiChevronDown,
  FiDownload,
  FiAlertTriangle,
  FiUser,
  FiUsers,
  FiBriefcase,
} from 'react-icons/fi';
import { Button, Input, Pagination } from '@/components/ui';
import Link from 'next/link';
import { Modal } from '@/components/ui/Modal';
import { DataView, type ViewColumn } from '@/components/ui/data-list/DataView';
import { Avatar } from '@/components/ui/data-list/DataList';
import {
  CreateUserModal,
  EditUserModal,
  PasswordResetModal,
  BanUserModal,
  PhoneTransferModal,
} from '@/components/admin';
import {
  useAdminUsers,
  useDeleteUser,
  useBulkBanUsers,
  useBulkUnbanUsers,
  useBulkEnableSms,
  useBulkDisableSms,
  useBulkEnableAutoDialer,
  useBulkDisableAutoDialer,
  useBulkDeleteUsers,
  useBulkEnableWhatsApp,
  useBulkDisableWhatsApp,
  useExportUsers,
  useOrganizations,
} from '@/lib/hooks';
import { usePagination } from '@/lib/hooks/usePagination';
import { usePermissions } from '@/lib/hooks/usePermissions';
import { formatLocalDate, formatAdminDateTime } from '@/lib/utils/datetime';
import type { AdminUser } from '@/lib/api/services';

const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

/** The single calm status for a user (color = state only). */
function userStatus(user: AdminUser): { tone: 'success' | 'neutral' | 'danger'; label: string } {
  if (user.banned) return { tone: 'danger', label: 'Banned' };
  return user.isActive ? { tone: 'success', label: 'Active' } : { tone: 'neutral', label: 'Inactive' };
}

/** Enabled feature names for a user (empty when none). */
function enabledFeatures(user: AdminUser): string[] {
  return [
    user.smsEnabled && 'SMS',
    user.autoDialerEnabled && 'Auto-Dialer',
    user.waEnabled && 'WhatsApp',
  ].filter(Boolean) as string[];
}

/** Small feature dots for the dense Table view. */
function FeatureDots({ user }: { user: AdminUser }) {
  const dot = (on: boolean, color: string, label: string) => (
    <span
      title={`${label}: ${on ? 'On' : 'Off'}`}
      role="img"
      aria-label={`${label} ${on ? 'enabled' : 'disabled'}`}
      className={`inline-block h-2 w-2 rounded-full ${on ? color : 'bg-gray-300 dark:bg-gray-600'}`}
    />
  );
  return (
    <span className="inline-flex items-center gap-1.5">
      {dot(user.smsEnabled, 'bg-green-500', 'SMS')}
      {dot(user.autoDialerEnabled, 'bg-blue-500', 'Auto-Dialer')}
      {dot(user.waEnabled, 'bg-emerald-500', 'WhatsApp')}
    </span>
  );
}

/**
 * Per-row actions: edit button + kebab menu. Shared by every DataView view.
 * The kebab uses fixed positioning so it escapes any overflow clipping.
 */
const UserActions = React.memo(function UserActions({
  user,
  onEdit,
  onToggleBan,
  onResetPassword,
  onTransfer,
  onDelete,
  isDeletePending,
}: {
  user: AdminUser;
  onEdit: (user: AdminUser) => void;
  onToggleBan: (user: AdminUser) => void;
  onResetPassword: (user: AdminUser) => void;
  onTransfer: (user: AdminUser) => void;
  onDelete: (user: AdminUser) => void;
  isDeletePending: boolean;
}) {
  const [showMenu, setShowMenu] = useState(false);
  const [menuCoords, setMenuCoords] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const toggleMenu = useCallback(() => {
    if (!showMenu && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const menuWidth = 192;
      const menuHeight = 210;
      const padding = 8;
      const spaceAbove = rect.top;
      const spaceBelow = window.innerHeight - rect.bottom;
      const openAbove = spaceBelow < menuHeight + padding && spaceAbove > spaceBelow;
      const top = openAbove
        ? Math.max(padding, rect.top - menuHeight - 4)
        : Math.min(window.innerHeight - menuHeight - padding, rect.bottom + 4);
      const left = Math.max(padding, rect.right - menuWidth);
      setMenuCoords({ top, left });
    }
    setShowMenu((prev) => !prev);
  }, [showMenu]);

  return (
    <>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={`Edit ${user.fullName || user.senderPhone}`}
        onClick={() => onEdit(user)}
      >
        <FiEdit2 className="h-4 w-4" aria-hidden="true" />
      </Button>
      <Button ref={triggerRef} variant="ghost" size="icon-sm" aria-label="More options" onClick={toggleMenu}>
        <FiMoreVertical className="h-4 w-4" aria-hidden="true" />
      </Button>
      {showMenu && menuCoords && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
          <div
            style={{ position: 'fixed', top: `${menuCoords.top}px`, left: `${menuCoords.left}px` }}
            className="z-50 w-48 rounded-lg border border-[var(--border)] bg-[var(--card)] shadow-lg"
          >
            <div className="py-1">
              <button
                className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-[var(--foreground)] hover:bg-[var(--muted)]"
                onClick={() => {
                  setShowMenu(false);
                  onResetPassword(user);
                }}
              >
                <FiLock className="h-4 w-4" />
                Reset Password
              </button>
              <button
                className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-[var(--foreground)] hover:bg-[var(--muted)]"
                onClick={() => {
                  setShowMenu(false);
                  onToggleBan(user);
                }}
              >
                <FiShield className="h-4 w-4" />
                {user.banned ? 'Unban User' : 'Ban User'}
              </button>
              <button
                className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-[var(--foreground)] hover:bg-[var(--muted)]"
                onClick={() => {
                  setShowMenu(false);
                  onTransfer(user);
                }}
              >
                <FiRepeat className="h-4 w-4" />
                Transfer to New User
              </button>
              <div className="my-1 border-t border-[var(--border)]" />
              <button
                className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-[var(--danger)] hover:bg-[var(--muted)]"
                onClick={() => {
                  setShowMenu(false);
                  onDelete(user);
                }}
                disabled={isDeletePending}
              >
                <FiTrash2 className="h-4 w-4" />
                Delete User
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
});

// Bulk actions dropdown (shown in the DataView selection strip)
interface BulkActionsProps {
  selectedCount: number;
  onBan: () => void;
  onUnban: () => void;
  onEnableSms: () => void;
  onDisableSms: () => void;
  onEnableAutoDialer: () => void;
  onDisableAutoDialer: () => void;
  onEnableWhatsApp: () => void;
  onDisableWhatsApp: () => void;
  onDelete: () => void;
  isLoading: boolean;
}

function BulkActionsDropdown({
  selectedCount,
  onBan,
  onUnban,
  onEnableSms,
  onDisableSms,
  onEnableAutoDialer,
  onDisableAutoDialer,
  onEnableWhatsApp,
  onDisableWhatsApp,
  onDelete,
  isLoading,
}: BulkActionsProps) {
  const [isOpen, setIsOpen] = useState(false);
  if (selectedCount === 0) return null;

  return (
    <div className="relative">
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
        disabled={isLoading}
        className="flex items-center gap-2"
      >
        {isLoading ? (
          <FiLoader className="h-4 w-4 animate-spin" />
        ) : (
          <>
            Bulk actions
            <FiChevronDown className="h-4 w-4" />
          </>
        )}
      </Button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 z-50 mt-1 w-56 rounded-lg border border-[var(--border)] bg-[var(--card)] shadow-lg">
            <div className="py-1">
              <div className="px-3 py-2 text-xs font-semibold uppercase text-[var(--muted-foreground)]">
                Status
              </div>
              <BulkItem icon={<FiShield className="h-4 w-4 text-red-500" />} label="Ban selected" onClick={() => { setIsOpen(false); onBan(); }} />
              <BulkItem icon={<FiCheck className="h-4 w-4 text-green-500" />} label="Unban selected" onClick={() => { setIsOpen(false); onUnban(); }} />
              <div className="my-1 border-t border-[var(--border)]" />
              <div className="px-3 py-2 text-xs font-semibold uppercase text-[var(--muted-foreground)]">SMS</div>
              <BulkItem icon={<FiMessageSquare className="h-4 w-4 text-green-500" />} label="Enable SMS" onClick={() => { setIsOpen(false); onEnableSms(); }} />
              <BulkItem icon={<FiMessageSquare className="h-4 w-4 text-gray-400" />} label="Disable SMS" onClick={() => { setIsOpen(false); onDisableSms(); }} />
              <div className="my-1 border-t border-[var(--border)]" />
              <div className="px-3 py-2 text-xs font-semibold uppercase text-[var(--muted-foreground)]">Auto-Dialer</div>
              <BulkItem icon={<FiPhone className="h-4 w-4 text-green-500" />} label="Enable Auto-Dialer" onClick={() => { setIsOpen(false); onEnableAutoDialer(); }} />
              <BulkItem icon={<FiPhone className="h-4 w-4 text-gray-400" />} label="Disable Auto-Dialer" onClick={() => { setIsOpen(false); onDisableAutoDialer(); }} />
              <div className="my-1 border-t border-[var(--border)]" />
              <div className="px-3 py-2 text-xs font-semibold uppercase text-[var(--muted-foreground)]">WhatsApp</div>
              <BulkItem icon={<FiMessageSquare className="h-4 w-4 text-emerald-500" />} label="Enable WhatsApp" onClick={() => { setIsOpen(false); onEnableWhatsApp(); }} />
              <BulkItem icon={<FiMessageSquare className="h-4 w-4 text-gray-400" />} label="Disable WhatsApp" onClick={() => { setIsOpen(false); onDisableWhatsApp(); }} />
              <div className="my-1 border-t border-[var(--border)]" />
              <BulkItem icon={<FiTrash2 className="h-4 w-4" />} label="Delete selected" danger onClick={() => { setIsOpen(false); onDelete(); }} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function BulkItem({
  icon,
  label,
  onClick,
  danger,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      className={`flex w-full items-center gap-2 px-4 py-2 text-left text-sm hover:bg-[var(--muted)] ${
        danger ? 'text-[var(--danger)]' : 'text-[var(--foreground)]'
      }`}
      onClick={onClick}
    >
      {icon}
      {label}
    </button>
  );
}

const DATA_CLEANUP_ITEMS = [
  { icon: FiPhone, label: 'Call History', color: 'text-blue-500' },
  { icon: FiMessageSquare, label: 'SMS Messages', color: 'text-green-500' },
  { icon: FiUser, label: 'Contacts & Blocked Numbers', color: 'text-purple-500' },
  { icon: FiPhone, label: 'Voicemails & Recordings', color: 'text-orange-500' },
  { icon: FiMessageSquare, label: 'SMS Groups', color: 'text-teal-500' },
  { icon: FiShield, label: 'SIP Extension & Inbound DID', color: 'text-red-500' },
];

function DeleteUserModal({
  user,
  onClose,
  onConfirm,
  loading,
}: {
  user: AdminUser | null;
  onClose: () => void;
  onConfirm: () => void;
  loading: boolean;
}) {
  const [confirmName, setConfirmName] = useState('');
  useEffect(() => {
    if (!user) setConfirmName('');
  }, [user]);
  if (!user) return null;
  const displayName = user.fullName || user.senderPhone || '';
  const canConfirm = confirmName.toLowerCase() === displayName.toLowerCase();

  return (
    <Modal isOpen={!!user} onClose={onClose} title="Delete User" size="lg">
      <div className="space-y-4">
        <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-950">
          <FiAlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-600 dark:text-red-400" />
          <div>
            <p className="text-sm font-medium text-red-800 dark:text-red-200">Permanent Deletion</p>
            <p className="mt-0.5 text-sm text-red-600 dark:text-red-400">
              This will permanently delete the user account and all associated data. This action
              cannot be undone.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--muted)] p-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--primary)] font-medium text-white">
            {(user.fullName || user.senderPhone || '?')[0].toUpperCase()}
          </div>
          <div>
            <p className="font-medium text-[var(--foreground)]">{user.fullName || 'No Name'}</p>
            <p className="text-sm text-[var(--muted-foreground)]">
              {user.senderPhone} {user.extension ? `| Ext. ${user.extension}` : ''}
            </p>
          </div>
        </div>
        <div>
          <p className="mb-2 text-sm font-medium text-[var(--foreground)]">
            The following data will be permanently deleted:
          </p>
          <div className="space-y-1.5">
            {DATA_CLEANUP_ITEMS.map((item) => (
              <div key={item.label} className="flex items-center gap-2 text-sm text-[var(--muted-foreground)]">
                <item.icon className={`h-4 w-4 ${item.color}`} />
                <span>{item.label}</span>
              </div>
            ))}
          </div>
        </div>
        <div>
          <label className="mb-1 block text-sm text-[var(--muted-foreground)]">
            Type <span className="font-semibold text-[var(--foreground)]">{displayName}</span> to confirm:
          </label>
          <Input value={confirmName} onChange={(e) => setConfirmName(e.target.value)} placeholder={displayName} autoFocus />
        </div>
      </div>
      <div className="mt-6 flex justify-end gap-3">
        <Button variant="outline" onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button variant="danger" onClick={onConfirm} disabled={!canConfirm || loading}>
          {loading ? <FiLoader className="mr-2 h-4 w-4 animate-spin" /> : <FiTrash2 className="mr-2 h-4 w-4" />}
          Delete User
        </Button>
      </div>
    </Modal>
  );
}

function BulkDeleteModal({
  isOpen,
  selectedCount,
  onClose,
  onConfirm,
  loading,
}: {
  isOpen: boolean;
  selectedCount: number;
  onClose: () => void;
  onConfirm: () => void;
  loading: boolean;
}) {
  const [confirmText, setConfirmText] = useState('');
  useEffect(() => {
    if (!isOpen) setConfirmText('');
  }, [isOpen]);
  const confirmPhrase = `delete ${selectedCount}`;
  const canConfirm = confirmText.toLowerCase() === confirmPhrase;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Delete Multiple Users" size="lg">
      <div className="space-y-4">
        <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-950">
          <FiAlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-600 dark:text-red-400" />
          <div>
            <p className="text-sm font-medium text-red-800 dark:text-red-200">Bulk Permanent Deletion</p>
            <p className="mt-0.5 text-sm text-red-600 dark:text-red-400">
              This will permanently delete {selectedCount} user account(s) and all associated data. Admin
              users will be skipped.
            </p>
          </div>
        </div>
        <div>
          <p className="mb-2 text-sm font-medium text-[var(--foreground)]">
            For each user, the following will be deleted:
          </p>
          <div className="space-y-1.5">
            {DATA_CLEANUP_ITEMS.map((item) => (
              <div key={item.label} className="flex items-center gap-2 text-sm text-[var(--muted-foreground)]">
                <item.icon className={`h-4 w-4 ${item.color}`} />
                <span>{item.label}</span>
              </div>
            ))}
          </div>
        </div>
        <div>
          <label className="mb-1 block text-sm text-[var(--muted-foreground)]">
            Type <span className="font-semibold text-[var(--foreground)]">{confirmPhrase}</span> to confirm:
          </label>
          <Input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder={confirmPhrase} autoFocus />
        </div>
      </div>
      <div className="mt-6 flex justify-end gap-3">
        <Button variant="outline" onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button variant="danger" onClick={onConfirm} disabled={!canConfirm || loading}>
          {loading ? <FiLoader className="mr-2 h-4 w-4 animate-spin" /> : <FiTrash2 className="mr-2 h-4 w-4" />}
          Delete {selectedCount} User(s)
        </Button>
      </div>
    </Modal>
  );
}

export default function UsersPage() {
  const pagination = usePagination({ initialPageSize: 20 });
  const { isAdmin, isSuperAdmin } = usePermissions();
  const SHOW_LEGACY_ADD_USER = false;

  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedUserIds, setSelectedUserIds] = useState<Set<number>>(new Set());
  // Super-admin only: scope the flat, cross-org list to a single org so it's
  // unambiguous which user belongs to which org. null = all organizations.
  const [orgFilterId, setOrgFilterId] = useState<number | null>(null);

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editUserId, setEditUserId] = useState<number | null>(null);
  const [passwordResetUser, setPasswordResetUser] = useState<AdminUser | null>(null);
  const [banUser, setBanUser] = useState<AdminUser | null>(null);
  const [transferUserId, setTransferUserId] = useState<number | null>(null);
  const [deleteUser, setDeleteUser] = useState<AdminUser | null>(null);
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      pagination.goToPage(1);
    }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- pagination.goToPage is stable
  }, [searchQuery]);

  const { data, isLoading, error, isFetching, refetch } = useAdminUsers({
    page: pagination.page,
    limit: pagination.pageSize,
    search: debouncedSearch || undefined,
    organizationId: orgFilterId ?? undefined,
  });

  // Organizations for the super-admin org filter dropdown. Skipped for tenant
  // admins/managers (the endpoint is super-admin only, and they're already
  // scoped to their own org server-side).
  const { data: orgsData } = useOrganizations(
    { page: 1, limit: 1000 },
    { enabled: isSuperAdmin }
  );
  const organizations = useMemo(() => orgsData?.organizations ?? [], [orgsData?.organizations]);

  // Changing the org scope resets to page 1 so the viewer never lands on an
  // out-of-range page of a smaller filtered set.
  const handleOrgFilterChange = useCallback(
    (value: string) => {
      setOrgFilterId(value ? Number(value) : null);
      setSelectedUserIds(new Set());
      pagination.goToPage(1);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- pagination.goToPage is stable
    []
  );

  useEffect(() => {
    if (data?.meta) pagination.setTotalItems(data.meta.total);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- pagination.setTotalItems is stable
  }, [data?.meta]);

  const [trackedDataVersion, setTrackedDataVersion] = useState<string | null>(null);
  const currentDataVersion = data ? `${data.meta?.page}-${data.meta?.total}` : null;
  if (currentDataVersion !== trackedDataVersion) {
    setTrackedDataVersion(currentDataVersion);
    if (selectedUserIds.size > 0) setSelectedUserIds(new Set());
  }

  const deleteUserMutation = useDeleteUser();
  const bulkBanMutation = useBulkBanUsers();
  const bulkUnbanMutation = useBulkUnbanUsers();
  const bulkEnableSmsMutation = useBulkEnableSms();
  const bulkDisableSmsMutation = useBulkDisableSms();
  const bulkEnableAutoDialerMutation = useBulkEnableAutoDialer();
  const bulkDisableAutoDialerMutation = useBulkDisableAutoDialer();
  const bulkDeleteMutation = useBulkDeleteUsers();
  const bulkEnableWhatsAppMutation = useBulkEnableWhatsApp();
  const bulkDisableWhatsAppMutation = useBulkDisableWhatsApp();
  const exportUsersMutation = useExportUsers();

  const users = useMemo(() => data?.users ?? [], [data?.users]);

  const isBulkLoading =
    bulkBanMutation.isPending ||
    bulkUnbanMutation.isPending ||
    bulkEnableSmsMutation.isPending ||
    bulkDisableSmsMutation.isPending ||
    bulkEnableAutoDialerMutation.isPending ||
    bulkDisableAutoDialerMutation.isPending ||
    bulkEnableWhatsAppMutation.isPending ||
    bulkDisableWhatsAppMutation.isPending ||
    bulkDeleteMutation.isPending;

  const handleSelectUser = useCallback((userId: string | number, selected: boolean) => {
    setSelectedUserIds((prev) => {
      const next = new Set(prev);
      if (selected) next.add(Number(userId));
      else next.delete(Number(userId));
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(
    (selected: boolean) => {
      setSelectedUserIds(selected ? new Set(users.map((u) => u.id)) : new Set());
    },
    [users]
  );

  const runBulk = useCallback(
    async (fn: (ids: number[]) => Promise<unknown>) => {
      await fn(Array.from(selectedUserIds));
      setSelectedUserIds(new Set());
    },
    [selectedUserIds]
  );

  const handleBulkDeleteConfirm = useCallback(async () => {
    await bulkDeleteMutation.mutateAsync(Array.from(selectedUserIds));
    setSelectedUserIds(new Set());
    setBulkDeleteConfirm(false);
  }, [selectedUserIds, bulkDeleteMutation]);

  const handleEdit = useCallback((user: AdminUser) => setEditUserId(user.id), []);
  const handleResetPassword = useCallback((user: AdminUser) => setPasswordResetUser(user), []);
  const handleToggleBan = useCallback((user: AdminUser) => setBanUser(user), []);
  const handleTransfer = useCallback((user: AdminUser) => setTransferUserId(user.id), []);
  const handleDeleteClick = useCallback((user: AdminUser) => setDeleteUser(user), []);

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteUser) return;
    try {
      await deleteUserMutation.mutateAsync(deleteUser.id);
      setDeleteUser(null);
    } catch (err) {
      console.error('Failed to delete user:', err);
    }
  }, [deleteUser, deleteUserMutation]);

  const handleRefresh = useCallback(() => refetch(), [refetch]);
  const handleModalSuccess = useCallback(() => refetch(), [refetch]);

  // ── DataView config (shared row model + table columns + board grouping) ─────
  const columns: ViewColumn<AdminUser>[] = useMemo(
    () => [
      {
        key: 'user',
        header: 'User',
        cell: (u) => (
          <div className="flex items-center gap-2.5">
            <Avatar name={u.fullName || u.senderPhone} size={30} />
            <div className="min-w-0">
              <div className="truncate font-medium text-[var(--foreground)]">
                {u.fullName || u.senderPhone}
              </div>
              <div className="truncate text-xs text-[var(--muted-foreground)]">{u.email}</div>
            </div>
          </div>
        ),
      },
      {
        key: 'org',
        header: 'Organization',
        cell: (u) =>
          u.organizationName || <span className="italic text-[var(--muted-foreground)]">Unassigned</span>,
      },
      { key: 'ext', header: 'Ext', cell: (u) => u.extension, mono: true },
      { key: 'role', header: 'Role', cell: (u) => cap(u.role) },
      { key: 'features', header: 'Features', secondary: true, cell: (u) => <FeatureDots user={u} /> },
      { key: 'created', header: 'Created', secondary: true, cell: (u) => formatLocalDate(u.createdAt) },
      {
        key: 'last',
        header: 'Last login',
        secondary: true,
        cell: (u) =>
          u.lastLogin ? formatAdminDateTime(u.lastLogin) : <span className="italic text-[var(--muted-foreground)]">Never</span>,
      },
    ],
    []
  );

  const bulkBar = (
    <BulkActionsDropdown
      selectedCount={selectedUserIds.size}
      onBan={() => runBulk((ids) => bulkBanMutation.mutateAsync({ userIds: ids }))}
      onUnban={() => runBulk((ids) => bulkUnbanMutation.mutateAsync(ids))}
      onEnableSms={() => runBulk((ids) => bulkEnableSmsMutation.mutateAsync(ids))}
      onDisableSms={() => runBulk((ids) => bulkDisableSmsMutation.mutateAsync(ids))}
      onEnableAutoDialer={() => runBulk((ids) => bulkEnableAutoDialerMutation.mutateAsync(ids))}
      onDisableAutoDialer={() => runBulk((ids) => bulkDisableAutoDialerMutation.mutateAsync(ids))}
      onEnableWhatsApp={() => runBulk((ids) => bulkEnableWhatsAppMutation.mutateAsync(ids))}
      onDisableWhatsApp={() => runBulk((ids) => bulkDisableWhatsAppMutation.mutateAsync(ids))}
      onDelete={() => setBulkDeleteConfirm(true)}
      isLoading={isBulkLoading}
    />
  );

  if (error) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-center">
          <FiAlertCircle className="mx-auto mb-4 h-12 w-12 text-[var(--danger)]" aria-hidden="true" />
          <p className="text-[var(--danger)]">Failed to load users</p>
          <p className="mt-2 text-sm text-[var(--muted-foreground)]">
            {error instanceof Error ? error.message : 'Unknown error'}
          </p>
          <Button onClick={handleRefresh} className="mt-4">
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
          <h1 className="text-2xl font-bold text-[var(--foreground)]">
            Users
            {data?.meta && (
              <span className="ml-2 text-lg font-normal text-[var(--muted-foreground)]">
                {data.meta.total}
              </span>
            )}
          </h1>
          <p className="mt-1 text-[var(--muted-foreground)]">Manage user accounts and permissions</p>
        </div>
        <div className="flex items-center gap-2">
          {isSuperAdmin && (
            <div className="relative flex items-center">
              <FiBriefcase
                className="pointer-events-none absolute left-3 h-4 w-4 text-[var(--muted-foreground)]"
                aria-hidden="true"
              />
              <select
                value={orgFilterId ?? ''}
                onChange={(e) => handleOrgFilterChange(e.target.value)}
                aria-label="Filter users by organization"
                className="h-9 min-w-[13rem] max-w-[16rem] appearance-none rounded-lg border border-[var(--border)] bg-[var(--background)] pl-9 pr-8 text-sm text-[var(--foreground)] outline-none focus:ring-2 focus:ring-[var(--primary)]/40"
              >
                <option value="">All organizations</option>
                {organizations.map((org) => (
                  <option key={org.id} value={org.id}>
                    {org.name}
                  </option>
                ))}
              </select>
              <FiChevronDown
                className="pointer-events-none absolute right-3 h-4 w-4 text-[var(--muted-foreground)]"
                aria-hidden="true"
              />
            </div>
          )}
          <Button
            variant="outline"
            onClick={() =>
              exportUsersMutation.mutate({
                search: debouncedSearch || undefined,
                organizationId: orgFilterId != null ? String(orgFilterId) : undefined,
              })
            }
            disabled={exportUsersMutation.isPending}
            aria-label="Export users to CSV"
          >
            {exportUsersMutation.isPending ? (
              <FiLoader className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <FiDownload className="h-4 w-4" aria-hidden="true" />
            )}
            Export CSV
          </Button>
          {SHOW_LEGACY_ADD_USER && isAdmin && (
            <Button onClick={() => setCreateModalOpen(true)} aria-label="Add new user">
              <FiPlus className="h-4 w-4" aria-hidden="true" />
              Add User
            </Button>
          )}
          {isSuperAdmin && (
            <Link href="/admin/accounts/new">
              <Button aria-label="Create a new customer account">
                <FiPlus className="h-4 w-4" aria-hidden="true" />
                Create Account
              </Button>
            </Link>
          )}
        </div>
      </div>

      <DataView<AdminUser>
        viewId="admin-users-v2"
        // Table first: it's the densest, most space-efficient view for a list you
        // manage all day. Cards (calm/mobile) and Board (by status) are one click
        // away and the choice is remembered per viewer.
        availableViews={['table', 'cards', 'board']}
        items={users}
        getRowId={(u) => u.id}
        loading={isLoading}
        avatarName={(u) => u.fullName || u.senderPhone}
        title={(u) => u.fullName || u.senderPhone}
        subtitle={(u) => u.email}
        meta={(u) => {
          const feats = enabledFeatures(u);
          return [
            { value: u.organizationName || 'Unassigned' },
            { label: 'Ext', value: u.extension, mono: true },
            { value: cap(u.role) },
            ...(feats.length ? [{ value: feats.join(', ') }] : []),
            ...(u.lastLogin ? [{ label: 'Last login', value: formatLocalDate(u.lastLogin) }] : []),
          ];
        }}
        status={(u) => userStatus(u)}
        // Board view groups users under their ORGANIZATION so it's obvious which
        // org each user belongs to (row status coloring is unchanged, via `status`).
        groupBy={(u) => {
          const key = u.organizationName || 'Unassigned';
          return { key, label: key };
        }}
        actions={(u) => (
          <UserActions
            user={u}
            onEdit={handleEdit}
            onToggleBan={handleToggleBan}
            onResetPassword={handleResetPassword}
            onTransfer={handleTransfer}
            onDelete={handleDeleteClick}
            isDeletePending={deleteUserMutation.isPending}
          />
        )}
        columns={columns}
        search={{ value: searchQuery, onChange: setSearchQuery, placeholder: 'Search users…' }}
        filters={[
          { key: 'role', label: 'Role', getValue: (u) => u.role },
          { key: 'status', label: 'Status', getValue: (u) => userStatus(u).label },
        ]}
        sortOptions={[
          { key: 'name', label: 'Name (A–Z)', cmp: (a, b) => (a.fullName || '').localeCompare(b.fullName || '') },
          {
            key: 'created',
            label: 'Newest first',
            cmp: (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
          },
          {
            key: 'login',
            label: 'Recent login',
            cmp: (a, b) => new Date(b.lastLogin || 0).getTime() - new Date(a.lastLogin || 0).getTime(),
          },
        ]}
        selectable
        selectedIds={selectedUserIds}
        onToggleRow={handleSelectUser}
        onToggleAll={handleSelectAll}
        bulkBar={bulkBar}
        toolbarRight={
          <Button
            variant="outline"
            size="icon"
            onClick={handleRefresh}
            disabled={isFetching}
            aria-label="Refresh users"
          >
            <FiRefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} aria-hidden="true" />
          </Button>
        }
        emptyTitle={searchQuery ? 'No users match your search' : 'No users yet'}
        emptyHint={searchQuery ? 'Try a different name, email, or number.' : undefined}
        emptyIcon={<FiUsers className="h-8 w-8" />}
        footer={
          data?.meta && data.meta.totalPages > 1 ? (
            <div className="border-t border-[var(--border)] pt-4">
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
          ) : undefined
        }
      />

      {/* Modals */}
      <CreateUserModal isOpen={createModalOpen} onClose={() => setCreateModalOpen(false)} onSuccess={handleModalSuccess} />
      <EditUserModal isOpen={editUserId !== null} onClose={() => setEditUserId(null)} userId={editUserId} onSuccess={handleModalSuccess} />
      <PasswordResetModal isOpen={passwordResetUser !== null} onClose={() => setPasswordResetUser(null)} user={passwordResetUser} onSuccess={handleModalSuccess} />
      <BanUserModal isOpen={banUser !== null} onClose={() => setBanUser(null)} user={banUser} onSuccess={handleModalSuccess} />
      <PhoneTransferModal isOpen={transferUserId !== null} onClose={() => setTransferUserId(null)} sourceUserId={transferUserId} onSuccess={handleModalSuccess} />
      <DeleteUserModal user={deleteUser} onClose={() => setDeleteUser(null)} onConfirm={handleDeleteConfirm} loading={deleteUserMutation.isPending} />
      <BulkDeleteModal isOpen={bulkDeleteConfirm} selectedCount={selectedUserIds.size} onClose={() => setBulkDeleteConfirm(false)} onConfirm={handleBulkDeleteConfirm} loading={bulkDeleteMutation.isPending} />
    </div>
  );
}
