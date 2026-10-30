'use client';

/**
 * Email verification landing page.
 *
 * URL: `/signup/verify-email/{verifyToken}?next={signupToken}`
 *
 * The verify email sends the user here. We POST the token to the
 * onboarding API exactly once on mount (single-use token; React strict
 * mode would normally fire twice in dev — guarded by a ref). On success
 * we redirect into the wizard at `/signup/{signupToken}` so the user
 * continues where they left off. On failure (expired / consumed link)
 * we render an error with the wizard URL as a fallback "go back" so the
 * user can hit "Resend verification email" from there.
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

  // Fallback truth source. Single-use verify tokens get consumed the moment
  // they're first hit — and Gmail / email-security scanners routinely pre-open
  // links, so the user's REAL click can arrive after the token is already spent
  // and returns "invalid or expired" even though the email IS verified. We read
  // the order (via the `next=` signup token) to know the real state: if it's
  // already verified, we treat this as success regardless of the POST result.
  const { data: order } = useSignupOrder(nextSignupToken);
  const alreadyVerifiedOnServer = !!order?.emailVerified;
  // Strict-mode + dev double-render guard. The verify token is single-use;
  // firing twice in dev would surface as a confusing "already verified"
  // even on the first legitimate click.
  const firedRef = useRef(false);

  useEffect(() => {
    if (firedRef.current) return;
    if (!params?.verifyToken) return;
    firedRef.current = true;
    verify.mutate(params.verifyToken);
    // verify.mutate intentionally excluded from deps — calling mutate is
    // imperative and we explicitly want this to fire exactly once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params?.verifyToken]);

  // Success = the POST succeeded, OR the order already shows verified (token was
  // spent by a scanner / earlier hit but the email really is verified).
  const isVerified = verify.isSuccess || alreadyVerifiedOnServer;

  // Auto-bounce back into the wizard once we've confirmed the email.
  // Small delay so the user sees the "verified" confirmation rather than
  // a flicker; nextSignupToken comes from the email link.
  useEffect(() => {
    if (!isVerified) return;
    if (!nextSignupToken) return;
    const t = window.setTimeout(() => {
      router.push(`/signup/${nextSignupToken}`);
    }, 1200);
    return () => window.clearTimeout(t);
  }, [isVerified, nextSignupToken, router]);

  // Safety net: if the mutation gets stuck (HMR race, React Query
  // re-mount oddity, slow network), surface a manual "Continue" link
  // after 4s so the user is never trapped on a spinning page. The
  // backend has either already verified (success state we just missed)
  // or is unreachable (in which case manual continue still works because
  // the API gate happens on the next request).
  const [showFallback, setShowFallback] = React.useState(false);
  useEffect(() => {
    if (!verify.isPending) {
      setShowFallback(false);
      return;
    }
    const t = window.setTimeout(() => setShowFallback(true), 4000);
    return () => window.clearTimeout(t);
  }, [verify.isPending]);

  // Only a genuinely-bad link: the POST failed AND either there's no signup
  // token to cross-check, or the order (loaded) confirms the email is NOT
  // verified. While the order is still loading after an error, we keep showing
  // the spinner rather than flashing "expired".
  const isDefinitelyExpired =
    verify.isError &&
    (!nextSignupToken || (order !== undefined && !order.emailVerified));
  const isChecking = !isVerified && !isDefinitelyExpired;

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--background)] px-4">
      <div className="max-w-md w-full bg-[var(--card)] border border-[var(--border)] rounded-2xl p-8 text-center shadow-sm">
        {isChecking && (
          <>
            <FiLoader className="w-12 h-12 mx-auto mb-4 text-[var(--foreground)] animate-spin" />
            <h1 className="text-xl font-semibold text-[var(--foreground)] mb-2">
              Verifying your email…
            </h1>
            <p className="text-sm text-[var(--muted-foreground)]">This will only take a second.</p>
            {showFallback && nextSignupToken && (
              <div className="mt-6 pt-6 border-t border-[var(--border)]">
                <p className="text-xs text-[var(--muted-foreground)] mb-3">
                  Taking longer than expected? Your verification likely succeeded — you can continue
                  to your signup.
                </p>
                <Link
                  href={`/signup/${nextSignupToken}`}
                  className="inline-block text-sm font-medium text-[var(--foreground)] hover:underline"
                >
                  Continue to signup →
                </Link>
              </div>
            )}
          </>
        )}

        {isVerified && (
          <>
            <FiCheckCircle className="w-12 h-12 mx-auto mb-4 text-green-500" />
            <h1 className="text-xl font-semibold text-[var(--foreground)] mb-2">
              {verify.data?.data.alreadyVerified || (alreadyVerifiedOnServer && !verify.isSuccess)
                ? 'Already verified'
                : 'Email verified'}
            </h1>
            <p className="text-sm text-[var(--muted-foreground)] mb-6">
              {nextSignupToken
                ? 'Taking you back to your signup…'
                : 'You can now continue your signup from the original tab.'}
            </p>
            {nextSignupToken && (
              <Link
                href={`/signup/${nextSignupToken}`}
                className="inline-block text-sm font-medium text-[var(--foreground)] hover:underline"
              >
                Continue now →
              </Link>
            )}
          </>
        )}

        {isDefinitelyExpired && (
          <>
            <FiAlertTriangle className="w-12 h-12 mx-auto mb-4 text-amber-500" />
            <h1 className="text-xl font-semibold text-[var(--foreground)] mb-2">
              Verification link expired
            </h1>
            <p className="text-sm text-[var(--muted-foreground)] mb-6">
              This link is no longer valid. Open your signup wizard and click{' '}
              <strong>Resend verification email</strong> to get a fresh link.
            </p>
            {nextSignupToken ? (
              <Link
                href={`/signup/${nextSignupToken}`}
                className="inline-block text-sm font-medium text-[var(--foreground)] hover:underline"
              >
                Back to signup →
              </Link>
            ) : (
              <Link
                href="/signup/start"
                className="inline-block text-sm font-medium text-[var(--foreground)] hover:underline"
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
