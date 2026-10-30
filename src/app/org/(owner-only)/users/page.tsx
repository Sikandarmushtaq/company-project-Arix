'use client';

/**
 * Team Members — Organization Portal (/org/users)
 *
 * Professional SaaS team management experience for Organization Owners.
 * Supports Agent and Manager delegation, phone number assignment, recycling
 * history decisions, status management, and custom permission toggles.
 *
 * Integrated with Org Portal Tier 1 API endpoints:
 * - GET /org-portal/dashboard (Org stats & caps)
 * - GET /org-portal/users (Live team members list)
 * - POST /org-portal/users (Create team member + number assignment + history choice)
 * - PUT /org-portal/users/:id (Update member role / status / info / reset password)
 * - DELETE /org-portal/users/:id (Remove member + data purge choice)
 */

import React, { useState, useMemo, useCallback } from 'react';
import { FiPlus, FiLoader } from 'react-icons/fi';
import { Button } from '@/components/ui';
import { toast } from '@/lib/stores/toast';

// Modular Components
import {
  TeamMember,
  TeamFilters,
  UserRole,
  UserStatus,
  CreateTeamMemberInput,
} from './_components/types';
import { TeamSummary } from './_components/TeamSummary';
import { TeamToolbar } from './_components/TeamToolbar';
import { TeamMembersTable } from './_components/TeamMembersTable';
import { TeamMemberCard } from './_components/TeamMemberCard';
import { AddTeamMemberDrawer } from './_components/AddTeamMemberDrawer';
import { MemberDetailDrawer } from './_components/MemberDetailDrawer';
import { RemoveMemberDialog } from './_components/RemoveMemberDialog';
import { ResetPasswordDialog } from './_components/ResetPasswordDialog';
import { DeactivateMemberDialog } from './_components/DeactivateMemberDialog';

// Production API hooks & types
import {
  useOrgDashboard,
  useOrgUsers,
  useOrgNumbers,
  useCreateOrgUser,
  useUpdateOrgUser,
  useDeleteOrgUser,
  useAssignNumber,
} from '@/lib/hooks/useOrg';
import type { OrgUser } from '@/lib/api/services/org.service';
import { normalizePhone } from '@/lib/utils/phone';
import { usePermissions } from '@/lib/hooks/usePermissions';

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error) return error.message;
  return fallback;
}

/** Map backend OrgUser API response to frontend TeamMember UI model */
function mapOrgUserToTeamMember(user: OrgUser): TeamMember {
  const role: UserRole =
    user.role === 'owner' ? 'owner' : user.role === 'manager' ? 'manager' : 'user';

  const status: UserStatus =
    user.status === 'banned' ? 'banned' : user.status === 'inactive' ? 'inactive' : 'active';

  return {
    id: user.id,
    fullName: user.fullName || 'Unnamed User',
    email: user.email,
    role,
    status,
    senderPhone: user.senderPhone || null,
    sipUsername: user.sipUsername || null,
    communication: {
      calling: false,
      sms: false,
      recordings: false,
      autodialer: false,
    },
    createdAt: user.createdAt,
  };
}

export default function OrgUsersPage() {
  // React Query API hooks
  const { data: dashboardData } = useOrgDashboard();
  const { data: usersResponse, isLoading: isUsersLoading } = useOrgUsers();
  const { data: numbersData } = useOrgNumbers();

  const createOrgUserMutation = useCreateOrgUser();
  const updateOrgUserMutation = useUpdateOrgUser();
  const assignNumberMutation = useAssignNumber();
  const deleteOrgUserMutation = useDeleteOrgUser();
  const { isModuleEnabled } = usePermissions();

  // Filters State
  const [filters, setFilters] = useState<TeamFilters>({
    search: '',
    role: 'all',
    status: 'all',
    phone: 'all',
  });

  // Modal / Drawer states
  const [isAddDrawerOpen, setIsAddDrawerOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);
  const [isDetailDrawerOpen, setIsDetailDrawerOpen] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState<TeamMember | null>(null);
  const [memberToResetPw, setMemberToResetPw] = useState<TeamMember | null>(null);
  const [memberToDeactivate, setMemberToDeactivate] = useState<TeamMember | null>(null);

  // Map API users to frontend TeamMember model
  const members: TeamMember[] = useMemo(() => {
    if (usersResponse?.data && Array.isArray(usersResponse.data)) {
      return usersResponse.data.map(mapOrgUserToTeamMember);
    }
    return [];
  }, [usersResponse]);

  // Compute available unassigned numbers from backend
  const availableNumbers = useMemo(() => {
    if (numbersData && Array.isArray(numbersData)) {
      return numbersData
        .filter((n) => !n.assignedUserId && n.isActive)
        .map((n) => ({
          id: n.id,
          number: n.phoneNumber,
          hasHistory: false,
        }));
    }
    return [];
  }, [numbersData]);

  // Organization config from live dashboard
  const organization = useMemo(() => {
    return {
      id: 1,
      name: dashboardData?.organizationName || 'Organization',
      maxUsers: dashboardData?.maxUsers || 10,
      enabledModules: {
        calling: isModuleEnabled('calling'),
        sms: isModuleEnabled('sms'),
        recordings: isModuleEnabled('recordings'),
        whatsapp: isModuleEnabled('whatsapp'),
        autodialer: isModuleEnabled('autodialer'),
      },
      availableNumbers,
    };
  }, [dashboardData, availableNumbers, isModuleEnabled]);

  // Reset all filters
  const handleResetFilters = useCallback(() => {
    setFilters({
      search: '',
      role: 'all',
      status: 'all',
      phone: 'all',
    });
  }, []);

  const hasActiveFilters =
    filters.search.trim().length > 0 ||
    filters.role !== 'all' ||
    filters.status !== 'all' ||
    filters.phone !== 'all';

  // Filtered members list
  const filteredMembers = useMemo(() => {
    return members.filter((member) => {
      // Search filter (name, email, phone)
      if (filters.search.trim()) {
        const query = filters.search.trim().toLowerCase();
        const matchesName = member.fullName.toLowerCase().includes(query);
        const matchesEmail = member.email.toLowerCase().includes(query);
        const matchesPhone =
          member.senderPhone?.replace(/\D/g, '').includes(query.replace(/\D/g, '')) ?? false;
        if (!matchesName && !matchesEmail && !matchesPhone) return false;
      }

      // Role filter
      if (filters.role !== 'all') {
        if (member.role !== filters.role) return false;
      }

      // Status filter
      if (filters.status !== 'all') {
        if (member.status !== filters.status) return false;
      }

      // Phone filter
      if (filters.phone === 'assigned' && !member.senderPhone) return false;
      if (filters.phone === 'unassigned' && member.senderPhone) return false;

      return true;
    });
  }, [members, filters]);

  // Handler: Add Member via API
  const handleAddMember = useCallback(
    async (newMemberData: CreateTeamMemberInput) => {
      try {
        await createOrgUserMutation.mutateAsync({
          fullName: newMemberData.fullName,
          email: newMemberData.email,
          password: newMemberData.password || 'TempPassword123!',
          role: newMemberData.role === 'manager' ? 'manager' : 'user',
          senderPhone: newMemberData.senderPhone || undefined,
          importHistory: newMemberData.importHistory,
        });

        toast.success(
          `${newMemberData.fullName} added as ${
            newMemberData.role === 'manager' ? 'Manager' : 'Agent'
          }`
        );
        return true;
      } catch (error: unknown) {
        toast.error(getErrorMessage(error, 'Failed to add team member'));
        return false;
      }
    },
    [createOrgUserMutation]
  );

  // Handler: Save Member Edits via API
  const handleSaveMember = useCallback(
    async (updated: TeamMember) => {
      try {
        // 1) Profile fields (name / email / role / status).
        await updateOrgUserMutation.mutateAsync({
          id: updated.id,
          data: {
            fullName: updated.fullName,
            email: updated.email,
            status: updated.status === 'inactive' ? 'inactive' : 'active',
            role: updated.role === 'manager' ? 'manager' : 'user',
          },
        });

        // 2) Phone-number (re)assignment. The profile update above does NOT touch
        //    number ownership — that has to go through the assign engine (which wires
        //    organization_numbers + user_phone_numbers + FusionPBX routing + the
        //    extension caller-ID). Previously the drawer's number pick was silently
        //    dropped here, so it showed a false "updated" and never assigned. Only act
        //    when the selection actually changed; resolve the id from the FULL numbers
        //    list (the drawer's available list excludes the currently-held one).
        const origPhone = normalizePhone(selectedMember?.senderPhone ?? '');
        const newPhone = normalizePhone(updated.senderPhone ?? '');
        if (newPhone !== origPhone) {
          const allNumbers = Array.isArray(numbersData) ? numbersData : [];
          // Assign the NEW number FIRST (if one was picked): if this fails, the
          // member keeps their current number rather than being left with none.
          if (newPhone) {
            const next = allNumbers.find((n) => normalizePhone(n.phoneNumber) === newPhone);
            if (!next) throw new Error('That number is no longer available to assign.');
            await assignNumberMutation.mutateAsync({ numberId: next.id, userId: updated.id });
          }
          // Then release the PREVIOUS number (cleared, or switched to a different one)
          // so a member is never left owning a number they no longer use.
          if (origPhone && origPhone !== newPhone) {
            const prev = allNumbers.find((n) => normalizePhone(n.phoneNumber) === origPhone);
            if (prev) await assignNumberMutation.mutateAsync({ numberId: prev.id, userId: null });
          }
        }

        toast.success(`Saved ${updated.fullName}'s changes`);
        return true;
      } catch (error: unknown) {
        // Honest feedback: if the number assignment failed, the profile may have saved
        // but the number did NOT — surface the real error and keep the drawer open.
        toast.error(getErrorMessage(error, 'Failed to save member changes'));
        return false;
      }
    },
    [updateOrgUserMutation, assignNumberMutation, numbersData, selectedMember]
  );

  // Handler: Open Detail Drawer
  const handleSelectMember = useCallback((member: TeamMember) => {
    setSelectedMember(member);
    setIsDetailDrawerOpen(true);
  }, []);

  // Handler: Initiate Deactivate
  const handleDeactivate = useCallback((member: TeamMember) => {
    if (member.role === 'owner') return; // Owner cannot deactivate self
    setMemberToDeactivate(member);
  }, []);

  // Handler: Confirm Deactivate via API
  const handleConfirmDeactivate = useCallback(
    async (member: TeamMember) => {
      try {
        await updateOrgUserMutation.mutateAsync({
          id: member.id,
          data: { status: 'inactive' },
        });

        setMemberToDeactivate(null);
        toast.success(`${member.fullName} has been deactivated`);
      } catch (error: unknown) {
        toast.error(getErrorMessage(error, 'Failed to deactivate member'));
      }
    },
    [updateOrgUserMutation]
  );

  // Handler: Reactivate Member (inactive -> active) via API
  const handleReactivate = useCallback(
    async (member: TeamMember) => {
      try {
        await updateOrgUserMutation.mutateAsync({
          id: member.id,
          data: { status: 'active' },
        });

        toast.success(`${member.fullName} has been reactivated`);
      } catch (error: unknown) {
        toast.error(getErrorMessage(error, 'Failed to reactivate member'));
      }
    },
    [updateOrgUserMutation]
  );

  // Handler: Remove Member via API
  const handleConfirmDelete = useCallback(
    async (member: TeamMember, deleteData: boolean) => {
      try {
        await deleteOrgUserMutation.mutateAsync({
          id: member.id,
          purgeData: deleteData,
        });

        setMemberToRemove(null);

        if (deleteData) {
          toast.success(
            `${member.fullName} removed. Data deletion scheduled (30-day grace period).`
          );
        } else {
          toast.success(
            `${member.fullName} removed. Phone number returned to available pool.`
          );
        }
      } catch (error: unknown) {
        toast.error(getErrorMessage(error, 'Failed to remove team member'));
      }
    },
    [deleteOrgUserMutation]
  );

  // Handler: Reset Password via API
  const handleConfirmResetPassword = useCallback(
    async (member: TeamMember, newPassword: string) => {
      try {
        await updateOrgUserMutation.mutateAsync({
          id: member.id,
          data: { password: newPassword },
        });

        setMemberToResetPw(null);
        toast.success(`Password reset successfully for ${member.fullName}`);
      } catch (error: unknown) {
        toast.error(getErrorMessage(error, 'Failed to reset password'));
      }
    },
    [updateOrgUserMutation]
  );

  if (isUsersLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <FiLoader className="w-8 h-8 animate-spin text-[var(--foreground)]" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* PAGE HEADER */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-[var(--border)] pb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[var(--foreground)]">
            Team Members
          </h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">
            Manage team profiles, roles, phone assignments, and supported messaging settings.
          </p>
        </div>

        <Button
          onClick={() => setIsAddDrawerOpen(true)}
          className="shrink-0 flex items-center gap-2"
          disabled={createOrgUserMutation.isPending}
        >
          <FiPlus className="w-4 h-4" />
          <span>Add Team Member</span>
        </Button>
      </div>

      {/* COMPACT INLINE SUMMARY */}
      <TeamSummary members={members} organization={organization} />

      {/* TOOLBAR (Search, Filters, Reset) */}
      <TeamToolbar
        filters={filters}
        onFilterChange={setFilters}
        onResetFilters={handleResetFilters}
        hasActiveFilters={hasActiveFilters}
      />

      {/* TEAM TABLE (Desktop) */}
      <div className="hidden md:block">
        <TeamMembersTable
          members={filteredMembers}
          onSelectMember={handleSelectMember}
          onEditMember={handleSelectMember}
          onManageAccess={handleSelectMember}
          onResetPassword={(m) => setMemberToResetPw(m)}
          onDeactivateMember={handleDeactivate}
          onReactivateMember={handleReactivate}
          onDeleteMember={(m) => setMemberToRemove(m)}
          onOpenAddDrawer={() => setIsAddDrawerOpen(true)}
          onResetFilters={handleResetFilters}
          isFiltered={hasActiveFilters}
        />
      </div>

      {/* MOBILE MEMBER CARDS (< md) */}
      <div className="md:hidden space-y-3">
        {filteredMembers.length === 0 ? (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-8 text-center text-sm text-[var(--muted-foreground)]">
            No team members found.
          </div>
        ) : (
          filteredMembers.map((member) => (
            <TeamMemberCard
              key={member.id}
              member={member}
              onSelectMember={handleSelectMember}
              onEditMember={handleSelectMember}
              onManageAccess={handleSelectMember}
              onResetPassword={(m) => setMemberToResetPw(m)}
              onDeactivateMember={handleDeactivate}
              onReactivateMember={handleReactivate}
              onDeleteMember={(m) => setMemberToRemove(m)}
            />
          ))
        )}
      </div>

      {/* ADD TEAM MEMBER DRAWER */}
      <AddTeamMemberDrawer
        isOpen={isAddDrawerOpen}
        onClose={() => setIsAddDrawerOpen(false)}
        organization={organization}
        availableNumbers={availableNumbers}
        currentMemberCount={members.length}
        onAddMember={handleAddMember}
      />

      {/* MEMBER DETAIL & EDIT DRAWER */}
      <MemberDetailDrawer
        member={selectedMember}
        isOpen={isDetailDrawerOpen}
        onClose={() => {
          setIsDetailDrawerOpen(false);
          setSelectedMember(null);
        }}
        availableNumbers={availableNumbers}
        onSaveMember={handleSaveMember}
        onOpenResetPassword={(m) => setMemberToResetPw(m)}
      />

      {/* REMOVE MEMBER CONFIRMATION DIALOG */}
      <RemoveMemberDialog
        member={memberToRemove}
        isOpen={!!memberToRemove}
        onClose={() => setMemberToRemove(null)}
        onConfirm={handleConfirmDelete}
        isDeleting={deleteOrgUserMutation.isPending}
      />

      {/* RESET PASSWORD DIALOG */}
      <ResetPasswordDialog
        member={memberToResetPw}
        isOpen={!!memberToResetPw}
        onClose={() => setMemberToResetPw(null)}
        onConfirm={handleConfirmResetPassword}
      />

      {/* DEACTIVATE MEMBER CONFIRMATION DIALOG */}
      <DeactivateMemberDialog
        member={memberToDeactivate}
        isOpen={!!memberToDeactivate}
        onClose={() => setMemberToDeactivate(null)}
        onConfirm={handleConfirmDeactivate}
      />
    </div>
  );
}
