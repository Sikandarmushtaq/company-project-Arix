'use client';

import React, { useState, useCallback } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Input, Button } from '@/components/ui';
import { useSetBanStatus } from '@/lib/hooks/useAdmin';
import { useAuthStore } from '@/lib/stores';
import { FiAlertTriangle, FiShield, FiShieldOff } from 'react-icons/fi';
import type { AdminUser } from '@/lib/api/services/admin.service';

interface BanUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: AdminUser | null;
  onSuccess?: () => void;
}

export function BanUserModal({ isOpen, onClose, user, onSuccess }: BanUserModalProps) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const setBanStatus = useSetBanStatus();
  const { user: currentUser } = useAuthStore();

  // Check if trying to ban self
  const isSelf = currentUser && user && currentUser.id === user.id;

  const handleClose = useCallback(() => {
    setReason('');
    setError(null);
    onClose();
  }, [onClose]);

  const handleSubmit = useCallback(async () => {
    if (!user) return;

    try {
      await setBanStatus.mutateAsync({
        id: user.id,
        banned: !user.banned,
        reason: reason.trim() || undefined,
      });

      handleClose();
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Operation failed');
    }
  }, [user, reason, setBanStatus, handleClose, onSuccess]);

  if (!user) return null;

  const isBanning = !user.banned;

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={
        isBanning
          ? `Ban User: ${user.fullName || user.senderPhone}`
          : `Unban User: ${user.fullName || user.senderPhone}`
      }
      size="sm"
      footer={
        <div className="flex justify-end gap-3">
          <Button
            type="button"
            variant="secondary"
            onClick={handleClose}
            disabled={setBanStatus.isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant={isBanning ? 'danger' : 'success'}
            onClick={handleSubmit}
            loading={setBanStatus.isPending}
            disabled={Boolean(isSelf && isBanning)}
          >
            {isBanning ? 'Ban User' : 'Unban User'}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {error && (
          <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm">
            {error}
          </div>
        )}

        {isSelf && isBanning && (
          <div className="p-3 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800">
            <div className="flex items-start gap-2">
              <FiAlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-yellow-700 dark:text-yellow-300">
                You cannot ban yourself. Please ask another admin to perform this action.
              </p>
            </div>
          </div>
        )}

        {isBanning ? (
          <>
            <div className="p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
              <div className="flex items-start gap-3">
                <FiShieldOff className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
                <div>
                  <h4 className="font-medium text-red-800 dark:text-red-200">Ban this user?</h4>
                  <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                    The user will be immediately logged out and prevented from accessing the system.
                    All active sessions will be terminated.
                  </p>
                </div>
              </div>
            </div>

            <Input
              label="Ban Reason (Optional)"
              placeholder="Enter reason for ban..."
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                setError(null);
              }}
              hint="This will be visible in the admin panel"
            />
          </>
        ) : (
          <div className="p-4 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
            <div className="flex items-start gap-3">
              <FiShield className="w-5 h-5 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
              <div>
                <h4 className="font-medium text-green-800 dark:text-green-200">Unban this user?</h4>
                <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                  The user will be able to log in and access the system again.
                </p>
                {user.banReason && (
                  <div className="mt-2 p-2 rounded bg-white/50 dark:bg-black/20">
                    <p className="text-xs text-green-600 dark:text-green-400">
                      Original ban reason: {user.banReason}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* User Details */}
        <div className="p-3 rounded-lg bg-[var(--muted)]/50">
          <h4 className="text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wider mb-2">
            User Details
          </h4>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="text-[var(--muted-foreground)]">Email:</div>
            <div className="text-[var(--foreground)]">{user.email}</div>
            <div className="text-[var(--muted-foreground)]">Role:</div>
            <div className="text-[var(--foreground)] capitalize">{user.role}</div>
            <div className="text-[var(--muted-foreground)]">Extension:</div>
            <div className="text-[var(--foreground)] font-mono">{user.extension}</div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
