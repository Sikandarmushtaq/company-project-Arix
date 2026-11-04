
'use client';

/**
 * Email verification landing page.
 *
 * URL: `/signup/verify-email/{verifyToken}?next={signupToken}`
 */
import React, { useEffect, useRef } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { FiCheckCircle, FiAlertTriangle, FiLoader } from 'react-icons/fi';
import { useVerifyEmail, useSignupOrder } from '@/lib/hooks/useSignup';

export default function VerifyEmailPage() {
  const params = useParams<{ verifyToken: string }>();
  const search = useSearchParams();
  const router = useRouter();
  const nextSignupToken = search.get('next') || '';

  const verify = useVerifyEmail();

  const { data: order } = useSignupOrder(nextSignupToken);
  const alreadyVerifiedOnServer = !!order?.emailVerified;
  const firedRef = useRef(false);

  useEffect(() => {
    if (firedRef.current) return;
    if (!params?.verifyToken) return;
    firedRef.current = true;
    verify.mutate(params.verifyToken);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params?.verifyToken]);

  const isVerified = verify.isSuccess || alreadyVerifiedOnServer;

  useEffect(() => {
    if (!isVerified) return;
    if (!nextSignupToken) return;
    const t = window.setTimeout(() => {
      router.push(`/signup/${nextSignupToken}`);
    }, 1200);
    return () => window.clearTimeout(t);
  }, [isVerified, nextSignupToken, router]);

  const [showFallback, setShowFallback] = React.useState(false);

  useEffect(() => {
    if (!verify.isPending) {
      setShowFallback(false);
      return;
    }
    const t = window.setTimeout(() => setShowFallback(true), 4000);
    return () => window.clearTimeout(t);
  }, [verify.isPending]);

  const isDefinitelyExpired =
    verify.isError &&
    (!nextSignupToken || (order !== undefined && !order.emailVerified));

  const isChecking = !isVerified && !isDefinitelyExpired;

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#101011] px-4 py-10 text-white">
      <div className="w-full max-w-md rounded-2xl border border-[#2d2d31] bg-[#171719] p-8 text-center shadow-xl shadow-black/30">
        {isChecking && (
          <>
            <FiLoader className="mx-auto mb-4 h-12 w-12 animate-spin text-[#ff7838]" />

            <h1 className="mb-2 text-xl font-semibold text-white">
              Verifying your email…
            </h1>

            <p className="text-sm text-[#a1a1aa]">
              This will only take a second.
            </p>

            {showFallback && nextSignupToken && (
              <div className="mt-6 border-t border-[#2d2d31] pt-6">
                <p className="mb-3 text-xs text-[#a1a1aa]">
                  Taking longer than expected? Your verification likely succeeded — you can continue
                  to your signup.
                </p>

                <Link
                  href={`/signup/${nextSignupToken}`}
                  className="inline-block text-sm font-medium text-[#ff7838] transition-colors hover:text-[#ff9a66] hover:underline"
                >
                  Continue to signup →
                </Link>
              </div>
            )}
          </>
        )}

        {isVerified && (
          <>
            <FiCheckCircle className="mx-auto mb-4 h-12 w-12 text-emerald-400" />

            <h1 className="mb-2 text-xl font-semibold text-white">
              {verify.data?.data.alreadyVerified || (alreadyVerifiedOnServer && !verify.isSuccess)
                ? 'Already verified'
                : 'Email verified'}
            </h1>

            <p className="mb-6 text-sm text-[#a1a1aa]">
              {nextSignupToken
                ? 'Taking you back to your signup…'
                : 'You can now continue your signup from the original tab.'}
            </p>

            {nextSignupToken && (
              <Link
                href={`/signup/${nextSignupToken}`}
                className="inline-block text-sm font-medium text-[#ff7838] transition-colors hover:text-[#ff9a66] hover:underline"
              >
                Continue now →
              </Link>
            )}
          </>
        )}

        {isDefinitelyExpired && (
          <>
            <FiAlertTriangle className="mx-auto mb-4 h-12 w-12 text-amber-400" />

            <h1 className="mb-2 text-xl font-semibold text-white">
              Verification link expired
            </h1>

            <p className="mb-6 text-sm text-[#a1a1aa]">
              This link is no longer valid. Open your signup wizard and click{' '}
              <strong className="text-white">Resend verification email</strong> to get a fresh link.
            </p>

            {nextSignupToken ? (
              <Link
                href={`/signup/${nextSignupToken}`}
                className="inline-block text-sm font-medium text-[#ff7838] transition-colors hover:text-[#ff9a66] hover:underline"
              >
                Back to signup →
              </Link>
            ) : (
              <Link
                href="/signup/start"
                className="inline-block text-sm font-medium text-[#ff7838] transition-colors hover:text-[#ff9a66] hover:underline"
              >
                Start over →
              </Link>
            )}
          </>
        )}
      </div>
    </div>
  );
}
