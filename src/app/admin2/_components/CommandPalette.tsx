'use client';

/**
 * Item 13 — Command palette (Ctrl/⌘-K) + global search, matching the prototype.
 * Live-searches REAL endpoints (useOrganizations / useAdminUsers by their `search`
 * param) as you type, plus quick actions and navigation. No mock results.
 */

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useOrganizations } from '@/lib/hooks/useAdmin';
import { adminService } from '@/lib/api/services';

type Props = { open: boolean; onClose: () => void };

const ACTIONS = [
  { label: 'Create Organization', href: '/admin2/onboarding', kind: 'Action' },
  { label: 'Go to Organizations', href: '/admin2/organizations', kind: 'Navigation' },
  { label: 'Go to Users', href: '/admin2/users', kind: 'Navigation' },
  { label: 'Go to Phone Numbers', href: '/admin2/phone-numbers', kind: 'Navigation' },
  { label: 'Go to Telephony Accounts', href: '/admin2/telephony', kind: 'Navigation' },
  { label: 'Go to Diagnostics', href: '/admin2/diagnostics', kind: 'Navigation' },
];

export function CommandPalette({ open, onClose }: Props) {
  const router = useRouter();
  const [raw, setRaw] = useState('');
  const [q, setQ] = useState('');

  // Debounce the live search so we don't fire a request per keystroke.
  useEffect(() => {
    const t = setTimeout(() => setQ(raw.trim()), 250);
    return () => clearTimeout(t);
  }, [raw]);

  // Reset on close.
  useEffect(() => {
    if (!open) {
      setRaw('');
      setQ('');
    }
  }, [open]);

  const hasQuery = q.length >= 2;
  const { data: orgData, isFetching: orgFetching } = useOrganizations(
    { page: 1, limit: 6, search: q },
    { enabled: open && hasQuery }
  );
  // Gated query (the palette is always mounted; only fetch when open + a real query).
  const { data: userData, isFetching: userFetching } = useQuery({
    queryKey: ['admin2', 'cmdk-users', q],
    queryFn: () => adminService.getUsers({ page: 1, limit: 6, search: q }),
    enabled: open && hasQuery,
    staleTime: 15_000,
  });

  const orgs = hasQuery ? (orgData?.organizations ?? []) : [];
  const users = hasQuery ? (userData?.users ?? []) : [];

  const filteredActions = useMemo(() => {
    if (!q) return ACTIONS;
    const lc = q.toLowerCase();
    return ACTIONS.filter((a) => a.label.toLowerCase().includes(lc));
  }, [q]);

  const go = (href: string) => {
    onClose();
    router.push(href);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] bg-slate-950/40" onClick={onClose}>
      <div
        className="mx-auto mt-[12vh] w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          autoFocus
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          placeholder="Search organizations, users, or run a command…"
          className="w-full border-b border-slate-200 bg-transparent px-5 py-4 text-base outline-none placeholder:text-slate-400 dark:border-slate-800"
        />
        <div className="max-h-[60vh] overflow-auto py-2">
          {/* Actions / navigation */}
          {filteredActions.length > 0 && (
            <Section title="Actions">
              {filteredActions.map((a) => (
                <Row key={a.href + a.label} onClick={() => go(a.href)} right={a.kind}>
                  {a.label}
                </Row>
              ))}
            </Section>
          )}

          {hasQuery && (
            <>
              <Section title={`Organizations${orgFetching ? ' · …' : ''}`}>
                {orgs.length === 0 && !orgFetching ? (
                  <Empty>No organizations match “{q}”.</Empty>
                ) : (
                  orgs.map((o) => (
                    <Row key={`org-${o.id}`} onClick={() => go(`/admin2/organizations/${o.id}`)} right="Organization">
                      <span className="font-semibold">{o.name}</span>{' '}
                      <span className="font-mono text-xs text-slate-400">{o.slug}</span>
                    </Row>
                  ))
                )}
              </Section>

              <Section title={`Users${userFetching ? ' · …' : ''}`}>
                {users.length === 0 && !userFetching ? (
                  <Empty>No users match “{q}”.</Empty>
                ) : (
                  users.map((u) => (
                    <Row
                      key={`user-${u.id}`}
                      onClick={() => go(u.organizationId ? `/admin2/organizations/${u.organizationId}` : '/admin2/users')}
                      right={u.organizationName || 'User'}
                    >
                      <span className="font-semibold">{u.fullName || u.email}</span>{' '}
                      <span className="text-xs text-slate-400">{u.email}</span>
                    </Row>
                  ))
                )}
              </Section>
            </>
          )}

          {!hasQuery && (
            <p className="px-5 py-3 text-xs text-slate-400">Type at least 2 characters to search organizations and users.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-1">
      <div className="px-5 pb-1 pt-2 text-[11px] font-bold uppercase tracking-wide text-slate-400">{title}</div>
      {children}
    </div>
  );
}

function Row({ children, onClick, right }: { children: React.ReactNode; onClick: () => void; right?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-between px-5 py-2.5 text-left text-sm hover:bg-[#FF6542]/5"
    >
      <span className="truncate">{children}</span>
      {right && <span className="ml-4 shrink-0 text-xs text-slate-400">{right}</span>}
    </button>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="px-5 py-2.5 text-sm text-slate-400">{children}</div>;
}
