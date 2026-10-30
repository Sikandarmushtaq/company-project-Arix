'use client';

import React, { useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  FiArrowLeft,
  FiTrash2,
  FiUsers,
  FiPhone,
  FiMessageSquare,
  FiCheck,
  FiX,
  FiLoader,
  FiAlertCircle,
  FiPlus,
  FiUserMinus,
} from 'react-icons/fi';
import { Card, CardContent, CardHeader, CardTitle, Button, StyledSelect } from '@/components/ui';
import { ConfirmModal, Modal } from '@/components/ui/Modal';
import {
  useOrganization,
  useOrganizationStats,
  useOrganizationUsers,
  useDeleteOrganization,
  useUnassignedUsers,
  useAssignUserToOrganization,
  useRemoveUserFromOrganization,
} from '@/lib/hooks';
import { formatLocalDate } from '@/lib/utils/datetime';
import type { AdminUser } from '@/lib/api/services';
import { WaFeaturesCard } from './WaFeaturesCard';
import { WaBillingCard } from './WaBillingCard';
import { VerificationCard } from './VerificationCard';
import { SmsPackageCard } from './SmsPackageCard';
import { CallSoftCapCard } from './CallSoftCapCard';

/**
 * Stats Card Component
 */
function StatCard({
  title,
  value,
  icon: Icon,
  color,
}: {
  title: string;
  value: number | string;
  icon: React.ElementType;
  color: string;
}) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-[var(--muted-foreground)]">{title}</p>
            <p className="text-2xl font-bold text-[var(--foreground)]">{value}</p>
          </div>
          <div className={`p-3 rounded-full ${color}`}>
            <Icon className="w-6 h-6" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * User Row Component
 */
function UserRow({
  user,
  onRemove,
  isRemoving,
}: {
  user: AdminUser;
  onRemove: (user: AdminUser) => void;
  isRemoving: boolean;
}) {
  return (
    <tr className="border-b border-[var(--border)] hover:bg-[var(--muted)] transition-colors">
      <td className="py-3 px-4 font-medium text-[var(--foreground)]">
        {user.fullName || user.email}
      </td>
      <td className="py-3 px-4 text-[var(--muted-foreground)]">{user.email}</td>
      <td className="py-3 px-4">
        <span
          className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
            user.role === 'admin'
              ? 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300'
              : user.role === 'manager'
                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                : 'bg-gray-100 text-gray-700 dark:bg-gray-900 dark:text-gray-300'
          }`}
        >
          {user.role}
        </span>
      </td>
      <td className="py-3 px-4 text-[var(--muted-foreground)] font-mono">{user.extension}</td>
      <td className="py-3 px-4">
        <span
          className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full ${
            user.isActive
              ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
              : 'bg-gray-100 text-gray-700 dark:bg-gray-900 dark:text-gray-300'
          }`}
        >
          {user.isActive ? <FiCheck className="w-3 h-3" /> : <FiX className="w-3 h-3" />}
          {user.isActive ? 'Active' : 'Inactive'}
        </span>
      </td>
      <td className="py-3 px-4 text-right">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => onRemove(user)}
          disabled={isRemoving}
          aria-label={`Remove ${user.fullName || user.email} from organization`}
        >
          <FiUserMinus className="w-4 h-4 text-[var(--danger)]" />
        </Button>
      </td>
    </tr>
  );
}

/**
 * Assign User Modal
 */
function AssignUserModal({
  isOpen,
  onClose,
  organizationId,
  onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  organizationId: number;
  onSuccess: () => void;
}) {
  const { data: unassignedUsers, isLoading } = useUnassignedUsers();
  const assignMutation = useAssignUserToOrganization();
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);

  const handleAssign = async () => {
    if (!selectedUserId) return;
    try {
      await assignMutation.mutateAsync({
        userId: selectedUserId,
        organizationId,
      });
      onSuccess();
      onClose();
      setSelectedUserId(null);
    } catch (error) {
      console.error('Failed to assign user:', error);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Assign User to Organization">
      <div className="space-y-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <FiLoader className="w-6 h-6 animate-spin text-[var(--primary)]" />
          </div>
        ) : !unassignedUsers || unassignedUsers.length === 0 ? (
          <div className="text-center py-8 text-[var(--muted-foreground)]">
            No unassigned users available. All users are already assigned to organizations.
          </div>
        ) : (
          <>
            <div>
              <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
                Select User
              </label>
              <StyledSelect
                value={String(selectedUserId || '')}
                onChange={(v) => setSelectedUserId(parseInt(v) || null)}
                className="bg-[var(--background)]"
              >
                <option value="">Select a user...</option>
                {unassignedUsers.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.fullName || user.email} ({user.email})
                  </option>
                ))}
              </StyledSelect>
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t border-[var(--border)]">
              <Button variant="outline" onClick={onClose} disabled={assignMutation.isPending}>
                Cancel
              </Button>
              <Button onClick={handleAssign} disabled={!selectedUserId || assignMutation.isPending}>
                {assignMutation.isPending ? (
                  <>
                    <FiLoader className="w-4 h-4 animate-spin" />
                    Assigning...
                  </>
                ) : (
                  'Assign User'
                )}
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

export default function OrganizationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const orgId = parseInt(params.id as string, 10);

  const {
    data: organization,
    isLoading: orgLoading,
    error: orgError,
    refetch: refetchOrg,
  } = useOrganization(orgId);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- reserved for future loading states
  const { data: stats, isLoading: statsLoading } = useOrganizationStats(orgId);
  const {
    data: usersData,
    isLoading: usersLoading,
    refetch: refetchUsers,
  } = useOrganizationUsers(orgId);

  const deleteMutation = useDeleteOrganization();
  const removeMutation = useRemoveUserFromOrganization();

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [removeUser, setRemoveUser] = useState<AdminUser | null>(null);

  const handleDelete = useCallback(async () => {
    try {
      await deleteMutation.mutateAsync(orgId);
      router.push('/admin/organizations');
    } catch (error) {
      console.error('Failed to delete organization:', error);
    }
  }, [orgId, deleteMutation, router]);

  const handleRemoveUser = useCallback(async () => {
    if (!removeUser) return;
    try {
      await removeMutation.mutateAsync(removeUser.id);
      setRemoveUser(null);
      refetchUsers();
      refetchOrg();
    } catch (error) {
      console.error('Failed to remove user:', error);
    }
  }, [removeUser, removeMutation, refetchUsers, refetchOrg]);

  const handleAssignSuccess = useCallback(() => {
    refetchUsers();
    refetchOrg();
  }, [refetchUsers, refetchOrg]);

  if (orgError) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <FiAlertCircle className="w-12 h-12 text-[var(--danger)] mx-auto mb-4" />
          <p className="text-[var(--danger)]">Failed to load organization</p>
          <p className="text-sm text-[var(--muted-foreground)] mt-2">
            {orgError instanceof Error ? orgError.message : 'Unknown error'}
          </p>
          <Link href="/admin/organizations">
            <Button className="mt-4">Back to Organizations</Button>
          </Link>
        </div>
      </div>
    );
  }

  if (orgLoading || !organization) {
    return (
      <div className="flex items-center justify-center h-64">
        <FiLoader className="w-8 h-8 animate-spin text-[var(--primary)]" />
      </div>
    );
  }

  const users = usersData?.users ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/admin/organizations">
            <Button variant="ghost" size="icon">
              <FiArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-[var(--foreground)]">{organization.name}</h1>
            <p className="text-[var(--muted-foreground)]">
              <span className="font-mono text-sm">{organization.slug}</span>
              {' - '}
              <span
                className={`inline-flex items-center gap-1 text-sm ${
                  organization.isActive ? 'text-green-600' : 'text-gray-500'
                }`}
              >
                {organization.isActive ? (
                  <>
                    <FiCheck className="w-4 h-4" /> Active
                  </>
                ) : (
                  <>
                    <FiX className="w-4 h-4" /> Inactive
                  </>
                )}
              </span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setDeleteConfirmOpen(true)}>
            <FiTrash2 className="w-4 h-4 text-[var(--danger)]" />
            Delete
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard
          title="Total Users"
          value={stats?.totalUsers ?? organization.userCount ?? 0}
          icon={FiUsers}
          color="bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300"
        />
        <StatCard
          title="Active Users"
          value={stats?.activeUsers ?? 0}
          icon={FiCheck}
          color="bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-300"
        />
        <StatCard
          title="Total Calls"
          value={stats?.totalCalls ?? 0}
          icon={FiPhone}
          color="bg-purple-100 text-purple-600 dark:bg-purple-900 dark:text-purple-300"
        />
        <StatCard
          title="Total SMS"
          value={stats?.totalSms ?? 0}
          icon={FiMessageSquare}
          color="bg-orange-100 text-orange-600 dark:bg-orange-900 dark:text-orange-300"
        />
      </div>

      {/* Organization Details */}
      <Card>
        <CardHeader>
          <CardTitle>Organization Details</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <dt className="text-sm text-[var(--muted-foreground)]">Max Users</dt>
              <dd className="text-[var(--foreground)] font-medium">{organization.maxUsers}</dd>
            </div>
            <div>
              <dt className="text-sm text-[var(--muted-foreground)]">Max Phone Numbers</dt>
              <dd className="text-[var(--foreground)] font-medium">
                {organization.maxPhoneNumbers}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-[var(--muted-foreground)]">Created</dt>
              <dd className="text-[var(--foreground)] font-medium">
                {formatLocalDate(organization.createdAt)}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-[var(--muted-foreground)]">Last Updated</dt>
              <dd className="text-[var(--foreground)] font-medium">
                {formatLocalDate(organization.updatedAt)}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      {/* WhatsApp billing plan: postpaid (unlimited) ↔ prepaid (metered wallet) */}
      <WaBillingCard orgId={orgId} />

      {/* WhatsApp manager-oversight feature toggles */}
      <WaFeaturesCard orgId={orgId} />

      {/* KYC / 10DLC verification — approve directly, even without a submission */}
      <VerificationCard orgId={orgId} />

      {/* Hidden fair-use call-minute ceiling for the "unlimited" tier */}
      <CallSoftCapCard orgId={orgId} />

      {/* SMS package — assign / remove an org-wide SMS allowance directly */}
      <SmsPackageCard orgId={orgId} />

      {/* Users Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>
              Organization Users
              <span className="text-sm font-normal text-[var(--muted-foreground)] ml-2">
                ({users.length} / {organization.maxUsers})
              </span>
            </CardTitle>
            <Button onClick={() => setAssignModalOpen(true)}>
              <FiPlus className="w-4 h-4" />
              Assign User
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {usersLoading ? (
            <div className="flex items-center justify-center py-8">
              <FiLoader className="w-6 h-6 animate-spin text-[var(--primary)]" />
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-8 text-[var(--muted-foreground)]">
              No users assigned to this organization yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[var(--border)]">
                    <th className="text-left py-3 px-4 font-medium text-[var(--muted-foreground)]">
                      Username
                    </th>
                    <th className="text-left py-3 px-4 font-medium text-[var(--muted-foreground)]">
                      Email
                    </th>
                    <th className="text-left py-3 px-4 font-medium text-[var(--muted-foreground)]">
                      Role
                    </th>
                    <th className="text-left py-3 px-4 font-medium text-[var(--muted-foreground)]">
                      Extension
                    </th>
                    <th className="text-left py-3 px-4 font-medium text-[var(--muted-foreground)]">
                      Status
                    </th>
                    <th className="text-right py-3 px-4 font-medium text-[var(--muted-foreground)]">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <UserRow
                      key={user.id}
                      user={user}
                      onRemove={setRemoveUser}
                      isRemoving={removeMutation.isPending}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Assign User Modal */}
      <AssignUserModal
        isOpen={assignModalOpen}
        onClose={() => setAssignModalOpen(false)}
        organizationId={orgId}
        onSuccess={handleAssignSuccess}
      />

      {/* Remove User Confirmation */}
      <ConfirmModal
        isOpen={removeUser !== null}
        onClose={() => setRemoveUser(null)}
        onConfirm={handleRemoveUser}
        title="Remove User from Organization"
        message={`Are you sure you want to remove "${removeUser?.fullName || removeUser?.email}" from this organization?`}
        confirmText="Remove"
        cancelText="Cancel"
        variant="danger"
        loading={removeMutation.isPending}
      />

      {/* Delete Organization Confirmation */}
      <ConfirmModal
        isOpen={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        onConfirm={handleDelete}
        title="Delete Organization"
        message={`Are you sure you want to delete "${organization.name}"? This will remove all users from this organization. This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
        loading={deleteMutation.isPending}
      />
    </div>
  );
}
