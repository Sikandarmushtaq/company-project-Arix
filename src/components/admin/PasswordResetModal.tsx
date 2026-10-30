'use client';

import React, { useState, useCallback } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Input, Button } from '@/components/ui';
import { useUpdateUserPassword } from '@/lib/hooks/useAdmin';
import { FiLock, FiAlertTriangle } from 'react-icons/fi';
import type { AdminUser } from '@/lib/api/services/admin.service';

interface PasswordResetModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: AdminUser | null;
  onSuccess?: () => void;
}

interface FormData {
  newPassword: string;
  confirmPassword: string;
}

interface FormErrors {
  newPassword?: string;
  confirmPassword?: string;
  general?: string;
}

export function PasswordResetModal({
  isOpen,
  onClose,
  user,
  onSuccess,
}: PasswordResetModalProps) {
  const [formData, setFormData] = useState<FormData>({
    newPassword: '',
    confirmPassword: '',
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const updatePassword = useUpdateUserPassword();

  const handleClose = useCallback(() => {
    setFormData({ newPassword: '', confirmPassword: '' });
    setErrors({});
    onClose();
  }, [onClose]);

  const validateForm = useCallback((): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.newPassword) {
      newErrors.newPassword = 'Password is required';
    } else if (formData.newPassword.length < 8) {
      newErrors.newPassword = 'Password must be at least 8 characters';
    } else if (formData.newPassword.length > 128) {
      newErrors.newPassword = 'Password must be less than 128 characters';
    }

    if (formData.newPassword !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm() || !user) return;

    try {
      await updatePassword.mutateAsync({
        id: user.id,
        password: formData.newPassword,
      });

      handleClose();
      onSuccess?.();
    } catch (error) {
      setErrors({
        general: error instanceof Error ? error.message : 'Failed to reset password',
      });
    }
  }, [formData, user, validateForm, updatePassword, handleClose, onSuccess]);

  const handleInputChange = useCallback((field: keyof FormData) => (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    setFormData(prev => ({ ...prev, [field]: e.target.value }));
    setErrors(prev => ({ ...prev, [field]: undefined, general: undefined }));
  }, []);

  if (!user) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={`Reset Password: ${user.fullName || user.senderPhone}`}
      size="sm"
      footer={
        <div className="flex justify-end gap-3">
          <Button
            type="button"
            variant="secondary"
            onClick={handleClose}
            disabled={updatePassword.isPending}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            onClick={handleSubmit}
            loading={updatePassword.isPending}
          >
            Reset Password
          </Button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {errors.general && (
          <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm">
            {errors.general}
          </div>
        )}

        <div className="p-3 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800">
          <div className="flex items-start gap-2">
            <FiAlertTriangle className="w-4 h-4 text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-yellow-700 dark:text-yellow-300">
              This will immediately invalidate all active sessions for this user.
              They will need to log in again with the new password.
            </p>
          </div>
        </div>

        <Input
          label="New Password"
          type="password"
          placeholder="Min. 8 characters"
          value={formData.newPassword}
          onChange={handleInputChange('newPassword')}
          error={errors.newPassword}
          leftIcon={<FiLock className="w-4 h-4" />}
          autoComplete="new-password"
        />

        <Input
          label="Confirm Password"
          type="password"
          placeholder="Repeat password"
          value={formData.confirmPassword}
          onChange={handleInputChange('confirmPassword')}
          error={errors.confirmPassword}
          leftIcon={<FiLock className="w-4 h-4" />}
          autoComplete="new-password"
        />
      </form>
    </Modal>
  );
}
