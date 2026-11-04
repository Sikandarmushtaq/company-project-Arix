
'use client';

import React from 'react';
import { FiCheck } from 'react-icons/fi';

interface StepIndicatorProps {
  steps: string[];
  currentStep: number;
  onStepClick?: (step: number) => void;
}

export default function StepIndicator({ steps, currentStep, onStepClick }: StepIndicatorProps) {
  const total = steps.length;

  return (
    <nav aria-label="Signup progress">
      <ol className="hidden items-start justify-between sm:flex">
        {steps.map((step, index) => {
          const stepNum = index + 1;
          const isActive = stepNum === currentStep;
          const isCompleted = stepNum < currentStep;
          const isClickable = isCompleted && !!onStepClick;
          const isLast = index === total - 1;

          return (
            <li key={step} className="relative flex flex-1 flex-col items-center">
              {!isLast && (
                <span
                  aria-hidden="true"
                  className={`absolute left-1/2 top-5 h-0.5 w-full transition-colors ${
                    stepNum < currentStep ? 'bg-[#ff7838]' : 'bg-[#2d2d31]'
                  }`}
                />
              )}

              <button
                type="button"
                disabled={!isClickable}
                onClick={() => isClickable && onStepClick(stepNum)}
                className={`relative z-10 flex flex-col items-center gap-2 ${
                  isClickable ? 'group cursor-pointer' : 'cursor-default'
                }`}
                aria-current={isActive ? 'step' : undefined}
              >
                <span
                  className={`flex h-10 w-10 items-center justify-center rounded-full border-2 text-sm font-bold transition-all ${
                    isCompleted
                      ? `border-[#ff7838] bg-[#ff7838] text-white ${
                          isClickable ? 'group-hover:brightness-110' : ''
                        }`
                      : isActive
                        ? 'border-[#ff7838] bg-[#171719] text-[#ff7838] ring-4 ring-[#ff7838]/15'
                        : 'border-[#36363a] bg-[#171719] text-[#85858e]'
                  }`}
                >
                  {isCompleted ? <FiCheck className="h-5 w-5" /> : stepNum}
                </span>

                <span
                  className={`max-w-[9rem] text-center text-xs font-semibold leading-tight transition-colors ${
                    isActive || isCompleted ? 'text-white' : 'text-[#85858e]'
                  }`}
                >
                  {step}
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      <div className="sm:hidden">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wide text-[#85858e]">
            Step {currentStep} of {total}
          </span>

          <span className="text-sm font-semibold text-white">
            {steps[currentStep - 1]}
          </span>
        </div>

        <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#2d2d31]">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#ff7a00] via-[#ff4d00] to-[#e81e2b] transition-all duration-300"
            style={{ width: `${(currentStep / total) * 100}%` }}
          />
        </div>
      </div>
    </nav>
  );
}
