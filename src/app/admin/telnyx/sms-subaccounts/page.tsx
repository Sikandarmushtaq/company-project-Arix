'use client';

/**
 * Admin — Telnyx SMS Sub-accounts
 *
 * Lists the manager's Telnyx managed (sub-)accounts and lets a super-admin
 * register the SMS-active ones by pasting their V2 API key (Telnyx surfaces a
 * managed account's key only once at creation, so a portal-created sub must be
 * pasted). Registered SMS-active subs become assignment targets in the
 * Create-Account wizard.
 */

import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FiRefreshCw, FiKey, FiTrash2, FiCheckCircle, FiXCircle } from 'react-icons/fi';
import { Card, CardContent, CardHeader, CardTitle, Button, Input, Badge, Modal } from '@/components/ui';
import { toast } from '@/lib/stores/toast';
import { adminAccountApi, type AdminSmsSubaccount } from '@/lib/api/services/admin-account.api';

export default function SmsSubaccountsPage() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<AdminSmsSubaccount | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [label, setLabel] = useState('');

  const list = useQuery({
    queryKey: ['admin-sms-subaccounts'],
    queryFn: () => adminAccountApi.listSmsSubaccounts(),
  });

  const register = useMutation({
    mutationFn: () =>
      adminAccountApi.registerSmsSubaccount({
        managedAccountId: editing!.managedAccountId,
        apiKey: apiKey.trim(),
        label: label.trim() || undefined,
      }),
    onSuccess: (data) => {
      toast[data.smsActive ? 'success' : 'info'](
        data.smsActive
          ? 'Registered — SMS-active (messaging profile + ACTIVE 10DLC campaign found).'
          : 'Registered, but NOT SMS-active yet (no active messaging profile + ACTIVE 10DLC campaign).'
      );
      qc.invalidateQueries({ queryKey: ['admin-sms-subaccounts'] });
      closeModal();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Could not register the API key'),
  });

  const remove = useMutation({
    mutationFn: (id: string) => adminAccountApi.unregisterSmsSubaccount(id),
    onSuccess: () => {
      toast.success('Removed from the registry');
      qc.invalidateQueries({ queryKey: ['admin-sms-subaccounts'] });
    },
    onError: () => toast.error('Could not remove'),
  });

  const openModal = (row: AdminSmsSubaccount) => {
    setEditing(row);
    setApiKey('');
    setLabel(row.organizationName ?? '');
  };
  const closeModal = () => {
    setEditing(null);
    setApiKey('');
    setLabel('');
  };

  const rows = list.data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">Telnyx SMS Sub-accounts</h1>
          <p className="mt-1 max-w-2xl text-sm text-[var(--muted-foreground)]">
            Register a managed sub-account for SMS by pasting its V2 API key. We verify it, detect
            whether it has an active messaging profile + an ACTIVE 10DLC campaign, and set up a
            voice keycard. SMS-active subs become assignment targets in the Create-Account wizard.
          </p>
        </div>
        <Button variant="secondary" onClick={() => list.refetch()} disabled={list.isFetching}>
          <FiRefreshCw className={`h-4 w-4 ${list.isFetching ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Managed accounts ({rows.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {list.isLoading ? (
            <p className="py-8 text-center text-sm text-[var(--muted-foreground)]">Loading…</p>
          ) : rows.length === 0 ? (
            <p className="py-8 text-center text-sm text-[var(--muted-foreground)]">
              No managed sub-accounts found on this Telnyx account.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)] text-left text-xs uppercase tracking-wide text-[var(--muted-foreground)]">
                    <th className="py-2 pr-4">Account</th>
                    <th className="py-2 pr-4">Telnyx status</th>
                    <th className="py-2 pr-4">SMS</th>
                    <th className="py-2 pr-4">10DLC</th>
                    <th className="py-2 pr-4">Voice keycard</th>
                    <th className="py-2 pr-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {rows.map((r) => (
                    <tr key={r.managedAccountId}>
                      <td className="py-3 pr-4">
                        <div className="font-medium text-[var(--foreground)]">
                          {r.organizationName || r.email || 'Unnamed'}
                        </div>
                        <div className="font-mono text-[11px] text-[var(--muted-foreground)]">
                          {r.managedAccountId}
                        </div>
                      </td>
                      <td className="py-3 pr-4 text-[var(--muted-foreground)]">
                        {r.status ?? '—'}
                      </td>
                      <td className="py-3 pr-4">
                        {!r.registered ? (
                          <Badge variant="secondary">Not registered</Badge>
                        ) : r.smsActive ? (
                          <Badge variant="success">
                            <FiCheckCircle className="mr-1 inline h-3 w-3" />
                            Active
                          </Badge>
                        ) : (
                          <Badge variant="warning">
                            <FiXCircle className="mr-1 inline h-3 w-3" />
                            Not active
                          </Badge>
                        )}
                      </td>
                      <td className="py-3 pr-4 text-[var(--muted-foreground)]">
                        {r.campaignStatus ?? '—'}
                      </td>
                      <td className="py-3 pr-4 text-[var(--muted-foreground)]">
                        {r.registered ? (r.hasVoiceKeycard ? 'Yes' : 'No') : '—'}
                      </td>
                      <td className="py-3 pr-4">
                        <div className="flex items-center justify-end gap-1">
                          <Button size="sm" variant="ghost" onClick={() => openModal(r)}>
                            <FiKey className="h-4 w-4" />
                            {r.registered ? 'Update key' : 'Register'}
                          </Button>
                          {r.registered && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => remove.mutate(r.managedAccountId)}
                              disabled={remove.isPending}
                              title="Remove from registry"
                            >
                              <FiTrash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Modal
        isOpen={!!editing}
        onClose={closeModal}
        title={editing?.registered ? 'Update API key' : 'Register sub-account'}
        size="md"
      >
        <div className="space-y-4">
          <p className="text-sm text-[var(--muted-foreground)]">
            Paste the V2 API key for{' '}
            <span className="font-medium text-[var(--foreground)]">
              {editing?.organizationName || editing?.email || editing?.managedAccountId}
            </span>
            . We verify it against Telnyx and detect SMS capability. The key is stored encrypted.
          </p>
          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--foreground)]">
              API key (KEY…)
            </label>
            <Input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="KEY01A0…"
              autoComplete="off"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--foreground)]">
              Label (optional)
            </label>
            <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Soul Nex Med" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={closeModal} disabled={register.isPending}>
              Cancel
            </Button>
            <Button
              onClick={() => register.mutate()}
              disabled={!apiKey.trim() || register.isPending}
              loading={register.isPending}
            >
              Verify &amp; save
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
