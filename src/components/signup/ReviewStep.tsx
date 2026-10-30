'use client';

import React, { useState } from 'react';
import { FiArrowLeft, FiCheck, FiLock, FiAlertCircle } from 'react-icons/fi';
import { Card, CardContent, Button } from '@/components/ui';
import { useCreateCheckout } from '@/lib/hooks/useSignup';
import type { SignupOrderData } from '@/lib/api/services/onboarding.service';
import { getPlan, planPriceLabel, type BillingPeriod } from './plans';
import BankTransferPanel from './BankTransferPanel';

interface Props {
  token: string;
  order: SignupOrderData;
  onBack?: () => void;
}

/**
 * Terminal step of the signup wizard. Summarises the order — business, chosen
 * numbers, and setup / monthly totals — then takes payment. Two methods:
 *  - Card: `createCheckout(token)` → redirect to Stripe's hosted Checkout
 *    (passes this app's origin as returnUrl so Stripe returns here).
 *  - Bank transfer: <BankTransferPanel> — the customer transfers manually,
 *    uploads a proof screenshot, and the order auto-activates (no Stripe).
 * Only reachable once the email is verified (the wizard gates on it earlier).
 */
export default function ReviewStep({ token, order, onBack }: Props) {
  const createCheckout = useCreateCheckout(token);
  const [error, setError] = useState('');
  // Payment method: card (Stripe) or manual bank transfer.
  const [method, setMethod] = useState<'card' | 'bank'>('card');

  const plan = getPlan(order.planSlug ?? undefined);
  const billing: BillingPeriod = order.billingPeriod === 'yearly' ? 'yearly' : 'monthly';

  // Amount actually charged now. For a plan order the plan (number included) is
  // billed via its Stripe Price, not a line item, so use the plan's price.
  const dueTodayCents = plan && plan.monthly != null ? Math.round(plan.monthly * 100) : 0;
  const amountLabel = dueTodayCents > 0 ? `$${(dueTodayCents / 100).toFixed(2)}` : 'the plan amount';

  const handlePay = async () => {
    setError('');
    try {
      const res = await createCheckout.mutateAsync();
      const url = res.data.checkoutUrl;
      if (!url) throw new Error('No checkout URL returned');
      window.location.href = url; // hand off to Stripe's hosted page
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not start checkout. Please try again.'
      );
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Card>
        <CardContent className="p-6 md:p-8">
          <div className="flex items-center gap-3 mb-6">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-[var(--coral)]/10 text-[var(--coral-700)]">
              <FiCheck className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-xl font-bold text-[var(--foreground)]">Review your order</h2>
              <p className="text-sm text-[var(--muted-foreground)]">
                Confirm everything looks right before payment.
              </p>
            </div>
          </div>

          {/* Business */}
          <section className="mb-6">
            <h3 className="text-xs font-bold uppercase tracking-wide text-[var(--muted-foreground)] mb-3">
              Business
            </h3>
            <dl className="rounded-xl border border-[var(--border)] divide-y divide-[var(--border)]">
              <div className="flex items-center justify-between px-4 py-3">
                <dt className="text-sm text-[var(--muted-foreground)]">Company</dt>
                <dd className="text-sm font-medium text-[var(--foreground)]">
                  {order.businessName}
                </dd>
              </div>
              <div className="flex items-center justify-between px-4 py-3">
                <dt className="text-sm text-[var(--muted-foreground)]">Contact</dt>
                <dd className="text-sm font-medium text-[var(--foreground)] text-right">
                  {order.contactName}
                  <span className="block text-xs font-normal text-[var(--muted-foreground)]">
                    {order.contactEmail}
                  </span>
                </dd>
              </div>
            </dl>
          </section>

          {/* Numbers */}
          <section className="mb-6">
            <h3 className="text-xs font-bold uppercase tracking-wide text-[var(--muted-foreground)] mb-3">
              Numbers ({order.numbers.length})
            </h3>
            {order.numbers.length === 0 ? (
              <p className="text-sm text-[var(--muted-foreground)]">No numbers selected.</p>
            ) : (
              <div className="rounded-xl border border-[var(--border)] divide-y divide-[var(--border)]">
                {order.numbers.map((n) => (
                  <div key={n.phoneNumber} className="flex items-center justify-between px-4 py-3">
                    <div className="min-w-0">
                      <span className="font-mono text-sm font-semibold text-[var(--foreground)]">
                        {n.phoneNumber}
                      </span>
                      <span className="ml-2 text-xs text-[var(--muted-foreground)] capitalize">
                        {n.numberType.replace(/_/g, '-')}
                        {n.region ? ` · ${n.region}` : ''}
                      </span>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="rounded-full bg-[var(--coral)]/10 px-2.5 py-1 text-xs font-bold text-[var(--coral-700)]">
                        Included
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Totals — the plan is the charge; the number is included. Final amount
              is confirmed on the Stripe page, so no "due today" figure here. */}
          <section className="rounded-xl bg-[var(--muted)]/40 border border-[var(--border)] p-4 space-y-2">
            {plan ? (
              <div className="flex items-center justify-between text-sm">
                <span className="text-[var(--muted-foreground)]">
                  {plan.name} plan
                  {billing === 'yearly' ? ' (billed annually)' : ''}
                </span>
                <span className="font-semibold text-[var(--foreground)]">
                  {planPriceLabel(plan, billing)}
                  <span className="font-normal text-[var(--muted-foreground)]">/mo</span>
                </span>
              </div>
            ) : (
              <div className="flex items-center justify-between text-sm">
                <span className="text-[var(--muted-foreground)]">Your plan</span>
                <span className="font-semibold text-[var(--foreground)]">Confirmed at checkout</span>
              </div>
            )}
            <div className="flex items-center justify-between text-sm">
              <span className="text-[var(--muted-foreground)]">
                Phone number{order.numbers.length !== 1 ? 's' : ''}
              </span>
              <span className="font-semibold text-[var(--coral-700)]">Included</span>
            </div>
          </section>
        </CardContent>
      </Card>

      {/* Payment — card (Stripe hosted Checkout) or manual bank transfer. */}
      <Card>
        <CardContent className="p-6 md:p-8">
          {error && (
            <div className="mb-4 flex items-start gap-3 rounded-lg border border-[var(--danger)]/30 bg-[var(--danger)]/10 p-4">
              <FiAlertCircle className="w-5 h-5 text-[var(--danger)] mt-0.5 shrink-0" />
              <p className="text-sm text-[var(--danger)]">{error}</p>
            </div>
          )}

          {/* Payment method */}
          <div className="mb-5 grid grid-cols-2 gap-2 rounded-xl border border-[var(--border)] p-1">
            {(
              [
                ['card', 'Pay by card'],
                ['bank', 'Bank transfer'],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setMethod(key)}
                className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                  method === key
                    ? 'bg-[var(--coral)] text-white'
                    : 'text-[var(--muted-foreground)] hover:bg-[var(--muted)]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {method === 'card' ? (
            <>
              <div className="flex flex-col-reverse sm:flex-row items-center gap-3 sm:justify-between">
                {onBack && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={onBack}
                    disabled={createCheckout.isPending}
                    className="w-full sm:w-auto"
                  >
                    <FiArrowLeft className="w-4 h-4 mr-1.5" />
                    Back to numbers
                  </Button>
                )}
                <Button
                  type="button"
                  variant="coral"
                  size="lg"
                  onClick={handlePay}
                  loading={createCheckout.isPending}
                  className="w-full sm:w-auto"
                >
                  {!createCheckout.isPending && <FiLock className="w-4 h-4 mr-1.5" />}
                  {createCheckout.isPending
                    ? 'Starting secure checkout…'
                    : 'Proceed to secure payment'}
                </Button>
              </div>
              <p className="mt-3 text-center sm:text-right text-xs text-[var(--muted-foreground)]">
                You&apos;ll be redirected to Stripe to complete payment securely.
              </p>
            </>
          ) : (
            <BankTransferPanel token={token} amountLabel={amountLabel} onBack={onBack} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
