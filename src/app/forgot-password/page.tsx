'use client';

import { useState } from 'react';
import Link from 'next/link';
import { FiMail, FiArrowLeft, FiCheck } from 'react-icons/fi';
import { Button, Input, Card, CardContent, ErrorAlert } from '@/components/ui';
import { authApiService } from '@/lib/api/services/auth.service';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      await authApiService.forgotPassword(email);
      setIsSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send reset email');
    } finally {
      setIsLoading(false);
    }
  };

  // Success state
  if (isSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[var(--primary-900)] via-[var(--primary-800)] to-[var(--primary-700)] p-4">
        {/* Background Pattern */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-[var(--primary-500)] rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse" />
          <div
            className="absolute -bottom-40 -left-40 w-80 h-80 bg-[var(--accent)] rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse"
            style={{ animationDelay: '1s' }}
          />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-[var(--primary-600)] rounded-full mix-blend-multiply filter blur-3xl opacity-10" />
        </div>

        <Card className="w-full max-w-md relative z-10 bg-white/95 dark:bg-[var(--card)]/95 backdrop-blur-xl shadow-2xl border-0">
          <CardContent className="p-8">
            {/* Success Icon & Header */}
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-green-500 to-green-700 rounded-2xl mb-4 shadow-lg">
                <FiCheck className="w-8 h-8 text-white" />
              </div>
              <h1 className="text-2xl font-bold text-[var(--foreground)]">Check Your Email</h1>
              <p className="text-[var(--muted-foreground)] mt-2">
                If an account exists for{' '}
                <span className="font-medium text-[var(--foreground)]">{email}</span>, you will
                receive a password reset link shortly.
              </p>
            </div>

            {/* Instructions */}
            <div className="mb-6 p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
              <p className="text-sm text-blue-700 dark:text-blue-400">
                The link will expire in 30 minutes. If you don&apos;t see the email, check your spam
                folder.
              </p>
            </div>

            {/* Back to Login */}
            <Link href="/login">
              <Button variant="outline" className="w-full h-12 text-base font-semibold">
                <FiArrowLeft className="w-4 h-4 mr-2" />
                Back to Sign In
              </Button>
            </Link>

            {/* Footer */}
            <div className="mt-8 pt-6 border-t border-[var(--border)] text-center">
              <p className="text-sm text-[var(--muted-foreground)]">
                Next-Generation Cloud Communication
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Request form
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[var(--primary-900)] via-[var(--primary-800)] to-[var(--primary-700)] p-4">
      {/* Background Pattern */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-[var(--primary-500)] rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse" />
        <div
          className="absolute -bottom-40 -left-40 w-80 h-80 bg-[var(--accent)] rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse"
          style={{ animationDelay: '1s' }}
        />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-[var(--primary-600)] rounded-full mix-blend-multiply filter blur-3xl opacity-10" />
      </div>

      <Card className="w-full max-w-md relative z-10 bg-white/95 dark:bg-[var(--card)]/95 backdrop-blur-xl shadow-2xl border-0">
        <CardContent className="p-8">
          {/* Logo & Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-[var(--primary-500)] to-[var(--primary-700)] rounded-2xl mb-4 shadow-lg">
              <FiMail className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-[var(--foreground)]">Forgot Password?</h1>
            <p className="text-[var(--muted-foreground)] mt-1">
              Enter your email and we&apos;ll send you a reset link
            </p>
          </div>

          {/* Error Message */}
          {error && <ErrorAlert message={error} className="mb-6" />}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <Input
              label="Email Address"
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              leftIcon={<FiMail className="w-4 h-4" />}
              required
              autoComplete="email"
              autoFocus
            />

            <Button
              type="submit"
              className="w-full h-12 text-base font-semibold"
              loading={isLoading}
              disabled={!email}
            >
              {isLoading ? 'Sending...' : 'Send Reset Link'}
            </Button>
          </form>

          {/* Back to Login */}
          <div className="mt-6 text-center">
            <Link
              href="/login"
              className="inline-flex items-center gap-2 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
            >
              <FiArrowLeft className="w-4 h-4" />
              Back to Sign In
            </Link>
          </div>

          {/* Footer */}
          <div className="mt-8 pt-6 border-t border-[var(--border)] text-center">
            <p className="text-sm text-[var(--muted-foreground)]">
              Next-Generation Cloud Communication
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
