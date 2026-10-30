'use client';

/**
 * WhatsApp Billing Plan — admin per-org control.
 *
 * Switches an organization between the two plans, and (for prepaid) tops up
 * the wallet and shows recent activity:
 *   • Postpaid  = "Unlimited" — never blocked; invoiced monthly for the
 *                 SaaS fee + actual provider usage.
 *   • Prepaid   = metered wallet — each message debits the balance at the
 *                 provider's exact price; sending is paused at $0.
 *
 * The manager's Billing panel reacts to whatever mode is set here: prepaid
 * shows the live balance banner; postpaid shows the pay-as-you-go view.
 *
 * @module app/admin/organizations/[id]/WaBillingCard
 */

import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FiLoader, FiDollarSign, FiZap, FiCreditCard, FiAlertTriangle } from 'react-icons/fi';
import { Card, CardContent, CardHeader, CardTitle, Button } from '@/components/ui';
import { toast } from '@/lib/stores/toast';
import {
  getOrgBillingAccount,
  getOrgBillingLedger,
  setOrgBillingMode,
  topUpOrgBalance,
  type AdminWaLedgerEntry,
} from '@/lib/api/services/whatsapp-admin.api';

/** Micro-dollars → display string, up to 4dp, trailing zeros trimmed. */
function fmtMicros(micros: number, currency: string): string {
  const n = Number(micros || 0) / 1_000_000;
  const str = n.toFixed(4).replace(/\.?0+$/, '');
  return `${currency} ${str === '' || str === '-0' ? '0' : str}`;
}

function fmtMoney(amount: number, currency: string): string {
  const n = Number(amount || 0);
  const str = n.toFixed(4).replace(/\.?0+$/, '');
  return `${currency} ${str === '' || str === '-0' ? '0' : str}`;
}

function ledgerLabel(e: AdminWaLedgerEntry): string {
  if (e.entryType === 'topup') return e.description || 'Top-up';
  if (e.entryType === 'debit') return e.description || 'Message';
  if (e.entryType === 'adjustment') return e.description || 'Adjustment';
  return e.description || e.entryType;
}

export function WaBillingCard({ orgId }: { orgId: number }) {
  const queryClient = useQueryClient();
  const accountKey = ['admin', 'organizations', orgId, 'wa-billing'] as const;
  const ledgerKey = ['admin', 'organizations', orgId, 'wa-billing-ledger'] as const;

  const {
    data: account,
    isLoading,
    isError,
  } = useQuery({
    queryKey: accountKey,
    queryFn: () => getOrgBillingAccount(orgId),
    staleTime: 15_000,
  });

  const isPrepaid = account?.mode === 'prepaid';

  // Ledger only matters for prepaid orgs — don't fetch it for postpaid.
  const { data: ledger } = useQuery({
    queryKey: ledgerKey,
    queryFn: () => getOrgBillingLedger(orgId),
    enabled: isPrepaid,
    staleTime: 15_000,
  });

  const [topUpAmount, setTopUpAmount] = useState('');

  const refreshBilling = () => {
    queryClient.invalidateQueries({ queryKey: accountKey });
    queryClient.invalidateQueries({ queryKey: ledgerKey });
  };

  const modeMutation = useMutation({
    mutationFn: (mode: 'prepaid' | 'postpaid') => setOrgBillingMode(orgId, mode),
    onSuccess: (_res, mode) => {
      refreshBilling();
      toast.success(
        mode === 'prepaid'
          ? 'Switched to Prepaid (metered wallet)'
          : 'Switched to Postpaid (unlimited)'
      );
    },
    onError: (err) => {
      refreshBilling();
      toast.error(err instanceof Error ? err.message : 'Failed to change plan');
    },
  });

  const topUpMutation = useMutation({
    mutationFn: (amount: number) => topUpOrgBalance(orgId, amount),
    onSuccess: () => {
      setTopUpAmount('');
      refreshBilling();
      toast.success('Credit added');
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Top-up failed');
    },
  });

  const busy = modeMutation.isPending || topUpMutation.isPending;

  const switchTo = (mode: 'prepaid' | 'postpaid') => {
    if (busy || account?.mode === mode) return; // no-op if unchanged / in flight
    modeMutation.mutate(mode);
  };

  const handleTopUp = () => {
    const amt = Number(topUpAmount);
    if (!(amt > 0)) {
      toast.error('Enter an amount greater than 0');
      return;
    }
    topUpMutation.mutate(amt);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>WhatsApp Billing Plan</CardTitle>
        <p className="text-sm text-[var(--muted-foreground)] mt-1">
          Choose how this organization pays for WhatsApp. The manager&apos;s Billing panel adapts to
          the selected plan automatically.
        </p>
      </CardHeader>
      <CardContent>
        {isLoading || !account ? (
          <div className="flex items-center justify-center py-6">
            <FiLoader className="w-6 h-6 animate-spin text-[var(--primary)]" />
          </div>
        ) : isError ? (
          <p className="text-sm text-[var(--danger)]">Failed to load billing plan.</p>
        ) : (
          <div className="space-y-5">
            {/* Plan selector — two clear cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                disabled={busy}
                aria-pressed={!isPrepaid}
                onClick={() => switchTo('postpaid')}
                className={`text-left rounded-xl border p-4 transition-colors ${
                  !isPrepaid
                    ? 'border-[var(--primary)] bg-[var(--primary)]/5'
                    : 'border-[var(--border)] hover:border-[var(--primary)]/50'
                } ${busy ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <FiZap className="w-4 h-4 text-[var(--primary)]" />
                  <span className="font-medium text-[var(--foreground)]">Postpaid · Unlimited</span>
                  {!isPrepaid && (
                    <span className="ml-auto text-xs font-semibold text-[var(--primary)]">
                      ACTIVE
                    </span>
                  )}
                </div>
                <p className="text-xs text-[var(--muted-foreground)]">
                  Never blocked. Invoiced monthly: your SaaS fee + actual provider usage.
                </p>
              </button>

              <button
                type="button"
                disabled={busy}
                aria-pressed={isPrepaid}
                onClick={() => switchTo('prepaid')}
                className={`text-left rounded-xl border p-4 transition-colors ${
                  isPrepaid
                    ? 'border-[var(--primary)] bg-[var(--primary)]/5'
                    : 'border-[var(--border)] hover:border-[var(--primary)]/50'
                } ${busy ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <FiCreditCard className="w-4 h-4 text-[var(--primary)]" />
                  <span className="font-medium text-[var(--foreground)]">Prepaid · Metered</span>
                  {isPrepaid && (
                    <span className="ml-auto text-xs font-semibold text-[var(--primary)]">
                      ACTIVE
                    </span>
                  )}
                </div>
                <p className="text-xs text-[var(--muted-foreground)]">
                  Wallet balance. Each message debits the exact provider price; paused at $0.
                </p>
              </button>
            </div>

            {modeMutation.isPending && (
              <p className="text-xs text-[var(--muted-foreground)] flex items-center gap-2">
                <FiLoader className="w-3 h-3 animate-spin" /> Updating plan…
              </p>
            )}

            {/* Prepaid wallet controls */}
            {isPrepaid && (
              <div className="rounded-xl border border-[var(--border)] p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs text-[var(--muted-foreground)]">Current balance</div>
                    <div
                      className={`text-2xl font-bold ${
                        account.balance <= 0
                          ? 'text-[var(--danger)]'
                          : account.balance < 5
                            ? 'text-amber-600 dark:text-amber-400'
                            : 'text-[var(--foreground)]'
                      }`}
                    >
                      {fmtMoney(account.balance, account.currency)}
                    </div>
                  </div>
                  <FiDollarSign className="w-8 h-8 text-[var(--muted-foreground)]" />
                </div>

                {/* Out-of-credit warning — switching to prepaid with $0 pauses
                    all sends, so make that consequence explicit. */}
                {account.balance <= 0 && (
                  <div className="flex items-start gap-2 rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 p-2.5">
                    <FiAlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-800 dark:text-amber-300">
                      No credit — this org cannot send WhatsApp messages until you add funds.
                    </p>
                  </div>
                )}

                <div className="flex items-end gap-2">
                  <div className="flex-1">
                    <label className="block text-xs text-[var(--muted-foreground)] mb-1">
                      Add credit ({account.currency})
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={topUpAmount}
                      onChange={(e) => setTopUpAmount(e.target.value)}
                      placeholder="e.g. 25.00"
                      disabled={busy}
                      className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] focus:ring-2 focus:ring-[var(--primary)]/40 focus:border-transparent"
                    />
                  </div>
                  <Button onClick={handleTopUp} disabled={busy || !topUpAmount}>
                    {topUpMutation.isPending ? (
                      <>
                        <FiLoader className="w-4 h-4 animate-spin" /> Adding…
                      </>
                    ) : (
                      'Add Credit'
                    )}
                  </Button>
                </div>
                <p className="text-xs text-[var(--muted-foreground)]">
                  Credit the customer&apos;s wallet after they pay you. Debits happen automatically
                  at the provider&apos;s real per-message price.
                </p>

                {/* Recent wallet activity */}
                {ledger && ledger.length > 0 && (
                  <div className="pt-2 border-t border-[var(--border)]">
                    <div className="text-xs font-medium text-[var(--muted-foreground)] mb-2">
                      Recent activity
                    </div>
                    <div className="space-y-1.5 max-h-48 overflow-y-auto">
                      {ledger.map((e) => {
                        const credit = e.amountMicros >= 0;
                        return (
                          <div key={e.id} className="flex items-center justify-between text-xs">
                            <span className="text-[var(--muted-foreground)] truncate pr-2">
                              {ledgerLabel(e)}
                            </span>
                            <span
                              className={`font-mono shrink-0 ${
                                credit
                                  ? 'text-green-600 dark:text-green-400'
                                  : 'text-[var(--foreground)]'
                              }`}
                            >
                              {credit ? '+' : ''}
                              {fmtMicros(e.amountMicros, account.currency)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default WaBillingCard;
