'use client';

import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FiAlertTriangle, FiDollarSign, FiInfo, FiPercent } from 'react-icons/fi';
import { Input } from '@/components/ui';
import { smsAdminService, type TwilioBill } from '@/lib/api/services';

interface Props {
  bill: TwilioBill;
}

const TAX_RATE_STORAGE_KEY = 'admin.twilioBill.taxRatePct';
const DEFAULT_TAX_RATE_PCT = 10;

function readSavedTaxRate(): number {
  if (typeof window === 'undefined') return DEFAULT_TAX_RATE_PCT;
  const saved = window.localStorage.getItem(TAX_RATE_STORAGE_KEY);
  if (saved === null) return DEFAULT_TAX_RATE_PCT;
  const parsed = parseFloat(saved);
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 100
    ? parsed
    : DEFAULT_TAX_RATE_PCT;
}

function fmtUsd(n: number): string {
  const abs = Math.abs(n);
  // 4dp for sub-dollar precision; whole-dollar numbers stay readable at 2dp
  return `${n < 0 ? '-' : ''}$${abs.toFixed(abs < 1 ? 4 : 2)}`;
}

function fmtPct(n: number): string {
  return `${n.toFixed(1)}%`;
}

/**
 * Live customer-charge preview computed from:
 *   - Twilio's authoritative bill (totalCost = real subtotal)
 *   - Admin-entered tax rate (persisted in localStorage)
 *   - Saved customer pricing (sms_pricing_config: out/in SMS per seg, MMS per msg)
 *
 * Business rules baked in (per user policy):
 *   - Charge for failed messages (no status filter)
 *   - Charge for inbound messages (in cost + in rate both apply)
 *   - MMS billed per message, SMS billed per segment
 *
 * Profit = customer_charge - (twilio_subtotal × (1 + tax_rate))
 */
export default function CustomerChargeCard({ bill }: Props) {
  const { data: pricing, isLoading: pricingLoading } = useQuery({
    queryKey: ['sms-pricing'],
    queryFn: () => smsAdminService.getPricing(),
  });

  // Lazy initializer — reads localStorage synchronously on first render so
  // there's no flash of the default value before the saved one loads.
  const [taxRatePct, setTaxRatePct] = useState<number>(readSavedTaxRate);

  const handleTaxRateChange = (raw: string) => {
    const parsed = parseFloat(raw);
    const safe =
      !Number.isFinite(parsed) || parsed < 0 ? 0 : Math.min(parsed, 100);
    setTaxRatePct(safe);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(TAX_RATE_STORAGE_KEY, String(safe));
    }
  };

  // Backend version check — the four aggregate fields were added together,
  // so any one being non-numeric means the server hasn't been redeployed
  // with the SMS/MMS split feature. Show a clear message instead of NaN.
  const splitsAvailable =
    typeof bill.outboundSmsSegments === 'number' &&
    typeof bill.inboundSmsSegments === 'number' &&
    typeof bill.outboundMmsCount === 'number' &&
    typeof bill.inboundMmsCount === 'number';

  const calc = useMemo(() => {
    if (!pricing || !splitsAvailable) return null;
    const taxRate = taxRatePct / 100;

    const twilioSubtotal = bill.totalCost;
    const twilioTax = twilioSubtotal * taxRate;
    const realCost = twilioSubtotal + twilioTax;

    const outSmsCharge = bill.outboundSmsSegments * pricing.smsOutboundPrice;
    const inSmsCharge = bill.inboundSmsSegments * pricing.smsInboundPrice;
    const outMmsCharge = bill.outboundMmsCount * pricing.mmsOutboundPrice;
    const inMmsCharge = bill.inboundMmsCount * pricing.mmsInboundPrice;
    const customerCharge = outSmsCharge + inSmsCharge + outMmsCharge + inMmsCharge;

    const profit = customerCharge - realCost;
    // Edge case: when realCost is 0 (no Twilio billing yet, all messages
    // pending price), any positive customer charge is infinite margin. Show
    // it that way instead of a misleading "0%".
    let marginPct: number;
    if (realCost > 0) {
      marginPct = (profit / realCost) * 100;
    } else if (customerCharge > 0) {
      marginPct = Infinity;
    } else {
      marginPct = 0;
    }

    return {
      twilioSubtotal,
      twilioTax,
      realCost,
      outSmsCharge,
      inSmsCharge,
      outMmsCharge,
      inMmsCharge,
      customerCharge,
      profit,
      marginPct,
    };
  }, [bill, pricing, taxRatePct]);

  if (pricingLoading) {
    return (
      <div className="rounded-lg border border-[var(--border)] bg-[var(--muted)]/40 p-4 text-center text-sm text-[var(--muted-foreground)]">
        Loading pricing config…
      </div>
    );
  }

  if (!splitsAvailable) {
    return (
      <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-700 dark:text-amber-300">
        <FiAlertTriangle className="inline w-4 h-4 mr-1.5" />
        <strong>Backend out of date.</strong> This Twilio bill response is
        missing the SMS/MMS split fields needed to compute the customer
        charge accurately. Deploy the latest backend (Recording API + Main
        API) to enable this view.
      </div>
    );
  }

  if (!pricing || !calc) {
    return (
      <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-700 dark:text-amber-300">
        <FiAlertTriangle className="inline w-4 h-4 mr-1.5" />
        Customer pricing config unavailable — set rates in the Customer Pricing card above to see the charge preview.
      </div>
    );
  }

  const isNegative = calc.profit < 0;

  return (
    <div className="rounded-lg border-2 border-[var(--border)]/30 bg-[var(--primary-600)]/5 p-4 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="flex items-center gap-2 text-base font-bold text-[var(--foreground)]">
          <FiDollarSign className="w-5 h-5 text-[var(--foreground)]" />
          What to charge this user
        </h3>
        <div className="flex items-center gap-2">
          <FiPercent className="w-4 h-4 text-[var(--muted-foreground)]" />
          <label
            htmlFor="customer-charge-tax-rate"
            className="text-xs font-bold uppercase tracking-wider text-[var(--muted-foreground)]"
          >
            Tax rate
          </label>
          <Input
            id="customer-charge-tax-rate"
            type="number"
            value={String(taxRatePct)}
            onChange={(e) => handleTaxRateChange(e.target.value)}
            step="0.1"
            min="0"
            max="100"
            className="w-20"
            aria-describedby="customer-charge-tax-rate-hint"
          />
          <span className="text-sm text-[var(--muted-foreground)]">%</span>
        </div>
      </div>
      <p
        id="customer-charge-tax-rate-hint"
        className="flex items-start gap-1.5 text-xs text-[var(--muted-foreground)] -mt-2"
      >
        <FiInfo className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
        <span>
          Use your blended effective rate from your last Twilio invoice
          (<code>Total Tax ÷ Pre-tax messaging subtotal</code>). Most US
          accounts land between 8–15%. Saved per browser.
        </span>
      </p>

      {/* Cost side — what Twilio charges us */}
      <div className="rounded-md border border-[var(--border)] bg-[var(--background)] p-3 space-y-1.5 text-sm">
        <div className="text-xs font-bold uppercase tracking-wider text-[var(--muted-foreground)] mb-1">
          Your real cost (Twilio + tax)
        </div>
        <div className="flex justify-between">
          <span className="text-[var(--muted-foreground)]">Twilio subtotal</span>
          <span className="font-mono">{fmtUsd(calc.twilioSubtotal)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-[var(--muted-foreground)]">
            Twilio tax ({taxRatePct}%)
          </span>
          <span className="font-mono">{fmtUsd(calc.twilioTax)}</span>
        </div>
        <div className="flex justify-between border-t border-[var(--border)] pt-1.5 font-bold">
          <span>Your real cost</span>
          <span className="font-mono text-red-600 dark:text-red-400">
            {fmtUsd(calc.realCost)}
          </span>
        </div>
      </div>

      {/* Charge side — what we charge the customer */}
      <div className="rounded-md border border-[var(--border)] bg-[var(--background)] p-3 space-y-1.5 text-sm">
        <div className="text-xs font-bold uppercase tracking-wider text-[var(--muted-foreground)] mb-1">
          Customer charge (your rates × Twilio counts)
        </div>
        <div className="flex justify-between">
          <span className="text-[var(--muted-foreground)]">
            Out SMS · {bill.outboundSmsSegments} seg × $
            {pricing.smsOutboundPrice.toFixed(4)}
          </span>
          <span className="font-mono">{fmtUsd(calc.outSmsCharge)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-[var(--muted-foreground)]">
            In SMS · {bill.inboundSmsSegments} seg × $
            {pricing.smsInboundPrice.toFixed(4)}
          </span>
          <span className="font-mono">{fmtUsd(calc.inSmsCharge)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-[var(--muted-foreground)]">
            Out MMS · {bill.outboundMmsCount} msg × $
            {pricing.mmsOutboundPrice.toFixed(4)}
          </span>
          <span className="font-mono">{fmtUsd(calc.outMmsCharge)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-[var(--muted-foreground)]">
            In MMS · {bill.inboundMmsCount} msg × $
            {pricing.mmsInboundPrice.toFixed(4)}
          </span>
          <span className="font-mono">{fmtUsd(calc.inMmsCharge)}</span>
        </div>
        <div className="flex justify-between border-t border-[var(--border)] pt-1.5 font-bold">
          <span>Customer charge</span>
          <span className="font-mono text-[var(--foreground)]">
            {fmtUsd(calc.customerCharge)}
          </span>
        </div>
      </div>

      {/* Bottom line */}
      <div
        className={`rounded-md border-2 p-3 ${
          isNegative
            ? 'border-red-500/40 bg-red-500/10'
            : 'border-green-500/40 bg-green-500/10'
        }`}
      >
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-center">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-[var(--muted-foreground)]">
              Bill this user
            </p>
            <p className="text-2xl font-bold text-[var(--foreground)] font-mono">
              {fmtUsd(calc.customerCharge)}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-[var(--muted-foreground)]">
              Profit
            </p>
            <p
              className={`text-2xl font-bold font-mono ${
                isNegative
                  ? 'text-red-600 dark:text-red-400'
                  : 'text-green-600 dark:text-green-400'
              }`}
            >
              {fmtUsd(calc.profit)}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-[var(--muted-foreground)]">
              Margin
            </p>
            <p
              className={`text-2xl font-bold font-mono ${
                isNegative
                  ? 'text-red-600 dark:text-red-400'
                  : 'text-green-600 dark:text-green-400'
              }`}
            >
              {Number.isFinite(calc.marginPct) ? fmtPct(calc.marginPct) : '∞'}
            </p>
          </div>
        </div>
        {isNegative && (
          <p className="mt-3 text-xs text-red-700 dark:text-red-300 text-center">
            <FiAlertTriangle className="inline w-3.5 h-3.5 mr-1" />
            Underwater — your rates don&apos;t cover Twilio cost + tax. Raise rates in Customer Pricing above.
          </p>
        )}
      </div>

      {bill.pendingPriceCount > 0 && (
        <p className="text-xs text-amber-600 dark:text-amber-400">
          Heads up: {bill.pendingPriceCount} message
          {bill.pendingPriceCount === 1 ? '' : 's'} have a pending Twilio
          price — the real cost (and your profit) will firm up once Twilio
          finishes pricing them.
        </p>
      )}
    </div>
  );
}
