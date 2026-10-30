'use client';

import React from 'react';
import { FiX } from 'react-icons/fi';
import { Button, Input } from '@/components/ui';

export interface EditLimitModalProps {
  phone: string;
  currentLimit: number | null;
  editLimitValue: string;
  onEditLimitValueChange: (value: string) => void;
  onSave: () => void;
  onClose: () => void;
  isSaving: boolean;
}

export function EditLimitModal({
  phone,
  currentLimit,
  editLimitValue,
  onEditLimitValueChange,
  onSave,
  onClose,
  isSaving,
}: EditLimitModalProps) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-[var(--card)] rounded-lg p-6 w-full max-w-md shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-[var(--foreground)]">Edit SMS Limit</h3>
          <button
            onClick={onClose}
            className="text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
          >
            <FiX className="w-5 h-5" />
          </button>
        </div>
        <p className="text-sm text-[var(--muted-foreground)] mb-4">
          Set monthly SMS limit for <strong>{phone}</strong>
        </p>
        <div className="mb-4">
          <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
            Monthly Limit
          </label>
          <Input
            type="number"
            min="0"
            value={editLimitValue}
            onChange={(e) => onEditLimitValueChange(e.target.value)}
            placeholder="Enter limit (empty = unlimited)"
            className="w-full"
          />
          <p className="text-xs text-[var(--muted-foreground)] mt-1">
            Current: {currentLimit ?? 'Unlimited'}
          </p>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={onSave} disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </div>
    </div>
  );
}
