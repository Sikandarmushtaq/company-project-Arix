'use client';

/**
 * Edit organization — admin2 Org Detail. Super-admin edit of the org's name, slug
 * and seat/number limits via adminService.updateOrganization (PUT /admin/
 * organizations/:id). Slug is lower-cased + trimmed; limits are clamped ≥ 1 to
 * match the backend schema.
 */

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { adminService } from '@/lib/api/services/admin.service';
import { adminKeys } from '@/lib/hooks/useAdmin';
import { toast } from '@/lib/stores/toast';
import { Modal, Btn } from '../../_components/ui';

const fieldCls =
  'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#FF6542] dark:border-slate-800 dark:bg-slate-950';

export function EditOrgModal({
  org,
  onClose,
}: {
  org: { id: number; name: string; slug: string; maxUsers: number; maxPhoneNumbers: number };
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [name, setName] = useState(org.name);
  const [slug, setSlug] = useState(org.slug);
  const [maxUsers, setMaxUsers] = useState(String(org.maxUsers));
  const [maxPhoneNumbers, setMaxPhoneNumbers] = useState(String(org.maxPhoneNumbers));

  const save = useMutation({
    mutationFn: () =>
      adminService.updateOrganization(org.id, {
        name: name.trim(),
        slug: slug.trim().toLowerCase(),
        // Schema requires ≥ 1 — clamp so the UI never sends a rejected value.
        maxUsers: Math.max(1, parseInt(maxUsers || '1', 10) || 1),
        maxPhoneNumbers: Math.max(1, parseInt(maxPhoneNumbers || '1', 10) || 1),
      }),
    onSuccess: () => {
      toast.success('Organization updated');
      qc.invalidateQueries({ queryKey: adminKeys.organizationDetail(org.id) });
      qc.invalidateQueries({ queryKey: adminKeys.organizations() });
      onClose();
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : 'Could not update organization'),
  });

  const dirty =
    name.trim() !== org.name ||
    slug.trim().toLowerCase() !== org.slug ||
    maxUsers !== String(org.maxUsers) ||
    maxPhoneNumbers !== String(org.maxPhoneNumbers);
  const valid = name.trim().length > 0 && slug.trim().length > 0;

  return (
    <Modal
      title="Edit organization"
      subtitle={`org #${org.id}`}
      onClose={() => (save.isPending ? undefined : onClose())}
      footer={
        <>
          <Btn onClick={onClose} disabled={save.isPending}>Cancel</Btn>
          <Btn variant="primary" onClick={() => save.mutate()} disabled={!dirty || !valid || save.isPending}>
            {save.isPending ? 'Saving…' : 'Save changes'}
          </Btn>
        </>
      }
    >
      <div className="space-y-3">
        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Name</span>
          <input className={`mt-1 ${fieldCls}`} value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Slug</span>
          <input
            className={`mt-1 font-mono ${fieldCls}`}
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
          />
          <span className="mt-1 block text-[11px] text-slate-400">Lower-cased identifier used in URLs.</span>
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Max users</span>
            <input type="number" min={1} className={`mt-1 ${fieldCls}`} value={maxUsers} onChange={(e) => setMaxUsers(e.target.value)} />
          </label>
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Max numbers</span>
            <input type="number" min={1} className={`mt-1 ${fieldCls}`} value={maxPhoneNumbers} onChange={(e) => setMaxPhoneNumbers(e.target.value)} />
          </label>
        </div>
      </div>
    </Modal>
  );
}
