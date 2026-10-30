/**
 * Stable, per-browser device identifier for concurrent-session (device-limit)
 * management.
 *
 * The backend enforces a max concurrent-devices cap (`maxLoginSessions`, default
 * 3) and de-dupes "the same device re-logging in" by a device fingerprint. When
 * the client sends NO device id, the backend falls back to `ua:sha256(userAgent)`
 * — which is NOT unique per browser (every login from the same browser build
 * shares one hash and all web logins arrive from the frontend proxy IP), so the
 * de-dupe is skipped and EVERY login (each tab, each subdomain, each re-login)
 * counts as a brand-new device. A user on app.arixcall.com + admin.arixcall.com
 * + a phone quickly exceeds 3 → the oldest session is evicted → "logged in on
 * too many devices" / gets signed out unexpectedly.
 *
 * Sending a stable, client-generated id (persisted here) as `deviceId` on login
 * lets the backend treat this browser as ONE device across tabs, subdomains, and
 * re-logins — the standard device-id pattern for concurrent-session management.
 * It only IDENTIFIES the browser; it is NOT a secret and carries no auth weight
 * (hence a plain, JS-readable cookie is fine — unlike the session token).
 *
 * Storage: on arixcall.com we persist it in a cookie scoped to `.arixcall.com`
 * so BOTH subdomains (app.* and admin.*) share ONE id — `localStorage` is
 * per-origin and would otherwise give the same physical browser two ids. A
 * `localStorage` mirror is kept as a fallback (and is the only store off
 * arixcall, e.g. the test box / localhost / nuxcall).
 *
 * @module lib/device-id
 */

const STORAGE_KEY = 'arixcall.deviceId';
const COOKIE_NAME = 'arix_device_id';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

function isArixHost(): boolean {
  return typeof window !== 'undefined' && /(^|\.)arixcall\.com$/i.test(window.location.hostname);
}

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const m = document.cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return m ? decodeURIComponent(m[1]) : null;
}

function writeSharedCookie(id: string): void {
  if (typeof document === 'undefined' || !isArixHost()) return;
  const secure = window.location.protocol === 'https:' ? '; secure' : '';
  document.cookie = `${COOKIE_NAME}=${encodeURIComponent(id)}; domain=.arixcall.com; path=/; max-age=${COOKIE_MAX_AGE}; samesite=Lax${secure}`;
}

function generateId(): string {
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `dev-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

/**
 * Get (or lazily create) this browser's stable device id, shared across
 * *.arixcall.com subdomains. Returns undefined during SSR or when storage is
 * fully unavailable — in which case the backend falls back to its previous
 * user-agent behaviour, so nothing breaks.
 */
export function getDeviceId(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  try {
    // Prefer the shared cross-subdomain cookie so app.* and admin.* agree.
    let id = isArixHost() ? readCookie(COOKIE_NAME) : null;
    if (!id) {
      try {
        id = window.localStorage.getItem(STORAGE_KEY);
      } catch {
        id = null;
      }
    }
    if (!id) id = generateId();
    // Persist to both stores (idempotent) so the id is stable + shared.
    try {
      window.localStorage.setItem(STORAGE_KEY, id);
    } catch {
      /* storage disabled — cookie still carries it on arixcall */
    }
    writeSharedCookie(id);
    return id;
  } catch {
    return undefined;
  }
}
