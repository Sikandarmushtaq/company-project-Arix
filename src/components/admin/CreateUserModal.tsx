'use client';

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Input, Button, Select, Toggle } from '@/components/ui';
import { useCreateUser, useAdminUsers } from '@/lib/hooks/useAdmin';
import { usePermissions } from '@/lib/hooks/usePermissions';
import { normalizePhone } from '@/lib/utils/phone';
import { isPossibleNumber } from '@/lib/utils/phone-format';
import { generateSecurePassword } from '@/lib/utils/password';
import {
  FiUser,
  FiMail,
  FiLock,
  FiPhone,
  FiHash,
  FiSettings,
  FiClock,
  FiRefreshCw,
  FiAlertCircle,
} from 'react-icons/fi';

interface CreateUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

interface FormData {
  fullName: string;
  phone: string;
  email: string;
  password: string;
  confirmPassword: string;
  role: 'admin' | 'manager' | 'user';
  extension: string;
  sipPassword: string;
  useCustomSipPassword: boolean;
  serverPreference: 'main' | 'backup';
  // Capabilities — control which sections of the form are required and which
  // backend resources are provisioned. WhatsApp is intentionally NOT here:
  // enabling it requires an organization assignment, which the admin does
  // from the Edit User modal after creation (keeps Create lean and avoids
  // forcing org picking in the create flow).
  voiceEnabled: boolean;
  smsEnabled: boolean;
  autoDialerEnabled: boolean;
  smsType: 'standard' | 'auto' | 'both' | null;
  limitMax: number;
  callTimeout: number;
}

interface FormErrors {
  fullName?: string;
  phone?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
  extension?: string;
  sipPassword?: string;
  general?: string;
}

const initialFormData: FormData = {
  fullName: '',
  phone: '',
  email: '',
  password: '',
  confirmPassword: '',
  role: 'user',
  extension: '',
  sipPassword: '',
  useCustomSipPassword: false,
  serverPreference: 'main',
  // Default capabilities match the most common case (a regular agent with
  // softphone + SMS). Admin un-checks Voice for a WhatsApp-only / SMS-only
  // user; they'll enable WhatsApp later from Edit User.
  voiceEnabled: true,
  smsEnabled: true,
  autoDialerEnabled: false,
  smsType: 'standard',
  limitMax: 5,
  callTimeout: 30,
};

export function CreateUserModal({ isOpen, onClose, onSuccess }: CreateUserModalProps) {
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [errors, setErrors] = useState<FormErrors>({});
  const [generatedSipPassword, setGeneratedSipPassword] = useState('');
  const createUser = useCreateUser();
  // Only the platform super admin may create Administrators; a tenant admin
  // manages users/managers within their org, not other admins.
  const { isSuperAdmin } = usePermissions();

  // Fetch existing users to check for duplicate extensions
  const { data: usersData, isLoading: isLoadingUsers } = useAdminUsers({ limit: 1000 });
  const existingExtensions = useMemo(() => {
    if (!usersData?.users) return [];
    return usersData.users
      .map((u) => u.extension?.trim())
      .filter((ext): ext is string => Boolean(ext));
  }, [usersData]);

  // Generate SIP password when modal opens
  useEffect(() => {
    if (isOpen) {
      setGeneratedSipPassword(generateSecurePassword(16));
    }
  }, [isOpen]);

  const handleClose = useCallback(() => {
    setFormData(initialFormData);
    setErrors({});
    setGeneratedSipPassword('');
    onClose();
  }, [onClose]);

  const validateForm = useCallback((): boolean => {
    const newErrors: FormErrors = {};

    // Always-required identity fields
    if (!formData.fullName.trim()) {
      newErrors.fullName = 'Full name is required';
    }

    // Phone number — required when Voice or SMS capability is on. A
    // WhatsApp-only user (no voice, no SMS) doesn't need a phone here;
    // their WhatsApp number is assigned separately via the WA Numbers page.
    const phoneRequired = formData.voiceEnabled || formData.smsEnabled;
    if (phoneRequired) {
      if (!formData.phone.trim()) {
        newErrors.phone = 'Phone number is required for Voice or SMS';
      } else {
        const normalized = normalizePhone(formData.phone);
        if (!isPossibleNumber('+' + normalized)) {
          newErrors.phone = 'Enter a valid phone number with country code (e.g. 12164281997 or 443300013011)';
        }
      }
    } else if (formData.phone.trim()) {
      // Even when not required, validate format if entered.
      const normalized = normalizePhone(formData.phone);
      if (!isPossibleNumber('+' + normalized)) {
        newErrors.phone = 'Enter a valid phone number with country code (e.g. 12164281997 or 443300013011)';
      }
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Invalid email format';
    }

    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters';
    }

    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    // Extension + SIP password — required only when Voice capability is on.
    if (formData.voiceEnabled) {
      if (!formData.extension.trim()) {
        newErrors.extension = 'Extension is required for Voice Calling';
      } else if (!/^\d{3,6}$/.test(formData.extension)) {
        newErrors.extension = 'Extension must be 3-6 digits';
      } else if (existingExtensions.includes(formData.extension.trim())) {
        newErrors.extension = 'This extension is already in use';
      }

      // SIP password validation only matters when admin chose a custom one;
      // the auto-generated path always passes.
      if (formData.useCustomSipPassword) {
        if (!formData.sipPassword.trim()) {
          newErrors.sipPassword = 'SIP password is required';
        } else if (formData.sipPassword.length < 8) {
          newErrors.sipPassword = 'SIP password must be at least 8 characters';
        } else if (!/[a-zA-Z]/.test(formData.sipPassword)) {
          newErrors.sipPassword = 'SIP password must contain at least one letter';
        } else if (!/\d/.test(formData.sipPassword)) {
          newErrors.sipPassword = 'SIP password must contain at least one digit';
        }
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData, existingExtensions]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      // Extension duplicate check is only meaningful when Voice is on.
      if (
        formData.voiceEnabled &&
        !isLoadingUsers &&
        existingExtensions.includes(formData.extension.trim())
      ) {
        setErrors({ extension: 'This extension is already in use' });
        return;
      }

      if (!validateForm()) return;

      try {
        // Build the payload from active capabilities only. Fields that
        // belong to a disabled capability are omitted so the backend can
        // skip the matching provisioning (FusionPBX extension, dialplan).
        const payload: Parameters<typeof createUser.mutateAsync>[0] = {
          fullName: formData.fullName.trim(),
          email: formData.email.trim(),
          password: formData.password,
          role: formData.role,
          smsEnabled: formData.smsEnabled,
          autoDialerEnabled: formData.autoDialerEnabled,
          smsType: formData.smsType,
        };

        // Phone number — sent when Voice or SMS is on, OR when admin
        // entered one (some flows store a contact phone without enabling
        // either capability — backend treats it as an identifier only).
        if (formData.phone.trim()) {
          payload.senderPhone = formData.phone.trim();
        }

        // Voice-only fields
        if (formData.voiceEnabled) {
          payload.extension = formData.extension.trim();
          payload.sipPassword = formData.useCustomSipPassword
            ? formData.sipPassword.trim()
            : generatedSipPassword;
          payload.serverPreference = formData.serverPreference;
          payload.limitMax = formData.limitMax;
          payload.callTimeout = formData.callTimeout;
        }

        await createUser.mutateAsync(payload);

        handleClose();
        onSuccess?.();
      } catch (error) {
        setErrors({
          general: error instanceof Error ? error.message : 'Failed to create user',
        });
      }
    },
    [
      formData,
      validateForm,
      createUser,
      handleClose,
      onSuccess,
      generatedSipPassword,
      isLoadingUsers,
      existingExtensions,
    ]
  );

  const handleInputChange = useCallback(
    (field: keyof FormData) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      setFormData((prev) => ({ ...prev, [field]: e.target.value }));
      setErrors((prev) => ({ ...prev, [field]: undefined, general: undefined }));
    },
    []
  );

  // Role change: an Administrator manages the account and does NOT make calls,
  // so they get no SIP extension. Force Voice Calling off (which hides the whole
  // FusionPBX extension section + drops its validation).
  const handleRoleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      const role = e.target.value as FormData['role'];
      setFormData((prev) => ({
        ...prev,
        role,
        voiceEnabled: role === 'admin' ? false : prev.voiceEnabled,
      }));
      setErrors((prev) => ({
        ...prev,
        role: undefined,
        extension: undefined,
        sipPassword: undefined,
        general: undefined,
      }));
    },
    []
  );

  // Real-time extension duplicate check
  const handleExtensionChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setFormData((prev) => ({ ...prev, extension: value }));

      // Clear previous error first
      setErrors((prev) => ({ ...prev, extension: undefined, general: undefined }));

      // Real-time duplicate check
      const trimmedValue = value.trim();
      if (trimmedValue && existingExtensions.includes(trimmedValue)) {
        setErrors((prev) => ({ ...prev, extension: 'This extension is already in use' }));
      }
    },
    [existingExtensions]
  );

  const handleToggleChange = useCallback(
    (field: 'voiceEnabled' | 'smsEnabled' | 'autoDialerEnabled') => (checked: boolean) => {
      setFormData((prev) => {
        const next = { ...prev, [field]: checked };
        // Turning Voice off clears any extension/SIP errors that no longer
        // apply, so the form doesn't show stale validation.
        if (field === 'voiceEnabled' && !checked) {
          setErrors((errs) => ({
            ...errs,
            extension: undefined,
            sipPassword: undefined,
          }));
        }
        return next;
      });
    },
    []
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Create New User"
      size="lg"
      footer={
        <div className="flex justify-end gap-3">
          <Button
            type="button"
            variant="secondary"
            onClick={handleClose}
            disabled={createUser.isPending}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            onClick={handleSubmit}
            loading={createUser.isPending}
          >
            Create User
          </Button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {errors.general && (
          <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm">
            {errors.general}
          </div>
        )}

        {/* Basic Information */}
        <div>
          <h3 className="text-sm font-medium text-[var(--foreground)] mb-3">Basic Information</h3>
          <div className="space-y-4">
            <Input
              label="Full Name"
              placeholder="e.g. John Smith"
              value={formData.fullName}
              onChange={handleInputChange('fullName')}
              error={errors.fullName}
              leftIcon={<FiUser className="w-4 h-4" />}
              autoComplete="off"
            />
            <Input
              label={
                formData.voiceEnabled || formData.smsEnabled
                  ? 'Phone Number'
                  : 'Phone Number (optional)'
              }
              placeholder="e.g. 12164281997"
              value={formData.phone}
              onChange={handleInputChange('phone')}
              error={errors.phone}
              leftIcon={<FiPhone className="w-4 h-4" />}
              autoComplete="off"
              hint={
                formData.voiceEnabled || formData.smsEnabled
                  ? 'Include country code, no + (e.g. US 12164281997 · UK 443300013011)'
                  : 'Not required for users without Voice or SMS — leave blank for WhatsApp-only users'
              }
            />
            <Input
              label="Email"
              type="email"
              placeholder="user@example.com"
              value={formData.email}
              onChange={handleInputChange('email')}
              error={errors.email}
              leftIcon={<FiMail className="w-4 h-4" />}
              autoComplete="off"
            />
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Password"
                type="password"
                placeholder="Min. 8 characters"
                value={formData.password}
                onChange={handleInputChange('password')}
                error={errors.password}
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
            </div>
          </div>
        </div>

        {/* Role & Permissions */}
        <div>
          <h3 className="text-sm font-medium text-[var(--foreground)] mb-3">Role & Permissions</h3>
          <div className="space-y-4">
            <Select
              label="Role"
              value={formData.role}
              onChange={handleRoleChange}
              options={[
                { value: 'user', label: 'User' },
                { value: 'manager', label: 'Manager' },
                ...(isSuperAdmin ? [{ value: 'admin', label: 'Administrator' }] : []),
              ]}
            />
            {/*
              Capability toggles — drive which sections of the form are
              required and which backend resources are provisioned.
              WhatsApp is enabled separately via the Edit User modal after
              an organization is assigned (see whatsapp.service.setUserWaEnabled).
            */}
            <div className="grid grid-cols-2 gap-4">
              {formData.role !== 'admin' ? (
                <Toggle
                  checked={formData.voiceEnabled}
                  onChange={handleToggleChange('voiceEnabled')}
                  label="Voice Calling"
                  description="SIP softphone, click-to-dial, voicemail"
                />
              ) : (
                <div className="flex items-start gap-3 p-3 rounded-lg bg-[var(--muted)]/30 border border-[var(--border)]">
                  <FiAlertCircle className="w-4 h-4 text-[var(--muted-foreground)] mt-0.5 flex-shrink-0" />
                  <div className="text-xs text-[var(--muted-foreground)]">
                    <span className="font-medium text-[var(--foreground)]">Administrators</span>{' '}
                    manage the account and don&apos;t get a SIP extension.
                  </div>
                </div>
              )}
              <Toggle
                checked={formData.smsEnabled}
                onChange={handleToggleChange('smsEnabled')}
                label="SMS"
                description="Send and receive text messages"
              />
              <Toggle
                checked={formData.autoDialerEnabled}
                onChange={handleToggleChange('autoDialerEnabled')}
                label="Auto-Dialer"
                description="Outbound calling campaigns"
              />
              <div className="flex items-start gap-3 p-3 rounded-lg bg-[var(--muted)]/30 border border-[var(--border)]">
                <FiAlertCircle className="w-4 h-4 text-[var(--muted-foreground)] mt-0.5 flex-shrink-0" />
                <div className="text-xs text-[var(--muted-foreground)]">
                  <span className="font-medium text-[var(--foreground)]">WhatsApp</span> is enabled
                  from the Edit User screen after assigning an organization.
                </div>
              </div>
            </div>
            {formData.smsEnabled && (
              <div>
                <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
                  SMS Provider
                </label>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.smsType === 'standard' || formData.smsType === 'both'}
                      onChange={(e) => {
                        setFormData((prev) => {
                          const hasAuto = prev.smsType === 'auto' || prev.smsType === 'both';
                          if (e.target.checked) {
                            return { ...prev, smsType: hasAuto ? 'both' : 'standard' };
                          } else {
                            return { ...prev, smsType: hasAuto ? 'auto' : null };
                          }
                        });
                      }}
                      className="rounded border-gray-300"
                    />
                    Standard SMS
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.smsType === 'auto' || formData.smsType === 'both'}
                      onChange={(e) => {
                        setFormData((prev) => {
                          const hasStandard =
                            prev.smsType === 'standard' || prev.smsType === 'both';
                          if (e.target.checked) {
                            return { ...prev, smsType: hasStandard ? 'both' : 'auto' };
                          } else {
                            return { ...prev, smsType: hasStandard ? 'standard' : null };
                          }
                        });
                      }}
                      className="rounded border-gray-300"
                    />
                    Auto SMS
                  </label>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* FusionPBX Extension Settings — only shown when Voice capability is on. */}
        {formData.voiceEnabled && (
          <div>
            <h3 className="text-sm font-medium text-[var(--foreground)] mb-3 flex items-center gap-2">
              <FiSettings className="w-4 h-4" />
              FusionPBX Extension Settings
            </h3>
            <p className="text-xs text-[var(--muted-foreground)] mb-4">
              Extension will be automatically created in FusionPBX with these settings
            </p>
            <div className="space-y-4">
              {/* Server Selection */}
              <Select
                label="FusionPBX Server"
                value={formData.serverPreference}
                onChange={handleInputChange('serverPreference')}
                options={[
                  { value: 'main', label: 'Main Server (Primary)' },
                  { value: 'backup', label: 'Backup Server (Secondary)' },
                ]}
              />

              {/* Extension Number */}
              <div className="space-y-1">
                <Input
                  label="Extension Number"
                  placeholder="e.g. 1001"
                  value={formData.extension}
                  onChange={handleExtensionChange}
                  error={errors.extension}
                  leftIcon={<FiHash className="w-4 h-4" />}
                  hint="3-6 digit SIP extension (must be unique)"
                />
                {isLoadingUsers && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                    <FiAlertCircle className="w-3 h-3" />
                    Loading existing extensions...
                  </p>
                )}
              </div>

              {/* SIP Password - Auto-generated or Custom */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="block text-sm font-medium text-[var(--foreground)]">
                    SIP Password
                  </label>
                  <Toggle
                    checked={formData.useCustomSipPassword}
                    onChange={(checked) =>
                      setFormData((prev) => ({ ...prev, useCustomSipPassword: checked }))
                    }
                    label="Custom password"
                  />
                </div>

                {formData.useCustomSipPassword ? (
                  <Input
                    type="password"
                    placeholder="Min. 8 characters with letter + digit"
                    value={formData.sipPassword}
                    onChange={handleInputChange('sipPassword')}
                    error={errors.sipPassword}
                    leftIcon={<FiLock className="w-4 h-4" />}
                    hint="Enter a custom SIP password"
                    autoComplete="new-password"
                  />
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--muted)]/30 font-mono text-sm">
                        {generatedSipPassword}
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setGeneratedSipPassword(generateSecurePassword(16))}
                        title="Generate new password"
                      >
                        <FiRefreshCw className="w-4 h-4" />
                      </Button>
                    </div>
                    <p className="text-xs text-[var(--muted-foreground)]">
                      Auto-generated secure password. Click refresh to generate a new one.
                    </p>
                  </div>
                )}
              </div>

              {/* Caller ID Settings - Auto-filled from Basic Info */}
              <div className="p-4 rounded-lg bg-[var(--muted)]/30 border border-[var(--border)]">
                <h4 className="text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wide mb-3">
                  Caller ID (Auto-filled from Basic Info)
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-[var(--foreground)] mb-1">
                      Caller ID Name
                    </label>
                    <div className="px-3 py-2 rounded-md bg-[var(--background)] border border-[var(--border)] text-sm text-[var(--muted-foreground)]">
                      {formData.fullName || '(Enter Full Name above)'}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[var(--foreground)] mb-1">
                      Caller ID Number
                    </label>
                    <div className="px-3 py-2 rounded-md bg-[var(--background)] border border-[var(--border)] text-sm text-[var(--muted-foreground)]">
                      {formData.phone ? normalizePhone(formData.phone) : '(Enter Phone above)'}
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 mt-3">
                  <div>
                    <label className="block text-sm font-medium text-[var(--foreground)] mb-1">
                      Outbound Caller ID Name
                    </label>
                    <div className="px-3 py-2 rounded-md bg-[var(--background)] border border-[var(--border)] text-sm text-[var(--muted-foreground)]">
                      {formData.fullName || '(Enter Full Name above)'}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[var(--foreground)] mb-1">
                      Outbound Caller ID Number
                    </label>
                    <div className="px-3 py-2 rounded-md bg-[var(--background)] border border-[var(--border)] text-sm text-[var(--muted-foreground)]">
                      {formData.phone ? normalizePhone(formData.phone) : '(Enter Phone above)'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Extension Settings - Editable */}
              <div className="p-4 rounded-lg bg-[var(--muted)]/30 border border-[var(--border)]">
                <h4 className="text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wide mb-3">
                  Extension Limits
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="Max Concurrent Calls"
                    type="number"
                    min={1}
                    max={20}
                    value={formData.limitMax.toString()}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, limitMax: parseInt(e.target.value) || 5 }))
                    }
                    leftIcon={<FiPhone className="w-4 h-4" />}
                    hint="Maximum simultaneous calls (1-20)"
                  />
                  <Input
                    label="Ring Timeout (seconds)"
                    type="number"
                    min={10}
                    max={120}
                    value={formData.callTimeout.toString()}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        callTimeout: parseInt(e.target.value) || 30,
                      }))
                    }
                    leftIcon={<FiClock className="w-4 h-4" />}
                    hint="Time before unanswered call times out"
                  />
                </div>
                <div className="grid grid-cols-3 gap-4 mt-3">
                  <div>
                    <label className="block text-sm font-medium text-[var(--foreground)] mb-1">
                      Voicemail
                    </label>
                    <div className="px-3 py-2 rounded-md bg-[var(--background)] border border-[var(--border)] text-sm text-green-600 dark:text-green-400">
                      Enabled
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[var(--foreground)] mb-1">
                      Directory Visible
                    </label>
                    <div className="px-3 py-2 rounded-md bg-[var(--background)] border border-[var(--border)] text-sm text-green-600 dark:text-green-400">
                      Yes
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[var(--foreground)] mb-1">
                      Extension Status
                    </label>
                    <div className="px-3 py-2 rounded-md bg-[var(--background)] border border-[var(--border)] text-sm text-green-600 dark:text-green-400">
                      Enabled
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </form>
    </Modal>
  );
}
