'use client';

/**
 * Invoices — admin2 Org Detail → Usage. Read-only view of the org's recent Stripe
 * invoices (number, amount, status, date) with links to the hosted invoice + PDF.
 * Wired to superadminApiService.getOrgInvoices. Shows a neutral note when the org
 * has no Stripe customer yet (card-less / bank-transfer).
 */

import { useQuery } from '@tanstack/react-query';
import { superadminApiService } from '@/lib/api/services/superadmin.service';
import { Card, SectionTitle, StatusDot, type Health } from '../../_components/ui';

const STATUS_HEALTH: Record<string, Health> = {
  paid: 'ok',
  open: 'warn',
  draft: 'off',
  void: 'off',
  uncollectible: 'bad',
};
const fmtDate = (unix: number) => new Date(unix * 1000).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
const fmtAmount = (cents: number, currency: string) =>
  `${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency.toUpperCase()}`;

export function InvoicesCard({ orgId }: { orgId: number }) {
  const q = useQuery({
    queryKey: ['admin2', 'org-invoices', orgId],
    queryFn: () => superadminApiService.getOrgInvoices(orgId),
    staleTime: 60_000,
  });

  if (q.isLoading) {
    return <Card className="p-5"><div className="h-20 animate-pulse rounded bg-slate-200 dark:bg-slate-800" /></Card>;
  }
  if (q.isError) return null;
  const invoices = q.data?.data ?? [];

  return (
    <Card className="p-5">
      <SectionTitle>Invoices</SectionTitle>
      {invoices.length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">
          No Stripe invoices for this organization yet (card-less / bank-transfer, or not billed).
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="py-2 pr-3 font-semibold">Invoice</th>
                <th className="py-2 pr-3 font-semibold text-right">Amount</th>
                <th className="py-2 pr-3 font-semibold">Status</th>
                <th className="py-2 pr-3 font-semibold">Date</th>
                <th className="py-2 font-semibold"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {invoices.map((inv) => (
                <tr key={inv.id}>
                  <td className="py-2 pr-3 font-mono text-xs">{inv.number ?? inv.id.slice(0, 12)}</td>
                  <td className="py-2 pr-3 text-right font-semibold tabular-nums">{fmtAmount(inv.amountCents, inv.currency)}</td>
                  <td className="py-2 pr-3"><StatusDot health={STATUS_HEALTH[inv.status] ?? 'off'} label={inv.status} /></td>
                  <td className="py-2 pr-3 text-xs text-slate-500">{fmtDate(inv.created)}</td>
                  <td className="py-2 text-right">
                    {inv.hostedUrl && (
                      <a href={inv.hostedUrl} target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-[#FF6542] hover:underline">View</a>
                    )}
                    {inv.pdfUrl && (
                      <a href={inv.pdfUrl} target="_blank" rel="noopener noreferrer" className="ml-2 text-xs font-bold text-slate-400 hover:underline">PDF</a>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
