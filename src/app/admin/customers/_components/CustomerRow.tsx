'use client';

/**
 * One row in the customer master table. Renders the customer's name +
 * unread badge, phone, status pill, inline assign dropdown, last activity,
 * and the row-level action buttons (edit / delete).
 *
 * Extracted from the parent page so the page itself stays a thin
 * composition + the row's render logic is testable and reviewable in
 * isolation.
 */

import React from 'react';
import { FaWhatsapp } from 'react-icons/fa';
import { FiEdit2, FiTrash2 } from 'react-icons/fi';
import { Button, StyledSelect } from '@/components/ui';
import { formatPhoneUS } from '@/lib/utils/phone';
import { formatRelativeTime } from '@/lib/utils/datetime';
import type { OrgCustomerWithAssignment } from '@/lib/api/services/customers.api';
import { STATUS_COLORS, STATUS_LABELS, type OrgMember } from './customer-shared';

interface Props {
  customer: OrgCustomerWithAssignment;
  agents: OrgMember[];
  isSelected: boolean;
  onToggleSelect: () => void;
  onAssign: (userId: number | null) => void;
  onEdit: () => void;
  onDelete: () => void;
  isAssignBusy: boolean;
}

export function CustomerRow({
  customer,
  agents,
  isSelected,
  onToggleSelect,
  onAssign,
  onEdit,
  onDelete,
  isAssignBusy,
}: Props) {
  return (
    <tr
      className={`border-b border-[var(--border)] hover:bg-[var(--muted)]/20 ${
        isSelected ? 'bg-[var(--primary-50)] dark:bg-[var(--primary-900)]/10' : ''
      }`}
    >
      <td className="py-3 px-3">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={onToggleSelect}
          aria-label={`Select ${customer.name}`}
        />
      </td>
      <td className="py-3 px-4">
        <div className="flex items-center gap-2">
          <FaWhatsapp className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
          <span className="font-medium text-[var(--foreground)]">{customer.name}</span>
          {customer.unreadCount > 0 && (
            <span className="text-xs px-1.5 py-0.5 rounded-full bg-green-500 text-white font-semibold">
              {customer.unreadCount}
            </span>
          )}
        </div>
      </td>
      <td className="py-3 px-4 text-[var(--muted-foreground)] tabular-nums">
        {formatPhoneUS(customer.phone)}
      </td>
      <td className="py-3 px-4">
        <span
          className={`inline-flex text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[customer.status]}`}
        >
          {STATUS_LABELS[customer.status]}
        </span>
      </td>
      <td className="py-3 px-4">
        <StyledSelect
          value={String(customer.assignedUserId ?? '')}
          onChange={(v) => {
            onAssign(v === '' ? null : Number(v));
          }}
          disabled={isAssignBusy}
          className="h-8 w-auto text-xs"
        >
          <option value="">— Unassigned —</option>
          {agents.map((a) => (
            <option key={a.id} value={a.id}>
              {a.fullName}
            </option>
          ))}
        </StyledSelect>
      </td>
      <td className="py-3 px-4 text-xs text-[var(--muted-foreground)]">
        {customer.lastMessageAt ? formatRelativeTime(customer.lastMessageAt) : 'No messages yet'}
      </td>
      <td className="py-3 px-4 text-right">
        <div className="inline-flex items-center gap-1">
          <Button variant="ghost" size="icon-sm" onClick={onEdit} aria-label="Edit">
            <FiEdit2 className="w-3.5 h-3.5" />
          </Button>
          <Button variant="ghost" size="icon-sm" onClick={onDelete} aria-label="Delete">
            <FiTrash2 className="w-3.5 h-3.5 text-[var(--danger)]" />
          </Button>
        </div>
      </td>
    </tr>
  );
}
