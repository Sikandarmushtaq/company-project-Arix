'use client';

import { useEffect, useState } from 'react';
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
  FiMoon,
  FiPhoneCall,
  FiShield,
  FiSun,
  FiUser,
} from 'react-icons/fi';
import { HiSparkles } from 'react-icons/hi2';
import { Button, ErrorAlert, ArixMark, ArixWordmark } from '@/components/ui';
import { useAuthStore } from '@/lib/stores';
import { apiClient } from '@/lib/api/client';
import { postLoginHref, landingHomeHref } from '@/lib/utils/routing';

const STORAGE_KEY = 'nuxcall:theme';

const channelChips = [
  { Icon: FiPhoneCall,     label: 'SIP',       cls: 'text-[var(--foreground)] border-[var(--border)]/40 bg-[var(--primary-600)]/5' },
  { Icon: FaWhatsapp,      label: 'WhatsApp',  cls: 'text-[#128c7e] dark:text-[#25D366] border-[#25D366]/40 bg-[#25D366]/5' },
  { Icon: HiSparkles,      label: 'AI Dialer', cls: 'text-[#7c3aed] dark:text-[#a78bfa] border-[#8b5cf6]/40 bg-[#8b5cf6]/5' },
  { Icon: FiMessageSquare, label: 'SMS',       cls: 'text-amber-600 dark:text-amber-400 border-amber-500/40 bg-amber-500/5' },
  { Icon: FiMic,           label: 'Recording', cls: 'text-[var(--accent-600)] border-[var(--accent-500)]/40 bg-[var(--accent-500)]/5' },
];

// Ambient mesh background — three drifting colored blobs and a soft canvas
// gradient. Same visual language as the landing page's AnimatedMesh, scoped
// here so /login doesn't depend on the marketing layout's chrome.
function MeshBackground() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-gradient-to-br from-[#f6f4f2] via-[#fffdfc] to-[#f0ece8] dark:from-[#121212] dark:via-[#121212] dark:to-black"
    >
      <motion.div
        className="absolute -top-40 -left-40 h-[42rem] w-[42rem] rounded-full bg-[radial-gradient(circle,_rgba(255,101,66,0.32),_rgba(255,101,66,0)_70%)] blur-3xl"
        animate={{ x: [0, 80, -40, 0], y: [0, -60, 40, 0], scale: [1, 1.1, 0.95, 1] }}
        transition={{ duration: 26, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute top-1/3 -right-40 h-[36rem] w-[36rem] rounded-full bg-[radial-gradient(circle,_rgba(255,181,71,0.28),_rgba(255,181,71,0)_70%)] blur-3xl"
        animate={{ x: [0, -100, 50, 0], y: [0, 80, -50, 0], scale: [1, 1.15, 0.92, 1] }}
        transition={{ duration: 30, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute -bottom-40 left-1/4 h-[40rem] w-[40rem] rounded-full bg-[radial-gradient(circle,_rgba(229,72,31,0.24),_rgba(229,72,31,0)_70%)] blur-3xl"
        animate={{ x: [0, 60, -80, 0], y: [0, -40, 60, 0], scale: [1, 1.08, 1.05, 1] }}
        transition={{ duration: 34, repeat: Infinity, ease: 'easeInOut' }}
      />
    </div>
  );
}

// Inline theme toggle. Sets `.dark` on <html> and writes to localStorage so
// the choice persists into the rest of the app (the landing's ThemeProvider
// reads the same key).
function ThemeToggle() {
  const [isDark, setIsDark] = useState<boolean>(false);

  useEffect(() => {
    try {
      // Match the app-wide default: LIGHT unless explicitly 'dark', or 'system'
      // with an OS dark preference. (Was `stored !== 'light'` → followed the OS
      // for unset users, which loaded dark and overrode the light default.)
      const stored =
        window.localStorage.getItem('theme') || window.localStorage.getItem(STORAGE_KEY);
      const prefers =
        stored === 'dark' ||
        (stored === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
      setIsDark(prefers);
      document.documentElement.classList.toggle('dark', prefers);
    } catch {
      // ignore (sandbox / private mode)
    }
  }, []);

  const flip = () => {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle('dark', next);
    try {
      const val = next ? 'dark' : 'light';
      // Write BOTH keys (app 'theme' + marketing 'nuxcall:theme') like the SSOT,
      // so the choice carries into the dialer/admin without disagreeing.
      window.localStorage.setItem('theme', val);
      window.localStorage.setItem(STORAGE_KEY, val);
    } catch {
      // ignore
    }
  };

  return (
    <button
      type="button"
      onClick={flip}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--border)] bg-white/80 text-slate-700 shadow-sm backdrop-blur transition hover:border-transparent hover:bg-[var(--primary-600)]/10 hover:text-[var(--foreground)] dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10"
    >
      {isDark ? <FiSun size={16} /> : <FiMoon size={16} />}
    </button>
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
  // "Home" points to the public landing on the apex (arixcall.com). Resolved
  // client-side (needs the live hostname); starts as "/" so SSR/first paint
  // match, then upgrades to the absolute apex URL after mount.
  const [homeHref, setHomeHref] = useState('/');
  useEffect(() => {
    setHomeHref(landingHomeHref());
  }, []);

  // A forced sign-out (device limit / admin log-out) hard-redirects here and leaves
  // a one-shot reason in sessionStorage — surface it so the user knows WHY they
  // landed on login, then clear it so a later manual visit stays clean.
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
      /* sessionStorage unavailable — no banner */
    }
  }, []);
  const loginSubtitle = 'Sign in to your account.';

  // Validate a PERSISTED session against the backend before trusting it for the
  // post-login redirect. Otherwise a stale/rejected token (a migrated user, or a
  // pre-deploy token the API no longer accepts) is trusted straight from
  // localStorage and bounces the user by their stale role — the "login just
  // bounces around, must clear cache" bug. checkAuth() self-heals: valid → we
  // redirect below; invalid → purged → the login form shows. A fresh visitor
  // (no persisted session) validates instantly with no backend call.
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
      // One login for everyone → route by ROLE to the right app. On arixcall this
      // is an absolute URL on the role's subdomain (auth carries via the shared
      // .arixcall.com SSO cookie) → a hard hop; on a single host it's a relative
      // SPA nav.
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
          const response = await apiClient.get<{ success: boolean; data: { nonce: string } }>(
            '/auth/google/nonce'
          );
          if (response.success) setGoogleNonce(response.data.nonce);
        } catch {
          console.warn('Failed to fetch Google nonce');
        }
      };
      fetchNonce();
    }
  }, [isGoogleSsoEnabled]);

  const handleCredentialsSubmit = async (e: React.FormEvent) => {
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
      // Error handled in store
    }
  };

  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    try {
      await verifyOtp(otp);
    } catch {
      // Error handled in store
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

  const handleGoogleSuccess = async (credentialResponse: CredentialResponse) => {
    clearError();
    if (credentialResponse.credential) {
      try {
        await loginWithGoogle(credentialResponse.credential, googleNonce || undefined);
      } catch {
        if (isGoogleSsoEnabled) {
          try {
            const response = await apiClient.get<{ success: boolean; data: { nonce: string } }>(
              '/auth/google/nonce'
            );
            if (response.success) setGoogleNonce(response.data.nonce);
          } catch {
            // Ignore
          }
        }
      }
    }
  };

  const handleGoogleError = () => {};

  // Loading shell while hydrating, validating a persisted session, or
  // just-authenticated (redirect in flight)
  if (!_hasHydrated || !bootValidated || (isAuthenticated && user)) {
    return (
      <main className="relative min-h-screen">
        <MeshBackground />
        <div className="flex min-h-screen items-center justify-center">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-[var(--border)] border-t-transparent" />
        </div>
      </main>
    );
  }

  // ─── OTP verification step ──────────────────────────────────────────────────
  if (otpStep === 'otp') {
    return (
      <main className="relative min-h-screen">
        <MeshBackground />
        <div className="fixed left-4 top-4 z-10 sm:left-6 sm:top-6">
          <Link
            href={homeHref}
            className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-white/80 px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm backdrop-blur transition hover:border-transparent hover:bg-white dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10"
          >
            <FiHome size={12} />
            Home
          </Link>
        </div>
        <div className="fixed right-4 top-4 z-10 sm:right-6 sm:top-6">
          <ThemeToggle />
        </div>

        <div className="flex min-h-screen items-center justify-center px-4 py-16 sm:px-6">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className="w-full max-w-md"
          >
            <div className="relative overflow-hidden rounded-3xl border border-[var(--border)] bg-white/85 p-8 shadow-2xl shadow-black/10 backdrop-blur-xl dark:border-white/10 dark:bg-[var(--card)]/85 sm:p-10">
              <div className="mb-7 text-center">
                <div className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[var(--primary-500)] to-[var(--accent-500)] text-white shadow-lg shadow-black/25">
                  <FiShield size={22} />
                </div>
                <h1 className="mt-5 text-2xl font-bold text-[var(--foreground)] dark:text-white sm:text-3xl">
                  Verify it&rsquo;s you
                </h1>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                  We sent a 6-digit code to{' '}
                  <span className="font-semibold text-[var(--foreground)]">{otpEmail}</span>
                </p>
              </div>

              {otpMessage && !error && (
                <div className="mb-5 flex items-start gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3">
                  <FiMail className="mt-0.5 h-5 w-5 flex-shrink-0 text-emerald-600 dark:text-emerald-400" />
                  <p className="text-sm text-emerald-700 dark:text-emerald-300">{otpMessage}</p>
                </div>
              )}

              {error && <ErrorAlert message={error} className="mb-5" />}

              <form onSubmit={handleOtpSubmit} className="space-y-5">
                <div>
                  <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                    Verification code
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="000000"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    required
                    autoFocus
                    maxLength={6}
                    className="w-full rounded-xl border border-[var(--border)] bg-white/80 px-4 py-3 text-center font-mono text-2xl tracking-[0.5em] text-[var(--foreground)] outline-none transition placeholder:text-slate-400 placeholder:tracking-normal placeholder:text-base focus:border-[var(--border)] focus:ring-2 focus:ring-[var(--primary-600)]/25 dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder:text-slate-500"
                  />
                </div>

                {otpRemainingAttempts !== null && (
                  <p className="text-center text-xs text-slate-500 dark:text-slate-400">
                    {otpRemainingAttempts} attempts remaining
                  </p>
                )}

                <Button
                  type="submit"
                  className="w-full h-12 rounded-full bg-[var(--primary-600)] text-sm font-bold text-white shadow-lg shadow-black/25 transition hover:scale-[1.02] hover:bg-[var(--primary-700)]"
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
                    <span className="text-slate-500 dark:text-slate-400">
                      Resend in{' '}
                      <span className="font-mono font-semibold text-slate-700 dark:text-slate-200">
                        {otpCooldown}s
                      </span>
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={handleResendOtp}
                      disabled={isLoading}
                      className="font-semibold text-[var(--foreground)] transition hover:underline disabled:opacity-50"
                    >
                      Resend code
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleBackToCredentials}
                  className="flex w-full items-center justify-center gap-1.5 py-2 text-sm font-medium text-slate-500 transition hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100"
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

  // ─── Credentials step ───────────────────────────────────────────────────────
  return (
    <main className="relative min-h-screen">
      <MeshBackground />

      <div className="fixed left-4 top-4 z-10 sm:left-6 sm:top-6">
        <Link
          href={homeHref}
          className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-white/80 px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm backdrop-blur transition hover:border-transparent hover:bg-white dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10"
        >
          <FiHome size={12} />
          Home
        </Link>
      </div>
      <div className="fixed right-4 top-4 z-10 sm:right-6 sm:top-6">
        <ThemeToggle />
      </div>

      <div className="flex min-h-screen items-center justify-center px-4 py-16 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: 'easeOut' }}
          className="w-full max-w-md"
        >
          {/* Brand */}
          <div className="mb-6 flex flex-col items-center gap-2">
            <ArixMark size={56} />
            <ArixWordmark className="text-2xl" />
          </div>

          {/* Card */}
          <div className="relative overflow-hidden rounded-3xl border border-[var(--border)] bg-white/85 p-7 shadow-2xl shadow-black/10 backdrop-blur-xl dark:border-white/10 dark:bg-[var(--card)]/85 sm:p-9">
            <div className="mb-7 text-center">
              <h1 className="text-3xl font-bold tracking-tight text-[var(--foreground)] dark:text-white sm:text-4xl">
                Welcome{' '}
                <span className="bg-gradient-to-r from-[var(--primary-500)] to-[var(--accent-500)] bg-clip-text text-transparent">
                  back
                </span>
              </h1>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                {loginSubtitle}
              </p>
            </div>

            {logoutNotice && !error && (
              <div
                role="status"
                className="mb-5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-300"
              >
                {logoutNotice}
              </div>
            )}

            {error && <ErrorAlert message={error} className="mb-5" />}

            <form onSubmit={handleCredentialsSubmit} className="space-y-4">
              {/* Email */}
              <div>
                <label
                  htmlFor="email"
                  className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300"
                >
                  Email
                </label>
                <div className="relative">
                  <FiUser className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    autoComplete="email"
                    autoFocus
                    className="w-full rounded-xl border border-[var(--border)] bg-white/80 py-2.5 pl-10 pr-3.5 text-sm text-[var(--foreground)] outline-none transition placeholder:text-slate-400 focus:border-[var(--border)] focus:ring-2 focus:ring-[var(--primary-600)]/25 dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder:text-slate-500"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label
                  htmlFor="password"
                  className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300"
                >
                  Password
                </label>
                <div className="relative">
                  <FiLock className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    className="w-full rounded-xl border border-[var(--border)] bg-white/80 py-2.5 pl-10 pr-10 text-sm text-[var(--foreground)] outline-none transition placeholder:text-slate-400 focus:border-[var(--border)] focus:ring-2 focus:ring-[var(--primary-600)]/25 dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder:text-slate-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    tabIndex={-1}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-slate-700 dark:hover:text-slate-200"
                  >
                    {showPassword ? <FiEyeOff size={16} /> : <FiEye size={16} />}
                  </button>
                </div>
              </div>

              <div className="flex justify-end">
                <Link
                  href="/forgot-password"
                  className="text-xs font-semibold text-[var(--foreground)] transition hover:underline"
                >
                  Forgot password?
                </Link>
              </div>

              <Button
                type="submit"
                className="group w-full h-12 rounded-full bg-[var(--primary-600)] text-sm font-bold text-white shadow-lg shadow-black/25 transition hover:scale-[1.02] hover:bg-[var(--primary-700)]"
                loading={isLoading}
                disabled={!username || !password}
              >
                <span className="flex items-center justify-center gap-2">
                  {isLoading ? 'Signing in…' : 'Sign in'}
                  {!isLoading && (
                    <FiArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />
                  )}
                </span>
              </Button>
            </form>

            {isGoogleSsoEnabled && (
              <>
                <div className="my-6 flex items-center gap-4">
                  <div className="h-px flex-1 bg-slate-200 dark:bg-white/10" />
                  <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                    or continue with
                  </span>
                  <div className="h-px flex-1 bg-slate-200 dark:bg-white/10" />
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

            <p className="mt-7 text-center text-sm text-slate-600 dark:text-slate-300">
              Don&rsquo;t have an account?{' '}
              <Link
                href="/signup"
                className="font-semibold text-[var(--foreground)] transition hover:underline"
              >
                Sign up
              </Link>
            </p>
          </div>

          {/* Channel chips — same branding as the landing Hero */}
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

          <p className="mt-5 text-center text-[11px] text-slate-500 dark:text-slate-400">
            By signing in, you agree to our{' '}
            <Link href="/terms" className="font-semibold hover:text-[var(--foreground)] hover:underline">
              Terms
            </Link>{' '}
            &amp;{' '}
            <Link href="/privacy" className="font-semibold hover:text-[var(--foreground)] hover:underline">
              Privacy
            </Link>
            .
          </p>
        </motion.div>
      </div>
    </main>
  );
}
