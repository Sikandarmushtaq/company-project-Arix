import React, { useState } from 'react';
import { FiLock, FiCopy, FiCheck } from 'react-icons/fi';
import { Button, Input, Modal } from '@/components/ui';
import { TeamMember } from './types';

interface ResetPasswordDialogProps {
  member: TeamMember | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (member: TeamMember, newPassword: string) => void;
}

export function ResetPasswordDialog({
  member,
  isOpen,
  onClose,
  onConfirm,
}: ResetPasswordDialogProps) {
  const [password, setPassword] = useState('');
  const [copied, setCopied] = useState(false);

  if (!member) return null;

  const handleGenerate = () => {
    const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%';
    let res = '';
    for (let i = 0; i < 12; i++) {
      res += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setPassword(res);
    setCopied(false);
  };

  const handleCopy = () => {
    if (!password) return;
    navigator.clipboard.writeText(password);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) return;
    onConfirm(member, password);
    setPassword('');
    setCopied(false);
    onClose();
  };

  const handleClose = () => {
    setPassword('');
    setCopied(false);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={`Reset password for ${member.fullName}`}
      size="sm"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-xs text-[var(--muted-foreground)] leading-relaxed">
          Set a new temporary password for <strong>{member.email}</strong>. They will use this password to sign in to ArixCall.
        </p>

        <div className="space-y-2">
          <label className="text-xs font-semibold text-[var(--foreground)] block">
            Temporary Password (min. 8 characters)
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter new password"
              className="flex-1 px-3 py-2 text-sm bg-[var(--background)] border border-[var(--border)] rounded-xl font-mono focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
              required
              minLength={8}
            />
            <Button type="button" variant="outline" size="sm" onClick={handleGenerate}>
              Generate
            </Button>
          </div>
          {password && (
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 text-xs text-[var(--primary)] hover:underline pt-1"
            >
              {copied ? <FiCheck className="w-3.5 h-3.5 text-emerald-500" /> : <FiCopy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied to clipboard' : 'Copy password'}</span>
            </button>
          )}
        </div>

        <div className="flex justify-end gap-2.5 pt-2">
          <Button type="button" variant="outline" size="sm" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="sm"
            disabled={password.length < 8}
          >
            Update Password
          </Button>
        </div>
      </form>
    </Modal>
  );
}
