import React, { useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiX,
  FiUser,
  FiUserCheck,
  FiEye,
  FiEyeOff,
  FiCheck,
  FiExternalLink,
  FiAlertCircle,
  FiPlusCircle,
} from 'react-icons/fi';
import {
  UserRole,
  OrganizationConfig,
  AvailableNumber,
  CommunicationCapabilities,
  CreateTeamMemberInput,
} from './types';
import { RecycledNumberHistoryChoice } from './RecycledNumberHistoryChoice';
import { Button, StyledSelect } from '@/components/ui';
import { useNumberHistory, useOrgBilling, usePurchaseSeats } from '@/lib/hooks/useOrg';
import { toast } from '@/lib/stores/toast';

interface AddTeamMemberDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  organization: OrganizationConfig;
  availableNumbers: AvailableNumber[];
  currentMemberCount: number;
  onAddMember: (member: CreateTeamMemberInput, usedNumberId?: number) => Promise<boolean>;
}

export function AddTeamMemberDrawer({
  isOpen,
  onClose,
  organization,
  availableNumbers,
  currentMemberCount,
  onAddMember,
}: AddTeamMemberDrawerProps) {
  // Billing and seat expansion
  const { data: billing } = useOrgBilling();
  const purchaseSeatsMutation = usePurchaseSeats();
  const [purchasingSeat, setPurchasingSeat] = useState(false);

  const seatRateFormatted = `$${(((billing?.agreedSeatPriceCents ?? 8000)) / 100).toFixed(2)}`;

  const handleQuickAddSeat = async () => {
    setPurchasingSeat(true);
    try {
      const res = await purchaseSeatsMutation.mutateAsync({ seats: 1 });
      toast.success(
        `Added 1 Seat License! New capacity: ${res.data?.newTotalSeats ?? organization.maxUsers + 1} seats. (Includes 1 phone line & 100 SMS)`
      );
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to purchase seat license');
    } finally {
      setPurchasingSeat(false);
    }
  };

  // Form State
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState<UserRole>('user');
  // Provisioning a member (FusionPBX extension + keycard + routing) can take a few
  // seconds. Track in-flight state so the submit button disables and can't be
  // double-clicked into creating duplicate members/extensions.
  const [submitting, setSubmitting] = useState(false);

  // Phone assignment state
  const [selectedNumber, setSelectedNumber] = useState<string>(
    availableNumbers[0]?.number ?? ''
  );
  const [importHistory, setImportHistory] = useState(false);

  const selectedNumberObj = availableNumbers.find((n) => n.number === selectedNumber);
  const { data: selectedNumberHistory } = useNumberHistory(
    isOpen && selectedNumberObj ? selectedNumberObj.id : null
  );
  const hasSelectedNumberHistory =
    selectedNumberHistory?.hasHistory ?? selectedNumberObj?.hasHistory ?? false;

  const isFormValid =
    fullName.trim().length > 0 &&
    email.trim().length > 0 &&
    email.includes('@') &&
    password.length >= 8;

  const resetForm = () => {
    setFullName('');
    setEmail('');
    setPassword('');
    setRole('user');
    setSelectedNumber(availableNumbers[0]?.number ?? '');
    setImportHistory(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Re-entry guard: ignore repeat clicks/Enter while a create is already in flight.
    if (!isFormValid || submitting) return;

    const communication: CommunicationCapabilities = {
      calling: false,
      sms: false,
      recordings: false,
      autodialer: false,
    };

    const newMember: CreateTeamMemberInput = {
      fullName: fullName.trim(),
      email: email.trim().toLowerCase(),
      password: password,
      importHistory: importHistory,
      role,
      status: 'active',
      senderPhone: selectedNumber || null,
      sipUsername: `${Math.floor(20000 + Math.random() * 9000)}`,
      communication,
      createdAt: new Date().toISOString(),
    };

    setSubmitting(true);
    try {
      if (await onAddMember(newMember, selectedNumberObj?.id)) {
        resetForm();
        onClose();
      }
    } finally {
      setSubmitting(false);
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
              <div>
                <h2 className="text-lg font-bold text-[var(--foreground)]">Add Team Member</h2>
                <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
                  Set up user profile, phone access, and permissions
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg p-2 text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
                aria-label="Close drawer"
              >
                <FiX className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Form Content */}
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              {/* SEAT QUOTA LIMIT BANNER */}
              {currentMemberCount >= organization.maxUsers && (
                <div className="rounded-xl border border-amber-300 dark:border-amber-800/60 bg-amber-50 dark:bg-amber-950/30 p-4 text-xs text-amber-900 dark:text-amber-100 space-y-3">
                  <div className="space-y-1">
                    <div className="font-semibold flex items-center gap-1.5 text-amber-800 dark:text-amber-200">
                      <FiAlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                      <span>Seat Limit Reached ({currentMemberCount} / {organization.maxUsers} seats)</span>
                    </div>
                    <p className="text-[11px] text-amber-700/90 dark:text-amber-300/90 leading-relaxed">
                      All seats allocated to your organization are currently assigned. Add a dialer seat license to instantly unlock an additional team member, 1 direct phone number, and 100 SMS.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2.5 pt-0.5">
                    <Button
                      type="button"
                      variant="primary"
                      size="sm"
                      onClick={handleQuickAddSeat}
                      loading={purchasingSeat}
                      className="shadow-sm font-semibold text-xs h-8"
                    >
                      <FiPlusCircle className="w-3.5 h-3.5 mr-1.5" />
                      Add 1 Seat License ({seatRateFormatted}/mo)
                    </Button>
                    <Link
                      href="/org/billing"
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-800 dark:text-amber-200 underline hover:no-underline ml-1"
                    >
                      <span>Manage in Plan &amp; Billing</span>
                      <FiExternalLink className="w-3 h-3" />
                    </Link>
                  </div>
                </div>
              )}

              {/* SECTION: ACCOUNT */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--foreground)] border-b border-[var(--border)] pb-1.5">
                  Account
                </h3>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-[var(--foreground)] mb-1">
                      Full Name *
                    </label>
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="e.g. Sarah Miller"
                      required
                      className="w-full px-3 py-2 text-sm bg-[var(--background)] border border-[var(--border)] rounded-xl placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[var(--foreground)] mb-1">
                      Email Address *
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="e.g. sarah@designhub.com"
                      required
                      className="w-full px-3 py-2 text-sm bg-[var(--background)] border border-[var(--border)] rounded-xl placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[var(--foreground)] mb-1">
                      Temporary Password *
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="At least 8 characters"
                        required
                        minLength={8}
                        className="w-full pl-3 pr-10 py-2 text-sm bg-[var(--background)] border border-[var(--border)] rounded-xl placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                      >
                        {showPassword ? <FiEyeOff className="w-4 h-4" /> : <FiEye className="w-4 h-4" />}
                      </button>
                    </div>
                    {password && password.length < 8 && (
                      <p className="text-[11px] text-amber-600 mt-1">
                        Password must be at least 8 characters ({password.length}/8).
                      </p>
                    )}
                  </div>
                </div>

                {/* Role selection visual cards */}
                <div className="space-y-2 pt-1">
                  <label className="block text-xs font-semibold text-[var(--foreground)]">
                    Role in Organization *
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Agent card */}
                    <button
                      type="button"
                      onClick={() => setRole('user')}
                      className={`flex flex-col text-left p-3.5 rounded-xl border transition-all ${role === 'user'
                          ? 'border-[var(--primary)] bg-[var(--primary)]/5 shadow-sm ring-1 ring-[var(--primary)]'
                          : 'border-[var(--border)] bg-[var(--card)] hover:border-[var(--foreground)]/30'
                        }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <FiUser className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                          <span className="text-sm font-bold text-[var(--foreground)]">Agent</span>
                        </div>
                        {role === 'user' && <FiCheck className="w-4 h-4 text-[var(--primary)]" />}
                      </div>
                      <p className="text-[11px] text-[var(--muted-foreground)] mt-1.5 leading-relaxed">
                        Uses ArixCall for day-to-day calling, SMS, and personal communications.
                      </p>
                    </button>

                    {/* Manager card */}
                    <button
                      type="button"
                      onClick={() => setRole('manager')}
                      className={`flex flex-col text-left p-3.5 rounded-xl border transition-all ${role === 'manager'
                          ? 'border-blue-500 bg-blue-50/30 dark:bg-blue-950/20 shadow-sm ring-1 ring-blue-500'
                          : 'border-[var(--border)] bg-[var(--card)] hover:border-[var(--foreground)]/30'
                        }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <FiUserCheck className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                          <span className="text-sm font-bold text-[var(--foreground)]">Manager</span>
                        </div>
                        {role === 'manager' && <FiCheck className="w-4 h-4 text-blue-600" />}
                      </div>
                      <p className="text-[11px] text-[var(--muted-foreground)] mt-1.5 leading-relaxed">
                        Uses ArixCall and can receive selected delegated management and QA access.
                      </p>
                    </button>
                  </div>
                </div>
              </div>

              {/* SECTION: PHONE & COMMUNICATION */}
              <div className="space-y-3 pt-1">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--foreground)] border-b border-[var(--border)] pb-1.5">
                  Phone &amp; Communication
                </h3>

                {/* Number Assignment */}
                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-[var(--foreground)]">
                    Assigned Phone Number
                  </label>

                  {availableNumbers.length > 0 ? (
                    <>
                      <StyledSelect
                        id="newMemberPhoneNumber"
                        value={selectedNumber}
                        onChange={(value) => {
                          setSelectedNumber(value);
                          setImportHistory(false);
                        }}
                        className="font-mono"
                        aria-label="Assigned Phone Number"
                      >
                        <option value="">Do not assign a number yet</option>
                        {availableNumbers.map((num) => (
                          <option key={num.id} value={num.number}>
                            {num.number} — Available {num.hasHistory ? '(has prior history)' : ''}
                          </option>
                        ))}
                      </StyledSelect>
                      <p className="text-[11px] text-[var(--muted-foreground)]">
                        Used as this member&apos;s caller ID and assigned phone number.
                      </p>

                      {/* Recycled number choice if selected has history */}
                      {hasSelectedNumberHistory && selectedNumber && (
                        <div className="pt-1">
                          <RecycledNumberHistoryChoice
                            value={importHistory}
                            onChange={(val) => setImportHistory(val)}
                          />
                        </div>
                      )}
                    </>
                  ) : (
                    /* Empty numbers state */
                    <div className="rounded-xl border border-amber-300 dark:border-amber-800/40 bg-amber-50/50 dark:bg-amber-950/20 p-4 space-y-2">
                      <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200 font-semibold text-xs">
                        <FiAlertCircle className="w-4 h-4 text-amber-600" />
                        No available phone numbers
                      </div>
                      <p className="text-xs text-[var(--muted-foreground)] leading-relaxed">
                        All purchased organization numbers are currently assigned to other team members.
                      </p>
                      <Link
                        href="/org/numbers"
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--primary)] hover:underline pt-1"
                        onClick={onClose}
                      >
                        <span>Go to Numbers to purchase more</span>
                        <FiExternalLink className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  )}
                </div>

              </div>

              {/* SECTION: SUMMARY & CREATE */}
              <div className="pt-2">
                <div className="rounded-xl border border-[var(--border)] bg-[var(--muted)]/40 p-3.5 space-y-2 text-xs">
                  <div className="font-semibold text-[var(--foreground)] flex items-center justify-between">
                    <span>{fullName.trim() || 'New Member'}</span>
                    <span className="capitalize font-bold text-[var(--primary)]">
                      {role === 'manager' ? 'Manager' : 'Agent'}
                    </span>
                  </div>
                  <div className="text-[var(--muted-foreground)]">
                    {email || 'No email entered'} {selectedNumber ? `• ${selectedNumber}` : ''}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[var(--border)]">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={onClose}
                  disabled={submitting}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  loading={submitting}
                  disabled={!isFormValid || submitting || currentMemberCount >= organization.maxUsers}
                >
                  {currentMemberCount >= organization.maxUsers
                    ? 'Seat Limit Reached'
                    : submitting
                      ? 'Creating…'
                      : 'Create Team Member'}
                </Button>
              </div>
            </form>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
