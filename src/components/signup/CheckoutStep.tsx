'use client';

import React, { useState } from 'react';
import { FiAlertCircle, FiArrowLeft, FiMessageSquare, FiCheck, FiMail } from 'react-icons/fi';
import { useCreateCheckout, useResendVerification } from '@/lib/hooks/useSignup';
import { Card, CardContent, Button } from '@/components/ui';
import type { SignupOrderData } from '@/lib/api/services/onboarding.service';
import BankTransferPanel from './BankTransferPanel';
import { getPlan } from './plans';

interface Props {
  token: string;
  order: SignupOrderData;
  onBack?: () => void;
}

export default function CheckoutStep({ token, order, onBack }: Props) {
  const checkoutMutation = useCreateCheckout(token);
  const resendMutation = useResendVerification(token);
  // Local "we just sent it" flash. Backed by mutation state instead of a
  // sticky banner so it disappears on the next user action.
  const [resentFlash, setResentFlash] = useState(false);
  // Payment method: card (Stripe) or manual bank transfer.
  const [method, setMethod] = useState<'card' | 'bank'>('card');

  const handleResend = async () => {
    try {
      await resendMutation.mutateAsync();
      setResentFlash(true);
      window.setTimeout(() => setResentFlash(false), 6000);
    } catch {
      // Error rendered inline via resendMutation.error.
    }
  };

  const handleCheckout = async () => {
    try {
      const result = await checkoutMutation.mutateAsync();
      window.location.href = result.data.checkoutUrl;
    } catch {
      // Error handled by mutation
    }
  };

  const oneTimeItems = order.lineItems.filter((item) => !item.metadata?.recurring);
  const recurringItems = order.lineItems.filter((item) => item.metadata?.recurring);
  const total = oneTimeItems.reduce((sum, item) => sum + item.totalCents, 0);
  const monthlyTotal = recurringItems.reduce(
    (sum, item) => sum + (Number(item.metadata?.monthlyCents) || item.unitPriceCents),
    0
  );
  // Amount actually charged now. For a plan order the plan (number included) is
  // billed via its Stripe Price, NOT a line item — so `total` (one-time lines) is
  // $0 and would understate the charge. Use the plan's price as the first payment;
  // fall back to the line-item math for legacy per-number orders.
  const plan = getPlan(order.planSlug);
  const dueTodayCents =
    plan && plan.monthly != null ? Math.round(plan.monthly * 100) + total : total;

  return (
    <div className="max-w-2xl mx-auto">
      <Card>
        <CardContent className="p-8">
          <h2 className="text-xl font-bold text-[var(--foreground)] mb-6">Order Summary</h2>

          {/* Business Info */}
          <div className="mb-6 pb-6 border-b border-[var(--border)]">
            <h3 className="text-sm font-semibold text-[var(--muted-foreground)] uppercase tracking-wide mb-2">
              Business
            </h3>
            <p className="text-[var(--foreground)] font-medium">{order.businessName}</p>
            <p className="text-sm text-[var(--muted-foreground)]">{order.contactEmail}</p>
          </div>

          {/* Numbers */}
          {order.numbers.length > 0 && (
            <div className="mb-6 pb-6 border-b border-[var(--border)]">
              <h3 className="text-sm font-semibold text-[var(--muted-foreground)] uppercase tracking-wide mb-2">
                Phone Numbers
              </h3>
              {order.numbers.map((num) => (
                <div key={num.phoneNumber} className="flex justify-between py-1">
                  <span className="font-mono text-sm text-[var(--foreground)]">
                    {num.phoneNumber}
                  </span>
                  <span className="text-sm text-[var(--muted-foreground)]">
                    {num.countryCode} - {num.numberType}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* SMS Campaign */}
          {order.smsCampaignRequested && (
            <div className="mb-6 pb-6 border-b border-[var(--border)]">
              <h3 className="text-sm font-semibold text-[var(--muted-foreground)] uppercase tracking-wide mb-2">
                SMS Campaign
              </h3>
              <div className="flex items-center gap-2 text-sm text-[var(--foreground)]">
                <FiMessageSquare className="w-4 h-4 text-[var(--foreground)]" />
                <span>SMS registration submitted for review</span>
                <FiCheck className="w-4 h-4 text-green-500" />
              </div>
            </div>
          )}

          {/* One-Time Charges */}
          <div className="mb-6 pb-6 border-b border-[var(--border)]">
            <h3 className="text-sm font-semibold text-[var(--muted-foreground)] uppercase tracking-wide mb-2">
              One-Time Charges
            </h3>
            {oneTimeItems.length === 0 ? (
              <p className="text-sm text-[var(--muted-foreground)]">No one-time charges</p>
            ) : (
              oneTimeItems.map((item) => (
                <div key={item.id} className="flex justify-between py-2">
                  <div>
                    <p className="text-sm text-[var(--foreground)]">{item.description}</p>
                    {item.quantity > 1 && (
                      <p className="text-xs text-[var(--muted-foreground)]">
                        {item.quantity}x ${(item.unitPriceCents / 100).toFixed(2)}
                      </p>
                    )}
                  </div>
                  <span className="text-sm font-medium text-[var(--foreground)]">
                    ${(item.totalCents / 100).toFixed(2)}
                  </span>
                </div>
              ))
            )}
          </div>

          {/* Recurring Charges */}
          {recurringItems.length > 0 && (
            <div className="mb-6 pb-6 border-b border-[var(--border)]">
              <h3 className="text-sm font-semibold text-[var(--muted-foreground)] uppercase tracking-wide mb-2">
                Monthly Recurring
              </h3>
              {recurringItems.map((item) => (
                <div key={item.id} className="flex justify-between py-2">
                  <p className="text-sm text-[var(--foreground)]">{item.description}</p>
                  <span className="text-sm font-medium text-[var(--foreground)]">
                    $
                    {((Number(item.metadata?.monthlyCents) || item.unitPriceCents) / 100).toFixed(
                      2
                    )}
                    /mo
                  </span>
                </div>
              ))}
              <div className="flex justify-between pt-2 mt-2 border-t border-[var(--border)]/50">
                <span className="text-sm font-semibold text-[var(--muted-foreground)]">
                  Monthly total
                </span>
                <span className="text-sm font-semibold text-[var(--foreground)]">
                  ${(monthlyTotal / 100).toFixed(2)}/mo
                </span>
              </div>
            </div>
          )}

          {/* Total */}
          <div className="flex justify-between items-center mb-2">
            <span className="text-lg font-bold text-[var(--foreground)]">Due Today</span>
            <span className="text-2xl font-bold text-[var(--foreground)]">
              ${(dueTodayCents / 100).toFixed(2)}
            </span>
          </div>
          {recurringItems.length > 0 && (
            <p className="text-xs text-[var(--muted-foreground)] mb-8">
              + ${(monthlyTotal / 100).toFixed(2)}/mo recurring starting next billing cycle
            </p>
          )}
          {recurringItems.length === 0 && <div className="mb-8" />}

          {/* Email verification gate.
              The backend rejects /checkout with a 400 + `details[0].code
              === 'EMAIL_NOT_VERIFIED'` when emailVerified is false, but
              we'd rather not let the user click Pay only to bounce back
              with an error. Disable the button and render the resend
              affordance inline. */}
          {!order.emailVerified ? (
            <div className="mb-6 p-4 rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-700">
              <div className="flex items-start gap-3">
                <FiMail className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-semibold text-amber-900 dark:text-amber-100 mb-1">
                    Verify your email before paying
                  </h4>
                  <p className="text-sm text-amber-800 dark:text-amber-200 mb-3">
                    We sent a verification link to{' '}
                    <strong className="break-all">{order.contactEmail}</strong>. Click it to unlock
                    checkout.
                  </p>
                  <div className="flex flex-wrap items-center gap-3">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={handleResend}
                      loading={resendMutation.isPending}
                    >
                      Resend verification email
                    </Button>
                    {resentFlash && (
                      <span className="text-xs text-green-700 dark:text-green-300 inline-flex items-center gap-1">
                        <FiCheck className="w-3.5 h-3.5" />
                        Sent — check your inbox
                      </span>
                    )}
                    {resendMutation.isError && (
                      <span className="text-xs text-red-700 dark:text-red-300">
                        {resendMutation.error instanceof Error
                          ? resendMutation.error.message
                          : 'Resend failed'}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {!order.emailVerified ? (
            <div className="flex gap-3">
              {onBack && (
                <Button type="button" variant="outline" size="xl" onClick={onBack} className="flex-shrink-0">
                  <FiArrowLeft className="w-5 h-5" />
                </Button>
              )}
              <Button size="xl" className="w-full" disabled>
                Verify email to continue
              </Button>
            </div>
          ) : (
            <>
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
                        ? 'bg-[var(--primary-600)] text-white'
                        : 'text-[var(--muted-foreground)] hover:bg-[var(--muted)]'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {method === 'card' ? (
                <>
                  <div className="flex gap-3">
                    {onBack && (
                      <Button
                        type="button"
                        variant="outline"
                        size="xl"
                        onClick={onBack}
                        className="flex-shrink-0"
                      >
                        <FiArrowLeft className="w-5 h-5" />
                      </Button>
                    )}
                    <Button
                      onClick={handleCheckout}
                      loading={checkoutMutation.isPending}
                      size="xl"
                      className="w-full"
                      disabled={checkoutMutation.isPending}
                    >
                      {checkoutMutation.isPending
                        ? 'Redirecting to payment...'
                        : `Pay $${(dueTodayCents / 100).toFixed(2)} with Stripe`}
                    </Button>
                  </div>
                  {checkoutMutation.isError && (
                    <div className="mt-4 flex items-center justify-center gap-2 text-sm text-[var(--danger)]">
                      <FiAlertCircle className="w-4 h-4" />
                      <span>
                        {checkoutMutation.error instanceof Error
                          ? checkoutMutation.error.message
                          : 'Payment initialization failed'}
                      </span>
                    </div>
                  )}
                </>
              ) : (
                <BankTransferPanel
                  token={token}
                  amountLabel={`$${(dueTodayCents / 100).toFixed(2)}`}
                  onBack={onBack}
                />
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
