'use client';

import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import StepIndicator from './StepIndicator';
import BusinessEditStep from './BusinessEditStep';
import NumberSelectionStep from './NumberSelectionStep';
import ReviewStep from './ReviewStep';
import EmailVerifyGate from './EmailVerifyGate';
// Stripe checkout is the NEXT phase — ReviewStep stands in as the terminal step
// (order summary + "payment coming next"). When Stripe is wired, swap ReviewStep
// for CheckoutStep here.
// import CheckoutStep from './CheckoutStep';
import type { SignupOrderData } from '@/lib/api/services/onboarding.service';

interface SignupWizardProps {
  token: string;
  order: SignupOrderData;
}

// SMS-campaign (10DLC) registration was removed from the signup flow — it will
// be handled inside the account/registration later. Numbers → straight to review.
const STEPS = ['Business Details', 'Select Numbers', 'Review & Payment'];

export default function SignupWizard({ token, order }: SignupWizardProps) {
  // The server's order.status is the source of truth for how far along the user
  // is; map it to the wizard step so a refresh/return-visit lands in the right
  // place. `overrideStep` lets the user click back to a completed step.
  const serverStep = useMemo(() => {
    switch (order.status) {
      case 'draft':
        return 2; // Select Numbers
      case 'numbers_selected':
        return 3; // Review & Payment (SMS step removed)
      case 'checkout_pending':
        return 3;
      default:
        return 3;
    }
  }, [order.status]);

  const [overrideStep, setOverrideStep] = useState<number | null>(null);
  const currentStep = overrideStep ?? serverStep;

  const handleStepClick = (step: number) => {
    if (step < currentStep) setOverrideStep(step);
  };
  const handleBack = () => {
    if (currentStep > 1) setOverrideStep(currentStep - 1);
  };
  const handleForward = () => setOverrideStep(null);

  // Email-verification gate — shown right after account creation, before the
  // numbers/SMS/payment steps. Verifying up front means checkout never bounces
  // with an "email not verified" error at the end. The gate verifies via a
  // 6-digit code and invalidates the order query on success, so this advances
  // automatically the moment the code is accepted (a link fallback also exists).
  if (!order.emailVerified) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-[var(--foreground)]">
            One quick check
          </h1>
          <p className="mt-1.5 text-sm text-[var(--muted-foreground)]">
            Confirm your email to keep setting up your account.
          </p>
        </div>
        <EmailVerifyGate token={token} email={order.contactEmail} />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Heading */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="text-center mb-8"
      >
        <h1 className="text-2xl sm:text-3xl font-bold text-[var(--foreground)]">
          Set up your account
        </h1>
        <p className="mt-1.5 text-sm text-[var(--muted-foreground)]">
          A few quick steps and you&apos;ll be ready to make calls.
        </p>
      </motion.div>

      {/* Progress */}
      <div className="mb-10">
        <StepIndicator steps={STEPS} currentStep={currentStep} onStepClick={handleStepClick} />
      </div>

      {/* Step body — animated cross-fade/slide between steps */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentStep}
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -24 }}
          transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
        >
          {currentStep === 1 && (
            <BusinessEditStep token={token} order={order} onContinue={handleForward} />
          )}
          {currentStep === 2 && (
            <NumberSelectionStep
              token={token}
              order={order}
              onBack={handleBack}
              onContinue={handleForward}
            />
          )}
          {currentStep === 3 && <ReviewStep token={token} order={order} onBack={handleBack} />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
