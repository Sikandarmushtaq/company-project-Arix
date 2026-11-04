
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

export default function EmailVerifyGate({ token, email }: Props) {
  const resend = useResendVerification(token);
  const verify = useVerifyEmailCode(token);
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState('');

  const handleCodeChange = (raw: string) => {
    setCode(raw.replace(/\D/g, '').slice(0, 6));
    if (verify.isError) verify.reset();
  };

  const handleVerify = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (code.length !== 6 || verify.isPending) return;
    try {
      await verify.mutateAsync(code);
    } catch {
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
    }
  };

  return (
    <div className="mx-auto max-w-lg text-white">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      >
        <Card className="!border-[#2d2d31] !bg-[#171719] !text-white">
          <CardContent className="p-8 text-center">
            <div className="mx-auto mb-6 grid h-16 w-16 place-items-center rounded-2xl border border-[#ff7838]/20 bg-[#ff7838]/10 text-[#ff7838]">
              <FiMail className="h-8 w-8" />
            </div>

            <h2 className="mb-2 text-2xl font-bold text-white">
              Verify your email
            </h2>

            <p className="mb-1 text-sm text-[#a1a1aa]">
              Enter the 6-digit code we sent to
            </p>

            <p className="mb-6 break-all text-sm font-semibold text-white">
              {email}
            </p>

            <form onSubmit={handleVerify}>
              <input
                inputMode="numeric"
                autoComplete="one-time-code"
                aria-label="6-digit verification code"
                value={code}
                onChange={(e) => handleCodeChange(e.target.value)}
                placeholder="000000"
                autoFocus
                className="mx-auto block w-full max-w-[280px] rounded-xl border border-[#36363a] bg-[#202023] px-4 py-3 text-center text-2xl font-bold tracking-[0.5em] text-white placeholder:text-[#66666f] focus:border-[#ff7838] focus:outline-none focus:ring-2 focus:ring-[#ff7838]/30"
              />

              {verify.isError && (
                <p className="mt-3 text-sm text-red-400" role="alert">
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
              <div className="mt-4 flex items-center justify-center gap-2 rounded-lg border border-green-500/30 bg-green-500/10 p-3 text-sm text-green-400">
                <FiCheck className="h-4 w-4 shrink-0" />
                A fresh code is on its way.
              </div>
            )}

            {resend.isError && (
              <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
                Couldn&apos;t resend right now. Please wait a moment and try again.
              </div>
            )}

            <div className="mt-6 flex items-center justify-center gap-1.5 text-sm text-[#a1a1aa]">
              <span>Didn&apos;t get a code?</span>
              <button
                type="button"
                onClick={handleResend}
                disabled={resend.isPending}
                className="inline-flex items-center gap-1 font-semibold text-[#ff7838] transition-colors hover:text-[#ff9a66] hover:underline disabled:opacity-60"
              >
                <FiRefreshCw className={`h-3.5 w-3.5 ${resend.isPending ? 'animate-spin' : ''}`} />
                Resend code
              </button>
            </div>

            <p className="mt-4 text-xs text-[#85858e]">
              The code expires in 24 hours. Check your spam folder if it doesn&apos;t arrive.
            </p>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
