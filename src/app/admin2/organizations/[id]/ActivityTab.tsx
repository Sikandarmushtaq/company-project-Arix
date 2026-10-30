'use client';

/**
 * Org Detail → Activity tab. Real audit-log timeline of events touching the org
 * (member actions + admin actions targeting the org) from
 * GET /admin/organizations/:id/activity. Paginated; read-only.
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { adminAccountApi, type OrgActivityItem } from '@/lib/api/services/admin-account.api';
import { Card, SectionTitle, Btn } from '../../_components/ui';

/** Humanize a dotted action code (org.call_soft_cap.updated → "call soft cap updated"). */
function humanizeAction(action: string): string {
  const parts = action.split('.');
  const tail = parts.length > 1 ? parts.slice(1) : parts;
  return tail.join(' ').replace(/_/g, ' ');
}
function actionTone(action: string): string {
  if (/delete|close|purge|ban|block|reject|fail|revoke/i.test(action)) return 'bg-red-500';
  if (/create|add|purchase|activate|reactivate|approve|grant|enable/i.test(action)) return 'bg-emerald-500';
  if (/update|change|reset|assign|sync|repair|set/i.test(action)) return 'bg-[#FF6542]';
  return 'bg-slate-400';
}

export function ActivityTab({ orgId }: { orgId: number }) {
  const [page, setPage] = useState(1);
  const q = useQuery({
    queryKey: ['admin2', 'org-activity', orgId, page],
    queryFn: () => adminAccountApi.getOrgActivity(orgId, page, 30),
    enabled: orgId > 0,
    staleTime: 15_000,
  });

  const items: OrgActivityItem[] = q.data?.items ?? [];
  const meta = q.data?.meta;
  const totalPages = meta?.totalPages ?? 1;

  return (
    <Card className="p-5">
      <SectionTitle action={meta ? <span className="text-xs font-bold text-slate-400">{meta.total} event{meta.total !== 1 ? 's' : ''}</span> : undefined}>
        Activity
      </SectionTitle>

      {q.isLoading ? (
        <div className="space-y-2">{[0, 1, 2, 3].map((i) => <div key={i} className="h-12 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />)}</div>
      ) : q.isError ? (
        <div className="text-sm text-slate-400">Could not load activity.</div>
      ) : items.length === 0 ? (
        <div className="py-8 text-center text-sm text-slate-400">No recorded activity for this organization yet.</div>
      ) : (
        <ol className="relative ml-1 border-l border-slate-200 dark:border-slate-800">
          {items.map((it) => (
            <li key={it.id} className="mb-4 ml-4 last:mb-0">
              <span className={`absolute -left-[5px] mt-1.5 h-2.5 w-2.5 rounded-full ${actionTone(it.action)}`} />
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div className="text-sm">
                  <span className="font-bold">{it.adminName}</span>{' '}
                  <span className="text-slate-600 dark:text-slate-300">{humanizeAction(it.action)}</span>
                  {it.targetName && <span className="text-slate-500 dark:text-slate-400"> — {it.targetName}</span>}
                </div>
                <time className="text-xs text-slate-400">{new Date(it.createdAt).toLocaleString()}</time>
              </div>
              <div className="mt-0.5 font-mono text-[11px] text-slate-400">{it.action}{it.ipAddress ? ` · ${it.ipAddress}` : ''}</div>
            </li>
          ))}
        </ol>
      )}

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm">
          <span className="text-slate-500 dark:text-slate-400">Page {page} of {totalPages}</span>
          <div className="flex gap-2">
            <Btn size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>← Prev</Btn>
            <Btn size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>Next →</Btn>
          </div>
        </div>
      )}
    </Card>
  );
}
