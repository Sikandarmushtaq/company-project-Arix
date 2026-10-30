'use client';

import React, { useState, useCallback, useRef } from 'react';
import {
  FiX,
  FiPlus,
  FiUsers,
  FiTrash2,
  FiEdit3,
  FiCheck,
  FiUserMinus,
  FiSettings,
} from 'react-icons/fi';
import { Button, Input } from '@/components/ui';
import { formatLocalDate } from '@/lib/utils/datetime';
import {
  useGroup,
  useUpdateGroup,
  useDeleteGroup,
  useAddGroupMembers,
  useRemoveGroupMember,
} from '@/lib/hooks';
import { useToast } from '@/lib/stores/toast';
import { normalizePhone, formatPhoneNumber, isOwnNumber } from '@/lib/utils/phone';
import { useAuthStore } from '@/lib/stores/auth';
import type { SmsGroupMember } from '@/lib/api';

interface GroupInfoPanelProps {
  groupId: number;
  isOpen: boolean;
  onClose: () => void;
  onDeleted?: () => void;
}

/**
 * Side panel for viewing and managing group details
 */
export const GroupInfoPanel = React.memo(function GroupInfoPanel({
  groupId,
  isOpen,
  onClose,
  onDeleted,
}: GroupInfoPanelProps) {
  const toast = useToast();
  const user = useAuthStore((s) => s.user);
  const { data: group, isLoading } = useGroup(groupId);

  // Separate own phone from other members for display
  const otherMembers = group?.members?.filter(
    (m) => !isOwnNumber(m.phoneNumber, user?.senderPhone, user?.phoneNumbers)
  );
  const otherMemberCount = otherMembers?.length ?? 0;
  const updateGroup = useUpdateGroup();
  const deleteGroup = useDeleteGroup();
  const addMembers = useAddGroupMembers();
  const removeMember = useRemoveGroupMember();

  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState('');
  const [isAddingMember, setIsAddingMember] = useState(false);
  const [newMemberPhone, setNewMemberPhone] = useState('');
  const [newMemberName, setNewMemberName] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const nameInputRef = useRef<HTMLInputElement>(null);
  const phoneInputRef = useRef<HTMLInputElement>(null);

  // Start editing name
  const handleStartEditName = useCallback(() => {
    if (group) {
      setEditedName(group.name);
      setIsEditingName(true);
      requestAnimationFrame(() => nameInputRef.current?.focus());
    }
  }, [group]);

  // Save name
  const handleSaveName = useCallback(async () => {
    if (!editedName.trim()) {
      toast.error('Group name cannot be empty');
      return;
    }

    try {
      await updateGroup.mutateAsync({
        groupId,
        data: { name: editedName.trim() },
      });
      setIsEditingName(false);
      toast.success('Group name updated');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update name');
    }
  }, [editedName, groupId, updateGroup, toast]);

  // Add member
  const handleAddMember = useCallback(async () => {
    const normalized = normalizePhone(newMemberPhone);
    if (!normalized || normalized.length < 10) {
      toast.error('Please enter a valid phone number');
      return;
    }

    // Check if already a member
    if (group?.members.some((m) => normalizePhone(m.phoneNumber) === normalized)) {
      toast.error('This person is already a member');
      return;
    }

    // Real group texting (Telnyx Group MMS) tops out at 8 people — beyond that it
    // can't be a group (everyone-sees-everyone), only a one-way broadcast.
    if ((group?.members.length ?? 0) >= 8) {
      toast.error('A group can have up to 8 people. For larger lists, use Bulk SMS.');
      return;
    }

    try {
      await addMembers.mutateAsync({
        groupId,
        data: {
          members: [{ phoneNumber: normalized, name: newMemberName.trim() || undefined }],
        },
      });
      setNewMemberPhone('');
      setNewMemberName('');
      setIsAddingMember(false);
      toast.success('Member added');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add member');
    }
  }, [newMemberPhone, newMemberName, group, groupId, addMembers, toast]);

  // Remove member
  const handleRemoveMember = useCallback(
    async (member: SmsGroupMember) => {
      try {
        await removeMember.mutateAsync({
          groupId,
          phoneNumber: member.phoneNumber,
        });
        toast.success(`${member.name || formatPhoneNumber(member.phoneNumber)} removed`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to remove member');
      }
    },
    [groupId, removeMember, toast]
  );

  // Delete group
  const handleDeleteGroup = useCallback(async () => {
    try {
      await deleteGroup.mutateAsync(groupId);
      toast.success('Group deleted');
      onDeleted?.();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete group');
    }
  }, [groupId, deleteGroup, toast, onDeleted, onClose]);

  if (!isOpen) return null;

  return (
    <>
      {/* Mobile-only backdrop (tap to close). Desktop keeps the borderless side panel. */}
      <div
        className="sm:hidden fixed inset-0 z-40 bg-black/50"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-80 bg-[var(--card)] shadow-xl border-l border-[var(--border)] flex flex-col pt-safe pb-safe">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
          <div className="flex items-center gap-2">
            <FiSettings className="w-5 h-5 text-[var(--foreground)]" />
            <h2 className="font-semibold">Group Info</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-[var(--muted)] transition-colors"
            aria-label="Close"
          >
            <FiX className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <div className="w-6 h-6 border-2 border-[var(--border)] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : group ? (
            <div className="p-4 space-y-6">
              {/* Group Name */}
              <div>
                <label className="text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wider">
                  Group Name
                </label>
                {isEditingName ? (
                  <div className="flex items-center gap-2 mt-1">
                    <Input
                      ref={nameInputRef}
                      value={editedName}
                      onChange={(e) => setEditedName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveName();
                        if (e.key === 'Escape') setIsEditingName(false);
                      }}
                      className="flex-1"
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={handleSaveName}
                      disabled={updateGroup.isPending}
                    >
                      <FiCheck className="w-4 h-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => setIsEditingName(false)}>
                      <FiX className="w-4 h-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between mt-1">
                    <p className="font-medium">{group.name}</p>
                    <button
                      onClick={handleStartEditName}
                      className="p-1.5 rounded hover:bg-[var(--muted)] text-[var(--muted-foreground)]"
                      aria-label="Edit name"
                    >
                      <FiEdit3 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              {/* Description */}
              {group.description && (
                <div>
                  <label className="text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wider">
                    Description
                  </label>
                  <p className="mt-1 text-sm">{group.description}</p>
                </div>
              )}

              {/* Members */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wider">
                    Members ({otherMemberCount})
                  </label>
                  <button
                    onClick={() => {
                      setIsAddingMember(true);
                      requestAnimationFrame(() => phoneInputRef.current?.focus());
                    }}
                    className="p-1.5 rounded hover:bg-[var(--muted)] text-[var(--foreground)]"
                    aria-label="Add member"
                  >
                    <FiPlus className="w-4 h-4" />
                  </button>
                </div>

                {/* Add Member Form */}
                {isAddingMember && (
                  <div className="p-3 rounded-lg bg-[var(--muted)] mb-3 space-y-2">
                    <Input
                      ref={phoneInputRef}
                      value={newMemberPhone}
                      onChange={(e) => setNewMemberPhone(e.target.value)}
                      placeholder="Phone number"
                      type="tel"
                    />
                    <Input
                      value={newMemberName}
                      onChange={(e) => setNewMemberName(e.target.value)}
                      placeholder="Name (optional)"
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        className="flex-1"
                        onClick={handleAddMember}
                        disabled={addMembers.isPending || !newMemberPhone}
                      >
                        {addMembers.isPending ? 'Adding...' : 'Add'}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setIsAddingMember(false);
                          setNewMemberPhone('');
                          setNewMemberName('');
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}

                {/* Members List (excludes self — creator is always a member but not shown) */}
                <div className="space-y-1">
                  {otherMembers?.map((member) => (
                    <div
                      key={member.id}
                      className="flex items-center justify-between p-2 rounded-lg hover:bg-[var(--muted)] group"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm truncate">
                          {member.name || formatPhoneNumber(member.phoneNumber)}
                        </p>
                        {member.name && (
                          <p className="text-xs text-[var(--muted-foreground)]">
                            {formatPhoneNumber(member.phoneNumber)}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => handleRemoveMember(member)}
                        className="p-1.5 rounded opacity-0 group-hover:opacity-100 hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 transition-all"
                        aria-label={`Remove ${member.name || member.phoneNumber}`}
                        disabled={removeMember.isPending}
                      >
                        <FiUserMinus className="w-4 h-4" />
                      </button>
                    </div>
                  ))}

                  {otherMemberCount === 0 && (
                    <p className="text-sm text-[var(--muted-foreground)] text-center py-4">
                      No members yet
                    </p>
                  )}
                </div>
              </div>

              {/* Created Date */}
              <div>
                <label className="text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wider">
                  Created
                </label>
                <p className="mt-1 text-sm">{formatLocalDate(group.createdAt)}</p>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-32 text-[var(--muted-foreground)]">
              Group not found
            </div>
          )}
        </div>

        {/* Footer - Delete Button */}
        {group && (
          <div className="p-4 border-t border-[var(--border)]">
            {showDeleteConfirm ? (
              <div className="space-y-2">
                <p className="text-sm text-center text-[var(--muted-foreground)]">
                  Are you sure you want to delete this group?
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    className="flex-1"
                    onClick={() => setShowDeleteConfirm(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    className="flex-1 bg-red-600 hover:bg-red-700"
                    onClick={handleDeleteGroup}
                    disabled={deleteGroup.isPending}
                  >
                    {deleteGroup.isPending ? 'Deleting...' : 'Delete'}
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                variant="ghost"
                className="w-full text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                onClick={() => setShowDeleteConfirm(true)}
              >
                <FiTrash2 className="w-4 h-4 mr-2" />
                Delete Group
              </Button>
            )}
          </div>
        )}
      </div>
    </>
  );
});

export default GroupInfoPanel;
