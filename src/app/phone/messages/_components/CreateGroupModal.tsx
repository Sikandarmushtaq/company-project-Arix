'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { FiX, FiPlus, FiUsers, FiTrash2 } from 'react-icons/fi';
import { Button, Input } from '@/components/ui';
import { useCreateGroup } from '@/lib/hooks';
import { useToast } from '@/lib/stores/toast';
import { formatPhoneNumber } from '@/lib/utils/phone';
import { GenericAvatar } from '@/components/phone/chrome/avatarUtils';
import { ContactPicker, type SelectedMember } from './ContactPicker';

interface CreateGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGroupCreated?: (groupId: number) => void;
}

/**
 * A real group text (Telnyx Group MMS) is a single multi-party conversation where
 * everyone sees each other and replies go to all — the carrier limit is 8 people.
 * Larger lists aren't a group; they belong in Bulk SMS (a one-way broadcast).
 */
const MAX_GROUP_MEMBERS = 8;

/**
 * Modal for creating a new SMS group
 *
 * Features:
 * - Group name and optional description
 * - Smart contact picker for adding members
 * - Member management with remove functionality
 * - Form validation
 */
export const CreateGroupModal = React.memo(function CreateGroupModal({
  isOpen,
  onClose,
  onGroupCreated,
}: CreateGroupModalProps) {
  const toast = useToast();
  const createGroup = useCreateGroup();
  const nameInputRef = useRef<HTMLInputElement>(null);

  const [groupName, setGroupName] = useState('');
  const [description, setDescription] = useState('');
  const [members, setMembers] = useState<SelectedMember[]>([]);
  const [showContactPicker, setShowContactPicker] = useState(false);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setGroupName('');
      setDescription('');
      setMembers([]);
      setShowContactPicker(false);
      requestAnimationFrame(() => nameInputRef.current?.focus());
    }
  }, [isOpen]);

  // Handle escape key (only when picker is closed)
  useEffect(() => {
    if (!isOpen || showContactPicker) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose, showContactPicker]);

  const handleAddMember = useCallback(
    (member: Omit<SelectedMember, 'id'>) => {
      const newMember: SelectedMember = {
        id: `${Date.now()}-${member.phoneNumber}`,
        ...member,
      };

      setMembers((prev) => {
        if (prev.length >= MAX_GROUP_MEMBERS) {
          toast.error(
            `A group can have up to ${MAX_GROUP_MEMBERS} people (group-texting limit). For larger lists, use Bulk SMS.`
          );
          return prev;
        }
        toast.success(`Added ${member.name || formatPhoneNumber(member.phoneNumber)}`);
        return [...prev, newMember];
      });
    },
    [toast]
  );

  const handleRemoveMember = useCallback((id: string) => {
    setMembers((prev) => prev.filter((m) => m.id !== id));
  }, []);

  const handleSubmit = useCallback(async () => {
    const trimmedName = groupName.trim();

    if (!trimmedName) {
      toast.error('Please enter a group name');
      return;
    }

    if (members.length === 0) {
      toast.error('Please add at least one member');
      return;
    }

    try {
      const result = await createGroup.mutateAsync({
        name: trimmedName,
        description: description.trim() || undefined,
        members: members.map((m) => m.phoneNumber),
      });

      toast.success(`Group "${trimmedName}" created with ${members.length} member(s)`);
      onGroupCreated?.(result.id);
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create group');
    }
  }, [groupName, description, members, createGroup, toast, onGroupCreated, onClose]);

  if (!isOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-group-title"
      >
        <div className="bg-[var(--card)] rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
            <div className="flex items-center gap-2.5">
              <span className="grid place-items-center w-9 h-9 rounded-full bg-[var(--primary-100)] dark:bg-[var(--primary-900)] text-[var(--foreground)]">
                <FiUsers className="w-[18px] h-[18px]" />
              </span>
              <h2 id="create-group-title" className="text-lg font-black text-[var(--foreground)]">
                Create Group
              </h2>
            </div>
            <button
              onClick={onClose}
              className="grid place-items-center w-9 h-9 rounded-full text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
              aria-label="Close"
            >
              <FiX className="w-[18px] h-[18px]" />
            </button>
          </div>

          {/* Content */}
          <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto">
            {/* Group Name */}
            <div>
              <label htmlFor="group-name" className="block text-[13px] font-bold text-[var(--foreground)] mb-1.5">
                Group Name <span className="text-[var(--danger)]">*</span>
              </label>
              <Input
                id="group-name"
                ref={nameInputRef}
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="Enter group name"
                maxLength={100}
              />
            </div>

            {/* Description */}
            <div>
              <label htmlFor="group-description" className="block text-[13px] font-bold text-[var(--foreground)] mb-1.5">
                Description <span className="font-normal text-[var(--muted-foreground)]">(optional)</span>
              </label>
              <textarea
                id="group-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What's this group about?"
                maxLength={500}
                rows={2}
                className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--input)] text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] resize-none"
              />
            </div>

            {/* Members Section */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-[13px] font-bold text-[var(--foreground)]">
                  Members <span className="text-[var(--danger)]">*</span>
                  <span className="text-[var(--muted-foreground)] font-normal ml-1">
                    ({members.length}/{MAX_GROUP_MEMBERS})
                  </span>
                </label>
                <button
                  type="button"
                  onClick={() => setShowContactPicker(true)}
                  disabled={members.length >= MAX_GROUP_MEMBERS}
                  className="flex items-center gap-1 text-[13px] font-bold text-[var(--foreground)] hover:text-[var(--foreground)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <FiPlus className="w-4 h-4" />
                  Add
                </button>
              </div>
              <p className="mb-2 text-[11px] leading-snug text-[var(--muted-foreground)]">
                Everyone sees each other and replies go to the whole group — up to{' '}
                {MAX_GROUP_MEMBERS} people. For larger lists, use Bulk SMS (a one-way broadcast).
              </p>

              {/* Members List */}
              {members.length > 0 ? (
                <div className="space-y-1 max-h-44 overflow-y-auto">
                  {members.map((member) => (
                    <MemberItem key={member.id} member={member} onRemove={handleRemoveMember} />
                  ))}
                </div>
              ) : (
                <EmptyMembersState />
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-2 px-5 py-4 border-t border-[var(--border)]">
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={createGroup.isPending || !groupName.trim() || members.length === 0}
            >
              {createGroup.isPending ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Creating...
                </div>
              ) : (
                'Create Group'
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Contact Picker (separate layer) */}
      <ContactPicker
        isOpen={showContactPicker}
        onClose={() => setShowContactPicker(false)}
        onAddMember={handleAddMember}
        existingMembers={members}
      />
    </>
  );
});

/**
 * Individual member item component
 */
const MemberItem = React.memo(function MemberItem({
  member,
  onRemove,
}: {
  member: SelectedMember;
  onRemove: (id: string) => void;
}) {
  return (
    <div className="group flex items-center justify-between gap-2 p-2 rounded-lg bg-[var(--muted)]/60 hover:bg-[var(--muted)] transition-colors">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <GenericAvatar name={member.name} number={member.phoneNumber} size={36} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-[var(--foreground)] truncate">
            {member.name || formatPhoneNumber(member.phoneNumber)}
          </p>
          {member.name && (
            <p className="text-xs text-[var(--muted-foreground)] truncate">
              {formatPhoneNumber(member.phoneNumber)}
            </p>
          )}
        </div>
      </div>
      <button
        onClick={() => onRemove(member.id)}
        className="grid place-items-center w-8 h-8 rounded-full text-[var(--muted-foreground)] hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-[var(--danger)] transition-colors shrink-0"
        aria-label={`Remove ${member.name || member.phoneNumber}`}
      >
        <FiTrash2 className="w-4 h-4" />
      </button>
    </div>
  );
});

/**
 * Empty state for members list
 */
const EmptyMembersState = React.memo(function EmptyMembersState() {
  return (
    <div className="text-center py-7 px-4 text-[var(--muted-foreground)] bg-[var(--muted)]/50 border border-dashed border-[var(--border)] rounded-xl">
      <FiUsers className="w-8 h-8 mx-auto mb-2 opacity-40" />
      <p className="text-sm font-bold text-[var(--foreground)]">No members added yet</p>
      <p className="text-xs mt-1">Tap “Add” to pick contacts or type a number</p>
    </div>
  );
});

export default CreateGroupModal;
