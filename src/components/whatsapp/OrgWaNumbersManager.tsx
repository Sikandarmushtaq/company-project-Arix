'use client';

/**
 * Per-org WhatsApp Numbers manager.
 *
 * Renders inside the WhatsApp tabbed layout (the H1 + tab nav are owned
 * by the layout). This component just lays out the numbers table with
 * a group-assignment selector that supports inline group creation —
 * no navigation away to set things up.
 *
 * Used by:
 *  - /org/whatsapp/numbers (org owner shell)
 *  - /admin/whatsapp/numbers (manager-side admin shell)
 */

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import {
  FiCheck,
  FiX,
  FiRefreshCw,
  FiAlertCircle,
  FiUsers,
  FiPlus,
  FiChevronDown,
  FiSettings,
} from 'react-icons/fi';
import { Card, CardContent, Button } from '@/components/ui';
import {
  useMyWaConfig,
  useMyWaNumbers,
  useSyncMyWaNumbers,
  useAssignMyWaNumber,
  useAssignMyWaNumberGroup,
  useMyWaGroups,
  useCreateMyWaGroup,
} from '@/lib/hooks/useWaOrg';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import type { ApiResponse } from '@/lib/types';
import type { WaNumber, WaAgentGroup } from '@/lib/api/services/whatsapp-types';
import { useRealtimeWaOrgSync } from '@/lib/hooks/useRealtimeWaOrgSync';
import { WaErrorBanner } from './WaErrorBanner';

interface OrgMember {
  id: number;
  fullName: string;
  email: string;
  role: 'owner' | 'manager' | 'user';
}

interface Props {
  /** Where the "go to settings" empty-state CTA navigates. */
  settingsPath: string;
}

export function OrgWaNumbersManager({ settingsPath }: Props) {
  useRealtimeWaOrgSync();

  const router = useRouter();
  const {
    data: config,
    isLoading: configLoading,
    isError: configError,
    error: configErrorObj,
    refetch: refetchConfig,
  } = useMyWaConfig();
  const {
    data: numbers,
    isLoading: numbersLoading,
    isError: numbersError,
    error: numbersErrorObj,
    refetch: refetchNumbers,
  } = useMyWaNumbers();
  const { data: groups } = useMyWaGroups();
  const syncMutation = useSyncMyWaNumbers();
  const assignUserMutation = useAssignMyWaNumber();
  const assignGroupMutation = useAssignMyWaNumberGroup();
  const [syncFlash, setSyncFlash] = useState<{ count: number } | null>(null);

  const { data: usersData } = useQuery({
    queryKey: ['wa', 'org', 'users'],
    queryFn: () =>
      apiClient.get<ApiResponse<OrgMember[]>>('/whatsapp/org/users').then((r) => r.data),
    staleTime: 30_000,
    retry: false,
  });
  const assignableUsers = useMemo(
    () => (usersData ?? []).filter((u) => u.role === 'user'),
    [usersData]
  );

  useEffect(() => {
    if (syncMutation.isSuccess && syncMutation.data) {
      setSyncFlash({ count: syncMutation.data.count });
      const timer = setTimeout(() => setSyncFlash(null), 3500);
      return () => clearTimeout(timer);
    }
  }, [syncMutation.isSuccess, syncMutation.data]);

  // Loading: skeleton table
  if (configLoading) {
    return <NumbersSkeleton />;
  }

  // Errored config
  if (configError) {
    return (
      <WaErrorBanner
        error={configErrorObj}
        context="WhatsApp numbers"
        onRetry={() => refetchConfig()}
      />
    );
  }

  // Not connected — primary empty state with single CTA to Settings tab
  if (!config) {
    return <NotConnectedEmptyState onConnect={() => router.push(settingsPath)} />;
  }

  const list = numbers ?? [];
  const groupList = groups ?? [];

  return (
    <div className="space-y-4">
      {/* Action bar: count + sync */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="text-sm text-[var(--muted-foreground)]">
          {list.length} number{list.length === 1 ? '' : 's'} on this WABA
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => syncMutation.mutate()}
          disabled={syncMutation.isPending}
          loading={syncMutation.isPending}
        >
          <FiRefreshCw className="w-4 h-4" /> Sync from Meta
        </Button>
      </div>

      {syncMutation.isError && (
        <Banner
          variant="error"
          message={(syncMutation.error as Error).message || 'Could not sync from Meta. Try again.'}
        />
      )}
      {syncFlash && (
        <Banner
          variant="success"
          message={`Synced ${syncFlash.count} number${syncFlash.count === 1 ? '' : 's'} from Meta.`}
        />
      )}
      {assignGroupMutation.isError && (
        <Banner
          variant="error"
          message={
            (assignGroupMutation.error as Error).message ||
            'Failed to update assignment. Refresh and try again.'
          }
        />
      )}

      {numbersError ? (
        <WaErrorBanner
          error={numbersErrorObj}
          context="WhatsApp numbers"
          onRetry={() => refetchNumbers()}
        />
      ) : numbersLoading ? (
        <NumbersSkeleton />
      ) : list.length === 0 ? (
        <NoNumbersEmptyState onSync={() => syncMutation.mutate()} />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-[var(--muted)]/40">
                <tr className="border-b border-[var(--border)]">
                  <Th>Number</Th>
                  <Th>Verified name</Th>
                  <Th>Quality</Th>
                  <Th>Assigned group</Th>
                  <Th>Status</Th>
                </tr>
              </thead>
              <tbody>
                {list.map((num) => (
                  <tr
                    key={num.id}
                    className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--muted)]/30 transition-colors"
                  >
                    <td className="py-3.5 px-4 font-mono text-sm font-medium text-[var(--foreground)]">
                      +{num.displayPhone}
                    </td>
                    <td className="py-3.5 px-4 text-sm text-[var(--foreground)]">
                      {num.verifiedName || '—'}
                    </td>
                    <td className="py-3.5 px-4">
                      <QualityBadge quality={num.qualityRating} />
                    </td>
                    <td className="py-3.5 px-4 min-w-[260px]">
                      <NumberAssignment
                        number={num}
                        groups={groupList}
                        assignableUsers={assignableUsers}
                        onAssignGroup={(groupId) =>
                          assignGroupMutation.mutate({ numberId: num.id, groupId })
                        }
                        onAssignUser={(userId) =>
                          assignUserMutation.mutate({ numberId: num.id, userId })
                        }
                        disabled={assignGroupMutation.isPending || assignUserMutation.isPending}
                      />
                    </td>
                    <td className="py-3.5 px-4">
                      <StatusBadge active={num.isActive} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Number assignment cell — supports both single user & group
// ─────────────────────────────────────────────────────────────

function NumberAssignment({
  number,
  groups,
  assignableUsers,
  onAssignGroup,
  onAssignUser,
  disabled,
}: {
  number: WaNumber;
  groups: WaAgentGroup[];
  assignableUsers: OrgMember[];
  onAssignGroup: (groupId: number | null) => void;
  onAssignUser: (userId: number | null) => void;
  disabled?: boolean;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const sortedGroups = useMemo(
    () => [...groups].sort((a, b) => a.name.localeCompare(b.name)),
    [groups]
  );
  const sortedUsers = useMemo(
    () =>
      [...assignableUsers].sort((a, b) =>
        (a.fullName || a.email).localeCompare(b.fullName || b.email)
      ),
    [assignableUsers]
  );
  const currentGroup = useMemo(
    () => groups.find((g) => g.id === number.groupId) ?? null,
    [groups, number.groupId]
  );
  const currentUser = useMemo(
    () =>
      !number.groupId && number.assignedUserId
        ? (assignableUsers.find((u) => u.id === number.assignedUserId) ?? null)
        : null,
    [assignableUsers, number.groupId, number.assignedUserId]
  );

  const isUnassigned = !currentGroup && !currentUser;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setMenuOpen((v) => !v)}
        disabled={disabled}
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--card)] text-sm text-[var(--foreground)] hover:border-[var(--border)]/50 disabled:opacity-50 transition-colors min-w-[200px] justify-between"
      >
        <span className="flex items-center gap-2 min-w-0 truncate">
          {currentGroup ? (
            <>
              <FiUsers className="w-4 h-4 text-[var(--foreground)] flex-shrink-0" />
              <span className="truncate">{currentGroup.name}</span>
              <span className="text-xs text-[var(--muted-foreground)] flex-shrink-0">
                · {currentGroup.memberCount}
              </span>
            </>
          ) : currentUser ? (
            <>
              <span className="w-5 h-5 rounded-full bg-[var(--primary-600)]/15 text-[var(--foreground)] flex items-center justify-center text-xs font-medium flex-shrink-0">
                {(currentUser.fullName || currentUser.email)[0].toUpperCase()}
              </span>
              <span className="truncate">{currentUser.fullName || currentUser.email}</span>
            </>
          ) : (
            <span className="text-[var(--muted-foreground)]">Unassigned</span>
          )}
        </span>
        <FiChevronDown className="w-4 h-4 text-[var(--muted-foreground)] flex-shrink-0" />
      </button>

      {menuOpen && (
        <PortalDropdown anchorRef={triggerRef} onClose={() => setMenuOpen(false)} width={288}>
          <ul className="overflow-y-auto flex-1 py-1">
            {/* Unassigned option */}
            <li>
              <button
                type="button"
                onClick={() => {
                  onAssignUser(null);
                  setMenuOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3 py-2 text-sm text-left hover:bg-[var(--muted)] transition-colors ${
                  isUnassigned ? 'text-[var(--foreground)]' : 'text-[var(--muted-foreground)]'
                }`}
              >
                <span>Unassigned</span>
                {isUnassigned && <FiCheck className="w-4 h-4 text-[var(--foreground)]" />}
              </button>
            </li>

            {/* Single user section */}
            {sortedUsers.length > 0 && (
              <li className="px-3 pt-2 pb-1 text-xs uppercase tracking-wide text-[var(--muted-foreground)]">
                Agents
              </li>
            )}
            {sortedUsers.map((u) => {
              const isActive = !number.groupId && number.assignedUserId === u.id;
              return (
                <li key={`user-${u.id}`}>
                  <button
                    type="button"
                    onClick={() => {
                      onAssignUser(u.id);
                      setMenuOpen(false);
                    }}
                    className="w-full flex items-center justify-between gap-2 px-3 py-2 text-sm text-left hover:bg-[var(--muted)] transition-colors"
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      <span className="w-5 h-5 rounded-full bg-[var(--muted)] flex items-center justify-center text-xs font-medium flex-shrink-0 text-[var(--muted-foreground)]">
                        {(u.fullName || u.email)[0].toUpperCase()}
                      </span>
                      <span className="truncate text-[var(--foreground)]">
                        {u.fullName || u.email}
                      </span>
                    </span>
                    {isActive && (
                      <FiCheck className="w-4 h-4 text-[var(--foreground)] flex-shrink-0" />
                    )}
                  </button>
                </li>
              );
            })}

            {/* Groups section */}
            {sortedGroups.length > 0 && (
              <li className="px-3 pt-2 pb-1 text-xs uppercase tracking-wide text-[var(--muted-foreground)]">
                Groups
              </li>
            )}
            {sortedGroups.map((g) => {
              const isActive = g.id === number.groupId;
              return (
                <li key={`group-${g.id}`}>
                  <button
                    type="button"
                    onClick={() => {
                      onAssignGroup(g.id);
                      setMenuOpen(false);
                    }}
                    className="w-full flex items-center justify-between gap-2 px-3 py-2 text-sm text-left hover:bg-[var(--muted)] transition-colors"
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      <FiUsers className="w-4 h-4 text-[var(--muted-foreground)] flex-shrink-0" />
                      <span className="truncate text-[var(--foreground)]">{g.name}</span>
                      <span className="text-xs text-[var(--muted-foreground)] flex-shrink-0">
                        {g.memberCount} agent{g.memberCount === 1 ? '' : 's'}
                      </span>
                    </span>
                    {isActive && (
                      <FiCheck className="w-4 h-4 text-[var(--foreground)] flex-shrink-0" />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="border-t border-[var(--border)]">
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                setCreateOpen(true);
              }}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-[var(--foreground)] hover:bg-[var(--primary-600)]/5 transition-colors font-medium"
            >
              <FiPlus className="w-4 h-4" />
              Create new group...
            </button>
          </div>
        </PortalDropdown>
      )}

      {createOpen && (
        <InlineCreateGroupModal
          assignableUsers={assignableUsers}
          onClose={() => setCreateOpen(false)}
          onCreated={(newGroupId) => {
            onAssignGroup(newGroupId);
            setCreateOpen(false);
          }}
          defaultName={number.verifiedName ? `${number.verifiedName} team` : ''}
        />
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// PortalDropdown — viewport-positioned dropdown, escapes any
// overflow-clipping ancestor (Card, table, etc.). Positions itself
// against the trigger's bounding rect, flips up when there's no room
// below, and re-positions on scroll/resize so the menu tracks the
// trigger if the page moves.
// ─────────────────────────────────────────────────────────────

function PortalDropdown({
  anchorRef,
  onClose,
  width,
  children,
}: {
  anchorRef: React.RefObject<HTMLElement | null>;
  onClose: () => void;
  width: number;
  children: React.ReactNode;
}) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{
    top: number;
    left: number;
    placement: 'down' | 'up';
  } | null>(null);

  // Position once on open, then track scroll/resize.
  useLayoutEffect(() => {
    const place = () => {
      const trigger = anchorRef.current;
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      const MAX_HEIGHT = 320;
      const SAFETY = 8;
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      const flipUp = spaceBelow < MAX_HEIGHT + SAFETY && spaceAbove > spaceBelow;

      // Clamp horizontal so the menu never spills past the viewport.
      let left = rect.left;
      const maxLeft = window.innerWidth - width - SAFETY;
      if (left > maxLeft) left = Math.max(SAFETY, maxLeft);

      setPosition({
        top: flipUp ? rect.top - SAFETY : rect.bottom + SAFETY,
        left,
        placement: flipUp ? 'up' : 'down',
      });
    };
    place();

    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    return () => {
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
    };
  }, [anchorRef, width]);

  // Click-outside + Esc.
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (
        menuRef.current &&
        !menuRef.current.contains(t) &&
        anchorRef.current &&
        !anchorRef.current.contains(t)
      ) {
        onClose();
      }
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onEsc);
    };
  }, [anchorRef, onClose]);

  if (typeof window === 'undefined' || !position) return null;

  const style: React.CSSProperties = {
    position: 'fixed',
    width,
    maxHeight: 320,
    zIndex: 60,
    left: position.left,
    ...(position.placement === 'up'
      ? { bottom: window.innerHeight - position.top }
      : { top: position.top }),
  };

  return createPortal(
    <div
      ref={menuRef}
      style={style}
      className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-2xl flex flex-col"
    >
      {children}
    </div>,
    document.body
  );
}

// ─────────────────────────────────────────────────────────────
// Inline create-group modal
// ─────────────────────────────────────────────────────────────

function InlineCreateGroupModal({
  assignableUsers,
  defaultName,
  onClose,
  onCreated,
}: {
  assignableUsers: OrgMember[];
  defaultName: string;
  onClose: () => void;
  onCreated: (groupId: number) => void;
}) {
  const [name, setName] = useState(defaultName);
  const [memberIds, setMemberIds] = useState<number[]>([]);
  const create = useCreateMyWaGroup();

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    try {
      const created = await create.mutateAsync({
        name: trimmed,
        memberUserIds: memberIds,
      });
      onCreated(created.id);
    } catch {
      // Surface error inline below.
    }
  };

  const toggleMember = (userId: number) => {
    setMemberIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-md rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-2xl p-6 space-y-5">
        <div>
          <h2 className="text-lg font-semibold text-[var(--foreground)]">Create a new group</h2>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">
            Pick the agents who should share this WhatsApp number. Conversations stay sticky to
            whichever agent starts them.
          </p>
        </div>

        {create.isError && (
          <Banner
            variant="error"
            message={(create.error as Error).message || 'Could not create the group.'}
          />
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-[var(--foreground)]">Group name</label>
            <input
              type="text"
              autoFocus
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
              Members{' '}
              <span className="text-[var(--muted-foreground)] font-normal">
                ({memberIds.length} selected)
              </span>
            </label>
            {assignableUsers.length === 0 ? (
              <div className="rounded-lg border border-dashed border-[var(--border)] px-3 py-4 text-sm text-[var(--muted-foreground)] text-center">
                No agents in your org yet. Create the group first, then add members later.
              </div>
            ) : (
              <div className="rounded-lg border border-[var(--border)] max-h-56 overflow-y-auto">
                {assignableUsers.map((u) => {
                  const checked = memberIds.includes(u.id);
                  return (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => toggleMember(u.id)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-[var(--muted)] transition-colors border-b border-[var(--border)] last:border-0"
                    >
                      <span
                        className={`flex-shrink-0 w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                          checked
                            ? 'bg-[var(--primary-600)] border-[var(--border)] text-white'
                            : 'border-[var(--border)]'
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
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-[var(--border)]">
            <Button type="button" variant="outline" onClick={onClose} disabled={create.isPending}>
              Cancel
            </Button>
            <Button
              type="submit"
              loading={create.isPending}
              disabled={create.isPending || !name.trim()}
            >
              Create &amp; assign
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Empty states
// ─────────────────────────────────────────────────────────────

function NotConnectedEmptyState({ onConnect }: { onConnect: () => void }) {
  return (
    <Card>
      <CardContent className="text-center py-16 space-y-4">
        <div className="w-14 h-14 rounded-full bg-[var(--muted)] flex items-center justify-center mx-auto">
          <FiSettings className="w-7 h-7 text-[var(--muted-foreground)]" />
        </div>
        <div>
          <h3 className="font-semibold text-[var(--foreground)]">WhatsApp not connected</h3>
          <p className="text-sm text-[var(--muted-foreground)] mt-1 max-w-md mx-auto">
            Connect your Meta account in Settings. We&apos;ll auto-discover every number under your
            WABA.
          </p>
        </div>
        <Button onClick={onConnect}>Open Settings</Button>
      </CardContent>
    </Card>
  );
}

function NoNumbersEmptyState({ onSync }: { onSync: () => void }) {
  return (
    <Card>
      <CardContent className="text-center py-12 space-y-3">
        <div className="w-12 h-12 rounded-full bg-[var(--muted)] flex items-center justify-center mx-auto">
          <FiRefreshCw className="w-6 h-6 text-[var(--muted-foreground)]" />
        </div>
        <p className="text-sm text-[var(--muted-foreground)] max-w-sm mx-auto">
          No numbers found under your WABA yet. Add a phone number in Meta Business Manager, then
          sync to pull it in.
        </p>
        <Button variant="outline" size="sm" onClick={onSync}>
          <FiRefreshCw className="w-4 h-4" /> Sync from Meta
        </Button>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────
// Misc UI bits
// ─────────────────────────────────────────────────────────────

function Banner({ variant, message }: { variant: 'success' | 'error'; message: string }) {
  const isError = variant === 'error';
  return (
    <div
      className={`rounded-lg border p-3 flex items-start gap-2 ${
        isError
          ? 'border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/20'
          : 'border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/20'
      }`}
    >
      {isError ? (
        <FiAlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
      ) : (
        <FiCheck className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
      )}
      <p
        className={`text-sm ${
          isError ? 'text-red-800 dark:text-red-300' : 'text-green-800 dark:text-green-300'
        }`}
      >
        {message}
      </p>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
      {children}
    </th>
  );
}

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full ${
        active
          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
          : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
      }`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-green-500' : 'bg-gray-400'}`}
        aria-hidden
      />
      {active ? 'Active' : 'Inactive'}
    </span>
  );
}

function QualityBadge({ quality }: { quality: string | null }) {
  if (!quality) {
    return <span className="text-xs text-[var(--muted-foreground)]">—</span>;
  }
  const color =
    quality === 'GREEN'
      ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
      : quality === 'YELLOW'
        ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
        : quality === 'RED'
          ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
          : 'bg-gray-100 text-gray-700 dark:bg-gray-900/40 dark:text-gray-300';
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${color}`}
    >
      {quality}
    </span>
  );
}

function NumbersSkeleton() {
  return (
    <Card>
      <CardContent className="space-y-3 pt-6 pb-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 py-2">
            <div className="h-4 w-32 bg-[var(--muted)] rounded animate-pulse" />
            <div className="h-4 w-32 bg-[var(--muted)] rounded animate-pulse" />
            <div className="h-4 w-16 bg-[var(--muted)] rounded animate-pulse" />
            <div className="h-7 w-48 bg-[var(--muted)] rounded animate-pulse" />
            <div className="h-5 w-16 bg-[var(--muted)] rounded-full animate-pulse" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
