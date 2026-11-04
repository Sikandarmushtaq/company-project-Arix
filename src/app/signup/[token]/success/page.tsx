
'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { FiCheck, FiLoader, FiAlertCircle, FiArrowRight, FiMail, FiLock } from 'react-icons/fi';
import { useSignupStatus } from '@/lib/hooks/useSignup';
import { Button } from '@/components/ui';
import Link from 'next/link';

export default function SignupSuccessPage() {
  const params = useParams();
  const token = params.token as string;
  const { data: status } = useSignupStatus(token);

  const s = status?.status;
  const isFailed = s === 'failed' || s === 'canceled';
  const isReady = s === 'active' && !isFailed;
  const isFinalizing = !isReady && !isFailed;

  return (
    <div
      className="flex min-h-[60vh] flex-col items-center justify-center text-white"
      style={
        {
          '--foreground': '#ffffff',
          '--muted-foreground': '#a1a1aa',
          '--card': '#171719',
          '--border': '#2d2d31',
          '--muted': '#242427',
          '--coral': '#ff7838',
          '--coral-700': '#ff6a00',
          '--danger': '#f87171',
          colorScheme: 'dark',
        } as React.CSSProperties
      }
    >
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-md overflow-hidden rounded-3xl border border-[#2d2d31] bg-[#171719] shadow-xl shadow-black/30"
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

              <h1 className="mb-3 text-2xl font-bold text-white">
                You&apos;re all set!
              </h1>

              <p className="mb-7 text-[#a1a1aa]">
                Payment received and your account is ready. Sign in to start calling.
              </p>
            </>
          ) : isFailed ? (
            <>
              <div className="mx-auto mb-6 grid h-16 w-16 place-items-center rounded-full bg-red-500/10 text-red-400 ring-8 ring-red-500/5">
                <FiAlertCircle className="h-8 w-8" />
              </div>

              <h1 className="mb-3 text-2xl font-bold text-white">
                We hit a snag
              </h1>

              <p className="mb-7 text-[#a1a1aa]">
                Your payment went through, but we couldn&apos;t finish setting up your account.
                Please contact support and we&apos;ll sort it out right away.
              </p>
            </>
          ) : (
            <>
              <div className="mx-auto mb-6 grid h-16 w-16 place-items-center rounded-full bg-[#ff7838]/10 text-[#ff7838] ring-8 ring-[#ff7838]/5">
                <FiLoader className="h-8 w-8 animate-spin" />
              </div>

              <h1 className="mb-3 text-2xl font-bold text-white">
                Finalizing your account…
              </h1>

              <p className="mb-7 text-[#a1a1aa]">
                Payment received. We&apos;re provisioning your number and setting up your account —
                this usually takes under a minute. This page updates automatically.
              </p>
            </>
          )}

          {isReady && status?.contactEmail && (
            <div className="mb-7 rounded-2xl border border-[#2d2d31] bg-[#242427]/60 p-5 text-left">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[#a1a1aa]">
                When you sign in
              </p>

              <ul className="space-y-2.5 text-sm text-white">
                <li className="flex items-start gap-2.5">
                  <FiMail className="mt-0.5 h-4 w-4 shrink-0 text-[#ff7838]" />
                  <span>
                    Use <span className="break-all font-semibold">{status.contactEmail}</span>
                  </span>
                </li>

                <li className="flex items-start gap-2.5">
                  <FiLock className="mt-0.5 h-4 w-4 shrink-0 text-[#ff7838]" />
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
