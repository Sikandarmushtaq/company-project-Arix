'use client';

/**
 * Users — cross-tenant directory (cross-tenant lookup / troubleshooting, read-only).
 *
 * Wired to GET /admin/users (useUsers: page/limit/search/role/banned). This is a
 * SUPER-ADMIN cross-org view for support — intentionally NO "Add User" button
 * (users are created inside an organization, Page 2 / Create-Org wizard). Rows
 * link to the owning org's detail page.
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/stores/auth';
import { useAdminUsers } from '@/lib/hooks/useAdmin';
import type { AdminUser } from '@/lib/api/services';

const LIMIT = 25;
type RoleFilter = '' | 'owner' | 'manager' | 'user' | 'admin';

function StatusPill({ u }: { u: AdminUser }) {
  const [label, cls] = u.banned
    ? ['Banned', 'bg-red-500/10 text-red-600 dark:text-red-400']
    : u.isActive
      ? ['Active', 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400']
      : ['Inactive', 'bg-slate-500/10 text-slate-500'];
  return <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${cls}`}>{label}</span>;
}

function Skeleton() {
  return (
    <tr className="animate-pulse">
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <td key={i} className="px-4 py-4"><div className="h-4 rounded bg-slate-200 dark:bg-slate-800" /></td>
      ))}
    </tr>
  );
}

export default function UserDirectoryPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const isSuperAdmin = user?.role === 'super_admin' || user?.role === 'superadmin';

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [role, setRole] = useState<RoleFilter>('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput.trim()); setPage(1); }, 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  const { data, isLoading, isError, isFetching } = useAdminUsers({
    page,
    limit: LIMIT,
    search: search || undefined,
    role: role || undefined,
  });

  const users: AdminUser[] = data?.users ?? [];
  const meta = data?.meta;
  const totalPages = meta?.totalPages ?? 1;
  const fmtDate = (iso?: string) =>
    iso ? new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '—';

  if (!isSuperAdmin) {
    return (
      <section>
        <h1 className="text-3xl font-black tracking-tight">Users</h1>
        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900">
          The cross-tenant user directory is available to platform super-admins. Manage your own team in your organization.
        </div>
      </section>
    );
  }

  return (
    <section>
      <div className="mb-6">
        <h1 className="text-3xl font-black tracking-tight">
          Users {meta ? <span className="text-slate-400">({meta.total})</span> : null}
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Cross-tenant lookup &amp; troubleshooting. Users are created inside an organization, not here.
        </p>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          aria-label="Search users"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search by name, email, or number…"
          className="min-w-[260px] flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none placeholder:text-slate-400 focus:border-[#FF6542] dark:border-slate-800 dark:bg-slate-900"
        />
        <select
          value={role}
          onChange={(e) => { setRole(e.target.value as RoleFilter); setPage(1); }}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-800 dark:bg-slate-900"
        >
          <option value="">All roles</option>
          <option value="owner">Owner</option>
          <option value="manager">Manager</option>
          <option value="user">User</option>
          <option value="admin">Admin</option>
        </select>
        {isFetching && !isLoading && <span className="text-xs font-semibold text-slate-400">Updating…</span>}
      </div>

      {isError ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm font-semibold text-red-800 dark:border-red-950 dark:bg-red-950/30 dark:text-red-200">
          Users could not be loaded. Please retry.
        </div>
      ) : !isLoading && users.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center dark:border-slate-700 dark:bg-slate-900">
          <h2 className="text-xl font-extrabold">{search || role ? 'No matching users' : 'No users'}</h2>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{search || role ? 'Try a different search or filter.' : ''}</p>
        </div>
      ) : (
        <>
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-950/70 dark:text-slate-400">
                  <tr>
                    <th className="px-4 py-3">User</th>
                    <th className="px-4 py-3">Organization</th>
                    <th className="px-4 py-3">Role</th>
                    <th className="px-4 py-3">Number</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {isLoading
                    ? [0, 1, 2, 3, 4].map((i) => <Skeleton key={i} />)
                    : users.map((u) => (
                        <tr key={u.id} className="hover:bg-[#FF6542]/5">
                          <td className="px-4 py-4">
                            <div className="font-extrabold">{u.fullName || '—'}</div>
                            <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{u.email}</div>
                          </td>
                          <td className="px-4 py-4">
                            {u.organizationId ? (
                              <button
                                type="button"
                                onClick={() => router.push(`/admin2/organizations/${u.organizationId}`)}
                                className="font-semibold text-[#FF6542] hover:underline"
                              >
                                {u.organizationName || `Org #${u.organizationId}`}
                              </button>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                          <td className="px-4 py-4 capitalize">{u.role}</td>
                          <td className="px-4 py-4">{u.senderPhone || <span className="text-slate-400">—</span>}</td>
                          <td className="px-4 py-4"><StatusPill u={u} /></td>
                          <td className="px-4 py-4 text-slate-500 dark:text-slate-400">{fmtDate(u.createdAt)}</td>
                        </tr>
                      ))}
                </tbody>
              </table>
            </div>
          </div>

          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between text-sm">
              <span className="text-slate-500 dark:text-slate-400">Page {page} of {totalPages}</span>
              <div className="flex gap-2">
                <button type="button" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="rounded-xl border border-slate-200 px-3 py-2 font-bold disabled:opacity-40 dark:border-slate-700">← Prev</button>
                <button type="button" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="rounded-xl border border-slate-200 px-3 py-2 font-bold disabled:opacity-40 dark:border-slate-700">Next →</button>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}
