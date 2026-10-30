'use client';

/**
 * First-run caller-ID name (CNAM) setup.
 *
 * CNAM — the business name people see when this line calls them — used to be
 * buried in Org → Numbers → Manage. This surfaces it up front: shown to the number
 * OWNER if their active number has no caller-ID name yet, so they set it BEFORE the
 * first call. Members (who can't change CNAM) never see it.
 *
 * Persistence is SESSION-scoped, not permanent: the prompt is what drives CNAM
 * adoption (a top caller-ID-reputation lever), so anyone who still hasn't set a
 * CNAM keeps getting re-prompted on their next session — including long-standing
 * users who dismissed an earlier one-time version. "Maybe later" only quiets it
 * for the current session; setting the name stops it for good (hasName gate).
 *
 * @module components/phone/CallerIdNameSetupModal
 */

import { useEffect, useState } from 'react';
import { Modal, Button, Input } from '@/components/ui';
import { useAuthStore } from '@/lib/stores';
import { usePermissions } from '@/lib/hooks/usePermissions';
import { useOrgNumbers, useUpdateCallerIdName } from '@/lib/hooks/useOrg';

// Session-scoped so users without a CNAM are re-prompted next session (not
// permanently suppressed). Deliberately NOT the old localStorage key, so a stuck
// legacy 'arixcall:cnam-setup-seen' flag can no longer hide the prompt forever.
const SEEN_KEY = 'arixcall:cnam-setup-dismissed-session';
const digits = (s?: string | null) => (s || '').replace(/\D/g, '');

export function CallerIdNameSetupModal() {
  // CNAM is an OWNER-only capability on the backend (both /org/numbers and the
  // caller-id-name update are `requireOwner`). Gate to owner so members/managers
  // never fetch /org/numbers (they'd 403) or see a prompt they can't act on.
  const { isOwner } = usePermissions();
  if (!isOwner) return null;
  return <CnamSetupInner />;
}

function CnamSetupInner() {
  const user = useAuthStore((s) => s.user);
  const { data: numbers } = useOrgNumbers();
  const updateCnam = useUpdateCallerIdName();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');

  // The line the dialer sends from (active caller ID), else the first owned number.
  const active =
    (numbers ?? []).find((n) => digits(n.phoneNumber) === digits(user?.senderPhone)) ??
    (numbers ?? [])[0];

  useEffect(() => {
    if (!active) return;
    let seen = false;
    try {
      seen = !!sessionStorage.getItem(SEEN_KEY);
    } catch {
      /* private mode / blocked storage — treat as not-seen */
    }
    const hasName = !!(active.callerIdName && active.callerIdName.trim());
    if (!seen && !hasName) {
      const suggestion = (user?.organizationName || user?.fullName || '').trim().slice(0, 15);
      setName(suggestion);
      setOpen(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- react only to the resolved number
  }, [active?.id, active?.callerIdName]);

  const remember = () => {
    try {
      sessionStorage.setItem(SEEN_KEY, '1');
    } catch {
      /* ignore */
    }
  };

  const dismiss = () => {
    remember();
    setOpen(false);
  };

  const save = async () => {
    if (!active || !name.trim()) return;
    try {
      await updateCnam.mutateAsync({ numberId: active.id, callerIdName: name.trim() });
      dismiss();
    } catch {
      // leave the modal open; the mutation surfaces the error
    }
  };

  if (!open || !active) return null;

  return (
    <Modal
      isOpen={open}
      onClose={dismiss}
      title="Set your caller ID name"
      size="sm"
      footer={
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={dismiss}
            disabled={updateCnam.isPending}
            className="px-4 py-2 text-sm font-medium rounded-lg border border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--muted)] transition-colors disabled:opacity-50"
          >
            Maybe later
          </button>
          <Button
            onClick={save}
            loading={updateCnam.isPending}
            disabled={!name.trim() || updateCnam.isPending}
          >
            Save
          </Button>
        </div>
      }
    >
      <p className="text-sm text-[var(--muted-foreground)]">
        This is the name people see when you call them (your <strong>caller ID name</strong>, or
        CNAM) — so they see your business instead of just a number. Set it before your first call.
        Up to 15 characters; carrier updates can take a little time to show up.
      </p>
      <div className="mt-4">
        <Input
          label="Caller ID name"
          value={name}
          onChange={(e) => setName(e.target.value.slice(0, 15))}
          maxLength={15}
          placeholder="e.g. ArixCall"
          autoFocus
        />
        <div className="mt-1 text-right text-xs text-[var(--muted-foreground)]">{name.length}/15</div>
        {updateCnam.isError && (
          <p className="mt-2 text-xs text-[var(--danger)]">
            {updateCnam.error instanceof Error
              ? updateCnam.error.message
              : 'Could not save the caller ID name. Try again.'}
          </p>
        )}
      </div>
      <p className="mt-3 text-xs text-[var(--muted-foreground)]">
        Sending from <span className="font-medium">{active.phoneNumber}</span>
      </p>
    </Modal>
  );
}
