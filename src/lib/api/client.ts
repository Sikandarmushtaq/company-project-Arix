'use client';

import { readSsoCookie } from '@/lib/auth-cookie';

// Use Next.js API route proxy for proper cookie handling
// Backend URL is configured via NEXT_PUBLIC_SOCKET_URL environment variable
const API_BASE_URL = '/api/proxy';

interface RequestOptions extends RequestInit {
  params?: Record<string, string | number | boolean | undefined>;
  responseType?: 'json' | 'blob' | 'text';
  /** Per-request timeout in ms. Defaults to DEFAULT_TIMEOUT_MS; 0 disables. */
  timeout?: number;
}

/**
 * Hard ceiling so a request can never hang forever (fetch has NO timeout by
 * default — a stalled request on a poor connection otherwise hangs the caller,
 * which was jamming the dialer's call lock). Kept generous (60s) so slow-but-alive
 * links (e.g. Pakistan) and ordinary heavy calls aren't cut short. Callers override
 * per request: the call path uses a tight timeout (fail fast); long bulk mutations
 * (import/delete/assign) pass `timeout: 0` to disable it so they can't be aborted
 * mid-flight (partial-apply risk).
 */
const DEFAULT_TIMEOUT_MS = 60000;

/** Thrown when a request exceeds its timeout (distinct from a network error). */
export class RequestTimeoutError extends Error {
  constructor(ms: number) {
    super(`Request timed out after ${Math.round(ms / 1000)}s`);
    this.name = 'RequestTimeoutError';
  }
}

// ============================================================
// Session Expiration Handling (Event-based)
//
// Uses browser CustomEvent for clean decoupling between API client
// and auth state management. Prevents burst of errors when session
// expires by detecting expiration once and failing subsequent
// requests fast without hitting the server.
// ============================================================
const SESSION_EXPIRED_EVENT = 'app:session-expired';
let sessionExpired = false;

/**
 * Session expired event - dispatched once when session expiration is detected
 */
export function dispatchSessionExpired(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT));
  }
}

/**
 * Subscribe to session expired events
 * @returns Cleanup function to remove listener
 */
export function onSessionExpired(handler: () => void): () => void {
  if (typeof window === 'undefined') return () => {};

  window.addEventListener(SESSION_EXPIRED_EVENT, handler);
  return () => window.removeEventListener(SESSION_EXPIRED_EVENT, handler);
}

/**
 * Mark session as valid (call after successful login)
 */
export function markSessionValid(): void {
  sessionExpired = false;
}

/**
 * Custom error for session expiration
 */
export class SessionExpiredError extends Error {
  constructor() {
    super('Session expired');
    this.name = 'SessionExpiredError';
  }
}

/**
 * A non-OK HTTP response, carrying the status code so callers can distinguish a
 * DEFINITIVE auth rejection (401) from a TRANSIENT failure (network/5xx). This is
 * what lets the auth store avoid logging a valid user out on a momentary backend
 * blip: 401 → tear down, everything else → keep the session. (A fetch/network
 * error throws a plain Error with no `status`, which the caller treats as
 * transient — exactly the desired behavior.)
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

// ============================================================
// Token Cache - Avoids JSON.parse on every API request
// ============================================================
const AUTH_STORAGE_KEY = 'auth-storage';
let cachedToken: string | null = null;
let cacheInitialized = false;

/**
 * Initialize token cache and listen for storage changes
 * Called once when module loads in browser
 */
function initTokenCache(): void {
  if (typeof window === 'undefined' || cacheInitialized) return;

  // Parse initial token
  cachedToken = parseTokenFromStorage();
  cacheInitialized = true;

  // Listen for storage changes (other tabs, logout, etc.)
  window.addEventListener('storage', (event) => {
    if (event.key === AUTH_STORAGE_KEY) {
      cachedToken = parseTokenFromStorage();
    }
  });
}

/**
 * Parse token from localStorage (called only when cache is invalid)
 */
function parseTokenFromStorage(): string | null {
  try {
    const stored = localStorage.getItem(AUTH_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed.state?.token) return parsed.state.token;
    }
  } catch {
    // Ignore parse errors
  }
  // Cross-subdomain SSO fallback: a sibling *.arixcall.com subdomain's login
  // (localStorage is per-origin; the shared cookie is not). No-op elsewhere.
  return readSsoCookie();
}

/**
 * Get cached token (fast path) or parse from storage (slow path)
 */
function getStoredToken(): string | null {
  if (typeof window === 'undefined') return null;

  // Initialize cache on first access
  if (!cacheInitialized) {
    initTokenCache();
  }

  return cachedToken;
}

/**
 * Invalidate token cache - call on login/logout
 * Exported for use by auth store
 */
export function invalidateTokenCache(): void {
  cachedToken = parseTokenFromStorage();
}

/**
 * Clear token cache - call on logout
 * Exported for use by auth store
 */
export function clearTokenCache(): void {
  cachedToken = null;
}

/**
 * Public accessor for the current Bearer token. Used to inject the token into
 * same-origin media stream URLs (`?token=`), which the proxy converts into an
 * Authorization header — `<audio>`/`<video>` elements can't set headers, so a
 * plain stream URL would 401. Returns null when signed out / on the server.
 */
export function getAuthToken(): string | null {
  return getStoredToken();
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    const { params, responseType = 'json', timeout = DEFAULT_TIMEOUT_MS, ...fetchOptions } = options;

    // Fast-fail if session is known to be expired (prevents burst of server requests)
    // Skip check for auth endpoints to allow login/logout to work
    const isAuthEndpoint = endpoint.startsWith('/auth/');
    if (sessionExpired && !isAuthEndpoint) {
      throw new SessionExpiredError();
    }

    let url = `${this.baseUrl}${endpoint}`;

    if (params) {
      const searchParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          searchParams.append(key, String(value));
        }
      });
      const queryString = searchParams.toString();
      if (queryString) {
        url += `?${queryString}`;
      }
    }

    // Build headers with Authorization token if available
    const token = getStoredToken();
    const headers: HeadersInit = {
      ...options.headers,
    };

    // Only set Content-Type for non-blob, non-FormData requests.
    // FormData needs the browser to auto-set Content-Type with the multipart boundary.
    const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
    if (responseType !== 'blob' && !isFormData) {
      (headers as Record<string, string>)['Content-Type'] = 'application/json';
    }

    if (token) {
      (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
    }

    // Timeout via AbortController so a stalled request fails fast instead of
    // hanging the caller forever (industry-standard fetch pattern).
    const controller = new AbortController();
    const timer = timeout > 0 ? setTimeout(() => controller.abort(), timeout) : null;
    let response: Response;
    try {
      response = await fetch(url, {
        ...fetchOptions,
        headers,
        credentials: 'include', // Send cookies with requests for session auth
        signal: controller.signal,
      });
    } catch (err) {
      // A timeout surfaces as an AbortError — translate it to a clear, typed error
      // so callers can show "couldn't reach the server, try again" and never hang.
      if (controller.signal.aborted) throw new RequestTimeoutError(timeout);
      throw err;
    } finally {
      if (timer) clearTimeout(timer);
    }

    if (!response.ok) {
      // For blob requests, don't try to parse JSON error
      if (responseType === 'blob') {
        throw new Error(`HTTP ${response.status}`);
      }

      // Parse error response - backend returns { success: false, error: { code, message, details? } }
      const errorResponse = await response.json().catch(() => null);

      // ANY 401 on a normal API call means our credential isn't accepted — an
      // expired/evicted session, OR a STALE token from a different backend (e.g. a
      // pre-cutover token still in localStorage / the session cookie after the
      // reskin was repointed to the arixcall API — signed with the old secret, so
      // arixcall rejects it). Treat them all the same: clear auth + bounce to
      // login, so migrated users never have to manually clear their cache to sign
      // in again. (Auth endpoints are excluded so a bad-password login stays a
      // normal error.)
      if (response.status === 401 && !isAuthEndpoint) {
        if (!sessionExpired) {
          sessionExpired = true;
          dispatchSessionExpired();
        }
        throw new SessionExpiredError();
      }

      // Extract error message from nested structure
      let errorMessage = `HTTP ${response.status}`;
      if (errorResponse?.error?.message) {
        errorMessage = errorResponse.error.message;
      } else if (errorResponse?.message) {
        errorMessage = errorResponse.message;
      }

      // Include field-level validation details if present
      if (errorResponse?.error?.details?.length > 0) {
        const details = errorResponse.error.details
          .map((d: { field: string; message: string }) => `${d.field}: ${d.message}`)
          .join(', ');
        errorMessage = `${errorMessage} (${details})`;
      }

      // Typed error carrying the HTTP status + backend code. Extends Error with the
      // same message, so existing `catch (e) { e.message }` callers are unaffected;
      // auth-flow callers additionally read `.status` to tell 401 from 5xx.
      throw new ApiError(errorMessage, response.status, errorResponse?.error?.code);
    }

    if (response.status === 204) {
      return {} as T;
    }

    // Handle different response types
    if (responseType === 'blob') {
      return response.blob() as Promise<T>;
    } else if (responseType === 'text') {
      return response.text() as Promise<T>;
    }

    return response.json();
  }

  async get<T>(endpoint: string, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'GET' });
  }

  async post<T>(endpoint: string, data?: unknown, options?: RequestOptions): Promise<T> {
    const isFormData = typeof FormData !== 'undefined' && data instanceof FormData;
    return this.request<T>(endpoint, {
      ...options,
      method: 'POST',
      body: data ? (isFormData ? (data as BodyInit) : JSON.stringify(data)) : undefined,
    });
  }

  async put<T>(endpoint: string, data?: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async patch<T>(endpoint: string, data?: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async delete<T>(endpoint: string, options?: RequestOptions & { data?: unknown }): Promise<T> {
    const { data, ...restOptions } = options || {};
    return this.request<T>(endpoint, {
      ...restOptions,
      method: 'DELETE',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async upload<T>(endpoint: string, formData: FormData): Promise<T> {
    const token = getStoredToken();
    const headers: HeadersInit = {};

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'POST',
      headers,
      body: formData,
      credentials: 'include', // Send cookies with requests for session auth
    });

    if (!response.ok) {
      const errorResponse = await response.json().catch(() => null);
      let errorMessage = `HTTP ${response.status}`;
      if (errorResponse?.error?.message) {
        errorMessage = errorResponse.error.message;
      } else if (errorResponse?.message) {
        errorMessage = errorResponse.message;
      }
      throw new Error(errorMessage);
    }

    return response.json();
  }

  /**
   * Download a blob via POST request (for bulk downloads)
   * Returns both the blob and filename from Content-Disposition header
   */
  async downloadBlob(endpoint: string, data?: unknown): Promise<{ blob: Blob; filename: string }> {
    const token = getStoredToken();
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'POST',
      headers,
      body: data ? JSON.stringify(data) : undefined,
      credentials: 'include',
    });

    if (!response.ok) {
      const errorResponse = await response.json().catch(() => null);
      let errorMessage = `HTTP ${response.status}`;
      if (errorResponse?.error?.message) {
        errorMessage = errorResponse.error.message;
      } else if (errorResponse?.message) {
        errorMessage = errorResponse.message;
      }
      throw new Error(errorMessage);
    }

    // Extract filename from Content-Disposition. If a download endpoint
    // ever forgets to set this header, fall back to a safe placeholder
    // with a known extension — anything is better than the bare string
    // 'download' which causes browsers to invent a `.txt` extension and
    // save an empty file alongside the real one.
    let filename = 'download.bin';
    const contentDisposition = response.headers.get('content-disposition');
    if (contentDisposition) {
      const match = contentDisposition.match(/filename="(.+?)"/);
      if (match) {
        filename = match[1];
      }
    }

    const blob = await response.blob();
    return { blob, filename };
  }
}

export const apiClient = new ApiClient(API_BASE_URL);
export default apiClient;
