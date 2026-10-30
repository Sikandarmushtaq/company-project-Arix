'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  FiSearch,
  FiPlus,
  FiEdit2,
  FiTrash2,
  FiMoreVertical,
  FiCheck,
  FiX,
  FiXCircle,
  FiRotateCcw,
  FiAlertCircle,
  FiLoader,
  FiRefreshCw,
  FiUsers,
  FiPhone,
  FiEye,
} from 'react-icons/fi';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Button,
  Input,
  Pagination,
} from '@/components/ui';
import { ConfirmModal, Modal } from '@/components/ui/Modal';
import {
  useOrganizations,
  useCreateOrganization,
  useUpdateOrganization,
  useDeleteOrganization,
  useReactivateOrganization,
  usePurgeOrganization,
} from '@/lib/hooks';
import { usePagination } from '@/lib/hooks/usePagination';
import { formatLocalDate } from '@/lib/utils/datetime';
import { useSocketEvent } from '@/lib/providers/SocketProvider';
import { REALTIME_EVENTS } from '@/lib/constants/events';
import type {
  Organization,
  CreateOrganizationData,
  UpdateOrganizationData,
} from '@/lib/api/services';

/**
 * Organization row component
 */
/** Subscription-state badge for the admin org list (Stripe billing_status). */
function SubscriptionBadge({ status }: { status?: string }) {
  const s = status || 'active';
  const map: Record<string, { label: string; cls: string }> = {
    active: {
      label: 'Active',
      cls: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
    },
    canceling: {
      label: 'Canceling',
      cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300',
    },
    past_due: {
      label: 'Past due',
      cls: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300',
    },
    suspended: {
      label: 'Suspended',
      cls: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
    },
  };
  const v = map[s] ?? {
    label: s,
    cls: 'bg-gray-100 text-gray-700 dark:bg-gray-900 dark:text-gray-300',
  };
  return (
    <span
      className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full ${v.cls}`}
      title={`Subscription: ${v.label}`}
    >
      {v.label}
    </span>
  );
}

const OrganizationRow = React.memo(function OrganizationRow({
  org,
  onEdit,
  onDelete,
  onReactivate,
  onPurge,
  isDeletePending,
}: {
  org: Organization;
  onEdit: (org: Organization) => void;
  onDelete: (org: Organization) => void;
  onReactivate: (org: Organization) => void;
  onPurge: (org: Organization) => void;
  isDeletePending: boolean;
}) {
  const [showMenu, setShowMenu] = useState(false);

  return (
    <tr className="border-b border-[var(--border)] hover:bg-[var(--muted)] transition-colors">
      <td className="py-3 px-4 font-medium text-[var(--foreground)]">{org.name}</td>
      <td className="py-3 px-4 text-[var(--muted-foreground)] font-mono text-sm">{org.slug}</td>
      <td className="py-3 px-4">
        <span
          className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full ${
            org.isActive
              ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
              : 'bg-gray-100 text-gray-700 dark:bg-gray-900 dark:text-gray-300'
          }`}
        >
          {org.isActive ? <FiCheck className="w-3 h-3" /> : <FiX className="w-3 h-3" />}
          {org.isActive ? 'Active' : 'Closed'}
        </span>
      </td>
      <td className="py-3 px-4">
        <SubscriptionBadge status={org.billingStatus} />
      </td>
      <td className="py-3 px-4 text-[var(--muted-foreground)]">
        <div className="flex items-center gap-1">
          <FiUsers className="w-4 h-4" />
          <span>
            {org.userCount ?? 0} / {org.maxUsers}
          </span>
        </div>
      </td>
      <td className="py-3 px-4 text-[var(--muted-foreground)]">
        <div className="flex items-center gap-1">
          <FiPhone className="w-4 h-4" />
          <span className="tabular-nums">
            {org.numberCount ?? 0} / {org.maxPhoneNumbers}
          </span>
        </div>
      </td>
      <td className="py-3 px-4 text-[var(--muted-foreground)]">{formatLocalDate(org.createdAt)}</td>
      <td className="py-3 px-4 text-right">
        <div className="flex items-center justify-end gap-2">
          <Link href={`/admin/organizations/${org.id}`}>
            <Button variant="ghost" size="icon-sm" aria-label={`View ${org.name}`}>
              <FiEye className="w-4 h-4" />
            </Button>
          </Link>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Edit ${org.name}`}
            onClick={() => onEdit(org)}
          >
            <FiEdit2 className="w-4 h-4" />
          </Button>
          <div className="relative">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="More options"
              onClick={() => setShowMenu(!showMenu)}
            >
              <FiMoreVertical className="w-4 h-4" />
            </Button>
            {showMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
                <div className="absolute right-0 mt-1 w-52 rounded-lg border border-[var(--border)] bg-[var(--card)] shadow-lg z-50">
                  <div className="py-1">
                    {org.isActive ? (
                      <>
                        <button
                          className="w-full px-4 py-2 text-left text-sm text-[var(--foreground)] hover:bg-[var(--muted)] flex items-center gap-2"
                          onClick={() => {
                            setShowMenu(false);
                            onDelete(org);
                          }}
                          disabled={isDeletePending}
                        >
                          <FiXCircle className="w-4 h-4" />
                          Close organization
                        </button>
                        <button
                          className="w-full px-4 py-2 text-left text-sm text-[var(--danger)] hover:bg-[var(--muted)] flex items-center gap-2"
                          onClick={() => {
                            setShowMenu(false);
                            onPurge(org);
                          }}
                          disabled={isDeletePending}
                        >
                          <FiTrash2 className="w-4 h-4" />
                          Delete permanently
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          className="w-full px-4 py-2 text-left text-sm text-[var(--foreground)] hover:bg-[var(--muted)] flex items-center gap-2"
                          onClick={() => {
                            setShowMenu(false);
                            onReactivate(org);
                          }}
                          disabled={isDeletePending}
                        >
                          <FiRotateCcw className="w-4 h-4" />
                          Reactivate
                        </button>
                        <button
                          className="w-full px-4 py-2 text-left text-sm text-[var(--danger)] hover:bg-[var(--muted)] flex items-center gap-2"
                          onClick={() => {
                            setShowMenu(false);
                            onPurge(org);
                          }}
                          disabled={isDeletePending}
                        >
                          <FiTrash2 className="w-4 h-4" />
                          Delete permanently
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </td>
    </tr>
  );
});

/**
 * Create/Edit Organization Modal
 */
function OrganizationModal({
  isOpen,
  onClose,
  organization,
  onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  organization?: Organization | null;
  onSuccess: () => void;
}) {
  const isEdit = !!organization;
  const createMutation = useCreateOrganization();
  const updateMutation = useUpdateOrganization();

  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    maxUsers: 50,
    maxPhoneNumbers: 5,
    isActive: true,
  });

  // Track organization/modal state to reset form data (avoids setState in effect)
  const [trackedOrgId, setTrackedOrgId] = useState<number | null>(null);
  const [trackedIsOpen, setTrackedIsOpen] = useState(false);
  const currentOrgId = organization?.id ?? null;

  if (isOpen !== trackedIsOpen || currentOrgId !== trackedOrgId) {
    setTrackedIsOpen(isOpen);
    setTrackedOrgId(currentOrgId);
    if (organization) {
      setFormData({
        name: organization.name,
        slug: organization.slug,
        maxUsers: organization.maxUsers,
        maxPhoneNumbers: organization.maxPhoneNumbers,
        isActive: organization.isActive,
      });
    } else {
      setFormData({
        name: '',
        slug: '',
        maxUsers: 50,
        maxPhoneNumbers: 5,
        isActive: true,
      });
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (isEdit && organization) {
        await updateMutation.mutateAsync({
          id: organization.id,
          data: formData as UpdateOrganizationData,
        });
      } else {
        await createMutation.mutateAsync(formData as CreateOrganizationData);
      }
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Failed to save organization:', error);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? 'Edit Organization' : 'Create Organization'}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-[var(--foreground)] mb-1">
            Organization Name *
          </label>
          <Input
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="Enter organization name"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-[var(--foreground)] mb-1">
            Slug (URL-friendly identifier)
          </label>
          <Input
            value={formData.slug}
            onChange={(e) =>
              setFormData({
                ...formData,
                slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
              })
            }
            placeholder="organization-slug"
          />
          <p className="text-xs text-[var(--muted-foreground)] mt-1">
            Leave empty to auto-generate from name
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-[var(--foreground)] mb-1">
              Max Users
            </label>
            <Input
              type="number"
              value={formData.maxUsers}
              onChange={(e) =>
                setFormData({ ...formData, maxUsers: parseInt(e.target.value) || 50 })
              }
              min={1}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--foreground)] mb-1">
              Max Phone Numbers
            </label>
            <Input
              type="number"
              value={formData.maxPhoneNumbers}
              onChange={(e) =>
                setFormData({ ...formData, maxPhoneNumbers: parseInt(e.target.value) || 10 })
              }
              min={1}
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="isActive"
            checked={formData.isActive}
            onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
            className="w-4 h-4 rounded border-[var(--border)] text-[var(--foreground)]"
          />
          <label htmlFor="isActive" className="text-sm text-[var(--foreground)]">
            Active
          </label>
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t border-[var(--border)]">
          <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button type="submit" disabled={isPending}>
            {isPending ? (
              <>
                <FiLoader className="w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : isEdit ? (
              'Update Organization'
            ) : (
              'Create Organization'
            )}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export default function OrganizationsPage() {
  const pagination = usePagination({ initialPageSize: 20 });

  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editOrg, setEditOrg] = useState<Organization | null>(null);
  const [deleteOrg, setDeleteOrg] = useState<Organization | null>(null);
  const [purgeOrg, setPurgeOrg] = useState<Organization | null>(null);
  const [purgeConfirmText, setPurgeConfirmText] = useState('');
  const [releaseTelnyx, setReleaseTelnyx] = useState(false);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      pagination.goToPage(1);
    }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- pagination.goToPage is stable from usePagination hook
  }, [searchQuery]);

  const { data, isLoading, error, isFetching, refetch } = useOrganizations({
    page: pagination.page,
    limit: pagination.pageSize,
    search: debouncedSearch || undefined,
  });

  const deleteOrgMutation = useDeleteOrganization();
  const reactivateOrgMutation = useReactivateOrganization();
  const purgeOrgMutation = usePurgeOrganization();

  // Real-time: refresh the list the moment any org's subscription status changes
  // (owner cancel/resume, renewal paid/failed, period-end suspend). The WS push
  // is the live path; refetchOnMount (see useOrganizations) is the self-heal
  // fallback for a missed event while disconnected.
  useSocketEvent(REALTIME_EVENTS.ORG_BILLING_CHANGED, () => {
    refetch();
  });

  // Update pagination when data changes
  useEffect(() => {
    if (data?.meta) {
      pagination.setTotalItems(data.meta.total);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- pagination.setTotalItems is stable from usePagination hook
  }, [data?.meta]);

  const organizations = data?.organizations ?? [];

  const handleEdit = useCallback((org: Organization) => {
    setEditOrg(org);
  }, []);

  const handleDeleteClick = useCallback((org: Organization) => {
    setReleaseTelnyx(false); // default OFF — opt-in per delete
    setDeleteOrg(org);
  }, []);

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteOrg) return;
    try {
      await deleteOrgMutation.mutateAsync({
        id: deleteOrg.id,
        releaseTelnyxSubAccount: releaseTelnyx,
      });
      setDeleteOrg(null);
      setReleaseTelnyx(false);
    } catch (err) {
      console.error('Failed to close organization:', err);
    }
  }, [deleteOrg, deleteOrgMutation, releaseTelnyx]);

  const handleReactivate = useCallback(
    async (org: Organization) => {
      try {
        await reactivateOrgMutation.mutateAsync(org.id);
      } catch (err) {
        console.error('Failed to reactivate organization:', err);
      }
    },
    [reactivateOrgMutation]
  );

  const handlePurgeClick = useCallback((org: Organization) => {
    setReleaseTelnyx(true); // default ON for a permanent delete
    setPurgeConfirmText(''); // reset the type-to-confirm guard
    setPurgeOrg(org);
  }, []);

  const handlePurgeConfirm = useCallback(async () => {
    if (!purgeOrg) return;
    try {
      await purgeOrgMutation.mutateAsync({
        id: purgeOrg.id,
        releaseTelnyxSubAccount: releaseTelnyx,
      });
      setPurgeOrg(null);
      setReleaseTelnyx(false);
      setPurgeConfirmText('');
    } catch (err) {
      console.error('Failed to permanently delete organization:', err);
    }
  }, [purgeOrg, purgeOrgMutation, releaseTelnyx]);

  // Require typing the exact org name before permanently deleting a workspace that
  // still holds data (active, or has members) — a misclick guard for the wipe.
  const purgeNeedsTyping = !!purgeOrg && (purgeOrg.isActive || (purgeOrg.userCount ?? 0) > 0);
  const purgeNameConfirmed = purgeConfirmText.trim() === (purgeOrg?.name ?? '');

  const handleRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  const handleModalSuccess = useCallback(() => {
    refetch();
  }, [refetch]);

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <FiAlertCircle className="w-12 h-12 text-[var(--danger)] mx-auto mb-4" />
          <p className="text-[var(--danger)]">Failed to load organizations</p>
          <p className="text-sm text-[var(--muted-foreground)] mt-2">
            {error instanceof Error ? error.message : 'Unknown error'}
          </p>
          <Button onClick={handleRefresh} className="mt-4">
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">Organizations</h1>
          <p className="text-[var(--muted-foreground)] mt-1">
            Manage multi-tenant organizations and user assignments
          </p>
        </div>
        <Button onClick={() => setCreateModalOpen(true)}>
          <FiPlus className="w-4 h-4" />
          Create Organization
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <CardTitle>
              All Organizations
              {data?.meta && (
                <span className="text-sm font-normal text-[var(--muted-foreground)] ml-2">
                  ({data.meta.total})
                </span>
              )}
            </CardTitle>
            <div className="flex items-center gap-2">
              <div className="w-72">
                <Input
                  placeholder="Search organizations..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  leftIcon={<FiSearch className="w-4 h-4" />}
                />
              </div>
              <Button variant="outline" size="icon" onClick={handleRefresh} disabled={isFetching}>
                <FiRefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading && organizations.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <FiLoader className="w-8 h-8 animate-spin text-[var(--primary)]" />
            </div>
          ) : organizations.length === 0 ? (
            <div className="text-center py-12 text-[var(--muted-foreground)]">
              {searchQuery
                ? 'No organizations found matching your search'
                : 'No organizations found. Create one to get started.'}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[var(--border)]">
                      <th className="text-left py-3 px-4 font-medium text-[var(--muted-foreground)]">
                        Name
                      </th>
                      <th className="text-left py-3 px-4 font-medium text-[var(--muted-foreground)]">
                        Slug
                      </th>
                      <th className="text-left py-3 px-4 font-medium text-[var(--muted-foreground)]">
                        Status
                      </th>
                      <th className="text-left py-3 px-4 font-medium text-[var(--muted-foreground)]">
                        Subscription
                      </th>
                      <th className="text-left py-3 px-4 font-medium text-[var(--muted-foreground)]">
                        Users
                      </th>
                      <th className="text-left py-3 px-4 font-medium text-[var(--muted-foreground)]">
                        Numbers
                      </th>
                      <th className="text-left py-3 px-4 font-medium text-[var(--muted-foreground)]">
                        Created
                      </th>
                      <th className="text-right py-3 px-4 font-medium text-[var(--muted-foreground)]">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {organizations.map((org) => (
                      <OrganizationRow
                        key={org.id}
                        org={org}
                        onEdit={handleEdit}
                        onDelete={handleDeleteClick}
                        onReactivate={handleReactivate}
                        onPurge={handlePurgeClick}
                        isDeletePending={
                          deleteOrgMutation.isPending ||
                          reactivateOrgMutation.isPending ||
                          purgeOrgMutation.isPending
                        }
                      />
                    ))}
                  </tbody>
                </table>
              </div>

              {data?.meta && data.meta.totalPages > 1 && (
                <div className="mt-6 border-t border-[var(--border)] pt-4">
                  <Pagination
                    page={pagination.page}
                    totalPages={pagination.totalPages}
                    pageSize={pagination.pageSize}
                    totalItems={pagination.totalItems}
                    hasNextPage={pagination.hasNextPage}
                    hasPreviousPage={pagination.hasPreviousPage}
                    pageRange={pagination.pageRange}
                    onPageChange={pagination.goToPage}
                    onPageSizeChange={pagination.setPageSize}
                    disabled={isFetching}
                  />
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Modal */}
      <OrganizationModal
        isOpen={createModalOpen || editOrg !== null}
        onClose={() => {
          setCreateModalOpen(false);
          setEditOrg(null);
        }}
        organization={editOrg}
        onSuccess={handleModalSuccess}
      />

      {/* Close (reversible) Confirmation Modal */}
      <ConfirmModal
        isOpen={deleteOrg !== null}
        onClose={() => {
          setDeleteOrg(null);
          setReleaseTelnyx(false);
        }}
        onConfirm={handleDeleteConfirm}
        title="Close Organization"
        message={`Close "${deleteOrg?.name}"? Everyone is signed out immediately and can no longer log in, and billing is cancelled. This is reversible — you can reactivate it within 30 days, after which it is permanently deleted automatically.`}
        confirmText="Close organization"
        cancelText="Cancel"
        variant="danger"
        loading={deleteOrgMutation.isPending}
      >
        <label className="mt-4 flex items-start gap-2.5 cursor-pointer rounded-lg border border-[var(--border)] p-3 hover:bg-[var(--muted)] transition-colors">
          <input
            type="checkbox"
            checked={releaseTelnyx}
            onChange={(e) => setReleaseTelnyx(e.target.checked)}
            disabled={deleteOrgMutation.isPending}
            className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--danger)]"
          />
          <span className="text-sm text-[var(--foreground)]">
            Also release this org&apos;s Telnyx numbers and disable its sub-account
            <span className="block text-xs text-[var(--muted-foreground)] mt-0.5">
              Releases every number back to Telnyx (stops billing) and disables the
              org&apos;s sub-account. Managed accounts can only be disabled, not deleted.
            </span>
          </span>
        </label>
      </ConfirmModal>

      {/* Delete Permanently (hard purge) Confirmation Modal */}
      <ConfirmModal
        isOpen={purgeOrg !== null}
        onClose={() => {
          setPurgeOrg(null);
          setReleaseTelnyx(false);
          setPurgeConfirmText('');
        }}
        onConfirm={handlePurgeConfirm}
        title="Delete Permanently"
        message={`Permanently delete "${purgeOrg?.name}"? This erases the organization and ALL of its data — members, numbers, messages, recordings and settings. This CANNOT be undone.`}
        confirmText="Delete permanently"
        cancelText="Cancel"
        variant="danger"
        loading={purgeOrgMutation.isPending}
        confirmDisabled={purgeNeedsTyping && !purgeNameConfirmed}
      >
        {purgeNeedsTyping && (
          <div className="mt-4">
            <label htmlFor="purge-confirm-name" className="block text-sm text-[var(--foreground)]">
              Type the organization name{' '}
              <span className="font-semibold">{purgeOrg?.name}</span> to confirm:
            </label>
            <Input
              id="purge-confirm-name"
              type="text"
              value={purgeConfirmText}
              onChange={(e) => setPurgeConfirmText(e.target.value)}
              disabled={purgeOrgMutation.isPending}
              autoComplete="off"
              placeholder={purgeOrg?.name}
              className="mt-1.5"
            />
          </div>
        )}
        <label className="mt-4 flex items-start gap-2.5 cursor-pointer rounded-lg border border-[var(--border)] p-3 hover:bg-[var(--muted)] transition-colors">
          <input
            type="checkbox"
            checked={releaseTelnyx}
            onChange={(e) => setReleaseTelnyx(e.target.checked)}
            disabled={purgeOrgMutation.isPending}
            className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--danger)]"
          />
          <span className="text-sm text-[var(--foreground)]">
            Release this org&apos;s Telnyx numbers and disable its sub-account
            <span className="block text-xs text-[var(--muted-foreground)] mt-0.5">
              Recommended — frees every number back to Telnyx and disables the
              sub-account so nothing keeps billing after deletion.
            </span>
          </span>
        </label>
      </ConfirmModal>
    </div>
  );
}
