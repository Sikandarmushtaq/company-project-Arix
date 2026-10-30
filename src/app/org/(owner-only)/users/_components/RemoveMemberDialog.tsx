import React, { useState } from 'react';
import { FiTrash2 } from 'react-icons/fi';
import { Button, Modal } from '@/components/ui';
import { TeamMember } from './types';

interface RemoveMemberDialogProps {
  member: TeamMember | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (member: TeamMember, deleteData: boolean) => void;
  isDeleting?: boolean;
}

export function RemoveMemberDialog({
  member,
  isOpen,
  onClose,
  onConfirm,
  isDeleting = false,
}: RemoveMemberDialogProps) {
  const [deleteData, setDeleteData] = useState(false);

  if (!member) return null;

  const handleConfirm = () => {
    onConfirm(member, deleteData);
  };

  const handleClose = () => {
    if (isDeleting) return;
    setDeleteData(false);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={`Remove ${member.fullName}?`}
      size="sm"
    >
      <div className="space-y-4">
        <p className="text-sm text-[var(--muted-foreground)] leading-relaxed">
          <strong className="text-[var(--foreground)]">{member.fullName}</strong> will lose access to
          ArixCall and their assigned phone number will become available for another team member.
        </p>

        {/* Delete associated user data checkbox */}
        <div className="rounded-xl border border-[var(--border)] bg-[var(--muted)]/30 p-3.5 space-y-2">
          <label className="flex items-start gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={deleteData}
              onChange={(e) => setDeleteData(e.target.checked)}
              disabled={isDeleting}
              className="mt-0.5 h-4 w-4 rounded border-[var(--border)] text-[var(--primary)] focus:ring-[var(--primary)]"
            />
            <div>
              <span className="text-xs font-semibold text-[var(--foreground)] block">
                Delete associated user data
              </span>
              <span className="text-[11px] text-[var(--muted-foreground)] mt-0.5 block leading-relaxed">
                Calls, SMS messages, recordings and voicemails will enter the existing 30-day deletion
                grace period before permanent removal.
              </span>
            </div>
          </label>
        </div>

        <div className="flex justify-end gap-2.5 pt-2">
          <Button variant="outline" size="sm" onClick={handleClose} disabled={isDeleting}>
            Cancel
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={handleConfirm}
            disabled={isDeleting}
            loading={isDeleting}
            className="flex items-center gap-1.5"
          >
            <FiTrash2 className="w-3.5 h-3.5" />
            <span>{isDeleting ? 'Removing...' : 'Remove Member'}</span>
          </Button>
        </div>
      </div>
    </Modal>
  );
}
