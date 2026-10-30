'use client';

import React, { useState, useCallback } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Input, Button, Toggle } from '@/components/ui';
import { useAdminUser } from '@/lib/hooks/useAdmin';
import { formatPhoneNumber } from '@/lib/utils/formatting';
import {
  FiUser,
  FiMail,
  FiLock,
  FiPhone,
  FiHash,
  FiAlertTriangle,
  FiCheckCircle,
} from 'react-icons/fi';
import { adminService, type AdminUser } from '@/lib/api/services/admin.service';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { adminKeys } from '@/lib/hooks/useAdmin';

interface PhoneTransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  sourceUserId: number | null;
  onSuccess?: () => void;
}

interface FormData {
  newEmail: string;
  newPassword: string;
  confirmPassword: string;
  newFullName: string;
  newCompanyName: string;
  deleteCallLogs: boolean;
  deleteSmsMessages: boolean;
  deleteRecordings: boolean;
}

interface FormErrors {
  newEmail?: string;
  newPassword?: string;
  confirmPassword?: string;
  newFullName?: string;
  general?: string;
}

const initialFormData: FormData = {
  newEmail: '',
  newPassword: '',
  confirmPassword: '',
  newFullName: '',
  newCompanyName: '',
  deleteCallLogs: true,
  deleteSmsMessages: true,
  deleteRecordings: true,
};

export function PhoneTransferModal({
  isOpen,
  onClose,
  sourceUserId,
  onSuccess,
}: PhoneTransferModalProps) {
  const { data: sourceUser, isLoading: userLoading } = useAdminUser(sourceUserId ?? 0);
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [errors, setErrors] = useState<FormErrors>({});
  const [step, setStep] = useState<'form' | 'confirm'>('form');

  // Transfer mutation - calls the backend endpoint
  const transferMutation = useMutation({
    mutationFn: async (data: {
      sourceUserId: number;
      newEmail: string;
      newPassword: string;
      newFullName: string;
      newCompanyName?: string;
      cleanupOldData: boolean;
    }) => {
      // Call the transfer-to-new endpoint
      const response = await fetch(`/api/v1/admin/users/${data.sourceUserId}/transfer-to-new`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          newEmail: data.newEmail,
          newPassword: data.newPassword,
          newFullName: data.newFullName,
          newCompanyName: data.newCompanyName,
          cleanupOldData: data.cleanupOldData,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Transfer failed');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.users() });
      queryClient.invalidateQueries({ queryKey: adminKeys.stats() });
    },
  });

  const handleClose = useCallback(() => {
    setFormData(initialFormData);
    setErrors({});
    setStep('form');
    onClose();
  }, [onClose]);

  const validateForm = useCallback((): boolean => {
    const newErrors: FormErrors = {};

    // Email validation
    if (!formData.newEmail.trim()) {
      newErrors.newEmail = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.newEmail)) {
      newErrors.newEmail = 'Invalid email format';
    }

    // Password validation
    if (!formData.newPassword) {
      newErrors.newPassword = 'Password is required';
    } else if (formData.newPassword.length < 8) {
      newErrors.newPassword = 'Password must be at least 8 characters';
    }

    // Confirm password
    if (formData.newPassword !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    // Full name validation
    if (!formData.newFullName.trim()) {
      newErrors.newFullName = 'Full name is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData]);

  const handleNext = useCallback(() => {
    if (validateForm()) {
      setStep('confirm');
    }
  }, [validateForm]);

  const handleBack = useCallback(() => {
    setStep('form');
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!sourceUserId || !sourceUser) return;

    try {
      await transferMutation.mutateAsync({
        sourceUserId,
        newEmail: formData.newEmail.trim(),
        newPassword: formData.newPassword,
        newFullName: formData.newFullName.trim(),
        newCompanyName: formData.newCompanyName.trim() || undefined,
        cleanupOldData:
          formData.deleteCallLogs || formData.deleteSmsMessages || formData.deleteRecordings,
      });

      handleClose();
      onSuccess?.();
    } catch (error) {
      setErrors({
        general: error instanceof Error ? error.message : 'Transfer failed',
      });
      setStep('form');
    }
  }, [sourceUserId, sourceUser, formData, transferMutation, handleClose, onSuccess]);

  const handleInputChange = useCallback(
    (field: keyof FormData) => (e: React.ChangeEvent<HTMLInputElement>) => {
      setFormData((prev) => ({ ...prev, [field]: e.target.value }));
      setErrors((prev) => ({ ...prev, [field]: undefined, general: undefined }));
    },
    []
  );

  const handleToggleChange = useCallback(
    (field: keyof FormData) => (checked: boolean) => {
      setFormData((prev) => ({ ...prev, [field]: checked }));
    },
    []
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Transfer Phone to New User"
      size="lg"
      footer={
        <div className="flex justify-between">
          {step === 'confirm' && (
            <Button
              type="button"
              variant="secondary"
              onClick={handleBack}
              disabled={transferMutation.isPending}
            >
              Back
            </Button>
          )}
          <div className="flex gap-3 ml-auto">
            <Button
              type="button"
              variant="secondary"
              onClick={handleClose}
              disabled={transferMutation.isPending}
            >
              Cancel
            </Button>
            {step === 'form' ? (
              <Button type="button" variant="primary" onClick={handleNext}>
                Review Transfer
              </Button>
            ) : (
              <Button
                type="button"
                variant="danger"
                onClick={handleSubmit}
                loading={transferMutation.isPending}
              >
                Confirm Transfer
              </Button>
            )}
          </div>
        </div>
      }
    >
      {userLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-4 border-[var(--border)] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : !sourceUser ? (
        <div className="p-4 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm">
          Failed to load user data.
        </div>
      ) : step === 'form' ? (
        <div className="space-y-6">
          {errors.general && (
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm">
              {errors.general}
            </div>
          )}

          {/* Source User Info (Preserved) */}
          <div className="p-4 rounded-lg bg-[var(--muted)]/50 border border-[var(--border)]">
            <h3 className="text-sm font-medium text-[var(--foreground)] mb-3 flex items-center gap-2">
              <FiCheckCircle className="w-4 h-4 text-green-500" />
              These will be preserved
            </h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="flex items-center gap-2">
                <FiHash className="w-4 h-4 text-[var(--muted-foreground)]" />
                <span className="text-[var(--muted-foreground)]">SIP Extension:</span>
                <span className="font-mono text-[var(--foreground)]">{sourceUser.extension}</span>
              </div>
              <div className="flex items-center gap-2">
                <FiPhone className="w-4 h-4 text-[var(--muted-foreground)]" />
                <span className="text-[var(--muted-foreground)]">Phone Number:</span>
                <span className="font-mono text-[var(--foreground)]">
                  {formatPhoneNumber(sourceUser.extension) || 'N/A'}
                </span>
              </div>
              <div className="col-span-2 text-xs text-[var(--muted-foreground)]">
                SIP password will also be preserved (unchanged)
              </div>
            </div>
          </div>

          {/* New User Details */}
          <div>
            <h3 className="text-sm font-medium text-[var(--foreground)] mb-3">New User Details</h3>
            <div className="space-y-4">
              <Input
                label="Full Name"
                placeholder="Enter full name"
                value={formData.newFullName}
                onChange={handleInputChange('newFullName')}
                error={errors.newFullName}
                leftIcon={<FiUser className="w-4 h-4" />}
              />
              <Input
                label="Email"
                type="email"
                placeholder="newuser@example.com"
                value={formData.newEmail}
                onChange={handleInputChange('newEmail')}
                error={errors.newEmail}
                leftIcon={<FiMail className="w-4 h-4" />}
              />
              <Input
                label="Company Name (Optional)"
                placeholder="Company or organization"
                value={formData.newCompanyName}
                onChange={handleInputChange('newCompanyName')}
              />
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Password"
                  type="password"
                  placeholder="Min. 8 characters"
                  value={formData.newPassword}
                  onChange={handleInputChange('newPassword')}
                  error={errors.newPassword}
                  leftIcon={<FiLock className="w-4 h-4" />}
                />
                <Input
                  label="Confirm Password"
                  type="password"
                  placeholder="Repeat password"
                  value={formData.confirmPassword}
                  onChange={handleInputChange('confirmPassword')}
                  error={errors.confirmPassword}
                  leftIcon={<FiLock className="w-4 h-4" />}
                />
              </div>
            </div>
          </div>

          {/* Data Cleanup Options */}
          <div>
            <h3 className="text-sm font-medium text-[var(--foreground)] mb-1 flex items-center gap-2">
              <FiAlertTriangle className="w-4 h-4 text-yellow-500" />
              Data Cleanup (Old User)
            </h3>
            <p className="text-xs text-[var(--muted-foreground)] mb-3">
              Select which data to delete from the current user
            </p>
            <div className="space-y-3">
              <Toggle
                checked={formData.deleteCallLogs}
                onChange={handleToggleChange('deleteCallLogs')}
                label="Delete Call Logs"
                description="Remove all call history for this user"
              />
              <Toggle
                checked={formData.deleteSmsMessages}
                onChange={handleToggleChange('deleteSmsMessages')}
                label="Delete SMS Messages"
                description="Remove all SMS conversations"
              />
              <Toggle
                checked={formData.deleteRecordings}
                onChange={handleToggleChange('deleteRecordings')}
                label="Delete Recordings"
                description="Remove all call recordings"
              />
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Confirmation Summary */}
          <div className="p-4 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800">
            <h3 className="text-sm font-semibold text-yellow-800 dark:text-yellow-200 mb-2 flex items-center gap-2">
              <FiAlertTriangle className="w-4 h-4" />
              Please Review Before Confirming
            </h3>
            <p className="text-sm text-yellow-700 dark:text-yellow-300">
              This action will transfer the phone number and SIP credentials to a new user account.
              The current user ({sourceUser.fullName || sourceUser.senderPhone}) will lose access.
            </p>
          </div>

          {/* Summary */}
          <div className="space-y-4">
            <div className="p-4 rounded-lg border border-[var(--border)]">
              <h4 className="text-sm font-medium text-[var(--foreground)] mb-2">New User</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="text-[var(--muted-foreground)]">Name:</div>
                <div className="text-[var(--foreground)]">{formData.newFullName}</div>
                <div className="text-[var(--muted-foreground)]">Email:</div>
                <div className="text-[var(--foreground)]">{formData.newEmail}</div>
                {formData.newCompanyName && (
                  <>
                    <div className="text-[var(--muted-foreground)]">Company:</div>
                    <div className="text-[var(--foreground)]">{formData.newCompanyName}</div>
                  </>
                )}
              </div>
            </div>

            <div className="p-4 rounded-lg border border-[var(--border)]">
              <h4 className="text-sm font-medium text-[var(--foreground)] mb-2">
                Preserved From Original
              </h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="text-[var(--muted-foreground)]">SIP Extension:</div>
                <div className="font-mono text-[var(--foreground)]">{sourceUser.extension}</div>
                <div className="text-[var(--muted-foreground)]">SIP Password:</div>
                <div className="text-[var(--foreground)]">(unchanged)</div>
              </div>
            </div>

            {(formData.deleteCallLogs ||
              formData.deleteSmsMessages ||
              formData.deleteRecordings) && (
              <div className="p-4 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20">
                <h4 className="text-sm font-medium text-red-800 dark:text-red-200 mb-2">
                  Data to be Deleted
                </h4>
                <ul className="text-sm text-red-700 dark:text-red-300 space-y-1">
                  {formData.deleteCallLogs && <li>- All call logs</li>}
                  {formData.deleteSmsMessages && <li>- All SMS messages</li>}
                  {formData.deleteRecordings && <li>- All call recordings</li>}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
