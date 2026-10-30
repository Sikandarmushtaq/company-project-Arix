'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { FiLock, FiEye, FiEyeOff, FiCheck, FiAlertCircle, FiArrowLeft } from 'react-icons/fi';
import { Button, Input, Card, CardContent, ErrorAlert } from '@/components/ui';
import { authApiService } from '@/lib/api/services/auth.service';

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isValidating, setIsValidating] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tokenValid, setTokenValid] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  // Password validation
  const passwordRequirements = [
    { label: 'At least 8 characters', met: newPassword.length >= 8 },
    { label: 'Contains uppercase letter', met: /[A-Z]/.test(newPassword) },
    { label: 'Contains lowercase letter', met: /[a-z]/.test(newPassword) },
    { label: 'Contains number', met: /\d/.test(newPassword) },
    { label: 'Contains special character', met: /[!@#$%^&*(),.?":{}|<>]/.test(newPassword) },
  ];

  const allRequirementsMet = passwordRequirements.every((req) => req.met);
  const passwordsMatch = newPassword === confirmPassword && confirmPassword.length > 0;

  // Validate token on mount
  useEffect(() => {
    const validateToken = async () => {
      if (!token) {
        setError('Invalid or missing reset token');
        setIsValidating(false);
        return;
      }

      try {
        const result = await authApiService.validateResetToken(token);
        if (result.valid) {
          setTokenValid(true);
          setUserEmail(result.email || null);
        } else {
          setError('This reset link has expired or is invalid');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to validate reset token');
      } finally {
        setIsValidating(false);
      }
    };

    validateToken();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!allRequirementsMet) {
      setError('Password does not meet all requirements');
      return;
    }

    if (!passwordsMatch) {
      setError('Passwords do not match');
      return;
    }

    if (!token) {
      setError('Invalid reset token');
      return;
    }

    setIsLoading(true);

    try {
      await authApiService.resetPassword(token, newPassword);
      setIsSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset password');
    } finally {
      setIsLoading(false);
    }
  };

  // Loading state
  if (isValidating) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[var(--primary-900)] via-[var(--primary-800)] to-[var(--primary-700)] p-4">
        <Card className="w-full max-w-md relative z-10 bg-white/95 dark:bg-[var(--card)]/95 backdrop-blur-xl shadow-2xl border-0">
          <CardContent className="p-8 text-center">
            <div className="animate-spin w-8 h-8 border-4 border-[var(--primary-500)] border-t-transparent rounded-full mx-auto mb-4" />
            <p className="text-[var(--muted-foreground)]">Validating reset link...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Invalid token state
  if (!tokenValid && !isSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[var(--primary-900)] via-[var(--primary-800)] to-[var(--primary-700)] p-4">
        {/* Background Pattern */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-[var(--primary-500)] rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse" />
          <div
            className="absolute -bottom-40 -left-40 w-80 h-80 bg-[var(--accent)] rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse"
            style={{ animationDelay: '1s' }}
          />
        </div>

        <Card className="w-full max-w-md relative z-10 bg-white/95 dark:bg-[var(--card)]/95 backdrop-blur-xl shadow-2xl border-0">
          <CardContent className="p-8">
            {/* Error Icon & Header */}
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-red-500 to-red-700 rounded-2xl mb-4 shadow-lg">
                <FiAlertCircle className="w-8 h-8 text-white" />
              </div>
              <h1 className="text-2xl font-bold text-[var(--foreground)]">Invalid Reset Link</h1>
              <p className="text-[var(--muted-foreground)] mt-2">
                {error || 'This password reset link is invalid or has expired.'}
              </p>
            </div>

            {/* Request New Link */}
            <Link href="/forgot-password">
              <Button className="w-full h-12 text-base font-semibold mb-4">
                Request New Reset Link
              </Button>
            </Link>

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
        </div>

        <Card className="w-full max-w-md relative z-10 bg-white/95 dark:bg-[var(--card)]/95 backdrop-blur-xl shadow-2xl border-0">
          <CardContent className="p-8">
            {/* Success Icon & Header */}
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-green-500 to-green-700 rounded-2xl mb-4 shadow-lg">
                <FiCheck className="w-8 h-8 text-white" />
              </div>
              <h1 className="text-2xl font-bold text-[var(--foreground)]">
                Password Reset Successful
              </h1>
              <p className="text-[var(--muted-foreground)] mt-2">
                Your password has been reset successfully. You can now sign in with your new
                password.
              </p>
            </div>

            {/* Sign In Button */}
            <Button
              onClick={() => router.push('/login')}
              className="w-full h-12 text-base font-semibold"
            >
              Sign In Now
            </Button>

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

  // Reset form
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
              <FiLock className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-[var(--foreground)]">Reset Your Password</h1>
            {userEmail && (
              <p className="text-[var(--muted-foreground)] mt-1">
                For <span className="font-medium text-[var(--foreground)]">{userEmail}</span>
              </p>
            )}
          </div>

          {/* Error Message */}
          {error && <ErrorAlert message={error} className="mb-6" />}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="relative">
              <Input
                label="New Password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter new password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                leftIcon={<FiLock className="w-4 h-4" />}
                rightIcon={
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="hover:text-[var(--foreground)] transition-colors"
                    tabIndex={-1}
                  >
                    {showPassword ? (
                      <FiEyeOff className="w-4 h-4" />
                    ) : (
                      <FiEye className="w-4 h-4" />
                    )}
                  </button>
                }
                required
                autoComplete="new-password"
                autoFocus
              />
            </div>

            {/* Password Requirements */}
            {newPassword.length > 0 && (
              <div className="space-y-2 p-3 rounded-lg bg-[var(--muted)]/50">
                <p className="text-xs font-medium text-[var(--muted-foreground)] mb-2">
                  Password Requirements:
                </p>
                {passwordRequirements.map((req) => (
                  <div key={req.label} className="flex items-center gap-2 text-xs">
                    {req.met ? (
                      <FiCheck className="w-3 h-3 text-green-600" />
                    ) : (
                      <div className="w-3 h-3 rounded-full border border-[var(--muted-foreground)]" />
                    )}
                    <span className={req.met ? 'text-green-600' : 'text-[var(--muted-foreground)]'}>
                      {req.label}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <div className="relative">
              <Input
                label="Confirm Password"
                type={showConfirmPassword ? 'text' : 'password'}
                placeholder="Confirm new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                leftIcon={<FiLock className="w-4 h-4" />}
                rightIcon={
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="hover:text-[var(--foreground)] transition-colors"
                    tabIndex={-1}
                  >
                    {showConfirmPassword ? (
                      <FiEyeOff className="w-4 h-4" />
                    ) : (
                      <FiEye className="w-4 h-4" />
                    )}
                  </button>
                }
                required
                autoComplete="new-password"
              />
              {confirmPassword.length > 0 && (
                <div className="mt-1 text-xs">
                  {passwordsMatch ? (
                    <span className="text-green-600 flex items-center gap-1">
                      <FiCheck className="w-3 h-3" /> Passwords match
                    </span>
                  ) : (
                    <span className="text-red-600">Passwords do not match</span>
                  )}
                </div>
              )}
            </div>

            <Button
              type="submit"
              className="w-full h-12 text-base font-semibold"
              loading={isLoading}
              disabled={!allRequirementsMet || !passwordsMatch}
            >
              {isLoading ? 'Resetting...' : 'Reset Password'}
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

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[var(--primary-900)] via-[var(--primary-800)] to-[var(--primary-700)] p-4">
          <Card className="w-full max-w-md relative z-10 bg-white/95 dark:bg-[var(--card)]/95 backdrop-blur-xl shadow-2xl border-0">
            <CardContent className="p-8 text-center">
              <div className="animate-spin w-8 h-8 border-4 border-[var(--primary-500)] border-t-transparent rounded-full mx-auto mb-4" />
              <p className="text-[var(--muted-foreground)]">Loading...</p>
            </CardContent>
          </Card>
        </div>
      }
    >
      <ResetPasswordContent />
    </Suspense>
  );
}
