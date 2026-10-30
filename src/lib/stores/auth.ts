'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  apiClient,
  invalidateTokenCache,
  clearTokenCache,
  onSessionExpired,
  markSessionValid,
  SessionExpiredError,
  ApiError,
} from '@/lib/api/client';
import { authApiService } from '@/lib/api/services/auth.service';
import { writeSsoCookie, clearSsoCookie } from '@/lib/auth-cookie';
import { getDeviceId } from '@/lib/device-id';
import { clearQueryCache, invalidateAllQueries } from '@/lib/providers/QueryProvider';
// Engine router (SIP.js or LiveKit, whichever is active) — see lib/call/call-engine.
import { callEngine as sipManager } from '@/lib/call/call-engine';
import type {
  User,
  LoginCredentials,
  ApiResponse,
  LoginData,
  AuthState,
  OtpVerifyRequest,
} from '@/lib/types';

/**
 * Token refresh constants
 */
const TOKEN_REFRESH_THRESHOLD_MS = 5 * 60 * 1000; // Refresh 5 minutes before expiry
const TOKEN_CHECK_INTERVAL_MS = 60 * 1000; // Check every minute

interface RefreshTokenResponse {
  token: string;
  expiresAt: string;
}

// ============================================================
// OTP State (for admin 2FA authentication flow)
// Note: OTP state is kept in auth store because it leads to
// authenticated state - separating would add unnecessary complexity
//
// SECURITY NOTE: Password is temporarily stored in memory during OTP flow.
// - NOT persisted to localStorage (excluded from partialize)
// - Cleared immediately after successful OTP verification
// - Only exists for the duration of the OTP verification process
//
// FUTURE IMPROVEMENT: Backend should issue a temporary OTP session token
// after initial credential check, eliminating need to retain password.
// See FUTUREFIX.md for details.
// ============================================================

/**
 * OTP login step
 */
type OtpStep = 'credentials' | 'otp' | 'complete';

/**
 * OTP state for admin 2FA flow
 */
interface OtpState {
  otpStep: OtpStep;
  otpEmail: string | null;
  otpPassword: string | null;
  otpCooldown: number;
  otpExpiresIn: number;
  otpRemainingAttempts: number | null;
  otpMessage: string | null;
}

interface AuthStore extends AuthState, OtpState {
  // Hydration state - tracks if zustand has loaded from localStorage
  _hasHydrated: boolean;
  setHasHydrated: (state: boolean) => void;
  // Auth methods
  login: (credentials: LoginCredentials) => Promise<void>;
  loginWithGoogle: (idToken: string, nonce?: string) => Promise<void>;
  logout: () => void;
  setUser: (user: User) => void;
  setLoading: (loading: boolean) => void;
  clearError: () => void;
  checkAuth: (opts?: { silent?: boolean }) => Promise<void>;
  refreshToken: () => Promise<boolean>;
  startTokenRefreshTimer: () => void;
  stopTokenRefreshTimer: () => void;
  // Phone number methods
  switchActivePhone: (phoneNumber: string) => Promise<void>;
  // OTP methods
  checkOtpRequired: (email: string, password: string) => Promise<boolean>;
  sendOtp: () => Promise<boolean>;
  verifyOtp: (otp: string) => Promise<void>;
  resetOtpState: () => void;
  setOtpCooldown: (seconds: number) => void;
}

// Use ReturnType for browser compatibility (NodeJS.Timeout is not available in browser)
let refreshTimerId: ReturnType<typeof setInterval> | null = null;
let otpCooldownTimerId: ReturnType<typeof setInterval> | null = null;

/**
 * Is this error a DEFINITIVE auth rejection (our credential is genuinely not
 * accepted) vs a TRANSIENT failure (network error / 5xx / backend blip)?
 *
 * Only a 401 means "logged out for real". The apiClient surfaces a 401 two ways
 * depending on the endpoint: `SessionExpiredError` for normal (non-`/auth/`)
 * calls, and a typed `ApiError` with `status === 401` for the `/auth/*` endpoints
 * (`/auth/me`, `/auth/refresh-token`), which are excluded from the global
 * SessionExpired path so login flows keep working. A network error throws a plain
 * Error (no `status`) → NOT definitive → the session is kept. This single rule is
 * what prevents a momentary blip from evicting a valid session.
 */
const isDefinitiveAuthRejection = (err: unknown): boolean =>
  err instanceof SessionExpiredError || (err instanceof ApiError && err.status === 401);

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      // Hydration state
      _hasHydrated: false,
      setHasHydrated: (state: boolean) => set({ _hasHydrated: state }),
      // Auth state
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      expiresAt: null,
      token: null,
      // OTP state
      otpStep: 'credentials' as OtpStep,
      otpEmail: null,
      otpPassword: null,
      otpCooldown: 0,
      otpExpiresIn: 0,
      otpRemainingAttempts: null,
      otpMessage: null,

      login: async (credentials: LoginCredentials) => {
        set({ isLoading: true, error: null });
        try {
          const response = await apiClient.post<ApiResponse<LoginData>>('/auth/login', {
            username: credentials.username,
            password: credentials.password,
            rememberMe: true,
            userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
            // Stable per-browser id so this browser counts as ONE device across
            // tabs/subdomains/re-logins (avoids spurious "too many devices" evictions).
            deviceId: getDeviceId(),
          });

          const loginData = response.data;

          set({
            user: loginData.user,
            expiresAt: loginData.expiresAt,
            token: loginData.token || null,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          });

          // Mark session as valid (clears session expired flag)
          markSessionValid();

          // Update token cache for API client
          invalidateTokenCache();
          // Mirror the JWT into the cross-subdomain SSO cookie (arixcall.com
          // only; no-op elsewhere) so a sibling subdomain can adopt the session.
          writeSsoCookie(get().token);

          // Invalidate all queries to force fresh data fetch after login
          invalidateAllQueries();

          // Start token refresh timer
          get().startTokenRefreshTimer();
        } catch (error) {
          set({
            isLoading: false,
            error: error instanceof Error ? error.message : 'Login failed',
          });
          throw error;
        }
      },

      loginWithGoogle: async (idToken: string, nonce?: string) => {
        set({ isLoading: true, error: null });
        try {
          const response = await apiClient.post<ApiResponse<LoginData>>('/auth/google', {
            idToken,
            nonce,
            userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
            deviceId: getDeviceId(),
          });

          const loginData = response.data;

          set({
            user: loginData.user,
            expiresAt: loginData.expiresAt,
            token: loginData.token || null,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          });

          // Mark session as valid (clears session expired flag)
          markSessionValid();

          // Update token cache for API client
          invalidateTokenCache();
          // Mirror the JWT into the cross-subdomain SSO cookie (arixcall.com
          // only; no-op elsewhere) so a sibling subdomain can adopt the session.
          writeSsoCookie(get().token);

          // Invalidate all queries to force fresh data fetch after login
          invalidateAllQueries();

          // Start token refresh timer
          get().startTokenRefreshTimer();
        } catch (error) {
          set({
            isLoading: false,
            error: error instanceof Error ? error.message : 'Google login failed',
          });
          throw error;
        }
      },

      logout: () => {
        // Synchronously suppress any SIP auto-reconnect/re-register BEFORE we
        // tear anything down. Otherwise the transport-close handler (or failover
        // / keepalive) re-registers the extension milliseconds after logout, and
        // incoming calls keep ringing even on the landing page. Setting the
        // intent first guarantees the async disconnect below can't be raced by a
        // reconnect.
        sipManager.markIntentDisconnected();

        // Stop refresh timer first
        get().stopTokenRefreshTimer();

        // Disconnect SIP to prevent stale credentials on next login
        // This is critical - otherwise the next user will have the old user's display name
        sipManager.disconnect().catch(() => {
          // Ignore disconnect errors - we're logging out anyway
        });

        // Clear token cache for API client
        clearTokenCache();
        // Expire the cross-subdomain SSO cookie so sibling subdomains sign out too.
        clearSsoCookie();

        // Clear all React Query cache to prevent stale data on next login
        clearQueryCache();

        // Clear state immediately (synchronous - no waiting for API)
        set({
          user: null,
          isAuthenticated: false,
          error: null,
          expiresAt: null,
          token: null,
        });

        // Clear localStorage explicitly to ensure clean logout
        if (typeof window !== 'undefined') {
          localStorage.removeItem('auth-storage');
        }

        // Call logout API in background (don't wait for it)
        apiClient.post('/auth/logout', {}).catch(() => {
          // Ignore logout errors - we've already cleared local state
        });
      },

      setUser: (user: User) => {
        set({ user });
      },

      switchActivePhone: async (phoneNumber: string) => {
        try {
          const response = await apiClient.post<ApiResponse<User>>('/auth/active-phone', {
            phoneNumber,
          });
          if (response.success && response.data) {
            set({ user: response.data });
            // No invalidateAllQueries() — pages show data for ALL numbers.
            // Only the active phone (caller ID / SMS sender) changes.
            // SipProvider detects senderPhone change and re-registers SIP.
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Failed to switch phone number';
          set({ error: message });
          throw error;
        }
      },

      setLoading: (loading: boolean) => {
        set({ isLoading: loading });
      },

      clearError: () => {
        set({ error: null });
      },

      // Validate the current session against the backend (/auth/me) and self-heal.
      // `silent` skips the global `isLoading` toggle so a BACKGROUND revalidation
      // (rehydration / optimistic paths) never flashes a full-page spinner; the
      // user/isAuthenticated result is applied either way.
      checkAuth: async (opts?: { silent?: boolean }) => {
        const silent = opts?.silent ?? false;
        try {
          if (!silent) set({ isLoading: true });
          const response = await apiClient.get<ApiResponse<User>>('/auth/me');
          if (response.success) {
            // Mark session as valid (clears session expired flag)
            markSessionValid();
            set({
              user: response.data,
              isAuthenticated: true,
            });
            // Start refresh timer if authenticated
            get().startTokenRefreshTimer();
          } else {
            set({
              user: null,
              isAuthenticated: false,
            });
          }
        } catch (err) {
          // CRITICAL: distinguish a DEFINITIVE auth rejection from a TRANSIENT
          // failure. `checkAuth` runs on every admin/org/phone layout mount, on
          // socket connect, and on socket reconnect — so if we purged on *any*
          // throw, a momentary backend blip (a blue-green deploy returning 502/503
          // for a second, a network drop, a cold start, api.arixcall.com briefly
          // unreachable) would tear down a VALID session and log the user out with
          // no fixed time or trigger. That was the random-logout bug.
          //
          // Only a definitive 401 means our credential is genuinely not accepted —
          // expired, evicted, or a stale pre-cutover token. Purge only then. For a
          // network error or 5xx, KEEP the existing session untouched: the
          // credential is presumed still valid and the next checkAuth / API call
          // (or the refresh timer) re-validates once the backend recovers.
          // NOTE: `/auth/me` is an `/auth/` endpoint, so its 401 arrives as an
          // ApiError(status 401), NOT SessionExpiredError — isDefinitiveAuthRejection
          // handles both (keying off SessionExpiredError alone would miss real
          // expiries here and leave dead sessions alive).
          if (isDefinitiveAuthRejection(err)) {
            get().stopTokenRefreshTimer();
            clearTokenCache();
            clearSsoCookie();
            set({
              user: null,
              isAuthenticated: false,
              token: null,
              expiresAt: null,
            });
          } else {
            // Transient — do NOT log the user out. Leave user/isAuthenticated/token
            // as-is so a blip can't evict a valid session.
            console.warn('checkAuth: transient /auth/me failure — keeping session', err);
          }
        } finally {
          if (!silent) set({ isLoading: false });
        }
      },

      refreshToken: async () => {
        const { token, expiresAt } = get();

        // Only refresh if we have a token
        if (!token) {
          return false;
        }

        // Check if token needs refresh (expires within threshold)
        if (expiresAt) {
          const expiryTime = new Date(expiresAt).getTime();
          const now = Date.now();
          const timeUntilExpiry = expiryTime - now;

          // Don't refresh if more than 5 minutes remaining
          if (timeUntilExpiry > TOKEN_REFRESH_THRESHOLD_MS) {
            return true;
          }
        }

        try {
          const response = await apiClient.post<ApiResponse<RefreshTokenResponse>>(
            '/auth/refresh-token',
            {}
          );

          if (response.success) {
            set({
              token: response.data.token,
              expiresAt: response.data.expiresAt,
            });
            invalidateTokenCache();
            writeSsoCookie(response.data.token);
            return true;
          }
        } catch (error) {
          // Same transient-vs-definitive rule as checkAuth, and MORE important here:
          // this runs on a BACKGROUND timer (fires ~5 min before expiry), with no
          // user action — so logging out on any failure meant a single transient
          // blip during that silent refresh evicted a perfectly valid session.
          // Only a definitive 401 means the credential is actually rejected → log
          // out. For a network error or 5xx, keep the current token (it's still
          // valid — the refresh fires pre-expiry, so there's headroom) and let the
          // next timer tick retry once the backend recovers. `/auth/refresh-token`
          // is an `/auth/` endpoint, so a real 401 arrives as ApiError(401), not
          // SessionExpiredError — isDefinitiveAuthRejection covers both.
          if (isDefinitiveAuthRejection(error)) {
            console.warn('Token refresh rejected (401) — logging out');
            get().logout();
          } else {
            console.warn('Token refresh: transient failure — keeping session, will retry', error);
          }
        }

        return false;
      },

      startTokenRefreshTimer: () => {
        // Clear existing timer
        if (refreshTimerId) {
          clearInterval(refreshTimerId);
        }

        // Check token expiry periodically
        refreshTimerId = setInterval(() => {
          const { isAuthenticated, expiresAt } = get();

          if (!isAuthenticated || !expiresAt) {
            return;
          }

          const expiryTime = new Date(expiresAt).getTime();
          const now = Date.now();
          const timeUntilExpiry = expiryTime - now;

          // Refresh if expiring within threshold
          if (timeUntilExpiry <= TOKEN_REFRESH_THRESHOLD_MS && timeUntilExpiry > 0) {
            get().refreshToken();
          }

          // If already expired, logout
          if (timeUntilExpiry <= 0) {
            console.warn('Token expired, logging out');
            get().logout();
          }
        }, TOKEN_CHECK_INTERVAL_MS);
      },

      stopTokenRefreshTimer: () => {
        if (refreshTimerId) {
          clearInterval(refreshTimerId);
          refreshTimerId = null;
        }
      },

      // OTP Methods
      checkOtpRequired: async (email: string, password: string) => {
        set({ isLoading: true, error: null });
        try {
          const response = await authApiService.checkOtpRequired(email);

          if (response.requiresOtp) {
            // Store credentials for OTP flow
            set({
              otpStep: 'otp',
              otpEmail: email,
              otpPassword: password,
              otpMessage: response.message || 'OTP verification required',
              isLoading: false,
            });
            return true;
          }

          set({ isLoading: false });
          return false;
        } catch (error) {
          set({
            isLoading: false,
            error: error instanceof Error ? error.message : 'Failed to check OTP requirement',
          });
          return false;
        }
      },

      sendOtp: async () => {
        const { otpEmail } = get();
        if (!otpEmail) {
          set({ error: 'No email address for OTP' });
          return false;
        }

        set({ isLoading: true, error: null });
        try {
          const response = await authApiService.sendOtp(otpEmail);

          if (response.success) {
            set({
              otpMessage: response.message,
              otpRemainingAttempts: response.remainingAttempts ?? null,
              otpExpiresIn: response.expiresIn ?? 0,
              isLoading: false,
            });

            // Start cooldown if present
            if (response.cooldownRemaining) {
              get().setOtpCooldown(response.cooldownRemaining);
            }

            return true;
          } else {
            set({
              error: response.message,
              isLoading: false,
            });

            // Handle cooldown error
            if (response.cooldownRemaining) {
              get().setOtpCooldown(response.cooldownRemaining);
            }

            return false;
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to send OTP';
          set({
            isLoading: false,
            error: errorMessage,
          });
          return false;
        }
      },

      verifyOtp: async (otp: string) => {
        const { otpEmail, otpPassword } = get();
        if (!otpEmail || !otpPassword) {
          set({ error: 'Missing credentials for OTP verification' });
          throw new Error('Missing credentials');
        }

        set({ isLoading: true, error: null });
        try {
          const response = await authApiService.verifyOtp({
            email: otpEmail,
            otp,
            password: otpPassword,
            deviceId: getDeviceId(),
          });

          if (response.success && response.user) {
            set({
              user: response.user,
              token: response.token || null,
              expiresAt: response.expiresAt || null,
              isAuthenticated: true,
              isLoading: false,
              error: null,
              otpStep: 'complete',
              otpEmail: null,
              otpPassword: null,
              otpCooldown: 0,
              otpExpiresIn: 0,
              otpMessage: null,
            });

            // Mark session as valid (clears session expired flag)
            markSessionValid();

            // Update token cache for API client
            invalidateTokenCache();
            // Mirror the JWT into the cross-subdomain SSO cookie (arixcall only).
            writeSsoCookie(get().token);

            // Invalidate all queries to force fresh data fetch after login
            invalidateAllQueries();

            // Start token refresh timer
            get().startTokenRefreshTimer();
          } else {
            set({
              isLoading: false,
              error: response.message || 'OTP verification failed',
            });
            throw new Error(response.message || 'OTP verification failed');
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'OTP verification failed';
          set({
            isLoading: false,
            error: errorMessage,
          });
          throw error;
        }
      },

      resetOtpState: () => {
        // Clear cooldown timer
        if (otpCooldownTimerId) {
          clearInterval(otpCooldownTimerId);
          otpCooldownTimerId = null;
        }

        set({
          otpStep: 'credentials',
          otpEmail: null,
          otpPassword: null,
          otpCooldown: 0,
          otpExpiresIn: 0,
          otpRemainingAttempts: null,
          otpMessage: null,
          error: null,
        });
      },

      setOtpCooldown: (seconds: number) => {
        set({ otpCooldown: seconds });

        // Clear existing timer
        if (otpCooldownTimerId) {
          clearInterval(otpCooldownTimerId);
        }

        // Start countdown
        otpCooldownTimerId = setInterval(() => {
          const { otpCooldown } = get();
          if (otpCooldown <= 1) {
            if (otpCooldownTimerId) {
              clearInterval(otpCooldownTimerId);
              otpCooldownTimerId = null;
            }
            set({ otpCooldown: 0 });
          } else {
            set({ otpCooldown: otpCooldown - 1 });
          }
        }, 1000);
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
        expiresAt: state.expiresAt,
        token: state.token,
      }),
      onRehydrateStorage: () => (state) => {
        // Mark hydration complete FIRST. The app must never hang on the loading
        // spinner — this MUST run before anything that could mutate/throw, or a
        // layout gated on `_hasHydrated` would spin forever.
        state?.setHasHydrated(true);

        // Cross-subdomain session adoption: on a sibling *.arixcall.com subdomain
        // (e.g. landing on admin.* after logging in on app.*) THIS origin's
        // localStorage is empty, but the browser DID send the HttpOnly
        // `arix_session` cookie. We can't read it from JS (by design), so we
        // probe `/auth/me` through the BFF — which reads the cookie server-side
        // and authenticates us — to adopt the session. Deferred to a microtask so
        // we never mutate store state during the synchronous rehydration pass.
        // A 401 here (genuinely logged out) simply leaves us unauthenticated.
        if (state && !state.token && typeof window !== 'undefined') {
          queueMicrotask(() => {
            void useAuthStore.getState().checkAuth();
          });
        }

        // Listen for session expiration events from API client
        onSessionExpired(() => {
          // Clear state without making API call (session already expired)
          state?.stopTokenRefreshTimer();
          clearTokenCache();
          clearQueryCache();
          useAuthStore.setState({
            user: null,
            isAuthenticated: false,
            error: null,
            expiresAt: null,
            token: null,
          });
        });

        // Start refresh timer when store is rehydrated (page reload)
        if (state?.isAuthenticated && state?.token) {
          markSessionValid();
          state.startTokenRefreshTimer();
        }
      },
    }
  )
);

// Mirror the JWT into the cross-subdomain SSO cookie whenever the token changes:
// login / Google / OTP / refresh set a token → write; logout sets null → clear.
// Both writeSsoCookie and clearSsoCookie are no-ops off arixcall.com, so this is
// inert for nuxcall/sslip.io/localhost.
if (typeof window !== 'undefined') {
  useAuthStore.subscribe((state, prev) => {
    if (state.token === prev.token) return;
    if (state.token) writeSsoCookie(state.token);
    else clearSsoCookie();
  });
}
