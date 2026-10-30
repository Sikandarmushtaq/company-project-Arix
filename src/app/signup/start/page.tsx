'use client';

import React, { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { FiCheck } from 'react-icons/fi';
import BusinessDetailsStep from '@/components/signup/BusinessDetailsStep';
import PlanSelectionStep from '@/components/signup/PlanSelectionStep';
import LeadSignupForm from '@/components/signup/LeadSignupForm';
import { getPlan, type BillingPeriod, type PlanSlug } from '@/components/signup/plans';

type Phase = 'plan' | 'account' | 'custom';

const STEPS = ['Choose Plan', 'Business Details', 'Choose Numbers'];

function Stepper({ current }: { current: number }) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-2 sm:gap-x-3">
      {STEPS.map((label, i) => {
        const n = i + 1;
        const done = n < current;
        const active = n === current;
        return (
          <React.Fragment key={label}>
            <div className="flex items-center gap-2">
              <span
                className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold transition-colors ${
                  done
                    ? 'bg-emerald-500 text-white'
                    : active
                      ? 'bg-[var(--coral)] text-white shadow-sm shadow-[var(--coral)]/30'
                      : 'bg-[var(--muted)] text-[var(--muted-foreground)] ring-1 ring-[var(--border)]'
                }`}
              >
                {done ? <FiCheck className="h-4 w-4" strokeWidth={3} /> : n}
              </span>
              <span
                className={`text-sm ${
                  active || done
                    ? 'font-semibold text-[var(--foreground)]'
                    : 'text-[var(--muted-foreground)]'
                }`}
              >
                {label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <span className="hidden h-px w-6 bg-[var(--border)] sm:inline-block sm:w-10" />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

export default function SignupStartPage() {
  const search = useSearchParams();
  const initialPlan = getPlan(search.get('plan'))?.slug;
  const initialBilling: BillingPeriod = search.get('billing') === 'yearly' ? 'yearly' : 'monthly';

  const [phase, setPhase] = useState<Phase>('plan');
  const [plan, setPlan] = useState<PlanSlug>(initialPlan ?? 'starter');
  const [billing, setBilling] = useState<BillingPeriod>(initialBilling);

  const heading =
    phase === 'plan'
      ? { title: 'Pick the plan that fits', sub: 'You can change or upgrade later.' }
      : phase === 'custom'
        ? {
            title: 'Tell us what you need',
            sub: "Share your requirements and we'll tailor a plan and reach out.",
          }
        : {
            title: 'Create your account',
            sub: 'Almost there! Tell us a few details about your business to get started.',
          };

  return (
    <div className="mx-auto max-w-6xl">
      <motion.div
        key={phase}
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="mb-8 text-center"
      >
        {phase !== 'custom' && <Stepper current={phase === 'plan' ? 1 : 2} />}
        <h1 className="mt-5 text-3xl font-bold tracking-tight text-[var(--foreground)] sm:text-4xl">
          {heading.title}
        </h1>
        <p className="mx-auto mt-2 max-w-xl text-[var(--muted-foreground)]">{heading.sub}</p>
      </motion.div>

      {phase === 'plan' && (
        <PlanSelectionStep
          initialPlan={plan}
          initialBilling={billing}
          onSelfServe={(p, b) => {
            setPlan(p);
            setBilling(b);
            setPhase('account');
          }}
          onCustom={() => setPhase('custom')}
        />
      )}

      {phase === 'account' && (
        <div className="mx-auto max-w-5xl">
          <BusinessDetailsStep plan={plan} billing={billing} onBackToPlans={() => setPhase('plan')} />
        </div>
      )}

      {phase === 'custom' && (
        <div className="mx-auto max-w-2xl">
          <div className="mb-4 text-center">
            <button
              type="button"
              onClick={() => setPhase('plan')}
              className="text-sm font-semibold text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            >
              ← Back to plans
            </button>
          </div>
          <LeadSignupForm />
        </div>
      )}
    </div>
  );
}
