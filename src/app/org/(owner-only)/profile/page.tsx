'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { FiLogOut } from 'react-icons/fi';
import { Button, Input, Modal, ThemeSelector } from '@/components/ui';
import { useAuthStore } from '@/lib/stores/auth';
import { orgApiService } from '@/lib/api/services/org.service';
import { authApiService } from '@/lib/api/services/auth.service';
import { toast } from '@/lib/stores/toast';

function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join('') || '?'
  );
}

export default function OrgProfilePage() {
  const router = useRouter();
  const { user, logout } = useAuthStore();

  // Patch the persisted auth user in-place (updates the top bar) WITHOUT calling
  // checkAuth() — checkAuth flips global isLoading, which makes the org layout
  // swap in its full-screen spinner and looks like a full page refresh.
  const patchUser = (partial: Record<string, unknown>) => {
    const cur = useAuthStore.getState().user;
    if (cur) useAuthStore.setState({ user: { ...cur, ...partial } });
  };

  const fullName = user?.fullName ?? '';
  const [firstName, setFirstName] = useState(fullName.split(' ')[0] ?? '');
  const [lastName, setLastName] = useState(fullName.split(' ').slice(1).join(' ') ?? '');
  const [savingName, setSavingName] = useState(false);

  // Company name — this is the org display name shown in the app's top bar.
  const [companyName, setCompanyName] = useState(user?.organizationName ?? '');
  const [savingCompany, setSavingCompany] = useState(false);

  const [pwOpen, setPwOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwError, setPwError] = useState('');
  const [savingPw, setSavingPw] = useState(false);

  const composed = `${firstName.trim()} ${lastName.trim()}`.trim();
  const nameChanged = composed !== fullName.trim() && firstName.trim().length > 0;
  const companyChanged =
    companyName.trim().length > 0 && companyName.trim() !== (user?.organizationName ?? '').trim();

  const handleSaveName = async () => {
    setSavingName(true);
    try {
      await orgApiService.updateProfile(composed);
      patchUser({ fullName: composed });
      toast.success('Profile updated');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not update your profile');
    } finally {
      setSavingName(false);
    }
  };

  const handleSaveCompany = async () => {
    setSavingCompany(true);
    try {
      await orgApiService.updateSettings({ name: companyName.trim() });
      patchUser({ organizationName: companyName.trim() }); // updates the top bar, no full-page reload
      toast.success('Company name updated');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not update the company name');
    } finally {
      setSavingCompany(false);
    }
  };

  const resetPwForm = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setPwError('');
  };

  const handleChangePassword = async () => {
    setPwError('');
    if (newPassword.length < 8) {
      setPwError('New password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwError('New passwords do not match.');
      return;
    }
    setSavingPw(true);
    try {
      await authApiService.changePassword(currentPassword, newPassword);
      toast.success('Password changed');
      setPwOpen(false);
      resetPwForm();
    } catch (err) {
      setPwError(err instanceof Error ? err.message : 'Could not change your password');
    } finally {
      setSavingPw(false);
    }
  };

  const handleLogout = () => {
    logout();
    router.replace('/login');
  };

  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-[var(--foreground)]">Account</h1>
        <p className="text-[var(--muted-foreground)] mt-1">Manage your profile</p>
      </div>

      {/* Avatar */}
      <div className="flex items-center gap-4">
        <span className="grid h-16 w-16 place-items-center rounded-full bg-[var(--primary-600)] text-xl font-semibold text-white">
          {initials(fullName || user?.email || '?')}
        </span>
      </div>

      {/* Company name */}
      <div className="space-y-2">
        <Input
          label="Company name"
          hint="Shown to your team in the top bar of the app."
          value={companyName}
          onChange={(e) => setCompanyName(e.target.value)}
          placeholder="e.g. Acme Logistics"
        />
        <div>
          <Button
            onClick={handleSaveCompany}
            loading={savingCompany}
            disabled={!companyChanged || savingCompany}
          >
            Save company name
          </Button>
        </div>
      </div>

      <hr className="border-[var(--border)]" />

      {/* Name */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input label="First name" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
        <Input label="Last name" value={lastName} onChange={(e) => setLastName(e.target.value)} />
      </div>
      <div className="-mt-4">
        <Button onClick={handleSaveName} loading={savingName} disabled={!nameChanged || savingName}>
          Save changes
        </Button>
      </div>

      <hr className="border-[var(--border)]" />

      {/* Email (read-only) */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-[var(--foreground)]">Email</p>
          <p className="text-sm text-[var(--muted-foreground)]">Used to log in to your account</p>
        </div>
        <p className="text-sm font-medium text-[var(--foreground)]">{user?.email}</p>
      </div>

      <hr className="border-[var(--border)]" />

      {/* Password */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-[var(--foreground)]">Password</p>
          <p className="text-sm text-[var(--muted-foreground)]">
            Change the password you use to sign in
          </p>
        </div>
        <Button variant="outline" onClick={() => setPwOpen(true)}>
          Change password
        </Button>
      </div>

      <hr className="border-[var(--border)]" />

      {/* Appearance (theme — SSOT) */}
      <div className="space-y-3">
        <div>
          <p className="text-sm font-medium text-[var(--foreground)]">Appearance</p>
          <p className="text-sm text-[var(--muted-foreground)]">
            Choose a light or dark theme, or follow your system setting.
          </p>
        </div>
        <ThemeSelector />
      </div>

      <hr className="border-[var(--border)]" />

      {/* Log out */}
      <div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
        >
          <FiLogOut className="w-4 h-4" />
          Log out
        </button>
      </div>

      <Modal
        isOpen={pwOpen}
        onClose={() => {
          if (savingPw) return;
          setPwOpen(false);
          resetPwForm();
        }}
        title="Change password"
        size="sm"
      >
        <div className="space-y-4">
          {pwError && (
            <div className="rounded-lg border border-[var(--danger)]/30 bg-[var(--danger)]/10 p-3 text-sm text-[var(--danger)]">
              {pwError}
            </div>
          )}
          <Input
            label="Current password"
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            autoComplete="current-password"
          />
          <Input
            label="New password"
            type="password"
            hint="At least 8 characters."
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            autoComplete="new-password"
          />
          <Input
            label="Confirm new password"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            autoComplete="new-password"
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => {
                setPwOpen(false);
                resetPwForm();
              }}
              disabled={savingPw}
            >
              Cancel
            </Button>
            <Button
              onClick={handleChangePassword}
              loading={savingPw}
              disabled={savingPw || !currentPassword || !newPassword || !confirmPassword}
            >
              Change password
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
