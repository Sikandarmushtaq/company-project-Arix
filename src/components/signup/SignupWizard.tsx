
'use client';

import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import StepIndicator from './StepIndicator';
import BusinessEditStep from './BusinessEditStep';
import NumberSelectionStep from './NumberSelectionStep';
import ReviewStep from './ReviewStep';
import EmailVerifyGate from './EmailVerifyGate';
import type { SignupOrderData } from '@/lib/api/services/onboarding.service';

interface SignupWizardProps {
  token: string;
  order: SignupOrderData;
}

const STEPS = ['Business Details', 'Select Numbers', 'Review & Payment'];

export default function SignupWizard({ token, order }: SignupWizardProps) {
  const serverStep = useMemo(() => {
    switch (order.status) {
      case 'draft':
        return 2;
      case 'numbers_selected':
        return 3;
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

  if (!order.emailVerified) {
    return (
      <div className="mx-auto max-w-4xl">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-white sm:text-3xl">
            One quick check
          </h1>
          <p className="mt-1.5 text-sm text-[#a1a1aa]">
            Confirm your email to keep setting up your account.
          </p>
        </div>

        <EmailVerifyGate token={token} email={order.contactEmail} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0, 1] }}
        className="mb-8 text-center"
      >
        <h1 className="text-2xl font-bold text-white sm:text-3xl">
          Set up your account
        </h1>

        <p className="mt-1.5 text-sm text-[#a1a1aa]">
          A few quick steps and you&apos;ll be ready to make calls.
        </p>
      </motion.div>

      <div className="mb-10">
        <StepIndicator
          steps={STEPS}
          currentStep={currentStep}
          onStepClick={handleStepClick}
        />
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={currentStep}
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -24 }}
          transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
        >
          {currentStep === 1 && (
            <BusinessEditStep
              token={token}
              order={order}
              onContinue={handleForward}
            />
          )}

          {currentStep === 2 && (
            <NumberSelectionStep
              token={token}
              order={order}
              onBack={handleBack}
              onContinue={handleForward}
            />
          )}

          {currentStep === 3 && (
            <ReviewStep
              token={token}
              order={order}
              onBack={handleBack}
            />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
