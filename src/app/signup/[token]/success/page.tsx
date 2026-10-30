'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { FiCheck, FiLoader, FiAlertCircle, FiArrowRight, FiMail, FiLock } from 'react-icons/fi';
import { useSignupStatus } from '@/lib/hooks/useSignup';
import { Button } from '@/components/ui';
import Link from 'next/link';

/**
 * Post-Stripe return page. Stripe has taken the payment, but the account isn't
 * usable until the backend webhook (`checkout.session.completed`) marks the order
 * paid and provisions it (buys the number, creates the org/user, enables calling).
 * So we POLL status and show the true state rather than claiming success up front.
 * Readiness is keyed on status === 'active' — the ONLY state where provisioning
 * is fully done: the number is purchased AND the org/owner are activated. The org
 * row is created earlier and the status is briefly 'pending_verification' mid-
 * provision, so gating on those would invite sign-in before the account works
 * ("account inactive" + no number). `useSignupStatus` polls until active/failed.
 */
export default function SignupSuccessPage() {
  const params = useParams();
  const token = params.token as string;
  const { data: status } = useSignupStatus(token);

  // Backend order statuses: draft, numbers_selected, staged, checkout_pending,
  // paid, provisioning, pending_verification, active, failed, canceled, …
  const s = status?.status;
  const isFailed = s === 'failed' || s === 'canceled';
  // Ready ONLY at 'active': number purchased + org/owner activated. The org exists
  // and status is briefly 'pending_verification' earlier in provisioning — neither
  // means the user can sign in yet, so we don't gate on them.
  const isReady = s === 'active' && !isFailed;
  const isFinalizing = !isReady && !isFailed; // checkout_pending / paid / provisioning / pending_verification

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-md overflow-hidden rounded-3xl border border-[var(--border)]/60 bg-[var(--card)] shadow-xl shadow-black/5"
      >
        <div className="p-8 text-center sm:p-10">
          {isReady ? (
            <>
              <motion.div
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.1, type: 'spring', stiffness: 240, damping: 18 }}
                className="mx-auto mb-6 grid h-16 w-16 place-items-center rounded-full bg-emerald-500 text-white shadow-lg shadow-emerald-500/30 ring-8 ring-emerald-500/10"
              >
                <FiCheck className="h-8 w-8" strokeWidth={3} />
              </motion.div>
              <h1 className="mb-3 text-2xl font-bold text-[var(--foreground)]">
                You&apos;re all set!
              </h1>
              <p className="mb-7 text-[var(--muted-foreground)]">
                Payment received and your account is ready. Sign in to start calling.
              </p>
            </>
          ) : isFailed ? (
            <>
              <div className="mx-auto mb-6 grid h-16 w-16 place-items-center rounded-full bg-[var(--danger)]/10 text-[var(--danger)] ring-8 ring-[var(--danger)]/5">
                <FiAlertCircle className="h-8 w-8" />
              </div>
              <h1 className="mb-3 text-2xl font-bold text-[var(--foreground)]">We hit a snag</h1>
              <p className="mb-7 text-[var(--muted-foreground)]">
                Your payment went through, but we couldn&apos;t finish setting up your account.
                Please contact support and we&apos;ll sort it out right away.
              </p>
            </>
          ) : (
            <>
              <div className="mx-auto mb-6 grid h-16 w-16 place-items-center rounded-full bg-[var(--coral)]/10 text-[var(--coral-700)] ring-8 ring-[var(--coral)]/5">
                <FiLoader className="h-8 w-8 animate-spin" />
              </div>
              <h1 className="mb-3 text-2xl font-bold text-[var(--foreground)]">
                Finalizing your account…
              </h1>
              <p className="mb-7 text-[var(--muted-foreground)]">
                Payment received. We&apos;re provisioning your number and setting up your account —
                this usually takes under a minute. This page updates automatically.
              </p>
            </>
          )}

          {/* Credentials hint — only when the account actually exists. */}
          {isReady && status?.contactEmail && (
            <div className="mb-7 rounded-2xl border border-[var(--border)] bg-[var(--muted)]/40 p-5 text-left">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
                When you sign in
              </p>
              <ul className="space-y-2.5 text-sm text-[var(--foreground)]">
                <li className="flex items-start gap-2.5">
                  <FiMail className="mt-0.5 h-4 w-4 shrink-0 text-[var(--coral-700)]" />
                  <span>
                    Use <span className="font-semibold break-all">{status.contactEmail}</span>
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <FiLock className="mt-0.5 h-4 w-4 shrink-0 text-[var(--coral-700)]" />
                  <span>
                    Enter the password you just created. Forgot it? Choose{' '}
                    <span className="font-semibold">Forgot password</span> on the login page.
                  </span>
                </li>
              </ul>
            </div>
          )}

          {isFailed ? (
            <a
              href="mailto:support@arixcall.com?subject=Signup%20setup%20issue"
              className="block"
            >
              <Button variant="coral" size="lg" className="w-full">
                Contact support
              </Button>
            </a>
          ) : (
            <Link href="/login" className="block">
              <Button variant="coral" size="lg" disabled={isFinalizing} className="group w-full">
                {isFinalizing ? 'Preparing your account…' : 'Go to Login'}
                {!isFinalizing && (
                  <FiArrowRight className="ml-1.5 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                )}
              </Button>
            </Link>
          )}
        </div>
      </motion.div>
    </div>
  );
}
