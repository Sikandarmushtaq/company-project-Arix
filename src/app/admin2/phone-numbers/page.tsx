'use client';

/**
 * Page 5 — Phone Numbers (cross-org inventory).
 *
 * Real data via GET /admin/numbers (search / filter / paginate). Each row opens
 * the Number drawer (identity + reassign + on-demand real diagnostic). "Add
 * Number" purchases + provisions a new DID into an org. Health is NOT shown as a
 * column here (it's a live multi-system check) — the drawer runs the real
 * diagnostic on demand, so the list never shows an unverified health value.
 */

import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/lib/stores/auth';
import { adminAccountApi, type AdminNumber } from '@/lib/api/services/admin-account.api';
import { PageHead } from '../_components/ui';
import { NumberDrawer } from './_components/NumberDrawer';

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'assigned', label: 'Assigned' },
  { key: 'unassigned', label: 'Available' },
  { key: 'inactive', label: 'Inactive' },
] as const;

const LIMIT = 25;

export default function PhoneNumbersPage() {
  const { user } = useAuthStore();
  const isSuperAdmin = user?.role === 'super_admin' || user?.role === 'superadmin';

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<AdminNumber | null>(null);

  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput.trim()); setPage(1); }, 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  const q = useQuery({
    queryKey: ['admin2', 'all-numbers', { search, filter, page }],
    queryFn: () => adminAccountApi.listAllNumbers({ search: search || undefined, filter, page, limit: LIMIT }),
    enabled: isSuperAdmin,
    staleTime: 15_000,
  });

  const numbers = q.data?.numbers ?? [];
  const meta = q.data?.meta;
  const totalPages = meta?.totalPages ?? 1;
  const fmtDate = useMemo(() => (iso?: string) => (iso ? new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '—'), []);

  const refresh = () => q.refetch();

  if (!isSuperAdmin) {
    return (
      <section>
        <h1 className="text-3xl font-black tracking-tight">Phone Numbers</h1>
        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900">
          The number inventory is available to platform super-admins.
        </div>
      </section>
    );
  }

  return (
    <section>
      <PageHead
        title={<>Phone Numbers {meta ? <span className="text-slate-400">({meta.total})</span> : null}</>}
        subtitle="Cross-organization DID inventory. Open a number to reassign or run a full health diagnostic."
      />

      {/* Filters + search */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex rounded-xl border border-slate-200 p-1 dark:border-slate-800">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => { setFilter(f.key); setPage(1); }}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold ${filter === f.key ? 'bg-[#FF6542] text-white' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <input
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search number, organization, or assignee…"
          className="min-w-[240px] flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none placeholder:text-slate-400 focus:border-[#FF6542] dark:border-slate-800 dark:bg-slate-900"
        />
        {q.isFetching && !q.isLoading && <span className="text-xs font-semibold text-slate-400">Updating…</span>}
      </div>

      {q.isError ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm font-semibold text-red-800 dark:border-red-950 dark:bg-red-950/30 dark:text-red-200">Numbers could not be loaded.</div>
      ) : !q.isLoading && numbers.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center dark:border-slate-700 dark:bg-slate-900">
          <h2 className="text-xl font-extrabold">{search || filter !== 'all' ? 'No matching numbers' : 'No numbers yet'}</h2>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{search || filter !== 'all' ? 'Try a different search or filter.' : 'Add the first number to an organization.'}</p>
        </div>
      ) : (
        <>
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-950/70 dark:text-slate-400">
                  <tr>
                    <th className="px-4 py-3">Number</th>
                    <th className="px-4 py-3">Organization</th>
                    <th className="px-4 py-3">Account</th>
                    <th className="px-4 py-3">Assignee</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">State</th>
                    <th className="px-4 py-3">Added</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {q.isLoading
                    ? [0, 1, 2, 3, 4].map((i) => (
                        <tr key={i} className="animate-pulse">{[0,1,2,3,4,5,6].map((j) => <td key={j} className="px-4 py-4"><div className="h-4 rounded bg-slate-200 dark:bg-slate-800" /></td>)}</tr>
                      ))
                    : numbers.map((n) => (
                        <tr key={n.id} onClick={() => setSelected(n)} className="cursor-pointer hover:bg-[#FF6542]/5">
                          <td className="px-4 py-4 font-mono font-bold">{n.phoneNumber}</td>
                          <td className="px-4 py-4">{n.orgName ?? <span className="text-slate-400">—</span>}</td>
                          <td className="px-4 py-4">
                            {n.tier === 'sub' ? (
                              <span
                                title={n.managedAccountId ?? undefined}
                                className="inline-flex max-w-[180px] items-center gap-1.5 rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-bold text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300"
                              >
                                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-500" />
                                <span className="truncate">Sub · {n.accountLabel}</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                                Mother
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-4">
                            {n.assignedUserName
                              ? <span>{n.assignedUserName}{n.assignedExtension ? <span className="text-slate-400"> · {n.assignedExtension}</span> : null}</span>
                              : <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">Available</span>}
                          </td>
                          <td className="px-4 py-4 text-slate-500 dark:text-slate-400">{n.numberType}</td>
                          <td className="px-4 py-4">
                            <span className={`inline-flex items-center gap-2 text-xs font-bold ${n.isActive ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500'}`}>
                              <span className={`h-2 w-2 rounded-full ${n.isActive ? 'bg-emerald-500' : 'bg-slate-400'}`} />{n.isActive ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td className="px-4 py-4 text-slate-500 dark:text-slate-400">{fmtDate(n.createdAt)}</td>
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
                <button type="button" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} className="rounded-xl border border-slate-200 px-3 py-2 font-bold disabled:opacity-40 dark:border-slate-700">← Prev</button>
                <button type="button" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))} className="rounded-xl border border-slate-200 px-3 py-2 font-bold disabled:opacity-40 dark:border-slate-700">Next →</button>
              </div>
            </div>
          )}
        </>
      )}

      {selected && <NumberDrawer number={selected} onClose={() => setSelected(null)} onChanged={() => { refresh(); }} />}
    </section>
  );
}
