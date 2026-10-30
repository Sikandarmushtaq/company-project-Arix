'use client';

/**
 * Phone Numbers — Organization Portal (/org/numbers)
 *
 * Professional SaaS phone number management experience for Organization Owners.
 * Supports inventory search (US & Canada, city/area code/toll-free), single number
 * purchase via Stripe Checkout or Bank Transfer, team member assignment/unassignment,
 * recycled-number history decision handling, and Caller ID Name (CNAM) configuration.
 *
 * Integrated with Tier 1 backend APIs:
 * - GET /org-portal/numbers (Fetch organization numbers)
 * - GET /org-portal/numbers/cap (Fetch number limit & usage cap)
 * - GET /org-portal/users (Fetch team members for assignment)
 * - PUT /org-portal/numbers/:id/assign (Assign / unassign number + recycled history choice)
 * - PUT /org-portal/numbers/:id/caller-id-name (Set outbound CNAM)
 * - PUT /org-portal/numbers/:id/inbound-caller-name (Toggle inbound CNAM lookup)
 */

import React, { useState, useMemo, useCallback } from 'react';
import { FiPlus, FiAlertCircle, FiLoader } from 'react-icons/fi';
import { Button } from '@/components/ui';
import { toast } from '@/lib/stores/toast';

// Modular Components
import {
  OrgNumberItem,
  NumberFilters,
  OrgMemberOption,
  OrganizationNumberConfig,
} from './_components/types';
import { NumbersSummary } from './_components/NumbersSummary';
import { NumbersToolbar } from './_components/NumbersToolbar';
import { NumbersTable } from './_components/NumbersTable';
import { NumberCard } from './_components/NumberCard';
import { AddNumberDrawer } from './_components/AddNumberDrawer';
import { NumberDetailDrawer } from './_components/NumberDetailDrawer';

// Production API hooks
import {
  useOrgNumbers,
  useOrgNumberCap,
  useOrgUsers,
  useAssignNumber,
  useUpdateCallerIdName,
} from '@/lib/hooks/useOrg';
import type { OrgNumber, OrgUser } from '@/lib/api/services/org.service';

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error) return error.message;
  return fallback;
}

/** Map backend OrgNumber object to frontend OrgNumberItem */
function mapOrgNumberToItem(num: OrgNumber, users: OrgUser[]): OrgNumberItem {
  const assignedUser = users.find((user) => user.id === num.assignedUserId);
  return {
    id: num.id,
    phoneNumber: num.phoneNumber,
    countryCode: (num.countryCode as 'US' | 'CA') || 'US',
    locality: '',
    region: '',
    numberType: num.numberType || 'local',
    assignedUserId: num.assignedUserId,
    assignedUserName: num.assignedUserName,
    assignedUserRole: assignedUser?.role,
    isActive: num.isActive ?? true,
    callerIdName: num.callerIdName || null,
    inboundCnamEnabled: num.inboundCnamEnabled ?? false,
    monthlyCostCents: num.monthlyCostCents,
    createdAt: num.createdAt,
    history: {
      sms: 0,
      calls: 0,
      hasHistory: false,
      pendingRetirement: false,
    },
  };
}

/** Map backend OrgUser to OrgMemberOption for assignment selection */
function mapOrgUserToMemberOption(user: OrgUser, numbers: OrgNumber[]): OrgMemberOption {
  const userNum = numbers.find((n) => n.assignedUserId === user.id);
  return {
    id: user.id,
    fullName: user.fullName || 'Unnamed User',
    email: user.email,
    role: (user.role as 'owner' | 'manager' | 'user') || 'user',
    hasNumber: !!userNum,
    assignedPhone: userNum?.phoneNumber || user.senderPhone || undefined,
  };
}

export default function OrgNumbersPage() {
  // React Query API Hooks
  const { data: numbersData, isLoading: isNumbersLoading } = useOrgNumbers();
  const { data: capData } = useOrgNumberCap();
  const { data: usersResponse } = useOrgUsers();

  const assignNumberMutation = useAssignNumber();
  const updateCallerIdNameMutation = useUpdateCallerIdName();

  // Filters State
  const [filters, setFilters] = useState<NumberFilters>({
    search: '',
    assignment: 'all',
    type: 'all',
    status: 'all',
  });

  // Drawer states
  const [isAddDrawerOpen, setIsAddDrawerOpen] = useState(false);
  const [selectedNumber, setSelectedNumber] = useState<OrgNumberItem | null>(null);
  const [isDetailDrawerOpen, setIsDetailDrawerOpen] = useState(false);

  // Map numbers from API
  const numbers: OrgNumberItem[] = useMemo(() => {
    if (numbersData && Array.isArray(numbersData)) {
      const users = usersResponse?.data ?? [];
      return numbersData.map((number) => mapOrgNumberToItem(number, users));
    }
    return [];
  }, [numbersData, usersResponse]);

  // Map member assignment options from API
  const members: OrgMemberOption[] = useMemo(() => {
    if (usersResponse?.data && Array.isArray(usersResponse.data)) {
      return usersResponse.data.map((user) =>
        mapOrgUserToMemberOption(user, numbersData || [])
      );
    }
    return [];
  }, [usersResponse, numbersData]);

  // Organization capacity config
  const organization: OrganizationNumberConfig = useMemo(() => {
    return {
      id: 1,
      name: 'Organization',
      maxPhoneNumbers: capData?.cap || 10,
    };
  }, [capData]);

  // Check capacity limit
  const isAtCapacity = capData
    ? capData.used >= capData.cap
    : numbers.length >= organization.maxPhoneNumbers;

  // Reset all filters
  const handleResetFilters = useCallback(() => {
    setFilters({
      search: '',
      assignment: 'all',
      type: 'all',
      status: 'all',
    });
  }, []);

  const hasActiveFilters =
    filters.search.trim().length > 0 ||
    filters.assignment !== 'all' ||
    filters.type !== 'all' ||
    filters.status !== 'all';

  // Filtered numbers list
  const filteredNumbers = useMemo(() => {
    return numbers.filter((num) => {
      // Search filter (number digits/formatted, caller ID, assigned member)
      if (filters.search.trim()) {
        const query = filters.search.trim().toLowerCase();
        const queryDigits = query.replace(/\D/g, '');
        const numDigits = num.phoneNumber.replace(/\D/g, '');

        const matchesDigits = queryDigits ? numDigits.includes(queryDigits) : false;
        const matchesCallerId = num.callerIdName
          ? num.callerIdName.toLowerCase().includes(query)
          : false;
        const matchesMember = num.assignedUserName
          ? num.assignedUserName.toLowerCase().includes(query)
          : false;
        const matchesLocation =
          (num.locality && num.locality.toLowerCase().includes(query)) ||
          (num.region && num.region.toLowerCase().includes(query));

        if (!matchesDigits && !matchesCallerId && !matchesMember && !matchesLocation) {
          return false;
        }
      }

      // Assignment filter
      if (filters.assignment === 'assigned' && num.assignedUserId === null) return false;
      if (filters.assignment === 'unassigned' && num.assignedUserId !== null) return false;

      // Type filter
      if (filters.type !== 'all' && num.numberType !== filters.type) return false;

      // Status filter
      if (filters.status === 'active' && !num.isActive) return false;
      if (filters.status === 'inactive' && num.isActive) return false;

      return true;
    });
  }, [numbers, filters]);

  // Handler: Select Number for detail drawer
  const handleSelectNumber = useCallback((number: OrgNumberItem) => {
    setSelectedNumber(number);
    setIsDetailDrawerOpen(true);
  }, []);

  // Handler: Direct Unassign via API
  const handleUnassignNumber = useCallback(
    async (number: OrgNumberItem) => {
      try {
        await assignNumberMutation.mutateAsync({
          numberId: number.id,
          userId: null,
        });
        toast.success(`Number ${number.phoneNumber} unassigned`);
      } catch (error: unknown) {
        toast.error(getErrorMessage(error, 'Failed to unassign number'));
      }
    },
    [assignNumberMutation]
  );

  // Handler: Direct Assign action opens detail drawer
  const handleAssignAction = useCallback((number: OrgNumberItem) => {
    setSelectedNumber(number);
    setIsDetailDrawerOpen(true);
  }, []);

  // Handler: Save number updates (assignment and outbound CNAM) via API
  const handleUpdateNumber = useCallback(
    async (updated: OrgNumberItem, options?: { importHistory?: boolean }) => {
      try {
        if (selectedNumber && selectedNumber.assignedUserId !== updated.assignedUserId) {
          await assignNumberMutation.mutateAsync({
            numberId: updated.id,
            userId: updated.assignedUserId,
            importHistory: options?.importHistory,
          });
        }
        if (selectedNumber && selectedNumber.callerIdName !== updated.callerIdName) {
          await updateCallerIdNameMutation.mutateAsync({
            numberId: updated.id,
            callerIdName: updated.callerIdName || '',
          });
        }
        toast.success(`Updated settings for ${updated.phoneNumber}`);
        setIsDetailDrawerOpen(false);
        setSelectedNumber(null);
      } catch (error: unknown) {
        toast.error(getErrorMessage(error, 'Failed to update number settings'));
      }
    },
    [
      selectedNumber,
      assignNumberMutation,
      updateCallerIdNameMutation,
    ]
  );

  if (isNumbersLoading) {
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
            Phone Numbers
          </h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">
            Manage your organization’s phone numbers, assignments and caller ID settings.
          </p>
        </div>

        <Button
          onClick={() => setIsAddDrawerOpen(true)}
          disabled={isAtCapacity}
          className="shrink-0 flex items-center gap-2"
        >
          <FiPlus className="w-4 h-4" />
          <span>Add Number</span>
        </Button>
      </div>

      {/* COMPACT INLINE SUMMARY */}
      <NumbersSummary numbers={numbers} organization={organization} />

      {/* AT-CAP WARNING (When limit reached) */}
      {isAtCapacity && (
        <div className="flex items-center gap-2.5 p-3 rounded-xl bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 text-xs text-amber-900 dark:text-amber-200">
          <FiAlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
          <span>
            You&apos;ve reached your phone-number limit of {organization.maxPhoneNumbers} numbers.
          </span>
        </div>
      )}

      {/* TOOLBAR (Search, Filters, Reset) */}
      <NumbersToolbar
        filters={filters}
        onFilterChange={setFilters}
        onResetFilters={handleResetFilters}
        hasActiveFilters={hasActiveFilters}
      />

      {/* DESKTOP TABLE (>= md) */}
      <div className="hidden md:block">
        <NumbersTable
          numbers={filteredNumbers}
          onSelectNumber={handleSelectNumber}
          onAssignMember={handleAssignAction}
          onUnassignMember={handleUnassignNumber}
          onOpenAddNumber={() => setIsAddDrawerOpen(true)}
          onResetFilters={handleResetFilters}
          isFiltered={hasActiveFilters}
          atCap={isAtCapacity}
        />
      </div>

      {/* MOBILE NUMBER CARDS (< md) */}
      <div className="md:hidden space-y-3">
        {filteredNumbers.length === 0 ? (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-8 text-center text-sm text-[var(--muted-foreground)]">
            {hasActiveFilters ? 'No numbers match your filters.' : 'No phone numbers yet.'}
          </div>
        ) : (
          filteredNumbers.map((num) => (
            <NumberCard
              key={num.id}
              number={num}
              onSelectNumber={handleSelectNumber}
              onAssignMember={handleAssignAction}
              onUnassignMember={handleUnassignNumber}
            />
          ))
        )}
      </div>

      {/* ADD NUMBER DRAWER */}
      <AddNumberDrawer
        isOpen={isAddDrawerOpen}
        onClose={() => setIsAddDrawerOpen(false)}
        existingNumbers={numbers}
      />

      {/* NUMBER DETAIL & MANAGEMENT DRAWER */}
      <NumberDetailDrawer
        number={selectedNumber}
        isOpen={isDetailDrawerOpen}
        onClose={() => {
          setIsDetailDrawerOpen(false);
          setSelectedNumber(null);
        }}
        members={members}
        onUpdateNumber={handleUpdateNumber}
      />
    </div>
  );
}
