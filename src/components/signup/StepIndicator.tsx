'use client';

import React from 'react';
import { FiCheck } from 'react-icons/fi';

interface StepIndicatorProps {
  steps: string[];
  currentStep: number;
  onStepClick?: (step: number) => void;
}

/**
 * Signup progress stepper. Numbered circles joined by a connector that fills
 * as the user advances; the current step is ringed, completed steps show a
 * check and are clickable to go back. Labels sit under each node on md+ and
 * collapse to a single "Step N of M · Label" line on mobile.
 */
export default function StepIndicator({ steps, currentStep, onStepClick }: StepIndicatorProps) {
  const total = steps.length;

  return (
    <nav aria-label="Signup progress">
      {/* Desktop / tablet — full horizontal stepper */}
      <ol className="hidden sm:flex items-start justify-between">
        {steps.map((step, index) => {
          const stepNum = index + 1;
          const isActive = stepNum === currentStep;
          const isCompleted = stepNum < currentStep;
          const isClickable = isCompleted && !!onStepClick;
          const isLast = index === total - 1;

          return (
            <li key={step} className="flex-1 flex flex-col items-center relative">
              {/* Connector to the NEXT node — sits behind the circle row */}
              {!isLast && (
                <span
                  aria-hidden="true"
                  className={`absolute top-5 left-1/2 h-0.5 w-full transition-colors ${
                    stepNum < currentStep ? 'bg-[var(--coral)]' : 'bg-[var(--border)]'
                  }`}
                />
              )}

              <button
                type="button"
                disabled={!isClickable}
                onClick={() => isClickable && onStepClick(stepNum)}
                className={`relative z-10 flex flex-col items-center gap-2 ${
                  isClickable ? 'cursor-pointer group' : 'cursor-default'
                }`}
                aria-current={isActive ? 'step' : undefined}
              >
                <span
                  className={`flex h-10 w-10 items-center justify-center rounded-full border-2 text-sm font-bold transition-all ${
                    isCompleted
                      ? `border-emerald-500 bg-emerald-500 text-white ${
                          isClickable ? 'group-hover:brightness-110' : ''
                        }`
                      : isActive
                        ? 'border-[var(--coral)] bg-[var(--card)] text-[var(--coral-700)] ring-4 ring-[var(--coral)]/15'
                        : 'border-[var(--border)] bg-[var(--card)] text-[var(--muted-foreground)]'
                  }`}
                >
                  {isCompleted ? <FiCheck className="h-5 w-5" /> : stepNum}
                </span>
                <span
                  className={`text-xs font-semibold text-center max-w-[9rem] leading-tight transition-colors ${
                    isActive
                      ? 'text-[var(--foreground)]'
                      : isCompleted
                        ? 'text-[var(--foreground)]'
                        : 'text-[var(--muted-foreground)]'
                  }`}
                >
                  {step}
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      {/* Mobile — compact progress bar + current label */}
      <div className="sm:hidden">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold uppercase tracking-wide text-[var(--muted-foreground)]">
            Step {currentStep} of {total}
          </span>
          <span className="text-sm font-semibold text-[var(--foreground)]">
            {steps[currentStep - 1]}
          </span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-[var(--border)] overflow-hidden">
          <div
            className="h-full rounded-full bg-[var(--coral)] transition-all duration-300"
            style={{ width: `${(currentStep / total) * 100}%` }}
          />
        </div>
      </div>
    </nav>
  );
}
