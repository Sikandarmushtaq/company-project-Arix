import React from 'react';
import { FiPhone, FiMessageSquare, FiImage } from 'react-icons/fi';
import { AvailableNumberItem } from './types';
import { NumberTypeBadge } from './NumberTypeBadge';
import { formatPhoneUS } from '@/lib/utils/phone';

interface AvailableNumberCardProps {
  number: AvailableNumberItem;
  isSelected?: boolean;
  onSelect: (number: AvailableNumberItem) => void;
}

export function AvailableNumberCard({
  number,
  isSelected,
  onSelect,
}: AvailableNumberCardProps) {
  const formatted = formatPhoneUS(number.phoneNumber);
  const locationText =
    [number.locality, number.region].filter(Boolean).join(', ') ||
    (number.countryCode === 'CA' ? 'Canada' : 'United States');
  const price = (number.monthlyCostCents / 100).toFixed(2);

  return (
    <div
      onClick={() => onSelect(number)}
      className={`group p-3.5 rounded-xl border transition-all cursor-pointer text-left flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
        isSelected
          ? 'border-[var(--primary)] bg-[var(--primary)]/5 ring-1 ring-[var(--primary)] shadow-sm'
          : 'border-[var(--border)] bg-[var(--card)] hover:border-[var(--primary)]/60 hover:bg-[var(--muted)]/40 hover:shadow-xs'
      }`}
    >
      {/* Left side: Phone number, location, and capability pills */}
      <div className="min-w-0 space-y-1.5">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-mono text-sm font-bold text-[var(--foreground)] group-hover:text-[var(--primary)] transition-colors">
            {formatted}
          </span>
          <NumberTypeBadge type={number.numberType} />
        </div>

        <p className="text-xs text-[var(--muted-foreground)]">{locationText}</p>

        {/* Feature Pills */}
        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
          {number.features.map((feature) => {
            const fLower = feature.toLowerCase();
            return (
              <span
                key={feature}
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-[var(--muted)] text-[var(--muted-foreground)] capitalize"
              >
                {fLower === 'voice' && <FiPhone className="w-2.5 h-2.5" />}
                {fLower === 'sms' && <FiMessageSquare className="w-2.5 h-2.5" />}
                {fLower === 'mms' && <FiImage className="w-2.5 h-2.5" />}
                {fLower}
              </span>
            );
          })}
        </div>
      </div>

      {/* Right side: Price & Select button */}
      <div className="flex sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto shrink-0 gap-2 border-t sm:border-t-0 pt-2 sm:pt-0 border-[var(--border)]/60">
        <div className="text-right">
          <span className="text-sm font-bold text-[var(--foreground)]">${price}</span>
          <span className="text-xs text-[var(--muted-foreground)]"> / mo</span>
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onSelect(number);
          }}
          className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors ${
            isSelected
              ? 'bg-[var(--primary)] text-white shadow-xs'
              : 'border border-[var(--border)] text-[var(--foreground)] group-hover:border-[var(--primary)]/60 group-hover:bg-[var(--primary)]/10 group-hover:text-[var(--primary)]'
          }`}
        >
          {isSelected ? 'Selected' : 'Select'}
        </button>
      </div>
    </div>
  );
}
