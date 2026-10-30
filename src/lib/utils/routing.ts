const APEX_HOST = 'arixcall.com';
const APP_HOST = 'app.arixcall.com';
const ADMIN_HOST = 'admin.arixcall.com';

// Any host in the arixcall.com family (apex, www, or any subdomain). The
// leading `(^|\.)` guards against look-alikes like "evilarixcall.com".
const ARIX_DOMAIN = /(^|\.)arixcall\.com$/i;

/**
 * Host-aware URL for the arixcall.com subdomain split.
 *   'app'   → the dialer   (app.arixcall.com)
 *   'admin' → the portals  (admin.arixcall.com)
 *
 * On ANY arixcall.com host (including the bare apex and www) it returns an
 * ABSOLUTE URL on the target subdomain, so a click crosses in a single hop
 * (auth carries via the shared `.arixcall.com` SSO cookie). Everywhere else —
 * the sslip.io test box, localhost, nuxcall.com, all single-host — it returns
 * the plain relative path, so those environments behave exactly as before.
 */
export function crossAppHref(target: 'app' | 'admin', path: string): string {
  if (typeof window !== 'undefined' && ARIX_DOMAIN.test(window.location.hostname)) {
    return `https://${target === 'app' ? APP_HOST : ADMIN_HOST}${path}`;
  }
  return path;
}

/**
 * The public landing page ("home"). It lives on the apex (arixcall.com), NOT on
 * the app subdomains (whose roots redirect to /login). So from any arixcall.com
 * host this returns the absolute apex URL; off arixcall (test box, localhost)
 * it's the plain "/".
 */
export function landingHomeHref(): string {
  if (typeof window !== 'undefined' && ARIX_DOMAIN.test(window.location.hostname)) {
    return `https://${APEX_HOST}/`;
  }
  return '/';
}

export function getDefaultRouteForRole(role: string | undefined): string {
  switch (role) {
    // Platform admin. The canonical JWT role string is 'super_admin' (underscore)
    // — used everywhere else (the /phone guard, usePermissions, useSuperadmin).
    // Without this exact case it fell through to the '/phone' default, so an admin
    // login landed on app.arixcall.com/phone and only THEN got bounced to /admin
    // by the /phone guard — a visible cross-subdomain double-hop. 'superadmin'
    // (no underscore) is the legacy pre-migration-022 spelling; keep both.
    case 'super_admin':
    case 'superadmin':
    case 'admin':
      return '/admin';
    // Owners are agents too (all have a SIP extension), so they land on the
    // DIALER by default and reach the org portal (/org) via the dialer's portal
    // switcher — same as managers. (Was '/org'.)
    case 'owner':
      return '/phone';
    case 'manager':
      return '/phone';
    default:
      return '/phone';
  }
}

/**
 * Which arixcall app an in-app path belongs to: the portals (/admin, /org) live
 * on admin.arixcall.com; everything else (the dialer) on app.arixcall.com.
 */
export function appForPath(path: string): 'app' | 'admin' {
  return path.startsWith('/admin') || path.startsWith('/org') ? 'admin' : 'app';
}

/**
 * Where to land AFTER a successful login. There is ONE login for everyone, so we
 * route purely by ROLE — never by which host the login happened to be served on:
 *   admin / super_admin → /admin  (admin.arixcall.com)
 *   owner               → /org    (admin.arixcall.com)
 *   manager / user      → /phone  (app.arixcall.com)
 * On arixcall.com this is an ABSOLUTE URL on the role's subdomain (auth carries
 * via the shared .arixcall.com SSO cookie → a single cross-subdomain hop). On the
 * test box / localhost / nuxcall (single host) it's the plain relative path.
 */
export function postLoginHref(role: string | undefined): string {
  const path = getDefaultRouteForRole(role);
  if (typeof window !== 'undefined' && ARIX_DOMAIN.test(window.location.hostname)) {
    return crossAppHref(appForPath(path), path);
  }
  return path;
}
