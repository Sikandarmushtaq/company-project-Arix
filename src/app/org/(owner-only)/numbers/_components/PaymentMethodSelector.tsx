import React from 'react';
import { FiCreditCard, FiHome } from 'react-icons/fi';

export type PaymentMethod = 'card' | 'bank';

interface PaymentMethodSelectorProps {
  method: PaymentMethod;
  onChange: (method: PaymentMethod) => void;
}

export function PaymentMethodSelector({ method, onChange }: PaymentMethodSelectorProps) {
  return (
    <div className="grid grid-cols-2 gap-2 p-1 rounded-xl border border-[var(--border)] bg-[var(--muted)]/30">
      <button
        type="button"
        onClick={() => onChange('card')}
        className={`inline-flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold transition-all ${
          method === 'card'
            ? 'bg-[var(--card)] text-[var(--foreground)] shadow-xs border border-[var(--border)]'
            : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
        }`}
      >
        <FiCreditCard className="w-4 h-4 text-[var(--primary)]" />
        <span>Pay by card</span>
      </button>

      <button
        type="button"
        onClick={() => onChange('bank')}
        className={`inline-flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold transition-all ${
          method === 'bank'
            ? 'bg-[var(--card)] text-[var(--foreground)] shadow-xs border border-[var(--border)]'
            : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
        }`}
      >
        <FiHome className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
        <span>Bank transfer</span>
      </button>
    </div>
  );
}
