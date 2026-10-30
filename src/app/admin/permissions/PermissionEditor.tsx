'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  FiEdit2,
  FiCheck,
  FiX,
  FiLoader,
  FiLock,
  FiEye,
  FiUsers,
  FiSettings,
  FiShield,
  FiFileText,
  FiChevronDown,
  FiChevronUp,
  FiClock,
  FiPlus,
  FiMinus,
} from 'react-icons/fi';
import { Button } from '@/components/ui';
import { Modal } from '@/components/ui/Modal';
import { formatLocalDate, formatLocalTime } from '@/lib/utils/datetime';
import {
  permissionsService,
  type Permission,
  type UserWithPermissions,
  type UserPermissionsResponse,
  type PermissionHistoryEntry,
} from '@/lib/api/services';

// ============================================================================
// Constants
// ============================================================================

const categoryIcons: Record<string, React.ReactNode> = {
  viewing: <FiEye className="w-4 h-4" />,
  managing: <FiUsers className="w-4 h-4" />,
  system: <FiSettings className="w-4 h-4" />,
  security: <FiShield className="w-4 h-4" />,
  reporting: <FiFileText className="w-4 h-4" />,
};

const categoryColors: Record<string, string> = {
  viewing: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  managing: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  system: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300',
  security: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
  reporting: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300',
};

// ============================================================================
// PermissionToggle
// ============================================================================

function PermissionToggle({
  permission,
  isGranted,
  isRoleDefault,
  isOverride,
  hasChange,
  onToggle,
  disabled,
}: {
  permission: Permission;
  isGranted: boolean;
  isRoleDefault: boolean;
  isOverride: boolean;
  hasChange: boolean;
  onToggle: (code: string, grant: boolean) => void;
  disabled: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between p-3 rounded-lg border transition-all ${
        hasChange
          ? 'border-blue-400 bg-blue-50 dark:border-blue-600 dark:bg-blue-900/30 ring-1 ring-blue-400'
          : isOverride
            ? 'border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-900/20'
            : 'border-[var(--border)] bg-[var(--card)]'
      }`}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <code className="text-xs font-mono text-[var(--muted-foreground)]">
            {permission.code}
          </code>
          {hasChange && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-blue-200 text-blue-800 dark:bg-blue-800 dark:text-blue-200 font-medium">
              Changed
            </span>
          )}
          {isOverride && !hasChange && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-amber-200 text-amber-800 dark:bg-amber-800 dark:text-amber-200">
              Override
            </span>
          )}
          {isRoleDefault && !isOverride && !hasChange && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300">
              Role Default
            </span>
          )}
        </div>
        <p className="text-sm font-medium text-[var(--foreground)] mt-1">{permission.name}</p>
        {permission.description && (
          <p className="text-xs text-[var(--muted-foreground)] mt-0.5">{permission.description}</p>
        )}
      </div>
      <div className="ml-4">
        <button
          onClick={() => onToggle(permission.code, !isGranted)}
          disabled={disabled}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:ring-offset-2 ${
            isGranted ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
          aria-label={`${isGranted ? 'Revoke' : 'Grant'} ${permission.name}`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              isGranted ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// HistoryItem
// ============================================================================

function HistoryItem({ entry }: { entry: PermissionHistoryEntry }) {
  const timestamp = new Date(entry.timestamp);
  const details = entry.details || {};

  const getActionIcon = () => {
    if (entry.action === 'permission.granted') return <FiPlus className="w-4 h-4 text-green-500" />;
    if (entry.action === 'permission.revoked') return <FiMinus className="w-4 h-4 text-red-500" />;
    return <FiEdit2 className="w-4 h-4 text-blue-500" />;
  };

  return (
    <div className="flex gap-3 p-3 border-b border-[var(--border)] last:border-b-0 hover:bg-[var(--muted)] transition-colors">
      <div className="flex-shrink-0 mt-0.5">{getActionIcon()}</div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-[var(--foreground)]">{entry.actionLabel}</p>
        {entry.permissionCode && (
          <code className="text-xs font-mono text-[var(--muted-foreground)] bg-[var(--muted)] px-1.5 py-0.5 rounded">
            {entry.permissionCode}
          </code>
        )}
        {entry.permissionsChanged && (
          <span className="text-xs text-[var(--muted-foreground)]">
            {entry.permissionsChanged} permission{entry.permissionsChanged > 1 ? 's' : ''} changed
          </span>
        )}
        {Array.isArray(details.permissions) && details.permissions.length > 0 && (
          <div className="mt-2 space-y-1">
            {(details.permissions as Array<{ code: string; granted: boolean }>)
              .slice(0, 5)
              .map((p, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  {p.granted ? (
                    <FiCheck className="w-3 h-3 text-green-500" />
                  ) : (
                    <FiX className="w-3 h-3 text-red-500" />
                  )}
                  <code className="font-mono text-[var(--muted-foreground)]">{p.code}</code>
                </div>
              ))}
            {(details.permissions as Array<unknown>).length > 5 && (
              <p className="text-xs text-[var(--muted-foreground)]">
                +{(details.permissions as Array<unknown>).length - 5} more
              </p>
            )}
          </div>
        )}
        <div className="flex items-center gap-2 mt-2 text-xs text-[var(--muted-foreground)]">
          <span>by {entry.performedBy.name}</span>
          <span>&bull;</span>
          <span>{formatLocalDate(timestamp)}</span>
          <span>{formatLocalTime(timestamp)}</span>
          {entry.ipAddress && (
            <>
              <span>&bull;</span>
              <span>{entry.ipAddress}</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// ChangesDiffPanel
// ============================================================================

function ChangesDiffPanel({
  changes,
  userPermissions,
  allPermissions,
}: {
  changes: Map<string, boolean>;
  userPermissions: UserPermissionsResponse | null;
  allPermissions: Permission[];
}) {
  if (changes.size === 0) {
    return (
      <div className="p-4 text-center text-[var(--muted-foreground)]">
        <p>No changes made yet</p>
        <p className="text-xs mt-1">Toggle permissions to see changes here</p>
      </div>
    );
  }

  const permissionMap = new Map(allPermissions.map((p) => [p.code, p]));

  return (
    <div className="space-y-2">
      {Array.from(changes.entries()).map(([code, newValue]) => {
        const oldValue = userPermissions?.effectivePermissions[code] ?? false;
        const permission = permissionMap.get(code);
        const isGrant = newValue && !oldValue;
        const isRevoke = !newValue && oldValue;

        return (
          <div
            key={code}
            className={`p-3 rounded-lg border ${
              isGrant
                ? 'border-green-300 bg-green-50 dark:border-green-700 dark:bg-green-900/20'
                : isRevoke
                  ? 'border-red-300 bg-red-50 dark:border-red-700 dark:bg-red-900/20'
                  : 'border-blue-300 bg-blue-50 dark:border-blue-700 dark:bg-blue-900/20'
            }`}
          >
            <div className="flex items-center gap-2">
              {isGrant ? (
                <FiPlus className="w-4 h-4 text-green-600 dark:text-green-400" />
              ) : isRevoke ? (
                <FiMinus className="w-4 h-4 text-red-600 dark:text-red-400" />
              ) : (
                <FiEdit2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              )}
              <div className="flex-1">
                <p className="text-sm font-medium text-[var(--foreground)]">
                  {permission?.name || code}
                </p>
                <code className="text-xs font-mono text-[var(--muted-foreground)]">{code}</code>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span
                  className={`px-2 py-1 rounded ${
                    oldValue
                      ? 'bg-green-200 text-green-800 dark:bg-green-800 dark:text-green-200'
                      : 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
                  }`}
                >
                  {oldValue ? 'Granted' : 'Denied'}
                </span>
                <span className="text-[var(--muted-foreground)]">&rarr;</span>
                <span
                  className={`px-2 py-1 rounded ${
                    newValue
                      ? 'bg-green-200 text-green-800 dark:bg-green-800 dark:text-green-200'
                      : 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
                  }`}
                >
                  {newValue ? 'Granted' : 'Denied'}
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ============================================================================
// Types
// ============================================================================

export interface PermissionEditorProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserWithPermissions | null;
  allPermissions: Permission[];
  onSave: (userId: number, changes: Map<string, boolean>) => void;
  isSaving: boolean;
}

// ============================================================================
// Component
// ============================================================================

export function PermissionEditor({
  isOpen,
  onClose,
  user,
  allPermissions,
  onSave,
  isSaving,
}: PermissionEditorProps) {
  const [changes, setChanges] = useState<Map<string, boolean>>(new Map());
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(['viewing', 'managing'])
  );
  const [activeTab, setActiveTab] = useState<'permissions' | 'history' | 'changes'>('permissions');
  const [trackedUserId, setTrackedUserId] = useState<number | null>(null);

  // Fetch user permissions using React Query
  const { data: userPermissionsData, isLoading } = useQuery({
    queryKey: ['user-permissions-modal', user?.id],
    queryFn: () => permissionsService.getUserPermissions(user!.id),
    enabled: isOpen && !!user,
    staleTime: 0,
  });
  const userPermissions = userPermissionsData?.data ?? null;

  // Fetch history using React Query
  const { data: historyData, isLoading: historyLoading } = useQuery({
    queryKey: ['user-permission-history', user?.id],
    queryFn: () => permissionsService.getUserPermissionHistory(user!.id),
    enabled: isOpen && !!user && activeTab === 'history',
    staleTime: 30000,
  });
  const history = historyData?.data ?? [];

  // Reset changes when user changes
  if (user && user.id !== trackedUserId) {
    setTrackedUserId(user.id);
    setChanges(new Map());
    setActiveTab('permissions');
  }

  // Reset tracked user when modal closes
  if (!isOpen && trackedUserId !== null) {
    setTrackedUserId(null);
  }

  // Group permissions by category
  const permissionsByCategory = useMemo(() => {
    const grouped: Record<string, Permission[]> = {};
    allPermissions.forEach((p) => {
      if (!grouped[p.category]) {
        grouped[p.category] = [];
      }
      grouped[p.category].push(p);
    });
    return grouped;
  }, [allPermissions]);

  const toggleCategory = useCallback((category: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  }, []);

  const handleToggle = useCallback(
    (code: string, grant: boolean) => {
      setChanges((prev) => {
        const next = new Map(prev);
        const originalValue = userPermissions?.effectivePermissions[code] ?? false;
        if (grant === originalValue) {
          next.delete(code);
        } else {
          next.set(code, grant);
        }
        return next;
      });
    },
    [userPermissions]
  );

  const handleSave = useCallback(() => {
    if (user && changes.size > 0) {
      onSave(user.id, changes);
    }
  }, [user, changes, onSave]);

  const getEffectiveValue = (code: string): boolean => {
    if (changes.has(code)) {
      return changes.get(code)!;
    }
    return userPermissions?.effectivePermissions[code] ?? false;
  };

  const isRoleDefault = (code: string): boolean => {
    return userPermissions?.roleDefaults.includes(code) ?? false;
  };

  const isOverride = (code: string): boolean => {
    return userPermissions?.overrides.some((o) => o.permissionCode === code) ?? false;
  };

  if (!user) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Edit Permissions - ${user.fullName || user.email}`}
      size="xl"
    >
      {/* User info */}
      <div className="p-4 bg-[var(--muted)] rounded-lg mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[var(--primary)] flex items-center justify-center text-white font-medium">
            {user.fullName || user.email[0].toUpperCase()}
          </div>
          <div>
            <p className="font-medium text-[var(--foreground)]">{user.fullName || user.email}</p>
            <p className="text-sm text-[var(--muted-foreground)]">
              {user.email} &bull; Role: {user.role}
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[var(--border)] mb-4">
        <button
          onClick={() => setActiveTab('permissions')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'permissions'
              ? 'border-[var(--primary)] text-[var(--primary)]'
              : 'border-transparent text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
          }`}
        >
          <FiLock className="inline w-4 h-4 mr-2" />
          Permissions
        </button>
        <button
          onClick={() => setActiveTab('changes')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'changes'
              ? 'border-[var(--primary)] text-[var(--primary)]'
              : 'border-transparent text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
          }`}
        >
          <FiEdit2 className="inline w-4 h-4 mr-2" />
          Changes
          {changes.size > 0 && (
            <span className="ml-2 px-1.5 py-0.5 text-xs rounded-full bg-blue-500 text-white">
              {changes.size}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'history'
              ? 'border-[var(--primary)] text-[var(--primary)]'
              : 'border-transparent text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
          }`}
        >
          <FiClock className="inline w-4 h-4 mr-2" />
          Activity History
        </button>
      </div>

      {/* Tab content */}
      <div className="max-h-[50vh] overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <FiLoader className="w-8 h-8 animate-spin text-[var(--primary)]" />
          </div>
        ) : activeTab === 'permissions' ? (
          <div className="space-y-4">
            {Object.entries(permissionsByCategory).map(([category, permissions]) => (
              <div
                key={category}
                className="border border-[var(--border)] rounded-lg overflow-hidden"
              >
                <button
                  onClick={() => toggleCategory(category)}
                  className="w-full flex items-center justify-between p-4 bg-[var(--muted)] hover:bg-[var(--muted)]/80 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className={`p-1.5 rounded ${categoryColors[category]}`}>
                      {categoryIcons[category]}
                    </span>
                    <span className="font-medium text-[var(--foreground)] capitalize">
                      {category}
                    </span>
                    <span className="text-sm text-[var(--muted-foreground)]">
                      ({permissions.length} permissions)
                    </span>
                  </div>
                  {expandedCategories.has(category) ? (
                    <FiChevronUp className="w-5 h-5 text-[var(--muted-foreground)]" />
                  ) : (
                    <FiChevronDown className="w-5 h-5 text-[var(--muted-foreground)]" />
                  )}
                </button>

                {expandedCategories.has(category) && (
                  <div className="p-4 space-y-3">
                    {permissions.map((permission) => (
                      <PermissionToggle
                        key={permission.code}
                        permission={permission}
                        isGranted={getEffectiveValue(permission.code)}
                        isRoleDefault={isRoleDefault(permission.code)}
                        isOverride={isOverride(permission.code)}
                        hasChange={changes.has(permission.code)}
                        onToggle={handleToggle}
                        disabled={permission.isAdminOnly || isSaving}
                      />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : activeTab === 'changes' ? (
          <ChangesDiffPanel
            changes={changes}
            userPermissions={userPermissions}
            allPermissions={allPermissions}
          />
        ) : activeTab === 'history' ? (
          historyLoading ? (
            <div className="flex items-center justify-center py-12">
              <FiLoader className="w-8 h-8 animate-spin text-[var(--primary)]" />
            </div>
          ) : history.length === 0 ? (
            <div className="p-8 text-center text-[var(--muted-foreground)]">
              <FiClock className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No permission changes recorded</p>
              <p className="text-xs mt-1">
                Changes will appear here after permissions are modified
              </p>
            </div>
          ) : (
            <div className="border border-[var(--border)] rounded-lg overflow-hidden">
              {history.map((entry) => (
                <HistoryItem key={entry.id} entry={entry} />
              ))}
            </div>
          )
        ) : null}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between mt-6 pt-4 border-t border-[var(--border)]">
        <p className="text-sm text-[var(--muted-foreground)]">
          {changes.size > 0 ? (
            <span className="text-blue-600 dark:text-blue-400 font-medium">
              {changes.size} change{changes.size > 1 ? 's' : ''} pending
            </span>
          ) : (
            'No changes'
          )}
        </p>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={changes.size === 0 || isSaving}>
            {isSaving ? (
              <>
                <FiLoader className="w-4 h-4 animate-spin mr-2" />
                Saving...
              </>
            ) : (
              'Save Changes'
            )}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
