
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

export default function ReviewStep({ token, order, onBack }: Props) {
  const createCheckout = useCreateCheckout(token);
  const [error, setError] = useState('');
  const [method, setMethod] = useState<'card' | 'bank'>('card');

  const plan = getPlan(order.planSlug ?? undefined);
  const billing: BillingPeriod = order.billingPeriod === 'yearly' ? 'yearly' : 'monthly';

  const dueTodayCents = plan && plan.monthly != null ? Math.round(plan.monthly * 100) : 0;
  const amountLabel = dueTodayCents > 0 ? `$${(dueTodayCents / 100).toFixed(2)}` : 'the plan amount';

  const handlePay = async () => {
    setError('');
    try {
      const res = await createCheckout.mutateAsync();
      const url = res.data.checkoutUrl;
      if (!url) throw new Error('No checkout URL returned');
      window.location.href = url;
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not start checkout. Please try again.'
      );
    }
  };

  return (
    <div
      className="mx-auto max-w-2xl space-y-6 text-white"
      style={
        {
          '--foreground': '#ffffff',
          '--muted-foreground': '#a1a1aa',
          '--card': '#171719',
          '--border': '#2d2d31',
          '--muted': '#242427',
          '--coral': '#ff7838',
          '--coral-700': '#ff6a00',
          '--danger': '#f87171',
          '--background': '#101011',
          colorScheme: 'dark',
        } as React.CSSProperties
      }
    >
      <Card className="!border-[#2d2d31] !bg-[#171719] !text-white">
        <CardContent className="p-6 md:p-8">
          <div className="mb-6 flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-[#ff7838]/10 text-[#ff7838]">
              <FiCheck className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-xl font-bold text-white">Review your order</h2>
              <p className="text-sm text-[#a1a1aa]">
                Confirm everything looks right before payment.
              </p>
            </div>
          </div>

          <section className="mb-6">
            <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-[#a1a1aa]">
              Business
            </h3>

            <dl className="divide-y divide-[#2d2d31] rounded-xl border border-[#2d2d31]">
              <div className="flex items-center justify-between px-4 py-3">
                <dt className="text-sm text-[#a1a1aa]">Company</dt>
                <dd className="text-sm font-medium text-white">
                  {order.businessName}
                </dd>
              </div>

              <div className="flex items-center justify-between px-4 py-3">
                <dt className="text-sm text-[#a1a1aa]">Contact</dt>
                <dd className="text-right text-sm font-medium text-white">
                  {order.contactName}
                  <span className="block text-xs font-normal text-[#a1a1aa]">
                    {order.contactEmail}
                  </span>
                </dd>
              </div>
            </dl>
          </section>

          <section className="mb-6">
            <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-[#a1a1aa]">
              Numbers ({order.numbers.length})
            </h3>

            {order.numbers.length === 0 ? (
              <p className="text-sm text-[#a1a1aa]">No numbers selected.</p>
            ) : (
              <div className="divide-y divide-[#2d2d31] rounded-xl border border-[#2d2d31]">
                {order.numbers.map((n) => (
                  <div key={n.phoneNumber} className="flex items-center justify-between px-4 py-3">
                    <div className="min-w-0">
                      <span className="font-mono text-sm font-semibold text-white">
                        {n.phoneNumber}
                      </span>
                      <span className="ml-2 text-xs capitalize text-[#a1a1aa]">
                        {n.numberType.replace(/_/g, '-')}
                        {n.region ? ` · ${n.region}` : ''}
                      </span>
                    </div>

                    <div className="shrink-0 text-right">
                      <span className="rounded-full bg-[#ff7838]/10 px-2.5 py-1 text-xs font-bold text-[#ff7838]">
                        Included
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="space-y-2 rounded-xl border border-[#2d2d31] bg-[#242427]/60 p-4">
            {plan ? (
              <div className="flex items-center justify-between text-sm">
                <span className="text-[#a1a1aa]">
                  {plan.name} plan
                  {billing === 'yearly' ? ' (billed annually)' : ''}
                </span>
                <span className="font-semibold text-white">
                  {planPriceLabel(plan, billing)}
                  <span className="font-normal text-[#a1a1aa]">/mo</span>
                </span>
              </div>
            ) : (
              <div className="flex items-center justify-between text-sm">
                <span className="text-[#a1a1aa]">Your plan</span>
                <span className="font-semibold text-white">Confirmed at checkout</span>
              </div>
            )}

            <div className="flex items-center justify-between text-sm">
              <span className="text-[#a1a1aa]">
                Phone number{order.numbers.length !== 1 ? 's' : ''}
              </span>
              <span className="font-semibold text-[#ff7838]">Included</span>
            </div>
          </section>
        </CardContent>
      </Card>

      <Card className="!border-[#2d2d31] !bg-[#171719] !text-white">
        <CardContent className="p-6 md:p-8">
          {error && (
            <div className="mb-4 flex items-start gap-3 rounded-lg border border-red-500/30 bg-red-500/10 p-4">
              <FiAlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-400" />
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          <div className="mb-5 grid grid-cols-2 gap-2 rounded-xl border border-[#2d2d31] p-1">
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
                    ? 'bg-gradient-to-r from-[#ff7a00] via-[#ff4d00] to-[#e81e2b] text-white'
                    : 'text-[#a1a1aa] hover:bg-[#242427] hover:text-white'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {method === 'card' ? (
            <>
              <div className="flex flex-col-reverse items-center gap-3 sm:flex-row sm:justify-between">
                {onBack && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={onBack}
                    disabled={createCheckout.isPending}
                    className="w-full sm:w-auto"
                  >
                    <FiArrowLeft className="mr-1.5 h-4 w-4" />
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
                  {!createCheckout.isPending && <FiLock className="mr-1.5 h-4 w-4" />}
                  {createCheckout.isPending
                    ? 'Starting secure checkout…'
                    : 'Proceed to secure payment'}
                </Button>
              </div>

              <p className="mt-3 text-center text-xs text-[#a1a1aa] sm:text-right">
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
