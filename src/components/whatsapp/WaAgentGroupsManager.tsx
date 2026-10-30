'use client';

/**
 * Per-org WhatsApp Agent Groups manager.
 *
 * Manager creates groups, picks members, then assigns the group to one or
 * more WhatsApp numbers (number assignment lives on the Numbers page).
 * Sticky-conversation routing is independent — each customer is owned by
 * one specific agent regardless of which group they're in.
 *
 * Used by both /org/whatsapp/groups (org-owner shell) and the admin shell
 * variant for managers. Path props keep cross-page nav inside whichever
 * shell is hosting the component.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  FiCheck,
  FiX,
  FiUserPlus,
  FiUsers,
  FiPlus,
  FiEdit2,
  FiTrash2,
  FiAlertCircle,
} from 'react-icons/fi';
import { Card, CardContent, CardHeader, CardTitle, Button } from '@/components/ui';
import {
  useMyWaGroups,
  useCreateMyWaGroup,
  useUpdateMyWaGroup,
  useDeleteMyWaGroup,
  useSetMyWaGroupMembers,
} from '@/lib/hooks/useWaOrg';
import { useRealtimeWaOrgSync } from '@/lib/hooks/useRealtimeWaOrgSync';
import { apiClient } from '@/lib/api/client';
import type { ApiResponse } from '@/lib/types';
import type { WaAgentGroup } from '@/lib/api/services/whatsapp-types';
import { WaErrorBanner } from './WaErrorBanner';

interface OrgMember {
  id: number;
  fullName: string;
  email: string;
  role: 'owner' | 'manager' | 'user';
}

interface Props {
  /** Where the "go to numbers" nav links should land (per host route). */
  numbersPath: string;
}

export function WaAgentGroupsManager({ numbersPath }: Props) {
  // Mount the realtime cache-sync listener for this surface. Other
  // managers' edits propagate live without polling — when manager B
  // creates a group or removes a member, manager A's open page
  // reconciles via React Query invalidation triggered by WS events.
  useRealtimeWaOrgSync();

  const router = useRouter();
  const { data: groups, isLoading, isError, error, refetch } = useMyWaGroups();

  const { data: usersData } = useQuery({
    queryKey: ['wa', 'org', 'users'],
    queryFn: () =>
      apiClient.get<ApiResponse<OrgMember[]>>('/whatsapp/org/users').then((r) => r.data),
    staleTime: 30_000,
    retry: false,
  });
  const allUsers: OrgMember[] = usersData ?? [];
  const assignableUsers = useMemo(() => allUsers.filter((u) => u.role === 'user'), [allUsers]);

  const [editing, setEditing] = useState<WaAgentGroup | null>(null);
  const [creating, setCreating] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<WaAgentGroup | null>(null);

  if (isLoading) {
    return <GroupsSkeleton />;
  }

  if (isError) {
    return <WaErrorBanner error={error} context="WhatsApp groups" onRetry={() => refetch()} />;
  }

  const list = groups ?? [];

  return (
    <div className="space-y-4">
      {/* Compact action bar — count + primary CTA */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="text-sm text-[var(--muted-foreground)]">
          {list.length === 0
            ? 'Create groups to share WhatsApp numbers across multiple agents.'
            : `${list.length} group${list.length === 1 ? '' : 's'}`}
        </div>
        <Button size="sm" onClick={() => setCreating(true)}>
          <FiPlus className="w-4 h-4" /> New group
        </Button>
      </div>

      {list.length === 0 ? (
        <Card>
          <CardContent className="text-center py-16 space-y-4">
            <div className="w-14 h-14 rounded-full bg-[var(--muted)] flex items-center justify-center mx-auto">
              <FiUsers className="w-7 h-7 text-[var(--muted-foreground)]" />
            </div>
            <div>
              <h3 className="font-semibold text-[var(--foreground)]">No groups yet</h3>
              <p className="text-sm text-[var(--muted-foreground)] mt-1 max-w-md mx-auto">
                Groups let multiple agents share one WhatsApp number while keeping each
                customer&apos;s conversation tied to whichever agent started it.
              </p>
            </div>
            <Button onClick={() => setCreating(true)}>
              <FiPlus className="w-4 h-4" /> Create first group
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((group) => (
            <GroupCard
              key={group.id}
              group={group}
              onEdit={() => setEditing(group)}
              onDelete={() => setConfirmDelete(group)}
              onJumpToNumbers={() => router.push(numbersPath)}
            />
          ))}
        </div>
      )}

      {creating && (
        <GroupEditorModal
          mode="create"
          assignableUsers={assignableUsers}
          onClose={() => setCreating(false)}
        />
      )}
      {editing && (
        <GroupEditorModal
          mode="edit"
          group={editing}
          assignableUsers={assignableUsers}
          onClose={() => setEditing(null)}
        />
      )}
      {confirmDelete && (
        <DeleteConfirmModal group={confirmDelete} onClose={() => setConfirmDelete(null)} />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Group card
// ─────────────────────────────────────────────────────────────

function GroupCard({
  group,
  onEdit,
  onDelete,
  onJumpToNumbers,
}: {
  group: WaAgentGroup;
  onEdit: () => void;
  onDelete: () => void;
  onJumpToNumbers: () => void;
}) {
  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="truncate">{group.name}</CardTitle>
            {group.description && (
              <p className="text-sm text-[var(--muted-foreground)] mt-1 line-clamp-2">
                {group.description}
              </p>
            )}
          </div>
          <div className="flex gap-1 flex-shrink-0">
            <button
              type="button"
              onClick={onEdit}
              className="p-1.5 rounded-lg hover:bg-[var(--muted)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
              aria-label="Edit group"
            >
              <FiEdit2 className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onDelete}
              className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-[var(--muted-foreground)] hover:text-red-600 dark:hover:text-red-400 transition-colors"
              aria-label="Delete group"
            >
              <FiTrash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 space-y-3 pt-0">
        <div className="flex items-center gap-3 text-sm">
          <Stat label="Agents" value={group.memberCount} />
          <Stat label="Numbers" value={group.numberIds.length} />
        </div>
        {group.members.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {group.members.slice(0, 6).map((m) => (
              <span
                key={m.userId}
                className="inline-flex items-center px-2 py-0.5 rounded-full bg-[var(--muted)] text-xs text-[var(--foreground)] truncate max-w-[12rem]"
                title={m.email ?? undefined}
              >
                {m.fullName ?? `User #${m.userId}`}
              </span>
            ))}
            {group.members.length > 6 && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-[var(--muted)] text-xs text-[var(--muted-foreground)]">
                +{group.members.length - 6} more
              </span>
            )}
          </div>
        )}
        {group.numberIds.length === 0 && (
          <button
            type="button"
            onClick={onJumpToNumbers}
            className="text-xs font-medium text-[var(--foreground)] hover:underline self-start"
          >
            Assign to a number →
          </button>
        )}
      </CardContent>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="text-base font-semibold text-[var(--foreground)]">{value}</span>
      <span className="text-xs text-[var(--muted-foreground)] uppercase tracking-wide">
        {label}
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Editor modal — create + edit share the same form
// ─────────────────────────────────────────────────────────────

function GroupEditorModal({
  mode,
  group,
  assignableUsers,
  onClose,
}: {
  mode: 'create' | 'edit';
  group?: WaAgentGroup;
  assignableUsers: OrgMember[];
  onClose: () => void;
}) {
  const [name, setName] = useState(group?.name ?? '');
  const [description, setDescription] = useState(group?.description ?? '');
  const [memberIds, setMemberIds] = useState<number[]>(group?.members.map((m) => m.userId) ?? []);

  const create = useCreateMyWaGroup();
  const update = useUpdateMyWaGroup();
  const setMembers = useSetMyWaGroupMembers();
  const isPending = create.isPending || update.isPending || setMembers.isPending;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) return;

    try {
      if (mode === 'create') {
        await create.mutateAsync({
          name: trimmedName,
          description: description.trim() || null,
          memberUserIds: memberIds,
        });
      } else if (group) {
        // Detail: update name/description first; only call setMembers
        // when the membership actually differs to avoid noise.
        const existingIds = group.members.map((m) => m.userId).sort();
        const nextIds = [...memberIds].sort();
        const membersChanged =
          existingIds.length !== nextIds.length || existingIds.some((id, i) => id !== nextIds[i]);
        const nameChanged = trimmedName !== group.name;
        const descChanged = (description.trim() || null) !== (group.description ?? null);

        if (nameChanged || descChanged) {
          await update.mutateAsync({
            groupId: group.id,
            data: {
              name: nameChanged ? trimmedName : undefined,
              description: descChanged ? description.trim() || null : undefined,
            },
          });
        }
        if (membersChanged) {
          await setMembers.mutateAsync({ groupId: group.id, userIds: memberIds });
        }
      }
      onClose();
    } catch {
      // Error surfaces via the mutation banner below.
    }
  };

  const error =
    (create.error as Error | undefined)?.message ??
    (update.error as Error | undefined)?.message ??
    (setMembers.error as Error | undefined)?.message ??
    null;

  return (
    <Modal onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <h2 className="text-xl font-semibold text-[var(--foreground)]">
            {mode === 'create' ? 'Create group' : 'Edit group'}
          </h2>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">
            Pick the agents who should share access to numbers assigned to this group.
          </p>
        </div>

        {error && (
          <div className="rounded-lg border border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/20 p-3 flex items-start gap-2">
            <FiAlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-800 dark:text-red-300">{error}</p>
          </div>
        )}

        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-[var(--foreground)]">Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Sales Team"
            maxLength={120}
            required
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm text-[var(--foreground)] placeholder-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-600)]"
          />
        </div>

        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-[var(--foreground)]">
            Description <span className="text-[var(--muted-foreground)]">(optional)</span>
          </label>
          <textarea
            value={description ?? ''}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What this group does"
            maxLength={500}
            rows={2}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm text-[var(--foreground)] placeholder-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-600)]"
          />
        </div>

        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-[var(--foreground)]">Members</label>
          <MemberPicker
            assignableUsers={assignableUsers}
            value={memberIds}
            onChange={setMemberIds}
            disabled={isPending}
          />
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-[var(--border)]">
          <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button type="submit" loading={isPending} disabled={isPending || !name.trim()}>
            {mode === 'create' ? 'Create group' : 'Save changes'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────
// Member picker — popover with search + checklist
// ─────────────────────────────────────────────────────────────

function MemberPicker({
  assignableUsers,
  value,
  onChange,
  disabled,
}: {
  assignableUsers: OrgMember[];
  value: number[];
  onChange: (next: number[]) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [flipUp, setFlipUp] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const userById = useMemo(() => new Map(assignableUsers.map((u) => [u.id, u])), [assignableUsers]);

  useEffect(() => {
    if (!open) return;
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const POPOVER_MAX_HEIGHT = 320;
    const SAFETY = 8;
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    setFlipUp(spaceBelow < POPOVER_MAX_HEIGHT + SAFETY && spaceAbove > spaceBelow);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        popoverRef.current &&
        !popoverRef.current.contains(target) &&
        triggerRef.current &&
        !triggerRef.current.contains(target)
      ) {
        setOpen(false);
      }
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onEsc);
    };
  }, [open]);

  const toggle = (userId: number) => {
    onChange(value.includes(userId) ? value.filter((id) => id !== userId) : [...value, userId]);
  };

  const removeChip = (userId: number) => {
    onChange(value.filter((id) => id !== userId));
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return assignableUsers;
    return assignableUsers.filter(
      (u) => u.fullName.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
    );
  }, [assignableUsers, search]);

  return (
    <div className="relative">
      <div className="flex flex-wrap items-center gap-1.5 min-h-[2.25rem] rounded-lg border border-[var(--border)] bg-[var(--card)] px-2 py-1.5">
        {value.length === 0 ? (
          <span className="text-xs text-[var(--muted-foreground)] italic px-1">No members yet</span>
        ) : (
          value.map((id) => {
            const u = userById.get(id);
            const label = u?.fullName ?? `User #${id}`;
            return (
              <span
                key={id}
                className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-full bg-[var(--primary-600)]/10 text-[var(--foreground)] text-xs font-medium border border-[var(--border)]/20"
              >
                {label}
                <button
                  type="button"
                  onClick={() => removeChip(id)}
                  disabled={disabled}
                  className="rounded-full p-0.5 hover:bg-[var(--primary-600)]/20 disabled:opacity-50"
                  aria-label={`Remove ${label}`}
                >
                  <FiX className="w-3 h-3" />
                </button>
              </span>
            );
          })
        )}
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setOpen((v) => !v)}
          disabled={disabled}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-dashed border-[var(--border)] text-xs text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)] disabled:opacity-50 transition-colors"
        >
          <FiUserPlus className="w-3.5 h-3.5" />
          Add
        </button>
      </div>

      {open && (
        <div
          ref={popoverRef}
          className={`absolute z-30 w-72 max-h-80 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-lg flex flex-col ${
            flipUp ? 'bottom-full mb-2' : 'top-full mt-2'
          }`}
        >
          <div className="px-3 py-2 border-b border-[var(--border)] flex items-center gap-2">
            <FiUsers className="w-4 h-4 text-[var(--muted-foreground)] flex-shrink-0" />
            <input
              type="text"
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search agents…"
              className="w-full bg-transparent text-sm text-[var(--foreground)] placeholder-[var(--muted-foreground)] outline-none"
            />
          </div>
          <div className="overflow-y-auto flex-1">
            {filtered.length === 0 ? (
              <div className="px-3 py-6 text-center text-sm text-[var(--muted-foreground)]">
                {search ? 'No agents match.' : 'No agents in your org yet.'}
              </div>
            ) : (
              <ul className="py-1">
                {filtered.map((u) => {
                  const checked = value.includes(u.id);
                  return (
                    <li key={u.id}>
                      <button
                        type="button"
                        onClick={() => toggle(u.id)}
                        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-[var(--muted)] transition-colors"
                      >
                        <span
                          className={`flex-shrink-0 w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                            checked
                              ? 'bg-[var(--primary-600)] border-[var(--border)] text-white'
                              : 'border-[var(--border)] bg-transparent'
                          }`}
                        >
                          {checked && <FiCheck className="w-3 h-3" />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm text-[var(--foreground)] truncate">
                            {u.fullName}
                          </span>
                          <span className="block text-xs text-[var(--muted-foreground)] truncate">
                            {u.email}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          {value.length > 0 && (
            <div className="px-3 py-2 border-t border-[var(--border)] flex items-center justify-between">
              <span className="text-xs text-[var(--muted-foreground)]">
                {value.length} selected
              </span>
              <button
                type="button"
                onClick={() => onChange([])}
                className="text-xs font-medium text-red-600 dark:text-red-400 hover:underline"
              >
                Remove all
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Delete confirm
// ─────────────────────────────────────────────────────────────

function DeleteConfirmModal({ group, onClose }: { group: WaAgentGroup; onClose: () => void }) {
  const del = useDeleteMyWaGroup();

  const handleDelete = async () => {
    try {
      await del.mutateAsync(group.id);
      onClose();
    } catch {
      // surfaces below
    }
  };

  return (
    <Modal onClose={onClose}>
      <div className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold text-[var(--foreground)]">Delete group?</h2>
          <p className="text-sm text-[var(--muted-foreground)] mt-2">
            <strong className="text-[var(--foreground)]">{group.name}</strong> will be removed.
            {group.numberIds.length > 0 && (
              <>
                {' '}
                {group.numberIds.length} number
                {group.numberIds.length === 1 ? '' : 's'} currently assigned to this group{' '}
                {group.numberIds.length === 1 ? 'will be' : 'will become'} unassigned. Members lose
                access to those numbers.
              </>
            )}
          </p>
          <p className="text-sm text-[var(--muted-foreground)] mt-2">
            Customer ownerships are not affected — agents keep their existing customers.
          </p>
        </div>
        {del.isError && (
          <div className="rounded-lg border border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/20 p-3 flex items-start gap-2">
            <FiAlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-800 dark:text-red-300">
              {(del.error as Error).message || 'Could not delete the group.'}
            </p>
          </div>
        )}
        <div className="flex justify-end gap-2 pt-2 border-t border-[var(--border)]">
          <Button type="button" variant="outline" onClick={onClose} disabled={del.isPending}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleDelete}
            loading={del.isPending}
            disabled={del.isPending}
            className="bg-red-600 hover:bg-red-700 text-white"
          >
            Delete group
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────
// Modal shell
// ─────────────────────────────────────────────────────────────

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onEsc);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onEsc);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-lg rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-2xl p-6">
        {children}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Skeleton
// ─────────────────────────────────────────────────────────────

function GroupsSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <Card key={i}>
          <CardHeader className="pb-3">
            <div className="h-5 w-32 bg-[var(--muted)] rounded animate-pulse" />
            <div className="h-3 w-48 bg-[var(--muted)] rounded animate-pulse mt-2" />
          </CardHeader>
          <CardContent className="space-y-3 pt-0">
            <div className="h-4 w-24 bg-[var(--muted)] rounded animate-pulse" />
            <div className="flex gap-1.5">
              <div className="h-5 w-16 bg-[var(--muted)] rounded-full animate-pulse" />
              <div className="h-5 w-20 bg-[var(--muted)] rounded-full animate-pulse" />
              <div className="h-5 w-14 bg-[var(--muted)] rounded-full animate-pulse" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
