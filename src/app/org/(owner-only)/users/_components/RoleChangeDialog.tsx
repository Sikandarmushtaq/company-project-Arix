import React from 'react';
import { FiAlertTriangle } from 'react-icons/fi';
import { Button, Modal } from '@/components/ui';

interface RoleChangeDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  memberName: string;
}

export function RoleChangeDialog({
  isOpen,
  onClose,
  onConfirm,
  memberName,
}: RoleChangeDialogProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Change to Agent?"
      size="sm"
    >
      <div className="space-y-4">
        <div className="flex items-start gap-3 p-3 rounded-xl border border-amber-200 dark:border-amber-800/40 bg-amber-50/60 dark:bg-amber-950/20">
          <FiAlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <p className="text-xs text-[var(--foreground)] leading-relaxed">
            Changing <strong>{memberName}</strong> to Agent will remove their delegated management access.
          </p>
        </div>

        <p className="text-xs text-[var(--muted-foreground)] leading-relaxed">
          Their normal ArixCall workspace access will remain based on enabled communication features.
        </p>

        <div className="flex justify-end gap-2.5 pt-2">
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" onClick={onConfirm}>
            Change to Agent
          </Button>
        </div>
      </div>
    </Modal>
  );
}
