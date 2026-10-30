'use client';

/**
 * /admin2/audit — platform audit log.
 *
 * The admin2 Live Operations page shows only the ~10 most recent events; this is the
 * full, paginated, filterable history for compliance / incident review. Reads the
 * same `/admin/audit` endpoint the legacy /admin panel uses (super-admin only) via
 * the shared useAuditLogs hook — no new backend surface.
 */

import { useMemo, useState } from 'react';
import { useAuditLogs } from '@/lib/hooks/useAdmin';
import type { AuditLog } from '@/lib/api/services/admin.service';
import { Card, PageHead, Btn, EmptyState, ErrorState, RowSkeleton, Pill, fieldInput } from '../_components/ui';

const LIMIT = 25;

const TARGET_TYPES: { value: string; label: string }[] = [
  { value: '', label: 'All targets' },
  { value: 'user', label: 'User' },
  { value: 'device', label: 'Device' },
  { value: 'session', label: 'Session' },
  { value: 'recording', label: 'Recording' },
  { value: 'settings', label: 'Settings' },
  { value: 'system', label: 'System' },
];

function fmtTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function humanize(action: string): string {
  return action.replace(/[._]/g, ' ');
}

function targetLabel(log: AuditLog): string {
  const name = log.targetName || log.targetId;
  return name ? `${log.targetType}: ${name}` : log.targetType;
}

export default function Admin2AuditPage() {
  const [page, setPage] = useState(1);
  const [targetType, setTargetType] = useState('');
  // `searchInput` is the live text box; `search` is what's actually queried (applied
  // on submit) so we don't fire a request on every keystroke.
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');

  const filters = useMemo(
    () => ({
      page,
      limit: LIMIT,
      search: search || undefined,
      targetType: targetType || undefined,
    }),
    [page, search, targetType]
  );

  const { data, isLoading, isError, isFetching, refetch } = useAuditLogs(filters);

  const logs = data?.logs ?? [];
  const meta = data?.meta;
  const totalPages = meta?.totalPages ?? 1;
  const total = meta?.total ?? 0;
  const active = !!search || !!targetType;

  const applySearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  };

  const resetFilters = () => {
    setSearchInput('');
    setSearch('');
    setTargetType('');
    setPage(1);
  };

  return (
    <section className="space-y-5">
      <PageHead
        title="Audit Log"
        subtitle="Every administrative action across the platform — the full, searchable history."
        actions={
          <Btn variant="default" onClick={() => refetch()} disabled={isFetching}>
            {isFetching ? 'Refreshing…' : 'Refresh'}
          </Btn>
        }
      />

      {/* Filters */}
      <Card className="flex flex-wrap items-center gap-3 p-4">
        <form onSubmit={applySearch} className="flex min-w-[220px] flex-1 items-center gap-2">
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search action, admin, target…"
            className={`${fieldInput} flex-1`}
            aria-label="Search audit log"
          />
          <Btn type="submit" variant="primary">Search</Btn>
        </form>
        <select
          value={targetType}
          onChange={(e) => {
            setPage(1);
            setTargetType(e.target.value);
          }}
          className={`${fieldInput} w-auto`}
          aria-label="Filter by target type"
        >
          {TARGET_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
        {active && (
          <Btn variant="default" onClick={resetFilters}>
            Clear
          </Btn>
        )}
      </Card>

      <Card className="p-0">
        {isError ? (
          <div className="p-6">
            <ErrorState>Couldn’t load the audit log. Please try again.</ErrorState>
          </div>
        ) : isLoading ? (
          <div className="p-4">
            <RowSkeleton cols={5} />
            <RowSkeleton cols={5} />
            <RowSkeleton cols={5} />
          </div>
        ) : logs.length === 0 ? (
          <div className="p-6">
            <EmptyState
              title={active ? 'No matching entries' : 'No audit activity yet'}
              subtitle={active ? 'Try a different search or filter.' : 'Administrative actions will appear here as they happen.'}
              action={active ? <Btn variant="default" onClick={resetFilters}>Clear filters</Btn> : undefined}
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:border-slate-800">
                  <th className="px-4 py-3">When</th>
                  <th className="px-4 py-3">Admin</th>
                  <th className="px-4 py-3">Action</th>
                  <th className="px-4 py-3">Target</th>
                  <th className="px-4 py-3">IP</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr
                    key={log.id}
                    className="border-b border-slate-100 last:border-0 hover:bg-slate-50 dark:border-slate-800/60 dark:hover:bg-slate-900/40"
                  >
                    <td className="whitespace-nowrap px-4 py-3 text-slate-500 dark:text-slate-400">
                      {fmtTime(log.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-semibold">{log.adminName || '—'}</div>
                      {log.adminEmail && (
                        <div className="text-xs text-slate-400">{log.adminEmail}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Pill tone="coral">{humanize(log.action)}</Pill>
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{targetLabel(log)}</td>
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-slate-400">
                      {log.ipAddress || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {!isLoading && !isError && logs.length > 0 && (
          <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 text-sm dark:border-slate-800">
            <span className="text-slate-500 dark:text-slate-400">
              Page {meta?.page ?? page} of {totalPages} · {total.toLocaleString()} entries
            </span>
            <div className="flex items-center gap-2">
              <Btn variant="default" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
                Previous
              </Btn>
              <Btn
                variant="default"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
              >
                Next
              </Btn>
            </div>
          </div>
        )}
      </Card>
    </section>
  );
}
