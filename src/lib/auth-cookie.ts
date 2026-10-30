/**
 * Legacy cross-subdomain SSO cleanup for *.arixcall.com.
 *
 * Cross-subdomain auth is now carried by the HttpOnly `arix_session` cookie that
 * the BFF proxy mints and reads server-side (see `app/api/proxy/[...path]/route.ts`).
 * That is the OWASP-recommended shape (HttpOnly + backend-for-frontend), so we no
 * longer write a JS-readable token cookie.
 *
 * This module now exists only to READ (for backward-compat during the rollout,
 * old clients may still hold an `arix_sso`) and to CLEAR the legacy cookie on
 * logout. `writeSsoCookie` is retained as a no-op so existing call sites compile.
 */

const SSO_COOKIE = 'arix_sso';

/** True only on an arixcall.com host (root or any subdomain). */
export function isArixHost(): boolean {
  return (
    typeof window !== 'undefined' && /(^|\.)arixcall\.com$/i.test(window.location.hostname)
  );
}

/** Read the shared SSO token cookie, or null. */
export function readSsoCookie(): string | null {
  if (typeof document === 'undefined') return null;
  const m = document.cookie.match(/(?:^|;\s*)arix_sso=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

/**
 * @deprecated No-op. Cross-subdomain auth is now carried by the **HttpOnly**
 * `arix_session` cookie minted server-side by the BFF proxy. We intentionally no
 * longer write a JS-readable token cookie — per OWASP, a token readable by
 * JavaScript is an XSS-exfiltration risk. Kept so existing call sites compile.
 */
export function writeSsoCookie(_token: string | null | undefined): void {
  void _token; // intentionally unused — retiring the JS-readable token cookie
}

/** Expire the shared SSO cookie (both the shared-domain and host-only forms). */
export function clearSsoCookie(): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${SSO_COOKIE}=; domain=.arixcall.com; path=/; max-age=0; secure; samesite=Lax`;
  document.cookie = `${SSO_COOKIE}=; path=/; max-age=0`;
}
