'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { FiCheck, FiPhoneCall, FiMic, FiMessageSquare, FiArrowRight } from 'react-icons/fi';
import { HiSparkles } from 'react-icons/hi2';
import { Button } from '@/components/ui';
import { PLANS, planPriceLabel, type BillingPeriod, type PlanSlug, type Plan } from './plans';

interface Props {
  initialPlan?: PlanSlug;
  initialBilling?: BillingPeriod;
  /** Basic → proceed to account creation. */
  onSelfServe: (plan: PlanSlug, billing: BillingPeriod) => void;
  /** Pro → route to the lead form (contact sales). */
  onCustom: () => void;
}

function ChannelChip({ active, icon: Icon, label }: { active: boolean; icon: React.ComponentType<{ size?: number }>; label: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
        active
          ? 'border-[var(--primary-600)]/30 bg-[var(--primary-600)]/10 text-[var(--primary-600)]'
          : 'border-[var(--border)] bg-[var(--muted)]/40 text-[var(--muted-foreground)] line-through'
      }`}
    >
      <Icon size={10} />
      {label}
    </span>
  );
}

export default function PlanSelectionStep({ initialPlan, onSelfServe, onCustom }: Props) {
  // Basic is monthly-only, and Pro is contact-sales — there is no billing-period
  // choice anymore, so the monthly/yearly toggle is gone.
  const billing: BillingPeriod = 'monthly';
  const [selected, setSelected] = useState<PlanSlug>(initialPlan ?? 'starter');

  const proceed = (plan: Plan) => {
    if (plan.selfServe) onSelfServe(plan.slug, billing);
    else onCustom();
  };

  return (
    <div className="mx-auto max-w-3xl">
      {/* Plan cards */}
      <div role="radiogroup" aria-label="Choose a plan" className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {PLANS.map((plan, i) => {
          const isSel = selected === plan.slug;
          return (
            <motion.button
              key={plan.slug}
              type="button"
              role="radio"
              aria-checked={isSel}
              aria-label={`${plan.name} plan`}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: i * 0.06, ease: [0.22, 1, 0.36, 1] }}
              onClick={() => setSelected(plan.slug)}
              className={`relative flex flex-col rounded-2xl border-2 p-6 text-left transition-all ${
                isSel
                  ? 'border-[var(--primary-600)] bg-[var(--primary-600)]/[0.04] shadow-lg shadow-[var(--primary-600)]/10'
                  : 'border-[var(--border)] bg-[var(--card)]/90 hover:border-[var(--primary-600)]/40'
              }`}
            >
              {plan.highlighted && (
                <span className="absolute -top-3 left-6 inline-flex items-center gap-1 rounded-full bg-[var(--primary-600)] px-3 py-0.5 text-[11px] font-bold text-white shadow">
                  <HiSparkles size={12} /> Most popular
                </span>
              )}
              {isSel && (
                <span className="absolute top-4 right-4 grid h-6 w-6 place-items-center rounded-full bg-[var(--primary-600)] text-white">
                  <FiCheck size={14} />
                </span>
              )}

              <h3 className="text-lg font-bold text-[var(--foreground)]">{plan.name}</h3>
              <p className="mt-1 text-sm text-[var(--muted-foreground)]">{plan.description}</p>

              <div className="mt-3 flex flex-wrap gap-1.5">
                <ChannelChip active={plan.channels.sip} icon={FiPhoneCall} label="Calls" />
                <ChannelChip active={plan.channels.sms} icon={FiMessageSquare} label="SMS" />
                <ChannelChip active={plan.channels.recording} icon={FiMic} label="Rec" />
              </div>

              <div className="mt-5 flex items-baseline gap-1">
                <span className="text-4xl font-bold text-[var(--foreground)]">
                  {planPriceLabel(plan, billing)}
                </span>
                {plan.monthly !== null && (
                  <span className="text-sm text-[var(--muted-foreground)]">/mo</span>
                )}
              </div>

              <ul className="mt-5 space-y-2 flex-1">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-[var(--foreground)]">
                    <FiCheck className="mt-0.5 h-4 w-4 shrink-0 text-[var(--primary-600)]" />
                    {f}
                  </li>
                ))}
              </ul>

              <span
                className={`mt-6 inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-bold transition-colors ${
                  isSel
                    ? 'bg-[var(--primary-600)] text-white'
                    : 'bg-[var(--muted)] text-[var(--foreground)]'
                }`}
              >
                {isSel ? 'Selected' : 'Select'}
              </span>
            </motion.button>
          );
        })}
      </div>

      {/* Continue */}
      <div className="mt-8 flex justify-center">
        <Button
          type="button"
          size="lg"
          onClick={() => {
            const plan = PLANS.find((p) => p.slug === selected)!;
            proceed(plan);
          }}
          className="group"
        >
          {selected === 'custom' ? 'Tell us what you need' : 'Continue'}
          <FiArrowRight className="ml-1.5 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </Button>
      </div>
    </div>
  );
}
