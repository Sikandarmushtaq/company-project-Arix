'use client';

/**
 * Create / edit form for a customer record. Used by both the Add Customer
 * modal (no `initial`, phone editable) and the Edit Customer modal
 * (`initial` populated, phone read-only — re-keying a phone after creation
 * would split the conversation history).
 */

import React, { useState } from 'react';
import { Button, Input, StyledSelect } from '@/components/ui';
import { normalizePhone } from '@/lib/utils/phone';
import type { CustomerStatus } from '@/lib/api/services/customers.api';
import { STATUS_LABELS } from './customer-shared';

export interface CustomerFormValues {
  name: string;
  phone: string;
  notes?: string;
  status: CustomerStatus;
}

interface Props {
  initial?: Partial<CustomerFormValues>;
  phoneReadOnly?: boolean;
  isPending: boolean;
  onSubmit: (values: CustomerFormValues) => void;
  onCancel: () => void;
}

export function CustomerForm({ initial, phoneReadOnly, isPending, onSubmit, onCancel }: Props) {
  const [name, setName] = useState(initial?.name ?? '');
  const [phone, setPhone] = useState(initial?.phone ?? '');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [status, setStatus] = useState<CustomerStatus>(initial?.status ?? 'new');

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      name: name.trim(),
      phone: phoneReadOnly ? phone : normalizePhone(phone),
      notes: notes.trim() || undefined,
      status,
    });
  };

  const valid = name.trim().length > 0 && (phoneReadOnly || normalizePhone(phone).length >= 10);

  return (
    <form onSubmit={submit} className="space-y-4">
      <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} required />
      <Input
        label="Phone"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        readOnly={phoneReadOnly}
        hint={phoneReadOnly ? 'Phone is locked once a customer is created.' : '11 digits, no +'}
        required={!phoneReadOnly}
      />
      <div>
        <label className="block text-sm font-medium text-[var(--foreground)] mb-1">Status</label>
        <StyledSelect value={status} onChange={(v) => setStatus(v as CustomerStatus)}>
          {(Object.keys(STATUS_LABELS) as CustomerStatus[]).map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </StyledSelect>
      </div>
      <div>
        <label className="block text-sm font-medium text-[var(--foreground)] mb-1">
          Notes (optional)
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--input)] text-sm"
          placeholder="Context for the assigned agent…"
        />
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isPending}>
          Cancel
        </Button>
        <Button type="submit" disabled={!valid || isPending}>
          {isPending ? 'Saving…' : initial ? 'Save changes' : 'Create customer'}
        </Button>
      </div>
    </form>
  );
}
