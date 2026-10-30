import React from 'react';
import { FiArrowLeft, FiPhone, FiInfo, FiMessageSquare, FiImage } from 'react-icons/fi';
import { AvailableNumberItem } from './types';
import { NumberTypeBadge } from './NumberTypeBadge';
import { formatPhoneUS } from '@/lib/utils/phone';

interface NumberPurchaseReviewProps {
  number: AvailableNumberItem;
  onBack: () => void;
}

export function NumberPurchaseReview({ number, onBack }: NumberPurchaseReviewProps) {
  const formatted = formatPhoneUS(number.phoneNumber);
  const locationText =
    [number.locality, number.region].filter(Boolean).join(', ') ||
    (number.countryCode === 'CA' ? 'Canada' : 'United States');
  const price = (number.monthlyCostCents / 100).toFixed(2);

  return (
    <div className="space-y-4">
      {/* Back button */}
      <div>
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
        >
          <FiArrowLeft className="w-3.5 h-3.5" />
          <span>Choose a different number</span>
        </button>
      </div>

      {/* Selected Number Card */}
      <div className="p-4 rounded-xl border border-[var(--primary)]/30 bg-[var(--primary)]/5 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[var(--primary)]/10 text-[var(--primary)] grid place-items-center shrink-0">
              <FiPhone className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-base font-bold text-[var(--foreground)]">
                  {formatted}
                </span>
                <NumberTypeBadge type={number.numberType} />
              </div>
              <p className="text-xs text-[var(--muted-foreground)] mt-0.5">{locationText}</p>
            </div>
          </div>

          <div className="text-right shrink-0">
            <span className="text-base font-bold text-[var(--foreground)]">${price}</span>
            <span className="text-xs text-[var(--muted-foreground)]"> / mo</span>
          </div>
        </div>

        {/* Feature Pills */}
        <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-[var(--primary)]/15">
          <span className="text-[11px] font-medium text-[var(--muted-foreground)] mr-1">
            Included features:
          </span>
          {number.features.map((feature) => {
            const fLower = feature.toLowerCase();
            return (
              <span
                key={feature}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-[var(--card)] border border-[var(--border)] text-[var(--foreground)] capitalize"
              >
                {fLower === 'voice' && <FiPhone className="w-2.5 h-2.5 text-[var(--primary)]" />}
                {fLower === 'sms' && <FiMessageSquare className="w-2.5 h-2.5 text-[var(--primary)]" />}
                {fLower === 'mms' && <FiImage className="w-2.5 h-2.5 text-[var(--primary)]" />}
                {fLower}
              </span>
            );
          })}
        </div>
      </div>

      {/* Product Rule Notice */}
      <div className="flex items-start gap-2.5 p-3 rounded-xl bg-blue-50/60 dark:bg-blue-950/20 border border-blue-200/60 dark:border-blue-800/40 text-xs text-blue-900 dark:text-blue-200 leading-relaxed">
        <FiInfo className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
        <div>
          <strong className="font-semibold">Unassigned by default:</strong> Purchasing this number
          adds it to your organization&apos;s inventory. You can assign it to a team member anytime
          from the numbers table.
        </div>
      </div>
    </div>
  );
}
