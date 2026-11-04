
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
  onSelfServe: (plan: PlanSlug, billing: BillingPeriod) => void;
  onCustom: () => void;
}

function ChannelChip({ active, icon: Icon, label }: { active: boolean; icon: React.ComponentType<{ size?: number }>; label: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
        active
          ? 'border-[#ff7838]/30 bg-[#ff7838]/10 text-[#ff7838]'
          : 'border-[#36363a] bg-[#202023] text-[#85858e] line-through'
      }`}
    >
      <Icon size={10} />
      {label}
    </span>
  );
}

export default function PlanSelectionStep({ initialPlan, onSelfServe, onCustom }: Props) {
  const billing: BillingPeriod = 'monthly';
  const [selected, setSelected] = useState<PlanSlug>(initialPlan ?? 'starter');

  const proceed = (plan: Plan) => {
    if (plan.selfServe) onSelfServe(plan.slug, billing);
    else onCustom();
  };

  return (
    <div className="mx-auto max-w-3xl">
      <div role="radiogroup" aria-label="Choose a plan" className="grid grid-cols-1 gap-5 md:grid-cols-2">
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
              transition={{ duration: 0.4, delay: i * 0.06, ease: [0.22, 1, 0, 1] }}
              onClick={() => setSelected(plan.slug)}
              className={`relative flex flex-col rounded-2xl border-2 p-6 text-left transition-all duration-300 ${
                isSel
                  ? 'border-[#ff6a00] bg-[#1c1715] shadow-lg shadow-[#ff6a00]/10'
                  : 'border-[#2d2d31] bg-[#171719] hover:border-[#ff7838]/50 hover:bg-[#1c1b1b]'
              }`}
            >
              {plan.highlighted && (
                <span className="absolute -top-3 left-6 inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-[#ff7a00] to-[#e81e2b] px-3 py-0.5 text-[11px] font-bold text-white shadow">
                  <HiSparkles size={12} /> Most popular
                </span>
              )}

              {isSel && (
                <span className="absolute right-4 top-4 grid h-6 w-6 place-items-center rounded-full bg-[#ff6a00] text-white">
                  <FiCheck size={14} />
                </span>
              )}

              <h3 className="text-lg font-bold text-white">{plan.name}</h3>

              <p className="mt-1 text-sm text-[#a1a1aa]">{plan.description}</p>

              <div className="mt-3 flex flex-wrap gap-1.5">
                <ChannelChip active={plan.channels.sip} icon={FiPhoneCall} label="Calls" />
                <ChannelChip active={plan.channels.sms} icon={FiMessageSquare} label="SMS" />
                <ChannelChip active={plan.channels.recording} icon={FiMic} label="Rec" />
              </div>

              <div className="mt-5 flex flex-wrap items-baseline gap-1">
                <span className="text-4xl font-bold text-white">
                  {planPriceLabel(plan, billing)}
                </span>

                {plan.monthly !== null && (
                  <span className="text-sm text-[#a1a1aa]">/mo</span>
                )}
              </div>

              <ul className="mt-5 flex-1 space-y-2">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-[#e4e4e7]">
                    <FiCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#ff7838]" />
                    {f}
                  </li>
                ))}
              </ul>

              <span
                className={`mt-6 inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-bold text-white transition-all ${
                  isSel
                    ? 'bg-gradient-to-r from-[#ff7a00] via-[#ff4d00] to-[#e81e2b]'
                    : 'bg-[#29292d] hover:bg-[#353539]'
                }`}
              >
                {isSel ? 'Selected' : 'Select'}
              </span>
            </motion.button>
          );
        })}
      </div>

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
