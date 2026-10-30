'use client';

/**
 * Access Control — platform roles & permissions. Lists admin/manager accounts
 * (who can do what), shows per-role default counts, and opens a per-user
 * permission editor (grant/revoke overrides). Reuses the deployed permissions
 * API; super-admin only.
 */

import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/lib/stores/auth';
import { permissionsService, type UserWithPermissions } from '@/lib/api/services/permissions.service';
import { PageHead, Card, SectionTitle, Metric } from '../_components/ui';
import { PermissionEditorDrawer } from './PermissionEditorDrawer';

const ROLE_BADGE: Record<string, string> = {
  super_admin: 'bg-[#FF6542]/10 text-[#b8462c] dark:text-[#ffb09a]',
  admin: 'bg-violet-500/10 text-violet-600 dark:text-violet-400',
  manager: 'bg-sky-500/10 text-sky-600 dark:text-sky-400',
  user: 'bg-slate-500/10 text-slate-500',
  owner: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
};

export default function AccessControlPage() {
  const { user } = useAuthStore();
  const isSuperAdmin = user?.role === 'super_admin' || user?.role === 'superadmin';

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('');
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<UserWithPermissions | null>(null);

  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput.trim()); setPage(1); }, 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  const usersQ = useQuery({
    queryKey: ['admin2', 'perm-users', { search, role, page }],
    queryFn: () => permissionsService.getUsersWithPermissions({ page, limit: 25, search: search || undefined, role: role || undefined }),
    enabled: isSuperAdmin,
    staleTime: 15_000,
  });
  const rolesQ = useQuery({
    queryKey: ['admin2', 'role-defaults'],
    queryFn: () => permissionsService.getRoleDefaults(),
    enabled: isSuperAdmin,
    staleTime: 5 * 60_000,
  });

  const data = usersQ.data?.data;
  const users = data?.users ?? [];
  const meta = data?.meta;
  const totalPages = meta?.totalPages ?? 1;
  const roleDefaults = rolesQ.data?.data;

  const roleCounts = useMemo(() => ({
    admin: roleDefaults?.admin?.length ?? 0,
    manager: roleDefaults?.manager?.length ?? 0,
    user: roleDefaults?.user?.length ?? 0,
  }), [roleDefaults]);

  if (!isSuperAdmin) {
    return (
      <section>
        <h1 className="text-3xl font-black tracking-tight">Access Control</h1>
        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900">
          Access control is available to platform super-admins.
        </div>
      </section>
    );
  }

  return (
    <section>
      <PageHead title="Access Control" subtitle="Platform roles & permissions. Open a user to grant or revoke permissions." />

      {/* Role reference (real default counts) */}
      <div className="grid gap-4 md:grid-cols-4">
        <Metric label="Super admin" value="Full" sub="all permissions" />
        <Metric label="Admin role" value={roleCounts.admin} sub="default permissions" subTone="off" />
        <Metric label="Manager role" value={roleCounts.manager} sub="default permissions" subTone="off" />
        <Metric label="User role" value={roleCounts.user} sub="default permissions" subTone="off" />
      </div>

      {/* Filters */}
      <div className="mb-4 mt-4 flex flex-wrap items-center gap-2">
        <div className="flex rounded-xl border border-slate-200 p-1 dark:border-slate-800">
          {[['', 'All'], ['super_admin', 'Super'], ['admin', 'Admin'], ['manager', 'Manager']].map(([k, label]) => (
            <button key={k} type="button" onClick={() => { setRole(k); setPage(1); }} className={`rounded-lg px-3 py-1.5 text-xs font-bold ${role === k ? 'bg-[#FF6542] text-white' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}>{label}</button>
          ))}
        </div>
        <input value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder="Search name or email…" className="min-w-[240px] flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none placeholder:text-slate-400 focus:border-[#FF6542] dark:border-slate-800 dark:bg-slate-900" />
      </div>

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-950/70 dark:text-slate-400">
              <tr><th className="px-4 py-3">User</th><th className="px-4 py-3">Role</th><th className="px-4 py-3">Effective permissions</th><th className="px-4 py-3">Overrides</th><th className="px-4 py-3"></th></tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {usersQ.isLoading ? (
                [0,1,2,3].map((i) => <tr key={i} className="animate-pulse">{[0,1,2,3,4].map((j)=><td key={j} className="px-4 py-4"><div className="h-4 rounded bg-slate-200 dark:bg-slate-800" /></td>)}</tr>)
              ) : usersQ.isError ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-red-600">Could not load users.</td></tr>
              ) : users.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-400">No matching users.</td></tr>
              ) : (
                users.map((u) => {
                  const effCount = Object.values(u.effectivePermissions).filter(Boolean).length;
                  return (
                    <tr key={u.id} onClick={() => setEditing(u)} className="cursor-pointer hover:bg-[#FF6542]/5">
                      <td className="px-4 py-4"><div className="font-extrabold">{u.fullName || '—'}</div><div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{u.email}</div></td>
                      <td className="px-4 py-4"><span className={`rounded-full px-2 py-0.5 text-xs font-bold capitalize ${ROLE_BADGE[u.role] ?? 'bg-slate-500/10 text-slate-500'}`}>{u.role.replace('_', ' ')}</span></td>
                      <td className="px-4 py-4 font-semibold">{u.role === 'super_admin' ? <span className="text-emerald-600 dark:text-emerald-400">Full</span> : effCount}</td>
                      <td className="px-4 py-4">{u.overrideCount > 0 ? <span className="rounded-full bg-[#FF6542]/10 px-2 py-0.5 text-xs font-bold text-[#b8462c] dark:text-[#ffb09a]">{u.overrideCount}</span> : <span className="text-slate-400">—</span>}</td>
                      <td className="px-4 py-4 text-right"><span className="text-xs font-bold text-[#FF6542]">Edit →</span></td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm">
          <span className="text-slate-500 dark:text-slate-400">Page {page} of {totalPages}</span>
          <div className="flex gap-2">
            <button type="button" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} className="rounded-xl border border-slate-200 px-3 py-2 font-bold disabled:opacity-40 dark:border-slate-700">← Prev</button>
            <button type="button" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))} className="rounded-xl border border-slate-200 px-3 py-2 font-bold disabled:opacity-40 dark:border-slate-700">Next →</button>
          </div>
        </div>
      )}

      {editing && <PermissionEditorDrawer user={editing} onClose={() => { setEditing(null); usersQ.refetch(); }} />}
    </section>
  );
}
