import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiX,
  FiShield,
} from 'react-icons/fi';
import {
  TeamMember,
  UserRole,
  UserStatus,
  AvailableNumber,
  CommunicationCapabilities,
} from './types';
import { RoleBadge } from './RoleBadge';
import { StatusBadge } from './StatusBadge';
import { RoleChangeDialog } from './RoleChangeDialog';
import { Button, StyledSelect } from '@/components/ui';

interface MemberDetailDrawerProps {
  member: TeamMember | null;
  isOpen: boolean;
  onClose: () => void;
  availableNumbers: AvailableNumber[];
  onSaveMember: (updated: TeamMember) => Promise<boolean>;
  onOpenResetPassword: (member: TeamMember) => void;
}

export function MemberDetailDrawer({
  member,
  isOpen,
  onClose,
  availableNumbers,
  onSaveMember,
  onOpenResetPassword,
}: MemberDetailDrawerProps) {
  // Local edit states
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<UserRole>('user');
  const [status, setStatus] = useState<UserStatus>('active');
  const [senderPhone, setSenderPhone] = useState<string | null>(null);
  // Saving now also (re)assigns the phone number, which provisions on FusionPBX and
  // can take a few seconds. Track in-flight state so the button disables + shows a
  // spinner and can't be double-clicked into duplicate assigns.
  const [saving, setSaving] = useState(false);

  // Communication capabilities
  const [communication, setCommunication] = useState<CommunicationCapabilities>({
    calling: true,
    sms: true,
    recordings: true,
    autodialer: false,
  });

  // Confirmation dialog for Manager -> Agent downgrade
  const [showRoleChangeConfirm, setShowRoleChangeConfirm] = useState(false);

  // Sync state whenever active member changes
  useEffect(() => {
    if (member) {
      setFullName(member.fullName);
      setEmail(member.email);
      setRole(member.role);
      setStatus(member.status);
      setSenderPhone(member.senderPhone);
      setCommunication({ ...member.communication });
    }
  }, [member]);

  if (!member) return null;

  const isOwner = member.role === 'owner';

  const handleRoleSelectChange = (newRole: UserRole) => {
    if (newRole === role) return;

    if (role === 'manager' && newRole === 'user') {
      // Downgrading Manager -> Agent requires confirmation
      setShowRoleChangeConfirm(true);
      return;
    }

    if (newRole === 'manager') {
      setRole('manager');
    } else {
      setRole(newRole);
    }
  };

  const handleConfirmDowngrade = () => {
    setRole('user');
    setShowRoleChangeConfirm(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isOwner) {
      onClose();
      return;
    }

    if (saving) return; // re-entry guard: ignore repeat clicks while a save is in flight

    const updated: TeamMember = {
      ...member,
      fullName: fullName.trim() || member.fullName,
      email: email.trim().toLowerCase() || member.email,
      role,
      status,
      senderPhone: senderPhone || null,
      communication,
    };

    setSaving(true);
    try {
      if (await onSaveMember(updated)) onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Drawer Body */}
          <motion.div
            className="fixed right-0 top-0 z-50 flex h-full w-full max-w-xl flex-col bg-[var(--card)] shadow-2xl border-l border-[var(--border)]"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 400, damping: 38 }}
          >
            {/* Header */}
            <div className="flex shrink-0 items-center justify-between border-b border-[var(--border)] px-6 py-4">
              <div className="min-w-0 pr-3">
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-[var(--foreground)] truncate">
                    {member.fullName}
                  </h2>
                  <RoleBadge role={member.role} />
                  <StatusBadge status={member.status} />
                </div>
                <p className="text-xs text-[var(--muted-foreground)] mt-0.5 truncate">{member.email}</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg p-2 text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)] transition-colors shrink-0"
                aria-label="Close drawer"
              >
                <FiX className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Body */}
            <form onSubmit={handleSave} className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              {/* Owner Protected Helper Notice */}
              {isOwner && (
                <div className="rounded-xl border border-purple-200/80 dark:border-purple-800/40 bg-purple-50/50 dark:bg-purple-950/20 px-3.5 py-2.5 flex items-start gap-2 text-xs text-purple-900 dark:text-purple-200">
                  <FiShield className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400 mt-0.5 shrink-0" />
                  <div className="leading-snug">
                    <strong className="font-semibold">Organization Owner</strong> — Ownership credentials and profile are managed in Profile Settings.
                  </div>
                </div>
              )}

              {/* SECTION: PROFILE */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--foreground)] border-b border-[var(--border)] pb-1.5">
                  Profile
                </h3>

                {isOwner ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 py-1">
                    <div className="p-2.5 rounded-xl bg-[var(--muted)]/30 border border-[var(--border)]">
                      <span className="text-[11px] font-medium text-[var(--muted-foreground)] block">Full name</span>
                      <span className="font-semibold text-xs text-[var(--foreground)] mt-0.5 block">{fullName}</span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-[var(--muted)]/30 border border-[var(--border)]">
                      <span className="text-[11px] font-medium text-[var(--muted-foreground)] block">Email address</span>
                      <span className="font-semibold text-xs text-[var(--foreground)] mt-0.5 block">{email}</span>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-[var(--foreground)] mb-1">
                        Full Name
                      </label>
                      <input
                        type="text"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        className="w-full px-3 py-2 text-sm bg-[var(--background)] border border-[var(--border)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-[var(--foreground)] mb-1">
                        Email Address
                      </label>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full px-3 py-2 text-sm bg-[var(--background)] border border-[var(--border)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                      />
                    </div>

                    {/* Role & Status (Editable for non-owner) */}
                    <div className="grid grid-cols-2 gap-3 pt-1">
                      <div>
                        <label className="block text-xs font-semibold text-[var(--foreground)] mb-1">
                          Role
                        </label>
                        <StyledSelect
                          value={role}
                          onChange={(val) => handleRoleSelectChange(val as UserRole)}
                          aria-label="Change user role"
                        >
                          <option value="user">Agent</option>
                          <option value="manager">Manager</option>
                        </StyledSelect>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-[var(--foreground)] mb-1">
                          Status
                        </label>
                        {member?.status === 'banned' ? (
                          <div className="py-2 px-3 text-xs font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 rounded-xl border border-red-200 dark:border-red-900/50">
                            Banned (Platform controlled)
                          </div>
                        ) : (
                          <StyledSelect
                            value={status}
                            onChange={(val) => setStatus(val as UserStatus)}
                            aria-label="Change user status"
                          >
                            <option value="active">Active</option>
                            <option value="inactive">Deactivated</option>
                          </StyledSelect>
                        )}
                      </div>
                    </div>

                    {/* Password reset button */}
                    <div className="pt-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => onOpenResetPassword(member)}
                      >
                        Reset Password
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {/* SECTION: COMMUNICATION */}
              <div className="space-y-3 pt-1">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--foreground)] border-b border-[var(--border)] pb-1.5">
                  Communication
                </h3>

                {/* Assigned Phone Number */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-[var(--foreground)]">
                    Assigned Phone Number
                  </label>
                  {!isOwner ? (
                    <StyledSelect
                      id="assignedPhoneNumber"
                      value={senderPhone ?? ''}
                      onChange={(value) => setSenderPhone(value || null)}
                      className="font-mono"
                      aria-label="Assigned Phone Number"
                    >
                      <option value="">No number assigned</option>
                      {senderPhone && (
                        <option value={senderPhone}>{senderPhone} (Currently Assigned)</option>
                      )}
                      {availableNumbers.map((num) => (
                        <option key={num.id} value={num.number}>
                          {num.number} (Available)
                        </option>
                      ))}
                    </StyledSelect>
                  ) : (
                    <div className="p-2.5 bg-[var(--muted)]/50 rounded-xl font-mono text-sm text-[var(--foreground)]">
                      {senderPhone || 'No number assigned'}
                    </div>
                  )}
                </div>

              </div>

              {/* SECTION: TECHNICAL DETAILS */}
              <div className="space-y-2 pt-1">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--muted-foreground)] border-b border-[var(--border)] pb-1.5">
                  Technical Details
                </h3>
                <div className="rounded-xl border border-[var(--border)] bg-[var(--muted)]/20 px-3.5 py-2.5 flex items-center justify-between text-xs">
                  <span className="text-[var(--muted-foreground)] font-medium">Internal extension</span>
                  <span className="font-mono font-semibold text-[var(--foreground)]">
                    {member.sipUsername || 'None'}
                  </span>
                </div>
              </div>

              {/* Footer action buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[var(--border)]">
                <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={saving}>
                  {isOwner ? 'Close' : 'Cancel'}
                </Button>
                {!isOwner && (
                  <Button type="submit" variant="primary" size="sm" loading={saving} disabled={saving}>
                    {saving ? 'Saving…' : 'Save Changes'}
                  </Button>
                )}
              </div>
            </form>
          </motion.div>

          {/* Role change confirmation modal */}
          <RoleChangeDialog
            isOpen={showRoleChangeConfirm}
            onClose={() => setShowRoleChangeConfirm(false)}
            onConfirm={handleConfirmDowngrade}
            memberName={member.fullName}
          />
        </>
      )}
    </AnimatePresence>
  );
}
