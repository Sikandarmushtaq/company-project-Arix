import React from 'react';
import { FiSlash } from 'react-icons/fi';
import { Button, Modal } from '@/components/ui';
import { TeamMember } from './types';

interface DeactivateMemberDialogProps {
  member: TeamMember | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (member: TeamMember) => void;
}

export function DeactivateMemberDialog({
  member,
  isOpen,
  onClose,
  onConfirm,
}: DeactivateMemberDialogProps) {
  if (!member) return null;

  const handleConfirm = () => {
    onConfirm(member);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Deactivate ${member.fullName}?`}
      size="sm"
    >
      <div className="space-y-4">
        <p className="text-sm text-[var(--muted-foreground)] leading-relaxed">
          <strong className="text-[var(--foreground)]">{member.fullName}</strong> will no
          longer be able to sign in or use the ArixCall application. Their account, assigned
          phone number, Manager permissions and historical data will remain intact.
        </p>

        <div className="flex justify-end gap-2.5 pt-2">
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={handleConfirm}
            className="flex items-center gap-1.5"
          >
            <FiSlash className="w-3.5 h-3.5" />
            Deactivate Member
          </Button>
        </div>
      </div>
    </Modal>
  );
}
