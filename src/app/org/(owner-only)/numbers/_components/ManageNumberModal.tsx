'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { FiUserPlus } from 'react-icons/fi';
import { Modal, Button, Input, StyledSelect, Toggle } from '@/components/ui';
import {
  useAssignNumber,
  useUpdateCallerIdName,
  useSetInboundCallerName,
  useNumberHistory,
} from '@/lib/hooks/useOrg';
import { toast } from '@/lib/stores/toast';
import { formatPhoneUS } from '@/lib/utils/phone';
import type { OrgNumber, OrgUser } from '@/lib/api/services/org.service';

// Inbound caller-name (CNAM) lookup is a paid per-number opt-in ($0.40/mo). The
// billing model (absorb vs. pass the cost through to the customer) isn't decided
// yet, so the toggle is HIDDEN for now. All the wiring (backend route + Telnyx
// call + this control) is kept intact — flip this to `true` to re-enable once
// billing is sorted. See the org-portal `setInboundCallerName` path.
const INBOUND_CNAM_UI_ENABLED = false;

interface Props {
  isOpen: boolean;
  onClose: () => void;
  number: OrgNumber;
  users: OrgUser[];
}

export default function ManageNumberModal({ isOpen, onClose, number, users }: Props) {
  // Local state (seeded from the prop) so the fields reflect the user's own
  // edits — the `number` prop is a snapshot from the list and doesn't update
  // live after a mutation, which would otherwise make the controls snap back.
  const [callerIdName, setCallerIdName] = useState(number.callerIdName ?? '');
  const [savedName, setSavedName] = useState(number.callerIdName ?? '');
  const [assignedUserId, setAssignedUserId] = useState<number | null>(number.assignedUserId);
  const [inboundCnam, setInboundCnam] = useState(number.inboundCnamEnabled);
  // User picked in the assign dropdown who's waiting on the "bring prior history?"
  // decision (only set when the number actually has retained history).
  const [historyPromptUser, setHistoryPromptUser] = useState<number | null>(null);
  const assignMutation = useAssignNumber();
  const cnamMutation = useUpdateCallerIdName();
  const inboundMutation = useSetInboundCallerName();
  // Prior-history summary for this number (drives the reassign prompt).
  const { data: history } = useNumberHistory(isOpen ? number.id : null);

  // The owner can hold a number too, so everyone is assignable. `hasMembers`
  // just drives the convenience "add a team member" hint.
  const hasMembers = users.some((u) => u.role !== 'owner');

  const handleSaveName = async () => {
    try {
      await cnamMutation.mutateAsync({ numberId: number.id, callerIdName: callerIdName.trim() });
      setSavedName(callerIdName.trim());
      toast.success('Caller ID name updated');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not update caller ID name');
    }
  };

  const doAssign = async (userId: number | null, importHistory?: boolean) => {
    const prev = assignedUserId;
    setAssignedUserId(userId); // optimistic
    try {
      await assignMutation.mutateAsync({ numberId: number.id, userId, importHistory });
      toast.success(userId ? 'Number assigned' : 'Number unassigned');
    } catch (err) {
      setAssignedUserId(prev); // revert on failure
      toast.error(err instanceof Error ? err.message : 'Could not assign number');
    }
  };

  // Assigning a number that carries a previous owner's history is the classic
  // number-recycling privacy risk, so the owner must decide first. Unassigning,
  // or assigning a number with no history, goes straight through.
  const requestAssign = (userId: number | null) => {
    if (userId !== null && history?.hasHistory) {
      setHistoryPromptUser(userId);
      return;
    }
    void doAssign(userId);
  };

  const resolveHistoryPrompt = (importHistory: boolean) => {
    const userId = historyPromptUser;
    setHistoryPromptUser(null);
    if (userId !== null) void doAssign(userId, importHistory);
  };

  const handleToggleInbound = async (enabled: boolean) => {
    setInboundCnam(enabled); // optimistic
    try {
      await inboundMutation.mutateAsync({ numberId: number.id, enabled });
      toast.success(enabled ? 'Incoming caller names turned on' : 'Incoming caller names turned off');
    } catch (err) {
      setInboundCnam(!enabled); // revert on failure
      toast.error(err instanceof Error ? err.message : 'Could not update inbound caller name');
    }
  };

  const nameChanged = callerIdName.trim() !== savedName;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={formatPhoneUS(number.phoneNumber)} size="md">
      <div className="space-y-6">
        <div className="flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
          <span className="rounded-full bg-[var(--muted)] px-2 py-0.5 capitalize">
            {number.numberType.replace(/_/g, ' ')}
          </span>
          <span className="rounded-full bg-[var(--muted)] px-2 py-0.5">{number.countryCode}</span>
          <span
            className={`rounded-full px-2 py-0.5 ${
              number.isActive
                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                : 'bg-[var(--muted)]'
            }`}
          >
            {number.isActive ? 'Active' : 'Inactive'}
          </span>
        </div>

        {/* Caller ID name (CNAM) */}
        <div className="space-y-2">
          <Input
            label="Caller ID name"
            hint="The name shown to people you call (CNAM). Up to 15 characters. Carrier updates can take time to appear."
            maxLength={15}
            value={callerIdName}
            onChange={(e) => setCallerIdName(e.target.value)}
            placeholder="e.g. Acme Support"
          />
          <div className="flex justify-end">
            <Button
              size="sm"
              onClick={handleSaveName}
              loading={cnamMutation.isPending}
              disabled={!nameChanged || cnamMutation.isPending}
            >
              Save name
            </Button>
          </div>
        </div>

        {/* Inbound caller name (CNAM lookup) — shows WHO is calling in. Opt-in,
            $0.40/mo per number. HIDDEN until the billing model is decided
            (INBOUND_CNAM_UI_ENABLED); the code below stays wired. */}
        {INBOUND_CNAM_UI_ENABLED && (
          <div className="rounded-lg border border-[var(--border)] p-3">
            <Toggle
              checked={inboundCnam}
              onChange={handleToggleInbound}
              disabled={inboundMutation.isPending}
              label="Show incoming caller names"
              description="Look up the name of people calling this number and show it on incoming calls (CNAM). $0.40/mo per number; carrier data isn't available for every caller."
            />
          </div>
        )}

        {/* Assignment — owner + members are all valid holders. When the picked
            user would inherit a previous owner's history, the select is replaced
            by an inline decision panel (no modal-on-modal). */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-[var(--foreground)]">Assigned to</label>

          {historyPromptUser !== null ? (
            <div className="space-y-3 rounded-lg border border-amber-300 bg-amber-50 p-3 dark:border-amber-800/60 dark:bg-amber-950/30">
              <p className="text-xs leading-relaxed text-[var(--foreground)]">
                Assigning to{' '}
                <b>{users.find((u) => u.id === historyPromptUser)?.fullName ?? 'this user'}</b>. This
                number has <b>{history?.sms ?? 0} messages</b> and <b>{history?.calls ?? 0} calls</b>{' '}
                from a previous owner
                {history?.pendingRetirement ? ' (scheduled for deletion)' : ''}. What should they
                see?
              </p>
              <div className="grid gap-2">
                <button
                  type="button"
                  onClick={() => resolveHistoryPrompt(false)}
                  disabled={assignMutation.isPending}
                  className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-2.5 text-left transition-colors hover:border-[var(--primary-600)] hover:bg-[var(--primary-600)]/5 disabled:opacity-60"
                >
                  <span className="block text-sm font-semibold text-[var(--foreground)]">
                    Start clean{' '}
                    <span className="font-normal text-[var(--primary-600)]">(recommended)</span>
                  </span>
                  <span className="mt-0.5 block text-[11px] leading-relaxed text-[var(--muted-foreground)]">
                    Hide the previous owner&apos;s messages &amp; calls, and permanently delete this
                    number&apos;s prior data (30-day grace).
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => resolveHistoryPrompt(true)}
                  disabled={assignMutation.isPending}
                  className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-2.5 text-left transition-colors hover:border-[var(--foreground)]/40 hover:bg-[var(--muted)]/40 disabled:opacity-60"
                >
                  <span className="block text-sm font-semibold text-[var(--foreground)]">
                    Bring the history over
                  </span>
                  <span className="mt-0.5 block text-[11px] leading-relaxed text-[var(--muted-foreground)]">
                    They&apos;ll see all prior messages &amp; calls for this number. Only if
                    they&apos;re taking over the same desk.
                  </span>
                </button>
              </div>
              <button
                type="button"
                onClick={() => setHistoryPromptUser(null)}
                className="text-xs font-medium text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              >
                Cancel
              </button>
            </div>
          ) : (
            <>
              <StyledSelect
                value={assignedUserId ? String(assignedUserId) : ''}
                onChange={(v) => requestAssign(v ? Number(v) : null)}
                disabled={assignMutation.isPending}
              >
                <option value="">Unassigned</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.fullName}
                    {u.role === 'owner' ? ' (owner)' : ''}
                  </option>
                ))}
              </StyledSelect>
              <p className="text-xs text-[var(--muted-foreground)]">
                Assign this number to yourself or a team member so their calls and texts use it.
              </p>
              {!hasMembers && (
                <Link
                  href="/org/users"
                  onClick={onClose}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--primary-600)] hover:underline"
                >
                  <FiUserPlus className="w-3.5 h-3.5" /> Add a team member
                </Link>
              )}
            </>
          )}
        </div>

        <div className="flex justify-end pt-2">
          <Button variant="outline" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    </Modal>
  );
}
