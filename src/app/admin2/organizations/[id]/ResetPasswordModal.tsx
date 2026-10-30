'use client';

/**
 * Reset an existing user's password (admin). Sets a new temporary password the
 * admin can hand to the user, who can change it later. Reuses the proven admin
 * endpoint PUT /admin/users/:id/password (min 8 chars, RESET_PASSWORDS perm).
 * The new password is shown once (copyable) so it can be communicated.
 */

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { updateUserPassword } from '@/lib/api/services/admin-user.api';
import { Modal, Btn, fieldInput } from '../../_components/ui';

function genPassword(): string {
  const lower = 'abcdefghjkmnpqrstuvwxyz';
  const upper = 'ABCDEFGHJKMNPQRSTUVWXYZ';
  const digit = '23456789';
  const sym = '!@#$%';
  const all = lower + upper + digit + sym;
  const pick = (s: string) => s[Math.floor(Math.random() * s.length)];
  let p = pick(lower) + pick(upper) + pick(digit) + pick(sym);
  for (let i = 0; i < 6; i++) p += pick(all);
  return p.split('').sort(() => Math.random() - 0.5).join('');
}

export function ResetPasswordModal({
  user,
  onClose,
  onDone,
}: {
  user: { id: number; fullName: string | null; email: string | null };
  onClose: () => void;
  onDone: () => void;
}) {
  const [password, setPassword] = useState(genPassword());
  const [done, setDone] = useState(false);

  const save = useMutation({
    mutationFn: () => updateUserPassword(user.id, password),
    onSuccess: () => { setDone(true); onDone(); },
  });

  const valid = password.trim().length >= 8;

  return (
    <Modal onClose={() => !save.isPending && onClose()} title="Reset password" subtitle={`${user.fullName || 'User'}${user.email ? ` · ${user.email}` : ''}`}>
      {done ? (
        <div>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm dark:border-emerald-900 dark:bg-emerald-950/30">
            <div className="font-bold text-emerald-700 dark:text-emerald-300">Password updated.</div>
            <p className="mt-1 text-emerald-700/80 dark:text-emerald-300/80">Share this with the user — it won’t be shown again. They can change it after signing in.</p>
            <div className="mt-3 flex items-center gap-2">
              <code className="flex-1 rounded-lg bg-white px-3 py-2 font-mono text-sm dark:bg-slate-900">{password}</code>
              <Btn size="sm" onClick={() => navigator.clipboard?.writeText(password).catch(() => {})}>Copy</Btn>
            </div>
          </div>
          <div className="mt-4 flex justify-end"><Btn variant="primary" onClick={onClose}>Done</Btn></div>
        </div>
      ) : (
        <div>
          <label className="text-xs font-bold text-slate-500 dark:text-slate-400">New temporary password</label>
          <div className="mt-1 flex gap-2">
            <input value={password} onChange={(e) => setPassword(e.target.value)} className={fieldInput} />
            <Btn size="sm" onClick={() => setPassword(genPassword())}>Generate</Btn>
          </div>
          {!valid && <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">Must be at least 8 characters.</p>}
          {save.isError && <p className="mt-2 text-xs font-semibold text-red-600">{(save.error as Error)?.message || 'Could not reset the password.'}</p>}
          <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">Sets a new sign-in password immediately. The user keeps their number, extension and settings.</p>
          <div className="mt-4 flex justify-end gap-2">
            <Btn disabled={save.isPending} onClick={onClose}>Cancel</Btn>
            <Btn variant="primary" disabled={!valid || save.isPending} onClick={() => save.mutate()}>{save.isPending ? 'Resetting…' : 'Reset password'}</Btn>
          </div>
        </div>
      )}
    </Modal>
  );
}
