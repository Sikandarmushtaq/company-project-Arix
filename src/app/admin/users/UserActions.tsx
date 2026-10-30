'use client';

import React, { useState, useEffect } from 'react';
import {
  FiTrash2,
  FiCheck,
  FiLoader,
  FiShield,
  FiMessageSquare,
  FiPhone,
  FiChevronDown,
  FiAlertTriangle,
  FiUser,
} from 'react-icons/fi';
import { Button, Input } from '@/components/ui';
import { Modal } from '@/components/ui/Modal';
import type { AdminUser } from '@/lib/api/services';

// ============================================================================
// Bulk Actions Dropdown
// ============================================================================

export interface UserActionsProps {
  selectedCount: number;
  onBan: () => void;
  onUnban: () => void;
  onEnableSms: () => void;
  onDisableSms: () => void;
  onEnableAutoDialer: () => void;
  onDisableAutoDialer: () => void;
  onDelete: () => void;
  isLoading: boolean;
}

export function UserActions({
  selectedCount,
  onBan,
  onUnban,
  onEnableSms,
  onDisableSms,
  onEnableAutoDialer,
  onDisableAutoDialer,
  onDelete,
  isLoading,
}: UserActionsProps) {
  const [isOpen, setIsOpen] = useState(false);

  if (selectedCount === 0) return null;

  return (
    <div className="relative">
      <Button
        variant="outline"
        onClick={() => setIsOpen(!isOpen)}
        disabled={isLoading}
        className="flex items-center gap-2"
      >
        {isLoading ? (
          <FiLoader className="w-4 h-4 animate-spin" />
        ) : (
          <>
            Bulk Actions ({selectedCount})
            <FiChevronDown className="w-4 h-4" />
          </>
        )}
      </Button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute left-0 mt-1 w-56 rounded-lg border border-[var(--border)] bg-[var(--card)] shadow-lg z-50">
            <div className="py-1">
              <div className="px-3 py-2 text-xs font-semibold text-[var(--muted-foreground)] uppercase">
                Status
              </div>
              <button
                className="w-full px-4 py-2 text-left text-sm text-[var(--foreground)] hover:bg-[var(--muted)] flex items-center gap-2"
                onClick={() => {
                  setIsOpen(false);
                  onBan();
                }}
              >
                <FiShield className="w-4 h-4 text-red-500" />
                Ban Selected
              </button>
              <button
                className="w-full px-4 py-2 text-left text-sm text-[var(--foreground)] hover:bg-[var(--muted)] flex items-center gap-2"
                onClick={() => {
                  setIsOpen(false);
                  onUnban();
                }}
              >
                <FiCheck className="w-4 h-4 text-green-500" />
                Unban Selected
              </button>

              <div className="border-t border-[var(--border)] my-1" />

              <div className="px-3 py-2 text-xs font-semibold text-[var(--muted-foreground)] uppercase">
                SMS
              </div>
              <button
                className="w-full px-4 py-2 text-left text-sm text-[var(--foreground)] hover:bg-[var(--muted)] flex items-center gap-2"
                onClick={() => {
                  setIsOpen(false);
                  onEnableSms();
                }}
              >
                <FiMessageSquare className="w-4 h-4 text-green-500" />
                Enable SMS
              </button>
              <button
                className="w-full px-4 py-2 text-left text-sm text-[var(--foreground)] hover:bg-[var(--muted)] flex items-center gap-2"
                onClick={() => {
                  setIsOpen(false);
                  onDisableSms();
                }}
              >
                <FiMessageSquare className="w-4 h-4 text-gray-400" />
                Disable SMS
              </button>

              <div className="border-t border-[var(--border)] my-1" />

              <div className="px-3 py-2 text-xs font-semibold text-[var(--muted-foreground)] uppercase">
                Auto-Dialer
              </div>
              <button
                className="w-full px-4 py-2 text-left text-sm text-[var(--foreground)] hover:bg-[var(--muted)] flex items-center gap-2"
                onClick={() => {
                  setIsOpen(false);
                  onEnableAutoDialer();
                }}
              >
                <FiPhone className="w-4 h-4 text-green-500" />
                Enable Auto-Dialer
              </button>
              <button
                className="w-full px-4 py-2 text-left text-sm text-[var(--foreground)] hover:bg-[var(--muted)] flex items-center gap-2"
                onClick={() => {
                  setIsOpen(false);
                  onDisableAutoDialer();
                }}
              >
                <FiPhone className="w-4 h-4 text-gray-400" />
                Disable Auto-Dialer
              </button>

              <div className="border-t border-[var(--border)] my-1" />

              <button
                className="w-full px-4 py-2 text-left text-sm text-[var(--danger)] hover:bg-[var(--muted)] flex items-center gap-2"
                onClick={() => {
                  setIsOpen(false);
                  onDelete();
                }}
              >
                <FiTrash2 className="w-4 h-4" />
                Delete Selected
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ============================================================================
// DATA_CLEANUP_ITEMS (shared between delete modals)
// ============================================================================

const DATA_CLEANUP_ITEMS = [
  { icon: FiPhone, label: 'Call History', color: 'text-blue-500' },
  { icon: FiMessageSquare, label: 'SMS Messages', color: 'text-green-500' },
  { icon: FiUser, label: 'Contacts & Blocked Numbers', color: 'text-purple-500' },
  { icon: FiPhone, label: 'Voicemails & Recordings', color: 'text-orange-500' },
  { icon: FiMessageSquare, label: 'SMS Groups', color: 'text-teal-500' },
  { icon: FiShield, label: 'SIP Extension & Inbound DID', color: 'text-red-500' },
];

// ============================================================================
// Delete User Modal
// ============================================================================

export interface DeleteUserModalProps {
  user: AdminUser | null;
  onClose: () => void;
  onConfirm: () => void;
  loading: boolean;
}

export function DeleteUserModal({
  user,
  onClose,
  onConfirm,
  loading,
}: DeleteUserModalProps) {
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
        {/* Warning banner */}
        <div className="flex items-start gap-3 p-3 rounded-lg bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800">
          <FiAlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-red-800 dark:text-red-200">Permanent Deletion</p>
            <p className="text-sm text-red-600 dark:text-red-400 mt-0.5">
              This will permanently delete the user account and all associated data. This action
              cannot be undone.
            </p>
          </div>
        </div>

        {/* User info card */}
        <div className="flex items-center gap-3 p-3 rounded-lg bg-[var(--muted)] border border-[var(--border)]">
          <div className="w-10 h-10 rounded-full bg-[var(--primary)] flex items-center justify-center text-white font-medium">
            {(user.fullName || user.senderPhone || '?')[0].toUpperCase()}
          </div>
          <div>
            <p className="font-medium text-[var(--foreground)]">{user.fullName || 'No Name'}</p>
            <p className="text-sm text-[var(--muted-foreground)]">
              {user.senderPhone} {user.extension ? `| Ext. ${user.extension}` : ''}
            </p>
          </div>
        </div>

        {/* Data cleanup checklist */}
        <div>
          <p className="text-sm font-medium text-[var(--foreground)] mb-2">
            The following data will be permanently deleted:
          </p>
          <div className="space-y-1.5">
            {DATA_CLEANUP_ITEMS.map((item) => (
              <div
                key={item.label}
                className="flex items-center gap-2 text-sm text-[var(--muted-foreground)]"
              >
                <item.icon className={`w-4 h-4 ${item.color}`} />
                <span>{item.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Type to confirm */}
        <div>
          <label className="block text-sm text-[var(--muted-foreground)] mb-1">
            Type <span className="font-semibold text-[var(--foreground)]">{displayName}</span> to
            confirm:
          </label>
          <Input
            value={confirmName}
            onChange={(e) => setConfirmName(e.target.value)}
            placeholder={displayName}
            autoFocus
          />
        </div>
      </div>

      <div className="flex justify-end gap-3 mt-6">
        <Button variant="outline" onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button variant="danger" onClick={onConfirm} disabled={!canConfirm || loading}>
          {loading ? (
            <FiLoader className="w-4 h-4 animate-spin mr-2" />
          ) : (
            <FiTrash2 className="w-4 h-4 mr-2" />
          )}
          Delete User
        </Button>
      </div>
    </Modal>
  );
}

// ============================================================================
// Bulk Delete Modal
// ============================================================================

export interface BulkDeleteModalProps {
  isOpen: boolean;
  selectedCount: number;
  onClose: () => void;
  onConfirm: () => void;
  loading: boolean;
}

export function BulkDeleteModal({
  isOpen,
  selectedCount,
  onClose,
  onConfirm,
  loading,
}: BulkDeleteModalProps) {
  const [confirmText, setConfirmText] = useState('');

  useEffect(() => {
    if (!isOpen) setConfirmText('');
  }, [isOpen]);

  const confirmPhrase = `delete ${selectedCount}`;
  const canConfirm = confirmText.toLowerCase() === confirmPhrase;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Delete Multiple Users" size="lg">
      <div className="space-y-4">
        {/* Warning banner */}
        <div className="flex items-start gap-3 p-3 rounded-lg bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800">
          <FiAlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-red-800 dark:text-red-200">
              Bulk Permanent Deletion
            </p>
            <p className="text-sm text-red-600 dark:text-red-400 mt-0.5">
              This will permanently delete {selectedCount} user account(s) and all associated data.
              Admin users will be skipped.
            </p>
          </div>
        </div>

        {/* Data cleanup checklist */}
        <div>
          <p className="text-sm font-medium text-[var(--foreground)] mb-2">
            For each user, the following will be deleted:
          </p>
          <div className="space-y-1.5">
            {DATA_CLEANUP_ITEMS.map((item) => (
              <div
                key={item.label}
                className="flex items-center gap-2 text-sm text-[var(--muted-foreground)]"
              >
                <item.icon className={`w-4 h-4 ${item.color}`} />
                <span>{item.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Type to confirm */}
        <div>
          <label className="block text-sm text-[var(--muted-foreground)] mb-1">
            Type <span className="font-semibold text-[var(--foreground)]">{confirmPhrase}</span> to
            confirm:
          </label>
          <Input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={confirmPhrase}
            autoFocus
          />
        </div>
      </div>

      <div className="flex justify-end gap-3 mt-6">
        <Button variant="outline" onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button variant="danger" onClick={onConfirm} disabled={!canConfirm || loading}>
          {loading ? (
            <FiLoader className="w-4 h-4 animate-spin mr-2" />
          ) : (
            <FiTrash2 className="w-4 h-4 mr-2" />
          )}
          Delete {selectedCount} User(s)
        </Button>
      </div>
    </Modal>
  );
}
