'use client';

import React, { useState } from 'react';
import {
  FiLoader,
  FiCreditCard,
  FiAlertTriangle,
  FiExternalLink,
  FiCalendar,
} from 'react-icons/fi';
import { Card, CardContent, CardHeader, CardTitle, Button, ConfirmModal } from '@/components/ui';
import {
  useOrgBilling,
  useCancelSubscription,
  useReactivateSubscription,
} from '@/lib/hooks/useOrg';
import { orgApiService, type OrgInvoice } from '@/lib/api/services/org.service';
import { toast } from '@/lib/stores/toast';
import BundlesSection from '@/components/org/BundlesSection';

function money(cents: number, currency = 'usd'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(cents / 100);
}

function fromUnix(unix: number | null): string {
  if (!unix) return '—';
  return new Date(unix * 1000).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

const INVOICE_STATUS: Record<string, string> = {
  paid: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  open: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  void: 'bg-[var(--muted)] text-[var(--muted-foreground)]',
  uncollectible: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  draft: 'bg-[var(--muted)] text-[var(--muted-foreground)]',
};

export default function OrgBillingPage() {
  const { data, isLoading, isError } = useOrgBilling();
  const cancelMutation = useCancelSubscription();
  const reactivateMutation = useReactivateSubscription();
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <FiLoader className="w-8 h-8 animate-spin text-[var(--muted-foreground)]" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="p-8 text-center text-[var(--danger)]">
        Failed to load billing. Please try again.
      </div>
    );
  }

  const { planLabel, billingPeriod, subscription, paymentMethod, invoices, billingStatus } = data;
  const isTrial = Boolean(data.isTrial) || billingStatus === 'trial' || billingStatus === 'trialing';
  const sub = subscription;
  const willCancel = sub?.cancelAtPeriodEnd ?? false;
  // Stripe orgs: the live subscription amount already includes per-number line
  // items. Non-Stripe (manual/custom) orgs: the plan price alone misses the $5
  // extras for numbers beyond the included count and active SMS add-ons — add them
  // so the total accurately reflects what is due / charged.
  const renewAmount =
    sub?.amountCents ??
    (data.monthlyCents != null
      ? data.monthlyCents + (data.numbersCents ?? 0) + (data.smsAddonCents ?? 0)
      : null);
  const isBankTransfer = data.paymentType === 'bank_transfer';

  // Payment history = Stripe invoices + the org's recorded offline (bank/cash)
  // payments, newest-first. If there are none of either, fall back to the single
  // synthesized bank-transfer receipt so the history isn't misleadingly empty.
  const manualRows: OrgInvoice[] = (data.manualPayments ?? []).map((p) => ({
    id: `mp-${p.id}`,
    number: p.method === 'bank_transfer' ? 'Bank transfer' : p.method === 'cash' ? 'Cash' : p.reference || p.method,
    amountCents: p.amountCents,
    currency: p.currency,
    status: 'paid',
    created: p.paidAt ? Math.floor(new Date(p.paidAt.replace(' ', 'T') + 'Z').getTime() / 1000) : 0,
    hostedUrl: null,
    pdfUrl: null,
  }));
  const combined = [...invoices, ...manualRows].sort((a, b) => b.created - a.created);
  const displayInvoices: OrgInvoice[] =
    combined.length > 0
      ? combined
      : isBankTransfer && data.bankTransfer
        ? [
            {
              id: 'bank-transfer',
              number: 'Bank transfer',
              amountCents: data.bankTransfer.amountCents ?? 0,
              currency: data.bankTransfer.currency,
              status: 'paid',
              created: data.bankTransfer.paidAt ?? 0,
              hostedUrl: null,
              pdfUrl: null,
            },
          ]
        : [];

  const handleEditPaymentMethod = async () => {
    setPortalLoading(true);
    try {
      const res = await orgApiService.billingPortal(window.location.href);
      window.location.href = res.data.url;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not open the billing portal');
      setPortalLoading(false);
    }
  };

  const handleCancel = async () => {
    try {
      await cancelMutation.mutateAsync();
      toast.success('Your subscription will cancel at the end of the billing period');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not cancel the subscription');
    } finally {
      setConfirmCancel(false);
    }
  };

  const handleReactivate = async () => {
    try {
      await reactivateMutation.mutateAsync();
      toast.success('Subscription resumed');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not resume the subscription');
    }
  };

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-[var(--foreground)]">Plan &amp; billing</h1>
        <p className="text-[var(--muted-foreground)] mt-1">
          Manage your subscription, payment method, and invoices
        </p>
      </div>

      {/* Past-due / suspended banner */}
      {billingStatus === 'past_due' && !isTrial && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-800 p-4 flex items-start gap-3">
          <FiAlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
          <p className="text-sm text-amber-800 dark:text-amber-200">
            Your last payment failed. Please update your payment method to avoid interruption.
          </p>
        </div>
      )}
      {billingStatus === 'suspended' && (
        <div className="rounded-xl border border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800 p-4 flex items-start gap-3">
          <FiAlertTriangle className="w-5 h-5 text-red-600 mt-0.5 shrink-0" />
          <div className="text-sm text-red-800 dark:text-red-200">
            <p className="font-semibold">Your account is currently disabled.</p>
            <p className="mt-0.5">
              {data.suspendReason
                ? data.suspendReason
                : 'Suspended for non-payment. Update your payment method to restore service.'}
            </p>
            <p className="mt-1 text-red-700/80 dark:text-red-300/80">Please contact your administrator to restore service.</p>
          </div>
        </div>
      )}

      {/* Current plan */}
      <section>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-[var(--foreground)]">
              {planLabel}
              {billingPeriod ? ` ${billingPeriod.charAt(0).toUpperCase()}${billingPeriod.slice(1)}` : ''} plan
            </h2>
            {sub ? (
              <p className="text-sm text-[var(--muted-foreground)] mt-0.5">
                {willCancel ? (
                  <>
                    Your subscription ends on{' '}
                    <span className="font-medium text-[var(--foreground)]">
                      {fromUnix(sub.currentPeriodEnd)}
                    </span>
                  </>
                ) : (
                  <>
                    Your subscription renews on{' '}
                    <span className="font-medium text-[var(--foreground)]">
                      {fromUnix(sub.currentPeriodEnd)}
                    </span>
                  </>
                )}
              </p>
            ) : isTrial ? (
              <p className="text-sm text-blue-600 dark:text-blue-400 mt-0.5 font-medium">
                Trial active — no payment required until your organization is activated.
              </p>
            ) : isBankTransfer ? (
              <p className="text-sm text-[var(--muted-foreground)] mt-0.5">
                Active — paid by bank transfer
                {data.bankTransfer?.paidAt ? (
                  <>
                    {' '}on{' '}
                    <span className="font-medium text-[var(--foreground)]">
                      {fromUnix(data.bankTransfer.paidAt)}
                    </span>
                  </>
                ) : (
                  ''
                )}
                .
              </p>
            ) : (
              <p className="text-sm text-[var(--muted-foreground)] mt-0.5">
                No active subscription on file.
              </p>
            )}
          </div>
          {renewAmount != null && (
            <div className="text-right">
              <p className="text-2xl font-bold text-[var(--foreground)]">
                {money(renewAmount, sub?.currency)}
              </p>
              <p className="text-xs text-[var(--muted-foreground)]">
                {data.smsAddons?.some((a) => !a.isRecurring)
                  ? 'total this period'
                  : `per ${sub?.interval ?? (billingPeriod === 'yearly' ? 'year' : 'month')}`}
              </p>
            </div>
          )}
        </div>

        {data.smsAddons && data.smsAddons.length > 0 && (
          <div className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--muted-foreground)] mb-3">
              Extra SMS Add-ons
            </h3>
            <div className="space-y-2">
              {data.smsAddons.map((addon) => (
                <div key={addon.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-[var(--foreground)]">{addon.name}</span>
                    <span className="rounded bg-[var(--muted)] px-2 py-0.5 text-[11px] font-medium text-[var(--muted-foreground)]">
                      +{addon.smsCount.toLocaleString()} SMS · {addon.isRecurring ? 'Recurring' : 'One-time'}
                    </span>
                  </div>
                  <span className="text-sm font-bold tabular-nums text-[var(--foreground)]">
                    {money(addon.priceCents)}
                    {addon.isRecurring ? '/mo' : ''}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {willCancel && sub && (
          <div className="mt-4 rounded-lg border border-[var(--border)] bg-[var(--muted)]/40 p-4 flex items-center justify-between gap-4">
            <p className="text-sm text-[var(--muted-foreground)]">
              Cancellation scheduled for {fromUnix(sub.currentPeriodEnd)}.
            </p>
            <Button
              size="sm"
              variant="outline"
              onClick={handleReactivate}
              loading={reactivateMutation.isPending}
            >
              Resume subscription
            </Button>
          </div>
        )}
      </section>

      {/* SMS packages — the self-serve "buy more" path (10DLC-gated). */}
      <BundlesSection />

      {/* Payment method */}
      <section>
        <h2 className="text-lg font-bold text-[var(--foreground)] mb-1">Payment method</h2>
        <p className="text-sm text-[var(--muted-foreground)] mb-3">
          Used for your subscription and additional numbers
        </p>
        <div className="rounded-xl border border-[var(--border)] p-4 flex items-center justify-between gap-4">
          {paymentMethod ? (
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-14 place-items-center rounded-md bg-[var(--muted)] text-[10px] font-bold uppercase text-[var(--foreground)]">
                {paymentMethod.type === 'card'
                  ? (paymentMethod.brand ?? 'Card')
                  : paymentMethod.type === 'us_bank_account'
                    ? 'ACH'
                    : paymentMethod.type === 'link'
                      ? 'Link'
                      : paymentMethod.type === 'sepa_debit'
                        ? 'SEPA'
                        : paymentMethod.type === 'paypal'
                          ? 'PayPal'
                          : 'Pay'}
              </span>
              <div>
                <p className="text-sm font-medium text-[var(--foreground)]">{paymentMethod.label}</p>
                {paymentMethod.type === 'card' && paymentMethod.expMonth && paymentMethod.expYear ? (
                  <p className="text-xs text-[var(--muted-foreground)]">
                    Expires {String(paymentMethod.expMonth).padStart(2, '0')}/{paymentMethod.expYear}
                  </p>
                ) : (
                  <p className="text-xs text-[var(--muted-foreground)]">
                    {paymentMethod.type === 'link'
                      ? 'Stripe Link'
                      : paymentMethod.type === 'us_bank_account'
                        ? 'Bank account (ACH)'
                        : 'Saved payment method'}
                  </p>
                )}
              </div>
            </div>
          ) : isBankTransfer ? (
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-14 place-items-center rounded-md bg-[var(--muted)] text-xs font-bold uppercase text-[var(--foreground)]">
                Bank
              </span>
              <div>
                <p className="text-sm font-medium text-[var(--foreground)]">Bank transfer</p>
                <p className="text-xs text-[var(--muted-foreground)]">
                  Paid manually — no card on file
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 text-[var(--muted-foreground)]">
              <FiCreditCard className="w-5 h-5" />
              <p className="text-sm">No payment method on file</p>
            </div>
          )}
          {/* The Stripe billing portal needs a Stripe customer. Only Stripe-billed
              orgs have one — bank-transfer AND custom/manual orgs (paymentType
              'none') do not, so showing them an "Add payment method" button just
              404s into "No billing account on file." Gate strictly on a real Stripe
              account. */}
          {data.paymentType === 'stripe' && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleEditPaymentMethod}
              loading={portalLoading}
            >
              {paymentMethod ? 'Edit payment method' : 'Add payment method'}
            </Button>
          )}
        </div>
      </section>

      {/* Invoices */}
      <section>
        <h2 className="text-lg font-bold text-[var(--foreground)] mb-1">Invoices</h2>
        <p className="text-sm text-[var(--muted-foreground)] mb-3">Your payment history</p>
        {displayInvoices.length === 0 ? (
          <div className="rounded-xl border border-[var(--border)] p-6 text-center text-sm text-[var(--muted-foreground)]">
            No invoices yet.
          </div>
        ) : (
          <div className="rounded-xl border border-[var(--border)] overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] text-left text-[var(--muted-foreground)]">
                  <th className="py-2.5 px-4 font-medium">Invoice</th>
                  <th className="py-2.5 px-4 font-medium">Date</th>
                  <th className="py-2.5 px-4 font-medium">Status</th>
                  <th className="py-2.5 px-4 font-medium">Total</th>
                  <th className="py-2.5 px-4 font-medium" />
                </tr>
              </thead>
              <tbody>
                {displayInvoices.map((inv: OrgInvoice) => (
                  <tr key={inv.id} className="border-b border-[var(--border)] last:border-0">
                    <td className="py-2.5 px-4 font-mono text-xs text-[var(--foreground)]">
                      {inv.number || inv.id.slice(-8)}
                    </td>
                    <td className="py-2.5 px-4 text-[var(--muted-foreground)]">
                      {fromUnix(inv.created)}
                    </td>
                    <td className="py-2.5 px-4">
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium capitalize ${
                          INVOICE_STATUS[inv.status] ?? INVOICE_STATUS.draft
                        }`}
                      >
                        {inv.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-[var(--foreground)]">
                      {money(inv.amountCents, inv.currency)}
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      {inv.hostedUrl && (
                        <a
                          href={inv.hostedUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[var(--primary-600)] hover:underline"
                        >
                          View <FiExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Danger zone */}
      {sub && !willCancel && (
        <section>
          <span className="inline-block rounded bg-red-100 dark:bg-red-900/30 px-2 py-0.5 text-xs font-semibold text-red-700 dark:text-red-300 mb-2">
            Danger zone
          </span>
          <Card variant="bordered" className="border-red-200 dark:border-red-900/50">
            <CardHeader>
              <CardTitle className="text-[var(--foreground)] flex items-center gap-2">
                <FiCalendar className="w-4 h-4" /> Cancel subscription
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-[var(--muted-foreground)]">
                If you cancel, your subscription stays active until the end of the current billing
                period. After that, calling and texting stop and your numbers are released. You can
                resume any time before the period ends.
              </p>
              <div className="mt-4">
                <Button variant="danger" onClick={() => setConfirmCancel(true)}>
                  Cancel subscription
                </Button>
              </div>
            </CardContent>
          </Card>
        </section>
      )}

      <ConfirmModal
        isOpen={confirmCancel}
        onClose={() => setConfirmCancel(false)}
        onConfirm={handleCancel}
        title="Cancel subscription?"
        message="Your subscription will remain active until the end of the current billing period, then calling and texting will stop and your numbers will be released. You can resume before then."
        confirmText="Cancel subscription"
        cancelText="Keep subscription"
        variant="danger"
        loading={cancelMutation.isPending}
      />
    </div>
  );
}
