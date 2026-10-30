'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  FiZap,
  FiCheck,
  FiMessageSquare,
  FiLock,
  FiArrowRight,
  FiLoader,
  FiClock,
} from 'react-icons/fi';
import { Button, ConfirmModal, Modal } from '@/components/ui';
import { useBundles, usePurchaseBundle, useCancelBundle } from '@/lib/hooks/useBundles';
import { useOrgBilling } from '@/lib/hooks/useOrg';
import type { BundleDef, BundleSlug } from '@/lib/api/services/bundle.service';
import AddonPayChoice from '@/components/org/AddonPayChoice';

function dollars(cents: number): string {
  return `$${Math.round(cents / 100)}`;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/** A single labelled usage meter (used / included) with a colour ramp. */
function Meter({
  icon: Icon,
  label,
  used,
  total,
  unit,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  used: number;
  total: number;
  unit: string;
}) {
  const pct = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0;
  const remaining = Math.max(0, Math.round((total - used) * 10) / 10);
  const bar = pct >= 100 ? 'bg-red-500' : pct >= 80 ? 'bg-amber-500' : 'bg-emerald-500';
  return (
    <div>
      <div className="flex items-center justify-between text-sm">
        <span className="inline-flex items-center gap-1.5 font-medium text-[var(--foreground)]">
          <Icon className="h-4 w-4 text-[var(--muted-foreground)]" />
          {label}
        </span>
        <span className="tabular-nums text-[var(--muted-foreground)]">
          <span className="font-semibold text-[var(--foreground)]">{remaining.toLocaleString()}</span> {unit} left
        </span>
      </div>
      <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-[var(--muted)]">
        <div className={`h-full rounded-full transition-all duration-500 ${bar}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-1 text-xs tabular-nums text-[var(--muted-foreground)]">
        {used.toLocaleString()} / {total.toLocaleString()} {unit} used
      </div>
    </div>
  );
}

function TierCard({
  tier,
  isCurrent,
  hasActive,
  canceling,
  canPurchase,
  pending,
  onChoose,
}: {
  tier: BundleDef;
  isCurrent: boolean;
  hasActive: boolean;
  canceling: boolean;
  canPurchase: boolean;
  pending: boolean;
  onChoose: (slug: BundleSlug) => void;
}) {
  return (
    <div
      className={`relative flex w-full flex-col rounded-2xl border p-6 transition sm:w-60 ${
        isCurrent
          ? 'border-[var(--primary-600)] bg-[var(--primary-600)]/[0.04] shadow-sm'
          : 'border-[var(--border)] bg-[var(--card)] hover:border-[var(--primary-600)]/40'
      }`}
    >
      {isCurrent && (
        <span className="absolute -top-2.5 left-5 inline-flex items-center gap-1 rounded-full bg-[var(--primary-600)] px-2.5 py-0.5 text-[11px] font-bold text-white">
          <FiCheck size={11} /> Current
        </span>
      )}

      {/* Hero: the SMS quantity is the product. */}
      <div className="flex items-baseline gap-1.5">
        <span className="text-3xl font-extrabold tracking-tight text-[var(--foreground)]">
          {tier.sms.toLocaleString()}
        </span>
        <span className="text-sm font-semibold text-[var(--muted-foreground)]">SMS/mo</span>
      </div>

      {/* Price */}
      <div className="mt-1.5 flex items-baseline gap-1">
        <span className="text-xl font-bold text-[var(--foreground)]">{dollars(tier.monthlyCents)}</span>
        <span className="text-sm text-[var(--muted-foreground)]">/mo</span>
      </div>

      <ul className="mt-4 space-y-2 text-[13px] text-[var(--muted-foreground)] flex-1">
        <li className="flex items-center gap-2">
          <FiMessageSquare className="h-3.5 w-3.5 shrink-0 text-[var(--primary-600)]" />
          Priority over your base SMS
        </li>
        <li className="flex items-center gap-2">
          <FiCheck className="h-3.5 w-3.5 shrink-0 text-[var(--primary-600)]" />
          Auto-renews · cancel anytime
        </li>
      </ul>

      <Button
        className="mt-5 w-full"
        size="sm"
        variant={isCurrent && !canceling ? 'outline' : 'primary'}
        disabled={!canPurchase || pending || (isCurrent && !canceling)}
        onClick={() => onChoose(tier.slug)}
      >
        {pending ? (
          <FiLoader className="h-4 w-4 animate-spin" />
        ) : isCurrent && canceling ? (
          'Resume'
        ) : isCurrent ? (
          'Active'
        ) : hasActive ? (
          'Switch'
        ) : (
          `Get ${tier.sms.toLocaleString()} SMS`
        )}
      </Button>
    </div>
  );
}

/**
 * SMS packages for Plan & billing. Calling is unlimited once business KYC is
 * approved, so only SMS is sold here — packages unlock after the org's 10DLC
 * (A2P) SMS registration is approved. Shows the active package with a live SMS
 * meter, the catalog to buy/switch, and past-cycle history. Renders nothing for
 * non-metered (nuxcall/prod) orgs.
 */
export default function BundlesSection() {
  const { data, isLoading, isError } = useBundles();
  const { data: billing, isLoading: billingLoading } = useOrgBilling();
  const purchase = usePurchaseBundle();
  const cancel = useCancelBundle();
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [confirmSwitch, setConfirmSwitch] = useState<BundleSlug | null>(null);
  const [confirmPurchase, setConfirmPurchase] = useState<BundleSlug | null>(null);
  // Card-less orgs can't be charged via the instant Stripe path — route them to
  // the pay-choice (add a card, or manual bank transfer with admin approval).
  const [payChoice, setPayChoice] = useState<BundleSlug | null>(null);
  const hasCard = !!billing?.paymentMethod;

  // Non-metered orgs (nuxcall/prod) have no package surface. On a fetch error,
  // hide the section rather than block the rest of Plan & billing.
  if (isError) return null;
  if (!isLoading && data && data.kycStatus === 'not_required') return null;

  if (isLoading || !data) {
    return (
      <section>
        <div className="flex items-center justify-center h-32">
          <FiLoader className="h-6 w-6 animate-spin text-[var(--muted-foreground)]" />
        </div>
      </section>
    );
  }

  const { active, catalog, canPurchase, callVerified, history, basePlan } = data;

  const choose = (slug: BundleSlug) => {
    // Wait until billing (card status) is known — otherwise a card-having org
    // could be routed to the "add card" path during the load window.
    if (billingLoading) return;
    // No card on file → let them add one (instant) or pay by bank transfer.
    if (!hasCard) {
      setPayChoice(slug);
      return;
    }
    // Always gate behind a confirmation — never a one-click charge.
    if (active) setConfirmSwitch(slug);
    else setConfirmPurchase(slug);
  };

  const purchaseTier = catalog.find((t) => t.slug === confirmPurchase);
  const payChoiceTier = catalog.find((t) => t.slug === payChoice);

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--primary-600)]/10 text-[var(--primary-600)]">
          <FiZap className="h-4 w-4" />
        </span>
        <div>
          <h2 className="text-lg font-bold text-[var(--foreground)]">SMS packages</h2>
          <p className="text-sm text-[var(--muted-foreground)]">
            Add SMS that renews every month. A package takes priority over the plan&apos;s{' '}
            {basePlan.sms} SMS. Calling is unlimited once your business is verified.
          </p>
        </div>
      </div>

      {/* Locked until 10DLC approved */}
      {!canPurchase && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-900/20">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <FiLock className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
              <div>
                <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">
                  Complete 10DLC registration to unlock SMS packages
                </p>
                <p className="mt-0.5 text-sm text-amber-700 dark:text-amber-300">
                  {callVerified
                    ? `Your business is verified — calling is unlimited. Register for 10DLC (A2P) to buy SMS packages. Until then you're on the base ${basePlan.sms} SMS / month.`
                    : `First verify your business to unlock unlimited calling, then complete 10DLC to add SMS packages. Until then you're on ${basePlan.minutes} min + ${basePlan.sms} SMS / month.`}
                </p>
              </div>
            </div>
            <Link
              href="/org/registrations"
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-amber-700"
            >
              {callVerified ? 'Register' : 'Verify'} <FiArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      )}

      {/* Active package with live SMS meter */}
      {active && (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-[var(--foreground)]">{active.label} package</h3>
                {active.canceling ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                    Canceling
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                    Active
                  </span>
                )}
              </div>
              <p className="mt-0.5 inline-flex items-center gap-1.5 text-xs text-[var(--muted-foreground)]">
                <FiClock className="h-3.5 w-3.5" />
                {active.canceling
                  ? `Active until ${fmtDate(active.periodEnd)} · won't renew`
                  : `Renews ${fmtDate(active.periodEnd)} · ${dollars(active.priceCents)}/mo`}
              </p>
            </div>
            {!active.canceling && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setConfirmCancel(true)}
                loading={cancel.isPending}
              >
                Cancel package
              </Button>
            )}
          </div>
          <div className="mt-4">
            <Meter
              icon={FiMessageSquare}
              label="Messaging"
              used={active.smsUsed}
              total={active.smsIncluded}
              unit="SMS"
            />
          </div>
        </div>
      )}

      {/* Catalog — centered so a partial last row (or fewer tiers) stays balanced. */}
      <div className="flex flex-wrap items-stretch justify-center gap-4">
        {catalog.map((tier) => (
          <TierCard
            key={tier.slug}
            tier={tier}
            isCurrent={active?.slug === tier.slug}
            hasActive={!!active}
            canceling={!!active?.canceling}
            canPurchase={canPurchase}
            pending={purchase.isPending || cancel.isPending || billingLoading}
            onChoose={choose}
          />
        ))}
      </div>

      {/* History */}
      {history.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-bold text-[var(--foreground)]">Usage history</h3>
          <div className="overflow-hidden rounded-xl border border-[var(--border)]">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] text-left text-[var(--muted-foreground)]">
                  <th className="px-4 py-2.5 font-medium">Package</th>
                  <th className="px-4 py-2.5 font-medium">Period</th>
                  <th className="px-4 py-2.5 font-medium">SMS</th>
                  <th className="px-4 py-2.5 font-medium">Ended</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h) => (
                  <tr key={h.id} className="border-b border-[var(--border)] last:border-0">
                    <td className="px-4 py-2.5 font-medium text-[var(--foreground)]">
                      {h.smsIncluded.toLocaleString()} SMS
                    </td>
                    <td className="px-4 py-2.5 text-[var(--muted-foreground)]">
                      {fmtDate(h.periodStart)} – {fmtDate(h.periodEnd)}
                    </td>
                    <td className="px-4 py-2.5 tabular-nums text-[var(--muted-foreground)]">
                      {h.smsUsed.toLocaleString()} / {h.smsIncluded.toLocaleString()}
                    </td>
                    <td className="px-4 py-2.5 capitalize text-[var(--muted-foreground)]">
                      {h.endedReason}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={confirmCancel}
        onClose={() => setConfirmCancel(false)}
        onConfirm={() => {
          cancel.mutate();
          setConfirmCancel(false);
        }}
        title="Cancel SMS package?"
        message={
          active
            ? `Your package stays active until ${fmtDate(active.periodEnd)}, then it won't renew and SMS reverts to the base ${basePlan.sms} / month. There's no refund for the current period. You can re-subscribe any time.`
            : ''
        }
        confirmText="Cancel package"
        cancelText="Keep package"
        variant="danger"
        loading={cancel.isPending}
      />

      <ConfirmModal
        isOpen={confirmPurchase !== null}
        onClose={() => setConfirmPurchase(null)}
        onConfirm={() => {
          if (confirmPurchase) purchase.mutate(confirmPurchase);
          setConfirmPurchase(null);
        }}
        title={`Subscribe to the ${purchaseTier?.label ?? ''} package?`}
        message={
          purchaseTier
            ? `You'll get ${purchaseTier.sms.toLocaleString()} SMS every month. Your card on file is charged ${dollars(
                purchaseTier.monthlyCents
              )}/mo — prorated for the rest of this billing cycle now, then ${dollars(
                purchaseTier.monthlyCents
              )}/mo automatically until you cancel.`
            : ''
        }
        confirmText={purchaseTier ? `Subscribe · ${dollars(purchaseTier.monthlyCents)}/mo` : 'Subscribe'}
        cancelText="Cancel"
        loading={purchase.isPending}
      />

      <ConfirmModal
        isOpen={confirmSwitch !== null}
        onClose={() => setConfirmSwitch(null)}
        onConfirm={() => {
          if (confirmSwitch) purchase.mutate(confirmSwitch);
          setConfirmSwitch(null);
        }}
        title="Switch SMS package?"
        message="Your current package's cycle is closed and moved to history, and the new package starts now. Your card is charged for the new package (prorated)."
        confirmText="Switch package"
        cancelText="Keep current"
        loading={purchase.isPending}
      />

      {/* Card-less pay choice — add a card (instant) or bank transfer (12–24h). */}
      <Modal
        isOpen={payChoice !== null}
        onClose={() => setPayChoice(null)}
        title="Choose how to pay"
        size="md"
      >
        {payChoiceTier && (
          <AddonPayChoice
            addon={{ addonType: 'sms_package', bundleSlug: payChoiceTier.slug }}
            label={`${payChoiceTier.sms.toLocaleString()} SMS package`}
            amountLabel={`$${(payChoiceTier.monthlyCents / 100).toFixed(2)}`}
            onBack={() => setPayChoice(null)}
            onSubmitted={() => setPayChoice(null)}
          />
        )}
      </Modal>
    </section>
  );
}
