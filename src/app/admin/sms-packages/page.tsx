'use client';

import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FiLoader, FiPackage, FiDollarSign, FiMessageSquare } from 'react-icons/fi';
import { Card, CardContent, CardHeader, CardTitle, StyledSelect } from '@/components/ui';
import { formatLocalDate } from '@/lib/utils/datetime';
import { superadminApiService, type BundlePurchase } from '@/lib/api/services/superadmin.service';

function dollars(cents: number): string {
  return `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function Badge({ tone, children }: { tone: 'green' | 'amber' | 'red' | 'gray'; children: React.ReactNode }) {
  const cls = {
    green: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
    amber: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
    red: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
    gray: 'bg-[var(--muted)] text-[var(--muted-foreground)]',
  }[tone];
  return (
    <span className={`inline-flex px-2 py-0.5 text-[11px] font-semibold rounded-full ${cls}`}>
      {children}
    </span>
  );
}

function statusTone(s: string): 'green' | 'amber' | 'gray' {
  return s === 'active' ? 'green' : s === 'canceling' ? 'amber' : 'gray';
}
function kycTone(s: string): 'green' | 'amber' | 'red' | 'gray' {
  return s === 'approved' ? 'green' : s === 'pending' ? 'amber' : s === 'rejected' ? 'red' : 'gray';
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 py-4">
        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--primary-600)]/10 text-[var(--primary-600)]">
          <Icon className="h-5 w-5" />
        </span>
        <div>
          <p className="text-xs text-[var(--muted-foreground)]">{label}</p>
          <p className="text-xl font-bold text-[var(--foreground)] tabular-nums">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

const Row = React.memo(function Row({ p }: { p: BundlePurchase }) {
  const pct = p.smsIncluded > 0 ? Math.min(100, Math.round((p.smsUsed / p.smsIncluded) * 100)) : 0;
  const bar = pct >= 100 ? 'bg-red-500' : pct >= 80 ? 'bg-amber-500' : 'bg-emerald-500';
  return (
    <tr className="border-b border-[var(--border)] hover:bg-[var(--muted)] transition-colors">
      <td className="py-3 px-4">
        <p className="font-medium text-[var(--foreground)]">{p.orgName || `Org #${p.orgId}`}</p>
        <p className="text-xs text-[var(--muted-foreground)]">
          {p.ownerName || '—'}
          {p.ownerEmail ? ` · ${p.ownerEmail}` : ''}
        </p>
      </td>
      <td className="py-3 px-4">
        <p className="font-medium text-[var(--foreground)]">{p.label}</p>
        <p className="text-xs text-[var(--muted-foreground)] tabular-nums">
          {p.smsIncluded.toLocaleString()} SMS/mo
        </p>
      </td>
      <td className="py-3 px-4 tabular-nums text-[var(--foreground)]">{dollars(p.priceCents)}</td>
      <td className="py-3 px-4 w-40">
        <div className="text-xs tabular-nums text-[var(--muted-foreground)] mb-1">
          {p.smsUsed.toLocaleString()} / {p.smsIncluded.toLocaleString()}
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--muted)]">
          <div className={`h-full rounded-full ${bar}`} style={{ width: `${pct}%` }} />
        </div>
      </td>
      <td className="py-3 px-4">
        <Badge tone={statusTone(p.status)}>{p.status}</Badge>
      </td>
      <td className="py-3 px-4">
        <div className="flex flex-col gap-1">
          <Badge tone={kycTone(p.kycStatus)}>KYC: {p.kycStatus.replace('_', ' ')}</Badge>
          <Badge tone={p.tenDlcApproved ? 'green' : 'gray'}>
            10DLC: {p.tenDlcApproved ? 'approved' : 'pending'}
          </Badge>
        </div>
      </td>
      <td className="py-3 px-4 text-sm text-[var(--muted-foreground)]">
        {p.status === 'canceling' ? 'Ends ' : 'Renews '}
        {formatLocalDate(p.periodEnd)}
      </td>
      <td className="py-3 px-4 text-sm text-[var(--muted-foreground)]">
        {p.purchasedAt ? formatLocalDate(p.purchasedAt) : '—'}
      </td>
    </tr>
  );
});

export default function SmsPackagesPage() {
  const [statusFilter, setStatusFilter] = useState('');

  const { data, isLoading, isError } = useQuery({
    queryKey: ['admin', 'bundle-purchases'],
    queryFn: () => superadminApiService.listBundlePurchases(),
    staleTime: 30_000,
  });

  const all = useMemo(() => data?.data ?? [], [data]);
  const rows = useMemo(
    () => (statusFilter ? all.filter((p) => p.status === statusFilter) : all),
    [all, statusFilter]
  );

  const stats = useMemo(() => {
    const active = all.filter((p) => p.status === 'active' || p.status === 'canceling');
    const mrr = active.reduce((s, p) => s + p.priceCents, 0);
    const smsSold = active.reduce((s, p) => s + p.smsIncluded, 0);
    return { activeCount: active.length, mrr, smsSold };
  }, [all]);

  if (isError)
    return (
      <div className="p-8 text-center text-[var(--danger)]">
        Failed to load SMS package purchases. Please try again.
      </div>
    );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">SMS Packages</h1>
          <p className="text-[var(--muted-foreground)] mt-1">
            Which organizations bought which SMS package, with live usage and their KYC / 10DLC standing.
          </p>
        </div>
        <StyledSelect
          value={statusFilter}
          onChange={(v) => setStatusFilter(v)}
          className="w-auto bg-[var(--card)]"
        >
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="canceling">Canceling</option>
          <option value="canceled">Canceled</option>
        </StyledSelect>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard icon={FiPackage} label="Active packages" value={String(stats.activeCount)} />
        <StatCard icon={FiDollarSign} label="Monthly recurring" value={dollars(stats.mrr)} />
        <StatCard
          icon={FiMessageSquare}
          label="SMS/mo sold (active)"
          value={stats.smsSold.toLocaleString()}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            Purchases{' '}
            <span className="text-sm font-normal text-[var(--muted-foreground)] ml-2">
              ({rows.length})
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <FiLoader className="w-8 h-8 animate-spin text-[var(--foreground)]" />
            </div>
          ) : rows.length === 0 ? (
            <div className="text-center py-12 text-[var(--muted-foreground)]">
              {statusFilter ? 'No packages with this status.' : 'No SMS packages purchased yet.'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[var(--border)] text-left text-[var(--muted-foreground)]">
                    <th className="py-3 px-4 font-medium">Organization</th>
                    <th className="py-3 px-4 font-medium">Package</th>
                    <th className="py-3 px-4 font-medium">Price</th>
                    <th className="py-3 px-4 font-medium">SMS used</th>
                    <th className="py-3 px-4 font-medium">Status</th>
                    <th className="py-3 px-4 font-medium">Verification</th>
                    <th className="py-3 px-4 font-medium">Renews</th>
                    <th className="py-3 px-4 font-medium">Purchased</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((p) => (
                    <Row key={p.orgId} p={p} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
