'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { FiMail, FiRefreshCw, FiCheck } from 'react-icons/fi';
import { Card, CardContent, Button } from '@/components/ui';
import { useResendVerification, useVerifyEmailCode } from '@/lib/hooks/useSignup';

interface Props {
  token: string;
  email: string;
}

/**
 * Email-verification gate, shown immediately after account creation and BEFORE
 * the rest of the wizard (numbers → SMS → payment). Moving verification to the
 * front means the customer is verified well before checkout — so payment never
 * bounces with a jarring "verify your email" error at the end.
 *
 * Verification is by 6-digit OTP code (sent in the signup email). On success the
 * order cache is invalidated, `order.emailVerified` flips true, and the wizard
 * advances automatically. (The email also contains a one-click link as a
 * fallback, handled by /signup/verify-email/[token].)
 */
export default function EmailVerifyGate({ token, email }: Props) {
  const resend = useResendVerification(token);
  const verify = useVerifyEmailCode(token);
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState('');

  const handleCodeChange = (raw: string) => {
    // Numbers only, max 6 (also handles paste of a full code).
    setCode(raw.replace(/\D/g, '').slice(0, 6));
    if (verify.isError) verify.reset();
  };

  const handleVerify = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (code.length !== 6 || verify.isPending) return;
    try {
      await verify.mutateAsync(code);
      // Success → order query invalidated → gate unmounts as the wizard advances.
    } catch {
      /* surfaced via verify.isError below */
    }
  };

  const handleResend = async () => {
    setSent(false);
    setCode('');
    verify.reset();
    try {
      await resend.mutateAsync();
      setSent(true);
    } catch {
      /* surfaced via resend.isError below */
    }
  };

  return (
    <div className="max-w-lg mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      >
        <Card>
          <CardContent className="p-8 text-center">
            <div className="mx-auto mb-6 grid h-16 w-16 place-items-center rounded-2xl bg-[var(--coral)]/10 text-[var(--coral-700)]">
              <FiMail className="h-8 w-8" />
            </div>
            <h2 className="text-2xl font-bold text-[var(--foreground)] mb-2">Verify your email</h2>
            <p className="text-sm text-[var(--muted-foreground)] mb-1">
              Enter the 6-digit code we sent to
            </p>
            <p className="text-sm font-semibold text-[var(--foreground)] mb-6 break-all">{email}</p>

            <form onSubmit={handleVerify}>
              <input
                inputMode="numeric"
                autoComplete="one-time-code"
                aria-label="6-digit verification code"
                value={code}
                onChange={(e) => handleCodeChange(e.target.value)}
                placeholder="000000"
                autoFocus
                className="w-full max-w-[280px] mx-auto block rounded-xl border border-[var(--border)] bg-[var(--input)] px-4 py-3 text-center text-2xl font-bold tracking-[0.5em] text-[var(--foreground)] placeholder:text-[var(--muted-foreground)]/40 focus:outline-none focus:ring-2 focus:ring-[var(--coral)] focus:border-transparent"
              />

              {verify.isError && (
                <p className="mt-3 text-sm text-[var(--danger)]" role="alert">
                  {verify.error instanceof Error && verify.error.message
                    ? verify.error.message
                    : 'That code is incorrect or has expired. Check the code, or resend a new one.'}
                </p>
              )}

              <Button
                type="submit"
                variant="coral"
                size="lg"
                className="mt-6 w-full"
                loading={verify.isPending}
                disabled={code.length !== 6 || verify.isPending}
              >
                {verify.isPending ? 'Verifying…' : 'Verify email'}
              </Button>
            </form>

            {sent && !resend.isError && (
              <div className="mt-4 flex items-center justify-center gap-2 rounded-lg border border-green-500/30 bg-green-500/10 p-3 text-sm text-green-600 dark:text-green-400">
                <FiCheck className="h-4 w-4 shrink-0" />A fresh code is on its way.
              </div>
            )}
            {resend.isError && (
              <div className="mt-4 rounded-lg border border-[var(--danger)]/30 bg-[var(--danger)]/10 p-3 text-sm text-[var(--danger)]">
                Couldn&apos;t resend right now. Please wait a moment and try again.
              </div>
            )}

            <div className="mt-6 flex items-center justify-center gap-1.5 text-sm text-[var(--muted-foreground)]">
              <span>Didn&apos;t get a code?</span>
              <button
                type="button"
                onClick={handleResend}
                disabled={resend.isPending}
                className="inline-flex items-center gap-1 font-semibold text-[var(--coral-700)] hover:underline disabled:opacity-60"
              >
                {resend.isPending ? (
                  <FiRefreshCw className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <FiRefreshCw className="h-3.5 w-3.5" />
                )}
                Resend code
              </button>
            </div>

            <p className="mt-4 text-xs text-[var(--muted-foreground)]">
              The code expires in 24 hours. Check your spam folder if it doesn&apos;t arrive.
            </p>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
