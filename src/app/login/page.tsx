
'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { GoogleLogin, type CredentialResponse } from '@react-oauth/google';
import { FaWhatsapp } from 'react-icons/fa';
import {
  FiArrowLeft,
  FiArrowRight,
  FiEye,
  FiEyeOff,
  FiHome,
  FiLock,
  FiMail,
  FiMessageSquare,
  FiMic,
  FiPhoneCall,
  FiShield,
  FiUser,
} from 'react-icons/fi';
import { HiSparkles } from 'react-icons/hi2';
import { Button, ErrorAlert, ArixMark } from '@/components/ui';
import { useAuthStore } from '@/lib/stores';
import { apiClient } from '@/lib/api/client';
import { postLoginHref, landingHomeHref } from '@/lib/utils/routing';

const channelChips = [
  {
    Icon: FiPhoneCall,
    label: 'SIP',
    cls: 'text-[#ff7838] border-[#ff6a00]/40 bg-[#ff6a00]/5',
  },
  {
    Icon: FaWhatsapp,
    label: 'WhatsApp',
    cls: 'text-[#25D366] border-[#25D366]/40 bg-[#25D366]/5',
  },
  {
    Icon: HiSparkles,
    label: 'AI Dialer',
    cls: 'text-[#ff7838] border-[#ff4d00]/40 bg-[#ff4d00]/5',
  },
  {
    Icon: FiMessageSquare,
    label: 'SMS',
    cls: 'text-[#ff9a66] border-[#ff7a00]/40 bg-[#ff7a00]/5',
  },
  {
    Icon: FiMic,
    label: 'Recording',
    cls: 'text-[#ff7838] border-[#e81e2b]/40 bg-[#e81e2b]/5',
  },
];

function MeshBackground() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-[#101011]"
    >
      <motion.div
        className="absolute -left-40 -top-40 h-[42rem] w-[42rem] rounded-full bg-[radial-gradient(circle,_rgba(255,101,0,0.20),_rgba(255,101,0,0)_70%)] blur-3xl"
        animate={{
          x: [0, 80, -40, 0],
          y: [0, -60, 40, 0],
          scale: [1, 1.1, 0.95, 1],
        }}
        transition={{ duration: 26, repeat: Infinity, ease: 'easeInOut' }}
      />

      <motion.div
        className="absolute -right-40 top-1/3 h-[36rem] w-[36rem] rounded-full bg-[radial-gradient(circle,_rgba(232,30,43,0.16),_rgba(232,30,43,0)_70%)] blur-3xl"
        animate={{
          x: [0, -100, 50, 0],
          y: [0, 80, -50, 0],
          scale: [1, 1.15, 0.92, 1],
        }}
        transition={{ duration: 30, repeat: Infinity, ease: 'easeInOut' }}
      />

      <motion.div
        className="absolute -bottom-40 left-1/4 h-[40rem] w-[40rem] rounded-full bg-[radial-gradient(circle,_rgba(255,77,0,0.12),_rgba(255,77,0,0)_70%)] blur-3xl"
        animate={{
          x: [0, 60, -80, 0],
          y: [0, -40, 60, 0],
          scale: [1, 1.08, 1.05, 1],
        }}
        transition={{ duration: 34, repeat: Infinity, ease: 'easeInOut' }}
      />
    </div>
  );
}

export default function LoginPage() {
  const router = useRouter();

  const {
    login,
    loginWithGoogle,
    isAuthenticated,
    isLoading,
    error,
    user,
    clearError,
    checkAuth,
    _hasHydrated,
    otpStep,
    otpEmail,
    otpCooldown,
    otpMessage,
    otpRemainingAttempts,
    checkOtpRequired,
    sendOtp,
    verifyOtp,
    resetOtpState,
  } = useAuthStore();

  const isGoogleSsoEnabled = !!process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [otp, setOtp] = useState('');
  const [googleNonce, setGoogleNonce] = useState<string | null>(null);
  const [homeHref, setHomeHref] = useState('/');

  useEffect(() => {
    setHomeHref(landingHomeHref());
  }, []);

  const [logoutNotice, setLogoutNotice] = useState<string | null>(null);

  useEffect(() => {
    try {
      const r = sessionStorage.getItem('arix:logout_reason');

      if (r) {
        sessionStorage.removeItem('arix:logout_reason');

        setLogoutNotice(
          r === 'device_limit'
            ? 'You were signed out because your account was signed in on another device. Only a limited number of devices can be active at once.'
            : 'You were signed out. Please sign in again to continue.'
        );
      }
    } catch {
      // Session storage unavailable.
    }
  }, []);

  const loginSubtitle = 'Sign in to your account.';

  const [bootValidated, setBootValidated] = useState(false);

  useEffect(() => {
    if (!_hasHydrated) return;

    const { token, isAuthenticated: authed } = useAuthStore.getState();

    if (token || authed) {
      void checkAuth({ silent: true }).finally(() => setBootValidated(true));
    } else {
      setBootValidated(true);
    }
  }, [_hasHydrated, checkAuth]);

  useEffect(() => {
    if (!_hasHydrated || !bootValidated) return;

    if (isAuthenticated && user) {
      const href = postLoginHref(user.role);

      if (href.startsWith('http')) window.location.replace(href);
      else router.replace(href);
    }
  }, [_hasHydrated, bootValidated, isAuthenticated, user, router]);

  useEffect(() => {
    return () => resetOtpState();
  }, [resetOtpState]);

  useEffect(() => {
    if (isGoogleSsoEnabled) {
      const fetchNonce = async () => {
        try {
          const response = await apiClient.get<{
            success: boolean;
            data: { nonce: string };
          }>('/auth/google/nonce');

          if (response.success) setGoogleNonce(response.data.nonce);
        } catch {
          console.warn('Failed to fetch Google nonce');
        }
      };

      fetchNonce();
    }
  }, [isGoogleSsoEnabled]);

  const handleCredentialsSubmit = async (e: FormEvent) => {
    e.preventDefault();
    clearError();

    try {
      const requiresOtp = await checkOtpRequired(username, password);

      if (requiresOtp) {
        await sendOtp();
      } else {
        await login({ username, password });
      }
    } catch {
      // Error handled in store.
    }
  };

  const handleOtpSubmit = async (e: FormEvent) => {
    e.preventDefault();
    clearError();

    try {
      await verifyOtp(otp);
    } catch {
      // Error handled in store.
    }
  };

  const handleResendOtp = async () => {
    clearError();
    await sendOtp();
  };

  const handleBackToCredentials = () => {
    resetOtpState();
    setOtp('');
  };

  const handleGoogleSuccess = async (
    credentialResponse: CredentialResponse
  ) => {
    clearError();

    if (credentialResponse.credential) {
      try {
        await loginWithGoogle(
          credentialResponse.credential,
          googleNonce || undefined
        );
      } catch {
        if (isGoogleSsoEnabled) {
          try {
            const response = await apiClient.get<{
              success: boolean;
              data: { nonce: string };
            }>('/auth/google/nonce');

            if (response.success) setGoogleNonce(response.data.nonce);
          } catch {
            // Ignore.
          }
        }
      }
    }
  };

  const handleGoogleError = () => {};

  if (!_hasHydrated || !bootValidated || (isAuthenticated && user)) {
    return (
      <main className="relative min-h-screen bg-[#101011]">
        <MeshBackground />

        <div className="flex min-h-screen items-center justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-[#343438] border-t-[#ff6a00]" />
        </div>
      </main>
    );
  }

  if (otpStep === 'otp') {
    return (
      <main className="relative min-h-screen bg-[#101011] text-white">
        <MeshBackground />

        <div className="fixed left-4 top-4 z-10 sm:left-6 sm:top-6">
          <Link
            href={homeHref}
            className="inline-flex items-center gap-1.5 rounded-full border border-[#343438] bg-[#171719]/90 px-3 py-1.5 text-xs font-semibold text-[#d4d4d8] shadow-sm backdrop-blur transition hover:border-[#ff6a00] hover:text-[#ff7838]"
          >
            <FiHome size={12} />
            Home
          </Link>
        </div>

        <div className="flex min-h-screen items-center justify-center px-4 py-16 sm:px-6">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className="w-full max-w-md"
          >
            <div className="relative overflow-hidden rounded-3xl border border-[#2d2d31] bg-[#171719]/95 p-8 shadow-2xl shadow-black/30 backdrop-blur-xl sm:p-10">
              <div className="mb-7 text-center">
                <div className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#ff7a00] to-[#e81e2b] text-white shadow-lg shadow-orange-950/30">
                  <FiShield size={22} />
                </div>

                <h1 className="mt-5 text-2xl font-bold text-white sm:text-3xl">
                  Verify it&rsquo;s you
                </h1>

                <p className="mt-2 text-sm text-[#a1a1aa]">
                  We sent a 6-digit code to{' '}
                  <span className="font-semibold text-white">{otpEmail}</span>
                </p>
              </div>

              {otpMessage && !error && (
                <div className="mb-5 flex items-start gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3">
                  <FiMail className="mt-0.5 h-5 w-5 flex-shrink-0 text-emerald-400" />
                  <p className="text-sm text-emerald-300">{otpMessage}</p>
                </div>
              )}

              {error && <ErrorAlert message={error} className="mb-5" />}

              <form onSubmit={handleOtpSubmit} className="space-y-5">
                <div>
                  <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-[#c4c4ca]">
                    Verification code
                  </label>

                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="000000"
                    value={otp}
                    onChange={(e) =>
                      setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))
                    }
                    required
                    autoFocus
                    maxLength={6}
                    className="w-full rounded-xl border border-[#343438] bg-[#101011] px-4 py-3 text-center font-mono text-2xl tracking-[0.5em] text-white outline-none transition placeholder:text-[#55555c] placeholder:tracking-normal placeholder:text-base focus:border-[#ff6a00] focus:ring-2 focus:ring-[#ff6a00]/20"
                  />
                </div>

                {otpRemainingAttempts !== null && (
                  <p className="text-center text-xs text-[#888890]">
                    {otpRemainingAttempts} attempts remaining
                  </p>
                )}

                <Button
                  type="submit"
                  className="h-12 w-full rounded-full bg-gradient-to-r from-[#ff7a00] via-[#ff4d00] to-[#e81e2b] text-sm font-bold text-white shadow-lg shadow-orange-950/30 transition hover:scale-[1.02]"
                  loading={isLoading}
                  disabled={otp.length !== 6}
                >
                  <span className="flex items-center justify-center gap-2">
                    Verify
                    <FiArrowRight size={14} />
                  </span>
                </Button>

                <div className="text-center text-sm">
                  {otpCooldown > 0 ? (
                    <span className="text-[#888890]">
                      Resend in{' '}
                      <span className="font-mono font-semibold text-white">
                        {otpCooldown}s
                      </span>
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={handleResendOtp}
                      disabled={isLoading}
                      className="font-semibold text-[#ff7838] transition hover:text-[#ff9b65] hover:underline disabled:opacity-50"
                    >
                      Resend code
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleBackToCredentials}
                  className="flex w-full items-center justify-center gap-1.5 py-2 text-sm font-medium text-[#888890] transition hover:text-white"
                >
                  <FiArrowLeft size={14} />
                  Back to sign in
                </button>
              </form>
            </div>
          </motion.div>
        </div>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen bg-[#101011] text-white">
      <MeshBackground />

      <div className="fixed left-4 top-4 z-10 sm:left-6 sm:top-6">
        <Link
          href={homeHref}
          className="inline-flex items-center gap-1.5 rounded-full border border-[#343438] bg-[#171719]/90 px-3 py-1.5 text-xs font-semibold text-[#d4d4d8] shadow-sm backdrop-blur transition hover:border-[#ff6a00] hover:text-[#ff7838]"
        >
          <FiHome size={12} />
          Home
        </Link>
      </div>

      <div className="flex min-h-screen items-center justify-center px-4 py-16 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: 'easeOut' }}
          className="w-full max-w-md"
        >
          <div className="mb-6 flex flex-col items-center gap-2">
            <ArixMark size={56} />

            <div className="font-display text-2xl font-black tracking-tight">
              <span className="text-[#ff6a00]">Arix</span>
              <span className="text-white">Call</span>
            </div>
          </div>

          <div className="relative overflow-hidden rounded-3xl border border-[#2d2d31] bg-[#171719]/95 p-7 shadow-2xl shadow-black/30 backdrop-blur-xl sm:p-9">
            <div className="mb-7 text-center">
              <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
                Welcome{' '}
                <span className="bg-gradient-to-r from-[#ff7a00] via-[#ff4d00] to-[#e81e2b] bg-clip-text text-transparent">
                  back
                </span>
              </h1>

              <p className="mt-2 text-sm text-[#a1a1aa]">
                {loginSubtitle}
              </p>
            </div>

            {logoutNotice && !error && (
              <div
                role="status"
                className="mb-5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-300"
              >
                {logoutNotice}
              </div>
            )}

            {error && <ErrorAlert message={error} className="mb-5" />}

            <form onSubmit={handleCredentialsSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="email"
                  className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-[#c4c4ca]"
                >
                  Email
                </label>

                <div className="relative">
                  <FiUser
                    className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#77777f]"
                    size={16}
                  />

                  <input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    autoComplete="email"
                    autoFocus
                    className="w-full rounded-xl border border-[#343438] bg-[#101011] py-2.5 pl-10 pr-3.5 text-sm text-white outline-none transition placeholder:text-[#626269] focus:border-[#ff6a00] focus:ring-2 focus:ring-[#ff6a00]/20"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="password"
                  className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-[#c4c4ca]"
                >
                  Password
                </label>

                <div className="relative">
                  <FiLock
                    className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#77777f]"
                    size={16}
                  />

                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    className="w-full rounded-xl border border-[#343438] bg-[#101011] py-2.5 pl-10 pr-10 text-sm text-white outline-none transition placeholder:text-[#626269] focus:border-[#ff6a00] focus:ring-2 focus:ring-[#ff6a00]/20"
                  />

                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    tabIndex={-1}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#77777f] transition hover:text-white"
                  >
                    {showPassword ? <FiEyeOff size={16} /> : <FiEye size={16} />}
                  </button>
                </div>
              </div>

              <div className="flex justify-end">
                <Link
                  href="/forgot-password"
                  className="text-xs font-semibold text-[#ff7838] transition hover:text-[#ff9b65] hover:underline"
                >
                  Forgot password?
                </Link>
              </div>

              <Button
                type="submit"
                className="group h-12 w-full rounded-full bg-gradient-to-r from-[#ff7a00] via-[#ff4d00] to-[#e81e2b] text-sm font-bold text-white shadow-lg shadow-orange-950/30 transition hover:scale-[1.02]"
                loading={isLoading}
                disabled={!username || !password}
              >
                <span className="flex items-center justify-center gap-2">
                  {isLoading ? 'Signing in…' : 'Sign in'}

                  {!isLoading && (
                    <FiArrowRight
                      size={14}
                      className="transition-transform group-hover:translate-x-0.5"
                    />
                  )}
                </span>
              </Button>
            </form>

            {isGoogleSsoEnabled && (
              <>
                <div className="my-6 flex items-center gap-4">
                  <div className="h-px flex-1 bg-[#343438]" />

                  <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#77777f]">
                    or continue with
                  </span>

                  <div className="h-px flex-1 bg-[#343438]" />
                </div>

                <div className="flex justify-center">
                  <GoogleLogin
                    onSuccess={handleGoogleSuccess}
                    onError={handleGoogleError}
                    theme="outline"
                    size="large"
                    width="100%"
                    text="continue_with"
                    shape="rectangular"
                  />
                </div>
              </>
            )}

            <p className="mt-7 text-center text-sm text-[#a1a1aa]">
              Don&rsquo;t have an account?{' '}
              <Link
                href="/signup"
                className="font-semibold text-[#ff7838] transition hover:text-[#ff9b65] hover:underline"
              >
                Sign up
              </Link>
            </p>
          </div>

          <div className="mt-7 flex flex-wrap items-center justify-center gap-1.5">
            {channelChips.map(({ Icon, label, cls }) => (
              <span
                key={label}
                className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold ${cls}`}
              >
                <Icon size={10} />
                {label}
              </span>
            ))}
          </div>

          <p className="mt-5 text-center text-[11px] text-[#85858d]">
            By signing in, you agree to our{' '}
            <Link
              href="/terms"
              className="font-semibold text-[#ff7838] hover:text-[#ff9b65] hover:underline"
            >
              Terms
            </Link>{' '}
            &amp;{' '}
            <Link
              href="/privacy"
              className="font-semibold text-[#ff7838] hover:text-[#ff9b65] hover:underline"
            >
              Privacy
            </Link>
            .
          </p>
        </motion.div>
      </div>
    </main>
  );
}
