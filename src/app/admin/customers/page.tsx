'use client';

/**
 * /admin/customers — Customer pool management.
 *
 * Visible to admin, owner, and manager (the layout enforces role gates).
 * The page presents the org's master customer list with assignment, status,
 * and a triage tab for unassigned numbers that have come in via WhatsApp.
 *
 * Agents reach their own assigned customers from the WhatsApp page —
 * they don't visit this page. Hence: full phone number is shown here, no
 * masking. The privacy mode that hides phones is per-agent, not per-page.
 */

import React, { useState, useMemo, useEffect } from 'react';
import { useTriageBadgeStore } from '@/lib/stores/triageBadge';
import { FaWhatsapp } from 'react-icons/fa';
import {
  FiPlus,
  FiSearch,
  FiTrash2,
  FiInbox,
  FiUsers,
  FiUploadCloud,
  FiDownload,
  FiX,
} from 'react-icons/fi';
import { Card, CardContent, Button, Input, StyledSelect } from '@/components/ui';
import { Modal, ConfirmModal } from '@/components/ui/Modal';
import {
  useCustomersList,
  useCreateCustomer,
  useUpdateCustomer,
  useDeleteCustomer,
  useAssignCustomer,
  useBulkAssignCustomers,
  useBulkDeleteCustomers,
} from '@/lib/hooks';
import { listCustomers as fetchCustomersForExport } from '@/lib/api/services/customers.api';
import { ImportCustomersModal } from './ImportCustomersModal';
import type { OrgCustomerWithAssignment, CustomerStatus } from '@/lib/api/services/customers.api';
import { formatPhoneUS } from '@/lib/utils/phone';
import { apiClient } from '@/lib/api/client';
import type { ApiResponse } from '@/lib/types';
import { useQuery } from '@tanstack/react-query';
import {
  CustomerRow,
  CustomerForm,
  CustomerLockoutsSection,
  STATUS_LABELS,
  type OrgMember,
} from './_components';

type Tab = 'all' | 'triage';

export default function CustomersPage() {
  const [tab, setTab] = useState<Tab>('all');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<CustomerStatus | ''>('');
  const [agentFilter, setAgentFilter] = useState<number | ''>('');
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [importOpen, setImportOpen] = useState(false);
  const [bulkDeleteConfirmOpen, setBulkDeleteConfirmOpen] = useState(false);
  const [bulkAssignTarget, setBulkAssignTarget] = useState<number | '' | 'unassign'>('');
  const [bulkTransferChat, setBulkTransferChat] = useState(false);
  /**
   * Pending single-row reassignment — when the manager picks a new agent
   * on a row that already has an owner, we show a confirm modal so they
   * can opt into chat transfer. First-time assigns and unassigns skip
   * the modal (no previous owner to lock out).
   */
  const [pendingReassign, setPendingReassign] = useState<{
    customer: OrgCustomerWithAssignment;
    newUserId: number | null;
  } | null>(null);
  const [pendingTransferChat, setPendingTransferChat] = useState(false);

  // Manager scoped to their org via /api/v1/whatsapp/org/users (org-portal
  // is excluded from build — see whatsapp module for the deployed list).
  const { data: orgUsersResp } = useQuery({
    queryKey: ['wa', 'org', 'users'],
    queryFn: () =>
      apiClient.get<ApiResponse<OrgMember[]>>('/whatsapp/org/users').then((r) => r.data),
    staleTime: 30_000,
    retry: false,
  });
  const agents = useMemo(
    () => (orgUsersResp ?? []).filter((u) => u.role === 'user'),
    [orgUsersResp]
  );

  const params = useMemo(
    () => ({
      search: search.trim() || undefined,
      status: statusFilter || undefined,
      assignedUserId:
        tab === 'triage'
          ? ('unassigned' as const)
          : agentFilter !== ''
            ? (agentFilter as number)
            : undefined,
      page: 1,
      limit: 200,
    }),
    [search, statusFilter, tab, agentFilter]
  );

  const { data, isLoading, refetch } = useCustomersList(params);
  const customers = data?.customers ?? [];

  // Triage arrivals badge — counts new triage entries since the manager
  // last visited the Triage tab.
  //   - The realtime hook bumps `count` on CUSTOMER_TRIAGE_ARRIVED, but
  //     ONLY when the manager isn't currently viewing the Triage tab.
  //   - When the tab IS active, the hook skips the bump entirely (the
  //     row appears in the list via cache invalidation, so no badge
  //     and no toast are needed).
  //   - We sync `viewingTriageTab` with the local tab state, and reset
  //     the count whenever the tab becomes active so the manager gets a
  //     clear "you've seen these" signal.
  const triageBadgeCount = useTriageBadgeStore((s) => s.count);
  const resetTriageBadge = useTriageBadgeStore((s) => s.reset);
  const setViewingTriageTab = useTriageBadgeStore((s) => s.setViewingTriageTab);
  useEffect(() => {
    const viewing = tab === 'triage';
    setViewingTriageTab(viewing);
    if (viewing) resetTriageBadge();
    return () => {
      // On unmount, no longer viewing — clear so an arrival on a
      // different page resumes toasts/badge bumps normally.
      setViewingTriageTab(false);
    };
  }, [tab, setViewingTriageTab, resetTriageBadge]);

  // Selection state — clear whenever the visible row set changes so we
  // don't end up with selected IDs that aren't actually on screen.
  React.useEffect(() => {
    setSelectedIds(new Set());
  }, [tab, statusFilter, agentFilter, search]);

  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<OrgCustomerWithAssignment | null>(null);
  const [deleting, setDeleting] = useState<OrgCustomerWithAssignment | null>(null);

  const createMut = useCreateCustomer();
  const updateMut = useUpdateCustomer();
  const deleteMut = useDeleteCustomer();
  const assignMut = useAssignCustomer();
  const bulkAssignMut = useBulkAssignCustomers();
  const bulkDeleteMut = useBulkDeleteCustomers();

  const allSelected = customers.length > 0 && selectedIds.size === customers.length;
  const someSelected = selectedIds.size > 0 && !allSelected;
  const toggleSelectAll = () => {
    if (allSelected) setSelectedIds(new Set());
    else setSelectedIds(new Set(customers.map((c) => c.id)));
  };
  const toggleSelectOne = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const applyBulkAssign = () => {
    if (selectedIds.size === 0 || bulkAssignTarget === '') return;
    const userId = bulkAssignTarget === 'unassign' ? null : (bulkAssignTarget as number);
    // Transfer chat is only meaningful when actually assigning to someone;
    // unassign-to-triage doesn't have a "new owner" to inherit chat.
    const transferChat = userId !== null && bulkTransferChat;
    bulkAssignMut.mutate(
      { customerIds: Array.from(selectedIds), userId, transferChat },
      {
        onSuccess: () => {
          setSelectedIds(new Set());
          setBulkAssignTarget('');
          setBulkTransferChat(false);
        },
      }
    );
  };

  const handleExport = async () => {
    // Paginate through the list endpoint — its per-request cap is 200,
    // and bumping it server-side would weaken the safety net for the
    // paginated UI. 5000-row ceiling protects the browser from runaway
    // exports if a manager triggers this on a huge org.
    const PAGE_SIZE = 200;
    const MAX_TOTAL = 5000;
    const all: typeof customers = [];
    let page = 1;
    while (all.length < MAX_TOTAL) {
      const result = await fetchCustomersForExport({ ...params, page, limit: PAGE_SIZE });
      if (result.customers.length === 0) break;
      all.push(...result.customers);
      if (result.customers.length < PAGE_SIZE) break;
      page++;
    }

    const headers = ['name', 'phone', 'status', 'assigned_user', 'last_message_at', 'notes'];
    const rows = all.map((c) => [
      c.name,
      c.phone,
      c.status,
      c.assignedUserName ?? '',
      c.lastMessageAt ?? '',
      c.notes ?? '',
    ]);
    const csv = [headers, ...rows]
      .map((r) =>
        r
          .map((cell) => {
            const s = String(cell ?? '');
            // RFC 4180: quote if contains comma, quote, or newline; double-up quotes.
            return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
          })
          .join(',')
      )
      .join('\n');
    // UTF-8 BOM so Excel on Windows doesn't mojibake the bullet characters.
    const blob = new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `customers-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">Customers</h1>
          <p className="text-[var(--muted-foreground)] text-sm mt-1">
            Manage the org's customer pool and assign WhatsApp conversations to agents.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" onClick={handleExport} disabled={customers.length === 0}>
            <FiDownload className="w-4 h-4" /> Export CSV
          </Button>
          <Button variant="outline" onClick={() => setImportOpen(true)}>
            <FiUploadCloud className="w-4 h-4" /> Import
          </Button>
          <Button onClick={() => setCreateOpen(true)}>
            <FiPlus className="w-4 h-4" /> Add Customer
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-[var(--border)]">
        <TabButton active={tab === 'all'} onClick={() => setTab('all')} icon={<FiUsers />}>
          All Customers ({data?.total ?? 0})
        </TabButton>
        <TabButton active={tab === 'triage'} onClick={() => setTab('triage')} icon={<FiInbox />}>
          Triage <span className="text-xs text-[var(--muted-foreground)] ml-1">unassigned</span>
          {triageBadgeCount > 0 && tab !== 'triage' && (
            <span
              className="ml-2 inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full bg-red-500 text-white text-xs font-semibold"
              aria-label={`${triageBadgeCount} new triage arrival${triageBadgeCount === 1 ? '' : 's'}`}
            >
              {triageBadgeCount > 99 ? '99+' : triageBadgeCount}
            </span>
          )}
        </TabButton>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <Input
          placeholder="Search by name or phone…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          leftIcon={<FiSearch className="w-4 h-4" />}
          className="max-w-sm"
        />
        <StyledSelect
          value={statusFilter}
          onChange={(v) => setStatusFilter(v as CustomerStatus | '')}
          className="w-auto"
        >
          <option value="">All statuses</option>
          {(Object.keys(STATUS_LABELS) as CustomerStatus[]).map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </StyledSelect>
        {/* Agent filter — disabled in triage tab (triage is "no agent"). */}
        {tab === 'all' && (
          <StyledSelect
            value={String(agentFilter)}
            onChange={(v) => setAgentFilter(v === '' ? '' : Number(v))}
            className="w-auto"
          >
            <option value="">All agents</option>
            {agents.map((a) => (
              <option key={a.id} value={a.id}>
                {a.fullName}
              </option>
            ))}
          </StyledSelect>
        )}
      </div>

      {/* Bulk action bar — appears whenever rows are selected. Sticky-feel
          but not actually sticky; sits between filters and the table. */}
      {selectedIds.size > 0 && (
        <div className="flex flex-col gap-2 p-3 rounded-lg border border-[var(--primary-300)] bg-[var(--primary-50)] dark:bg-[var(--primary-900)]/20">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-sm font-medium text-[var(--foreground)]">
              {selectedIds.size} selected
            </span>
            <StyledSelect
              value={String(bulkAssignTarget)}
              onChange={(v) => {
                setBulkAssignTarget(v === '' ? '' : v === 'unassign' ? 'unassign' : Number(v));
              }}
              className="h-9 w-auto"
            >
              <option value="">Assign to…</option>
              <option value="unassign">— Unassign (move to triage) —</option>
              {agents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.fullName}
                </option>
              ))}
            </StyledSelect>
            <Button
              size="sm"
              onClick={applyBulkAssign}
              disabled={bulkAssignTarget === '' || bulkAssignMut.isPending}
            >
              {bulkAssignMut.isPending ? 'Applying…' : 'Apply'}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setBulkDeleteConfirmOpen(true)}
              disabled={bulkDeleteMut.isPending}
            >
              <FiTrash2 className="w-3.5 h-3.5 text-[var(--danger)]" /> Delete
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setSelectedIds(new Set())}
              className="ml-auto"
            >
              <FiX className="w-3.5 h-3.5" /> Clear selection
            </Button>
          </div>
          {/*
            Transfer-chat checkbox — only meaningful when actually assigning
            to a real agent. Hidden when the action is "unassign" because
            triage has no owner to inherit chat. The label spells out the
            destructive part ("locks out previous agent") so a manager who
            checks it knows the previous owner loses access.
          */}
          {bulkAssignTarget !== '' && bulkAssignTarget !== 'unassign' && (
            <label className="flex items-start gap-2 text-sm cursor-pointer pl-1">
              <input
                type="checkbox"
                checked={bulkTransferChat}
                onChange={(e) => setBulkTransferChat(e.target.checked)}
                className="mt-0.5"
              />
              <span className="text-[var(--foreground)]">
                Also transfer chat history
                <span className="text-xs text-[var(--muted-foreground)] ml-2">
                  Locks out the previous agent — they can no longer see the conversation.
                </span>
              </span>
            </label>
          )}
        </div>
      )}

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--muted)]/30">
                  <th className="py-3 px-3 w-10">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      ref={(el) => {
                        if (el) el.indeterminate = someSelected;
                      }}
                      onChange={toggleSelectAll}
                      aria-label="Select all on page"
                    />
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-[var(--muted-foreground)]">
                    Name
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-[var(--muted-foreground)]">
                    Phone
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-[var(--muted-foreground)]">
                    Status
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-[var(--muted-foreground)]">
                    Assigned To
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-[var(--muted-foreground)]">
                    Last Activity
                  </th>
                  <th className="text-right py-3 px-4 font-medium text-[var(--muted-foreground)]">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-[var(--muted-foreground)]">
                      Loading…
                    </td>
                  </tr>
                ) : customers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-[var(--muted-foreground)]">
                      {tab === 'triage'
                        ? 'No unassigned customers right now. Inbound messages from unknown numbers will appear here.'
                        : 'No customers yet — add one or wait for inbound WhatsApp messages.'}
                    </td>
                  </tr>
                ) : (
                  customers.map((c) => (
                    <CustomerRow
                      key={c.id}
                      customer={c}
                      agents={agents}
                      isSelected={selectedIds.has(c.id)}
                      onToggleSelect={() => toggleSelectOne(c.id)}
                      onAssign={(userId) => {
                        // Confirm via modal when this is a true reassign
                        // (existing owner → different new owner). First
                        // assigns and unassigns can skip — there's nothing
                        // to lock out.
                        const isReassign =
                          c.assignedUserId !== null &&
                          userId !== null &&
                          c.assignedUserId !== userId;
                        if (isReassign) {
                          setPendingReassign({ customer: c, newUserId: userId });
                          setPendingTransferChat(false);
                        } else {
                          assignMut.mutate({ id: c.id, data: { userId } });
                        }
                      }}
                      onEdit={() => setEditing(c)}
                      onDelete={() => setDeleting(c)}
                      isAssignBusy={assignMut.isPending}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Create modal */}
      <Modal isOpen={createOpen} onClose={() => setCreateOpen(false)} title="Add Customer">
        <CustomerForm
          isPending={createMut.isPending}
          onSubmit={(values) =>
            createMut.mutate(values, {
              onSuccess: () => {
                setCreateOpen(false);
                refetch();
              },
            })
          }
          onCancel={() => setCreateOpen(false)}
        />
      </Modal>

      {/* Edit modal */}
      <Modal
        isOpen={!!editing}
        onClose={() => setEditing(null)}
        title={editing ? `Edit ${editing.name}` : ''}
      >
        {editing && (
          <div className="space-y-5">
            <CustomerForm
              initial={{
                name: editing.name,
                phone: editing.phone,
                notes: editing.notes ?? '',
                status: editing.status,
              }}
              phoneReadOnly
              isPending={updateMut.isPending}
              onSubmit={(values) =>
                updateMut.mutate(
                  {
                    id: editing.id,
                    data: { name: values.name, notes: values.notes ?? null, status: values.status },
                  },
                  { onSuccess: () => setEditing(null) }
                )
              }
              onCancel={() => setEditing(null)}
            />
            {/*
              Locked-out agents — chat-transfer is permanent unless the
              manager explicitly restores access here. This closes the
              one-way-door gap (an accidentally-checked Transfer Chat
              checkbox is reversible).
            */}
            <CustomerLockoutsSection customerId={editing.id} />
          </div>
        )}
      </Modal>

      {/* Delete confirm (single) */}
      <ConfirmModal
        isOpen={!!deleting}
        onClose={() => setDeleting(null)}
        title="Delete customer?"
        message={
          deleting
            ? `Permanently remove ${deleting.name} (${formatPhoneUS(deleting.phone)}) from the customer pool. WhatsApp message history is kept; only the assignment record is removed.`
            : ''
        }
        confirmText="Delete"
        variant="danger"
        onConfirm={() => {
          if (!deleting) return;
          deleteMut.mutate(deleting.id, { onSuccess: () => setDeleting(null) });
        }}
        loading={deleteMut.isPending}
      />

      {/* Bulk delete confirm */}
      <ConfirmModal
        isOpen={bulkDeleteConfirmOpen}
        onClose={() => setBulkDeleteConfirmOpen(false)}
        title={`Delete ${selectedIds.size} customer${selectedIds.size === 1 ? '' : 's'}?`}
        message={`Permanently remove ${selectedIds.size} customer${
          selectedIds.size === 1 ? '' : 's'
        } from the pool. WhatsApp message history is preserved; only the customer + assignment records are deleted.`}
        confirmText="Delete all"
        variant="danger"
        onConfirm={() => {
          bulkDeleteMut.mutate(Array.from(selectedIds), {
            onSuccess: () => {
              setSelectedIds(new Set());
              setBulkDeleteConfirmOpen(false);
            },
          });
        }}
        loading={bulkDeleteMut.isPending}
      />

      {/* Import modal */}
      <ImportCustomersModal
        isOpen={importOpen}
        onClose={() => setImportOpen(false)}
        agents={agents}
        onImported={() => refetch()}
      />

      {/* Single-row reassign confirm — only fires when there's a previous
          owner to lock out. Lets the manager opt into chat transfer per
          customer without going through the bulk path. */}
      <Modal
        isOpen={!!pendingReassign}
        onClose={() => {
          setPendingReassign(null);
          setPendingTransferChat(false);
        }}
        title="Reassign customer"
      >
        {pendingReassign && (
          <div className="space-y-4">
            <p className="text-sm text-[var(--foreground)]">
              Move <span className="font-medium">{pendingReassign.customer.name}</span> from{' '}
              <span className="font-medium">
                {pendingReassign.customer.assignedUserName ?? 'current owner'}
              </span>{' '}
              to{' '}
              <span className="font-medium">
                {agents.find((a) => a.id === pendingReassign.newUserId)?.fullName ?? 'new agent'}
              </span>
              ?
            </p>
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={pendingTransferChat}
                onChange={(e) => setPendingTransferChat(e.target.checked)}
                className="mt-0.5"
              />
              <div>
                <p className="text-sm font-medium text-[var(--foreground)]">
                  Also transfer chat history
                </p>
                <p className="text-xs text-[var(--muted-foreground)]">
                  The new agent inherits the past WhatsApp conversation. The previous agent is
                  locked out — they can no longer see the chat. Default off (reassign only).
                </p>
              </div>
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => {
                  setPendingReassign(null);
                  setPendingTransferChat(false);
                }}
                disabled={assignMut.isPending}
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (!pendingReassign) return;
                  assignMut.mutate(
                    {
                      id: pendingReassign.customer.id,
                      data: {
                        userId: pendingReassign.newUserId,
                        transferChat: pendingTransferChat,
                      },
                    },
                    {
                      onSuccess: () => {
                        setPendingReassign(null);
                        setPendingTransferChat(false);
                      },
                    }
                  );
                }}
                disabled={assignMut.isPending}
              >
                {assignMut.isPending ? 'Reassigning…' : 'Reassign'}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Components
// ---------------------------------------------------------------------------

function TabButton({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
        active
          ? 'border-[var(--border)] text-[var(--foreground)]'
          : 'border-transparent text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
      }`}
    >
      {icon}
      {children}
    </button>
  );
}
